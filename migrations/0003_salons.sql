-- ============================================================================
-- (2026-11-01) 미용실 지도 — 미용실(위치) · 미용실 헤어스타일(GYEOL 3D 스타일 스펙)
-- ============================================================================
-- 0002 다음에 한 번만 실행. (대시보드 → D1 → tryon-marketplace-db → Console 에 붙여넣기)
--   · 입점사(stores) 하나가 미용실(지점)을 여러 개 가질 수 있음
--   · 지도에는 "입점사 active + 미용실 active" 만 보임
--   · 헤어스타일 spec 은 GYEOL 앱의 STYLE_SPECS 와 같은 JSON (cut·perm·styling·color …)
-- ============================================================================

CREATE TABLE IF NOT EXISTS salons (
  id           TEXT PRIMARY KEY,
  store_id     TEXT NOT NULL REFERENCES stores(id),
  name         TEXT NOT NULL,
  lat          REAL NOT NULL CHECK (lat BETWEEN -90 AND 90),
  lng          REAL NOT NULL CHECK (lng BETWEEN -180 AND 180),
  address      TEXT,
  country      TEXT,                       -- KR | US … (검색·표시용)
  phone        TEXT,
  hours        TEXT,                       -- 자유 문구 ("월~토 10:00-20:00")
  booking_url  TEXT,                       -- https 예약 링크
  description  TEXT,
  cover_url    TEXT,                       -- 대표 사진 (https 또는 /api/assets/…)
  status       TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'hidden')),
  created_at   TEXT NOT NULL,
  updated_at   TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_salons_store ON salons(store_id);
CREATE INDEX IF NOT EXISTS idx_salons_geo   ON salons(lat, lng);

CREATE TABLE IF NOT EXISTS salon_styles (
  id             TEXT PRIMARY KEY,
  salon_id       TEXT NOT NULL REFERENCES salons(id) ON DELETE CASCADE,
  name           TEXT NOT NULL,
  gender         TEXT NOT NULL DEFAULT 'both' CHECK (gender IN ('male', 'female', 'both')),
  price_minor    INTEGER,                  -- 최소 단위 정수 (KRW 원, USD 센트) · 비우면 "문의"
  currency       TEXT,
  duration_min   INTEGER,
  thumbnail_url  TEXT,
  spec           TEXT NOT NULL,            -- JSON (GYEOL 스타일 스펙)
  sort           INTEGER NOT NULL DEFAULT 0,
  status         TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'hidden')),
  created_at     TEXT NOT NULL,
  updated_at     TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_salon_styles_salon ON salon_styles(salon_id, sort);
