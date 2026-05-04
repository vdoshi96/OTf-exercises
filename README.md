# OTF Exercise Directory

A searchable, unofficial fan directory of OrangeTheory Fitness exercise demos from multiple creators and source platforms.

Browse 1,746 exercise demonstrations across 1,054 grouped exercises, filterable by muscle group, equipment, category, platform, and creator. Each exercise links to the original video embed.

> **Disclaimer:** This is an unofficial fan directory. All video content belongs to its original creators and source platforms.

## Tech Stack

- **Framework:** Next.js 16 (App Router)
- **Styling:** Tailwind CSS 4
- **Search:** Fuse.js (client-side fuzzy search)
- **Video Embeds:** TikTok and Instagram embeds
- **Data:** Static JSON bundled at build time (1,054 grouped exercises)

## Getting Started

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Data Pipeline

The exercise data is generated from social video metadata using these scripts:

```bash
# 1. Scrape metadata from source platforms (requires yt-dlp where supported)
yt-dlp --skip-download --write-info-json --output "metadata/%(id)s" "https://www.tiktok.com/@coachingotf"

# 2. Parse into raw_videos.json
python3 scripts/parse_metadata.py

# 3. Enrich with exercise classification
python3 scripts/enrich_local.py          # Pattern-based (no API key)
python3 scripts/enrich_metadata.py       # Claude API (requires ANTHROPIC_API_KEY)

# 4. Merge and filter into src/data/exercises.json
python3 scripts/merge_and_filter.py

# 5. Self-host Instagram thumbnails (cdninstagram URLs expire)
node scripts/download_instagram_thumbnails.mjs

# Or run everything at once:
./scripts/refresh.sh
```

### Instagram thumbnails

Instagram's CDN thumbnail URLs are signed and expire after a few days, so the URLs captured at scrape time return 403 once the static site loads them later. `scripts/download_instagram_thumbnails.mjs` walks `src/data/exercises.json`, fetches each reel's public page for a fresh `og:image`, downloads the JPEG to `public/thumbs/<shortcode>.jpg`, and rewrites the `thumbnail` field to point at the local copy. Re-run it whenever new reels are added; existing thumbs are skipped unless you pass `--force`.

## Project Structure

```
├── scripts/
│   ├── parse_metadata.py       # Parse yt-dlp .info.json files
│   ├── enrich_local.py         # Local pattern-based enrichment
│   ├── enrich_metadata.py      # Claude API enrichment (optional)
│   ├── merge_and_filter.py     # Merge + filter to exercises.json
│   └── refresh.sh              # Full pipeline automation
├── src/
│   ├── app/
│   │   ├── page.tsx            # Main directory with search + filters
│   │   ├── exercise/[id]/
│   │   │   └── page.tsx        # Exercise detail page + video embeds
│   │   ├── layout.tsx          # Root layout with header/footer
│   │   └── globals.css
│   ├── components/
│   │   ├── SearchBar.tsx       # Debounced fuzzy search
│   │   ├── FilterPanel.tsx     # Category/muscle/equipment/creator filters
│   │   ├── ExerciseCard.tsx    # Exercise card with tags
│   │   ├── ExerciseGrid.tsx    # Responsive card grid
│   │   ├── TikTokEmbed.tsx     # TikTok video embed
│   │   └── InstagramEmbed.tsx  # Instagram video embed
│   ├── data/
│   │   └── exercises.json      # 1,054 grouped exercises
│   └── lib/
│       ├── search.ts           # Fuse.js search logic
│       └── types.ts            # TypeScript types + constants
├── metadata/                   # yt-dlp output (gitignored)
└── package.json
```

## Deployment

See [hosting-guide.md](hosting-guide.md) for step-by-step Vercel deployment instructions.
