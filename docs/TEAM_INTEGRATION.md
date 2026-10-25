# Team integration — October 25, 2026

The owner requested merging the three completed teammates' branches. This integration combines:

- PR #2, `teammate-1/generation-reliability` at `4652728`: bounded Argon JSON recovery, cancellation/budgets, and incremental generation progress.
- PR #3, `teammate-2/motion-verification` at `93c397e`: declared-joint motion measurement, scoped repair and re-review, preserved source geometry, recorded pose evidence.
- `teammate-3/evidence-and-demo` at `845ffdd`: independent task oracles, historical feedback-loop comparison, browser observations, maker-study materials and demo script.

The retired two-candidate generator is excluded. A compatibility parser still opens projects saved during that experiment, dropping only its retired `selection` metadata.

## Integration fixes

- A failed provider call with no completed review cannot enable **Use this draft**. Both the button and application handler enforce this. Locally measured motion also cannot be accepted as a provider-reviewed design.
- The motion evidence panel opens on the retained correction. The original and other attempts remain selectable, with their own measurements and images.
- The team handoffs and README point to the combined baseline and distinguish historical evidence from current checks.

## Verified on the combined code

- Node 24: **382 tests passed, 7 opt-in tests skipped**. TypeScript and the production build passed. Skipped tests are not counted as live verification.
- A fresh production-browser run at `http://127.0.0.1:3004/?example=motion-fan` used actual `gemini-4-argon` calls. This is an authored fan study with a deliberately lowered stand, not an arbitrary generated-object benchmark.
- Two rendered/provider review rounds completed in **66.853 seconds**. The yoke moved from **48 mm to 78 mm** within its frozen allowed edit. The initial sampled motion failed; the retained correction passed **19 poses from -45° to +45°**, at 5° increments, with **0.8153189588437844 mm** minimum sampled clearance against a 0.5 mm requirement.
- Accepted the checked draft through the UI and exported editable JSON. Independently reparsed it, recomputed every round's geometry result and document fingerprint, verified the recorded image hashes, and checked original shape/source preservation including the canonical 608 bearing. This recorded evidence is now covered by regression tests.
- UI undo exported exactly the original baseline document; UI redo exported exactly the accepted document, including its review. This compares complete JSON documents, not just success notifications.

Evidence: [fresh editable export](team-integration/evidence/live-merged-fan.part.json), [check summary](team-integration/evidence/checks.json). The images are actual recorded geometry renders. The main viewport used the supported software renderer; the recorded review frames report WebGL. No physical hardware was tested.

To reproduce: run `npm ci`, configure the server-only `.env.local` from `.env.example`, then `npm run build` and `npm start`. Open `/?example=motion-fan`, choose **Review**, and run **Inspect and improve**. An API-enabled re-run is live, variable and billable; opening saved evidence is replay. Do not describe replay as a fresh run.

## Remaining limits

- Finite pose samples do not prove continuous clearance. Declared contact exclusions remain excluded; forces, tolerances, wiring and hardware operation are unverified.
- The independent held-out set has fixture/oracle tests but has not been run as a live model benchmark. The historical seeded repairs improved 17/18 known defects; the six fresh-edit cases already passed their first attempts. Those results do not establish broad generation reliability or superiority over another model.
- There is no completed maker user study or timed full three-minute demo rehearsal yet.
- This integration uses direct Argon calls. Google Managed Agents integration and runtime access remain separate, unimplemented work.
- No Vercel deployment was requested or performed for this merge. GitHub workflows connected externally may run when main changes.
