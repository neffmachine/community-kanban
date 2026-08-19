# Roadmap

This started as a from-scratch rebuild working through milestones. That was the
wrong shape: there was already a working app, and the job was to publish a copy
of it without one shop's data in it. So the plan changed — the real screens and
the real API were brought across whole, and the milestone list below is kept
only as a record of what is and isn't done.

## Done

- **The data model** — the production schema in full: items, cart, orders,
  cells, item types, locations, activity log, settings.
- **The screens** — inventory, reorder queue, receiving, cells, item types,
  locations, activity log, settings, card designer, and the public scan page.
  Plus label building and the QR scanner.
- **The API** — items with activity logging and undo, the queue, on-order and
  receiving, the config collections, the log, QR generation.
- **A login.** The original has none: locally it trusts the LAN, and in the
  cloud it sits behind Cloudflare Access — a company SSO layer that doesn't
  travel. This fork uses a shop password and a signed session, gating the pages
  themselves so none of them had to change. The scan page stays open, as it must.
- **Runs both ways** — a shop PC or Cloudflare, from one codebase.
- **Screenshot import** — optional, off until a shop sets its own API key.
- **Sample data** — five labelled example items.

## Not done yet

- `scrape-url` and `import-url` — pull item details from a supplier's product
  page. Only ever existed in the old file-based server, so they need converting
  rather than copying, and they carry the SSRF guards that came out of an
  earlier security pass.
- `backup` / `backup/download` — export and restore.
- `duplicate`, `remap-category`, `sync-unlink` — bulk and housekeeping actions.
- The original test suite (item rules, label building, scraping, SSRF) still
  needs porting.
- Input validation on the config endpoints. They replace a whole collection
  from the request body without checking its shape, so a malformed payload can
  empty a list. Harmless behind a company SSO gate; less so on the open web.
- Screenshots in the README, and a tagged release.

## Working notes

- `src/app.mjs` stays host-agnostic. Anything host-specific belongs in the two
  adapters or the two entry points.
- Every ported feature ships with a `node:test` alongside it.
- Don't reintroduce the label wrapper bug: the pickup flag injects into the
  card's root element, never a wrapping div — a wrapper's `line-height:0`
  collapsed the card text.
