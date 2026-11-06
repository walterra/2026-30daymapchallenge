export const VIEWS = {
  europe: {label:'Europe & Mediterranean', bounds:[-26,27,43,71], width:860, height:870},
  north: {label:'Northern waters', bounds:[-12,49,23,65], width:860, height:760},
  med: {label:'Mediterranean', bounds:[-7,29,37,46], width:1000, height:650},
};
export const DEFAULTS = {view:'europe',culture:'all',kind:'all',query:'',from:-2000,to:1900,unknown:true,later:false};
export function yearText(year) {return `${Math.abs(year)} ${year<0?'BCE':'CE'}`;}
export function rangeText(a,b) {
  if(a==null||b==null)return 'Undated';
  if(a===b)return yearText(a);
  if(a<0&&b<0)return `${Math.abs(a)}–${Math.abs(b)} BCE`;
  if(a>0&&b>0)return `${a}–${b} CE`;
  return `${yearText(a)}–${yearText(b)}`;
}
export function validYears(from,to) {return Number.isInteger(from)&&Number.isInteger(to)&&from!==0&&to!==0&&from>=-2500&&to<=2000&&from<=to;}
export function matches(feature,state) {
  const p=feature.properties,[lon,lat]=feature.geometry.coordinates;
  const [west,south,east,north]=VIEWS[state.view].bounds;
  if(lon<west||lon>east||lat<south||lat>north)return false;
  if(p.sourceCategory==='later'&&!state.later)return false;
  if(state.culture!=='all'&&p.culture!==state.culture)return false;
  if(state.kind!=='all'&&p.kind!==state.kind)return false;
  const normalize=text=>text.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase();
  const q=normalize(state.query.trim());
  if(q&&!normalize(`${p.name} ${p.place||''} ${p.context||''} ${p.period||''} ${p.locationNote||''} ${p.reference||''}`).includes(q))return false;
  if(p.dateStart==null||p.dateEnd==null)return state.unknown;
  return p.dateStart<=state.to&&p.dateEnd>=state.from;
}
