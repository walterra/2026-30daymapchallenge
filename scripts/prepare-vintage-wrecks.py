#!/usr/bin/env python3
"""Rebuild local datasets: uv run --with shapely scripts/prepare-vintage-wrecks.py."""
import hashlib
import json
from pathlib import Path
from shapely.geometry import shape, box, mapping
from vintage_dates import date_envelope

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'maps/06-vintage-wrecks/data'
LEGACY = [
    ('Q1145770',1588,'Galleass','County Antrim','Spanish Armada','Girona_(ship)'),
    ('Q5632075',1690,'Warship','Sound of Mull','Storm loss','English_ship_Dartmouth_(1655)'),
    ('Q1134543',1691,'Ship of the line','Off Plymouth','Storm loss','HMS_Coronation'),
    ('Q3024668',1707,'Ship of the line','Isles of Scilly','Scilly naval disaster','HMS_Association'),
    ('Q839283',1744,'Ship of the line','English Channel','Storm loss','HMS_Victory_(1737)'),
    ('Q1721414',1859,'Steam clipper','Anglesey','Royal Charter storm','Royal_Charter_(ship)'),
    ('Q1803745',1898,'Steamship','The Manacles, Cornwall','Struck rocks','SS_Mohegan'),
]

def read(name):
    return json.loads((OUT/name).read_text())

def write(name,data):
    (OUT/name).write_text(json.dumps(data,ensure_ascii=False,separators=(',',':'))+'\n')

def collection(features,metadata):
    return dict(type='FeatureCollection',metadata=metadata,features=features)

def point(props,coords):
    return dict(type='Feature',properties=props,geometry=dict(type='Point',coordinates=coords))

def culture(period):
    # Only explicit source-period labels: never infer identity from cargo.
    if period == 'Phoenician': return 'phoenician'
    if 'Greek' in period or 'Hellenistic' in period and 'Roman' not in period: return 'greek'
    if any(word in period for word in ['Roman','Republican','Imperial']): return 'roman'
    return 'other'

raw=read('wikidata-source.json'); legacy=[]
for number,(qid,year,kind,place,context,title) in enumerate(LEGACY,1):
    e=raw['entities'][qid]
    claims=[s for s in e['claims']['P625'] if s.get('rank')!='deprecated' and 'datavalue' in s['mainsnak']]
    assert len(claims)==1, f'Review legacy coordinate claims: {qid}'
    c=claims[0]['mainsnak']['datavalue']['value']
    p=dict(id=qid,number=number,name=e['labels']['en']['value'],year=year,kind=kind,place=place,context=context,
           source=f'https://www.wikidata.org/wiki/{qid}',revision=e['lastrevid'],
           historySource='https://en.wikipedia.org/wiki/'+title,
           locationNote='Reported wreck location; not independently surveyed for this map.')
    if qid=='Q1721414':
        p.update(disputedLocation=True,locationNote='Location needs review: Wikidata and the linked article differ by approximately 1.8 km. The Wikidata position is retained, not silently corrected.')
    legacy.append(point(p,[c['longitude'],c['latitude']]))
write('wrecks.geojson',collection(legacy,dict(title='Original seven historical wrecks',reviewed='2026-11-06',
    selection='Seven deliberately curated examples, not an inventory or representative sample.')))

review=read('reviewed-ships.json'); entities=read('ancient-wikidata-source.json')['entities']; curated=[]
replaced={x for r in review['records'] for x in r.get('replaces',[])}
for number, record in enumerate(review['records'],1):
    r=dict(record); e=entities[r['coordinateEntity']]
    claim=e['claims']['P625'][r.pop('coordinateIndex')]
    assert claim['rank']!='deprecated'
    c=claim['mainsnak']['datavalue']['value']
    r.update(number=number,sourceCategory='curated',featured=True,
             source=f'https://www.wikidata.org/wiki/{r["id"]}',
             coordinateSource=f'https://www.wikidata.org/wiki/{r["coordinateEntity"]}',
             coordinateClaim=claim['id'],coordinateRevision=e['lastrevid'],
             license='CC0 coordinates; independently compiled factual annotations',
             sourceDating=r['dateLabel'],period='Norse/Viking' if r['culture']=='viking' else r['culture'],
             reference='Source history reviewed 6 November 2026. No article prose copied; contextual images are separately licensed in photos.json.')
    curated.append(point(r,[round(c['longitude'],2),round(c['latitude'],2)]))

emodnet=read('emodnet-source.geojson'); provenance=read('emodnet-provenance.json'); background=[]
assert emodnet['numberMatched']==emodnet['numberReturned']==len(emodnet['features'])==provenance['records']
assert replaced.issubset({'emodnet:'+f['properties']['source_id'] for f in emodnet['features']})
for f in emodnet['features']:
    p=f['properties']; id='emodnet:'+p['source_id']
    assert p['source_inf']=='The Oxford Roman Economy Project' and f['geometry']['type']=='Point'
    if id in replaced: continue
    bounds=date_envelope(p['dating'])
    q=dict(id=id,name=p['name'],region='med',culture=culture(p['period']),kind='wreck',
           sourceCategory='emodnet',featured=False,dateStart=bounds[0] if bounds else None,
           dateEnd=bounds[1] if bounds else None,dateLabel=p['dating'],sourceDating=p['dating'],
           dateBasis='Source dating; broad whole-century filter envelope; early/late qualifiers retained in original text',
           period=p['period'],context=p['obj_desc'] if p['obj_desc']!='n/a' else 'Oxford-derived archaeological wreck record.',
           locationNote='Published approximate location, rounded for regional mapping. Source coordinates are not reliable navigation or excavation fixes.',
           source=provenance['catalogue'],historySource='https://oxrep.web.ox.ac.uk/shipwrecks-database',
           reference=p['reference'],license='CC BY 4.0',sourceRecord=f['id'],sourceId=p['source_id'],
           sourceYear=p['yr_updated'])
    background.append(point(q,[round(v,2) for v in f['geometry']['coordinates']]))

later=[]
for f in legacy:
    p=f['properties'];q={**p,'region':'later','culture':'later','kind':'wreck','sourceCategory':'later',
       'featured':False,'dateStart':p['year'],'dateEnd':p['year'],'dateLabel':f'{p["year"]} CE',
       'dateBasis':'Loss year','sourceDating':str(p['year']),'period':'Later historical wreck',
       'license':'CC0 coordinates; independently compiled factual annotations'}
    later.append(point(q,[round(v,2) for v in f['geometry']['coordinates']]))
features=curated+background+later
assert len({f['properties']['id'] for f in features})==len(features)
metadata=dict(title='Ships of the ancient seas',reviewed='2026-11-06',
    selection='Partial archaeological coverage plus curated Viking/ancient highlights. Not a complete European inventory.',
    emodnetCredit=provenance['credit'],emodnetOriginalProvider=provenance['originalProvider'],
    emodnetInput=len(emodnet['features']),groupedReplacements=sorted(replaced),
    curatedSites=len(curated),backgroundRecords=len(background),laterRecords=len(later),
    dateConvention='Negative years are BCE; positive years are CE; no year zero. Whole-century bins are broad filter envelopes, not confidence intervals. Circa dates filter by their nominal year without invented uncertainty intervals.',
    locationConvention='Rounded to two decimal places for regional display; precision is not accuracy. Displaced numbered badges have leaders to the reported point.',
    unknownDating=sum(f['properties']['dateStart'] is None for f in features),
    cautions=['Museums are not original find sites.','Periods and associations are not proven crew nationalities.','Site/group records are not counts of individual ships.'])
write('ships.geojson',collection(features,metadata))
land=json.loads((ROOT/'maps/04-travel-clusters/data/land.geojson').read_text())
write('land.geojson',dict(type='Feature',properties={**land['properties'],'clipBounds':[-26,26,47,73]},
    geometry=mapping(shape(land['geometry']).intersection(box(-26,26,47,73)))))
inputs=['wikidata-source.json','ancient-wikidata-source.json','reviewed-ships.json','emodnet-source.geojson','emodnet-provenance.json']
inputs += [name for name in ['image-selection.json','commons-images.json','photos.json'] if (OUT/name).exists()]
write('snapshot.json',dict(reviewed='2026-11-06',sha256={n:hashlib.sha256((OUT/n).read_bytes()).hexdigest() for n in inputs+['ships.geojson','land.geojson']},
    exclusions=['Oxford 2017 Excel: no redistribution licence verified; not bundled.','Gjellestad and Gozo: reviewed candidate Wikidata entities lacked direct find coordinates.','Klåstad ship: queried coordinate identifies its museum; not bundled.','Marsala Punic ship: original find coordinate not verified; unrelated medieval Marsala A remains as its own background record.']))
print(f'Prepared {len(features)} records: {len(curated)} curated, {len(background)} background, {len(later)} optional later; {metadata["unknownDating"]} unknown dating')
