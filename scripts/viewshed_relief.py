#!/usr/bin/env python3
"""Prepare relief-only texture without recomputing viewsheds.
uv run --with numpy --with pillow --with rasterio scripts/viewshed_relief.py
"""
import argparse
import json
from pathlib import Path
import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]


def write_relief(dem, valid, cell_size, target):
    """Directional hillshade: flat ground is white; no altitude-dependent tint."""
    gy, gx = np.gradient(np.where(valid, dem, 0), cell_size)
    light = np.clip((-.5*gx+.6*gy+1)/np.sqrt(gx*gx+gy*gy+1), 0, 1)
    supported = valid.copy()
    for axis in (0, 1):
        supported &= np.roll(valid, 1, axis) & np.roll(valid, -1, axis)
    supported[[0, -1], :] = False
    supported[:, [0, -1]] = False
    # Missing neighbors must not manufacture a shadow cliff at the border.
    light[~supported] = 1
    Image.fromarray(np.rint(light*255).astype('uint8')).save(target, optimize=True)


def main():
    import rasterio
    from rasterio.transform import from_origin
    from rasterio.warp import reproject, Resampling
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--source', type=Path, default=Path('/tmp/koessen-viewshed-cache/terrain-kaiser.tif'))
    args = parser.parse_args()
    if not args.source.exists():
        parser.error('Cached source is missing; run scripts/prepare-viewshed.py to download and prepare all assets.')
    for slug in ('05-viewshed-01-taubensee', '05-viewshed-02-griesenau'):
        folder = ROOT/'maps'/slug/'data'
        m = json.loads((folder/'manifest.json').read_text())
        dem = np.zeros((m['height'], m['width']), dtype=np.float32)
        with rasterio.open(args.source) as src:
            reproject(src.read(1), dem, src_transform=src.transform, src_crs=src.crs,
                      src_nodata=0, dst_transform=from_origin(m['west'], m['north'], m['cellSize'], m['cellSize']),
                      dst_crs=m['crs'], dst_nodata=0, resampling=Resampling.bilinear)
        write_relief(dem, dem > 100, m['cellSize'], folder/'relief.png')
        print(f'{slug}: relief-only texture written; visibility assets unchanged')


if __name__ == '__main__':
    main()
