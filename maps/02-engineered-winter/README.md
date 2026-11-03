# Research draft — Where the snow begins

Saved for a future challenge day. Day 02 is now [Closer than it felt](../02-close-to-home/). The original directory name is retained to preserve existing links.

Tirol-wide snowmaking-water infrastructure from the public Wasserbuch and official GIS. Expanded from the individually inspected Sölden case study; replaces the original sparse piste-snowmaking map.

## Verified snapshot — 2026-11-02

All nine Tirol district searches completed for **Nutzwasser für Beschneiungsanlagen**, status **<alle aktiven>**, with enclosing **Topanlage** reports and their child trees.

- 249 search rows, resolving to 149 distinct enclosing reports.
- 1,140 unique facility IDs across those reports.
- 704 ID-matched official GIS locations: 553 point geometries and 151 reservoir polygon centroids (including three non-snowmaking reservoir types shown as other facilities).
- 148 mapped facilities classified explicitly as Beschneiungsteich; 129 have an unambiguous usable-volume attribute, 19 do not.
- 426 documented parent–child associations with both endpoints mapped.
- 436 records excluded from the map because no unique geometry match was available in the two queried official GIS layers.
- 8 parent-name references could not be resolved unambiguously; no speculative links are drawn.
- Extracted statuses: 1,115 besteht and 25 projektiert. Child records retain their own status; the active search filter is not an assertion that every descendant is operating.

| District query | Search rows | Distinct reports | Unique facilities | Mapped | Snowmaking reservoirs |
| --- | ---: | ---: | ---: | ---: | ---: |
| Imst | 22 | 19 | 129 | 90 | 17 |
| Innsbruck-Land | 40 | 23 | 119 | 71 | 16 |
| Innsbruck-Stadt | 1 | 1 | 1 | 0 | 0 |
| Kitzbühel | 40 | 21 | 220 | 132 | 36 |
| Kufstein | 20 | 14 | 128 | 79 | 24 |
| Landeck | 31 | 16 | 146 | 100 | 17 |
| Lienz | 35 | 22 | 105 | 63 | 10 |
| Reutte | 26 | 19 | 121 | 59 | 13 |
| Schwaz | 34 | 17 | 207 | 141 | 27 |

Facilities/reports shared across districts occur in multiple rows. Do not sum district rows into unique Tirol totals. District membership is the query/report association, not an independent point-in-boundary classification.

Innsbruck-Stadt has a returned Patscherkofel system report but no geometry match in the layers used here. The UI retains the report and shows zero mapped facilities; zero is not evidence that infrastructure is absent.

## Sources actually queried

Register search:
https://wis.tirol.gv.at/wisSrvPublic/wis/wbo_wb_search.aspx

Example system, postzahl 2/1160:
https://wis.tirol.gv.at/wisSrvPublic/wis/wbo_wb_auszug.aspx?ATTR=Y&TREE=Y&PICTURE=N&ANL_ID=T20571970R3&GIS=WWW_GIS_URL

Official queryable GIS service:
https://gis.tirol.gv.at/arcgis/rest/services/Service_Public/ogd_wasser/MapServer

Layers used:
- 28: Alle Wasserinformationen (Übersicht), point geometry.
- 14: Speicher, polygon geometry.

Only facility IDs already discovered in the WIS extraction are queried, in batches of 100. No geographic proximity join is used. Backend errors, unexpected CRS and truncated GIS results fail the extraction.

## Coordinate evaluation

The HTML reports give Rechtswert/Hochwert without a per-row CRS label. Applying the Sölden EPSG:31254 assumption throughout Tirol incorrectly shifts eastern facilities westward. Cross-checking by ID against the GIS exposed **369 records consistent with EPSG:31254 and 335 with EPSG:31255** among the mapped facilities.

The map therefore does NOT guess a meridian from a coordinate sign or district name. It uses official GIS geometries requested explicitly in EPSG:31254, then converts them to EPSG:4326 with pyproj 3.7.2:
- Point features use their official point location.
- Reservoir polygons use a signed-area centroid, respecting ring orientation. A centroid is a symbol anchor, not an entrance or actual pipe connection, and need not be inside a concave polygon.
- WIS raw coordinates are preserved for audit. Both candidate meridians are compared to the matched GIS anchor; a close match is recorded, not used to silently overwrite official geometry.
- No unmatched record is given a guessed location. Query coverage is not a complete equipment census.

Examples verified in the output:
- Panorama reservoir: approximately 10.936 E, 46.919 N; usable volume 416,500 m³; western meridian.
- Mittermoos UV facility: approximately 12.112 E, 47.436 N; central meridian. The western-meridian assumption would place it near 9.113 E, outside Tirol.

## Extraction and files

- `tirol-source.json`: selected factual record fields, attributes, district/report associations, SHA-256 hashes of the retrieved HTML reports.
- `gis-source.json`: matching official GIS IDs and geometries, native CRS and layer provenance.
- `tirol-outline.geojson`: generalized official province boundary for geographic context and the zoom inset. Source: https://gis.tirol.gv.at/arcgis/rest/services/Service_Public/ogd_basis/MapServer/42; rounded to four decimal places. Not a survey-grade boundary.
- `water.geojson`: map-ready points and schematic associations; coverage metadata and report selector data.
- `coverage.json`: district coverage, status/coordinate audit and the full list of unmapped records.
- `water-source.json`: the original manually reviewed Sölden transcription, retained as a regression reference, not the Tirol-wide map input.

Raw HTML stays in an external cache, not in this repository, because it includes unnecessary personal/contact and permit text. Only facility names, IDs, types, statuses, attributes and hierarchy/provenance are exported; personal address tables and full permit narratives are not copied.

The scraper is sequential, pauses at least 0.4 seconds between requests, caches responses, reuses already-seen enclosing reports, checks page counts, deduplicates by ID and fails on conflicting repeated coordinates, types, statuses, attributes or resolved parents. Current district searches each fit within 50 rows; pagination support is present but was not exercised by this snapshot.

Parent names are resolved only to a unique exact name (or exact name followed by the enclosing-system suffix) within the report. Unresolved/ambiguous names stay unresolved. Lines are emitted only when both endpoint IDs have verified positions.

## Reproduce

Prepare dependencies are managed by uv; the published site has no build step or Python dependency.

```sh
uv run scripts/fetch-tirol-water.py --cache /tmp/wis-tirol-cache
uv run scripts/fetch-water-geometry.py --cache /tmp/wis-tirol-cache
uv run scripts/prepare-water-data.py
uv run scripts/test-water-data.py
python3 scripts/check-site.py
node --check assets/searchable-select.js
node --check maps/02-engineered-winter/map.js
python3 -m http.server 8000
```

Open http://localhost:8000/maps/02-engineered-winter/.

To perform a deliberate fresh extraction, use a new external cache directory. Do not repeatedly hammer the register. Visitors download only a local map snapshot (approximately 650 KB) and generalized boundary (approximately 15 KB); no live WIS or GIS queries run in the browser. The default view makes no external tile requests.

## Visual and interaction semantics

- Cyan circles: explicitly classified snowmaking reservoirs. Circle AREA scales with positive recorded usable volume on a fixed Tirol-wide scale, even after filtering.
- Hollow cyan symbols: usable volume unknown/nonpositive. Their nominal size is categorical, not a storage estimate.
- Orange/ochre points: intakes and other associated facilities, hidden by default to make reservoir storage the primary encoding. The current matched layers do not supply point anchors for the top-level snowmaking systems.
- Dashed straight lines: documented parent–child associations, not pipeline routes, actual pipe lengths or flow direction. They appear from zoom level 11 when enabled; overview-level lines would be misleadingly dense.
- Associated trees can contain non-snowmaking water facilities; membership is not proof of an exclusive snowmaking purpose.
- Select district, then system, then facility. All lists with 10+ choices expose a labeled, accent-insensitive search input and match count. Smaller lists remain native selects. Escape clears search. The native select remains keyboard-operable.
- The selected-record panel exposes original attribute labels/units and official source links. The system selector retains reports even if no facilities have verified geometry.
- A numeric circle-size legend uses the same square-root radius function as map symbols: 10,000, 100,000 and 400,000 m³. The largest symbol radius is 28 px on desktop and 16 px on narrow screens; legend and symbols resize together. The scale does not renormalize after filtering.
- The tile-free default uses a muted Tirol boundary, explicit North/East Tirol labels and a cropped regional frame. An optional street-map layer provides detail; a boundary-only inset preserves orientation when zoomed in.
- “Explore Sölden” opens the previously verified case study with secondary facilities, schematic associations and the detailed street map enabled. “All Tirol” resets the geographic filters and returns to the tile-free, reservoir-first overview. No observations are clustered, summed or displaced to reduce overlap.

## Design references and application

The design applies Datawrapper guidance rather than embedding the commercial service:

- [How to create a symbol map](https://www.datawrapper.de/academy/how-to-create-a-symbol-map): use location-based symbols, balance maximum symbol size against overlap, use transparency/outlines, provide an explicit size legend, add useful tooltips/annotations, and test narrow screens.
- [Cropped view and inset maps](https://www.datawrapper.de/blog/cropped-view-inset-maps): frame the region with data while retaining geographic orientation at closer zoom levels.

Implemented as a lighter editorial layout with restrained background detail, smaller translucent reservoir symbols, progressive disclosure of secondary layers, consistent quantitative legends, and a local context inset. Overlap is acknowledged rather than converted into an unsupported aggregate. Labels and source/coverage explanations do not depend solely on hover.

## Interpretation hazards

- Rates, annual limits, fractional flows, seasonal permissions and one-time first-fill rights cannot be added into measured consumption.
- Parent reports repeat child rights; summing both double-counts permissions.
- A reservoir's total volume and usable volume are different measures. Tiefenbachferner's narrative says 9,000 m³ total but the usable-volume attribute is 7,000 m³; only the latter is used for size.
- The Sölden record says besteht and also includes permit deadlines ending in 2025. Current legal validity and actual operation are not independently validated.
- There are no observed cannon counts, real pipe routes, actual water-use measurements, live snow production or derived environmental-impact figures in this map.

## Attribution, reuse and runtime dependencies

Data: Land Tirol, Wasserbuch / WIS and official ogd_wasser GIS service. Context: Land Tirol, official ogd_basis generalized province boundary (layer 42).

Public inspection and a queryable OGD-named service do not, by themselves, establish the applicable bulk-data redistribution license. Reuse clearance remains unresolved. This is a research prototype, not a cleared open-data release. Do not attach the previous OpenSkiData/ODbL license to these records. No deployment or push is performed as part of this update.

Leaflet 1.9.4 is vendored with its BSD-2-Clause license. OpenStreetMap raster tiles provide optional detailed context; they are off initially, with attribution shown when enabled. Respect https://operations.osmfoundation.org/policies/tiles/; no tile prefetching or offline download is implemented.

Accessibility: native selects, labeled search/layer controls, a selected-record text panel, prose map description, coverage table and downloadable data supplement the visual map. Source strings are rendered with textContent. Canvas points are not individually keyboard-addressable; facility selection provides an alternative.

AI assistance: source inspection, extraction, coordinate audit, transformation, implementation and checks.
