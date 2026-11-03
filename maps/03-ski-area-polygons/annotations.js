/* Permanent boundary labels. Hover changes classes/colors, never layout or nodes. */
'use strict';
window.skiMapAnnotations = function ({ map, rows }) {
  const container = map.getContainer();
  const scene = container.closest('.map-scene');
  const ns = 'http://www.w3.org/2000/svg';
  const make = (tag, attrs = {}) => {
    const element = document.createElementNS(ns, tag);
    for (const [key, value] of Object.entries(attrs)) element.setAttribute(key, value);
    return element;
  };
  const svg = make('svg', { class: 'map-annotations', 'aria-hidden': 'true' });
  scene.append(svg);
  const groups = rows.map(row => {
    const group = make('g', { class: 'annotation', 'data-resort-id': row.id });
    const connector = make('g', { class: 'annotation-connector' });
    const path = make('path'); connector.append(path);
    const note = make('g', { class: 'annotation-note' });
    const content = make('g', { class: 'annotation-note-content' });
    const bg = make('rect', { class: 'annotation-note-bg', rx: 2 });
    const text = make('text', { class: 'annotation-note-title' });
    const title = make('title'); title.textContent = row.label;
    content.append(bg, text); note.append(content); group.append(title, connector, note); svg.append(group);
    return { row, group, path, content, bg, text };
  });
  let selectedId, frame;
  function color() {
    for (const item of groups) item.group.classList.toggle('is-map-active', item.row.id === selectedId);
  }
  const intersects = (a, b, c, d) => {
    const cross = (p, q, r) => (q.x - p.x) * (r.y - p.y) - (q.y - p.y) * (r.x - p.x);
    return cross(a, b, c) * cross(a, b, d) < -1e-6 && cross(c, d, a) * cross(c, d, b) < -1e-6;
  };
  function draw() {
    frame = undefined;
    const size = map.getSize();
    if (!size.x || !size.y) return;
    const columns = Math.min(5, Math.max(2, Math.floor((size.x - 12) / 147)));
    const margin = 12, gap = 12, cell = (size.x - margin * 2 - gap * (columns - 1)) / columns;
    const slots = [];
    for (let column = 0; column < columns; column++) {
      const count = Math.floor(rows.length / columns) + Number(column < rows.length % columns);
      for (let row = 0; row < count; row++) slots.push({ column, row, x: margin + column * (cell + gap), port: margin + (column + 1) * cell + column * gap - 5 - row * 3 });
    }
    const anchors = groups.map(item => {
      const [lon, lat] = item.row.mapReference.coordinates;
      return map.latLngToContainerPoint([lat, lon]);
    });
    // Begin in west-to-east order. Within each column the upper label gets
    // the outer gutter lane, so horizontal branches cannot cross lower notes.
    let order = anchors.map((_, i) => i).sort((a, b) => anchors[a].x - anchors[b].x);
    let byPort = slots.map((_, i) => i).sort((a, b) => slots[a].port - slots[b].port);
    let assignment = slots.map(() => 0);
    byPort.forEach((slot, i) => { assignment[slot] = order[i]; });
    function score(indices) {
      let value = 0;
      for (let i = 0; i < indices.length; i++) {
        const a = anchors[indices[i]], b = { x: slots[i].port, y: 8 };
        value += (a.x - b.x) ** 2 + (a.y - b.y) ** 2;
        for (let j = 0; j < i; j++) if (intersects(a, b, anchors[indices[j]], { x: slots[j].port, y: 8 })) value += 1e9;
      }
      return value;
    }
    // Deterministic pair-swap descent prioritizes uncrossed fan leaders.
    let best = score(assignment);
    for (let pass = 0; pass < 20; pass++) {
      let changed = false;
      for (let a = 0; a < assignment.length; a++) for (let b = a + 1; b < assignment.length; b++) {
        const next = assignment.slice(); [next[a], next[b]] = [next[b], next[a]];
        const cost = score(next);
        if (cost < best - .01) { assignment = next; best = cost; changed = true; }
      }
      if (!changed) break;
    }
    const fontSize = parseFloat(getComputedStyle(svg).fontSize), lineHeight = Math.ceil(fontSize * 1.3);
    const probe = make('text', { class: 'annotation-note-title', x: -10000 }); svg.append(probe);
    const measure = value => { probe.textContent = value; return probe.getComputedTextLength(); };
    const wrap = label => {
      const lines = []; let line = '';
      for (const word of label.replace(/–/g, '– ').split(/\s+/)) {
        const candidate = line ? line + ' ' + word : word;
        if (line && measure(candidate) > cell - 30) { lines.push(line); line = word; }
        else line = candidate;
      }
      if (line) lines.push(line);
      return lines;
    };
    const bottoms = Array(columns).fill(12);
    const positions = slots.map((slot, i) => {
      const item = groups[assignment[i]], lines = wrap(item.row.label);
      const width = Math.max(...lines.map(measure)), height = lines.length * lineHeight;
      const position = { ...slot, item, lines, width, height, y: bottoms[slot.column] };
      bottoms[slot.column] += height + 14;
      return position;
    });
    probe.remove();
    const bankHeight = Math.ceil(Math.max(...bottoms) + 4);
    if (scene.style.paddingTop !== bankHeight + 'px') scene.style.paddingTop = bankHeight + 'px';
    svg.setAttribute('width', size.x); svg.setAttribute('height', bankHeight + size.y);
    for (const position of positions) {
      const { item, x, y, width, height, lines, port } = position;
      item.content.setAttribute('transform', `translate(${x},${y})`);
      item.bg.setAttribute('x', -4); item.bg.setAttribute('y', -3);
      item.bg.setAttribute('width', width + 8); item.bg.setAttribute('height', height + 6);
      item.text.replaceChildren(...lines.map((line, i) => {
        const span = make('tspan', { x: 0, y: fontSize + i * lineHeight }); span.textContent = line; return span;
      }));
      const anchor = anchors[groups.indexOf(item)], mid = y + height / 2;
      item.path.setAttribute('d', `M${anchor.x},${bankHeight + anchor.y}L${port},${bankHeight + 8}L${port},${mid}L${x + width + 6},${mid}`);
    }
    color();
    container.dataset.annotationCount = String(groups.length);
    container.dataset.labelCrossings = String(Math.floor(best / 1e9));
    map.fire('storyannotationslayout');
  }
  function update() { if (frame === undefined) frame = requestAnimationFrame(draw); }
  map.on('move zoomend resize', update);
  map.on('mapthemechange', color);
  document.fonts.ready.then(update);
  update();
  return { update, setHighlight(value) { selectedId = value?.id; color(); } };
};
