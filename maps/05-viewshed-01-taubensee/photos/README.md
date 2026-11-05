# Route photographs

Three historical photographs sourced from Wikimedia Commons. Retrieved 5 November 2026. All are **CC BY-SA 4.0**: https://creativecommons.org/licenses/by-sa/4.0/. Individual photographs remain separately licensed from application code and terrain data. Local JPEGs were EXIF-oriented, resized without cropping to fit 640 × 480 pixels, and recompressed at Pillow quality 82; no color edits. Credit, source and license appear with each displayed image.

| Local file | Creator | Date | Source and original |
| --- | --- | --- | --- |
| post.jpg | Braveheart | 2017-05-11 | [File page](https://commons.wikimedia.org/wiki/File:Gasthof_zur_Post,_K%C3%B6ssen.jpg) · [Original](https://upload.wikimedia.org/wikipedia/commons/f/f1/Gasthof_zur_Post%2C_K%C3%B6ssen.jpg) |
| schwendt.jpg | Braveheart | 2017-05-11 | [File page](https://commons.wikimedia.org/wiki/File:Ortsansicht_Schwendt.jpg) · [Original](https://upload.wikimedia.org/wikipedia/commons/1/19/Ortsansicht_Schwendt.jpg) |
| chapel.jpg | Sturmel | 2020-07-12 | [File page](https://commons.wikimedia.org/wiki/File:Kapelle_der_Bergtoten_im_Kaiserbachtal.jpg) · [Original](https://upload.wikimedia.org/wikipedia/commons/1/18/Kapelle_der_Bergtoten_im_Kaiserbachtal.jpg) |

License version, authors and camera coordinates were checked against each Commons file page's raw wikitext (`action=raw`), not inferred from Commons' general footer license.

## Route matching and behavior

Each entry has its own `data/photos.json`: `radius` (meters), and `photos` with ID, local relative URL, title, alt text, photographer, source, capture date, WGS84 camera coordinates `[longitude, latitude]`, route distance anchor in meters and camera-to-track offset. Both entries reuse these three local images and `photos.mjs`; no external runtime photo requests.

Anchors were found by projecting camera coordinates onto the nearest segment of each local route GeoJSON in a local equirectangular metric approximation (111,320 meters per degree, longitude scaled by cosine latitude), then accumulating segment lengths. Rounded anchors/offsets are sufficient for the 150 m walking / 300 m cycling selection windows. These are approximate, not surveyed positions. Shared village photo: walking anchor 0 m, offset 92 m; cycling anchor 30 m, offset 70 m. Cycling Schwendt: 9,630 m, offset 2 m; chapel: 17,420 m, offset 55 m.

The nearest anchor within the window is shown; otherwise an explicit empty state replaces it. The card updates on seek, playback, reset and `renderAt()`, sits below the ground elevation chart, and is omitted from canvas-only captures. Images preserve their full composition. Metadata or image failure does not disable the map. Photos are historical location context, not evidence validating the viewshed or a promise of present-day conditions. Taubensee currently has only the shared start photograph; no upper-route coverage is implied.

AI assistance: photo discovery, metadata/license verification, approximate route matching, image preparation, UI implementation, documentation and browser checks.

## Reproduction

Download originals from the table to `/tmp/viewshed-{post,schwendt,chapel}.jpg`, then from the repository root:

```sh
uv run --with pillow python - <<'PY'
from PIL import Image, ImageOps
for name in ['post', 'schwendt', 'chapel']:
    image = ImageOps.exif_transpose(Image.open('/tmp/viewshed-' + name + '.jpg'))
    image.thumbnail((640, 480))
    image.convert('RGB').save('maps/05-viewshed-01-taubensee/photos/' + name + '.jpg', quality=82, optimize=True)
PY
```

Browser regression: serve the repository, open either entry using agent-browser, and run `agent-browser eval --stdin < scripts/check-viewshed-photos.js`. Run at desktop and mobile widths. The test exercises all photo anchors and image loading, credits, out-of-range empty states, reset, timeline seeking and horizontal overflow; desktop viewport fit is checked at heights of at least 720 px.
