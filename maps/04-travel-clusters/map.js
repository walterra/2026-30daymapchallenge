/* Render saved geographic bubble layouts. Forces run only in
   scripts/prepare-travel-layouts.js, never in the browser. */
'use strict';
(() => {
  const origin = document.querySelector('#origin');
  const excludeDomestic = document.querySelector('#exclude-domestic');
  const showFlows = document.querySelector('#show-flows');
  const status = document.querySelector('#status');
  const ranking = document.querySelector('#ranking');
  const selection = document.querySelector('#selection');
  const format = new Intl.NumberFormat('en');
  const countries = new Intl.DisplayNames(['en'], {type: 'region'});
  const definitions = {NG: 'Hotels; city area', NGS: 'Hotels; greater city area', NA: 'All paid accommodation; city area', NAS: 'All paid accommodation; greater city area', NZS: 'All accommodation including friends/relatives; greater city area'};
  const svg = d3.select('#map');
  let nodes, circles, data, saved, bounds, bundled, flowLayer, sourceLayer;
  const bundleLine = d3.line().curve(d3.curveBundle.beta(.82));

  function drawFlows() {
    flowLayer.selectAll('*').remove();
    sourceLayer.selectAll('*').remove();
    const note = document.querySelector('#flow-note');
    if (!showFlows.checked) { note.textContent = 'Source connections hidden.'; return; }
    const market = origin.value;
    const source = bundled.origins[market];
    const edges = bundled.layouts[excludeDomestic.checked ? 'foreign' : 'all'][market];
    flowLayer.selectAll('path').data(edges).enter().append('path')
      .attr('class', 'flow').attr('data-city-index', d => d.cityIndex)
      .attr('d', d => bundleLine(d.points));
    const [x, y] = source.point;
    sourceLayer.append('circle').attr('class', 'source-point').attr('cx', x).attr('cy', y).attr('r', 5)
      .append('title').text(`${market}: representative point at ${source.name}${source.offMap ? '; shown schematically at the map edge' : ''}. Not observed traveller departure locations.`);
    sourceLayer.append('text').attr('class', 'source-label')
      .attr('x', x + (x < saved.config.width / 2 ? 9 : -9)).attr('y', Math.max(25, y - 9))
      .attr('text-anchor', x < saved.config.width / 2 ? 'start' : 'end')
      .text(`${market}${source.offMap ? ' (off-map)' : ''}`);
    note.textContent = `${edges.length} schematic connections from ${market}. Representative country point: ${source.name}${source.offMap ? ' (outside this frame; entry marker placed at map edge)' : ''}. Bundles show relationships, not actual routes; line endpoints are city anchors, not displaced bubbles. Zero and missing counts have no flow line.`;
  }
  const inFrame = city => city.lon >= bounds[0][0] && city.lon <= bounds[1][0] && city.lat >= bounds[0][1] && city.lat <= bounds[1][1];
  const isVisible = node => node.position !== null;

  function describe(node) {
    selection.textContent = `${node.city.name}, ${countries.of(node.city.country)} ← ${node.market}: ${format.format(node.value)} person-nights in 2024. ${definitions[node.city.definition]}. Bubble displaced for legibility; the line ends at its destination attractor.${node.city.representativePoint ? ` Representative point: ${node.city.coordinatePlace}.` : ''}`;
    svg.selectAll('.leader').remove();
    svg.append('line').attr('class', 'leader').attr('x1', node.x).attr('y1', node.y).attr('x2', node.ax).attr('y2', node.ay);
    circles.classed('active', n => n === node);
    flowLayer.selectAll('.flow').classed('active', edge => node.market === origin.value && edge.cityIndex === node.cityIndex);
  }

  function highlight() {
    const market = origin.value;
    circles.style('display', n => isVisible(n) ? null : 'none')
      .classed('selected', n => isVisible(n) && n.market === market).classed('active', false);
    circles.filter(n => n.market === market).raise();
    const visible = nodes.filter(isVisible);
    const selected = visible.filter(n => n.market === market).sort((a, b) => b.value - a.value || a.city.name.localeCompare(b.city.name));
    const missing = data.cities.filter(c => inFrame(c) && (!excludeDomestic.checked || c.country !== saved.marketCountries[market]) && (c.nights[market] === null || c.nights[market] === undefined)).length;
    status.textContent = `${format.format(visible.length)} reported country–destination pairs shown · ${selected.length} highlighted for ${market} · ${missing} missing counts for eligible destinations. Saved layout. ${excludeDomestic.checked ? `${nodes.filter(n => inFrame(n.city) && n.domestic).length} domestic pairs excluded.` : 'Domestic stays included.'}`;
    selection.textContent = 'Hover or select any bubble, or use a ranked destination button, to inspect its source and destination.';
    svg.selectAll('.leader').remove();
    drawFlows();
    ranking.replaceChildren();
    selected.forEach(node => {
      const li = document.createElement('li');
      const button = document.createElement('button'); button.type = 'button';
      const name = document.createElement('span'); name.textContent = node.city.name;
      const count = document.createElement('strong'); count.textContent = format.format(node.value);
      const detail = document.createElement('small'); detail.textContent = `${countries.of(node.city.country)} · ${node.city.definition}`;
      button.append(name, count, detail);
      button.addEventListener('click', () => describe(node));
      li.append(button); ranking.append(li);
    });
  }

  function loadLayout() {
    const positions = saved.layouts[excludeDomestic.checked ? 'foreign' : 'all'];
    nodes.forEach((node, i) => {
      node.position = positions[i];
      [node.x, node.y] = node.position || [node.ax, node.ay];
    });
    circles.attr('cx', n => n.x).attr('cy', n => n.y);
    const active = nodes.filter(isVisible);
    svg.attr('data-settled', 'true').attr('data-layout-count', active.length)
      .attr('data-layout-domestic-count', active.filter(n => n.domestic).length)
      .attr('data-layout-mode', excludeDomestic.checked ? 'foreign' : 'all');
    highlight();
  }

  async function json(url) {
    const response = await fetch(url);
    if (!response.ok) throw Error(`${url} unavailable`);
    return response.json();
  }

  Promise.all([json('data/map-data.json'), json('data/land.geojson'), json('data/bubble-layouts.json'), json('data/bundled-flows.json')])
    .then(([loaded, land, layouts, flows]) => {
      bundled = flows;
      data = loaded; saved = layouts; bounds = saved.config.bounds;
      if (bundled.version !== 1) throw Error('Incompatible saved flows');
      bundleLine.curve(d3.curveBundle.beta(bundled.beta));
      if (saved.version !== 1 || saved.layouts.all.length !== saved.nodes.length || saved.layouts.foreign.length !== saved.nodes.length) throw Error('Incompatible saved layouts');
      const projection = d3.geoAzimuthalEqualArea().rotate(saved.projection.rotate)
        .scale(saved.projection.scale).translate(saved.projection.translate);
      const path = d3.geoPath(projection);
      svg.attr('viewBox', `0 0 ${saved.config.width} ${saved.config.height}`).attr('preserveAspectRatio', 'xMidYMid meet');
      svg.append('path').datum(d3.geoGraticule().extent(bounds).step([10, 10])()).attr('class', 'graticule').attr('d', path);
      svg.append('path').datum(land).attr('class', 'land').attr('d', path);
      flowLayer = svg.append('g').attr('class', 'flows').attr('aria-hidden', 'true');
      origin.replaceChildren(...saved.markets.map(m => { const option = document.createElement('option'); option.textContent = m; return option; }));
      origin.value = 'Netherlands';
      nodes = saved.nodes.map(entry => {
        const city = data.cities[entry.cityIndex];
        const market = saved.markets[entry.marketIndex];
        const [ax, ay] = saved.anchors[entry.cityIndex];
        return {...entry, city, market, value: city.nights[market], ax, ay, position: null};
      });
      const c = saved.config;
      document.querySelector('#size-note').textContent = `Fixed scale across all origins: the largest bubble represents ${format.format(saved.maxValue)} person-nights. Counts below ${format.format(Math.round(saved.maxValue * (c.minimumRadius / c.maximumRadius) ** 2))} (including reported zeros) use a minimum visibility radius. The saved composition scales uniformly to fit the viewport.`;
      svg.append('g').attr('class', 'anchors').selectAll('circle').data(data.cities.filter(inFrame)).enter().append('circle')
        .attr('cx', city => projection([city.lon, city.lat])[0]).attr('cy', city => projection([city.lon, city.lat])[1]).attr('r', 1.2).attr('class', 'anchor');
      circles = svg.append('g').attr('class', 'cities').selectAll('circle').data(nodes).enter().append('circle')
        .attr('class', 'dot').attr('r', n => n.r).on('mouseenter', describe).on('click', describe);
      circles.append('title').text(n => `${n.city.name} ← ${n.market}: ${format.format(n.value)} person-nights`);
      sourceLayer = svg.append('g').attr('class', 'source-marker');
      origin.addEventListener('change', highlight);
      showFlows.addEventListener('change', drawFlows);
      excludeDomestic.addEventListener('change', loadLayout);
      loadLayout();
    }).catch(error => { status.textContent = `Unable to load the map: ${error.message}. Use the CSV download below or serve this directory over HTTP.`; });
})();
