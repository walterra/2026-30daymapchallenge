/* Run through agent-browser eval --stdin after the page styles load. */
(() => {
  const chart = document.querySelector('.downhill-ranking');
  const rows = Array.from(chart.querySelectorAll('.ranking-row'));
  const errors = [];
  if (rows.length !== 10) errors.push('Expected ten bars');
  const values = rows.map(row => Number(row.dataset.km));
  if (values.some((v, i) => !Number.isFinite(v) || v <= 0 || (i && v > values[i - 1]))) errors.push('Values are not positive and descending');
  let color;
  for (const row of rows) {
    const track = row.querySelector('.ranking-bar-track').getBoundingClientRect();
    const barNode = row.querySelector('.ranking-bar');
    const bar = barNode.getBoundingClientRect();
    const label = row.querySelector('.ranking-value').getBoundingClientRect();
    const name = row.querySelector('.ranking-name').getBoundingClientRect();
    const bounds = row.getBoundingClientRect();
    const expectedWidth = track.width * Number(row.dataset.km) / 300;
    if (Math.abs(bar.width - expectedWidth) > .1 || Math.abs(bar.left - track.left) > .1) errors.push('Nonlinear or nonzero bar: ' + row.dataset.sourceId);
    if (label.left < bar.right + 4 || label.right > bounds.right + 1) errors.push('Value overlaps bar or is clipped: ' + row.dataset.sourceId);
    if (name.right > bounds.right + 1 || name.left < bounds.left - 1) errors.push('Clipped name');
    if (name.left < label.right && name.right > label.left && name.top < label.bottom && name.bottom > label.top) errors.push('Name/value collision');
    const fill = getComputedStyle(barNode).backgroundColor;
    if (!row.classList.contains('is-map-active')) {
      if (color && color !== fill) errors.push('Unexplained multicolor bars');
      color = fill;
    }
  }
  const caveat = chart.querySelector('.ranking-caveat');
  if (!caveat || !caveat.textContent.includes('not an official national ranking')) errors.push('Missing visible ranking qualification');
  else {
    const box = caveat.getBoundingClientRect();
    if (box.height <= 0 || box.top < rows.at(-1).getBoundingClientRect().bottom || box.bottom > chart.getBoundingClientRect().bottom + 1) errors.push('Ranking qualification is not directly below the bars');
  }
  if (rows.filter(row => row.classList.contains('is-map-active')).length > 1) errors.push('More than one active bar');
  if (document.documentElement.scrollWidth > innerWidth) errors.push('Page overflow');
  if (!chart.querySelector('.ranking-list[role="list"]')) errors.push('Missing semantic list');
  if (errors.length) throw Error(errors.join('\n'));
  return { status: 'pass', width: innerWidth, theme: document.documentElement.dataset.theme, bars: rows.length, scale: [0, 300], directValues: true, oneColor: color };
})()
