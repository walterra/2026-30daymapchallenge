# /// script
# requires-python = ">=3.10"
# dependencies = ["pyshp==2.3.1", "shapely==2.1.2"]
# ///
"""Clip Natural Earth land to the Day 4 map, retaining northern Europe."""
import argparse
import io
import json
from pathlib import Path
import zipfile
import shapefile
from shapely.geometry import box, mapping, shape
from shapely.ops import unary_union

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('land_zip', type=Path)
args = parser.parse_args()
with zipfile.ZipFile(args.land_zip) as archive:
    reader = shapefile.Reader(**{ext: io.BytesIO(archive.read(f'ne_10m_land.{ext}')) for ext in ['shp', 'shx', 'dbf']})
    extent = box(-26, 26, 47, 73)
    land = unary_union([shape(s.__geo_interface__).intersection(extent) for s in reader.shapes()]).simplify(.015, preserve_topology=True)
result = {'type': 'Feature', 'properties': {'source': 'Natural Earth 1:10m land', 'license': 'Public domain',
          'url': 'https://www.naturalearthdata.com/about/terms-of-use/', 'simplification_degrees': .015}, 'geometry': mapping(land)}
output = Path(__file__).resolve().parents[1] / 'maps/04-travel-clusters/data/land.geojson'
output.write_text(json.dumps(result, separators=(',', ':')) + '\n')
print(output)
