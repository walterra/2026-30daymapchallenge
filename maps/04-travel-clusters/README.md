# Day 4 — Shared destinations: geographic clustered bubbles

[Open the research PoC](index.html). Every reported individual-origin-country × destination pair is a bubble. All 5,321 reported pairs are available simultaneously; only the selected source country is accented. A checked-by-default “Exclude domestic stays (all origins)” control hides pairs whose origin and destination countries match. The map frame now runs from Madeira in the southwest to Trondheim in the north and Rēzekne in the east (longitude −17.9…28.3°, latitude 32…64.2°), with SVG padding. It contains 147 destinations. Netherlands starts with 97 foreign destinations in this frame; unchecking restores 103 framed destinations. Seven out-of-frame destinations are excluded from forces, anchors and ranking: Istanbul, Las Palmas, Oulu, Reykjavik, Santa Cruz de Tenerife, Tel Aviv and Tromsø. Their source records remain in the downloadable data. No destination-country colours are used.

## Data and reuse

- Source: [TourMIS](https://www.tourmis.info/), European Cities / CityDNA, **ECM-J8 — All markets versus all cities (arrivals or nights)**.
- Query: annual 2024, benchmark All, Bednights (preferred definition).
- Retrieved 2026-11-04 through the user's authenticated browser session.
- `data/tourmis-2024-raw.json`: rendered table cells, spans and definition legend; no credentials or authenticated URLs.
- `data/tourmis-2024.csv`: normalized/adapted extract, not an official export. It contains 154 destination columns × 74 market rows, including aggregates and residual groups (11,396 records).
- The map excludes continents, foreign/domestic totals and residual “Other” groups to avoid double counting. Only non-missing individual-country counts become bubbles. There are 144 reported zero counts; missing counts are never imputed.

[TourMIS terms, version 08.02.2021](https://www.tourmis.info/material/TourMIS_DSGVO_txe.pdf) permit accurate reproduction, distribution, public availability and processing with original-source attribution and an extraction/adaptation notice. These are custom terms, not a verified standard open-data licence. © MU Vienna and contributing statistical providers. Individual city-level provider attribution remains to be checked before treating this research PoC as publication-ready.

## Force layout

Reference studied: [D3 / Mike Bostock, Clustered Bubbles](https://observablehq.com/@d3/clustered-bubbles). The reference combines group attraction and collision. This implementation independently uses the existing local D3 v4 built-in forces; notebook source code is not copied.

- Each origin-country × destination record is one node.
- Its destination's projected coordinates are its fixed x/y attractor (`forceX` and `forceY`, strength 0.14), replacing the example's free-moving group centroid.
- Deterministic spiral seeds avoid coincident starting positions.
- `forceCollide` uses bubble radius + 0.35 map units, strength 1, two iterations.
- `scripts/prepare-travel-layouts.js` runs each layout for 320 ticks offline using the vendored D3, then writes `data/bubble-layouts.json`. Only included nodes participate in attraction and collision. The browser never runs forces.
- Collision displacement is diagrammatic, not a new geographic location. Selecting or hovering a bubble draws a line back to its actual city attractor.
- Source selection changes only highlighting, paint order and the selected-source ranked list. It never filters nodes, reruns the layout, rescales radii or colours destinations by country.
- All unselected origins have the same neutral grey fill.
- The domestic filter hides matching-country pairs across all origins, not just the selected one. It also filters the ranking and missing-count denominator. The two layouts are prepared separately: 5,205 framed pairs with domestic stays and 5,060 without. Excluded nodes occupy no collision space in the foreign-only layout. Toggling synchronously loads the corresponding saved positions without simulation or radius changes. Each entry uses stable city/market indices, with null positions for excluded pairs. Source and generator SHA-256 digests make stale artifacts detectable in tests. Regenerate after changing data, projection, frame, size scale or force configuration.

This replaces the earlier four-cluster visitor-profile view. The prepared `map-data.json` retains the earlier statistical profile fields for reproducibility, but the current renderer does not use them. Geographic bubble grouping is not a statistical tourism segmentation.

## Selected-source bundled connections

Decision: implement a small geographic hierarchy preparer and use the already-vendored `d3.curveBundle.beta(0.82)` renderer. No new library, build dependency or runtime force algorithm is added.

Research:
- [D3 hierarchical edge bundling](https://observablehq.com/@d3/hierarchical-edge-bundling): shared hierarchical control paths with a bundle curve. This is the closest pattern for one selected source; our geographic hierarchy is independently constructed rather than copied from the notebook.
- [d3.ForceBundle](https://github.com/upphiminn/d3.ForceBundle): geometric compatibility and iterative subdivision forces; repository licence verified as GPL-2.0 via GitHub API. Rejected to avoid an additional iterative algorithm and licence integration for this small single-source view.
- [flowmap.gl](https://flowmap.gl/docs/intro/): deck.gl/WebGL and automatic location clustering; repository licence verified as Apache-2.0. Useful for larger interactive flow applications, but unnecessarily large for this local SVG page. Location clustering is not the same as edge bundling.

`prepare-travel-origins.py` extracts GeoNames PPLC (capital/seat) records from the same CC BY 4.0 cities1000 extract used for destinations, choosing the most populous if several exist. `country-anchors.json` preserves names, IDs and coordinates. Israel explicitly uses Tel Aviv (GeoNames 293397) as a representative-city fallback because this extract has no IL-coded PPLC; this is not a capital designation. A representative country point is a schematic proxy, not an observed traveller departure city. The dataset records residence country only.

`prepare-travel-flows.js` prepares separate domestic-included and foreign-only connections for all 61 origin markets. Eligible targets are in-frame cities with positive reported counts; zero and missing values have no flow line. Each source's targets are partitioned into eight 45° direction sectors. Within sectors, recursive median splits along the longest projected axis create spatial branches, stopping at four targets or depth four. Shared hubs are 75% towards each group's unweighted centroid from the parent. The saved point chains start at the representative source and end at exact geographic city anchors, not displaced bubbles. The browser merely draws the selected source's point chains with D3's bundle curve. Line widths are uniform; overlapping branches appear darker, but branch darkness is not a quantitative volume scale.

Representative source points retain their original projected coordinates, including when outside the composition viewport. Bundles start there and are clipped to the actual visible SVG viewport, including the extra space introduced by uniform aspect-ratio fitting. A small ResizeObserver updates only the clipping rectangle and directional label positions; it never changes saved bubble or route coordinates. No source circle is substituted at the border. Only the country label moves to an inset edge location along the ray from the viewport centre towards the source; an arrow indicates that direction. Tooltips and explanatory copy qualify the representative point, not the whole country. Turkey and Ukraine can therefore be partially visible while their representative points (Ankara and Kyiv) remain outside. Offscreen classification uses the effective visible viewport in saved-coordinate units, not merely the canonical 1,000 × 850 composition or geographic destination-eligibility bounds. A source revealed in extra letterboxed space is shown at its true location rather than incorrectly labelled as outside. All connection geometry is schematic and may cross land, sea or other lines: it must not be interpreted as observed routes, roads, flights or travel corridors.

The flow toggle changes only connections, not bubbles. Source selection changes the displayed connections and source label; the domestic filter switches the matching saved bundle. Bubble/table selection emphasizes the corresponding connection. Data, bubble-layout, representative-anchor and flow-generator SHA-256 hashes are recorded for freshness tests. Regenerate flows after regenerating bubble layouts or changing representative points or branching parameters.

## Bubble size and interaction

Radius is `max(0.65, 15 × sqrt(person-nights / global maximum))` in a canonical 1,000 × 850 SVG composition. Above the minimum, circle area is proportional to bednights. Tiny counts and reported zeros use a visibility floor, explicitly disclosed on the page; they are not area-proportional. The global scale is unchanged across origins. On desktop, map and table share a height of `min(760px, 84dvh)`, independent of header space or scroll position. Scrolling down to this section is normal; the ranking then scrolls internally within its fixed-height panel. The canonical viewBox scales uniformly with `preserveAspectRatio="xMidYMid meet"`; map geometry, radii, anchors and leader lines stay aligned, without repacking on resize. Different aspect ratios can leave unused space around the composition. Narrow layouts stack the panels.

Bubble hover/click displays the source, destination, count and reporting definition. The origin selector and ranked destination buttons provide keyboard-accessible equivalents. Neutral circles remain inspectable, even when they belong to another source. The SVG has a text description; explanatory copy, missing-data counts and downloadable data remain available.

## Geocoding and basemap

Coordinates: [GeoNames cities1000](https://download.geonames.org/export/dump/cities1000.zip), retrieved 2026-11-04, [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/), verified in its [readme](https://download.geonames.org/export/dump/readme.txt). The full gazetteer is not committed.

The preparation script matches normalized primary/alternate names within the map extent, with explicit ambiguity overrides. All 154 output name/country/place combinations were reviewed. Bruges, Cologne, Bienne, Porto and other ambiguous names have reviewed overrides; GeoNames IDs are retained. Madeira uses Funchal and Haarlemmermeer uses Hoofddorp as representative points rather than exact reporting-area centroids.

Land: Natural Earth 1:10m, [public domain](https://www.naturalearthdata.com/about/terms-of-use/), clipped to include northern Europe and simplified by 0.015 degrees with preserved topology. No political borders are drawn. The map uses a Europe-centred Lambert azimuthal equal-area projection, centred at 10°E, 49°N, implemented with D3’s spherical `geoAzimuthalEqualArea`. This reduces northern area exaggeration compared with Mercator. It is not an exact ellipsoidal EPSG:3035 transformation. Projection fitting uses the projected footprint of all 147 eligible destination points, rather than the empty corners of their geographic bounding box. This is approximately 28% closer than the previous fit, while retaining all destinations, including Madeira, Trondheim and Rēzekne. Eligibility bounds are unchanged; 30 canonical units of padding leave space for bubble groups. Neither displaced bubble centres nor bubble areas describe geographic extents.

## Interpretation limits

- Bednights are person-nights, not unique travellers or trips.
- Domestic travel is available but hidden by default. Unchecking the filter includes Dutch residents staying in Dutch destinations.
- This is a selected reporting-destination dataset, not a complete European destination ranking. The source extract includes Madeira and Tel Aviv; Tel Aviv is outside the current frame.
- Reporting areas can overlap; do not sum them to estimate total European travel.
- Preferred definitions mix accommodation coverage and geographic scope:
  - NG: hotels and similar establishments, city area.
  - NGS: hotels and similar establishments, greater city area.
  - NA: all paid accommodation, city area.
  - NAS: all paid accommodation, greater city area.
  - NZS: all accommodation including friends/relatives, greater city area.
- Missing counts are unknown, not zero. The selected-source status explicitly reports them.
- Dense neighbouring city groups can merge or spill away from their attractors; leader lines expose their actual anchors.

## Reproduce

From the repository root:

```sh
python3 scripts/prepare-tourmis.py maps/04-travel-clusters/data/tourmis-2024-raw.json maps/04-travel-clusters/data/tourmis-2024.csv
curl -fL https://download.geonames.org/export/dump/cities1000.zip -o /tmp/tourmis-cities1000.zip
python3 scripts/prepare-travel-clusters.py /tmp/tourmis-cities1000.zip
curl -fL https://naciscdn.org/naturalearth/10m/physical/ne_10m_land.zip -o /tmp/ne_10m_land.zip
uv run scripts/prepare-travel-land.py /tmp/ne_10m_land.zip
python3 scripts/test-travel-clusters.py
node scripts/prepare-travel-layouts.js
python3 scripts/prepare-travel-origins.py /tmp/tourmis-cities1000.zip
node scripts/prepare-travel-flows.js
node --test scripts/test-travel-layouts.js scripts/test-travel-flows.js
node --check maps/04-travel-clusters/map.js
python3 scripts/check-site.py
python3 -m http.server 8044 --bind 127.0.0.1
```

Open `/maps/04-travel-clusters/`, wait for “Saved layout”, then run the browser regression script:

```sh
agent-browser eval --stdin < scripts/check-travel-bubbles.js
agent-browser eval --stdin < scripts/check-travel-flows.js
```

Runtime dependencies: local D3 v4.13.0 (BSD-3-Clause; `assets/vendor/d3/LICENSE`) and shared theme files. No build step, credentials, remote API, tiles or external runtime requests. Force-layout preparation uses Node.js and the existing vendored D3; no packages need installing. Other preparation uses Python; basemap preparation uses pinned pyshp and Shapely via uv.

## Animated GIF export

[Download the looping country tour](exports/country-tour.gif): 61 countries in alphabetical order, 1.2 seconds per country, 73.2 seconds per loop, 1280 × 771 pixels, approximately 2.7 MB. Domestic stays are excluded and bundled connections enabled. Each frame includes the country, progress, a selected-source ranking, attribution and the schematic-route qualification. There are no interactive controls or hover instructions in the export.

With the preview server running, reproduce using the installed `agent-browser` CLI and `ffmpeg`:

```sh
python3 scripts/export-travel-gif.py
# Optional: --url http://localhost:8000/maps/04-travel-clusters/ --output /tmp/country-tour.gif
```

The script uses a separate isolated browser session, renders a temporary export-only wrapper, captures one frame per country, creates a shared 128-colour palette and an infinitely looping GIF, then closes the export browser. Production map geometry is not modified. Temporary PNG frames are deleted after encoding. The original interactive browser session is untouched.

Export checks performed: ffprobe confirmed 61 frames, 1280 × 771 dimensions and 73.2-second duration. The GIF application extension confirms infinite looping; an extracted Netherlands frame was visually reviewed during export development.

## Assistance and checks

Substantial AI assistance: authenticated data extraction, normalization, geocoding, clustering experiments, map code, documentation and checks. Travel counts are real reported values, not illustrative observations. Force displacement is purely visual.

Checks performed on the saved-layout revision: four Node tests passed (source/generator freshness, exact coordinate reproduction, stable keys and mode coverage, absence of runtime force/resize simulation). Five Python dataset tests, JavaScript syntax, site/link checks and `git diff --check` passed. Headed-browser interaction regression passed for source highlighting, both filter modes, inspection and matching panel heights. Resizing from 1280×900 to 375×812 retained identical saved coordinates and radii with no horizontal overflow; console produced no messages. Earlier axe checks found zero violations with an incomplete contrast review; no claim of complete accessibility conformance. Bundled-flow revision checks: eight combined Node tests passed, including exact flow regeneration, source/layout freshness, eligible positive-edge coverage, fixed endpoints and shared branches. Browser flow checks passed for Netherlands, United States and Germany in both domestic modes, directional edge labels for outside source points, and the connections toggle. Narrow 375×812 layout had no horizontal overflow; the console produced no messages. JavaScript syntax, site/link checks and diff whitespace checks passed. Original-provider attribution and cross-city comparability remain publication gates.
