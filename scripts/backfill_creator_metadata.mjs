import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const DEFAULT_CREATOR = {
  id: "coachingotf",
  display_name: "Coach Rudy",
  handle: "coachingotf",
  profile_url: "https://www.instagram.com/coachingotf/",
};

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const exercisesPath = path.join(__dirname, "..", "src", "data", "exercises.json");

const raw = await readFile(exercisesPath, "utf8");
const exercises = JSON.parse(raw);

let totalVideos = 0;
let addedCreators = 0;
let preservedCreators = 0;

for (const exercise of exercises) {
  for (const video of exercise.videos ?? []) {
    totalVideos += 1;

    if (video.creator) {
      preservedCreators += 1;
      continue;
    }

    video.creator = { ...DEFAULT_CREATOR };
    addedCreators += 1;
  }
}

await writeFile(exercisesPath, `${JSON.stringify(exercises, null, 2)}\n`);

console.log(`videos: ${totalVideos}`);
console.log(`creators added: ${addedCreators}`);
console.log(`creators preserved: ${preservedCreators}`);
