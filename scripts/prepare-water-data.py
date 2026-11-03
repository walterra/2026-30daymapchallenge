# /// script
# requires-python = ">=3.10"
# dependencies = ["pyproj==3.7.2"]
# ///
"""uv run scripts/prepare-water-data.py — transform and audit cached Tirol extraction."""
import json
from collections import Counter
from pathlib import Path
import re
from pyproj import Transformer

folder = Path(__file__).resolve().parents[1] / 'maps/02-engineered-winter/data'
source = json.loads((folder / 'tirol-source.json').read_text())
transform = Transformer.from_crs('EPSG:31254', 'EPSG:4326', always_xy=True)
central_to_west = Transformer.from_crs('EPSG:31255', 'EPSG:31254', always_xy=True)
gis = json.loads((folder / 'gis-source.json').read_text())
assert gis['crs'] == 'EPSG:31254'
geometry_by_id = {r['id']: r for r in gis['records']}
assert len(geometry_by_id) == len(gis['records']), 'Ambiguous GIS ID matches'

def anchor(geometry):
    if not geometry:
        return None
    if 'x' in geometry and 'y' in geometry:
        return geometry['x'], geometry['y'], 'Official GIS point'
    if 'rings' in geometry:
        area2 = sx = sy = 0
        for ring in geometry['rings']:
            for (x1, y1), (x2, y2) in zip(ring, ring[1:]):
                cross = x1 * y2 - x2 * y1
                area2 += cross
                sx += (x1 + x2) * cross
                sy += (y1 + y2) * cross
        if abs(area2) > .01:
            return sx / (3 * area2), sy / (3 * area2), 'Official GIS polygon centroid (symbol anchor, not an entrance)'
    return None

features = []
rejected = []
all_nodes = {n['id']: n for n in source['nodes']}

def numeric_attribute(attributes, term, unit):
    matches = [(key, value) for key, value in attributes.items() if term in key.lower()]
    if len(matches) != 1:
        return None
    match = re.fullmatch(r'([\d.,]+)\s*' + re.escape(unit), matches[0][1])
    if not match:
        return None
    return float(match[1].replace('.', '').replace(',', '.'))

for node in source['nodes']:
    kind = 'reservoir' if 'Beschneiungsteich' in node.get('type', '') else 'system' if 'Schneeanlage' in node.get('type', '') else 'facility'
    volume = numeric_attribute(node['attributes'], 'genutztes volumen', 'm³') if kind == 'reservoir' else None
    snow = numeric_attribute(node['attributes'], 'ausmaß schneifläche', 'ha')
    p = {**node, 'kind': kind, 'usableM3': volume, 'snowmakingHa': snow}
    official = geometry_by_id.get(node['id'])
    position = anchor(official.get('geometry')) if official else None
    if not position:
        rejected.append({'id': node['id'], 'name': node['name'], 'reason': 'No unique authoritative geometry match in queried GIS layers 28 / 14', 'districts': node['districts']})
        continue
    x, y, method = position
    p['coordinateSource'] = method
    p['gisLayer'] = official['layer']
    if 'rw' in node and 'hw' in node:
        # Audit ambiguous WIS coordinate zones against the ID-matched geometry.
        candidates = {'EPSG:31254': (node['rw'], node['hw']), 'EPSG:31255': central_to_west.transform(node['rw'], node['hw'])}
        distances = {crs: ((a - x) ** 2 + (b - y) ** 2) ** .5 for crs, (a, b) in candidates.items()}
        chosen = min(distances, key=distances.get)
        p['rawCoordinateCrsCheck'] = chosen if distances[chosen] < 2000 else 'unresolved'
        p['rawCoordinateOffsetM'] = round(distances[chosen], 1)
    lon, lat = transform.transform(x, y)
    if not (10 <= lon <= 13.2 and 46.5 <= lat <= 47.85):
        rejected.append({'id': node['id'], 'name': node['name'], 'reason': 'Outside broad Tirol bounds after EPSG:31254 conversion', 'districts': node['districts']})
        continue
    features.append({'type': 'Feature', 'geometry': {'type': 'Point', 'coordinates': [round(lon, 6), round(lat, 6)]}, 'properties': p})
points = {f['properties']['id']: f for f in features}
links = []
for node in source['nodes']:
    parent = node.get('parent')
    if node['id'] in points and parent in points:
        links.append({'type': 'Feature', 'geometry': {'type': 'LineString', 'coordinates': [points[parent]['geometry']['coordinates'], points[node['id']]['geometry']['coordinates']]}, 'properties': {'parent': parent, 'child': node['id'], 'reports': node['reports'], 'districts': node['districts'], 'meaning': 'Documented parent–child association; not a pipeline or flow direction.'}})
reservoirs = [f for f in features if f['properties']['kind'] == 'reservoir']
systems = [{'id': n['id'], 'name': n['name'], 'districts': n['districts'], 'type': n.get('type', ''), 'status': n.get('status', ''), 'attributes': n['attributes'], 'snowmakingHa': numeric_attribute(n['attributes'], 'ausmaß schneifläche', 'ha'), 'facilities': sum(n['id'] in item['reports'] for item in source['nodes']), 'locatedFacilities': sum(n['id'] in f['properties']['reports'] for f in features)} for n in source['nodes'] if n['isSystem']]
coverage = []
for row in source['districts']:
    district = row['district']
    relevant = [n for n in source['nodes'] if district in n['districts']]
    mapped = [f for f in features if district in f['properties']['districts']]
    coverage.append({**row, 'uniqueFacilities': len(relevant), 'mappedFacilities': len(mapped), 'reservoirs': sum(f['properties']['kind'] == 'reservoir' for f in mapped)})
metadata = {'retrieved': source['retrieved'], 'query': source['query'], 'crs': 'Official GIS EPSG:31254 → EPSG:4326; WIS raw coordinates have mixed zones', 'geometryService': gis['service'], 'coordinateMethods': dict(Counter(f['properties']['coordinateSource'] for f in features)), 'rawCoordinateCrsChecks': dict(Counter(f['properties'].get('rawCoordinateCrsCheck', 'No WIS coordinate pair') for f in features)), 'attribution': 'Land Tirol, Wasserbuch / WIS and official ogd_wasser GIS service', 'reuseStatus': 'No open bulk-data license verified; research prototype, reuse clearance unresolved.', 'uniqueFacilities': len(source['nodes']), 'mappedFacilities': len(features), 'unmappedFacilities': len(rejected), 'relationships': len(links), 'reservoirs': len(reservoirs), 'reservoirsWithVolume': sum(f['properties']['usableM3'] is not None for f in reservoirs), 'systems': systems, 'districts': coverage, 'statusCounts': dict(Counter(n.get('status', 'unknown') for n in source['nodes'])), 'unresolvedParents': sum('parentName' in n and 'parent' not in n for n in source['nodes'])}
(folder / 'water.geojson').write_text(json.dumps({'type': 'FeatureCollection', 'features': features + links, 'metadata': metadata}, ensure_ascii=False, separators=(',', ':')) + '\n')
(folder / 'coverage.json').write_text(json.dumps({**metadata, 'unmappedRecords': rejected}, ensure_ascii=False, indent=2) + '\n')
print(json.dumps({k: v for k, v in metadata.items() if k != 'systems'}, ensure_ascii=False, indent=2))
