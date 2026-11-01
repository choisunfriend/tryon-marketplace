import { NextResponse } from "next/server"
import { isAdminRequest, isSameOriginWrite } from "@/lib/security"
import { createProduct, getProductsDb, listProducts, MAX_PRODUCT_BODY } from "@/lib/products-db"

// ============================================================================
// 관리자 상품 — GET 목록 · POST 등록
// ============================================================================
// (2026-11-01) D1(DB 바인딩)을 직접 읽고 씁니다 — 목록에는 draft·archived 도 다 보임.
// DB 바인딩이 없으면 POST 만 예전처럼 백엔드 Worker 로 넘깁니다(BACKEND_ADMIN_TOKEN).
// ============================================================================

const noStore = { "Cache-Control": "no-store" }

function fail(error: string, status: number) {
  return NextResponse.json({ success: false, error }, { status, headers: noStore })
}

function backendBase() {
  return (
    process.env.NEXT_PUBLIC_API_BASE_URL ?? "https://tryon-marketplace.choisunfriend.workers.dev"
  ).replace(/\/+$/, "")
}

export async function GET(request: Request) {
  if (!(await isAdminRequest(request))) return fail("관리자 로그인이 필요합니다", 401)
  const db = await getProductsDb()
  if (!db) return fail("D1 바인딩(DB)이 없습니다 — wrangler.jsonc 의 d1_databases 를 확인하세요", 503)
  try {
    const products = await listProducts(db)
    return NextResponse.json({ success: true, products }, { headers: noStore })
  } catch (e) {
    return fail(e instanceof Error ? e.message : "목록을 읽지 못했습니다", 500)
  }
}

export async function POST(request: Request) {
  if (!(await isAdminRequest(request))) return fail("관리자 로그인이 필요합니다", 401)
  if (!isSameOriginWrite(request)) return fail("허용되지 않은 요청 출처입니다", 403)

  const text = await request.text()
  if (text.length > MAX_PRODUCT_BODY) return fail("요청이 너무 큽니다", 413)
  let body: Record<string, unknown>
  try {
    body = JSON.parse(text)
  } catch {
    return fail("JSON 형식이 아닙니다", 400)
  }
  if (!body || typeof body !== "object" || !String(body.name ?? "").trim()) return fail("상품 이름이 필요합니다", 400)

  const db = await getProductsDb()
  if (db) {
    try {
      const product = await createProduct(db, body)
      return NextResponse.json({ success: true, product }, { status: 201, headers: noStore })
    } catch (e) {
      return fail(e instanceof Error ? e.message : "등록하지 못했습니다", 500)
    }
  }

  // D1 바인딩이 없을 때 — 예전 방식(백엔드 Worker 로 넘김)
  const token = process.env.BACKEND_ADMIN_TOKEN
  if (!token) return fail("D1 바인딩(DB)도 BACKEND_ADMIN_TOKEN 도 없습니다", 503)
  const res = await fetch(`${backendBase()}/api/products`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: text,
  })
  return new Response(await res.text(), {
    status: res.status,
    headers: { "Content-Type": res.headers.get("content-type") ?? "application/json", ...noStore },
  })
}
