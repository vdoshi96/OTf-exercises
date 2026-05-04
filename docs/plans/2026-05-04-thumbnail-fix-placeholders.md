# Thumbnail Fix & Exercise Diagram Placeholders

> **Branch:** `fix/thumbnail-placeholders`
> **Base:** `main`

**Goal:** Self-host TikTok CDN thumbnails so they never expire, and add graceful fallback placeholders that show exercise-relevant muscle group diagrams (like gym machine labels) instead of broken images.

**Architecture:** Download all 603 TikTok CDN thumbnail images to `public/thumbs/`, update `exercises.json` to reference local paths, and add an `onError` handler in `ExerciseCard` that swaps broken images for category-specific SVG exercise diagrams.

**Tech Stack:** Node.js script for downloading, Next.js/React for UI, inline SVGs for placeholders

---

## Current State

- 1980 total videos across 1236 exercises
- 1377 thumbnails already self-hosted at `/thumbs/<id>.jpg` (Instagram videos)
- 603 thumbnails still use TikTok CDN URLs (`p16-common-sign.tiktokcdn-us.com`, `p19-common-sign.tiktokcdn-us.com`) which expire
- All local thumbnail files exist on disk in `public/thumbs/`
- `ExerciseCard.tsx` checks `firstVideo?.thumbnail` for truthiness but has no `onError` handler
- When a TikTok CDN URL expires, the `<img>` tag silently fails, showing a broken image

## Task 1: Download TikTok Thumbnails Locally

**Files:**
- Create: `scripts/download-tiktok-thumbs.mjs`
- Modify: `src/data/exercises.json`

- [ ] **Step 1: Write the download script**

```javascript
// scripts/download-tiktok-thumbs.mjs
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';
import https from 'https';
import http from 'http';

const EXERCISES_PATH = join(process.cwd(), 'src/data/exercises.json');
const THUMBS_DIR = join(process.cwd(), 'public/thumbs');

function download(url) {
  return new Promise((resolve, reject) => {
    const mod = url.startsWith('https') ? https : http;
    mod.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return download(res.headers.location).then(resolve, reject);
      }
      if (res.statusCode !== 200) {
        return reject(new Error(`HTTP ${res.statusCode} for ${url}`));
      }
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => resolve(Buffer.concat(chunks)));
      res.on('error', reject);
    }).on('error', reject);
  });
}

async function main() {
  mkdirSync(THUMBS_DIR, { recursive: true });
  const exercises = JSON.parse(readFileSync(EXERCISES_PATH, 'utf-8'));
  
  let downloaded = 0, failed = 0, skipped = 0;
  
  for (const ex of exercises) {
    for (const video of ex.videos) {
      if (video.thumbnail.startsWith('/')) {
        skipped++;
        continue;
      }
      
      const filename = `${video.id}.jpg`;
      const localPath = `/thumbs/${filename}`;
      const diskPath = join(THUMBS_DIR, filename);
      
      if (existsSync(diskPath)) {
        video.thumbnail = localPath;
        skipped++;
        continue;
      }
      
      try {
        const buf = await download(video.thumbnail);
        writeFileSync(diskPath, buf);
        video.thumbnail = localPath;
        downloaded++;
        if (downloaded % 50 === 0) console.log(`Downloaded ${downloaded}...`);
      } catch (err) {
        console.error(`FAIL ${video.id}: ${err.message}`);
        failed++;
      }
    }
  }
  
  writeFileSync(EXERCISES_PATH, JSON.stringify(exercises, null, 2) + '\n');
  console.log(`Done. Downloaded: ${downloaded}, Skipped: ${skipped}, Failed: ${failed}`);
}

main();
```

- [ ] **Step 2: Run the download script**

Run: `node scripts/download-tiktok-thumbs.mjs`
Expected: Downloads ~603 images to `public/thumbs/`, updates `exercises.json` to use local paths. Some may fail if CDN URLs already expired.

- [ ] **Step 3: Verify all thumbnails are now local**

Run: `node -e "const d=require('./src/data/exercises.json'); let ext=0; d.forEach(e=>e.videos.forEach(v=>{if(!v.thumbnail.startsWith('/'))ext++})); console.log('External thumbs remaining:', ext)"`
Expected: `External thumbs remaining: 0` (or a small number of failures)

## Task 2: Create Exercise Diagram Placeholder SVGs

**Files:**
- Create: `src/components/ExercisePlaceholder.tsx`

- [ ] **Step 4: Create the placeholder component**

Build a component that renders a category-appropriate muscle/exercise diagram SVG. These mimic the diagrams found on gym machines — clean line-art showing target muscle groups.

The component accepts a `category` prop and renders the appropriate diagram.

## Task 3: Add onError Fallback to ExerciseCard

**Files:**
- Modify: `src/components/ExerciseCard.tsx`

- [ ] **Step 5: Make ExerciseCard a client component with onError handler**

Convert `ExerciseCard` to a client component (add `"use client"`) and add state to track image load failure. When the thumbnail `<img>` fires `onError`, swap to the `ExercisePlaceholder` component.

- [ ] **Step 6: Build and verify**

Run: `npm run build`
Expected: Build succeeds with 0 errors

- [ ] **Step 7: Visual verification**

Run: `npm run dev`
Open browser, check that:
1. Cards with local thumbnails load correctly
2. Any remaining external thumbnail failures show the exercise diagram placeholder
3. No broken image icons visible

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "fix: self-host TikTok thumbnails, add exercise diagram placeholders"
```

## Verification Checklist

- [ ] All thumbnails in `exercises.json` use local `/thumbs/` paths
- [ ] `ExerciseCard` has `onError` handler that shows diagram placeholder
- [ ] Placeholder shows category-relevant exercise diagram (not Instagram logo, not broken image)
- [ ] `npm run build` succeeds
- [ ] Visual check in browser passes
