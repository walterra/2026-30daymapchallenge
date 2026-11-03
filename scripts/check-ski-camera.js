/* Fixed-camera regression: run through agent-browser eval after map readiness. */
(async () => {
  const map = document.querySelector('#map');
  const frame = () => new Promise(resolve => requestAnimationFrame(resolve));
  await frame(); await frame(); await frame();
  const view = map.dataset.view;
  for (const row of document.querySelectorAll('.ranking-row')) {
    row.dispatchEvent(new PointerEvent('pointerenter', { pointerType: 'mouse' }));
    await frame(); await frame();
    if (map.dataset.view !== view) throw Error('Hover changed map framing');
  }
  const started = performance.now();
  while (performance.now() - started < 1000) await frame();
  if (map.dataset.view !== view) throw Error('Delayed camera motion remains');
  document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  await frame();
  if (map.dataset.view !== view) throw Error('Escape moved the map');
  return { status: 'pass', fixedView: true, resorts: 10, delayedMotion: false };
})()
