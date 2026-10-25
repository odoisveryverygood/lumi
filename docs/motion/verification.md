# Motion verification record

Date: October 25, 2026. Original repository baseline: `0bfb4bf`.

## Development attempts retained

- `evidence/attempt-1-pose-mismatch.part.json`: browser measurement and actual renders were retained; server validation rejected one posed-document hash. Browser/server trigonometric rounding differed at +45°. No model review was completed for this attempt. Shared pose quantization fixed this.
- `evidence/attempt-2-review-error.part.json`: the next browser attempt retained the original after a review error. A separate direct diagnostic timed out at the existing 60-second provider boundary. This is a failure, not a successful repair or refusal.
- A synthetic API diagnostic with the existing generic object response schema returned an empty object. The motion reviewer now supplies its explicit bounded findings/transform schema through the existing SDK. No provider transport file was changed.
- `evidence/direct-argon-diagnostic-round.json`: a subsequent real direct Argon request returned findings and a permitted correction. This is API evidence; it is not claimed as browser acceptance.

## Local checks

- `npm test`: 340 passed; 6 existing opt-in tests skipped. Includes 18 new motion tests.
- `npm run typecheck`: passed.
- `npm run build`: passed; production browser verification used `npm start`.
- Offline recomputation: 25/25 checks passed, including actual per-round geometry, pose/document hashes, JPEG hashes, source/contract preservation and exported history/cancellation comparisons.

## Actual production browser run

`evidence/browser-reviewed.part.json` records two real Gemini 4 Argon calls through Interactions, medium thinking, Standard processing. Total review duration was 71,687 ms; reported provider durations were 46,357 and 21,235 ms. Both calls used the same original request and the same frozen v1 joint contract. The first candidate failed; Argon proposed raising the yoke from `[0,48,0]` to `[0,78,0]` mm. Its correction was rendered and measured again, then reviewed by Argon. Nineteen sampled poses from -45° through +45° passed. The minimum conservative clearance bound was 0.8153189588 mm against the 0.5 mm requirement. All 11 source shapes and the canonical bearing were preserved.

Browser acceptance exercised original/correction selection, pose focus, explicit acceptance, export, undo, redo, import/reopen, cancellation and joint playback. The actual exported undo parts equal the original baseline parts exactly. Redo equals the applied document exactly. Import reopened both rounds and their images. Cancelling an active review preserved the accepted document exactly. The first rapid pointer-based history attempt did not change the export; keyboard activation and settled UI checks then verified actual undo/redo. No data change was inferred from a toast alone.

Artifacts: `browser-applied.part.json`, `browser-undo.part.json`, `browser-redo.part.json`, `browser-after-cancel.part.json`, `offline-recomputation.json`, and `browser-review.jpg`. No cached model responses were substituted into the live browser run. The later offline recomputation is explicitly separate.

The browser used the software viewport fallback while the recorded review images were actual WebGL captures. Both use the same shared geometry and explicit pose transform. The fallback also rendered joint playback through the endpoints.

## Remaining boundaries

This is one authored reference study, not an arbitrary-mechanism or continuous-clearance result. Five declared contact pairs, fixed internal interfaces, manufacturing fit, electrical operation and physical safety remain outside the clearance verdict. Between-sample defects can be missed. The tests demonstrate a coarse miss found after refinement. No physical hardware or independent maker study was run. Teammate 3 still owns independent evaluation. Earlier failures remain in this folder and were not counted as successful repairs.

Credentials remain in ignored local configuration and are excluded from evidence. Validation was completed locally before publication. The owner authorized pushing the teammate branch and opening a PR. No merge or deployment was performed.
