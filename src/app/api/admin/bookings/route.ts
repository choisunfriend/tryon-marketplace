// GET /api/admin/bookings?from=YYYY-MM-DD&to=YYYY-MM-DD&salonId= — 원장 스케줄표(예약자 정보 포함)
//   입점사 계정은 자기 미용실 예약만 · platform 은 전부
//   미용실용 앱도 이 API 로 스케줄을 읽으면 됩니다(같은 관리자 로그인).
import { NextResponse } from "next/server"
import { fail, noStore, requireAdmin } from "@/lib/admin-guard"
import { withLang } from "@/i18n/api"
import { bi } from "@/i18n/l"
import { DATE_RE, listSalonBookings } from "@/lib/bookings-db"
import { ID_RE } from "@/lib/salons-db"

async function handleGET(request: Request) {
  const g = await requireAdmin(request)
  if ("err" in g) return g.err
  const q = new URL(request.url).searchParams
  const today = new Date().toISOString().slice(0, 10)
  const from = DATE_RE.test(q.get("from") ?? "") ? q.get("from")! : today
  const to = DATE_RE.test(q.get("to") ?? "") ? q.get("to")! : new Date(Date.now() + 13 * 86400000).toISOString().slice(0, 10)
  const salonId = q.get("salonId")
  if (salonId && !ID_RE.test(salonId)) return fail(bi("잘못된 미용실입니다", "Invalid salon"))
  try {
    const bookings = await listSalonBookings(g.db, {
      storeId: g.session.role === "platform" ? null : g.session.sid,
      salonId: salonId || null,
      from,
      to,
    })
    return NextResponse.json({ success: true, from, to, bookings }, { headers: noStore })
  } catch {
    return fail(bi("예약을 읽지 못했습니다 — migrations/0006_bookings.sql 을 실행했는지 확인하세요", "Couldn't load bookings — check that migrations/0006_bookings.sql was run"), 500)
  }
}

export const GET = withLang(handleGET)
