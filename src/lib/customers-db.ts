// ============================================================================
// (2026-11-15) 고객 계정 — D1 읽기·쓰기 (migrations/0004_customers.sql)
// ============================================================================
// 흐름
//   ① 앱 첫 실행: startAnonymous() → 가입 없는 고객 + 세션 토큰. 앱은 토큰을 안전한 저장소에 보관
//   ② 로그인(애플·구글·카카오): linkOrLogin()
//      · 그 로그인 수단이 처음이면 → 지금 고객(가입 전)에 연결해 정식 고객으로
//      · 이미 다른 고객에 연결돼 있으면 → 그 고객으로 들어가고, 지금(가입 전) 고객의 찜 목록을 옮긴 뒤 지움
//   ③ 매 요청: Authorization: Bearer <토큰> → customerFromToken()
//   ④ 탈퇴: deleteCustomer() — 고객·로그인 수단·세션·찜 전부 삭제 (앱스토어 필수 기능)
// 토큰은 DB 에 SHA-256 값만 저장 → DB 가 새어도 토큰으로 로그인할 수 없음
// ============================================================================

import type { D1Database } from "@/lib/products-db"
import type { VerifiedIdentity } from "@/lib/oidc"

export const SESSION_DAYS = 180
const MAX_SESSIONS_PER_CUSTOMER = 20
const MAX_WISHLIST = 500

export interface Customer {
  id: string
  kind: "anonymous" | "member"
  display_name: string | null
  email: string | null
  lang: string | null
  country: string | null
  disabled: number
  created_at: string
  updated_at: string
  last_seen_at: string | null
}

export interface PublicCustomer {
  id: string
  kind: "anonymous" | "member"
  displayName: string | null
  email: string | null
  lang: string | null
  providers: string[]
  createdAt: string
}

const nowIso = () => new Date().toISOString()

function toHex(buf: ArrayBuffer): string {
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
}

export async function hashToken(token: string): Promise<string> {
  return toHex(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token)))
}

function newToken(): string {
  // "gy_" + 32바이트 무작위 (hex 64자)
  return "gy_" + toHex(crypto.getRandomValues(new Uint8Array(32)).buffer)
}

export const TOKEN_RE = /^gy_[0-9a-f]{64}$/

export interface SessionMeta {
  platform: string | null
  deviceLabel: string | null
}

export function cleanSessionMeta(body: Record<string, unknown>): SessionMeta {
  const platform = body.platform === "ios" || body.platform === "android" || body.platform === "web" ? body.platform : null
  const raw = typeof body.deviceId === "string" ? body.deviceId.trim() : ""
  const deviceLabel = /^[A-Za-z0-9._:-]{1,128}$/.test(raw) ? raw : null
  return { platform, deviceLabel }
}

async function createSession(db: D1Database, customerId: string, meta: SessionMeta): Promise<{ token: string; expiresAt: string }> {
  const token = newToken()
  const now = nowIso()
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 86400_000).toISOString()
  await db
    .prepare(
      `INSERT INTO customer_sessions (token_hash, customer_id, platform, device_label, created_at, last_used_at, expires_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(await hashToken(token), customerId, meta.platform, meta.deviceLabel, now, now, expiresAt)
    .run()
  // 오래된 세션 정리 — 한 고객이 세션을 끝없이 쌓지 못하게
  await db
    .prepare(
      `DELETE FROM customer_sessions WHERE customer_id = ? AND token_hash NOT IN (
         SELECT token_hash FROM customer_sessions WHERE customer_id = ? ORDER BY created_at DESC LIMIT ?)`
    )
    .bind(customerId, customerId, MAX_SESSIONS_PER_CUSTOMER)
    .run()
  return { token, expiresAt }
}

export async function getCustomer(db: D1Database, id: string): Promise<Customer | null> {
  return db.prepare(`SELECT * FROM customers WHERE id = ?`).bind(id).first<Customer>()
}

export async function toPublic(db: D1Database, c: Customer): Promise<PublicCustomer> {
  const r = await db
    .prepare(`SELECT provider FROM customer_identities WHERE customer_id = ? ORDER BY created_at`)
    .bind(c.id)
    .all<{ provider: string }>()
  return {
    id: c.id,
    kind: c.kind,
    displayName: c.display_name,
    email: c.email,
    lang: c.lang,
    providers: (r.results ?? []).map((x) => x.provider),
    createdAt: c.created_at,
  }
}

/** 가입 없이 새 고객 + 세션 */
export async function startAnonymous(
  db: D1Database,
  meta: SessionMeta,
  info: { lang: string | null; country: string | null }
): Promise<{ customer: Customer; token: string; expiresAt: string }> {
  const id = crypto.randomUUID()
  const now = nowIso()
  await db
    .prepare(
      `INSERT INTO customers (id, kind, lang, country, created_at, updated_at, last_seen_at)
       VALUES (?, 'anonymous', ?, ?, ?, ?, ?)`
    )
    .bind(id, info.lang, info.country, now, now, now)
    .run()
  const s = await createSession(db, id, meta)
  return { customer: (await getCustomer(db, id))!, ...s }
}

/** 토큰 → 고객 (만료·정지·없음이면 null). 마지막 사용 시각은 1시간에 한 번만 갱신 */
export async function customerFromToken(db: D1Database, token: string): Promise<{ customer: Customer; tokenHash: string } | null> {
  if (!TOKEN_RE.test(token)) return null
  const th = await hashToken(token)
  const row = await db
    .prepare(
      `SELECT c.*, s.expires_at AS s_expires, s.last_used_at AS s_used
         FROM customer_sessions s JOIN customers c ON c.id = s.customer_id
        WHERE s.token_hash = ?`
    )
    .bind(th)
    .first<Customer & { s_expires: string; s_used: string | null }>()
  if (!row) return null
  const now = Date.now()
  if (Date.parse(row.s_expires) < now || row.disabled) return null
  if (!row.s_used || now - Date.parse(row.s_used) > 3600_000) {
    const iso = new Date(now).toISOString()
    await db.prepare(`UPDATE customer_sessions SET last_used_at = ? WHERE token_hash = ?`).bind(iso, th).run()
    await db.prepare(`UPDATE customers SET last_seen_at = ? WHERE id = ?`).bind(iso, row.id).run()
  }
  const { s_expires: _e, s_used: _u, ...customer } = row
  return { customer: customer as Customer, tokenHash: th }
}

export async function endSession(db: D1Database, tokenHash: string): Promise<void> {
  await db.prepare(`DELETE FROM customer_sessions WHERE token_hash = ?`).bind(tokenHash).run()
}

export async function endAllSessions(db: D1Database, customerId: string): Promise<void> {
  await db.prepare(`DELETE FROM customer_sessions WHERE customer_id = ?`).bind(customerId).run()
}

async function moveWishlist(db: D1Database, fromId: string, toId: string): Promise<void> {
  await db
    .prepare(
      `INSERT OR IGNORE INTO customer_wishlist (customer_id, product_id, created_at)
       SELECT ?, product_id, created_at FROM customer_wishlist WHERE customer_id = ?`
    )
    .bind(toId, fromId)
    .run()
}

export async function deleteCustomer(db: D1Database, id: string): Promise<void> {
  // ON DELETE CASCADE 가 꺼져 있는 환경도 있어 자식부터 직접 지움
  await db.prepare(`DELETE FROM customer_wishlist WHERE customer_id = ?`).bind(id).run()
  await db.prepare(`DELETE FROM customer_sessions WHERE customer_id = ?`).bind(id).run()
  await db.prepare(`DELETE FROM customer_identities WHERE customer_id = ?`).bind(id).run()
  await db.prepare(`DELETE FROM customers WHERE id = ?`).bind(id).run()
}

export class AccountError extends Error {
  constructor(
    message: string,
    public status = 400
  ) {
    super(message)
  }
}

/**
 * 로그인 수단 연결 또는 그 수단으로 로그인.
 * current: 지금 앱이 들고 있는 고객(없을 수 있음)
 * 돌려주는 값: 들어갈 고객 + 새 세션 토큰
 */
export async function linkOrLogin(
  db: D1Database,
  idt: VerifiedIdentity,
  current: Customer | null,
  meta: SessionMeta,
  info: { lang: string | null; country: string | null }
): Promise<{ customer: Customer; token: string; expiresAt: string; merged: boolean; created: boolean }> {
  const now = nowIso()
  const existing = await db
    .prepare(`SELECT customer_id FROM customer_identities WHERE provider = ? AND subject = ?`)
    .bind(idt.provider, idt.subject)
    .first<{ customer_id: string }>()

  let target: Customer | null = null
  let merged = false
  let created = false

  if (existing) {
    target = await getCustomer(db, existing.customer_id)
    if (!target) throw new AccountError("account missing", 500)
    if (target.disabled) throw new AccountError("account disabled", 403)
    if (current && current.id !== target.id) {
      if (current.kind === "anonymous") {
        // 가입 전 기기 데이터를 기존 계정으로 옮기고, 빈 껍데기는 지움
        await moveWishlist(db, current.id, target.id)
        await deleteCustomer(db, current.id)
        merged = true
      }
      // current 가 다른 정식 계정이면 건드리지 않고 그냥 target 으로 로그인(계정 전환)
    }
    await db
      .prepare(`UPDATE customer_identities SET last_login_at = ?, email = COALESCE(?, email) WHERE provider = ? AND subject = ?`)
      .bind(now, idt.email, idt.provider, idt.subject)
      .run()
  } else {
    if (current) {
      target = current // 지금 고객(가입 전 또는 정식)에 이 로그인 수단을 붙임
    } else {
      const id = crypto.randomUUID()
      await db
        .prepare(`INSERT INTO customers (id, kind, lang, country, created_at, updated_at) VALUES (?, 'member', ?, ?, ?, ?)`)
        .bind(id, info.lang, info.country, now, now)
        .run()
      target = (await getCustomer(db, id))!
      created = true
    }
    await db
      .prepare(
        `INSERT INTO customer_identities (provider, subject, customer_id, email, created_at, last_login_at)
         VALUES (?, ?, ?, ?, ?, ?)`
      )
      .bind(idt.provider, idt.subject, target.id, idt.email, now, now)
      .run()
  }

  // 정식 고객으로 올리고, 비어 있는 이름·이메일만 채움(고객이 고친 값은 덮어쓰지 않음)
  await db
    .prepare(
      `UPDATE customers SET kind = 'member',
              display_name = COALESCE(display_name, ?),
              email = COALESCE(email, ?),
              lang = COALESCE(lang, ?),
              updated_at = ?, last_seen_at = ?
        WHERE id = ?`
    )
    .bind(idt.name, idt.emailVerified ? idt.email : null, info.lang, now, now, target.id)
    .run()

  const s = await createSession(db, target.id, meta)
  return { customer: (await getCustomer(db, target.id))!, ...s, merged, created }
}

/** 로그인 수단 끊기 — 마지막 하나는 못 끊음(끊으면 계정에 다시 못 들어옴) */
export async function unlinkProvider(db: D1Database, customerId: string, provider: string): Promise<void> {
  const r = await db
    .prepare(`SELECT provider FROM customer_identities WHERE customer_id = ?`)
    .bind(customerId)
    .all<{ provider: string }>()
  const list = (r.results ?? []).map((x) => x.provider)
  if (!list.includes(provider)) throw new AccountError("not linked", 404)
  if (list.length <= 1) throw new AccountError("last login method", 409)
  await db.prepare(`DELETE FROM customer_identities WHERE customer_id = ? AND provider = ?`).bind(customerId, provider).run()
}

export async function updateProfile(
  db: D1Database,
  id: string,
  body: Record<string, unknown>
): Promise<void> {
  const sets: string[] = []
  const vals: unknown[] = []
  if ("displayName" in body) {
    const v = typeof body.displayName === "string" ? body.displayName.trim().slice(0, 80) : ""
    sets.push("display_name = ?")
    vals.push(v || null)
  }
  if ("lang" in body) {
    const v = body.lang === "en" || body.lang === "ko" ? body.lang : null
    sets.push("lang = ?")
    vals.push(v)
  }
  if (!sets.length) return
  sets.push("updated_at = ?")
  vals.push(nowIso())
  await db.prepare(`UPDATE customers SET ${sets.join(", ")} WHERE id = ?`).bind(...vals, id).run()
}

// ---- 찜 목록 -----------------------------------------------------------------
export const PRODUCT_ID_RE = /^[A-Za-z0-9_-]{1,80}$/

export async function listWishlist(db: D1Database, customerId: string): Promise<string[]> {
  const r = await db
    .prepare(`SELECT product_id FROM customer_wishlist WHERE customer_id = ? ORDER BY created_at DESC LIMIT ?`)
    .bind(customerId, MAX_WISHLIST)
    .all<{ product_id: string }>()
  return (r.results ?? []).map((x) => x.product_id)
}

export async function addWishlist(db: D1Database, customerId: string, productId: string): Promise<void> {
  const n = await db
    .prepare(`SELECT COUNT(*) AS n FROM customer_wishlist WHERE customer_id = ?`)
    .bind(customerId)
    .first<{ n: number }>()
  if ((n?.n ?? 0) >= MAX_WISHLIST) throw new AccountError("wishlist full", 409)
  await db
    .prepare(`INSERT OR IGNORE INTO customer_wishlist (customer_id, product_id, created_at) VALUES (?, ?, ?)`)
    .bind(customerId, productId, nowIso())
    .run()
}

export async function removeWishlist(db: D1Database, customerId: string, productId: string): Promise<void> {
  await db.prepare(`DELETE FROM customer_wishlist WHERE customer_id = ? AND product_id = ?`).bind(customerId, productId).run()
}
