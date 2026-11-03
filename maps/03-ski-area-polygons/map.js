'use strict';
const status = document.querySelector('#status');
async function start() {
  if (!window.L || !window.searchableSelect) throw new Error('Local map library unavailable.');
  const [areas, coverage, context, austria, tirol, annotationData, stateBorders, referenceLabels] = await Promise.all(
    ['ski-areas.geojson', 'coverage.json', 'context.geojson', 'austria.geojson', 'tirol-boundaries.geojson', 'annotations.json?v=zillertal-1', 'state-borders.geojson', 'reference-labels.geojson'].map(async name => {
      const response = await fetch('data/' + name);
      if (!response.ok) throw new Error(name + ' could not be loaded (HTTP ' + response.status + ').');
      return response.json();
    })
  );
  document.querySelector('#polygon-count').textContent = coverage.polygonRecords;
  document.querySelector('#omitted-count').textContent = coverage.omittedRecords;
  document.querySelector('#total-count').textContent = coverage.selectedRecords;
  document.querySelector('#tirol-count').textContent = tirol.metadata.records;
  const records = [...areas.features, ...tirol.features];
  const recordsById = new Map(records.map(f => [f.properties.id, f]));
  const dataset = feature => feature.properties.dataset === 'tirol' ? 'tirol' : 'openskidata';
  const sourceLabel = feature => dataset(feature) === 'tirol' ? 'Tirol planning boundary · 2011' : 'OpenSkiData outline · snapshot 2026-11-02';
  const map = L.map('map', { preferCanvas: true, scrollWheelZoom: false, zoomSnap: .25 });
  for (const [name, zIndex] of [['context', 250], ['political-labels', 310], ['resorts', 420]]) {
    map.createPane(name); map.getPane(name).style.zIndex = zIndex;
  }
  map.getPane('context').style.pointerEvents = 'none';
  const basemap = L.geoJSON(context, {
    pane: 'context', interactive: false,
    style: f => ({ color: '#c8cecb', weight: .7, fillColor: f.properties.iso === 'AUT' ? '#f0f2ef' : '#f8f9f6', fillOpacity: 1 })
  }).addTo(map);
  const border = L.geoJSON(austria, { pane: 'context', interactive: false, style: { color: '#9ca8a5', weight: 1.1, fill: false } }).addTo(map);
  const countryBounds = border.getBounds();
  map.attributionControl.addAttribution('Data: <a href="https://openskidata.org/">OpenSkiData</a> · © <a href="https://www.openstreetmap.org/copyright">OSM contributors</a> · <a href="https://skimap.org/">Skimap.org</a> · <a href="https://whosonfirst.org/">Who’s On First</a> · © <a href="https://mapterhorn.com/">Mapterhorn</a> · Tirol: <a href="https://www.arcgis.com/home/item.html?id=9fb23fac39034eadaff8054fdd35cbf6">Land Tirol – tiris</a> (<a href="https://creativecommons.org/licenses/by/4.0/">CC BY 4.0</a>) · Context: <a href="https://www.naturalearthdata.com/">Natural Earth</a>');
  L.control.scale({ imperial: false, position: 'bottomleft', maxWidth: 100 }).addTo(map);
  L.geoJSON(stateBorders, { pane: 'context', interactive: false,
    style: { color: '#b1bcb7', weight: .7, opacity: .9, dashArray: '2 4', fill: false }
  }).addTo(map);
  map.getPane('political-labels').style.pointerEvents = 'none';
  const politicalLabels = referenceLabels.features.sort((a, b) => a.properties.priority - b.properties.priority).map(feature => {
    const label = document.createElement('span'); label.textContent = feature.properties.name;
    const [lon, lat] = feature.geometry.coordinates;
    const marker = L.marker([lat, lon], { pane: 'political-labels', interactive: false, keyboard: false,
      icon: L.divIcon({ className: 'political-label ' + feature.properties.kind + '-reference', html: label, iconSize: [160, 20], iconAnchor: [80, 10] })
    }).addTo(map);
    return { feature, marker };
  });
  function updatePoliticalLabels() {
    const occupied = Array.from(map.getContainer().querySelectorAll('.annotation-note-content, .leaflet-control-zoom, .leaflet-popup-content-wrapper')).map(node => node.getBoundingClientRect());
    const extent = map.getContainer().getBoundingClientRect();
    // Test painted strokes, not their large bounding boxes: those would hide
    // most useful city labels even when the line does not touch their text.
    const strokePoints = [];
    for (const path of map.getContainer().querySelectorAll('.annotation-connector path, .annotation-subject path, .annotation-note path')) {
      const matrix = path.getScreenCTM(); if (!matrix) continue;
      const length = path.getTotalLength();
      for (let distance = 0; distance <= length; distance += 3) {
        strokePoints.push(path.getPointAtLength(distance).matrixTransform(matrix));
      }
    }
    for (const { feature, marker } of politicalLabels) {
      const element = marker.getElement(); if (!element) continue;
      element.setAttribute('aria-hidden', 'true'); element.style.display = '';
      const rect = element.querySelector('span').getBoundingClientRect();
      const collides = occupied.some(b => rect.left < b.right + 8 && rect.right > b.left - 8 && rect.top < b.bottom + 5 && rect.bottom > b.top - 5);
      const crossesStroke = strokePoints.some(p => p.x >= rect.left - 4 && p.x <= rect.right + 4 && p.y >= rect.top - 4 && p.y <= rect.bottom + 4);
      const outside = rect.left < extent.left + 7 || rect.right > extent.right - 7 || rect.top < extent.top + 7 || rect.bottom > extent.bottom - 22;
      if (map.getZoom() < feature.properties.minZoom || collides || crossesStroke || outside) element.style.display = 'none';
      else occupied.push(rect);
    }
  }
  let politicalFrame;
  function schedulePoliticalLabels() {
    map.getContainer().dataset.labelsReady = 'false';
    if (politicalFrame !== undefined) return;
    politicalFrame = requestAnimationFrame(() => {
      politicalFrame = undefined;
      updatePoliticalLabels();
      map.getContainer().dataset.labelsReady = 'true';
    });
  }
  map.on('moveend zoomend resize storyannotationslayout', schedulePoliticalLabels);
  map.whenReady(schedulePoliticalLabels);
  const background = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 18, attribution: 'Tiles © <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
  });
  background.on('tileerror', () => { document.querySelector('#context-status').textContent = 'Street-map tiles unavailable; the local polygons and country context still work.'; });
  document.querySelector('#street-map').addEventListener('change', event => {
    if (event.target.checked) { background.addTo(map); basemap.setStyle({ fillOpacity: .04 }); }
    else { map.removeLayer(background); basemap.setStyle({ fillOpacity: 1 }); document.querySelector('#context-status').textContent = ''; }
  });
  const baseStyle = { color: '#087c83', weight: 1.3, fillColor: '#138c8c', fillOpacity: .28 };
  const tirolStyle = { color: '#71549b', weight: 1.3, fillColor: '#9782b5', fillOpacity: .2 };
  const styleFor = feature => dataset(feature) === 'tirol' ? tirolStyle : baseStyle;
  const selectedStyle = { color: '#a8522b', weight: 2.5, fillColor: '#c67a48', fillOpacity: .35 };
  const groups = { tirol: L.featureGroup().addTo(map), openskidata: L.featureGroup().addTo(map) };
  const layers = new Map();
  let selectedId;
  let calloutBounds;
  const select = document.querySelector('#resort');
  const search = searchableSelect(select, 'ski areas');
  const displayName = feature => (feature.properties.aliases?.length ? feature.properties.aliases.join(' / ') + ' · ' : '') + (feature.properties.name || 'Unnamed ski-area record');
  const options = records.map(f => ({ value: f.properties.id, label: displayName(f) + ' [' + (dataset(f) === 'tirol' ? 'Tirol 2011 · ' + f.properties.officialObjectId : 'OpenSkiData') + ']' })).sort((a, b) => a.label.localeCompare(b.label));
  search.setOptions(options, 'Choose a ski area…');
  function safeLink(url, text) {
    try {
      const parsed = new URL(url);
      if (!['https:', 'http:'].includes(parsed.protocol)) return null;
      const link = document.createElement('a'); link.href = parsed.href; link.textContent = text; return link;
    } catch { return null; }
  }
  function inspect(feature, zoom) {
    calloutBounds = undefined;
    if (selectedId) layers.get(selectedId)?.setStyle(styleFor(recordsById.get(selectedId)));
    const p = feature.properties;
    const key = dataset(feature);
    if (!map.hasLayer(groups[key])) { groups[key].addTo(map); document.getElementById('layer-' + key).checked = true; }
    selectedId = p.id;
    const layer = layers.get(p.id);
    layer.setStyle(selectedStyle); layer.bringToFront();
    search.setValue(p.id);
    document.querySelector('#selection-title').textContent = displayName(feature);
    document.querySelector('#selection-description').textContent = key === 'tirol' ? 'An official Tirol planning boundary with reference date ' + p.referenceDate + '. This older envelope is not a verified current operational footprint or a piste surface.' : 'The full outline supplied by OpenSkiData. It is not a surveyed piste surface or an independently verified resort boundary.';
    const facts = document.querySelector('#selection-facts'); facts.replaceChildren();
    for (const [field, value] of [
      ['Source and meaning', sourceLabel(feature)],
      ['Original source name', p.originalName || p.name || 'Not recorded'],
      ['Geometry', feature.geometry.type === 'MultiPolygon' ? 'MultiPolygon · several parts in one record' : 'Polygon'],
      ['Source region labels', p.regions.join(', ') || 'Not recorded'],
      ['Status / date qualification', key === 'tirol' ? 'Reference date: ' + p.referenceDate + ' · no live operating status supplied' : p.status + ' · not a live opening report'],
      ['Snapshot downloaded', key === 'tirol' ? tirol.metadata.downloaded : coverage.snapshotDownloaded],
      ['Source record ID', p.id]
    ]) {
      const dt = document.createElement('dt'); dt.textContent = field;
      const dd = document.createElement('dd'); dd.textContent = value;
      facts.append(dt, dd);
    }
    const links = document.querySelector('#selection-links'); links.replaceChildren();
    if (p.sourceUrl) {
      const a = safeLink(p.sourceUrl, 'Official Land Tirol source record'); if (a) links.append(a);
      const license = safeLink('https://creativecommons.org/licenses/by/4.0/', 'License · CC BY 4.0'); links.append(license);
    }
    for (const source of p.sources) {
      let url;
      if (source.type === 'openstreetmap' && /^(node|way|relation)\/\d+$/.test(String(source.id))) url = 'https://www.openstreetmap.org/' + source.id;
      if (source.type === 'skimap.org' && /^\d+$/.test(String(source.id))) url = 'https://skimap.org/SkiAreas/view/' + source.id;
      const a = url && safeLink(url, 'Upstream source · ' + source.type + ' ' + source.id);
      if (a) links.append(a);
    }
    for (const url of p.websites) {
      const a = safeLink(url, 'Resort website'); if (a) links.append(a);
    }
    status.textContent = 'Selected: ' + displayName(feature) + '. ' + sourceLabel(feature) + '. Source layers overlap; they are not separate resort counts.';
    if (zoom) map.fitBounds(layer.getBounds(), { padding: [45, 45], maxZoom: 14, animate: false });
    layer.openPopup();
  }
  for (const [key, features] of [['tirol', tirol.features], ['openskidata', areas.features]]) L.geoJSON({ type: 'FeatureCollection', features }, {
    pane: 'resorts', style: styleFor,
    onEachFeature(feature, layer) {
      layers.set(feature.properties.id, layer);
      const title = document.createElement('strong'); title.textContent = displayName(feature);
      layer.bindTooltip(title);
      const popup = document.createElement('div');
      const heading = document.createElement('strong'); heading.textContent = displayName(feature);
      const description = document.createElement('p'); description.textContent = sourceLabel(feature) + ' · ' + feature.geometry.type + '. Source details appear in the inspector.';
      popup.append(heading, description); layer.bindPopup(popup);
      layer.on('mouseover', () => { if (feature.properties.id !== selectedId) layer.setStyle({ weight: 2.5, color: styleFor(feature).color }); });
      layer.on('mouseout', () => { if (feature.properties.id !== selectedId) layer.setStyle(styleFor(feature)); });
      layer.on('click', () => inspect(feature, false));
    }
  }).addTo(groups[key]);
  function overviewStatus() {
    status.textContent = (map.hasLayer(groups.openskidata) ? coverage.polygonRecords : 0) + ' OpenSkiData outlines + ' + (map.hasLayer(groups.tirol) ? tirol.metadata.records : 0) + ' Tirol planning records visible. Overlaps are not deduplicated; do not sum these as resorts.';
  }
  for (const [key, group] of Object.entries(groups)) {
    const checkbox = document.getElementById('layer-' + key); checkbox.disabled = false;
    checkbox.addEventListener('change', event => {
      if (event.target.checked) group.addTo(map); else map.removeLayer(group);
      overviewStatus();
    });
  }
  function fitOverview() { map.fitBounds(countryBounds, { padding: [25, 25], animate: false }); }
  fitOverview();
  select.addEventListener('change', () => {
    const feature = recordsById.get(select.value);
    if (feature) inspect(feature, true);
  });
  document.querySelector('#overview').disabled = false;
  document.querySelector('#overview').addEventListener('click', () => {
    if (selectedId) layers.get(selectedId)?.setStyle(styleFor(recordsById.get(selectedId)));
    selectedId = undefined; calloutBounds = undefined; map.closePopup(); search.setOptions(options, 'Choose a ski area…'); search.setValue('');
    document.querySelector('#selection-title').textContent = 'Select a polygon to inspect it.';
    document.querySelector('#selection-description').textContent = 'The national overview is restored. Toggle sources to compare; search also reaches small or overlapping records.';
    document.querySelector('#selection-facts').replaceChildren(); document.querySelector('#selection-links').replaceChildren();
    overviewStatus();
    fitOverview();
  });
  const koessen = areas.features.find(f => f.properties.name === 'Hochkössen - Unterberghorn');
  document.querySelector('#koessen').disabled = !koessen;
  document.querySelector('#koessen').addEventListener('click', () => { if (koessen) inspect(koessen, true); });
  const solden = tirol.features.find(f => f.properties.aliases.includes('Sölden'));
  document.querySelector('#solden').disabled = !solden;
  document.querySelector('#solden').addEventListener('click', () => { if (solden) inspect(solden, true); });
  map.on('resize', () => {
    if (!selectedId) fitOverview();
    else map.fitBounds(calloutBounds || layers.get(selectedId).getBounds(), { padding: [45, 45], maxZoom: 14, animate: false });
  });
  skiMapAnnotations({ map, annotations: annotationData.annotations,
    isVisible: spec => map.hasLayer(groups[spec.dataset]),
    inspect: (id, memberIds) => {
      const feature = recordsById.get(id);
      if (!feature) return;
      inspect(feature, false);
      const bounds = L.latLngBounds([]);
      for (const memberId of memberIds) bounds.extend(layers.get(memberId).getBounds());
      calloutBounds = bounds;
      map.fitBounds(bounds, { padding: [55, 55], maxZoom: 14, animate: false });
      document.querySelector('#selection-description').append(' The callout groups nearby planning polygons; this inspector shows its reference record.');
    }
  });
  overviewStatus();
}
start().catch(error => {
  status.textContent = 'Map unavailable: ' + error.message + ' Open this site through an HTTP server, not file://. The explanation and source downloads remain available.';
  console.error(error);
});
