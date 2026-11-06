import {DEFAULTS,VIEWS,matches,rangeText,validYears} from './filters.mjs';
import {createShipPhotos} from './photos.mjs';
import {setupDashboardLayout} from './layout.mjs';
setupDashboardLayout();

const $=id=>document.getElementById(id);
const d3=window.d3;
const state={...DEFAULTS};
const params=new URLSearchParams(location.search);
const requested=params.get('view');
const requestedShip=params.get('ship');
if(Object.hasOwn(VIEWS,requested))state.view=requested;
const PAGE_SIZE=8;
let all=[],visible=[],selected=null,page=0,projection,chart,selection,landData,photoPanel,pins=new Map();
const kindNames={wreck:'Wreck',burial:'Ship burial',deliberate:'Deliberate loss'};
const cultureNames={viking:'Norse / Viking',greek:'Greek / Hellenistic-associated',roman:'Roman-period',phoenician:'Phoenician-associated',other:'Other / uncertain',later:'Later historical wreck'};

function svgText(parent,text,x,y,cls) {return parent.append('text').attr('x',x).attr('y',y).attr('class',cls).text(text);}
function buildChart(land) {
  const view=VIEWS[state.view],W=view.width,H=view.height,pad={left:48,right:30,top:25,bottom:48};
  const svg=d3.select('#map');svg.selectAll(':scope > :not(title):not(desc)').remove();
  svg.attr('viewBox',`0 0 ${W} ${H}`).style('--chart-ratio',`${W}/${H}`);
  const [west,south,east,north]=view.bounds;
  const raw=d3.geoMercator().scale(1).translate([0,0]);
  const a=raw([west,north]),b=raw([east,south]);
  const scale=Math.min((W-pad.left-pad.right)/(b[0]-a[0]),(H-pad.top-pad.bottom)/(b[1]-a[1]));
  projection=d3.geoMercator().scale(scale).translate([
    pad.left+(W-pad.left-pad.right-scale*(b[0]-a[0]))/2-scale*a[0],
    pad.top+(H-pad.top-pad.bottom-scale*(b[1]-a[1]))/2-scale*a[1],
  ]);
  const nw=projection([west,north]),se=projection([east,south]);
  const frame={x:nw[0],y:nw[1],w:se[0]-nw[0],h:se[1]-nw[1]};
  const path=d3.geoPath().projection(projection),defs=svg.append('defs');
  defs.append('clipPath').attr('id','frame').append('rect').attr('x',frame.x).attr('y',frame.y).attr('width',frame.w).attr('height',frame.h);
  const grain=defs.append('pattern').attr('id','paper-grain').attr('width',17).attr('height',19).attr('patternUnits','userSpaceOnUse');
  grain.append('circle').attr('cx',3).attr('cy',7).attr('r',.6).attr('fill','#806540').attr('opacity',.12);
  const base=svg.append('g').attr('aria-hidden','true');
  base.append('rect').attr('x',frame.x).attr('y',frame.y).attr('width',frame.w).attr('height',frame.h).attr('fill','#dfd4b3').attr('fill-opacity',.4);
  chart=svg.append('g').attr('clip-path','url(#frame)');
  const scenery=chart.append('g').attr('aria-hidden','true');
  const step=state.view==='europe'?10:5;
  scenery.append('path').datum(d3.geoGraticule().extent([[west,south],[east,north]]).step([step,5])()).attr('d',path).attr('fill','none').attr('stroke','#867451').attr('stroke-width',.65).attr('opacity',.4);
  const compass=[frame.x+frame.w*.13,frame.y+frame.h*.27];
  for(let a=0;a<360;a+=22.5){const r=a*Math.PI/180;scenery.append('line').attr('x1',compass[0]).attr('y1',compass[1]).attr('x2',compass[0]+1800*Math.sin(r)).attr('y2',compass[1]-1800*Math.cos(r)).attr('stroke','#836744').attr('stroke-width',.65).attr('opacity',.15);}
  scenery.append('path').datum(land).attr('d',path).attr('fill','#f4eacd').attr('stroke','#65553d').attr('stroke-width',.9);
  scenery.append('rect').attr('x',frame.x).attr('y',frame.y).attr('width',frame.w).attr('height',frame.h).attr('fill','url(#paper-grain)');
  const rose=scenery.append('g').attr('transform',`translate(${compass})`);
  for(let i=0;i<8;i++)rose.append('path').attr('d',`M0,${i%2?-17:-28} L5,0 L0,6 L-5,0 Z`).attr('transform',`rotate(${i*45})`).attr('fill',i%2?'#eadbb7':'#65553d').attr('stroke','#65553d').attr('stroke-width',.7);
  rose.append('circle').attr('r',3).attr('fill','#f5eacc').attr('stroke','#65553d');
  svgText(rose,'N',0,-38,'north-label').attr('text-anchor','middle');
  const labels=state.view==='med'?[['IBERIA',[-3,40]],['ITALIA',[13,43]],['HELLAS',[24,39]],['ANATOLIA',[32,41]],['AFRICA',[13,31]],['MEDITERRANEAN SEA',[17,34.5]]]:state.view==='north'?[['NORWAY',[8,62]],['SWEDEN',[17,60]],['DENMARK',[10,56.8]],['BRITAIN',[-3,54]],['NORTH SEA',[2,56]]]:[['SCANDINAVIA',[15,65]],['BRITAIN',[-4,55]],['EUROPE',[17,50]],['AFRICA',[13,29]],['MEDITERRANEAN',[15,35]]];
  for(const [text,coords] of labels){const [x,y]=projection(coords);svgText(scenery,text,x,y,'place').attr('text-anchor','middle');}
  for(let lat=Math.ceil(south/5)*5;lat<north;lat+=5)svgText(base,`${lat}°N`,frame.x-7,projection([west,lat])[1]+3,'grid-label').attr('text-anchor','end');
  for(let lon=Math.ceil(west/step)*step;lon<east;lon+=step)svgText(base,`${Math.abs(lon)}°${lon<0?'W':lon>0?'E':''}`,projection([lon,south])[0],frame.y+frame.h+20,'grid-label').attr('text-anchor','middle');
  const edge=svg.append('g').attr('aria-hidden','true').attr('pointer-events','none');
  for(const inset of [0,6])edge.append('rect').attr('x',frame.x+inset).attr('y',frame.y+inset).attr('width',frame.w-inset*2).attr('height',frame.h-inset*2).attr('fill','none').attr('stroke','#65553d').attr('stroke-width',inset?.45:1);
  selection=chart.append('g').attr('pointer-events','none').attr('aria-hidden','true');
  $('chart-region').textContent=view.label.toUpperCase();
  $('chart-label').textContent=`Archaeological ship finds: ${view.label}`;
  // Marker leaders and selected labels use the actual projected frame bounds.
  chart.node().__frame=frame;
}

function drawMarkers() {
  chart.selectAll('.records-layer').remove();pins=new Map();
  const background=chart.append('g').attr('class','records-layer').attr('aria-hidden','true');
  for(const f of visible.filter(f=>!f.properties.featured)){
    const [x,y]=projection(f.geometry.coordinates);
    background.append('circle').attr('cx',x).attr('cy',y).attr('r',3).attr('class','background-wreck').attr('data-record',f.properties.id).on('click',()=>select(f));
  }
  const highlights=visible.filter(f=>f.properties.featured).map(f=>{const [x,y]=projection(f.geometry.coordinates);return {feature:f,x,y,tx:x,ty:y};});
  // Layout only numbered badges; reported positions remain separate anchor dots.
  const force=d3.forceSimulation(highlights).force('x',d3.forceX(d=>d.tx).strength(.2)).force('y',d3.forceY(d=>d.ty).strength(.2)).force('collide',d3.forceCollide(18).iterations(3)).stop();
  for(let i=0;i<100;i++)force.tick();
  const frame=chart.node().__frame;
  const layer=chart.append('g').attr('class','records-layer');
  for(const n of highlights){
    const f=n.feature,p=f.properties;n.x=Math.max(frame.x+18,Math.min(frame.x+frame.w-18,n.x));n.y=Math.max(frame.y+18,Math.min(frame.y+frame.h-18,n.y));
    layer.append('line').attr('x1',n.tx).attr('y1',n.ty).attr('x2',n.x).attr('y2',n.y).attr('class','badge-leader').attr('aria-hidden','true');
    layer.append('circle').attr('cx',n.tx).attr('cy',n.ty).attr('r',2).attr('class','anchor-dot').attr('aria-hidden','true');
    const pin=layer.append('g').attr('transform',`translate(${n.x},${n.y})`).attr('class','wreck').attr('data-record',p.id).attr('role','button').attr('tabindex',0).attr('aria-pressed','false').attr('aria-label',`${p.number}. ${p.name}; ${kindNames[p.kind]}; ${p.dateLabel}`);
    const shape=p.kind==='burial'?'M0,-16 L16,0 L0,16 L-16,0 Z':p.kind==='deliberate'?'M-13,-13 H13 V13 H-13 Z':null;
    if(shape)pin.append('path').attr('d',shape);else pin.append('circle').attr('r',14);
    pin.append('text').text(p.number);
    pin.on('click',()=>select(f)).on('keydown',()=>{if(['Enter',' '].includes(d3.event.key)){d3.event.preventDefault();select(f);}});
    pins.set(p.id,{pin,x:n.x,y:n.y});
  }
  updateHighlight();
}

function updateHighlight() {
  selection.selectAll('*').remove();
  for(const [id,{pin}] of pins)pin.attr('aria-pressed',String(selected?.properties.id===id));
  if(!selected)return;
  const p=selected.properties,[tx,ty]=projection(selected.geometry.coordinates),badge=pins.get(p.id),x=badge?.x??tx,y=badge?.y??ty;
  const frame=chart.node().__frame,right=x<frame.x+frame.w*.55;
  const endX=x+(right?35:-35),endY=Math.max(frame.y+25,y-30);
  if(!badge)selection.append('circle').attr('cx',tx).attr('cy',ty).attr('r',9).attr('fill','#8d382b').attr('stroke','#fff4db').attr('stroke-width',2).attr('stroke-dasharray',p.disputedLocation?'3 2':null);
  selection.append('path').attr('d',`M${x},${y} L${endX},${endY} h${right?10:-10}`).attr('class','selection-leader');
  svgText(selection,p.name,endX+(right?14:-14),endY+4,'selection-label').attr('text-anchor',right?'start':'end');
}

function details() {
  const inspector=document.querySelector('.inspect-panel');
  const key=selected?.properties.id||'';
  if(inspector.dataset.record!==key){inspector.scrollTop=0;inspector.dataset.record=key;}
  photoPanel.update(selected);
  $('wreck-detail').hidden=!selected;
  if(!selected){delete document.body.dataset.selectedWreck;return;}
  const p=selected.properties;
  document.body.dataset.selectedWreck=p.id;
  $('detail-name').textContent=p.name;
  $('detail-year').textContent=`${kindNames[p.kind].toUpperCase()} · ${p.dateLabel}`;
  $('detail-culture').textContent=cultureNames[p.culture]+(p.sourceCategory==='emodnet'?` · source period: ${p.period}`:'');
  $('detail-context').textContent=p.context.length>320?`${p.context.slice(0,317)}…`:p.context;
  $('detail-note').textContent=`${p.locationNote} Display coordinates are rounded; they do not promise kilometre-level accuracy.`;
  $('detail-dating').textContent=`Original dating: ${p.sourceDating}. Date basis: ${p.dateBasis}. Filter envelope: ${rangeText(p.dateStart,p.dateEnd)}. These bounds are not a statistical confidence interval.`;
  $('detail-reference').textContent=p.reference||'See the linked ship history for references.';
  $('record-source').href=p.source;$('record-source').textContent=p.sourceCategory==='emodnet'?'EMODnet catalogue':'Wikidata record';
  $('history-source').href=p.historySource;$('history-source').textContent=p.sourceCategory==='emodnet'?'Oxford database':'Ship history';
  $('coordinate-source').hidden=!p.coordinateSource||p.coordinateSource===p.source;
  if(p.coordinateSource)$('coordinate-source').href=p.coordinateSource;
  $('detail-credit').textContent=p.sourceCategory==='emodnet'?'EMODnet / AND-International; original provider: Oxford Roman Economy Project (Strauss 2013). CC BY 4.0.':'Wikidata coordinates: CC0. Historical annotations compiled from the linked sources.';
}

function register() {
  const ol=$('register');ol.replaceChildren();
  const slice=visible.slice(page*PAGE_SIZE,(page+1)*PAGE_SIZE);
  for(const f of slice){
    const p=f.properties,li=document.createElement('li'),button=document.createElement('button');
    button.type='button';button.dataset.record=p.id;button.setAttribute('aria-pressed',String(selected?.properties.id===p.id));
    for(const [cls,text] of [['number',p.number?String(p.number).padStart(2,'0'):'·'],['name',p.name],['year',p.featured?p.dateLabel:rangeText(p.dateStart,p.dateEnd)]]){
      const span=document.createElement('span');span.className=cls;span.textContent=text;button.append(span);
    }
    button.addEventListener('click',()=>select(f));li.append(button);ol.append(li);
  }
  $('register-page').textContent=visible.length?`${page*PAGE_SIZE+1}–${Math.min((page+1)*PAGE_SIZE,visible.length)} of ${visible.length}`:'No matching records';
  $('previous').disabled=page===0;$('next').disabled=(page+1)*PAGE_SIZE>=visible.length;
}
function select(f) {
  selected=f;const nextPage=Math.floor(visible.indexOf(f)/PAGE_SIZE);
  if(nextPage!==page){page=nextPage;register();}
  else for(const b of $('register').querySelectorAll('button'))b.setAttribute('aria-pressed',String(b.dataset.record===f.properties.id));
  details();updateHighlight();
}

function refresh(reframe=false) {
  visible=all.filter(f=>matches(f,state));page=0;
  selected=visible.find(f=>f.properties.id===selected?.properties.id)||visible[0]||null;
  if(reframe)buildChart(landData);
  drawMarkers();register();details();
  const unknown=visible.filter(f=>f.properties.dateStart==null).length;
  $('result-count').textContent=`${visible.length} records in this view${unknown?` · ${unknown} with unknown/unparsed dates`:''}`;
  $('empty').hidden=visible.length>0;
  $('date-window').textContent=`Date envelope: ${rangeText(state.from,state.to)}. ${state.unknown?'Unknown dates included.':'Unknown dates excluded.'}`;
  for(const b of document.querySelectorAll('[data-view]'))b.setAttribute('aria-pressed',String(b.dataset.view===state.view));
}
function readFilters() {
  const from=$('from-year').valueAsNumber,to=$('to-year').valueAsNumber;
  const valid=validYears(from,to);$('date-error').hidden=valid;
  for(const id of ['from-year','to-year'])$(id).setAttribute('aria-invalid',String(!valid));
  if(!valid)return; // Keep the previous valid map; never silently reinterpret year zero.
  Object.assign(state,{culture:$('culture').value,kind:$('kind').value,query:$('search').value,from,to,unknown:$('unknown').checked,later:$('later').checked});
  refresh();
}
function resetFilters(){Object.assign(state,{...DEFAULTS,view:state.view});$('culture').value='all';$('kind').value='all';$('search').value='';$('from-year').value=state.from;$('to-year').value=state.to;$('unknown').checked=true;$('later').checked=false;$('date-error').hidden=true;for(const id of ['from-year','to-year'])$(id).setAttribute('aria-invalid','false');}

try {
  const [land,data]=await Promise.all(['land.geojson','ships.geojson'].map(async file=>{const r=await fetch(`data/${file}`);if(!r.ok)throw new Error(`${file}: HTTP ${r.status}`);return r.json();}));
  if(!d3)throw new Error('Local D3 dependency unavailable');
  landData=land;all=data.features;
  photoPanel=await createShipPhotos();
  resetFilters();refresh(true);
  const initial=visible.find(f=>f.properties.id===requestedShip);
  if(initial)select(initial);
  $('status').hidden=true;
  for(const id of ['culture','kind','search','from-year','to-year','unknown','later'])$(id).addEventListener('input',readFilters);
  $('reset').addEventListener('click',()=>{resetFilters();refresh();});
  for(const b of document.querySelectorAll('[data-view]'))b.addEventListener('click',()=>{state.view=b.dataset.view;resetFilters();refresh(true);});
  $('previous').addEventListener('click',()=>{page--;register();});$('next').addEventListener('click',()=>{page++;register();});
  window.vintage={get state(){return {...state,page,selected:selected?.properties.id||null,visible:visible.map(f=>f.properties.id)};}};
} catch(error) {$('status').hidden=false;$('status').textContent=`Unable to load the local chart: ${error.message}`;$('status').setAttribute('role','alert');console.error(error);}
