'use strict';
const status = document.querySelector('#status');
async function start() {
  if (!window.L || !window.searchableSelect) throw new Error('Local map scripts unavailable.');
  const response = await fetch('data/water.geojson');
  if (!response.ok) throw new Error('Local snapshot unavailable (HTTP ' + response.status + ').');
  const data = await response.json();
  const meta = data.metadata;
  const points = data.features.filter(f => f.geometry.type === 'Point');
  const links = data.features.filter(f => f.geometry.type === 'LineString');
  const number = n => n.toLocaleString('en');
  const sourceUrl = id => 'https://wis.tirol.gv.at/wisSrvPublic/wis/wbo_wb_auszug.aspx?ATTR=Y&TREE=Y&PICTURE=N&ANL_ID=' + encodeURIComponent(id) + '&GIS=WWW_GIS_URL';
  const map = L.map('map', { scrollWheelZoom: false, preferCanvas: true, zoomSnap: .25 });
  map.createPane('context');
  map.getPane('context').style.zIndex = 250;
  map.getPane('context').style.pointerEvents = 'none';
  let outline;
  try {
    const contextResponse = await fetch('data/tirol-outline.geojson');
    if (!contextResponse.ok) throw new Error('Context unavailable');
    outline = await contextResponse.json();
    const contextLayer = L.geoJSON(outline, { pane: 'context', style: { color: '#9bafaa', weight: 1, fillColor: '#dfe9e5', fillOpacity: .65 }, interactive: false }).addTo(map);
    map.on('zoomend', () => contextLayer.setStyle({ fillOpacity: map.getZoom() >= 11 ? .05 : .65 }));
    map.attributionControl.addAttribution('Context: <a href="https://gis.tirol.gv.at/arcgis/rest/services/Service_Public/ogd_basis/MapServer/42">Land Tirol</a>');
    const polygons = outline.features[0].geometry.coordinates;
    for (const [index, name] of [[0, 'North Tirol'], [1, 'East Tirol']]) {
      const ring = polygons[index][0];
      const lons = ring.map(c => c[0]); const lats = ring.map(c => c[1]);
      const lat = index === 0 ? Math.max(...lats) + .025 : Math.min(...lats) - .025;
      L.marker([lat, (Math.min(...lons) + Math.max(...lons)) / 2], { pane: 'context', interactive: false, keyboard: false, icon: L.divIcon({ className: 'region-label', html: name, iconSize: [100, 20], iconAnchor: [50, 10] }) }).addTo(map);
    }
    // Tile-free overview inset, shown only when the main map is zoomed in.
    const insetControl = L.control({ position: 'topright' });
    let insetMap;
    let viewport;
    let insetContainer;
    let mini;
    const outlineBounds = L.geoJSON(outline).getBounds();
    insetControl.onAdd = () => {
      insetContainer = L.DomUtil.create('div', 'inset-wrap');
      insetContainer.setAttribute('aria-hidden', 'true');
      const title = document.createElement('div'); title.className = 'inset-title'; title.textContent = 'View within Tirol';
      mini = document.createElement('div'); mini.className = 'inset-map';
      insetContainer.append(title, mini);
      L.DomEvent.disableClickPropagation(insetContainer);
      return insetContainer;
    };
    // Main view must have a valid center before building the inset.
    map.once('moveend', () => {
      insetControl.addTo(map);
      const refresh = () => {
        insetContainer.hidden = map.getZoom() < 10;
        if (!insetContainer.hidden) {
          // Initialize only once attached and visible: detached/hidden maps
          // have zero dimensions and can produce invalid geographic centers.
          if (!insetMap) {
            insetMap = L.map(mini, { zoomControl: false, attributionControl: false, dragging: false, scrollWheelZoom: false, doubleClickZoom: false, touchZoom: false, boxZoom: false, keyboard: false, trackResize: false, zoomSnap: 0, zoomAnimation: false, fadeAnimation: false });
            L.geoJSON(outline, { style: { color: '#9bafaa', weight: 1, fillColor: '#dfe9e5', fillOpacity: 1 }, interactive: false }).addTo(insetMap);
            insetMap.fitBounds(outlineBounds, { padding: [3, 3], animate: false });
            viewport = L.rectangle(map.getBounds(), { color: '#086b78', weight: 1.5, fillOpacity: .1, interactive: false }).addTo(insetMap);
          } else {
            insetMap.invalidateSize({ pan: false, animate: false });
            insetMap.fitBounds(outlineBounds, { padding: [3, 3], animate: false });
          }
          viewport.setBounds(map.getBounds());
        }
      };
      map.on('moveend resize', refresh); refresh();
    });
  } catch (error) {
    document.querySelector('#tile-status').textContent = 'Local geographic context unavailable; enable the street map for orientation.';
  }
  const background = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 18,
    attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
  });
  background.on('tileerror', () => { document.querySelector('#tile-status').textContent = 'Background tiles unavailable; local infrastructure still works.'; });
  const groups = { connections: L.layerGroup(), reservoirs: L.layerGroup().addTo(map), facilities: L.layerGroup() };
  const districtSelect = document.querySelector('#district');
  const systemSelect = document.querySelector('#system');
  const facilitySelect = document.querySelector('#facility');
  const districtSearch = searchableSelect(districtSelect, 'districts');
  const systemSearch = searchableSelect(systemSelect, 'systems');
  const facilitySearch = searchableSelect(facilitySelect, 'facilities');
  let district = '*';
  let system = '*';
  let visible = points;
  let markers = new Map();
  let bounds;
  let associationCount = 0;
  const maxVolume = Math.max(...points.map(f => f.properties.usableM3 || 0), 1);
  let maxRadius = window.matchMedia('(max-width: 700px)').matches ? 16 : 28;
  const symbolRadius = value => maxRadius * Math.sqrt(value / maxVolume);
  function drawSizeLegend() {
    const svg = document.querySelector('#size-legend');
    svg.replaceChildren();
    for (const [index, value] of [10000, 100000, 400000].entries()) {
      const radius = symbolRadius(value);
      const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      for (const [key, val] of Object.entries({ cx: [25, 92, 172][index], cy: 65 - radius, r: radius, fill: '#2b969d', 'fill-opacity': .42, stroke: '#086570', 'stroke-width': 1, 'data-value': value })) circle.setAttribute(key, val);
      const label = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      label.setAttribute('x', [25, 92, 172][index]); label.setAttribute('y', 84); label.setAttribute('text-anchor', 'middle'); label.setAttribute('font-size', '11'); label.setAttribute('fill', '#40585f'); label.textContent = number(value);
      svg.append(circle, label);
    }
  }
  drawSizeLegend();
  function tooltipOptions(p, radius, count, largest) {
    const pinned = p.kind === 'reservoir' && count <= 3 && system !== '*' && !window.matchMedia('(max-width: 700px)').matches;
    const direction = pinned ? p.usableM3 === largest ? 'left' : 'right' : 'auto';
    return { permanent: pinned, direction, offset: pinned ? [direction === 'left' ? -radius - 4 : radius + 4, 0] : [0, 0], className: 'facility-tooltip' };
  }
  function syncConnections() {
    const show = document.querySelector('#connections').checked && map.getZoom() >= 11;
    if (show) groups.connections.addTo(map); else map.removeLayer(groups.connections);
    document.querySelector('#connection-note').textContent = associationCount + ' associations in this selection; ' + (show ? 'shown' : 'visible from zoom 11') + '. These are record relationships, not pipe routes or flow direction.';
  }
  map.on('zoomend', syncConnections);
  const sorted = items => items.sort((a, b) => a.label.localeCompare(b.label));
  districtSearch.setOptions([{ value: '*', label: 'All Tirol districts' }, ...meta.districts.map(d => ({ value: d.district, label: d.district }))], 'Choose a district…');
  districtSelect.value = '*';
  function updateSystems() {
    const systems = meta.systems.filter(s => district === '*' || s.districts.includes(district));
    systemSearch.setOptions([{ value: '*', label: 'All systems in scope' }, ...sorted(systems.map(s => ({ value: s.id, label: s.name })))], 'Choose a system…');
    systemSelect.value = '*';
  }
  function describe(feature) {
    const p = feature.properties;
    document.querySelector('#detail-title').textContent = p.name;
    document.querySelector('#detail-text').textContent = p.type + ' · Register status: ' + (p.status || 'unknown') + '. District search: ' + p.districts.join(', ') + '. ' + (p.coordinateSource || 'No verified map anchor for this system record; associated facilities may be mapped.');
    const facts = document.querySelector('#detail-facts');
    facts.replaceChildren();
    for (const [key, value] of Object.entries(p.attributes)) {
      const dt = document.createElement('dt'); dt.textContent = key;
      const dd = document.createElement('dd'); dd.textContent = value;
      facts.append(dt, dd);
    }
    const source = document.querySelector('#detail-source');
    source.replaceChildren();
    const link = document.createElement('a');
    link.href = sourceUrl(p.id); link.textContent = 'Official facility record · ' + p.id;
    source.append(link);
    for (const id of p.reports) {
      const reportLink = document.createElement('a');
      reportLink.href = sourceUrl(id); reportLink.textContent = 'Enclosing system report · ' + id;
      source.append(document.createElement('br'), reportLink);
    }
  }
  function inspect(feature, zoom) {
    const p = feature.properties;
    describe(feature);
    facilitySearch.setValue(p.id);
    const group = p.kind === 'reservoir' ? 'reservoirs' : 'facilities';
    if (!map.hasLayer(groups[group])) {
      groups[group].addTo(map);
      document.getElementById(group).checked = true;
    }
    if (zoom) map.setView([...feature.geometry.coordinates].reverse(), 15, { animate: false });
    markers.get(p.id).openPopup();
  }
  function fit() {
    if (bounds && bounds.isValid()) map.fitBounds(bounds, { paddingTopLeft: [35, 35], paddingBottomRight: [35, system === '*' ? 35 : 100], maxZoom: 14, animate: false });
  }
  function render() {
    for (const group of Object.values(groups)) group.clearLayers();
    markers = new Map();
    visible = points.filter(f => (district === '*' || f.properties.districts.includes(district)) && (system === '*' || f.properties.reports.includes(system)));
    const ids = new Set(visible.map(f => f.properties.id));
    const associations = links.filter(f => ids.has(f.properties.parent) && ids.has(f.properties.child));
    associationCount = associations.length;
    L.geoJSON(associations, { style: { color: '#93612d', weight: 1.5, dashArray: '4 6', opacity: .85 }, interactive: false }).addTo(groups.connections);
    const reservoirCount = visible.filter(f => f.properties.kind === 'reservoir').length;
    const largestVisibleVolume = Math.max(...visible.map(f => f.properties.usableM3 || 0), 0);
    // Large circles first, so smaller nearby facilities remain clickable.
    for (const f of [...visible].sort((a, b) => (b.properties.usableM3 || 0) - (a.properties.usableM3 || 0))) {
      const p = f.properties;
      const reservoir = p.kind === 'reservoir';
      const measured = reservoir && p.usableM3 !== null && p.usableM3 > 0;
      const radius = measured ? symbolRadius(p.usableM3) : reservoir ? 4 : 2.7;
      const marker = L.circleMarker([...f.geometry.coordinates].reverse(), {
        radius, color: reservoir ? '#086570' : '#fff',
        fillColor: reservoir ? '#2b969d' : '#a46b32',
        fillOpacity: reservoir ? measured ? .42 : 0 : .75, weight: reservoir ? 1 : .6
      }).addTo(reservoir ? groups.reservoirs : groups.facilities);
      const tooltip = document.createElement('span');
      tooltip.textContent = p.name + (reservoir ? p.usableM3 === null ? ' · usable volume unknown' : ' · ' + number(p.usableM3) + ' m³' : '');
      marker.bindTooltip(tooltip, tooltipOptions(p, radius, reservoirCount, largestVisibleVolume));
      const popup = document.createElement('div');
      const title = document.createElement('strong'); title.textContent = p.name;
      const detail = document.createElement('p'); detail.textContent = p.type + (reservoir ? p.usableM3 === null ? ' · usable volume unknown' : ' · usable storage ' + number(p.usableM3) + ' m³' : '');
      const a = document.createElement('a'); a.href = sourceUrl(p.id); a.textContent = 'Official source record';
      popup.append(title, detail, a);
      marker.bindPopup(popup);
      marker.on('click', () => inspect(f, false));
      markers.set(p.id, marker);
    }
    facilitySearch.setOptions(sorted(visible.map(f => ({ value: f.properties.id, label: f.properties.name + ' [' + f.properties.id + ']' }))), 'Choose a facility…');
    const reservoirs = visible.filter(f => f.properties.kind === 'reservoir');
    document.querySelector('#mapped-count').textContent = number(visible.length);
    document.querySelector('#reservoir-count').textContent = number(reservoirs.length);
    document.querySelector('#volume-count').textContent = number(reservoirs.filter(f => f.properties.usableM3 !== null).length);
    status.textContent = number(reservoirs.length) + ' reservoirs · ' + number(visible.length) + ' located records available in this selection.';
    bounds = L.latLngBounds(visible.map(f => [...f.geometry.coordinates].reverse()));
    if (district === '*' && system === '*' && outline) bounds = bounds.extend(L.geoJSON(outline).getBounds()).pad(.05);
    if (visible.length) fit();
    syncConnections();
    document.querySelector('#detail-title').textContent = 'Inspect a facility';
    document.querySelector('#detail-text').textContent = 'Select a map point or search the facility list. Unmatched records stay off-map; this does not mean the infrastructure is absent.';
    document.querySelector('#detail-facts').replaceChildren();
    document.querySelector('#detail-source').replaceChildren();
    if (system !== '*') {
      const root = meta.systems.find(s => s.id === system);
      describe({ properties: { ...root, reports: [] } });
      status.textContent += ' ' + root.locatedFacilities + ' of ' + root.facilities + ' associated records have verified map geometry.';
    }
  }
  districtSelect.addEventListener('change', () => { district = districtSelect.value || '*'; system = '*'; updateSystems(); render(); });
  systemSelect.addEventListener('change', () => { system = systemSelect.value || '*'; render(); });
  facilitySelect.addEventListener('change', () => {
    const feature = visible.find(f => f.properties.id === facilitySelect.value);
    if (feature) inspect(feature, true);
  });
  for (const [id, layer] of Object.entries({ ...groups, background })) {
    document.getElementById(id).addEventListener('change', event => {
      if (id === 'connections') syncConnections();
      else if (event.target.checked) layer.addTo(map); else map.removeLayer(layer);
    });
  }
  document.querySelector('#reset').addEventListener('click', fit);
  document.querySelector('#overview').addEventListener('click', () => {
    district = '*'; system = '*'; districtSearch.setValue('*'); updateSystems();
    document.querySelector('#reservoirs').checked = true; groups.reservoirs.addTo(map);
    document.querySelector('#facilities').checked = false; map.removeLayer(groups.facilities);
    document.querySelector('#background').checked = false; map.removeLayer(background);
    render();
  });
  document.querySelector('#case-study').addEventListener('click', () => {
    district = 'Imst'; system = 'T20571970R3'; districtSearch.setValue(district); updateSystems(); systemSearch.setValue(system);
    document.querySelector('#facilities').checked = true; groups.facilities.addTo(map);
    document.querySelector('#reservoirs').checked = true; groups.reservoirs.addTo(map);
    document.querySelector('#connections').checked = true;
    document.querySelector('#background').checked = true; background.addTo(map);
    render();
  });
  map.on('resize', () => {
    maxRadius = window.matchMedia('(max-width: 700px)').matches ? 16 : 28;
    const count = visible.filter(f => f.properties.kind === 'reservoir').length;
    const largest = Math.max(...visible.map(f => f.properties.usableM3 || 0), 0);
    for (const feature of visible) {
      const p = feature.properties;
      const marker = markers.get(p.id);
      if (!marker) continue;
      if (p.kind === 'reservoir' && p.usableM3 > 0) marker.setRadius(symbolRadius(p.usableM3));
      const tooltip = marker.getTooltip()?.getContent();
      if (tooltip) marker.unbindTooltip().bindTooltip(tooltip, tooltipOptions(p, marker.getRadius(), count, largest));
    }
    drawSizeLegend();
  });
  document.querySelector('#scope').textContent = 'All nine Tirol districts queried · ' + meta.systems.length + ' enclosing system reports · ' + number(meta.mappedFacilities) + ' of ' + number(meta.uniqueFacilities) + ' unique facilities mapped · snapshot ' + meta.retrieved + '. Query coverage is not a complete infrastructure census.';
  document.querySelector('#coverage-summary').textContent = number(meta.unmappedFacilities) + ' records lack a verified geometry match in the two queried GIS layers and are not mapped; ' + meta.reservoirsWithVolume + ' of ' + meta.reservoirs + ' mapped snowmaking reservoirs have an unambiguous usable-volume value. Child records retain their own statuses; an active search result does not imply every child is active.';
  const coverageBody = document.querySelector('#coverage-body');
  for (const row of meta.districts) {
    const tr = document.createElement('tr');
    for (const [i, value] of [row.district, row.searchRows, row.reports, row.uniqueFacilities, row.mappedFacilities, row.reservoirs].entries()) {
      const cell = document.createElement(i === 0 ? 'th' : 'td');
      if (i === 0) cell.scope = 'row';
      cell.textContent = String(value); tr.append(cell);
    }
    coverageBody.append(tr);
  }
  updateSystems(); render();
}
start().catch(error => {
  status.textContent = 'Map unavailable: ' + error.message + ' Preview over HTTP, not file://. Source and methodology links remain available.';
  console.error(error);
});
