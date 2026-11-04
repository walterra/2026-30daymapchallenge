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
- Each layout runs 320 ticks, in batches of eight per animation frame, then freezes. Only visible nodes participate in attraction and collision.
- Collision displacement is diagrammatic, not a new geographic location. Selecting or hovering a bubble draws a line back to its actual city attractor.
- Source selection changes only highlighting, paint order and the selected-source ranked list. It never filters nodes, reruns the layout, rescales radii or colours destinations by country.
- All unselected origins have the same neutral grey fill.
- The domestic filter hides matching-country pairs across all origins, not just the selected one. It also filters the ranking and missing-count denominator. Changing the filter rebuilds the simulation using only visible nodes, releasing excluded bubbles’ collision space. Deterministic seeds are restored and obsolete animation batches are cancelled. Toggling repacks the remaining bubbles without rescaling radii; changing the source alone still preserves positions.

This replaces the earlier four-cluster visitor-profile view. The prepared `map-data.json` retains the earlier statistical profile fields for reproducibility, but the current renderer does not use them. Geographic bubble grouping is not a statistical tourism segmentation.

## Bubble size and interaction

Radius is `max(0.65, 15 × sqrt(person-nights / global maximum))` in a fixed 1,000 × 1,000 SVG viewBox. Above the minimum, circle area is proportional to bednights. Tiny counts and reported zeros use a visibility floor, explicitly disclosed on the page; they are not area-proportional. The global scale is unchanged across origins.

Bubble hover/click displays the source, destination, count and reporting definition. The origin selector and ranked destination buttons provide keyboard-accessible equivalents. Neutral circles remain inspectable, even when they belong to another source. The SVG has a text description; explanatory copy, missing-data counts and downloadable data remain available.

## Geocoding and basemap

Coordinates: [GeoNames cities1000](https://download.geonames.org/export/dump/cities1000.zip), retrieved 2026-11-04, [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/), verified in its [readme](https://download.geonames.org/export/dump/readme.txt). The full gazetteer is not committed.

The preparation script matches normalized primary/alternate names within the map extent, with explicit ambiguity overrides. All 154 output name/country/place combinations were reviewed. Bruges, Cologne, Bienne, Porto and other ambiguous names have reviewed overrides; GeoNames IDs are retained. Madeira uses Funchal and Haarlemmermeer uses Hoofddorp as representative points rather than exact reporting-area centroids.

Land: Natural Earth 1:10m, [public domain](https://www.naturalearthdata.com/about/terms-of-use/), clipped to include northern Europe and simplified by 0.015 degrees with preserved topology. No political borders are drawn. The map uses a Europe-centred Lambert azimuthal equal-area projection, centred at 10°E, 49°N, implemented with D3’s spherical `geoAzimuthalEqualArea`. This reduces northern area exaggeration compared with Mercator. It is not an exact ellipsoidal EPSG:3035 transformation. All four geographic frame edges are sampled before fitting, so projection curvature is accounted for. Neither displaced bubble centres nor bubble areas describe geographic extents.

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
node --check maps/04-travel-clusters/map.js
python3 scripts/check-site.py
python3 -m http.server 8044 --bind 127.0.0.1
```

Open `/maps/04-travel-clusters/`, wait for “Layout settled”, then run the browser regression script:

```sh
agent-browser eval --stdin < scripts/check-travel-bubbles.js
```

Runtime dependencies: local D3 v4.13.0 (BSD-3-Clause; `assets/vendor/d3/LICENSE`) and shared theme files. No build step, credentials, remote API, tiles or external runtime requests. Preparation uses Python; basemap preparation uses pinned pyshp and Shapely via uv.

## Assistance and checks

Substantial AI assistance: authenticated data extraction, normalization, geocoding, clustering experiments, map code, documentation and checks. Travel counts are real reported values, not illustrative observations. Force displacement is purely visual.

Checks performed on this revision: five standard-library dataset regression tests passed; JavaScript syntax, site/link checks and `git diff --check` passed. Headed-browser force-layout regression passed for all 5,321 pairs, 144 zero markers, source-only highlighting, unchanged positions/radii across Germany/China/Netherlands selections, finite geometry and anchor inspection. Maximum observed bubble displacement in the tested layout: 31 SVG map units. Desktop 1280×900 screenshot reviewed; narrow 375×812 layout had no horizontal overflow and retained all bubbles. Narrow axe audit: zero violations, one incomplete contrast review; no claim of complete accessibility conformance. Browser console produced no messages. Original-provider attribution and cross-city comparability remain publication gates.
