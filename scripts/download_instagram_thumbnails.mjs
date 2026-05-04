#!/usr/bin/env node
// Downloads a fresh thumbnail for every Instagram video referenced in
// `src/data/exercises.json` and rewrites the `thumbnail` field to point to
// the locally hosted copy under `public/thumbs/<shortcode>.jpg`.
//
// Why: Instagram's CDN thumbnail URLs are signed and expire after a few days,
// so the URLs stored at scrape time return HTTP 403 when the static site
// loads them later. Self-hosting the JPEGs in `public/thumbs/` makes them
// stable for as long as we want them in the repo.
//
// How: Each reel's public page (e.g. https://www.instagram.com/reel/<sc>/)
// exposes a fresh, unauthenticated thumbnail URL via the standard
// `<meta property="og:image">` tag. We fetch the HTML, extract og:image,
// then download the JPEG.
//
// Usage:
//   node scripts/download_instagram_thumbnails.mjs            # all reels
//   node scripts/download_instagram_thumbnails.mjs --limit 50 # smoke test
//   node scripts/download_instagram_thumbnails.mjs --force    # re-download
//
// Idempotent: skips reels whose `public/thumbs/<sc>.jpg` already exists
// unless `--force` is passed.

import { mkdir, readFile, writeFile, access } from "node:fs/promises";
import { constants as fsConstants } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, "..");
const DATA_FILE = path.join(REPO_ROOT, "src", "data", "exercises.json");
const THUMBS_DIR = path.join(REPO_ROOT, "public", "thumbs");

const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15";

const args = process.argv.slice(2);
const FORCE = args.includes("--force");
const LIMIT = (() => {
  const i = args.indexOf("--limit");
  if (i === -1) return Infinity;
  const n = Number.parseInt(args[i + 1] ?? "", 10);
  return Number.isFinite(n) ? n : Infinity;
})();
const CONCURRENCY = 4;
const BETWEEN_REQUESTS_MS = 250;

function shortcodeFromUrl(url) {
  // Matches /reel/<sc>/, /p/<sc>/, /tv/<sc>/ paths
  const m = /\/(?:reel|p|tv)\/([A-Za-z0-9_-]+)/.exec(url);
  return m ? m[1] : null;
}

async function fileExists(p) {
  try {
    await access(p, fsConstants.F_OK);
    return true;
  } catch {
    return false;
  }
}

async function fetchOgImage(reelUrl) {
  const res = await fetch(reelUrl, {
    headers: { "User-Agent": USER_AGENT, "Accept-Language": "en-US,en;q=0.9" },
    redirect: "follow",
  });
  if (!res.ok) throw new Error(`reel page ${res.status}`);
  const html = await res.text();
  const m = /<meta\s+property="og:image"\s+content="([^"]+)"/i.exec(html);
  if (!m) throw new Error("no og:image in reel page");
  return m[1].replace(/&amp;/g, "&");
}

async function downloadImage(url, outPath) {
  const res = await fetch(url, {
    headers: { "User-Agent": USER_AGENT, Referer: "https://www.instagram.com/" },
    redirect: "follow",
  });
  if (!res.ok) throw new Error(`image ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length < 256) throw new Error(`image too small (${buf.length}b)`);
  await writeFile(outPath, buf);
  return buf.length;
}

async function processOne(video, stats) {
  const shortcode = shortcodeFromUrl(video.url);
  if (!shortcode) {
    stats.skipped++;
    return { kind: "skip", reason: "no-shortcode" };
  }
  const localPath = path.join(THUMBS_DIR, `${shortcode}.jpg`);
  const localUrl = `/thumbs/${shortcode}.jpg`;

  if (!FORCE && (await fileExists(localPath))) {
    video.thumbnail = localUrl;
    stats.cached++;
    return { kind: "cached", shortcode };
  }

  try {
    const ogImage = await fetchOgImage(video.url);
    const bytes = await downloadImage(ogImage, localPath);
    video.thumbnail = localUrl;
    stats.downloaded++;
    return { kind: "downloaded", shortcode, bytes };
  } catch (err) {
    stats.failed++;
    return { kind: "fail", shortcode, error: String(err?.message ?? err) };
  }
}

async function pool(items, worker, n) {
  const queue = items.slice();
  const results = [];
  const workers = Array.from({ length: n }, async () => {
    while (queue.length) {
      const item = queue.shift();
      // eslint-disable-next-line no-await-in-loop
      results.push(await worker(item));
      // eslint-disable-next-line no-await-in-loop
      await new Promise((r) => setTimeout(r, BETWEEN_REQUESTS_MS));
    }
  });
  await Promise.all(workers);
  return results;
}

async function main() {
  await mkdir(THUMBS_DIR, { recursive: true });
  const raw = await readFile(DATA_FILE, "utf8");
  const exercises = JSON.parse(raw);

  const tasks = [];
  for (const ex of exercises) {
    for (const v of ex.videos ?? []) {
      if (v.source === "instagram") tasks.push(v);
    }
  }
  const total = tasks.length;
  const slice = Number.isFinite(LIMIT) ? tasks.slice(0, LIMIT) : tasks;
  console.log(
    `[ig-thumbs] ${total} instagram videos, processing ${slice.length} (force=${FORCE}, concurrency=${CONCURRENCY})`,
  );

  const stats = { downloaded: 0, cached: 0, failed: 0, skipped: 0 };
  let done = 0;
  await pool(
    slice,
    async (video) => {
      const r = await processOne(video, stats);
      done++;
      if (done % 25 === 0 || r.kind === "fail") {
        console.log(
          `[ig-thumbs] ${done}/${slice.length} d=${stats.downloaded} c=${stats.cached} f=${stats.failed}` +
            (r.kind === "fail" ? ` last-fail=${r.shortcode}:${r.error}` : ""),
        );
      }
      return r;
    },
    CONCURRENCY,
  );

  await writeFile(DATA_FILE, JSON.stringify(exercises, null, 2) + "\n", "utf8");
  console.log(
    `[ig-thumbs] done. downloaded=${stats.downloaded} cached=${stats.cached} failed=${stats.failed} skipped=${stats.skipped}`,
  );
  if (stats.failed > 0) process.exitCode = 1;
}

main().catch((err) => {
  console.error("[ig-thumbs] fatal", err);
  process.exit(1);
});
