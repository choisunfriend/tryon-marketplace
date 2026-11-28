// ============================================================================
// (2026-11-28) 미용실 예약 — 저장·조회·상태 바꾸기 · 원장 이메일 알림
// ============================================================================
// 결제 없이 "예약 요청"만 받습니다. 원장이 관리자 화면 스케줄표에서 확정·취소합니다.
// 시간은 미용실 현지 시각 문자열(date YYYY-MM-DD · time HH:MM)로만 다룹니다 — 시간대 계산 없음.
// 같은 미용실·같은 시각에 살아 있는 예약(requested·confirmed)이 있으면 새 예약을 받지 않습니다.
// ============================================================================

import { bi } from "@/i18n/l"
import type { D1Database } from "@/lib/products-db"
import { ID_RE } from "@/lib/salons-db"

export type BookingStatus = "requested" | "confirmed" | "cancelled" | "done" | "noshow"
export const BOOKING_STATUSES: BookingStatus[] = ["requested", "confirmed", "cancelled", "done", "noshow"]
const LIVE = `('requested','confirmed')`

export interface BookingRow {
  id: string
  salon_id: string
  style_id: string | null
  style_name: string | null
  customer_id: string | null
  customer_name: string | null
  customer_phone: string | null
  customer_email: string | null
  note: string | null
  date: string
  time: string
  duration_min: number
  status: BookingStatus
  cancelled_by: string | null
  lang: string | null
  created_at: string
  updated_at: string
}

export class BookingError extends Error {
  constructor(message: string, public status = 400) {
    super(message)
  }
}

export const DATE_RE = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/
export const TIME_RE = /^([01]\d|2[0-3]):(00|30)$/ // 30분 칸

function clip(v: unknown, max: number): string | null {
  if (typeof v !== "string") return null
  const s = v.replace(/[\u0000-\u001f\u007f]/g, " ").trim()
  return s ? s.slice(0, max) : null
}

export interface BookingInput {
  salonId: string
  styleId: string | null
  date: string
  time: string
  name: string
  phone: string
  note: string | null
}

export function parseBookingInput(body: Record<string, unknown>): BookingInput {
  const salonId = String(body.salonId ?? "")
  if (!ID_RE.test(salonId)) throw new BookingError(bi("미용실을 찾을 수 없습니다", "Salon not found"), 404)
  const styleId = body.styleId == null || body.styleId === "" ? null : String(body.styleId)
  if (styleId && !ID_RE.test(styleId)) throw new BookingError(bi("시술을 찾을 수 없습니다", "Service not found"))
  const date = String(body.date ?? "")
  const time = String(body.time ?? "")
  if (!DATE_RE.test(date)) throw new BookingError(bi("날짜를 골라 주세요", "Please choose a date"))
  if (!TIME_RE.test(time)) throw new BookingError(bi("시간을 골라 주세요", "Please choose a time"))
  const name = clip(body.name, 60)
  if (!name) throw new BookingError(bi("이름을 적어 주세요", "Please enter your name"))
  const phone = clip(body.phone, 30)
  if (!phone || !/^[0-9+()\-.\s]{6,30}$/.test(phone)) throw new BookingError(bi("연락처(전화번호)를 적어 주세요", "Please enter a phone number"))
  return { salonId, styleId, date, time, name, phone, note: clip(body.note, 500) }
}

// 오늘(UTC 기준 하루 여유)보다 이전 날짜·1년 넘게 뒤는 받지 않음
function dateInRange(date: string): boolean {
  const d = Date.parse(date + "T00:00:00Z")
  if (!Number.isFinite(d)) return false
  const now = Date.now()
  return d >= now - 2 * 86400000 && d <= now + 366 * 86400000
}

export async function takenTimes(db: D1Database, salonId: string, date: string): Promise<string[]> {
  const r = await db
    .prepare(`SELECT time FROM salon_bookings WHERE salon_id = ? AND date = ? AND status IN ${LIVE} ORDER BY time`)
    .bind(salonId, date)
    .all<{ time: string }>()
  return (r.results ?? []).map((x) => x.time)
}

export async function createBooking(
  db: D1Database,
  input: BookingInput,
  customer: { id: string; email: string | null; lang: string | null }
): Promise<{ booking: BookingRow; salon: { name: string; store_id: string } }> {
  if (!dateInRange(input.date)) throw new BookingError(bi("예약할 수 없는 날짜입니다", "That date can't be booked"))
  const salon = await db
    .prepare(
      `SELECT sa.name AS name, sa.store_id AS store_id FROM salons sa JOIN stores st ON st.id = sa.store_id
        WHERE sa.id = ? AND sa.status = 'active' AND st.status = 'active'`
    )
    .bind(input.salonId)
    .first<{ name: string; store_id: string }>()
  if (!salon) throw new BookingError(bi("미용실을 찾을 수 없습니다", "Salon not found"), 404)

  let styleName: string | null = null
  let duration = 60
  if (input.styleId) {
    const st = await db
      .prepare(`SELECT name, duration_min FROM salon_styles WHERE id = ? AND salon_id = ? AND status = 'active'`)
      .bind(input.styleId, input.salonId)
      .first<{ name: string; duration_min: number | null }>()
    if (!st) throw new BookingError(bi("시술을 찾을 수 없습니다", "Service not found"), 404)
    styleName = st.name
    if (st.duration_min && st.duration_min > 0) duration = Math.min(600, st.duration_min)
  }

  // 같은 고객이 살아 있는 예약을 너무 많이 잡지 못하게(장난 예약 막기)
  const mine = await db
    .prepare(`SELECT COUNT(*) AS n FROM salon_bookings WHERE customer_id = ? AND status IN ${LIVE}`)
    .bind(customer.id)
    .first<{ n: number }>()
  if ((mine?.n ?? 0) >= 5) throw new BookingError(bi("진행 중인 예약이 너무 많습니다. 지난 예약을 취소한 뒤 다시 해 주세요", "You have too many active bookings. Cancel one and try again"), 429)

  const id = crypto.randomUUID()
  const now = new Date().toISOString()
  // 같은 시각에 살아 있는 예약이 없을 때만 넣음 (동시에 두 명이 눌러도 한 명만 들어감)
  const res = await db
    .prepare(
      `INSERT INTO salon_bookings
         (id, salon_id, style_id, style_name, customer_id, customer_name, customer_phone, customer_email, note,
          date, time, duration_min, status, lang, created_at, updated_at)
       SELECT ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'requested', ?, ?, ?
        WHERE NOT EXISTS (SELECT 1 FROM salon_bookings WHERE salon_id = ? AND date = ? AND time = ? AND status IN ${LIVE})`
    )
    .bind(
      id, input.salonId, input.styleId, styleName, customer.id, input.name, input.phone, customer.email, input.note,
      input.date, input.time, duration, customer.lang, now, now,
      input.salonId, input.date, input.time
    )
    .run()
  if (!res.meta || !res.meta.changes) throw new BookingError(bi("방금 다른 분이 그 시간을 예약했어요. 다른 시간을 골라 주세요", "Someone just booked that time. Please pick another"), 409)
  const booking = (await getBooking(db, id))!
  return { booking, salon }
}

export async function getBooking(db: D1Database, id: string): Promise<BookingRow | null> {
  if (!/^[0-9a-f-]{36}$/.test(id)) return null
  return db.prepare(`SELECT * FROM salon_bookings WHERE id = ?`).bind(id).first<BookingRow>()
}

export async function listMyBookings(db: D1Database, customerId: string) {
  const r = await db
    .prepare(
      `SELECT b.id, b.salon_id, b.style_name, b.date, b.time, b.duration_min, b.status, b.note, b.created_at,
              sa.name AS salon_name, sa.address AS salon_address, sa.phone AS salon_phone
         FROM salon_bookings b LEFT JOIN salons sa ON sa.id = b.salon_id
        WHERE b.customer_id = ?
        ORDER BY b.date DESC, b.time DESC LIMIT 50`
    )
    .bind(customerId)
    .all()
  return r.results ?? []
}

export async function cancelMyBooking(db: D1Database, customerId: string, id: string): Promise<boolean> {
  const r = await db
    .prepare(
      `UPDATE salon_bookings SET status = 'cancelled', cancelled_by = 'customer', updated_at = ?
        WHERE id = ? AND customer_id = ? AND status IN ${LIVE}`
    )
    .bind(new Date().toISOString(), id, customerId)
    .run()
  return !!r.meta?.changes
}

// 관리자(원장): 기간 안 예약 — platform 은 storeId=null 이면 전부
export async function listSalonBookings(
  db: D1Database,
  opts: { storeId: string | null; salonId: string | null; from: string; to: string }
) {
  const where = [`b.date BETWEEN ? AND ?`]
  const args: unknown[] = [opts.from, opts.to]
  if (opts.storeId) { where.push(`sa.store_id = ?`); args.push(opts.storeId) }
  if (opts.salonId) { where.push(`b.salon_id = ?`); args.push(opts.salonId) }
  const r = await db
    .prepare(
      `SELECT b.*, sa.name AS salon_name FROM salon_bookings b JOIN salons sa ON sa.id = b.salon_id
        WHERE ${where.join(" AND ")} ORDER BY b.date, b.time LIMIT 500`
    )
    .bind(...args)
    .all()
  return r.results ?? []
}

export async function setBookingStatus(db: D1Database, id: string, status: BookingStatus): Promise<void> {
  await db
    .prepare(`UPDATE salon_bookings SET status = ?, cancelled_by = CASE WHEN ? = 'cancelled' THEN 'salon' ELSE cancelled_by END, updated_at = ? WHERE id = ?`)
    .bind(status, status, new Date().toISOString(), id)
    .run()
}

// 탈퇴: 앞으로의 예약은 취소, 모든 예약에서 개인정보를 지우고 고객 연결을 끊음
export async function scrubCustomerBookings(db: D1Database, customerId: string): Promise<void> {
  const today = new Date().toISOString().slice(0, 10)
  const now = new Date().toISOString()
  try {
    await db
      .prepare(`UPDATE salon_bookings SET status = 'cancelled', cancelled_by = 'customer', updated_at = ? WHERE customer_id = ? AND date >= ? AND status IN ${LIVE}`)
      .bind(now, customerId, today)
      .run()
    await db
      .prepare(
        `UPDATE salon_bookings SET customer_id = NULL, customer_name = NULL, customer_phone = NULL, customer_email = NULL,
                note = NULL, updated_at = ? WHERE customer_id = ?`
      )
      .bind(now, customerId)
      .run()
  } catch {
    /* 예약 테이블이 아직 없으면(0006 미실행) 지울 것도 없음 */
  }
}

// ---------------------------------------------------------------------------
// 원장 알림 이메일 — Resend (RESEND_API_KEY · MAIL_FROM 이 있을 때만)
//   받는 주소: 그 미용실 입점사의 contact_email (관리자 → 입점사 정보)
//   키가 없거나 보내기에 실패해도 예약은 저장되고 스케줄표에는 보입니다.
// ---------------------------------------------------------------------------
export async function notifySalon(db: D1Database, b: BookingRow, salon: { name: string; store_id: string }, adminUrl: string): Promise<boolean> {
  const key = process.env.RESEND_API_KEY
  const from = process.env.MAIL_FROM
  if (!key || !from) return false
  const store = await db.prepare(`SELECT contact_email FROM stores WHERE id = ?`).bind(salon.store_id).first<{ contact_email: string | null }>()
  const to = store?.contact_email
  if (!to || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) return false
  const esc = (s: string | null) => (s ?? "").replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`)
  const subject = `[Stylepeek] 새 예약 요청 · New booking — ${salon.name} ${b.date} ${b.time}`
  const html = `<p><b>${esc(salon.name)}</b>에 새 예약 요청이 왔습니다. / A new booking request has arrived.</p>
<table cellpadding="4">
<tr><td>날짜·시간 / When</td><td><b>${esc(b.date)} ${esc(b.time)}</b> (${b.duration_min}min)</td></tr>
<tr><td>시술 / Service</td><td>${esc(b.style_name) || "-"}</td></tr>
<tr><td>이름 / Name</td><td>${esc(b.customer_name)}</td></tr>
<tr><td>연락처 / Phone</td><td>${esc(b.customer_phone)}</td></tr>
<tr><td>메모 / Note</td><td>${esc(b.note) || "-"}</td></tr>
</table>
<p>확정·취소는 관리자 화면에서 / Confirm or cancel in the admin: <a href="${esc(adminUrl)}">${esc(adminUrl)}</a></p>`
  try {
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from, to: [to], subject, html }),
    })
    return r.ok
  } catch {
    return false
  }
}
