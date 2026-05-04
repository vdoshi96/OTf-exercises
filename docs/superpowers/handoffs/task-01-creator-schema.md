# Task 01: Creator Attribution Schema

## Owner

Worker Task 1

## Scope

- Added required creator metadata to the shared `Video` type.
- Added an idempotent backfill script for existing exercise video records.
- Backfilled current exercise data so every video has Coach Rudy / `@coachingotf` creator metadata.

## Files Touched

- `src/lib/types.ts`
- `src/data/exercises.json`
- `scripts/backfill_creator_metadata.mjs`
- `docs/superpowers/handoffs/task-01-creator-schema.md`

## Pre-Existing Coordination Artifacts

These files were created by the controller before Task 1 worker implementation began and are not part of the Task 1 worker-owned change set:

- `docs/superpowers/specs/2026-05-04-multi-creator-ingestion-design.md`
- `docs/superpowers/plans/2026-05-04-multi-creator-ingestion.md`
- `docs/superpowers/handoffs/README.md`

## Implementation Notes

- Introduced `Creator` with `id`, `display_name`, `handle`, and `profile_url` string fields.
- Updated `Video` so `creator: Creator` is required.
- Created `scripts/backfill_creator_metadata.mjs`.
- The backfill script reads `src/data/exercises.json`, adds the default creator only when `video.creator` is missing, preserves existing creator data, writes two-space JSON, and prints total/add/preserve counts.
- Ran the backfill against the current data set:
  - `videos: 1746`
  - `creators added: 1746`
  - `creators preserved: 0`

## Verification

```bash
node -e "const d=require('./src/data/exercises.json'); const videos=d.flatMap(e=>e.videos); if (videos.some(v=>!v.creator?.id)) process.exit(1); console.log(videos.length)"
```

Outcome: passed, printed `1746`.

```bash
./node_modules/.bin/tsc --noEmit
```

Outcome: passed with exit code 0 and no output.

## Concerns

None.
