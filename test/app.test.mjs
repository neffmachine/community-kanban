import test from 'node:test';
import assert from 'node:assert/strict';
import { createSqliteDb } from '../src/db/sqlite.mjs';
import { createApp } from '../src/app.mjs';
import { makeSession, verifySession, checkPassword } from '../src/auth.mjs';

const config = {
  hostMode: 'local', shopName: 'Test Shop',
  shopPassword: 'hunter2', sessionSecret: 'test-secret',
};
const makeClient = () => {
  const db = createSqliteDb(':memory:');
  const app = createApp({ db, config });
  return (path, opts = {}) => app.fetch(new Request('http://localhost' + path, {
    headers: { 'Content-Type': 'application/json', ...(opts.headers || {}) }, ...opts,
  }));
};
const cookieFrom = (res) => (res.headers.get('set-cookie') || '').split(';')[0];

test('session cookies are signed and tamper-evident', async () => {
  const good = await makeSession('s');
  assert.equal(await verifySession(good, 's'), true);
  assert.equal(await verifySession(good, 'other-secret'), false);
  assert.equal(await verifySession(good.slice(0, -1) + '0', 's'), false);
  assert.equal(await verifySession('', 's'), false);
});

test('checkPassword is exact and rejects empty expected', () => {
  assert.equal(checkPassword('hunter2', 'hunter2'), true);
  assert.equal(checkPassword('Hunter2', 'hunter2'), false);
  assert.equal(checkPassword('anything', ''), false);
});

test('the API is closed without a session and open after login', async () => {
  const call = makeClient();
  assert.equal((await call('/api/health')).status, 200);          // open
  assert.equal((await call('/api/items')).status, 401);           // protected
  assert.equal((await call('/api/login', { method: 'POST', body: '{"password":"nope"}' })).status, 401);

  const login = await call('/api/login', { method: 'POST', body: '{"password":"hunter2"}' });
  assert.equal(login.status, 200);
  const cookie = cookieFrom(login);
  assert.match(cookie, /^session=/);

  const items = await call('/api/items', { headers: { cookie } });
  assert.equal(items.status, 200);
  assert.deepEqual(await items.json(), []);
});

test('items round-trip and normalize the physical-run flag', async () => {
  const call = makeClient();
  const cookie = cookieFrom(await call('/api/login', { method: 'POST', body: '{"password":"hunter2"}' }));
  const h = { cookie };

  const created = await (await call('/api/items', {
    method: 'POST', headers: h,
    body: JSON.stringify({ description: 'Argon bottle', sku: 'ar-1', physicalReorder: true }),
  })).json();
  assert.equal(created.description, 'Argon bottle');
  assert.equal(created.sku, 'AR-1');               // uppercased
  assert.equal(created.physicalReorder, 1);        // boolean → 1

  const toggled = await (await call('/api/items/' + created.id, {
    method: 'PUT', headers: h, body: JSON.stringify({ physicalReorder: false }),
  })).json();
  assert.equal(toggled.physicalReorder, 0);

  await call('/api/items/' + created.id, { method: 'DELETE', headers: h });
  assert.deepEqual(await (await call('/api/items', { headers: h })).json(), []);
});
