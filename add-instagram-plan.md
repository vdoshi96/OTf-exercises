# Add Instagram to OTF Exercise Directory — Claude Code Plan

## Context

The OTF Exercise Directory is already built, deployed, and working with TikTok data from `@coachingotf`. The existing project structure follows the v2 plan with `exercises.json` powering the frontend. This plan ONLY covers adding Instagram data from `https://www.instagram.com/coachingotf/` and merging it into the existing app.

---

## Step 1: Scrape Instagram Metadata via Playwright

### 1.1 — Install Playwright (if not already installed)

```bash
npm install playwright
npx playwright install chromium
```

### 1.2 — Write `scripts/scrape_instagram.js`

This script launches Vishal's real Chrome browser (already logged into Instagram), navigates to `https://www.instagram.com/coachingotf/`, scrolls the profile, and intercepts the GraphQL/API responses that Instagram's own frontend makes — capturing post metadata (captions, URLs, thumbnails) without downloading any media.

Key implementation details:

- **Launch with Vishal's Chrome profile** so he's already authenticated:
  ```js
  const context = await chromium.launchPersistentContext(CHROME_PROFILE_PATH, {
    headless: false,
    viewport: { width: 1280, height: 900 },
    args: ["--disable-blink-features=AutomationControlled"],
  });
  ```
  > Ask Vishal for his Chrome profile path. Default on macOS: `/Users/vishal/Library/Application Support/Google/Chrome/Default`

- **Run headful (not headless)** — Vishal watches the browser scroll. If a CAPTCHA appears, he solves it manually and the script continues.

- **Intercept network responses** on the page matching URLs containing `graphql`, `api/v1/users`, or `api/v1/feed`. Parse JSON from these responses to extract post data.

- **Auto-scroll with human-like delays** — scroll by `window.innerHeight * 0.8`, wait a random 1.5–3.5 seconds between scrolls. Stop after 5 consecutive scrolls with no new posts.

- **Deduplicate by shortcode** as posts come in (Instagram may return overlapping batches).

- **Extract from each post:**
  ```json
  {
    "id": "shortcode",
    "platform": "instagram",
    "url": "https://www.instagram.com/p/{shortcode}/",
    "description": "caption text",
    "thumbnail": "thumbnail URL",
    "timestamp": 1234567890,
    "upload_date": "20260115",
    "is_video": true
  }
  ```

- **Handle multiple Instagram API response shapes:**
  - GraphQL: `json.data.user.edge_owner_to_timeline_media.edges[].node`
  - GraphQL v2: `json.data.xdt_api__v1__feed__user_timeline_connection.edges[].node`
  - API v1: `json.items[]`
  - Caption lives at `edge_media_to_caption.edges[0].node.text` (GraphQL) or `caption.text` (API v1)

- **Save output** to `data/instagram_raw.json`

- **Print summary** when done: total posts, video count, image count, sample caption.

### 1.3 — Fallback if Instagram blocks the scraper

If auto-scrolling gets blocked:
1. Change the auto-scroll loop to `await page.waitForTimeout(600000)` (10-minute window)
2. Vishal scrolls manually while network interception still captures data in the background
3. Script saves whatever was captured when the timeout expires or Vishal closes the browser

If network interception captures nothing (Instagram changed their API shape):
1. Try Apify's Instagram Profile Scraper (~$5) as a fallback
2. Output the same JSON shape to `data/instagram_raw.json`

---

## Step 2: Enrich Instagram Descriptions (In This Claude Code Session)

### 2.1 — Load `data/instagram_raw.json` and read descriptions

Do NOT use API calls. Claude Code (you, in this session) reads the descriptions directly and produces structured metadata.

### 2.2 — For each Instagram post description, extract:

```json
{
  "exercise_name": "Dumbbell Crossover Lunge With Low Row",
  "exercise_name_slug": "dumbbell-crossover-lunge-with-low-row",
  "related_exercises": ["Reverse Lunge", "Single Arm Low Row"],
  "muscle_groups": ["glutes", "quads", "lats"],
  "equipment": ["dumbbells"],
  "category": "upper_body" | "lower_body" | "core" | "full_body" | "cardio" | "mobility" | "other",
  "movement_type": "compound" | "isolation" | "cardio" | "stretch" | "other",
  "coaching_cues": ["Keep chest up", "Row at the bottom"],
  "is_exercise_demo": true,
  "difficulty": "beginner" | "intermediate" | "advanced" | null
}
```

**NAMING RULES — same as existing TikTok data:**
- Preserve Coach Rudy's exact exercise name from the caption as-is
- Only strip preamble: "How to do a Hammer Curl" → "Hammer Curl"
- Do NOT normalize to generic gym terminology
- `exercise_name_slug` is lowercase hyphenated for grouping: "Hammer Curl" → `"hammer-curl"`
- If the post is NOT an exercise demo (meme, promo, Q&A), set `is_exercise_demo: false`

### 2.3 — Process in batches of ~25 descriptions

Read 25 at a time, output enriched JSON, append to `data/instagram_enriched.json`. Save after each batch so progress survives session interruptions.

### 2.4 — Filter out non-exercise posts

Remove entries where `is_exercise_demo` is false. Save filtered result.

---

## Step 3: Merge Instagram Data into Existing exercises.json

### 3.1 — Load existing `src/data/exercises.json` (the live TikTok data)

### 3.2 — For each enriched Instagram entry:

**Case A — Matching exercise already exists (slug match):**
- Append the Instagram video to that exercise's `videos` array
- Increment `video_count`
- Merge any new `coaching_cues`, `muscle_groups`, `equipment` (deduplicated)
- Add `"platform": "instagram"` to the video entry

**Case B — Fuzzy match (85%+ slug similarity):**
- Same as Case A but merge into the fuzzy-matched exercise
- Print the merge for Vishal to review: `"MERGE: instagram 'hammer-curls' → existing 'hammer-curl'"`

**Case C — Near match (70-85% similarity):**
- Do NOT auto-merge
- Print for manual review: `"REVIEW: instagram 'dumbbell-lunge-low-row' vs existing 'dumbbell-crossover-lunge-with-low-row' (78% similar)"`
- Ask Vishal whether to merge or keep separate

**Case D — No match (new exercise not in TikTok data):**
- Create a new exercise entry with only Instagram video(s)
- This is expected — he may demo exercises on Instagram that aren't on TikTok

### 3.3 — Re-sort exercises alphabetically and save updated `exercises.json`

### 3.4 — Print merge summary:
```
Existing TikTok exercises: 247
Instagram entries processed: 312
  → Matched to existing exercises: 189
  → Fuzzy-merged: 14
  → New exercises added: 41
  → Flagged for manual review: 8
  → Skipped (not exercise demos): 60
Updated total exercises: 288
Exercises with multi-platform videos: 156
```

---

## Step 4: Update Frontend for Instagram Support

### 4.1 — Add `InstagramEmbed.tsx` component

```tsx
"use client";
import { useEffect, useRef } from "react";

export default function InstagramEmbed({ url }: { url: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    const script = document.createElement("script");
    script.src = "https://www.instagram.com/embed.js";
    script.async = true;
    document.body.appendChild(script);
    
    const timer = setInterval(() => {
      if ((window as any).instgrm) {
        (window as any).instgrm.Embeds.process();
        clearInterval(timer);
      }
    }, 500);

    return () => {
      clearInterval(timer);
      document.body.removeChild(script);
    };
  }, [url]);

  return (
    <div ref={containerRef}>
      <blockquote
        className="instagram-media"
        data-instgrm-permalink={url}
        data-instgrm-version="14"
        style={{ maxWidth: "100%" }}
      >
        <a href={url} target="_blank" rel="noopener noreferrer">View on Instagram</a>
      </blockquote>
    </div>
  );
}
```

### 4.2 — Add `PlatformBadge.tsx` component

Small badge showing TikTok or Instagram icon + label, displayed on each video in the carousel. Use platform-appropriate colors:
- TikTok: black background, white text, TikTok logo
- Instagram: gradient background (purple→orange), white text, Instagram logo

### 4.3 — Update `VideoCarouselItem.tsx`

Currently renders TikTok embeds only. Update to check `video.platform` and render either `<TikTokEmbed>` or `<InstagramEmbed>`. Add `<PlatformBadge>` overlay in the top-left corner of each carousel item.

### 4.4 — Update `FilterPanel.tsx`

Add a "Platform" filter section with chips: "All", "TikTok", "Instagram". Filters exercises by whether their `videos` array contains entries matching the selected platform.

### 4.5 — Update `ExerciseCard.tsx`

If an exercise has videos from both platforms, show small platform icons (TikTok + Instagram logos) in the corner of the card. This signals to the user that multiple platform versions exist before they click in.

### 4.6 — Update types

Add `"instagram"` to the platform union type wherever it's defined:
```ts
type Platform = "tiktok" | "instagram";
```

---

## Step 5: Test and Deploy

### 5.1 — Run `npm run build` locally to verify no errors

### 5.2 — Test exercise pages that have both TikTok and Instagram videos:
- Carousel should show all videos with platform badges
- Dot indicators should reflect total video count
- Swiping/scrolling between a TikTok embed and Instagram embed should work smoothly
- Both embed types should load (TikTok's embed.js and Instagram's embed.js can coexist)

### 5.3 — Test the platform filter on the main directory page

### 5.4 — Commit and push to deploy

```bash
git add .
git commit -m "Add Instagram exercise videos and platform filtering"
git push origin main
```

Vercel auto-deploys on push.

---

## Checklist Before Starting

- [ ] Confirm Vishal's Chrome profile path for Playwright
- [ ] Verify `coachingotf` Instagram profile is public (embeds won't work for private accounts)
- [ ] Check existing `exercises.json` location in the project (should be `src/data/exercises.json`)
- [ ] Ensure Playwright can be installed in the project without conflicting with existing deps
