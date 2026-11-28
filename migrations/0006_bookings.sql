-- ============================================================================
-- (2026-11-28) 미용실 예약 — 결제 없이 예약만 받고, 원장 스케줄표에 표시 + 이메일 알림
-- ============================================================================
-- 실행 (한 번만):
--   npx wrangler d1 execute tryon-marketplace-db --remote --file=migrations/0006_bookings.sql
--   (대시보드 → D1 → tryon-marketplace-db → Console 에 붙여 넣어도 됩니다)
--
-- 시간은 "미용실 현지 시각" 문자열로 저장합니다(날짜 YYYY-MM-DD · 시각 HH:MM).
--   나라마다 시간대가 달라도 원장이 보는 그대로라 바꿔 계산할 일이 없습니다.
-- 고객이 탈퇴하면 customer_id 는 NULL, 이름·연락처·메모는 지우고, 앞으로의 예약은 취소로 바꿉니다.
-- ============================================================================

CREATE TABLE IF NOT EXISTS salon_bookings (
  id             TEXT PRIMARY KEY,
  salon_id       TEXT NOT NULL REFERENCES salons(id) ON DELETE CASCADE,
  style_id       TEXT,                                   -- 고른 시술(없을 수 있음)
  style_name     TEXT,                                   -- 그때 이름 그대로(시술이 지워져도 남게)
  customer_id    TEXT,                                   -- 탈퇴하면 NULL
  customer_name  TEXT,
  customer_phone TEXT,
  customer_email TEXT,
  note           TEXT,
  date           TEXT NOT NULL,                          -- YYYY-MM-DD (미용실 현지)
  time           TEXT NOT NULL,                          -- HH:MM (미용실 현지)
  duration_min   INTEGER NOT NULL DEFAULT 60,
  status         TEXT NOT NULL DEFAULT 'requested'
                 CHECK (status IN ('requested', 'confirmed', 'cancelled', 'done', 'noshow')),
  cancelled_by   TEXT,                                   -- customer | salon
  lang           TEXT,
  created_at     TEXT NOT NULL,
  updated_at     TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_bookings_salon_date ON salon_bookings(salon_id, date, time);
CREATE INDEX IF NOT EXISTS idx_bookings_customer   ON salon_bookings(customer_id, date);
