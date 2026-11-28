-- (2026-11-28) 약관 동의 기록 — 누가 어떤 약관(버전)에 언제 동의/철회했는지
-- 개인정보보호법·정보통신망법상 동의 받은 사실을 입증할 수 있어야 해서 남깁니다. 탈퇴하면 지웁니다.
CREATE TABLE IF NOT EXISTS customer_consents (
  customer_id TEXT NOT NULL,
  item        TEXT NOT NULL,      -- age14 | terms | privacy | salon_share | marketing
  version     TEXT NOT NULL,      -- 약관 버전(시행일) 예: 2026-12-01
  agreed      INTEGER NOT NULL,   -- 1 동의 · 0 철회/미동의
  lang        TEXT,
  updated_at  TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (customer_id, item)
);
