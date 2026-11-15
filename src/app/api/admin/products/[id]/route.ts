import { NextResponse } from "next/server"
import { getAssetsBucket } from "@/lib/assets-bucket"
import { cleanupModelFolder } from "@/lib/model-cleanup"
import { canTouchProduct, fail, noStore, requireAdmin } from "@/lib/admin-guard"
import { deleteProduct, getProduct, MAX_PRODUCT_BODY, updateProduct } from "@/lib/products-db"
import { withLang } from "@/i18n/api"
import { bi } from "@/i18n/l"

// ============================================================================
// 관리자 상품 한 개 — GET 읽기 · PUT 수정 · DELETE 삭제 (D1 직접)
// ============================================================================
// (2026-11-01) 입점사 계정은 자기 입점사 상품만. 남의 상품은 "없음(404)"으로 답함(있는지도 안 알려 줌).
// store_id 는 platform 만 바꿀 수 있음.
// 삭제해도 R2 파일(products/{folder}/…)은 남습니다 — [R2 동기화] 화면에서 다시 등록할 수 있음.
// ============================================================================

const ID_RE = /^[A-Za-z0-9_-]{1,80}$/

type Ctx = { params: Promise<{ id: string }> }

async function guard(request: Request, ctx: Ctx, write: boolean) {
  const g = await requireAdmin(request, { write })
  if ("err" in g) return g
  const { id } = await ctx.params
  if (!id || !ID_RE.test(id)) return { err: fail(bi("잘못된 상품 id 입니다", "Invalid product id"), 400) }
  const product = await getProduct(g.db, id)
  if (!canTouchProduct(g.session, product)) return { err: fail(bi("상품이 없습니다", "Product not found"), 404) }
  return { ...g, id, product: product! }
}

async function handleGET(request: Request, ctx: Ctx) {
  const g = await guard(request, ctx, false)
  if ("err" in g) return g.err
  return NextResponse.json({ success: true, product: g.product }, { headers: noStore })
}

async function handlePUT(request: Request, ctx: Ctx) {
  const g = await guard(request, ctx, true)
  if ("err" in g) return g.err
  const text = await request.text()
  if (text.length > MAX_PRODUCT_BODY) return fail(bi("요청이 너무 큽니다", "Request is too large"), 413)
  let body: Record<string, unknown>
  try {
    body = JSON.parse(text)
  } catch {
    return fail(bi("JSON 형식이 아닙니다", "Not valid JSON"), 400)
  }
  if (!body || typeof body !== "object") return fail(bi("JSON 형식이 아닙니다", "Not valid JSON"), 400)
  if ("name" in body && !String(body.name ?? "").trim()) return fail(bi("상품 이름이 필요합니다", "Product name is required"), 400)

  if (g.session.role !== "platform") {
    delete body.store_id
  } else if ("store_id" in body) {
    const sid = String(body.store_id ?? "")
    if (!(await g.db.prepare(`SELECT 1 FROM stores WHERE id = ?`).bind(sid).first())) return fail(bi("없는 입점사입니다", "That store doesn't exist"), 400)
  }

  try {
    const product = await updateProduct(g.db, g.id, body)
    if (!product) return fail(bi("상품이 없습니다", "Product not found"), 404)
    await cleanupAfterSave(product)
    return NextResponse.json({ success: true, product }, { headers: noStore })
  } catch (e) {
    return fail(e instanceof Error ? e.message : bi("수정하지 못했습니다", "Couldn't update"), 500)
  }
}

async function handleDELETE(request: Request, ctx: Ctx) {
  const g = await guard(request, ctx, true)
  if ("err" in g) return g.err
  try {
    const ok = await deleteProduct(g.db, g.id)
    if (!ok) return fail(bi("상품이 없습니다", "Product not found"), 404)
    return NextResponse.json({ success: true }, { headers: noStore })
  } catch (e) {
    return fail(e instanceof Error ? e.message : bi("삭제하지 못했습니다", "Couldn't delete"), 500)
  }
}

// (2026-11-14) 저장 뒤 3D 폴더 정리 — 지금 쓰는 OBJ·MTL·텍스처·구운 파일만 남김 (model-cleanup.ts)
async function cleanupAfterSave(product: Record<string, unknown> | null | undefined) {
  try {
    const media = product?.media as { model_file?: string } | string | null | undefined
    const m = typeof media === "string" ? (JSON.parse(media) as { model_file?: string }) : media
    const modelFile = m?.model_file || (product?.model_path as string | undefined) || ""
    const bucket = await getAssetsBucket()
    if (bucket && modelFile) await cleanupModelFolder(bucket, modelFile)
  } catch {
    /* 정리 실패는 저장 결과에 영향 없음 */
  }
}

export const GET = withLang(handleGET)
export const PUT = withLang(handlePUT)
export const DELETE = withLang(handleDELETE)
