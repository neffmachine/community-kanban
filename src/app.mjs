// The Community Kanban API. Framework code only — it receives a `db` (SQLite or D1)
// and a `config`, so the exact same routes run locally and on Cloudflare.
import { Hono } from 'hono';
import { checkPassword, makeSession, requireAuth } from './auth.mjs';

// Fields a create/update may set, normalized to the stored shape.
function normalizeItem(body = {}) {
  const s = (v) => (v == null ? '' : String(v)).trim();
  const b01 = (v) => (v === true || v === 1 || v === '1' || v === 'true') ? 1 : 0;
  return {
    sku: s(body.sku).toUpperCase(),
    description: s(body.description),
    supplier: s(body.supplier),
    minStock: parseInt(body.minStock, 10) || 1,
    reorderQty: parseInt(body.reorderQty, 10) || 1,
    price: parseFloat(body.price) || 0,
    bin: s(body.bin),
    url: s(body.url),
    category: body.category || '#6b7280',
    photo: body.photo || null,
    physicalReorder: b01(body.physicalReorder),
  };
}

const ITEM_COLS = ['sku', 'description', 'supplier', 'minStock', 'reorderQty', 'price',
  'bin', 'url', 'category', 'photo', 'physicalReorder'];

export function createApp({ db, config }) {
  const app = new Hono();
  const secure = () => config.hostMode === 'cloudflare';
  const sessionCookie = (value, maxAge) =>
    `session=${value}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${maxAge}` + (secure() ? '; Secure' : '');

  app.get('/api/health', (c) => c.json({ ok: true, host: config.hostMode, shop: config.shopName }));

  app.post('/api/login', async (c) => {
    const { password } = await c.req.json().catch(() => ({}));
    if (!checkPassword(password, config.shopPassword)) {
      return c.json({ error: 'Wrong password' }, 401);
    }
    c.header('Set-Cookie', sessionCookie(await makeSession(config.sessionSecret), 60 * 60 * 24 * 30));
    return c.json({ ok: true });
  });

  app.post('/api/logout', (c) => {
    c.header('Set-Cookie', sessionCookie('', 0));
    return c.json({ ok: true });
  });

  // Everything below requires a valid session.
  app.use('/api/*', requireAuth(config));

  app.get('/api/me', (c) => c.json({ signedIn: true, shop: config.shopName }));

  app.get('/api/items', async (c) => c.json(await db.all('SELECT * FROM items ORDER BY description')));

  app.post('/api/items', async (c) => {
    const body = await c.req.json().catch(() => ({}));
    if (!String(body.description || '').trim()) return c.json({ error: 'Description required' }, 400);
    const f = normalizeItem(body);
    const cols = [...ITEM_COLS, 'status', 'createdAt'];
    const vals = [...ITEM_COLS.map((k) => f[k]), 'ok', new Date().toISOString()];
    const res = await db.run(
      `INSERT INTO items (${cols.join(',')}) VALUES (${cols.map(() => '?').join(',')})`, vals);
    return c.json(await db.get('SELECT * FROM items WHERE id = ?', [res.lastInsertRowid]), 201);
  });

  app.put('/api/items/:id', async (c) => {
    const id = parseInt(c.req.param('id'), 10);
    const existing = await db.get('SELECT * FROM items WHERE id = ?', [id]);
    if (!existing) return c.json({ error: 'Not found' }, 404);
    const body = await c.req.json().catch(() => ({}));
    const f = normalizeItem({ ...existing, ...body });
    const set = [...ITEM_COLS, 'updatedAt'];
    await db.run(`UPDATE items SET ${set.map((k) => `${k} = ?`).join(',')} WHERE id = ?`,
      [...ITEM_COLS.map((k) => f[k]), new Date().toISOString(), id]);
    return c.json(await db.get('SELECT * FROM items WHERE id = ?', [id]));
  });

  app.delete('/api/items/:id', async (c) => {
    await db.run('DELETE FROM items WHERE id = ?', [parseInt(c.req.param('id'), 10)]);
    return c.json({ ok: true });
  });

  app.get('/api/categories', async (c) => c.json(await db.all('SELECT * FROM categories ORDER BY label')));

  app.get('/api/settings', async (c) => {
    const rows = await db.all('SELECT key, value FROM settings');
    const out = { shopName: config.shopName };
    for (const r of rows) out[r.key] = r.value;
    return c.json(out);
  });

  return app;
}
