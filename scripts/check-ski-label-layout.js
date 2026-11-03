/* Run after the overview settles at each viewport:
   agent-browser eval --stdin < scripts/check-ski-label-layout.js
   Tests rendered text AND actual SVG connector/circle geometry.
*/
(() => {
  const map = document.querySelector('#map');
  const extent = map.getBoundingClientRect();
  const groups = Array.from(map.querySelectorAll('g.annotation'));
  const notes = groups.map(group => ({ group, rect: group.querySelector('.annotation-note-content').getBoundingClientRect() }));
  const errors = [];
  const expectedNotes = Number(map.dataset.annotationCount);
  if (!expectedNotes || notes.length !== expectedNotes) errors.push('Expected all ' + expectedNotes + ' fixed-map callouts; found ' + notes.length + '. Wait for the map to finish rendering.');
  const legend = map.querySelector('.source-legend')?.getBoundingClientRect();
  const overlaps = (a, b, gap = 0) => a.left < b.right + gap && a.right > b.left - gap && a.top < b.bottom + gap && a.bottom > b.top - gap;
  const strokes = groups.flatMap(group => Array.from(group.querySelectorAll('.annotation-connector path, .annotation-subject path, .annotation-note path')).flatMap(path => {
    const matrix = path.getScreenCTM();
    if (!matrix) return [];
    const points = [];
    for (let d = 0, length = path.getTotalLength(); d <= length; d += 1) points.push(path.getPointAtLength(d).matrixTransform(matrix));
    return [{ group, points }];
  }));
  const crosses = (points, rect, gap = 0) => points.some(p => p.x > rect.left - gap && p.x < rect.right + gap && p.y > rect.top - gap && p.y < rect.bottom + gap);
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
  if (document.documentElement.scrollWidth > innerWidth) errors.push('horizontal page overflow');
  if (errors.length) throw new Error(errors.join('\n'));
  return { status: 'pass', viewport: innerWidth, annotationNotes: notes.length, visibleBasemapLabels: labels.map(n => n.textContent), checks: ['note bounds', 'note separation', 'cross-callout strokes', 'basemap text versus notes/connectors/circles', 'basemap separation', 'page overflow'] };
})()
