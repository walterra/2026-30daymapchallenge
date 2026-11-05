#!/usr/bin/env python3
"""uv run --with numpy --with pillow scripts/test-viewshed.py — both route variants."""
import json
import math
import pathlib
import unittest
import hashlib
import numpy as np
from PIL import Image

ROOT = pathlib.Path(__file__).resolve().parents[1]

class TaubenseeData(unittest.TestCase):
    slug = '05-viewshed-01-taubensee'
    cycling = False

    @classmethod
    def setUpClass(cls):
        cls.data = ROOT/'maps'/cls.slug/'data'
        cls.m = json.loads((cls.data/'manifest.json').read_text())
        cls.route = json.loads((cls.data/'route.geojson').read_text())
        cls.atlases = []
        for file in cls.m['atlasFiles']:
            with Image.open(cls.data/file) as image:
                cls.atlases.append(np.array(image))
        with Image.open(cls.data/'coverage.png') as image:
            cls.coverage = np.array(image) > 0

    def test_metric_grid_and_texture_dimensions(self):
        m = self.m
        self.assertEqual(m['crs'], 'EPSG:32633')
        self.assertEqual(m['cellSize'],20)
        self.assertEqual(len(self.atlases),math.ceil(m['frameCount']/m['atlasPageSize']))
        for atlas in self.atlases:
            self.assertEqual(atlas.shape,(m['height']*m['atlasRows'],m['width']*m['atlasColumns']))
            self.assertLessEqual(max(atlas.shape),8192)
        with Image.open(self.data/'terrain.png') as image:
            self.assertEqual(image.size,(m['width'],m['height']))

    def test_route_anchors_and_provenance(self):
        coords = self.route['geometry']['coordinates']
        self.assertAlmostEqual(coords[0][0],12.4053869,places=5)
        self.assertAlmostEqual(coords[0][1],47.6693828,places=5)
        end = (12.3298855,47.5797403) if self.cycling else (12.4197732,47.6935666)
        for a,b in zip(coords[-1],end): self.assertAlmostEqual(a,b,places=5)
        self.assertEqual(len(coords),len(self.m['route']))
        self.assertEqual(len(coords),len(self.route['properties']['osm_node_ids']))
        self.assertEqual(self.route['properties']['osm_node_ids'][0],2064921082)
        self.assertEqual(self.route['properties']['license'],'ODbL-1.0')
        self.assertTrue(self.m['terrainURL'].startswith('https://gis.tirol.gv.at/'))
        self.assertEqual(len(self.m['osmURLs']),17 if self.cycling else 4)

    def test_route_distances_and_elevations(self):
        m = self.m
        lo,hi = (18000,20000) if self.cycling else (4500,5500)
        self.assertTrue(lo < m['distance'] < hi)
        self.assertEqual(m['route'][0][3],0)
        self.assertAlmostEqual(m['route'][-1][3],m['distance'],places=2)
        for a,b in zip(m['route'],m['route'][1:]):
            self.assertGreater(b[3],a[3])
            self.assertAlmostEqual(math.dist(a[:2],b[:2])*20,b[3]-a[3],delta=.05)
        for x,y,z,d in m['route']:
            self.assertTrue(0<=x<m['width'] and 0<=y<m['height'])
            self.assertTrue(self.coverage[round(y),round(x)])
            self.assertTrue(500<z<1300)
        self.assertGreater(m['route'][-1][2]-m['route'][0][2],350 if self.cycling else 500)

    def test_observer_spacing_and_endpoints(self):
        m = self.m
        self.assertEqual(m['frameCount'],len(m['observers']))
        self.assertEqual(m['frameCount'],len(m['visibleCells']))
        self.assertEqual(m['observers'][0],m['route'][0])
        self.assertEqual(m['observers'][-1],m['route'][-1])
        for a,b in zip(m['observers'],m['observers'][1:]):
            self.assertLessEqual(b[3]-a[3],150.01 if self.cycling else 50.01)

    def test_masks_never_claim_unknown_terrain(self):
        m = self.m
        hashes = set()
        for i in range(m['frameCount']):
            slot = i % m['atlasPageSize']
            x,y = (slot%m['atlasColumns'])*m['width'],(slot//m['atlasColumns'])*m['height']
            atlas = self.atlases[i//m['atlasPageSize']]
            mask = atlas[y:y+m['height'],x:x+m['width']] > 0
            self.assertFalse(np.any(mask & ~self.coverage),f'Frame {i} claims missing terrain')
            ox,oy,*_ = m['observers'][i]
            self.assertTrue(mask[round(oy),round(ox)],f'Observer {i} not visible')
            self.assertEqual(np.count_nonzero(mask),m['visibleCells'][i])
            window = m['kaiserWindow']
            region = mask[window['y']:window['y']+window['height'],window['x']:window['x']+window['width']]
            self.assertEqual(np.count_nonzero(region),m['kaiserVisibleCells'][i])
            hashes.add(hashlib.sha256(mask.tobytes()).digest())
        self.assertGreater(len(hashes),m['frameCount']*.9)
        self.assertTrue(np.any(~self.coverage),'Missing terrain must remain explicit')

    def test_kaiser_extent_and_route_composition(self):
        m = self.m
        self.assertEqual(m['analysisRadius'],32000)
        self.assertEqual(m['rayCount'],16384)
        self.assertGreater(m['width']*m['cellSize'],22000)
        self.assertGreater(m['height']*m['cellSize'],21000)
        anchors = m['route'][:1] if self.cycling else m['route']
        for x,y,*_ in anchors:
            self.assertGreater(x/m['width'],.75)
            self.assertLess(y/m['height'],.20)
        landmark = m['landmarks'][0]
        self.assertEqual(landmark['name'],'WILDER KAISER')
        self.assertGreater(landmark['elevation'],2200)
        self.assertTrue(self.coverage[round(landmark['y']),round(landmark['x'])])
        self.assertGreater(math.dist(m['observers'][0][:2],[landmark['x'],landmark['y']])*m['cellSize'],12000)
        for frame in (0,m['frameCount']//2,m['frameCount']-1):
            self.assertGreater(m['kaiserVisibleCells'][frame],0)
        self.assertGreater(max(m['kaiserVisibleCells'])-min(m['kaiserVisibleCells']),1000)

    def test_terrain_is_grayscale(self):
        with Image.open(self.data/'terrain.png') as image:
            rgb = np.array(image)
        known = rgb[self.coverage]
        self.assertTrue(np.array_equal(known[:,0],known[:,1]))
        self.assertTrue(np.array_equal(known[:,1],known[:,2]))

class GriesenauData(TaubenseeData):
    slug = '05-viewshed-02-griesenau'
    cycling = True

    def test_same_origin_terrain_and_visibility(self):
        first = ROOT/'maps/05-viewshed-01-taubensee/data'
        previous = json.loads((first/'manifest.json').read_text())
        self.assertEqual(self.m['route'][0],previous['route'][0])
        self.assertEqual(self.m['visibleCells'][0],previous['visibleCells'][0])
        for name in ('terrain.png','coverage.png'):
            self.assertEqual(hashlib.sha256((self.data/name).read_bytes()).digest(),
                             hashlib.sha256((first/name).read_bytes()).digest())
        with Image.open(first/previous['atlasFiles'][0]) as image:
            first_mask = np.array(image.crop((0,0,self.m['width'],self.m['height'])))
        self.assertTrue(np.array_equal(first_mask,self.atlases[0][:self.m['height'],:self.m['width']]))

    def test_cycling_access_and_valley_waypoints(self):
        m = self.m
        ways = json.loads((self.data/'route-ways.json').read_text())
        ids = self.route['properties']['osm_node_ids']
        self.assertEqual(m['mode'],'cycling')
        self.assertEqual(m['destination'],'Griesner Alm')
        self.assertEqual(len(m['waypointLabels']),2)
        self.assertLess(ids.index(m['viaNodes'][0]),ids.index(m['viaNodes'][1]))
        self.assertEqual([p['name'] for p in m['waypointLabels']],['SCHWENDT','GRIESENAU'])
        self.assertEqual(len(self.route['properties']['osm_way_ids']),len(ids)-1)
        self.assertIn('454081835',ways)
        self.assertEqual(list(m['reviewedCycleAccess']),['454081835'])
        self.assertTrue(any(t.get('name')=='Kaiserbachtal' for t in ways.values()))
        for way_id,tags in ways.items():
            permit = tags.get('bicycle') in {'yes','designated','permissive'} or way_id in m['reviewedCycleAccess']
            self.assertNotIn(tags.get('bicycle'),{'no','private','use_sidepath'})
            self.assertNotIn(tags.get('highway'),{'steps','motorway','motorway_link'})
            if tags.get('highway') in {'track','path','footway','pedestrian'}: self.assertTrue(permit)
            if tags.get('access') in {'private','no'} or tags.get('vehicle') in {'private','no'}: self.assertTrue(permit)
        # Last kilometers must run westwards into the valley, not stop at Griesenau.
        self.assertLess(m['route'][-1][0],m['waypointLabels'][-1]['x']-150)

if __name__ == '__main__':
    unittest.main()
