// ============================================================================
// (2026-11-28) 새 예약이 들어왔을 때 원장에게 알리는 곳 — 한 곳에 모아 둠
// ============================================================================
// 지금: 이메일(RESEND_API_KEY · MAIL_FROM 이 있을 때만). 없으면 아무것도 안 보내고, 스케줄표에만 보입니다.
// 나중: 미용실용 앱을 만들면 여기에 푸시 알림(APNs·FCM)을 붙이면 됩니다 — 예약 API 는 손댈 필요 없음.
//   예) await sendPushToStore(db, salon.store_id, { title: "새 예약", body: `${b.date} ${b.time}` })
// 알림이 실패해도 예약은 이미 저장되어 있으므로 오류를 손님에게 돌려주지 않습니다.
// ============================================================================
import type { D1Database } from "@/lib/products-db"
import { notifySalon, type BookingRow } from "@/lib/bookings-db"

export async function onNewBooking(db: D1Database, b: BookingRow, salon: { name: string; store_id: string }, adminUrl: string): Promise<void> {
  try {
    await notifySalon(db, b, salon, adminUrl)
  } catch {
    /* 알림 실패는 무시 */
  }
  // TODO(미용실 앱): 푸시 알림
}
