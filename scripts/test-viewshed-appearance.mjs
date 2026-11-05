// node --test scripts/test-viewshed-appearance.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {appearance, rgb} from '../maps/05-viewshed-01-taubensee/appearance.mjs';

function luminance(channels) {
  const linear = channels.map(c => c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  return linear[0] * 0.2126 + linear[1] * 0.7152 + linear[2] * 0.0722;
}
function contrast(a, b) {
  const [lo, hi] = [luminance(a), luminance(b)].sort((a,b) => a-b);
  return (hi + 0.05) / (lo + 0.05);
}

test('context ink and its halo exceed 7:1 palette contrast', () => {
  assert.ok(contrast(rgb(appearance.contextInk), rgb(appearance.contextHalo)) >= 7);
});

test('inside boundary exceeds 3:1 against visible fill over every grayscale background', () => {
  const fill = rgb(appearance.visibleFill);
  const boundary = rgb(appearance.visibleBoundary);
  const paper = rgb(appearance.basePaper), shadow = rgb(appearance.reliefShadow);
  for (let gray = 0; gray <= 255; gray++) {
    const shade = (1-gray/255)*appearance.reliefStrength;
    const base = paper.map((c,i) => c*(1-shade)+shadow[i]*shade);
    const composite = fill.map((c,i) => c * appearance.fillOpacity + base[i] * (1-appearance.fillOpacity));
    assert.ok(contrast(boundary, composite) >= 3.25, `Failed at grayscale ${gray}`);
  }
});

test('legend matches the shader palette and non-visible terrain is not darkened', () => {
  const css = readFileSync(new URL('../maps/05-viewshed-01-taubensee/style.css', import.meta.url), 'utf8');
  const swatch = css.match(/\.visible-swatch\s*\{([^}]+)\}/)?.[1];
  assert.ok(swatch?.includes(appearance.visibleFill));
  assert.ok(swatch.includes(appearance.visibleBoundary));
  assert.equal(appearance.shadeOpacity,0);
  assert.ok(appearance.reliefStrength >= 0.5 && appearance.reliefStrength <= 0.8);
  const paper = rgb(appearance.basePaper), shadow = rgb(appearance.reliefShadow);
  assert.ok(contrast(paper,paper.map((c,i)=>c*(1-appearance.reliefStrength)+shadow[i]*appearance.reliefStrength))>=1.8,'Terrain relief must remain visibly distinct from flat paper');
  assert.ok(css.includes(appearance.noData) && css.includes(appearance.noDataHatch));
});

test('gray land and leafy green match the selected map reference', () => {
  assert.equal(appearance.basePaper,'#e8e7e8');
  assert.equal(appearance.visibleFill,'#8dc98f');
  assert.equal(appearance.noData,'#fbfbfb');
  const [r,g,b] = rgb(appearance.visibleFill);
  assert.ok(g > r && g > b);
  assert.ok(g-Math.max(r,b) >= 50/255);
});
