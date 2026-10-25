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

Browser component selection, undo to the prior 75-part Corne document and redo to the 18-part robot dog were verified. The known GPU startup failure remains; displayed software geometry and review rendering do not prove working WebGL. No hardware claims are made.

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
