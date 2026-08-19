import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

// buildLabel.js has to stay loadable by a <script> tag in the browser, so it
// exports through a guarded `module.exports` that this ESM project can't
// require. Running it in a VM context gives us the same handle without asking
// the browser file to change shape for the sake of a test.
function loadBuildLabel() {
  const module = { exports: {} };
  const context = {
    module,
    exports: module.exports,
    console,
    // Globals the browser would have provided.
    localStorage: { getItem: () => null },
    settings: { shopName: 'YOUR SHOP' },
    cats: {},
    esc: (s) => String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'),
  };
  vm.createContext(context);
  vm.runInContext(readFileSync(join(root, 'public/buildLabel.js'), 'utf8'), context);
  return module.exports;
}

const { buildLabel, pickupWrap } = loadBuildLabel();

const item = {
  id: 42, description: 'T12 - 1/2in Carbide End Mill', sku: '97036A040',
  supplier: 'McMaster-Carr', bin: 'A-14', minStock: 6, reorderQty: 12,
  category: null, photo: null,
};
const QR = 'data:image/png;base64,AAAA';

test('the pickup flag goes into the card root, not a wrapper around it', () => {
  const label = buildLabel(item, QR, 'md');
  assert.equal(pickupWrap({ ...item, physicalReorder: 0 }, label), label);
  assert.equal(pickupWrap(item, label), label);

  const wrapped = pickupWrap({ ...item, physicalReorder: 1 }, label);
  assert.match(wrapped, /PICKUP/);
  assert.match(wrapped, /position:absolute/);
  assert.match(wrapped, /width:288px;height:192px/);   // card size untouched
  assert.match(wrapped, /Carbide End Mill/);           // card content untouched

  // The regression this guards: wrapping the card in another element shifted
  // the layout, and the wrapper's line-height:0 collapsed the header and vendor
  // text. Injecting into the card's own root keeps a single root element.
  assert.doesNotMatch(wrapped, /display:inline-block/);
  assert.doesNotMatch(wrapped, /line-height:0/);
  assert.match(wrapped, /^\s*<div style="position:relative;width:288px/);
});

test('the flag still lands in the root when that root carries a class', () => {
  const wrapped = pickupWrap({ ...item, physicalReorder: 1 }, buildLabel(item, QR, 'sm'));
  assert.match(wrapped, /class="label-sm-print" style="position:relative;width:168px/);
  assert.match(wrapped, /PICKUP/);
});

test('every label size renders at its documented pixel dimensions', () => {
  const dims = { xs: [144, 96], sm: [168, 72], md: [288, 192], lg: [384, 288], full: [288, 480], ship: [384, 576] };
  for (const [size, [w, h]] of Object.entries(dims)) {
    assert.match(buildLabel(item, QR, size), new RegExp(`width:${w}px;height:${h}px`), `${size} should render ${w}x${h}`);
  }
});

test('the 4x6 shipping label stays black-and-white', () => {
  const html = buildLabel({ ...item, category: '#1a4fa8' }, QR, 'ship');
  assert.match(html, /background:#fff;color:#000/);
  assert.doesNotMatch(html, /#1a4fa8/, 'category colour must not leak into a B&W label');
  assert.match(html, /SCAN TO REORDER/);
});

test('item text is escaped, so a description cannot inject markup into a label', () => {
  const html = buildLabel({ ...item, description: '<img src=x onerror=alert(1)>', sku: '"><script>' }, QR, 'full');
  assert.doesNotMatch(html, /<img src=x onerror/, 'raw markup must not survive');
  assert.match(html, /&lt;img src=x onerror/, 'markup should appear escaped');
  assert.doesNotMatch(html, /"><script>/);
});

test('the QR image is embedded in the label', () => {
  assert.match(buildLabel(item, QR, 'md'), /data:image\/png;base64,AAAA/);
});
