# Hosting guide

Two ways to run Community Kanban. Pick one — you can switch later; only the data
location differs.

Run the wizard first either way:

```bash
npm install
npm run setup
```

---

## Option A — Local server (shop PC or Raspberry Pi)

Best when you want everything on your own network with nothing in the cloud.
Phones on the shop wifi can scan cards; off-site devices can't reach it.

The wizard writes a `.env` for you. Then:

```bash
npm run dev
```

- Open `http://localhost:<port>` on the same machine.
- From other shop devices, use `http://<this-machine-ip>:<port>` (find the IP with
  `ipconfig getifaddr en0` on macOS, `hostname -I` on Linux).
- Sign in with the shop password you chose.

**Your data** is the SQLite file at `DB_PATH` (default `./data/shop.db`). Copy that
file somewhere safe on a schedule — that's your backup.

**Run it as an always-on service** (so it survives reboots): use `pm2`
(`npx pm2 start server.mjs`), a systemd unit on Linux, or a Login Item on macOS.
Point it at the same `.env` (the `dev`/`start` scripts already load it via
`node --env-file=.env`).

**Config** lives in `.env` (documented in `.env.example`): `SHOP_NAME`, `PORT`,
`DB_PATH`, `SHOP_PASSWORD`, `SESSION_SECRET`, and an optional `ANTHROPIC_API_KEY`.

---

## Option B — Cloudflare (free, reachable anywhere)

Best when you want QR scanning to work from any phone, anywhere, without running
a machine yourself. Everything lives in **your own** Cloudflare account.

The wizard writes `wrangler.toml` and a `SETUP-NEXT-STEPS.md` with your generated
`SESSION_SECRET` and the exact commands. Those steps are:

```bash
npm install
npx wrangler login                    # free account; opens your browser

# 1. Create your database; paste the printed database_id into wrangler.toml
npx wrangler d1 create <project>

# 2. Load the schema
npx wrangler d1 execute <project> --remote --file=src/db/schema.sql

# 3. Set secrets (paste each value when prompted)
npx wrangler pages secret put SHOP_PASSWORD --project-name <project>
npx wrangler pages secret put SESSION_SECRET --project-name <project>

# 4. Deploy
npx wrangler pages deploy public --project-name <project> --branch main
```

Wrangler prints your URL (`https://<project>.pages.dev`). You can attach a custom
domain in the Cloudflare Pages dashboard.

**Your data** is the D1 database in your account. Export a backup any time with
`npx wrangler d1 export <project> --remote --output backup.sql`.

**Updating after code changes:** re-run step 4 (`wrangler pages deploy`). If you
changed `src/db/schema.sql`, apply the change with another `wrangler d1 execute`
(D1 has no automatic migrations — write an `ALTER TABLE` and run it once).

**Gotchas** (learned the hard way):
- After `wrangler pages secret put`, **redeploy** — Pages keeps serving the old
  secret value until a new deployment binds the new one.
- A successful deploy prints `✨ Compiled Worker successfully` **and**
  `Uploading Functions bundle`. If you don't see the Functions line, only static
  files went up and the API is stale.

---

## Updating an existing install

New versions sometimes add database columns. How you pick them up depends on
where your data lives:

- **Local** — nothing to do. The app adds any missing columns when it starts,
  and leaves your rows alone.
- **Cloudflare** — re-run the schema (it only creates what is missing), then
  apply any migration files newer than your install:

  ```bash
  wrangler d1 execute <your-db> --remote --file=src/db/schema.sql
  wrangler d1 execute <your-db> --remote --file=src/db/migrations/001-inventory-core.sql
  ```

  A migration you have already applied fails with `duplicate column name`. That
  is the expected way to find out it is already there — nothing is wrong, and
  nothing was changed. A **fresh** database needs only `schema.sql`.

## Optional: screenshot import

Both hosts support importing an item from a product-page screenshot via Claude
vision. It's **off** until you provide a key:

- **Local:** put `ANTHROPIC_API_KEY=...` in `.env`.
- **Cloudflare:** `npx wrangler pages secret put ANTHROPIC_API_KEY --project-name <project>`, then redeploy.

With no key set, the rest of the app works normally; only that one feature is disabled.
