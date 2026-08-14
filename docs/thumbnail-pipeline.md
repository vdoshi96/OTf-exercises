# Thumbnail Pipeline

The exercise and coaching catalogs store durable local thumbnail paths. A video thumbnail must be
either a validated `/thumbs/...` asset or the shared
`/thumbs/fallback-exercise.jpg`; remote CDN URLs and blank image states are not
valid release output.

`scripts/ensure-thumbnails.mjs` is the single implementation used by the
refresh workflow and the legacy platform-specific entry points.

## Recovery order

| Platform | First candidate | Fallback candidate | Stable filename |
| --- | --- | --- | --- |
| Instagram | A live signed URL supplied by the latest scrape | Public post `og:image` | `public/thumbs/<shortcode>.jpg` |
| TikTok | A live signed URL supplied by the latest scrape | Official TikTok oEmbed `thumbnail_url` | `public/thumbs/tiktok-<video-id>.jpg` |

Existing local files are decoded and validated before they are reused. File
existence by itself is not considered a cache hit.

For an unavailable post, the pipeline assigns
`public/thumbs/fallback-exercise.jpg`. This is a deterministic 640x960,
quality-72 progressive JPEG generated from `public/otf-logo.svg` on `#111111`
with a visible orange `UNOFFICIAL FAN DIRECTORY` panel. The fallback is a
presentation and transparency safeguard, not a permanent cache hit: the
pipeline retries source recovery on every later run.

## Integrity guarantees

Each remote candidate is handled as follows:

1. Fetch with four workers, a 200ms per-worker pause after network recovery, a
   15-second timeout, and up to three attempts. The timeout remains active while
   the response body is read, and body-stream errors retry the entire request.
   HTTP 408, 425, 429, and 5xx responses are retryable; permanent 4xx responses
   fail immediately and their bodies are cancelled.
2. Stream each image through a hard 15 MB cap before allocating the final
   buffer. Reject payloads under 1 KB, images smaller than 64x64, incomplete
   decodes, and the known Instagram branding-page content hash.
3. Auto-rotate, resize to at most 640 pixels wide without enlargement, strip
   metadata, and encode as quality-72 mozjpeg.
4. Write and sync a temporary file, then atomically rename it to the stable
   path. A failed candidate never replaces a valid local asset.
5. Replace an unrecoverable remote or blank reference with the durable fallback
   and record the failure in the JSON report.

Both public catalogs are written atomically. Before committing either one, the
worker verifies that no other refresh process changed its source file while
downloads were running; if it did, the worker exits rather than overwriting the
newer data.

Before processing public records, the pipeline removes only canonical image
files whose video IDs have durable `exclude` decisions in
`data/catalog-curation.json`. Other orphaned images are left untouched, and
video arrays are never reordered. The report records the narrowly pruned
filenames in `excluded_thumbnails_pruned`.

## Commands

```bash
# Normal post-refresh run; writes images, catalogue refs, and QA report
node scripts/ensure-thumbnails.mjs

# Full network/decoding preview with no filesystem writes
node scripts/ensure-thumbnails.mjs --dry-run

# Validate locals and assign the fallback without network recovery
node scripts/ensure-thumbnails.mjs --skip-download

# Re-fetch real local thumbnails, preserving them if recovery fails
node scripts/ensure-thumbnails.mjs --force

# Focused troubleshooting
node scripts/ensure-thumbnails.mjs --source instagram --limit 10
node scripts/ensure-thumbnails.mjs --source tiktok --limit 10

# Fixture/automation paths
node scripts/ensure-thumbnails.mjs \
  --catalog /tmp/exercises.json \
  --coaching-catalog /tmp/coaching.json \
  --thumbs-dir /tmp/thumbs \
  --report /tmp/thumbnail-report.json
```

Other supported controls are `--coaching-catalog`, `--concurrency`, `--between-items-ms`,
`--attempts`, `--timeout-ms`, and `--no-report`. Run
`node scripts/ensure-thumbnails.mjs --help` for the complete CLI reference.

`scripts/download_instagram_thumbnails.mjs` and
`scripts/download-tiktok-thumbs.mjs` remain as compatibility entry points. They
delegate to the same worker with the appropriate `--source` value; they do not
contain separate download logic. Filtered runs do not overwrite the canonical
full-run QA report; pass an explicit different `--report` path when a focused
run needs its own artifact.

## Report and release checks

Normal runs write `docs/qa/latest/thumbnail-report.json`. The canonical report
covers every public exercise and coaching video together. It includes before
and after coverage, catalog membership, per-platform statuses,
fallback-generation provenance, options, and per-video failure reasons. A dry
run writes no report unless the caller chooses a separate automation around the
returned output.

Run the focused suite after changing this worker:

```bash
node --test tests/thumbnail-pipeline.test.mjs
```

Before release, verify the report and catalogue show:

- zero remote thumbnail references;
- zero empty thumbnail references;
- every referenced local file is present and decodable;
- no known Instagram error-logo hash;
- every fallback assignment has a corresponding report entry;
- no curation-proven excluded thumbnail remains under `public/thumbs`;
- the app build and mobile visual checks pass.
