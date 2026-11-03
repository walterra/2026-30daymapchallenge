# /// script
# requires-python = ">=3.10"
# dependencies = ["requests==2.32.5"]
# ///
"""Read-only official GIS queries, cached outside repository.
uv run scripts/fetch-water-geometry.py --cache /tmp/wis-tirol-cache
Only IDs already in the WIS snowmaking extract are requested.
"""
import argparse
import datetime
import hashlib
import json
from pathlib import Path
import re
import time
import requests

folder = Path(__file__).resolve().parents[1] / 'maps/02-engineered-winter/data'
source = json.loads((folder / 'tirol-source.json').read_text())
parser = argparse.ArgumentParser()
parser.add_argument('--cache', required=True, type=Path)
args = parser.parse_args()
args.cache.mkdir(parents=True, exist_ok=True)
ids = sorted(n['id'] for n in source['nodes'])
assert all(re.fullmatch(r'[ATSK]\w+', id) for id in ids)
base = 'https://gis.tirol.gv.at/arcgis/rest/services/Service_Public/ogd_wasser/MapServer/'
records = []
for layer in [28, 14]:
    for start in range(0, len(ids), 100):
        batch = ids[start:start + 100]
        key = hashlib.sha256(','.join(batch).encode()).hexdigest()[:12]
        path = args.cache / f'gis-{layer}-{key}.json'
        if path.exists():
            result = json.loads(path.read_text())
        else:
            time.sleep(.4)
            params = {'f': 'json', 'where': 'ANL_ID IN (' + ','.join("'" + id + "'" for id in batch) + ')', 'outFields': 'ANL_ID,ANL_NAME', 'returnGeometry': 'true', 'outSR': '31254'}
            response = requests.get(base + str(layer) + '/query', params=params, timeout=60)
            response.raise_for_status()
            result = response.json()
            if 'error' in result or result.get('exceededTransferLimit'):
                raise ValueError(result)
            if result.get('spatialReference', {}).get('wkid') != 31254:
                raise ValueError('Unexpected official GIS CRS')
            path.write_text(json.dumps(result))
        for feature in result['features']:
            assert feature['attributes']['ANL_ID'] in batch
            records.append({'id': feature['attributes']['ANL_ID'], 'name': feature['attributes']['ANL_NAME'], 'layer': layer, 'geometry': feature.get('geometry')})
        print(f'layer {layer}, batch {start // 100 + 1}: {len(result["features"])} geometries', flush=True)
output = {'retrieved': datetime.date.today().isoformat(), 'service': base, 'crs': 'EPSG:31254', 'layers': {'28': 'Alle Wasserinformationen (Übersicht), points', '14': 'Speicher, polygons'}, 'records': records}
(folder / 'gis-source.json').write_text(json.dumps(output, ensure_ascii=False, separators=(',', ':')) + '\n')
print(f'{len(records)} official geometries retrieved')

# Generalized province boundary for a tile-free overview and context inset.
outline_service = 'https://gis.tirol.gv.at/arcgis/rest/services/Service_Public/ogd_basis/MapServer/42'
outline_cache = args.cache / 'tirol-outline.geojson'
if outline_cache.exists():
    outline = json.loads(outline_cache.read_text())
else:
    time.sleep(.4)
    response = requests.get(outline_service + '/query', params={'where': '1=1', 'outFields': 'NAME', 'returnGeometry': 'true', 'outSR': '4326', 'geometryPrecision': '4', 'f': 'geojson'}, timeout=60)
    response.raise_for_status()
    outline = response.json()
    assert outline.get('type') == 'FeatureCollection' and len(outline['features']) == 1
    assert outline['features'][0]['properties']['NAME'] == 'Tirol'
    assert outline['features'][0]['geometry']['type'] == 'MultiPolygon'
    outline_cache.write_text(json.dumps(outline))
outline['metadata'] = {'source': outline_service, 'attribution': 'Land Tirol, ogd_basis, Landesgrenze generalisiert', 'retrieved': datetime.date.today().isoformat(), 'purpose': 'Generalized geographic context, not survey-grade boundaries', 'reuseStatus': 'Specific redistribution license remains unverified.'}
(folder / 'tirol-outline.geojson').write_text(json.dumps(outline, ensure_ascii=False, separators=(',', ':')) + '\n')
print('Prepared generalized Tirol boundary for geographic context')
