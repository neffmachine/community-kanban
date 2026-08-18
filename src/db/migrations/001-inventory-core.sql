-- Milestone 1 (inventory core), for databases created before it.
--
-- Only needed on Cloudflare, and only if you deployed an earlier version: the
-- local host applies these automatically on boot. A fresh D1 database gets
-- these columns from schema.sql and should skip this file.
--
--   wrangler d1 execute <your-db> --remote --file=src/db/migrations/001-inventory-core.sql
--
-- Running it twice errors with "duplicate column name" — that means it has
-- already been applied, and nothing is wrong.
ALTER TABLE items ADD COLUMN minUnit     TEXT NOT NULL DEFAULT '';
ALTER TABLE items ADD COLUMN reorderUnit TEXT NOT NULL DEFAULT '';
ALTER TABLE items ADD COLUMN itemType    TEXT NOT NULL DEFAULT '';
