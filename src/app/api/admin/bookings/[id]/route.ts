// PATCH /api/admin/bookings/{id}  body { status: confirmed|cancelled|done|noshow } — 원장이 확정·취소
import { NextResponse } from "next/server"
import { fail, noStore, requireAdmin } from "@/lib/admin-guard"
import { withLang } from "@/i18n/api"
import { bi } from "@/i18n/l"
import { BOOKING_STATUSES, getBooking, setBookingStatus, type BookingStatus } from "@/lib/bookings-db"
import { ownSalon } from "@/lib/salons-guard"

type Ctx = { params: Promise<{ id: string }> }

async function handlePATCH(request: Request, ctx: Ctx) {
  const g = await requireAdmin(request, { write: true })
  if ("err" in g) return g.err
  const { id } = await ctx.params
  const b = await getBooking(g.db, id)
  if (!b || !(await ownSalon(g.session, g.db, b.salon_id))) return fail(bi("예약을 찾을 수 없습니다", "Booking not found"), 404)
  let body: Record<string, unknown>
  try { body = await request.json() } catch { return fail(bi("JSON 형식이 아닙니다", "Not valid JSON")) }
  const status = String(body.status ?? "") as BookingStatus
  if (!BOOKING_STATUSES.includes(status) || status === "requested") return fail(bi("바꿀 수 없는 상태입니다", "Invalid status"))
  await setBookingStatus(g.db, id, status)
  return NextResponse.json({ success: true, booking: await getBooking(g.db, id) }, { headers: noStore })
}

export const PATCH = withLang(handlePATCH)
