# Thumbnail Fix & Exercise Placeholders

**Date:** 2026-05-04
**Branch:** `fix/thumbnail-placeholders`

## Problem

- 603 out of 1980 video thumbnails use TikTok CDN URLs that expire, causing broken images
- No graceful fallback when thumbnails fail to load — just broken `<img>` tags
- Need category-specific exercise diagram placeholders instead of broken images

## Steps Taken

### 1. Created thumbnail download script

**File:** `scripts/download-tiktok-thumbs.mjs`

- Reads `src/data/exercises.json`, identifies videos with non-local (remote) thumbnails
- Downloads each to `public/thumbs/<videoId>.jpg` with concurrency of 5
- Updates the video's `thumbnail` field to the local path
- Handles failures gracefully (logs and continues)
- Skips files that already exist locally

**Result:** All 603 TikTok CDN URLs returned HTTP 403 (expired). This is expected — the URLs contain `x-expires` timestamps that have long passed. The onError fallback (step 3) handles these gracefully.

### 2. Created ExercisePlaceholder component

**File:** `src/components/ExercisePlaceholder.tsx`

- Category-specific SVG diagrams styled like gym machine exercise charts
- Human figure outline with relevant muscle groups highlighted in orange (#f97316)
- Categories handled: `upper_body`, `lower_body`, `core`, `full_body`, `cardio`, `mobility`, `other`
- Each diagram is a clean line-art figure:
  - **Upper Body:** Arms and chest highlighted
  - **Lower Body:** Legs and glutes highlighted
  - **Core:** Midsection/torso highlighted
  - **Full Body:** Entire figure highlighted
  - **Cardio:** Running figure with motion lines
  - **Mobility:** Stretching figure with flexibility indicators at joints
  - **Other:** Neutral figure with dumbbell accents

### 3. Added onError fallback to ExerciseCard

**File:** `src/components/ExerciseCard.tsx`

- Added `"use client"` directive (required for `useState`)
- Added `useState` to track image load errors
- Added `onError` handler on the `<img>` tag
- When `onError` fires, swaps the broken image for `<ExercisePlaceholder>` with the exercise's category
- Placeholder fills the same space as the thumbnail would

## Thumbnail Counts

| Metric | Count |
|--------|-------|
| Total videos | 1980 |
| Local thumbnails (self-hosted) | 1377 |
| Remote thumbnails (TikTok CDN, expired) | 603 |
| Exercises total | 1236 |

All 603 remote thumbnails will show the exercise diagram placeholder via the onError fallback.

## Verification

- `npm run build` — passes successfully, no TypeScript or compilation errors
- `ExercisePlaceholder.tsx` exists and handles all 7 categories
- `ExerciseCard.tsx` has `"use client"`, `useState`, `onError`, and `ExercisePlaceholder` import
- `scripts/download-tiktok-thumbs.mjs` runs without crashing, handles 403s gracefully
