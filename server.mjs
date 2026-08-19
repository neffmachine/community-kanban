// Local-host entry point: serves the API + static files on this machine (or a
// shop server / Raspberry Pi on the LAN). Data lives in a local SQLite file.
//   npm run dev   →   node --env-file=.env server.mjs
import './src/check-node.mjs';
import { serve } from '@hono/node-server';
import { serveStatic } from '@hono/node-server/serve-static';
import { createSqliteDb } from './src/db/sqlite.mjs';
import { createApp } from './src/app.mjs';
import { loadConfig } from './src/config.mjs';
import { verifySession, getCookie } from './src/auth.mjs';
import { PRETTY_PAGES, requiresSession } from './src/page-gate.mjs';

const config = loadConfig();
const db = createSqliteDb(config.dbPath);
const app = createApp({ db, config });

// Gate the pages themselves, not just the API.
//
// Production sat behind Cloudflare Access, which stopped people at the door, so
// the pages never had to consider a signed-out visitor — they just load and
// fetch. Serving them unguarded here would show an empty shell throwing 401s.
// Guarding at the door instead keeps all ten pages untouched.
//
app.use('*', async (c, next) => {
  const path = new URL(c.req.url).pathname;
  if (!requiresSession(path)) return next();
  if (await verifySession(getCookie(c.req.header('cookie'), 'session'), config.sessionSecret)) return next();
  return c.redirect('/login?next=' + encodeURIComponent(path));
});

// Pretty URLs the pages link to (/cart rather than /cart.html), matching what
// the production server served. On Cloudflare the same mapping lives in
// public/_redirects, since Pages does its own routing.
app.get('/login', serveStatic({ path: './public/login.html' }));

for (const [route, file] of Object.entries(PRETTY_PAGES)) {
  app.get(route, serveStatic({ path: `./public/${file}` }));
}
// A scanned card lands on /reorder/<id>; the page reads the id from the URL.
app.get('/reorder/:id', serveStatic({ path: './public/reorder.html' }));

// Serve the frontend for any non-API path.
app.use('/*', serveStatic({ root: './public' }));

serve({ fetch: app.fetch, port: config.port }, (info) => {
  console.log(`\n  ${config.shopName} — Community Kanban`);
  console.log(`  Running at http://localhost:${info.port}`);
  console.log(`  On your shop's wifi, other devices reach it at http://<this-machine-ip>:${info.port}\n`);
});
