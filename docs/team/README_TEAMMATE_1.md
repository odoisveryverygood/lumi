# Teammate 1: reliable generation and provider transport

This work is local on `teammate-1/generation-reliability`, based on merged `main`. It has not been pushed, deployed or submitted as a PR. Preserve that boundary until the owner requests publication.

## Problem and resulting behavior

The previously failing `a robot dog` request exposed two separate defects:

1. Interactions JSON calls without a concrete response schema were given `{type:"object"}` automatically. A real diagnostic returned only `{}`. This passed the old synthetic transport smoke test but could not create an assembly. JSON MIME mode now omits the schema unless the caller supplied one. Explicit schemas, Argon, reasoning level, tier and stateless defaults are preserved.
2. New-object JSON parsing happened before its bounded repair loop. A malformed response failed immediately. Trailing commas outside strings can now be removed locally. Other syntax defects receive bounded, unique literal edits; they cannot rewrite complete, valid received components. Structurally invalid JSON objects still use targeted field replacements. There is no full-object regeneration or template substitution.

Generation and both repair modes share at most three model calls and a 250-second deadline, beneath the route's 270-second limit. Provider quota/auth/access failures are surfaced without automatic paid retries. Failed or cancelled requests cannot return a completed object. Stream cancellation interrupts a stalled body after response headers. Final token/cost totals include successful repair calls; missing usage remains unknown.

## Ownership and code map

- `lib/gemini-sdk.ts`: JSON response format; concrete caller schemas remain optional.
- `lib/ai.ts`, `lib/inference.ts`: transport body cancellation and timeout classification.
- `lib/studio/device-generation.ts`: one shared deadline, syntax/structure repair budget and aggregate usage.
- `lib/studio/generation-json.ts`: non-executable JSON normalization and guarded literal syntax edits.
- `tests/generation-reliability.test.ts`: malformed JSON, preserved geometry, call budgets, cancellation, quota/provider failure and cost accounting.
- Existing inference, timeout and streaming tests cover SDK fields and body cancellation.
- `tests/generation-reliability-live.test.ts`: explicit, billable opt-in through the real streaming route.

This lane does not change teammate 2's motion algorithms or teammate 3's independent evaluator. Existing project/document formats are unchanged.

## Verification and evidence

Ordinary suite: **341 passed, seven skipped**. Type checking and production build pass. The full ordinary suite and the 65 directly relevant tests also pass under Node 24.19.0. Ordinary tests do not spend API credits.

Live streaming route: the exact request `a robot dog` passed on actual `gemini-4-argon`, producing **18 parts and 234 solids in 106.583 seconds**. The original empty-schema failure and successful rerun are retained under `docs/sponsor-sprint/2026-10-25-generation-reliability/`, with the generated document and content hashes for the changed runtime sources. This is one successful request, not a broad reliability rate or proof of latency improvement. Syntax recovery was exercised by deterministic regressions; the provider did not need to emit malformed JSON in the successful live run.

Browser cancellation: started the actual form request, cancelled it, and verified the original 31-part desktop assembly and `a robot dog` prompt remained available, with an explicit cancellation message. Screenshot is retained locally in `work/generation-reliability/browser/cancelled.png`.

A second fresh browser request created the independent 18-part Agile Quadruped Robot Dog and completed automatic review of assembled, top and exploded views. Component selection, undo to the prior 75-part Corne document, redo to the robot dog, and reload with its recorded review were verified. See the [verification report](../sponsor-sprint/2026-10-25-generation-reliability/verification-report.md). A successful API response alone is not a completed browser review, working WebGL or physical hardware evidence.

## Reproduce

Use Node 24 and a private server-only Gemini environment. Never include the key in a command argument, GitHub issue, commit or screenshot.

```bash
npm ci
npm test
npm run typecheck
npm run build
# Billable: one fresh object, at most three Argon calls including repairs.
LUMI_RELIABILITY_LIVE=1 node --env-file=.env.local node_modules/vitest/vitest.mjs run tests/generation-reliability-live.test.ts
```

The live test writes a new timestamped evidence directory under ignored `work/generation-reliability/`; it does not overwrite earlier failed attempts. For browser testing, start this branch locally and use the real form. Verify progress, cancellation, retained original, completed review/draft handling and a retry using the unchanged prompt.

## Remaining limits and review requirements

- Large or incomplete output can still fail the fixed repair budget; the saved assembly must remain unchanged.
- Generation and visual review take separate time. No universal latency guarantee is made.
- The initial GPU warning in the report was a diagnosis error: fallback text was exposed by the accessibility tree while the canvas was working. Direct inspection confirmed active WebGL 2 on Apple M4, no context loss and software fallback off.
- Independent held-out evaluation, maker studies, motion verification and physical hardware validation remain separate work.
- Before any future publication, have teammate 3 exercise the exact browser flow and inspect the full evidence, including unsuccessful attempts. Create a PR from this branch; do not push to `main` or merge/deploy without the owner's instruction.

## Local stream-performance follow-up

`generation-progress.ts` now scans only new characters and expands each completed component once per request. The final snapshot is always flushed; the UI receives a truthful transition after the parts array closes. Eight additional regressions cover arbitrary character boundaries, escaped strings, reset, invalid/duplicate parts and exact real-object geometry. An identical-stream benchmark reduced median parser CPU time from about 74 ms to 3 ms across 96 snapshots. This does not measure provider latency; API calls and output quality are unchanged.
