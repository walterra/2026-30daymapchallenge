# Day 4 — Travel clusters (data preparation)

Map implementation is pending. This directory is not yet a completed entry.

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

## Checks performed

- Normalization executed successfully: 11,396 destination-market records.
- Netherlands non-missing coverage counted: 105 destinations.
- No map, responsive-layout, accessibility or console checks yet; no map exists.
