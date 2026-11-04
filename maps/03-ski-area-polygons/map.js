'use strict';
const status = document.querySelector('#status');
async function start() {
  if (!window.L) throw new Error('Local map library unavailable.');
  const [areas, coverage, context, austria, tirol, stateBorders, referenceLabels, ranking, matchReview, region, regionContext] = await Promise.all(
    ['ski-areas.geojson', 'coverage.json', 'context.geojson', 'austria.geojson', 'tirol-boundaries.geojson', 'state-borders.geojson', 'reference-labels.geojson?v=regional-cities-1', 'downhill-ranking.json?v=linked-1', 'polygon-matches.json?v=reviewed-1', 'region-bounds.json', 'region-context.geojson'].map(async name => {
      const response = await fetch('data/' + name);
      if (!response.ok) throw new Error(name + ' could not be loaded (HTTP ' + response.status + ').');
      return response.json();
    })
  );
  document.querySelector('#ranking-count').textContent = ranking.top10.length;
  document.querySelector('#length-count').textContent = ranking.metadata.recordsWithDownhillLength;
  document.querySelector('#missing-length-count').textContent = ranking.metadata.recordsWithoutDownhillLength;
  document.querySelector('#omitted-count').textContent = coverage.omittedRecords;
  const container = document.querySelector('#map');
  container.dataset.annotationCount = '10';
  const map = L.map(container, {
    preferCanvas: true, zoomSnap: .25,
    dragging: false, scrollWheelZoom: false, doubleClickZoom: false,
    touchZoom: false, boxZoom: false, keyboard: false, tapHold: false,
    zoomControl: false, zoomAnimation: false, fadeAnimation: false, trackResize: false
  });
  for (const [name, zIndex] of [['context', 250], ['political-labels', 310], ['resorts', 420]]) {
    map.createPane(name); map.getPane(name).style.zIndex = zIndex;
    map.getPane(name).style.pointerEvents = 'none';
  }
  const basemap = L.geoJSON(context, {
    pane: 'context', interactive: false,
    style: f => ({ stroke: false, fillColor: f.properties.iso === 'AUT' ? '#f0f2ef' : '#f8f9f6', fillOpacity: 1 })
  }).addTo(map);
  const focusLand = L.geoJSON(regionContext, { pane: 'context', interactive: false,
    style: { stroke: false, fillColor: '#f0f2f1', fillOpacity: 1 }
  }).addTo(map);
  const border = L.geoJSON(austria, { pane: 'context', interactive: false,
    style: { color: '#9ca8a5', weight: 1.1, fill: false }
  }).addTo(map);
  const [west, south, east, north] = region.bbox;
  const regionBounds = L.latLngBounds([south, west], [north, east]);
  container.dataset.region = region.states.join(', ');
  map.attributionControl.addAttribution('Data: <a href="https://openskidata.org/">OpenSkiData</a> · © <a href="https://www.openstreetmap.org/copyright">OSM contributors</a> · <a href="https://skimap.org/">Skimap.org</a> · <a href="https://whosonfirst.org/">Who’s On First</a> · © <a href="https://mapterhorn.com/">Mapterhorn</a> · Tirol: <a href="https://www.arcgis.com/home/item.html?id=9fb23fac39034eadaff8054fdd35cbf6">Land Tirol – tiris</a> (<a href="https://creativecommons.org/licenses/by/4.0/">CC BY 4.0</a>) · Context: <a href="https://www.naturalearthdata.com/">Natural Earth</a>');
  const scale = L.control.scale({ imperial: false, position: 'bottomleft', maxWidth: 100 }).addTo(map);
  const footer = container.closest('.map-card').querySelector('.map-footer');
  footer.prepend(scale.getContainer());
  footer.append(map.attributionControl.getContainer());
  const stateLayer = L.geoJSON(stateBorders, { pane: 'context', interactive: false,
    style: { color: '#b1bcb7', weight: .7, opacity: .9, dashArray: '2 4', fill: false }
  }).addTo(map);
  const politicalLabels = referenceLabels.features.sort((a, b) => a.properties.priority - b.properties.priority).map(feature => {
    const label = document.createElement('span'); label.textContent = feature.properties.name;
    const html = document.createElement('div'); html.append(label);
    if (feature.properties.required) {
      const dot = document.createElement('i'); dot.className = 'city-dot';
      html.prepend(dot);
    }
    const [lon, lat] = feature.geometry.coordinates;
    const marker = L.marker([lat, lon], { pane: 'political-labels', interactive: false, keyboard: false,
      icon: L.divIcon({ className: 'political-label ' + feature.properties.kind + '-reference', html, iconSize: [160, 20], iconAnchor: [80, 10] })
    }).addTo(map);
    return { feature, marker };
  });
  function updatePoliticalLabels() {
    const occupied = Array.from(container.closest('.map-scene').querySelectorAll('.annotation-note-content')).map(node => node.getBoundingClientRect());
    const extent = container.getBoundingClientRect();
    const strokePoints = [];
    for (const path of container.closest('.map-scene').querySelectorAll('.annotation-connector path, .annotation-subject path, .annotation-note path')) {
      const matrix = path.getScreenCTM(); if (!matrix) continue;
      const length = path.getTotalLength();
      for (let distance = 0; distance <= length; distance += 3) strokePoints.push(path.getPointAtLength(distance).matrixTransform(matrix));
    }
    for (const { feature, marker } of politicalLabels) {
      const element = marker.getElement(); if (!element) continue;
      element.setAttribute('aria-hidden', 'true'); element.style.display = '';
      const span = element.querySelector('span');
      span.style.display = 'inline-block';
      // City names stay attached to their true points; resort labels yield to them.
      const offsets = feature.properties.required ? [[0, -14]] : [[0, 0]];
      let placed = false;
      for (const [x, y] of offsets) {
        span.style.transform = `translate(${x}px,${y}px)`;
        const rect = span.getBoundingClientRect();
        const collides = occupied.some(b => rect.left < b.right + 8 && rect.right > b.left - 8 && rect.top < b.bottom + 5 && rect.bottom > b.top - 5);
        const crossesStroke = strokePoints.some(p => p.x >= rect.left - 4 && p.x <= rect.right + 4 && p.y >= rect.top - 4 && p.y <= rect.bottom + 4);
        const outside = rect.left < extent.left + 7 || rect.right > extent.right - 7 || rect.top < extent.top + 7 || rect.bottom > extent.bottom - 7;
        if (map.getZoom() >= feature.properties.minZoom && !outside && (feature.properties.required || (!collides && !crossesStroke))) {
          const line = element.querySelector('.city-reference-leader line');
          if (line) {
            const icon = element.getBoundingClientRect(), dotX = icon.left + 80, dotY = icon.top + 10;
            const targetX = Math.max(rect.left, Math.min(rect.right, dotX));
            const targetY = Math.max(rect.top, Math.min(rect.bottom, dotY));
            line.setAttribute('x2', targetX - icon.left); line.setAttribute('y2', targetY - icon.top + 70);
            line.style.display = Math.hypot(targetX - dotX, targetY - dotY) > 10 ? '' : 'none';
          }
          occupied.push(rect); placed = true; break;
        }
      }
      if (!placed) element.style.display = 'none';
    }
  }
  let politicalFrame;
  function schedulePoliticalLabels() {
    container.dataset.labelsReady = 'false';
    if (politicalFrame !== undefined) return;
    politicalFrame = requestAnimationFrame(() => {
      politicalFrame = undefined;
      updatePoliticalLabels();
      container.dataset.labelsReady = 'true';
    });
  }
  map.on('moveend zoomend resize storyannotationslayout', schedulePoliticalLabels);
  map.whenReady(schedulePoliticalLabels);
  const planningFeatures = new Map(tirol.features.map(feature => [feature.properties.id, feature]));
  const matches = new Map(matchReview.matches.map(match => [match.openSkiDataId, match]));
  function vertices(coords) {
    return typeof coords[0] === 'number' ? [coords.slice(0, 2)] : coords.flatMap(vertices);
  }
  const displayRows = ranking.top10.map(row => {
    const match = matches.get(row.id);
    if (row.mapReference.kind !== 'point' || !match) return row;
    const points = match.polygonIds.flatMap(id => {
      const feature = planningFeatures.get(id);
      if (!feature) throw Error('Missing reviewed planning polygon: ' + id);
      return vertices(feature.geometry.coordinates);
    });
    const [lon, lat] = row.mapReference.coordinates;
    const anchor = points.reduce((best, p) => (p[0] - lon) ** 2 + (p[1] - lat) ** 2 < (best[0] - lon) ** 2 + (best[1] - lat) ** 2 ? p : best);
    return { ...row, planningMatch: match, mapReference: { kind: 'planning-outline', coordinates: anchor, polygonIds: match.polygonIds } };
  });
  const matchedPlanningIds = new Set(displayRows.flatMap(row => row.planningMatch?.polygonIds || []));
  const rankedIds = new Set(ranking.top10.map(row => row.id));
  const baseStyle = { color: '#a5adaa', weight: .65, fill: false, opacity: .4 };
  const tirolStyle = { color: '#a5adaa', weight: .7, dashArray: '3 3', fill: false, opacity: .4 };
  // Navigation stays disabled; ranking only highlights source geometry.
  const tirolLayer = L.geoJSON(tirol, { pane: 'resorts', interactive: false, style: tirolStyle }).addTo(map);
  const areaLayer = L.geoJSON(areas, { pane: 'resorts', interactive: false, style: baseStyle }).addTo(map);
  const planningLayers = new Map();
  tirolLayer.eachLayer(layer => planningLayers.set(layer.feature.properties.id, layer));
  const outlineLayers = new Map();
  areaLayer.eachLayer(layer => outlineLayers.set(layer.feature.properties.id, layer));
  const referenceMarkers = new Map();
  for (const row of displayRows) {
    if (row.mapReference.kind !== 'point') continue;
    const [lon, lat] = row.mapReference.coordinates;
    referenceMarkers.set(row.id, L.circleMarker([lat, lon], { pane: 'resorts', interactive: false, radius: 5, weight: 1.5 }));
  }
  container.dataset.rankedOutlines = String(ranking.top10.filter(row => row.mapReference.kind === 'outline').length);
  container.dataset.rankedPoints = String(referenceMarkers.size);
  container.dataset.rankedPlanning = String(displayRows.filter(row => row.planningMatch).length);
  container.dataset.rankedPlanningPolygons = String(matchedPlanningIds.size);
  let activeRow;
  let pointMarker;
  function paintHighlight() {
    if (pointMarker) { map.removeLayer(pointMarker); pointMarker = undefined; }
    if (!activeRow) return;
    const color = getComputedStyle(document.documentElement).getPropertyValue('--color-accent').trim();
    if (activeRow.mapReference.kind === 'outline') {
      const layer = outlineLayers.get(activeRow.id);
      if (layer) { layer.setStyle({ color, fillColor: color }); }
    } else if (activeRow.planningMatch) {
      for (const id of activeRow.planningMatch.polygonIds) {
        const layer = planningLayers.get(id);
        layer.setStyle({ color, fillColor: color });
      }
    } else {
      const [lon, lat] = activeRow.mapReference.coordinates;
      pointMarker = L.circleMarker([lat, lon], { pane: 'resorts', interactive: false, radius: 7, color, weight: 2.5, fillColor: color, fillOpacity: .2 }).addTo(map);
    }
  }
  function applyMapTheme() {
    const styles = getComputedStyle(document.documentElement);
    const token = name => styles.getPropertyValue(name).trim();
    const dark = document.documentElement.dataset.theme === 'dark' || (!document.documentElement.dataset.theme && matchMedia('(prefers-color-scheme: dark)').matches);
    const colors = dark
      ? { land: '#262a2c', neighbor: '#1d1f20', country: '#697175', state: '#4c5559' }
      : { land: '#f0f2f1', neighbor: '#fafafa', country: '#929c9c', state: '#bac1c0' };
    basemap.setStyle({ fillColor: colors.neighbor, color: colors.state });
    focusLand.setStyle({ fillColor: colors.land });
    border.setStyle({ color: colors.country });
    stateLayer.setStyle({ color: colors.state });
    const contextColor = dark ? '#68716e' : '#adb5b2';
    areaLayer.setStyle(feature => rankedIds.has(feature.properties.id)
      ? { color: token('--color-link'), weight: 1.5, fill: true, fillColor: token('--color-link'), fillOpacity: dark ? .24 : .28, opacity: 1 }
      : { color: contextColor, weight: .65, fill: false, fillOpacity: 0, opacity: .35 });
    tirolLayer.setStyle(feature => matchedPlanningIds.has(feature.properties.id)
      ? { color: token('--color-link'), weight: 1.5, dashArray: '4 3', fill: true, fillColor: token('--color-link'), fillOpacity: dark ? .18 : .2, opacity: 1 }
      : { color: contextColor, weight: .7, dashArray: '3 3', fill: false, fillOpacity: 0, opacity: .4 });
    for (const marker of referenceMarkers.values()) marker.setStyle({ color: token('--color-link'), fillColor: token('--color-global-bg'), fillOpacity: 1 });
    paintHighlight();
    map.fire('mapthemechange');
    schedulePoliticalLabels();
  }
  applyMapTheme();
  new MutationObserver(applyMapTheme).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  function fitOverview() {
    if (!container.clientWidth || !container.clientHeight) return;
    map.fitBounds(regionBounds, { padding: [25, 25], animate: false });
  }
  fitOverview();
  for (const marker of referenceMarkers.values()) marker.addTo(map);
  // Refit after layout settles, never recursively inside Leaflet's resize event.
  // Ignore temporary zero-size states during viewport/capture transitions.
  let resizeFrame;
  function scheduleFit() {
    if (resizeFrame !== undefined) return;
    resizeFrame = requestAnimationFrame(() => {
      resizeFrame = undefined;
      if (!container.clientWidth || !container.clientHeight) return;
      const size = map.getSize();
      if (size.x === container.clientWidth && size.y === container.clientHeight) return;
      map.invalidateSize({ pan: false, animate: false });
      fitOverview();
    });
  }
  if (window.ResizeObserver) new ResizeObserver(scheduleFit).observe(container);
  else window.addEventListener('resize', scheduleFit);
  map.on('moveend zoomend', () => {
    const center = map.getCenter();
    container.dataset.view = JSON.stringify([center.lat, center.lng, map.getZoom()]);
  });
  const center = map.getCenter();
  container.dataset.view = JSON.stringify([center.lat, center.lng, map.getZoom()]);
  const labelAreas = displayRows.map(row => row.planningMatch
    ? row.planningMatch.polygonIds.reduce((bounds, id) => bounds.extend(planningLayers.get(id).getBounds()), L.latLngBounds([]))
    : outlineLayers.get(row.id)?.getBounds()).filter(Boolean);
  const labelShapes = Object.fromEntries(displayRows.map(row => [row.id, row.planningMatch
    ? row.planningMatch.polygonIds.map(id => planningLayers.get(id).feature.geometry)
    : [outlineLayers.get(row.id).feature.geometry]]));
  const labelMarks = [...areaLayer.getLayers().filter(layer => rankedIds.has(layer.feature.properties.id)), ...tirolLayer.getLayers().filter(layer => matchedPlanningIds.has(layer.feature.properties.id))].map(layer => ({
    geometry: layer.feature.geometry, fill: !!layer.options.fill && layer.options.fillOpacity > 0,
    stroke: layer.options.stroke !== false, width: layer.options.weight || 1,
    dash: typeof layer.options.dashArray === 'string' ? layer.options.dashArray.split(/\s+/).map(Number) : []
  }));
  const story = skiMapAnnotations({ map, rows: displayRows, cities: referenceLabels.features.filter(feature => feature.properties.required), marks: labelMarks, shapes: labelShapes, land: regionContext.features.map(feature => feature.geometry), onHover: updateLinkedHighlight });
  const rankRows = new Map(displayRows.map(row => [row.id, row]));
  const buttons = Array.from(document.querySelectorAll('.ranking-row'));
  let renderedId;
  function updateLinkedHighlight(id = null) {
    for (const button of buttons) {
      button.classList.toggle('is-map-active', button.dataset.sourceId === id);
      button.setAttribute('aria-pressed', String(button.dataset.sourceId === id));
    }
    if (id === renderedId) return;
    renderedId = id;
    activeRow = rankRows.get(id);
    container.dataset.activeResort = activeRow?.id || '';
    container.dataset.activeKind = activeRow?.mapReference.kind || '';
    container.dataset.activePolygonIds = JSON.stringify(activeRow ? activeRow.planningMatch?.polygonIds || [activeRow.id] : []);
    applyMapTheme();
    story.setHighlight(activeRow);
    document.querySelector('#ranking-map-status').textContent = activeRow ? 'Map: ' + activeRow.label + '. ' + (activeRow.planningMatch ? 'Matched 2011 Tirol planning polygons. ' + activeRow.planningMatch.qualification : 'Source outline highlighted.') : '';
  }
  const clear = id => { if (renderedId === id) updateLinkedHighlight(null); };
  for (const button of buttons) {
    const id = button.dataset.sourceId;
    button.disabled = false;
    button.addEventListener('pointerenter', event => { if (event.pointerType === 'mouse') updateLinkedHighlight(id); });
    button.addEventListener('focus', () => updateLinkedHighlight(id));
    button.addEventListener('blur', () => clear(id));
    button.addEventListener('click', () => updateLinkedHighlight(id));
  }
  document.querySelector('.downhill-ranking').addEventListener('pointerleave', () => updateLinkedHighlight(null));
  // The shared canvas only hit-tests ranked features; background geometry is inert.
  map.getPane('resorts').style.pointerEvents = 'auto';
  for (const row of displayRows) {
    const layers = row.planningMatch ? row.planningMatch.polygonIds.map(id => planningLayers.get(id)) : [outlineLayers.get(row.id)];
    for (const layer of layers.filter(Boolean)) {
      layer.options.interactive = true;
      layer.on('mouseover', () => updateLinkedHighlight(row.id));
      layer.on('mouseout', () => clear(row.id));
    }
  }
  container.closest('.map-scene').addEventListener('pointerleave', () => updateLinkedHighlight(null));
  document.addEventListener('keydown', event => { if (event.key === 'Escape') updateLinkedHighlight(null); });
  updateLinkedHighlight(null);
  container.dataset.ready = 'true';
  status.hidden = true;
}
start().catch(error => {
  status.hidden = false;
  status.textContent = 'Map unavailable: ' + error.message + ' The description and source downloads remain available.';
  console.error(error);
});
