# /// script
# requires-python = ">=3.10"
# dependencies = ["shapely==2.1.2"]
# ///
"""Offline snapshot tests; optionally verify exact fidelity against the download.
uv run scripts/test-ski-polygons.py --source /tmp/ski-areas.geojson
"""
import argparse
from collections import Counter
import datetime
import hashlib
import json
from pathlib import Path
import sys
import unittest
from shapely.geometry import shape

parser = argparse.ArgumentParser(add_help=False)
parser.add_argument('--source', type=Path)
parser.add_argument('--tirol-source', type=Path)
args, remaining = parser.parse_known_args()
folder = Path(__file__).resolve().parents[1] / 'maps/03-ski-area-polygons/data'
areas = json.loads((folder / 'ski-areas.geojson').read_text())['features']
coverage = json.loads((folder / 'coverage.json').read_text())

class SkiPolygonTests(unittest.TestCase):
    def test_snapshot_counts(self):
        self.assertEqual(len(areas), coverage['polygonRecords'])
        self.assertEqual(len(areas), 188)
        self.assertEqual(coverage['selectedRecords'], 375)
        self.assertEqual(coverage['polygonRecords'] + coverage['omittedRecords'], coverage['selectedRecords'])

    def test_only_supplied_polygon_geometry(self):
        self.assertEqual(dict(Counter(f['geometry']['type'] for f in areas)), {'Polygon': 177, 'MultiPolygon': 11})
        self.assertEqual(dict(Counter(f['geometry']['type'] for f in areas)), coverage['geometryCounts'])

    def test_all_geometries_valid_and_nonempty(self):
        for feature in areas:
            geometry = shape(feature['geometry'])
            self.assertTrue(geometry.is_valid, feature['properties']['id'])
            self.assertFalse(geometry.is_empty)
            west, south, east, north = geometry.bounds
            self.assertTrue(8 < west <= east < 19 and 45 < south <= north < 50)

    def test_unique_ids_and_omissions_are_disjoint(self):
        ids = {f['properties']['id'] for f in areas}
        self.assertEqual(len(ids), len(areas))
        self.assertEqual(len(coverage['omitted']), 187)
        self.assertFalse(ids.intersection(r['id'] for r in coverage['omitted']))
        self.assertTrue(all(r['geometryType'] == 'Point' for r in coverage['omitted']))

    def test_source_status_activity_and_provenance(self):
        for f in areas:
            p = f['properties']
            self.assertEqual(p['status'], 'operating')
            self.assertIn('downhill', p['activities'])
            self.assertTrue(p['sources'])
        self.assertEqual(coverage['license'], 'ODbL 1.0')
        self.assertEqual(len(coverage['sourceSHA256']), 64)
        datetime.date.fromisoformat(coverage['snapshotDownloaded'])

    def test_koessen_is_a_real_polygon_record(self):
        matches = [f for f in areas if f['properties']['name'] == 'Hochkössen - Unterberghorn']
        self.assertEqual(len(matches), 1)
        self.assertEqual(matches[0]['geometry']['type'], 'Polygon')
        p = shape(matches[0]['geometry']).representative_point()
        self.assertTrue(12.3 < p.x < 12.6 and 47.5 < p.y < 47.8)

    def test_unnamed_record_not_silently_removed(self):
        self.assertEqual(sum(bool(f['properties']['name']) for f in areas), coverage['namedPolygonRecords'])
        self.assertEqual(coverage['namedPolygonRecords'], 187)

    def test_context_is_separate_and_valid(self):
        context = json.loads((folder / 'context.geojson').read_text())
        self.assertEqual(context['metadata']['license'], 'Public domain')
        self.assertTrue(any(f['properties']['iso'] == 'AUT' for f in context['features']))
        self.assertTrue(all(shape(f['geometry']).is_valid for f in context['features']))
        austria = json.loads((folder / 'austria.geojson').read_text())
        self.assertEqual(austria['properties']['name'], 'Austria')
        self.assertTrue(shape(austria['geometry']).is_valid)

    def test_tirol_count_geometry_dates_and_license(self):
        data = json.loads((folder / 'tirol-boundaries.geojson').read_text())
        self.assertEqual(len(data['features']), 102)
        self.assertEqual(data['metadata']['uniqueNames'], 100)
        self.assertEqual(data['metadata']['license'], 'CC BY 4.0')
        self.assertEqual(data['metadata']['referenceDates'], ['2011-10-30'])
        for f in data['features']:
            self.assertEqual(f['properties']['referenceDate'], '2011-10-30')
            g = shape(f['geometry'])
            self.assertTrue(g.is_valid)
            self.assertFalse(g.is_empty)

    def test_sources_have_separate_ids(self):
        tirol = json.loads((folder / 'tirol-boundaries.geojson').read_text())['features']
        self.assertEqual(len({f['properties']['id'] for f in areas + tirol}), 290)
        self.assertTrue(all(f['properties']['dataset'] == 'tirol' for f in tirol))
        self.assertEqual(json.loads((folder / 'ski-areas.geojson').read_text())['metadata']['license'], 'ODbL 1.0')

    def test_solden_alias_is_explicit_and_supported(self):
        data = json.loads((folder / 'tirol-boundaries.geojson').read_text())
        matches = [f for f in data['features'] if 'Sölden' in f['properties']['aliases']]
        self.assertEqual(len(matches), 1)
        self.assertEqual(matches[0]['properties']['name'], 'Ötztaler Gletscher')
        evidence = data['metadata']['reviewedAssociations'][0]
        from shapely.geometry import Point
        self.assertTrue(shape(matches[0]['geometry']).covers(Point(evidence['sourcePoint'])))
        self.assertIn(evidence['openSkiDataId'], {r['id'] for r in coverage['omitted']})
        audit = evidence['pisteRecordCheck']
        self.assertEqual([audit[k] for k in ['associatedRecords', 'intersectingRecords', 'fullyContainedRecords']], [223, 219, 212])
        self.assertEqual(len(audit['runsSHA256']), 64)

    def test_political_basemap_context(self):
        borders = json.loads((folder / 'state-borders.geojson').read_text())
        self.assertEqual(borders['metadata']['stateCount'], 9)
        self.assertEqual(borders['metadata']['license'], 'Public domain')
        lines = shape(borders['geometry'])
        self.assertIn(lines.geom_type, ('LineString', 'MultiLineString'))
        self.assertTrue(lines.is_valid)
        self.assertFalse(lines.is_empty)
        labels = json.loads((folder / 'reference-labels.geojson').read_text())['features']
        counts = Counter(f['properties']['kind'] for f in labels)
        self.assertEqual(counts['state'], 9)
        self.assertEqual(counts['city'], 9)
        self.assertTrue({'Vienna', 'Innsbruck', 'Salzburg'}.issubset({f['properties']['name'] for f in labels}))
        for f in labels:
            lon, lat = f['geometry']['coordinates']
            self.assertTrue(8 <= lon <= 19 and 45 <= lat <= 51)
            self.assertGreaterEqual(f['properties']['minZoom'], 0)

    def test_annotation_anchors_and_source_names(self):
        from shapely.geometry import Point
        notes = json.loads((folder / 'annotations.json').read_text())
        tirol = {f['properties']['id']: f for f in json.loads((folder / 'tirol-boundaries.geojson').read_text())['features']}
        self.assertEqual({n['featureId'] for n in notes['annotations']}, {'tiris:72', 'tiris:102', 'tiris:93', 'tiris:77'})
        for note in notes['annotations']:
            feature = tirol[note['featureId']]
            self.assertEqual(note['sourceName'], feature['properties']['name'])
            self.assertTrue(shape(feature['geometry']).covers(Point(note['coordinates'])))
            self.assertEqual(note['referenceDate'], '2011-10-30')
            self.assertEqual(note['dataset'], 'tirol')
            from shapely.geometry import box
            self.assertIn(note['featureId'], note['featureIds'])
            self.assertGreater(len(note['featureIds']), 1)
            extent = box(*note['bounds'])
            for member in note['members']:
                self.assertIn(member['id'], note['featureIds'])
                self.assertEqual(member['name'], tirol[member['id']]['properties']['name'])
                self.assertTrue(extent.covers(shape(tirol[member['id']]['geometry'])))
        self.assertIn('not a largest-resorts ranking', notes['metadata']['selection'])
        self.assertEqual(notes['metadata']['license'], 'CC BY 4.0')

    def test_zillertal_group_spans_the_valley(self):
        notes = json.loads((folder / 'annotations.json').read_text())['annotations']
        note = next(n for n in notes if n['title'] == 'Zillertal')
        self.assertEqual(note['featureId'], 'tiris:93')
        self.assertEqual(set(note['featureIds']), {'tiris:98', 'tiris:93', 'tiris:48', 'tiris:23', 'tiris:21', 'tiris:45', 'tiris:20', 'tiris:57', 'tiris:44'})
        self.assertEqual(len(note['members']), 9)

    def test_tirol_geometries_are_unchanged(self):
        if args.tirol_source is None:
            self.skipTest('Pass --tirol-source to check the original official download')
        data = json.loads((folder / 'tirol-boundaries.geojson').read_text())
        raw = args.tirol_source.read_bytes()
        self.assertEqual(hashlib.sha256(raw).hexdigest(), data['metadata']['sourceSHA256'])
        original = {f['properties']['OBJECTID']: f for f in json.loads(raw)['features']}
        for f in data['features']:
            upstream = original[f['properties']['officialObjectId']]
            self.assertEqual(f['geometry'], upstream['geometry'])
            self.assertEqual(f['properties']['originalName'], upstream['properties']['NAME'])

    def test_geometry_and_source_ids_are_unchanged(self):
        if args.source is None:
            self.skipTest('Pass --source to verify the pinned global download')
        raw = args.source.read_bytes()
        self.assertEqual(hashlib.sha256(raw).hexdigest(), coverage['sourceSHA256'])
        original = {f['properties']['id']: f for f in json.loads(raw)['features']}
        for f in areas:
            upstream = original[f['properties']['id']]
            self.assertEqual(f['geometry'], upstream['geometry'])
            self.assertEqual(f['properties']['sources'], upstream['properties']['sources'])
            self.assertTrue(any(p.get('iso3166_1Alpha2') == 'AT' for p in upstream['properties']['places']))

if __name__ == '__main__':
    unittest.main(argv=[sys.argv[0], *remaining])
