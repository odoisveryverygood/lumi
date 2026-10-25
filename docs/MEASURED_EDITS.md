# Lumi measured design edits

Local revision, October 24, 2026. This revision is not deployed. Open http://127.0.0.1:3001.

Describe a geometric design change, or open **Review** and give the object a design brief. Argon maps the request to supported checks. Application code measures them from the modeled geometry, and the checks stay fixed while Argon proposes corrections. The existing source keyboard Design Lab remains available with its specialized source-document, charging and layout checks.

## What changed

The general object workflow now prepares a design contract before image review. Whole-object editing receives the current editable procedural shapes, rather than only part dimensions and shape counts. Every proposed check quotes the original request, uses existing component IDs, and retains numerical limits expressed in millimetres or centimetres. Basic coverage checks reject omitted recognizable containment, preservation, access, separation and maximum-size clauses. Request-to-component and request-to-axis mapping is still an AI interpretation, shown with the evidence; it is not an independently proved understanding of arbitrary language.

Supported geometric checks are:

| Check | What is measured | Boundary |
|---|---|---|
| Enclosure placement | A conservative component envelope inside a supported interior, including requested clearance | Five actual box floor/wall faces, or the registered Corne study region with source triangle and floor-coverage checks. Arbitrary outer bounds are never treated as free interior space. |
| Internal structure conflict | The placed envelope against the enclosure's actual available solid or mesh geometry | Conservative envelopes can reject a shape that would need closer CAD inspection. This does not certify fastening or physical tolerance. |
| Maximum dimension | Actual local primitive/source-mesh bounds | Size metadata alone cannot produce a pass. Primitive minimum dimensions match the renderer. |
| Separation | Conservative world-space component envelope gap | Negative values indicate envelope overlap, not an exact physical surface intersection. |
| Straight access | A corridor from the named interface's interpreted local face against available obstacles | This does not verify connector identity, cable bend radius, finger reach or real ergonomics. Unsupported imported geometry stays unverified. |
| Preservation | Original component shape, or shape and placement | Source identities and canonical dimensions remain protected. A move-only request also freezes original shapes, so shrinking a part cannot disguise a successful move. |
| Established placement | Supported interior placements that were valid in the original design | A correction cannot solve one gap by pushing another originally contained part outside. Explicit outside/removal requests may release a named placement using a quoted request. |

An unknown required check leaves an inspectable draft. A positive visual opinion cannot override a failed or unknown required measurement. Electrical operation, firmware, RF behavior, structural loads and manufacturing tolerances require separate evidence and are not certified by these checks.

## The repair loop

1. Keep the original object and request. Prepare and validate the checks, including baseline preservation rules. Planning allows two attempts total, including one retry for a transient timeout; quota and cancellation are not retried. The existing operation deadline still applies.
2. Render assembled, top and exploded views from the actual geometry. Lock each comparison camera's center and scale for subsequent revisions.
3. Send the images, fixed checks, component data and measured failures to Gemini 4 Argon.
4. Validate its scoped correction. Existing source meshes cannot be resized; protected components may only be restored to their original geometry when a proposal changed them incorrectly.
5. Render and measure again. At most two corrections and three reviews are allowed. A revision that introduces a new issue is not retained as the best result; a remaining scoped correction can still be reviewed within that bound.
6. Accept only a reviewed result with passing required checks. Otherwise retain a separate draft and keep the saved object intact. Undo restores the complete previous object after an accepted change.

The bundled Corne reference also has corrected envelope metadata for 42 authored parts; the actual geometry and source dimensions are unchanged, and original nominal sizes remain in specs. Older saved projects keep their own data and may still show the original envelope warning. Reopen the updated reference for the corrected source study.

The existing Review panel shows **Original → First attempt → Retained** numerical results, exact request quotes, measurement explanations, linked parts, actual review images and revision history. No extra pet controls were added. Source snapshots, checks, image hashes, camera framing and the bounded original project travel with new project exports. Large baselines beyond the embedded snapshot bound need the original file for independent reproduction.

## Fixed-task evaluation

The local engineering tool is http://127.0.0.1:3001/evaluate. It is separate from normal generation and is not linked as another primary workspace control. It runs real API requests and actual geometry renders sequentially using the existing server key. It makes billable calls; repeats are bounded to one, two or three.

The twelve fixed cases in `lib/studio/evaluation-tasks.ts` cover two sourced Espressif module sizes, enclosure placement, floor intersections, battery envelope edits, separation, access and expected refusals. The enclosure, board, battery and interfaces are authored evaluation envelopes. They are explicitly not manufacturer CAD or customer results. Generation and review do not import these tasks as response templates.

The report separates:

- **Seeded repairs:** authored defects deliberately present in the input. Their initial failure rate is by construction and must never be advertised as a model's initial-generation error rate.
- **Fresh live edits:** a real `/api/device` edit produces the first attempt, then the review loop checks it.
- **Negative controls:** impossible source resizing and unsupported enclosure evidence must remain blocked or unverified, with original geometry intact. They are not counted as positive task successes.

Task acceptance is recomputed against the fixture's known geometry and preserved parts, without reading model observations or the planned contract. Oracle version 2 additionally checks that components originally inside the known enclosure stay inside, and handles rotated envelopes. Earlier exports without an oracle version retain version 1 interpretation. Task geometry and prompts were not changed to improve the results.

Every attempted failure, cancellation and queued/unrun case remains in the export. **Download current evidence** can save a checkpoint during a run. Human ratings are left null. This benchmark is a controlled software test, not a representative sample of all hardware or a maker usefulness study.

## Reproduce and inspect

```bash
npm test
npm run typecheck
npm run build
npm start
# Run the fixed cases from /evaluate and download their complete evidence.
node scripts/summarize-design-evaluation.mjs /absolute/path/lumi-design-evaluation.json
LUMI_DESIGN_EVIDENCE=/absolute/path/lumi-design-evaluation.json npx vitest run tests/evaluation-evidence.test.ts
# Recompute a normal exported project's design checks and exact image associations.
LUMI_PROJECT_EVIDENCE=/absolute/path/device.part.json npx vitest run tests/project-design-evidence.test.ts
```

The offline checks make no provider calls. Image and document fingerprints establish byte associations and detect inconsistencies; an editable JSON file is not authenticated proof of a provider response. The local dated packet retains the initial successful smoke, an interrupted batch that exposed a contract-hash bug, its diagnosis, and the subsequent frozen implementation and results. See [the evidence packet](sponsor-sprint/2026-10-24-design-checks/verification-report.md).

The pre-change source archive is `../../work/lumi-preserved/lumi-before-design-checks-2026-10-24.tar.gz`, relative to the app root. The original sibling `part-explode` checkout remains preserved. No additional key or dependency was required.
