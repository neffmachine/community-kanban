import test from 'node:test';
import assert from 'node:assert/strict';
import {
  extractJson, pickFields, howToAddKey, importFromScreenshot, MAX_IMAGE_BYTES,
} from '../src/screenshot-import.mjs';

const withKey = { anthropicKey: 'sk-ant-test', hostMode: 'local' };
const noKey = { anthropicKey: '', hostMode: 'local' };
const reply = (obj) => ({
  ok: true, status: 200,
  json: async () => ({ content: [{ type: 'text', text: JSON.stringify(obj) }] }),
});

test('the model reply survives prose or fences around the JSON', () => {
  assert.deepEqual(extractJson('{"sku":"A1"}'), { sku: 'A1' });
  assert.deepEqual(extractJson('Here you go:\n```json\n{"sku":"A1"}\n```'), { sku: 'A1' });
  assert.equal(extractJson('no json here'), null);
  assert.equal(extractJson('{ broken'), null);
  assert.equal(extractJson(''), null);
  assert.equal(extractJson(undefined), null);
});

test('only known fields reach the form', () => {
  const picked = pickFields({
    description: ' 1/4 end mill ', sku: 'EM-250', supplier: 'Lakeshore',
    url: 'https://example.com/x', price: '28.50',
    status: 'ordered', id: 99, physicalReorder: 1,     // must not come through
  });
  assert.deepEqual(picked, {
    description: '1/4 end mill', sku: 'EM-250', supplier: 'Lakeshore',
    url: 'https://example.com/x', price: 28.5,
  });
});

test('missing and unusable values are dropped rather than guessed', () => {
  assert.deepEqual(pickFields({ description: 'Widget', sku: null, price: null }), { description: 'Widget' });
  assert.deepEqual(pickFields({ description: '   ', price: 'free' }), {});
  assert.deepEqual(pickFields({ price: -5 }), {});          // negative price is not a price
  assert.deepEqual(pickFields({ price: 0 }), { price: 0 }); // but zero is legitimate
  assert.equal(pickFields(null), null);
  assert.equal(pickFields('nope'), null);
});

test('the no-key message tells you how to add one, per host', async () => {
  const local = await importFromScreenshot({ image: 'x', config: noKey });
  assert.equal(local.status, 400);
  assert.match(local.body.error, /No Anthropic API key/);
  assert.match(local.body.detail, /\.env/);
  assert.match(local.body.detail, /console\.anthropic\.com/);
  assert.match(local.body.detail, /billed to you/);

  const cloud = howToAddKey('cloudflare');
  assert.match(cloud, /wrangler pages secret/);
  assert.match(cloud, /your Cloudflare account/);
  assert.doesNotMatch(cloud, /\.env file/);
});

test('a missing or oversized image fails before any API call is made', async () => {
  let called = false;
  const spy = async () => { called = true; };

  const none = await importFromScreenshot({ image: '', config: withKey, fetchImpl: spy });
  assert.equal(none.status, 400);

  const huge = await importFromScreenshot({
    image: 'a'.repeat(MAX_IMAGE_BYTES + 1), config: withKey, fetchImpl: spy,
  });
  assert.equal(huge.status, 413);
  assert.match(huge.body.detail, /5MB/);

  assert.equal(called, false, 'should not spend an API call on input we know is bad');
});

test('a screenshot becomes item fields', async () => {
  const res = await importFromScreenshot({
    image: 'base64data', mediaType: 'image/jpeg', config: withKey,
    fetchImpl: async () => reply({
      description: 'Carbide End Mill 1/4"', sku: 'EM-250',
      supplier: 'Lakeshore Carbide', price: 28.5, url: null,
    }),
  });
  assert.equal(res.status, 200);
  assert.deepEqual(res.body, {
    description: 'Carbide End Mill 1/4"', sku: 'EM-250',
    supplier: 'Lakeshore Carbide', price: 28.5,
  });
});

test('the image and media type are actually sent to Anthropic', async () => {
  let sent;
  await importFromScreenshot({
    image: 'IMGDATA', mediaType: 'image/webp', config: withKey,
    fetchImpl: async (url, opts) => { sent = { url, opts }; return reply({ description: 'x' }); },
  });
  assert.equal(sent.url, 'https://api.anthropic.com/v1/messages');
  assert.equal(sent.opts.headers['x-api-key'], 'sk-ant-test');
  assert.equal(sent.opts.headers['anthropic-version'], '2023-06-01');
  const body = JSON.parse(sent.opts.body);
  assert.equal(body.messages[0].content[0].source.data, 'IMGDATA');
  assert.equal(body.messages[0].content[0].source.media_type, 'image/webp');
});

test('a rejected key says so instead of leaking a raw status', async () => {
  const res = await importFromScreenshot({
    image: 'x', config: withKey,
    fetchImpl: async () => ({ ok: false, status: 401 }),
  });
  assert.equal(res.status, 502);
  assert.match(res.body.detail, /key was rejected/);
  assert.match(res.body.detail, /console\.anthropic\.com/);
});

test('running out of credit is named, not hidden behind 429', async () => {
  const res = await importFromScreenshot({
    image: 'x', config: withKey,
    fetchImpl: async () => ({ ok: false, status: 429 }),
  });
  assert.match(res.body.detail, /rate-limited or out of credit/);
});

test('no internet is reported as no internet', async () => {
  const res = await importFromScreenshot({
    image: 'x', config: withKey,
    fetchImpl: async () => { throw new Error('getaddrinfo ENOTFOUND'); },
  });
  assert.equal(res.status, 502);
  assert.match(res.body.error, /Could not reach the Anthropic API/);
});

test('an unreadable screenshot suggests a better crop', async () => {
  const res = await importFromScreenshot({
    image: 'x', config: withKey,
    fetchImpl: async () => ({ ok: true, status: 200, json: async () => ({ content: [{ text: 'I cannot tell' }] }) }),
  });
  assert.equal(res.status, 422);
  assert.match(res.body.detail, /tighter crop/);
});

test('the configured model is used when one is set', async () => {
  let model;
  const capture = async (url, opts) => { model = JSON.parse(opts.body).model; return reply({ description: 'x' }); };
  await importFromScreenshot({ image: 'x', config: withKey, fetchImpl: capture });
  assert.match(model, /^claude-/);
  await importFromScreenshot({
    image: 'x', config: { ...withKey, anthropicModel: 'claude-opus-5' }, fetchImpl: capture,
  });
  assert.equal(model, 'claude-opus-5');
});
