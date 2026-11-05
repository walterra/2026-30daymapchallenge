# Into the Kaiser — Kössen → Griesner Alm

Second static Three.js viewshed prototype, in `05-viewshed-02-griesenau`. Starts at **the identical Kössen Dorf OSM node** as [01 · Taubensee](../05-viewshed-01-taubensee/), then follows a calculated cycling route via Schwendt and Griesenau into Kaiserbachtal, ending at Griesner Alm.

Naming clarification: **Griesenau** is the hamlet at the valley entrance; **Griesner Alm** is the restaurant/alm at the end of the valley road. The requested “Griesenau Alm” is interpreted as Griesner Alm, not as a stop in Griesenau.

## Preview

```sh
python3 -m http.server 8000
# http://localhost:8000/maps/05-viewshed-02-griesenau/
```

No required build step, backend or remote runtime requests. Red + grayscale Cactus presentation matches the first variant. This entry imports its renderer and stylesheet from `../05-viewshed-01-taubensee/`; the vendored Three.js MIT dependency is shared there as well. Keep both entries together when deploying. Terrain, route and visibility data are local to this entry.

## Layout

Both variants use a square map on the left and a 320 px control panel on the right, containing playback, statistics and elevation profile. A compact two-column introduction and reduced header spacing leave more room for the visualization. On desktop, the map is sized from the actual remaining viewport height, with 24 px of space beneath the full visualization; short desktop screens also use more compact controls. Sizing uses document coordinates so scrolling the method notes does not grow or shrink the map. The page can still scroll to the notes/footer; no content is clipped to force a fit. At viewport widths of 900 px or less, controls stack below the still-square map. Capture mode hides the entire panel and preserves explicitly requested canvas dimensions, including non-square exports.

Viewport-fit update checked at 1280 × 800 on both entries, 1280 × 720 on Taubensee, 1024 × 600 on Griesenau, and 390 × 844 on Griesenau. Desktop regression asserts that the entire visualization fits with at least 16 px of breathing room, and that scrolling does not change its size. Square geometry, controls, deterministic export, site resources and whitespace checks passed; browser error logs were empty. The 1280 × 800 composition was visually inspected.

Layout regression checks passed for both variants at 1440 × 1100 and 390 × 844; the cycling variant also passed at 901 × 1000 and 320 × 740. Checks assert square map geometry, desktop/stacked panel positioning, no horizontal overflow and deterministic 960 × 720 capture. Desktop screenshot inspected. Narrow cycling-page axe scan: 0 violations, 0 incomplete checks; browser error log empty. Site resource checks and `git diff --check` passed.

## Kaiserwinkl regional label

**Kaiserwinkl** is the Tirol holiday region comprising **Kössen, Walchsee, Schwendt and Rettenschöss**, between the Chiemgau Alps and the Kaiser mountains. Here “Kaiser” refers to the Kaisergebirge; “Winkl” is a regional form of “Winkel”, a corner or nook. “The corner by the Kaiser mountains” is a plain-language gloss, not a documented historical naming account.

Sources checked: [the official tourism board’s Kössen page](https://www.kaiserwinkl.com/de/koessen-tirol.html), which names the four municipalities, and [the regional overview](https://de.wikipedia.org/wiki/Kaiserwinkl), which identifies the namesake Kaisergebirge and geographic setting. No historical naming dates are inferred.

A neutral, lighter-weight **KAISERWINKL** label is placed over the valley west of Kössen, between Kössen and Walchsee (12.355° E, 47.657° N). This is a cartographic placement inside the region, not a surveyed centroid or an administrative boundary. Both manifests record the anchor and source, and the preparation script preserves it on regeneration. The label is part of the Three.js scene, so it is included in PNG captures.

## High-density text rendering

Interactive WebGL rendering uses the display’s pixel ratio, capped at 3×, while keeping CSS map dimensions and label sizes unchanged. Label textures are 3072 × 288 pixels with 96 px source glyphs and a finer outline. Terrain and visibility data resolutions are unchanged. Explicit capture mode still uses pixel ratio 1 for exact requested output dimensions; increase the requested capture size for higher-resolution exports.

Verified at 1280 × 800 / 2× density on both entries, 390 × 844 / 3× density on cycling, and 1280 × 800 / 1× density on hiking. Tests verify physical canvas resolution and unchanged exact 960 × 720 deterministic captures. A 2× desktop screenshot was visually inspected. All 18 data tests, site/resource checks, module syntax and whitespace checks passed; browser error logs were empty.

## Cycling camera

Only this entry uses a tighter, route-centered viewport: a **790 × 790 cell (15.8 × 15.8 km)** frame centered at grid coordinates **735, 480**. It is approximately **1.4× closer** than the original full-terrain view. The complete cycling route retains padding on every side, with Kaiserbachtal and the northern Wilder Kaiser slopes still in view. The camera remains fixed during playback; non-square captures expand the frame to preserve its extent. The scale bar is repositioned inside the tighter view. The hiking entry retains its original camera.

Framing is configured in this entry’s `#map` element via `data-view`, not in the shared terrain or visibility data. Changing the camera does not recompute visibility or change the total modeled visible-area statistic, which can include offscreen terrain. `window.viewshed.framing` reports the current center and extents in grid-cell coordinates.

Camera regressions passed at 1280 × 800 for both entries and 390 × 844 for cycling: unchanged hiking extent, tighter cycling extent, full route within padded bounds, fixed camera during animation and deterministic capture. Site/whitespace checks passed and browser error logs were empty. Desktop framing was visually inspected.

## Cycling route and evidence

- **18.71 km**, 1,353 route vertices; calculated from OpenStreetMap, not a GPS recording, surveyed cycle trail or official complete itinerary.
- Same start: OSM node **2064921082**, 12.4053869° E, 47.6693828° N.
- Through-road waypoints near the mapped places **Schwendt** and **Griesenau**, then west along the asphalt **Kaiserbachtal** toll road to the access driveway at Griesner Alm: 12.3298855° E, 47.5797403° N. The driveway endpoint is near the mapped building, not inside it.
- Weighted network routing prefers quieter roads to primary/secondary roads. Costs per meter: primary 3, secondary 1.6, tertiary 1.2, track 1.4, other permitted links 1. No disconnected straight-line bridges are inserted.
- Explicit bicycle/access prohibitions are excluded. Tracks, paths, footways and pedestrian ways require positive bicycle permission; steps and motorways are excluded. Bicycle-specific one-way rules, generic one-way roads and mapped opposite-direction cycleways are respected. Motor-vehicle-only restrictions do not prohibit bicycles.
- **Traffic warning:** this is not a continuous segregated cycleway. Some sections use the B172/B176 and other roads with motor traffic, including high-speed sections. The model does not account for temporary closures, conditional access, turn-restriction relations or current traffic. It is not a navigation/safety recommendation.

### Reviewed access exception — not silently inferred

[The regional tourism board’s Kaiserbachtal cycling description](https://www.kitzbueheler-alpen.com/de/stjo/touren/kaiserbachtal-radstrecke.html) explicitly describes cycling the 5 km toll road from Griesenau, via Fischbachalm, to Griesner Alm. Its full tour starts in Kirchdorf, **not Kössen**; only its description of the valley road is used to review this segment. No tourism GPX, map imagery or proprietary track is copied.

OSM way **454081835**, an asphalt `Kaiserbachtal` road section, has `vehicle=no` but lacks the `bicycle=yes` explicitly present on its continuation, way **25382299**. The preparation script applies one named, recorded bicycle-access exception to way 454081835 based on that cycling description. It does not override an explicit `bicycle=no`. Original tags are preserved in `data/route-ways.json`, and the evidence URL is recorded in `manifest.json.reviewedCycleAccess`. This is a prototype review decision, not a legal assurance; verify current signs before riding.

The downloadable ODbL route includes each OSM node ID and each consecutive segment’s source way ID. The source tags for the selected ways are published separately for review.

## Visibility

Same metric terrain grid as the Taubensee variant, with its own tighter camera: **20 m**, EPSG:32633, approximately **22.6 × 21.8 km** including Wilder Kaiser. North stays up; the camera does not follow the rider.

**126 independently calculated viewsheds**, at approximately **150 m** route intervals. Eye height is modeled as 1.7 m above ground; it is not measured rider eye height. Each observer uses 16,384 rays, 10 m radial steps, nearest-cell terrain and a 32 km search radius. Missing terrain terminates a ray. Visibility changes discretely at the nearest route sample; the marker moves continuously at constant presentation speed over 30 seconds. The 30 seconds are animation time, not ride duration.

Trees, buildings, Earth curvature, refraction and weather are excluded. German terrain remains absent. This is terrain-only modeled visibility, not photographic visibility. Six atlas pages fit within an 8192-pixel GPU texture limit and use single-channel GPU textures. The approximately 118 MiB estimate for the four-page hiking variant does not apply here: these six pages use approximately **176 MiB**, excluding decode buffers.

## Sources, licenses and publishing

- Terrain and terrain-derived assets: **Datenquelle: Land Tirol - data.tirol.gv.at**, CC BY 4.0; [current terms and extensions](https://www.tirol.gv.at/data/nutzungsbedingungen/). Source service, extraction URL, retrieval details, limitations and required publication notification are documented in [the shared terrain method](../05-viewshed-01-taubensee/README.md#sources-and-redistribution). **Notification to `opendata@tirol.gv.at` remains outstanding** and must include both application URLs when published; no message was sent automatically.
- Route, selected OSM way tags, and route-related manifest data: © [OpenStreetMap contributors](https://www.openstreetmap.org/copyright), [ODbL 1.0](https://opendatacommons.org/licenses/odbl/1-0/). Source extraction URLs are recorded in the manifest; downloaded 5 November 2026. Raw XML is cached outside git. Regeneration against changing OSM data can produce a different route.
- Cycling-corridor review: [Kitzbüheler Alpen — Kaiserbachtal Radstrecke](https://www.kitzbueheler-alpen.com/de/stjo/touren/kaiserbachtal-radstrecke.html). Used as factual route/access evidence only.
- Renderer: shared Three.js 0.170.0, MIT; original license at `../05-viewshed-01-taubensee/vendor/THREE-LICENSE.txt`.
- Wilder Kaiser label anchor: [Ellmauer Halt](https://en.wikipedia.org/wiki/Ellmauer_Halt), 47.56222° N, 12.30306° E.

## Preparation and capture

```sh
uv run --with numpy --with pillow --with pyproj --with rasterio scripts/prepare-viewshed.py --route griesenau --route-only
uv run --with numpy --with pillow --with pyproj --with rasterio scripts/prepare-viewshed.py --route griesenau
uv run --with numpy --with pillow scripts/test-viewshed.py
python3 scripts/check-site.py
```

The first command validates the connected route without computing viewsheds. Default `--route taubensee` regenerates the hiking variant. Raw downloads are cached under `/tmp/koessen-viewshed-cache`; no source-data credentials are needed. A missing or disconnected network fails instead of fabricating a replacement.

```js
await window.viewshed.ready;
window.viewshed.setCapture({ width: 1200, height: 900 });
window.viewshed.renderAt(15);
const png = window.viewshed.png();
```

Same [deterministic capture contract](../05-viewshed-01-taubensee/README.md#deterministic-capture-api) as the hiking variant. Canvas PNGs exclude DOM attribution; capture the viewport with `?capture=1` or add source credits in offline encoding. GIF encoding remains a later step.

## Assistance and verification

Substantial AI assistance: source research, cycling-network construction and access review, data preparation, viewshed generation, renderer generalization, page implementation, documentation and automated checks. No field verification or independent reference-GIS validation is claimed.

Run the browser regression on either page using `agent-browser eval --stdin < scripts/check-viewshed.js`; the test reads each entry’s manifest rather than assuming the same number of viewsheds. The data suite covers both variants, identical starts and initial visibility, matching terrain, cycling waypoints, bicycle-access filtering, metric lengths, observer spacing, paged masks, unknown terrain and changing Kaiser visibility.

Checks performed for this addition:

- 16 data tests passed across both variants; local site/resource checks passed.
- JavaScript module syntax, Python preparation-script compilation and `git diff --check` passed.
- Browser regression passed on both variants at 1200 × 900 and 390 × 844; the cycling variant also passed at 320 × 740. Checks include all atlas-page transitions, play/pause/seek/reset/end-stop, exact capture dimensions, no horizontal overflow and repeatable PNG pixels.
- Cycling desktop capture and narrow mobile screenshots visually inspected; narrow place labels are separated to prevent Griesenau/Griesner Alm overlap.
- Cycling page axe scans in light and dark modes: 0 violations, 0 incomplete checks. Browser error logs were empty. No field route validation or reference-GIS comparison was performed.
