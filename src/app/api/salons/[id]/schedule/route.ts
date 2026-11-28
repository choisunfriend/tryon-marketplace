// GET /api/salons/{id}/schedule?date=YYYY-MM-DD — 그날 예약된 시간칸만(누가 예약했는지는 안 보임) · 공개
//   → { success, date, taken: ["10:00", "14:30", …] }
import { NextResponse } from "next/server"
import { corsHeaders, preflight } from "@/lib/customer-auth"
import { getProductsDb } from "@/lib/products-db"
import { ID_RE } from "@/lib/salons-db"
import { DATE_RE, takenTimes } from "@/lib/bookings-db"

type Ctx = { params: Promise<{ id: string }> }

export async function GET(request: Request, ctx: Ctx) {
  const { id } = await ctx.params
  const date = new URL(request.url).searchParams.get("date") ?? ""
  const h = { ...corsHeaders(request), "Cache-Control": "no-store" }
  if (!ID_RE.test(id) || !DATE_RE.test(date)) return NextResponse.json({ success: false, error: "bad request" }, { status: 400, headers: h })
  const db = await getProductsDb()
  if (!db) return NextResponse.json({ success: false, error: "DB" }, { status: 503, headers: h })
  try {
    return NextResponse.json({ success: true, date, taken: await takenTimes(db, id, date) }, { headers: h })
  } catch {
    // 예약 테이블이 아직 없으면(0006 미실행) 비어 있는 것으로
    return NextResponse.json({ success: true, date, taken: [] }, { headers: h })
  }
}
export const OPTIONS = (request: Request) => preflight(request)
