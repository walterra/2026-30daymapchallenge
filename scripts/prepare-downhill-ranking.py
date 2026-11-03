"""Prepare the reviewed piste-length ranking from the cached OpenSkiData file.
python3 scripts/prepare-downhill-ranking.py --source /tmp/ski-areas.geojson
No network calls. Regenerates only the marked ranking block in the static page.
"""
import argparse
import csv
import hashlib
import html
import io
import json
import math
from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1]
FOLDER = ROOT / 'maps/03-ski-area-polygons'
START = '<!-- downhill-ranking:start -->'
END = '<!-- downhill-ranking:end -->'


def downhill_length(properties):
    difficulties = (properties.get('statistics') or {}).get('runs', {}).get('byActivity', {}).get('downhill', {}).get('byDifficulty', {})
    if not difficulties:
        return None, {}
    values = {}
    for difficulty, stats in difficulties.items():
        value = stats.get('lengthInKm')
        if not isinstance(value, (int, float)) or not math.isfinite(value) or value < 0:
            raise ValueError('Invalid downhill length: ' + str(properties.get('id')))
        values[difficulty] = value
    return math.fsum(values.values()), values


def prepare(source_path):
    raw = source_path.read_bytes()
    coverage = json.loads((FOLDER / 'data/coverage.json').read_text())
    assert hashlib.sha256(raw).hexdigest() == coverage['sourceSHA256'], 'Use the pinned download, or update and review the base snapshot first'
    review = json.loads((FOLDER / 'data/ranking-review.json').read_text())
    decisions = {r['id']: r for r in review['decisions']}
    features = [f for f in json.loads(raw)['features'] if f['properties'].get('status') == 'operating' and 'downhill' in f['properties'].get('activities', []) and any(p.get('iso3166_1Alpha2') == 'AT' for p in f['properties'].get('places', []))]
    candidates = []
    missing = []
    for feature in features:
        p = feature['properties']
        length, breakdown = downhill_length(p)
        if length is None:
            missing.append({'id': p['id'], 'name': p.get('name')})
            continue
        geometry = feature['geometry']
        if geometry['type'] == 'Point':
            reference = {'kind': 'point', 'coordinates': geometry['coordinates'][:2], 'method': 'Supplied OpenSkiData reference point; no outline inferred'}
        else:
            def vertices(coords):
                if isinstance(coords[0], (int, float)):
                    yield coords[:2]
                else:
                    for part in coords:
                        yield from vertices(part)
            points = list(vertices(geometry['coordinates']))
            center = (p.get('viewportHint') or {}).get('center', points[0])
            anchor = min(points, key=lambda c: (c[0] - center[0]) ** 2 + (c[1] - center[1]) ** 2)
            reference = {'kind': 'outline', 'coordinates': anchor, 'method': 'Actual source boundary vertex nearest supplied viewport center'}
        record = {'mapReference': reference, 'id': p['id'], 'name': p.get('name'), 'downhillLengthKm': length, 'byDifficultyKm': breakdown, 'geometryType': feature['geometry']['type'], 'sources': p.get('sources', [])}
        if p['id'] in decisions:
            decision = decisions[p['id']]
            assert decision['name'] == p.get('name'), 'Review source name changed'
            record.update({'decision': decision['decision'], 'reason': decision['reason']})
            if 'evidenceUrl' in decision:
                record['evidenceUrl'] = decision['evidenceUrl']
            if decision['decision'] == 'include':
                record['label'] = decision['label']
        else:
            record['decision'] = 'below-review-cutoff'
        candidates.append(record)
    candidates.sort(key=lambda r: (-r['downhillLengthKm'], r['id']))
    assert set(decisions).issubset({r['id'] for r in candidates}), 'Reviewed record disappeared'
    rows = [r.copy() for r in candidates if r['decision'] == 'include']
    assert len(rows) == 10
    cutoff = rows[-1]['downhillLengthKm']
    # Every record that could enter this top ten must have an explicit decision.
    assert all(r['id'] in decisions for r in candidates if r['downhillLengthKm'] >= cutoff), 'Review additional above-cutoff candidates'
    for rank, row in enumerate(rows, 1):
        row['rank'] = rank
    output = {'metadata': {'source': coverage['source'], 'sourceSHA256': coverage['sourceSHA256'], 'snapshotDownloaded': coverage['snapshotDownloaded'], 'license': coverage['license'], 'licenseUrl': coverage['licenseUrl'], 'attribution': coverage['attribution'], 'scope': review['scope'], 'reviewDate': review['reviewDate'], 'selectedRecords': len(features), 'recordsWithDownhillLength': len(candidates), 'recordsWithoutDownhillLength': len(missing), 'method': 'Sum source statistics.runs.byActivity.downhill.byDifficulty.*.lengthInKm; exclude Nordic trails and lifts. No official advertised totals substituted.', 'qualification': 'Reviewed resort/destination areas, not a complete official resort census. Full cross-border lengths retained. No claim that every destination is lift-connected.', 'axisMinimum': 0, 'axisMaximum': 300, 'displayDecimals': 1}, 'top10': rows, 'reviewedCandidates': [r for r in candidates if r['id'] in decisions], 'missingLengths': missing}
    (FOLDER / 'data/downhill-ranking.json').write_text(json.dumps(output, ensure_ascii=False, indent=2) + '\n')
    stream = io.StringIO(newline='')
    writer = csv.writer(stream)
    writer.writerow(['rank', 'resort_area', 'mapped_downhill_km', 'source_name', 'source_id', 'snapshot_downloaded'])
    for r in rows:
        writer.writerow([r['rank'], r['label'], r['downhillLengthKm'], r['name'], r['id'], coverage['snapshotDownloaded']])
    (FOLDER / 'data/downhill-ranking.csv').write_text(stream.getvalue())
    return output


def render(data):
    rows = []
    for r in data['top10']:
        width = r['downhillLengthKm'] / data['metadata']['axisMaximum'] * 100
        rows.append(f'''          <li class="ranking-item"><button type="button" class="ranking-row" disabled aria-pressed="false" data-source-id="{html.escape(r['id'])}" data-km="{r['downhillLengthKm']:.15g}">
            <span class="ranking-name">{html.escape(r['label'])}</span>
            <span class="ranking-bar-cell"><span class="ranking-bar-track" style="--bar-width:{width:.10f}%">
              <span class="ranking-bar" aria-hidden="true"></span>
              <span class="ranking-value">{r['downhillLengthKm']:.1f}<span class="visually-hidden"> kilometers</span></span>
            </span></span>
          </button></li>''')
    ticks = ''.join(f'<span style="left:{value / 3:.10f}%">{value}</span>' for value in range(0, 301, 50))
    return f'''    {START}
    <section class="downhill-ranking" aria-labelledby="ranking-title">
      <h2 id="ranking-title">The longest mapped downhill networks</h2>
      <p class="ranking-subtitle" id="ranking-description">Top 10 reviewed resort areas · mapped downhill km.</p>
      <p class="ranking-interaction">Hover, focus or tap to select a resort. Selection stays visible.</p>
      <p id="ranking-map-status" class="visually-hidden" role="status"></p>
      <div class="ranking-plot" aria-describedby="ranking-description ranking-note">
        <div class="ranking-grid" aria-hidden="true"></div>
        <div class="ranking-axis" aria-hidden="true">{ticks}</div>
        <ol class="ranking-list" role="list" aria-label="Resort areas ranked by mapped downhill kilometers">
{chr(10).join(rows)}
        </ol>
      </div>
      <p class="ranking-caveat"><strong>Mapped km—not advertised piste totals.</strong> Regional ticket alliances and duplicate components excluded. This is a reviewed snapshot, not an official national ranking.</p>
    </section>
    <div class="comparison-notes">
      <p class="ranking-note" id="ranking-note"><strong>Length definition.</strong> Sum of mapped downhill statistics across difficulty classes; Nordic trails and lifts excluded. Full cross-border resort areas are retained, not clipped to Austria.</p>
      <p class="ranking-source">Source: <a href="https://openskidata.org/">OpenSkiData</a> / © <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a>, snapshot downloaded 2 November 2026 (<a href="https://opendatacommons.org/licenses/odbl/1-0/">ODbL</a>). 355 of 375 qualifying records have downhill-length statistics; missing values are not zero. Tirol’s planning polygons are not used for these lengths.</p>
      <details class="ranking-method">
        <summary>Which records count as a resort area?</summary>
        <p>Named resort/destination areas are compared, not entire ticket alliances. Ski amadé, the broader Schladming–Dachstein and Oberstdorf–Kleinwalsertal regions, and the combined Damüls–Mellau–Faschina record are excluded. Lech/Zürs is not counted again alongside Ski Arlberg. The Austrian association of the Drei Zinnen record is uncertain, so it is excluded. These are editorial unit decisions, not an automatic or universally accepted resort classification.</p>
        <p>Mayrhofen–Hippach includes its different mountains; inclusion does not imply all pistes connect by lift. Point-only records such as Sölden and SkiWelt remain eligible. All numerical totals come from the cached source’s downhill difficulty categories, not current marketing claims.</p>
        <p>Grouping references: <a href="https://www.skiamade.com/en/ski-areas">Ski amadé</a> · <a href="https://www.schladming-dachstein.at/en/activities/skiing">Schladming–Dachstein</a> · <a href="https://www.kleinwalsertal.com/en/discover-kleinwalsertal/ski-resorts-kleinwalsertal">Kleinwalsertal</a> · <a href="https://www.damuels.at/en/winter/ski-area-of-damuels-mellau-and-faschina-1.html">Damüls / Faschina</a>.</p>
        <p><a href="data/downhill-ranking.csv">Download chart data (CSV)</a> · <a href="data/downhill-ranking.json">Values, calculation and candidate audit (JSON)</a> · <a href="data/ranking-review.json">Record-by-record review decisions</a></p>
      </details>
    </div>
    {END}'''


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--source', required=True, type=Path)
    args = parser.parse_args()
    data = prepare(args.source)
    page = FOLDER / 'index.html'
    content = page.read_text()
    block = render(data)
    if START in content:
        content, count = re.subn(r'    ' + re.escape(START) + r'.*?' + re.escape(END), lambda _: block, content, flags=re.S)
        assert count == 1, 'Exactly one generated chart block is required'
        page.write_text(content)
    else:
        # First insertion is an explicit source edit; subsequent regeneration
        # only replaces the dedicated generated block.
        (FOLDER / 'data/downhill-ranking.fragment.html').write_text(block + '\n')
    print('Prepared 10 descending resort-area bars from', data['metadata']['recordsWithDownhillLength'], 'length-bearing records; all above-cutoff candidates reviewed.')

if __name__ == '__main__':
    main()
