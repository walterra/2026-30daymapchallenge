/* Run in the rendered page with agent-browser eval --stdin. */
(async () => {
  const assert = (v, m) => { if (!v) throw Error(m); };
  const origin = document.querySelector('#origin'), filter = document.querySelector('#exclude-domestic'), toggle = document.querySelector('#show-flows');
  const original = {market: origin.value, filter: filter.checked, toggle: toggle.checked};
  const artifact = await fetch('data/bundled-flows.json').then(r => r.json());
  toggle.checked = true;
  for (const market of ['Netherlands', 'United States', 'Germany', 'Turkiye', 'Ukraine']) {
    origin.value = market;
    for (const domestic of [true, false]) {
      filter.checked = domestic; filter.dispatchEvent(new Event('change'));
      const expected = artifact.layouts[domestic ? 'foreign' : 'all'][market];
      const paths = Array.from(document.querySelectorAll('.flow'));
      assert(paths.length === expected.length, 'Line coverage must follow origin and filter');
      assert(paths.every((p, i) => p.__data__.cityIndex === expected[i].cityIndex && !/NaN|undefined/.test(p.getAttribute('d'))), 'Paths must match the saved bundle');
      assert(document.querySelector('.source-label').textContent.includes(market), 'Source label must follow selection');
      if (['United States', 'Turkiye', 'Ukraine'].includes(market)) {
        const label = document.querySelector('.source-label');
        const map = document.querySelector('#map');
        const point = new DOMPoint(...label.__data__.point).matrixTransform(map.getScreenCTM());
        const rect = map.getBoundingClientRect();
        const outside = point.x < rect.left || point.x > rect.right || point.y < rect.top || point.y > rect.bottom;
        assert((label.dataset.offscreen === 'true') === outside, 'Offscreen classification must use the actual visible viewport');
        if (outside) {
          assert(label.querySelector('title').textContent.includes('outside the viewport'), 'Label must qualify the representative point, not the whole country');
          assert(document.querySelectorAll('.source-point').length === 0, 'Do not draw a substitute edge source marker');
        } else assert(document.querySelectorAll('.source-point').length === 1, 'A true source visible in letterboxed space should be drawn at its actual point');
        assert(label.__data__.point[0] < 0 || label.__data__.point[0] > 1000 || label.__data__.point[1] < 0 || label.__data__.point[1] > 850, 'Source must retain its true outside position');
        assert(document.querySelector('.flows').getAttribute('clip-path'), 'Offscreen lines must be clipped to the composition viewport');
      }
    }
  }
  const map = document.querySelector('#map'), clip = document.querySelector('#flow-viewport-clip rect');
  const screen = map.getBoundingClientRect(), matrix = map.getScreenCTM();
  const topLeft = new DOMPoint(+clip.getAttribute('x'), +clip.getAttribute('y')).matrixTransform(matrix);
  const bottomRight = new DOMPoint(+clip.getAttribute('x') + +clip.getAttribute('width'), +clip.getAttribute('y') + +clip.getAttribute('height')).matrixTransform(matrix);
  assert(Math.abs(topLeft.x - screen.left) < 2 && Math.abs(topLeft.y - screen.top) < 2
    && Math.abs(bottomRight.x - screen.right) < 2 && Math.abs(bottomRight.y - screen.bottom) < 2,
    'Flow clipping must reach actual SVG viewport edges, including letterboxed space');
  const count = document.querySelectorAll('.dot.selected').length;
  toggle.checked = false; toggle.dispatchEvent(new Event('change'));
  assert(document.querySelectorAll('.flow').length === 0, 'Connection toggle must hide lines');
  assert(document.querySelectorAll('.dot.selected').length === count, 'Connection toggle must not alter bubbles');
  origin.value = original.market; filter.checked = original.filter; toggle.checked = original.toggle;
  filter.dispatchEvent(new Event('change'));
  return {result: 'pass', connections: document.querySelectorAll('.flow').length, source: origin.value};
})();
