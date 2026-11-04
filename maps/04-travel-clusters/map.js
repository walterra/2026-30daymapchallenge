/* Local-only rendering; data preparation and clustering are documented in README.md. */
'use strict';
(() => {
  const colours = ['#007f86', '#ad4c00', '#9053a0', '#386bc0'];
  const origin = document.querySelector('#origin');
  const outbound = document.querySelector('#outbound');
  const clustered = document.querySelector('#clustered');
  const status = document.querySelector('#status');
  const ranking = document.querySelector('#ranking');
  const selection = document.querySelector('#selection');
  const format = new Intl.NumberFormat('en');
  const countryNames = new Intl.DisplayNames(['en'], { type: 'region' });
  const marketCodes = { 'Netherlands': 'NL', 'Germany': 'DE', 'United Kingdom': 'GB', 'France': 'FR', 'Italy': 'IT', 'Spain': 'ES', 'United States': 'US', 'China': 'CN', 'Austria': 'AT', 'Belarus': 'BY', 'Belgium': 'BE', 'Bosnia and Herzegovina': 'BA', 'Bulgaria': 'BG', 'Croatia': 'HR', 'Cyprus': 'CY', 'Czechia': 'CZ', 'Denmark': 'DK', 'Estonia': 'EE', 'Finland': 'FI', 'Georgia': 'GE', 'Greece': 'GR', 'Hungary': 'HU', 'Iceland': 'IS', 'Ireland Rep': 'IE', 'Latvia': 'LV', 'Liechtenstein': 'LI', 'Lithuania': 'LT', 'Luxembourg': 'LU', 'Malta': 'MT', 'Monaco': 'MC', 'Montenegro': 'ME', 'North Macedonia': 'MK', 'Norway': 'NO', 'Poland': 'PL', 'Portugal': 'PT', 'Romania': 'RO', 'Russia': 'RU', 'San Marino': 'SM', 'Serbia': 'RS', 'Slovakia': 'SK', 'Slovenia': 'SI', 'Sweden': 'SE', 'Switzerland': 'CH', 'Turkiye': 'TR', 'Ukraine': 'UA', 'Argentina': 'AR', 'Brazil': 'BR', 'Canada': 'CA', 'Mexico': 'MX', 'India': 'IN', 'Israel': 'IL', 'Japan': 'JP', 'Saudi Arabia': 'SA', 'South Korea': 'KR', 'Taiwan': 'TW', 'Thailand': 'TH', 'United Arab Emirates': 'AE', 'Egypt': 'EG', 'South Africa': 'ZA', 'Australia': 'AU', 'New Zealand': 'NZ' };
  const definitions = {
    NG: 'Hotels and similar establishments; city area',
    NGS: 'Hotels and similar establishments; greater city area',
    NA: 'All paid accommodation; city area',
    NAS: 'All paid accommodation; greater city area',
    NZS: 'All accommodation including friends/relatives; greater city area'
  };
  const svg = d3.select('#map');
  const projection = d3.geoMercator().fitExtent([[20, 20], [980, 770]], {
    type: 'MultiPoint', coordinates: [[-25, 27], [46, 72]]
  });
  const path = d3.geoPath(projection);
  let data;
  let dots;
  let visible = [];

  function describe(city) {
    dots.classed('active', d => d.name === city.name);
    const group = city.cluster === null ? 'No cluster: incomplete eight-market profile' : data.clusters[city.cluster].name;
    selection.textContent = `${city.name}, ${countryNames.of(city.country)}: ${format.format(city.nights[origin.value])} person-nights from ${origin.value}. ${definitions[city.definition]}. ${group}.${city.representativePoint ? ` Point shown at ${city.coordinatePlace}.` : ''}`;
  }

  function render() {
    const market = origin.value;
    const pool = data.cities.filter(c => !outbound.checked || c.country !== marketCodes[market]);
    const withCounts = pool.filter(c => c.nights[market] !== null && c.nights[market] !== undefined);
    visible = withCounts.filter(c => !clustered.checked || c.cluster !== null)
      .sort((a, b) => b.nights[market] - a.nights[market] || a.name.localeCompare(b.name));
    const maximum = d3.max(visible, c => c.nights[market]) || 1;
    const radius = d3.scaleSqrt().domain([0, maximum]).range([0, 24]);
    status.textContent = `${data.year} · ${visible.length} of ${pool.length} eligible destinations shown · ${pool.length - withCounts.length} missing origin counts${clustered.checked ? ` · ${withCounts.length - visible.length} omitted without a cluster` : ''}. Circle sizes rescale with each selection; zero counts have no visible circle.`;
    selection.textContent = 'Select a city in the map or list for details.';
    svg.selectAll('.cities').remove();
    // Small circles are drawn last so they remain reachable near large destinations.
    dots = svg.append('g').attr('class', 'cities').selectAll('circle').data(visible).enter()
      .append('circle').attr('class', 'dot')
      .attr('cx', c => projection([c.lon, c.lat])[0])
      .attr('cy', c => projection([c.lon, c.lat])[1])
      .attr('r', c => radius(c.nights[market]))
      .attr('fill', c => c.cluster === null ? '#777d83' : colours[c.cluster])
      .on('click', describe);
    dots.append('title').text(c => `${c.name}: ${format.format(c.nights[market])} person-nights`);
    svg.selectAll('.labels').remove();
    svg.append('g').attr('class', 'labels').selectAll('text').data(visible.slice(0, 5)).enter()
      .append('text').attr('class', 'map-label')
      .attr('x', c => projection([c.lon, c.lat])[0] + radius(c.nights[market]) + 4)
      .attr('y', c => projection([c.lon, c.lat])[1] + 4).text(c => c.name);
    ranking.replaceChildren();
    visible.forEach(city => {
      const li = document.createElement('li');
      const button = document.createElement('button');
      button.type = 'button';
      const name = document.createElement('span');
      name.textContent = city.name;
      const count = document.createElement('strong');
      count.textContent = format.format(city.nights[market]);
      const detail = document.createElement('small');
      detail.textContent = `${countryNames.of(city.country)} · ${city.definition} · ${city.cluster === null ? 'unclustered' : `cluster ${city.cluster + 1}`}`;
      button.append(name, count, detail);
      button.addEventListener('click', () => describe(city));
      li.append(button);
      ranking.append(li);
    });
  }

  Promise.all([
    fetch('data/map-data.json').then(r => { if (!r.ok) throw Error('Map data unavailable'); return r.json(); }),
    fetch('data/land.geojson').then(r => { if (!r.ok) throw Error('Basemap unavailable'); return r.json(); })
  ]).then(([loaded, land]) => {
    data = loaded;
    svg.append('path').datum(d3.geoGraticule().extent([[-25, 27], [46, 72]]).step([10, 10])()).attr('class', 'graticule').attr('d', path);
    svg.append('path').datum(land).attr('class', 'land').attr('d', path);
    const markets = Object.keys(marketCodes).filter(m => data.cities.some(c => c.nights[m] !== null && c.nights[m] !== undefined)).sort();
    origin.replaceChildren(...markets.map(m => { const option = document.createElement('option'); option.textContent = m; option.value = m; return option; }));
    origin.value = 'Netherlands';
    const legend = document.querySelector('#legend');
    [...data.clusters, { id: null, name: 'Unclustered', count: data.cities.filter(c => c.cluster === null).length }].forEach(group => {
      const card = document.createElement('div');
      card.className = 'legend-item';
      card.style.setProperty('--cluster-color', group.id === null ? '#777d83' : colours[group.id]);
      const heading = document.createElement('strong');
      heading.textContent = group.name;
      const text = document.createElement('p');
      text.textContent = `${group.count} destinations in the complete extract`;
      card.append(heading, text);
      if (group.meanShares) {
        const shares = document.createElement('p');
        shares.textContent = Object.entries(group.meanShares).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([m, v]) => `${m} ${Math.round(v * 100)}%`).join(' · ');
        card.append(shares);
      }
      legend.append(card);
    });
    [origin, outbound, clustered].forEach(control => control.addEventListener('change', render));
    render();
  }).catch(error => { status.textContent = `Unable to load the map: ${error.message}. Use the CSV download below or serve this directory over HTTP.`; });
})();
