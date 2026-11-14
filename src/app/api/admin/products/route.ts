import { NextResponse } from "next/server"
import { getAssetsBucket } from "@/lib/assets-bucket"
import { cleanupModelFolder } from "@/lib/model-cleanup"
import { fail, noStore, requireAdmin } from "@/lib/admin-guard"
import { createProduct, listProducts, MAX_PRODUCT_BODY } from "@/lib/products-db"

// ============================================================================
// 관리자 상품 — GET 목록 · POST 등록 (D1 직접)
// ============================================================================
// (2026-11-01) 마켓플레이스
//   · 입점사 계정: 자기 입점사 상품만 보이고, 등록하면 store_id 가 자기 입점사로 고정
//   · platform: 전부 보임(?store=ID 로 거르기), 등록 때 body.store_id 로 입점사 지정(없으면 default)
// (예전의 "D1 없으면 백엔드 Worker 로 넘김" 경로는 입점사 구분을 못 해서 뺐습니다)
// ============================================================================

const STORE_ID_RE = /^[A-Za-z0-9_-]{1,80}$/

export async function GET(request: Request) {
  const g = await requireAdmin(request)
  if ("err" in g) return g.err
  const { session, db } = g
  const q = new URL(request.url).searchParams.get("store")
  const storeId = session.role === "platform" ? (q && STORE_ID_RE.test(q) ? q : null) : session.sid
  try {
    const products = await listProducts(db, storeId)
    return NextResponse.json({ success: true, products }, { headers: noStore })
  } catch (e) {
    return fail(e instanceof Error ? e.message : "목록을 읽지 못했습니다", 500)
  }
}

export async function POST(request: Request) {
  const g = await requireAdmin(request, { write: true })
  if ("err" in g) return g.err
  const { session, db } = g

  const text = await request.text()
  if (text.length > MAX_PRODUCT_BODY) return fail("요청이 너무 큽니다", 413)
  let body: Record<string, unknown>
  try {
    body = JSON.parse(text)
  } catch {
    return fail("JSON 형식이 아닙니다", 400)
  }
  if (!body || typeof body !== "object" || !String(body.name ?? "").trim()) return fail("상품 이름이 필요합니다", 400)

  if (session.role === "platform") {
    const sid = typeof body.store_id === "string" && STORE_ID_RE.test(body.store_id) ? body.store_id : "default"
    if (!(await db.prepare(`SELECT 1 FROM stores WHERE id = ?`).bind(sid).first())) return fail("없는 입점사입니다", 400)
    body.store_id = sid
  } else {
    body.store_id = session.sid // 입점사 계정은 다른 입점사로 못 넣음
  }

  try {
    const product = await createProduct(db, body)
    await cleanupAfterSave(product)
    return NextResponse.json({ success: true, product }, { status: 201, headers: noStore })
  } catch (e) {
    return fail(e instanceof Error ? e.message : "등록하지 못했습니다", 500)
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
