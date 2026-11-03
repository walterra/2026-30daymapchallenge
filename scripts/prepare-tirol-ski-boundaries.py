# /// script
# requires-python = ">=3.10"
# dependencies = ["shapely==2.1.2", "ijson==3.4.0"]
# ///
"""Prepare the separate CC BY Tirol layer; do not dissolve it into ODbL data.
uv run scripts/prepare-tirol-ski-boundaries.py --input /tmp/tirol-ski-boundaries.geojson \
  --snapshot-date 2026-11-03 --ski-areas /tmp/ski-areas.geojson --runs /tmp/ski-runs.geojson
Input query: layer 7 of the official ogd_sport service, outFields=OBJECTID,NAME,STAND,EMASST, outSR=4326, f=geojson.
"""
import argparse
import datetime
import hashlib
import json
from pathlib import Path
from urllib.parse import urlencode
import ijson
from shapely.geometry import shape

parser = argparse.ArgumentParser()
parser.add_argument('--input', required=True, type=Path)
parser.add_argument('--snapshot-date', required=True, type=datetime.date.fromisoformat)
parser.add_argument('--ski-areas', required=True, type=Path)
parser.add_argument('--runs', type=Path)
args = parser.parse_args()
folder = Path(__file__).resolve().parents[1] / 'maps/03-ski-area-polygons/data'
raw = args.input.read_bytes()
source = json.loads(raw)
base = 'https://gis.tirol.gv.at/arcgis/rest/services/Service_Public/ogd_sport/MapServer/7'
areas = json.loads(args.ski_areas.read_text())['features']
solden = next(f for f in areas if f['properties'].get('name') == 'Sölden')
assert solden['geometry']['type'] == 'Point', 'Re-evaluate Sölden association if its source geometry changes'
features = []
associations = []
for f in source['features']:
    p = f['properties']
    geometry = shape(f['geometry'])
    assert geometry.is_valid and not geometry.is_empty
    aliases = []
    if p['NAME'] == 'Ötztaler Gletscher':
        assert geometry.covers(shape(solden['geometry']))
        aliases = ['Sölden']
        evidence = {'officialObjectId': p['OBJECTID'], 'officialName': p['NAME'], 'alias': 'Sölden', 'openSkiDataId': solden['properties']['id'], 'sourcePoint': solden['geometry']['coordinates'], 'pointContained': True, 'qualification': 'Association, not a claim of identical current operational boundaries.'}
        if args.runs:
            count = intersects = inside = 0
            with args.runs.open('rb') as stream:
                for run in ijson.items(stream, 'features.item', use_float=True):
                    if any(a['properties']['id'] == solden['properties']['id'] for a in run['properties'].get('skiAreas', [])):
                        g = shape(run['geometry'])
                        count += 1; intersects += g.intersects(geometry); inside += g.within(geometry)
            digest = hashlib.sha256()
            with args.runs.open('rb') as stream:
                for chunk in iter(lambda: stream.read(8 * 1024 * 1024), b''):
                    digest.update(chunk)
            evidence['pisteRecordCheck'] = {'runsSHA256': digest.hexdigest(), 'associatedRecords': count, 'intersectingRecords': intersects, 'fullyContainedRecords': inside, 'qualification': 'Record counts, not distance-weighted or area-weighted coverage.'}
        associations.append(evidence)
    date = datetime.datetime.fromtimestamp(p['STAND'] / 1000, datetime.timezone.utc).date().isoformat() if p.get('STAND') else None
    features.append({'type': 'Feature', 'geometry': f['geometry'], 'properties': {'id': 'tiris:' + str(p['OBJECTID']), 'name': p['NAME'].strip(), 'originalName': p['NAME'], 'dataset': 'tirol', 'aliases': aliases, 'regions': ['Tirol'], 'referenceDate': date, 'captureScale': p.get('EMASST'), 'officialObjectId': p['OBJECTID'], 'sourceUrl': base + '/query?' + urlencode({'where': 'OBJECTID=' + str(p['OBJECTID']), 'outFields': 'OBJECTID,NAME,STAND,EMASST', 'returnGeometry': 'false', 'f': 'pjson'}), 'sources': [], 'websites': []}})
features.sort(key=lambda f: shape(f['geometry']).area, reverse=True)
meta = {'source': base, 'sourceItem': 'https://www.arcgis.com/home/item.html?id=9fb23fac39034eadaff8054fdd35cbf6', 'sourceSHA256': hashlib.sha256(raw).hexdigest(), 'downloaded': args.snapshot_date.isoformat(), 'referenceDates': sorted({f['properties']['referenceDate'] for f in features if f['properties']['referenceDate']}), 'records': len(features), 'uniqueNames': len({f['properties']['name'] for f in features}), 'license': 'CC BY 4.0', 'licenseUrl': 'https://creativecommons.org/licenses/by/4.0/', 'attribution': 'Land Tirol – tiris, Schigebietsgrenzen', 'meaning': 'Official ski-area planning boundaries, not verified current piste surfaces or live operational footprints.', 'reviewedAssociations': associations, 'mergePolicy': 'Separate supplementary source layer. No geometric dissolve, clipping, deduplication or combined resort count.'}
(folder / 'tirol-boundaries.geojson').write_text(json.dumps({'type': 'FeatureCollection', 'features': features, 'metadata': meta}, ensure_ascii=False, separators=(',', ':')) + '\n')
(folder / 'tirol-coverage.json').write_text(json.dumps(meta, ensure_ascii=False, indent=2) + '\n')
print(json.dumps(meta, ensure_ascii=False, indent=2))
