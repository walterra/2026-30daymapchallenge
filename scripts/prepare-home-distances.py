# /// script
# requires-python = ">=3.10"
# dependencies = ["pyproj==3.7.2", "pyshp==2.3.1", "shapely==2.1.2"]
# ///
"""Generate a static, distance-faithful SVG and reproducible measurements.
uv run scripts/prepare-home-distances.py --land-zip /tmp/ne_10m_land.zip
Land: https://naciscdn.org/naturalearth/10m/physical/ne_10m_land.zip
"""
import argparse
import hashlib
import html
import io
import json
import math
import re
from pathlib import Path
import zipfile
import shapefile
from pyproj import CRS, Geod, Transformer
from shapely.geometry import box, mapping, shape
from shapely.ops import unary_union

parser = argparse.ArgumentParser()
parser.add_argument('--land-zip', type=Path, required=True)
args = parser.parse_args()
folder = Path(__file__).resolve().parents[1] / 'maps/02-close-to-home'
locations = json.loads((folder / 'data/locations.json').read_text())
origin = locations['origin']['coordinates']
geod = Geod(ellps='WGS84')
projection_definition = f'+proj=aeqd +lat_0={origin[1]} +lon_0={origin[0]} +datum=WGS84 +units=m +no_defs'
crs = CRS.from_proj4(projection_definition)
project = Transformer.from_crs('EPSG:4326', crs, always_xy=True)
features = []
for destination in locations['destinations']:
    azimuth, _, metres = geod.inv(*origin, *destination['coordinates'])
    coordinates = [origin, *geod.npts(*origin, *destination['coordinates'], 63), destination['coordinates']]
    # Ellipsoidal AEQD preserves distances and azimuths from its origin.
    x, y = project.transform(*destination['coordinates'])
    assert math.isclose(math.hypot(x, y), metres, abs_tol=.01)
    sampled_length = sum(geod.inv(*a, *b)[2] for a, b in zip(coordinates, coordinates[1:]))
    assert math.isclose(sampled_length, metres, abs_tol=.01)
    features.append({'type': 'Feature', 'geometry': {'type': 'LineString', 'coordinates': coordinates}, 'properties': {**destination, 'origin': locations['origin']['name'], 'distance_m': round(metres, 3), 'initialAzimuthDegrees': azimuth % 360, 'displayKm': round(metres / 1000)}})
comparison = {'method': 'WGS84 ellipsoidal geodesic, pyproj.Geod.inv (PROJ)', 'projection': projection_definition, 'origin': locations['origin'], 'destinations': [f['properties'] for f in features], 'difference_m': round(features[0]['properties']['distance_m'] - features[1]['properties']['distance_m'], 3), 'qualification': 'Published place reference coordinates, not a home address. Display rounded to nearest kilometer. Neither roads, flights nor Lisboa–Kyiv distance.'}
(folder / 'data/routes.geojson').write_text(json.dumps({'type': 'FeatureCollection', 'features': features}, ensure_ascii=False, indent=2) + '\n')
(folder / 'data/calculations.json').write_text(json.dumps(comparison, ensure_ascii=False, indent=2) + '\n')

with zipfile.ZipFile(args.land_zip) as archive:
    reader = shapefile.Reader(shp=io.BytesIO(archive.read('ne_10m_land.shp')), shx=io.BytesIO(archive.read('ne_10m_land.shx')), dbf=io.BytesIO(archive.read('ne_10m_land.dbf')))
    clip = box(-22, 30, 43, 62)
    land = unary_union([shape(s.__geo_interface__).intersection(clip) for s in reader.shapes()])
(folder / 'data/land.geojson').write_text(json.dumps({'type': 'Feature', 'properties': {'source': 'Natural Earth 1:10m land', 'license': 'Public domain', 'url': 'https://www.naturalearthdata.com/about/terms-of-use/'}, 'geometry': mapping(land)}, separators=(',', ':')) + '\n')

# One uniform x/y scale: map distances from the origin are not stretched.
WIDTH, HEIGHT = 1000, 570
SCALE = WIDTH / 3_950_000
X0, Y0 = 2_250_000 * SCALE, 950_000 * SCALE

def xy(coordinates):
    x, y = project.transform(*coordinates)
    return X0 + x * SCALE, Y0 - y * SCALE

def path_line(coordinates):
    return ' '.join(('M' if i == 0 else 'L') + f'{x:.2f},{y:.2f}' for i, (x, y) in enumerate(map(xy, coordinates)))

polygons = list(land.geoms) if hasattr(land, 'geoms') else [land]
land_path = ' '.join(path_line(list(ring.coords)) + ' Z' for polygon in polygons for ring in [polygon.exterior, *polygon.interiors])

def text(x, y, value, size=20, color='#263f49', anchor='start', weight=400):
    return f'<text x="{x:.2f}" y="{y:.2f}" font-size="{size}" fill="{color}" text-anchor="{anchor}" font-weight="{weight}" paint-order="stroke" stroke="#fbfcfa" stroke-width="5" stroke-linejoin="round">{html.escape(value)}</text>'

for mobile in [False, True]:
    labels = []
    lines = []
    for feature in features:
        p = feature['properties']
        x, y = xy(feature['geometry']['coordinates'][-1])
        lines.append(f'<path d="{path_line(feature["geometry"]["coordinates"])}" fill="none" stroke="{p["color"]}" stroke-width="3.5" vector-effect="non-scaling-stroke"/>')
        lines.append(f'<circle cx="{x:.2f}" cy="{y:.2f}" r="{8 if mobile else 6}" fill="{p["color"]}" stroke="#fff" stroke-width="2"/>')
        if p['name'] == 'Lisboa':
            labels += [text(x - 8, y + (58 if mobile else 39), 'Lisboa', 40 if mobile else 25, p['color'], weight=700), text(x - 8, y + (100 if mobile else 65), 'Portugal', 31 if mobile else 17, '#596b70')]
            label_x, label_y = (X0 + x) / 2 - 8, (Y0 + y) / 2 - (20 if mobile else 15)
        else:
            labels += [text(x + 8, y - (46 if mobile else 30), 'Kyiv', 40 if mobile else 25, p['color'], 'end', 700), text(x + 8, y - (8 if mobile else 8), 'Ukraine', 31 if mobile else 17, '#596b70', 'end')]
            label_x, label_y = (X0 + x) / 2 + 8, (Y0 + y) / 2 + (52 if mobile else 32)
        labels.append(text(label_x, label_y, f'{p["displayKm"]:,} km', 37 if mobile else 23, p['color'], 'middle', 700))
    labels += [text(X0, Y0 - (64 if mobile else 51), 'HOME', 25 if mobile else 12, '#596b70', 'middle', 600), text(X0, Y0 - (24 if mobile else 24), 'Kössen', 39 if mobile else 23, '#20343b', 'middle', 700), text(X0, Y0 + (56 if mobile else 39), 'Tirol, Austria', 28 if mobile else 15, '#596b70', 'middle')]
    # Geographic country names are orientation labels, not additional observations.
    context = '' if mobile else ''.join(text(*xy(coord), name, 13, '#748582', 'middle') for name, coord in [('FRANCE', [2, 46.8]), ('GERMANY', [10, 51.2]), ('SPAIN', [-4, 40]), ('ITALY', [13.5, 42])])
    svg = f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {WIDTH} {HEIGHT}" role="img" aria-labelledby="title description">
<title id="title">Two distances from home</title>
<desc id="description">From Kössen, Tirol: Lisboa, Portugal is 2,003 kilometers away; Kyiv, Ukraine is 1,356 kilometers away. Lisboa is 647 kilometers farther from Kössen. WGS84 geodesic distances; the projection preserves distances from Kössen.</desc>
<defs><clipPath id="frame"><rect width="{WIDTH}" height="{HEIGHT}"/></clipPath></defs>
<g font-family="system-ui, sans-serif" clip-path="url(#frame)">
<rect width="{WIDTH}" height="{HEIGHT}" fill="#fbfcfa"/>
<path d="{land_path}" fill="#e8eeea" stroke="#bdcbc6" stroke-width=".7" fill-rule="evenodd"/>
{context}
{''.join(lines)}
<circle cx="{X0:.2f}" cy="{Y0:.2f}" r="{10 if mobile else 7}" fill="#20343b" stroke="#fff" stroke-width="3"/>
{''.join(labels)}
</g></svg>'''
    (folder / ('map-mobile.svg' if mobile else 'map.svg')).write_text(svg + '\n')
# New asset content must get a new URL, including the <picture> mobile source.
page_path = folder / 'index.html'
page = page_path.read_text()
for filename in ['map.svg', 'map-mobile.svg']:
    version = hashlib.sha256((folder / filename).read_bytes()).hexdigest()[:12]
    pattern = r'((?:src|srcset)=")' + re.escape(filename) + r'(?:\?v=[0-9a-f]+)?(")'
    page, count = re.subn(pattern, lambda m: m[1] + filename + '?v=' + version + m[2], page)
    assert count == 1, f'Missing/duplicate image reference: {filename}'
if page != page_path.read_text():
    page_path.write_text(page)
print(json.dumps(comparison, ensure_ascii=False, indent=2))
