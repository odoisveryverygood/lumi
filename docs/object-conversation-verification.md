# Object conversation verification — 2026-10-22

The production build and 181 automated tests passed; one opt-in billable suite is skipped. Live browser requests were tested separately with `gemini-4-argon` on localhost.

Observed flows:

- Source Corne geometry loads, including independent keycaps and the original enclosure mesh.
- Asking how a key works invokes and plays the existing switch mechanism.
- A wireless request chooses a 150 mAh cell and the thinner nice!nano study envelope and passes the listed model checks.
- Retaining the acoustic insert produces three checked attempts, a blocked result, a measured 2.675 mm gap versus the cell's 3.8 mm height, red overlap regions and a disabled Apply control.
- Asking why returns the measured conflict without changing geometry.
- Removing the insert recovers a passing layout while preserving a 4 mm battery limit.
- The proposed radio can be selected on the canvas. Asking about charging focuses its proposed connections.
- Apply changes the source study from 75 to 76 parts; Undo restores 75; Redo restores 76.
- After reload, the applied document, constraints and conversation are restored. A question about controller clearance reveals the 4.275 mm gap and 3.2 mm requirement. The exported document before and after this question is identical.
- The evidence drawer exposes source CAD, the separate community radio footprint source, numeric checks and an export containing conversation and revision data.
- The 390 × 844 layout has been inspected. The temporary viewport override was reset. Browser error logs were empty on the verified flow.

The accompanying reports and screenshots are in the parent `outputs` directory. Reports include a baseline, input, current document, proposal where present, constraint set and conversation. They contain public source/model data, not credentials.

These are software checks. The PCB outline and some internal details are disclosed reconstructions. The nice!nano horizontal envelope is a community drawing rather than manufacturer CAD. Source registration, physical fit, mounting, wiring, charging, firmware and RF remain unverified. Unfinished proposals are not restored after a reload.

No deployment or push was performed.
