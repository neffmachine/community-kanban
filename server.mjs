// Local-host entry point: serves the API + static files on this machine (or a
// shop server / Raspberry Pi on the LAN). Data lives in a local SQLite file.
//   npm run dev   →   node --env-file=.env server.mjs
import { serve } from '@hono/node-server';
import { serveStatic } from '@hono/node-server/serve-static';
import { createSqliteDb } from './src/db/sqlite.mjs';
import { createApp } from './src/app.mjs';
import { loadConfig } from './src/config.mjs';

const config = loadConfig();
const db = createSqliteDb(config.dbPath);
const app = createApp({ db, config });

// Serve the frontend for any non-API path.
app.use('/*', serveStatic({ root: './public' }));

serve({ fetch: app.fetch, port: config.port }, (info) => {
  console.log(`\n  ${config.shopName} — Shop Kanban`);
  console.log(`  Running at http://localhost:${info.port}`);
  console.log(`  On your shop's wifi, other devices reach it at http://<this-machine-ip>:${info.port}\n`);
});
