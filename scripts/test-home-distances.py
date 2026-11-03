# /// script
# requires-python = ">=3.10"
# dependencies = ["pyproj==3.7.2"]
# ///
"""Offline distance, projection and generated-artifact regression tests."""
import hashlib
import json
import math
from pathlib import Path
import unittest
import xml.etree.ElementTree as ET
from pyproj import Geod, Transformer

folder = Path(__file__).resolve().parents[1] / 'maps/02-close-to-home'
inputs = json.loads((folder / 'data/locations.json').read_text())
results = json.loads((folder / 'data/calculations.json').read_text())
routes = json.loads((folder / 'data/routes.geojson').read_text())['features']
geod = Geod(ellps='WGS84')
transform = Transformer.from_crs('EPSG:4326', results['projection'], always_xy=True)
NS = {'svg': 'http://www.w3.org/2000/svg'}

class DistanceMapTests(unittest.TestCase):
    def test_calculated_results(self):
        for destination, expected in zip(inputs['destinations'], [2002934.227, 1356104.530]):
            distance = geod.inv(*inputs['origin']['coordinates'], *destination['coordinates'])[2]
            self.assertAlmostEqual(distance, expected, delta=.001)

    def test_shared_origin_and_endpoints(self):
        self.assertEqual(len(routes), 2)
        for route, destination in zip(routes, inputs['destinations']):
            self.assertEqual(route['geometry']['coordinates'][0], inputs['origin']['coordinates'])
            self.assertEqual(route['geometry']['coordinates'][-1], destination['coordinates'])

    def test_sampled_line_lengths(self):
        for route in routes:
            coords = route['geometry']['coordinates']
            length = sum(geod.inv(*a, *b)[2] for a, b in zip(coords, coords[1:]))
            self.assertAlmostEqual(length, route['properties']['distance_m'], delta=.001)

    def test_projection_preserves_radial_distances(self):
        self.assertLess(math.hypot(*transform.transform(*inputs['origin']['coordinates'])), .001)
        for route in routes:
            xy = transform.transform(*route['geometry']['coordinates'][-1])
            self.assertAlmostEqual(math.hypot(*xy), route['properties']['distance_m'], delta=.001)

    def test_projection_keeps_origin_geodesics_straight(self):
        for route in routes:
            end_x, end_y = transform.transform(*route['geometry']['coordinates'][-1])
            for coordinates in route['geometry']['coordinates']:
                x, y = transform.transform(*coordinates)
                perpendicular_offset = abs(x * end_y - y * end_x) / math.hypot(end_x, end_y)
                self.assertLess(perpendicular_offset, .01)

    def test_rounding_and_difference(self):
        self.assertEqual([r['properties']['displayKm'] for r in routes], [2003, 1356])
        difference = routes[0]['properties']['distance_m'] - routes[1]['properties']['distance_m']
        self.assertAlmostEqual(results['difference_m'], difference, delta=.001)
        self.assertEqual(round(difference / 1000), 647)

    def test_both_svgs_have_accessible_labels_and_no_scripts(self):
        for filename in ['map.svg', 'map-mobile.svg']:
            svg = ET.parse(folder / filename).getroot()
            self.assertEqual(svg.get('viewBox'), '0 0 1000 570')
            self.assertTrue(svg.find('svg:title', NS).text)
            self.assertTrue(svg.find('svg:desc', NS).text)
            self.assertEqual(svg.findall('.//svg:script', NS), [])
            labels = {element.text for element in svg.findall('.//svg:text', NS)}
            self.assertTrue({'Lisboa', 'Kyiv', 'Kössen', '2,003 km', '1,356 km'}.issubset(labels))

    def test_page_references_current_svg_content(self):
        page = (folder / 'index.html').read_text()
        for filename in ['map.svg', 'map-mobile.svg']:
            version = hashlib.sha256((folder / filename).read_bytes()).hexdigest()[:12]
            self.assertIn(filename + '?v=' + version, page)

    def test_detailed_shoreline_is_in_the_rendered_svg(self):
        land = json.loads((folder / 'data/land.geojson').read_text())
        self.assertEqual(land['properties']['source'], 'Natural Earth 1:10m land')
        for filename in ['map.svg', 'map-mobile.svg']:
            svg = ET.parse(folder / filename).getroot()
            coastline = svg.find('.//svg:path', NS)
            self.assertGreater(coastline.get('d').count('L'), 10000)

    def test_mobile_annotation_is_not_just_shrunken_desktop(self):
        def city_size(filename):
            svg = ET.parse(folder / filename).getroot()
            return next(float(el.get('font-size')) for el in svg.findall('.//svg:text', NS) if el.text == 'Lisboa')
        self.assertGreater(city_size('map-mobile.svg'), city_size('map.svg'))

if __name__ == '__main__':
    unittest.main()
