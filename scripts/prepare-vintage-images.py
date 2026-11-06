#!/usr/bin/env python3
"""Prepare licensed local images: uv run --with pillow scripts/prepare-vintage-images.py.

Metadata/selection are pinned locally. Downloads are restricted to Wikimedia's
public upload hosts. The UI's sepia treatment is NOT baked into the JPEGs.
"""
import hashlib
import html
import json
import re
import tempfile
import urllib.error
import urllib.parse
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from html.parser import HTMLParser
from io import BytesIO
from pathlib import Path
from PIL import Image, ImageOps

ROOT=Path(__file__).resolve().parents[1]
ENTRY=ROOT/'maps/06-vintage-wrecks'
DATA=ENTRY/'data'
CACHE=Path(tempfile.gettempdir())/'vintage-image-cache'
CACHE.mkdir(exist_ok=True)
(ENTRY/'photos').mkdir(exist_ok=True)
selection=json.loads((DATA/'image-selection.json').read_text())['images']
raw=json.loads((DATA/'commons-images.json').read_text())['files']

class Plain(HTMLParser):
    def __init__(self):super().__init__();self.parts=[]
    def handle_data(self,text):self.parts.append(text)
def plain(text):
    p=Plain();p.feed(text);return ' '.join(html.unescape(''.join(p.parts)).split())
def clean_url(url):
    p=urllib.parse.urlsplit(url)
    if p.scheme!='https' or p.hostname not in {'upload.wikimedia.org','thumb.wikimedia.org'}:
        raise ValueError('Unexpected image download host')
    return urllib.parse.urlunsplit(p._replace(query='',fragment=''))
def download(url):
    cache=CACHE/hashlib.sha256(url.encode()).hexdigest()
    if cache.exists():return cache.read_bytes()
    req=urllib.request.Request(url,headers={'User-Agent':'30DayMapChallenge/1.0 (educational map; Wikimedia Commons attributed images)'})
    with urllib.request.urlopen(req,timeout=35) as response:
        clean_url(response.url)
        data=response.read(25_000_001)
    if len(data)>25_000_000:raise ValueError('Image exceeds 25 MB preparation limit')
    cache.write_bytes(data);return data

def prepare(s):
    assert re.fullmatch(r'Q\d+',s['id'])
    info=raw[s['file']]['imageinfo'][0];ext=info['extmetadata']
    value=lambda key:ext.get(key,{}).get('value','')
    licence=value('LicenseShortName')
    if not re.fullmatch(r'CC BY(?:-SA)? (?:2\.0|2\.5|3\.0|4\.0)|Public domain',licence):
        raise ValueError(f'Unreviewed licence: {licence}')
    if value('Restrictions').strip():raise ValueError('Review additional file restrictions')
    author=s.get('artistOverride') or plain(value('Artist'))
    if not author:raise ValueError(f'Missing credit: {s["file"]}')
    original=clean_url(info['url']);url=clean_url(info.get('thumburl',info['url']))
    try:source=download(url)
    except urllib.error.HTTPError:
        url=original;source=download(original)
    image=ImageOps.exif_transpose(Image.open(BytesIO(source))).convert('RGB')
    image.thumbnail((960,640),Image.Resampling.LANCZOS)
    path=ENTRY/'photos'/f'{s["id"]}.jpg'
    image.save(path,quality=82,optimize=True)
    result={k:s[k] for k in ['id','kind','caption','alt']}
    result.update(src=f'photos/{s["id"]}.jpg',author=author,source=info['descriptionurl'],
        license=licence,licenseUrl=value('LicenseUrl').replace('http:','https:') or 'https://creativecommons.org/publicdomain/mark/1.0/',
        file=s['file'],originalUrl=original,downloadUrl=url,date=plain(value('DateTimeOriginal')),
        width=image.width,height=image.height,sha256=hashlib.sha256(path.read_bytes()).hexdigest(),
        changes='EXIF-oriented, resized without cropping, recompressed and EXIF stripped. UI applies sepia; local JPEG retains unfiltered colours.')
    print(f'{s["id"]}: {image.width} × {image.height}; {licence}; {author}',flush=True)
    return result

with ThreadPoolExecutor(max_workers=2) as pool:images=list(pool.map(prepare,selection))
(DATA/'photos.json').write_text(json.dumps({'reviewed':'2026-11-06','images':images},ensure_ascii=False,indent=2)+'\n')
print(f'Prepared {len(images)} images; {sum((ENTRY/x["src"]).stat().st_size for x in images):,} bytes')
