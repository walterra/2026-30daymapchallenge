#!/usr/bin/env node
/* Offline-only D3 force preparation. No package installation required. */
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const d3 = require('../assets/vendor/d3/d3.v4.13.0.min.js');
const directory = path.join(__dirname, '../maps/04-travel-clusters/data');
const CONFIG = { width: 1000, height: 850, padding: 30,
  bounds: [[-17.9, 32], [28.3, 64.2]], rotate: [-10, -49],
  ticks: 320, attraction: .14, collisionPadding: .35, collisionIterations: 2,
  minimumRadius: .65, maximumRadius: 15 };
const aggregates = new Set(['Europe', 'America', 'Asia', 'Africa', 'Oceania', 'Total foreign', 'Total domestic', 'Total foreign and domestic']);
const round = n => Math.round(n * 10000) / 10000;

function prepare(source) {
  const data = JSON.parse(source);
  const c = CONFIG;
  const inFrame = city => city.lon >= c.bounds[0][0] && city.lon <= c.bounds[1][0] && city.lat >= c.bounds[0][1] && city.lat <= c.bounds[1][1];
  const framePoints = [];
  for (let i = 0; i <= 100; i++) {
    const lon = c.bounds[0][0] + (c.bounds[1][0] - c.bounds[0][0]) * i / 100;
    const lat = c.bounds[0][1] + (c.bounds[1][1] - c.bounds[0][1]) * i / 100;
    framePoints.push([lon, c.bounds[0][1]], [lon, c.bounds[1][1]], [c.bounds[0][0], lat], [c.bounds[1][0], lat]);
  }
  const projection = d3.geoAzimuthalEqualArea().rotate(c.rotate).fitExtent([[c.padding, c.padding], [c.width - c.padding, c.height - c.padding]], {type: 'MultiPoint', coordinates: framePoints});
  const markets = Array.from(new Set(data.cities.flatMap(city => Object.keys(city.nights)))).filter(m => !aggregates.has(m) && !m.startsWith('Other ')).sort();
  const names = new Intl.DisplayNames(['en'], {type: 'region'});
  const marketCountries = Object.fromEntries(Array.from(new Set(data.cities.map(city => city.country))).map(code => [names.of(code), code]));
  Object.assign(marketCountries, {'Ireland Rep': 'IE', 'Turkiye': 'TR', 'Czechia': 'CZ'});
  const anchors = data.cities.map(city => projection([city.lon, city.lat]).map(round));
  const nodes = [];
  data.cities.forEach((city, cityIndex) => markets.forEach((market, marketIndex) => {
    const value = city.nights[market];
    if (value === null || value === undefined) return;
    const [ax, ay] = anchors[cityIndex];
    const angle = marketIndex * Math.PI * (3 - Math.sqrt(5));
    const radius = Math.sqrt(marketIndex) * 1.5;
    nodes.push({cityIndex, marketIndex, value, domestic: marketCountries[market] === city.country,
      inFrame: inFrame(city), ax, ay, seedX: ax + Math.cos(angle) * radius, seedY: ay + Math.sin(angle) * radius});
  }));
  const maxValue = d3.max(nodes, n => n.value);
  nodes.forEach(n => { n.r = round(Math.max(c.minimumRadius, c.maximumRadius * Math.sqrt(n.value / maxValue))); });
  const layouts = {};
  for (const mode of ['all', 'foreign']) {
    const active = nodes.filter(n => n.inFrame && (mode === 'all' || !n.domestic)).map(n => ({...n, x: n.seedX, y: n.seedY, vx: 0, vy: 0}));
    const simulation = d3.forceSimulation(active).stop()
      .force('x', d3.forceX(n => n.ax).strength(c.attraction))
      .force('y', d3.forceY(n => n.ay).strength(c.attraction))
      .force('collide', d3.forceCollide(n => n.r + c.collisionPadding).strength(1).iterations(c.collisionIterations));
    for (let tick = 0; tick < c.ticks; tick++) {
      simulation.tick();
      active.forEach(n => {
        n.x = Math.max(n.r + 2, Math.min(c.width - 2 - n.r, n.x));
        n.y = Math.max(n.r + 2, Math.min(c.height - 2 - n.r, n.y));
      });
    }
    const positions = new Map(active.map(n => [`${n.cityIndex}:${n.marketIndex}`, [round(n.x), round(n.y)]]));
    layouts[mode] = nodes.map(n => positions.get(`${n.cityIndex}:${n.marketIndex}`) || null);
  }
  return {version: 1, sourceSha256: crypto.createHash('sha256').update(source).digest('hex'),
    generatorSha256: crypto.createHash('sha256').update(fs.readFileSync(__filename)).digest('hex'),
    config: c, projection: {rotate: c.rotate, scale: projection.scale(), translate: projection.translate()},
    markets, marketCountries, anchors, maxValue,
    // Stable compound keys are city/market indices, never simulation array indices.
    nodes: nodes.map(n => ({cityIndex: n.cityIndex, marketIndex: n.marketIndex, r: n.r, domestic: n.domestic})), layouts};
}

if (require.main === module) {
  const source = fs.readFileSync(path.join(directory, 'map-data.json'), 'utf8');
  const output = prepare(source);
  fs.writeFileSync(path.join(directory, 'bubble-layouts.json'), JSON.stringify(output) + '\n');
  console.log(`Saved layouts: ${output.layouts.all.filter(Boolean).length} all pairs; ${output.layouts.foreign.filter(Boolean).length} foreign pairs`);
}
module.exports = {prepare};
