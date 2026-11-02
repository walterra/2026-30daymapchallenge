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

## First milestone

Choose a day/theme and dataset, build one map, then add its link to the gallery. The first three 2026 themes are Points, Lines, and Polygons.

## Verification

Before publishing, preview locally and check navigation, mobile layout, browser console errors, data attribution, and GitHub Pages subpath compatibility.
