import type { D1Database } from "@/lib/products-db"
import { hashPassword, type AdminRole } from "@/lib/security"

// ============================================================================
// (2026-11-01) 입점사(stores) · 관리 계정(store_users) — D1
// 테이블은 migrations/0001_multi_store.sql 로 만듭니다.
// ============================================================================

export type StoreStatus = "pending" | "active" | "suspended"
export const STORE_STATUSES: StoreStatus[] = ["pending", "active", "suspended"]

export interface StoreRow {
  id: string
  slug: string
  name: string
  status: StoreStatus
  commission_rate: number
  contact_email: string | null
  created_at: string
  updated_at: string
}

export interface StoreUserRow {
  id: string
  store_id: string | null
  email: string
  password_hash: string
  role: AdminRole
  disabled: number
}

// slug: 영문 소문자·숫자·- , 2~30자, 앞뒤 - 없음, "--" 없음 (R2 폴더 "{slug}--..." 앞머리로 씀)
export const SLUG_RE = /^(?!.*--)[a-z0-9][a-z0-9-]{0,28}[a-z0-9]$/
export const EMAIL_RE = /^[^\s@]{1,64}@[^\s@]{1,190}\.[^\s@]{2,}$/

export async function findUserByEmail(db: D1Database, email: string) {
  return db
    .prepare(`SELECT id, store_id, email, password_hash, role, disabled FROM store_users WHERE email = ? COLLATE NOCASE`)
    .bind(email.trim())
    .first<StoreUserRow>()
}

export async function touchLogin(db: D1Database, userId: string) {
  await db.prepare(`UPDATE store_users SET last_login_at = ? WHERE id = ?`).bind(new Date().toISOString(), userId).run()
}

export async function getStore(db: D1Database, id: string) {
  return db.prepare(`SELECT * FROM stores WHERE id = ?`).bind(id).first<StoreRow>()
}

export async function listStores(db: D1Database) {
  const r = await db
    .prepare(
      `SELECT s.*,
              (SELECT COUNT(*) FROM products p WHERE p.store_id = s.id) AS product_count,
              (SELECT GROUP_CONCAT(email, ', ') FROM store_users u WHERE u.store_id = s.id AND u.role = 'owner') AS owner_emails
         FROM stores s ORDER BY s.created_at DESC`
    )
    .all<StoreRow & { product_count: number; owner_emails: string | null }>()
  return r.results ?? []
}

// 입점사 + 대표 계정을 한 번에 만듦
export async function createStoreWithOwner(
  db: D1Database,
  input: { slug: string; name: string; ownerEmail: string; ownerPassword: string; status?: StoreStatus }
) {
  const now = new Date().toISOString()
  const storeId = crypto.randomUUID()
  const userId = crypto.randomUUID()
  const hash = await hashPassword(input.ownerPassword)
  const status = input.status ?? "active"

  if (await db.prepare(`SELECT 1 FROM stores WHERE slug = ?`).bind(input.slug).first()) {
    throw new Error("이미 쓰는 slug 입니다")
  }
  if (await findUserByEmail(db, input.ownerEmail)) throw new Error("이미 가입된 이메일입니다")

  await db
    .prepare(
      `INSERT INTO stores (id, slug, name, status, contact_email, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(storeId, input.slug, input.name, status, input.ownerEmail, now, now)
    .run()
  try {
    await db
      .prepare(
        `INSERT INTO store_users (id, store_id, email, password_hash, role, created_at) VALUES (?, ?, ?, ?, 'owner', ?)`
      )
      .bind(userId, storeId, input.ownerEmail.trim(), hash, now)
      .run()
  } catch (e) {
    await db.prepare(`DELETE FROM stores WHERE id = ?`).bind(storeId).run() // 계정이 실패하면 스토어도 되돌림
    throw e
  }
  return getStore(db, storeId)
}

export async function updateStore(
  db: D1Database,
  id: string,
  input: { name?: string; status?: StoreStatus; commission_rate?: number }
) {
  const sets: string[] = []
  const vals: unknown[] = []
  const add = (col: string, v: unknown) => {
    sets.push(`${col} = ?`)
    vals.push(v)
  }
  if (input.name !== undefined) add("name", input.name)
  if (input.status !== undefined) add("status", input.status)
  if (input.commission_rate !== undefined) add("commission_rate", input.commission_rate)
  if (!sets.length) throw new Error("바꿀 값이 없습니다")
  sets.push("updated_at = ?")
  vals.push(new Date().toISOString())
  const r = await db.prepare(`UPDATE stores SET ${sets.join(", ")} WHERE id = ?`).bind(...vals, id).run()
  if (!r.meta?.changes) return null
  return getStore(db, id)
}

// 입점사에 계정 추가 (owner 또는 staff)
export async function addStoreUser(
  db: D1Database,
  input: { storeId: string; email: string; password: string; role: "owner" | "staff" }
) {
  if (await findUserByEmail(db, input.email)) throw new Error("이미 가입된 이메일입니다")
  const id = crypto.randomUUID()
  await db
    .prepare(`INSERT INTO store_users (id, store_id, email, password_hash, role, created_at) VALUES (?, ?, ?, ?, ?, ?)`)
    .bind(id, input.storeId, input.email.trim(), await hashPassword(input.password), input.role, new Date().toISOString())
    .run()
  return { id, email: input.email.trim(), role: input.role }
}
