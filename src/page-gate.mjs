// Which requests have to be signed in before a page is served.
//
// Both hosts ask the same question — server.mjs for the local server,
// functions/_middleware.js for Cloudflare — so the answer lives here rather
// than in two lists that drift apart.

// Pretty URL → file in public/. The pages link to /cart, not /cart.html.
export const PRETTY_PAGES = {
  '/cart': 'cart.html',
  '/cells': 'cells.html',
  '/log': 'log.html',
  '/receiving': 'receiving.html',
  '/locations': 'locations.html',
  '/item-types': 'item-types.html',
  '/settings': 'settings.html',
  '/card-editor': 'card-editor.html',
};

// Reachable signed out: the login page, and the reorder page a scanned card
// lands on — that one has to work from any phone, which is the whole point of
// printing a QR code onto the bin.
export function isOpenPath(path) {
  return path === '/login' || path === '/login.html'
    || path === '/reorder.html' || path.startsWith('/reorder/');
}

// A request for a page rather than an asset or an API call. Assets stay open so
// the login screen can style itself, and /api guards itself.
export function isPageRequest(path) {
  return path === '/' || path.endsWith('.html') || Object.hasOwn(PRETTY_PAGES, path);
}

// The one question both hosts ask.
export function requiresSession(path) {
  if (path.startsWith('/api') || isOpenPath(path)) return false;
  return isPageRequest(path);
}
