-- ============================================================================
-- (2026-11-01) 마켓플레이스 1단계 — 입점사(stores) · 관리 계정(store_users) · 상품 소속(products.store_id)
-- ============================================================================
-- 실행 (한 번만):
--   npx wrangler d1 execute tryon-marketplace-db --remote --file=migrations/0001_multi_store.sql
-- ⚠ ALTER TABLE 은 두 번 실행하면 "duplicate column" 오류가 납니다 — 이미 했다면 다시 돌리지 마세요.
-- ============================================================================

-- 입점사
CREATE TABLE IF NOT EXISTS stores (
  id          TEXT PRIMARY KEY,                    -- UUID (기본 스토어만 'default')
  slug        TEXT NOT NULL UNIQUE,                -- 영문 소문자·숫자·- (주소·R2 폴더 앞머리에 씀)
  name        TEXT NOT NULL,
  status      TEXT NOT NULL DEFAULT 'pending'      -- pending(심사 중) | active(영업) | suspended(정지)
              CHECK (status IN ('pending', 'active', 'suspended')),
  commission_rate REAL NOT NULL DEFAULT 0.1,       -- 플랫폼 수수료(정산 단계에서 씀)
  contact_email TEXT,
  created_at  TEXT NOT NULL,
  updated_at  TEXT NOT NULL
);

-- 관리 계정 — role: platform(플랫폼 운영자, store_id 없음) | owner(입점사 대표) | staff(입점사 직원)
CREATE TABLE IF NOT EXISTS store_users (
  id            TEXT PRIMARY KEY,
  store_id      TEXT REFERENCES stores(id) ON DELETE CASCADE,
  email         TEXT NOT NULL UNIQUE COLLATE NOCASE,
  password_hash TEXT NOT NULL,                     -- pbkdf2-sha256$반복$솔트$해시
  role          TEXT NOT NULL CHECK (role IN ('platform', 'owner', 'staff')),
  disabled      INTEGER NOT NULL DEFAULT 0,
  created_at    TEXT NOT NULL,
  last_login_at TEXT,
  CHECK ((role = 'platform' AND store_id IS NULL) OR (role <> 'platform' AND store_id IS NOT NULL))
);
CREATE INDEX IF NOT EXISTS idx_store_users_store ON store_users(store_id);

-- 기존 상품을 담을 기본 스토어 (지금까지의 단일 스토어)
INSERT OR IGNORE INTO stores (id, slug, name, status, created_at, updated_at)
VALUES ('default', 'gyeol', 'GYEOL', 'active', strftime('%Y-%m-%dT%H:%M:%fZ','now'), strftime('%Y-%m-%dT%H:%M:%fZ','now'));

-- 상품 소속
ALTER TABLE products ADD COLUMN store_id TEXT REFERENCES stores(id);
UPDATE products SET store_id = 'default' WHERE store_id IS NULL;
CREATE INDEX IF NOT EXISTS idx_products_store ON products(store_id);
