# Project guidance

## Goal

Create simple static HTML map visualizations for the 2026 #30DayMapChallenge, hosted on GitHub Pages. See README.md for scope and publishing instructions.

## Constraints

- Use plain HTML, CSS, and JavaScript by default; no required build step or backend.
- Do not add frameworks, package tooling, or large mapping dependencies without a concrete need.
- Keep every entry in maps/<day>-<slug>/index.html and link completed entries from index.html.
- Use relative URLs compatible with GitHub Pages project sites.
- Prefer local, reasonably sized datasets; do not commit credentials or private data.
- Attribute data sources and verify their redistribution licenses.
- Provide semantic HTML, keyboard-accessible controls, readable contrast, responsive layouts, and a text description of each map.
- Document data preparation, external dependencies, and substantial AI assistance per entry.
- Do not invent data or imply that illustrative data represents real observations.

## Checks

Preview with python3 -m http.server 8000. Check links, console errors, narrow screens, and map descriptions. Report which checks were actually performed.
