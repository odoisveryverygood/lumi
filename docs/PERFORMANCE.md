# Local inference and generation improvements

As of October 23, 2026. These changes are local and have not been deployed.

## What changed

- Custom object creation always asks Gemini for the exact requested object. The former generated-keyboard shortcut is removed. Curated source assemblies remain explicit gallery choices.
- The same Gemini 4 Argon can use Priority processing through the Interactions API. Requests are stateless (`store:false`). Actual served tier, elapsed time, first text, token usage and estimated cost are recorded separately from the requested tier. A provider downgrade is reported honestly; application code does not retry a Priority failure on another model.
- Compact numeric solid arrays remove repeated JSON property names. Every shape, coordinate, rotation and material is expanded and validated before use; there is no shared-object template substitution.
- Individually complete, schema-valid parts appear in a temporary 3D preview as the model streams. Incomplete references are excluded from this preview. Only a complete assembly with validated relationships, actions and mechanisms replaces the saved object. Cancellation or failure restores the existing assembly.
- Progress displays real received component names and elapsed time. Editing and export wait for the checked final assembly. No invented completion percentage is shown.

## Observed results

One sequential, same-prompt cassette-player comparison, one model call per tier, before the compact representation:

| Metric | Standard | Requested Priority |
|---|---:|---:|
| Actual served tier | Standard | Priority |
| Full generation | 99.109 s | 91.178 s |
| First text | 4.529 s | 1.444 s |
| First complete part | 12.582 s | 12.520 s |
| Selectable components | 14 | 14 |
| Procedural solids | 121 | 114 |
| Relationships / mechanisms | 7 / 1 | 8 / 1 |
| Output tokens | 9,690 | 9,898 |
| Estimated model cost | $0.0991 | $0.1821 |

Priority completed about 8% sooner in this single comparison. This is not a statistically established speedup. Both generated graphs passed software validation; counts do not establish equal visual quality or engineering accuracy.

A subsequent compact-format browser run produced 14 cassette-player components and 132 solids, using 9,266 output tokens, in 107.644 s on actual Priority. This run was slower. We therefore do not claim that compact output has proved lower end-to-end latency. Lossless offline re-encoding of the exact 121-solid baseline reduced its JSON from 27,989 to 21,948 bytes (21.6%) without removing geometry.

The post-fix local browser test generated a different six-part, 51-solid lamp in 45.712 s. Two parts were visible by a sampled 18 s observation and five at 34 s, correctly fitted in frame. Direct 3D selection worked; a 12 mm base move and Undo were verified against exported documents. This smaller object is not a same-workload speed comparison. See the [dated verification packet](sponsor-sprint/2026-10-23-priority/verification-report.md) for screenshots and exact evidence.

A small preliminary request asked for Priority but was served Standard. Requests can be downgraded by the provider. More API keys alone do not establish faster single-request inference or a larger balance.

## Server configuration

Keep the existing key server-side and pin the model. The local private environment is configured for Priority. The public example defaults to Standard so copying it does not silently opt into higher pricing.

```dotenv
GEMINI_MODEL=gemini-4-argon
GEMINI_TRANSPORT=interactions
GEMINI_SERVICE_TIER=priority
# Optional sanitized server timing logs:
# FLARE_LOG_INFERENCE=1
```

Use `GEMINI_SERVICE_TIER=standard` to keep the same model at Standard processing. Priority always selects Interactions. Removing both new settings retains the original generateContent Standard transport. A Priority access error is surfaced; no extra model call is automatically purchased as a fallback. The existing bounded generation repair loop may make up to three model calls when a full result fails structural validation, within the overall request deadline.

Cost estimates use published Argon token prices, actual tier when available, and reported usage. They are not an invoice, account-balance check or spending limit. Unknown tiers use the requested rate conservatively. First-token time is unavailable for non-streamed calls. Official references: [Priority](https://ai.google.dev/gemini-api/docs/priority-inference), [Interactions](https://ai.google.dev/gemini-api/docs/interactions-overview), [pricing](https://ai.google.dev/gemini-api/docs/pricing).

## Reproduce

`npm test`, `npm run typecheck` and `npm run build` do not call the provider. The ordinary suite skips both live provider tests.

`npm run benchmark:inference` explicitly makes two billable Argon calls using the same cassette prompt, one per tier, with no repair calls. It saves each run in a new timestamped directory under `../../work/flare-speed-benchmark/`. Do not run it as a normal CI check. The saved original comparison predates the compact prompt; new runs use the current code and are a new experiment.

Full generation remains variable and can take over a minute. Streaming improves how soon real work is visible; it does not remove the time required to generate and check the entire object. Illustrative geometry remains distinct from manufacturer CAD and physically verified hardware.

## October 23: exact-request sofa latency fix

The generator now uses a bounded declarative repeat operator for regular geometry (rails, buttons, vents and connector pins), expanded to the same ordinary solid representation before validation or rendering. Every request still gets new custom geometry from Argon. Existing imports, saved projects and individual part editing retain their full expanded format. The decoder derives redundant zero rotations, geometry envelopes, role text and empty metadata when omitted, rather than asking the model to emit them repeatedly.

The generation instructions now use furniture-scale coordinates when needed and focus on the actual requested functions. They no longer encourage adding unrequested motorized mechanisms merely to create an animated object. Distinctive geometry remains the priority; simple duplicate rows are short recipes, not lost detail or object presets.

Validation repair now receives the actual failed candidate and a list of issues, and returns small literal replacements. It cannot replace the complete document or the whole parts array. One initial generation has a 180-second ceiling, with at most two 35-second targeted corrections, still bounded by the existing overall route deadline. There is no full-object regeneration repair loop. Invalid JSON, failed corrections or cancellation do not commit a partial document. Timeout wording permits retrying the same request without asking the user to choose a simpler object.

The same-prompt live baseline (`Build a smart sofa with an iron base and an ESP32.`) completed in 149.782 seconds, with the first complete part at 21.464 seconds, 14 selectable parts, 180 solids and 13,336 output tokens. It added a motorized recliner, scissor linkage and Qi charging although those were not in the input. New results and validation are recorded separately in `sponsor-sprint/2026-10-23-sofa-latency/`; one timing comparison does not establish a latency guarantee or equal visual quality.

The successful updated API check completed in 78.214 seconds (first complete part9.178 seconds,14 parts/247 solids/18 relationships/5 steps,6702 output tokens). A subsequent fresh creation through the actual production browser form completed in87.072 seconds with15 parts/254 solids/19 relationships/6 steps and7069 output tokens. Both were served by Priority Argon. The browser result was independently selected, toggled between assembled/exploded, exported through the UI and revalidated from the downloaded bytes. The final browser run was about42% faster than the150-second baseline. These are small-sample observations, not a guarantee; generated details differ between runs.

An earlier updated browser attempt received output in82.212 seconds but failed decoding and retained the saved object; it is recorded in `browser-attempt-1.json`. The generation instructions were corrected to show valid literal JSON and forbid arithmetic/comments; the exact raw response from that failed run was unavailable, so its precise parse defect is unknown. The final flow was then retested successfully. The shared relationship graph is also used for the selected-part connection count, so omitting repeated per-part links does not make a connected ESP32 appear disconnected.

## October 25: generation reliability

JSON MIME mode no longer silently inserts `{type:"object"}` as a schema. A real robot-dog diagnostic returned only `{}` with that schema. Callers with a real response schema retain it. The model, tier and thinking configuration are unchanged.

New-object generation now removes trailing commas outside strings locally. Other malformed JSON can receive unique literal syntax edits; complete valid parts must survive unchanged. Parseable candidates use the existing targeted structural repair. Both kinds share the same maximum of three model calls and a 250-second generation deadline. Unfinished geometry is not invented, templates are not substituted, and cancellation, provider failures and exhausted corrections preserve the saved object. Deeply incomplete responses can still fail.

Final performance totals include all successful model calls in the generation/repair operation. Missing usage stays unknown rather than becoming zero. Transport cancellation also interrupts a stalled streaming body after headers arrive.

A fresh `a robot dog` request through the actual streaming route passed schema validation with 18 parts and 234 solids in 106.583 seconds. The failed initial run is retained alongside that result. This is one successful generation, not a broad reliability rate or a latency improvement claim. Browser review evidence and exact checks are recorded in [the teammate 1 handoff](team/README_TEAMMATE_1.md).
