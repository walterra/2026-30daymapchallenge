'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const {prepare} = require('./prepare-travel-layouts.js');
const root = path.join(__dirname, '..');
const directory = path.join(root, 'maps/04-travel-clusters');
const source = fs.readFileSync(path.join(directory, 'data/map-data.json'), 'utf8');
const data = JSON.parse(source);
const savedText = fs.readFileSync(path.join(directory, 'data/bubble-layouts.json'), 'utf8');
const saved = JSON.parse(savedText);
const hash = value => crypto.createHash('sha256').update(value).digest('hex');

test('saved layouts match current data and generator', () => {
  assert.equal(saved.sourceSha256, hash(source));
  assert.equal(saved.generatorSha256, hash(fs.readFileSync(path.join(__dirname, 'prepare-travel-layouts.js'))));
});

test('offline preparation reproduces the committed coordinates exactly', () => {
  assert.equal(JSON.stringify(prepare(source)) + '\n', savedText);
});

test('stable country-destination keys and mode coverage', () => {
  assert.equal(saved.nodes.length, 5321);
  assert.equal(new Set(saved.nodes.map(n => `${n.cityIndex}:${n.marketIndex}`)).size, 5321);
  assert.equal(saved.layouts.all.filter(Boolean).length, 5205);
  assert.equal(saved.layouts.foreign.filter(Boolean).length, 5060);
  saved.nodes.forEach((node, i) => {
    const city = data.cities[node.cityIndex];
    const market = saved.markets[node.marketIndex];
    assert.equal(typeof city.nights[market], 'number');
    const b = saved.config.bounds;
    const inFrame = city.lon >= b[0][0] && city.lon <= b[1][0] && city.lat >= b[0][1] && city.lat <= b[1][1];
    for (const mode of ['all', 'foreign']) {
      const position = saved.layouts[mode][i];
      assert.equal(position !== null, inFrame && (mode === 'all' || !node.domestic));
      if (position) {
        assert(position.every(Number.isFinite));
        assert(position[0] >= node.r && position[0] <= saved.config.width - node.r);
        assert(position[1] >= node.r && position[1] <= saved.config.height - node.r);
      }
    }
  });
});

test('browser renderer contains no force simulation or resize-driven layout', () => {
  const script = fs.readFileSync(path.join(directory, 'map.js'), 'utf8');
  assert(!/d3\.force|requestAnimationFrame|ResizeObserver/.test(script));
  assert(script.includes("json('data/bubble-layouts.json')"));
});
