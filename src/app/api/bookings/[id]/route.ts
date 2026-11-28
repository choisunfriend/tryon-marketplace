// DELETE /api/bookings/{id} — 내 예약 취소 (로그인 필수)
import { withLang } from "@/i18n/api"
import { bi } from "@/i18n/l"
import { cfail, cjson, preflight, requireCustomer } from "@/lib/customer-auth"
import { cancelMyBooking } from "@/lib/bookings-db"

type Ctx = { params: Promise<{ id: string }> }

async function handleDELETE(request: Request, ctx: Ctx) {
  const g = await requireCustomer(request)
  if ("err" in g) return g.err
  const { id } = await ctx.params
  if (!/^[0-9a-f-]{36}$/.test(id)) return cfail(request, bi("예약을 찾을 수 없습니다", "Booking not found"), 404)
  const ok = await cancelMyBooking(g.db, g.customer.id, id)
  if (!ok) return cfail(request, bi("취소할 수 없는 예약입니다", "This booking can't be cancelled"), 404)
  return cjson(request, { success: true })
}

export const DELETE = withLang(handleDELETE)
export const OPTIONS = (request: Request) => preflight(request)
