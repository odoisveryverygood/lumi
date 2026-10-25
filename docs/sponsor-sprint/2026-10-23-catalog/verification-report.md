# Lumi catalog verification — October 23, 2026

Status: local only. No deployment, Git push or production account changes.

- 14 actual preprocessed CAD components, pinned sources and per-part licenses. 2,407 indexed CC0 Smithsonian object references; models are downloaded only when opened.
- 254 default tests passed; four opt-in suites skipped in that run. The catalog live suite was then run explicitly and passed separately. TypeScript and the final production build passed.
- Fresh Gemini 4 Argon design: nine parts, including the real ESP32-C3-MINI-1 module and M3 × 12 screw; 110 custom solids. Generation validated in 57.8 seconds. Complete live check including a source-model download took 63.0 seconds. This single run is not a general latency benchmark.
- Browser: searched official CAD, added the ESP32 to the saved smart sofa, moved it, undid movement and addition, redid insertion, asked Gemini which part used source CAD, and exported/reimported the compact project. The exact source CAD envelope was correctly identified and distinguished from conceptual carrier-board geometry.
- Browser: selected a real Smithsonian Side Chair, verified its indexed hash, downloaded 1,506,420 bytes, decoded Draco locally, imported its original mesh group, selected it and restored it again after reload. Returned to the sofa afterward. Large or incompatible museum models can still be rejected; only this sample was verified end to end.
- Catalog geometry is immutable; placement, finish and annotations are editable. No physical fit, wiring, load capacity, firmware or hardware operation was verified. Museum mesh groups do not establish semantic internals.
- WebGL was unavailable in the in-app browser. Static source previews, actual GLB decoding, saved-model restoration and editing controls were verified; GPU rendering/orbiting was not verified there.

Earlier attempts: one live generation returned malformed JSON and was rejected without replacing the object; subsequent fresh generation succeeded. The first museum preflight rejected Draco; a self-hosted decoder and metadata budgets were added, then the actual source scan imported successfully.

Original PartExplode checkout remains clean. The prior Lumi source was preserved before this change at the task-level `work/lumi-preserved/lumi-before-catalog-2026-10-23.tar.gz`.
