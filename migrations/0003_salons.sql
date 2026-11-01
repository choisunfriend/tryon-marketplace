CREATE TABLE IF NOT EXISTS salons (
  id           TEXT PRIMARY KEY,
  store_id     TEXT NOT NULL REFERENCES stores(id),
  name         TEXT NOT NULL,
  lat          REAL NOT NULL CHECK (lat BETWEEN -90 AND 90),
  lng          REAL NOT NULL CHECK (lng BETWEEN -180 AND 180),
  address      TEXT,
  country      TEXT,
  phone        TEXT,
  hours        TEXT,
  booking_url  TEXT,
  description  TEXT,
  cover_url    TEXT,
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
  price_minor    INTEGER,
  currency       TEXT,
  duration_min   INTEGER,
  thumbnail_url  TEXT,
  spec           TEXT NOT NULL,
  sort           INTEGER NOT NULL DEFAULT 0,
  status         TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'hidden')),
  created_at     TEXT NOT NULL,
  updated_at     TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_salon_styles_salon ON salon_styles(salon_id, sort);
