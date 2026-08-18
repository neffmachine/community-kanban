// Search and filtering for the inventory list.
//
// This lives beside the page rather than inside it so it can be tested directly:
// the production app keeps the same logic inline in a 2,800-line HTML file,
// where none of it can be exercised by a test.

// The text a search query is matched against. Mirrors the production fields:
// description, part number, vendor, item type and location.
export function itemHaystack(item = {}) {
  return [item.description, item.sku, item.supplier, item.itemType, item.bin]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}

// Items matching a free-text query plus optional exact-match cell/vendor filters.
// An empty query or filter means "no constraint", so {} returns everything.
export function filterItems(items = [], { query = '', category = '', supplier = '' } = {}) {
  const q = String(query || '').trim().toLowerCase();
  return items.filter((item) => {
    if (q && !itemHaystack(item).includes(q)) return false;
    if (category && item.category !== category) return false;
    if (supplier && item.supplier !== supplier) return false;
    return true;
  });
}

// Sorted unique non-empty values of a field, for building a filter dropdown.
export function distinctValues(items = [], field) {
  return [...new Set(items.map((i) => i && i[field]).filter(Boolean))]
    .sort((a, b) => String(a).localeCompare(String(b)));
}

// Whether an item is at or below its minimum and should be flagged low.
// status is stored (the reorder flow owns it); this is the display-side check.
export function isLow(item = {}) {
  return item.status === 'reorder' || item.status === 'ordered';
}
