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
- **Import from a supplier's page** — `scrape-url` and `import-url`, with the
  SSRF guards intact and re-checked on every redirect hop.
- **Backup** — builds the export on demand and hands it to the browser, rather
  than writing files onto the server's own disk.
- **Bulk actions** — duplicate, remap-category, sync-unlink.
- **The original test suite** — item rules, undo, label building, scraping and
  SSRF, all ported. 74 tests.
- **Config endpoints validate their input**, so a malformed request is refused
  rather than emptying a collection.

## Not done yet

- Screenshots in the README.
- A tagged release.
- Per-person accounts. The shop password is one shared secret, which suits a
  shop floor but records nothing about who did what beyond the activity log.

## Working notes

- `src/app.mjs` stays host-agnostic. Anything host-specific belongs in the two
  adapters or the two entry points.
- Every ported feature ships with a `node:test` alongside it.
- Don't reintroduce the label wrapper bug: the pickup flag injects into the
  card's root element, never a wrapping div — a wrapper's `line-height:0`
  collapsed the card text.
