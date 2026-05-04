# Multi-Creator Exercise Ingestion Design

**Goal:** Add videos from Coach Austin, Coach Fajardo, Brooke Rooney, Luster Training, and Coach Garin while preserving source attribution and letting users filter by creator.

**Approved scope:** Ingest all available Instagram posts/reels from the requested profiles that pass the current exercise-demo standards. Do not require a curated URL list.

**Creators in scope:**
- Austin Hendrickson / Coach Austin: `trainingtall`
- David Fajardo / Coach Fajardo: `coach.fajardo`
- Brooke Rooney: `brookerooney`
- Coach Chris / Luster Training: `lustertraining`
- Garin White / Coach Garin: `coachgarin`
- Existing source preserved as Coach Rudy: `coachingotf`

## Architecture

Creator attribution belongs on each video because one grouped exercise can contain videos from multiple creators. The final grouped JSON keeps the current exercise-level shape and extends each video with a `creator` object. Creator filters and display labels are derived from `exercise.videos`, so no duplicated group-level creator list is required.

The data pipeline keeps the current standards: raw posts are scraped, `enrich_local.py` classifies exercise demos, `merge_and_filter.py` removes non-demo posts, and `group_exercises.py` merges accepted videos into exercise groups. Multi-creator ingestion must preserve creator metadata through every stage.

## Data Model

Each final video includes:

```ts
creator: {
  id: string;
  display_name: string;
  handle: string;
  profile_url: string;
}
```

`id` is a stable lowercase identifier for filtering. `handle` excludes the leading `@`. `profile_url` points to the creator profile. Existing videos are backfilled as `coachingotf`.

## Frontend Behavior

The home page copy reports the number of creators instead of implying every video belongs to one account. Users can filter by creator using the existing filter panel pattern. Search should match creator names and handles. Exercise cards show a compact creator summary without nested links. Detail pages and individual video embeds show the creator next to platform attribution.

Hardcoded Coach Rudy-only copy in layout metadata, footer, home page, detail metadata, and README is replaced with multi-creator language.

## Ingestion Behavior

Instagram scraping accepts a profile list. The login account remains separate from target creator profiles. Scraped raw video records include creator metadata before enrichment so the later pipeline can preserve provenance.

For the requested creators, ingestion should attempt full-profile scraping, then keep only posts that pass the existing `is_exercise_demo` enrichment/filtering path. Generated data changes must include a review report with counts by creator, accepted/rejected totals when available, and representative rejects or classification concerns.

## Accountability Workflow

Work is split into PR-sized branches. Each implementation task has:

- An implementer handoff file in `docs/superpowers/handoffs/`.
- A spec review section confirming the task matched this design.
- A code quality review section with issues and resolution notes.
- Verification commands and outcomes.

Fresh subagents implement each task. Separate reviewer agents review spec compliance first, then code quality. Open findings must be fixed and re-reviewed before the task is considered complete.

## PR Slices

1. **Creator attribution and filtering:** Add schema, current-data backfill, UI attribution, creator search/filtering, and documentation.
2. **Multi-profile scraper plumbing:** Parameterize Instagram targets and preserve creator metadata through raw/enriched/flat/grouped pipeline outputs.
3. **Creator data imports:** Scrape requested profiles, run enrichment/filtering/grouping, review accepted data, and commit generated JSON plus report.
4. **Final polish:** Update README/process docs, verify production build, and clean up any residual lint or accessibility issues in touched surfaces.

## Risks

Instagram scraping is session- and rate-limit-sensitive. The current classifier is tuned around existing captions, so new creators may have different caption styles. Generated thumbnails from Instagram can expire, so UI should not depend on thumbnails as the only access path. The current repo also has unrelated local edits in another checkout; all PR work must happen in isolated worktrees.

## Self-Review

- Placeholder scan: no placeholders remain.
- Scope check: focused on multi-creator Instagram ingestion, attribution, and filtering.
- Ambiguity check: “current standards” means the existing enrichment/filtering pipeline, not manual curation.
- Consistency check: creator attribution is per-video throughout raw, enriched, grouped, and UI layers.
