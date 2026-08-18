-- Shop Kanban schema. Runs identically on local SQLite (node:sqlite) and
-- Cloudflare D1 — both are SQLite. Column names are camelCase so API responses
-- match the field names the frontend uses.

CREATE TABLE IF NOT EXISTS items (
  id          INTEGER PRIMARY KEY,
  sku         TEXT    NOT NULL DEFAULT '',
  description TEXT    NOT NULL,
  supplier    TEXT    NOT NULL DEFAULT '',
  minStock    INTEGER NOT NULL DEFAULT 1,
  reorderQty  INTEGER NOT NULL DEFAULT 1,
  price       REAL    NOT NULL DEFAULT 0,
  bin         TEXT    NOT NULL DEFAULT '',
  url         TEXT    NOT NULL DEFAULT '',
  category    TEXT    NOT NULL DEFAULT '#6b7280',
  photo       TEXT,
  physicalReorder INTEGER NOT NULL DEFAULT 0,  -- 1 = restocked by a physical run (local pickup)
  status      TEXT    NOT NULL DEFAULT 'ok',
  createdAt   TEXT,
  updatedAt   TEXT
);
CREATE INDEX IF NOT EXISTS idx_items_status ON items(status);

-- Cells/categories, keyed by color. subtypes is a JSON object of sub-locations.
CREATE TABLE IF NOT EXISTS categories (
  color    TEXT PRIMARY KEY,
  label    TEXT NOT NULL DEFAULT '',
  subtypes TEXT NOT NULL DEFAULT '{}'
);

-- Named physical locations.
CREATE TABLE IF NOT EXISTS locations (
  name TEXT PRIMARY KEY
);

-- Non-secret app settings (shop name, logo, etc.). Never store passwords/keys here.
CREATE TABLE IF NOT EXISTS settings (
  key   TEXT PRIMARY KEY,
  value TEXT
);

-- A sensible starting cell so a fresh shop isn't staring at an empty dropdown.
INSERT OR IGNORE INTO categories (color, label, subtypes) VALUES ('#6b7280', 'General', '{}');
