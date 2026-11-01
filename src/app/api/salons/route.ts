import { NextResponse } from "next/server"
import { getProductsDb } from "@/lib/products-db"
import { salonsInBox } from "@/lib/salons-db"

// ============================================================================
// (2026-11-01) 미용실 지도 — 공개 목록
//   GET /api/salons?bbox=west,south,east,north[&limit=300]
//   지도 화면이 움직일 때마다 보이는 범위만 가져감. 영업 중(입점사·미용실 active)만.
// ============================================================================

const cache = { "Cache-Control": "public, max-age=30, s-maxage=60" }

export async function GET(request: Request) {
  const url = new URL(request.url)
  const parts = (url.searchParams.get("bbox") ?? "-180,-90,180,90").split(",").map(Number)
  if (parts.length !== 4 || parts.some((n) => !Number.isFinite(n))) {
    return NextResponse.json({ success: false, error: "bbox=west,south,east,north" }, { status: 400 })
  }
  const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v))
  let [w, s, e, n] = parts
  // 지도를 한 바퀴 넘게 돌리면 경도가 ±180 을 넘음 → 감아서 정리
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

  const db = await getProductsDb()
  if (!db) return NextResponse.json({ success: false, error: "DB 없음" }, { status: 503 })
  try {
    const salons = await salonsInBox(db, { w, s, e, n }, limit)
    return NextResponse.json({ success: true, salons, truncated: salons.length >= limit }, { headers: cache })
  } catch {
    return NextResponse.json({ success: false, error: "미용실 목록을 읽지 못했습니다 — 0003 마이그레이션을 실행했는지 확인하세요" }, { status: 500 })
  }
}
