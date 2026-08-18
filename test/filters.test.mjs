import test from 'node:test';
import assert from 'node:assert/strict';
import { filterItems, itemHaystack, distinctValues, isLow } from '../public/filters.mjs';

const items = [
  { id: 1, description: 'Carbide endmill 1/4', sku: 'EM-250', supplier: 'Lakeshore', itemType: 'Endmill', bin: 'Tool crib', category: '#ff0000', status: 'ok' },
  { id: 2, description: 'Argon bottle', sku: 'GAS-AR', supplier: 'Airgas', itemType: 'Gas', bin: 'Welding', category: '#00ff00', status: 'reorder' },
  { id: 3, description: 'Blue shop towels', sku: 'TWL-1', supplier: 'Lakeshore', itemType: '', bin: 'Shelf B', category: '#ff0000', status: 'ordered' },
];
const ids = (list) => list.map((i) => i.id);

test('an empty filter returns every item, and the sizes below it hold', () => {
  assert.deepEqual(ids(filterItems([], {})), []);                    // 0
  assert.deepEqual(ids(filterItems([items[0]], {})), [1]);           // 1
  assert.deepEqual(ids(filterItems(items.slice(0, 2), {})), [1, 2]); // 2
  assert.deepEqual(ids(filterItems(items, {})), [1, 2, 3]);          // N
  assert.deepEqual(ids(filterItems(items)), [1, 2, 3]);              // no options at all
});

test('search matches description, part number, vendor, type and location', () => {
  assert.deepEqual(ids(filterItems(items, { query: 'endmill' })), [1]);    // description
  assert.deepEqual(ids(filterItems(items, { query: 'GAS-AR' })), [2]);     // part number
  assert.deepEqual(ids(filterItems(items, { query: 'lakeshore' })), [1, 3]); // vendor
  assert.deepEqual(ids(filterItems(items, { query: 'welding' })), [2]);    // location
  assert.deepEqual(ids(filterItems(items, { query: 'nothing here' })), []);
});

test('search ignores case and surrounding whitespace', () => {
  assert.deepEqual(ids(filterItems(items, { query: '  ARGON  ' })), [2]);
  assert.deepEqual(ids(filterItems(items, { query: '' })), [1, 2, 3]);
  assert.deepEqual(ids(filterItems(items, { query: '   ' })), [1, 2, 3]);
});

test('cell and vendor filters combine with search rather than replacing it', () => {
  assert.deepEqual(ids(filterItems(items, { category: '#ff0000' })), [1, 3]);
  assert.deepEqual(ids(filterItems(items, { supplier: 'Lakeshore' })), [1, 3]);
  // both filters at once
  assert.deepEqual(ids(filterItems(items, { category: '#ff0000', supplier: 'Lakeshore' })), [1, 3]);
  // filter plus a query that narrows it further
  assert.deepEqual(ids(filterItems(items, { category: '#ff0000', query: 'towels' })), [3]);
  // a filter that excludes everything the query found
  assert.deepEqual(ids(filterItems(items, { category: '#00ff00', query: 'towels' })), []);
});

test('the haystack skips missing fields instead of printing undefined', () => {
  assert.equal(itemHaystack({ description: 'Only this' }), 'only this');
  assert.equal(itemHaystack({}), '');
  assert.equal(itemHaystack(), '');
  assert.equal(itemHaystack(items[2]), 'blue shop towels twl-1 lakeshore shelf b');
});

test('distinctValues is unique, sorted, and drops blanks', () => {
  assert.deepEqual(distinctValues(items, 'supplier'), ['Airgas', 'Lakeshore']);
  assert.deepEqual(distinctValues(items, 'itemType'), ['Endmill', 'Gas']);  // '' dropped
  assert.deepEqual(distinctValues([], 'supplier'), []);
  assert.deepEqual(distinctValues([{}, { supplier: '' }], 'supplier'), []);
});

test('isLow flags items the reorder flow has marked', () => {
  assert.equal(isLow({ status: 'ok' }), false);
  assert.equal(isLow({ status: 'reorder' }), true);
  assert.equal(isLow({ status: 'ordered' }), true);
  assert.equal(isLow({}), false);
});
