# Day 03 · Polygons — Austria’s ski areas, outlined

A curated map with a national overview combining OpenSkiData’s coverage with official Tirol planning boundaries. Both sources are always visible; a bottom-right inline legend distinguishes them. A dense, linked ranking selects one resort on the map, initially Ski Arlberg. Pan/zoom, search, sidebar and optional tiles remain disabled. Chart selection only changes the persistent highlight. No artificial resort boundaries are generated.

## Snapshot and scope

The global ski-area GeoJSON was downloaded on **2026-11-02**, not queried live by visitors.

Select records where:
- `places` contains country code `AT`;
- `status` is `operating`;
- `activities` includes `downhill`.

Results in this pinned download:
- 375 selected source records.
- 177 Polygon records and 11 MultiPolygon records: **188 shown**.
- 187 Point records: **omitted**, listed in data/coverage.json.
- All 188 supplied polygon geometries are valid and nonempty.
- 187 polygon records have names; one is explicitly labeled unnamed in the UI.

Counts are records, not an official census of unique resorts. Overlapping, nested, cross-border and imperfectly classified records exist. Country association is inherited from OpenSkiData and is not independently validated.

For example, source-country assignments can include nearby/cross-border records such as Balderschwang, Schnalstal and Drei Zinnen. Comparison with a generalized national border is not precise enough to establish legal resort membership. This map does not quietly reclassify or clip them.

The polygons are mapped ski-area outlines, not piste footprints, land ownership, cleared land or planning boundaries. Source status is not a live report of lift or piste opening.

## Supplementary Tirol source: CC BY 4.0

Downloaded 2026-11-03 from the official **Schigebietsgrenzen** layer:
https://gis.tirol.gv.at/arcgis/rest/services/Service_Public/ogd_sport/MapServer/7

- 102 valid, nonempty Polygon records, 100 distinct source names.
- Every record has STAND = 2011-10-30; capture scale EMASST = 5000.
- Attribution: **Land Tirol – tiris, Schigebietsgrenzen**.
- License: **CC BY 4.0**, https://creativecommons.org/licenses/by/4.0/
- License confirmed in the ArcGIS service item’s licenseInfo: https://www.arcgis.com/sharing/rest/content/items/9fb23fac39034eadaff8054fdd35cbf6?f=json
- Separate files: data/tirol-boundaries.geojson and data/tirol-coverage.json.

These are planning envelopes, not verified current operational/piste footprints. They supplement the ODbL dataset without being dissolved into it. Both sources remain visible in the fixed composition; their counts are not added as a resort census. Overlapping records are deliberately retained, not silently deduplicated.

### Verified Sölden association

OpenSkiData’s Sölden record is only a Point. The official polygon **Ötztaler Gletscher**, OBJECTID 102, contains that point. Using the cached piste snapshot associated with the same OpenSkiData ID, **219 of 223 piste records intersect** this planning polygon; 212 are wholly inside it. These are record counts, not distance/area-weighted coverage or proof of identical operational boundaries.

The data retains the reviewed alias **Sölden**, while retaining **Ötztaler Gletscher** as the original source name. No geometry is changed. Metadata stores the matching point, source ID and piste-record audit. Other resort names are not automatically fuzzy-matched or renamed.

## OpenSkiData source and ODbL

Download: https://tiles.openskimap.org/geojson/ski_areas.geojson
Documentation and attribution: https://openskidata.org/

Attribution: OpenSkiData / OpenSkiMap.org, © OpenStreetMap contributors (ODbL), Skimap.org, Who’s On First, © Mapterhorn.

The reduced dataset in data/ski-areas.geojson is distributed under **ODbL 1.0**:
https://opendatacommons.org/licenses/odbl/1-0/

Retain attribution and comply with applicable share-alike requirements when redistributing a modified database. The source download SHA-256 is recorded in data/coverage.json. Upstream OSM/Skimap IDs are preserved for traceability; OpenSkiData content-hash IDs can change between builds.

Automated OpenSkiData downloads are permitted at most once daily. Direct use of its hosted vector tiles is prohibited. This implementation uses a local snapshot instead.

## What preparation changes

The preparation script filters the source and drops unused properties. Polygon/MultiPolygon coordinates are preserved exactly as supplied, including any cross-border geometry. There is no buffer, convex hull, geometry repair, resort-boundary inference, coordinate jitter, clipping or simplification of the ski-area data.

Larger source envelopes are painted first so smaller overlapping records remain inspectable. This drawing order is not presented as an area ranking.

Source region labels, operating status, official websites and upstream source identifiers are retained in the downloadable data. They are not converted into a regional resort census.

## Geographic context

Public-domain Natural Earth data, kept separate from the ODbL ski-area dataset:
- 1:10m admin-0 countries: https://naciscdn.org/naturalearth/10m/cultural/ne_10m_admin_0_countries.zip
- 1:10m admin-1 states/provinces: https://naciscdn.org/naturalearth/10m/cultural/ne_10m_admin_1_states_provinces.zip
- 1:10m populated places: https://naciscdn.org/naturalearth/10m/cultural/ne_10m_populated_places.zip
- Original preparation input (legacy single-city file, no longer rendered): https://naciscdn.org/naturalearth/50m/cultural/ne_50m_populated_places.zip
- Terms: https://www.naturalearthdata.com/about/terms-of-use/

Neighboring countries are clipped and simplified only for background rendering. The neutral, tile-free political basemap adds shared internal boundaries for **all nine Austrian states**: adjacent boundaries are intersected, unioned and line-merged before simplification, so shared edges are drawn once rather than as independent polygon outlines. National borders are solid; state borders are fine dashed lines. The separate Austria outline remains the overview extent.

Scale-aware country, state and city labels use public-domain Natural Earth positions (nine Austrian city records). Label collisions, clipped labels and collisions with annotation text, connectors, circle outlines or controls are suppressed. Stroke collisions use sampled screen-space SVG paths, not oversized path bounding boxes. Labels sit beneath resort geometry and callouts, never above them. The background is not used to validate, classify or clip resort polygons.

Reproduce this additional context:

```sh
curl -L --fail https://naciscdn.org/naturalearth/10m/cultural/ne_10m_admin_1_states_provinces.zip -o /tmp/ne_10m_admin_1_states_provinces.zip
curl -L --fail https://naciscdn.org/naturalearth/10m/cultural/ne_10m_populated_places.zip -o /tmp/ne_10m_populated_places.zip
uv run scripts/prepare-political-basemap.py --states /tmp/ne_10m_admin_1_states_provinces.zip --places /tmp/ne_10m_populated_places.zip
```

Outputs: `data/state-borders.geojson` and `data/reference-labels.geojson`, approximately 32 KB combined. Metadata records public-domain licensing and source hashes. These are topology-aware GeoJSON linework and label files, not a required TopoJSON runtime or an external map-tile service.

No street-map layer or external tiles are loaded. The complete basemap is local. The clipped neighboring-country polygons supply fill only, avoiding artificial strokes along the clipping rectangle; Austria’s separate outline supplies its national border.

## Reproduce

Use the pinned OpenSkiData file or deliberately download a newer snapshot and update the date. Do not fetch the global file repeatedly.

```sh
# Download only if a cached snapshot is not already available:
curl -L --fail https://tiles.openskimap.org/geojson/ski_areas.geojson -o /tmp/ski-areas.geojson
curl -L --fail https://naciscdn.org/naturalearth/10m/cultural/ne_10m_admin_0_countries.zip -o /tmp/ne_10m_admin_0_countries.zip
curl -L --fail https://naciscdn.org/naturalearth/50m/cultural/ne_50m_populated_places.zip -o /tmp/ne_50m_populated_places.zip

uv run scripts/prepare-ski-polygons.py \
  --ski-areas /tmp/ski-areas.geojson \
  --snapshot-date 2026-11-02 \
  --countries /tmp/ne_10m_admin_0_countries.zip \
  --places /tmp/ne_50m_populated_places.zip
uv run scripts/test-ski-polygons.py
python3 scripts/check-site.py
node --check maps/03-ski-area-polygons/map.js
```

Prepare the separate Tirol layer from the official query (read-only download):

```sh
curl -G --fail \
  --data-urlencode 'where=1=1' \
  --data-urlencode 'outFields=OBJECTID,NAME,STAND,EMASST' \
  --data-urlencode 'outSR=4326' --data-urlencode 'f=geojson' \
  'https://gis.tirol.gv.at/arcgis/rest/services/Service_Public/ogd_sport/MapServer/7/query' \
  -o /tmp/tirol-ski-boundaries.geojson
uv run scripts/prepare-tirol-ski-boundaries.py \
  --input /tmp/tirol-ski-boundaries.geojson \
  --snapshot-date 2026-11-03 \
  --ski-areas /tmp/ski-areas.geojson \
  --runs /tmp/ski-runs.geojson
```

The optional `--runs` input refers to the matching cached OpenSkiData piste snapshot; it streams that file and recomputes the recorded Sölden audit. No additional network request is made. If omitted, the audit is not regenerated; recheck the published fixed-snapshot narrative before publishing changed inputs. Use the actual download date for a newly downloaded Tirol snapshot.

If freshly downloading, replace the snapshot date with the actual download date. Counts may change with newer builds; inspect the manifest before updating narrative counts.

Hosting needs only HTML, CSS, JavaScript and local data. No build, server API, credentials, framework or visitor-time OpenSkiData request is needed. Preview through the project's existing local HTTP server at /maps/03-ski-area-polygons/.

## Datawrapper-informed design

- [Map design and customization](https://www.datawrapper.de/academy/how-to-create-a-symbol-map): restrained basemap, clear legends, useful tooltips, explicit annotation and mobile testing.
- [Crop and context](https://www.datawrapper.de/blog/cropped-view-inset-maps): frame the geography relevant to the data without confusing empty areas with absent infrastructure.

The map and chart emphasize the same ten reviewed resort areas. Six OpenSkiData outlines and five reviewed Tirol planning polygons (representing the other four ranked resorts) use the Cactus link color. The planning matches retain dashed borders and a visible 2011 qualification. The accent is reserved exclusively for the selected row, its geometry and local name label. Other mapped outlines are faint gray; unmatched historical Tirol planning boundaries are gray dashed outlines with no fill. The bottom-right legend distinguishes these roles and sits above attribution. Shapes locate resorts; only bar length encodes downhill kilometers.

The fixed regional view frames Vorarlberg, Tirol and Salzburg. All ten ranked resort labels remain visible, without inventing shapes for point records. The old four regional annotations are no longer rendered or fetched. The original OpenSkiData and Tirol sources remain separate datasets under their respective licenses.

## Reviewed polygon fallbacks

The four point-only ranking records have manually reviewed display associations: SkiWelt → `tiris:76` + `tiris:89`; Serfaus–Fiss–Ladis → `tiris:43`; Ischgl–Samnaun → `tiris:41` (partial); Sölden → `tiris:102`. Every source point is contained in its matched group. Across all 102 candidate planning features, the audit finds no other intersecting candidates for these four resorts beyond the accepted polygons. The evidence, exclusions, dates and reproduction are in [POLYGON-MATCH-REVIEW.md](POLYGON-MATCH-REVIEW.md). No source geometry is modified or merged, and ranking numbers remain unchanged.

## Linked resort hover

Nothing is highlighted initially. Hovering a bar, ranked polygon or map label highlights the same resort in both views. Leaving clears the highlight; keyboard focus provides the corresponding chart interaction and Escape clears it. Hover changes color only, not label placement or geographic framing.

[Susie Lu’s d3-annotation](https://d3-annotation.susielu.com/) renders all ten permanent name labels with straight leaders. Kilometer values are not duplicated on the map. Six ranking records highlight their actual OpenSkiData polygon/MultiPolygon; four point-only records highlight reviewed Tirol planning polygons instead of reference dots. These are source-preserving display associations, not changes to the original point records or kilometer values. Ischgl–Samnaun is explicitly partial because Swiss planning geometry is not supplied. See [the manual review and evidence](POLYGON-MATCH-REVIEW.md), [crosswalk](data/polygon-matches.json) and [run-record audit](data/polygon-match-audit.json). No outline or area is invented for point records. Ranking JSON retains its original source-boundary references for provenance. Live callouts instead start at visual interior centers computed from the displayed original polygons: a distance-field maximum keeps centers away from edges and out of holes or gaps between components. No source geometry or ranking value is changed. The historical four-group preparation files remain as unused research artifacts, not part of the page renderer.

The regional view stays fixed during interaction, with no automatic pan or zoom; resizing refits the region and recalculates labels. Cactus styling follows the page theme. Wide screens place the chart beside the map; narrow screens stack them. The visual SVG has a textual counterpart in the chart and live status.

### Occupancy bitmap and outward preference

`label-layout.js` follows the raster occupancy approach in [Kittivorawong et al., FastLabels, VIS 2021, §§3–4](https://idl.cs.washington.edu/files/2021-FastLabels-VIS.pdf). Ranked resort geometry and city names are rasterized as label obstacles. Owner-specific polygon masks also reject leaders crossing any other ranked resort; overlapping ownership is not erased when exempting the owner. Faint political/background context is not a hard obstacle. Each accepted label box **and its entire connection** is reserved before the next placement, including the visually empty six-pixel gap between the visible stem and its label. Bitmap journals permit exact rollback without repeatedly copying a full canvas.

Application extensions—not claims about the paper—include bounded forward checking to retain all ten labels, larger candidate rings, compact edge-sliding candidates and adaptive margins. Sparse raster-word intersections cache candidate conflicts. Full-segment tests reject actual leader crossings and text cuts, including within the eight-pixel raster tolerance near adjacent projected attachments. Leaders retain a minimum length of 32px when the map is at least 620px wide, otherwise 20px. City names remain anchored to their actual points.

Innsbruck’s Natural Earth position anchors a **soft outward preference**. A second, stronger north/south preference uses the mean latitude of each resort’s three nearest neighboring centers; this distinguishes northern Arlberg from southern Ischgl instead of pushing both south from Innsbruck. Wide western layouts preserve relative latitude order, but no fixed leader angle or oval slot is enforced. Candidate cost also penalizes sampled coverage of the actual Vorarlberg/Tirol/Salzburg basemap by each label box. This favors a loose surrounding envelope rather than horizontal interior labels. A bounded improvement pass reduces total placement cost after finding a complete layout. Collision checks remain hard constraints, and hover never moves labels. Probe annotations are measured separately and never published; failed recalculation retains the last completed layout.

Below 340px map width, three compact names are used: Saalbach–Hinterglemm, SkiWelt and Mayrhofen. Full resort names remain in the ranking, SVG tooltips and source data. This preserves readable 12px map labels rather than shrinking text or omitting resorts.

Validation: `node --test scripts/test-label-layout.js` covers bitmap word boundaries, rollback, outward/latitude preferences, polygon ownership, interior centers and complete leader-to-label connections. `scripts/check-ski-label-layout.js` independently samples the rendered SVG against original polygon paths, checks center anchors and semantic connections across the invisible label gap, and verifies text separation, city names and page overflow.

Vendored, version-pinned dependencies (no visitor-time CDN requests or new build step):
- D3 **4.13.0**, BSD-3-Clause, with its license in `assets/vendor/d3/LICENSE`.
- d3-svg-annotation **2.5.1**, Apache-2.0, with its license and provenance in `assets/vendor/d3-annotation/`.

## Downhill-length ranking

A dense horizontal bar chart sits beside the map on wide screens and below it on narrow screens. It shows the **top ten reviewed resort/destination areas by mapped downhill length**, not official advertised piste totals. It includes point-only ski-area records, including Sölden and SkiWelt. Tirol’s planning polygons and the editorial map circles are not used to calculate kilometers.

Source field: `statistics.runs.byActivity.downhill.byDifficulty.*.lengthInKm`. Sum all downhill difficulty categories using `math.fsum`; exclude Nordic trails and lifts. Of the 375 qualifying source records, 355 have these statistics and 20 do not. Missing lengths are not zero. Full cross-border resort lengths are retained, not clipped to Austrian territory.

The source mixes resort units, components and ticket regions. The explicit decisions in `data/ranking-review.json` exclude Ski amadé, the broader Schladming–Dachstein and Oberstdorf–Kleinwalsertal regions, the combined Damüls–Mellau–Faschina region, Lech/Zürs as an Arlberg component, and an uncertain Austrian association for Drei Zinnen. Official grouping pages are linked in that file and in the chart method. Their advertised kilometer totals are **not** imported. Every source record at or above the displayed cutoff must have an explicit review decision or preparation fails. The list is a reviewed comparison, not a definitive national league table or a claim that every destination is fully lift-connected.

Datawrapper-informed presentation: descending order, a common **0–300 km** scale, one theme-aware base bar color, a selection-only accent, light vertical guides, complete names and direct one-decimal values. The chart has more horizontal space than the earlier paired layout. Geographic names use proportional type; numeric values and site chrome retain monospace. A visible qualification directly below the bars states that these are mapped kilometers, not advertised totals or an official national ranking. Names move above bars on narrow screens. Full-precision values remain in the downloadable CSV/JSON. Native list/button semantics expose each name, value and selected state; bar fills are decorative. The chart values and bars are static HTML/CSS, with lightweight JavaScript only for linking selection to the map. There is no external chart service or new runtime library.

Reproduce from the existing pinned download:

```sh
python3 scripts/prepare-downhill-ranking.py --source /tmp/ski-areas.geojson
python3 scripts/test-downhill-ranking.py --source /tmp/ski-areas.geojson
```

The optional preparation step writes ODbL chart data and replaces only the `downhill-ranking:start/end` generated block in `index.html`. The cached source hash is checked against the map manifest; a newer source requires a fresh review. Do not hand-edit that generated block. Static hosting still needs no build step.

Outputs: `data/downhill-ranking.json` (values, source IDs, difficulty breakdowns, candidate decisions and licensing) and `data/downhill-ranking.csv`. `ranking.css` handles the responsive chart. `scripts/check-downhill-chart.js` verifies actual rendered widths, zero baseline, order, value/name placement and a single consistent color.

## Accessibility and dependencies

Leaflet 1.9.4 is vendored with its BSD-2-Clause license and used only as a renderer. Drag, wheel, double-click, touch, box and keyboard zoom/pan are disabled; no zoom control, search or map-click popups are installed. Resort selection is driven by the accessible ranking buttons without moving the map. The map is not an unnecessary keyboard stop. Textual counts, legend, prose description and downloadable data supplement canvas rendering. The page theme toggle remains accessible. A ResizeObserver coalesces responsive refitting after layout settles and ignores temporary zero-sized containers. Map styling reacts to the page’s theme without changing source geometry.

## Earlier verification · 2026-11-03

- 22 ski-map tests passed: pinned source/geometry fidelity, valid geometries, separate licenses/IDs, Sölden’s association and piste audit, all four annotation groups and bounding boxes, political context accounting, and the fixed-presentation contract.
- Eleven downhill-ranking tests, eight theme-preference tests, 10 home-distance tests and seven water-data tests passed, alongside the 22 ski-map tests (58 total).
- Map and annotation JavaScript passed `node --check`; site-resource and whitespace checks passed.
- The earlier renderer passed a 22-combination light/dark browser sweep. That sweep predates the permanent ten-label bitmap renderer and transient hover behavior; its persistent-selection expectations are no longer current.

### Current annotation verification

- 21 bitmap/preference/connector unit tests pass, including foreign polygons, interior centers, geographic order and the hidden leader-to-label gap.
- Rendered-label checks pass at 320, 390, 600, 768, 1024, 1100, 1280, 1440 and 1920px in both light and dark mode (18 combinations): all ten notes, note bounds/separation, actual leader paths, fixed city labels and page overflow.
- Native pointer checks pass for bar, label and polygon linking, clearing on exit, and unchanged SVG label/leader geometry during hover. No browser errors were reported.
- Latest recorded light-theme placement was 39–266ms across the nine tested widths. Additional 2× raster-scale checks pass at 390px and 1440px (307ms and 97ms). These are local browser observations, not performance guarantees.
- Site-resource validation and `git diff --check` pass.
- No sidebar, search, source switches, zoom control, popup or external tile requests remain. Ranking buttons drive persistent selection. The only page-level toggle is the light/dark theme.
- Full-page captures and viewport changes were checked with ResizeObserver-based framing, including temporary-size guards. Final browser session: no console errors.
- Axe WCAG 2 A/AA scan: no detected violations. Map/canvas contrast remains flagged for manual review; this is not a claim of full accessibility conformance.

Run the rendered-layout regression in the named browser session after the map overview and labels settle:

```sh
agent-browser wait --fn 'document.querySelector("#map").dataset.layoutReady === "true" && !document.querySelector("#map").dataset.layoutFailure'
agent-browser eval --stdin < scripts/check-ski-label-layout.js
agent-browser eval --stdin < scripts/check-ski-fixed-map.js
agent-browser eval --stdin < scripts/check-downhill-chart.js
agent-browser eval --stdin < scripts/check-linked-ski-chart.js
```

To include input-fidelity checks:

```sh
uv run scripts/test-ski-polygons.py \
  --source /tmp/ski-areas.geojson \
  --tirol-source /tmp/tirol-ski-boundaries.geojson
```

AI assistance: source inspection, data preparation, implementation and checks.
