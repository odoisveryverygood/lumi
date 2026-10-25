# Lumi sourced parts and object library

**October 24 follow-up:** the current browser rendered sourced components through WebGL and sent actual geometry images to Gemini 4 Argon. A fresh fan used a sourced 608 bearing; a desk-sensor repair preserved the official ESP32-C3 CAD. The shared software renderer also has local rasterization and picking tests. See [the quality update](QUALITY.md) for current evidence; the October 23 browser limitation below remains a historical observation.

Open **Parts library** in the header or the Explore page. Ready parts have actual preprocessed CAD, dimensions and source/license links. Search by name or category, select a part, then add it to the current assembly or open it on its own. Move, rotate and recolor it through the normal inspector. Undo/redo treats each addition as one assembly edit. Standard part dimensions are locked to their cited source.

The initial local collection contains 14 components: three official Espressif ESP32 radio modules; NopSCADlib M3/M4 screws, M3 nut/washer, 608 bearing and two extrusion lengths; and BOSL2 rounded blank, tube and two spur gears. It is a curated subset of these upstream libraries, not the entire repositories.

Gemini creation and conversational additions receive matching compact catalog metadata. A `catalogRef: {id: "esp32-c3-mini-1"}` resolves locally to canonical geometry. Unknown IDs, arbitrary dimensions, source URL overrides and forged geometry are rejected. Custom geometry is still generated for the requested object. Streaming previews hydrate the same references; source geometry is never invented from an ID.

Catalog saves, share links, exports and API payloads use compact references. Reopening hydrates them against the pinned catalog and preserves placement, finish and annotations. One ESP32-WROOM-32E component is under 3 KB as a reference rather than several megabytes of repeated mesh JSON. The geometry is bundled once in the app. Adding an existing catalog component does not call Gemini. AI design latency still depends on the complexity of custom geometry and provider response.

**Museum objects** searches 2,407 CC0 GLB records in the Objaverse-XL Smithsonian subset. Opening downloads only that model, verifies its exact indexed hash, checks container/geometry budgets and uses local ordinary/meshopt/Draco decoding. An unavailable or incompatible object produces an explicit error and preserves the current assembly. Mesh groups are selectable, but they do not imply semantic internal parts. Scans are normalized for display; physical dimensions are unverified. Source and license are attached to the document and parts, and exported museum projects embed their original GLB.

All source revisions, corresponding SCAD archives, transformations and licenses: [public catalog notice](../public/catalog/README.md).

## Extend the ready collection

`scripts/build-catalog.mjs` contains the pinned source definitions and controlled SCAD recipes. It is a build-time converter, never an endpoint for executing model-written code. Run from this app root with `node scripts/build-catalog.mjs /path/to/catalog-tools`. The prepared tool folder needs `hyparquet` and `occt-import-js` (in that folder or its sibling `cad-tools`), official OpenSCAD WASM release files in `openscad/`, `smithsonian.parquet`, and pinned source trees in `source/Espressif`, `source/NopSCADlib`, `source/BOSL2`. Espressif files are the three named STEP files, `Espressif.kicad_sym` and `LICENSE.md`. Upstream source archives and recipes are included in `public/catalog/sources/`. The converter writes `catalog-data/parts.json`, `catalog-data/objects.json`, notices and SCAD wrappers. If changing the upstream revision, regenerate the corresponding source archive and rerun the catalog validation tests. Runtime builds use the checked-in data and need none of these converters.

## Verification

Run `npm test`, `npm run typecheck` and `npm run build`. The tests cover canonical geometry, forged references, compact round trips, streaming hydration, transactions, lookup, download bounds, integrity and Draco metadata budgets. The opt-in billable provider check is `LUMI_CATALOG_LIVE=1 npx vitest run tests/catalog-live.test.ts`.

The October 23 live check generated a fresh 9-part desk sensor using Gemini 4 Argon: 2 sourced components and 110 custom solids, with the generation validated in 57.8 seconds. A separate current-browser conversation identified the official ESP32-C3 CAD in the saved sofa, distinguished it from the conceptual carrier board and focused it. A real 1,506,420-byte Smithsonian Side Chair passed the indexed SHA-256 check and decoded/imported in the browser as its single original mesh group. These are software checks; physical fit, wiring, strength and hardware operation are unverified. The in-app browser did not provide WebGL, so browser checks exercised catalog previews, imported mesh decoding and non-WebGL editing controls; rendered 3D orbiting was not verified there.

Evidence: [catalog verification packet](sponsor-sprint/2026-10-23-catalog/).
