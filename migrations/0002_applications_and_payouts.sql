-- ============================================================================
-- (2026-11-01) 마켓플레이스 2단계 — 입점 신청·심사 · 나라/통화 · 정산 장부 · 지급
-- ============================================================================
-- 0001 다음에 한 번만 실행. (대시보드 → D1 → tryon-marketplace-db → Console 에 붙여넣기)
-- ============================================================================

-- 입점사: 나라·통화
ALTER TABLE stores ADD COLUMN country TEXT NOT NULL DEFAULT 'KR';      -- KR | US (늘릴 수 있음)
ALTER TABLE stores ADD COLUMN currency TEXT NOT NULL DEFAULT 'KRW';    -- 정산 통화 KRW | USD

-- 입점 심사 (영업 상태 status 와 별개)
--   pending(심사 중) → approved(승인 · status=active) | rejected(거절 · status=pending 유지)
ALTER TABLE stores ADD COLUMN review_status TEXT NOT NULL DEFAULT 'approved';
ALTER TABLE stores ADD COLUMN review_note TEXT;          -- 거절 사유 등 (신청자에게 보임)
ALTER TABLE stores ADD COLUMN applied_at TEXT;
ALTER TABLE stores ADD COLUMN reviewed_at TEXT;
ALTER TABLE stores ADD COLUMN contact_name TEXT;
ALTER TABLE stores ADD COLUMN contact_phone TEXT;
ALTER TABLE stores ADD COLUMN business_info TEXT;        -- JSON (나라별 사업자 정보)

-- 정산 받는 방법
ALTER TABLE stores ADD COLUMN payout_provider TEXT;      -- manual | toss | payoneer (비우면 나라 기본값)
ALTER TABLE stores ADD COLUMN payout_status TEXT NOT NULL DEFAULT 'not_connected'; -- not_connected | pending | connected
ALTER TABLE stores ADD COLUMN payout_ref TEXT;           -- 업체 쪽 판매자 id (토스 셀러 id · 페이오니아 payee id)
ALTER TABLE stores ADD COLUMN payout_account TEXT;       -- JSON (한국: 은행·예금주·계좌)

-- 정산 장부: 판매자에게 줄 돈의 증감을 한 줄씩 (금액은 최소 단위 정수 — KRW 원, USD 센트)
--   sale(+판매액) · commission(-수수료) · refund(-환불) · adjustment(±조정)
--   payout_id 가 비어 있으면 아직 지급 안 된 잔액
CREATE TABLE IF NOT EXISTS ledger_entries (
  id           TEXT PRIMARY KEY,
  store_id     TEXT NOT NULL REFERENCES stores(id),
  type         TEXT NOT NULL CHECK (type IN ('sale', 'commission', 'refund', 'adjustment')),
  amount_minor INTEGER NOT NULL,
  currency     TEXT NOT NULL,
  order_ref    TEXT,
  memo         TEXT,
  payout_id    TEXT,
  created_at   TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_ledger_store_open ON ledger_entries(store_id, currency, payout_id);

-- 지급 (한 번 송금 = 한 줄)
CREATE TABLE IF NOT EXISTS payouts (
  id           TEXT PRIMARY KEY,
  store_id     TEXT NOT NULL REFERENCES stores(id),
  provider     TEXT NOT NULL,                  -- manual | toss | payoneer
  amount_minor INTEGER NOT NULL,
  currency     TEXT NOT NULL,
  status       TEXT NOT NULL CHECK (status IN ('processing', 'paid', 'failed')),
  provider_ref TEXT,                           -- 업체 쪽 지급 id
  error        TEXT,
  created_at   TEXT NOT NULL,
  updated_at   TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_payouts_store ON payouts(store_id, created_at);
