// Portable auth. Replaces the Cloudflare-Access gate (which is tied to one
// Cloudflare org) with a self-contained shop password + signed session cookie,
// so the app can protect itself on any host. Uses Web Crypto (HMAC-SHA256),
// which is present in both Node and the Workers runtime.
//
// The shop password and the signing secret come from the environment
// (SHOP_PASSWORD, SESSION_SECRET) — never hard-coded, never stored in the DB.

const enc = new TextEncoder();

async function hmac(secret, value) {
  const key = await crypto.subtle.importKey(
    'raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(value));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

// Constant-time string compare, so a wrong password can't be timed byte-by-byte.
function safeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export function checkPassword(submitted, expected) {
  return !!expected && safeEqual(String(submitted || ''), String(expected));
}

// A session cookie value is `<issuedAt>.<hmac(issuedAt)>`; tampering breaks the signature.
export async function makeSession(secret) {
  const issued = String(Date.now());
  return `${issued}.${await hmac(secret, issued)}`;
}

export async function verifySession(cookieValue, secret) {
  if (!cookieValue || !secret) return false;
  const dot = cookieValue.lastIndexOf('.');
  if (dot < 0) return false;
  const issued = cookieValue.slice(0, dot);
  const sig = cookieValue.slice(dot + 1);
  return safeEqual(sig, await hmac(secret, issued));
}

// Hono middleware: allow the listed open paths through, require a valid session
// cookie for everything else under /api.
export function requireAuth(config, openPaths = ['/api/login', '/api/health']) {
  return async (c, next) => {
    const path = new URL(c.req.url).pathname;
    if (!path.startsWith('/api') || openPaths.includes(path)) return next();
    const cookie = getCookie(c.req.header('cookie'), 'session');
    if (await verifySession(cookie, config.sessionSecret)) return next();
    return c.json({ error: 'Not signed in' }, 401);
  };
}

export function getCookie(header, name) {
  if (!header) return null;
  for (const part of header.split(';')) {
    const [k, ...v] = part.trim().split('=');
    if (k === name) return v.join('=');
  }
  return null;
}
