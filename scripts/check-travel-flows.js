/* Run in the rendered page with agent-browser eval --stdin. */
(async () => {
  const assert = (v, m) => { if (!v) throw Error(m); };
  const origin = document.querySelector('#origin'), filter = document.querySelector('#exclude-domestic'), toggle = document.querySelector('#show-flows');
  const original = {market: origin.value, filter: filter.checked, toggle: toggle.checked};
  const artifact = await fetch('data/bundled-flows.json').then(r => r.json());
  toggle.checked = true;
  for (const market of ['Netherlands', 'United States', 'Germany']) {
    origin.value = market;
    for (const domestic of [true, false]) {
      filter.checked = domestic; filter.dispatchEvent(new Event('change'));
      const expected = artifact.layouts[domestic ? 'foreign' : 'all'][market];
      const paths = Array.from(document.querySelectorAll('.flow'));
      assert(paths.length === expected.length, 'Line coverage must follow origin and filter');
      assert(paths.every((p, i) => p.__data__.cityIndex === expected[i].cityIndex && !/NaN|undefined/.test(p.getAttribute('d'))), 'Paths must match the saved bundle');
      assert(document.querySelector('.source-label').textContent.includes(market), 'Source label must follow selection');
      if (market === 'United States') assert(document.querySelector('.source-label').textContent.includes('off-map'), 'External origins need explicit edge-entry labels');
    }
  }
  const count = document.querySelectorAll('.dot.selected').length;
  toggle.checked = false; toggle.dispatchEvent(new Event('change'));
  assert(document.querySelectorAll('.flow').length === 0, 'Connection toggle must hide lines');
  assert(document.querySelectorAll('.dot.selected').length === count, 'Connection toggle must not alter bubbles');
  origin.value = original.market; filter.checked = original.filter; toggle.checked = original.toggle;
  filter.dispatchEvent(new Event('change'));
  return {result: 'pass', connections: document.querySelectorAll('.flow').length, source: origin.value};
})();
