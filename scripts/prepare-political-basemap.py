# /// script
# requires-python = ">=3.10"
# dependencies = ["shapely==2.1.2", "pyshp==2.3.1"]
# ///
"""Prepare quiet political context; shared state edges are drawn only once.
uv run scripts/prepare-political-basemap.py --states /tmp/ne_10m_admin_1_states_provinces.zip --places /tmp/ne_10m_populated_places.zip
Natural Earth is public domain. No online map service is needed by visitors.
"""
import argparse
import hashlib
import io
import json
from pathlib import Path
import zipfile
import shapefile
from shapely.geometry import shape, mapping, Point
from shapely.ops import unary_union, linemerge

parser = argparse.ArgumentParser()
parser.add_argument('--states', required=True, type=Path)
parser.add_argument('--places', required=True, type=Path)
args = parser.parse_args()
folder = Path(__file__).resolve().parents[1] / 'maps/03-ski-area-polygons/data'

def records(path):
    with zipfile.ZipFile(path) as archive:
        stem = next(n[:-4] for n in archive.namelist() if n.endswith('.shp'))
        reader = shapefile.Reader(**{ext: io.BytesIO(archive.read(stem + '.' + ext)) for ext in ['shp', 'shx', 'dbf']})
        for row in reader.iterShapeRecords():
            yield row.record.as_dict(), shape(row.shape.__geo_interface__)

states = [(p, g) for p, g in records(args.states) if p.get('adm0_a3') == 'AUT']
assert len(states) == 9 and all(g.is_valid and not g.is_empty for _, g in states)
# Regional composition uses real admin-1 bounds, not a hand-drawn resort extent.
focus_states = [(p, g) for p, g in states if (p.get('name_en') or p['name']) in ('Vorarlberg', 'Tyrol', 'Salzburg')]
assert len(focus_states) == 3
(folder / 'region-context.geojson').write_text(json.dumps({
    'type': 'FeatureCollection',
    'features': [{'type': 'Feature', 'properties': {'name': 'Tirol' if p['name_en'] == 'Tyrol' else p['name_en']}, 'geometry': mapping(g)} for p, g in focus_states],
    'metadata': {'source': 'Natural Earth 1:10m admin-1 states/provinces', 'license': 'Public domain', 'sourceSHA256': hashlib.sha256(args.states.read_bytes()).hexdigest()}
}, ensure_ascii=False, separators=(',', ':')) + '\n')
(folder / 'region-bounds.json').write_text(json.dumps({
    'states': ['Vorarlberg', 'Tirol', 'Salzburg'],
    'bbox': list(unary_union([g for _, g in focus_states]).bounds),
    'source': 'Natural Earth 1:10m admin-1 states/provinces',
    'sourceSHA256': hashlib.sha256(args.states.read_bytes()).hexdigest(),
    'license': 'Public domain',
    'qualification': 'Rectangular framing of three states; neighboring country context and cross-border resort geometry are retained.'
}, ensure_ascii=False, indent=2) + '\n')
# Intersect adjacent polygon boundaries, then dissolve duplicate line segments.
# This avoids independently simplified polygons creating gaps or double edges.
edges = []
for i, (_, a) in enumerate(states):
    for _, b in states[i + 1:]:
        common = a.boundary.intersection(b.boundary)
        if common.length > 0:
            edges.append(common)
lines = linemerge(unary_union(edges)).simplify(.0004, preserve_topology=True)
assert lines.geom_type in ('LineString', 'MultiLineString') and not lines.is_empty
metadata = {'source': 'Natural Earth 1:10m admin-1 states/provinces and populated places; existing admin-0 country context', 'license': 'Public domain', 'licenseUrl': 'https://www.naturalearthdata.com/about/terms-of-use/', 'stateCount': 9, 'states': [p['name_en'] or p['name'] for p, _ in states], 'method': 'Intersect shared Austrian state boundaries; union linework before simplifying. No ski-area geometry or classification changes.', 'sourceSHA256': {'states': hashlib.sha256(args.states.read_bytes()).hexdigest(), 'places': hashlib.sha256(args.places.read_bytes()).hexdigest()}}
(folder / 'state-borders.geojson').write_text(json.dumps({'type': 'Feature', 'properties': {'kind': 'shared-state-boundaries'}, 'geometry': mapping(lines), 'metadata': metadata}, separators=(',', ':')) + '\n')
labels = []
def label(name, point, kind, min_zoom, priority, required=False):
    labels.append({'type': 'Feature', 'geometry': mapping(point), 'properties': {'name': name, 'kind': kind, 'minZoom': min_zoom, 'priority': priority, 'required': required}})
for p, g in states:
    point = Point(p['longitude'], p['latitude'])
    if not g.covers(point):
        point = g.representative_point()
    label(p['name_en'] or p['name'], point, 'state', 7.75, 20)
for f in json.loads((folder / 'context.geojson').read_text())['features']:
    g = shape(f['geometry'])
    if f['properties']['iso'] != 'AUT':
        label(f['properties']['name'], g.representative_point(), 'country', 5.5 if g.area > 1 else 9, 10)
city_count = 0
for p, g in records(args.places):
    if p.get('ADM0_A3') != 'AUT':
        continue
    name = p.get('NAME_EN') or p['NAME']
    required = name in ('Bregenz', 'Innsbruck', 'Salzburg')
    min_zoom = 0 if required or name == 'Vienna' else 8 if p['SCALERANK'] <= 7 else 9
    label(name, g, 'city', min_zoom, -10 if required else 0 if name == 'Vienna' else 30, required)
    city_count += 1
assert city_count == 9
(folder / 'reference-labels.geojson').write_text(json.dumps({'type': 'FeatureCollection', 'features': labels, 'metadata': metadata}, ensure_ascii=False, separators=(',', ':')) + '\n')
print(f'Prepared shared borders for {len(states)} Austrian states and {len(labels)} scale-aware labels ({city_count} verified city records).')
