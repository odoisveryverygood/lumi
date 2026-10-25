# Third-party code and model attribution

## Anatomy

Source: https://github.com/wheresryan22/anatomy

Pinned commit: `1482e8469b0a9e0d8cc18ea2740a01423d29ae80`.

- `vendor/anatomy/iso-kit.ts` is copied verbatim from `kit/iso-kit.ts`.
- `components/anatomy/HardwareArt.tsx` adapts the structure of `kit/react/draw.tsx`.
- Upstream MIT copyright/license is preserved in `vendor/anatomy/LICENSE`.
- Electronics geometry and its project/editing bindings are application code. Details are in `vendor/anatomy/PROVENANCE.md`.

## Etch

Source: https://github.com/PranavAchar01/etch

Pinned commit: `c548129ec5ed13f59f76b0a852a5dd03b728825b`.

The user explicitly instructed this application to reuse the repository's code and stated that they have permission. The inspected upstream tree did not include a root license file. That statement of permission is the basis for this requested local reuse; this notice does not invent a broader license for Etch.

Adapted source:

- `deploy/etch-app/js/board-viewer.js`: part-only ray picking, click-versus-drag threshold and selection outline, adapted into `components/Scene.tsx`.
- `deploy/etch-app/js/editor/selection.js`: projected selection footprint, guides and millimetre dimensions, adapted into `components/Scene.tsx`.
- `deploy/etch-app/js/build-anim/parts3d.js`: material conversion, independent model instances and fade behavior, adapted into `lib/etch-models.ts`.
- `deploy/etch-app/css/editor.css`: editor tokens, inspector/control hierarchy, adapted into `app/globals.css` and React editor panels. Application layout, controlled fields, manual edit operations, Gemini integration and history are application code.
- Nine GLB assets and their original catalog metadata copied selectively from `deploy/etch-app/parts3d/` into `public/etch-parts/`. Their exact identities, physical bounds, original pad coordinates and commit are preserved in `public/etch-parts/index.json` and `PROVENANCE.md`. Only matching footprints are used as whole parts; the ESP32-WROOM asset is used as the module on a DevKit carrier.

The model catalog identifies these GLBs as exports from KiCad STEP assets. KiCad attribution and its 3D-model license are additionally preserved under `public/models/`. The application does not claim authorship of these models or the upstream source.

## Stack Chan real-board assembly

`public/assemblies/stack-chan/` bundles the original Etch-rendered board GLB and metadata at Etch commit `c548129ec5ed13f59f76b0a852a5dd03b728825b`. The underlying KiCad project is `stack-chan/stack-chan`, commit `ad876ea36e7ef13f08de2982fe8d15a6ffda5cc7`, under Apache-2.0. Its full license and detailed conversion notice are included beside the asset. The app preserves the actual mesh/material geometry and does not invent the missing SW1 model. DeviceScene uses the previously documented Etch picking/fade/outline techniques; its light solid composition follows Anatomy's craft guidance. The compact desktop geometry is original illustrative application data.

## Other software

Next.js, React, Three.js, React Three Fiber, drei, Zod, Lucide, jsPDF and their transitive dependencies retain their own notices/licenses in their installed distributions. The lockfile pins the installed dependency graph.

## Lumi typography

Oxanium variable font by Severin Meyer, from google/fonts (`ofl/oxanium`), licensed under SIL Open Font License 1.1. The font and license are self-hosted in `public/fonts/`. Downloaded October 23, 2026.
# Lumi source catalog (October 23, 2026)

The application now includes a curated CAD catalog from Espressif, NopSCADlib and BOSL2, plus searchable CC0 Smithsonian object metadata from Objaverse-XL. Exact revisions, transformations, original source links, asset hashes, licenses and corresponding source archives are documented in [the catalog notice](public/catalog/README.md). NopSCADlib-derived meshes and their wrapper recipes retain GPL-3.0-or-later terms; no proprietary license is asserted over those assets. BOSL2 retains BSD-2-Clause notices. Espressif retains CC-BY-SA 4.0 and its KiCad exception. Individual museum objects are included only when their metadata identifies CC0. Objaverse-XL metadata attribution and ODC-By are separate from object licensing.

The self-hosted Draco glTF decoder (`public/catalog/decoders/draco/`) is copied unmodified from Three.js 0.180.0, `examples/jsm/libs/draco/gltf`. Google Draco contributors, Apache License 2.0. Full terms are in `public/catalog/licenses/draco.txt`; source: https://github.com/google/draco. Only the WASM decoder and its wrapper are included; no third-party decoder CDN is used.
