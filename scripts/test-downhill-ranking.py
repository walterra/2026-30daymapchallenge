"""Offline tests for the reviewed ranking and generated static bars.
python3 scripts/test-downhill-ranking.py --source /tmp/ski-areas.geojson
"""
import argparse
import csv
import hashlib
import importlib.util
import json
import math
from pathlib import Path
import re
import sys
import unittest

ROOT = Path(__file__).resolve().parents[1]
FOLDER = ROOT / 'maps/03-ski-area-polygons'
parser = argparse.ArgumentParser(add_help=False)
parser.add_argument('--source', type=Path)
args, remaining = parser.parse_known_args()
data = json.loads((FOLDER / 'data/downhill-ranking.json').read_text())
rows = data['top10']
spec = importlib.util.spec_from_file_location('ranking_prepare', ROOT / 'scripts/prepare-downhill-ranking.py')
prepare = importlib.util.module_from_spec(spec)
spec.loader.exec_module(prepare)

class DownhillRankingTests(unittest.TestCase):
    def test_ten_unique_descending_rows(self):
        self.assertEqual(len(rows), 10)
        self.assertEqual(len({r['id'] for r in rows}), 10)
        self.assertEqual([r['rank'] for r in rows], list(range(1, 11)))
        lengths = [r['downhillLengthKm'] for r in rows]
        self.assertEqual(lengths, sorted(lengths, reverse=True))
        self.assertGreater(min(lengths), 0)

    def test_snapshot_accounting(self):
        m = data['metadata']
        self.assertEqual((m['selectedRecords'], m['recordsWithDownhillLength'], m['recordsWithoutDownhillLength']), (375, 355, 20))
        self.assertEqual(len(data['missingLengths']), 20)
        self.assertEqual(m['license'], 'ODbL 1.0')
        self.assertEqual(m['snapshotDownloaded'], '2026-11-02')

    def test_zero_based_common_scale(self):
        self.assertEqual(data['metadata']['axisMinimum'], 0)
        self.assertEqual(data['metadata']['axisMaximum'], 300)
        self.assertLess(max(r['downhillLengthKm'] for r in rows), 300)

    def test_totals_match_difficulty_breakdowns(self):
        for row in rows:
            self.assertAlmostEqual(row['downhillLengthKm'], math.fsum(row['byDifficultyKm'].values()), places=11)

    def test_umbrella_and_component_records_not_ranked(self):
        excluded = {r['name'] for r in data['reviewedCandidates'] if r['decision'] == 'exclude'}
        self.assertTrue({'Ski amadé', 'Schladming Dachstein', 'Lech/Zürs', 'Kleinwalsertal-Oberstdorf', 'Skigebiet Damüls-Mellau-Faschina'}.issubset(excluded))
        names = {r['name'] for r in rows}
        self.assertFalse(names.intersection(excluded))
        self.assertIn('Ski Arlberg', names)

    def test_every_above_cutoff_reviewed_and_decided(self):
        for candidate in data['reviewedCandidates']:
            self.assertIn(candidate['decision'], ['include', 'exclude'])
            self.assertTrue(candidate['reason'])
        includes = [r for r in data['reviewedCandidates'] if r['decision'] == 'include']
        self.assertEqual({r['id'] for r in includes}, {r['id'] for r in rows})

    def test_point_records_remain_eligible(self):
        by_name = {r['name']: r for r in rows}
        self.assertEqual(by_name['Sölden']['geometryType'], 'Point')
        self.assertEqual(by_name['SkiWelt Wilder Kaiser - Brixental']['geometryType'], 'Point')
        self.assertAlmostEqual(by_name['Sölden']['downhillLengthKm'], 103.00422348808945, places=8)

    def test_linked_map_references(self):
        for row in rows:
            ref = row['mapReference']
            self.assertIn(ref['kind'], ['point', 'outline'])
            self.assertEqual(ref['kind'] == 'point', row['geometryType'] == 'Point')
            self.assertEqual(len(ref['coordinates']), 2)
            lon, lat = ref['coordinates']
            self.assertTrue(8 < lon < 19 and 45 < lat < 50)
            self.assertTrue(ref['method'])

    def test_csv_matches_unrounded_values(self):
        with (FOLDER / 'data/downhill-ranking.csv').open(newline='') as stream:
            csv_rows = list(csv.DictReader(stream))
        self.assertEqual(len(csv_rows), 10)
        for raw, row in zip(csv_rows, rows):
            self.assertEqual(raw['source_id'], row['id'])
            self.assertAlmostEqual(float(raw['mapped_downhill_km']), row['downhillLengthKm'], places=12)

    def test_generated_html_and_bar_widths(self):
        page = (FOLDER / 'index.html').read_text()
        block = re.search(re.escape(prepare.START) + r'.*?' + re.escape(prepare.END), page, re.S).group()
        self.assertEqual(block, prepare.render(data).strip())
        widths = [float(p) for p in re.findall(r'--bar-width:([\d.]+)%', block)]
        self.assertEqual(len(widths), 10)
        for width, row in zip(widths, rows):
            self.assertAlmostEqual(width / 100 * 300, row['downhillLengthKm'], places=8)
        self.assertIn('Nordic trails and lifts excluded', block)
        self.assertIn('not advertised piste totals', block)

    def test_source_fidelity_and_downhill_only(self):
        if args.source is None:
            self.skipTest('Pass --source for cached-download fidelity checks')
        raw = args.source.read_bytes()
        self.assertEqual(hashlib.sha256(raw).hexdigest(), data['metadata']['sourceSHA256'])
        features = {f['properties']['id']: f for f in json.loads(raw)['features']}
        for row in rows:
            p = features[row['id']]['properties']
            expected, breakdown = prepare.downhill_length(p)
            self.assertEqual(row['downhillLengthKm'], expected)
            self.assertEqual(row['byDifficultyKm'], breakdown)
            self.assertEqual(row['sources'], p['sources'])
            self.assertEqual(row['name'], p['name'])
            geometry = features[row['id']]['geometry']
            if geometry['type'] == 'Point':
                self.assertEqual(row['mapReference']['coordinates'], geometry['coordinates'][:2])
            else:
                def points(coords):
                    if isinstance(coords[0], (int, float)):
                        yield coords[:2]
                    else:
                        for part in coords:
                            yield from points(part)
                self.assertIn(row['mapReference']['coordinates'], list(points(geometry['coordinates'])))
        reviewed = {r['id'] for r in data['reviewedCandidates']}
        cutoff = rows[-1]['downhillLengthKm']
        for feature in features.values():
            p = feature['properties']
            if p.get('status') != 'operating' or 'downhill' not in p.get('activities', []) or not any(place.get('iso3166_1Alpha2') == 'AT' for place in p.get('places', [])):
                continue
            length, _ = prepare.downhill_length(p)
            if length is not None and length >= cutoff:
                self.assertIn(p['id'], reviewed, 'Unreviewed record can displace the displayed top ten')
        solden = features[next(r['id'] for r in rows if r['name'] == 'Sölden')]['properties']
        self.assertIn('nordic', solden['statistics']['runs']['byActivity'])
        all_activities = math.fsum(v['lengthInKm'] for activity in solden['statistics']['runs']['byActivity'].values() for v in activity['byDifficulty'].values())
        self.assertGreater(all_activities, next(r['downhillLengthKm'] for r in rows if r['name'] == 'Sölden'))

if __name__ == '__main__':
    unittest.main(argv=[sys.argv[0], *remaining])
