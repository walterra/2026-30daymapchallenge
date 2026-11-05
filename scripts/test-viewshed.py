#!/usr/bin/env python3
"""uv run --with numpy --with pillow scripts/test-viewshed.py"""
import json
import math
import pathlib
import unittest
import numpy as np
from PIL import Image

ROOT = pathlib.Path(__file__).resolve().parents[1]
DATA = ROOT/'maps/05-viewshed/data'

class ViewshedData(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.m = json.loads((DATA/'manifest.json').read_text())
        cls.route = json.loads((DATA/'route.geojson').read_text())
        with Image.open(DATA/'viewsheds.png') as image:
            cls.atlas = np.array(image)
        with Image.open(DATA/'coverage.png') as image:
            cls.coverage = np.array(image) > 0

    def test_metric_grid_and_texture_dimensions(self):
        m = self.m
        self.assertEqual(m['crs'], 'EPSG:32633')
        self.assertEqual(m['cellSize'],20)
        self.assertEqual(self.atlas.shape,(m['height']*m['atlasRows'],m['width']*m['atlasColumns']))
        self.assertLessEqual(max(self.atlas.shape),8192)
        with Image.open(DATA/'terrain.png') as image:
            self.assertEqual(image.size,(m['width'],m['height']))

    def test_route_anchors_and_provenance(self):
        coords = self.route['geometry']['coordinates']
        self.assertAlmostEqual(coords[0][0],12.4053869,places=5)
        self.assertAlmostEqual(coords[0][1],47.6693828,places=5)
        self.assertAlmostEqual(coords[-1][0],12.4197732,places=5)
        self.assertAlmostEqual(coords[-1][1],47.6935666,places=5)
        self.assertEqual(len(coords),len(self.m['route']))
        self.assertEqual(len(coords),len(self.route['properties']['osm_node_ids']))
        self.assertEqual(self.route['properties']['license'],'ODbL-1.0')
        self.assertTrue(self.m['terrainURL'].startswith('https://gis.tirol.gv.at/'))
        self.assertEqual(len(self.m['osmURLs']),4)

    def test_route_distances_and_elevations(self):
        m = self.m
        self.assertTrue(4500 < m['distance'] < 5500)
        self.assertEqual(m['route'][0][3],0)
        self.assertAlmostEqual(m['route'][-1][3],m['distance'],places=2)
        for a,b in zip(m['route'],m['route'][1:]):
            self.assertGreater(b[3],a[3])
            self.assertAlmostEqual(math.dist(a[:2],b[:2])*20,b[3]-a[3],delta=.05)
        for x,y,z,d in m['route']:
            self.assertTrue(0<=x<m['width'] and 0<=y<m['height'])
            self.assertTrue(self.coverage[round(y),round(x)])
            self.assertTrue(500<z<1300)
        self.assertGreater(m['route'][-1][2]-m['route'][0][2],500)

    def test_observer_spacing_and_endpoints(self):
        m = self.m
        self.assertEqual(m['frameCount'],len(m['observers']))
        self.assertEqual(m['frameCount'],len(m['visibleCells']))
        self.assertEqual(m['observers'][0],m['route'][0])
        self.assertEqual(m['observers'][-1],m['route'][-1])
        for a,b in zip(m['observers'],m['observers'][1:]):
            self.assertLessEqual(b[3]-a[3],50.01)

    def test_masks_never_claim_unknown_terrain(self):
        m = self.m
        hashes = set()
        for i in range(m['frameCount']):
            x,y = (i%m['atlasColumns'])*m['width'],(i//m['atlasColumns'])*m['height']
            mask = self.atlas[y:y+m['height'],x:x+m['width']] > 0
            self.assertFalse(np.any(mask & ~self.coverage),f'Frame {i} claims missing terrain')
            ox,oy,*_ = m['observers'][i]
            self.assertTrue(mask[round(oy),round(ox)],f'Observer {i} not visible')
            self.assertEqual(np.count_nonzero(mask),m['visibleCells'][i])
            hashes.add(mask.tobytes())
        self.assertGreater(len(hashes),m['frameCount']*.9)
        self.assertTrue(np.any(~self.coverage),'Missing terrain must remain explicit')

if __name__ == '__main__':
    unittest.main()
