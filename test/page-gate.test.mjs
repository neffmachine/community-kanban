import test from 'node:test';
import assert from 'node:assert/strict';
import { requiresSession, isOpenPath, isPageRequest, PRETTY_PAGES } from '../src/page-gate.mjs';

test('the app pages require a session', () => {
  assert.equal(requiresSession('/'), true);
  assert.equal(requiresSession('/index.html'), true);
  for (const route of Object.keys(PRETTY_PAGES)) {
    assert.equal(requiresSession(route), true, `${route} should be gated`);
  }
});

test('a scanned card reaches the reorder page without signing in', () => {
  // The whole point of the printed QR: it has to work from any phone.
  assert.equal(requiresSession('/reorder/1'), false);
  assert.equal(requiresSession('/reorder/9999'), false);
  assert.equal(requiresSession('/reorder.html'), false);
  assert.equal(requiresSession('/api/reorder/1'), false);
});

test('the login page is reachable signed out, or nobody could sign in', () => {
  assert.equal(requiresSession('/login'), false);
  assert.equal(requiresSession('/login.html'), false);
});

test('assets and API calls are not page requests', () => {
  // Assets stay open so the login screen can style itself.
  for (const path of ['/theme-tokens.css', '/theme.js', '/favicon.svg', '/buildLabel.js', '/vendor/jsqr.js']) {
    assert.equal(requiresSession(path), false, `${path} should not be gated as a page`);
    assert.equal(isPageRequest(path), false);
  }
  // The API guards itself and must not be redirected to HTML.
  for (const path of ['/api/items', '/api/login', '/api/cart']) {
    assert.equal(requiresSession(path), false, `${path} must be left to the API's own check`);
  }
});

test('every pretty URL maps to a page that exists in public/', async () => {
  const { existsSync } = await import('node:fs');
  const { fileURLToPath } = await import('node:url');
  const { dirname, join } = await import('node:path');
  const root = join(dirname(fileURLToPath(import.meta.url)), '..');
  const entries = Object.entries(PRETTY_PAGES);
  assert.ok(entries.length >= 8, 'expected the full set of pages');
  for (const [route, file] of entries) {
    assert.ok(existsSync(join(root, 'public', file)), `${route} points at missing public/${file}`);
  }
});

test('isOpenPath and isPageRequest agree on the gated set', () => {
  assert.equal(isOpenPath('/login'), true);
  assert.equal(isOpenPath('/cart'), false);
  assert.equal(isPageRequest('/cart'), true);
  assert.equal(isPageRequest('/nope'), false);   // unknown, non-.html → asset lookup, then 404
});
