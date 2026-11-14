import { NextResponse } from "next/server"
import {
  ADMIN_SESSION_SECONDS,
  adminCookie,
  createAdminSession,
  isSameOriginWrite,
  safeEqual,
  verifyPassword,
  type AdminSession,
} from "@/lib/security"
import { getProductsDb } from "@/lib/products-db"
import { findUserByEmail, getStore, touchLogin } from "@/lib/stores-db"

// ============================================================================
// 관리자 로그인 — POST /api/admin/login  { email?, password }
// ============================================================================
// (2026-11-01) 마켓플레이스
//   · email 있음 → D1 store_users 계정 (입점사 owner·staff 또는 platform)
//                  입점사가 active 가 아니면(심사 중·정지) 못 들어옴
//   · email 없음 → 예전처럼 ADMIN_PASSWORD (플랫폼 운영자 비상 로그인)
// 성공하면
// HttpOnly·Secure·SameSite=Strict 서명 쿠키를 줍니다 (8시간).
//
// 무차별 대입 방지: 같은 IP 에서 10분에 5번 실패하면 잠시 막습니다.
// (Worker 인스턴스마다 따로 세므로 보조 수단입니다 — Cloudflare 대시보드의
//  Rate limiting rule 로 /api/admin/login 을 함께 막는 것을 권장합니다.)
// ============================================================================

const WINDOW_MS = 10 * 60 * 1000
const MAX_FAILS = 5
const fails = new Map<string, { n: number; at: number }>()

function clientIp(request: Request) {
  return request.headers.get("cf-connecting-ip") ?? "unknown"
}

export async function POST(request: Request) {
  if (!isSameOriginWrite(request)) {
    return NextResponse.json({ success: false, error: "허용되지 않은 요청 출처입니다" }, { status: 403 })
  }

  if (!process.env.ADMIN_SESSION_SECRET || process.env.ADMIN_SESSION_SECRET.length < 32) {
    return NextResponse.json(
      { success: false, error: "서버에 ADMIN_SESSION_SECRET(32자 이상)이 설정되지 않았습니다" },
      { status: 503 }
    )
  }

  const ip = clientIp(request)
  const now = Date.now()
  const rec = fails.get(ip)
  if (rec && now - rec.at < WINDOW_MS && rec.n >= MAX_FAILS) {
    return NextResponse.json(
      { success: false, error: "시도가 너무 많습니다. 10분 뒤 다시 해 주세요" },
      { status: 429, headers: { "Retry-After": "600" } }
    )
  }

  let password = ""
  let email = ""
  try {
    const body = (await request.json()) as { password?: unknown; email?: unknown }
    password = typeof body.password === "string" ? body.password.slice(0, 256) : ""
    email = typeof body.email === "string" ? body.email.trim().slice(0, 254) : ""
  } catch {
    /* 아래에서 실패 처리 */
  }

  const result = email ? await loginWithAccount(email, password) : await loginWithEnvPassword(password)

  if (!result.ok) {
    if (result.status === 401) {
      const cur = rec && now - rec.at < WINDOW_MS ? rec : { n: 0, at: now }
      fails.set(ip, { n: cur.n + 1, at: cur.at })
      await new Promise((r) => setTimeout(r, 400)) // 느리게 응답
    }
    return NextResponse.json({ success: false, error: result.error }, { status: result.status })
  }

  fails.delete(ip)
  const token = await createAdminSession(result.who)
  if (!token) {
    return NextResponse.json({ success: false, error: "세션 키 설정 오류" }, { status: 503 })
  }
  return NextResponse.json(
    { success: true, role: result.who.role },
    { headers: { "Set-Cookie": adminCookie(token, ADMIN_SESSION_SECONDS), "Cache-Control": "no-store" } }
  )
}

type LoginResult =
  | { ok: true; who: Omit<AdminSession, "exp"> }
  | { ok: false; status: number; error: string }

const BAD_LOGIN: LoginResult = { ok: false, status: 401, error: "이메일 또는 비밀번호가 올바르지 않습니다" }

async function loginWithEnvPassword(password: string): Promise<LoginResult> {
  const expected = process.env.ADMIN_PASSWORD ?? ""
  if (expected.length < 12) return { ok: false, status: 400, error: "이메일을 입력해 주세요" }
  if (!(await safeEqual(password, expected))) return { ok: false, status: 401, error: "비밀번호가 올바르지 않습니다" }
  return { ok: true, who: { uid: "env", role: "platform", sid: null, slug: null } }
}

async function loginWithAccount(email: string, password: string): Promise<LoginResult> {
  const db = await getProductsDb()
  if (!db) return { ok: false, status: 503, error: "D1 바인딩(DB)이 없습니다" }
  let user
  try {
    user = await findUserByEmail(db, email)
  } catch {
    return { ok: false, status: 503, error: "계정 테이블이 없습니다 — migrations/0001_multi_store.sql 을 먼저 실행하세요" }
  }
  // 계정이 없어도 같은 시간 걸리게 가짜 해시로 한 번 비교
  const hash =
    user?.password_hash ??
    "pbkdf2-sha256$100000$00000000000000000000000000000000$0000000000000000000000000000000000000000000000000000000000000000"
  const ok = await verifyPassword(password, hash)
  if (!user || !ok || user.disabled) return BAD_LOGIN

  if (user.role === "platform") {
    await touchLogin(db, user.id)
    return { ok: true, who: { uid: user.id, role: "platform", sid: null, slug: null } }
  }
  const store = user.store_id ? await getStore(db, user.store_id) : null
  if (!store) return BAD_LOGIN
  if (store.review_status === "rejected") {
    return {
      ok: false,
      status: 403,
      error: `입점 신청이 승인되지 않았습니다${store.review_note ? ` — ${store.review_note}` : ""}`,
    }
  }
  if (store.status !== "active") {
    return {
      ok: false,
      status: 403,
      error: store.status === "pending" ? "입점 심사 중입니다. 승인 뒤 로그인할 수 있습니다" : "정지된 입점사입니다",
    }
  }
  await touchLogin(db, user.id)
  return { ok: true, who: { uid: user.id, role: user.role, sid: store.id, slug: store.slug } }
}
