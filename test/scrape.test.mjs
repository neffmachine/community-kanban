import test from 'node:test';
import assert from 'node:assert/strict';
import {
  isPrivateHost, assertFetchAllowed, assertScrapeHostAllowed, fetchPage,
  scrapeMcMaster, scrapeAmazon, scrapeOgImage, scrapeProductUrl, MAX_REDIRECTS,
} from '../src/scrape.mjs';

const html = (body) => ({ status: 200, headers: new Headers(), body: null, text: async () => body });
const redirectTo = (location) => ({ status: 302, headers: new Headers({ location }), body: null, text: async () => '' });

test('loopback, private ranges and link-local are all private', () => {
  for (const h of [
    'localhost', 'shop-pc.local', 'db.internal', '127.0.0.1', '127.1.1.1',
    '10.0.0.5', '192.168.1.1', '172.16.0.1', '172.31.255.255',
    '0.0.0.0', '::1', 'fd00::1', 'fe80::1',
  ]) {
    assert.equal(isPrivateHost(h), true, `${h} should be treated as private`);
  }
});

test('the cloud metadata address is private', () => {
  // 169.254.169.254 hands out cloud credentials to anything that can reach it.
  assert.equal(isPrivateHost('169.254.169.254'), true);
  assert.equal(isPrivateHost('169.254.0.1'), true);
});

test('ordinary public hosts are not private', () => {
  for (const h of ['mcmaster.com', 'www.amazon.com', '8.8.8.8', '172.15.0.1', '172.32.0.1', '11.0.0.1']) {
    assert.equal(isPrivateHost(h), false, `${h} should be reachable`);
  }
});

test('only http and https are fetchable', () => {
  assert.throws(() => assertFetchAllowed('file:///etc/passwd'), /http\/https/);
  assert.throws(() => assertFetchAllowed('gopher://example.com'), /http\/https/);
  assert.throws(() => assertFetchAllowed('not a url'), /Invalid URL/);
  assert.throws(() => assertFetchAllowed('http://127.0.0.1:8080/'), /internal\/private/);
  assert.equal(assertFetchAllowed('https://mcmaster.com/x').hostname, 'mcmaster.com');
});

test('the scrape allowlist cannot be fooled by lookalike hostnames', () => {
  assert.doesNotThrow(() => assertScrapeHostAllowed('https://www.mcmaster.com/97036A040/'));
  assert.doesNotThrow(() => assertScrapeHostAllowed('https://amazon.com/dp/B01234ABCD'));
  for (const bad of [
    'https://mcmaster.com.evil.com/x',   // suffix trick
    'https://evil-mcmaster.com/x',       // prefix trick
    'https://notamazon.com/x',
    'https://example.com/x',
  ]) {
    assert.throws(() => assertScrapeHostAllowed(bad), /mcmaster\.com or amazon\.com/, `${bad} must be refused`);
  }
});

test('a redirect off an allowed host to a private address is refused', async () => {
  // The attack this guard exists for: the first URL passes the allowlist, then
  // the response redirects inward. Every hop is re-checked, so it stops here.
  const hops = [redirectTo('http://169.254.169.254/latest/meta-data/'), html('secrets')];
  let i = 0;
  await assert.rejects(
    fetchPage('https://www.mcmaster.com/x', { fetchImpl: async () => hops[i++] }),
    /internal\/private/,
  );
  assert.equal(i, 1, 'should have stopped before fetching the redirect target');
});

test('a redirect chain cannot loop forever', async () => {
  let calls = 0;
  await assert.rejects(
    fetchPage('https://www.mcmaster.com/a', {
      fetchImpl: async () => { calls++; return redirectTo('https://www.mcmaster.com/next'); },
    }),
    /Too many redirects/,
  );
  assert.ok(calls <= MAX_REDIRECTS + 1, `followed ${calls} hops, expected at most ${MAX_REDIRECTS + 1}`);
});

test('an ordinary redirect to another allowed page is followed', async () => {
  const pages = [redirectTo('https://www.mcmaster.com/final'), html('<title>Widget</title>')];
  let i = 0;
  const out = await fetchPage('https://www.mcmaster.com/start', { fetchImpl: async () => pages[i++] });
  assert.match(out, /Widget/);
});

test('McMaster pages give a part number, image and supplier', () => {
  const item = scrapeMcMaster('<title>Alloy Steel Socket Head Screw</title>', 'https://www.mcmaster.com/97036A040/');
  assert.equal(item.sku, '97036A040');
  assert.equal(item.supplier, 'McMaster-Carr');
  assert.equal(item.description, 'Alloy Steel Socket Head Screw');
  assert.match(item.photo, /images1\.mcmaster\.com.*97036p\.png$/);
  assert.equal(item.url, 'https://www.mcmaster.com/97036A040/');
});

test('a bare McMaster title is not mistaken for a description', () => {
  const item = scrapeMcMaster('<title>McMaster-Carr</title>', 'https://www.mcmaster.com/91290A115/');
  assert.equal(item.description, undefined);
  assert.equal(item.sku, '91290A115');
});

test('Amazon pages give a title, ASIN and price', () => {
  const page = '<span id="productTitle">  Kurt   D688 Vise </span>'
    + '<span class="a-price-whole">1,299</span><span class="a-price-fraction">95</span>'
    + '<meta property="og:image" content="https://m.media-amazon.com/x.jpg">';
  const item = scrapeAmazon(page, 'https://www.amazon.com/dp/B01ABCDEFG');
  assert.equal(item.description, 'Kurt D688 Vise');   // whitespace collapsed
  assert.equal(item.sku, 'B01ABCDEFG');
  assert.equal(item.price, 1299.95);
  assert.equal(item.supplier, 'Amazon');
  assert.equal(item.photo, 'https://m.media-amazon.com/x.jpg');
});

test('og:image is found whichever order the attributes come in', () => {
  assert.equal(scrapeOgImage('<meta property="og:image" content="https://a/1.jpg">'), 'https://a/1.jpg');
  assert.equal(scrapeOgImage('<meta content="https://a/2.jpg" property="og:image">'), 'https://a/2.jpg');
  assert.equal(scrapeOgImage('<meta name="other" content="x">'), null);
});

test('scrapeProductUrl refuses bad input before fetching anything', async () => {
  let called = false;
  const spy = async () => { called = true; };
  assert.equal((await scrapeProductUrl({ url: '', source: 'mcmaster', fetchImpl: spy })).status, 400);
  assert.equal((await scrapeProductUrl({ url: 'https://mcmaster.com/x', source: 'ebay', fetchImpl: spy })).status, 400);
  assert.equal((await scrapeProductUrl({ url: 'https://example.com/x', source: 'amazon', fetchImpl: spy })).status, 400);
  assert.equal(called, false);
});

test('a page with no product info says so rather than saving a blank item', async () => {
  const res = await scrapeProductUrl({
    url: 'https://www.amazon.com/dp/B01ABCDEFG', source: 'amazon',
    fetchImpl: async () => html('<html><body>Sign in to continue</body></html>'),
  });
  assert.equal(res.status, 422);
  assert.match(res.body.error, /require login or JavaScript/);
});
