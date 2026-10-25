# Teammate 3: independent evidence, maker usefulness and the three-minute demo

## Your assignment

Establish whether Lumi's rendered feedback loop produces useful, better results, preserve unsuccessful attempts, and turn the verified result into a clear three-minute demonstration. You are the independent reviewer of teammate 1's reliability work and teammate 2's movement checks. You may block integration when the real browser flow fails even if unit tests pass.

This assignment is not to produce promotional scores or invent customer validation. The goal is reproducible evidence and a truthful pitch.

## Git rules — mandatory

**Do not push to `main`. Do not merge your own PR. Do not force-push shared branches. Create your own branch, push it to GitHub, and open a PR for review.**

The initial repository PR contains the current source on `codex/lumi-team-handoffs`. Until that integration PR merges, branch from it and target it in your PR. The owner must approve switching the base to `main` afterward. Do not mix an unmerged motion branch into the shared branch merely to run an experiment; test its exact commit in a separate checkout.

```bash
git clone https://github.com/odoisveryverygood/lumi.git
cd lumi
git fetch origin
git switch -c teammate-3/evidence-and-demo origin/codex/lumi-team-handoffs
npm ci
cp .env.example .env.local
mkdir -p work
# Obtain the server-only Gemini key privately. Never paste it into GitHub.
npm run dev
```

Use Node 24.x; the local app runs at http://127.0.0.1:3001. Read `AGENTS.md`, relevant bundled Next.js documentation before code changes, and `docs/GEMINI_SETUP.md` for the SDK/model configuration.

```bash
git add <your-specific-files>
git commit -m "Add independent Lumi evaluation and verified demo evidence"
git push -u origin teammate-3/evidence-and-demo
gh pr create --base codex/lumi-team-handoffs --head teammate-3/evidence-and-demo \
  --title "Measure Lumi feedback-loop results and demo readiness" --body-file work/pr-body.md
```

Use `main` as the PR base only after the owner confirms the integration PR merged. Leave your PR open for review. No deployment, publication of participant information or messaging participants is authorized by this handoff.

## Current evidence and known gaps

- `docs/sponsor-sprint/2026-10-24-design-checks/verification-report.md` records the older full run, failures, targeted retest and source-CAD workspace checks. Read it before quoting metrics.
- The older 24-trial run completed with 15/16 seeded repairs, 2/4 fresh edits and 3/4 negative controls passing. These are separate categories, not one generation-success rate.
- After scoped fixes, an eight-trial targeted subset passed. That does not establish a perfect full-matrix or arbitrary-object success rate.
- A source-CAD study preserved 69 original parts and verified a placement correction. It required a retry after a provider timeout. It is software geometry evidence, not physical certification.
- The latest Gemini setup recorded 322 default regression tests passing plus TypeScript/build and synthetic streaming/background SDK checks. Rerun on your exact revision; these are historical counts.
- The initial malformed-JSON recovery gap in new-object generation remains known in this snapshot. The reported robot-dog failure must become a real browser regression case. Teammate 1 owns its fix.
- Motion verification is teammate 2's new task, not an existing verified capability. Human usefulness testing and model-comparison evidence have not been performed.

## Work package A: independent comparison

### Freeze the protocol before running it

Create a small, versioned task set with exact requests, source geometry/units, required constraints and allowed edits. Include unseen variations rather than only the cases used during implementation. Include some impossible/unsupported cases that should remain blocked.

Separate three groups: deliberately seeded repairs, fresh AI edits/creation, and expected refusals. A seeded initial failure is by construction; it is not evidence that the generator usually fails.

The evaluator must be independent of model prose. Check known geometry, actual dimensions, source identity, protected parts and requested limits. For movement, independently inspect teammate 2's sampled transforms and conflict witness. Do not copy its reported pass/fail field as your oracle.

### Compare paired conditions fairly

1. **One pass:** Argon produces one candidate without rendered/measured feedback. Save it and independently measure it.
2. **Full feedback loop:** start from that same saved candidate and original request; permit the actual render/measure/repair loop with its declared correction budget.
3. **Equal-call text review control, if feasible:** give the same starting candidate the same additional call budget for textual self-review, without the rendered/measured feedback. Record the actual budget consumed.

Keep the model, thinking level, source inputs, initial candidate, task limits and scoring fixed. Record token/call usage and total elapsed time, including retries and failures. The full loop uses more computation than one pass; disclose that. Do not claim images alone caused an improvement when measurements, extra calls or other settings also changed.

This comparison can establish the value of the feedback loop. It **cannot establish that only Argon can do the job**. A separate model comparison requires an agreed protocol and owner approval; do not switch the product to a cheaper model or claim an unrun baseline lost.

### Preserve every outcome

Record exact code revision and dataset/oracle version, original request, initial/final documents, actual images, measurements, failure reason, accepted/rejected status, changed/protected parts, elapsed time and provider configuration. Keep failed, cancelled and unrun cases visible. A provider outage is neither a successful repair nor a correct refusal.

Do not silently rerun failures until green and discard the first attempts. Label targeted retries separately. Do not change task inputs, tolerance or oracle after seeing results without versioning the change and retaining the earlier run.

Useful existing files:

- `lib/studio/evaluation-tasks.ts`: fixed task definitions and independent acceptance oracle.
- `components/studio/DesignEvaluation.tsx`, `app/evaluate/page.tsx`: real API evaluation UI.
- `scripts/summarize-design-evaluation.mjs`: category summaries and image associations.
- `tests/evaluation-evidence.test.ts`, `tests/project-design-evidence.test.ts`: offline recomputation.
- `docs/MEASURED_EDITS.md`, `docs/QUALITY.md`, `docs/GEMINI_SETUP.md`: capability boundaries.

Keep evaluator code/fixtures separate from generation prompts. The product must never read evaluation fixtures as response templates or fallback answers.

## Work package B: real maker usefulness

Use `docs/MAKER_STUDY.md`. The owner should recruit willing participants; coordinate consent and private handling of their designs. Start with at least one real maker if time is tight, and disclose the sample size. Do not claim broad user validation from one person.

Give a concrete task, such as placing a sourced module while preserving an enclosure, or resolving a supported mechanism's geometric conflict. Ask the person to perform it, not merely say the UI looks nice. Record actual completion, time, mistakes, help required and whether they understand the limits. Compare a matched task in their normal workflow when feasible; account for order/learning effects.

Use anonymous IDs. Keep records empty until someone actually participates. Do not fabricate interviews, quotes, ratings, saved-time percentages or physical testing. Do not publish participants' personal details or private CAD without their permission.

## Work package C: real browser acceptance

Test each workflow through the UI, not only direct API calls:

- Fresh creation: the robot-dog request and unrelated unseen objects. Record invalid output, cancellation and actual recovery. Confirm the old saved project remains intact on failure.
- Supported edit: accept a real new constraint, inspect the result and independently check it.
- Review/repair: show an actual conflict and a checked correction; unknown constraints must not become automatic success.
- Save/export/import/reload: recover the document and report, including baseline and images.
- Undo/redo: compare exported document data before, after and after undo/redo. A toast is not proof.
- Movement: on teammate 2's exact commit, test an intermediate collision, a clear case, source preservation and limits of pose sampling.
- Connectivity: record provider timeout behavior and recovery. Do not treat `/api/status` or a synthetic SDK call as end-to-end generation proof.

Run the complete current evaluation after integration, plus the fresh-creation cases it does not cover. Save artifacts, screenshots and actual failures. A saved report or recording is useful backup evidence, but is not a live run.

## Work package D: a three-minute pitch without slides

Update `docs/THREE_MINUTE_DEMO.md` to match what is actually implemented. The older script uses Flare wording and a keyboard conversion; it is a starting aid, not a verified timed Lumi presentation.

Suggested structure:

| Time | Show |
|---|---|
| 0:00–0:20 | One maker and one concrete design problem. |
| 0:20–0:45 | Existing source assembly, evidence and the constraint to preserve. |
| 0:45–1:45 | Enter a real request; show actual progress and the verified correction. |
| 1:45–2:25 | Show measured before/after, preserved parts and one undo. Use motion evidence only if its implementation passed verification. |
| 2:25–3:00 | State the observed benefit, Argon's role, limits and next user. |

Time the real calls. If they exceed the window, simplify the demonstrated task or improve reliability; do not edit waiting time out and call the result live. Use an honestly labeled recording/export if the provider fails. The pitch should focus on supported assembly editing/verification while arbitrary object generation remains unreliable.

## Ownership and PR acceptance

Own evaluation scripts, held-out task data, sanitized evidence, maker-study records and the demo document. Coordinate before editing `evaluation-tasks.ts`, the evaluation UI or shared schemas. Teammate 2 owns motion algorithms; teammate 1 owns provider/generation reliability. Report defects with exact reproduction, revision, expected/actual behavior and sanitized evidence rather than silently rewriting their modules.

Before requesting review:

```bash
npm test
npm run typecheck
npm run build
```

Include a comparison table with raw counts per category, success/failure definitions, attempts, time/cost and limitations. Include browser evidence and a timed rehearsal result. Mark any human study, model comparison or deployed-host check that remains unrun. No arbitrary projected hackathon scores or winning guarantees.

Ask the owner and teammate 2 to review the PR. **Do not merge to `main`, merge your own PR, push another person's branch or deploy.**
