import type { D1Database } from "@/lib/products-db"

// ============================================================================
// (2026-11-01) 미용실 지도 — salons · salon_styles (migrations/0003_salons.sql)
// ============================================================================
// 헤어스타일은 3D 파일이 아니라 GYEOL 앱의 "스타일 스펙"(JSON)입니다.
// 앱이 손님 사진으로 만든 3D 머리(없으면 마네킹)에 스펙(커트·펌·스타일링·컬러)을 적용해 보여 줍니다.
// 그래서 여기서는 스펙을 "데이터로만" 안전하게 저장·전달하고, 해석은 앱이 합니다.
// ============================================================================

export type SalonStatus = "active" | "hidden"
export type StyleGender = "male" | "female" | "both"

export interface SalonRow {
  id: string
  store_id: string
  name: string
  lat: number
  lng: number
  address: string | null
  country: string | null
  phone: string | null
  hours: string | null
  booking_url: string | null
  description: string | null
  cover_url: string | null
  status: SalonStatus
  created_at: string
  updated_at: string
}

export interface SalonStyleRow {
  id: string
  salon_id: string
  name: string
  gender: StyleGender
  price_minor: number | null
  currency: string | null
  duration_min: number | null
  thumbnail_url: string | null
  spec: string
  sort: number
  status: SalonStatus
  created_at: string
  updated_at: string
}

export const ID_RE = /^[A-Za-z0-9_-]{1,80}$/

// ----------------------------------------------------------------------------
// 입력 정리
// ----------------------------------------------------------------------------
function str(v: unknown, max: number): string | null {
  if (v === undefined || v === null) return null
  const s = String(v).trim()
  if (!s) return null
  if (s.length > max) throw new Error(`글자 수가 너무 깁니다 (최대 ${max}자)`)
  return s
}

// https 주소 또는 같은 사이트의 /api/assets/… 만
export function safeUrl(v: unknown, label: string): string | null {
  const s = str(v, 500)
  if (!s) return null
  if (/^\/api\/assets\/[A-Za-z0-9._~\/-]+$/.test(s)) return s
  try {
    const u = new URL(s)
    if (u.protocol === "https:") return u.href
  } catch {
    /* 아래에서 오류 */
  }
  throw new Error(`${label} 은(는) https:// 주소여야 합니다`)
}

export interface SalonInput {
  name?: string
  lat?: number
  lng?: number
  address?: string | null
  country?: string | null
  phone?: string | null
  hours?: string | null
  booking_url?: string | null
  description?: string | null
  cover_url?: string | null
  status?: SalonStatus
}

export function parseSalonInput(body: Record<string, unknown>, creating: boolean): SalonInput {
  const out: SalonInput = {}
  if (creating || "name" in body) {
    const n = str(body.name, 80)
    if (!n) throw new Error("미용실 이름을 넣어 주세요")
    out.name = n
  }
  if (creating || "lat" in body || "lng" in body) {
    const lat = Number(body.lat)
    const lng = Number(body.lng)
    if (!Number.isFinite(lat) || lat < -90 || lat > 90) throw new Error("위도(lat)가 올바르지 않습니다 — 지도에서 위치를 찍어 주세요")
    if (!Number.isFinite(lng) || lng < -180 || lng > 180) throw new Error("경도(lng)가 올바르지 않습니다 — 지도에서 위치를 찍어 주세요")
    out.lat = Math.round(lat * 1e6) / 1e6
    out.lng = Math.round(lng * 1e6) / 1e6
  }
  if ("address" in body) out.address = str(body.address, 200)
  if ("country" in body) {
    const c = str(body.country, 2)?.toUpperCase() ?? null
    if (c && !/^[A-Z]{2}$/.test(c)) throw new Error("나라 코드는 영문 2자 (KR, US …)")
    out.country = c
  }
  if ("phone" in body) out.phone = str(body.phone, 40)
  if ("hours" in body) out.hours = str(body.hours, 200)
  if ("booking_url" in body) out.booking_url = safeUrl(body.booking_url, "예약 링크")
  if ("description" in body) out.description = str(body.description, 1000)
  if ("cover_url" in body) out.cover_url = safeUrl(body.cover_url, "대표 사진")
  if ("status" in body) {
    if (body.status !== "active" && body.status !== "hidden") throw new Error("status 는 active | hidden")
    out.status = body.status
  }
  return out
}

// ----------------------------------------------------------------------------
// 스타일 스펙 정리 — 순수 JSON 데이터만 통과 (함수·__proto__ 등 차단, 크기 제한)
// 앱(js/35-salon-bridge.js)도 받을 때 같은 규칙으로 한 번 더 거릅니다.
// ----------------------------------------------------------------------------
// (2026-11-01) 앱이 원본 머리를 재서 만든 스타일은 수십 KB — 앱(35-salon-bridge.js)과 같은 한도
const SPEC_MAX_BYTES = 512 * 1024
const SPEC_MAX_DEPTH = 10
const BAD_KEYS = new Set(["__proto__", "prototype", "constructor"])

const B64_RE = /^[A-Za-z0-9+/]*={0,2}$/

function cleanValue(v: unknown, depth: number, path = ""): unknown {
  if (depth > SPEC_MAX_DEPTH) throw new Error("스펙이 너무 깊게 중첩되어 있습니다")
  if (v === null || typeof v === "boolean") return v
  if (typeof v === "number") {
    if (!Number.isFinite(v)) throw new Error("스펙에 숫자가 아닌 값(NaN·Infinity)이 있습니다")
    return v
  }
  if (typeof v === "string") {
    const isLongFlowData =
      path === "flow.d" && v.length <= 260000 && B64_RE.test(v)
    if (v.length > 400 && !isLongFlowData) {
      throw new Error("스펙 안의 글자가 너무 깁니다 (최대 400자)")
    }
    return v
  }
  if (Array.isArray(v)) {
    if (v.length > 20000) throw new Error("스펙 안의 목록이 너무 깁니다")
    return v.map((x) => cleanValue(x, depth + 1, `${path}[]`))
  }
  if (typeof v === "object") {
    const out: Record<string, unknown> = {}
    for (const [k, x] of Object.entries(v as Record<string, unknown>)) {
      if (BAD_KEYS.has(k) || !/^[A-Za-z][A-Za-z0-9_]{0,40}$/.test(k)) {
        throw new Error(`스펙에 쓸 수 없는 키: ${k}`)
      }
      out[k] = cleanValue(x, depth + 1, path ? `${path}.${k}` : k)
    }
    return out
  }
  throw new Error("스펙은 JSON 데이터만 넣을 수 있습니다")
}

// (2026-11-01) spec.groom — GYEOL 앱이 붙이는 빗질·가닥 지우기 "명령"(base64 덩어리, 앱 js/37-groom-recipe.js)
//   일반 규칙(글자 400자)으로는 못 담아 따로 검사: comb ≤ 260,000자 · erase ≤ 4,000자 · base64 글자만

function cleanGroom(g: unknown): Record<string, unknown> | undefined {
  if (!g || typeof g !== "object" || Array.isArray(g)) return undefined
  const x = g as Record<string, unknown>
  const out: Record<string, unknown> = { v: typeof x.v === "number" ? x.v : 1 }
  if (typeof x.comb === "string" && x.comb.length <= 260000 && B64_RE.test(x.comb)) out.comb = x.comb
  if (typeof x.erase === "string" && x.erase.length <= 4000 && B64_RE.test(x.erase)) out.erase = x.erase
  return out.comb || out.erase ? out : undefined
}

export function cleanSpec(input: unknown): Record<string, unknown> {
  let v = input
  if (typeof v === "string") {
    try {
      v = JSON.parse(v)
    } catch {
      throw new Error("스펙이 올바른 JSON 이 아닙니다")
    }
  }
  if (!v || typeof v !== "object" || Array.isArray(v)) throw new Error("스펙은 { … } 객체여야 합니다")
  let groom: Record<string, unknown> | undefined
  if ("groom" in (v as object)) {
    groom = cleanGroom((v as Record<string, unknown>).groom)
    v = { ...(v as Record<string, unknown>) }
    delete (v as Record<string, unknown>).groom
  }
  const spec = cleanValue(v, 0) as Record<string, unknown>
  if (!spec.cut || typeof spec.cut !== "object" || Array.isArray(spec.cut)) {
    throw new Error("스펙에 cut(구역별 커트) 이 있어야 합니다")
  }
  if (spec.color !== undefined && !(typeof spec.color === "string" && /^#[0-9A-Fa-f]{6}$/.test(spec.color))) {
    throw new Error("color 는 #RRGGBB 형식이어야 합니다")
  }
  // (2026-11-01) GYEOL 앱의 「미용실에 올리기」로 만든 스펙만 받음 (앱에서만 스타일을 만들게)
  //   ⚠ 앱이 붙이는 표시일 뿐 서명이 아니라, 마음먹고 흉내 내면 막을 수는 없음 — 관리자 화면에 입력칸을 없애 길을 막는 것
  const mark = spec.gyeol as Record<string, unknown> | undefined
  if (!mark || typeof mark !== "object" || mark.app !== "gyeol") {
    throw new Error("헤어스타일은 GYEOL 앱의 「미용실에 올리기」로만 등록할 수 있어요")
  }
  if (JSON.stringify(spec).length > SPEC_MAX_BYTES) throw new Error("스펙이 너무 큽니다 (512KB 이하)")
  if (groom) spec.groom = groom
  return spec
}

export interface StyleInput {
  name?: string
  gender?: StyleGender
  price_minor?: number | null
  currency?: string | null
  duration_min?: number | null
  thumbnail_url?: string | null
  spec?: string
  sort?: number
  status?: SalonStatus
}

export function parseStyleInput(body: Record<string, unknown>, creating: boolean): StyleInput {
  const out: StyleInput = {}
  if (creating || "name" in body) {
    const n = str(body.name, 80)
    if (!n) throw new Error("스타일 이름을 넣어 주세요")
    out.name = n
  }
  if ("gender" in body) {
    if (!["male", "female", "both"].includes(String(body.gender))) throw new Error("gender 는 male | female | both")
    out.gender = body.gender as StyleGender
  }
  const optInt = (k: string, max: number, label: string) => {
    const v = body[k]
    if (v === null || v === "" || v === undefined) return null
    const n = Number(v)
    if (!Number.isInteger(n) || n < 0 || n > max) throw new Error(`${label} 값이 올바르지 않습니다`)
    return n
  }
  if ("price_minor" in body) out.price_minor = optInt("price_minor", 1e10, "가격")
  if ("duration_min" in body) out.duration_min = optInt("duration_min", 24 * 60, "소요 시간")
  if ("sort" in body) out.sort = optInt("sort", 9999, "순서") ?? 0
  if ("currency" in body) {
    const c = str(body.currency, 3)?.toUpperCase() ?? null
    if (c && !/^[A-Z]{3}$/.test(c)) throw new Error("통화는 영문 3자 (KRW, USD …)")
    out.currency = c
  }
  if ("thumbnail_url" in body) out.thumbnail_url = safeUrl(body.thumbnail_url, "썸네일")
  if (creating || "spec" in body) out.spec = JSON.stringify(cleanSpec(body.spec))
  if ("status" in body) {
    if (body.status !== "active" && body.status !== "hidden") throw new Error("status 는 active | hidden")
    out.status = body.status
  }
  return out
}

// ----------------------------------------------------------------------------
// 공개 조회 (지도)
// ----------------------------------------------------------------------------
export interface PublicSalon {
  id: string
  name: string
  lat: number
  lng: number
  address: string | null
  country: string | null
  cover_url: string | null
  store_name: string
  style_count: number
}

const PUBLIC_SALON_COLS = `sa.id, sa.name, sa.lat, sa.lng, sa.address, sa.country, sa.cover_url, st.name AS store_name,
  (SELECT COUNT(*) FROM salon_styles ss WHERE ss.salon_id = sa.id AND ss.status = 'active') AS style_count`
const PUBLIC_SALON_WHERE = `sa.status = 'active' AND st.status = 'active'`

// bbox: 서·남·동·북 (west > east 면 날짜변경선을 걸친 화면)
export async function salonsInBox(
  db: D1Database,
  box: { w: number; s: number; e: number; n: number },
  limit: number
): Promise<PublicSalon[]> {
  const lngCond = box.w <= box.e ? `sa.lng BETWEEN ? AND ?` : `(sa.lng >= ? OR sa.lng <= ?)`
  const r = await db
    .prepare(
      `SELECT ${PUBLIC_SALON_COLS}
         FROM salons sa JOIN stores st ON st.id = sa.store_id
        WHERE ${PUBLIC_SALON_WHERE} AND sa.lat BETWEEN ? AND ? AND ${lngCond}
        ORDER BY style_count DESC, sa.updated_at DESC
        LIMIT ?`
    )
    .bind(box.s, box.n, box.w, box.e, limit)
    .all<PublicSalon>()
  return r.results ?? []
}

// (2026-11-01) 미용실 화면에는 가벼운 정보(이름·가격·썸네일)만 — 스펙은 「입어 보기」 때 styleSpec() 으로 따로
export interface PublicStyle {
  id: string
  name: string
  gender: StyleGender
  price_minor: number | null
  currency: string | null
  duration_min: number | null
  thumbnail_url: string | null
  color: string | null // 썸네일이 없을 때 견본 색 (스펙의 color 만 뽑아 둠)
}

export async function publicSalonDetail(db: D1Database, id: string) {
  const salon = await db
    .prepare(
      `SELECT ${PUBLIC_SALON_COLS}, sa.phone, sa.hours, sa.booking_url, sa.description
         FROM salons sa JOIN stores st ON st.id = sa.store_id
        WHERE sa.id = ? AND ${PUBLIC_SALON_WHERE}`
    )
    .bind(id)
    .first<PublicSalon & { phone: string | null; hours: string | null; booking_url: string | null; description: string | null }>()
  if (!salon) return null
  const r = await db
    .prepare(
      `SELECT id, name, gender, price_minor, currency, duration_min, thumbnail_url,
              json_extract(spec, '$.color') AS color
         FROM salon_styles WHERE salon_id = ? AND status = 'active' ORDER BY sort, created_at`
    )
    .bind(id)
    .all<PublicStyle>()
  const styles = r.results ?? []
  return { salon, styles }
}

// 스타일 하나의 스펙 — 「입어 보기」를 누를 때만 받음 (영업 중인 입점사 · 보이는 미용실 · 보이는 스타일만)
export async function publicStyleSpec(db: D1Database, styleId: string) {
  const row = await db
    .prepare(
      `SELECT ss.id, ss.name, ss.gender, ss.spec, sa.id AS salon_id, sa.name AS salon_name
         FROM salon_styles ss
         JOIN salons sa ON sa.id = ss.salon_id
         JOIN stores st ON st.id = sa.store_id
        WHERE ss.id = ? AND ss.status = 'active' AND ${PUBLIC_SALON_WHERE}`
    )
    .bind(styleId)
    .first<{ id: string; name: string; gender: StyleGender; spec: string; salon_id: string; salon_name: string }>()
  if (!row) return null
  try {
    return { id: row.id, name: row.name, gender: row.gender, salon: { id: row.salon_id, name: row.salon_name }, spec: JSON.parse(row.spec) as Record<string, unknown> }
  } catch {
    return null
  }
}

// ----------------------------------------------------------------------------
// 관리자
// ----------------------------------------------------------------------------
export async function listSalons(db: D1Database, storeId: string | null) {
  const where = storeId ? `WHERE sa.store_id = ?` : ``
  const stmt = db.prepare(
    `SELECT sa.*, st.name AS store_name,
            (SELECT COUNT(*) FROM salon_styles ss WHERE ss.salon_id = sa.id) AS style_count
       FROM salons sa JOIN stores st ON st.id = sa.store_id ${where}
      ORDER BY sa.created_at DESC`
  )
  const r = await (storeId ? stmt.bind(storeId) : stmt).all<SalonRow & { store_name: string; style_count: number }>()
  return r.results ?? []
}

export async function getSalon(db: D1Database, id: string) {
  return db.prepare(`SELECT * FROM salons WHERE id = ?`).bind(id).first<SalonRow>()
}

export async function createSalon(db: D1Database, storeId: string, input: SalonInput) {
  const id = crypto.randomUUID()
  const now = new Date().toISOString()
  await db
    .prepare(
      `INSERT INTO salons (id, store_id, name, lat, lng, address, country, phone, hours, booking_url, description, cover_url, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(
      id, storeId, input.name, input.lat, input.lng, input.address ?? null, input.country ?? null,
      input.phone ?? null, input.hours ?? null, input.booking_url ?? null, input.description ?? null,
      input.cover_url ?? null, input.status ?? "active", now, now
    )
    .run()
  return getSalon(db, id)
}

async function updateRow(db: D1Database, table: "salons" | "salon_styles", id: string, input: object) {
  const sets: string[] = []
  const vals: unknown[] = []
  for (const [k, v] of Object.entries(input)) {
    if (v === undefined) continue
    sets.push(`${k} = ?`) // 키는 parse*Input 이 만든 고정 목록에서만 옴
    vals.push(v)
  }
  if (!sets.length) throw new Error("바꿀 값이 없습니다")
  sets.push("updated_at = ?")
  vals.push(new Date().toISOString())
  const r = await db.prepare(`UPDATE ${table} SET ${sets.join(", ")} WHERE id = ?`).bind(...vals, id).run()
  return !!r.meta?.changes
}

export async function updateSalon(db: D1Database, id: string, input: SalonInput) {
  return (await updateRow(db, "salons", id, input)) ? getSalon(db, id) : null
}

export async function deleteSalon(db: D1Database, id: string) {
  await db.prepare(`DELETE FROM salon_styles WHERE salon_id = ?`).bind(id).run()
  const r = await db.prepare(`DELETE FROM salons WHERE id = ?`).bind(id).run()
  return !!r.meta?.changes
}

export async function listStyles(db: D1Database, salonId: string) {
  const r = await db
    .prepare(`SELECT * FROM salon_styles WHERE salon_id = ? ORDER BY sort, created_at`)
    .bind(salonId)
    .all<SalonStyleRow>()
  return r.results ?? []
}

export async function getStyle(db: D1Database, id: string) {
  return db.prepare(`SELECT * FROM salon_styles WHERE id = ?`).bind(id).first<SalonStyleRow>()
}

export async function createStyle(db: D1Database, salonId: string, input: StyleInput) {
  const id = crypto.randomUUID()
  const now = new Date().toISOString()
  await db
    .prepare(
      `INSERT INTO salon_styles (id, salon_id, name, gender, price_minor, currency, duration_min, thumbnail_url, spec, sort, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(
      id, salonId, input.name, input.gender ?? "both", input.price_minor ?? null, input.currency ?? null,
      input.duration_min ?? null, input.thumbnail_url ?? null, input.spec, input.sort ?? 0, input.status ?? "active", now, now
    )
    .run()
  return getStyle(db, id)
}

export async function updateStyle(db: D1Database, id: string, input: StyleInput) {
  return (await updateRow(db, "salon_styles", id, input)) ? getStyle(db, id) : null
}

export async function deleteStyle(db: D1Database, id: string) {
  const r = await db.prepare(`DELETE FROM salon_styles WHERE id = ?`).bind(id).run()
  return !!r.meta?.changes
}
