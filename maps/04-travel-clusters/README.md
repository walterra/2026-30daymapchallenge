# Day 4 — Travel clusters (data preparation)

[Shared destinations](index.html) is a working research PoC: a local SVG map and ranked list with origin, outbound-only and complete-profile filters. It is linked in the gallery's research section, not presented as publication-ready.

## Source and retrieval

- Source: [TourMIS](https://www.tourmis.info/), European Cities / CityDNA statistics; original city-level statistical providers are not individually identified in this extract and attribution must be checked before publication.
- Report: **ECM-J8 — All markets versus all cities (arrivals or nights)**.
- Settings: annual 2024, benchmark All, Bednights (preferred definition).
- Retrieved: 2026-11-04 using the user's authenticated browser session.
- `data/tourmis-2024-raw.json` contains the rendered table cells, spans and definition legend, not credentials or authenticated URLs.
- `data/tourmis-2024.csv` is a normalized/adapted extract, not an official TourMIS export.

[TourMIS terms, version 08.02.2021](https://www.tourmis.info/material/TourMIS_DSGVO_txe.pdf) permit accurate reproduction, distribution, public availability and processing with original-source attribution and an extraction/adaptation notice. These are custom terms, not a verified standard open-data licence. Check the current terms and original-source attribution before publishing the map.

## Preparation

```sh
python3 scripts/prepare-tourmis.py \
  maps/04-travel-clusters/data/tourmis-2024-raw.json \
  maps/04-travel-clusters/data/tourmis-2024.csv
```

Python standard library only. The script validates destination headers and row widths, removes number-grouping commas, and preserves missing numeric values as empty fields. It retains year-on-year changes separately from absolute bednight counts.

The extract contains 154 destination columns and 74 market rows, including countries, residual groups and aggregates. Netherlands has non-missing counts for 105 destinations. Aggregate and residual rows are explicitly classified; do not sum them alongside individual countries.

## Interpretation and outstanding work

- Bednights are person-nights, not unique travellers or trips.
- Preferred definitions differ by destination:
  - NG: hotels and similar establishments, city area.
  - NGS: hotels and similar establishments, greater city area.
  - NA: all paid accommodation, city area.
  - NAS: all paid accommodation, greater city area.
  - NZS: all accommodation including visits to friends and relatives, greater city area.
- Missing values are unknown, not zero. Do not rank cities with missing counts as unvisited.
- Domestic travel is present: Netherlands-market counts include Dutch cities. Add destination countries before offering an outbound-only view.
- Greater-city and city-area destinations may overlap. This is not a complete, mutually exclusive inventory of European destinations.
- Add coordinates and destination countries, inspect reporting coverage, check original provider attribution, and decide consistent-definition versus mixed-definition presentation before mapping or clustering.
- Automated browser extraction, normalization script and documentation received substantial AI assistance. No illustrative travel counts were introduced.

## Map preparation and dependencies

Coordinates use the [GeoNames cities1000 extract](https://download.geonames.org/export/dump/cities1000.zip), retrieved 2026-11-04, licensed [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/), verified in its [readme](https://download.geonames.org/export/dump/readme.txt). The full gazetteer is not committed. `scripts/prepare-travel-clusters.py` matches normalized primary/alternate names within the map extent, with explicit ambiguity overrides. All 154 output name/country/place combinations were reviewed; Bruges and Cologne required corrections, alongside Bienne, Porto and other ambiguous aliases. GeoNames IDs are retained in `map-data.json`. Madeira and Haarlemmermeer use Funchal and Hoofddorp as representative points rather than claiming city-boundary accuracy.

```sh
curl -fL https://download.geonames.org/export/dump/cities1000.zip -o /tmp/tourmis-cities1000.zip
python3 scripts/prepare-travel-clusters.py /tmp/tourmis-cities1000.zip
curl -fL https://naciscdn.org/naturalearth/10m/physical/ne_10m_land.zip -o /tmp/ne_10m_land.zip
uv run scripts/prepare-travel-land.py /tmp/ne_10m_land.zip
python3 scripts/test-travel-clusters.py
node --check maps/04-travel-clusters/map.js
python3 scripts/check-site.py
```

Clustering uses eight markets with comparatively broad coverage: Netherlands, Germany, United Kingdom, France, Italy, Spain, United States and China. Only 103 destinations with all eight non-missing counts and a positive sum qualify. Shares are normalized within those eight markets, square-root transformed (Hellinger space), and clustered using four-means with deterministic farthest-first initialization, at most 100 iterations. Cluster summaries are unweighted means of destination shares; two clusters can have the same leading markets despite different full profiles. Names include cluster numbers to distinguish them. Four is an exploratory choice, not a statistically validated optimum. Domestic stays are included in these fixed profiles, so domestic tourism can strongly influence clusters. The outbound filter changes circle/ranking eligibility, not the profiles.

Circle area is proportional to the selected origin's bednights, rescaled per selection. True zero counts remain in the ranked list but produce zero-radius circles; missing values are excluded and counted separately. Grey destinations lack a complete clustering profile. The rank/list buttons provide keyboard-accessible equivalents to circle selection. On-screen circle colours are supplemented by cluster numbers in the list and textual details.

The basemap is Natural Earth public-domain land, clipped to the full map extent and simplified by 0.015 degrees with preserved topology. It deliberately shows no political borders. Runtime dependencies are local D3 v4.13.0 (BSD-3-Clause; see `assets/vendor/d3/LICENSE`) and the shared theme files. There are no external runtime requests, tile servers, credentials or backend. Preparation alone uses Python; basemap preparation uses pinned pyshp and Shapely through uv. The browser needs no build step.

## Checks performed

- Five standard-library data regression tests passed: reproducible CSV, coverage/counts, reviewed geocodes, cluster summaries, and CSV/map fidelity.
- Normalization: 11,396 destination-market records; Netherlands coverage: 105 destinations, of which 99 are foreign destinations.
- JavaScript syntax and repository site/link checks passed.
- Headed browser: origin change, both filters, ranking selection and default restoration passed.
- Desktop 1280×900 and narrow 375×812 layouts checked for horizontal overflow; none detected. Desktop screenshot reviewed; map description present.
- Browser console produced no messages in the tested session.
- Desktop axe: zero violations; colour contrast review incomplete for overlapping SVG labels and offscreen ranking items. This is not a claim of full accessibility conformance.
- Individual-provider attribution and cross-city comparability remain publication gates.
