-- Community Kanban schema. Runs identically on local SQLite (node:sqlite) and
-- Cloudflare D1 — both are SQLite.
-- Column names intentionally match the current JSON field names (camelCase) so the
-- API responses stay identical to today and the frontend needs no data-shape changes.
--
-- items.id is what a printed QR code points at (/reorder/<id>), so ids are stable
-- for the life of a card — never renumber them.

CREATE TABLE IF NOT EXISTS items (
  id          INTEGER PRIMARY KEY,
  sku         TEXT    NOT NULL DEFAULT '',
  description TEXT    NOT NULL,
  supplier    TEXT    NOT NULL DEFAULT '',
  minStock    INTEGER NOT NULL DEFAULT 1,
  reorderQty  INTEGER NOT NULL DEFAULT 1,
  minUnit     TEXT    NOT NULL DEFAULT '',
  reorderUnit TEXT    NOT NULL DEFAULT '',
  price       REAL    NOT NULL DEFAULT 0,
  bin         TEXT    NOT NULL DEFAULT '',
  url         TEXT    NOT NULL DEFAULT '',
  itemType    TEXT    NOT NULL DEFAULT '',
  category    TEXT    NOT NULL DEFAULT '#6b7280',
  photo       TEXT,                  -- external URL or data: URI (R2 URL later if we migrate blobs)
  physicalReorder INTEGER NOT NULL DEFAULT 0,  -- 1 = restocked by a physical run (local pickup), not an online order
  syncGroup   TEXT,                  -- groups items that share description/sku/etc.
  status      TEXT    NOT NULL DEFAULT 'ok',   -- 'ok' | 'reorder' | 'ordered'
  createdAt   TEXT,
  updatedAt   TEXT,
  lastOrdered TEXT,
  lastReceived TEXT
);
CREATE INDEX IF NOT EXISTS idx_items_status    ON items(status);
CREATE INDEX IF NOT EXISTS idx_items_syncGroup ON items(syncGroup);

-- Reorder queue ("cart"). One row per queued item.
CREATE TABLE IF NOT EXISTS cart (
  itemId  INTEGER PRIMARY KEY REFERENCES items(id) ON DELETE CASCADE,
  addedAt TEXT,
  addedBy TEXT NOT NULL DEFAULT ''
);

-- Items marked ordered, awaiting receipt.
CREATE TABLE IF NOT EXISTS orders (
  itemId     INTEGER PRIMARY KEY REFERENCES items(id) ON DELETE CASCADE,
  orderedAt  TEXT,
  reorderQty INTEGER NOT NULL DEFAULT 1,
  vendor     TEXT NOT NULL DEFAULT ''
);

-- Cells/categories, keyed by color . subtypes stored as JSON.
CREATE TABLE IF NOT EXISTS categories (
  color    TEXT PRIMARY KEY,
  label    TEXT NOT NULL DEFAULT '',
  subtypes TEXT NOT NULL DEFAULT '{}'   -- JSON object: { "<color>": "<label>", ... }
);

-- Tool/item types , keyed by type name.
CREATE TABLE IF NOT EXISTS itemTypes (
  name  TEXT PRIMARY KEY,
  color TEXT NOT NULL DEFAULT '#6b7280'
);

-- Physical location strings .
CREATE TABLE IF NOT EXISTS locations (
  name TEXT PRIMARY KEY
);

-- Activity log . Kept to the most recent entries by the app.
CREATE TABLE IF NOT EXISTS activityLog (
  id          TEXT PRIMARY KEY,
  type        TEXT,
  description TEXT,
  itemId      INTEGER,
  itemDesc    TEXT,
  reversible  INTEGER NOT NULL DEFAULT 0,   -- 0/1
  reverseData TEXT,                          -- JSON
  reversed    INTEGER NOT NULL DEFAULT 0,   -- 0/1
  timestamp   TEXT
);
CREATE INDEX IF NOT EXISTS idx_log_timestamp ON activityLog(timestamp DESC);

-- Non-secret app settings .
-- The Anthropic API key is NOT stored here — it comes from the environment.
CREATE TABLE IF NOT EXISTS settings (
  key   TEXT PRIMARY KEY,
  value TEXT
);

-- A starting cell so a fresh shop isn't staring at an empty dropdown.
INSERT OR IGNORE INTO categories (color, label, subtypes) VALUES ('#6b7280', 'General', '{}');
