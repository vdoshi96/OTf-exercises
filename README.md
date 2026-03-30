# OTF Exercise Directory

A searchable web directory of OrangeTheory Fitness exercises, sourced from [Coach Rudy's TikTok (@coachingotf)](https://www.tiktok.com/@coachingotf).

Browse 592 exercise demonstrations across 61 unique exercises, filterable by muscle group, equipment, and category. Each exercise links to the original TikTok video embed.

> **Disclaimer:** This is an unofficial fan directory. All video content belongs to Coach Rudy / @coachingotf on TikTok.

## Tech Stack

- **Framework:** Next.js 16 (App Router)
- **Styling:** Tailwind CSS 4
- **Search:** Fuse.js (client-side fuzzy search)
- **Video Embeds:** TikTok oEmbed
- **Data:** Static JSON bundled at build time (592 exercises)

## Getting Started

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Data Pipeline

The exercise data is generated from TikTok metadata using these scripts:

```bash
# 1. Scrape metadata from TikTok (requires yt-dlp)
yt-dlp --skip-download --write-info-json --output "metadata/%(id)s" "https://www.tiktok.com/@coachingotf"

# 2. Parse into raw_videos.json
python3 scripts/parse_metadata.py

# 3. Enrich with exercise classification
python3 scripts/enrich_local.py          # Pattern-based (no API key)
python3 scripts/enrich_metadata.py       # Claude API (requires ANTHROPIC_API_KEY)

# 4. Merge and filter into src/data/exercises.json
python3 scripts/merge_and_filter.py

# Or run everything at once:
./scripts/refresh.sh
```

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
│   │   │   └── page.tsx        # Exercise detail page + TikTok embed
│   │   ├── layout.tsx          # Root layout with header/footer
│   │   └── globals.css
│   ├── components/
│   │   ├── SearchBar.tsx       # Debounced fuzzy search
│   │   ├── FilterPanel.tsx     # Category/muscle/equipment filters
│   │   ├── ExerciseCard.tsx    # Exercise card with tags
│   │   ├── ExerciseGrid.tsx    # Responsive card grid
│   │   └── TikTokEmbed.tsx     # TikTok video embed
│   ├── data/
│   │   └── exercises.json      # 592 enriched exercises
│   └── lib/
│       ├── search.ts           # Fuse.js search logic
│       └── types.ts            # TypeScript types + constants
├── metadata/                   # yt-dlp output (gitignored)
└── package.json
```

## Deployment

See [hosting-guide.md](hosting-guide.md) for step-by-step Vercel deployment instructions.
