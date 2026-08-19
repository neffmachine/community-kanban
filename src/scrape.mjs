// Pull item details from a supplier's product page.
//
// This fetches a URL server-side, which is a capability worth being careful
// with: without limits, anyone who can reach the app could use it to probe the
// network it sits on — a shop's router, a cloud metadata endpoint. The guards
// below are ported from the production app's security pass and are the reason
// this file exists rather than a one-line fetch.
//
// Ported to fetch() from node:https so it runs on Cloudflare as well as a shop
// PC. Redirects are followed by hand, on purpose: an allowed host can redirect
// to a forbidden one, so every hop is re-checked.

// Only these hosts may be fetched. An allowlist, not a blocklist — a blocklist
// of "bad" addresses is a game you lose eventually.
const ALLOWED_SCRAPE_HOSTS = [/(^|\.)mcmaster\.com$/i, /(^|\.)amazon\.com$/i];

export const MAX_REDIRECTS = 5;
export const MAX_BYTES = 800_000;
export const TIMEOUT_MS = 12_000;

// Addresses that are never fetched, whatever the allowlist says: loopback,
// private ranges, and link-local — which covers the cloud metadata endpoint at
// 169.254.169.254 that hands out credentials.
export function isPrivateHost(hostname) {
  const h = (hostname || '').toLowerCase();
  if (!h || h === 'localhost' || h.endsWith('.local') || h.endsWith('.internal')) return true;
  const m = h.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (m) {
    const a = +m[1], b = +m[2];
    if (a === 0 || a === 10 || a === 127) return true;         // unspecified / private / loopback
    if (a === 169 && b === 254) return true;                    // link-local, incl. cloud metadata
    if (a === 172 && b >= 16 && b <= 31) return true;           // private
    if (a === 192 && b === 168) return true;                    // private
  }
  // IPv6 loopback, unique-local and link-local.
  if (h === '::1' || h.startsWith('fc') || h.startsWith('fd') || h.startsWith('fe80')) return true;
  return false;
}

export function assertFetchAllowed(rawUrl) {
  let u;
  try { u = new URL(rawUrl); } catch { throw new Error('Invalid URL'); }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') throw new Error('Only http/https URLs are allowed');
  if (isPrivateHost(u.hostname)) throw new Error('Refusing to fetch an internal/private network address');
  return u;
}

export function assertScrapeHostAllowed(rawUrl) {
  const u = assertFetchAllowed(rawUrl);
  if (!ALLOWED_SCRAPE_HOSTS.some((re) => re.test(u.hostname))) {
    throw new Error('URL must be a mcmaster.com or amazon.com product page');
  }
  return u;
}

// Read at most MAX_BYTES of the body, so a huge or endless response can't be
// used to exhaust memory.
async function readCapped(response) {
  if (!response.body) return await response.text();
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let out = '';
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    out += decoder.decode(value, { stream: true });
    if (out.length >= MAX_BYTES) { await reader.cancel(); break; }
  }
  return out.slice(0, MAX_BYTES);
}

export async function fetchPage(url, { fetchImpl = fetch, redirects = 0 } = {}) {
  if (redirects > MAX_REDIRECTS) throw new Error('Too many redirects');
  assertFetchAllowed(url);   // re-checked on every hop, not just the first

  const response = await fetchImpl(url, {
    redirect: 'manual',
    signal: AbortSignal.timeout(TIMEOUT_MS),
    headers: {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      Accept: 'text/html,application/xhtml+xml',
      'Accept-Language': 'en-US,en;q=0.9',
    },
  });

  if ([301, 302, 303, 307, 308].includes(response.status)) {
    const location = response.headers.get('location');
    if (!location) throw new Error('Redirect with no location');
    const next = new URL(location, url).href;
    return fetchPage(next, { fetchImpl, redirects: redirects + 1 });
  }
  return readCapped(response);
}

export function scrapeOgImage(html) {
  const m = html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i)
    || html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i);
  return m ? m[1] : null;
}

export function scrapeMcMaster(html, url) {
  const item = {};
  const partMatch = url.match(/mcmaster\.com\/([A-Z0-9]+)\/?$/i) || url.match(/mcmaster\.com\/([A-Z0-9]+)/i);
  const partNum = partMatch ? partMatch[1].toUpperCase() : null;
  if (partNum) {
    item.sku = partNum;
    // McMaster's product images follow a predictable CDN path off the numeric
    // part of the number.
    const numericBase = partNum.match(/^([0-9]+)/);
    if (numericBase) item.photo = `https://images1.mcmaster.com/content/gfx/large/${numericBase[1]}p.png`;
  }
  // The description isn't in the static HTML; take the title when it carries
  // something more useful than the site name.
  const titleMatch = html.match(/<title>([^<]+)<\/title>/i);
  if (titleMatch && !titleMatch[1].includes('McMaster-Carr')) item.description = titleMatch[1].trim();
  item.supplier = 'McMaster-Carr';
  item.url = url.replace(/\/$/, '') + '/';
  return item;
}

export function scrapeAmazon(html, url) {
  const item = {};
  let m = html.match(/id="productTitle"[^>]*>\s*([^<]{5,200})/i);
  if (m) item.description = m[1].trim().replace(/\s+/g, ' ');
  if (!item.description) {
    m = html.match(/<title>([^:]{5,120})\s*:/i);
    if (m) item.description = m[1].trim();
  }
  m = url.match(/\/dp\/([A-Z0-9]{10})/i) || url.match(/\/gp\/product\/([A-Z0-9]{10})/i);
  if (m) item.sku = m[1];
  const whole = html.match(/class="a-price-whole">([0-9,]+)/);
  const cents = html.match(/class="a-price-fraction">([0-9]+)/);
  if (whole) item.price = parseFloat(whole[1].replace(',', '') + '.' + (cents ? cents[1] : '00'));
  item.supplier = 'Amazon';
  item.url = url;
  item.photo = scrapeOgImage(html);
  return item;
}

// Fetch and parse a product page. Returns { status, body } for the route.
export async function scrapeProductUrl({ url, source, fetchImpl = fetch }) {
  if (!url) return { status: 400, body: { error: 'No URL provided' } };
  if (source !== 'mcmaster' && source !== 'amazon') {
    return { status: 400, body: { error: 'Unknown source — expected mcmaster or amazon' } };
  }
  try {
    assertScrapeHostAllowed(url);
  } catch (err) {
    return { status: 400, body: { error: err.message } };
  }

  let html;
  try {
    html = await fetchPage(url, { fetchImpl });
  } catch (err) {
    return {
      status: 502,
      body: {
        error: 'Could not fetch that page',
        detail: err?.name === 'TimeoutError' ? 'The page took too long to respond.' : (err?.message || ''),
      },
    };
  }

  const scraped = source === 'mcmaster' ? scrapeMcMaster(html, url) : scrapeAmazon(html, url);
  if (!scraped.description) {
    return {
      status: 422,
      body: { error: 'Could not find product info — the page may require login or JavaScript' },
    };
  }
  return { status: 200, body: scraped };
}
