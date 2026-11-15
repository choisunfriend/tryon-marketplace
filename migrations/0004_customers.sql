-- ============================================================================
-- (2026-11-15) 고객(손님 앱 사용자) 계정
-- ============================================================================
-- 실행 (한 번만):
--   npx wrangler d1 execute tryon-marketplace-db --remote --file=migrations/0004_customers.sql
--   (대시보드 → D1 → tryon-marketplace-db → Console 에 이 파일 내용을 붙여 넣어도 됩니다)
--
-- 구조
--   customers           고객 한 명. 처음엔 가입 없이(anonymous) 만들어지고, 로그인하면 정식(member)이 됨
--   customer_identities 그 고객이 연결한 로그인 수단(apple · google · kakao) — 한 고객에 여러 개 가능
--   customer_sessions   앱이 들고 다니는 로그인 증표. 토큰 자체는 저장하지 않고 SHA-256 값만 저장
--   customer_wishlist   찜 목록 (기기를 바꿔도 따라옴)
--
-- 입점사·미용실 관리자 계정(store_users)과는 완전히 따로입니다.
-- ============================================================================

CREATE TABLE IF NOT EXISTS customers (
  id            TEXT PRIMARY KEY,                       -- UUID
  kind          TEXT NOT NULL DEFAULT 'anonymous'       -- anonymous(가입 전) | member(로그인 연결됨)
                CHECK (kind IN ('anonymous', 'member')),
  display_name  TEXT,
  email         TEXT COLLATE NOCASE,                    -- 로그인 수단이 알려 준 이메일(없을 수 있음 · 애플은 가림 주소일 수 있음)
  lang          TEXT,                                   -- en | ko
  country       TEXT,                                   -- ISO 2글자 (Cloudflare 가 알려 준 접속 국가)
  disabled      INTEGER NOT NULL DEFAULT 0,
  created_at    TEXT NOT NULL,
  updated_at    TEXT NOT NULL,
  last_seen_at  TEXT
);
CREATE INDEX IF NOT EXISTS idx_customers_email ON customers(email);

CREATE TABLE IF NOT EXISTS customer_identities (
  provider      TEXT NOT NULL CHECK (provider IN ('apple', 'google', 'kakao')),
  subject       TEXT NOT NULL,                          -- 로그인 수단이 주는 그 사람 고유 번호(sub)
  customer_id   TEXT NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  email         TEXT COLLATE NOCASE,
  created_at    TEXT NOT NULL,
  last_login_at TEXT,
  PRIMARY KEY (provider, subject)
);
CREATE INDEX IF NOT EXISTS idx_customer_identities_customer ON customer_identities(customer_id);

CREATE TABLE IF NOT EXISTS customer_sessions (
  token_hash    TEXT PRIMARY KEY,                       -- SHA-256(토큰) hex
  customer_id   TEXT NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  platform      TEXT,                                   -- ios | android | web
  device_label  TEXT,                                   -- 앱이 보낸 기기 아이디(구분용 · 비밀 아님)
  created_at    TEXT NOT NULL,
  last_used_at  TEXT,
  expires_at    TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_customer_sessions_customer ON customer_sessions(customer_id);

CREATE TABLE IF NOT EXISTS customer_wishlist (
  customer_id   TEXT NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  product_id    TEXT NOT NULL,
  created_at    TEXT NOT NULL,
  PRIMARY KEY (customer_id, product_id)
);
