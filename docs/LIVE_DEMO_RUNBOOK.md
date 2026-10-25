# Morf — three-minute live demo

Audience: judges using the supplied 50/25/15/10 rubric and Track 2, More Dimensions. Target user: a hardware maker modifying an existing assembly before prototyping. One demonstration: repair the shortened fan support while preserving its shapes, movement range and sourced bearing.

## What was actually tested

Revision `3f26257`, October 25, local production server at port 3004. A fresh real Argon review completed in **36.085 seconds**, using two review rounds. The original failed; the retained correction raised the yoke from 48 to 78 mm and passed 19 sampled poses with 0.815 mm minimum clearance against a 0.5 mm requirement. A previous integration run took 66.853 seconds; latency is variable.

Twenty-eight focused tests passed. Independently recomputed the fresh export's measurements, document hashes and all 12 image hashes; original shapes and canonical bearing were preserved. Browser original/retained selection, pose focus, acceptance, exact exported undo/redo states and reloaded report were checked. The operator sequence from Inspect through comparison, acceptance, undo/redo and export took 89.716 seconds. This includes tool operation time; **a spoken three-minute pitch has not been rehearsed**.

Evidence: [fresh run](sponsor-sprint/2026-10-25-live-demo/live-check.json), [operator observations](sponsor-sprint/2026-10-25-live-demo/operator-rehearsal.json), [editable result](sponsor-sprint/2026-10-25-live-demo/accepted.part.json), [verification packet](sponsor-sprint/2026-10-25-live-demo/sprint.json).

## Before judging

1. Keep the local production server running. The tested server is already at `http://127.0.0.1:3004/`. If restarting from this checkout, use Node 24, run `npm run build`, then `node node_modules/next/dist/bin/next start --hostname 127.0.0.1 --port 3004`. Do not rebuild during an active review. Server-only credentials must already be configured.
2. Prepare the backup in a separate tab at `http://localhost:3004/`. Import `docs/team-integration/evidence/live-merged-fan.part.json` using **Import device file**, then open **Review**. If a pending draft was restored, choose **Return to saved object** before importing. Inspect the report, then leave this tab alone. `localhost` and `127.0.0.1` isolate browser storage. This is a **previous recorded result**, not a live run.
3. In the live tab, open `http://127.0.0.1:3004/?example=motion-fan` immediately before starting. This loads the defective reference study and its frozen brief. Confirm the footer says **Inspect and improve**, not **Review current object**. Keep the study's exact brief; do not type an unrelated edit into chat.
4. Close unrelated apps/tabs, check the projector and text size, and have one presenter and one operator if available. Do not change zoom or window size halfway through.
5. Start a visible three-minute timer. Run this aloud once before judging. The words below are the script; click instructions are not spoken. If the real run returns sooner, continue directly into the comparison.

## Exact prompt already loaded

> Repair the deliberately lowered fan stand while keeping it at least 10 mm shorter than the original reference. Retain the full -45 to +45 degree tilt range relative to its original resting head angle, with 0.5 mm sampled clearance. Only raise or lower the tilt yoke within the declared limits; preserve every original shape and the sourced 608 bearing.

“Shorter” here constrains the yoke's placement relative to its original reference, not the entire fan's bounding box. The joint, contact exclusions and permitted edit are explicitly authored assumptions.

## Click-by-click script

| Time | What to do | What to say |
|---|---|---|
| **0:00–0:20** | Show the fan with Review open. Point to the physical parts. | **“A hardware design can look right and still collide when it moves. For a maker, discovering that after building a prototype means another redesign. Morf helps you understand, change and check a 3D assembly before that next build.”** |
| **0:20–0:35** | Click **Inspect and improve**. Point to the brief while the review starts. Do not click **Measure motion locally**. | **“We deliberately lowered this fan's support to create a test defect. The task is to repair it while keeping the support shorter than its original reference, preserving the full tilt range and every component's shape. I'm starting a fresh Argon review now.”** |
| **0:35–1:10** | Let the request run. Follow the visible stages. Scroll inside Review if needed; leave the request running. | **“Argon receives the actual assembly, rendered views, posed images and measured conflicts. It proposes a change within the permitted edit. Morf then renders and measures that proposal again. The geometry checks determine the clearance result. Positive model feedback cannot override a failed measurement.”** |
| **1:10–1:40** | Once complete, scroll to **Sampled motion**. In **Inspect attempt**, choose **Original**, then its first **Show this pose**. Select **Correction 1 · retained** (or the actual retained attempt), then **Show this pose** again. | **“Here is the original failure at a checked tilt angle. Here is the retained correction at the same angle. In this run, the support moved from 48 to 78 millimetres. All 19 sampled poses passed, with about 0.815 millimetres of minimum clearance against our 0.5 millimetre requirement. The original shapes and sourced bearing are preserved.”** Read the actual result; do not say this if the live run differs or fails. |
| **1:40–2:10** | Click **Use this draft**. Close Review with its X. Click **Undo edit**, then **Redo edit** in the viewport toolbar. | **“I choose whether to accept it. The correction becomes one editable change. Undo restores the original assembly; redo restores the correction. The saved project retains the original, candidate snapshots, measurements and the images used for review.”** |
| **2:10–2:35** | Click **Export → Editable project**. If behind schedule, skip the download and point to Export. | **“This leaves the maker with an editable assembly and inspectable evidence. Our Track 2 contribution is the complete feedback loop: render the design, inspect the result, propose a correction, and check the changed design again.”** |
| **2:35–3:00** | End on the corrected object; if time permits reopen Review on the retained sampled pass. | **“These checks cover the modeled geometry at sampled poses. Continuous clearance and physical hardware still need separate validation. Morf's goal is to help makers move from ‘I think this fits’ to a change they can inspect, measure and iterate on.”** |

The normal script is around 350 spoken words, leaving time for clicks and pointing. If the model finishes early, show the result early; do not wait to match the table. If it finishes later, shorten the narration and skip export. Do not promise the result before it is measured.

## Slow or failed live request

- If no passing result by **1:50 on the presentation timer**, stop spending the remaining demo on waiting. Click **Cancel review** if active. If an incomplete draft remains, choose **Return to saved object**; do not accept it. Switch to the already prepared backup tab.
- Say: **“The live request hasn't completed within our demo window. This is a result from our earlier real run, with its original measurements and images preserved. I'll show you that recorded evidence.”** Then select Original and the retained correction to finish the explanation. Do not describe this as the current live run, and do not claim the 50% live-demo criterion was fully demonstrated if the live call fails.
- If the live result says **needs attention**, show the failed measurement honestly. Say: **“Morf has not verified this candidate, so it keeps the original. Here is a previous successful run to show the completed workflow.”**
- The backup is an editable saved result; no backup video was recorded in this task. Never click **Review current object** on the backup unless you intend another real API request.

## What each rubric category sees

| Supplied criterion | Evidence to put on screen |
|---|---|
| Working live demo — 50% | Start a real request; show rendered/model review stages, independently computed failure/pass, explicit acceptance and editable result. |
| Problem/usefulness — 25% | One maker changing an assembly before prototyping; one geometric conflict with a concrete clearance requirement. Present reduced rework as the intended benefit, not measured user-study results. |
| Originality — 15% | Demonstrate coordinated reasoning over part identities, static and posed renders, constraints and measured results across a repair loop. We have not proven exclusive Argon capability, superiority to another model, or a 1M-token requirement. |
| Clarity — 10% | One object, one requested change, one before/after result, within three minutes, without slides. |

Do not claim “build anything,” engineering certification, verified wiring/forces, a completed maker study or Google Managed Agents. The current implementation uses direct Argon calls. This script addresses the supplied rubric; it does not guarantee an award.
