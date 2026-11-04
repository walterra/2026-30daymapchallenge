'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const context = vm.createContext({});
vm.runInContext(fs.readFileSync(path.join(__dirname, '../maps/03-ski-area-polygons/label-layout.js'), 'utf8'), context);
const { OccupancyBitmap: Bitmap, greedy, connected, consecutive, outwardCost } = context.SkiLabelLayout;
const rect = (left, top, right, bottom) => ({ left, top, right, bottom });

test('empty bitmap and half-open touching edges', () => {
  const bitmap = new Bitmap(96, 20);
  assert.equal(bitmap.rectangle(rect(0, 0, 96, 20)), false);
  bitmap.rectangle(rect(10, 4, 20, 8), true);
  assert.equal(bitmap.rectangle(rect(10, 4, 20, 8)), true);
  assert.equal(bitmap.rectangle(rect(20, 4, 25, 8)), false);
  assert.equal(bitmap.rectangle(rect(10, 8, 20, 9)), false);
});
test('31/32 and 63/64 word boundaries preserve neighboring bits', () => {
  const bitmap = new Bitmap(100, 4);
  bitmap.rectangle(rect(31, 1, 33, 2), true);
  bitmap.rectangle(rect(63, 1, 65, 2), true);
  for (const x of [31, 32, 63, 64]) assert.equal(bitmap.rectangle(rect(x, 1, x + 1, 2)), true);
  for (const x of [30, 33, 62, 65]) assert.equal(bitmap.rectangle(rect(x, 1, x + 1, 2)), false);
});
test('full 32-bit words and row padding', () => {
  const bitmap = new Bitmap(35, 3);
  bitmap.rectangle(rect(0, 1, 35, 2), true);
  assert.equal(bitmap.rectangle(rect(0, 0, 35, 1)), false);
  assert.equal(bitmap.rectangle(rect(0, 1, 35, 2)), true);
  assert.equal(bitmap.rectangle(rect(0, 2, 35, 3)), false);
});
test('fractional coordinates are conservatively rounded', () => {
  const bitmap = new Bitmap(40, 10);
  bitmap.rectangle(rect(10.8, 2.1, 12.1, 3.2), true);
  assert.equal(bitmap.rectangle(rect(10, 2, 11, 3)), true);
  assert.equal(bitmap.rectangle(rect(12, 3, 13, 4)), true);
});
test('out-of-bounds candidates are occupied', () => {
  const bitmap = new Bitmap(40, 10);
  assert.equal(bitmap.rectangle(rect(-1, 0, 2, 2)), true);
  assert.equal(bitmap.rectangle(rect(39, 9, 41, 11)), true);
});
test('all update rows are occupied, including one-pixel connector queries', () => {
  const bitmap = new Bitmap(40, 20);
  bitmap.rectangle(rect(5, 2, 15, 15), true);
  for (let y = 2; y < 15; y++) assert.equal(bitmap.rectangle(rect(7, y, 8, y + 1)), true);
});
test('alpha raster includes antialiased pixels', () => {
  const rgba = new Uint8ClampedArray(8 * 3 * 4);
  rgba[(1 * 8 + 4) * 4 + 3] = 1;
  const bitmap = new Bitmap(8, 3).fromAlpha(rgba);
  assert.equal(bitmap.rectangle(rect(4, 1, 5, 2)), true);
  assert.equal(bitmap.rectangle(rect(5, 1, 6, 2)), false);
});
test('clone is independent', () => {
  const original = new Bitmap(40, 10), clone = original.clone();
  clone.rectangle(rect(1, 1, 2, 2), true);
  assert.equal(original.rectangle(rect(1, 1, 2, 2)), false);
});
test('leader lookup detects a crossing and supports an endpoint exemption', () => {
  const bitmap = new Bitmap(40, 40);
  bitmap.line({ x: 5, y: 20 }, { x: 35, y: 20 }, 1, true);
  assert.equal(bitmap.line({ x: 20, y: 5 }, { x: 20, y: 35 }, 1), true);
  const endpoint = new Bitmap(40, 40); endpoint.rectangle(rect(4, 4, 7, 7), true);
  assert.equal(endpoint.line({ x: 5, y: 5 }, { x: 30, y: 5 }, .5, false, 5), false);
});
test('greedy placement follows priority, omits blocked labels, and reserves labels/leaders', () => {
  const base = new Bitmap(80, 60), empty = new Bitmap(80, 60);
  const candidate = { pixelRect: rect(30, 10, 45, 20), pixelAnchor: { x: 10, y: 15 }, pixelEnd: { x: 26, y: 15 } };
  const labels = [{ id: 'a', candidates: [candidate] }, { id: 'b', candidates: [candidate] }];
  assert.deepEqual(Array.from(greedy(base, empty, empty, labels, [0, 1]), p => p.id), ['a']);
  assert.deepEqual(Array.from(greedy(base, empty, empty, labels, [1, 0]), p => p.id), ['b']);
  base.rectangle(candidate.pixelRect, true);
  assert.equal(greedy(base, empty, empty, labels, [0, 1]).length, 0);
});

test('rollback restores overlapping rectangle and leader writes across word boundaries', () => {
  const bitmap = new Bitmap(100, 80);
  bitmap.rectangle(rect(30, 5, 34, 12), true);
  const original = bitmap.data.slice(), checkpoint = bitmap.checkpoint();
  bitmap.rectangle(rect(20, 8, 75, 30), true);
  bitmap.line({ x: 5, y: 5 }, { x: 90, y: 60 }, .6, true);
  bitmap.rollback(checkpoint);
  assert.deepEqual(bitmap.data, original);
});

test('outward preference follows the supplied center, with a finite distance tradeoff', () => {
  const centre = { x: 50, y: 50 }, east = { x: 80, y: 50 }, south = { x: 50, y: 80 };
  assert.ok(outwardCost(rect(100, 45, 110, 55), east, centre, 20) < outwardCost(rect(50, 45, 60, 55), east, centre, 20));
  assert.ok(outwardCost(rect(45, 100, 55, 110), south, centre, 20) < outwardCost(rect(45, 50, 55, 60), south, centre, 20));
  assert.ok(outwardCost(rect(50, 45, 60, 55), east, centre, 20) < outwardCost(rect(180, 45, 190, 55), east, centre, 100));
  assert.equal(outwardCost(rect(100, 45, 110, 55), east, centre, 20, 0), 400);
  assert.ok(Number.isFinite(outwardCost(rect(45, 45, 55, 55), centre, centre, 20)));
});

function option(box, anchor, end, cost = 1) {
  return { rect: box, pixelRect: box, anchor, pixelAnchor: anchor, end, pixelEnd: end, distance: Math.hypot(end.x - anchor.x, end.y - anchor.y), placementCost: cost, direction: 0 };
}
test('consecutive placement backtracks instead of accepting a leader through a later label', () => {
  const empty = new Bitmap(128, 128);
  const a1 = option(rect(70, 5, 90, 15), { x: 10, y: 10 }, { x: 68, y: 10 });
  const a2 = option(rect(70, 50, 90, 65), { x: 10, y: 10 }, { x: 68, y: 48 });
  const b1 = option(rect(40, 5, 50, 15), { x: 45, y: 30 }, { x: 45, y: 17 });
  const b2 = option(rect(55, 5, 65, 15), { x: 60, y: 30 }, { x: 60, y: 17 });
  const labels = [{ id: 0, candidates: [a1, a2] }, { id: 1, candidates: [b1, b2] }];
  const result = consecutive(empty, empty, labels, [0, 1], 1, { maxMs: 1000 });
  assert.equal(result.complete, true);
  assert.ok(result.backtracks > 0);
  assert.equal(result.placed.find(p => p.id === 0).rect.top, 50);
  assert.equal(connected(labels, empty, [0, 1], 1, 1000).length, 2);
});
test('crossing leaders are rejected, including crossings inside the attachment tolerance', () => {
  const empty = new Bitmap(128, 128);
  const a = option(rect(74, 66, 90, 82), { x: 20, y: 20 }, { x: 70, y: 70 });
  const b = option(rect(36, 1, 55, 8), { x: 10, y: 34 }, { x: 34, y: 10 });
  const labels = [{ id: 0, candidates: [a] }, { id: 1, candidates: [b] }];
  assert.equal(connected(labels, empty, [0, 1], 1, 1000).length, 0);
  assert.equal(consecutive(empty, empty, labels, [0, 1], 1, { maxMs: 1000 }).complete, false);
});
test('rasterized leaders reject subpixel-near parallel strokes, not only geometric intersections', () => {
  const empty = new Bitmap(128, 128);
  const a = option(rect(74, 26, 90, 34), { x: 10, y: 30 }, { x: 70, y: 30 });
  const b = option(rect(74, 38, 90, 46), { x: 10, y: 31 }, { x: 70, y: 31 });
  assert.equal(connected([{ id: 0, candidates: [a] }, { id: 1, candidates: [b] }], empty, [0, 1], 1, 1000).length, 0);
});
