# /// script
# dependencies = ["shapely==2.1.2", "ijson==3.4.0"]
# ///
"""Audit manually chosen fallback polygons against the cached OpenSkiData runs.
No network access. Counts are records, not distance-weighted coverage.
"""
import argparse
import hashlib
import json
from pathlib import Path
import ijson
from shapely.geometry import shape, Point
from shapely.ops import unary_union

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / 'maps/03-ski-area-polygons/data'


def audit(runs):
    review = json.loads((DATA / 'polygon-matches.json').read_text())
    ranking = {r['id']: r for r in json.loads((DATA / 'downhill-ranking.json').read_text())['top10']}
    features = {f['properties']['id']: f for f in json.loads((DATA / 'tirol-boundaries.geojson').read_text())['features']}
    polygons = {key: shape(f['geometry']) for key, f in features.items()}
    stats = {}
    for row in review['matches']:
        rid = row['openSkiDataId']
        union = unary_union([polygons[key] for key in row['polygonIds']])
        stats[rid] = {'label': ranking[rid]['label'], 'polygonIds': row['polygonIds'],
                      'sourcePointCovered': union.covers(Point(ranking[rid]['mapReference']['coordinates'])),
                      'associatedRecords': 0, 'intersectingRecords': 0, 'fullyContainedRecords': 0,
                      'candidateIntersections': {}, '_union': union}
    with runs.open('rb') as stream:
        for run in ijson.items(stream, 'features.item', use_float=True):
            ids = {a['properties']['id'] for a in run['properties'].get('skiAreas', [])}
            for rid in ids & stats.keys():
                if not run.get('geometry'):
                    continue
                geometry = shape(run['geometry'])
                s = stats[rid]
                s['associatedRecords'] += 1
                s['intersectingRecords'] += int(s['_union'].intersects(geometry))
                s['fullyContainedRecords'] += int(s['_union'].covers(geometry))
                for key, polygon in polygons.items():
                    if polygon.intersects(geometry):
                        s['candidateIntersections'][key] = s['candidateIntersections'].get(key, 0) + 1
    for s in stats.values():
        del s['_union']
        s['candidateIntersections'] = {key: {'name': features[key]['properties']['name'], 'records': count}
                                      for key, count in sorted(s['candidateIntersections'].items(), key=lambda item: -item[1])}
    with runs.open('rb') as stream:
        digest = hashlib.file_digest(stream, 'sha256').hexdigest()
    output = {'runsSHA256': digest,
              'reviewSHA256': hashlib.sha256((DATA / 'polygon-matches.json').read_bytes()).hexdigest(),
              'tirolSHA256': hashlib.sha256((DATA / 'tirol-boundaries.geojson').read_bytes()).hexdigest(),
              'qualification': 'Associated source run records; not distance/area-weighted coverage, current boundary equivalence or a polygon-generation method.',
              'matches': stats}
    (DATA / 'polygon-match-audit.json').write_text(json.dumps(output, ensure_ascii=False, indent=2) + '\n')
    print(json.dumps(output, ensure_ascii=False, indent=2))


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--runs', type=Path, required=True)
    audit(parser.parse_args().runs)
