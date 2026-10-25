# Teammate 2: verify movement and repair geometric conflicts

**Integration update:** the owner authorized combining all three completed branches. Use `main` as the base for further changes. The task description below is retained as the original assignment; current evidence and limits are summarized in [TEAM_INTEGRATION.md](../TEAM_INTEGRATION.md).

## Your assignment

Extend Lumi's existing measured Review workflow to inspect one supported moving assembly throughout a declared range of movement. Start with an adjustable fan or another agreed, reproducible reference mechanism. Detect geometric conflicts, show the first problematic pose, ask Argon for a scoped correction, and verify the corrected movement again.

This capability is now implemented for the explicitly declared adjustable-fan reference study; see [motion verification](../motion/README.md). Existing keypress/rotor animations are playback, not collision verification. Current reviews capture assembled, top and exploded static views. Do not present an animation as proof of movement clearance.

## Git rules — mandatory

**Do not push to `main`. Do not merge your own PR. Do not force-push shared branches. Create your own branch, push that branch to GitHub, and open a PR for review.**

The initial foundation PR is merged. Base new work on current `origin/main`; the owner coordinates shared integration.

```bash
git clone https://github.com/odoisveryverygood/lumi.git
cd lumi
git fetch origin
git switch -c teammate-2/motion-verification origin/main
npm ci
cp .env.example .env.local
mkdir -p work
# Obtain the server-only Gemini key privately. Never paste it into GitHub.
npm run dev
```

Use Node 24.x. Local development runs at http://127.0.0.1:3001. Read `AGENTS.md` and its relevant bundled Next.js documentation before changing application code. Read `docs/GEMINI_SETUP.md` for the current official SDK and reasoning configuration.

When ready:

```bash
git add <your-specific-files>
git commit -m "Verify sampled mechanism movement and scoped repairs"
git push -u origin teammate-2/motion-verification
gh pr create --base main --head teammate-2/motion-verification \
  --title "Verify mechanism movement with geometric evidence" --body-file work/pr-body.md
```

Replace the PR base with `main` only after the owner confirms the integration branch has merged. These commands are instructions for your own branch; they do not authorize a deployment or a merge.

## Definition of done

A live request can change one supported assembly while retaining a specified movement range. Lumi renders the movement, reports a measured conflict if present, proposes a permitted repair, checks the result again, and retains the original when verification fails or remains unknown. The user can inspect before/after evidence and undo the entire accepted change.

The first demo should use an existing source assembly and a real input, such as making a fan stand more compact while retaining a specified tilt range. A deliberately defective starting study is acceptable if clearly labeled. Never imply a hand-authored defect was a fresh model-generation failure.

### 1. Establish the mechanism contract

- Agree with the owner on one reference mechanism, its moving parts, pivot, axis, limits and allowed edits. Freeze the brief and limits across correction attempts.
- Preserve source CAD, canonical dimensions, stable IDs and unrelated components. A correction cannot shrink a sourced bearing, remove a component, reduce the requested movement range or move the entire case to manufacture a pass.
- Use explicit mechanism data; do not infer reliable joints, dimensions or internals from an arbitrary scan.
- Start with a bounded set of poses, including rest, endpoints and relevant intermediate positions. Record exactly which poses were checked. Use a documented cap on poses, geometry and render work.

### 2. Measure actual transformed geometry

- Reuse the viewport's geometry, primitive dimension conventions, millimetre units, rotations and attachment transforms. Moving a parent must carry its mounted descendants consistently.
- Bounds are useful for broad-phase filtering. Do not use the outer bounding box of a hollow grille or enclosure as the final collision verdict. Use supported solids or source geometry for the actual check.
- Return `pass`, `fail` or `unverified`, relevant part IDs, the pose/angle, measurement units and the check's limitations. State when a value is a conservative bound.
- Treat intended contact pairs, such as supported hinge interfaces, explicitly. Do not hide collisions by globally ignoring attached parts.
- If geometry or joint evidence is insufficient, report it as unverified. This is geometric verification, not force, structural, electrical or physical safety certification.

### 3. Close the actual Argon loop

- Capture actual rendered poses with fixed comparison framing. Send representative views, the first conflict witness and measured results to Argon through the existing SDK integration.
- Do not send unnecessary duplicate frames. Keep request, output, cancellation and correction budgets bounded.
- Let Argon propose a small, issue-linked transaction. Apply the existing source/preservation guards, then render and measure the candidate again.
- Do not accept an unreviewed correction. A positive model description cannot override a required failed or unknown measurement.
- A mechanism with no detected conflict needs no manufactured repair. Preserve errors, failed attempts and rejected regressions in the evidence.

### 4. Integrate into the existing experience

- Put motion findings in the existing Review panel, not another primary navigation mode or a pet settings menu.
- Selecting a finding should focus the relevant parts/pose. Show the original and retained motion evidence, requested limits, sampled poses and measured clearance.
- Extend saved-report schemas compatibly: old projects and static reviews must still open. Coordinate schema changes before editing shared files.
- Preserve draft protection, explicit acceptance rules, cancellation, save/import/export and atomic undo/redo.

## Code map and ownership

Start by reading:

- `lib/studio/types.ts`: `DeviceMechanism`, tracks, playback and attachments.
- `components/studio/DeviceScene.tsx`: actual viewport animation and transforms.
- `lib/studio/attachments.ts`: mounted descendant transforms.
- `lib/studio/render-model.ts`: shared actual geometry and bounds.
- `lib/studio/review-renderer.ts`: static capture and locked framing.
- `lib/studio/quality-types.ts`, `quality-engine.ts`, `quality-client.ts`: report contracts, scoped corrections and acceptance.
- `lib/studio/design-constraints.ts`: existing measured constraints and preservation.
- `components/studio/QualityPanel.tsx`, `MeasuredDesignChecks.tsx`: existing evidence UI.

Prefer new focused modules for pose sampling and geometric checks. Own those modules and their tests. Coordinate any shared renderer, schema or Review-panel changes before implementation. The owner/teammate 1 owns provider transport, malformed new-object JSON recovery and timeout handling. Do not independently rewrite `lib/ai.ts`, `lib/gemini-sdk.ts` or the generation pipeline. Teammate 3 owns the independent evaluator and demo evidence.

Before integrating, agree on the serialized shape of a motion finding: mechanism ID, pose/phase, part IDs, status, measurement/bound, required threshold, evidence frame references and limitations. Do not silently redefine the existing static view or report semantics.

## Required tests and browser evidence

- Known collision at an intermediate pose is detected; a genuinely clear fixture passes.
- Correct transformed child geometry follows a rotated/translated parent.
- A move/rotate-only repair preserves shapes and source identities.
- A hollow enclosure is not treated as a filled box.
- An unsupported import or unknown joint returns unverified.
- A defect between coarse samples is either found by refinement or explicitly outside the claimed coverage. Never claim continuous clearance from a finite sampling result.
- A new collision or changed requirement cannot be accepted as an improvement.
- Cancellation/provider failure preserves the original; old saved reports remain readable.
- Browser: trigger the real flow, inspect before/after evidence, focus a finding, export/reopen, undo and redo. A build or mocked test is not browser proof.

```bash
npm test
npm run typecheck
npm run build
```

Run live checks separately with the existing key; they are billable. Record source revision, full original request, geometry provenance, checked poses, actual measurements, actual rendered evidence, all failed attempts, elapsed time and model/configuration. Exclude credentials and personal data. Do not reuse cached answers while describing a run as live.

## PR checklist

- Explain the concrete problem, supported mechanism and resulting behavior.
- Link the fixture, quantitative before/after evidence and actual browser verification.
- List exact commands/results, skipped/unrun checks, geometry limits and any open reliability issue.
- Include migration/backward-compatibility notes for saved reports.
- Ask the owner and teammate 3 for review. Leave the PR open; **do not merge or deploy**.

Rubric purpose: strengthen the live verification loop, provide a concrete maker task and demonstrate harder multimodal reasoning. Do not claim guaranteed points, uniqueness or that only Argon can perform the task without evidence.
