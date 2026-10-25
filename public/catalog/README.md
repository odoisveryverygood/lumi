# Lumi source collection

The ready collection contains 14 preprocessed components. Search and add them locally; Gemini may select matching catalog IDs during creation and editing. Custom geometry is still generated for the requested object. This is a curated subset, not a claim that every upstream model has been imported.

## Ready CAD

- Espressif KiCad libraries, revision `dd76561812ab300351234ba6e0ec1295641796f0`: ESP32-WROOM-32E, ESP32-S3-WROOM-1 and ESP32-C3-MINI-1 official STEP geometry. Copyright Espressif Systems. CC-BY-SA 4.0 with the upstream KiCad electronic-design exception. Full terms: [espressif.txt](licenses/espressif.txt). Original STEP downloads are linked on each part. Models are modules, not complete development boards.
- NopSCADlib, revision `00ec2898c0a2cdebd446f0175671b633d5ae7d5f`: M3/M4 cap screws, M3 nut/washer, 608 bearing and two 2020 extrusion lengths. Copyright Chris Palmer and upstream contributors. GPL-3.0-or-later. [License](licenses/nopscadlib.txt), [corresponding source archive](sources/NopSCADlib-00ec2898c0a2cdebd446f0175671b633d5ae7d5f.tar.gz). Individual wrapper recipes are downloadable from each component. Source library files are unmodified.
- BOSL2, revision `d29d3e5fcfe830e7554b7c914b1431dbf23e82d8`: rounded blank, hollow tube and two spur gears. Copyright Revar Desmera and upstream contributors. BSD-2-Clause. [License](licenses/bosl2.txt), [source archive](sources/BOSL2-d29d3e5fcfe830e7554b7c914b1431dbf23e82d8.tar.gz).

Meshes were tessellated using OpenCascade / occt-import-js for STEP and the official OpenSCAD WASM 2022.03.20 runtime for SCAD. OpenSCAD is build tooling and is not shipped in the runtime app. Source units are millimetres; source coordinates were mapped `[x,y,z] -> [x,z,-y]` and centered. Floating-point positions and colors were rounded to four decimals. Source hashes and pinned revisions are preserved in component specs. SCAD wrappers plus the pinned source archives reproduce the pre-tessellation geometry. Rendering is a mesh approximation of the cited CAD.

Source: https://github.com/espressif/kicad-libraries

Source: https://github.com/nophead/NopSCADlib

Source: https://github.com/BelfrySCAD/BOSL2

## Broader object references

2,407 GLB records from the Smithsonian subset of Objaverse-XL are indexed. The metadata file is `https://huggingface.co/datasets/allenai/objaverse-xl/resolve/main/smithsonian/smithsonian.parquet`, retrieved October 23, 2026. Only records explicitly marked Creative Commons Zero v1.0 Universal are included. Objaverse-XL metadata attribution: Deitke et al., *Objaverse-XL: A Universe of 10M+ 3D Objects*, https://github.com/allenai/objaverse-xl. The dataset metadata is subject to ODC-By; individual objects retain their own license. Smithsonian object records selected here are CC0, https://creativecommons.org/publicdomain/zero/1.0/.

Search downloads metadata only. Opening downloads the selected model from the Smithsonian, checks its indexed SHA-256, then validates the GLB before replacing the scene. Downloads are limited to 25 MB / 45 seconds. Ordinary, meshopt and Draco mesh geometry are supported. Draco is decoded in one browser worker using self-hosted Google Draco decoder assets distributed with Three.js 0.180.0, Apache-2.0; [license](licenses/draco.txt). Decoded accessor metadata is checked against the 100 MB / one million triangle budget. KTX2 textures, external resources, modified hashes and inaccessible files are rejected. These historical metadata records may contain unavailable source models; inclusion in the index does not guarantee current compatibility. The current object is preserved on failure.

Museum models are static visual references. Selectable mesh groups do not imply meaningful internal engineering parts. Their display scale is normalized and physical dimensions are unverified. Generated custom internals, assembly placements, wiring and mechanisms remain conceptual unless independently verified.

## Project files

Catalog components are saved as compact IDs with editable placement, finish and annotations. Reopening resolves geometry from this pinned local catalog. For portability outside Lumi, download the original STEP or SCAD recipe and its source/license. Museum projects embed the original GLB when exported.
