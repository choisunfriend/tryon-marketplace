import { NextResponse } from "next/server"
import { getProductsDb } from "@/lib/products-db"
import { ID_RE } from "@/lib/salons-db"
import { shopsForProduct, shopsInBox } from "@/lib/shops-db"

// ============================================================================
// (2026-11-22) 옷가게 지도 — 공개 목록
//   GET /api/shops?bbox=west,south,east,north[&limit=300]  지도에 보이는 범위
//   GET /api/shops?product=<상품 id>                       그 상품을 파는 매장들(상품 페이지 작은 지도)
//   영업 중(입점사·매장 active)만.
// ============================================================================

const cache = { "Cache-Control": "public, max-age=30, s-maxage=60" }

export async function GET(request: Request) {
  const url = new URL(request.url)
  const db = await getProductsDb()
  if (!db) return NextResponse.json({ success: false, error: "DB 없음" }, { status: 503 })

  const product = url.searchParams.get("product")
  if (product !== null) {
    if (!ID_RE.test(product)) return NextResponse.json({ success: false, error: "잘못된 product" }, { status: 400 })
    try {
      return NextResponse.json({ success: true, shops: await shopsForProduct(db, product) }, { headers: cache })
    } catch {
      return NextResponse.json({ success: true, shops: [] }, { headers: cache }) // 0005 전이면 조용히 빈 목록
    }
  }

  const parts = (url.searchParams.get("bbox") ?? "-180,-90,180,90").split(",").map(Number)
  if (parts.length !== 4 || parts.some((n) => !Number.isFinite(n))) {
    return NextResponse.json({ success: false, error: "bbox=west,south,east,north" }, { status: 400 })
  }
  const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v))
  let [w, s, e, n] = parts
  const wrap = (x: number) => ((((x + 180) % 360) + 360) % 360) - 180
  if (e - w >= 360) {
    w = -180
    e = 180
  } else {
    w = wrap(w)
    e = wrap(e)
  }
  s = clamp(s, -90, 90)
  n = clamp(n, -90, 90)
  const limit = clamp(Math.floor(Number(url.searchParams.get("limit") ?? 300)) || 300, 1, 500)
  try {
    const shops = await shopsInBox(db, { w, s, e, n }, limit)
    return NextResponse.json({ success: true, shops, truncated: shops.length >= limit }, { headers: cache })
  } catch {
    return NextResponse.json({ success: false, error: "옷가게 목록을 읽지 못했습니다 — 0005 마이그레이션을 실행했는지 확인하세요" }, { status: 500 })
  }
}
