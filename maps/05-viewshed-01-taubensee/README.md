# Into view — Kössen → Taubenseehütte

First Three.js viewshed research prototype, renamed to `05-viewshed-01-taubensee`; challenge day unassigned. The companion [02 · Kaiserbachtal cycling route](../05-viewshed-02-griesenau/) starts at the identical Kössen Dorf node and ends at Griesner Alm. Both entries share this folder’s renderer, stylesheet and vendored Three.js, but load their own data. No build step, remote runtime assets, accounts, or backend. Serve the repository with `python3 -m http.server 8000`, then open `http://localhost:8000/maps/05-viewshed-01-taubensee/`.

## What is real, and what is modeled

- Real Land Tirol elevation data and real OpenStreetMap street/path geometry.
- A **calculated shortest permitted walking-network route**, not a GPS recording, official recommended itinerary, or field-verified hike. The start is snapped from Kössen Dorf (12.40535, 47.66945) to the nearest walking-network vertex. The destination is the walking-network vertex nearest the OSM Taubenseehütte building (way 182389660). Both actual endpoints are downloadable in `data/route.geojson`.
- The resulting route is about 4.88 km, 368 network vertices. Walkability reflects OSM tags, not a safety assessment. No straight-line bridges are inserted into the route. The road approach and paths are both included; one-way vehicle restrictions are not applied to pedestrians.
- 99 observers, approximately every 50 m, eye height 1.7 m above ground. A 30-second presentation uses constant distance-based speed, not real walking time.
- Marker motion is interpolated along the route. Visibility uses the nearest precomputed sample, without crossfading or inventing intermediate results. The elevation profile follows sampled ground elevations, not a separately measured survey.

## Terrain and visibility

Source: Land Tirol `Gelaendemodell_5m_M28`, via [Gelände Tirol WCS](https://gis.tirol.gv.at/arcgis/services/Service_Public/terrain/MapServer/WCSServer?service=WCS&version=1.0.0&request=GetCapabilities). The exact extraction request is in `data/manifest.json`. Source WCS extraction is approximately 10 m spacing, reprojected with bilinear resampling to a **20 m UTM 33N (EPSG:32633)** grid. The 5 m source is not represented as a 5 m analysis. Published assets use grid-cell coordinates; north is up.

The fixed, north-up composition covers approximately **22.6 × 21.8 km**, extending southwest so the walking route sits in the upper right and **Wilder Kaiser** occupies the lower half. The mountain label is anchored at [Ellmauer Halt](https://en.wikipedia.org/wiki/Ellmauer_Halt) (47.56222° N, 12.30306° E), not placed arbitrarily. Map labels maintain readable pixel sizes and are kept inside the viewport on narrow screens.

An approximate radial horizon sweep uses **16,384 rays per observer** and 10 m radial steps, nearest-cell elevations, a running maximum of elevation/distance slopes and a maximum **32 km search**. This replaces the initial 12 km radius, which could not reach the main Kaiser ridge. The newly acquired southern terrain is included in the actual visibility calculation, not only in the background. The extract is smaller than that radius: the actual computed area is limited by the raster boundary and available coverage. The first unknown cell terminates each ray. This conservative handling can omit visible areas across a gap; unknown land is never silently filled with zero elevation. The model does **not** include German terrain, vegetation, buildings, weather, Earth curvature, refraction or vertical-datum reconciliation with other datasets. No cross-border data are merged in this first prototype.

The result is terrain-only **modeled visibility**, not photographic visibility or a navigation product. It is not independently validated against a reference GIS implementation. Higher-resolution and cross-border data are follow-up work, not implied capabilities. The hillshade and viewsheds use the same grid. Neutral grayscale hillshade follows the Cactus palette; muted red indicates visible cells, a red/white-cased line marks the route, and charcoal indicates missing terrain. Controls, marker and profile cursor use the Cactus red accent (`#cb2a42`, lighter red in dark mode), without orange/green/yellow thematic colors. Empty atlas slots are not rendered.

The larger 20 m grid uses four 5 × 5 atlas pages rather than a single oversized texture. Pages are loaded before readiness and uploaded as single-channel textures to reduce GPU memory use (approximately 118 MiB total for visibility textures, excluding browser decode buffers). Frames switch between pages deterministically with no network requests during playback. The displayed visible area counts only visible modeled cells (20 × 20 m each).

## Sources and redistribution

### Terrain: CC BY 4.0, Land Tirol

Required credit: **Datenquelle: Land Tirol - data.tirol.gv.at**. Elevation-derived terrain image, coverage mask and viewshed atlas pages are modified/derived from this source. See [Land Tirol license and extensions](https://www.tirol.gv.at/data/nutzungsbedingungen/) and [terrain availability](https://www.tirol.gv.at/sicherheit/geoinformation/geodaten-tiris/laserscandaten/). Retrieved 5 November 2026. The live WCS capabilities explicitly state `CC BY 4.0 AT`; the current terms link to CC BY 4.0 International. Older ArcGIS catalog metadata still say CC BY 3.0 AT; current terms and live service were used here.

**Publication action:** the Tirol terms request active notification to `opendata@tirol.gv.at` with the application URL. This has not been sent by the agent. Complete that action before promoting this prototype as a published entry. No email was sent automatically.

### Route: OpenStreetMap, ODbL 1.0

© [OpenStreetMap contributors](https://www.openstreetmap.org/copyright), [Open Database License 1.0](https://opendatacommons.org/licenses/odbl/1-0/). The route GeoJSON and route-related portions of the manifest are an extracted/derived database distributed under ODbL 1.0. The GeoJSON includes OSM node identifiers and full selected route coordinates. API extraction bounding boxes are recorded in the manifest. Retrieved 5 November 2026. OSM data are continuously edited; regenerating later can change the path. No Komoot/Strava track or imagery is copied.

### Rendering: Three.js

Three.js **0.170.0**, vendored locally in `vendor/three.module.min.js`, MIT; original notice in `vendor/THREE-LICENSE.txt`. Downloaded from the version-pinned jsDelivr npm distribution. Three.js is used explicitly for this prototype; there is no framework or npm build setup.

## Regeneration

Only data preparation needs Python packages. They are not browser/runtime requirements:

```sh
uv run --with numpy --with pillow --with pyproj --with rasterio scripts/prepare-viewshed.py --route taubensee
uv run --with numpy --with pillow scripts/test-viewshed.py
python3 scripts/check-site.py
```

The preparation script caches raw downloads in `/tmp/koessen-viewshed-cache`, outside git. Delete that cache to fetch a fresh snapshot. Downloaded API/XML and source GeoTIFF files are not needed by the browser. Data assets total approximately 2.2 MB, plus approximately 676 KB for Three.js. Generation date and extraction URLs are stored in the manifest. Requests can fail or be rate-limited; the script fails rather than generating invented replacements.

## Deterministic capture API

```js
await window.viewshed.ready; // rejects on load/WebGL failure
window.viewshed.setCapture({ width: 1200, height: 900 });
window.viewshed.renderAt(15); // seconds, clamped to [0, 30]; pauses playback
const pngDataURL = window.viewshed.png();
```

- `ready` resolves only after textures and the first frame have rendered.
- `renderAt(t)` returns time, viewshed frame index, distance and elevation. Repeating the same time restores the same scene, independent of previous playback.
- `setCapture` sets exact canvas dimensions and a clean composition. Pixel ratio is always 1, independent of device density.
- `png()` exports **the canvas only**, with route, labels and scale bar. DOM title, progress, legend and source footer are not baked into that PNG. For an attributed GIF, capture the map element/full capture viewport or add attribution during encoding.
- `?capture=1` hides the surrounding page and sizes the map to the viewport. For this mode use browser screenshots at a fixed viewport size; they include the title, legend and source credits.
- `viewshed.current` exposes `{time, frame, playing}`; `viewshed.state` exposes readiness/error.
- Interactive playback does not autoplay, does not loop and stops at 30 s. Users explicitly start motion. Rendering is time-based but there is no capture-time wall clock, randomized scene, camera drift or remote tile loading.

For a future GIF, capture frames at `t = i / fps` for `i = 0 … duration*fps - 1`, then encode offline with an optimized palette (for example FFmpeg palettegen/paletteuse). The last capture can be held separately if desired. Browser/WebGL rendering can vary between GPUs; byte-identical output is expected only within the same browser/rendering environment. This change provides the capture contract, not an automated GIF exporter.

## Assistance and checks

Substantial AI assistance: source research, OSM path calculation, elevation extraction, radial visibility algorithm, asset preparation, Three.js scene, interface, documentation and tests. No terrain visibility field validation is claimed.

Checks performed:

- `uv run --with numpy --with pillow scripts/test-viewshed.py`: 16 tests passed across both variants, including atlas page dimensions, route endpoints and metric distances, sample spacing, observer-cell visibility, frame variation, no visible cells outside known coverage, upper-right hiking-route framing, coverage and changing visibility at Wilder Kaiser, grayscale terrain, and cycling-access/waypoint checks.
- `python3 scripts/check-site.py`: passed, including local HTML resources across the repository.
- `node --input-type=module --check < maps/05-viewshed-01-taubensee/app.js` and `git diff --check`: passed.
- Served with `python3 -m http.server 8000`. Chromium via agent-browser: `scripts/check-viewshed.js` passed at 1200 × 900, 390 × 844 and 320 × 740. Checks cover start/middle/end, repeatable PNG pixels, seeks across all four atlas pages, red timeline accent, seek/clamping/invalid input, play/pause/reset/end-stop, no horizontal overflow, and exact 960 × 720 capture size.
- Desktop capture and full mobile screenshot visually inspected. Browser error log empty during checks. Narrow dark-mode axe scan after contrast backing was added: 0 violations, 0 incomplete checks. The earlier light-mode scan had 0 violations but required manual review of map text; opaque backing was subsequently added. Canvas labels and terrain colors still depend on manual visual review.

Re-run browser checks on this page with `agent-browser eval --stdin < scripts/check-viewshed.js`. The test ends in capture mode; reload to restore the normal page.
