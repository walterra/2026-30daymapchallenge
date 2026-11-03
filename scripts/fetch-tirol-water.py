# /// script
# requires-python = ">=3.10"
# dependencies = ["beautifulsoup4==4.14.3", "requests==2.32.5"]
# ///
"""Sequential, cached WIS extraction. Raw HTML stays OUTSIDE the repository.
uv run scripts/fetch-tirol-water.py --cache /tmp/wis-tirol-cache
Public read-only searches only; 0.4s minimum spacing, no concurrency.
"""
import argparse
import datetime
import hashlib
import json
from pathlib import Path
import re
import time
import requests
from bs4 import BeautifulSoup

BASE = 'https://wis.tirol.gv.at/wisSrvPublic/wis/'
DISTRICTS = {'T1': 'Imst', 'T2': 'Innsbruck-Land', 'T3': 'Innsbruck-Stadt', 'T4': 'Kitzbühel', 'T5': 'Kufstein', 'T6': 'Landeck', 'T7': 'Lienz', 'T8': 'Reutte', 'T9': 'Schwaz'}

def text(tag):
    return ' '.join(tag.get_text(' ', strip=True).split()) if tag else ''

def form(page):
    values = {x['name']: x.get('value', '') for x in page.select('input[name]') if x.get('type') not in ('submit', 'button', 'image') and (x.get('type') != 'checkbox' or x.has_attr('checked'))}
    for select in page.select('select[name]'):
        option = select.select_one('option[selected]') or select.select_one('option')
        if option is not None:
            values[select['name']] = option.get('value', '')
    return values

def parse_report(html, district):
    page = BeautifulSoup(html, 'html.parser')
    nodes = []
    node = None
    for table in page.find_all('table', id=True):
        key = table['id']
        if key in ('tblRootAnlage', 'tblSubAnlage'):
            anchor = table.find('a', attrs={'name': re.compile(r'^[ATSK]\w+$')})
            if not anchor:
                raise ValueError('Missing source ID in report heading')
            node = {'id': anchor['name'], 'name': text(anchor.parent), 'districts': [district], 'isSystem': key == 'tblRootAnlage', 'attributes': {}}
            nodes.append(node)
        elif node is not None:
            value = text(table)
            if key.endswith('AnlageType'):
                node['type'] = value.removeprefix('Typ:').strip()
            elif key.endswith('AnlagenStatus'):
                node['status'] = value.removeprefix('Status:').strip()
            elif key.endswith('AnlageParentName'):
                node['parentName'] = value.removeprefix('Teil von:').strip()
            elif key.endswith('AnlageKoord'):
                match = re.search(r'Rechtswert:\s*([-\d.,]+)\s*Hochwert:\s*([-\d.,]+)', value)
                if match:
                    node['rw'], node['hw'] = [float(x.replace('.', '').replace(',', '.')) for x in match.groups()]
            elif key.endswith('_tblAttr'):
                for tr in table.find_all('tr'):
                    cells = tr.find_all('td', recursive=False)
                    if len(cells) >= 4 and not any(c.find('table') for c in cells):
                        node['attributes'][text(cells[0])] = ' '.join(text(c) for c in cells[1:] if text(c))
    if not nodes:
        raise ValueError('Empty/unrecognized report')
    # Parent text is not an ID. Resolve only an exact name or an exact name
    # with the enclosing root name in parentheses. Ambiguity stays unresolved.
    for node in nodes:
        if 'parentName' not in node:
            continue
        matches = [n['id'] for n in nodes if n['id'] != node['id'] and (node['parentName'] == n['name'] or node['parentName'].startswith(n['name'] + ' ('))]
        if len(matches) == 1:
            node['parent'] = matches[0]
    return nodes

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--cache', type=Path, required=True)
    args = parser.parse_args()
    args.cache.mkdir(parents=True, exist_ok=True)
    session = requests.Session()
    def request(method, url, **kwargs):
        time.sleep(.4)
        r = session.request(method, url, timeout=90, **kwargs)
        r.raise_for_status()
        if 'Server Error in' in r.text or 'Invalid postback' in r.text:
            raise ValueError('WIS rejected postback')
        return r.text
    # Resolve already-seen search rows to their enclosing report. A child row
    # often opens the exact same Topanlage report; do not download it again.
    known_rows = {}
    def index_report(html):
        parsed = parse_report(html, '')
        root = parsed[0]['id']
        known_rows[parsed[0]['name']] = root
        for child in parsed[1:]:
            known_rows[child['name'] + ' - ' + parsed[0]['name']] = root
        return parsed
    for path in args.cache.glob('*.html'):
        if re.fullmatch(r'[ATSK]\w+\.html', path.name):
            index_report(path.read_text())
    results = []
    all_nodes = {}
    report_hashes = {}
    for code, district in DISTRICTS.items():
        manifest_path = args.cache / (code + '.json')
        if manifest_path.exists():
            cached = json.loads(manifest_path.read_text())
            district_reports = cached['reports']
            count = cached['searchRows']
        else:
            search_url = BASE + 'wbo_wb_search.aspx'
            initial = BeautifulSoup(request('GET', search_url), 'html.parser')
            values = form(initial)
            values.update(cboGISBezirk=code, cboGISGemeinde='', cboGISKG='', cboAnlSparte='T2005235R0', cboAnzahlErgebnisse='50', btStartSearch='Suche starten')
            html = request('POST', search_url, data=values)
            (args.cache / f'{code}-initial.html').write_text(html)
            page = BeautifulSoup(html, 'html.parser')
            match = re.search(r'Es wurde[n]?\s+(\d+)\s+Anlage[n]? gefunden', text(page))
            if not match:
                # A zero-result response must say so explicitly.
                if re.search(r'keine.*gefunden|0 Anlagen', text(page), re.I):
                    count = 0
                else:
                    raise ValueError(f'No result count for {district}: {text(page)[-1500:]}')
            else:
                count = int(match[1])
            district_reports = []
            seen_rows = 0
            page_number = 1
            while count:
                (args.cache / f'{code}-search-{page_number}.html').write_text(str(page))
                table = page.select_one('#grdSuchErgebnis')
                rows = [tr for tr in table.find_all('tr', recursive=False) if tr.select_one('input[title="WB-Auszug (HTML)"]')]
                for index, row in enumerate(rows):
                    row_name = text(row.find_all('td', recursive=False)[1])
                    if row_name in known_rows:
                        root = known_rows[row_name]
                        report = (args.cache / (root + '.html')).read_text()
                        parsed = parse_report(report, district)
                    else:
                        button = row.select_one('input[title="WB-Auszug (HTML)"]')['name']
                        values = form(page)
                        values.update({button + '.x': '5', button + '.y': '5'})
                        report = request('POST', search_url, data=values)
                        parsed = parse_report(report, district)
                        root = parsed[0]['id']
                        path = args.cache / (root + '.html')
                        path.write_text(report)
                        index_report(report)
                    district_reports.append(root)
                    seen_rows += 1
                    print(f'{district}: {seen_rows}/{count} {root} ({len(parsed)} facilities)', flush=True)
                if seen_rows >= count:
                    break
                page_number += 1
                pager = next((a for a in table.select('a[href]') if text(a) == str(page_number)), None)
                if pager is None:
                    raise ValueError(f'Incomplete pagination: {district} {seen_rows}/{count}')
                target, argument = re.search(r"__doPostBack\('([^']*)','([^']*)'\)", pager['href']).groups()
                values = form(page)
                values.update(__EVENTTARGET=target, __EVENTARGUMENT=argument)
                page = BeautifulSoup(request('POST', search_url, data=values), 'html.parser')
            assert seen_rows == count
            manifest_path.write_text(json.dumps({'searchRows': count, 'reports': district_reports}, indent=2))
        for root in district_reports:
            html = (args.cache / (root + '.html')).read_text()
            report_hashes[root] = hashlib.sha256(html.encode()).hexdigest()
            nodes = parse_report(html, district)
            for node in nodes:
                node['reports'] = [root]
                if node['id'] in all_nodes:
                    old = all_nodes[node['id']]
                    # Fail closed on conflicting repeated observations rather
                    # than choosing coordinates or quantities arbitrarily.
                    for field in ['rw', 'hw', 'type', 'status', 'parent', 'attributes']:
                        if old.get(field) and node.get(field) and old[field] != node[field]:
                            raise ValueError(f'Conflicting {field} for {node["id"]}')
                    # Union provenance; keep richer nonempty fields.
                    for field in ['reports', 'districts']:
                        old[field] = sorted(set(old[field] + node[field]))
                    for field, value in node.items():
                        if field not in ('reports', 'districts', 'isSystem') and value and not old.get(field):
                            old[field] = value
                    old['isSystem'] = old['isSystem'] or node['isSystem']
                else:
                    all_nodes[node['id']] = node
        results.append({'district': district, 'searchRows': count, 'reports': len(set(district_reports))})
        print(f'COMPLETE {district}: {count} rows', flush=True)
    retrieval_dates = [datetime.datetime.fromtimestamp((args.cache / (id + '.html')).stat().st_mtime, datetime.timezone.utc).date().isoformat() for id in report_hashes]
    output = {'retrieved': max(retrieval_dates), 'retrievalStarted': min(retrieval_dates), 'query': 'Sparte=Nutzwasser für Beschneiungsanlagen; Status=<alle aktiven>; all nine Tirol districts; 50 rows/page; topanlage reports with tree', 'districts': results, 'reportHashes': report_hashes, 'nodes': list(all_nodes.values())}
    folder = Path(__file__).resolve().parents[1] / 'maps/02-engineered-winter/data'
    (folder / 'tirol-source.json').write_text(json.dumps(output, ensure_ascii=False, indent=2) + '\n')
    print(f'TOTAL: {len(all_nodes)} unique facilities, {len(report_hashes)} reports', flush=True)

if __name__ == '__main__':
    main()
