import { readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_PATH = join(__dirname, "..", "src", "data", "exercises.json");

const KEEP_CREATORS = new Set(["coachingotf", "trainingtall"]);
const DISPLAY_NAME_UPDATES = {
  trainingtall: "Austin Hendrickson (Trainingtall)",
};

const raw = JSON.parse(readFileSync(DATA_PATH, "utf-8"));

console.log(`Before: ${raw.length} exercises`);

const creatorCountsBefore = {};
for (const ex of raw) {
  for (const v of ex.videos) {
    creatorCountsBefore[v.creator.id] =
      (creatorCountsBefore[v.creator.id] || 0) + 1;
  }
}
console.log("Creator video counts before:", creatorCountsBefore);

const cleaned = raw
  .map((ex) => {
    const filteredVideos = ex.videos
      .filter((v) => KEEP_CREATORS.has(v.creator.id))
      .map((v) => {
        if (DISPLAY_NAME_UPDATES[v.creator.id]) {
          return {
            ...v,
            creator: {
              ...v.creator,
              display_name: DISPLAY_NAME_UPDATES[v.creator.id],
            },
          };
        }
        return v;
      });

    return { ...ex, videos: filteredVideos };
  })
  .filter((ex) => ex.videos.length > 0);

console.log(`\nAfter: ${cleaned.length} exercises`);
console.log(`Removed: ${raw.length - cleaned.length} exercises with no remaining videos`);

const creatorCountsAfter = {};
for (const ex of cleaned) {
  for (const v of ex.videos) {
    creatorCountsAfter[v.creator.id] =
      (creatorCountsAfter[v.creator.id] || 0) + 1;
  }
}
console.log("Creator video counts after:", creatorCountsAfter);

writeFileSync(DATA_PATH, JSON.stringify(cleaned, null, 2) + "\n", "utf-8");
console.log("\nWrote updated exercises.json");
