# Lumi actual-geometry review: local verification

As of October 24, 2026. Working source in `outputs/flare-grounded`; no commit or deployment made. Production build is running at http://127.0.0.1:3001.

Scope: fixed design brief → render the candidate → Gemini 4 Argon image review → bounded scoped correction → render and review again. Preserve identities, canonical source geometry, saved objects and undo history. Keep the existing object studio, catalog, Design Lab and circuit workbench available.

| Check | Mode | Expected | Observed | Status | Evidence |
|---|---|---|---|---|---|
| C001 | Live Argon | Review actual images and reinspect a correction | Saved sensor with deliberately misplaced ESP32: two reviews, six WebGL images, one reported issue to zero. Only that module changed. All original IDs, source identity and unrelated geometry retained. | Passed | [Evaluation](sensor-evaluation.json), [baseline](sensor-placement-challenge.part.json), [reviewed project](reviewed-sensor.part.json), [browser](live-review.png) |
| C002 | Live Argon | Fresh generation followed automatically by image review | Desktop fan: eleven parts, 91 custom solids, sourced 608 bearing, eight mounts. Three-view review found no issue requiring repair. | Passed | [Evaluation](fan-evaluation.json), [project](reviewed-fan.part.json), [browser](fan-reviewed.png) |
| C003 | Local browser | Parent movement carries mounted children; one undo restores all | A 5 mm upward housing edit moved its motor, bearing and grille by 5 mm. Undo restored the exact original document and review report. Old review was visibly stale before undo, valid afterward. | Passed | [Export comparison](mount-edit-evidence.json), [moved project](fan-moved-parent.part.json), [undo project](fan-undone.part.json) |
| C004 | Local browser | Cancellation preserves the saved document | Cancelled while Argon was inspecting; old report returned. Export matched the original document exactly. | Passed | [Result](cancellation-evidence.json), [browser](review-cancelled.png) |
| C005 | Local browser | Recorded evidence survives save and import | Production reload and imported project restored the brief, images and findings. Full-size comparison opened; Escape closed it. | Passed | [Comparison](fan-comparison.png) |
| C006 | Local | Regression checks pass | 275 tests passed, four billable opt-in suites skipped. Actual provider checks were performed through the browser separately. | Passed | [Log](tests.log) |
| C007 | Local | Type check passes | `tsc --noEmit` completed successfully. | Passed | [Log](typecheck.log) |
| C008 | Local | Production build succeeds | Next.js build completed; `npm start` served it on port 3001. | Passed | [Log](build.log) |
| C009 | Local browser | GPU viewport and review UI visibly render | Inspected final fan and report; latest browser error query returned no entries. Review controls no longer cover undo/redo. | Passed | [Final browser](final-production.png) |
| C010 | Live availability | Existing model configuration stays available | Production status returned available with model `gemini-4-argon`. C001/C002, rather than this status check, demonstrate inference. | Passed | [Status](provider-status.json) |

## What this demonstrates

The sensor run establishes a genuine software feedback loop: a concrete defect was present in the initial candidate, the model received actual rendered images, a validated scoped edit moved and mounted the affected source part, and the model reviewed new images before the result was accepted. The two review rounds preserve hashes of their exact JPEG inputs. The fan establishes that the same path runs automatically after a fresh prompt; it is not hardcoded to manufacture a repair.

The comparison script verifies recorded image hashes, frozen requirement coverage and optional baseline preservation. These checks bind local evidence bytes; they do not authenticate an editable imported JSON report. Provider findings remain model judgments. The sensor's 1-to-0 result is not an engineering accuracy metric or an overall success rate.

The ordinary editor and review capture now share a geometry builder. GPU captures use source materials; the software fallback draws complete triangles with a depth buffer and picking. Deterministic tests render real saved sofa/sensor documents and sourced CAD, reject stale or invalid image inputs, preserve catalog references, prevent unrelated repairs and selected-part edits, exercise nested parent transforms/resizes, and retain the better previously reviewed candidate after a regression or provider failure.

Google's [image-input documentation](https://ai.google.dev/gemini-api/docs/image-understanding) was checked through Bright Data for the inline Interactions payload. [Contract note](api-contract-check.json). No new credentials or dependencies were required; credentials are excluded from the evidence packet.

## Unrun checks and limits

- **C011:** a forced software-only browser session was not run. Rasterization, visibility/picking and real source geometry have local test coverage. Current browser evidence used WebGL.
- **C012:** the evaluation fixture contains twelve briefs. Two have live model evidence, two have local geometry/mount regression coverage, and eight are explicitly unrun. No twelve-case AI success claim is made.
- **C013:** physical assembly, tolerances, fastening, loads, wiring, firmware and hardware operation were not verified. A visual pass does not establish these.
- No deployment or deployed-host verification was performed. Generation and image review still depend on provider availability and latency. No fixed response-time guarantee is claimed.
- Failed/unresolved results remain inspectable drafts. Error, rollback and bounded-retry behavior has deterministic coverage; no live provider outage was manufactured for this packet.

## Preservation and reproducibility

Pre-change source is archived at `../../work/lumi-preserved/lumi-before-quality-2026-10-24.tar.gz (relative to the app root)`, without secrets, dependencies or build output. The original sibling `part-explode` checkout remains clean. No Git push or Vercel deployment was made.

Run the commands in [the quality guide](../../QUALITY.md). `sprint.json` fingerprints each check's sanitized evidence. The packet validator checks structure and hashes; it does not establish model accuracy, end-to-end behavior or hardware readiness.
