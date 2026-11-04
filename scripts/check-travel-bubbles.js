/* Run inside the page: agent-browser eval --stdin < scripts/check-travel-bubbles.js */
(async () => {
  const assert = (condition, message) => { if (!condition) throw new Error(message); };
  const svg = document.querySelector('#map');
  assert(svg.dataset.settled === 'true', 'Wait for the force layout to settle before testing');
  const waitForLayout = async () => {
    const start = performance.now();
    while (svg.dataset.settled !== 'true') {
      assert(performance.now() - start < 20000, 'Layout did not settle');
      await new Promise(requestAnimationFrame);
    }
  };
  const filter = document.querySelector('#exclude-domestic');
  const originalFilter = filter.checked;
  filter.checked = false;
  filter.dispatchEvent(new Event('change'));
  await waitForLayout();
  const inFrame = node => node.city.lon >= -17.9 && node.city.lon <= 28.3 && node.city.lat >= 32 && node.city.lat <= 64.2;
  const allDots = Array.from(document.querySelectorAll('.dot'));
  const framedCount = allDots.filter(e => inFrame(e.__data__)).length;
  const foreignCount = allDots.filter(e => inFrame(e.__data__) && !e.__data__.domestic).length;
  assert(+svg.dataset.layoutCount === framedCount, 'Unfiltered simulation must contain only framed pairs');
  const dots = Array.from(document.querySelectorAll('.dot'));
  assert(dots.length === 5321, 'Every non-missing individual-country pair must be present');
  assert(dots.filter(e => e.__data__.value === 0).length === 144, 'Reported zeros must not be dropped');
  assert(document.querySelectorAll('.anchor').length === 147, 'All destination attractors must be present');
  const before = new Map(dots.map(e => [e, [e.getAttribute('cx'), e.getAttribute('cy'), e.getAttribute('r')]]));
  const origin = document.querySelector('#origin');
  const original = origin.value;
  for (const market of ['Germany', 'China', 'Netherlands']) {
    origin.value = market;
    origin.dispatchEvent(new Event('change'));
    assert(document.querySelectorAll('.dot').length === 5321, 'Source selection must never filter bubbles');
    dots.forEach(element => {
      const node = element.__data__;
      assert(element.classList.contains('selected') === (inFrame(node) && node.market === market), 'Only selected-origin bubbles may be highlighted');
      assert([element.getAttribute('cx'), element.getAttribute('cy'), element.getAttribute('r')].every((v, i) => v === before.get(element)[i]), 'Selection must preserve layout and scale');
      assert(Number.isFinite(node.x) && Number.isFinite(node.y) && node.r > 0, 'Every bubble needs a finite visible position and radius');
    });
  }
  assert(document.querySelectorAll('.dot.selected').length === 103, 'Framed Dutch coverage must include 103 destinations');
  document.querySelector('#ranking button').click();
  assert(document.querySelector('#selection').textContent.includes('Amsterdam'), 'Rank selection should expose the destination');
  const leader = document.querySelector('.leader');
  assert(leader && Number.isFinite(+leader.getAttribute('x2')), 'Selection must expose the geographic attractor');
  const neutral = dots.find(e => e.__data__.market !== 'Netherlands');
  assert(getComputedStyle(neutral).fill !== getComputedStyle(document.querySelector('.dot.selected')).fill, 'Selected and neutral fills must differ');
  filter.checked = true;
  filter.dispatchEvent(new Event('change'));
  await waitForLayout();
  assert(+svg.dataset.layoutCount === foreignCount, 'Filtered simulation must omit domestic and out-of-frame pairs');
  assert(+svg.dataset.layoutDomesticCount === 0, 'No domestic pair may participate in collision forces');
  assert(document.querySelectorAll('.dot.selected').length === 97, 'Framed Dutch outbound coverage must be 97');
  assert(dots.every(e => (getComputedStyle(e).display === 'none') === (e.__data__.domestic || !inFrame(e.__data__))), 'Filter must hide domestic pairs across every origin');
  assert(dots.some(e => e.__data__.market === 'Germany' && e.__data__.domestic && getComputedStyle(e).display === 'none'), 'German domestic bubbles must also be hidden');
  dots.forEach(e => assert(e.getAttribute('r') === before.get(e)[2], 'Filtering must preserve the global radius scale'));
  assert(dots.some(e => !e.__data__.domestic && Math.abs(+e.getAttribute('cx') - +before.get(e)[0]) > 1), 'Remaining bubbles must repack into the released collision space');
  // Rapid toggles must cancel obsolete animation batches.
  filter.checked = false;
  filter.dispatchEvent(new Event('change'));
  filter.checked = originalFilter;
  filter.dispatchEvent(new Event('change'));
  await waitForLayout();
  assert(+svg.dataset.layoutCount === (originalFilter ? foreignCount : framedCount), 'Latest filter state must own the final layout');
  origin.value = original;
  origin.dispatchEvent(new Event('change'));
  return { result: 'pass', bubbles: dots.length, reportedZeros: 144,
    maxDisplacement: Math.round(Math.max(...dots.map(e => Math.hypot(e.__data__.x - e.__data__.ax, e.__data__.y - e.__data__.ay)))),
    overflow: document.documentElement.scrollWidth > innerWidth };
})();
