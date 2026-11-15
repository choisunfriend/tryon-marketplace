// ============================================================================
// (2026-11-15) 고객 API 공용 — 토큰 확인 · CORS · 시도 제한
// ============================================================================
// 고객 앱은 쿠키가 아니라 "Authorization: Bearer gy_…" 헤더로 로그인 상태를 보냅니다.
//   · 쿠키를 안 쓰므로 다른 사이트가 몰래 요청을 보내도(CSRF) 토큰이 따라가지 않음
//   · 아이폰 사파리의 iframe 쿠키 차단과도 상관없음 — 앱이 쇼핑몰 iframe 에 토큰을 넘겨주면 됨
//
// CORS 허용 출처 = APP_ORIGINS(웹앱) + CUSTOMER_APP_ORIGINS(네이티브 앱 껍데기)
//   CUSTOMER_APP_ORIGINS 기본값: capacitor://localhost https://localhost (Capacitor iOS · Android)
// ============================================================================

import { NextResponse } from "next/server"
import { getCloudflareContext } from "@opennextjs/cloudflare"
import { appOrigins } from "@/lib/security"
import { getProductsDb, type D1Database } from "@/lib/products-db"
import { customerFromToken, type Customer } from "@/lib/customers-db"
import { bi } from "@/i18n/l"

const DEFAULT_NATIVE_ORIGINS = ["capacitor://localhost", "https://localhost"]

export function customerOrigins(): string[] {
  const native = (process.env.CUSTOMER_APP_ORIGINS ?? "")
    .split(/[\s,]+/)
    .map((s) => s.trim())
    .filter((s) => /^(https|capacitor|ionic):\/\/[A-Za-z0-9.-]+(:\d+)?$/.test(s))
  return Array.from(new Set([...appOrigins(), ...(native.length ? native : DEFAULT_NATIVE_ORIGINS)]))
}

export function corsHeaders(request: Request): Record<string, string> {
  const h: Record<string, string> = {
    Vary: "Origin",
    "Cache-Control": "no-store",
  }
  const origin = request.headers.get("origin")
  if (origin && customerOrigins().includes(origin)) {
    h["Access-Control-Allow-Origin"] = origin
    h["Access-Control-Allow-Headers"] = "Authorization, Content-Type"
    h["Access-Control-Allow-Methods"] = "GET, POST, PATCH, PUT, DELETE, OPTIONS"
    h["Access-Control-Max-Age"] = "600"
  }
  return h
}

/** 미리 묻기(OPTIONS) 응답 */
export function preflight(request: Request): Response {
  return new Response(null, { status: 204, headers: corsHeaders(request) })
}

export function cjson(request: Request, body: unknown, status = 200): NextResponse {
  return NextResponse.json(body, { status, headers: corsHeaders(request) })
}

export function cfail(request: Request, error: string, status = 400): NextResponse {
  return cjson(request, { success: false, error }, status)
}

export function bearerToken(request: Request): string | null {
  const h = request.headers.get("authorization") ?? ""
  const m = /^Bearer\s+(\S{1,200})$/i.exec(h)
  return m ? m[1] : null
}

export function clientInfo(request: Request): { lang: string | null; country: string | null; ip: string } {
  const al = (request.headers.get("x-gyeol-lang") ?? request.headers.get("accept-language") ?? "").toLowerCase()
  const lang = al.startsWith("ko") ? "ko" : al ? "en" : null
  const c = (request.headers.get("cf-ipcountry") ?? "").toUpperCase()
  return { lang, country: /^[A-Z]{2}$/.test(c) && c !== "XX" ? c : null, ip: request.headers.get("cf-connecting-ip") ?? "unknown" }
}

type Ok = { db: D1Database; customer: Customer; tokenHash: string }
type Err = { err: NextResponse }

export async function customerDb(request: Request): Promise<{ db: D1Database } | Err> {
  const db = await getProductsDb()
  if (!db) return { err: cfail(request, bi("서버 설정 오류(DB)", "Server configuration error (DB)"), 503) }
  return { db }
}

/** 로그인(토큰) 필수 */
export async function requireCustomer(request: Request): Promise<Ok | Err> {
  const d = await customerDb(request)
  if ("err" in d) return d
  const token = bearerToken(request)
  if (!token) return { err: cfail(request, bi("로그인이 필요합니다", "Sign-in required"), 401) }
  try {
    const r = await customerFromToken(d.db, token)
    if (!r) return { err: cfail(request, bi("로그인이 만료되었습니다", "Your session has expired"), 401) }
    return { db: d.db, ...r }
  } catch {
    return { err: cfail(request, bi("계정 테이블이 없습니다 — migrations/0004_customers.sql 을 실행하세요", "Accounts table missing — run migrations/0004_customers.sql"), 503) }
  }
}

/** 토큰이 있으면 고객, 없거나 틀리면 null (로그인 연결용) */
export async function optionalCustomer(request: Request, db: D1Database): Promise<Customer | null> {
  const token = bearerToken(request)
  if (!token) return null
  const r = await customerFromToken(db, token)
  return r ? r.customer : null
}

// 고객 시작·로그인 시도 제한 — wrangler.jsonc 의 CUSTOMER_LIMITER (IP 당 1분 20번)
type Limiter = { limit(opts: { key: string }): Promise<{ success: boolean }> }
export async function overCustomerLimit(key: string): Promise<boolean> {
  try {
    const { env } = await getCloudflareContext({ async: true })
    const lim = (env as unknown as { CUSTOMER_LIMITER?: Limiter }).CUSTOMER_LIMITER
    if (!lim) return false
    return !(await lim.limit({ key })).success
  } catch {
    return false
  }
}

export async function readJson(request: Request): Promise<Record<string, unknown> | null> {
  const len = Number(request.headers.get("content-length") ?? "0")
  if (len > 32 * 1024) return null
  try {
    const t = await request.text()
    if (t.length > 32 * 1024) return null
    const v = t ? JSON.parse(t) : {}
    return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null
  } catch {
    return null
  }
}
