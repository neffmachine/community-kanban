# Community Kanban

A free, self-hosted kanban inventory system for machine shops. Print a QR card
for every bin; when someone takes the last one, they scan the card with their
phone and the item lands in your reorder queue. **You host your own data** —
there is no central service, no account, and nobody else's server involved.

Run it one of two ways — the setup wizard walks you through picking:

- **Local server** — a shop PC or a Raspberry Pi on your wifi. Data lives in a
  single file on that box. No internet, no accounts, no monthly bill. Phones on
  the shop wifi can scan and reorder; off-site can't reach it.
- **Cloudflare** — free hosting in *your own* Cloudflare account, reachable and
  QR-scannable from anywhere. Data lives in your account's database.

The same code runs both ways. Only where the data lives changes.

## Quick start

You need **Node 22 or newer** — the LTS installer from
[nodejs.org](https://nodejs.org) is all it takes. Everything else is handled
for you.

**The easy way.** Download this repository (green **Code** button → **Download
ZIP**), unzip it, and double-click:

- **Start Community Kanban.command** on a Mac — the first time, right-click it
  and choose *Open*, to clear the "unidentified developer" warning
- **Start Community Kanban.bat** on Windows

It installs what's needed, asks a few setup questions, offers to load some
sample parts, then starts the app and opens your browser.

**The terminal way**, if you'd rather:

```bash
npm install
npm run setup      # local or Cloudflare, plus a shop name and password
npm run dev        # local only — Cloudflare prints its own next steps
```

Then open `http://localhost:8080` and sign in with the shop password you chose.
Other devices on your wifi use `http://<that-machine's-ip>:8080` — and that's
the address to use if you want to scan a printed card with a phone, since the
QR code points at whatever address you were browsing.

Sample data, any time:

```bash
npm run seed:sample            # five clearly-labelled example items
npm run seed:sample -- --clear # remove them again
```

Full details and troubleshooting: **[docs/HOSTING.md](docs/HOSTING.md)**.

## What it does

**Inventory** — parts with vendor, part number, cell, location, min stock and
reorder quantity (each with its own unit, so "4 ea / 1 box of 10" reads right),
price, product URL and a photo. Search across everything, filter by cell or
vendor, sort by any column, bulk-edit a selection.

**Tools vs. everything else** — a one-click toggle between cutting tools and
general stock, so the crib and the consumables shelf don't crowd each other out.

**Reorder queue** — flag an item, or let a scan flag it. The queue totals up
what you're about to spend, then marks the batch ordered. Receiving checks them
back in and puts the stock level right.

**Printed cards with QR codes** — five sizes from a small bin label to a 3×5
card, printed in batches, with a card designer for laying out your own. Scanning
one opens a single-purpose page that adds the item to the queue — no login, so
it works from any phone on the floor, and it exposes nothing but that one item.

**Pickup items** — things you fetch yourself rather than order online (welding
gas, say) are tagged so they go on the run list instead of a purchase order.

**Activity log** — every change, with an undo for the ones that can be undone.

**Screenshot import (optional)** — paste a screenshot of a supplier's product
page into the Add Item form and have the description, part number, vendor and
price filled in. This needs an Anthropic API key. See below.

## Bring your own API key

Screenshot import is the only feature that talks to an outside service, and it
is off until you set it up.

**You use your own key and pay for your own usage.** There is no shared key and
nothing is billed to anyone else. Get one at
[console.anthropic.com](https://console.anthropic.com), then:

- **Local:** add `ANTHROPIC_API_KEY=sk-ant-...` to your `.env` and restart.
- **Cloudflare:** `npx wrangler pages secret put ANTHROPIC_API_KEY`, then redeploy.

The key is read from the environment and never written into your inventory
data, so it can't end up in a backup or an export. Everything else in the app
works exactly the same without one.

## Your data

There is no telemetry and no phone-home. On a local install your data is the
file at `DB_PATH` — **back that file up**; nobody else has a copy. On Cloudflare
it's a database in your own account.

The one thing to understand about the shop password: it's a single password
everyone shares, which suits a shop floor but is not per-person access control.
Treat it like the key to the shop. If you put this on the public internet, use a
long one.

Provided as-is under the [MIT license](LICENSE). You own your data and are
responsible for your backups.

## What's in the box

```
Start Community Kanban.command / .bat   Double-click launcher (macOS / Windows)
setup.mjs              Setup wizard (local vs Cloudflare)
server.mjs             Local host entry (Node + node:sqlite)
functions/             Cloudflare host entry (Pages Functions + D1)
src/
  app.mjs              The API — one set of routes, both hosts
  items.mjs            Item rules (normalising, updates, undo) — pure, tested
  auth.mjs             Shop-password login + signed session cookie
  screenshot-import.mjs Optional Claude vision import
  db/                  One interface, two adapters: sqlite.mjs, d1.mjs
  db/schema.sql        Schema (identical on both — both are SQLite)
public/                The app: inventory, queue, receiving, cells, types,
                       locations, log, settings, card designer, scan page
scripts/seed-sample.mjs Optional example data
test/                  node:test suite
```

## Contributing

House rules are in [AGENTS.md](AGENTS.md); the testing setup is in
[docs/TESTING-PIPELINE.md](docs/TESTING-PIPELINE.md). The short version: keep
secrets out of git, ship a real test with every change, and run `npm test`
before you push.
