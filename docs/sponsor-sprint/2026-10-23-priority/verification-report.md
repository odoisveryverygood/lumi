# Local performance verification

As of October 23, 2026. This revision is local, based on `510216d9aed26f9c1078740a0dadd9e2d779b85b`; the repository also contains earlier uncommitted grounded-design work. Exact changed-file fingerprints are included. The original sibling is clean. Nothing was pushed or deployed.

| Check | Mode | Observed | Result |
|---|---|---|---|
| C001 | Mock | Interactions framing, stateless requests, text/PDF/image mapping, actual tier, usage, errors and abort | Passed |
| C002 | Local | 222 tests passed, two opt-in live tests skipped; TypeScript and production build passed | Passed |
| C003 | Live | Same-prompt custom cassette: 99.109s Standard, 91.178s actual Priority | Passed, single comparison |
| C004 | Mock | Truncation/failure cannot commit; template shortcut rejected | Passed |
| C005 | Live/local browser | New six-part lamp, streamed geometry, direct 3D selection, manual X edit, exact-document undo and real export downloads | Passed |
| C006 | Local | Lossless compact codec and temporary-preview guards; baseline JSON 21.6% smaller | Passed |
| C007 | Local | Original copy clean; no push or deployment | Passed |

## What was observed

The same-prompt comparison used one real model call per tier and no repair loop. Both outputs passed the existing graph, geometry, action and mechanism validation. The Priority run completed about 8% sooner, but there is only one pair and generated solid counts differ. That does not establish equal visual quality or a repeatable speedup.

A subsequent compact browser cassette produced 14 components and 132 solids in 107.644s, slower than either baseline completion. Compact representation saves serialization space without deleting geometry; it has not proved an end-to-end latency improvement.

The streamed fan preview showed a real base and later 12 parts. Its first complete result failed structural validation. A repair started; a development hot reload then cancelled that attempt, preserving the existing cassette assembly. The original base-only camera fit cropped tall later parts. The correction refits the transient scene on new components. The separate lamp test verified the fix: the base and arm were visible by the sampled 18s UI observation, and five parts including the head remained fitted at 34s. The final lamp completed in 45.712s with 6 parts, 51 solids, 5 relationships and 4 steps. Those times reflect this object and cannot be compared as the same workload as the cassette.

In the browser, the base was selected, its X position changed from 0 to 12 mm, and the edited project was downloaded. Undo restored a project whose entire document equaled the original export. Clicking the rendered upper arm directly opened that correct component's card. The final screenshot records the selected component and assembled object. The optimized production build then served locally with HTTP 200 and available Gemini 4 Argon; the saved six-part lamp restored and rendered. No paid generation was rerun against that production server.

## Limits

The normal suite uses mocks/local checks and skips billable tests. The real comparison and browser generation are separately documented live evidence. Text/PDF/image request mapping is mock-tested for the new transport; the earlier grounded-design multimodal workflow was not rerun live in this performance scope. No account balance was retrieved. Costs are token-price estimates, and aborted repair spend is not fully reported by the provider. No physical hardware, wiring, tolerances or manufacturing feasibility was tested.

No API keys or raw provider responses/headers are included. Evidence contains only custom test objects, allowlisted usage/timings, test/build output and local UI captures. Packet structure and file hashes are checked independently; that validator does not execute the app or turn local/mock checks into live evidence.
