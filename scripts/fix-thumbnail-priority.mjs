import { readFileSync, writeFileSync, statSync, unlinkSync } from "fs";
import { join } from "path";

const ROOT = process.cwd();
const EXERCISES_PATH = join(ROOT, "src/data/exercises.json");
const THUMBS_DIR = join(ROOT, "public/thumbs");

const INSTAGRAM_LOGO_SIZE = 778568;

function isInstagramLogo(thumbPath) {
  if (!thumbPath.startsWith("/thumbs/")) return false;
  const diskPath = join(THUMBS_DIR, thumbPath.split("/").pop());
  try {
    return statSync(diskPath).size === INSTAGRAM_LOGO_SIZE;
  } catch {
    return false;
  }
}

function thumbnailQuality(thumb) {
  if (!thumb) return 0;
  if (isInstagramLogo(thumb)) return 0;
  if (thumb.startsWith("/thumbs/")) return 3; // local, real
  return 1; // remote CDN (likely expired)
}

const exercises = JSON.parse(readFileSync(EXERCISES_PATH, "utf-8"));

let reordered = 0;
let logosCleared = 0;
let logoFilesDeleted = new Set();

for (const ex of exercises) {
  // Clear Instagram logo thumbnails from all videos
  for (const v of ex.videos) {
    if (isInstagramLogo(v.thumbnail)) {
      const filename = v.thumbnail.split("/").pop();
      logoFilesDeleted.add(filename);
      v.thumbnail = "";
      logosCleared++;
    }
  }

  // Sort videos so the one with the best thumbnail comes first
  const origFirst = ex.videos[0]?.id;
  ex.videos.sort((a, b) => thumbnailQuality(b.thumbnail) - thumbnailQuality(a.thumbnail));
  if (ex.videos[0]?.id !== origFirst) reordered++;
}

// Delete the Instagram logo files from disk
for (const filename of logoFilesDeleted) {
  try {
    unlinkSync(join(THUMBS_DIR, filename));
  } catch {}
}

writeFileSync(EXERCISES_PATH, JSON.stringify(exercises, null, 2) + "\n");

console.log(`Videos reordered (best thumb first): ${reordered} exercises`);
console.log(`Instagram logo thumbs cleared: ${logosCleared} videos`);
console.log(`Logo files deleted from disk: ${logoFilesDeleted.size}`);
console.log(`Total exercises: ${exercises.length}`);

// Post-fix analysis
let localReal = 0, empty = 0, remote = 0;
for (const ex of exercises) {
  const t = ex.videos[0]?.thumbnail || "";
  if (!t) empty++;
  else if (t.startsWith("/")) localReal++;
  else remote++;
}
console.log(`\nFirst-video thumbnail after fix:`);
console.log(`  Real local: ${localReal}`);
console.log(`  Remote CDN: ${remote}`);
console.log(`  Empty (needs fallback): ${empty}`);
