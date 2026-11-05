#!/usr/bin/env python3
"""Validate local photographs, licenses, counts and approximate route anchoring.
Run: uv run --with pillow python scripts/test-route-photos.py
"""
import json
import math
from pathlib import Path
import unittest
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent


def nearest_route_position(coordinates, camera):
    lon, lat = camera
    scale = 111320 * math.cos(math.radians(lat))
    best = (math.inf, 0)
    distance = 0
    for a, b in zip(coordinates, coordinates[1:]):
        ax, ay = (a[0] - lon) * scale, (a[1] - lat) * 111320
        dx, dy = (b[0] - a[0]) * scale, (b[1] - a[1]) * 111320
        squared = dx * dx + dy * dy
        t = max(0, min(1, -(ax * dx + ay * dy) / squared)) if squared else 0
        length = math.sqrt(squared)
        offset = math.hypot(ax + t * dx, ay + t * dy)
        if offset < best[0]:
            best = offset, distance + t * length
        distance += length
    return best


class RoutePhotos(unittest.TestCase):
    def test_catalogs(self):
        # Hiking coverage remains explicitly incomplete; do not pad with unrelated images.
        for folder, count in [('05-viewshed-01-taubensee', 4), ('05-viewshed-02-griesenau', 10)]:
            entry = ROOT / 'maps' / folder
            catalog = json.loads((entry / 'data/photos.json').read_text())
            route = json.loads((entry / 'data/route.geojson').read_text())
            feature = route['features'][0] if 'features' in route else route
            coordinates = feature['geometry']['coordinates']
            self.assertEqual(len(catalog['photos']), count)
            self.assertEqual(len({photo['id'] for photo in catalog['photos']}), count)
            for photo in catalog['photos']:
                with self.subTest(folder=folder, photo=photo['id']):
                    self.assertTrue(photo['alt'] and photo['author'] and photo['date'])
                    if 'originalFile' in photo:
                        self.assertEqual(photo['license'], 'Used with permission')
                        self.assertTrue(photo['licenseUrl'].endswith('/photos/README.md#owner-permission'))
                        self.assertTrue(photo['source'].endswith('/photos/README.md#' + photo['id']))
                        self.assertEqual(Path(photo['originalFile']).name, photo['originalFile'])
                        self.assertNotIn('original', photo)
                    else:
                        self.assertEqual(photo['license'], 'CC BY-SA 4.0')
                        self.assertEqual(photo['licenseUrl'].rstrip('/'), 'https://creativecommons.org/licenses/by-sa/4.0')
                        self.assertTrue(photo['source'].startswith('https://commons.wikimedia.org/wiki/File:'))
                        self.assertTrue(photo['original'].startswith('https://upload.wikimedia.org/wikipedia/commons/'))
                    path = (entry / photo['src']).resolve()
                    self.assertTrue(path.is_relative_to(ROOT / 'maps/05-viewshed-01-taubensee/photos'))
                    with Image.open(path) as image:
                        self.assertEqual(image.format, 'JPEG')
                        self.assertLessEqual(image.width, 640)
                        self.assertLessEqual(image.height, 480)
                        self.assertFalse(image.getexif(), 'Published JPEG must not retain EXIF metadata')
                        image.verify()
                    self.assertLess(path.stat().st_size, 100_000)
                    offset, distance = nearest_route_position(coordinates, photo['camera'])
                    self.assertLessEqual(offset, 200)
                    self.assertAlmostEqual(offset, photo['offset'], delta=15)
                    self.assertAlmostEqual(distance, photo['distance'], delta=15)


if __name__ == '__main__':
    unittest.main()
