#!/usr/bin/env python3
"""Dependency-free data and local HTML-link smoke checks. Run from any directory."""
import json
from collections import Counter
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import unquote, urlsplit

root = Path(__file__).resolve().parents[1]
entry = root / 'maps/02-engineered-winter'
runs = json.loads((entry / 'data/runs.geojson').read_text())
areas = json.loads((entry / 'data/areas.geojson').read_text())
meta = json.loads((entry / 'data/metadata.json').read_text())
assert len(runs['features']) == meta['segments']
assert len(areas['features']) == meta['areas']
assert dict(Counter(f['properties']['snowmaking'] for f in runs['features'])) == meta['snowmaking']
for f in runs['features']:
    assert f['geometry']['type'] == 'LineString'
    assert len(f['geometry']['coordinates']) >= 2
    for lon, lat in f['geometry']['coordinates']:
        assert -180 <= lon <= 180 and -90 <= lat <= 90

class Links(HTMLParser):
    def __init__(self, path):
        super().__init__()
        self.path = path

    def handle_starttag(self, tag, attrs):
        for name, url in attrs:
            if name not in ('src', 'href') or not url or url.startswith('#'):
                continue
            parsed = urlsplit(url)
            if parsed.scheme or parsed.netloc:
                continue
            assert not parsed.path.startswith('/'), f'Root-absolute URL: {url}'
            target = (self.path.parent / unquote(parsed.path)).resolve()
            assert target.is_relative_to(root), f'Escaping project root: {url}'
            assert target.exists(), f'Missing local resource: {target}'

for path in root.rglob('*.html'):
    if '.git' not in path.parts:
        Links(path).feed(path.read_text())
print('PASS: snapshot counts, piste coordinates, and relative local HTML resources')
