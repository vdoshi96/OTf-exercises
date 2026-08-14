# Unofficial OTF Exercise Directory

A searchable, unofficial fan directory of Orangetheory Fitness exercise demos
and reviewed coaching resources from multiple creators and source platforms.

Browse 1,383 demonstrations across 765 grouped exercises, or explore 655
videos across 515 separately classified coaching resources. Exercise results
can be searched or filtered by category, muscle group, equipment, platform, and
creator; coaching results use reviewed topics instead of pretending to have
exercise metadata.

All 1,309 exercise slugs published by the reviewed `7d059a7` baseline remain
resolvable: 714 are still canonical, 546 permanently redirect to one reviewed
destination, 18 open a reviewed split-destination chooser, and 31 open a
reviewed-removal recovery page. Unknown slugs remain true 404 responses.

> **Disclaimer:** This is an unofficial fan-made directory. It is not
> affiliated with, endorsed by, or operated by Orangetheory Fitness.
> Orangetheory, OTF, and related logos are trademarks of their owners. Video
> content belongs to its original creators and source platforms.

## Tech Stack

- **Framework:** Next.js 16 (App Router)
- **Styling:** Tailwind CSS 4
- **Search:** Fuse.js in a server-only directory module with URL-backed filters
- **Video Playback:** Tap-to-play TikTok players and linked Instagram previews
- **Data:** Static reviewed exercise and coaching JSON, exposed to the client as
  compact 24-item summaries
- **Privacy and hardening:** Click-gated third-party media, a public privacy
  explanation, route-aware CSP, anti-framing, MIME, referrer, and permissions
  headers

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
# Check source completeness and candidate totals first; this writes nothing.
npm run refresh

# After item-level review is recorded, apply the reviewed delta, backfill
# thumbnails across both public catalogs, and run strict integrity checks.
npm run refresh:apply
```

Per-source checkpoints live in `data/refresh-state.json`. Durable video-ID
classifications, reviewed destination metadata, equipment-review exceptions,
and controlled exclusion reasons live in `data/catalog-curation.json`.
Unresolved source candidates persist in `data/catalog-review-queue.json` until
a human records a decision; the legacy override maps are retired and must stay
empty. The complete apply workflow holds one repository lock across catalog,
thumbnail, and integrity work, and uses `data/refresh-transaction.json` for
crash-safe multi-file recovery.

`data/refresh-report.json` is intentionally the last historical applied-source
report (`2026-08-14T15:13:18Z`, schema v1). The next reviewed apply will replace
it with the current queue-aware schema; documentation does not misrepresent a
curation-only migration as a new creator-source scan.

### Durable thumbnails

Instagram and TikTok CDN URLs expire, so release data never references them
directly. `scripts/ensure-thumbnails.mjs` covers both public catalogs, recovers
each platform's current preview, validates and normalizes it with Sharp, then
stores it under `public/thumbs/`. Unavailable posts receive a durable local
fallback visibly labelled `UNOFFICIAL FAN DIRECTORY` and an explicit failure
entry in `docs/qa/latest/thumbnail-report.json`. See
[the thumbnail pipeline](docs/thumbnail-pipeline.md) for recovery order,
validation, and troubleshooting commands.

## Documentation parity

Project-owned prose documentation is maintained in source form and generated as
same-directory HTML counterparts. Stage a newly created source document first so
tracked-file discovery includes it without touching private untracked notes. Then
run the canonical regeneration command after editing or adding documentation:

```bash
npm run docs:generate
```

Use `npm run docs:check` for a mutation-free completeness and content-parity
check. The same check runs automatically before every production build.

## Project Structure

```
├── scripts/
│   ├── parse_metadata.py       # Parse yt-dlp .info.json files
│   ├── enrich_local.py         # Local pattern-based enrichment
│   ├── refresh_incremental.py  # Fail-closed creator source importer
│   ├── run_refresh_workflow.py # Whole-workflow lock + validation owner
│   ├── generate-legacy-exercise-routes.mjs # Historical URL ledger
│   ├── ensure-thumbnails.mjs   # Exercise + coaching thumbnail worker
│   └── refresh.sh              # Dry-run/apply orchestration
├── data/
│   ├── catalog-curation.json   # Auditable video-level decisions
│   ├── catalog-baseline-exercise-routes.json # Immutable old URL scope
│   ├── catalog-review-queue.json # Durable unresolved-source queue
│   ├── refresh-state.json      # Last successful source checkpoints
│   ├── refresh-overrides.json  # Retired legacy maps; required empty
│   ├── refresh-transaction.json # Crash-recovery journal; required idle
│   ├── refresh.lock            # Stable whole-workflow process lock
│   └── refresh-report.json     # Last applied source-scan provenance
├── src/
│   ├── app/
│   │   ├── page.tsx            # Server-rendered exercise directory
│   │   ├── api/directory/      # Compact paged directory API
│   │   ├── coaching/           # Coaching index and detail routes
│   │   ├── privacy/            # Media and analytics transparency
│   │   ├── exercise/[id]/
│   │   │   └── page.tsx        # Exercise detail page + video embeds
│   │   ├── robots.ts           # Crawl policy and sitemap pointer
│   │   ├── not-found.tsx       # Branded recovery route
│   │   ├── layout.tsx          # Unofficial identity, nav, and footer
│   │   └── globals.css
│   ├── components/
│   │   ├── SearchBar.tsx       # Debounced URL-backed search
│   │   ├── FilterPanel.tsx     # Category/muscle/equipment/creator filters
│   │   ├── ExerciseCard.tsx    # Exercise card with tags
│   │   ├── ExerciseGrid.tsx    # Responsive card grid
│   │   ├── TikTokEmbed.tsx     # Tap-to-play TikTok player
│   │   └── InstagramEmbed.tsx  # Explicit outbound Instagram preview
│   ├── data/
│   │   ├── exercises.json      # 765 reviewed grouped exercises
│   │   ├── coaching.json       # 515 reviewed coaching resources
│   │   └── legacy-exercise-routes.json # Redirect/recovery outcomes
│   └── lib/
│       ├── directory.ts        # Server-only filtering and summaries
│       ├── query.ts            # Normalized public URL contract
│       ├── search.ts           # Multi-field Fuse.js search logic
│       └── types.ts            # TypeScript types + constants
├── tests/                      # Import, thumbnail, and browser checks
└── package.json
```

## Deployment

See [hosting-guide.md](hosting-guide.md) for the release and Vercel verification
workflow. The independent claim assessment and implemented remediation are in
[the 2026-08-14 audit response](docs/audits/2026-08-14-web-audit-response.md).
