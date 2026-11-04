#!/usr/bin/env python3
"""Normalize a browser-extracted TourMIS ECM-J8 table; no authentication data."""
import argparse
import csv
import json
import re
from pathlib import Path

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('input', type=Path)
parser.add_argument('output', type=Path)
args = parser.parse_args()
data = json.loads(args.input.read_text())
rows = data['rows']
header = next(r for r in rows if r[0]['text'] == 'Destination (Information)')
cities = []
for cell in header[1:]:
    match = re.fullmatch(r'(.+) \(([A-Z]+)\)', cell['text'])
    if not match or cell['colspan'] != 2:
        raise ValueError(f'Unexpected destination header: {cell}')
    cities.append(match.groups())

def number(value, integer=False):
    value = value.strip().replace(',', '')
    if not value:
        return ''  # Missing is not zero.
    return int(value) if integer else float(value)

aggregates = {'Europe', 'America', 'Asia', 'Africa', 'Oceania',
              'Total foreign', 'Total domestic', 'Total foreign and domestic'}
args.output.parent.mkdir(parents=True, exist_ok=True)
count = 0
with args.output.open('w', newline='') as out:
    writer = csv.writer(out)
    writer.writerow(['year', 'city', 'definition', 'market', 'market_type',
                     'bednights', 'change_previous_year_pct'])
    for row in rows:
        if len(row) == 1 or row[0]['text'] in {'Destination (Information)', 'Market'}:
            continue
        if row[0]['text'].strip() == '':
            continue
        if len(row) != 1 + 2 * len(cities):
            raise ValueError('Unexpected table width')
        market = row[0]['text']
        kind = 'aggregate' if market in aggregates else 'other' if market.startswith('Other ') else 'country'
        for i, (city, definition) in enumerate(cities):
            writer.writerow([data['year'], city, definition, market, kind,
                             number(row[1 + 2*i]['text'], True),
                             number(row[2 + 2*i]['text'])])
            count += 1
print(f'{len(cities)} destinations; {count} records -> {args.output}')
