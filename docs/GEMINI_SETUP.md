# Gemini setup — October 25, 2026

Installed Google's `gemini-api-dev` and `gemini-live-api-dev` skills in the Codex skills directory. They become discoverable on the next turn. The Live API skill is installed for future voice work; no new microphone feature was enabled.

Lumi now uses official `@google/genai` 2.31.0 for Interactions calls. It keeps the existing server-only key, pinned Argon model and configured Priority/Standard tier. The older generateContent transport remains explicitly selectable for existing integrations. SDK automatic retries are disabled so existing application retry bounds remain authoritative.

Argon generation/review defaults to `thinking_level: medium`; targeted requirement extraction uses `low`. `high` is available through the typed generation option or server-only `GEMINI_THINKING_LEVEL`. Sampling parameters are omitted on Interactions. Argon requests receive at least 32,768 total reasoning/output tokens, following the current guide; this is an allowance, not a promise that each request spends that amount. JSON requests set the JSON MIME type. A concrete caller-supplied schema is included only when one is provided; a synthetic empty object schema can constrain the model to `{}` and is never inserted. All outputs still pass application validation.

Normal calls retain `store: false`. Explicit `background: true` calls use stored server jobs and bounded polling, and attempt server cancellation when the caller aborts. These jobs are opt-in; background execution is not enabled globally or exposed as another UI control. Long decode requires background execution, and the provider's 1M window is shared with the input. Lumi's own assembly, size and response limits still apply. No million-token output or long-job reconnection UI has been claimed or tested.

Live synthetic checks verified a streaming and a background Argon SDK call, both returning the required JSON, in approximately 3.8 and 4.0 seconds. These are API setup checks, not robot-dog generation or full demo-readiness results. Sanitized evidence: `work/gemini-setup-live.json`.

Reproduce without printing credentials:

```bash
node --env-file=.env.local node_modules/vite-node/vite-node.mjs scripts/verify-gemini-setup.ts
npm test
npm run typecheck
npm run build
```

Official references: [skills](https://github.com/google-gemini/gemini-skills), [Argon guide](https://ai.google.dev/gemini-api/docs/latest-model), [thinking](https://ai.google.dev/gemini-api/docs/interactions/thinking), [background execution](https://ai.google.dev/gemini-api/docs/background-execution).

This setup does not claim hackathon credits, install Antigravity, deploy the app, or implement motion verification. The teammate 1 reliability changes add bounded syntax recovery and full-stream cancellation. See `team/README_TEAMMATE_1.md` for current live evidence and remaining limits; the earlier synthetic setup checks alone did not exercise generation.
