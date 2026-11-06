import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {test} from 'node:test';
import {DEFAULTS,matches,rangeText,validYears,yearText} from '../maps/06-vintage-wrecks/filters.mjs';
const data=JSON.parse(await readFile(new URL('../maps/06-vintage-wrecks/data/ships.geojson',import.meta.url),'utf8')).features;
const filtered=(patch={})=>data.filter(f=>matches(f,{...DEFAULTS,...patch}));
const ids=patch=>filtered(patch).map(f=>f.properties.id);

test('default and three geographic views have explicit coverage',()=>{
  assert.equal(filtered().length,339);
  assert.equal(filtered({view:'north'}).length,11);
  assert.equal(filtered({view:'med'}).length,328);
  assert.equal(filtered({later:true}).length,346);
  assert.equal(filtered({view:'north',later:true}).length,18);
});
test('association filters reflect classifications, not cargo nationality',()=>{
  for(const [culture,count] of Object.entries({viking:6,greek:17,roman:241,phoenician:3,historic:5,other:67}))assert.equal(filtered({culture}).length,count,culture);
  assert.ok(ids({culture:'other'}).includes('Q573852'),'Uluburun remains uncertain');
  assert.ok(!ids({culture:'phoenician'}).includes('Q573852'));
  assert.ok(ids({culture:'roman'}).includes('Q2616711'),'Antikythera: Roman-period, not classified from Greek cargo');
  assert.equal(filtered({view:'med',culture:'viking'}).length,0);
});
test('ship burials and deliberate losses are not ordinary wrecks',()=>{
  assert.equal(filtered({kind:'burial'}).length,4);
  assert.equal(filtered({kind:'deliberate'}).length,2);
  assert.equal(filtered({kind:'wreck'}).length,333);
});
test('date filters use interval overlap, retain unknowns only explicitly',()=>{
  assert.equal(filtered({unknown:false}).length,290);
  assert.equal(filtered({from:-2500,to:-2001,unknown:false}).length,0);
  assert.equal(filtered({from:-2500,to:-2001,unknown:true}).length,49);
  const overlap=ids({from:-65,to:-62,unknown:false});
  assert.ok(overlap.includes('Q3589083'));
  assert.ok(overlap.includes('Q6728460'));
  assert.ok(!overlap.includes('Q832395'));
  assert.equal(filtered({from:834,to:834,view:'north',unknown:false}).length,1,'Oseberg; no invented uncertainty interval around Gokstad c. 900');
});
test('case-insensitive search and grouping remain transparent',()=>{
  assert.deepEqual(ids({query:'OSEBERG'}),['Q832395']);
  assert.ok(ids({query:'Mazarr'}).includes('Q2884899'));
  assert.ok(ids({query:'mazarron'}).includes('Q2884899'),'Accent-insensitive search');
  assert.deepEqual(ids({query:'Sandefjord'}),['Q640851'],'Discovery-site notes are searchable');
  assert.ok(!ids({query:'Mazarr'}).includes('emodnet:8903'));
  assert.equal(filtered({query:'no-such-ship-abcdef'}).length,0);
});
test('year validation rejects no-year-zero, invalid and reversed ranges',()=>{
  for(const [a,b] of [[0,1],[-1,0],[10,1],[NaN,100],[-100,Infinity],[-2501,100],[-100,2001],[1.5,3]])assert.equal(validYears(a,b),false,`${a},${b}`);
  assert.equal(validYears(-1,1),true);
  assert.equal(validYears(-2500,2000),true);
  assert.equal(yearText(-75),'75 BCE');
  assert.equal(rangeText(-75,-50),'75–50 BCE');
  assert.equal(rangeText(-1,1),'1 BCE–1 CE');
  assert.equal(rangeText(null,null),'Undated');
});
test('filtering is pure and leaves original source records unchanged',()=>{
  const before=JSON.stringify(data);filtered({view:'med',culture:'roman',unknown:false});assert.equal(JSON.stringify(data),before);
});
