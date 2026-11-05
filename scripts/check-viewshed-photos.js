// Run on a freshly loaded, normal viewshed page:
// agent-browser eval --stdin < scripts/check-viewshed-photos.js
(async () => {
  const api=window.viewshed;
  const {distance}=await api.ready;
  const {photos,radius}=await (await fetch('data/photos.json')).json();
  const panel=document.getElementById('route-photos');
  const assert=(condition,message)=>{if(!condition)throw new Error(message);};
  assert(!document.body.classList.contains('capture'),'Reload to leave capture mode before testing photo controls');
  const pins=[...document.querySelectorAll('.photo-pin')];
  assert(pins.length===photos.length*2,'Each photo needs a track and profile button');
  assert(document.getElementById('map').getAttribute('role')==='group','Map must expose interactive descendants');
  for(const photo of photos) {
    const controls=pins.filter(pin=>pin.dataset.photoId===photo.id);
    assert(controls.length===2,`${photo.id}: two linked controls`);
    for(const pin of controls) {
      assert(pin.tagName==='BUTTON' && pin.type==='button' && pin.getAttribute('aria-label').includes(photo.title),`${photo.id}: native accessible button`);
      assert(!pin.hidden,`${photo.id}: stop is inside this view`);
      api.renderAt(30);
      document.getElementById('play').click();
      pin.click();
      const expected=photo.distance/distance*api.duration;
      assert(!api.current.playing,`${photo.id}: clicking a stop pauses playback`);
      assert(Math.abs(api.current.time-expected)<1e-8,`${photo.id}: exact route seek`);
      assert(Math.abs(Number(document.getElementById('timeline').value)-expected)<=.011,`${photo.id}: progress slider follows seek`);
      assert(controls.every(control=>control.getAttribute('aria-pressed')==='true'),`${photo.id}: both markers synchronize`);
      const image=panel.querySelector('img');
      await image.decode();
      assert(!panel.querySelector('figure').hidden,`${photo.id}: card visible`);
      assert(image.naturalWidth>0 && image.alt,`${photo.id}: accessible local photo loaded`);
      assert(panel.querySelector('.photo-title').textContent===photo.title,`${photo.id}: title`);
      assert(panel.querySelector('.photo-source').href===photo.source,`${photo.id}: credit`);
    }
    const profilePin=controls.find(pin=>pin.dataset.photoLocation==='profile');
    assert(Math.abs(parseFloat(profilePin.style.left)-photo.distance/distance*100)<1e-4,`${photo.id}: chart stop matches distance axis`);
    const stop=photo.distance+radius+1;
    if(stop<distance) {
      api.renderAt(stop/distance*api.duration);
      assert(panel.querySelector('figure').hidden,`${photo.id}: hides outside proximity radius`);
      assert(controls.every(control=>control.getAttribute('aria-pressed')==='false'),`${photo.id}: clears stale selection`);
    }
  }
  // Resizing must keep track markers aligned with the orthographic scene.
  const before=api.framing;
  dispatchEvent(new Event('resize'));
  await new Promise(requestAnimationFrame);
  assert(JSON.stringify(api.framing)===JSON.stringify(before),'Resize without dimension changes preserves camera');
  api.renderAt(30);
  assert(panel.querySelector('figure').hidden,'No stale photo at the destination');
  document.getElementById('reset').click();
  assert(!panel.querySelector('figure').hidden,'Reset restores start photo');
  const timeline=document.getElementById('timeline');
  timeline.value=7.5;timeline.dispatchEvent(new Event('input',{bubbles:true}));
  assert(panel.querySelector('figure').hidden,'Timeline also updates photo selection');
  api.renderAt(0);
  assert(document.documentElement.scrollWidth<=innerWidth,'No horizontal overflow');
  if(innerWidth>900 && innerHeight>=720) assert(panel.getBoundingClientRect().bottom<=innerHeight,'Photo panel fits desktop viewport');
  return {passed:true,photos:photos.length,markers:pins.length,viewport:[innerWidth,innerHeight]};
})();
