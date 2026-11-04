/* Geographic clustered bubbles: fixed destination attractors + collision.
   Pattern reference: https://observablehq.com/@d3/clustered-bubbles
   Local D3 v4; independently implemented with built-in forceCollide. */
'use strict';
(() => {
  const origin = document.querySelector('#origin');
  const excludeDomestic = document.querySelector('#exclude-domestic');
  const status = document.querySelector('#status');
  const ranking = document.querySelector('#ranking');
  const selection = document.querySelector('#selection');
  const format = new Intl.NumberFormat('en');
  const countries = new Intl.DisplayNames(['en'], { type: 'region' });
  const definitions = { NG: 'Hotels; city area', NGS: 'Hotels; greater city area', NA: 'All paid accommodation; city area', NAS: 'All paid accommodation; greater city area', NZS: 'All accommodation including friends/relatives; greater city area' };
  const aggregates = new Set(['Europe', 'America', 'Asia', 'Africa', 'Oceania', 'Total foreign', 'Total domestic', 'Total foreign and domestic']);
  const svg = d3.select('#map');
  // Madeira (west/south), Trondheim (north), Rezekne (east), with breathing room.
  const frameBounds = [[-17.9, 32], [28.3, 64.2]];
  // Europe-centred Lambert azimuthal equal-area (spherical D3 model).
  // Sample all four edges: curved projected bounds need more than two corners.
  const framePoints = [];
  for (let i = 0; i <= 100; i++) {
    const lon = frameBounds[0][0] + (frameBounds[1][0] - frameBounds[0][0]) * i / 100;
    const lat = frameBounds[0][1] + (frameBounds[1][1] - frameBounds[0][1]) * i / 100;
    framePoints.push([lon, frameBounds[0][1]], [lon, frameBounds[1][1]],
      [frameBounds[0][0], lat], [frameBounds[1][0], lat]);
  }
  const projection = d3.geoAzimuthalEqualArea().rotate([-10, -49])
    .fitExtent([[35, 35], [965, 965]], { type: 'MultiPoint', coordinates: framePoints });
  const path = d3.geoPath(projection);
  let nodes = [], circles, data, ready = false;
  let missing = 0;
  let marketCountries = {};
  const inFrame = city => city.lon >= frameBounds[0][0] && city.lon <= frameBounds[1][0]
    && city.lat >= frameBounds[0][1] && city.lat <= frameBounds[1][1];
  const isVisible = node => inFrame(node.city) && (!excludeDomestic.checked || !node.domestic);

  function describe(node) {
    const city = node.city;
    selection.textContent = `${city.name}, ${countries.of(city.country)} ← ${node.market}: ${format.format(node.value)} person-nights in 2024. ${definitions[city.definition]}. Bubble displaced for legibility; the line ends at its destination attractor.${city.representativePoint ? ` Representative point: ${city.coordinatePlace}.` : ''}`;
    svg.selectAll('.leader').remove();
    svg.append('line').attr('class', 'leader').attr('x1', node.x).attr('y1', node.y).attr('x2', node.ax).attr('y2', node.ay);
    circles.classed('active', d => d === node);
  }

  function highlight() {
    const market = origin.value;
    circles.style('display', n => isVisible(n) ? null : 'none')
      .classed('selected', n => isVisible(n) && n.market === market).classed('active', false);
    // Keep highlighted bubbles above neutral neighbours without moving them.
    circles.filter(n => n.market === market).raise();
    const visible = nodes.filter(isVisible);
    const selected = visible.filter(n => n.market === market).sort((a, b) => b.value - a.value || a.city.name.localeCompare(b.city.name));
    status.textContent = `${format.format(visible.length)} reported country–destination pairs shown · ${selected.length} highlighted for ${market} · ${missing} missing counts for eligible destinations. ${ready ? 'Layout settled.' : 'Separating bubbles…'} ${excludeDomestic.checked ? `${nodes.filter(n => inFrame(n.city) && n.domestic).length} domestic pairs hidden across all origins.` : 'Domestic stays included.'}`;
    selection.textContent = 'Hover or select any bubble, or use a ranked destination button, to inspect its source and destination.';
    svg.selectAll('.leader').remove();
    ranking.replaceChildren();
    selected.forEach(node => {
      const li = document.createElement('li');
      const button = document.createElement('button');
      button.type = 'button';
      const name = document.createElement('span'); name.textContent = node.city.name;
      const count = document.createElement('strong'); count.textContent = format.format(node.value);
      const detail = document.createElement('small'); detail.textContent = `${countries.of(node.city.country)} · ${node.city.definition}`;
      button.append(name, count, detail);
      button.addEventListener('click', () => describe(node));
      li.append(button); ranking.append(li);
    });
  }

  function updateSelection() {
    missing = data.cities.filter(c => inFrame(c) && (!excludeDomestic.checked || c.country !== marketCountries[origin.value])
      && (c.nights[origin.value] === null || c.nights[origin.value] === undefined)).length;
    highlight();
  }

  Promise.all([
    fetch('data/map-data.json').then(r => { if (!r.ok) throw Error('Map data unavailable'); return r.json(); }),
    fetch('data/land.geojson').then(r => { if (!r.ok) throw Error('Basemap unavailable'); return r.json(); })
  ]).then(([loaded, land]) => {
    data = loaded;
    svg.append('path').datum(d3.geoGraticule().extent(frameBounds).step([10, 10])()).attr('class', 'graticule').attr('d', path);
    svg.append('path').datum(land).attr('class', 'land').attr('d', path);
    const markets = Array.from(new Set(data.cities.flatMap(c => Object.keys(c.nights)))).filter(m => !aggregates.has(m) && !m.startsWith('Other ')).sort();
    origin.replaceChildren(...markets.map(m => { const option = document.createElement('option'); option.textContent = m; return option; }));
    origin.value = 'Netherlands';
    marketCountries = Object.fromEntries(Array.from(new Set(data.cities.map(c => c.country))).map(code => [countries.of(code), code]));
    Object.assign(marketCountries, { 'Ireland Rep': 'IE', 'Turkiye': 'TR', 'Czechia': 'CZ' });
    data.cities.forEach(city => {
      const [ax, ay] = projection([city.lon, city.lat]);
      markets.forEach((market, i) => {
        const value = city.nights[market];
        if (value === null || value === undefined) return;
        // Deterministic spiral seeds avoid coincident-node random jitter.
        const angle = i * Math.PI * (3 - Math.sqrt(5));
        const seedRadius = Math.sqrt(i) * 1.5;
        nodes.push({ city, market, value, domestic: marketCountries[market] === city.country, ax, ay, x: ax + Math.cos(angle) * seedRadius, y: ay + Math.sin(angle) * seedRadius });
      });
    });
    const maxValue = d3.max(nodes, n => n.value);
    nodes.forEach(n => { n.r = Math.max(.65, 15 * Math.sqrt(n.value / maxValue)); });
    document.querySelector('#size-note').textContent = `Fixed scale across all origins: the largest bubble represents ${format.format(maxValue)} person-nights. Counts below ${format.format(Math.round(maxValue * (.65 / 15) ** 2))} (including reported zeros) use a minimum visibility radius.`;
    svg.append('g').attr('class', 'anchors').selectAll('circle').data(data.cities.filter(inFrame)).enter().append('circle')
      .attr('cx', c => projection([c.lon, c.lat])[0]).attr('cy', c => projection([c.lon, c.lat])[1]).attr('r', 1.2).attr('class', 'anchor');
    circles = svg.append('g').attr('class', 'cities').selectAll('circle').data(nodes).enter().append('circle')
      .attr('class', 'dot').attr('r', n => n.r).attr('cx', n => n.x).attr('cy', n => n.y)
      .on('mouseenter', describe).on('click', describe);
    circles.append('title').text(n => `${n.city.name} ← ${n.market}: ${format.format(n.value)} person-nights`);
    // Keep deterministic seeds so filter changes rebuild a fresh layout.
    nodes.forEach(n => { n.seedX = n.x; n.seedY = n.y; });
    let frame;
    function layout() {
      cancelAnimationFrame(frame);
      ready = false;
      const layoutNodes = nodes.filter(isVisible);
      svg.attr('data-settled', 'false').attr('data-layout-count', layoutNodes.length)
        .attr('data-layout-domestic-count', layoutNodes.filter(n => n.domestic).length);
      layoutNodes.forEach(n => { n.x = n.seedX; n.y = n.seedY; n.vx = 0; n.vy = 0; });
      // Excluded nodes never enter attraction or collision forces.
      const simulation = d3.forceSimulation(layoutNodes).stop()
        .force('x', d3.forceX(n => n.ax).strength(.14))
        .force('y', d3.forceY(n => n.ay).strength(.14))
        .force('collide', d3.forceCollide(n => n.r + .35).strength(1).iterations(2));
      updateSelection();
      let ticks = 0;
      function settle() {
        for (let i = 0; i < 8; i++) simulation.tick();
        ticks += 8;
        layoutNodes.forEach(n => { n.x = Math.max(n.r + 2, Math.min(998 - n.r, n.x)); n.y = Math.max(n.r + 2, Math.min(998 - n.r, n.y)); });
        circles.filter(isVisible).attr('cx', n => n.x).attr('cy', n => n.y);
        svg.selectAll('.leader').remove();
        if (ticks < 320) frame = requestAnimationFrame(settle);
        else {
          ready = true;
          svg.attr('data-settled', 'true');
          updateSelection();
        }
      }
      frame = requestAnimationFrame(settle);
    }
    origin.addEventListener('change', updateSelection);
    excludeDomestic.addEventListener('change', layout);
    layout();
  }).catch(error => { status.textContent = `Unable to load the map: ${error.message}. Use the CSV download below or serve this directory over HTTP.`; });
})();
