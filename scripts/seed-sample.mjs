// Sample inventory, so a new shop can see what the app does before typing in
// anything real. Entirely optional and clearly fake:
//
//   npm run seed:sample     add the sample data
//   npm run seed:sample -- --clear   remove it again
//
// Everything it creates is tagged in the notes below so `--clear` can take it
// back out without touching anything you have added yourself. It refuses to run
// against a database that already holds items it did not create, so nobody
// seeds demo parts on top of a real crib.
import { createSqliteDb } from '../src/db/sqlite.mjs';
import { loadConfig } from '../src/config.mjs';

const SAMPLE_SKUS = new Set();

// Cells. The two with subtypes are "tool crib" cells — the app treats items in
// them as tools, which is what drives the Tools / Other toggle.
const CELLS = {
  '#b45309': { label: 'Tool crib', subtypes: { '#d97706': 'Carbide', '#f59e0b': 'HSS' } },
  '#0369a1': { label: 'Inserts & holders', subtypes: { '#0ea5e9': 'Turning', '#38bdf8': 'Milling' } },
  '#4d7c0f': { label: 'Consumables', subtypes: {} },
};

const TYPES = {
  'End mill': { color: '#d97706' },
  'Drill': { color: '#f59e0b' },
  'Insert': { color: '#0ea5e9' },
};

const LOCATIONS = ['TOOL CRIB', 'BAY 1', 'SHELF A'];

// Five items, every one labelled SAMPLE in both the description and the part
// number so nobody mistakes them for real stock. Three are tool-crib items and
// two are not, which gives the Tools / Other toggle both sides; one sits in the
// order queue and one is on order, so neither of those screens reads empty.
//
// description, sku, supplier, itemType, category, bin, minStock, reorderQty,
// minUnit, reorderUnit, price, status
const ITEMS = [
  ['SAMPLE — T101 1/4" 4FL carbide end mill', 'SAMPLE-EM-250', 'Lakeshore Carbide', 'End mill', '#d97706', 'TOOL CRIB', 4, 10, 'ea', 'box of 10', 28.5, 'ok'],
  ['SAMPLE — T110 #7 jobber drill', 'SAMPLE-DR-7', 'Grainger', 'Drill', '#f59e0b', 'TOOL CRIB', 5, 10, 'ea', 'pack of 10', 6.4, 'reorder'],
  ['SAMPLE — T120 CNMG 432 insert', 'SAMPLE-CNMG-432', 'MSC Direct', 'Insert', '#0ea5e9', 'BAY 1', 10, 10, 'ea', 'box of 10', 9.75, 'ordered'],
  ['SAMPLE — Way oil ISO 68', 'SAMPLE-OIL-68', 'Grainger', '', '#4d7c0f', 'SHELF A', 2, 4, 'gal', 'case of 4', 34.0, 'ok'],
  ['SAMPLE — Blue shop towels', 'SAMPLE-TWL', 'Uline', '', '#4d7c0f', 'SHELF A', 6, 12, 'roll', 'case of 12', 3.1, 'ok'],
];

// Card images. Drawn here as inline SVG rather than linked from anywhere, so
// they work on a shop PC with no internet, add no third-party requests, and
// print cleanly at any card size. Each carries its own light tile so it reads
// on a dark screen and on white card stock alike.
const SHAPES = {
  'SAMPLE-EM-250': // end mill: shank above a fluted cutting length
    '<rect x="26" y="8" width="12" height="20" rx="1.5" fill="#9ca3af"/>' +
    '<rect x="24" y="27" width="16" height="30" rx="2" fill="#4b5563"/>' +
    '<path d="M26 31l12 6M26 39l12 6M26 47l12 6" stroke="#e5e7eb" stroke-width="2.5" stroke-linecap="round"/>',
  'SAMPLE-DR-7': // twist drill: shank, spiral flutes, 118-degree point
    '<rect x="27" y="8" width="10" height="16" rx="1.5" fill="#9ca3af"/>' +
    '<rect x="26" y="23" width="12" height="26" rx="1.5" fill="#4b5563"/>' +
    '<path d="M27 27l10 7M27 35l10 7M27 43l10 7" stroke="#e5e7eb" stroke-width="2.5" stroke-linecap="round"/>' +
    '<path d="M26 49l6 8 6-8z" fill="#4b5563"/>',
  'SAMPLE-CNMG-432': // turning insert: rhombus with a clamp hole
    '<path d="M32 14l20 18-20 18-20-18z" fill="#4b5563"/>' +
    '<circle cx="32" cy="32" r="6" fill="#e5e7eb"/>',
  'SAMPLE-OIL-68': // oil jug with a handle and a label
    '<path d="M22 24h20a4 4 0 014 4v24a4 4 0 01-4 4H22a4 4 0 01-4-4V28a4 4 0 014-4z" fill="#4b5563"/>' +
    '<rect x="28" y="12" width="8" height="12" rx="1.5" fill="#9ca3af"/>' +
    '<rect x="23" y="34" width="18" height="12" rx="1.5" fill="#e5e7eb"/>' +
    '<path d="M46 32h4a4 4 0 010 8h-4" fill="none" stroke="#4b5563" stroke-width="3"/>',
  'SAMPLE-TWL': // towel roll seen end-on
    '<rect x="16" y="18" width="32" height="30" rx="4" fill="#4b5563"/>' +
    '<ellipse cx="32" cy="18" rx="16" ry="5" fill="#9ca3af"/>' +
    '<ellipse cx="32" cy="18" rx="5" ry="2" fill="#e5e7eb"/>' +
    '<path d="M48 34c6 0 8 4 8 8" fill="none" stroke="#9ca3af" stroke-width="3"/>',
};

// Wrap a shape in its tile and encode it for an <img src>.
function cardImage(sku) {
  const shape = SHAPES[sku];
  if (!shape) return null;
  const svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="64" height="64">' +
    '<rect width="64" height="64" rx="8" fill="#e5e7eb"/>' + shape + '</svg>';
  return 'data:image/svg+xml,' + encodeURIComponent(svg);
}

const INSERT_COLS = ['sku', 'description', 'supplier', 'minStock', 'reorderQty', 'minUnit',
  'reorderUnit', 'price', 'bin', 'url', 'itemType', 'category', 'photo', 'physicalReorder',
  'status', 'createdAt'];

function rowFor(spec) {
  const [description, sku, supplier, itemType, category, bin, minStock, reorderQty,
    minUnit, reorderUnit, price, status] = spec;
  SAMPLE_SKUS.add(sku);
  return {
    sku, description, supplier, minStock, reorderQty, minUnit, reorderUnit, price,
    bin, url: '', itemType, category, photo: cardImage(sku),
    physicalReorder: 0,
    status, createdAt: new Date().toISOString(),
  };
}

async function clear(db) {
  const skus = ITEMS.map((i) => i[1]);
  const marks = skus.map(() => '?').join(',');
  const doomed = await db.all(`SELECT id FROM items WHERE sku IN (${marks})`, skus);
  for (const { id } of doomed) {
    await db.run('DELETE FROM cart WHERE itemId = ?', [id]);
    await db.run('DELETE FROM orders WHERE itemId = ?', [id]);
    await db.run('DELETE FROM items WHERE id = ?', [id]);
  }
  console.log(`  Removed ${doomed.length} sample item${doomed.length === 1 ? '' : 's'}.`);
  console.log('  Cells, item types and locations were left alone — you may have edited them.');
}

async function seed(db) {
  const skus = ITEMS.map((i) => i[1]);
  const marks = skus.map(() => '?').join(',');
  const existingTotal = (await db.get('SELECT COUNT(*) AS n FROM items')).n;
  const existingSample = (await db.get(`SELECT COUNT(*) AS n FROM items WHERE sku IN (${marks})`, skus)).n;

  if (existingTotal > existingSample) {
    console.error('\n  This database already has items that are not sample data.');
    console.error('  Refusing to seed on top of a real inventory.\n');
    process.exit(1);
  }
  if (existingSample > 0) {
    console.log('  Sample data is already here — clearing it first so this stays repeatable.');
    await clear(db);
  }

  for (const [color, cell] of Object.entries(CELLS)) {
    await db.run('INSERT OR REPLACE INTO categories (color, label, subtypes) VALUES (?,?,?)',
      [color, cell.label, JSON.stringify(cell.subtypes)]);
  }
  for (const [name, t] of Object.entries(TYPES)) {
    await db.run('INSERT OR REPLACE INTO itemTypes (name, color) VALUES (?,?)', [name, t.color]);
  }
  for (const name of LOCATIONS) {
    await db.run('INSERT OR IGNORE INTO locations (name) VALUES (?)', [name]);
  }

  const ids = {};
  for (const spec of ITEMS) {
    const row = rowFor(spec);
    const res = await db.run(
      `INSERT INTO items (${INSERT_COLS.join(',')}) VALUES (${INSERT_COLS.map(() => '?').join(',')})`,
      INSERT_COLS.map((c) => row[c]));
    ids[row.sku] = res.lastInsertRowid;
  }

  // Put the flagged items where their status says they are, so the Order Queue
  // and Receiving screens have something in them rather than reading empty.
  const now = new Date().toISOString();
  for (const spec of ITEMS) {
    const [, sku, supplier, , , , , reorderQty, , , , status] = spec;
    if (status === 'reorder') {
      await db.run('INSERT OR IGNORE INTO cart (itemId, addedAt, addedBy) VALUES (?,?,?)',
        [ids[sku], now, 'sample data']);
    }
    if (status === 'ordered') {
      await db.run('INSERT OR IGNORE INTO orders (itemId, orderedAt, reorderQty, vendor) VALUES (?,?,?,?)',
        [ids[sku], now, reorderQty, supplier]);
    }
  }

  console.log(`\n  Added ${ITEMS.length} sample items across ${Object.keys(CELLS).length} cells.`);
  console.log('  Every one is labelled SAMPLE, in the description and the part number.');
  console.log('  3 are tool-crib items and 2 are not, so the Tools / Other toggle has both sides.');
  console.log('  1 sits in the order queue and 1 is on order, so those screens are not empty.');
  console.log('  Each has a drawn card image, embedded rather than linked, so it works offline.');
  console.log('\n  Remove it all again with:  npm run seed:sample -- --clear\n');
}

const config = loadConfig();
const db = createSqliteDb(config.dbPath);
if (process.argv.includes('--clear')) {
  console.log('\n  Clearing sample data…');
  await clear(db);
  console.log('');
} else {
  await seed(db);
}
