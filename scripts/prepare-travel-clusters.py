#!/usr/bin/env python3
"""Prepare local map data from TourMIS CSV and a GeoNames cities1000 zip."""
import argparse
import collections
import csv
import json
import math
from pathlib import Path
import unicodedata
import zipfile

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / 'maps/04-travel-clusters/data'
MARKETS = ['Netherlands', 'Germany', 'United Kingdom', 'France', 'Italy', 'Spain', 'United States', 'China']
ALIASES = {'Salzburg (city)': 'Salzburg', 'Luxembourg city': 'Luxembourg',
           'La Coruna': 'A Coruña', 'Las Palmas': 'Las Palmas de Gran Canaria',
           'Piran/Pirano': 'Piran', 'Madeira': 'Funchal', 'Haarlemmermeer': 'Hoofddorp'}
# Ambiguous alternate names reviewed against the intended TourMIS destination.
OVERRIDES = {'Bruges': '2800931', 'Cologne': '2886242',
             'Bienne': '2661513', 'Porto': '2735943', 'Frankfurt': '2925533',
             'Luxembourg city': '2960316', 'Mechelen': '2791537', 'Münster': '2867543',
             'Valencia': '2509954', 'Verona': '3164527'}

def norm(text):
    return ''.join(c for c in unicodedata.normalize('NFKD', text.casefold()) if not unicodedata.combining(c))

def distance(a, b):
    return sum((x-y)**2 for x, y in zip(a, b))

def cluster(vectors, k=4):
    # Deterministic farthest-first initialization; Hellinger-space profiles.
    centers = [vectors[0][:]]
    while len(centers) < k:
        centers.append(max(vectors, key=lambda v: min(distance(v, c) for c in centers))[:])
    labels = None
    for _ in range(100):
        new = [min(range(k), key=lambda j: distance(v, centers[j])) for v in vectors]
        if new == labels:
            break
        labels = new
        for j in range(k):
            members = [v for v, label in zip(vectors, labels) if label == j]
            if members:
                centers[j] = [sum(v[i] for v in members)/len(members) for i in range(len(MARKETS))]
    return labels

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('geonames_zip', type=Path)
args = parser.parse_args()
index = collections.defaultdict(list)
by_id = {}
with zipfile.ZipFile(args.geonames_zip) as archive:
    for line in archive.read('cities1000.txt').decode().splitlines():
        row = line.split('\t')
        if not (-25 < float(row[5]) < 50 and 28 < float(row[4]) < 72):
            continue
        by_id[row[0]] = row
        for name in {norm(x) for x in [row[1], row[2]] + row[3].split(',')}:
            index[name].append(row)
records = collections.defaultdict(dict)
definitions = {}
for row in csv.DictReader((DATA / 'tourmis-2024.csv').open()):
    records[row['city']][row['market']] = int(row['bednights']) if row['bednights'] else None
    definitions[row['city']] = row['definition']
cities = []
for name, values in sorted(records.items()):
    if name in OVERRIDES:
        geo = by_id[OVERRIDES[name]]
    else:
        candidates = index[norm(ALIASES.get(name, name))]
        if not candidates:
            raise ValueError(f'Unmatched destination: {name}')
        primary = [r for r in candidates if norm(ALIASES.get(name, name)) in {norm(r[1]), norm(r[2])}]
        geo = max(primary or candidates, key=lambda r: int(r[14]))
    cities.append({'name': name, 'country': geo[8], 'lat': float(geo[4]), 'lon': float(geo[5]),
                   'geonamesId': int(geo[0]), 'coordinatePlace': geo[1],
                   'representativePoint': name in {'Madeira', 'Haarlemmermeer'},
                   'definition': definitions[name], 'nights': values, 'cluster': None})
eligible = [c for c in cities if all(c['nights'].get(m) is not None for m in MARKETS)
            and sum(c['nights'][m] for m in MARKETS) > 0]
vectors = [[math.sqrt(c['nights'][m]/sum(c['nights'][x] for x in MARKETS)) for m in MARKETS] for c in eligible]
labels = cluster(vectors)
for city, label in zip(eligible, labels):
    city['cluster'] = label
summary = []
for label in range(4):
    group = [c for c in eligible if c['cluster'] == label]
    shares = {m: sum(c['nights'][m]/sum(c['nights'][x] for x in MARKETS) for c in group)/len(group) for m in MARKETS}
    leaders = sorted(MARKETS, key=lambda m: shares[m], reverse=True)[:2]
    summary.append({'id': label, 'name': f"{label + 1} · {' / '.join(leaders)}", 'count': len(group), 'meanShares': shares})
result = {'year': 2024, 'clusterMarkets': MARKETS, 'clusters': summary, 'cities': cities}
(DATA / 'map-data.json').write_text(json.dumps(result, ensure_ascii=False, separators=(',', ':')) + '\n')
print(f'{len(cities)} destinations geocoded; {len(eligible)} clustered')
for c in summary:
    print(c['id'], c['name'], c['count'])
for c in cities:
    print(c['name'], c['country'], c['coordinatePlace'], c['geonamesId'])
