# Independent evidence, maker usefulness and demo readiness — teammate 3

Revision `226f792` (`origin/codex/lumi-team-handoffs`), checked October 25, 2026, locally on Node 24.18.1. No key, no deployment, no push. This is the independent reviewer's record; it does not restate teammate 1's or teammate 2's claims as verified.

## What was run on this exact revision

| Check | Result | Evidence |
|---|---|---|
| `npm test` | 322 passed, 6 opt-in suites skipped | [tests.txt](tests.txt), [local-verification.json](local-verification.json) |
| `npm run typecheck` | passed | [typecheck.txt](typecheck.txt) |
| `npm run build` | passed | [build.txt](build.txt) |
| Held-out dataset tests | 9 passed | [holdout-tests.txt](holdout-tests.txt) |
| Offline recomputation of the October 24 exports | 5 of 5 passed | [offline-evidence-verification.json](offline-evidence-verification.json) |
| Browser acceptance without a provider | 5 flows passed, 7 not run | [browser-acceptance.json](browser-acceptance.json) |

The historical counts quoted in the handoff (320 and 322 tests) were not reused; the 322 above is from this revision.

## Work package A: does the feedback loop help?

The October 24 exports already record, for every trial, the candidate before any rendered feedback and the candidate retained after the loop, scored by the same independent fixture oracle. [`scripts/compare-feedback-loop.mjs`](../../../scripts/compare-feedback-loop.mjs) pairs them. Raw counts, oracle version 2, no model prose read:

| Category | Trials | One pass passed | Full loop passed | Fail → pass | Pass → fail | Not scored | Review calls | Elapsed |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| Seeded repairs (full run) | 16 | 0 | 15 | 15 | 0 | 0 | 30 | 685 s |
| Fresh live edits (full run) | 4 | 2 | 2 | 0 | 0 | 2 | 2 | 218 s |
| Negative controls (full run) | 4 | 0 | 0 | 0 | 0 | 0 | 3 | 78 s |
| Seeded repairs (follow-up) | 2 | 0 | 2 | 2 | 0 | 0 | 4 | 64 s |
| Fresh live edits (follow-up) | 4 | 4 | 4 | 0 | 0 | 0 | 4 | 148 s |
| Negative controls (follow-up) | 2 | 0 | 0 | 0 | 0 | 0 | 2 | 89 s |

Reading, with definitions: "passed" is the independent oracle on known fixture geometry and protected parts. "Not scored" is a trial whose one-pass edit failed before any candidate existed (one provider timeout, one invalid response after repairs); both are retained as failures.

- **Seeded repairs:** the loop converted 17 of 18 deliberately broken layouts and regressed none. The one miss was a planning timeout. This measures the repair loop, because the one-pass failure is by construction.
- **Fresh edits:** every scored one-pass candidate (6 of 6) already passed. The loop changed nothing and added one review call per trial. There is no recorded case of the loop improving a genuine model edit.
- **Negative controls:** neither condition manufactured a pass; one historical provider error is counted as a failure, not a refusal.
- **Equal-call text-review control:** not run. Nothing in the product gives the same candidate the same extra budget without images, so the export cannot separate the effect of images from the effect of measurement and extra calls. This remains open.
- **Cost:** token counts are not in the export. Per trial the loop added one planning call plus one to three review calls; elapsed times above include failures.
- **Model comparison:** not run, not claimed.

Files: [full-paired-comparison.json](full-paired-comparison.json), [followup-paired-comparison.json](followup-paired-comparison.json), [full-evaluation-summary.json](full-evaluation-summary.json), [followup-evaluation-summary.json](followup-evaluation-summary.json).

### Frozen held-out task set, version 1

[`lib/studio/holdout-tasks.ts`](../../../lib/studio/holdout-tasks.ts) defines ten unseen variations with their own geometry-only oracle: four seeded repairs (rotated module outside, module through a side wall, overlap along Z, bracket 1 mm from the port), three fresh edits (5 mm and 2.5 mm battery envelopes, a compound two-clause separation on an unbroken layout) and three expected refusals (12 mm clearance in a 24 mm interior, a contradictory request, a housing with no floor). [holdout-tasks.v1.json](holdout-tasks.v1.json) is the packet copy; a test pins its SHA-256 and fails if the module or packet changes without a new version. Tests prove each seeded fixture fails only its requirement, a genuine correction passes, cheats (shrinking, moving the housing, dropping a part, pushing another part outside, size-only resizes, replacing source mesh, dropping the requested rotation) fail, and refusals score as correct only when nothing changed. A test also fails if any generation, planning, review or component code imports the module.

**The held-out set has not been run live.** Running it needs a small runner in the `/evaluate` tool (teammate 3 owns that change but must coordinate the shared UI) and the key. Until then there is no held-out result to quote.

## Work package B: maker usefulness

Not run. No participant has been recruited. [`docs/maker-study/records.csv`](../../maker-study/records.csv) holds the header only, with a [README](../../maker-study/README.md) defining each column and the rule that rows come from real sessions scored by the oracle, not impressions. Sample size must be stated next to any future result.

## Work package C: real browser acceptance

Done through the UI on a dev server without a key: save/reload of a reviewed project, the Review panel's evidence (checks, focus, full-size images, Escape), the unconfigured-provider path for review and for fresh creation, the retained-draft and return-to-saved-object behavior, and undo/redo compared by document data. The saved object was byte-identical in every failure path. Details and the seven unrun flows are in [browser-acceptance.json](browser-acceptance.json).

One observation for the owner, not a defect by the documented rules: with no provider, Review leaves a draft whose report is `incomplete` with an error, and the footer still offers **Use this draft**. Accepting it would store an incomplete report on an unchanged document. Consider hiding or relabeling that button when no review round was recorded.

## Work package D: three-minute pitch

[`docs/THREE_MINUTE_DEMO.md`](../../THREE_MINUTE_DEMO.md) was rewritten for Lumi's implemented Review workflow, with the observed numbers above, explicit limits, fallbacks and a list of claims not to make. It has not been timed live; [demo-rehearsal.json](demo-rehearsal.json) is empty until a rehearsal with the key.

## Blocking opinion on integration

Nothing blocks on what was measurable here. What cannot be signed off: live fresh creation (the robot-dog regression is still only a known gap), live held-out results, any motion verification (no branch yet), timeout recovery, the human study, and the demo timing. Each needs a key or a person.
