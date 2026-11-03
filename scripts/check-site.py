#!/usr/bin/env python3
"""Dependency-free data and local HTML-link smoke checks. Run from any directory."""
import json
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import unquote, urlsplit

root = Path(__file__).resolve().parents[1]
entry = root / 'maps/02-engineered-winter'
data = json.loads((entry / 'data/water.geojson').read_text())
source = json.loads((entry / 'data/tirol-source.json').read_text())
coverage = json.loads((entry / 'data/coverage.json').read_text())
reviewed = json.loads((entry / 'data/water-source.json').read_text())
meta = data['metadata']
source_by_id = {n['id']: n for n in source['nodes']}
points = {f['properties']['id']: f for f in data['features'] if f['geometry']['type'] == 'Point'}
links = [f for f in data['features'] if f['geometry']['type'] == 'LineString']
assert len(points) == meta['mappedFacilities']
assert len(source_by_id) == len(source['nodes']) == meta['uniqueFacilities']
assert len(links) == meta['relationships']
assert len(points) + len(coverage['unmappedRecords']) == len(source['nodes'])
assert {r['district'] for r in meta['districts']} == {'Imst', 'Innsbruck-Land', 'Innsbruck-Stadt', 'Kitzbühel', 'Kufstein', 'Landeck', 'Lienz', 'Reutte', 'Schwaz'}
assert len(meta['systems']) == len(source['reportHashes'])
for row in meta['districts']:
    assert row['searchRows'] >= row['reports']
    assert row['uniqueFacilities'] == sum(row['district'] in n['districts'] for n in source['nodes'])
    assert row['mappedFacilities'] == sum(row['district'] in f['properties']['districts'] for f in points.values())
for f in points.values():
    node = source_by_id[f['properties']['id']]
    assert all(f['properties'][key] == value for key, value in node.items())
    assert all(report in source['reportHashes'] for report in node['reports'])
    lon, lat = f['geometry']['coordinates']
    assert 10 <= lon <= 13.2 and 46.5 <= lat <= 47.85
# Regression against the original manually inspected Sölden transcription.
for n in reviewed['nodes']:
    p = points[n['id']]['properties']
    assert p['rw'] == n['rw'] and p['hw'] == n['hw']
    if 'usableM3' in n:
        assert p['usableM3'] == n['usableM3']
assert next(s for s in meta['systems'] if s['id'] == 'T20571970R3')['snowmakingHa'] == 47.9
for f in links:
    p = f['properties']
    assert points[p['child']]['properties']['parent'] == p['parent']
    assert f['geometry']['coordinates'] == [points[p['parent']]['geometry']['coordinates'], points[p['child']]['geometry']['coordinates']]
# A stable anchor detects swapped axes or a wrong regional meridian.
lon, lat = points['T20572011R3']['geometry']['coordinates']
assert 10.92 < lon < 10.95 and 46.90 < lat < 46.94
# Eastern Tirol must not be shifted three degrees west by the M28 assumption.
lon, lat = points['T14585010']['geometry']['coordinates']
assert 12.10 < lon < 12.13 and 47.42 < lat < 47.45
assert points['T14585010']['properties']['rawCoordinateCrsCheck'] == 'EPSG:31255'
gis = json.loads((entry / 'data/gis-source.json').read_text())
assert set(points).issubset({r['id'] for r in gis['records']})
assert {(f['properties']['parent'], f['properties']['child']) for f in links} == {(n['parent'], n['id']) for n in source['nodes'] if n.get('parent') in points and n['id'] in points}
assert meta['reservoirsWithVolume'] == sum(f['properties']['kind'] == 'reservoir' and f['properties']['usableM3'] is not None for f in points.values())

outline = json.loads((entry / 'data/tirol-outline.geojson').read_text())
assert outline['type'] == 'FeatureCollection'
assert len(outline['features']) == 1
assert outline['features'][0]['properties']['NAME'] == 'Tirol'
assert outline['features'][0]['geometry']['type'] == 'MultiPolygon'
assert outline['metadata']['source'].endswith('/ogd_basis/MapServer/42')
for polygon in outline['features'][0]['geometry']['coordinates']:
    for ring in polygon:
        assert ring[0] == ring[-1]
        assert all(10 < lon < 13.2 and 46.5 < lat < 48 for lon, lat in ring)

class Links(HTMLParser):
    def __init__(self, path):
        super().__init__()
        self.path = path

    def handle_starttag(self, tag, attrs):
        for name, url in attrs:
            if name not in ('src', 'href') or not url or url.startswith('#'):
                continue
            parsed = urlsplit(url)
            if parsed.scheme or parsed.netloc:
                continue
            assert not parsed.path.startswith('/'), f'Root-absolute URL: {url}'
            target = (self.path.parent / unquote(parsed.path)).resolve()
            assert target.is_relative_to(root), f'Escaping project root: {url}'
            assert target.exists(), f'Missing local resource: {target}'

for path in root.rglob('*.html'):
    if '.git' not in path.parts:
        Links(path).feed(path.read_text())
print(f"PASS: {len(points)} facilities, {len(links)} relationships, 9 districts, coverage accounting, source fidelity, Sölden regression, local HTML resources")
