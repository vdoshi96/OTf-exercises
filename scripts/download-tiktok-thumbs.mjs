#!/usr/bin/env node

import { readFile, writeFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import https from "node:https";
import http from "node:http";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const EXERCISES_PATH = join(ROOT, "src", "data", "exercises.json");
const THUMBS_DIR = join(ROOT, "public", "thumbs");
const CONCURRENCY = 5;
const TIMEOUT_MS = 15_000;

function downloadFile(url, dest) {
  return new Promise((resolve, reject) => {
    const protocol = url.startsWith("https") ? https : http;
    const request = protocol.get(url, { timeout: TIMEOUT_MS }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        downloadFile(res.headers.location, dest).then(resolve, reject);
        return;
      }
      if (res.statusCode !== 200) {
        res.resume();
        reject(new Error(`HTTP ${res.statusCode} for ${url}`));
        return;
      }

      const chunks = [];
      res.on("data", (chunk) => chunks.push(chunk));
      res.on("end", async () => {
        const buffer = Buffer.concat(chunks);
        if (buffer.length < 1000) {
          reject(new Error(`Suspiciously small file (${buffer.length} bytes)`));
          return;
        }
        await writeFile(dest, buffer);
        resolve();
      });
      res.on("error", reject);
    });
    request.on("timeout", () => {
      request.destroy();
      reject(new Error(`Timeout after ${TIMEOUT_MS}ms`));
    });
    request.on("error", reject);
  });
}

async function processInBatches(items, batchSize, fn) {
  let completed = 0;
  const total = items.length;

  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    const results = await Promise.allSettled(batch.map(fn));
    completed += batch.length;

    const succeeded = results.filter((r) => r.status === "fulfilled").length;
    const failed = results.filter((r) => r.status === "rejected").length;
    if (failed > 0) {
      const errors = results
        .filter((r) => r.status === "rejected")
        .map((r) => r.reason?.message || String(r.reason));
      console.log(
        `  [${completed}/${total}] +${succeeded} ok, ${failed} failed: ${errors[0]}`
      );
    } else {
      console.log(`  [${completed}/${total}] +${succeeded} ok`);
    }
  }
}

async function main() {
  const raw = await readFile(EXERCISES_PATH, "utf-8");
  const exercises = JSON.parse(raw);

  if (!existsSync(THUMBS_DIR)) {
    await mkdir(THUMBS_DIR, { recursive: true });
  }

  const toDownload = [];

  for (const exercise of exercises) {
    for (const video of exercise.videos) {
      if (video.thumbnail && !video.thumbnail.startsWith("/")) {
        const ext = ".jpg";
        const localPath = `/thumbs/${video.id}${ext}`;
        const destPath = join(THUMBS_DIR, `${video.id}${ext}`);

        if (existsSync(destPath)) {
          video.thumbnail = localPath;
          continue;
        }

        toDownload.push({ video, localPath, destPath, url: video.thumbnail });
      }
    }
  }

  console.log(`Found ${toDownload.length} remote thumbnails to download`);

  let downloaded = 0;
  let failed = 0;
  const failures = [];

  await processInBatches(toDownload, CONCURRENCY, async (item) => {
    try {
      await downloadFile(item.url, item.destPath);
      item.video.thumbnail = item.localPath;
      downloaded++;
    } catch (err) {
      failed++;
      failures.push({ id: item.video.id, error: err.message });
      throw err;
    }
  });

  console.log(`\nResults: ${downloaded} downloaded, ${failed} failed`);
  if (failures.length > 0 && failures.length <= 20) {
    console.log("Failed downloads:");
    for (const f of failures) {
      console.log(`  - ${f.id}: ${f.error}`);
    }
  } else if (failures.length > 20) {
    console.log(`${failures.length} failures (too many to list)`);
  }

  await writeFile(EXERCISES_PATH, JSON.stringify(exercises, null, 2) + "\n");
  console.log("Updated exercises.json");

  let localCount = 0;
  let remoteCount = 0;
  for (const ex of exercises) {
    for (const v of ex.videos) {
      if (v.thumbnail.startsWith("/")) localCount++;
      else remoteCount++;
    }
  }
  console.log(`Final counts: ${localCount} local, ${remoteCount} remote, ${localCount + remoteCount} total`);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
