/* Run through agent-browser eval --stdin after the fixed map is ready. */
(async () => {
  const map = document.querySelector('#map');
  const errors = [];
  if (map.dataset.ready !== 'true') throw Error('Map is not ready');
  if (document.querySelector('aside, #resort, #selection-title, #street-map, [data-annotation-feature]')) errors.push('Explorer UI remains');
  if (map.querySelector('.leaflet-control-zoom, .leaflet-interactive, button, input, select')) errors.push('Interactive map controls remain');
  if (map.hasAttribute('tabindex')) errors.push('Noninteractive map is a keyboard stop');
  if (map.getAttribute('role') !== 'group') errors.push('Missing named map-group semantics');
  if (map.querySelectorAll('.source-legend > span').length !== 4) errors.push('Expected ranked, selected, mapped-context and planning-context legend entries');
  if (map.dataset.rankedOutlines !== '6' || map.dataset.rankedPoints !== '0' || map.dataset.rankedPlanning !== '4' || map.dataset.rankedPlanningPolygons !== '5') errors.push('Map does not represent the same ten ranked resorts');
  if (document.querySelectorAll('.leaflet-tile').length) errors.push('Unexpected external tiles');
  const extent = map.getBoundingClientRect();
  const legend = map.querySelector('.source-legend').getBoundingClientRect();
  const attribution = map.querySelector('.leaflet-control-attribution').getBoundingClientRect();
  if (Math.abs(extent.right - legend.right - 16) > 1) errors.push('Legend is not bottom-right aligned');
  if (legend.bottom > attribution.top - 8 || legend.top < extent.top || legend.left < extent.left) errors.push('Legend overlaps credits or escapes map');
  const body = getComputedStyle(document.body);
  if (getComputedStyle(map).backgroundColor !== body.backgroundColor) errors.push('Map background does not match Cactus theme');
  if (!getComputedStyle(map.closest('.map-scene').querySelector('.annotation-note-title')).fontFamily.includes('system-ui')) errors.push('Geographic labels should use proportional type');
  const view = map.dataset.view;
  map.dispatchEvent(new WheelEvent('wheel', { deltaY: -600, bubbles: true, cancelable: true }));
  map.dispatchEvent(new MouseEvent('dblclick', { clientX: extent.left + 80, clientY: extent.top + 80, bubbles: true }));
  map.dispatchEvent(new KeyboardEvent('keydown', { key: '+', bubbles: true }));
  map.dispatchEvent(new MouseEvent('mousedown', { clientX: extent.left + 80, clientY: extent.top + 160, buttons: 1, bubbles: true }));
  document.dispatchEvent(new MouseEvent('mousemove', { clientX: extent.left + 150, clientY: extent.top + 190, buttons: 1, bubbles: true }));
  document.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
  await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  if (map.dataset.view !== view) errors.push('Fixed map responds to navigation gestures');
  if (errors.length) throw Error(errors.join('\n'));
  return { status: 'pass', theme: document.documentElement.dataset.theme, width: innerWidth, fixedView: true, legend: 'bottom-right, above credits', explorerControls: 0 };
})()
