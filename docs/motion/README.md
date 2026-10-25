# Sampled adjustable-fan motion review

Open `/?example=motion-fan`, or open Review and choose **Open adjustable fan study**. **Measure motion locally** renders and measures without a model call. **Inspect and improve** sends the actual static views and selected posed views to the existing server-side Argon integration. Inspect the candidate and explicitly choose **Use this draft** after a passing review. Applying it is one undoable assembly change.

## Frozen study v1

The owner approved an adjustable fan, move/rotate-only repairs and additive Review/report integration in this session. The source is the existing saved fan at `docs/sponsor-sprint/2026-10-24-quality/reviewed-fan.part.json`, from repository revision `0bfb4bf`. `lib/studio/motion-fan-source.json` retains that document without its historical review.

Preparation preserves all 11 shapes and source identities, relocates the controller PCB to `[55,14,0]` mm, and explicitly mounts the existing axle and rotor to the motor housing. It declares an authored X-axis tilt joint at `[0,55,0]` in yoke coordinates. The head and its mounted descendants rotate together. The source assembly itself was a generated illustration, with one canonical NopSCADlib 608 bearing; it is not manufacturer CAD for a functioning fan.

The original yoke reference height is 88 mm. The study deliberately lowers it to 48 mm to seed a defect. This is an authored defect, not a fresh model-generation failure. The only permitted correction is moving the yoke vertically between 48 and 78 mm, retaining its original rotation. The base, controller, knob and all original shapes remain protected; mounted descendants follow the yoke. The 78 mm upper bound keeps the yoke at least 10 mm shorter than its original reference. It does not claim a 10 mm reduction in the entire object's axis-aligned envelope at every pose.

The frozen range is -45° through +45° relative to the saved -12° resting head angle. Nineteen poses are checked, every 5°, including zero and both endpoints. Required sampled clearance is 0.5 mm. The original request and joint contract cannot change during a review or repair.

Five explicit part pairs are excluded as declared interfaces: housing/yoke, housing/tilt knobs, grille/yoke, grille/tilt knobs and yoke/base. The grille has side lugs in its source solids. These are whole-pair exclusions; local hinge fit and interference within those pairs remain unverified. The report lists every excluded pair and reason. Other attached components are not globally excluded.

## Geometry and budgets

The evaluator uses the viewport's exact primitive tessellation, millimetre units, XYZ rotations and source meshes. Broad-phase box separation is a conservative lower bound. Overlapping boxes require actual triangle distance, segment/triangle intersection and closed-solid containment. Hollow objects are not filled bounding boxes. Open meshes and unsupported imports remain unverified. The saved pose is quantized to 0.00000001 mm/degrees for portable browser/server hashes, below the 0.00001 mm intersection tolerance.

Only pairs with relative joint motion or involving an editable subtree are in scope. Fixed internal interfaces, forces, structural behavior, wiring, manufacturing fit and physical safety are outside this study. Finite samples do not establish continuous clearance; a sufficiently small defect between samples can remain undetected. The tests include a coarse miss that is detected with finer sampling.

Caps: 25 poses, 64 parts, 500 solids, 50,000 triangles, 2,000,000 triangle comparisons per candidate, and 200 recorded findings. Every candidate has at most three static and three motion images at 640×440. The first conflict and endpoints are represented without duplicate frames, up to three motion frames; rest fills an unused slot. Comparisons retain the original witness angles and camera framing. The loop allows two corrections, at most three provider calls with 60-second call limits and a 180-second operation limit. Cancellation and provider failures retain the original.

## Evidence and compatibility

Motion contracts, per-round measurements, pose/frame references, candidate snapshots and provider configuration are optional additions to version-1 documents/reports. Old static projects/reports remain readable. Motion reports retain the original baseline and each reviewed candidate, allowing export/reopen and inspection of rejected attempts. Only a fully measured and reviewed passing candidate can be applied. A positive model description cannot override failed or unknown measurements.

The SDK/provider transport and new-object generation pipeline are unchanged. The motion reviewer supplies an explicit response schema to the existing SDK; this bounds the returned findings and transform-only transaction. It does not change teammate 1's transport or malformed new-object recovery work, or teammate 3's independent evaluator.

See `verification.md` for actual runs and remaining limitations. Keep the pull request open for owner and teammate 3 review. Do not merge or deploy from this branch.
