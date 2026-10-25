# Three minutes, one maker, one checked correction

Status (October 25, 2026, revision 226f792): this script matches what Lumi actually implements today. It has **not** been timed against live Argon calls on this revision; the server key was not available to the independent evaluator. Historical live timings are quoted below with their source. Rehearse once with the key before presenting, record the real elapsed times in [the rehearsal record](sponsor-sprint/2026-10-25-independent-evidence/demo-rehearsal.json), and cut the task if it does not fit. Do not edit waiting time out of a recording and call it live.

Integration note: the original independent script below was written against revision 226f792. Later generation recovery and sampled-motion work are now integrated. The full live demo still needs a timed rehearsal; keep the original evidence limits.

Scope rules for the pitch:

- Show supported assembly editing and measured verification. Arbitrary object generation (the robot-dog case) is known to be unreliable in this snapshot; do not demo it live.
- Sampled movement verification is available for the declared adjustable-fan study. Its real API/browser evidence is in [motion verification](motion/verification.md), with integration checks in [TEAM_INTEGRATION.md](TEAM_INTEGRATION.md). Playback alone is not clearance evidence, and finite samples do not prove continuous clearance.
- Say "software geometry check", never "certified", "tested hardware" or "makers told us".

## Script

**0:00–0:20 — One maker, one problem**

"I build small enclosures around off-the-shelf modules. The expensive mistake is finding out after printing that a sourced module sits through a wall or too close to a battery. Lumi lets me ask for the change and then measures whether it is actually true."

Open http://127.0.0.1:3001. The desk-controller study is in **Explore**; the 70-part Corne keyboard is the larger alternative. Pick one before the demo and keep it.

**0:20–0:45 — The source assembly and the constraint to keep**

Click the sourced ESP32 module. In the inspector, point at the catalog source, revision and SHA-256. "This geometry is Espressif's CAD, and Lumi is not allowed to resize it." Point at the housing and say which constraint must survive: the housing and carrier stay exactly as they are.

**0:45–1:45 — A real request and the verified correction**

Open **Review** (eye icon in the header). Type a concrete brief, for example:

> Place the ESP32-C3 module inside the housing with 1 mm clearance. Keep the housing and the carrier board unchanged.

Click **Inspect and improve**. Narrate the actual stages as they appear in the panel: planning turns the sentence into fixed measurable checks; three views are rendered from the real geometry; Argon reviews them with the measured failures; a scoped correction is rendered and measured again. If the provider is slow, say so and wait. If it times out, the panel says the saved object is unchanged; show that and click **Review again** once, or fall back to the labeled recording below.

Historical timing, same workflow, earlier revision: accepted Corne study after one retry in 66.9 s with two reviews ([record](sponsor-sprint/2026-10-24-design-checks/verification-report.md)); seeded module repairs median 35 s, maximum 88.9 s across 16 trials. Budget 90 s here.

**1:45–2:25 — Measured before and after, preserved parts, one undo**

In **Measured design checks**, read the row aloud: Original → First attempt → Retained, in millimetres, against the requested limit. Click the focus button on the check so the viewport frames the parts it measured. Open **Compare at full size** to show the exact JPEG renders Argon received. Click **Use this draft**.

Then press undo once. The whole accepted change reverts to the saved object as one step; press redo to bring it back. Mention that the export carries the baseline, the checks, the image hashes and the camera framing, so anyone can recompute this offline without the provider.

**2:25–3:00 — What was observed, what Argon does, and the limits**

"Across the recorded controlled runs, the render-measure-repair loop turned 17 of 18 deliberately broken layouts into measured passes, and never regressed a layout that already passed. For fresh edits on an unbroken layout, the first attempt already passed in every scored trial, so the loop's measured benefit so far is catching and repairing defects, not improving good edits. Argon's role is the interpretation and the proposal; the pass or fail comes from geometry code and cannot be talked into a pass."

"Limits: this checks modeled geometry, not tolerances, wiring, loads or physical fit. The next user is a maker placing a real module in their own enclosure; that study is prepared and has not been run."

## Fallbacks

- Provider failure: open the exported reviewed project from the evidence packet through **Import**, state clearly that it is a recorded result from the date on the file, and show the same checks and renders.
- Over time: drop the compare-at-full-size step first, then the redo.

## Claims not to make

No hackathon score, no "only Argon could do this", no model comparison (none was run), no user quotes, no time savings, no physical test.
