# 2026 #30DayMapChallenge

A lightweight collection of map visualizations for the [2026 #30DayMapChallenge](https://30daymapchallenge.com/2026/), published as a static website on GitHub Pages.

## Scope

- Build simple, browser-based maps with HTML, CSS, and JavaScript.
- Publish each completed entry from `maps/<day>-<slug>/index.html`.
- Link completed entries from the root gallery.
- Keep the site usable on mobile and desktop.
- Credit data sources and document how each map was made.
- No backend, accounts, database, or required build step.
- Prefer small local datasets and minimal dependencies. Never publish secrets.

Map subjects, datasets, and rendering libraries remain undecided. Choose them per entry rather than adding a framework in advance. Completing all 30 days is optional.

## Structure

```text
index.html                  Entry gallery
assets/style.css            Gallery layout
assets/theme.css            Shared Cactus-inspired visual styling
assets/theme.js             Optional native light/dark toggle
maps/                       One directory per completed entry
```

Each entry should include its day and theme, a short explanation, an accessible description of the visualization, data attribution and licensing, and a link back to the gallery. Record any substantial AI assistance.

## Local preview

From this directory:

```sh
python3 -m http.server 8000
```

Open http://localhost:8000. No package installation is required.

## Visual theme

The gallery and all map-page interfaces share the visual language of the Cactus-based site in `~/dev/walterra-dev-main/`: its exact light/dark color tokens, system monospace font stack, compact headings, accent navigation, underlined links and dashed separators. Reference files: `src/styles/global.css`, `src/layouts/Base.astro` and `src/components/layout/Header.astro` in that repository.

Only the needed styling is adapted into plain `assets/theme.css`. There is **no Astro, Tailwind, Cactus package, build step, remote font or analytics dependency**. The upstream MIT notice is preserved in [assets/theme.LICENSE.txt](assets/theme.LICENSE.txt). The reference website is not modified.

`assets/theme.js` selects the system theme before rendering and provides an accessible light/dark button. A manual choice is saved under `map-challenge-theme` and retained across challenge pages. Blocked storage is handled without breaking the site; without JavaScript, CSS follows the system preference and the toggle remains hidden.

Day 03’s map itself follows the Cactus theme: neutral light/dark land, proportional geographic labels, a selection-only accent and an inline legend. The ten ranked resorts are foregrounded; other mapped outlines and unmatched historical planning boundaries are muted context. Four point-only ranked records use explicitly reviewed, dashed 2011 planning-polygon fallbacks rather than dots. A fixed composition replaces explorer controls. The distance-map SVG and water-research canvas retain their original light palettes. All shared assets and internal navigation use relative URLs for GitHub Pages subpaths.

Verification: 8 theme-preference tests plus 50 map/data/ranking tests passed (58 total). All four pages passed light/dark palette, font, overflow and toolbar checks at 1440, 390 and 320px (24 page/theme/viewport combinations). The curated ski-map geometry/layout and fixed-presentation regressions passed under both themes at eleven widths from 320 to 1920px (22 combinations), with one persistent resort label and the legend above the bottom-right source credits. Final browser session: no console errors. Gallery and distance-page dark-mode axe scans detected no violations; map/canvas contrast still requires the existing manual review.

Run `node --test scripts/test-theme.js`, `python3 scripts/check-site.py`, the existing data tests and `scripts/check-ski-label-layout.js` in the browser. New entries should load the shared theme CSS after their entry-specific styles and the small theme-preference script in the head. AI assistance: extracting visual conventions, implementing standalone styles/preferences and checking responsive layouts.

## GitHub Pages

1. Push this repository to GitHub.
2. In **Settings → Pages**, select **Deploy from a branch**.
3. Select the `main` branch and `/ (root)`, then save.

Use relative asset and navigation URLs so the site also works beneath a GitHub Pages repository path. Do not assume it is hosted at the domain root.

## First entry

[Day 02 — Closer than it felt](maps/02-close-to-home/) compares two calculated distances from Kössen: Lisboa, 2,003 km, and Kyiv, 1,356 km. A personal story about distance and perception, rendered as static HTML/CSS/SVG with a distance-preserving projection. See the [method](maps/02-close-to-home/README.md).

## Day 03 · Polygons

[Austria’s ski areas, outlined](maps/03-ski-area-polygons/) shows the 188 polygon records supplied by OpenSkiData for Austrian-associated, operating downhill ski areas in the 2 November snapshot. An additional 102 official Tirol planning polygons (reference date 2011, CC BY 4.0) supplement the OpenSkiData layer without dissolving or deduplicating their different boundaries. Four point-only ranked resorts, including Sölden, use manually reviewed Tirol planning polygons on hover; the 2011 date and partial Ischgl–Samnaun coverage are explicit. See the [matching review](maps/03-ski-area-polygons/POLYGON-MATCH-REVIEW.md). The map and dense ranking sit side by side on wide screens, with matching panel heights and no separate chart scrolling. The map retains fixed national framing and a bottom-right legend; selection only changes the highlight, without pan or zoom. The first resort is selected initially; hover, focus or tap changes the persistent highlight. Horizontal exits retain it, and exits above/below the chart select the first/last resort. The map styling follows the Cactus light/dark theme; no missing boundaries are invented for point-only records. A descending horizontal bar chart compares ten reviewed resort areas by mapped downhill kilometers, with explicit grouping decisions, zero-based bars and downloadable source values. See the [method and license](maps/03-ski-area-polygons/README.md).

## Day 04 · Clusters — research PoC

[Shared destinations](maps/04-travel-clusters/) contains 5,321 reported individual-origin-country × destination pairs across 154 TourMIS reporting destinations. The map now frames 147 destinations between Madeira, Trondheim and Rēzekne; outside-frame records remain in the download, not in the force layout. Collision-separated bubbles are attracted to their destination coordinates. Only the selected source country is highlighted; source selection never changes bubble positions or the global size scale. Domestic stays are excluded by default across all origins. Netherlands shows 97 foreign destinations in this frame, or 103 when domestic stays are enabled. Mixed definitions, geographic displacement, the minimum marker size and missing-data coverage are explicit. Individual provider attribution remains a publication gate. See the [preparation, terms and checks](maps/04-travel-clusters/README.md).

## Viewshed · Three.js research PoC

[Into view](maps/05-viewshed/) animates a calculated 4.88 km OpenStreetMap walking route from Kössen Dorf to Taubenseehütte. A fixed top-down Three.js scene plays 99 precomputed terrain-only viewsheds over real Tirol elevation data on a 20 m analysis grid. Missing German terrain remains explicit. Local assets, no build step, play/pause and scrubbing, and a deterministic `window.viewshed.renderAt(timeSeconds)` capture API support future GIF rendering. Challenge day unassigned; Tirol application notification remains a publication action. See the [method, licenses and capture API](maps/05-viewshed/README.md).

## Saved for another day

[Where the snow begins](maps/02-engineered-winter/) preserves the Tirol snowmaking-water prototype: 704 verified locations and 148 mapped snowmaking reservoirs. Its challenge day is unassigned and source reuse clearance remains unresolved. See its [method](maps/02-engineered-winter/README.md).

## Verification

Before publishing, preview locally and check navigation, mobile layout, browser console errors, data attribution, and GitHub Pages subpath compatibility.
