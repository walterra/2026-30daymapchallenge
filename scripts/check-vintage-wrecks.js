/* Run on the loaded atlas: agent-browser eval --stdin < scripts/check-vintage-wrecks.js */
(async()=>{
  const assert=(ok,msg)=>{if(!ok)throw new Error(msg);};
  const data=(await(await fetch('data/ships.geojson')).json()).features;
  const state=()=>window.vintage.state;
  const $=id=>document.getElementById(id);
  const view=name=>document.querySelector(`[data-view="${name}"]`).click();
  const input=(id,value)=>{const el=$(id);if(el.type==='checkbox')el.checked=value;else el.value=value;const event=el.tagName==='SELECT'||el.type==='checkbox'?'change':'input';el.dispatchEvent(new Event(event,{bubbles:true}));};
  const checkCount=n=>assert(state().visible.length===n,`Expected ${n} records, got ${state().visible.length}`);
  view('europe');checkCount(339);assert($('status').hidden,'No loading error');
  assert(document.querySelectorAll('#map .wreck').length===19,'Nineteen reviewed badges');
  assert(document.querySelectorAll('#register button').length===8,'Register is paginated');
  $('next').click();assert(state().page===1,'Next page');$('previous').click();assert(state().page===0,'Previous page');
  view('north');checkCount(11);
  const northern=data.filter(f=>f.properties.region==='north');
  for(const f of northern){
    const p=f.properties;document.querySelector(`#register button[data-record="${p.id}"]`).click();
    assert(state().selected===p.id&&$('detail-name').textContent===p.name,'Register selection');
    assert($('record-source').href===p.source&&$('history-source').href===p.historySource,'Correct source links');
    assert(document.querySelector(`#map [data-record="${p.id}"]`).getAttribute('aria-pressed')==='true','Synchronized highlight');
    assert(document.querySelectorAll('#register button[aria-pressed="true"]').length===1,'Exactly one register selection');
  }
  const pin=document.querySelector('#map .wreck[data-record="Q832395"]');
  pin.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true}));assert(state().selected==='Q832395','Enter selects original Oseberg site');
  document.querySelector('#map .wreck[data-record="Q831457"]').dispatchEvent(new KeyboardEvent('keydown',{key:' ',bubbles:true}));assert(state().selected==='Q831457','Space selects grouped Skuldelev site');
  input('kind','burial');checkCount(4);input('kind','deliberate');checkCount(2);
  input('kind','all');input('culture','historic');checkCount(5);
  for(const id of ['Q219821','Q544894','Q1789811','Q20819337','Q907712']){
    assert(state().visible.includes(id),'Historical highlight in its own collection');
    document.querySelector(`#register button[data-record="${id}"]`).click();
    assert(state().selected===id&&$('ship-photo').dataset.record===id,'Historical record and image selection synchronized');
    if(id==='Q544894')assert($('detail-credit').textContent.includes('Historic England'),'Mary Rose coordinate licence exception credited');
  }
  view('med');checkCount(328);
  input('culture','phoenician');checkCount(3);
  assert(state().visible.includes('Q2884899')&&!state().visible.includes('emodnet:8903'),'Mazarrón group not double counted');
  assert(!state().visible.includes('Q573852'),'Uluburun not labelled Phoenician');
  input('culture','roman');checkCount(241);input('culture','greek');checkCount(17);
  input('search','a-nonexistent-ship-abcdef');checkCount(0);assert(!$('empty').hidden&&$('wreck-detail').hidden,'Explicit empty state');
  $('reset').click();checkCount(328);
  const background=data.filter(f=>f.properties.sourceCategory==='emodnet')[1];
  document.querySelector(`#map .background-wreck[data-record="${background.properties.id}"]`).dispatchEvent(new MouseEvent('click',{bubbles:true}));
  assert(state().selected===background.properties.id&&state().page>0,'Background-dot selection moves register page');
  assert(document.querySelector(`#register button[data-record="${background.properties.id}"]`).getAttribute('aria-pressed')==='true','Selected background record accessible in register');
  assert($('detail-credit').textContent.includes('CC BY 4.0'),'EMODnet detail credit');
  input('unknown',false);checkCount(279);
  input('from-year',-65);input('to-year',-62);
  const expected=data.filter(f=>f.properties.region==='med'&&f.properties.dateStart!=null&&f.properties.dateStart<=-62&&f.properties.dateEnd>=-65);
  checkCount(expected.length);assert(state().visible.includes('Q3589083'),'Date interval overlap includes Mahdia');
  const previous=JSON.stringify(state().visible);input('from-year',0);
  assert(!$('date-error').hidden&&JSON.stringify(state().visible)===previous,'Year zero rejected, previous chart preserved');
  view('europe');input('later',true);checkCount(346);
  input('search','Royal Charter');assert(state().visible.includes('Q1721414'),'Original later layer available');
  document.querySelector('#register button[data-record="Q1721414"]').click();assert($('detail-note').textContent.includes('1.8 km'),'Known legacy location conflict retained');
  view('europe');checkCount(339);
  assert(document.documentElement.scrollWidth<=innerWidth+1,'No horizontal page overflow');
  assert(!performance.getEntriesByType('resource').some(r=>new URL(r.name).origin!==location.origin),'Local runtime resources only');
  return {pass:true,views:3,defaultRecords:339,fullRecords:346,viewport:[innerWidth,innerHeight],theme:document.documentElement.dataset.theme};
})();
