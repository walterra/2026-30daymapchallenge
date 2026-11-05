#!/usr/bin/env python3
"""Pack existing atlas PNGs for fast browser loading without RGBA conversion.
uv run --with pillow scripts/viewshed_atlases.py
"""
import gzip
import json
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]


def pack_atlas(image, target):
    if image.mode != 'L':
        image = image.convert('L')
    # Deterministic gzip: one byte per pixel, row-major, no header inside payload.
    target.write_bytes(gzip.compress(image.tobytes(), compresslevel=6, mtime=0))


if __name__ == '__main__':
    for slug in ('05-viewshed-01-taubensee', '05-viewshed-02-griesenau'):
        folder = ROOT/'maps'/slug/'data'
        manifest = json.loads((folder/'manifest.json').read_text())
        for name in manifest['atlasFiles']:
            target = folder/name.replace('.png', '.bin.gz')
            with Image.open(folder/name) as image:
                pack_atlas(image, target)
        print(f'{slug}: packed {len(manifest["atlasFiles"])} single-channel atlas pages')
