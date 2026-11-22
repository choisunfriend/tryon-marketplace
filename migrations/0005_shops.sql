-- ============================================================================
-- (2026-11-22) 옷가게 지점(shops) — 미용실(salons)과 같은 구조
-- ============================================================================
-- 입점사(stores) 하나가 오프라인 매장(지점)을 여러 곳 가질 수 있습니다.
-- 매장의 "메뉴판"은 따로 저장하지 않고, 그 입점사의 상품(products.store_id)을 그대로 보여 줍니다.
-- 실행 (한 번만):
--   npx wrangler d1 execute tryon-marketplace-db --remote --file=migrations/0005_shops.sql
-- ============================================================================

CREATE TABLE IF NOT EXISTS shops (
  id           TEXT PRIMARY KEY,
  store_id     TEXT NOT NULL REFERENCES stores(id),
  name         TEXT NOT NULL,
  lat          REAL NOT NULL CHECK (lat BETWEEN -90 AND 90),
  lng          REAL NOT NULL CHECK (lng BETWEEN -180 AND 180),
  address      TEXT,
  country      TEXT,
  phone        TEXT,
  hours        TEXT,
  link_url     TEXT,
  description  TEXT,
  cover_url    TEXT,
  status       TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'hidden')),
  created_at   TEXT NOT NULL,
  updated_at   TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_shops_store ON shops(store_id);

CREATE INDEX IF NOT EXISTS idx_shops_geo   ON shops(lat, lng);
