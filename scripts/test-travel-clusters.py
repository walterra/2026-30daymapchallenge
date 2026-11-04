#!/usr/bin/env python3
"""Standard-library regression checks for the Day 4 prepared dataset."""
import csv
import json
from pathlib import Path
import subprocess
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / 'maps/04-travel-clusters/data'

class TravelDataTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.data = json.loads((DATA / 'map-data.json').read_text())
        cls.cities = cls.data['cities']

    def test_normalization_reproducible(self):
        with tempfile.TemporaryDirectory() as directory:
            output = Path(directory) / 'result.csv'
            subprocess.run(['python3', str(ROOT / 'scripts/prepare-tourmis.py'),
                            str(DATA / 'tourmis-2024-raw.json'), str(output)], check=True)
            self.assertEqual(output.read_bytes(), (DATA / 'tourmis-2024.csv').read_bytes())

    def test_coverage_and_counts(self):
        self.assertEqual(len(self.cities), 154)
        self.assertEqual(sum(c['cluster'] is not None for c in self.cities), 103)
        self.assertEqual(sum(c['nights']['Netherlands'] is not None for c in self.cities), 105)
        self.assertEqual(len({c['name'] for c in self.cities}), 154)
        for c in self.cities:
            self.assertTrue(-25 < c['lon'] < 50 and 27 < c['lat'] < 72)
            self.assertTrue(all(n is None or isinstance(n, int) and n >= 0 for n in c['nights'].values()))
            if c['cluster'] is not None:
                self.assertTrue(all(c['nights'][m] is not None for m in self.data['clusterMarkets']))

    def test_reviewed_geocodes(self):
        countries = {c['name']: c['country'] for c in self.cities}
        for name, code in {'Bruges': 'BE', 'Cologne': 'DE', 'Bienne': 'CH', 'Porto': 'PT', 'Luxembourg city': 'LU'}.items():
            self.assertEqual(countries[name], code)

    def test_cluster_summaries(self):
        for group in self.data['clusters']:
            self.assertAlmostEqual(sum(group['meanShares'].values()), 1)
            self.assertEqual(group['count'], sum(c['cluster'] == group['id'] for c in self.cities))

    def test_csv_matches_map(self):
        lookup = {(c['name'], m): n for c in self.cities for m, n in c['nights'].items()}
        for row in csv.DictReader((DATA / 'tourmis-2024.csv').read_text().splitlines()):
            expected = int(row['bednights']) if row['bednights'] else None
            self.assertEqual(lookup[row['city'], row['market']], expected)

if __name__ == '__main__':
    unittest.main()
