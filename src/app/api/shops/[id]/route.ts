import { NextResponse } from "next/server"
import { getProductsDb } from "@/lib/products-db"
import { ID_RE } from "@/lib/salons-db"
import { publicShopDetail } from "@/lib/shops-db"

// (2026-11-22) 옷가게 하나 + 메뉴판(그 입점사의 영업 중 상품) — 공개
type Ctx = { params: Promise<{ id: string }> }

export async function GET(_request: Request, ctx: Ctx) {
  const { id } = await ctx.params
  if (!ID_RE.test(id)) return NextResponse.json({ success: false, error: "잘못된 id" }, { status: 400 })
  const db = await getProductsDb()
  if (!db) return NextResponse.json({ success: false, error: "DB 없음" }, { status: 503 })
  try {
    const d = await publicShopDetail(db, id)
    if (!d) return NextResponse.json({ success: false, error: "매장이 없습니다" }, { status: 404 })
    return NextResponse.json({ success: true, ...d }, { headers: { "Cache-Control": "public, max-age=30, s-maxage=60" } })
  } catch {
    return NextResponse.json({ success: false, error: "읽지 못했습니다" }, { status: 500 })
  }
}
