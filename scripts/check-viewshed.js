/* Run on the viewshed page: agent-browser eval --stdin < scripts/check-viewshed.js */
(async () => {
  const assert = (condition, message) => { if (!condition) throw new Error(message); };
  const api = window.viewshed;
  await api.ready;
  const manifest = await fetch('data/manifest.json').then(response=>response.json());
  const lastFrame = manifest.frameCount-1;
  const mapElement = document.querySelector('#map');
  const interactiveCanvas = mapElement.querySelector('canvas');
  const density = Math.min(window.devicePixelRatio || 1,3);
  assert(interactiveCanvas.width===Math.floor(mapElement.clientWidth*density) && interactiveCanvas.height===Math.floor(mapElement.clientHeight*density),'Interactive canvas must use Retina backing resolution');
  assert(manifest.regionLabels?.some(region=>region.name==='KAISERWINKL'),'Both maps must carry the researched region label');
  const initialFraming = api.framing;
  const customView = document.querySelector('#map').dataset.view;
  if (customView) {
    const view = JSON.parse(customView);
    assert(initialFraming.centerX===view.centerX && initialFraming.centerY===view.centerY,'Cycling camera must use its own route-centered frame');
    assert(initialFraming.width<manifest.width*.75,'Cycling view must be zoomed in');
    for (const [x,y] of manifest.route) {
      assert(Math.abs(x-initialFraming.centerX)<initialFraming.width*.4 && Math.abs(y-initialFraming.centerY)<initialFraming.height*.4,'Entire route must remain inside the centered view with padding');
    }
  } else {
    assert(Math.abs(initialFraming.width-Math.max(manifest.width,manifest.height)*1.01)<1,'Hiking camera must retain its original full-terrain frame');
  }
  const frames = [];
  const pixelProbe = document.createElement('canvas');
  pixelProbe.width=interactiveCanvas.width; pixelProbe.height=interactiveCanvas.height;
  const probe = pixelProbe.getContext('2d',{willReadFrequently:true});
  const assertRedMarker = distance => {
    let i=1;
    while(i<manifest.route.length-1 && manifest.route[i][3]<distance)i++;
    const a=manifest.route[i-1],b=manifest.route[i];
    const t=Math.max(0,Math.min(1,(distance-a[3])/(b[3]-a[3]||1)));
    const x=a[0]+(b[0]-a[0])*t,y=a[1]+(b[1]-a[1])*t;
    const px=Math.floor(((x-initialFraming.centerX)/initialFraming.width+.5)*interactiveCanvas.width);
    const py=Math.floor(((y-initialFraming.centerY)/initialFraming.height+.5)*interactiveCanvas.height);
    probe.drawImage(interactiveCanvas,0,0);
    const [r,g,blue]=probe.getImageData(px,py,1,1).data;
    assert(r>160 && g<100 && blue<120,'Position marker must stay red above the blue overlay');
  };
  for (const time of [0, 15, 30]) {
    const result = api.renderAt(time);
    frames.push(result.frame);
    assertRedMarker(result.distance);
    assert(result.time === time, 'Requested time must be exact');
    assert(JSON.stringify(api.framing)===JSON.stringify(initialFraming),'Camera must remain fixed throughout playback');
    assert(!api.current.playing, 'Capture must pause interactive playback');
    assert(+document.querySelector('#timeline').value === time, 'Scrubber must track capture time');
  }
  assert(frames.join(',') === [0,Math.round(lastFrame/2),lastFrame].join(','), 'Expected sample frames at start, midpoint and end');
  const boundaries = [lastFrame];
  for (let cut=manifest.atlasPageSize;cut<=lastFrame;cut+=manifest.atlasPageSize) boundaries.push(cut-1,cut);
  for (const frame of boundaries) {
    const time = frame*30/lastFrame;
    assert(api.renderAt(time).frame === frame,'Atlas boundary must select the requested global frame');
    const png = api.png();
    api.renderAt(0); api.renderAt(time);
    assert(png === api.png(),'Seeking across atlas pages must restore identical pixels');
  }
  assert(['rgb(203, 42, 66)','rgb(237, 113, 132)'].includes(getComputedStyle(document.querySelector('#timeline')).accentColor), 'Timeline must use the red page accent');
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
  const mapBounds = document.querySelector('#map').getBoundingClientRect();
  const panelBounds = document.querySelector('.control-panel').getBoundingClientRect();
  assert(Math.abs(mapBounds.width-mapBounds.height)<1,'Normal map must be square');
  if (innerWidth>900) {
    assert(panelBounds.left>=mapBounds.right-1,'Desktop controls must sit to the right of the map');
    assert(Math.abs(panelBounds.top-mapBounds.top)<1,'Desktop columns must align at the top');
    if (innerHeight>=600) {
      const stage = document.querySelector('.experience').getBoundingClientRect();
      assert(stage.top+scrollY>=0 && stage.bottom+scrollY<=innerHeight-16,'The complete desktop visualization must fit on screen with breathing room');
    }
    const widthBeforeScroll = mapBounds.width;
    window.scrollBy(0,150);
    await new Promise(requestAnimationFrame);
    assert(Math.abs(document.querySelector('#map').getBoundingClientRect().width-widthBeforeScroll)<1,'Scrolling must not resize the map');
    window.scrollTo(0,0);
  } else {
    assert(panelBounds.top>=mapBounds.bottom-1,'Narrow screens must stack controls below the map');
  }
  const normal = {width:innerWidth,height:innerHeight};
  api.setCapture({width:960,height:720});
  const canvas = document.querySelector('#map canvas');
  assert(canvas.width === 960 && canvas.height === 720, 'Capture must have exact pixel dimensions');
  assert(document.body.classList.contains('capture'), 'Capture must hide surrounding interface');
  assert(getComputedStyle(document.querySelector('.control-panel')).display==='none','Capture must hide the complete control panel');
  api.renderAt(15); const capture = api.png();
  api.renderAt(1); api.renderAt(15);
  assert(capture === api.png(), 'Fixed-size capture must be deterministic');
  assert(capture.startsWith('data:image/png;base64,'), 'Export must be a PNG');
  return {result:'pass', viewport:normal, pixelRatio:density, frames, atlasFormat:api.state.atlasFormat,startupMs:api.state.startupMs,deterministic:true, capture:[canvas.width,canvas.height]};
})();
