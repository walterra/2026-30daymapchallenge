/* Geographic callouts using Susie Lu's d3-annotation; no boundary inference. */
'use strict';
window.skiMapAnnotations = function ({ map, annotations, isVisible, inspect }) {
  if (!window.d3?.annotation) throw new Error('Local d3-annotation library unavailable.');
  const pane = map.createPane('story-annotations');
  pane.style.zIndex = 620;
  pane.style.pointerEvents = 'none';
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('class', 'map-annotations leaflet-zoom-hide');
  svg.setAttribute('aria-hidden', 'true');
  pane.append(svg);
  const root = d3.select(svg).append('g');
  let frame;
  function draw() {
    frame = undefined;
    const size = map.getSize();
    L.DomUtil.setPosition(svg, map.containerPointToLayerPoint([0, 0]));
    svg.setAttribute('width', size.x); svg.setAttribute('height', size.y);
    const compact = size.x < 600;
    const margin = compact ? 12 : 65;
    const column = (size.x - 2 * margin) / 3;
    const wrap = Math.min(compact ? 100 : 155, column - 12);
    function project(spec) {
      const [west, south, east, north] = spec.bounds;
      const a = map.latLngToContainerPoint([south, west]);
      const b = map.latLngToContainerPoint([north, east]);
      const p = L.point((a.x + b.x) / 2, (a.y + b.y) / 2);
      // Enclose the group's projected bounding rectangle, plus visual padding.
      return { p, radius: Math.hypot(b.x - a.x, b.y - a.y) / 2 + 5 };
    }
    const visible = annotations.filter(spec => {
      const { p } = project(spec);
      return isVisible(spec) && p.x >= 8 && p.x <= size.x - 8 && p.y >= 8 && p.y <= size.y - 30;
    });
    // Rebuild just three notes so wrapping and positions follow the viewport.
    root.selectAll('*').remove();
    const notes = visible.map(spec => {
      const index = annotations.indexOf(spec);
      const { p, radius } = project(spec);
      const nx = visible.length === 1 ? Math.max(55, size.x - wrap - 25) : margin + index * column;
      const ny = compact ? 140 : 155;
      return {
        id: spec.featureId, x: p.x, y: p.y, dx: nx - p.x, dy: ny - p.y,
        color: '#54416e',
        note: { title: spec.title, label: compact ? spec.compactLabel : spec.label, wrap, align: 'left', orientation: 'topBottom', padding: 6, bgPadding: 5 },
        subject: { radius, radiusPadding: 3 }
      };
    });
    root.call(d3.annotation().type(d3.annotationCalloutCircle).annotations(notes));
    map.fire('storyannotationslayout');
  }
  function update() { if (frame === undefined) frame = requestAnimationFrame(draw); }
  map.on('move zoomend resize layeradd layerremove', update);
  document.querySelectorAll('[data-annotation-feature]').forEach(button => {
    const spec = annotations.find(a => a.featureId === button.dataset.annotationFeature);
    button.disabled = !spec;
    button.addEventListener('click', () => { if (spec) inspect(spec.featureId, spec.featureIds); });
  });
  // Match map labels to final font metrics, including delayed font availability.
  document.fonts.ready.then(update);
  update();
  return { update };
};
