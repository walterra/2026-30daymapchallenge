/* On the atlas: agent-browser eval --stdin < scripts/check-vintage-images.js */
(async()=>{
  const assert=(ok,msg)=>{if(!ok)throw new Error(msg);};
  const $=id=>document.getElementById(id);
  const until=async fn=>{const end=performance.now()+8000;while(!fn()){if(performance.now()>end)throw new Error('Image load timed out');await new Promise(r=>setTimeout(r,25));}};
  const [photos,data]=await Promise.all(['photos.json','ships.geojson'].map(async file=>(await fetch('data/'+file)).json()));
  document.querySelector('[data-view="europe"]').click();
  assert(photos.images.length===19,'Nineteen image records');
  const select=id=>document.querySelector(`#map .wreck[data-record="${id}"]`).dispatchEvent(new MouseEvent('click',{bubbles:true}));
  const ready=id=>$('ship-photo').dataset.record===id&&!$('ship-photo-image').hidden&&$('ship-photo-image').complete&&$('ship-photo-image').naturalWidth>0;
  for(const p of photos.images){
    select(p.id);await until(()=>ready(p.id));
    const img=$('ship-photo-image');
    assert(!$('ship-photo').hidden,'Selected highlight image visible');
    assert(img.alt===p.alt,'Accurate per-image alt text');
    assert(img.naturalWidth===p.width&&img.naturalHeight===p.height,'Correct local image dimensions');
    assert(img.currentSrc===new URL(p.src,location.href).href,'Correct local image, no stale selection');
    assert(getComputedStyle(img).filter.includes('sepia(1)'),'Sepia display filter');
    assert(getComputedStyle(img).objectFit==='contain','No forced image cropping');
    assert($('ship-photo-author').href===new URL(p.source).href,'Source link matches image');
    assert($('ship-photo-author').textContent.includes(p.author),'Author credit');
    assert($('ship-photo-license').textContent===p.license,'Individual licence shown');
    assert($('ship-photo-license').href===p.licenseUrl,'Individual licence link');
    assert($('ship-photo-kind').textContent===p.kind,'Reconstruction/artefact/original distinction');
    assert($('ship-photo-unfiltered').href===img.currentSrc,'Unfiltered local image available');
    assert(getComputedStyle($('ship-photo')).borderTopWidth==='0px','No inherited dashed figure border');
  }
  select('Q832395');select('Q573852');select('Q1190639');await until(()=>ready('Q1190639'));
  assert($('ship-photo-description').textContent.includes('1929'),'Nemi historical photo, not disputed 1930 image');
  assert($('detail-context').textContent.includes('inland lake ships'),'Nemi context is inland, not maritime');
  const background=data.features.find(f=>f.properties.sourceCategory==='emodnet');
  document.querySelector(`#map .background-wreck[data-record="${background.properties.id}"]`).dispatchEvent(new MouseEvent('click',{bubbles:true}));
  assert($('ship-photo').hidden&&$('ship-photo-image').getAttribute('src')===null,'No stale image on background records');
  assert(document.documentElement.scrollWidth<=innerWidth+1,'No horizontal overflow');
  assert(!performance.getEntriesByType('resource').some(r=>new URL(r.name).origin!==location.origin),'Local runtime images only');
  select('Q1190639');await until(()=>ready('Q1190639'));
  return {pass:true,images:19,selected:'Nemi ships (2)',viewport:[innerWidth,innerHeight],theme:document.documentElement.dataset.theme};
})();
