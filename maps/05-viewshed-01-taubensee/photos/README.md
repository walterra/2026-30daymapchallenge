# Route photographs

Thirteen historical photographs: ten sourced from Wikimedia Commons and three supplied by the project author. The cycling route uses the ten Commons photos; the hiking route has four photos (the shared Kössen start photo and three owner-supplied upper-route photos). Commons images retrieved 5 November 2026 are **CC BY-SA 4.0**: https://creativecommons.org/licenses/by-sa/4.0/. Individual photographs remain separately licensed from application code and terrain data. Local JPEGs were EXIF-oriented, resized without cropping to fit 640 × 480 pixels, and recompressed at Pillow quality 82; no color edits. Credit, source and license appear with each displayed image.

| Local file | Creator | Date | Source and original |
| --- | --- | --- | --- |
| post.jpg | Braveheart | 2017-05-11 | [File page](https://commons.wikimedia.org/wiki/File:Gasthof_zur_Post,_K%C3%B6ssen.jpg) · [Original](https://upload.wikimedia.org/wikipedia/commons/f/f1/Gasthof_zur_Post%2C_K%C3%B6ssen.jpg) |
| schwendt.jpg | Braveheart | 2017-05-11 | [File page](https://commons.wikimedia.org/wiki/File:Ortsansicht_Schwendt.jpg) · [Original](https://upload.wikimedia.org/wikipedia/commons/1/19/Ortsansicht_Schwendt.jpg) |
| chapel.jpg | Sturmel | 2020-07-12 | [File page](https://commons.wikimedia.org/wiki/File:Kapelle_der_Bergtoten_im_Kaiserbachtal.jpg) · [Original](https://upload.wikimedia.org/wikipedia/commons/1/18/Kapelle_der_Bergtoten_im_Kaiserbachtal.jpg) |
| schwendt-church.jpg | Braveheart | 2017-05-11 | [File page](https://commons.wikimedia.org/wiki/File:Pfarrkirche_Schwendt_01.jpg) · [Original](https://upload.wikimedia.org/wikipedia/commons/2/24/Pfarrkirche_Schwendt_01.jpg) |
| kohlamweg.jpg | Michielverbeek | 2017-08-03 | [File page](https://commons.wikimedia.org/wiki/File:Tussen_Griesenau_en_Schwendt,_panorama_vanaf_de_Kohlamweg_foto5_2017-08-03_14.27.jpg) · [Original](https://upload.wikimedia.org/wikipedia/commons/2/2d/Tussen_Griesenau_en_Schwendt%2C_panorama_vanaf_de_Kohlamweg_foto5_2017-08-03_14.27.jpg) |
| griesenau-chapel.jpg | Braveheart | 2017-05-11 | [File page](https://commons.wikimedia.org/wiki/File:Kapelle_Griesenau,_Kirchdorf_in_Tirol_01.jpg) · [Original](https://upload.wikimedia.org/wikipedia/commons/2/20/Kapelle_Griesenau%2C_Kirchdorf_in_Tirol_01.jpg) |
| kaiserbach.jpg | Chmee2 | 2016-06-27 | [File page](https://commons.wikimedia.org/wiki/File:Naturschutzgebiet_Kaiserbachtal_am_Wilden_Kaiser_in_Kirchdorf_in_Tirol_in_2016_(1).JPG) · [Original](https://upload.wikimedia.org/wikipedia/commons/a/a1/Naturschutzgebiet_Kaiserbachtal_am_Wilden_Kaiser_in_Kirchdorf_in_Tirol_in_2016_%281%29.JPG) |
| kaiser-valley-road.jpg | Chmee2 | 2016-06-27 | [File page](https://commons.wikimedia.org/wiki/File:Naturschutzgebiet_Kaiserbachtal_am_Wilden_Kaiser_in_Kirchdorf_in_Tirol_in_2016_(5).JPG) · [Original](https://upload.wikimedia.org/wikipedia/commons/5/5b/Naturschutzgebiet_Kaiserbachtal_am_Wilden_Kaiser_in_Kirchdorf_in_Tirol_in_2016_%285%29.JPG) |
| fischbachalm.jpg | Chmee2 | 2016-06-27 | [File page](https://commons.wikimedia.org/wiki/File:Alpengasthaus_Fischbachalm_in_naturschutzgebiet_Kaiserbachtal_am_Wilden_Kaiser_in_Kirchdorf_in_Tirol_in_2016_(6).JPG) · [Original](https://upload.wikimedia.org/wikipedia/commons/8/83/Alpengasthaus_Fischbachalm_in_naturschutzgebiet_Kaiserbachtal_am_Wilden_Kaiser_in_Kirchdorf_in_Tirol_in_2016_%286%29.JPG) |
| kaiser-road-view.jpg | Chmee2 | 2016-06-27 | [File page](https://commons.wikimedia.org/wiki/File:Kaiser_Mountains_as_view_from_naturschutzgebiet_Kaiserbachtal_in_Tirol_in_2016_(1).JPG) · [Original](https://upload.wikimedia.org/wikipedia/commons/6/66/Kaiser_Mountains_as_view_from_naturschutzgebiet_Kaiserbachtal_in_Tirol_in_2016_%281%29.JPG) |

License version, authors and camera coordinates were checked against each Commons file page's raw wikitext (`action=raw`), not inferred from Commons' general footer license.

## Route matching and behavior

Each entry has its own `data/photos.json`: `radius` (meters), and `photos` with ID, local relative URL, title, alt text, photographer, source, capture date, WGS84 camera coordinates `[longitude, latitude]`, route distance anchor in meters and camera-to-track offset. Both entries reuse this local image folder and `photos.mjs`; no external runtime photo requests. Each photo also records its verified `license` and `licenseUrl`. Commons photos include their original download URL. Owner-supplied photos instead record only the original filename, never a private filesystem path.

Anchors were found by projecting camera coordinates onto the nearest segment of each local route GeoJSON in a local equirectangular metric approximation (111,320 meters per degree, longitude scaled by cosine latitude), then accumulating segment lengths. Rounded anchors/offsets are sufficient for the 150 m walking / 300 m cycling selection windows. These are approximate, not surveyed positions. Shared village photo: walking anchor 0 m, offset 92 m; cycling anchor 30 m, offset 70 m. Cycling Schwendt: 9,630 m, offset 2 m; chapel: 17,420 m, offset 55 m.

The nearest anchor within the window is shown; otherwise an explicit empty state replaces it. The card updates on seek, playback, reset and `renderAt()`, sits below the ground elevation chart, and is omitted from canvas-only captures. Images preserve their full composition. Metadata or image failure does not disable the map. Photos are historical location context, not evidence validating the viewshed or a promise of present-day conditions. Taubensee now has the shared start photograph plus three owner-supplied upper-route images. The terrace photo appears at the route destination. Capture dates distinguish autumn, winter and year-end conditions; none are a live view.

AI assistance: photo discovery, metadata/license verification, approximate route matching, image preparation, UI implementation, documentation and browser checks.

## Owner permission

The project author supplied three original photographs and explicitly authorized their use in this map project on 5 November 2026. Copyright remains with the photographer. These images are **not CC-licensed** and no general permission for reuse outside this project is granted here. The card displays “Photo: Project author · Used with permission” instead of a CC badge. Existing Commons credits remain CC BY-SA 4.0.

Local JPEG copies were oriented from EXIF, resized without additional cropping to fit 640 × 480 pixels, recompressed at quality 82, and stripped of EXIF metadata. The supplied framing and color appearance were preserved. Only capture date and camera coordinates needed for route matching were transcribed to `data/photos.json`; original-resolution files, device metadata and private source paths are not published.

### moosen-winter

- Local file: `moosen-winter.jpg`; supplied original: `B7250706-63D7-4B8F-80C2-918B0B4BBEB2.jpeg`.
- Caption: Moosen pastures · winter. Capture date from EXIF: 14 January 2023.
- EXIF camera: 47.69001111° N, 12.41843056° E. Nearest hiking-route anchor: 4,170 m; camera offset: approximately 3 m.

### moosen-autumn

- Local file: `moosen-autumn.jpg`; supplied original: `IMG_7059.jpeg`.
- Caption: Above Moosen · autumn. Capture date from EXIF: 23 October 2022.
- EXIF camera: 47.69021667° N, 12.42006944° E. Nearest hiking-route anchor: 4,328 m; camera offset: approximately 120 m. This is nearby context, not a photograph taken exactly on the calculated track.

### taubensee-terrace

- Local file: `taubensee-terrace.jpg`; supplied original: `IMG_7476.jpeg`.
- Caption: Taubenseehütte · terrace view. Capture date from EXIF: 31 December 2022.
- EXIF camera: 47.69351111° N, 12.41985833° E. Nearest hiking-route anchor: 4,870 m; camera offset: approximately 9 m.

Locations use the same approximate projection method as the Commons photos. Names identify the nearby route context, not a surveyed camera placement. AI assistance includes EXIF extraction, route matching, captions, image preparation, per-photo permission display and checks.

## Expanded cycling coverage and hiking research gap

Seven additional cycling photos were checked using the public Commons API (`imageinfo` / `extmetadata`), then the individual file pages’ raw license templates and camera locations. All seven are CC BY-SA 4.0. Images were visually reviewed; descriptive captions and alt text reflect their actual content. New stops (distance along track / camera offset):

- Schwendt · St Ägidius church: 6.730 km / 49 m.
- Kohlental · near Kohlamweg: 12.100 km / 184 m.
- Griesenau · roadside chapel: 13.829 km / 4 m.
- Kaiserbach · entering the valley: 15.189 km / 17 m.
- Kaiserbachtal · road into the mountains: 15.914 km / 4 m.
- Fischbachalm · valley road: 17.220 km / 0 m.
- Wilder Kaiser · from the valley road: 18.227 km / 4 m.

The Kohlamweg panorama is nearby context from a camera 184 m away, not a photograph taken exactly on the road. Positions remain approximate; no view direction or photographic visibility is inferred. The route between the village start and Schwendt still has a coverage gap; ten photos do not imply evenly spaced coverage.

The requested hiking target of five suitable photos is **not met**. Commons geosearch at six locations along the actual hiking track (350 m radius), plus text/geographic searches excluding aerial imagery, found no suitable upper-route ground photos. Results for other Taubensee lakes in Ramsau/Ruhpolding and aerial orthophotos were rejected. The Flickr hut photo by Chiemgau-Wiki is explicitly all-rights-reserved; Hikr and Höhenrausch examples lacked an individual CC grant. Outdooractive/Alpenvereinaktiv and tourism pages mix photo-specific rights: a CC label elsewhere on the page is not permission for every photograph. No restricted images were downloaded for redistribution. Village duplicates were not added just to reach the requested count. The later owner-supplied photographs now cover the upper route, bringing the hiking total to four; one additional suitable image is still needed to reach five.

## Reproduction

Commons original URLs and owner-supplied original filenames are in `data/photos.json`. To fetch missing Commons files and apply the same preparation:

```sh
uv run --with pillow python scripts/prepare-route-photos.py
# Add --refresh to re-download/reprocess existing images.
# Owner-supplied originals must be provided separately:
uv run --with pillow python scripts/prepare-route-photos.py --local-originals /path/to/private/originals
```

The script checks the source host and destination directory; it needs no key, subscription, build step or browser runtime service. Wikimedia downloads can be rate-limited; wait and retry instead of substituting an unverified image. Original manual preparation for the initial three:

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

Checks performed after expansion: `uv run --with pillow python scripts/test-route-photos.py` passed (14 catalog entries validated, including the shared start image and three owner-permission photos). Browser photo/control checks passed for cycling at 1440 × 1000, 1200 × 720 and 390 × 844, and hiking at 1440 × 1000 and 390 × 844. All local images loaded; source links matched metadata; no browser errors were reported. A mobile screenshot was inspected: the extra stops cluster near the valley end, so map badges can overlap there; profile buttons and keyboard navigation remain available. The parallel UI edits were preserved. `git diff --check` passed.

Browser regression: serve the repository, open either entry using agent-browser, and run `agent-browser eval --stdin < scripts/check-viewshed-photos.js`. Run at desktop and mobile widths. The test exercises all photo anchors and image loading, credits, out-of-range empty states, reset, timeline seeking and horizontal overflow; desktop viewport fit is checked at heights of at least 720 px.
