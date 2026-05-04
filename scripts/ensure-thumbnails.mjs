#!/usr/bin/env node
/**
 * ensure-thumbnails.mjs — Post-refresh thumbnail pipeline step
 *
 * Run after exercises.json is generated to guarantee every exercise has a local
 * thumbnail or is cleanly marked for the fallback placeholder. Designed to be
 * called from refresh.sh or by an agent after a data refresh.
 *
 * What it does (in order):
 *   1. Download Instagram thumbnails via og:image for any Instagram video
 *      missing a local /thumbs/ file
 *   2. Detect and delete Instagram logo files (the scraper sometimes downloads
 *      Instagram's branding page instead of the actual thumbnail — all logo
 *      files are exactly 778,568 bytes with the same content)
 *   3. Reorder videos within each exercise so the video with the best local
 *      thumbnail comes first
 *   4. Clear any remaining remote CDN URLs (TikTok, Instagram CDN, etc.)
 *      so the site never makes external thumbnail requests
 *
 * Result: every thumbnail field in exercises.json is either a local /thumbs/
 * path or empty string. Zero external URLs. Zero broken-image flicker.
 *
 * Usage:
 *   node scripts/ensure-thumbnails.mjs                  # normal run
 *   node scripts/ensure-thumbnails.mjs --skip-download  # cleanup only
 *   node scripts/ensure-thumbnails.mjs --force          # re-download existing
 */

import { readFile, writeFile, mkdir, stat, unlink, access } from "node:fs/promises";
import { readdirSync, constants as fsConstants } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const EXERCISES_PATH = join(ROOT, "src", "data", "exercises.json");
const THUMBS_DIR = join(ROOT, "public", "thumbs");

const args = process.argv.slice(2);
const SKIP_DOWNLOAD = args.includes("--skip-download");
const FORCE = args.includes("--force");
const CONCURRENCY = 4;
const BETWEEN_MS = 300;
const INSTAGRAM_LOGO_SIZE = 778568;
const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15";

async function fileExists(p) {
  try { await access(p, fsConstants.F_OK); return true; } catch { return false; }
}

// ── Step 1: Download Instagram thumbnails ──────────────────────────────

function shortcodeFromUrl(url) {
  const m = /\/(?:reel|p|tv)\/([A-Za-z0-9_-]+)/.exec(url);
  return m ? m[1] : null;
}

async function fetchOgImage(reelUrl) {
  const res = await fetch(reelUrl, {
    headers: { "User-Agent": USER_AGENT, "Accept-Language": "en-US,en;q=0.9" },
    redirect: "follow",
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const html = await res.text();
  const m = /<meta\s+property="og:image"\s+content="([^"]+)"/i.exec(html);
  if (!m) throw new Error("no og:image");
  return m[1].replace(/&amp;/g, "&");
}

async function downloadImage(url, outPath) {
  const res = await fetch(url, {
    headers: { "User-Agent": USER_AGENT, Referer: "https://www.instagram.com/" },
    redirect: "follow",
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length < 500) throw new Error(`too small (${buf.length}b)`);
  await writeFile(outPath, buf);
  return buf.length;
}

async function downloadInstagramThumbnails(exercises) {
  const tasks = [];
  for (const ex of exercises) {
    for (const v of ex.videos) {
      if (v.source !== "instagram") continue;
      const sc = shortcodeFromUrl(v.url);
      if (!sc) continue;
      const diskPath = join(THUMBS_DIR, `${sc}.jpg`);
      const localUrl = `/thumbs/${sc}.jpg`;
      if (!FORCE && await fileExists(diskPath)) {
        v.thumbnail = localUrl;
        continue;
      }
      tasks.push({ video: v, sc, diskPath, localUrl });
    }
  }
  if (tasks.length === 0) {
    console.log("  No Instagram thumbnails to download");
    return { downloaded: 0, failed: 0 };
  }
  console.log(`  ${tasks.length} Instagram thumbnails to download...`);

  let downloaded = 0, failed = 0, done = 0;
  const queue = tasks.slice();
  const worker = async () => {
    while (queue.length) {
      const t = queue.shift();
      try {
        const ogUrl = await fetchOgImage(t.video.url);
        await downloadImage(ogUrl, t.diskPath);
        t.video.thumbnail = t.localUrl;
        downloaded++;
      } catch {
        failed++;
      }
      done++;
      if (done % 25 === 0) console.log(`  [${done}/${tasks.length}] downloaded=${downloaded} failed=${failed}`);
      await new Promise(r => setTimeout(r, BETWEEN_MS));
    }
  };
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));
  console.log(`  Done: ${downloaded} downloaded, ${failed} failed`);
  return { downloaded, failed };
}

// ── Step 2: Purge Instagram logo files ─────────────────────────────────

async function purgeInstagramLogos(exercises) {
  const files = readdirSync(THUMBS_DIR);
  const logoFiles = new Set();

  for (const f of files) {
    try {
      const s = await stat(join(THUMBS_DIR, f));
      if (s.size === INSTAGRAM_LOGO_SIZE) logoFiles.add(f);
    } catch {}
  }

  if (logoFiles.size === 0) {
    console.log("  No Instagram logo files found");
    return 0;
  }

  let cleared = 0;
  for (const ex of exercises) {
    for (const v of ex.videos) {
      if (!v.thumbnail.startsWith("/thumbs/")) continue;
      const fname = v.thumbnail.split("/").pop();
      if (logoFiles.has(fname)) {
        v.thumbnail = "";
        cleared++;
      }
    }
  }

  for (const f of logoFiles) {
    try { await unlink(join(THUMBS_DIR, f)); } catch {}
  }

  console.log(`  Purged ${logoFiles.size} logo files, cleared ${cleared} video thumbnails`);
  return cleared;
}

// ── Step 3: Reorder videos (best local thumbnail first) ────────────────

function thumbnailScore(thumb) {
  if (!thumb) return 0;
  if (thumb.startsWith("/thumbs/")) return 3;
  return 1;
}

function reorderVideos(exercises) {
  let reordered = 0;
  for (const ex of exercises) {
    const origFirst = ex.videos[0]?.id;
    ex.videos.sort((a, b) => thumbnailScore(b.thumbnail) - thumbnailScore(a.thumbnail));
    if (ex.videos[0]?.id !== origFirst) reordered++;
  }
  console.log(`  Reordered videos in ${reordered} exercises`);
  return reordered;
}

// ── Step 4: Clear remote URLs ──────────────────────────────────────────

function clearRemoteUrls(exercises) {
  let cleared = 0;
  for (const ex of exercises) {
    for (const v of ex.videos) {
      if (v.thumbnail && !v.thumbnail.startsWith("/")) {
        v.thumbnail = "";
        cleared++;
      }
    }
  }
  console.log(`  Cleared ${cleared} remote CDN thumbnail URLs`);
  return cleared;
}

// ── Main ───────────────────────────────────────────────────────────────

async function main() {
  await mkdir(THUMBS_DIR, { recursive: true });
  const exercises = JSON.parse(await readFile(EXERCISES_PATH, "utf-8"));

  const countLocal = () => {
    let local = 0, empty = 0;
    for (const ex of exercises) {
      for (const v of ex.videos) {
        if (v.thumbnail && v.thumbnail.startsWith("/")) local++;
        else if (!v.thumbnail) empty++;
      }
    }
    return { local, empty, total: exercises.reduce((s, e) => s + e.videos.length, 0) };
  };

  const before = countLocal();
  console.log(`\n=== ensure-thumbnails ===`);
  console.log(`Before: ${before.local} local, ${before.empty} empty, ${before.total} total videos\n`);

  console.log("[1/4] Download Instagram thumbnails");
  if (SKIP_DOWNLOAD) {
    console.log("  Skipped (--skip-download)");
  } else {
    await downloadInstagramThumbnails(exercises);
  }

  console.log("\n[2/4] Purge Instagram logo files");
  await purgeInstagramLogos(exercises);

  console.log("\n[3/4] Reorder videos (best thumbnail first)");
  reorderVideos(exercises);

  console.log("\n[4/4] Clear remaining remote URLs");
  clearRemoteUrls(exercises);

  await writeFile(EXERCISES_PATH, JSON.stringify(exercises, null, 2) + "\n");

  const after = countLocal();
  console.log(`\nAfter: ${after.local} local, ${after.empty} empty, ${after.total} total videos`);
  console.log(`Exercises with a local thumbnail: ${exercises.filter(e => e.videos.some(v => v.thumbnail.startsWith("/"))).length}/${exercises.length}`);
  console.log(`=== done ===\n`);
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
