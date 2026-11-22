import type { D1Database } from "@/lib/products-db"
import { bi } from "@/i18n/l"
import { ID_RE, safeUrl } from "@/lib/salons-db"
import type { AdminSession } from "@/lib/security"

// ============================================================================
// (2026-11-22) 옷가게 지점 — shops (migrations/0005_shops.sql)
// ============================================================================
// 미용실(salons-db.ts)과 같은 구조. 다른 점은 "메뉴판":
//   미용실 = salon_styles(헤어 스펙) · 옷가게 = 그 입점사의 상품(products.store_id)
// 상품 컬럼은 PRAGMA 로 바뀔 수 있어(products-db.ts) SELECT * 로 읽고 여기서 필요한 것만 뽑습니다.
// ============================================================================

export type ShopStatus = "active" | "hidden"

export interface ShopRow {
  id: string
  store_id: string
  name: string
  lat: number
  lng: number
  address: string | null
  country: string | null
  phone: string | null
  hours: string | null
  link_url: string | null
  description: string | null
  cover_url: string | null
  status: ShopStatus
  created_at: string
  updated_at: string
}

export interface ShopInput {
  name?: string
  lat?: number
  lng?: number
  address?: string | null
  country?: string | null
  phone?: string | null
  hours?: string | null
  link_url?: string | null
  description?: string | null
  cover_url?: string | null
  status?: ShopStatus
}

function str(v: unknown, max: number): string | null {
  if (v === undefined || v === null) return null
  const s = String(v).trim()
  if (!s) return null
  if (s.length > max) throw new Error(bi(`글자 수가 너무 깁니다 (최대 ${max}자)`, `Text is too long (max ${max} characters)`))
  return s
}

export function parseShopInput(body: Record<string, unknown>, creating: boolean): ShopInput {
  const out: ShopInput = {}
  if (creating || "name" in body) {
    const n = str(body.name, 80)
    if (!n) throw new Error(bi("매장 이름을 넣어 주세요", "Please enter the shop name"))
    out.name = n
  }
  if (creating || "lat" in body || "lng" in body) {
    const lat = Number(body.lat)
    const lng = Number(body.lng)
    if (!Number.isFinite(lat) || lat < -90 || lat > 90) throw new Error(bi("위도(lat)가 올바르지 않습니다 — 지도에서 위치를 찍어 주세요", "Latitude (lat) is invalid — pick the location on the map"))
    if (!Number.isFinite(lng) || lng < -180 || lng > 180) throw new Error(bi("경도(lng)가 올바르지 않습니다 — 지도에서 위치를 찍어 주세요", "Longitude (lng) is invalid — pick the location on the map"))
    out.lat = Math.round(lat * 1e6) / 1e6
    out.lng = Math.round(lng * 1e6) / 1e6
  }
  if ("address" in body) out.address = str(body.address, 200)
  if ("country" in body) {
    const c = str(body.country, 2)?.toUpperCase() ?? null
    if (c && !/^[A-Z]{2}$/.test(c)) throw new Error(bi("나라 코드는 영문 2자 (KR, US …)", "Country code must be 2 letters (KR, US …)"))
    out.country = c
  }
  if ("phone" in body) out.phone = str(body.phone, 40)
  if ("hours" in body) out.hours = str(body.hours, 200)
  if ("link_url" in body) out.link_url = safeUrl(body.link_url, bi("매장 링크", "Shop link"))
  if ("description" in body) out.description = str(body.description, 1000)
  if ("cover_url" in body) out.cover_url = safeUrl(body.cover_url, bi("대표 사진", "Cover photo"))
  if ("status" in body) {
    if (body.status !== "active" && body.status !== "hidden") throw new Error(bi("status 는 active | hidden", "status must be active | hidden"))
    out.status = body.status
  }
  return out
}

// ----------------------------------------------------------------------------
// 공개 조회 (지도)
// ----------------------------------------------------------------------------
export interface PublicShop {
  id: string
  name: string
  lat: number
  lng: number
  address: string | null
  country: string | null
  cover_url: string | null
  store_id: string
  store_name: string
  product_count: number
}

// 상품 상태는 비어 있거나 active 일 때만 보임 (json-product-repository readStatus 와 같은 뜻)
const ACTIVE_PRODUCT = `(p.status IS NULL OR p.status = '' OR p.status = 'active')`
const PUBLIC_SHOP_COLS = `sh.id, sh.name, sh.lat, sh.lng, sh.address, sh.country, sh.cover_url, st.id AS store_id, st.name AS store_name,
  (SELECT COUNT(*) FROM products p WHERE p.store_id = sh.store_id AND ${ACTIVE_PRODUCT}) AS product_count`
const PUBLIC_SHOP_WHERE = `sh.status = 'active' AND st.status = 'active'`

export async function shopsInBox(
  db: D1Database,
  box: { w: number; s: number; e: number; n: number },
  limit: number
): Promise<PublicShop[]> {
  const lngCond = box.w <= box.e ? `sh.lng BETWEEN ? AND ?` : `(sh.lng >= ? OR sh.lng <= ?)`
  const r = await db
    .prepare(
      `SELECT ${PUBLIC_SHOP_COLS}
         FROM shops sh JOIN stores st ON st.id = sh.store_id
        WHERE ${PUBLIC_SHOP_WHERE} AND sh.lat BETWEEN ? AND ? AND ${lngCond}
        ORDER BY product_count DESC, sh.updated_at DESC
        LIMIT ?`
    )
    .bind(box.s, box.n, box.w, box.e, limit)
    .all<PublicShop>()
  return r.results ?? []
}

// 상품 하나를 파는 매장들 — 상품 페이지의 작은 지도
export async function shopsForProduct(db: D1Database, productId: string): Promise<PublicShop[]> {
  const r = await db
    .prepare(
      `SELECT ${PUBLIC_SHOP_COLS}
         FROM shops sh JOIN stores st ON st.id = sh.store_id
        WHERE ${PUBLIC_SHOP_WHERE}
          AND sh.store_id = (SELECT store_id FROM products WHERE CAST(id AS TEXT) = ?)
        ORDER BY sh.updated_at DESC
        LIMIT 50`
    )
    .bind(productId)
    .all<PublicShop>()
  return r.results ?? []
}

// 메뉴판 한 줄 — 앱에 입힐 때 필요한 것(gyeol-wear 의 item 과 같은 재료)과 상품 페이지 주소
export interface ShopMenuItem {
  id: string
  name: string
  slug: string
  price: number | null
  currency: string | null
  image_url: string | null
  model_file: string | null
  gender: string | null
  body_part: string | null
}

function loose(v: unknown): Record<string, unknown> | null {
  if (!v) return null
  if (typeof v === "object" && !Array.isArray(v)) return v as Record<string, unknown>
  if (typeof v === "string") {
    try {
      const o = JSON.parse(v)
      return o && typeof o === "object" && !Array.isArray(o) ? (o as Record<string, unknown>) : null
    } catch {
      return null
    }
  }
  return null
}
const s = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null)

// json-product-repository createSlug 와 같은 식 — 상품 페이지 주소(/{slug})
export function productSlug(name: string): string {
  return name.toLowerCase().trim().replace(/[^\w\s-]/g, "").replace(/\s+/g, "-").replace(/-+/g, "-")
}

function firstImage(row: Record<string, unknown>, media: Record<string, unknown> | null): string | null {
  const direct = s(row.image_url)
  if (direct) return direct
  const imgs = media?.images
  if (Array.isArray(imgs) && imgs.length) {
    const f = imgs[0] as unknown
    if (typeof f === "string") return s(f)
    if (f && typeof f === "object") return s((f as Record<string, unknown>).url)
  }
  return null
}

export function toMenuItem(row: Record<string, unknown>): ShopMenuItem {
  const media = loose(row.media)
  const avatar = loose(row.avatar)
  const name = String(row.name ?? "")
  return {
    id: String(row.id),
    name,
    slug: productSlug(name),
    price: typeof row.price === "number" ? row.price : row.price == null ? null : Number(row.price) || null,
    currency: s(row.currency),
    image_url: firstImage(row, media),
    model_file: s(media?.model_file) ?? s(row.model_path),
    gender: s(avatar?.gender) ?? s(row.gender),
    body_part: s(avatar?.body_part),
  }
}

export async function publicShopDetail(db: D1Database, id: string) {
  const shop = await db
    .prepare(
      `SELECT ${PUBLIC_SHOP_COLS}, sh.phone, sh.hours, sh.link_url, sh.description
         FROM shops sh JOIN stores st ON st.id = sh.store_id
        WHERE sh.id = ? AND ${PUBLIC_SHOP_WHERE}`
    )
    .bind(id)
    .first<PublicShop & { phone: string | null; hours: string | null; link_url: string | null; description: string | null }>()
  if (!shop) return null
  const r = await db
    .prepare(`SELECT * FROM products p WHERE p.store_id = ? AND ${ACTIVE_PRODUCT} LIMIT 200`)
    .bind(shop.store_id)
    .all<Record<string, unknown>>()
  const products = (r.results ?? []).map(toMenuItem)
  return { shop, products }
}

// ----------------------------------------------------------------------------
// 관리자
// ----------------------------------------------------------------------------
export async function listShops(db: D1Database, storeId: string | null) {
  const where = storeId ? `WHERE sh.store_id = ?` : ``
  const stmt = db.prepare(
    `SELECT sh.*, st.name AS store_name,
            (SELECT COUNT(*) FROM products p WHERE p.store_id = sh.store_id) AS product_count
       FROM shops sh JOIN stores st ON st.id = sh.store_id ${where}
      ORDER BY sh.created_at DESC`
  )
  const r = await (storeId ? stmt.bind(storeId) : stmt).all<ShopRow & { store_name: string; product_count: number }>()
  return r.results ?? []
}

export async function getShop(db: D1Database, id: string) {
  return db.prepare(`SELECT * FROM shops WHERE id = ?`).bind(id).first<ShopRow>()
}

export async function createShop(db: D1Database, storeId: string, input: ShopInput) {
  const id = crypto.randomUUID()
  const now = new Date().toISOString()
  await db
    .prepare(
      `INSERT INTO shops (id, store_id, name, lat, lng, address, country, phone, hours, link_url, description, cover_url, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(
      id, storeId, input.name, input.lat, input.lng, input.address ?? null, input.country ?? null,
      input.phone ?? null, input.hours ?? null, input.link_url ?? null, input.description ?? null,
      input.cover_url ?? null, input.status ?? "active", now, now
    )
    .run()
  return getShop(db, id)
}

export async function updateShop(db: D1Database, id: string, input: ShopInput) {
  const sets: string[] = []
  const vals: unknown[] = []
  for (const [k, v] of Object.entries(input)) {
    if (v === undefined) continue
    sets.push(`${k} = ?`) // 키는 parseShopInput 이 만든 고정 목록에서만 옴
    vals.push(v)
  }
  if (!sets.length) throw new Error(bi("바꿀 값이 없습니다", "Nothing to update"))
  sets.push("updated_at = ?")
  vals.push(new Date().toISOString())
  const r = await db.prepare(`UPDATE shops SET ${sets.join(", ")} WHERE id = ?`).bind(...vals, id).run()
  return r.meta?.changes ? getShop(db, id) : null
}

export async function deleteShop(db: D1Database, id: string) {
  const r = await db.prepare(`DELETE FROM shops WHERE id = ?`).bind(id).run()
  return !!r.meta?.changes
}

// 이 세션이 그 매장을 다룰 수 있으면 매장을, 아니면 null (platform → 전부 · 입점사 → 자기 것만)
export async function ownShop(session: AdminSession, db: D1Database, id: string) {
  if (!ID_RE.test(id)) return null
  const shop = await getShop(db, id)
  if (!shop) return null
  if (session.role !== "platform" && shop.store_id !== session.sid) return null
  return shop
}
