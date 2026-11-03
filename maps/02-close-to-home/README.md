# Day 02 · Lines — Closer than it felt

A personal distance-perception story, supplied by the author: when Russia launched its full-scale invasion of Ukraine in 2022, the author was in Lisboa and Kyiv felt far away. This map compares both cities from the same reference point, Kössen, rather than confusing that experience with a Lisboa–Kyiv measurement.

## Verified calculation

| Destination from Kössen | WGS84 geodesic | Display |
| --- | ---: | ---: |
| Lisboa | 2,002.934227 km | 2,003 km |
| Kyiv | 1,356.104530 km | 1,356 km |

Difference: **646.829697 km**, displayed as **647 km**.

Computed with pyproj 3.7.2, Geod(ellps='WGS84').inv, using the longitude/latitude reference coordinates in data/locations.json. The displayed extra decimals describe arithmetic for those coordinates, not positional or survey accuracy.

These are shortest ellipsoidal surface distances, not road distances, actual flights, chords through the Earth, or distances from the author's home address. No home address was supplied, geocoded or inferred.

Coordinate sources, checked 2026-11-02:
- Kössen: https://geloky.com/geocoding/place/K%C3%B6ssen+Austria
- Lisboa: https://www.latlong.net/place/lisbon-portugal-804.html
- Kyiv: https://www.latlong.net/place/kyiv-ukraine-27597.html

## Why the lines have these lengths

The map uses an **ellipsoidal azimuthal equidistant projection centered exactly on the Kössen reference point**. A uniform screen scale preserves the length ratio and directions of the two geodesics from that origin. It is not a Mercator map with misleading straight screen-line lengths.

Each route includes 63 intermediate geodesic points. Preparation verifies:
- Sum of geodesic segment lengths equals the inverse-geodesic distance to within 1 cm.
- Projected radial distance equals that distance to within 1 cm.

Geodesics from the projection origin appear straight; the two lines are not diagrammatic curves or invented routes.

## Basemap and licensing

Natural Earth 1:10m physical land:
https://naciscdn.org/naturalearth/10m/physical/ne_10m_land.zip

License: public domain, verified at https://www.naturalearthdata.com/about/terms-of-use/.

Land is clipped to the European context and projected for the SVG. The 1:10m source replaces the coarser 1:110m shoreline; no additional geometric simplification is applied. Coastlines are still cartographically generalized; no internal political boundaries or territorial claims are drawn. Context country labels are geographic orientation, not extra measurements.

## Reproduce

From the repository root:

```sh
curl -L --fail https://naciscdn.org/naturalearth/10m/physical/ne_10m_land.zip -o /tmp/ne_10m_land.zip
uv run scripts/prepare-home-distances.py --land-zip /tmp/ne_10m_land.zip
uv run scripts/test-home-distances.py
python3 scripts/check-site.py
python3 -m http.server 8042 --bind 127.0.0.1
```

Open http://127.0.0.1:8042/maps/02-close-to-home/.

Only preparation requires Python/uv. The published page is HTML, CSS and SVG: no JavaScript, external tile server, API request, tracking, runtime library or build step.

## Design and accessibility

Datawrapper-inspired editorial styling: a message-led title, quiet land background, two directly labeled lines, consistent colors, prominent values, and visible source/method qualifications. No embedding or dependency on Datawrapper.

Desktop and mobile SVGs use the same geographic scale and framing; only annotation sizes differ. Preparation updates both image URLs with a SHA-256 content-version query so browsers request regenerated artwork rather than retaining an older shoreline. Regression tests check both the page URLs and detailed coastline geometry. The mobile version keeps labels readable rather than merely shrinking desktop text. Textual comparison and image alternative text expose the findings without relying on color, hover or interactive controls.

The personal narrative is the author's account, not an inferred psychological measurement. AI assistance: editing the supplied story, calculations, basemap processing, code and checks.

The Tirol snowmaking prototype remains separately preserved for a future challenge day.
