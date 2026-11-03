/* Run via agent-browser eval --stdin once map.dataset.ready is true. */
(async () => {
  const map = document.querySelector('#map');
  const scene = map.closest('.map-scene');
  const chart = document.querySelector('.downhill-ranking');
  const buttons = Array.from(chart.querySelectorAll('.ranking-row'));
  const nextFrame = () => new Promise(resolve => requestAnimationFrame(resolve));
  async function wait(predicate) {
    for (let n = 0; n < 90; n++) { if (predicate()) return; await nextFrame(); }
    throw Error('Linked chart did not settle');
  }
  const enter = button => button.dispatchEvent(new PointerEvent('pointerenter', { pointerType: 'mouse' }));
  const leave = button => button.dispatchEvent(new PointerEvent('pointerleave', { pointerType: 'mouse' }));
  const group = button => scene.querySelector(`g.annotation[data-resort-id="${button.dataset.sourceId}"]`);
  const selected = button => map.dataset.activeResort === button.dataset.sourceId && scene.querySelectorAll(".annotation-note-title").length === 10 && group(button)?.querySelector(".annotation-note-title").textContent.replace(/\s/g, "") === button.querySelector(".ranking-name").textContent.replace(/\s/g, "") && group(button).classList.contains("is-map-active") && map.dataset.labelsReady === "true";
  const escape = () => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  // Let pending viewport ResizeObserver/refit work finish before checking node identity.
  await nextFrame(); await nextFrame(); await nextFrame();
  escape();
  await wait(() => selected(buttons[0]));
  const view = map.dataset.view;
  const paths = Array.from(scene.querySelectorAll('.annotation-connector path')).map(path => path.getAttribute('d'));
  const review = await (await fetch('data/polygon-matches.json')).json();
  const matches = new Map(review.matches.map(row => [row.openSkiDataId, row]));
  const planningFeatures = new Map((await (await fetch('data/tirol-boundaries.geojson')).json()).features.map(f => [f.properties.id, f]));
  let points = 0, outlines = 0, planning = 0;
  for (const button of buttons) {
    enter(button);
    await wait(() => selected(button));
    if (map.dataset.activeKind === 'planning-outline') {
      planning++;
      if (JSON.stringify(matches.get(button.dataset.sourceId)?.polygonIds) !== map.dataset.activePolygonIds) throw Error('Wrong reviewed polygon selection');
      if (!document.querySelector('.annotation-context').textContent.includes('2011')) throw Error('Missing historical qualification');
    } else if (map.dataset.activeKind === 'point') points++; else outlines++;
    if (map.dataset.view !== view) throw Error('Selection changed map framing');
    const note = group(button).querySelector('.annotation-note-content').getBoundingClientRect();
    const extent = scene.getBoundingClientRect();
    const legend = map.querySelector('.source-legend').getBoundingClientRect();
    if (note.left < extent.left || note.right > extent.right || note.top < extent.top || note.bottom > extent.bottom) throw Error('Clipped selected label: ' + button.dataset.sourceId);
    if (note.left < legend.right && note.right > legend.left && note.top < legend.bottom && note.bottom > legend.top) throw Error('Selected label overlaps legend');
    if (matches.has(button.dataset.sourceId)) {
      const [lat, lon, zoom] = JSON.parse(map.dataset.view);
      const center = L.CRS.EPSG3857.latLngToPoint(L.latLng(lat, lon), zoom);
      for (const id of matches.get(button.dataset.sourceId).polygonIds) {
        const geometry = planningFeatures.get(id).geometry;
        const coordinates = geometry.coordinates.flat(geometry.type === 'MultiPolygon' ? 2 : 1);
        for (const [lon, lat] of coordinates) {
          const point = L.CRS.EPSG3857.latLngToPoint(L.latLng(lat, lon), zoom).subtract(center);
          const x = map.getBoundingClientRect().left + map.clientWidth / 2 + point.x, y = map.getBoundingClientRect().top + map.clientHeight / 2 + point.y;
          if (x > legend.left - 2 && x < legend.right + 2 && y > legend.top - 2 && y < legend.bottom + 2) throw Error('Matched polygon is hidden by legend: ' + id);
        }
      }
    }
    if (Array.from(scene.querySelectorAll('.annotation-connector path')).some((path, i) => path.getAttribute('d') !== paths[i])) throw Error('Hover repositioned labels or leaders');
    const node = group(button);
    leave(button); await nextFrame(); await nextFrame();
    if (!selected(button) || group(button) !== node) throw Error('Selection flickers in an inter-row gap');
    enter(button); await nextFrame(); await nextFrame();
    if (group(button) !== node) throw Error('Unchanged resort redraws its label');
  }
  const middle = buttons[4];
  enter(middle); await wait(() => selected(middle));
  const b = chart.getBoundingClientRect();
  for (const x of [b.left - 2, b.right + 2]) {
    chart.dispatchEvent(new PointerEvent('pointerleave', { pointerType: 'mouse', clientX: x, clientY: (b.top + b.bottom) / 2 }));
    await nextFrame();
    if (!selected(middle)) throw Error('Horizontal exit lost current selection');
  }
  chart.dispatchEvent(new PointerEvent('pointerleave', { pointerType: 'mouse', clientX: b.left + b.width / 2, clientY: b.top - 2 }));
  await wait(() => selected(buttons[0]));
  chart.dispatchEvent(new PointerEvent('pointerleave', { pointerType: 'mouse', clientX: b.left + b.width / 2, clientY: b.bottom + 2 }));
  await wait(() => selected(buttons.at(-1)));
  buttons[2].focus({ preventScroll: true });
  await wait(() => selected(buttons[2]));
  buttons[2].blur(); await nextFrame();
  if (!selected(buttons[2])) throw Error('Blur cleared persistent selection');
  buttons[7].click(); await wait(() => selected(buttons[7]));
  if (buttons[7].getAttribute('aria-pressed') !== 'true' || buttons.filter(btn => btn.getAttribute('aria-pressed') === 'true').length !== 1) throw Error('Selection is not accessible');
  escape(); await wait(() => selected(buttons[0]));
  if (map.dataset.view !== view) throw Error('Linked interactions moved the map');
  if (innerWidth >= 1100) {
    const a = document.querySelector('.map-card').getBoundingClientRect();
    const c = chart.getBoundingClientRect();
    if (Math.abs(a.top - c.top) > 1 || Math.abs(a.height - c.height) > 1) throw Error('Paired cards not aligned');
    if (buttons.at(-1).getBoundingClientRect().bottom > a.bottom || chart.scrollHeight > chart.clientHeight + 1) throw Error('Ten bars do not fit alongside map');
  }
  return { status: 'pass', width: innerWidth, theme: document.documentElement.dataset.theme, outlines, points, planning, defaultFirst: true, gapFlicker: false, horizontalExitRetains: true, topExitFirst: true, bottomExitLast: true, persistentFocusAndTap: true, fixedView: true };
})()
