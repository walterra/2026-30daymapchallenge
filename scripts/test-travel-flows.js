'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const {execFileSync} = require('node:child_process');
const dir = path.join(__dirname, '../maps/04-travel-clusters/data');
const read = name => fs.readFileSync(path.join(dir, name), 'utf8');
const data = JSON.parse(read('map-data.json'));
const layouts = JSON.parse(read('bubble-layouts.json'));
const flowsText = read('bundled-flows.json'), flows = JSON.parse(flowsText);
const hash = value => crypto.createHash('sha256').update(value).digest('hex');
const inFrame = c => c.lon >= -17.9 && c.lon <= 28.3 && c.lat >= 32 && c.lat <= 64.2;

test('flow artifact is current and reproducible', () => {
  assert.equal(flows.sourceSha256, hash(read('map-data.json')));
  assert.equal(flows.layoutSha256, hash(read('bubble-layouts.json')));
  assert.equal(flows.anchorsSha256, hash(read('country-anchors.json')));
  assert.equal(flows.generatorSha256, hash(fs.readFileSync(path.join(__dirname, 'prepare-travel-flows.js'))));
  execFileSync(process.execPath, [path.join(__dirname, 'prepare-travel-flows.js')]);
  assert.equal(read('bundled-flows.json'), flowsText);
});

test('every positive eligible country-city pair has exactly one edge', () => {
  assert.equal(Object.keys(flows.origins).length, layouts.markets.length);
  for (const market of layouts.markets) {
    const source = flows.origins[market];
    assert(source.geonamesId > 0);
    for (const mode of ['all', 'foreign']) {
      const expected = data.cities.flatMap((city, i) => inFrame(city) && city.nights[market] > 0 && (mode === 'all' || city.country !== source.country) ? [i] : []);
      assert.deepEqual(flows.layouts[mode][market].map(edge => edge.cityIndex), expected);
    }
  }
});

test('paths start at the representative source and end at true city anchors', () => {
  for (const mode of ['all', 'foreign']) for (const [market, edges] of Object.entries(flows.layouts[mode])) {
    edges.forEach(edge => {
      assert.deepEqual(edge.points[0], flows.origins[market].point);
      const end = edge.points.at(-1), anchor = layouts.anchors[edge.cityIndex];
      assert(end.every((value, i) => Math.abs(value - anchor[i]) < .0006));
      assert(edge.points.every(point => point.length === 2 && point.every(Number.isFinite)));
    });
  }
});

test('bundles share control points; off-frame sources have labelled edge entries', () => {
  const edges = flows.layouts.foreign.Netherlands;
  const hubs = edges.filter(e => e.points.length > 2).map(e => e.points[1].join(','));
  assert(new Set(hubs).size < hubs.length / 2);
  assert.equal(flows.origins.Netherlands.offMap, false);
  assert.equal(flows.origins['United States'].offMap, true);
  const [x, y] = flows.origins['United States'].point;
  assert(Math.min(Math.abs(x - 20), Math.abs(x - 980), Math.abs(y - 20), Math.abs(y - 830)) < .001);
});
