# Day 03 · Polygons — Austria’s ski areas, outlined

A polygon-only explorer combining OpenSkiData’s national coverage with a separately labeled official Tirol planning-boundary layer. Teal means OpenSkiData; violet means Tirol planning boundaries (reference date 2011). Searchable inspection and Hochkössen / Sölden shortcuts expose the original sources. No artificial resort boundaries are generated.

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

These are planning envelopes, not verified current operational/piste footprints. They supplement the ODbL dataset without being dissolved into it. Both source layers can be toggled independently; their counts are not added as a resort census. Overlapping records are deliberately retained, not silently deduplicated. Selecting a hidden-source record enables that source so the chosen polygon is visible.

### Verified Sölden association

OpenSkiData’s Sölden record is only a Point. The official polygon **Ötztaler Gletscher**, OBJECTID 102, contains that point. Using the cached piste snapshot associated with the same OpenSkiData ID, **219 of 223 piste records intersect** this planning polygon; 212 are wholly inside it. These are record counts, not distance/area-weighted coverage or proof of identical operational boundaries.

The map adds the reviewed search alias **Sölden**, while retaining **Ötztaler Gletscher** as the original source name. No geometry is changed. Metadata stores the matching point, source ID and piste-record audit. Other resort names are not automatically fuzzy-matched or renamed.

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

Source region labels, operating status, official websites and upstream source identifiers are exposed in the inspector. They are not converted into a regional resort census.

## Geographic context

Public-domain Natural Earth data, kept separate from the ODbL ski-area dataset:
- 1:10m admin-0 countries: https://naciscdn.org/naturalearth/10m/cultural/ne_10m_admin_0_countries.zip
- 1:50m populated places: https://naciscdn.org/naturalearth/50m/cultural/ne_50m_populated_places.zip
- Terms: https://www.naturalearthdata.com/about/terms-of-use/

Neighboring countries are clipped and simplified only for background rendering. Austria's separate outline and the supplied Vienna reference label provide geographic orientation. The background is not used to validate or clip resort polygons.

Optional street-map tiles come from OpenStreetMap with visible attribution:
https://operations.osmfoundation.org/policies/tiles/

No tiles are requested by default. No tile prefetching or offline tile download is implemented.

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

Source presence is categorical: teal for OpenSkiData outlines, violet for Tirol planning boundaries with their 2011 date explicit, not an unsupported choropleth. A separate orange highlight indicates selection, never resort quality or size. Opacity keeps overlaps visible; the caption explicitly warns that darker patches are not higher values.

The national overview is intentionally incomplete rather than inventing shapes for point records. Zoom and a searchable native select expose small or overlapping shapes. All 188 OpenSkiData polygons and 102 Tirol polygons remain available during inspection. The sources are delivered as separate datasets under their respective licenses.

## Geographic story callouts

Three editorial polygon groups orient the national overview: **St. Anton** (Rendl and both Albonagrat records), **Ötztal / Sölden** (Ötztaler Gletscher, Hochgurgl, Obergurgl and Stablein–Vent), and **Kitzbühel** (Hahnenkamm–Ehrenbachhöhe, Kitzbühler Horn, Bichlalm and Jochberg–Pass Thurn). These are selected clusters, **not a measured largest-resorts ranking or an exhaustive regional inventory**.

[Susie Lu’s d3-annotation](https://d3-annotation.susielu.com/) draws SVG `annotationCalloutCircle` callouts. `scripts/prepare-ski-annotations.py` verifies the reference names and derives a geographic bounding box from each reviewed group’s actual polygons. At runtime the box is projected through Leaflet; its midpoint and half-diagonal define an enclosing circle, with five pixels of visual padding. Circles are editorial highlights, not new boundaries, skiable-area measurements or inferred resort footprints. No guessed town coordinates are used. Reproduce with `uv run scripts/prepare-ski-annotations.py` after preparing the Tirol layer. The derived anchor file is CC BY 4.0, attributed to Land Tirol – tiris.

`annotations.js` recalculates circle centers and radii on movement, zoom, resize and source visibility changes. Notes disappear when their source is hidden or their center leaves the viewport. Matching buttons fit the whole group rather than zooming only its reference polygon; the inspector explicitly identifies that reference record. Shorter labels and wrapping are used on narrow maps. The visual SVG is hidden from screen readers and does not intercept map interactions; three matching native buttons and a prose map description provide equivalent keyboard-accessible exploration.

Vendored, version-pinned dependencies (no visitor-time CDN requests or new build step):
- D3 **4.13.0**, BSD-3-Clause, with its license in `assets/vendor/d3/LICENSE`.
- d3-svg-annotation **2.5.1**, Apache-2.0, with its license and provenance in `assets/vendor/d3-annotation/`.

## Accessibility and dependencies

Leaflet 1.9.4 is vendored with its BSD-2-Clause license. Native controls, labeled keyboard-searchable selection (including German ae/oe/ue spellings), textual coverage counts, a live selected-record panel, prose explanation and downloadable data supplement canvas rendering. Individual polygons are not keyboard-addressable; the selector is the equivalent inspection path. Source strings are rendered as text; external URLs are protocol-checked.

## Verification · 2026-11-03

- 14 ski-map tests passed, including exact geometry/source-name fidelity against both cached input downloads, valid geometries, separate IDs/licenses, the Sölden alias, its piste-record audit and all three annotation groups/source names and enclosing geographic bounds.
- Existing 10 home-distance and 7 water-data tests passed.
- Both JavaScript files passed `node --check`; site-resource and whitespace checks passed.
- Browser checks at 1440px, 390px and 320px: no horizontal overflow; source toggles, hidden-source activation, Sölden search/native selection, no-match/Escape behavior and overview reset checked. No browser errors in the final clean session.
- d3-annotation callouts checked at 1440px, 390px and 320px: no note collisions or clipping in the overview; geographic highlights follow actual drag/pan, labels update on zoom, hiding Tirol removes its notes, and the matching buttons activate the correct reference record. Circle-callout checks also verify three unfilled circle subjects, source visibility, whole-group zoom and no page overflow at 320px.
- Default map requests zero street-map tiles. Optional street-map context was checked separately.
- Axe WCAG 2 A/AA scan after popup transitions: no detected violations; contrast over map/canvas controls remains flagged for manual review. This is not a claim of full accessibility conformance.

To include input-fidelity checks:

```sh
uv run scripts/test-ski-polygons.py \
  --source /tmp/ski-areas.geojson \
  --tirol-source /tmp/tirol-ski-boundaries.geojson
```

AI assistance: source inspection, data preparation, implementation and checks.
