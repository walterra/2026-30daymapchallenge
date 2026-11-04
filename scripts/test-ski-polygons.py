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

    def test_fixed_map_presentation_contract(self):
        import re
        page = (folder.parent / 'index.html').read_text()
        script = (folder.parent / 'map.js').read_text()
        self.assertNotIn('<aside', page)
        self.assertNotIn('<select', page)
        self.assertNotIn('searchable-select.js', page)
        self.assertNotIn('Selected record</span>', page)
        self.assertIn('class="source-legend"', page)
        self.assertIn('id="map" role="group"', page)
        for option in ['dragging', 'scrollWheelZoom', 'doubleClickZoom', 'touchZoom', 'boxZoom', 'keyboard', 'zoomControl']:
            self.assertRegex(script, rf'\b{option}:\s*false')
        self.assertNotIn('L.tileLayer(', script)
        self.assertNotIn('bindPopup(', script)

    def test_persistent_ranking_selection_contract(self):
        page = (folder.parent / 'index.html').read_text()
        script = (folder.parent / 'map.js').read_text()
        annotations = (folder.parent / 'annotations.js').read_text()
        self.assertNotIn("'annotations.json", script)
        self.assertNotIn('Four familiar ski-area clusters', page)
        self.assertIn('let selectedId = firstId', script)
        self.assertIn("querySelector('.downhill-ranking').addEventListener('pointerleave'", script)
        self.assertIn('event.clientY <= bounds.top', script)
        self.assertIn('event.clientY >= bounds.bottom', script)
        self.assertNotIn('annotationCalloutCircle', annotations)

    def test_ranked_foreground_and_neutral_planning_context(self):
        import re
        ranking = json.loads((folder / 'downhill-ranking.json').read_text())['top10']
        polygons = {f['properties']['id'] for f in areas}
        self.assertEqual(sum(r['mapReference']['kind'] == 'point' for r in ranking), 4)
        self.assertTrue(all(r['id'] in polygons for r in ranking if r['mapReference']['kind'] == 'outline'))
        script = (folder.parent / 'map.js').read_text()
        self.assertIn('rankedIds.has(feature.properties.id)', script)
        style = re.search(r'tirolLayer\.setStyle\((.*?)\);', script, re.S).group(1)
        self.assertIn('contextColor', style)
        self.assertIn('dashArray', style)
        self.assertNotIn('--color-accent', style)
        page = (folder.parent / 'index.html').read_text()
        self.assertIn('Vorarlberg · Tirol · Salzburg', page)
        self.assertIn('OpenSkiData', page)

    def test_reviewed_planning_matches_cover_all_four_point_records(self):
        from shapely.ops import unary_union
        rows = json.loads((folder / 'downhill-ranking.json').read_text())['top10']
        review = json.loads((folder / 'polygon-matches.json').read_text())
        polygons = {f['properties']['id']: f for f in json.loads((folder / 'tirol-boundaries.geojson').read_text())['features']}
        points = {r['id']: r for r in rows if r['mapReference']['kind'] == 'point'}
        self.assertEqual({r['openSkiDataId'] for r in review['matches']}, set(points))
        self.assertEqual(len(review['matches']), 4)
        self.assertEqual(sum(len(r['polygonIds']) for r in review['matches']), 5)
        for match in review['matches']:
            selected = [polygons[key] for key in match['polygonIds']]
            self.assertTrue(all(f['properties']['referenceDate'] == review['referenceDate'] for f in selected))
            point = shape({'type': 'Point', 'coordinates': points[match['openSkiDataId']]['mapReference']['coordinates']})
            self.assertTrue(unary_union([shape(f['geometry']) for f in selected]).covers(point))

    def test_reviewed_planning_audit_is_bound_to_inputs(self):
        audit = json.loads((folder / 'polygon-match-audit.json').read_text())
        self.assertEqual(audit['tirolSHA256'], hashlib.sha256((folder / 'tirol-boundaries.geojson').read_bytes()).hexdigest())
        self.assertEqual(audit['reviewSHA256'], hashlib.sha256((folder / 'polygon-matches.json').read_bytes()).hexdigest())
        self.assertEqual(audit['runsSHA256'], json.loads((folder / 'tirol-coverage.json').read_text())['reviewedAssociations'][0]['pisteRecordCheck']['runsSHA256'])
        self.assertEqual(set(audit['matches']), {r['openSkiDataId'] for r in json.loads((folder / 'polygon-matches.json').read_text())['matches']})
        expected = [(602, 592, 550), (464, 458, 424), (528, 399, 368), (223, 219, 212)]
        for row, counts in zip(audit['matches'].values(), expected):
            self.assertTrue(row['sourcePointCovered'])
            self.assertEqual(tuple(row[key] for key in ['associatedRecords', 'intersectingRecords', 'fullyContainedRecords']), counts)

    def test_partial_cross_border_match_is_explicit(self):
        review = json.loads((folder / 'polygon-matches.json').read_text())['matches']
        ischgl = next(r for r in review if r['label'] == 'Ischgl–Samnaun')
        self.assertEqual(ischgl['polygonIds'], ['tiris:41'])
        self.assertIn('Swiss', ischgl['qualification'])
        self.assertIn('Partial', ischgl['qualification'])
        skiwelt = next(r for r in review if r['label'].startswith('SkiWelt'))
        self.assertEqual(skiwelt['polygonIds'], ['tiris:76', 'tiris:89'])

    def test_regional_framing_matches_three_real_states(self):
        from shapely.ops import unary_union
        region = json.loads((folder / 'region-bounds.json').read_text())
        context = json.loads((folder / 'region-context.geojson').read_text())
        self.assertEqual(region['states'], ['Vorarlberg', 'Tirol', 'Salzburg'])
        self.assertEqual({f['properties']['name'] for f in context['features']}, set(region['states']))
        self.assertEqual(list(unary_union([shape(f['geometry']) for f in context['features']]).bounds), region['bbox'])
        self.assertEqual(region['sourceSHA256'], context['metadata']['sourceSHA256'])
        west, south, east, north = region['bbox']
        frame = shape({'type': 'Polygon', 'coordinates': [[[west, south], [east, south], [east, north], [west, north], [west, south]]]})
        ranking = json.loads((folder / 'downhill-ranking.json').read_text())['top10']
        ids = {r['id'] for r in ranking}
        self.assertTrue(all(frame.covers(shape(f['geometry'])) for f in areas if f['properties']['id'] in ids))

    def test_permanent_labels_change_color_without_relayout(self):
        script = (folder.parent / 'annotations.js').read_text()
        self.assertIn('groups = rows.map', script)
        self.assertIn('setHighlight(value) { selectedId = value?.id; color(); }', script)
        self.assertIn("map.on('mapthemechange', color)", script)
        self.assertNotIn('root.selectAll', script)
        self.assertIn('map.fitBounds(regionBounds', (folder.parent / 'map.js').read_text())

    def test_required_regional_city_labels(self):
        labels = json.loads((folder / 'reference-labels.geojson').read_text())['features']
        required = [f for f in labels if f['properties'].get('required')]
        self.assertEqual({f['properties']['name'] for f in required}, {'Bregenz', 'Innsbruck', 'Salzburg'})
        self.assertTrue(all(f['properties']['minZoom'] == 0 and f['properties']['kind'] == 'city' for f in required))

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
