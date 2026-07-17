# OTF Exercise Directory

A searchable, unofficial fan directory of OrangeTheory Fitness exercise demos from multiple creators and source platforms.

Browse 2,031 exercise demonstrations across 1,286 grouped exercises, filterable by muscle group, equipment, category, platform, and creator. Each exercise links to the original source video.

> **Disclaimer:** This is an unofficial fan directory. All video content belongs to its original creators and source platforms.

## Tech Stack

- **Framework:** Next.js 16 (App Router)
- **Styling:** Tailwind CSS 4
- **Search:** Fuse.js (client-side fuzzy search)
- **Video Embeds:** TikTok and Instagram embeds
- **Data:** Static JSON bundled at build time (1,231 grouped exercises)

## Getting Started

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Safe Data Refresh

The refresh workflow scans Coach Rudy's tracked Instagram and TikTok feeds plus
TrainingTall's Instagram feed. It is incremental and fail-closed: incomplete or
rate-limited scans do not alter the catalogue or advance source state.

```bash
# Always review the dry run first; this writes nothing.
npm run refresh

# Apply the reviewed delta, backfill thumbnails, and run strict integrity checks.
npm run refresh:apply
```

Per-source checkpoints live in `data/refresh-state.json`. Reviewed include,
reject, title, and exact-group decisions live in
`data/refresh-overrides.json`. Each applied run writes provenance and counts to
`data/refresh-report.json`.

### Durable thumbnails

Instagram and TikTok CDN URLs expire, so release data never references them
directly. `scripts/ensure-thumbnails.mjs` recovers each platform's current
preview, validates and normalizes it with Sharp, then stores it under
`public/thumbs/`. Unavailable posts receive a durable local fallback and an
explicit failure entry in `docs/qa/latest/thumbnail-report.json` so the UI never
shows a broken image. See [the thumbnail pipeline](docs/thumbnail-pipeline.md)
for recovery order, validation, and troubleshooting commands.

## Project Structure

```
├── scripts/
│   ├── parse_metadata.py       # Parse yt-dlp .info.json files
│   ├── enrich_local.py         # Local pattern-based enrichment
│   ├── refresh_incremental.py  # Fail-closed creator source importer
│   ├── ensure-thumbnails.mjs   # Shared IG/TikTok local thumbnail worker
│   └── refresh.sh              # Dry-run/apply orchestration
├── data/
│   ├── refresh-state.json      # Last successful source checkpoints
│   ├── refresh-overrides.json  # Reviewed classification decisions
│   └── refresh-report.json     # Latest applied content provenance
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
│   │   ├── TikTokEmbed.tsx     # Tap-to-play TikTok player
│   │   └── InstagramEmbed.tsx  # Instagram video embed
│   ├── data/
│   │   └── exercises.json      # 1,286 grouped exercises
│   └── lib/
│       ├── search.ts           # Fuse.js search logic
│       └── types.ts            # TypeScript types + constants
├── tests/                      # Import, thumbnail, and browser checks
└── package.json
```

## Deployment

See [hosting-guide.md](hosting-guide.md) for step-by-step Vercel deployment instructions.
