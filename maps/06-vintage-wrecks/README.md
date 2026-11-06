# Ships of the ancient seas · Day 06: Vintage · PoC

A vintage-inspired atlas with **Europe & Mediterranean**, **Northern waters** and **Mediterranean** compositions. The default view contains **339 archaeological/find-site records**: nineteen reviewed highlights and 320 background records. The original seven later British/Irish wrecks remain an optional layer, giving **346 records** in the complete download. This is partial, geographically uneven coverage—not a complete European inventory, maritime-risk map, historical-chart reproduction or navigation product.

## Data and licences

### EMODnet archaeological background: CC BY 4.0

The [specific catalogue record](https://emodnet.ec.europa.eu/geonetwork/srv/api/records/e965088b-a265-4517-84df-c49b156af8a7) explicitly states **Creative Commons CC-BY 4.0** and supplies this attribution:

> This data was downloaded from the EMODnet Portal (https://emodnet.ec.europa.eu/en/). The data originator is AND-International.

Original archaeological provider: University of Oxford, Oxford Roman Economy Project; Strauss, J. (2013), *Shipwrecks Database*, version 1.0. The EMODnet catalogue describes a 2025 combined product, but that does **not** make the Oxford component a 2025 archaeological survey.

The recorded WFS request selects only records whose `source_inf` is The Oxford Roman Economy Project. On 6 November 2026 the service returned **321 matching records**, all captured; this is **not the whole Oxford database**. The raw response is `data/emodnet-source.geojson`; exact request, source credit, catalogue, licence evidence and retrieval date are in `data/emodnet-provenance.json`. It is not the separate, much larger UKHO worldwide wreck dataset. Neither restricted private wreck databases nor live map services are used at runtime.

The EMODnet point for **Mazarron 1** (`source_id=8903`) is represented by the reviewed **Mazarrón two-ship site group** instead of duplicated. Thus 321 source rows become 320 background records plus the curated group. This is a documented grouping decision, not a claim that the original source has duplicate errors. Site/group counts do not equal numbers of vessels.

Changes to the licensed background: selected fields, coordinates rounded to two decimal places, derived date-filter envelopes, period classification and one grouping replacement. Source strings, IDs, references and original dating are retained. The attribution appears on the page and in individual EMODnet detail cards.

The downloadable Oxford **2017 v2.1 Excel** was inspected separately for structure/terms, but no redistribution licence was verified; its copyright page returned access denied and no licence statement was found in the inspected workbook strings. **That workbook is not bundled or used to supply the map records.** This map uses the explicitly CC-BY-licensed EMODnet distribution instead.

### Nineteen reviewed highlights: sourced coordinates and factual annotations

`data/reviewed-ships.json` documents each explicit date range, event type, cultural association, source history and coordinate choice. `data/ancient-wikidata-source.json` captures the relevant public Wikidata ship/discovery-site entities and their revision/statement IDs. Wikidata structured data is [CC0](https://www.wikidata.org/wiki/Wikidata:Licensing). Mary Rose instead uses a separately pinned Historic England protected-site centroid via the same CC-BY-4.0 EMODnet product; that exception is explicitly credited, not relabelled CC0. Historical annotations are independently compiled factual summaries of the linked museum/archaeological histories, not copied prose. Article prose is not redistributed. Separately licensed highlight photographs and contextual images are documented below.

Northern highlights:

- **Oseberg:** original burial mound entity Q352332, not the ship's Oslo museum coordinate. Burial **834 CE**, checked against the Museum of the Viking Age.
- **Gokstad:** discovery mound Q11972326, not the current museum. Burial **c. 900 CE**; filter uses the nominal year, without manufacturing an uncertainty interval.
- **Tune:** reviewed Rolvsøy coordinate statement on Q778065, explicitly excluding its second, Oslo museum coordinate. Burial **c. 910 CE**, not its construction date c. 900; filter uses the nominal burial year, retaining the circa label.
- **Ladby:** original burial site; early 10th century, filtered with a whole-century envelope.
- **Skuldelev:** five vessels deliberately sunk as barriers, represented by **one find site** in Peberrenden, not the Roskilde museum; 11th-century event envelope. Museum excavation history confirms successive barrier phases; individual ship construction dates are not treated as sinking dates.
- **Hedeby 1:** deliberate destruction as a fire ship, **990–1010 CE** in the linked history. Uses the historical Hedeby locality as an explicitly coarse harbour-area anchor, not the ship item's museum-area point. “Deliberate loss” does not imply an ordinary storm wreck or necessarily a blockship.

Mediterranean-region highlights: **Kyrenia, Antikythera, Mahdia, Madrague de Giens, Mazarrón, Bajo de la Campana, Uluburun and the Nemi ships**. The two Nemi vessels are grouped at a coarse Lake Nemi anchor, not the museum or exact lake-bed wreck positions. Their **37–41 CE** date describes construction/use under Caligula, not an established sinking year. They are explicitly inland lake ships; the lake is too small to be represented by this generalized coastline layer. Kyrenia uses a deliberately broad fourth-to-third-century BCE envelope because published sinking estimates differ. Mahdia and Antikythera have Greek material but are shown as **Roman-period**, not as proof of a Roman crew. **Uluburun** is a Late Bronze Age ship with uncertain origin; it is not automatically labelled Phoenician or Greek.

Medieval/early-modern highlights form a separate five-record association filter, enabled in the default view: **Vasa (1628), Mary Rose (1545), Kronan (1676), Gribshunden (1495) and Bremen cog (c. 1380 timber date)**. Vasa uses a coarse Beckholmen-area anchor near its documented original sinking position, not the Vasa Museum. Mary Rose uses Historic England's original protected wreck-site centroid (EMODnet record `heritageshipwrecks.30`), not its Portsmouth museum coordinate. Kronan and Gribshunden use reported offshore wreck areas. The Bremen cog uses the Rablinghausen locality near the original Weser discovery area, not its present museum in Bremerhaven; the timber date is not claimed as an exact sinking year. Locality anchors are explicitly approximate, not invented excavation fixes. `data/historic-find-sites.json` pins the additional Mary Rose source record and licence evidence. Background medieval records retain their original period classifications; the new filter specifically identifies these curated highlights rather than pretending to classify every medieval ship in Europe.

Deferred candidates: Gjellestad and Gozo lacked direct find coordinates in the queried Wikidata entities; Klåstad's queried coordinate identifies its museum; the original find coordinate for the Marsala Punic ship was not verified. These are not substituted with guessed points. The unrelated medieval **Marsala A** remains its own EMODnet background record.

### Original seven wrecks

The first PoC remains reproducible in `data/wrecks.geojson` and `data/wikidata-source.json`. Optional records include Girona, Dartmouth, Coronation, Association, Victory, Royal Charter and Mohegan. The Royal Charter location retains a documented approximately **1.8 km** conflict with its linked article; it is not silently corrected. All later records are off by default.

### Coastlines and dependencies

Land: [Natural Earth 1:10m, public domain](https://www.naturalearthdata.com/about/terms-of-use/), reused from the Day 04 local snapshot (previously simplified by 0.015 degrees, preserving topology). Bounds −26…47° longitude, 26…73° latitude cover the compositions including the southern Mediterranean and Levant. Coastlines are modern/generalized; small islands and historical coastline changes are not reconstructed. No political borders.

Renderer: the existing local D3 4.13.0, [BSD-3-Clause](../../assets/vendor/d3/LICENSE). Shared Cactus-derived styling retains its existing MIT notice. No new browser dependency, remote font, backend, package tooling or required build step. The browser loads local land/ship/image metadata and the selected highlight's local JPEG, plus existing scripts/styles. Raw research snapshots are downloads, not startup requests.

## Sepia highlight images

All **nineteen highlights**, including Nemi and the five medieval/early-modern additions, have a selected contextual image. The separate image/details inspector follows map/register selection, clears on background records and discloses whether the image shows original remains, a reconstruction, recovered cargo or a historical recovery scene. Images are individually licensed on Commons; author, source, licence and sepia/resizing disclosure remain visible. Local files retain unfiltered colours, accessible through “view unfiltered”; CSS applies `sepia(1)` without cropping. See the [full image credits, rejected candidates and preparation](photos/README.md). The lead 1930 Nemi image was not copied because its US copyright status is unconfirmed; the article's public-domain 1929 Commons photograph is used instead.

```sh
uv run --with pillow scripts/prepare-vintage-images.py
```

No remote image requests occur at runtime. Only the current highlight's image is requested. Missing image metadata or a failed image does not disable the map. These images provide context, not archaeological validation of the plotted coordinates.

## Dates and cultural classification

Negative years mean BCE; positive years mean CE; **no year zero**. The date filter uses **interval overlap**, not a fabricated midpoint or an invented exact sinking year. Original source dating is always available in each card's “Dating & references”.

`scripts/vintage_dates.py` conservatively converts explicit source century strings into whole-century filtering envelopes. For example, `late C2nd- first half 1st BC` becomes **200–1 BCE**, while retaining the narrower original phrase. “Early”, “late”, halves and quarters are not silently translated into arbitrary exact years. Explicit year ranges are retained. Dates lacking an explicit era, `Roman`, `n/a` and unparsed text remain **unknown**, rather than inferred from cultural labels. **49 records** have unknown/unparsed dates. They are included by default and counted explicitly; the checkbox can exclude them. Invalid/reversed ranges and year zero leave the previous valid chart displayed with an error message.

Curated event dates distinguish burial, deliberate loss and sinking. For circa-year dates, filtering uses the stated nominal year while retaining the approximate label; no uncertainty interval is manufactured. Broad source-century envelopes are specified and explained in the review catalog. They are **not statistical confidence intervals**.

Period/association filters are not nationalities. Background classification uses explicit source labels: `Phoenician`; labels containing `Greek` or `Hellenistic` (unless mixed Roman); labels containing `Roman`, `Republican` or `Imperial`. Mixed Hellenistic/Roman is grouped under Roman-period. Ambiguous “Archaic”, “Classical”, Byzantine, Etruscan, Bronze Age and missing labels remain **Other / uncertain**, unless separately reviewed. Crew origin is never inferred from cargo, modern country or find location.

## Interaction and cartography

At widths of at least 1000 px and heights of at least 600 px, the working area is a **three-column horizontal dashboard**: map, paginated register, and selected image/details. Compact controls sit above it. A small layout observer sizes the dashboard from the actual remaining viewport height; all three panels and pagination fit without scrolling the page between them. The register and inspector can scroll independently for overflow; selecting another record resets the inspector to its image. Methods and licences remain below the dashboard. Smaller/mobile screens stack the panels. This changes framing/layout only, not the geographical projection or source positions.

Region buttons select fixed spherical-Mercator compositions and reset filters; selecting a record does not reframe the map. Source points are filtered by the geographic bounds as well as dates, association, find type and search. The paginated native-button register (eight records per page) exposes every matching record without hundreds of tab stops. Selection from background dots moves the register to the appropriate page.

Numbered highlights distinguish **circles: wrecks; diamonds: ship burials; squares: deliberate losses**. Dense highlight badges are separated with a short, stopped force layout and leaders back to the actual rounded source anchors. Leaders are **not routes** and displaced badges are not new archaeological coordinates. Small dots are background wrecks; the register provides keyboard access to all of them. Highlight SVG controls support Enter/Space; register selection retains button focus.

Georgia/system serif lettering, a double neatline, compass rose, real graticules, decorative rhumb lines and SVG grain suggest old nautical charts. North is up. No invented soundings, vessel tracks, historical boundaries or archaeological certainty. The parchment map retains its light palette while the surrounding interface follows Cactus light/dark themes. Mobile stacks the register below the chart.

## Reproduction

```sh
uv run --with shapely scripts/prepare-vintage-wrecks.py
python3 -m http.server 8000
# Open /maps/06-vintage-wrecks/ or /maps/06-vintage-wrecks/?view=med
python3 scripts/test-vintage-wrecks.py
node --test scripts/test-vintage-filters.mjs
python3 scripts/check-site.py
# In an agent-browser session on the loaded entry:
agent-browser eval --stdin < scripts/check-vintage-wrecks.js
agent-browser eval --stdin < scripts/check-vintage-images.js
agent-browser eval --stdin < scripts/check-vintage-layout.js
```

Preparation is optional; committed assets work directly. The script reads committed snapshots, performs no network requests, checks source completeness/IDs and emits `ships.geojson`, `land.geojson`, the legacy dataset and `snapshot.json` hashes. To update the upstream data intentionally, repeat the request in `emodnet-provenance.json`, check matching/returned counts, re-review grouping/location choices and regenerate. A metadata revision is not a promise of full or up-to-date coverage.

## Verification performed

- **20 automated tests:** thirteen Python data/provenance/date-parser regressions and seven Node filter tests passed. Source counts, exact coordinate statement/revision tracing, museum exclusions, grouping, raw/derived hashes, no-year-zero validation and date-overlap behavior are checked.
- Repository local HTML-link/data smoke check, JavaScript syntax checks and `git diff --check` passed.
- Browser regression exercises all three regions, every northern highlight, associations, find types, empty states, pagination, source links/credits, background-dot selection, date overlap, unknown dates, rejected year zero and the optional legacy layer. The updated full filter regression passed at 1440 × 900 in light/dark and 390 × 844 in light, DPR 2. No horizontal overflow or external runtime resource requests were detected.
- Direct `?view=med` loading produced 328 records. The expanded date controls did not overflow at 390 px. A real Enter key on the focused Tune SVG control selected the original find-site record. Northern/Mediterranean desktop and mobile screenshots were visually inspected. No browser errors were reported.
- Image regression loaded all nineteen local images at 1440 × 900, 390 × 844 and 320 × 740 under both themes, verifying dimensions, sepia filter, contained framing, per-image credits/licences, unfiltered links, rapid selection changes and clearing on background records. Contact sheets of the original fourteen and the five new images were visually inspected, together with desktop/mobile dashboard screenshots. Deliberately blocking the Nemi JPEG and then `photos.json` both produced explicit fallbacks while leaving the map usable.
- `?view=med&ship=Q1190639` opens Nemi directly, with its historical image and 328 regional records. `?view=north&ship=Q219821` opens Vasa directly; northern waters contain eleven default records, six Viking and five medieval/early-modern highlights.
- Horizontal-layout regression passed all three map regions at 1440 × 900, 1280 × 720 and 1024 × 768. All three panels and pagination remained inside the viewport; selecting another record reset the inspector to the image. Mobile stacking passed at 390 × 844 and 320 × 740.
- Light desktop axe WCAG 2 A/AA scan: zero detected violations, with color contrast incomplete and still requiring manual review. This is not a claim of complete accessibility compliance.

## AI assistance

Substantial Pi Coding Agent / gpt-6.1-sol assistance: public-source and licence research, API inspection, museum/find-site screening, factual date/event review, preparation, filters, cartographic/interface implementation, documentation and tests. No synthetic shipwreck observations. All records are approximate historical/archaeological context, **not for diving, salvage or navigation**.
