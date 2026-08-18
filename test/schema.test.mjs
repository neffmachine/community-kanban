import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createSqliteDb } from '../src/db/sqlite.mjs';
import { missingColumnStatements } from '../src/db/migrate.mjs';

const withTempDb = (fn) => {
  const dir = mkdtempSync(join(tmpdir(), 'ck-test-'));
  try {
    return fn(join(dir, 'test.db'));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
};
const columnsOf = (path, table) => {
  const raw = new DatabaseSync(path);
  const names = raw.prepare(`PRAGMA table_info(${table})`).all().map((c) => c.name);
  raw.close();
  return names;
};

test('a fresh database has every inventory column the API writes', async () => {
  const db = createSqliteDb(':memory:');
  const row = await db.get('SELECT * FROM items WHERE 0');   // shape without rows
  assert.equal(row, undefined);
  await db.run("INSERT INTO items (description) VALUES ('probe')");
  const probe = await db.get('SELECT * FROM items');
  for (const col of ['id', 'sku', 'description', 'supplier', 'minStock', 'reorderQty',
    'minUnit', 'reorderUnit', 'price', 'bin', 'url', 'itemType', 'category', 'photo',
    'physicalReorder', 'status', 'createdAt', 'updatedAt']) {
    assert.ok(col in probe, `items is missing column: ${col}`);
  }
  assert.equal(probe.minUnit, '');
  assert.equal(probe.reorderUnit, '');
  assert.equal(probe.itemType, '');
  assert.equal(probe.minStock, 1);
  assert.equal(probe.status, 'ok');
});

test('a fresh database has the cells, locations and item-type tables', async () => {
  const db = createSqliteDb(':memory:');
  assert.deepEqual(await db.all('SELECT name FROM itemTypes'), []);
  assert.deepEqual(await db.all('SELECT name FROM locations'), []);
  // node:sqlite returns null-prototype rows; spread them so deepEqual compares values.
  const cells = (await db.all('SELECT color, label FROM categories')).map((r) => ({ ...r }));
  assert.deepEqual(cells, [{ color: '#6b7280', label: 'General' }]);
});

test('missingColumnStatements returns only what is absent', () => {
  const all = ['minUnit', 'reorderUnit', 'itemType'];
  // none present → all three
  assert.equal(missingColumnStatements('items', []).length, 3);
  // one present → two
  assert.equal(missingColumnStatements('items', ['minUnit']).length, 2);
  // two present → one, and it is the right one
  const one = missingColumnStatements('items', ['minUnit', 'itemType']);
  assert.deepEqual(one, ["ALTER TABLE items ADD COLUMN reorderUnit TEXT NOT NULL DEFAULT ''"]);
  // all present → none, so re-running is safe
  assert.deepEqual(missingColumnStatements('items', all), []);
  // unknown table → none
  assert.deepEqual(missingColumnStatements('nope', []), []);
});

test('opening an older database adds the new columns and keeps the rows', () => {
  withTempDb((path) => {
    // A database as an earlier version left it: no minUnit/reorderUnit/itemType.
    const old = new DatabaseSync(path);
    old.exec(`CREATE TABLE items (
      id INTEGER PRIMARY KEY, sku TEXT NOT NULL DEFAULT '', description TEXT NOT NULL,
      supplier TEXT NOT NULL DEFAULT '', minStock INTEGER NOT NULL DEFAULT 1,
      reorderQty INTEGER NOT NULL DEFAULT 1, price REAL NOT NULL DEFAULT 0,
      bin TEXT NOT NULL DEFAULT '', url TEXT NOT NULL DEFAULT '',
      category TEXT NOT NULL DEFAULT '#6b7280', photo TEXT,
      physicalReorder INTEGER NOT NULL DEFAULT 0, status TEXT NOT NULL DEFAULT 'ok',
      createdAt TEXT, updatedAt TEXT)`);
    old.prepare("INSERT INTO items (description, sku) VALUES ('Carbide endmill', 'EM-250')").run();
    old.close();
    assert.equal(columnsOf(path, 'items').includes('itemType'), false);

    createSqliteDb(path);

    const after = columnsOf(path, 'items');
    for (const col of ['minUnit', 'reorderUnit', 'itemType']) assert.ok(after.includes(col));
    const raw = new DatabaseSync(path);
    const rows = raw.prepare('SELECT description, sku, itemType FROM items').all().map((r) => ({ ...r }));
    raw.close();
    assert.deepEqual(rows, [{ description: 'Carbide endmill', sku: 'EM-250', itemType: '' }]);
  });
});

test('re-opening a migrated database changes nothing', () => {
  withTempDb((path) => {
    createSqliteDb(path);
    const first = columnsOf(path, 'items');
    createSqliteDb(path);          // would throw "duplicate column name" if not guarded
    createSqliteDb(path);
    assert.deepEqual(columnsOf(path, 'items'), first);
  });
});
