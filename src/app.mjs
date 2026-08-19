// The Community Kanban API.
//
// Ported from the production Cloudflare app. Route paths, request bodies and
// response shapes are unchanged, so the pages in public/ work against it as-is.
// The difference is underneath: instead of talking to D1 directly it goes
// through the `db` interface, which is backed by node:sqlite locally and D1 on
// Cloudflare — one set of routes, both hosts.
//
// The other difference is the login. Production sits behind Cloudflare Access
// (company SSO) plus a hostname allowlist; neither travels to another shop, so
// this uses the shop password instead. The public reorder endpoints stay
// outside it, exactly as they sat outside Access, so a scanned card still works
// from any phone.
import { Hono } from 'hono';
import QRCode from 'qrcode';
import { normalizeItemInput, applyUpdate, publicReorderView, buildReverse } from './items.mjs';
import { checkPassword, makeSession, requireAuth } from './auth.mjs';
import { importFromScreenshot, howToAddKey } from './screenshot-import.mjs';

const ITEM_INSERT_COLS = ['sku', 'description', 'supplier', 'minStock', 'reorderQty', 'minUnit',
  'reorderUnit', 'price', 'bin', 'url', 'itemType', 'category', 'photo', 'physicalReorder', 'status', 'createdAt'];
const ITEM_UPDATE_COLS = ['sku', 'description', 'supplier', 'minStock', 'reorderQty', 'minUnit',
  'reorderUnit', 'price', 'bin', 'url', 'itemType', 'category', 'photo', 'physicalReorder', 'status', 'updatedAt'];

const getItem = (db, id) => db.get('SELECT * FROM items WHERE id = ?', [id]);
const loadItemMap = async (db) =>
  new Map((await db.all('SELECT * FROM items')).map((i) => [i.id, i]));

// D1 exposes batch(); the shared interface doesn't, so statements run in order.
// Both hosts are SQLite and each statement is independent here, so the visible
// result is the same.
async function runAll(db, statements) {
  for (const [sql, params] of statements) await db.run(sql, params);
}

// Append an activity-log entry. reverseData (when the action is reversible) is
// stored as JSON so the entry can later be undone via buildReverse. Logging must
// never break the action it describes, so any failure here is swallowed.
async function logActivity(db, { type, description, itemId = null, itemDesc = null, reversible = false, reverseData = null }) {
  try {
    await db.run(
      'INSERT INTO activityLog (id, type, description, itemId, itemDesc, reversible, reverseData, reversed, timestamp) VALUES (?,?,?,?,?,?,?,0,?)',
      [crypto.randomUUID(), type, description, itemId, itemDesc, reversible ? 1 : 0,
        reverseData ? JSON.stringify(reverseData) : null, new Date().toISOString()]);
  } catch (e) {
    console.error('logActivity failed:', e && e.message);
  }
}

export function createApp({ db, config }) {
  const app = new Hono();
  const secure = () => config.hostMode === 'cloudflare';
  const sessionCookie = (value, maxAge) =>
    `session=${value}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${maxAge}` + (secure() ? '; Secure' : '');

  // ── Open routes ───────────────────────────────────────────────────────────
  // Registered before the auth middleware, so they never reach it.

  app.get('/api/health', (c) => c.json({ ok: true, host: config.hostMode, shop: config.shopName }));

  app.post('/api/login', async (c) => {
    const { password } = await c.req.json().catch(() => ({}));
    if (!checkPassword(password, config.shopPassword)) return c.json({ error: 'Wrong password' }, 401);
    c.header('Set-Cookie', sessionCookie(await makeSession(config.sessionSecret), 60 * 60 * 24 * 30));
    return c.json({ ok: true });
  });

  app.post('/api/logout', (c) => {
    c.header('Set-Cookie', sessionCookie('', 0));
    return c.json({ ok: true });
  });

  // Public reorder, reached by scanning a printed card. The only endpoints
  // outside the login, and deliberately narrow: publicReorderView exposes an
  // item's identifying fields only — no price, url, photo, or any way to list,
  // edit or delete. Nothing here reads the queue.
  app.get('/api/reorder/:id', async (c) => {
    const id = parseInt(c.req.param('id'), 10);
    const item = await getItem(db, id);
    if (!item) return c.json({ error: 'Not found' }, 404);
    const queued = await db.get('SELECT itemId FROM cart WHERE itemId = ?', [id]);
    return c.json(publicReorderView(item, queued));
  });

  app.post('/api/reorder/:id', async (c) => {
    const id = parseInt(c.req.param('id'), 10);
    const { addedBy } = await c.req.json().catch(() => ({}));
    const item = await getItem(db, id);
    if (!item) return c.json({ error: 'Not found' }, 404);
    if (await db.get('SELECT itemId FROM cart WHERE itemId = ?', [id])) {
      return c.json({ ok: true, duplicate: true });
    }
    await runAll(db, [
      ['INSERT INTO cart (itemId, addedAt, addedBy) VALUES (?,?,?)', [id, new Date().toISOString(), addedBy || '']],
      ["UPDATE items SET status = 'reorder' WHERE id = ?", [id]],
    ]);
    await logActivity(db, {
      type: 'queue', description: `Queued "${item.description}"`, itemId: id, itemDesc: item.description,
      reversible: true, reverseData: { itemId: id, prevStatus: item.status },
    });
    return c.json({ ok: true });
  });

  // ── Everything below requires the shop password ───────────────────────────
  app.use('/api/*', requireAuth(config));

  app.get('/api/me', (c) => c.json({ signedIn: true, shop: config.shopName }));
  app.get('/api/env', (c) => c.json({ host: config.hostMode, shop: config.shopName }));

  // ── Items ─────────────────────────────────────────────────────────────────
  app.get('/api/items', async (c) => c.json(await db.all('SELECT * FROM items ORDER BY id')));

  app.get('/api/items/:id', async (c) => {
    const item = await getItem(db, parseInt(c.req.param('id'), 10));
    return item ? c.json(item) : c.json({ error: 'Not found' }, 404);
  });

  app.post('/api/items', async (c) => {
    const body = await c.req.json().catch(() => ({}));
    if (!body.description || !String(body.description).trim()) {
      return c.json({ error: 'Description required' }, 400);
    }
    const row = { ...normalizeItemInput(body), status: 'ok', createdAt: new Date().toISOString() };
    const res = await db.run(
      `INSERT INTO items (${ITEM_INSERT_COLS.join(', ')}) VALUES (${ITEM_INSERT_COLS.map(() => '?').join(', ')})`,
      ITEM_INSERT_COLS.map((col) => row[col]));
    const created = await getItem(db, res.lastInsertRowid);
    await logActivity(db, {
      type: 'add', description: `Added "${created.description}"`, itemId: created.id,
      itemDesc: created.description, reversible: true, reverseData: { itemId: created.id },
    });
    return c.json(created, 201);
  });

  app.put('/api/items/:id', async (c) => {
    const id = parseInt(c.req.param('id'), 10);
    const existing = await getItem(db, id);
    if (!existing) return c.json({ error: 'Not found' }, 404);
    const body = await c.req.json().catch(() => ({}));
    const next = applyUpdate(existing, body);
    next.status = body.status || existing.status;
    next.updatedAt = new Date().toISOString();
    // Capture only the fields that actually changed, so undo restores exactly those.
    const prev = {};
    for (const col of ITEM_UPDATE_COLS) {
      if (col !== 'updatedAt' && body[col] !== undefined && existing[col] !== next[col]) prev[col] = existing[col];
    }
    await db.run(`UPDATE items SET ${ITEM_UPDATE_COLS.map((col) => `${col} = ?`).join(', ')} WHERE id = ?`,
      [...ITEM_UPDATE_COLS.map((col) => next[col]), id]);
    const changed = Object.keys(prev).length > 0;
    await logActivity(db, {
      type: 'edit', description: `Edited "${next.description}"`, itemId: id, itemDesc: next.description,
      reversible: changed, reverseData: changed ? { itemId: id, prev } : null,
    });
    return c.json({ item: await getItem(db, id) });
  });

  app.delete('/api/items/:id', async (c) => {
    const id = parseInt(c.req.param('id'), 10);
    const existing = await getItem(db, id);   // saved so the delete can be undone
    // Clear cart/orders explicitly rather than relying on FK cascade being on.
    await runAll(db, [
      ['DELETE FROM cart WHERE itemId = ?', [id]],
      ['DELETE FROM orders WHERE itemId = ?', [id]],
      ['DELETE FROM items WHERE id = ?', [id]],
    ]);
    if (existing) {
      await logActivity(db, {
        type: 'item_delete', description: `Deleted "${existing.description}"`, itemId: id,
        itemDesc: existing.description, reversible: true, reverseData: { item: existing },
      });
    }
    return c.json({ ok: true });
  });

  // QR code for an item's reorder page, as an SVG data URI — pure JS, so it runs
  // in the Workers runtime too (the PNG path needs Node Buffer/zlib). The URL is
  // built from the request origin, so a scanned code points at whichever host
  // serves the app.
  app.get('/api/items/:id/qr', async (c) => {
    const item = await getItem(db, parseInt(c.req.param('id'), 10));
    if (!item) return c.json({ error: 'Not found' }, 404);
    const url = `${new URL(c.req.url).origin}/reorder/${item.id}`;
    const svg = await QRCode.toString(url, { type: 'svg', margin: 1, color: { dark: '#1a1a1a', light: '#ffffff' } });
    return c.json({ qr: 'data:image/svg+xml,' + encodeURIComponent(svg), url });
  });

  // ── Cart (reorder queue) ──────────────────────────────────────────────────
  app.get('/api/cart', async (c) => {
    const rows = await db.all('SELECT * FROM cart ORDER BY addedAt');
    const items = await loadItemMap(db);
    return c.json({ items: rows.filter((r) => items.has(r.itemId)).map((r) => ({ ...r, item: items.get(r.itemId) })) });
  });

  app.post('/api/cart', async (c) => {
    const { itemId, addedBy } = await c.req.json().catch(() => ({}));
    const id = parseInt(itemId, 10);
    const item = await getItem(db, id);
    if (!item) return c.json({ error: 'Item not found' }, 404);
    if (await db.get('SELECT itemId FROM cart WHERE itemId = ?', [id])) return c.json({ ok: true, duplicate: true });
    await runAll(db, [
      ['INSERT INTO cart (itemId, addedAt, addedBy) VALUES (?,?,?)', [id, new Date().toISOString(), addedBy || '']],
      ["UPDATE items SET status = 'reorder' WHERE id = ?", [id]],
    ]);
    await logActivity(db, {
      type: 'queue', description: `Queued "${item.description}"`, itemId: id, itemDesc: item.description,
      reversible: true, reverseData: { itemId: id, prevStatus: item.status },
    });
    return c.json({ ok: true });
  });

  app.delete('/api/cart/:itemId', async (c) => {
    const id = parseInt(c.req.param('itemId'), 10);
    const item = await getItem(db, id);
    await db.run('DELETE FROM cart WHERE itemId = ?', [id]);
    if (item) {
      await logActivity(db, {
        type: 'unqueue', description: `Removed "${item.description}" from the queue`, itemId: id,
        itemDesc: item.description, reversible: true, reverseData: { itemId: id },
      });
    }
    return c.json({ ok: true });
  });

  // Move queued items to on-order.
  app.post('/api/cart/ordered', async (c) => {
    const { itemIds } = await c.req.json().catch(() => ({}));
    if (!Array.isArray(itemIds)) return c.json({ error: 'itemIds must be array' }, 400);
    const now = new Date().toISOString();
    const items = await loadItemMap(db);
    const statements = [];
    for (const raw of itemIds) {
      const id = parseInt(raw, 10);
      const it = items.get(id);
      statements.push(['DELETE FROM cart WHERE itemId = ?', [id]]);
      statements.push(['INSERT OR IGNORE INTO orders (itemId, orderedAt, reorderQty, vendor) VALUES (?,?,?,?)',
        [id, now, it ? (it.reorderQty || it.minStock || 1) : 1, it ? it.supplier : '']]);
      statements.push(["UPDATE items SET status = 'ordered', lastOrdered = ? WHERE id = ?", [now, id]]);
    }
    await runAll(db, statements);
    const n = itemIds.length;
    await logActivity(db, { type: 'ordered', description: `Marked ${n} item${n !== 1 ? 's' : ''} ordered`, reversible: false });
    return c.json({ ok: true, moved: n });
  });

  // ── On order ──────────────────────────────────────────────────────────────
  app.get('/api/orders', async (c) => {
    const rows = await db.all('SELECT * FROM orders ORDER BY orderedAt');
    const items = await loadItemMap(db);
    return c.json({ items: rows.filter((r) => items.has(r.itemId)).map((r) => ({ ...r, item: items.get(r.itemId) })) });
  });

  app.post('/api/orders/received', async (c) => {
    const { itemIds } = await c.req.json().catch(() => ({}));
    if (!Array.isArray(itemIds)) return c.json({ error: 'itemIds must be array' }, 400);
    const now = new Date().toISOString();
    const statements = [];
    for (const raw of itemIds) {
      const id = parseInt(raw, 10);
      statements.push(['DELETE FROM orders WHERE itemId = ?', [id]]);
      statements.push(["UPDATE items SET status = 'ok', lastReceived = ? WHERE id = ?", [now, id]]);
    }
    await runAll(db, statements);
    const n = itemIds.length;
    await logActivity(db, { type: 'received', description: `Received ${n} item${n !== 1 ? 's' : ''}`, reversible: false });
    return c.json({ ok: true, received: n });
  });

  // ── Config: cells / item types / locations ────────────────────────────────
  app.get('/api/categories', async (c) => {
    const out = {};
    for (const r of await db.all('SELECT * FROM categories')) {
      out[r.color] = { label: r.label, subtypes: JSON.parse(r.subtypes || '{}') };
    }
    return c.json(out);
  });

  app.put('/api/categories', async (c) => {
    const body = await c.req.json().catch(() => ({}));
    const statements = [['DELETE FROM categories', []]];
    for (const [color, val] of Object.entries(body)) {
      const label = (typeof val === 'object' && val) ? (val.label || '') : String(val);
      const subtypes = (typeof val === 'object' && val && val.subtypes) ? JSON.stringify(val.subtypes) : '{}';
      statements.push(['INSERT INTO categories (color, label, subtypes) VALUES (?,?,?)', [color, label, subtypes]]);
    }
    await runAll(db, statements);
    return c.json(body);
  });

  app.get('/api/types', async (c) => {
    const out = {};
    for (const r of await db.all('SELECT * FROM itemTypes')) out[r.name] = { color: r.color };
    return c.json(out);
  });

  app.put('/api/types', async (c) => {
    const body = await c.req.json().catch(() => ({}));
    const statements = [['DELETE FROM itemTypes', []]];
    for (const [name, val] of Object.entries(body)) {
      const color = ((typeof val === 'object' && val) ? val.color : val) || '#6b7280';
      statements.push(['INSERT INTO itemTypes (name, color) VALUES (?,?)', [name, color]]);
    }
    await runAll(db, statements);
    return c.json(body);
  });

  app.get('/api/locations', async (c) =>
    c.json((await db.all('SELECT name FROM locations')).map((r) => r.name)));

  app.put('/api/locations', async (c) => {
    const body = await c.req.json().catch(() => ([]));
    const list = Array.isArray(body) ? body : [];
    const statements = [['DELETE FROM locations', []]];
    for (const name of list) statements.push(['INSERT OR IGNORE INTO locations (name) VALUES (?)', [name]]);
    await runAll(db, statements);
    return c.json(list);
  });

  // ── Activity log ──────────────────────────────────────────────────────────
  app.get('/api/log', async (c) => {
    const limit = parseInt(c.req.query('limit'), 10) || 200;
    const rows = await db.all('SELECT * FROM activityLog ORDER BY timestamp DESC LIMIT ?', [limit]);
    return c.json(rows.map((r) => ({
      ...r, reversible: !!r.reversible, reversed: !!r.reversed,
      reverseData: r.reverseData ? JSON.parse(r.reverseData) : null,
    })));
  });

  // Undo a reversible action. buildReverse (pure, tested) decides the inverse
  // statements from the stored reverseData; we run them and mark the entry reversed.
  app.post('/api/log/reverse/:id', async (c) => {
    const row = await db.get('SELECT * FROM activityLog WHERE id = ?', [c.req.param('id')]);
    if (!row) return c.json({ error: 'Not found' }, 404);
    const entry = {
      ...row, reversible: !!row.reversible, reversed: !!row.reversed,
      reverseData: row.reverseData ? JSON.parse(row.reverseData) : null,
    };
    const ops = buildReverse(entry);
    if (!ops.length) return c.json({ error: "This entry can't be undone" }, 400);
    await runAll(db, ops.map((o) => [o.sql, o.params]));
    await db.run('UPDATE activityLog SET reversed = 1 WHERE id = ?', [entry.id]);
    return c.json({ ok: true });
  });

  // ── Screenshot import ─────────────────────────────────────────────────────
  // Off unless this shop has set its own ANTHROPIC_API_KEY. The key is never
  // stored by the app — only read from the environment — so it can't end up in
  // a backup or a database dump.
  app.post('/api/screenshot-import', async (c) => {
    const { image, mediaType } = await c.req.json().catch(() => ({}));
    const { status, body } = await importFromScreenshot({ image, mediaType, config });
    return c.json(body, status);
  });

  // Whether a key is configured — never the key itself. The Settings page uses
  // this to show either "connected" or instructions for connecting one.
  app.get('/api/settings/anthropic-key', (c) => c.json({
    hasKey: !!config.anthropicKey,
    howTo: config.anthropicKey ? null : howToAddKey(config.hostMode),
  }));

  // ── Settings ──────────────────────────────────────────────────────────────
  app.get('/api/settings', async (c) => {
    const out = { shopName: config.shopName };
    for (const r of await db.all('SELECT key, value FROM settings')) out[r.key] = r.value;
    return c.json(out);
  });

  return app;
}
