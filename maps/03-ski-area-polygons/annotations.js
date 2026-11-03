/* Single, persistent resort label using Susie Lu's d3-annotation. */
'use strict';
window.skiMapAnnotations = function ({ map }) {
  if (!window.d3?.annotation) throw new Error('Local d3-annotation library unavailable.');
  const pane = map.createPane('story-annotations');
  pane.style.zIndex = 620;
  pane.style.pointerEvents = 'none';
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('class', 'map-annotations leaflet-zoom-hide');
  svg.setAttribute('aria-hidden', 'true');
  pane.append(svg);
  const root = d3.select(svg).append('g');
  let frame, selected;
  function draw() {
    frame = undefined;
    if (!selected) return;
    const size = map.getSize();
    L.DomUtil.setPosition(svg, map.containerPointToLayerPoint([0, 0]));
    svg.setAttribute('width', size.x); svg.setAttribute('height', size.y);
    const [lon, lat] = selected.mapReference.coordinates;
    const p = map.latLngToContainerPoint([lat, lon]);
    const wrap = Math.min(220, size.x - 48);
    const nx = Math.max(16, Math.min(p.x + 24, size.x - wrap - 12));
    const ny = Math.max(64, p.y - 36);
    function render(noteY) {
      root.selectAll('*').remove();
      root.call(d3.annotation().type(d3.annotationCallout).annotations([{
        x: p.x, y: p.y, dx: nx - p.x, dy: noteY - p.y,
        color: getComputedStyle(document.documentElement).getPropertyValue('--color-accent').trim(),
        note: {
          title: selected.label.replace(/–/g, '– '),
          wrap, align: 'left', orientation: 'topBottom', padding: 6, bgPadding: 5
        },
        connector: { type: 'line', end: 'dot' }
      }]));
    }
    render(ny);
    const note = svg.querySelector('.annotation-note-content').getBoundingClientRect();
    const legend = map.getContainer().querySelector('.source-legend').getBoundingClientRect();
    if (note.left < legend.right && note.right > legend.left && note.top < legend.bottom && note.bottom > legend.top) {
      render(Math.max(64, ny - (note.bottom - legend.top) - 12));
    }
    map.getContainer().dataset.annotationCount = '1';
    map.fire('storyannotationslayout');
  }
  function update() { if (frame === undefined) frame = requestAnimationFrame(draw); }
  map.on('move zoomend resize layeradd layerremove mapthemechange', update);
  document.fonts.ready.then(update);
  return { update, setHighlight(value) { if (value) { selected = value; update(); } } };
};
