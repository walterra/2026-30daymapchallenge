# Day 02 — Austria’s engineered winter

Proof of concept for the Lines theme. This iteration maps Austrian downhill piste line segments and their recorded snowmaking attributes, not individual snow cannons.

## Sources and licenses

Downloaded on 2026-11-02 from:
- https://tiles.openskimap.org/geojson/ski_areas.geojson
- https://tiles.openskimap.org/geojson/runs.geojson

Documentation: https://openskidata.org/

Data attribution: OpenSkiData / OpenSkiMap.org, © OpenStreetMap contributors (ODbL), Skimap.org, Who's On First, © Mapterhorn.

The derived GeoJSON files in data/ are distributed under ODbL 1.0: https://opendatacommons.org/licenses/odbl/1-0/
They are publicly downloadable from the visualization. Preserve attribution and applicable share-alike obligations when redistributing.

Leaflet 1.9.4 is vendored in assets/vendor/leaflet; its BSD-2-Clause license is included. The map requests OpenStreetMap standard raster tiles for context and displays attribution. Tiles are not preloaded or downloaded for offline use. Tile usage policy: https://operations.osmfoundation.org/policies/tiles/. Reassess the provider before high-traffic publication.

## Reproduce

Download the two source files above (automated downloads at most once per day). They are global and large: the runs file is approximately 800 MB uncompressed; preparation also needs substantially more memory than the final static site.

From the repository root:

```sh
python3 scripts/prepare-ski-data.py /path/to/ski-areas.geojson /path/to/runs.geojson
python3 -m http.server 8000
```

Visit http://localhost:8000/maps/02-engineered-winter/.

The browser fetches only the reduced local snapshot, approximately 6 MB of piste data plus ski-area locations. No build step, API credentials, or live data query is required.

## Method

- Select features with Austrian membership in OpenSkiData's places field.
- Include only operating downhill ski areas and operating downhill LineString runs.
- Use the ski area's supplied viewport center as a location marker, not a verified resort entrance.
- Keep true, false, and null/missing snowmaking values distinct.
- Drop elevation and round coordinates to five decimal places (roughly meter-scale).
- Preserve piste names, supplied ski-area associations, and upstream source IDs.
- Do not merge segments or count them as unique trails.
- Exclude polygon pistes rather than representing their outlines as trail centerlines.
- Do not clip cross-border geometry; Austrian membership is not a promise that every vertex is inside Austria.

## Snapshot findings

375 ski-area locations; 11,002 piste line segments:
- 73 with snowmaking true
- 36 with snowmaking false
- 10,893 unknown (99.0%)

These are segment counts, not length-weighted coverage. The unknown share measures tagging incompleteness, not absence of snowmaking. This snapshot is unsuitable for ranking resorts by actual snowmaking capacity.

## Cannon-location limitation

Attempts to obtain Austrian man_made=snow_cannon features through Overpass returned an HTTP 406 or timed out. No cannon observations were fabricated or substituted. Add a separately documented fixed-cannon layer only after a successful download and coverage inspection. OSM does not generally map mobile cannons without a fixed position.

## Accessibility and dependencies

Layer switches and the resort selector provide keyboard-operable controls; Leaflet supports keyboard panning/zooming. A prose map description, totals, and downloadable data supplement the visual map. Individual canvas-rendered pistes are not keyboard-addressable; popups are supplemental, not the sole source of the map's main findings. External background tiles require a network connection; local piste layers do not depend on a tile API.

AI assistance was used for research, source inspection, data preparation, code, and verification.
