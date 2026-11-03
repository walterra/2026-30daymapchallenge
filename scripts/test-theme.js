'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname, '../assets/theme.js'), 'utf8');

function fixture({ stored = null, dark = false, blocked = false } = {}) {
  const events = {}, mediaEvents = {}, windowEvents = {}, clicks = {};
  let ready = false;
  const button = { hidden: true, attributes: {}, setAttribute(k, v) { this.attributes[k] = v; }, addEventListener(k, fn) { clicks[k] = fn; } };
  const document = { documentElement: { dataset: {} }, querySelectorAll: () => ready ? [button] : [], addEventListener(k, fn) { events[k] = fn; } };
  const media = { matches: dark, addEventListener(k, fn) { mediaEvents[k] = fn; } };
  const writes = [];
  const localStorage = { getItem() { if (blocked) throw Error('Storage disabled'); return stored; }, setItem(k, v) { if (blocked) throw Error('Storage disabled'); writes.push([k, v]); } };
  const window = { matchMedia: () => media, addEventListener(k, fn) { windowEvents[k] = fn; } };
  vm.runInNewContext(source, { window, document, localStorage });
  return { document, media, button, writes, load() { ready = true; events.DOMContentLoaded(); }, click() { clicks.click(); }, system(value) { media.matches = value; mediaEvents.change(); }, storage(value) { windowEvents.storage({ key: 'map-challenge-theme', newValue: value }); } };
}

test('sets system light preference before DOMContentLoaded', () => {
  assert.equal(fixture().document.documentElement.dataset.theme, 'light');
});
test('sets system dark preference before DOMContentLoaded', () => {
  assert.equal(fixture({ dark: true }).document.documentElement.dataset.theme, 'dark');
});
test('saved light preference overrides a dark system', () => {
  assert.equal(fixture({ stored: 'light', dark: true }).document.documentElement.dataset.theme, 'light');
});
test('invalid storage values fall back to system preference', () => {
  assert.equal(fixture({ stored: 'invalid', dark: true }).document.documentElement.dataset.theme, 'dark');
});
test('toggle is accessible and persists a manual preference', () => {
  const f = fixture(); f.load();
  assert.equal(f.button.hidden, false);
  assert.equal(f.button.attributes['aria-pressed'], 'false');
  f.click();
  assert.equal(f.document.documentElement.dataset.theme, 'dark');
  assert.equal(f.button.attributes['aria-pressed'], 'true');
  assert.deepEqual(f.writes, [['map-challenge-theme', 'dark']]);
  f.system(false);
  assert.equal(f.document.documentElement.dataset.theme, 'dark');
});
test('blocked storage does not break initialization or toggling', () => {
  const f = fixture({ blocked: true }); f.load(); f.click();
  assert.equal(f.document.documentElement.dataset.theme, 'dark');
});
test('system changes apply when there is no manual preference', () => {
  const f = fixture(); f.load(); f.system(true);
  assert.equal(f.document.documentElement.dataset.theme, 'dark');
  assert.equal(f.button.attributes['aria-pressed'], 'true');
});
test('storage changes sync themes and clearing restores system mode', () => {
  const f = fixture(); f.load(); f.storage('dark');
  assert.equal(f.document.documentElement.dataset.theme, 'dark');
  f.storage(null);
  assert.equal(f.document.documentElement.dataset.theme, 'light');
});
