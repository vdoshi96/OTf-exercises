# Task 04B: Corrections Scope

## Root Cause

`scripts/apply_corrections.py` was written for legacy Coach Rudy / `@coachingotf` Instagram captions, where short captions often contain only an exercise name. During multi-creator import, the correction pass still selected every Instagram false negative and reclassified posts from new creators that should keep the stricter `enrich_local` result.

## Scope Rule

The correction heuristic now only considers Instagram records that are legacy Coach Rudy / `coachingotf` data:

- `source == "instagram"`
- and `creator.id == "coachingotf"` or creator metadata/id is missing

Records with any other creator id are excluded from correction reclassification, so new creator false negatives remain non-demos unless the enrichment pipeline classified them as demos.

## Changed Files

- `scripts/apply_corrections.py`: added `is_legacy_coachingotf_instagram_record()` and applied it to the Instagram non-demo correction candidate filter.
- `docs/superpowers/handoffs/task-04b-corrections-scope.md`: documented the false-positive cause, scope rule, changed files, and verification.

## Verification

Run:

```bash
python3 -m py_compile scripts/apply_corrections.py
```
