# Shop Kanban — porting roadmap

The starter is the **foundation**: portable login, dual local/Cloudflare database,
minimal add/list UI. These milestones port the real app onto it, one shippable
chunk at a time. Each milestone should end green (`npm test`) and runnable
(`npm run dev`) on both hosts.

Source of truth for the features being ported: the production `neff-kanban` app.
As each piece comes over it must be **de-Neffed** — no shop name, seeded items,
Cloudflare-Access assumptions, or hardcoded hosts.

---

## Milestone 1 — Inventory core
The real inventory page in place of the placeholder `public/index.html`.
- Full item fields (min/reorder units, price, url, photo, itemType, status).
- Categories/cells (color + label + subtypes) and locations, with their API.
- Row layout: photo/placeholder icon, category dot, part#, vendor, location tag,
  min/reorder, status.
- Search + category/vendor filters.
- Schema adds: extend `items`; keep `categories`, `locations`.
**Done when:** you can add/edit/search real items with cells & locations on both hosts.

## Milestone 2 — Reorder flow
- Reorder queue ("cart"), min-stock status, mark-ordered, receiving.
- Schema adds: `cart`, `orders`.
**Done when:** low items flag for reorder, queue → ordered → received round-trips.

## Milestone 3 — Labels & QR (the shop-floor half)
- `buildLabel` (all sizes) + the label modal & print flow + the pickup flag.
- QR generation.
- Public **scan-to-reorder** page — WITHOUT Cloudflare Access. Use an
  unguessable per-item token route (e.g. `/r/<token>`) so a scanned code works
  from any phone without exposing the whole app.
**Done when:** print a card, scan it on a phone, item lands in the reorder queue.

## Milestone 4 — Power features
- Bulk edit, photos, the card designer, settings (shop name/logo).
- Screenshot import — gated on an optional `ANTHROPIC_API_KEY` (off by default).
**Done when:** a shop can theme it and edit in bulk; AI import works only if keyed.

## Milestone 5 — Release
- A few README screenshots, an optional demo-data seeder, version tag, and a
  GitHub release / "Deploy your own" notes.
**Done when:** a stranger can go from download → running in ~10 minutes.

---

### Working notes
- Keep `src/app.mjs` host-agnostic; anything host-specific goes in the two
  adapters / two entry points.
- Every ported feature ships with a `node:test` alongside it.
- Don't reintroduce the label wrapper bug: the pickup flag injects into the
  card's root element, never a wrapping div (a wrapper's `line-height:0`
  collapsed card text). See the production fix if in doubt.
