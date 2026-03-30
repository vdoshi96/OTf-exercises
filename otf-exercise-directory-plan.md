# OTF Exercise Directory — Claude Code Agentic Plan

## Project Overview

Build a searchable web directory of OrangeTheory exercises sourced from Coach Rudy's TikTok (@coachingotf). The app displays structured exercise metadata with embedded TikTok videos. No video files are hosted — all playback is via TikTok oEmbed.

---

## Phase 1: Metadata Extraction Pipeline

### Step 1.1 — Install yt-dlp

```bash
pip install yt-dlp
```

### Step 1.2 — Download metadata only (no video files)

```bash
yt-dlp --skip-download --write-info-json \
  --output "metadata/%(id)s" \
  "https://www.tiktok.com/@coachingotf"
```

This produces one `.info.json` file per video in `./metadata/`. Each JSON contains `description`, `webpage_url`, `id`, `timestamp`, `thumbnail`, `duration`, and more.

> **NOTE:** If yt-dlp can't bulk-scrape the profile (TikTok sometimes blocks), fall back to:
> 1. Use browser DevTools → Network tab on his TikTok profile while scrolling to capture video list API responses
> 2. Or manually collect video URLs into a `urls.txt` file (one per line) and run:
>    ```bash
>    yt-dlp --skip-download --write-info-json -a urls.txt --output "metadata/%(id)s"
>    ```
> 3. Or use a TikTok scraping library like `TikTokApi` (Python) to get video metadata programmatically

### Step 1.3 — Parse metadata into structured JSON

Write a Python script: `parse_metadata.py`

```python
import json, glob, os

videos = []
for filepath in glob.glob("metadata/*.info.json"):
    with open(filepath) as f:
        data = json.load(f)
    videos.append({
        "id": data.get("id"),
        "url": data.get("webpage_url"),
        "description": data.get("description", ""),
        "thumbnail": data.get("thumbnail", ""),
        "duration": data.get("duration", 0),
        "timestamp": data.get("timestamp", 0),
        "upload_date": data.get("upload_date", ""),
    })

with open("raw_videos.json", "w") as f:
    json.dump(videos, f, indent=2)

print(f"Parsed {len(videos)} videos")
```

---

## Phase 2: LLM Enrichment

### Step 2.1 — Enrich each video's description using Claude API

Write a script: `enrich_metadata.py`

For each video, send the `description` field to Claude Haiku and ask it to extract:

```json
{
  "exercise_name": "Lateral Raise",
  "muscle_groups": ["shoulders", "deltoids"],
  "equipment": ["dumbbells"],
  "category": "upper_body",
  "movement_type": "isolation",
  "coaching_cues": ["Keep elbows slightly bent", "Don't swing"],
  "is_exercise_demo": true
}
```

**Prompt template for the API call:**

```
You are parsing TikTok video descriptions from an OrangeTheory fitness coach.
Given the description below, extract structured exercise information.
If the video is NOT an exercise demonstration (e.g., it's a meme, vlog, or promo), set is_exercise_demo to false and leave other fields empty/null.

Description:
"{description}"

Respond with ONLY valid JSON, no markdown fences:
{
  "exercise_name": string or null,
  "muscle_groups": string[] or [],
  "equipment": string[] or [],
  "category": "upper_body" | "lower_body" | "core" | "full_body" | "cardio" | "mobility" | "other",
  "movement_type": "compound" | "isolation" | "cardio" | "stretch" | "other",
  "coaching_cues": string[] or [],
  "is_exercise_demo": boolean
}
```

**Use claude-haiku-4-5-20251001 via the Anthropic API.** Batch all 500 calls with a small delay (0.2s) to stay under rate limits. Estimated cost: ~$0.30–0.50 total.

### Step 2.2 — Merge enriched data

Combine `raw_videos.json` with LLM outputs into `exercises.json`:

```json
[
  {
    "id": "7312345678",
    "url": "https://www.tiktok.com/@coachingotf/video/7312345678",
    "thumbnail": "https://...",
    "upload_date": "20250115",
    "exercise_name": "Lateral Raise",
    "muscle_groups": ["shoulders"],
    "equipment": ["dumbbells"],
    "category": "upper_body",
    "movement_type": "isolation",
    "coaching_cues": ["Keep elbows slightly bent", "Don't swing"],
    "is_exercise_demo": true
  }
]
```

Filter out entries where `is_exercise_demo` is false. Save as `exercises.json`.

### Step 2.3 — Manual review pass

Print a summary table of all extracted exercise names for quick human review. Flag any that look wrong or duplicated. The user (Vishal) will eyeball this before proceeding.

---

## Phase 3: Build the Frontend

### Tech Stack

- **Framework:** Next.js (App Router) or plain React via Vite
- **Styling:** Tailwind CSS
- **Data:** Static JSON import (`exercises.json` bundled at build time)
- **Video embeds:** TikTok oEmbed via `<blockquote>` + script tag, or iframe
- **Search:** Client-side fuzzy search (use `fuse.js`)
- **Hosting:** Vercel (free tier)

### Step 3.1 — Initialize project

```bash
npx create-next-app@latest otf-exercise-directory --typescript --tailwind --app --src-dir
cd otf-exercise-directory
npm install fuse.js
```

Copy `exercises.json` into `src/data/exercises.json`.

### Step 3.2 — Build core components

#### Layout & Pages

```
src/
  app/
    page.tsx          — Main directory page with search + filters
    exercise/[id]/
      page.tsx        — Individual exercise detail page with TikTok embed
  components/
    SearchBar.tsx     — Text input with debounced fuzzy search
    FilterPanel.tsx   — Filter by category, muscle group, equipment
    ExerciseCard.tsx  — Thumbnail + name + tags, links to detail page
    ExerciseGrid.tsx  — Responsive grid of ExerciseCards
    TikTokEmbed.tsx   — Embeds a TikTok video given a URL
  data/
    exercises.json
  lib/
    search.ts         — Fuse.js configuration and search logic
```

#### TikTokEmbed component

Use TikTok's oEmbed. Two options:

**Option A — blockquote method (recommended):**
```tsx
"use client";
import { useEffect, useRef } from "react";

export default function TikTokEmbed({ url }: { url: string }) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Load TikTok embed script
    const script = document.createElement("script");
    script.src = "https://www.tiktok.com/embed.js";
    script.async = true;
    document.body.appendChild(script);
    return () => { document.body.removeChild(script); };
  }, []);

  return (
    <div ref={containerRef}>
      <blockquote
        className="tiktok-embed"
        cite={url}
        data-video-id={url.split("/video/")[1]}
      >
        <a href={url}>View on TikTok</a>
      </blockquote>
    </div>
  );
}
```

**Option B — oEmbed API fetch (for thumbnails/previews without full embed):**
```
GET https://www.tiktok.com/oembed?url={video_url}
```
Returns JSON with `thumbnail_url`, `title`, `html` (embed code).

#### Search implementation

```ts
import Fuse from "fuse.js";
import exercises from "@/data/exercises.json";

const fuse = new Fuse(exercises, {
  keys: [
    { name: "exercise_name", weight: 2 },
    { name: "muscle_groups", weight: 1.5 },
    { name: "equipment", weight: 1 },
    { name: "coaching_cues", weight: 0.5 },
  ],
  threshold: 0.3,
});

export function searchExercises(query: string) {
  if (!query.trim()) return exercises;
  return fuse.search(query).map((r) => r.item);
}
```

### Step 3.3 — UI/UX requirements

- **Dark mode by default** (consistent with Vishal's preference)
- **Mobile-first responsive** layout
- Sticky search bar at top
- Filter chips for: category (upper body, lower body, core, full body, cardio, mobility), equipment, muscle group
- Exercise cards show: thumbnail, exercise name, category badge, muscle group tags
- Detail page shows: full TikTok embed, exercise name, all metadata, coaching cues as a bulleted list
- "Back to directory" navigation
- Footer: "Videos by Coach Rudy on TikTok. This is an unofficial fan directory."

### Step 3.4 — SEO & metadata (optional but nice)

- Dynamic `<title>` and `<meta description>` per exercise page
- Open Graph tags so exercises are shareable
- Sitemap generation from exercises.json

---

## Phase 4: Data Refresh Strategy

Since Coach Rudy posts new videos regularly, plan for periodic updates:

1. Re-run yt-dlp metadata scrape monthly
2. Diff against existing `exercises.json` to find new videos
3. Run LLM enrichment on new entries only
4. Merge and redeploy

Write a `refresh.sh` script that automates steps 1–3. The user triggers it manually and redeploys.

---

## File Deliverables

After all phases, the project directory should contain:

```
otf-exercise-directory/
├── scripts/
│   ├── parse_metadata.py
│   ├── enrich_metadata.py
│   ├── merge_and_filter.py
│   └── refresh.sh
├── metadata/              (gitignored, raw yt-dlp output)
├── src/
│   ├── app/
│   ├── components/
│   ├── data/
│   │   └── exercises.json
│   └── lib/
├── package.json
├── tailwind.config.ts
├── next.config.js
├── tsconfig.json
└── README.md
```

---

## Cost Summary

| Item | Cost |
|---|---|
| Claude Haiku API (500 descriptions) | ~$0.30–0.50 |
| Vercel hosting (free tier) | $0 |
| Domain name (optional) | $10–15/year |
| **Total** | **$0.50 – $15** |

---

## Important Notes

- **Legal:** This is an unofficial directory. Include clear attribution to Coach Rudy. If he requests removal, comply immediately. Consider reaching out to him proactively — he might love it and promote it.
- **TikTok embed reliability:** TikTok embeds can be slow or break if TikTok changes their embed API. The fallback is a direct link + thumbnail.
- **yt-dlp TikTok scraping:** TikTok aggressively blocks scrapers. If yt-dlp fails, the user may need to use a browser extension or manual collection. The pipeline handles both — it just needs a `urls.txt` or `metadata/*.info.json` files as input.
