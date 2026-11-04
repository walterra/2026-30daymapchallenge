/* Run after the overview settles at each viewport:
   agent-browser eval --stdin < scripts/check-ski-label-layout.js
   Tests rendered text AND actual SVG connector/circle geometry.
*/
(() => {
  const map = document.querySelector('#map');
  const scene = map.closest('.map-scene');
  const extent = scene.getBoundingClientRect();
  const groups = Array.from(scene.querySelectorAll('g.annotation'));
  const notes = groups.map(group => ({ group, rect: group.querySelector('.annotation-note-content').getBoundingClientRect() }));
  const errors = [];
  if (map.dataset.layoutReady !== 'true' || map.dataset.layoutFailure) errors.push('No completed layout for the current viewport');
  if (map.dataset.antiGravityCenter !== 'Innsbruck') errors.push('Outward preference must use the actual Innsbruck reference');
  const expectedNotes = Number(map.dataset.annotationCount);
  const obstacles = Array.from(scene.querySelectorAll('.label-polygon-obstacles path'), path => ({ id: path.dataset.resortId, name: path.dataset.resortName, path: new Path2D(path.getAttribute('d')) }));
  if (new Set(obstacles.map(obstacle => obstacle.id)).size !== 10) errors.push('Expected ten owner-specific polygon obstacles');
  const context = document.createElement('canvas').getContext('2d');
  const connections = [];
  for (const group of groups) {
    const leader = group.querySelector('.annotation-connector path');
    const svgInverse = leader.ownerSVGElement.getScreenCTM().inverse();
    const matrix = leader.getScreenCTM(), length = leader.getTotalLength();
    const start = leader.getPointAtLength(0).matrixTransform(matrix), end = leader.getPointAtLength(length).matrixTransform(matrix);
    const box = group.querySelector('.annotation-note-content').getBoundingClientRect();
    const guard = { x: Math.max(box.left, Math.min(box.right, start.x)), y: Math.max(box.top, Math.min(box.bottom, start.y)) };
    connections.push({ name: group.querySelector('title')?.textContent, points: [start, end, guard] });
    const center = start.matrixTransform(svgInverse);
    context.lineWidth = 2;
    if (!obstacles.some(obstacle => obstacle.id === group.dataset.resortId && (context.isPointInPath(obstacle.path, center.x, center.y, 'evenodd') || context.isPointInStroke(obstacle.path, center.x, center.y)))) errors.push('Leader does not start in its own polygon: ' + group.querySelector('title')?.textContent);
    for (const obstacle of obstacles) {
      if (obstacle.id === group.dataset.resortId) continue;
      for (let distance = 0; distance <= length; distance += .5) {
        const p = leader.getPointAtLength(distance).matrixTransform(matrix).matrixTransform(svgInverse);
        if (context.isPointInPath(obstacle.path, p.x, p.y, 'evenodd')) {
          errors.push((group.querySelector('title')?.textContent || group.dataset.resortId) + ' leader crosses polygon: ' + obstacle.name); break;
        }
      }
    }
  }
  if (expectedNotes !== 10 || notes.length !== expectedNotes) errors.push('Expected all ' + expectedNotes + ' fixed-map callouts; found ' + notes.length + '. Wait for the map to finish rendering.');
  const orientation = (a, b, c) => (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
  for (let i = 0; i < connections.length; i++) for (let j = i + 1; j < connections.length; j++) {
    for (let a = 1; a < connections[i].points.length; a++) for (let b = 1; b < connections[j].points.length; b++) {
      const [p, q] = connections[i].points.slice(a - 1, a + 1), [r, s] = connections[j].points.slice(b - 1, b + 1);
      if (orientation(p, q, r) * orientation(p, q, s) < -1e-6 && orientation(r, s, p) * orientation(r, s, q) < -1e-6) errors.push('Connected leader/label paths cross: ' + connections[i].name + ' / ' + connections[j].name);
    }
  }
  const legend = map.closest('.map-card').querySelector('.source-legend')?.getBoundingClientRect();
  const overlaps = (a, b, gap = 0) => a.left < b.right + gap && a.right > b.left - gap && a.top < b.bottom + gap && a.bottom > b.top - gap;
  const strokes = groups.flatMap(group => Array.from(group.querySelectorAll('.annotation-connector path, .annotation-subject path, .annotation-note path')).flatMap(path => {
    const matrix = path.getScreenCTM();
    if (!matrix) return [];
    const points = [];
    for (let d = 0, length = path.getTotalLength(); d <= length; d += 1) points.push(path.getPointAtLength(d).matrixTransform(matrix));
    return [{ group, points }];
  }));
  const crosses = (points, rect, gap = 0) => points.some(p => p.x > rect.left - gap && p.x < rect.right + gap && p.y > rect.top - gap && p.y < rect.bottom + gap);
  const paths = groups.flatMap(group => Array.from(group.querySelectorAll('.annotation-connector path')).map(path => {
    const matrix = path.getScreenCTM(), points = [];
    const length = path.getTotalLength();
    for (let d = 0; d < length; d += 3) points.push(path.getPointAtLength(d).matrixTransform(matrix));
    points.push(path.getPointAtLength(length).matrixTransform(matrix));
    return points;
  }));
  const cross = (p, q, r) => (q.x - p.x) * (r.y - p.y) - (q.y - p.y) * (r.x - p.x);
  for (let i = 0; i < paths.length; i++) for (let j = 0; j < i; j++) {
    for (let a = 1; a < paths[i].length; a++) for (let b = 1; b < paths[j].length; b++) {
      const p = paths[i][a - 1], q = paths[i][a], r = paths[j][b - 1], s = paths[j][b];
      if (cross(p, q, r) * cross(p, q, s) < -1e-6 && cross(r, s, p) * cross(r, s, q) < -1e-6) errors.push('annotation leaders cross');
    }
  }
  if (legend && strokes.some(stroke => crosses(stroke.points, legend, 1))) errors.push('inline legend obscures an annotation stroke');
  for (let i = 0; i < notes.length; i++) {
    const { group, rect } = notes[i];
    const name = group.querySelector('.annotation-note-title').textContent;
    if (rect.left < extent.left || rect.right > extent.right || rect.top < extent.top || rect.bottom > extent.bottom) errors.push('clipped note: ' + name);
    if (legend && overlaps(rect, legend, 2)) errors.push('inline legend overlaps annotation: ' + name);
    for (let j = 0; j < i; j++) if (overlaps(rect, notes[j].rect, 2)) errors.push('annotation text overlap: ' + name);
    for (const stroke of strokes) if (stroke.group !== group && crosses(stroke.points, rect)) errors.push('another callout crosses annotation text: ' + name);
  }
  const labels = Array.from(map.querySelectorAll('.political-label')).filter(n => getComputedStyle(n).display !== 'none');
  const labelRects = labels.map(n => n.querySelector('span').getBoundingClientRect());
  labels.forEach((label, i) => {
    const rect = labelRects[i];
    if (legend && overlaps(rect, legend, 2)) errors.push('inline legend overlaps basemap label: ' + label.textContent);
    if (notes.some(note => overlaps(rect, note.rect, 2))) errors.push('annotation text crosses basemap label: ' + label.textContent);
    if (strokes.some(stroke => crosses(stroke.points, rect, 1))) errors.push('connector/circle crosses basemap label: ' + label.textContent);
    for (let j = 0; j < i; j++) if (overlaps(rect, labelRects[j], 2)) errors.push('basemap labels overlap: ' + label.textContent);
  });
  const cityNames = labels.map(node => node.textContent);
  for (const city of ['Bregenz', 'Innsbruck', 'Salzburg']) if (!cityNames.includes(city)) errors.push('Missing city label: ' + city);
  if (!groups.some(group => group.dataset.labelBank === 'top') || !groups.some(group => group.dataset.labelBank === 'bottom')) errors.push('Labels must surround the geographic view');
  const geo = map.getBoundingClientRect();
  if (Math.abs((geo.top + geo.bottom) / 2 - (extent.top + extent.bottom) / 2) > 1) errors.push('Geographic view is not vertically centered');
  if (document.documentElement.scrollWidth > innerWidth) errors.push('horizontal page overflow');
  if (errors.length) throw new Error(errors.join('\n'));
  return { status: 'pass', viewport: innerWidth, annotationNotes: notes.length, visibleBasemapLabels: labels.map(n => n.textContent), checks: ['note bounds', 'note separation', 'cross-callout strokes', 'leaders versus foreign resort polygons', 'full leader-to-label connections', 'polygon-center anchors', 'basemap text versus notes/connectors/circles', 'basemap separation', 'page overflow'] };
})()
