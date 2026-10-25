# Exact smart-sofa generation: local speed verification

October23,2026 local date. No deployment. The source hashes identify the tested implementation.

| Check | Mode | Expected | Observed | Status |
|---|---|---|---|---|
| C001 | Live | Bounded original same-prompt baseline |149.782s;first complete part21.464s;14 parts/180 solids;Priority Argon |Passed |
| C002 | Local | Geometry/defaults/graph compatibility and build |243 tests pass;3 opt-in live suites skipped;typecheck and production build pass |Passed |
| C003 | Live | Browser creates exact sofa with independent iron base and ESP32 |87.072s;15 parts/254 solids/19 relationships/6 steps;UI export revalidated |Passed |
| C004 | Mock | Bounded failure, cancellation and targeted repair |Small reference correction preserves geometry;malformed/exhausted/cancelled output does not commit a sample or unfinished document |Passed |

The separate API generation passed in78.214s,with a real first component at9.178s. Its artifact is `diagnostic-object.json`. The final browser creation is `sofa-final.part.json`;screenshots show assembled geometry and ESP32 selection. Actual provider timing is in `browser-final.json`. Two successful updated generations took78–87s,compared with a single150s baseline. This is not a speed guarantee or controlled visual-quality equivalence study.

The first updated browser attempt failed decoding after82.212s;the saved lamp and input were retained. `browser-attempt-1.json` records it. Raw output was unavailable,so the precise defect remains unknown. The final prompt uses a valid literal-JSON example and forbids arithmetic/comments;the final browser run then passed.

The optimization retains Argon and fresh custom geometry. Bounded repeats expand into ordinary editable solids, while derived default fields and shared relationship links avoid redundant output. Corrections patch the received candidate rather than regenerating all geometry. No template substitution, extra API key, cheaper-model fallback or deployment occurred.

Model diagrams remain illustrative. Structural validation and visible browser operation do not verify mechanical strength, actual ESP32 wiring, firmware, certifications or physical hardware operation. The scope here is generation latency and application functionality.

The structural packet validator verifies declared evidence hashes only. Local and mocked checks are intentionally labeled separately from live provider checks;this packet does not claim all checks ran live.
