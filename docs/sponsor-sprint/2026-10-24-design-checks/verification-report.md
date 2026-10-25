# Lumi measured edits: verification record

Local revision, October 24, 2026. Existing Gemini 4 Argon server configuration; no new dependency, key, deployment or push. The pre-change copy is archived and the original sibling `part-explode` checkout remains clean.

## Scope

A maker can ask for supported geometric edits and see what actually changed. Argon interprets the request into fixed goals. Application code measures actual geometry, retains valid original enclosure placements and enforces protected shapes. The visual review receives those measurements and three rendered views, proposes a scoped correction, then checks another render. Required failures and unknowns cannot become an automatic success through a positive visual description.

The existing Review panel shows **Original → First attempt → Retained**, the quoted request, numeric limits, measurement explanations and focused components. The baseline, exact images and comparison framing travel with exports. The draggable animated companion and existing source design workflow remain available.

## Repeated live evaluation

The complete frozen run finished with **24 of 24 trials recorded**, no cancellations and no queued cases. [Full export](full-evaluation.json), [summary](full-summary.json), [offline recomputation](full-evidence-recompute.log), [results screenshot](full-run-results.png). Task definitions remain dataset version 1; final acceptance uses oracle version 2, adding original containment and rotated-envelope checks. The [source manifest](final-run-source-manifest.json) was saved before the run; implementation changes require a new run or an explicitly scoped follow-up.

| Category | Completed | Passed | Failed | Median / maximum elapsed |
|---|---:|---:|---:|---|
| Deliberately seeded repairs | 16 | 15 | 1 | 35.0 / 88.9 seconds |
| Fresh live AI edits | 4 | 2 | 2 | 47.8 / 90.0 seconds |
| Expected negative controls | 4 | 3 | 1 | 18.4 / 37.8 seconds |

The run recorded **35 actual reviews and 105 image hashes**, all with consistent locked comparison framing. The independent oracle and image/document checks recomputed successfully. The four failed attempts were a fresh-edit timeout, an invalid fresh-edit response after its bounded correction attempts, a planning timeout for battery separation and a provider error while preparing the unsupported-interior case. None counts as a successful repair or correct refusal. These results do not establish consistently successful live service. [The source remained frozen](full-run-source-check.json).

The twelve fixed cases run twice. Eight deliberately seeded defects cover sourced Espressif modules outside or through an enclosure floor, battery/module separation and charging access. Two fresh live edits resize authored battery geometry. Two negative controls require an impossible source resize or unsupported enclosure evidence. These three categories stay separate. Seeded initial failures are by construction; they are not initial model-generation failures. Authored enclosure, battery, board and interface envelopes are controlled software studies, not manufacturer CAD or customer results.

The task oracle uses known fixture geometry and protected components, without reading model opinions or the planned check results. Offline tests recompute it from the downloaded artifact, validate document and contract fingerprints, and verify every image hash and locked camera. Hashes establish byte consistency; editable JSON is not authenticated proof of a provider response.

## Scoped follow-up

After preserving the complete run, two runtime changes were made: provide actual existing procedural shapes for whole-object edits, and retry one transient planning timeout within the existing two-attempt bound. A regression established the missing-geometry context. The exact invalid provider output was not retained, so it cannot be attributed solely to that missing context. The timeout retry and nonretry behavior for quota/cancellation have mock regression coverage. Neither change weakens geometric acceptance. [Follow-up source manifest](followup-source-manifest.json).

The separate follow-up completed **8 of 8 trials with no failures**: 4/4 fresh edits, 2/2 seeded separation repairs and 2/2 expected unsupported-interior refusals. It recorded 10 actual reviews and 30 images, with frozen source and consistent camera framing. The independent oracle and image/document checks recomputed successfully. [Export](followup-evaluation.json), [summary](followup-summary.json), [recomputation](followup-recompute.log), [source check](followup-source-check.json), [results screenshot](followup-results.png).

Fresh edits took a median 39.0 seconds (maximum 45.3); seeded repairs 31.8 (maximum 40.2); negative controls 44.5 (maximum 53.2). This small targeted subset is not another full 24-trial result, a statistically established improvement, a guaranteed latency or evidence of general superiority. Provider variation may affect the difference. Historical failures remain in the full export. The updated full 24-trial matrix was not rerun.

## Failures retained during development

The [first smoke](smoke-evaluation.json) moved the sourced C3 module into the controlled enclosure with the required 1 mm margin, measuring **−41.6 → 3.8 mm** while preserving source shape and unrelated parts. This historical smoke preceded camera locking and baseline placement retention.

The [first batch](first-batch-with-contract-bug.json) was interrupted after 11 completed trials: 3 of 10 positive trials passed, 7 failed before image review, one negative control was correctly blocked, one trial was cancelled and 12 remained queued. The cause was a contract serialization defect: automatically added shape locks were hashed before schema normalization. The normalized JSON no longer matched the hash. This was an application failure, not seven completed model repairs. The [diagnosis](first-batch-diagnosis.json) and failed artifact remain intact. The fix normalizes before hashing; a regression crosses the JSON boundary for every fixed task. Task prompts and geometry were not changed to improve results.

## Local and normal-workspace checks

- **320 regression tests passed**, with six opt-in suites skipped by default. Four are existing billable provider suites; two read saved evidence and were exercised separately. TypeScript and the production build passed. [Latest local record](release-local-verification.json), [tests](release-tests.log), [TypeScript](release-typecheck.log), [build](release-build.log). The [earlier local record](local-verification.json) remains available.
- A normal import restored the accepted controlled study's measurements, quotes and recorded views. Focusing a clearance check focused the source component and brought up Lumi's contextual guidance. The full-size comparison opened and Escape closed it. Export and reload preserved the exact parsed document and report. [Browser record](ui-save-verification.json), [normal project export](ui-saved-study.part.json), [offline recomputation](saved-project-recompute.log), [screenshot](measured-review-ui.png).
- In the first 70-part Corne source-CAD study, the requested geometric checks passed after one correction: enclosure margin −36.6 → 1.8 mm; PCB separation 1.8 mm; insert separation 0.7 mm, each against 0.2 mm. The original 69 keyboard components were exactly retained. Automatic acceptance correctly remained blocked by inconsistent envelope metadata on existing authored reference parts. The flagged draft was applied only to export its evidence, then undo restored the original exactly. [Draft export](corne-first-flagged-draft.part.json), [verification](corne-first-case-verification.json), [recomputation](corne-first-recompute.log).
- The reference data was corrected for 42 authored procedural parts by deriving size metadata from the existing rendered shapes. No shapes, poses, source mesh data or source dimensions changed. Original nominal dimensions remain in specs. The check was not weakened. [Before audit](corne-bounds-before.json), [repair audit](corne-bounds-repair.json), [original reference](corne-reference-before.json), [release source check](reference-release-source-check.json). The script is `scripts/audit-reference-envelopes.ts`; this does not migrate or rewrite user projects. The first corrected-reference attempt timed out during its second visual review and preserved the saved object; [timeout text](corne-corrected-timeout.txt) and [screenshot](corne-corrected-timeout.png) remain in the packet. The normal **Review again** retry was then automatically accepted in **66.9 seconds**, after two actual reviews and six recorded images. Its measured enclosure margin improved **−36.6 → 2.0 mm**, PCB gap became **2.1 mm**, and insert gap **0.4 mm**, against the requested **0.2 mm**. All 69 original keyboard components and the sourced radio geometry remained exactly unchanged. One undo restored the exact corrected baseline; redo restored the exact accepted document and report. Reload restored the saved six-check report. [Accepted project](corne-reviewed.part.json), [UI verification](corne-ui-verification.json), [offline recomputation](corne-recompute.log), [final screenshot](corne-measured-ui.png). This is a recorded retry, not a first-attempt or general reliability claim.

## Packet checks

The structured [sprint record](sprint.json) distinguishes local gates, live evidence, the failed older full-matrix reliability diagnostic and unrun human/physical work. Required checks concern the scoped implementation and recorded verification; they do not assert every live request succeeds. The full matrix was not rerun on the final code.

## Limits and remaining evidence

These are software geometry and live API results. Conservative bounds can reject a layout that needs closer CAD inspection. Arbitrary imported interiors stay unverified. Access checks establish a straight modeled corridor, not cable bends or ergonomics. AI mapping of parts and axes remains an interpretation. The registered Corne region is a bounded design-study region with source triangle and floor checks, not a general interior inference algorithm.

No manufacturing, structural, RF, electrical, firmware or physical hardware result is established. The illustrative battery edits do not shrink a commercial battery or preserve its capacity. No human preference, time-savings or maker usefulness result is invented. [The maker study protocol](../../MAKER_STUDY.md) is prepared but has not been run or sent to anyone. No hackathon score or win is guaranteed.

Run commands and supported measurement details are in [MEASURED_EDITS.md](../../MEASURED_EDITS.md). The full fixed evaluation is available locally at http://127.0.0.1:3001/evaluate; the normal workspace is http://127.0.0.1:3001.
