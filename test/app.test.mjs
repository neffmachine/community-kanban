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

  const toggled = (await (await call('/api/items/' + created.id, {
    method: 'PUT', headers: h, body: JSON.stringify({ physicalReorder: false }),
  })).json()).item;
  assert.equal(toggled.physicalReorder, 0);

  await call('/api/items/' + created.id, { method: 'DELETE', headers: h });
  assert.deepEqual(await (await call('/api/items', { headers: h })).json(), []);
});

const signIn = async (call) =>
  ({ cookie: cookieFrom(await call('/api/login', { method: 'POST', body: '{"password":"hunter2"}' })) });

test('items carry the inventory-core fields through create and update', async () => {
  const call = makeClient();
  const h = await signIn(call);

  const created = await (await call('/api/items', {
    method: 'POST', headers: h,
    body: JSON.stringify({
      description: 'Carbide endmill', sku: 'em-250', supplier: 'Lakeshore',
      minStock: 4, reorderQty: 10, minUnit: 'ea', reorderUnit: 'box of 5',
      price: 32.5, bin: 'Tool crib', itemType: 'Endmill', category: '#ff0000',
      url: 'https://example.com/em250',
    }),
  })).json();
  assert.equal(created.minUnit, 'ea');
  assert.equal(created.reorderUnit, 'box of 5');
  assert.equal(created.itemType, 'Endmill');
  assert.equal(created.bin, 'TOOL CRIB');   // bins are uppercased, like SKUs
  assert.equal(created.minStock, 4);
  assert.equal(created.price, 32.5);
  assert.equal(created.status, 'ok');

  // A partial update leaves untouched fields alone.
  const updated = (await (await call('/api/items/' + created.id, {
    method: 'PUT', headers: h, body: JSON.stringify({ reorderUnit: 'box of 10' }),
  })).json()).item;
  assert.equal(updated.reorderUnit, 'box of 10');
  assert.equal(updated.minUnit, 'ea');
  assert.equal(updated.itemType, 'Endmill');
  assert.equal(updated.description, 'Carbide endmill');
});

test('cells round-trip as a colour-keyed map, subtypes included', async () => {
  const call = makeClient();
  const h = await signIn(call);

  const fresh = await (await call('/api/categories', { headers: h })).json();
  assert.deepEqual(fresh, { '#6b7280': { label: 'General', subtypes: {} } });

  const put = { '#ff0000': { label: 'Tooling', subtypes: { '#ff8888': 'Carbide' } }, '#00ff00': { label: 'Gas', subtypes: {} } };
  assert.equal((await call('/api/categories', { method: 'PUT', headers: h, body: JSON.stringify(put) })).status, 200);
  assert.deepEqual(await (await call('/api/categories', { headers: h })).json(), put);

  // PUT replaces the whole map rather than merging into it.
  await call('/api/categories', { method: 'PUT', headers: h, body: JSON.stringify({ '#0000ff': { label: 'Abrasives', subtypes: {} } }) });
  const after = await (await call('/api/categories', { headers: h })).json();
  assert.deepEqual(Object.keys(after), ['#0000ff']);

  // No shape validation: a PUT replaces the map with whatever it can iterate,
  // so an empty payload clears the cells rather than being rejected.
  await call('/api/categories', { method: 'PUT', headers: h, body: '[]' });
  assert.deepEqual(await (await call('/api/categories', { headers: h })).json(), {});
});

test('item types round-trip and default their colour', async () => {
  const call = makeClient();
  const h = await signIn(call);
  assert.deepEqual(await (await call('/api/types', { headers: h })).json(), {});

  await call('/api/types', { method: 'PUT', headers: h, body: JSON.stringify({ Endmill: { color: '#123456' }, Gas: {} }) });
  assert.deepEqual(await (await call('/api/types', { headers: h })).json(), {
    Endmill: { color: '#123456' }, Gas: { color: '#6b7280' },
  });
  // Replaces wholesale rather than merging.
  await call('/api/types', { method: 'PUT', headers: h, body: JSON.stringify({ Drill: {} }) });
  assert.deepEqual(await (await call('/api/types', { headers: h })).json(), { Drill: { color: '#6b7280' } });
});

test('locations round-trip as a list and replace wholesale', async () => {
  const call = makeClient();
  const h = await signIn(call);
  assert.deepEqual(await (await call('/api/locations', { headers: h })).json(), []);

  const saved = await (await call('/api/locations', {
    method: 'PUT', headers: h, body: JSON.stringify(['Tool crib', 'Welding']),
  })).json();
  assert.deepEqual(saved, ['Tool crib', 'Welding']);
  assert.deepEqual(await (await call('/api/locations', { headers: h })).json(), ['Tool crib', 'Welding']);

  // Duplicates collapse on the primary key rather than erroring.
  await call('/api/locations', { method: 'PUT', headers: h, body: JSON.stringify(['Bay 1', 'Bay 1']) });
  assert.deepEqual(await (await call('/api/locations', { headers: h })).json(), ['Bay 1']);

  // A non-array clears the list — worth knowing, since the UI sends the whole set.
  await call('/api/locations', { method: 'PUT', headers: h, body: '{}' });
  assert.deepEqual(await (await call('/api/locations', { headers: h })).json(), []);
});

test('every config route is closed without a session', async () => {
  const call = makeClient();
  for (const path of ['/api/categories', '/api/types', '/api/locations']) {
    assert.equal((await call(path)).status, 401, `GET ${path} should be protected`);
    assert.equal((await call(path, { method: 'PUT', body: '{}' })).status, 401, `PUT ${path} should be protected`);
  }
});
