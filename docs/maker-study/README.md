# Maker study records — empty until someone participates

`records.csv` holds one row per participant task. It contains only the header on purpose. No participant has been recruited, no session has been run, and no quote, rating, time saving or physical test exists. Do not fill a row from a rehearsal, a teammate, or an imagined user.

Protocol: [docs/MAKER_STUDY.md](../MAKER_STUDY.md). Owner recruits willing participants and handles consent and private designs; the evaluator records sessions.

Columns:

| Column | Meaning |
|---|---|
| `participant_id` | Anonymous ID such as `P1`. Never a name, email or handle. |
| `task_id` | A held-out task ID from `lib/studio/holdout-tasks.ts` or a described matched task in the person's normal workflow. |
| `condition` | `lumi` or `normal-workflow`. |
| `order` | 1 or 2, so order and learning effects can be reported. |
| `elapsed_seconds` | Wall-clock from reading the task to the participant saying they are done. Include retries and failures. |
| `completed_without_help` | `yes` / `no`. Any hint, demo or coaching makes this `no`. |
| `independently_checked_requirements_met` | `yes` / `no` / `partial`, decided by the held-out oracle or a measured check, not by the participant's impression or the model's prose. |
| `accidental_changes` | Count of unrequested part changes found by comparing the exported document before and after. |
| `understood_limits` | `yes` / `no`: could the participant state what Lumi did not verify (tolerances, wiring, physical fit)? |
| `observations` | Short factual notes. No invented quotes. |

Private CAD files and the participant's exported projects stay outside the repository unless the participant gives written permission. Report the sample size next to any result; one person is one person.
