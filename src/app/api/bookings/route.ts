// /api/bookings — 손님 예약 (로그인 필수 · Authorization: Bearer gy_…)
//   GET  → { success, bookings }                  내 예약 목록
//   POST { salonId, styleId?, date, time, name, phone, note? } → { success, booking }
//        결제 없이 "예약 요청"으로 저장 → 원장 스케줄표에 표시 · 원장 알림(onNewBooking)
import { withLang } from "@/i18n/api"
import { bi } from "@/i18n/l"
import { cfail, cjson, clientInfo, overCustomerLimit, preflight, readJson, requireCustomer } from "@/lib/customer-auth"
import { BookingError, createBooking, listMyBookings, parseBookingInput } from "@/lib/bookings-db"
import { onNewBooking } from "@/lib/booking-notify"

async function handleGET(request: Request) {
  const g = await requireCustomer(request)
  if ("err" in g) return g.err
  try {
    return cjson(request, { success: true, bookings: await listMyBookings(g.db, g.customer.id) })
  } catch {
    return cfail(request, bi("예약 테이블이 없습니다 — migrations/0006_bookings.sql 을 실행하세요", "Bookings table missing — run migrations/0006_bookings.sql"), 503)
  }
}

async function handlePOST(request: Request) {
  const g = await requireCustomer(request)
  if ("err" in g) return g.err
  if (g.customer.kind !== "member") return cfail(request, bi("로그인한 뒤 예약할 수 있어요", "Please sign in to book"), 401)
  if (await overCustomerLimit(`book:${clientInfo(request).ip}`)) return cfail(request, bi("요청이 너무 많습니다. 잠시 뒤 다시 해 주세요", "Too many requests. Try again shortly"), 429)
  const body = await readJson(request)
  if (!body) return cfail(request, bi("JSON 형식이 아닙니다", "Not valid JSON"))
  try {
    const input = parseBookingInput(body)
    const { booking, salon } = await createBooking(g.db, input, { id: g.customer.id, email: g.customer.email, lang: g.customer.lang })
    await onNewBooking(g.db, booking, salon, new URL("/admin/bookings", request.url).toString())
    return cjson(request, { success: true, booking: { id: booking.id, date: booking.date, time: booking.time, status: booking.status, style_name: booking.style_name } }, 201)
  } catch (e) {
    if (e instanceof BookingError) return cfail(request, e.message, e.status)
    return cfail(request, bi("예약하지 못했습니다 — migrations/0006_bookings.sql 을 실행했는지 확인하세요", "Couldn't book — check that migrations/0006_bookings.sql was run"), 500)
  }
}

export const GET = withLang(handleGET)
export const POST = withLang(handlePOST)
export const OPTIONS = (request: Request) => preflight(request)
