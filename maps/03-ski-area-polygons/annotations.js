/* Bitmap-based greedy placement (FastLabels, VIS 2021); d3-annotation renders.
 * Application extensions: larger 8-position rings, priority retries, connector
 * occupancy, minimum leader length, and adaptive margins to retain all ten.
 */
'use strict';
window.skiMapAnnotations = function ({ map, rows, cities = [], marks = [], shapes = {}, onHover = () => {} }) {
  if (!window.d3?.annotation || !window.SkiLabelLayout) throw Error('Local annotation/layout libraries unavailable');
  const { OccupancyBitmap, consecutive, connected, outwardCost } = SkiLabelLayout;
  const container = map.getContainer(), scene = container.closest('.map-scene');
  const svg = d3.select(scene).append('svg').attr('class', 'map-annotations').attr('aria-hidden', 'true');
  const root = svg.append('g');
  let frame, selectedId, nodes = [];
  function color() {
    for (const { row, group } of nodes) group.classList.toggle('is-map-active', row.id === selectedId);
  }
  const flatten = coordinates => typeof coordinates[0] === 'number' ? [coordinates] : coordinates.flatMap(flatten);
  const project = (coordinate, padding) => {
    const p = map.latLngToContainerPoint([coordinate[1], coordinate[0]]);
    return { x: p.x, y: p.y + padding };
  };
  function drawGeometry(context, geometry, padding) {
    const line = (coordinates, closed) => {
      coordinates.forEach((c, i) => { const p = project(c, padding); if (i) context.lineTo(p.x, p.y); else context.moveTo(p.x, p.y); });
      if (closed) context.closePath();
    };
    if (geometry.type === 'Polygon') geometry.coordinates.forEach(ring => line(ring, true));
    else if (geometry.type === 'MultiPolygon') geometry.coordinates.forEach(polygon => polygon.forEach(ring => line(ring, true)));
    else if (geometry.type === 'LineString') line(geometry.coordinates, false);
    else if (geometry.type === 'MultiLineString') geometry.coordinates.forEach(coordinates => line(coordinates, false));
  }
  function draw() {
    frame = undefined;
    const size = map.getSize(); if (!size.x || !size.y) return;
    const started = performance.now();
    const priorReady = container.dataset.layoutReady;
    container.dataset.layoutReady = 'false';
    const scale = Math.max(1, Math.min(2, devicePixelRatio || 1));
    const minimum = size.x >= 620 ? 32 : 20;
    const maxWidth = size.x < 420 ? 92 : 145;
    let placements, padding, metrics, renderData;
    const previous = { top: scene.style.paddingTop, bottom: scene.style.paddingBottom, width: svg.attr('width'), height: svg.attr('height'), ready: priorReady };
    for (const extra of [0, 20, 40, 70, 110, 160]) {
      padding = (size.x < 420 ? 70 : 28) + extra;
      scene.style.paddingTop = padding + 'px'; scene.style.paddingBottom = padding + 'px';
      const height = size.y + padding * 2;
      svg.attr('width', size.x).attr('height', height);
      const compactNames = new Map([
        ['Saalbach–Hinterglemm–Leogang–Fieberbrunn', 'Saalbach–Hinterglemm'],
        ['SkiWelt Wilder Kaiser–Brixental', 'SkiWelt'],
        ['Mayrhofen–Hippach', 'Mayrhofen'],
      ]);
      const annotations = rows.map(row => {
        const label = size.x < 340 ? compactNames.get(row.label) || row.label : row.label;
        const p = project(row.mapReference.coordinates, padding);
        return { x: p.x, y: p.y, dx: 32, dy: -32, data: { id: row.id },
          note: { title: label.replace(/–/g, '– '), wrap: maxWidth, align: 'left', orientation: 'topBottom', padding: 0, bgPadding: 4 },
          connector: { type: 'line' } };
      });
      if (!metrics) {
        const probeSvg = d3.select(scene).append('svg').attr('class', 'map-annotations').attr('width', size.x).attr('height', height).style('visibility', 'hidden');
        const probeRoot = probeSvg.append('g');
        probeRoot.call(d3.annotation().type(d3.annotationCallout).annotations(annotations));
        const measuredNodes = probeRoot.selectAll('g.annotation').nodes().map((group, i) => {
          const row = rows[i], content = group.querySelector('.annotation-note-content');
          group.dataset.resortId = row.id;
          content.onpointerenter = () => onHover(row.id);
          content.onpointerleave = () => onHover(null);
          // No note underline: the measured box and simple leader are sufficient.
          group.querySelectorAll('.annotation-note > path').forEach(path => path.remove());
          return { row, group, content };
        });
        metrics = measuredNodes.map(node => {
          const rect = node.content.getBoundingClientRect();
          return { width: rect.width, height: rect.height };
        });
        probeSvg.remove();
      }
      const widthPixels = Math.ceil(size.x * scale), heightPixels = Math.ceil(height * scale);
      function raster(drawMarks) {
        const canvas = document.createElement('canvas'); canvas.width = widthPixels; canvas.height = heightPixels;
        const context = canvas.getContext('2d', { willReadFrequently: true }); context.scale(scale, scale);
        context.fillStyle = context.strokeStyle = '#000'; context.lineJoin = context.lineCap = 'round';
        drawMarks(context);
        return new OccupancyBitmap(widthPixels, heightPixels).fromAlpha(context.getImageData(0, 0, widthPixels, heightPixels).data);
      }
      const cityRects = cities.map(city => {
        const p = project(city.geometry.coordinates, padding);
        const element = Array.from(container.querySelectorAll('.city-reference')).find(node => node.textContent.trim() === city.properties.name);
        const span = element?.querySelector('span'), width = span?.getBoundingClientRect().width || 60;
        return { left: p.x - width / 2 - 5, right: p.x + width / 2 + 5, top: p.y - 29, bottom: p.y + 1 };
      });
      const paintCities = context => cityRects.forEach(rect => context.fillRect(rect.left, rect.top, rect.right - rect.left, rect.bottom - rect.top));
      const cityMask = raster(paintCities);
      const base = raster(context => {
        context.save(); context.beginPath(); context.rect(0, padding, size.x, size.y); context.clip();
        for (const mark of marks) {
          context.beginPath(); drawGeometry(context, mark.geometry, padding);
          if (mark.fill) context.fill('evenodd');
          if (mark.stroke) { context.lineWidth = mark.width + 4; context.setLineDash(mark.dash); context.stroke(); }
        }
        context.restore(); paintCities(context);
      });
      const vertices = rows.map(row => Array.from(new Map((shapes[row.id] || []).flatMap(geometry => flatten(geometry.coordinates).map(coordinate => project(coordinate, padding))).map(point => [point.x + ':' + point.y, point])).values()));
      const bounds = vertices.map(points => ({ left: Math.min(...points.map(p => p.x)), right: Math.max(...points.map(p => p.x)), top: Math.min(...points.map(p => p.y)), bottom: Math.max(...points.map(p => p.y)) }));
      const centreCity = cities.find(city => city.properties.name === 'Innsbruck');
      const core = centreCity ? project(centreCity.geometry.coordinates, padding) : { x: size.x / 2, y: padding + size.y / 2 };
      container.dataset.antiGravityCenter = centreCity?.properties.name || 'none';
      const pixel = p => ({ x: p.x * scale, y: p.y * scale });
      const labels = rows.map((row, id) => {
        const metric = metrics[id], box = bounds[id], candidates = [];
        const cx = (box.left + box.right) / 2, cy = (box.top + box.bottom) / 2;
        const reference = project(row.mapReference.coordinates, padding);
        const targets = [[box.left, box.top], [cx, box.top], [box.right, box.top], [box.right, cy], [box.right, box.bottom], [cx, box.bottom], [box.left, box.bottom], [box.left, cy]];
        const points = [reference, ...targets.map(([x, y]) => vertices[id].reduce((best, p) => (p.x - x) ** 2 + (p.y - y) ** 2 < (best.x - x) ** 2 + (best.y - y) ** 2 ? p : best))];
        const unique = Array.from(new Map((size.x < 620 ? [...points, ...vertices[id]] : points).map(point => [point.x + ':' + point.y, point])).values());
        const origins = [...unique.map(point => ({ left: point.x, right: point.x, top: point.y, bottom: point.y })), box];
        const seen = new Set();
        const directions = [[1, -1], [1, 0], [1, 1], [0, -1], [0, 1], [-1, -1], [-1, 0], [-1, 1]];
        directions.sort((a, b) => ((b[0] * (cx - core.x) + b[1] * (cy - core.y)) / Math.hypot(...b)) - ((a[0] * (cx - core.x) + a[1] * (cy - core.y)) / Math.hypot(...a)));
        for (const gap of [minimum + 6, minimum + 12, minimum + 24, minimum + 44, minimum + 72, minimum + 110, minimum + 160, minimum + 210]) for (const [dx, dy] of directions) for (const origin of origins) for (const slide of (size.x < 620 && (!dx || !dy) ? [-1.5, -1, -.5, 0, .5, 1, 1.5] : [0])) {
          const left = (dx > 0 ? origin.right + gap : dx < 0 ? origin.left - gap - metric.width : (origin.left + origin.right - metric.width) / 2) + (!dx ? slide * metric.width : 0);
          const top = (dy > 0 ? origin.bottom + gap : dy < 0 ? origin.top - gap - metric.height : (origin.top + origin.bottom - metric.height) / 2) + (!dy ? slide * metric.height : 0);
          const key = left + ':' + top;
          if (seen.has(key)) continue; seen.add(key);
          const rect = { left, right: left + metric.width, top, bottom: top + metric.height };
          if (left < 8 || top < 8 || rect.right > size.x - 8 || rect.bottom > height - 8) continue;
          let anchor, end, distanceSquared = Infinity;
          for (const point of vertices[id]) {
            const target = { x: Math.max(rect.left - 6, Math.min(rect.right + 6, point.x)), y: Math.max(rect.top - 6, Math.min(rect.bottom + 6, point.y)) };
            const length = (point.x - target.x) ** 2 + (point.y - target.y) ** 2;
            if (length < distanceSquared) { anchor = point; end = target; distanceSquared = length; }
          }
          const distance = Math.sqrt(distanceSquared);
          if (distance < minimum) continue;
          const pixelRect = { left: (rect.left - 3) * scale, right: (rect.right + 3) * scale, top: (rect.top - 3) * scale, bottom: (rect.bottom + 3) * scale };
          const placementCost = outwardCost(rect, { x: cx, y: cy }, core, distance);
          if (!base.rectangle(pixelRect)) candidates.push({ rect, anchor, end, distance, placementCost, gap, slide, direction: directions.findIndex(pair => pair[0] === dx && pair[1] === dy), pixelRect, pixelAnchor: pixel(anchor), pixelEnd: pixel(end) });
        }
        candidates.sort((a, b) => a.placementCost - b.placementCost);
        const cells = new Set(), variants = new Map();
        const diverse = candidates.filter(candidate => {
          const key = Math.round(candidate.rect.left / 6) + ':' + Math.round(candidate.rect.top / 6);
          const variant = candidate.direction + ':' + candidate.gap + ':' + candidate.slide;
          const count = variants.get(variant) || 0;
          if (cells.has(key) || count >= 2) return false;
          cells.add(key); variants.set(variant, count + 1); return true;
        });
        return { id, candidates: diverse };
      });
      const constrained = rows.map((_, i) => i).sort((a, b) => size.x < 340 ? metrics[b].height * metrics[b].width - metrics[a].height * metrics[a].width : size.x < 620 ? bounds[a].left + bounds[a].right - bounds[b].left - bounds[b].right : labels[a].candidates.length - labels[b].candidates.length || metrics[b].height * metrics[b].width - metrics[a].height * metrics[a].width);
      const seed = connected(labels, cityMask, constrained, scale, size.x < 620 ? 128 : 48);
      container.dataset.bitmapSeedCount = String(seed.length);
      const preferred = labels.map(label => {
        const first = seed.find(item => item.id === label.id);
        return first ? { ...label, candidates: [first, ...label.candidates] } : label;
      });
      const result = consecutive(base, cityMask, preferred, constrained, scale, { maxChecks: 12000, maxMs: 80 });
      const best = result.placed;
      container.dataset.bitmapAvailable = JSON.stringify(result.available);
      container.dataset.bitmapChecks = String(result.checks);
      container.dataset.bitmapBacktracks = String(result.backtracks);
      container.dataset.bitmapCandidates = JSON.stringify(labels.map(label => label.candidates.length));
      container.dataset.bitmapPlaced = String(best.length);
      container.dataset.bitmapMissing = rows.filter((_, id) => !best.some(item => item.id === id)).map(row => row.label).join('; ');
      if (best.length === rows.length) { placements = best; renderData = annotations; break; }
    }
    if (!placements) {
      scene.style.paddingTop = previous.top; scene.style.paddingBottom = previous.bottom;
      svg.attr('width', previous.width).attr('height', previous.height);
      container.dataset.layoutReady = previous.ready || 'false';
      container.dataset.layoutFailure = 'Bounded placement did not complete; retaining previous layout';
      container.dataset.layoutMs = (performance.now() - started).toFixed(1);
      return;
    }
    delete container.dataset.layoutFailure;
    root.call(d3.annotation().type(d3.annotationCallout).annotations(renderData));
    nodes = root.selectAll('g.annotation').nodes().map((group, i) => {
      const row = rows[i], content = group.querySelector('.annotation-note-content');
      group.dataset.resortId = row.id;
      const title = group.querySelector('title') || document.createElementNS('http://www.w3.org/2000/svg', 'title');
      title.textContent = row.label; if (!title.parentNode) group.prepend(title);
      content.onpointerenter = () => onHover(row.id); content.onpointerleave = () => onHover(null);
      group.querySelectorAll('.annotation-note > path').forEach(path => path.remove());
      return { row, group, content };
    });
    const sceneRect = scene.getBoundingClientRect();
    for (const placed of placements) {
      const { group, content } = nodes[placed.id];
      group.setAttribute('transform', `translate(${placed.anchor.x},${placed.anchor.y})`);
      const note = group.querySelector('.annotation-note'), matrix = note.transform.baseVal.consolidate()?.matrix;
      const current = content.getBoundingClientRect();
      note.setAttribute('transform', `translate(${(matrix?.e || 0) + sceneRect.left + placed.rect.left - current.left},${(matrix?.f || 0) + sceneRect.top + placed.rect.top - current.top})`);
      group.dataset.labelBank = placed.rect.top + metrics[placed.id].height / 2 < padding + map.getSize().y / 2 ? 'top' : 'bottom';
      group.querySelector('.annotation-connector path').setAttribute('d', placed.leader.map((p, i) => `${i ? 'L' : 'M'}${p.x - placed.anchor.x},${p.y - placed.anchor.y}`).join(''));
    }
    color(); svg.style('visibility', '');
    container.dataset.annotationCount = String(rows.length);
    container.dataset.layoutReady = 'true';
    container.dataset.layoutMs = (performance.now() - started).toFixed(1);
    container.dataset.labelAlgorithm = 'occupancy-bitmap-connected-outward';
    map.fire('storyannotationslayout');
  }
  function update() { if (frame === undefined) frame = requestAnimationFrame(draw); }
  map.on('move zoomend resize', update);
  map.on('mapthemechange', color);
  document.fonts.ready.then(update);
  update();
  return { update, setHighlight(value) { selectedId = value?.id; color(); } };
};
