# Multi-Creator Exercise Ingestion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add creator attribution, creator filtering, and full-profile ingestion support for the requested Instagram creators.

**Architecture:** Store creator metadata on each video, derive creator filters/search from grouped exercise videos, and preserve creator metadata through the scrape/enrich/filter/group pipeline. Keep generated data reviewable with per-creator handoff reports.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Tailwind CSS 4, Fuse.js, Python data scripts, Playwright/Instaloader scraper scripts.

---

## Task 1: Creator Attribution Schema And Current Data Backfill

**Files:**
- Modify: `src/lib/types.ts`
- Modify: `src/data/exercises.json`
- Create: `scripts/backfill_creator_metadata.mjs`
- Create: `docs/superpowers/handoffs/task-01-creator-schema.md`

- [ ] **Step 1: Write the backfill script**

Create `scripts/backfill_creator_metadata.mjs` that reads `src/data/exercises.json`, adds this creator object to every video missing creator data, and writes the file with two-space JSON formatting:

```js
const DEFAULT_CREATOR = {
  id: "coachingotf",
  display_name: "Coach Rudy",
  handle: "coachingotf",
  profile_url: "https://www.instagram.com/coachingotf/",
};
```

- [ ] **Step 2: Run the backfill**

Run: `node scripts/backfill_creator_metadata.mjs`

Expected: the script reports how many videos were updated and every video in `src/data/exercises.json` has `creator.id`.

- [ ] **Step 3: Update TypeScript types**

Add:

```ts
export interface Creator {
  id: string;
  display_name: string;
  handle: string;
  profile_url: string;
}
```

Add `creator: Creator;` to `Video`.

- [ ] **Step 4: Verify schema coverage**

Run:

```bash
node -e "const d=require('./src/data/exercises.json'); const videos=d.flatMap(e=>e.videos); if (videos.some(v=>!v.creator?.id)) process.exit(1); console.log(videos.length)"
./node_modules/.bin/tsc --noEmit
```

Expected: both commands pass.

- [ ] **Step 5: Update handoff**

Record changed files, verification output, and concerns in `docs/superpowers/handoffs/task-01-creator-schema.md`.

## Task 2: Creator Search, Filtering, And UI Attribution

**Files:**
- Modify: `src/lib/search.ts`
- Modify: `src/app/page.tsx`
- Modify: `src/app/layout.tsx`
- Modify: `src/app/exercise/[id]/page.tsx`
- Modify: `src/components/FilterPanel.tsx`
- Modify: `src/components/ExerciseCard.tsx`
- Modify: `src/components/VideoEmbed.tsx`
- Modify: `README.md`
- Create: `docs/superpowers/handoffs/task-02-creator-ui.md`

- [ ] **Step 1: Add creator helpers/search**

In `src/lib/search.ts`, add creator fields to Fuse search keys and extend `getFilterOptions`/`filterExercises` to support `creator`.

- [ ] **Step 2: Add creator filter state**

In `src/app/page.tsx`, add `activeCreator`, pass creator options into `FilterPanel`, include creator in filter calls, and update summary copy to say videos are from multiple creators.

- [ ] **Step 3: Render creator filter chips**

In `FilterPanel.tsx`, add a Creator section using labels from `display_name`. Add `aria-pressed` to chips and `aria-expanded` to collapsible buttons while touching the component.

- [ ] **Step 4: Render creator attribution**

In `ExerciseCard.tsx`, show a compact non-clickable creator summary. In `VideoEmbed.tsx`, show creator display name and handle next to the platform badge. In the detail page, update metadata descriptions and render creator information in the sidebar.

- [ ] **Step 5: Replace single-creator copy**

Update `src/app/layout.tsx`, `src/app/page.tsx`, `src/app/exercise/[id]/page.tsx`, and `README.md` to avoid implying all videos are from Coach Rudy.

- [ ] **Step 6: Verify**

Run:

```bash
./node_modules/.bin/tsc --noEmit
NEXT_TELEMETRY_DISABLED=1 npm run build
```

Expected: both pass. If lint failures are unrelated to touched files, record them; if caused by touched files, fix them.

- [ ] **Step 7: Update handoff**

Record changed files, verification output, screenshots if taken, and concerns in `docs/superpowers/handoffs/task-02-creator-ui.md`.

## Task 3: Multi-Profile Scraper And Pipeline Provenance

**Files:**
- Modify: `scripts/scrape_instagram.py`
- Modify: `scripts/enrich_local.py`
- Modify: `scripts/merge_and_filter.py`
- Modify: `scripts/group_exercises.py`
- Modify: `scripts/refresh.sh`
- Create: `docs/superpowers/handoffs/task-03-multi-profile-pipeline.md`

- [ ] **Step 1: Parameterize profile scraping**

Change `scripts/scrape_instagram.py` so `--user` remains the login username and `--profiles` accepts a comma-separated list of target Instagram handles.

- [ ] **Step 2: Preserve creator metadata**

Raw Instagram records must include creator fields. `enrich_local.py`, `merge_and_filter.py`, and `group_exercises.py` must preserve `creator` on every video.

- [ ] **Step 3: Avoid stale grouping input**

Change `group_exercises.py` so it groups the fresh flat output from the current pipeline unless an explicit input file argument is provided.

- [ ] **Step 4: Verify pipeline code**

Run:

```bash
python3 -m py_compile scripts/scrape_instagram.py scripts/enrich_local.py scripts/merge_and_filter.py scripts/group_exercises.py
./node_modules/.bin/tsc --noEmit
```

Expected: both pass.

- [ ] **Step 5: Update handoff**

Record commands, changed files, and any scraper limitations in `docs/superpowers/handoffs/task-03-multi-profile-pipeline.md`.

## Task 4: Requested Creator Data Import

**Files:**
- Modify: `src/data/exercises.json`
- Create: `docs/superpowers/handoffs/task-04-creator-data-import.md`

- [ ] **Step 1: Run full-profile scrape**

Run the scraper for:

```text
trainingtall,coach.fajardo,brookerooney,lustertraining,coachgarin
```

- [ ] **Step 2: Run current standards pipeline**

Run enrichment, corrections if still applicable, merge/filter, and grouping. Keep only posts accepted by `is_exercise_demo`.

- [ ] **Step 3: Review generated data**

Produce counts by creator, accepted video totals, exercise totals, and any suspicious classifications.

- [ ] **Step 4: Verify generated site**

Run:

```bash
node -e "const d=require('./src/data/exercises.json'); const videos=d.flatMap(e=>e.videos); console.log({exercises:d.length,videos:videos.length,creators:[...new Set(videos.map(v=>v.creator?.id))].sort()})"
./node_modules/.bin/tsc --noEmit
NEXT_TELEMETRY_DISABLED=1 npm run build
```

Expected: creators include all requested handles that had accepted exercise demos.

- [ ] **Step 5: Update handoff**

Record scrape status, counts, review notes, and verification output in `docs/superpowers/handoffs/task-04-creator-data-import.md`.

## Review Gates

Each task requires:

- Implementer final notes in the task handoff.
- Spec compliance review by a fresh reviewer agent.
- Code quality review by a fresh reviewer agent.
- Fix/re-review loop until both reviewers approve.
- Commit and PR when the slice is complete.
