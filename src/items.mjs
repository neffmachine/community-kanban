// Pure item logic — no database, no framework, so it unit-tests cleanly.
// Both hosts share it: the API layer does the storage, this does the rules.

const DEFAULT_CATEGORY = '#6b7280';

// Normalize a raw request body into the item fields we store. Used by both create
// and update; update layers this over the existing row (see applyUpdate).
function normalizeItemInput(body = {}) {
  const s = (v) => (v == null ? '' : String(v)).trim();
  // 0/1 flag, tolerant of the checkbox's boolean and DB/string round-trips.
  const b01 = (v) => (v === true || v === 1 || v === '1' || v === 'true') ? 1 : 0;
  const rawUrl = s(body.url);
  return {
    sku: s(body.sku).toUpperCase(),
    description: s(body.description),
    supplier: s(body.supplier),
    minStock: parseInt(body.minStock, 10) || 1,
    reorderQty: parseInt(body.reorderQty, 10) || 1,
    minUnit: s(body.minUnit),
    reorderUnit: s(body.reorderUnit),
    price: parseFloat(body.price) || 0,
    bin: s(body.bin).toUpperCase(),
    // bare domains get https:// prepended; anything already starting with http(s) is left alone
    url: rawUrl && !/^https?:/i.test(rawUrl) ? 'https://' + rawUrl.replace(/^\/+/, '') : rawUrl,
    itemType: s(body.itemType),
    category: body.category || DEFAULT_CATEGORY,
    photo: body.photo || null,
    // Restocked by a physical run (local pickup) rather than an online order.
    physicalReorder: b01(body.physicalReorder),
  };
}

// Fields that a PUT is allowed to change. `id`, `createdAt`, `syncGroup`, and status
// transitions are handled by dedicated endpoints, not a blanket update.
const UPDATABLE = ['sku', 'description', 'supplier', 'minStock', 'reorderQty', 'minUnit',
  'reorderUnit', 'price', 'bin', 'url', 'itemType', 'category', 'photo', 'physicalReorder'];

// Produce the updated row: start from the existing item, overlay only the fields the
// body actually provided (normalized). Missing fields keep their current value.
function applyUpdate(existing, body = {}) {
  const norm = normalizeItemInput({ ...existing, ...body });
  const next = { ...existing };
  for (const f of UPDATABLE) {
    if (body[f] !== undefined) next[f] = norm[f];
  }
  return next;
}

// The ONLY item fields exposed on the public reorder endpoint (/api/reorder/:id),
// which sits OUTSIDE Cloudflare Access so scanned QR codes work from any phone. Keep
// this list minimal — it must never leak price, url, photo, timestamps, or the full
// inventory. It mirrors exactly what public/reorder.html renders.
function publicReorderView(item, alreadyQueued) {
  return {
    id: item.id,
    sku: item.sku,
    description: item.description,
    supplier: item.supplier || '',
    bin: item.bin || '',
    minStock: item.minStock,
    reorderQty: item.reorderQty,
    alreadyQueued: !!alreadyQueued,
  };
}

// Given a reversible activity-log entry (with reverseData already parsed), return
// the list of { sql, params } statements that undo it. Pure — the endpoint runs
// them; keeping the decision here makes every undo path unit-testable. Returns []
// when the entry can't be undone (not reversible, already reversed, or unknown).
function buildReverse(entry) {
  if (!entry || !entry.reversible || entry.reversed) return [];
  const d = entry.reverseData || {};
  switch (entry.type) {
    case 'item_add': // added an item → undo by deleting it (and any queue/order rows)
      return [
        { sql: 'DELETE FROM cart WHERE itemId = ?', params: [d.itemId] },
        { sql: 'DELETE FROM orders WHERE itemId = ?', params: [d.itemId] },
        { sql: 'DELETE FROM items WHERE id = ?', params: [d.itemId] },
      ];
    case 'item_delete': { // deleted an item → undo by re-inserting the saved row (same id keeps QR codes valid)
      const it = d.item || {};
      const cols = Object.keys(it);
      if (!cols.length) return [];
      return [{ sql: `INSERT INTO items (${cols.join(', ')}) VALUES (${cols.map(() => '?').join(', ')})`, params: cols.map((k) => it[k]) }];
    }
    case 'item_edit': { // edited fields → undo by restoring the previous values
      const prev = d.prev || {};
      const cols = Object.keys(prev);
      if (!cols.length) return [];
      return [{ sql: `UPDATE items SET ${cols.map((k) => `${k} = ?`).join(', ')} WHERE id = ?`, params: [...cols.map((k) => prev[k]), d.itemId] }];
    }
    case 'queue': // added to the reorder queue → undo by removing it and restoring the prior status
      return [
        { sql: 'DELETE FROM cart WHERE itemId = ?', params: [d.itemId] },
        { sql: 'UPDATE items SET status = ? WHERE id = ?', params: [d.prevStatus || 'ok', d.itemId] },
      ];
    case 'unqueue': // removed from the queue → undo by re-adding it
      return [
        { sql: 'INSERT OR IGNORE INTO cart (itemId, addedAt, addedBy) VALUES (?, ?, ?)', params: [d.itemId, d.addedAt || '', ''] },
        { sql: "UPDATE items SET status = 'reorder' WHERE id = ?", params: [d.itemId] },
      ];
    default:
      return [];
  }
}

export { normalizeItemInput, applyUpdate, publicReorderView, buildReverse, UPDATABLE, DEFAULT_CATEGORY };
