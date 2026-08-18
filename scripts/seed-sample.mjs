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
  '#7c3aed': { label: 'Raw material', subtypes: {} },
  '#be123c': { label: 'Safety', subtypes: {} },
};

const TYPES = {
  'End mill': { color: '#d97706' },
  'Drill': { color: '#f59e0b' },
  'Tap': { color: '#ea580c' },
  'Insert': { color: '#0ea5e9' },
  'Boring bar': { color: '#38bdf8' },
};

const LOCATIONS = ['TOOL CRIB', 'BAY 1', 'BAY 2', 'SHELF A', 'WELDING', 'STOCK RACK'];

// description, sku, supplier, itemType, category, bin, minStock, reorderQty,
// minUnit, reorderUnit, price, status
const ITEMS = [
  // Tools — numbered like a tool crib, so the Tools filter has something to find.
  ['T101 1/4" 4FL carbide end mill', 'EM-250-4F', 'Lakeshore Carbide', 'End mill', '#d97706', 'TOOL CRIB', 4, 10, 'ea', 'box of 10', 28.5, 'ok'],
  ['T102 1/2" 4FL carbide end mill', 'EM-500-4F', 'Lakeshore Carbide', 'End mill', '#d97706', 'TOOL CRIB', 3, 5, 'ea', 'box of 5', 54.0, 'ok'],
  ['T103 3/8" 3FL alu end mill', 'EM-375-3F', 'Lakeshore Carbide', 'End mill', '#d97706', 'TOOL CRIB', 2, 5, 'ea', 'box of 5', 41.25, 'reorder'],
  ['T110 #7 jobber drill', 'DR-7-JOB', 'Grainger', 'Drill', '#f59e0b', 'TOOL CRIB', 5, 10, 'ea', 'pack of 10', 6.4, 'ok'],
  ['T111 1/4-20 spiral tap', 'TAP-2520', 'Grainger', 'Tap', '#f59e0b', 'TOOL CRIB', 3, 6, 'ea', 'pack of 6', 12.9, 'ok'],
  ['T120 CNMG 432 insert', 'CNMG-432', 'MSC Direct', 'Insert', '#0ea5e9', 'BAY 1', 10, 10, 'ea', 'box of 10', 9.75, 'reorder'],
  ['T121 DCMT 32.51 insert', 'DCMT-3251', 'MSC Direct', 'Insert', '#0ea5e9', 'BAY 1', 10, 10, 'ea', 'box of 10', 11.2, 'ok'],
  ['T130 3/4" boring bar', 'BB-750', 'MSC Direct', 'Boring bar', '#38bdf8', 'BAY 2', 1, 1, 'ea', 'ea', 132.0, 'ok'],
  ['T140 1/8" ball nose', 'EM-125-BN', 'Lakeshore Carbide', 'End mill', '#d97706', 'TOOL CRIB', 4, 10, 'ea', 'box of 10', 22.0, 'ordered'],
  ['T141 90° spot drill', 'DR-SPOT-90', 'Grainger', 'Drill', '#f59e0b', 'TOOL CRIB', 2, 5, 'ea', 'pack of 5', 15.5, 'ok'],
  // Everything else — the "Other" side of the toggle.
  ['Way oil ISO 68', 'OIL-WAY-68', 'Grainger', '', '#4d7c0f', 'SHELF A', 2, 4, 'gal', 'case of 4', 34.0, 'ok'],
  ['Coolant concentrate', 'CLNT-5G', 'Grainger', '', '#4d7c0f', 'SHELF A', 1, 1, 'pail', 'pail', 118.0, 'reorder'],
  ['Blue shop towels', 'TWL-BLU', 'Uline', '', '#4d7c0f', 'SHELF A', 6, 12, 'roll', 'case of 12', 3.1, 'ok'],
  ['Nitrile gloves, L', 'GLV-NIT-L', 'Uline', '', '#be123c', 'SHELF A', 4, 10, 'box', 'case of 10', 8.75, 'ok'],
  ['Safety glasses, clear', 'PPE-GLS', 'Uline', '', '#be123c', 'SHELF A', 6, 12, 'ea', 'box of 12', 2.4, 'ok'],
  ['Ear plugs, corded', 'PPE-EAR', 'Uline', '', '#be123c', 'SHELF A', 10, 100, 'pair', 'box of 100', 0.35, 'ok'],
  ['6061-T6 plate 1/2" x 12" x 12"', 'AL-6061-500', 'Online Metals', '', '#7c3aed', 'STOCK RACK', 2, 2, 'ea', 'ea', 62.0, 'ok'],
  ['1018 CRS round 1" x 12ft', 'CRS-1018-100', 'Online Metals', '', '#7c3aed', 'STOCK RACK', 1, 1, 'bar', 'bar', 48.0, 'ok'],
  ['ER70S-6 MIG wire .035"', 'WLD-ER70-035', 'Airgas', '', '#4d7c0f', 'WELDING', 2, 4, 'spool', 'case of 4', 29.0, 'ok'],
  ['Argon/CO2 75/25 cylinder', 'GAS-C25', 'Airgas', '', '#4d7c0f', 'WELDING', 1, 1, 'cyl', 'cyl', 0, 'ok'],
];

const INSERT_COLS = ['sku', 'description', 'supplier', 'minStock', 'reorderQty', 'minUnit',
  'reorderUnit', 'price', 'bin', 'url', 'itemType', 'category', 'photo', 'physicalReorder',
  'status', 'createdAt'];

function rowFor(spec) {
  const [description, sku, supplier, itemType, category, bin, minStock, reorderQty,
    minUnit, reorderUnit, price, status] = spec;
  SAMPLE_SKUS.add(sku);
  return {
    sku, description, supplier, minStock, reorderQty, minUnit, reorderUnit, price,
    bin, url: '', itemType, category, photo: null,
    physicalReorder: bin === 'WELDING' ? 1 : 0,   // gas gets picked up, not shipped
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
  console.log('  10 are tool-crib items (T-numbered) and 10 are not, so the Tools / Other toggle has both sides.');
  console.log('  3 sit in the order queue and 1 is on order, so those screens are not empty.');
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
