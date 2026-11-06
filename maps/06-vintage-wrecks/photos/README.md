# Selected-highlight images

Fourteen contextual images, sourced from individual Wikimedia Commons file pages on 6 November 2026. Each image keeps its own licence; neither the map's data licences nor the website's code notices replace these image terms. Exact source filenames, creator credits, file-page URLs, licence URLs, download URLs, dimensions, changes and local SHA-256 hashes are in [`../data/photos.json`](../data/photos.json). The pinned API evidence is [`../data/commons-images.json`](../data/commons-images.json), with editorial choices in [`../data/image-selection.json`](../data/image-selection.json).

| Highlight / local file | Creator | Licence / status | What is depicted |
| --- | --- | --- | --- |
| Oseberg · Q832395.jpg | Petter Ulleland | CC BY-SA 4.0 | Original ship displayed in Oslo, 2016 |
| Gokstad · Q640851.jpg | Karamell | CC BY-SA 2.5 | Original ship in museum display |
| Tune · Q778065.jpg | China Crisis | CC BY-SA 2.5 | Original surviving timbers in museum display |
| Ladby · Q1799877.jpg | Malene Thyssen | CC BY-SA 3.0 | Burial remains preserved in situ |
| Skuldelev · Q831457.jpg | Colin | CC BY-SA 4.0 | Skuldelev 1, one of the five vessels, in Roskilde |
| Hedeby 1 · Q18412197.jpg | Xocolatl | Public domain | Longship reconstruction model at Hedeby, not the original hull |
| Kyrenia · Q2234980.jpg | Mgiganteus1 (English Wikipedia) | CC BY-SA 3.0 | Surviving original hull in its museum |
| Antikythera · Q2616711.jpg | Unknown photographer | Public domain | Recovery expedition on Mykali, winter 1900–1901 |
| Mahdia · Q3589083.jpg | Pradigue | CC BY 3.0 | Architectural cargo fragments in the Bardo Museum |
| Madrague de Giens · Q6728460.jpg | dronepicr | CC BY 2.0 | Reconstruction model in Mainz |
| Mazarrón · Q2884899.jpg | Nanosanchez | Public domain | Reconstruction of Mazarrón II at ARQUA, Cartagena |
| Bajo de la Campana · Q65006224.jpg | Jamie Heath | CC BY 2.0 | Recovered inscribed ivory tusks, not a ship hull |
| Uluburun · Q573852.jpg | Martin Bahmann | CC BY-SA 3.0 | Wooden reconstruction model |
| Nemi ships · Q1190639.jpg | Unknown photographer; published in Bilderwoche | Public domain | Historical photograph of a recovered hull, 1929 |

Public-domain links in the UI identify status using the Public Domain Mark; that mark is not itself a copyright licence. Creative Commons image adaptations remain subject to each image's BY or BY-SA version. Attribution, source link, licence link and the changes “resized · sepia display” appear next to the selected image. Full source/terms remain available from the linked file page.

## Licence and subject review

The licence fields were checked on the **individual files**, not inferred from Wikimedia's general footer or from their presence on Wikipedia. Ladby's older file lacks a machine-readable Artist field: its raw `MaleneThyssenCredit` template explicitly identifies Malene Thyssen and offers CC BY-SA 3.0 / 2.5; the chosen 3.0 grant is also reported by imageinfo. That explicit creator credit is retained.

The English Wikipedia lead photo **Nemi Ship Hull 1930.jpg was not copied**: its English file page reports PD-Italy with unconfirmed US copyright status and prior Commons deletion. Instead, the Commons file **Nemi-Schiff.jpg**, also shown on the Nemi article, reports public-domain status for a photograph published in *Bilderwoche* in 1929. This is why the UI says 1929 rather than 1930.

The original Wikidata P18 suggestion for Madrague de Giens was an unrelated Ulysses mosaic: rejected in favour of a specifically identified reconstruction model. A generic Mahdia ship miniature was replaced with documented architectural cargo from that wreck. Museum, artefact and reconstruction captions are explicit; no image is presented as an underwater photograph of the selected wreck unless it actually is one. All fourteen prepared images were visually reviewed together before inclusion.

## Preparation and UI

```sh
uv run --with pillow scripts/prepare-vintage-images.py
uv run --with shapely scripts/prepare-vintage-wrecks.py
```

The first script reads pinned selection/API metadata, verifies the accepted licence labels, downloads only from public Wikimedia image hosts (two at a time), caches temporary inputs outside the repository, applies EXIF orientation, fits within **960 × 640** without cropping, converts to RGB and saves JPEG at quality 82 with EXIF removed. Total local JPEG size is approximately **1.40 MB** for all fourteen; original-resolution downloads are not committed. The second script refreshes the atlas data/provenance hashes, including the image metadata.

The local JPEGs retain their unfiltered colours. The browser applies **CSS `filter: sepia(1)`**; a “view unfiltered” link opens the resized, original-colour local copy. Sepia is a disclosed visual treatment—not a claim that the modern museum photographs are old. `object-fit: contain` preserves each image's composition, including portrait photographs.

Only the selected highlight's image is requested; the browser does not download all fourteen at startup. The photo panel appears near the top of the register. Background and optional later records clear/hide it rather than retaining an unrelated picture. Rapid selection changes update image, caption and credit together. Metadata or image failures leave the map usable and show an explicit image-unavailable message with source links where available.

AI assistance: Commons discovery, file-level licence and subject checks, metadata transcription, resized asset preparation, captions/alt text, UI and regression tests. No AI-generated ship images.
