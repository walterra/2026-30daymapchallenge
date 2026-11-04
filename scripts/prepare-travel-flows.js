#!/usr/bin/env node
/* Offline geographic hierarchy bundling; no third-party bundling plugin. */
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const d3 = require('../assets/vendor/d3/d3.v4.13.0.min.js');
const directory = path.join(__dirname, '../maps/04-travel-clusters/data');
const read = name => fs.readFileSync(path.join(directory, name), 'utf8');
const dataText = read('map-data.json'), layoutText = read('bubble-layouts.json'), anchorText = read('country-anchors.json');
const data = JSON.parse(dataText), saved = JSON.parse(layoutText), capitals = JSON.parse(anchorText);
const projection = d3.geoAzimuthalEqualArea().rotate(saved.projection.rotate).scale(saved.projection.scale).translate(saved.projection.translate);
const names = new Intl.DisplayNames(['en'], {type: 'region'});
const marketCodes = Object.fromEntries(Object.keys(capitals).map(code => [names.of(code), code]));
Object.assign(marketCodes, {'Ireland Rep': 'IE', 'Turkiye': 'TR', 'Czechia': 'CZ', 'Bosnia and Herzegovina': 'BA'});
const round = n => Math.round(n * 1000) / 1000;
const inside = point => {
  const b = saved.config.bounds;
  return point.lon >= b[0][0] && point.lon <= b[1][0] && point.lat >= b[0][1] && point.lat <= b[1][1];
};

function bundle(origin, destinations) {
  const result = [];
  function branch(members, previous, route, depth) {
    if (members.length === 1) {
      result.push({cityIndex: members[0].cityIndex, points: [...route, members[0].point].map(p => p.map(round))});
      return;
    }
    const centroid = [d3.mean(members, d => d.point[0]), d3.mean(members, d => d.point[1])];
    const hub = [previous[0] * .25 + centroid[0] * .75, previous[1] * .25 + centroid[1] * .75];
    const nextRoute = [...route, hub];
    if (members.length <= 4 || depth >= 4) {
      members.forEach(member => result.push({cityIndex: member.cityIndex, points: [...nextRoute, member.point].map(p => p.map(round))}));
      return;
    }
    const axis = d3.max(members, m => m.point[0]) - d3.min(members, m => m.point[0]) >= d3.max(members, m => m.point[1]) - d3.min(members, m => m.point[1]) ? 0 : 1;
    const sorted = members.slice().sort((a, b) => a.point[axis] - b.point[axis] || a.cityIndex - b.cityIndex);
    const middle = Math.floor(sorted.length / 2);
    branch(sorted.slice(0, middle), hub, nextRoute, depth + 1);
    branch(sorted.slice(middle), hub, nextRoute, depth + 1);
  }
  // Opposite directions must not share a branch. Split into 45-degree sectors,
  // then recursively split spatial groups along their longest projected axis.
  const sectors = Array.from({length: 8}, () => []);
  destinations.forEach(d => {
    const angle = (Math.atan2(d.point[1] - origin[1], d.point[0] - origin[0]) + 2 * Math.PI) % (2 * Math.PI);
    sectors[Math.min(7, Math.floor(angle / (Math.PI / 4)))].push(d);
  });
  sectors.filter(s => s.length).forEach(s => branch(s, origin, [origin], 0));
  return result.sort((a, b) => a.cityIndex - b.cityIndex);
}

const origins = {}, layouts = {all: {}, foreign: {}};
for (const market of saved.markets) {
  const country = marketCodes[market], representative = capitals[country];
  if (!representative) throw Error(`Missing representative point for ${market}`);
  const projected = projection([representative.lon, representative.lat]);
  const offMap = projected[0] < 0 || projected[0] > saved.config.width || projected[1] < 0 || projected[1] > saved.config.height;
  let labelPoint = projected;
  if (offMap) {
    // Only the label moves to an inset viewport edge; source geometry stays at
    // the true projected coordinate, even far outside the viewport.
    const center = [saved.config.width / 2, saved.config.height / 2];
    const dx = projected[0] - center[0], dy = projected[1] - center[1];
    const factor = Math.min((center[0] - 20) / Math.max(Math.abs(dx), 1e-9), (center[1] - 20) / Math.max(Math.abs(dy), 1e-9));
    labelPoint = [center[0] + dx * factor, center[1] + dy * factor];
  }
  origins[market] = {...representative, point: projected.map(round), projectedPoint: projected.map(round), labelPoint: labelPoint.map(round), offMap};
  for (const mode of ['all', 'foreign']) {
    const destinations = data.cities.flatMap((city, cityIndex) => {
      const value = city.nights[market];
      return inside(city) && value > 0 && (mode === 'all' || city.country !== country)
        ? [{cityIndex, point: saved.anchors[cityIndex]}] : [];
    });
    layouts[mode][market] = bundle(origins[market].point, destinations);
  }
}
const hash = value => crypto.createHash('sha256').update(value).digest('hex');
const output = {version: 2, beta: .82, sourceSha256: hash(dataText), layoutSha256: hash(layoutText), anchorsSha256: hash(anchorText),
  generatorSha256: hash(fs.readFileSync(__filename)), origins, layouts};
fs.writeFileSync(path.join(directory, 'bundled-flows.json'), JSON.stringify(output) + '\n');
console.log(`Saved geographic bundles for ${Object.keys(origins).length} source countries, both filter modes`);
