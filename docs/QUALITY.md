# Lumi: inspect and improve the actual object

Local revision, October 24, 2026. Open http://127.0.0.1:3001. This revision has not been deployed.

The subsequent [measured-edit revision](MEASURED_EDITS.md) adds frozen geometric requirements, baseline placement preservation, locked comparison cameras and a separate repeated evaluation. Results below are the earlier quality revision's historical evidence, not the newer benchmark.

New object generation and geometry-changing AI edits now run a bounded visual review automatically. **Review** in the header can inspect an existing object against an editable brief. The original brief stays fixed throughout that run.

1. The editor renders the actual candidate from assembled, top and exploded cameras. Review and viewport share the same geometry builder, source meshes, transformations and materials.
2. Gemini 4 Argon receives those three images, the original request, part identities and deterministic checks. Each request clause receives a supported, issue or unverifiable finding with relevant parts.
3. A repair can touch only issue-linked components, with at most eight updates and three additions. It cannot delete or rename existing parts, rewrite the assembly graph, replace source geometry or edit unrelated components. Explicit mounts can carry descendants with their parent.
4. Each correction is rendered and reviewed again before acceptance. There are at most two corrections and three reviews. A revision introducing a new issue or more failed checks is rejected in favor of the earlier candidate; any remaining scoped correction may still be reviewed within that bound. An unreviewed correction is never the accepted result.
5. A reviewed candidate becomes one undoable edit. Unresolved findings or a failed review leave a separate draft for inspection, explicit acceptance, another review or return to the saved object. Cancellation preserves the saved object. An interrupted draft can be restored only against its matching saved baseline.

Simple name and finish edits keep their fast path. Manual transforms remain immediate. A saved report becomes visibly stale after a geometry, appearance or brief change; undoing to the reviewed document restores its validity. Reviewing is an image-based design aid, not hardware certification.

## Use and inspect the evidence

Open **Review**, enter the design brief and select **Inspect and improve**. The panel shows progress, fixed camera views, first and retained renders, findings, revision history and measured checks. **Compare at full size** opens the actual recorded images; Escape closes the comparison. Finding buttons focus the named components. The report and exact images travel with project JSON exports and local saves.

The API checks the candidate fingerprint, JPEG bounds, image dimensions and known part IDs before calling the provider. Stored image hashes bind the report to the bytes it received. These integrity checks do not prove that a third-party imported report came from the provider; JSON exports are editable.

WebGL review renders preserve source materials. When WebGL is unavailable, a local depth-buffered triangle renderer draws the same geometry with base colors and supports orbit, zoom, isolation and pixel-accurate picking. The fallback explicitly omits texture maps and physically based finishes. Its rasterization is tested; a forced software-only browser session was not exercised in this verification. GPU rendering and the live image-review flow were observed in the current browser.

## Connected editing

The component inspector has an **Attached to** control. A mount stores a normalized anchor in its parent's local geometry bounds and a relative rotation. Parent movement, rotation and geometry resize carry mounted descendants; directly moving a child updates its anchor. Detaching or deleting a parent preserves the child's current world placement. Unknown parents, cycles and inconsistent transforms are rejected. A mechanical or electrical relationship alone does not silently create a rigid mount.

The general AI patch endpoint also enforces selection scope: a selected-part edit cannot change another existing component directly. Mounted descendants can still follow their parent. The dedicated whole-assembly conversation can intentionally coordinate several parts.

## Data and evaluation

This builds on the existing pinned collection of 14 CAD components from Espressif, NopSCADlib and BOSL2, and 2,407 CC0 Smithsonian object references. Source dimensions, identities and attribution stay attached to sourced geometry. The generated fan used the real 608 bearing; the sensor repair retained the official ESP32-C3 geometry. Museum exterior scans do not supply trustworthy internal parts. See [catalog provenance](CATALOG.md).

`tests/fixtures/quality-briefs.json` contains twelve evaluation briefs. The app does not read them as templates or training data. Two have live Argon evidence, two have local geometry/mount regression coverage, and eight are explicitly unrun. This is not a measured twelve-case generation success rate.

Observed software results:

| Case | Evidence | Result |
|---|---|---|
| Misplaced module in a real saved desk sensor | Two live reviews, six recorded images | Argon reported one placement issue, moved only the ESP32-C3 module onto the carrier board, mounted it, then reported zero issues in the new renders. Other geometry, IDs and source identity were retained. |
| Fresh desktop-fan prompt | Live generation and automatic three-view review | Eleven selectable parts, 91 custom solids, a sourced 608 bearing and eight explicit mounts. The first review reported no issue requiring a repair. |
| Parent edit in the production browser | Export before, after and after undo | Moving the motor housing up 5 mm moved its motor, sourced bearing and grille by the same amount. One undo restored the exact original document and review report. |
| Cancellation and save restoration | Browser UI and project exports | Cancelling a pending visual review preserved the exact saved document. Reload and import restored recorded views and findings; Escape closed the full comparison. |

The sensor's 1-to-0 change is a model finding count for this case, not an engineering accuracy score. Neither live run establishes manufacturing tolerances, realistic fastening, structural performance, electrical compatibility, firmware behavior or physical operation.

## Run and reproduce

Use the existing server-only `GEMINI_API_KEY` and pinned `GEMINI_MODEL=gemini-4-argon` configuration. No new key or dependency is needed. The image-input format follows [Google's image-understanding documentation](https://ai.google.dev/gemini-api/docs/image-understanding), checked October 24. The review operation is bounded to 180 seconds; each server review has its own provider and request deadlines. Generation still depends on provider latency; this revision does not promise a fixed generation time.

```bash
npm test
npm run typecheck
npm run build
npm start
node scripts/evaluate-quality.mjs docs/sponsor-sprint/2026-10-24-quality/reviewed-sensor.part.json docs/sponsor-sprint/2026-10-24-quality/sensor-placement-challenge.part.json
node scripts/evaluate-quality.mjs docs/sponsor-sprint/2026-10-24-quality/reviewed-fan.part.json
```

275 tests passed; four billable opt-in suites were skipped. The live browser runs above were performed separately. The evaluator checks image integrity, requirement coverage and optional baseline preservation; it does not authenticate provider output or certify hardware. [Dated verification packet](sponsor-sprint/2026-10-24-quality/verification-report.md).

The pre-change source archive is `../../work/lumi-preserved/lumi-before-quality-2026-10-24.tar.gz (relative to the app root)`. The sibling `part-explode` checkout remains untouched. Credentials, dependencies and build output are excluded from the archive.
