# Community Kanban

A free, self-hosted kanban inventory app for machine shops. Print QR cards for
your bins; scan a card to drop the item into a reorder queue. **You host your own
data** — there's no central service and nobody else's server involved.

Run it one of two ways (the setup wizard walks you through picking):

- **Local server** — on a shop PC or a Raspberry Pi on your wifi. Data lives in a
  single SQLite file on that box. No internet, no accounts, no monthly bill.
- **Cloudflare** — free hosting in *your own* Cloudflare account, reachable (and
  QR-scannable) from anywhere. Data lives in your account's database.

The same code runs both ways; only where the data lives changes.

## Quick start

```bash
npm install
npm run setup      # choose local or Cloudflare, answer a few questions
```

Then follow what the wizard prints:

- **Local:** `npm run dev`, open `http://localhost:8080`, sign in with your shop password.
- **Cloudflare:** follow the steps in the generated `SETUP-NEXT-STEPS.md`.

Full details and troubleshooting: **[docs/HOSTING.md](docs/HOSTING.md)**.

## What's in the box

```
setup.mjs              Choose-your-own-adventure wizard (local vs Cloudflare)
server.mjs             Local host entry (Node + node:sqlite)
functions/api/         Cloudflare host entry (Pages Function + D1)
src/
  app.mjs              The API — one set of routes, runs on both hosts
  auth.mjs             Shop-password login + signed session cookie
  db/                  One interface, two adapters: sqlite.mjs (local), d1.mjs (cloud)
  db/schema.sql        Database schema (identical on both — both are SQLite)
public/index.html      A minimal starter UI (sign in, list, add, flag pickup)
test/                  Unit tests (node:test): auth + API round-trip
```

The `public/` UI is intentionally minimal — a working base to build on, or to
replace with your own frontend. Everything under `src/` is host-agnostic.

## Requirements

- **Node 22+** (uses the built-in `node:sqlite` and `--env-file` — no native deps to compile).
- For the Cloudflare path: a free Cloudflare account and `wrangler` (installed as a dev dependency).

## A note on your data

There is no telemetry and no phone-home. On local, your data is the SQLite file
at `DB_PATH` — back it up. On Cloudflare, it's a D1 database in your own account.
The project is provided as-is under the [MIT license](LICENSE); you own and are
responsible for your data and backups.

## Contributing / house rules

This repo ships with a lightweight engineering kit (see `CLAUDE.md` /
`TESTING-PIPELINE.md` and the `.claude`, `.cursor`, `.gemini`, etc. skill folders).
The short version: keep secrets out of git, write a real test with every change,
and run `npm test` before you push.
