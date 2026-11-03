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
assets/style.css            Shared site styles
maps/                       One directory per completed entry
```

Each entry should include its day and theme, a short explanation, an accessible description of the visualization, data attribution and licensing, and a link back to the gallery. Record any substantial AI assistance.

## Local preview

From this directory:

```sh
python3 -m http.server 8000
```

Open http://localhost:8000. No package installation is required.

## GitHub Pages

1. Push this repository to GitHub.
2. In **Settings → Pages**, select **Deploy from a branch**.
3. Select the `main` branch and `/ (root)`, then save.

Use relative asset and navigation URLs so the site also works beneath a GitHub Pages repository path. Do not assume it is hosted at the domain root.

## First entry

[Day 02 — Closer than it felt](maps/02-close-to-home/) compares two calculated distances from Kössen: Lisboa, 2,003 km, and Kyiv, 1,356 km. A personal story about distance and perception, rendered as static HTML/CSS/SVG with a distance-preserving projection. See the [method](maps/02-close-to-home/README.md).

## Day 03 · Polygons

[Austria’s ski areas, outlined](maps/03-ski-area-polygons/) shows the 188 polygon records supplied by OpenSkiData for Austrian-associated, operating downhill ski areas in the 2 November snapshot. An additional 102 official Tirol planning polygons (reference date 2011, CC BY 4.0) supplement the OpenSkiData layer without dissolving or deduplicating their different boundaries. Sölden is available through the reviewed alias for Tirol’s Ötztaler Gletscher polygon. The map offers source toggles, searchable inspection and Hochkössen/Sölden shortcuts without inventing boundaries for point-only records. See the [method and license](maps/03-ski-area-polygons/README.md).

## Saved for another day

[Where the snow begins](maps/02-engineered-winter/) preserves the Tirol snowmaking-water prototype: 704 verified locations and 148 mapped snowmaking reservoirs. Its challenge day is unassigned and source reuse clearance remains unresolved. See its [method](maps/02-engineered-winter/README.md).

## Verification

Before publishing, preview locally and check navigation, mobile layout, browser console errors, data attribution, and GitHub Pages subpath compatibility.
