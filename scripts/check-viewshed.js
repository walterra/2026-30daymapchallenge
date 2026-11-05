/* Run on the viewshed page: agent-browser eval --stdin < scripts/check-viewshed.js */
(async () => {
  const assert = (condition, message) => { if (!condition) throw new Error(message); };
  const api = window.viewshed;
  await api.ready;
  const frames = [];
  for (const time of [0, 15, 30]) {
    const result = api.renderAt(time);
    frames.push(result.frame);
    assert(result.time === time, 'Requested time must be exact');
    assert(!api.current.playing, 'Capture must pause interactive playback');
    assert(+document.querySelector('#timeline').value === time, 'Scrubber must track capture time');
  }
  assert(frames.join(',') === '0,49,98', 'Expected sample frames at start, midpoint and end');
  api.renderAt(0); const first = api.png();
  api.renderAt(15); const middle = api.png();
  assert(first !== middle, 'Visibility and marker must change along the route');
  api.renderAt(0);
  assert(first === api.png(), 'Rendering the same time must restore identical canvas pixels');
  assert(api.renderAt(-10).time === 0 && api.renderAt(100).time === 30, 'Clamp capture bounds');
  let rejected = false;
  try { api.renderAt(NaN); } catch { rejected = true; }
  assert(rejected, 'Reject non-finite capture time');
  const timeline = document.querySelector('#timeline');
  timeline.value = 12; timeline.dispatchEvent(new Event('input'));
  assert(api.current.time === 12 && !api.current.playing, 'Scrubbing must pause and seek');
  document.querySelector('#play').click();
  await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  assert(api.current.playing && api.current.time > 12, 'Playback must advance');
  document.querySelector('#play').click();
  assert(!api.current.playing, 'Pause control must stop playback');
  document.querySelector('#reset').click();
  assert(api.current.time === 0, 'Reset must restore start');
  api.renderAt(29.99);
  document.querySelector('#speed').value = '2';
  document.querySelector('#play').click();
  for (let i=0;i<20 && api.current.playing;i++) await new Promise(requestAnimationFrame);
  assert(api.current.time === 30 && !api.current.playing, 'Playback must stop at endpoint, without looping');
  document.querySelector('#speed').value = '1';
  assert(document.documentElement.scrollWidth <= innerWidth, 'Page must not overflow horizontally');
  const normal = {width:innerWidth,height:innerHeight};
  api.setCapture({width:960,height:720});
  const canvas = document.querySelector('#map canvas');
  assert(canvas.width === 960 && canvas.height === 720, 'Capture must have exact pixel dimensions');
  assert(document.body.classList.contains('capture'), 'Capture must hide surrounding interface');
  api.renderAt(15); const capture = api.png();
  api.renderAt(1); api.renderAt(15);
  assert(capture === api.png(), 'Fixed-size capture must be deterministic');
  assert(capture.startsWith('data:image/png;base64,'), 'Export must be a PNG');
  return {result:'pass', viewport:normal, frames, deterministic:true, capture:[canvas.width,canvas.height]};
})();
