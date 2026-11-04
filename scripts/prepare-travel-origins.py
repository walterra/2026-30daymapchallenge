#!/usr/bin/env python3
"""Extract representative country points from GeoNames populated-place capitals.
Uses the same CC BY 4.0 cities1000 extract as destination preparation.
"""
import argparse
import json
from pathlib import Path
import zipfile

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('geonames_zip', type=Path)
args = parser.parse_args()
capitals = {}
with zipfile.ZipFile(args.geonames_zip) as archive:
    for line in archive.read('cities1000.txt').decode().splitlines():
        row = line.split('\t')
        # Tel Aviv is an explicit representative-city fallback, not a capital
        # claim; this extract has no IL-coded PPLC record.
        if row[7] != 'PPLC' and row[0] != '293397':
            continue
        country = row[8]
        point = {'country': country, 'name': row[1], 'lon': float(row[5]), 'lat': float(row[4]),
                 'geonamesId': int(row[0]), 'population': int(row[14]),
                 'kind': 'capital/seat' if row[7] == 'PPLC' else 'representative city'}
        # Some countries have multiple seats; use the most populous PPLC.
        if country not in capitals or point['population'] > capitals[country]['population']:
            capitals[country] = point
output = Path(__file__).resolve().parents[1] / 'maps/04-travel-clusters/data/country-anchors.json'
output.write_text(json.dumps(capitals, ensure_ascii=False, separators=(',', ':')) + '\n')
print(f'{len(capitals)} country representative points -> {output}')
