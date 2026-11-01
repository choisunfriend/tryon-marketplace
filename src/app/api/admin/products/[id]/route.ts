import { NextResponse } from "next/server"
import { isAdminRequest, isSameOriginWrite } from "@/lib/security"
import { deleteProduct, getProduct, getProductsDb, MAX_PRODUCT_BODY, updateProduct } from "@/lib/products-db"

// ============================================================================
// 관리자 상품 한 개 — GET 읽기 · PUT 수정 · DELETE 삭제 (D1 직접)
// ============================================================================
// 삭제해도 R2 파일(products/{folder}/…)은 남습니다 — [R2 동기화] 화면에서 다시 등록할 수 있음.
// ============================================================================

const noStore = { "Cache-Control": "no-store" }
const ID_RE = /^[A-Za-z0-9_-]{1,80}$/

function fail(error: string, status: number) {
  return NextResponse.json({ success: false, error }, { status, headers: noStore })
}

type Ctx = { params: Promise<{ id: string }> }

async function guard(request: Request, ctx: Ctx, write: boolean) {
  if (!(await isAdminRequest(request))) return { err: fail("관리자 로그인이 필요합니다", 401) }
  if (write && !isSameOriginWrite(request)) return { err: fail("허용되지 않은 요청 출처입니다", 403) }
  const { id } = await ctx.params
  if (!id || !ID_RE.test(id)) return { err: fail("잘못된 상품 id 입니다", 400) }
  const db = await getProductsDb()
  if (!db) return { err: fail("D1 바인딩(DB)이 없습니다 — wrangler.jsonc 의 d1_databases 를 확인하세요", 503) }
  return { id, db }
}

export async function GET(request: Request, ctx: Ctx) {
  const g = await guard(request, ctx, false)
  if ("err" in g) return g.err
  try {
    const product = await getProduct(g.db, g.id)
    if (!product) return fail("상품이 없습니다", 404)
    return NextResponse.json({ success: true, product }, { headers: noStore })
  } catch (e) {
    return fail(e instanceof Error ? e.message : "읽지 못했습니다", 500)
  }
}

export async function PUT(request: Request, ctx: Ctx) {
  const g = await guard(request, ctx, true)
  if ("err" in g) return g.err
  const text = await request.text()
  if (text.length > MAX_PRODUCT_BODY) return fail("요청이 너무 큽니다", 413)
  let body: Record<string, unknown>
  try {
    body = JSON.parse(text)
  } catch {
    return fail("JSON 형식이 아닙니다", 400)
  }
  if (!body || typeof body !== "object") return fail("JSON 형식이 아닙니다", 400)
  if ("name" in body && !String(body.name ?? "").trim()) return fail("상품 이름이 필요합니다", 400)
  try {
    const product = await updateProduct(g.db, g.id, body)
    if (!product) return fail("상품이 없습니다", 404)
    return NextResponse.json({ success: true, product }, { headers: noStore })
  } catch (e) {
    return fail(e instanceof Error ? e.message : "수정하지 못했습니다", 500)
  }
}

export async function DELETE(request: Request, ctx: Ctx) {
  const g = await guard(request, ctx, true)
  if ("err" in g) return g.err
  try {
    const ok = await deleteProduct(g.db, g.id)
    if (!ok) return fail("상품이 없습니다", 404)
    return NextResponse.json({ success: true }, { headers: noStore })
  } catch (e) {
    return fail(e instanceof Error ? e.message : "삭제하지 못했습니다", 500)
  }
}
