import { NextResponse } from "next/server"
import { getProductsDb } from "@/lib/products-db"
import { ID_RE, publicStyleSpec } from "@/lib/salons-db"

// (2026-11-01) 헤어스타일 하나의 스펙 — 지도에서 「입어 보기」를 누를 때만 받음 (미용실 화면은 가벼운 정보만)
type Ctx = { params: Promise<{ id: string }> }

export async function GET(_request: Request, ctx: Ctx) {
  const { id } = await ctx.params
  if (!ID_RE.test(id)) return NextResponse.json({ success: false, error: "잘못된 id" }, { status: 400 })
  const db = await getProductsDb()
  if (!db) return NextResponse.json({ success: false, error: "DB 없음" }, { status: 503 })
  try {
    const style = await publicStyleSpec(db, id)
    if (!style) return NextResponse.json({ success: false, error: "스타일이 없습니다" }, { status: 404 })
    return NextResponse.json({ success: true, style }, { headers: { "Cache-Control": "public, max-age=60, s-maxage=300" } })
  } catch {
    return NextResponse.json({ success: false, error: "읽지 못했습니다" }, { status: 500 })
  }
}
