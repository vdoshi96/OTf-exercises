# Task 04: Creator Data Import

Status: DONE

## Scope

Import all available Instagram reels from the approved creator list that pass the current exercise-demo standards, then regenerate the local exercise data.

Approved creators:

| Creator | Instagram handle |
| --- | --- |
| Austin Hendrickson / Coach Austin | `trainingtall` |
| David Fajardo / Coach Fajardo | `coach.fajardo` |
| Brooke Rooney | `brookerooney` |
| Coach Chris / Luster Training | `lustertraining` |
| Garin White / Coach Garin | `coachgarin` |

This task depends on:

- Task 01: creator metadata schema/backfill
- Task 02: creator attribution UI and creator filter
- Task 03: multi-profile Instagram scrape pipeline

## Agent Handoffs

Detailed handoffs for this import are split by responsibility:

| Handoff | Status | Responsibility |
| --- | --- | --- |
| `task-04a-live-scrape-fallback.md` | DONE | Add Instagram web API fallback when Instaloader profile resolution fails. |
| `task-04b-corrections-scope.md` | DONE | Keep legacy correction heuristics scoped to `coachingotf` only. |
| `task-04c-new-creator-quality-guard.md` | DONE | Add stricter import-quality guard for non-legacy Instagram creators. |

Each handoff records the root cause, file ownership, verification, and review concerns for that slice.

## Live Scrape Result

The live scrape used an existing Instaloader session for `vizhal007`. Instaloader profile resolution failed for the new target handles, so the script used the web API fallback documented in Task 04A.

Fresh reels collected:

| Handle | Raw reels collected | Notes |
| --- | ---: | --- |
| `trainingtall` | 300 | Hit the 25-page safety cap. |
| `coach.fajardo` | 299 | Hit the 25-page safety cap. |
| `brookerooney` | 79 | Completed available fallback pages. |
| `lustertraining` | 71 | Completed available fallback pages. |
| `coachgarin` | 93 | Completed available fallback pages. |
| Total new Instagram reels | 842 | Merged with existing raw data. |

Merged raw inputs:

| Source | Count |
| --- | ---: |
| Existing legacy `coachingotf` Instagram records | 1,195 |
| New Instagram creator records | 842 |
| TikTok raw records | 848 |
| Total raw records entering enrichment | 2,885 |

## Import Standards

The import keeps the existing standards and adds guardrails needed for multi-creator data:

- Every accepted video must retain creator metadata: `id`, `display_name`, `handle`, and `profile_url`.
- Legacy `coachingotf` Instagram correction rules remain available only for legacy/missing-creator `coachingotf` data.
- New Instagram creators must pass the stricter import guard before keyword-based demo classification can accept them.
- Obvious promos, class announcements, lifestyle/event posts, nutrition/product posts, sports gameplay, generic advice, and hashtag-only fitness-adjacent captions are rejected.
- Real instructional/demo captions from new creators are preserved, including TrainingTall examples with contextual event, pregnancy, travel, or colloquial language when exercise instruction is clear.

## Regenerated Data

Final regeneration command:

```bash
python3 scripts/enrich_local.py > /tmp/otf-enrich-final5.log
python3 scripts/apply_corrections.py > /tmp/otf-corrections-final5.log
python3 scripts/merge_and_filter.py > /tmp/otf-merge-final5.log
python3 scripts/group_exercises.py > /tmp/otf-group-final5.log
```

Pipeline output:

| Stage | Result |
| --- | --- |
| Enrichment before corrections | 1,621 exercise demos |
| Legacy correction reclassifications | 359 |
| Confirmed non-demos | 51 |
| Final videos | 1,980 |
| Final grouped exercises | 1,236 |
| Exercises with multiple videos | 468 |

Accepted video counts by creator:

| Creator id | Accepted videos |
| --- | ---: |
| `coachingotf` | 1,747 |
| `trainingtall` | 206 |
| `lustertraining` | 15 |
| `brookerooney` | 6 |
| `coach.fajardo` | 6 |
| `coachgarin` | 0 |

`coachgarin` scraped successfully, but all sampled and generated-audit candidates were filtered as studio promos, benchmark/class announcements, recaps, or otherwise non-directory posts under the current standards.

## Review Outcome

Subagent review approved the final import after the strict quality gate:

- Schema audit passed.
- Missing creator metadata: 0.
- Duplicate video IDs: 0.
- Known reject matrix absent from final data.
- Known accept TrainingTall tutorials present in final data.
- All 27 non-TrainingTall accepted entries were reviewed as plausible demos.
- Sampled TrainingTall accepted entries had no clear non-demo false positives.
- `npm run lint` passed in review with only pre-existing Next.js `<img>` warnings.

## Residual Notes

- The Instagram fallback uses a private web API and may need maintenance if Instagram changes headers, cookies, paging, or rate limits.
- `trainingtall` and `coach.fajardo` reached the 25-page safety cap. The import therefore covers all reels available within the current scraper limit, not necessarily every historical reel on those profiles.
- Raw scrape and enrichment scratch files are not part of the PR; the committed artifact is the regenerated app data plus pipeline code.

## Final Verification

Status: PASSED in parent session before commit and PR.

Commands:

```bash
python3 -m py_compile scripts/scrape_instagram.py scripts/enrich_local.py scripts/apply_corrections.py scripts/merge_and_filter.py scripts/group_exercises.py
./node_modules/.bin/tsc --noEmit
npm run lint
NEXT_TELEMETRY_DISABLED=1 npm run build
git diff --check
```

Data audit result:

- Exercises: 1,236.
- Videos: 1,980.
- Missing creator metadata: 0.
- Duplicate video IDs: 0.
- Known reject matrix: absent.
- Known accept TrainingTall tutorials: present.

`npm run lint` exited 0 with the existing `<img>` warnings in `ExerciseCard.tsx` and `InstagramEmbed.tsx`.
