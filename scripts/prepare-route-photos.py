#!/usr/bin/env python3
"""Re-download/resize explicitly licensed route photos. Run with uv --with pillow.
No API key required. Existing images are skipped unless --refresh is passed.
"""
import argparse
import io
import json
import subprocess
from pathlib import Path
from PIL import Image, ImageOps

ROOT = Path(__file__).resolve().parent.parent
FOLDERS = ['05-viewshed-01-taubensee', '05-viewshed-02-griesenau']


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--refresh', action='store_true')
    parser.add_argument('--local-originals', type=Path, help='Directory containing owner-supplied originals; never committed')
    args = parser.parse_args()
    seen = set()
    for folder in FOLDERS:
        config = json.loads((ROOT / 'maps' / folder / 'data/photos.json').read_text())
        for photo in config['photos']:
            output = (ROOT / 'maps' / folder / photo['src']).resolve()
            if not output.is_relative_to(ROOT / 'maps/05-viewshed-01-taubensee/photos'):
                raise ValueError(f'Unexpected output path: {output}')
            if output in seen:
                continue
            seen.add(output)
            if output.exists() and not args.refresh:
                continue
            if 'originalFile' in photo:
                if not args.local_originals:
                    raise ValueError(f"Pass --local-originals to prepare {photo['id']}; originals are not published")
                filename = photo['originalFile']
                if Path(filename).name != filename:
                    raise ValueError('Local original must be a filename, not a path')
                raw = (args.local_originals / filename).read_bytes()
            else:
                url = photo['original']
                if not url.startswith('https://upload.wikimedia.org/wikipedia/commons/'):
                    raise ValueError(f'Unexpected download host: {url}')
                raw = subprocess.check_output(['curl', '-L', '--fail', '--retry', '2', url])
            image = ImageOps.exif_transpose(Image.open(io.BytesIO(raw)))
            image.thumbnail((640, 480))
            image.convert('RGB').save(output, quality=82, optimize=True)
            print(f'{output.relative_to(ROOT)}: {output.stat().st_size:,} bytes')


if __name__ == '__main__':
    main()
