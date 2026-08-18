// Local SQLite adapter, backed by Node's built-in `node:sqlite` (no native
// dependency to compile). Exposes the same async interface as the D1 adapter so
// the app code doesn't know or care which one it's running on.
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdirSync } from 'node:fs';
import { ADDED_COLUMNS, missingColumnStatements } from './migrate.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));

export function createSqliteDb(dbPath) {
  mkdirSync(dirname(dbPath), { recursive: true });
  const raw = new DatabaseSync(dbPath);
  // Add any columns an older database is missing, BEFORE applying the schema:
  // schema.sql builds indexes over columns like syncGroup, and indexing a column
  // that isn't there yet fails the whole boot. A table with no rows in
  // table_info doesn't exist yet, so there is nothing to migrate — schema.sql
  // below will create it complete.
  for (const table of Object.keys(ADDED_COLUMNS)) {
    const present = raw.prepare(`PRAGMA table_info(${table})`).all().map((c) => c.name);
    if (!present.length) continue;
    for (const sql of missingColumnStatements(table, present)) raw.exec(sql);
  }
  // Apply the schema; every statement is IF NOT EXISTS, so it's a no-op once created.
  raw.exec(readFileSync(join(HERE, 'schema.sql'), 'utf8'));

  return {
    async all(sql, params = []) {
      return raw.prepare(sql).all(...params);
    },
    async get(sql, params = []) {
      return raw.prepare(sql).get(...params);
    },
    async run(sql, params = []) {
      const info = raw.prepare(sql).run(...params);
      return { changes: info.changes, lastInsertRowid: Number(info.lastInsertRowid) };
    },
    async exec(sql) {
      raw.exec(sql);
    },
  };
}
