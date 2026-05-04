# Thumbnail Pipeline

## Why self-hosted thumbnails?

Instagram CDN URLs expire after a few days (403). TikTok CDN URLs also expire.
If we store remote URLs in `exercises.json`, the site shows broken images for
10-30 seconds while the browser waits for timeout.

**Rule: every thumbnail in `exercises.json` must be a local `/thumbs/` path or
empty string. Zero remote URLs.**

## How it works

`scripts/ensure-thumbnails.mjs` runs as the final step of `refresh.sh` (step 7/7).
It can also be run standalone after any data change.

### The 4-step process

1. **Download Instagram thumbnails** — For any Instagram video missing a local
   thumbnail, fetches the public reel page, extracts `og:image`, downloads the
   JPEG to `public/thumbs/<shortcode>.jpg`.

2. **Purge Instagram logo files** — The scraper sometimes downloads Instagram's
   gradient branding page instead of the actual thumbnail. All such files are
   exactly 778,568 bytes. The script detects them by file size and deletes them.

3. **Reorder videos** — Within each exercise, sorts videos so the one with the
   best local thumbnail comes first. This is what `ExerciseCard` uses for the
   grid preview.

4. **Clear remote URLs** — Any thumbnail that isn't a local `/thumbs/` path gets
   set to empty string. This ensures the site never makes external requests for
   thumbnails.

### Running it

```bash
# As part of full pipeline
./scripts/refresh.sh

# Standalone (after any exercises.json change)
node scripts/ensure-thumbnails.mjs

# Skip downloads (just cleanup + reorder)
node scripts/ensure-thumbnails.mjs --skip-download

# Force re-download everything
node scripts/ensure-thumbnails.mjs --force
```

## For agents refreshing the catalogue

When refreshing exercise data (e.g. after 3 months), always run the full
pipeline via `./scripts/refresh.sh`. The thumbnail step runs automatically
as step 7/7.

If you're only adding new exercises manually (editing `exercises.json`), run
`ensure-thumbnails.mjs` afterwards to download and self-host their thumbnails.

### What the agent should verify after a refresh

1. `node -e "const d=require('./src/data/exercises.json'); let r=0; d.forEach(e=>e.videos.forEach(v=>{if(v.thumbnail && !v.thumbnail.startsWith('/'))r++})); console.log('Remote URLs:', r)"` — should be 0
2. `npm run build` — should pass
3. Check the first few exercises visually if possible

## ExerciseCard behavior

`ExerciseCard` only trusts local `/thumbs/` paths. It is a server component
(no client-side state). If a local thumbnail exists, it renders instantly.
If not, `ExercisePlaceholder` shows immediately with the exercise name,
category icon, and muscle groups. No broken images, no loading delay.
