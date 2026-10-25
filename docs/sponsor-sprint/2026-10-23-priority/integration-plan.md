# Local generation performance integration

As of October 23, 2026. Work is confined to `outputs/flare-grounded`; the original sibling and production deployment are preserved.

The user requested faster and better one-prompt custom objects, retained strong Gemini reasoning, and prohibited deployment. This change uses the existing Gemini credential and pins `gemini-4-argon`. No new key, model downgrade, concurrency fan-out, installed dependency or deployment is needed.

## Implementation

1. Add an Interactions transport with stateless requests, optional Priority, actual served-tier tracking and sanitized usage/timing. Keep Standard legacy transport compatible.
2. Remove the generated-keyboard shortcut. Model output must supply the exact custom object; curated source references remain explicit choices.
3. Encode generated solids compactly, then expand and validate every coordinate/material using existing geometry schemas.
4. Stream only independently complete schema-valid components into a temporary scene. Commit the full assembly only after graph/action/mechanism validation. Failure, timeout and cancellation preserve the previous saved object.
5. Compare two full same-prompt generations, once per tier without repairs; test the actual browser flow separately. Preserve outcomes even when they do not demonstrate a speedup.

The requested tier is server configuration, not a browser-supplied billing parameter. Provider Priority rejection is surfaced without application fallback or automatic retry. Provider downgrades are recorded as the actual tier. Explicit cache APIs were not added. Existing request limits and at most two structural repair attempts remain in place.

## Checks

C001: mock protocol tests for Interactions, multimodal attachment mapping, usage, actual tier, malformed/truncated responses and abort.
C002: local regression suite, typecheck and production build.
C003: bounded real same-prompt Standard/Priority comparison, one call each, with saved validated documents and usage.
C004: mock failure and atomic response behavior, including refusal of template substitution.
C005: local browser plus real Argon generation, streaming preview, component selection, manual edit and undo.
C006: local lossless geometry round-trip and transient preview guards.

The published comparison is a single sample, not a statistical latency or quality study. Generated geometry is conceptual; none of these checks establish physical fit, safety or working hardware. No deployment is authorized in this scope.
