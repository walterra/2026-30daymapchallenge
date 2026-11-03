# /// script
# requires-python = ">=3.10"
# dependencies = ["shapely==2.1.2", "pyshp==2.3.1"]
# ///
"""Reduce a pinned OpenSkiData download and prepare public-domain context.
uv run scripts/prepare-ski-polygons.py --ski-areas /tmp/ski-areas.geojson \
  --snapshot-date 2026-11-02 --countries /tmp/ne_10m_admin_0_countries.zip \
  --places /tmp/ne_50m_populated_places.zip
No network calls. OpenSkiData automated downloads are limited to once daily.
"""
import argparse
from collections import Counter
import datetime
import hashlib
import io
import json
from pathlib import Path
import zipfile
import shapefile
from shapely.geometry import shape, mapping, box

parser = argparse.ArgumentParser()
parser.add_argument('--ski-areas', required=True, type=Path)
parser.add_argument('--snapshot-date', required=True, type=datetime.date.fromisoformat)
parser.add_argument('--countries', required=True, type=Path)
parser.add_argument('--places', required=True, type=Path)
args = parser.parse_args()
folder = Path(__file__).resolve().parents[1] / 'maps/03-ski-area-polygons/data'
folder.mkdir(parents=True, exist_ok=True)
source_bytes = args.ski_areas.read_bytes()
source = json.loads(source_bytes)
selected = [f for f in source['features'] if f['properties'].get('status') == 'operating' and 'downhill' in f['properties'].get('activities', []) and any(p.get('iso3166_1Alpha2') == 'AT' for p in f['properties'].get('places', []))]
features = []
omitted = []
for f in selected:
    p = f['properties']
    if f['geometry']['type'] not in ('Polygon', 'MultiPolygon'):
        omitted.append({'name': p.get('name'), 'id': p['id'], 'geometryType': f['geometry']['type'], 'reason': 'No polygon supplied; no substitute boundary created'})
        continue
    geometry = shape(f['geometry'])
    assert geometry.is_valid and not geometry.is_empty, p['id']
    regions = sorted({place.get('localized', {}).get('en', {}).get('region') for place in p['places'] if place.get('localized', {}).get('en', {}).get('region')})
    features.append({'type': 'Feature', 'geometry': f['geometry'], 'properties': {'id': p['id'], 'name': p.get('name'), 'regions': regions, 'status': p['status'], 'activities': p['activities'], 'sources': p.get('sources', []), 'websites': p.get('websites', []), 'wikidataID': p.get('wikidataID')}})
# Paint broad envelopes first to keep smaller overlapping records inspectable.
features.sort(key=lambda f: shape(f['geometry']).area, reverse=True)
meta = {'source': 'https://tiles.openskimap.org/geojson/ski_areas.geojson', 'sourceDocumentation': 'https://openskidata.org/', 'snapshotDownloaded': args.snapshot_date.isoformat(), 'sourceSHA256': hashlib.sha256(source_bytes).hexdigest(), 'selection': 'Source places contains AT; status operating; activities includes downhill. Country association is supplied by OpenSkiData, not reclassified here.', 'selectedRecords': len(selected), 'polygonRecords': len(features), 'geometryCounts': dict(Counter(f['geometry']['type'] for f in features)), 'omittedRecords': len(omitted), 'omitted': omitted, 'namedPolygonRecords': sum(bool(f['properties']['name']) for f in features), 'license': 'ODbL 1.0', 'licenseUrl': 'https://opendatacommons.org/licenses/odbl/1-0/', 'attribution': "OpenSkiData / OpenSkiMap.org, © OpenStreetMap contributors (ODbL), Skimap.org, Who’s On First, © Mapterhorn", 'limitations': ['Not a complete Austrian resort inventory. Counts are source records, not unique resorts.', 'Outlines can overlap, be coarse, span borders or have imperfect country/region classification.', 'Source outlines are preserved without clipping, buffering, convex hulls or boundary invention.', 'Polygons are broad mapped ski-area outlines, not piste surfaces, land ownership or legal boundaries.', 'Operating is a source category, not a live lift/piste opening report.']}
(folder / 'ski-areas.geojson').write_text(json.dumps({'type': 'FeatureCollection', 'features': features, 'metadata': {key: meta[key] for key in ['source', 'snapshotDownloaded', 'license', 'licenseUrl', 'attribution']}}, ensure_ascii=False, separators=(',', ':')) + '\n')
(folder / 'coverage.json').write_text(json.dumps(meta, ensure_ascii=False, indent=2) + '\n')

def read_shapes(path, stem):
    with zipfile.ZipFile(path) as archive:
        reader = shapefile.Reader(**{ext: io.BytesIO(archive.read(stem + '.' + ext)) for ext in ['shp', 'shx', 'dbf']})
        for record in reader.iterShapeRecords():
            yield record.record.as_dict(), record.shape.__geo_interface__

context = []
view = box(8.4, 45.6, 18.3, 49.8)
austria = None
for p, geometry in read_shapes(args.countries, 'ne_10m_admin_0_countries'):
    original = shape(geometry)
    if p['ADM0_A3'] == 'AUT':
        austria = {'type': 'Feature', 'properties': {'name': 'Austria'}, 'geometry': geometry}
    if original.intersects(view):
        clipped = original.intersection(view).simplify(.001, preserve_topology=True)
        if clipped.geom_type not in ('Polygon', 'MultiPolygon'):
            continue
        context.append({'type': 'Feature', 'properties': {'name': p['NAME'], 'iso': p['ADM0_A3']}, 'geometry': mapping(clipped)})
assert austria is not None
cities = []
for p, geometry in read_shapes(args.places, 'ne_50m_populated_places'):
    if p.get('ADM0NAME') == 'Austria':
        cities.append({'type': 'Feature', 'properties': {'name': p['NAME']}, 'geometry': geometry})
(folder / 'context.geojson').write_text(json.dumps({'type': 'FeatureCollection', 'features': context, 'metadata': {'source': 'Natural Earth 1:10m admin-0 countries', 'license': 'Public domain', 'url': 'https://www.naturalearthdata.com/about/terms-of-use/', 'note': 'Generalized background only, not used to classify or clip ski areas.'}}, ensure_ascii=False, separators=(',', ':')) + '\n')
(folder / 'austria.geojson').write_text(json.dumps(austria, separators=(',', ':')) + '\n')
(folder / 'cities.geojson').write_text(json.dumps({'type': 'FeatureCollection', 'features': cities, 'metadata': {'source': 'Natural Earth 1:50m populated places', 'license': 'Public domain'}}, separators=(',', ':')) + '\n')
print(json.dumps({k:v for k,v in meta.items() if k not in ['omitted', 'limitations']}, ensure_ascii=False, indent=2))
