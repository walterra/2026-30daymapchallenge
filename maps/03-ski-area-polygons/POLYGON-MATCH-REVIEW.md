# Reviewed polygon fallback for point-only ranked resorts

## Scope and decision

Review covers all **four point-only records in the ten-resort ranking**, assessed against all 102 Tirol planning features and the cached OpenSkiData run associations. It is not an automatic match of all 187 omitted point records.

Keep the six existing OpenSkiData outlines. For the remaining four resort selections, highlight the following **original, unmodified Tirol polygons** instead of drawing a dot. The two source files remain separate; the reviewed crosswalk is `data/polygon-matches.json`. No polygon is inferred, buffered, clipped or published as a dissolved union. Original point geometry, downhill lengths and the ranking CSV/JSON remain unchanged.

These are **2011-10-30 planning envelopes**, not verified current resort boundaries. Dashed outlines, a visible 2011 header badge, the legend and caption retain that distinction.

## Manual decisions and spatial evidence

| Ranked area | Accepted Tirol polygons | Associated run records | Intersect accepted polygons | Fully contained |
| --- | --- | ---: | ---: | ---: |
| SkiWelt Wilder Kaiser–Brixental | `tiris:76` Schiwelt Wilder Kaiser–Brixental; `tiris:89` Choralm–Westendorf / Kandleralm–Brixen | 602 | 592 | 550 |
| Serfaus–Fiss–Ladis | `tiris:43` Komperdell | 464 | 458 | 424 |
| Ischgl–Samnaun | `tiris:41` Silvretta Schiarena | 528 | 399 | 368 |
| Sölden | `tiris:102` Ötztaler Gletscher | 223 | 219 | 212 |

Each accepted polygon/group contains the original source resort point. Counts refer to associated source run **records**, not distance-weighted or area-weighted coverage. Intersections do not prove equivalent boundaries or modern operational status. Temporary unions are used only for group auditing, never as replacement display geometry.

### SkiWelt: include the separately named southern component

The direct SkiWelt-name match alone is incomplete: `tiris:76` intersects 487 associated records, while the separate Westendorf/Brixen polygon intersects 106. Their combined selection intersects 592 distinct associated records; one intersects both, so these counts must not be added as independent coverage.

[The official Westendorf page](https://www.skiwelt.at/en/skiwelt-westendorf.html) explicitly identifies Westendorf, Talkaser and Choralpe as part of SkiWelt. Do not add KitzSki merely because the KitzSkiWelt tour connects the two areas.

### Serfaus–Fiss–Ladis: historical Komperdell name, broader envelope

The source point is inside `tiris:43`. Its envelope spans approximately 10.4716–10.6464° E, 47.0075–47.0900° N and intersects 458 of the resort's 464 associated records. No other supplied Tirol polygon intersects these associated records. This establishes a strong display association despite the older Komperdell name; it does not establish a complete current boundary.

[Official resort naming context](https://www.serfaus-fiss-ladis.at/en/winter-holiday/ski-area-and-winter-activities/skiing-and-snowboarding). The empirical association comes from the local geometries and source run links, not from importing a marketing map or advertised total.

### Ischgl–Samnaun: explicitly partial

`tiris:41` contains the source point and intersects 399 associated records. No other supplied Tirol polygon intersects this resort's associated records. Do not substitute neighboring Galtür (`tiris:9`), Kappl (`tiris:29`) or See (`tiris:42`, `tiris:56`).

[The official Silvretta Arena description](https://www.ischgl.com/en/winter/silvretta-arena) identifies the cross-border Ischgl/Samnaun resort. Tirol's planning file supplies no Swiss Samnaun boundary. The map therefore says **2011 planning · partial**; its caption explicitly distinguishes this from the full cross-border chart length. The 129 nonintersecting records are not assumed to be exclusively Swiss: historical boundary differences can also contribute.

### Sölden: retain the independently audited association

`tiris:102` Ötztaler Gletscher contains the source point and intersects 219 of 223 associated records, reproducing the earlier Sölden audit. Obergurgl (`tiris:37`), Hochgurgl (`tiris:40`) and Vent (`tiris:6`) are not added merely because they share the valley; none intersects the associated Sölden records in this audit.

[Official polygon source](https://gis.tirol.gv.at/arcgis/rest/services/Service_Public/ogd_sport/MapServer/7).

## Reproduction and provenance

```sh
uv run scripts/audit-ski-polygon-matches.py --runs /tmp/ski-runs.geojson
uv run scripts/test-ski-polygons.py --source /tmp/ski-areas.geojson --tirol-source /tmp/tirol-ski-boundaries.geojson
```

The audit streams the existing cached download; no network request is made. `data/polygon-match-audit.json` records hashes for the run snapshot, rendered Tirol input and reviewed crosswalk, plus all intersecting candidate polygons. Run snapshot SHA-256: `05b3a180ffbe9ce7c398f6470baf4dd37915339b69b2579f21f9fca33b82660f`.

OpenSkiData records/associations retain ODbL attribution. Tirol geometry remains separately distributed under CC BY 4.0, attributed to Land Tirol–tiris. The association is a display fallback, not a new authoritative resort census or a replacement for the source geometry.
