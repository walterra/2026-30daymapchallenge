# /// script
# requires-python = ">=3.10"
# dependencies = ["shapely==2.1.2"]
# ///
"""Create reviewed callout anchors inside the actual Tirol polygons.
These editorial examples are not a ranking of resort size. No boundary changes.
"""
import json
from pathlib import Path
from shapely.geometry import shape

folder = Path(__file__).resolve().parents[1] / 'maps/03-ski-area-polygons/data'
source = json.loads((folder / 'tirol-boundaries.geojson').read_text())
features = {f['properties']['id']: f for f in source['features']}
examples = [
    {'featureId': 'tiris:72', 'sourceName': 'Rendl - St. Anton a.A.', 'title': 'St. Anton', 'featureIds': ['tiris:72', 'tiris:74', 'tiris:31'], 'label': 'Rendl and the Albonagrat planning areas.', 'compactLabel': 'Rendl + Albonagrat'},
    {'featureId': 'tiris:102', 'sourceName': 'Ötztaler Gletscher', 'title': 'Ötztal / Sölden', 'featureIds': ['tiris:102', 'tiris:40', 'tiris:37', 'tiris:6'], 'label': 'Sölden, Gurgl and Vent: a cluster along the valley.', 'compactLabel': 'Sölden, Gurgl, Vent'},
    {'featureId': 'tiris:77', 'sourceName': 'Hahnenkamm - Ehrenbachhöhe', 'title': 'Kitzbühel', 'featureIds': ['tiris:77', 'tiris:79', 'tiris:1', 'tiris:55'], 'label': 'Hahnenkamm, Horn and the areas toward Pass Thurn.', 'compactLabel': 'Hahnenkamm + Horn'},
]
for example in examples:
    feature = features[example['featureId']]
    assert feature['properties']['name'] == example['sourceName']
    geometry = shape(feature['geometry'])
    point = geometry.representative_point()
    assert geometry.covers(point)
    example['coordinates'] = [point.x, point.y]
    members = [features[key] for key in example['featureIds']]
    boxes = [shape(member['geometry']).bounds for member in members]
    example['bounds'] = [min(b[0] for b in boxes), min(b[1] for b in boxes), max(b[2] for b in boxes), max(b[3] for b in boxes)]
    example['members'] = [{'id': member['properties']['id'], 'name': member['properties']['name']} for member in members]
    example['referenceDate'] = feature['properties']['referenceDate']
    example['dataset'] = 'tirol'
output = {'annotations': examples, 'metadata': {'selection': 'Editorial examples requested by the map author; not a largest-resorts ranking.', 'anchors': 'Interior points identify reference records; circle centers and radii are derived at runtime from the projected bounds of each reviewed polygon group. Circles are visual highlights, not resort boundaries.', 'meaning': 'Circle callouts group nearby Tirol planning polygons with reference date 2011-10-30. Membership is editorial, not an exhaustive resort or valley inventory.', 'attribution': source['metadata']['attribution'], 'license': 'CC BY 4.0', 'licenseUrl': 'https://creativecommons.org/licenses/by/4.0/'}}
(folder / 'annotations.json').write_text(json.dumps(output, ensure_ascii=False, indent=2) + '\n')
print('Prepared 3 regional circle callouts with verified polygon-group bounds; no size-ranking claim.')
