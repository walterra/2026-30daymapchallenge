/* Local data, local Leaflet. Only optional context tiles use the network. */
'use strict';
const status = document.querySelector('#status');
async function start() {
  if (!window.L) throw new Error('The local map library could not be loaded.');
  const map = L.map('map', { preferCanvas: true, scrollWheelZoom: false });
  const home = [[46.35, 9.4], [49.1, 17.3]];
  map.fitBounds(home);
  const tiles = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 18,
    attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
  }).addTo(map);
  let tileWarning = false;
  tiles.on('tileerror', () => {
    tileWarning = true;
    status.textContent = 'Background tiles unavailable. The local piste layers still work.';
  });
  const [runs, areas, meta] = await Promise.all(
    ['runs.geojson', 'areas.geojson', 'metadata.json'].map(async file => {
      const response = await fetch('data/' + file);
      if (!response.ok) throw new Error('Could not load ' + file + ' (HTTP ' + response.status + ').');
      return response.json();
    })
  );
  const number = value => value.toLocaleString('en');
  const stats = document.querySelector('#stats');
  for (const [label, count] of [
    ['Ski-area locations', meta.areas], ['Piste line segments', meta.segments],
    ['Snowmaking recorded', meta.snowmaking.yes], ['Explicitly tagged no', meta.snowmaking.no],
    ['Unknown', meta.snowmaking.unknown]
  ]) {
    const dt = document.createElement('dt');
    dt.textContent = label;
    const dd = document.createElement('dd');
    dd.textContent = number(count);
    stats.append(dt, dd);
  }
  const colors = { yes: '#d58b19', no: '#007da7', unknown: '#64757b' };
  // Build unknown first; snowmaking records remain on top.
  for (const key of ['unknown', 'no', 'yes']) {
    const layer = L.geoJSON(runs, {
      filter: feature => feature.properties.snowmaking === key,
      style: { color: colors[key], weight: key === 'unknown' ? 1.6 : 3.5, opacity: key === 'unknown' ? .65 : 1 },
      onEachFeature(feature, line) {
        const p = feature.properties;
        const box = document.createElement('div');
        const title = document.createElement('strong');
        title.textContent = p.name;
        const description = document.createElement('p');
        description.textContent = (p.resorts || 'No ski-area association recorded') + ' · Snowmaking: ' + p.snowmaking;
        box.append(title, description);
        for (const source of p.sources) {
          if (source.type !== 'openstreetmap' || !/^(way|node|relation)\/\d+$/.test(source.id)) continue;
          const link = document.createElement('a');
          link.href = 'https://www.openstreetmap.org/' + source.id;
          link.textContent = 'View OSM source';
          box.append(link, document.createElement('br'));
        }
        line.bindPopup(box);
      }
    }).addTo(map);
    document.getElementById(key).addEventListener('change', event => {
      if (event.target.checked) layer.addTo(map);
      else map.removeLayer(layer);
    });
  }
  const areaLayer = L.geoJSON(areas, {
    pointToLayer: (_, latlng) => L.circleMarker(latlng, { radius: 4, color: '#253942', weight: 1, fillColor: '#fff3da', fillOpacity: 1 }),
    onEachFeature: (feature, layer) => {
      const name = document.createElement('span');
      name.textContent = feature.properties.name;
      layer.bindPopup(name);
    }
  });
  document.querySelector('#areas').addEventListener('change', event => {
    if (event.target.checked) areaLayer.addTo(map);
    else map.removeLayer(areaLayer);
  });
  const select = document.querySelector('#resort');
  const sorted = [...areas.features].sort((a, b) => a.properties.name.localeCompare(b.properties.name));
  sorted.forEach((feature, index) => {
    const option = document.createElement('option');
    option.value = index;
    option.textContent = feature.properties.name;
    select.append(option);
  });
  select.disabled = false;
  select.addEventListener('change', () => {
    if (select.value === '') return;
    const [lon, lat] = sorted[Number(select.value)].geometry.coordinates;
    map.setView([lat, lon], 13);
  });
  document.querySelector('#reset').addEventListener('click', () => {
    map.fitBounds(home);
    select.value = '';
  });
  const unknown = (100 * meta.snowmaking.unknown / meta.segments).toFixed(1);
  if (!tileWarning) status.textContent = unknown + '% of these line segments have no snowmaking value. This is a data-coverage map, not a snowmaking census.';
  document.querySelector('#snapshot').textContent = 'Snapshot downloaded ' + meta.downloadDate + '. See the method for filtering details.';
}
start().catch(error => {
  status.textContent = 'Map unavailable: ' + error.message + ' Preview this site over HTTP, not file://. Data downloads and methodology are linked below.';
  console.error(error);
});
