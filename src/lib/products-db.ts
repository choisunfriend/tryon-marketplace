import { getCloudflareContext } from "@opennextjs/cloudflare"

// ============================================================================
// 상품 D1 직접 읽기·쓰기 (관리자 전용) — wrangler.jsonc 의 DB 바인딩
// ============================================================================
// 백엔드 API Worker(tryon-marketplace)와 같은 D1 데이터베이스를 이 웹 Worker 에도 붙여
// 관리자 화면의 목록·등록·수정·삭제를 여기서 바로 처리합니다.
// 테이블 컬럼은 코드에 박지 않고 PRAGMA table_info 로 그때그때 읽어,
// 실제로 있는 컬럼만 씁니다(컬럼이 늘거나 빠져도 그대로 동작).
//   · 객체 값(details·media·avatar)은 JSON 문자열로 저장
//   · true/false 는 1/0
//   · id 컬럼이 TEXT 면 새 UUID, INTEGER 면 D1 이 자동으로 매김
// ============================================================================

// @cloudflare/workers-types 없이 쓰는 최소 타입
interface D1Result<T> {
  results?: T[]
  success?: boolean
  meta?: { changes?: number; last_row_id?: number }
}
interface D1Statement {
  bind(...values: unknown[]): D1Statement
  all<T = Record<string, unknown>>(): Promise<D1Result<T>>
  first<T = Record<string, unknown>>(): Promise<T | null>
  run(): Promise<D1Result<unknown>>
}
export interface D1Database {
  prepare(sql: string): D1Statement
}

export const PRODUCTS_TABLE = "products"

export async function getProductsDb(): Promise<D1Database | null> {
  try {
    const { env } = await getCloudflareContext({ async: true })
    return (env as unknown as { DB?: D1Database }).DB ?? null
  } catch {
    return null
  }
}

interface ColumnInfo {
  name: string
  type: string
  pk: number
}

async function columnsOf(db: D1Database): Promise<ColumnInfo[]> {
  const r = await db.prepare(`PRAGMA table_info(${PRODUCTS_TABLE})`).all<ColumnInfo>()
  const cols = r.results ?? []
  if (!cols.length) throw new Error(`D1 에 ${PRODUCTS_TABLE} 테이블이 없습니다`)
  return cols
}

function toDbValue(v: unknown): unknown {
  if (v === undefined) return null
  if (typeof v === "boolean") return v ? 1 : 0
  if (v !== null && typeof v === "object") return JSON.stringify(v)
  return v
}

// JSON 문자열로 저장된 컬럼을 객체로 돌려줌(화면에서 바로 쓰게)
function fromDbRow(row: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = { ...row }
  for (const k of ["details", "media", "avatar"]) {
    const v = out[k]
    if (typeof v === "string" && v.trim().startsWith("{")) {
      try {
        out[k] = JSON.parse(v)
      } catch {
        /* 그대로 둠 */
      }
    }
  }
  if (typeof out.featured === "number") out.featured = out.featured === 1
  return out
}

// 받은 값 중 테이블에 있는 컬럼만, 읽기 전용(id·created_at)은 빼고
function pickWritable(
  cols: ColumnInfo[],
  input: Record<string, unknown>,
  skip: string[]
): [string[], unknown[]] {
  const names: string[] = []
  const values: unknown[] = []
  for (const c of cols) {
    if (skip.includes(c.name)) continue
    if (!(c.name in input)) continue
    names.push(c.name)
    values.push(toDbValue(input[c.name]))
  }
  return [names, values]
}

function quote(name: string): string {
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(name)) throw new Error(`이상한 컬럼 이름: ${name}`)
  return `"${name}"`
}

export async function listProducts(db: D1Database) {
  const cols = await columnsOf(db)
  const order = cols.some((c) => c.name === "updated_at")
    ? "updated_at DESC"
    : cols.some((c) => c.name === "created_at")
      ? "created_at DESC"
      : "rowid DESC"
  const r = await db.prepare(`SELECT * FROM ${PRODUCTS_TABLE} ORDER BY ${order}`).all()
  return (r.results ?? []).map(fromDbRow)
}

export async function getProduct(db: D1Database, id: string) {
  const row = await db.prepare(`SELECT * FROM ${PRODUCTS_TABLE} WHERE id = ?`).bind(id).first()
  return row ? fromDbRow(row) : null
}

export async function createProduct(db: D1Database, input: Record<string, unknown>) {
  const cols = await columnsOf(db)
  const now = new Date().toISOString()
  const data: Record<string, unknown> = { ...input }
  const idCol = cols.find((c) => c.name === "id")
  const textId = idCol && !/INT/i.test(idCol.type)
  if (textId) data.id = crypto.randomUUID()
  if (cols.some((c) => c.name === "created_at")) data.created_at = now
  if (cols.some((c) => c.name === "updated_at")) data.updated_at = now

  const [names, values] = pickWritable(cols, data, textId ? [] : ["id"])
  if (!names.length) throw new Error("저장할 값이 없습니다")
  const sql = `INSERT INTO ${PRODUCTS_TABLE} (${names.map(quote).join(", ")}) VALUES (${names.map(() => "?").join(", ")})`
  const r = await db.prepare(sql).bind(...values).run()
  const id = textId ? String(data.id) : String(r.meta?.last_row_id ?? "")
  return getProduct(db, id)
}

export async function updateProduct(db: D1Database, id: string, input: Record<string, unknown>) {
  const cols = await columnsOf(db)
  const data: Record<string, unknown> = { ...input }
  if (cols.some((c) => c.name === "updated_at")) data.updated_at = new Date().toISOString()
  const [names, values] = pickWritable(cols, data, ["id", "created_at"])
  if (!names.length) throw new Error("바꿀 값이 없습니다")
  const sql = `UPDATE ${PRODUCTS_TABLE} SET ${names.map((n) => `${quote(n)} = ?`).join(", ")} WHERE id = ?`
  const r = await db.prepare(sql).bind(...values, id).run()
  if (!r.meta?.changes) return null
  return getProduct(db, id)
}

export async function deleteProduct(db: D1Database, id: string): Promise<boolean> {
  const r = await db.prepare(`DELETE FROM ${PRODUCTS_TABLE} WHERE id = ?`).bind(id).run()
  return (r.meta?.changes ?? 0) > 0
}

// 관리자 화면 공용 — 같은 출처·관리자 쿠키 확인
export const MAX_PRODUCT_BODY = 256 * 1024
