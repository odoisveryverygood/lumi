# Teammate 1 local verification — October 25, 2026

## Outcome

Fixed the observed empty-schema SDK failure and moved malformed new-object JSON into bounded recovery. The actual `a robot dog` streaming-route request passed, followed by a separate fresh browser creation that completed automatic rendered review. No push or deployment was performed.

## Retained attempts

- `initial-empty-schema-failure.json`: original failed live request, including both unsuccessful correction attempts. A follow-up one-call diagnostic observed the raw seven-character response `{\n    }`; it was not a generated assembly.
- `successful-route.json` and `robot-dog-document.json`: after the SDK response-format correction, the same exact prompt generated 18 parts / 234 solids in 106.583 seconds. First valid part arrived at 12.073 seconds. Schema and streaming route passed. The provider did not need syntax recovery in this run.
- `browser-verification.json`: a second, fresh generation through the real browser form, producing the independent 18-part Agile Quadruped Robot Dog. Automatic review reported one supported visual finding, zero issues and zero unknown findings. Zero numeric constraints were requested; this does not imply measured fit.
- `cancelled.png`: cancellation restored the 31-part desktop and preserved the prompt.
- `robot-dog-reviewed.png`: completed browser review with actual assembled render comparisons.
- `review-after-reload.png`: project and recorded review persisted after reload.

Browser component selection, undo to the prior 75-part Corne document and redo to the 18-part robot dog were verified. Correction following direct graphics inspection: WebGL 2 was active on the Apple M4 through ANGLE Metal, the context was not lost, software fallback was off and no browser errors were recorded. The earlier startup-failure diagnosis mistakenly treated canvas fallback text in the accessibility tree as an active error. No hardware claims are made.

## Checks

- `npm test`: 341 passed, seven opt-in tests skipped. Full ordinary suite also passed under Node 24.19.0.
- `npm run typecheck`: passed.
- `npm run build`: passed.
- `LUMI_RELIABILITY_LIVE=1 node --env-file=<private-env> node_modules/vitest/vitest.mjs run tests/generation-reliability-live.test.ts`: one live test passed after the retained initial failure.
- Focused transport/recovery suite under Node 24: 65 passed.
- `git diff --check`: passed.

The tests cover conservative comma normalization, unique literal edits, preserved complete geometry, fixed call budgets, exhausted repair, cancellation, shared deadline, provider/quota failures, supplied response schemas and aggregated cost/tokens. Mocked malformed-output regressions are distinct from the real provider checks.

## Boundaries

This establishes two successful fresh requests and specific regression coverage, not universal generation reliability, a speed benchmark, continuous motion verification or physical engineering correctness. Existing independent evaluation and maker studies remain teammate 3's lane. Runtime source content hashes are in `source-hashes.json`; base revision is the merged public source.

## Stream-processing follow-up

The progressive decoder now advances a cursor through cumulative text and expands each completed component only once. The final provider snapshot is flushed even when it arrives within the progress throttle window. Geometry is still validated, previews remain transient, and final assembly checks remain unchanged. Once the parts array is closed, progress explicitly says connections, mechanisms and the guide are finishing. No model, prompt, reasoning, geometry or repair budget was reduced.

An identical 47,846-character saved robot-dog response was replayed in 96 cumulative snapshots, with one warm-up and five recorded runs. Median local parsing/decoding time fell from 73.958 ms to 3.022 ms; every expanded part matched exactly. See `stream-progress-benchmark.json`. This is a CPU microbenchmark, not a claim that a 107-second provider generation is now 24 times faster.

Follow-up validation on Node 24.19.0: 349 tests passed, seven opt-in tests skipped; type checking, production build and diff checks passed. No additional provider calls were made for the parser-only change.
