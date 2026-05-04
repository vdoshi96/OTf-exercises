# Smart Thumbnail Selection & Placeholder Overhaul

**Date:** 2026-05-04
**Branch:** `fix/smart-thumbnail-selection`

## Problem

Three distinct issues caused poor thumbnail display on the exercise grid:

1. **Naive first-video selection (310 exercises):** `ExerciseCard` always used `exercise.videos[0]` for the thumbnail. In 310 exercises, `videos[0]` was a TikTok video with an expired CDN URL, while another video in the array had a perfectly working local `/thumbs/` file.

2. **Instagram logo contamination (154 files, 119 exercises):** 154 thumbnail files in `public/thumbs/` were byte-identical copies of the Instagram gradient logo (778,568 bytes each, MD5: `bbbcf3a6ff0c8bd580103bd13eb268a4`). These loaded without `onError` triggering since they were valid JPEGs — they just showed the Instagram branding instead of the exercise.

3. **Goofy stick-figure placeholders:** The previous `ExercisePlaceholder` component used crude stick-figure SVGs that looked unprofessional and fired too often due to issues #1 and #2.

## Root Cause Analysis

| Issue | Root Cause | Affected Exercises |
|-------|-----------|-------------------|
| Stick figures showing | `videos[0]` has expired TikTok CDN URL, other videos have working local thumbs | 310 |
| Instagram logo showing | Scraper downloaded Instagram branding page instead of actual thumbnail | 119 |
| Placeholder too liberal | No smart thumbnail selection across videos array | 428 total (before fix) |

## Fix Applied

### Step 1: Data cleanup script (`scripts/fix-thumbnail-priority.mjs`)

- **Detected Instagram logo files** by checking for the known file size (778,568 bytes)
- **Deleted 148 logo files** from `public/thumbs/`
- **Cleared thumbnail field** to empty string for 148 videos that had logo thumbnails
- **Reordered videos** within each exercise so the video with the best thumbnail comes first:
  - Priority 3: Local real thumbnail (`/thumbs/...`, not Instagram logo)
  - Priority 1: Remote CDN URL (may or may not work)
  - Priority 0: Empty / Instagram logo

### Step 2: Smart thumbnail selection in ExerciseCard

Added `getBestThumbnail()` function that searches ALL videos in an exercise for the best available thumbnail, preferring local files over remote CDN URLs:

```typescript
function getBestThumbnail(exercise: GroupedExercise): string | null {
  const local = exercise.videos.find(
    (v) => v.thumbnail && v.thumbnail.startsWith("/")
  );
  if (local) return local.thumbnail;
  const remote = exercise.videos.find((v) => !!v.thumbnail);
  if (remote) return remote.thumbnail;
  return null;
}
```

### Step 3: Placeholder redesign

Replaced stick-figure SVGs with a clean, minimal placeholder that shows:
- Category-colored icon in a circle
- Exercise name (line-clamped to 2 lines)
- Muscle groups (first 3, dot-separated)

## Before/After

| Metric | Before | After |
|--------|--------|-------|
| Exercises with working first-video thumbnail | 792 (65%) | 997 (82%) |
| Exercises showing Instagram logo | 119 | 0 |
| Exercises needing any fallback | 428 (35%) | 223 (18%) |
| Exercises needing placeholder (no thumb at all) | N/A (broken images) | 66 (5.4%) |
| Remote CDN URLs that might work | 0 attempted | 157 tried (onError fallback if they fail) |

## Verification

- `npm run build` — passes, 1224 static pages generated
- Visual check: first 20+ exercises all show real thumbnails
- Search for "3 TIPS I USED FOR my PR" (previously showed Instagram logo) — now shows clean text placeholder
- No Instagram logos visible anywhere
- No stick figure SVGs remaining
