#!/usr/bin/env python3
"""Reduce downloaded OpenSkiData files to an Austrian downhill snapshot.
Usage: python3 scripts/prepare-ski-data.py /tmp/ski-areas.geojson /tmp/ski-runs.geojson
Downloads: https://openskidata.org/#downloads (at most once daily).
"""
import datetime
import json
from pathlib import Path
import sys

OUT = Path(__file__).resolve().parents[1] / 'maps/02-engineered-winter/data'
OUT.mkdir(parents=True, exist_ok=True)

def austrian(p):
    return any(place.get('iso3166_1Alpha2') == 'AT' for place in p.get('places', []))

def coords(value):
    if isinstance(value[0], (int, float)):
        return [round(value[0], 5), round(value[1], 5)]
    return [coords(v) for v in value]

def save(name, features):
    (OUT / name).write_text(json.dumps({'type': 'FeatureCollection', 'features': features}, separators=(',', ':')) + '\n')

areas = []
for f in json.load(open(sys.argv[1]))['features']:
    p = f['properties']
    if not austrian(p) or 'downhill' not in p.get('activities', []) or p.get('status') != 'operating':
        continue
    center = p.get('viewportHint', {}).get('center')
    if not center:
        continue
    areas.append({'type': 'Feature', 'geometry': {'type': 'Point', 'coordinates': coords(center)}, 'properties': {'name': p.get('name') or 'Unnamed ski area'}})
save('areas.geojson', areas)
runs = []
counts = {'yes': 0, 'no': 0, 'unknown': 0}
for f in json.load(open(sys.argv[2]))['features']:
    p = f['properties']
    if not austrian(p) or 'downhill' not in p.get('uses', []) or p.get('status') != 'operating' or f['geometry']['type'] != 'LineString':
        continue
    snow = 'yes' if p.get('snowmaking') is True else 'no' if p.get('snowmaking') is False else 'unknown'
    counts[snow] += 1
    runs.append({'type': 'Feature', 'geometry': {'type': 'LineString', 'coordinates': coords(f['geometry']['coordinates'])}, 'properties': {'name': p.get('name') or p.get('ref') or 'Unnamed piste segment', 'snowmaking': snow, 'resorts': ', '.join(a['properties'].get('name') or 'Unnamed ski area' for a in p.get('skiAreas', [])), 'sources': p.get('sources', [])}})
save('runs.geojson', runs)
metadata = {'downloadDate': datetime.date.today().isoformat(), 'source': 'https://openskidata.org/', 'areas': len(areas), 'segments': len(runs), 'snowmaking': counts, 'scope': 'Operating Austrian downhill LineString features only; polygon pistes excluded. Country membership supplied by OpenSkiData. Cross-border geometries are not clipped.'}
(OUT / 'metadata.json').write_text(json.dumps(metadata, indent=2) + '\n')
print(json.dumps(metadata, indent=2))
