import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { normalizeItemInput, applyUpdate, publicReorderView, buildReverse } from '../src/items.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

test('entries that cannot be undone produce no statements', () => {
  assert.deepEqual(buildReverse(null), []);
  assert.deepEqual(buildReverse({ type: 'item_add', reversible: false, reverseData: { itemId: 1 } }), []);
  assert.deepEqual(buildReverse({ type: 'item_add', reversible: true, reversed: true, reverseData: { itemId: 1 } }), []);
  assert.deepEqual(buildReverse({ type: 'mystery', reversible: true, reverseData: {} }), []);
});

test('undoing an add deletes the item and its queue and order rows', () => {
  const ops = buildReverse({ type: 'item_add', reversible: true, reverseData: { itemId: 42 } });
  assert.equal(ops.length, 3);
  assert.match(ops[2].sql, /DELETE FROM items WHERE id = \?/);
  assert.deepEqual(ops[2].params, [42]);
});

test('undoing a delete restores the row with its original id', () => {
  // The id has to survive: it is what printed QR codes point at.
  const item = { id: 7, description: 'Argon', sku: 'AR1', status: 'ok' };
  const ops = buildReverse({ type: 'item_delete', reversible: true, reverseData: { item } });
  assert.equal(ops.length, 1);
  assert.match(ops[0].sql, /^INSERT INTO items \(id, description, sku, status\) VALUES \(\?, \?, \?, \?\)$/);
  assert.deepEqual(ops[0].params, [7, 'Argon', 'AR1', 'ok']);
});

test('undoing an edit restores exactly the fields that changed', () => {
  const ops = buildReverse({ type: 'item_edit', reversible: true, reverseData: { itemId: 5, prev: { price: 10, bin: 'A-1' } } });
  assert.equal(ops.length, 1);
  assert.match(ops[0].sql, /UPDATE items SET price = \?, bin = \? WHERE id = \?/);
  assert.deepEqual(ops[0].params, [10, 'A-1', 5]);
});

test('undoing a queue removes the cart row and restores the prior status', () => {
  const ops = buildReverse({ type: 'queue', reversible: true, reverseData: { itemId: 3, prevStatus: 'ok' } });
  assert.deepEqual(ops.map((o) => o.params), [[3], ['ok', 3]]);
  assert.match(ops[0].sql, /DELETE FROM cart WHERE itemId = \?/);
});

test('undoing an unqueue puts the item back in the cart', () => {
  const ops = buildReverse({ type: 'unqueue', reversible: true, reverseData: { itemId: 9 } });
  assert.equal(ops.length, 2);
  assert.match(ops[0].sql, /INSERT OR IGNORE INTO cart/);
  assert.match(ops[1].sql, /status = 'reorder'/);
});

// The bug this guards: the API logged 'add' and 'edit' while buildReverse
// handled 'item_add' and 'item_edit'. Entries were still marked reversible, so
// the log offered an Undo button that always answered "can't be undone".
test('every reversible type the API logs is one buildReverse can actually undo', () => {
  const source = readFileSync(join(root, 'src/app.mjs'), 'utf8');
  const logged = new Set();
  for (const call of source.matchAll(/logActivity\(db,\s*\{([\s\S]*?)\}\)/g)) {
    const block = call[1];
    if (!/reversible:\s*(true|changed)/.test(block)) continue;   // one-way entries are fine
    const type = block.match(/type:\s*'([a-z_]+)'/);
    if (type) logged.add(type[1]);
  }
  assert.ok(logged.size >= 4, `expected several reversible types, found ${[...logged]}`);

  for (const type of logged) {
    const ops = buildReverse({
      type, reversible: true,
      reverseData: { itemId: 1, prevStatus: 'ok', prev: { price: 1 }, item: { id: 1, description: 'x' } },
    });
    assert.ok(ops.length > 0, `the API logs reversible type '${type}' but buildReverse cannot undo it`);
  }
});

test('part numbers and bins are uppercased, text trimmed, defaults applied', () => {
  const out = normalizeItemInput({ sku: ' cs-126 ', description: '  Carvesmart Jaws ', bin: 'lista' });
  assert.equal(out.sku, 'CS-126');
  assert.equal(out.bin, 'LISTA');
  assert.equal(out.description, 'Carvesmart Jaws');
  assert.equal(out.minStock, 1);
  assert.equal(out.reorderQty, 1);
  assert.equal(out.price, 0);
  assert.equal(out.category, '#6b7280');
  assert.equal(out.photo, null);
});

test('numbers arrive as numbers, and a supplied cell or photo is kept', () => {
  const out = normalizeItemInput({
    description: 'x', minStock: '3', reorderQty: '6', price: '89.5',
    category: '#1a4fa8', photo: 'https://img/x.png',
  });
  assert.equal(out.minStock, 3);
  assert.equal(out.reorderQty, 6);
  assert.equal(out.price, 89.5);
  assert.equal(out.category, '#1a4fa8');
  assert.equal(out.photo, 'https://img/x.png');
});

test('a bare product URL gets a scheme so the link works when clicked', () => {
  assert.equal(normalizeItemInput({ url: 'mcmaster.com/97036A040' }).url, 'https://mcmaster.com/97036A040');
  assert.equal(normalizeItemInput({ url: 'https://a.com/x' }).url, 'https://a.com/x');
  assert.equal(normalizeItemInput({ url: 'http://a.com/x' }).url, 'http://a.com/x');
  assert.equal(normalizeItemInput({ url: '' }).url, '');
});

test('the pickup flag stores as 0 or 1 whatever shape it arrives in', () => {
  for (const truthy of [true, 1, '1', 'true']) {
    assert.equal(normalizeItemInput({ physicalReorder: truthy }).physicalReorder, 1, `${truthy} should be 1`);
  }
  for (const falsy of [false, 0, '0', 'false', undefined, null]) {
    assert.equal(normalizeItemInput({ physicalReorder: falsy }).physicalReorder, 0, `${falsy} should be 0`);
  }
});

test('an update changes only what it was given', () => {
  const existing = {
    sku: 'A1', description: 'Old', supplier: 'V', minStock: 4, reorderQty: 8,
    price: 10, bin: 'B-2', url: '', itemType: 'End mill', category: '#111', photo: null, physicalReorder: 1,
  };
  const next = applyUpdate(existing, { description: 'New' });
  assert.equal(next.description, 'New');
  assert.equal(next.sku, 'A1');
  assert.equal(next.minStock, 4);
  assert.equal(next.bin, 'B-2');
  assert.equal(next.physicalReorder, 1);      // preserved when the body is silent
  assert.equal(applyUpdate(existing, { physicalReorder: false }).physicalReorder, 0);
});

test('an empty update body does not wipe the item', () => {
  const existing = { sku: 'A1', description: 'Keep me', supplier: 'V', minStock: 4, reorderQty: 8, price: 10, bin: 'B-2' };
  const next = applyUpdate(existing, {});
  assert.equal(next.description, 'Keep me');
  assert.equal(next.minStock, 4);
  assert.equal(next.price, 10);
});

test('the public reorder page exposes only what a scanned card needs', () => {
  // This is what an unauthenticated phone can read, so the whitelist matters.
  // What it needs: enough to recognise the part and know how many to order.
  // What it must not carry: price, the vendor's product URL, the photo, or any
  // internal linkage.
  const view = publicReorderView({
    id: 5, description: 'Argon', sku: 'AR1', supplier: 'Airgas', bin: 'W-1',
    price: 199.99, url: 'https://vendor/secret', photo: 'data:image/png;base64,xx',
    minStock: 2, reorderQty: 4, status: 'ok', syncGroup: 'g1',
  }, null);
  for (const leaked of ['price', 'url', 'photo', 'syncGroup', 'status']) {
    assert.equal(view[leaked], undefined, `${leaked} must not reach the public page`);
  }
  // And nothing beyond the known-safe set, so a new column can't leak silently.
  assert.deepEqual(Object.keys(view).sort(),
    ['alreadyQueued', 'bin', 'description', 'id', 'minStock', 'reorderQty', 'sku', 'supplier']);
  assert.equal(view.description, 'Argon');
  assert.equal(view.id, 5);
});

test('the reorder page reports queued state as a real boolean', () => {
  assert.equal(publicReorderView({ id: 1, description: 'x' }, { itemId: 1 }).alreadyQueued, true);
  assert.equal(publicReorderView({ id: 1, description: 'x' }, null).alreadyQueued, false);
  assert.equal(publicReorderView({ id: 1, description: 'x' }, undefined).alreadyQueued, false);
});
