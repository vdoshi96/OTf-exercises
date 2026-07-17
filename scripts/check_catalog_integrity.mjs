#!/usr/bin/env node

import { createHash } from "node:crypto";
import { readFile, stat } from "node:fs/promises";
import { dirname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import sharp from "sharp";


const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const projectDirectory = resolve(scriptDirectory, "..");
const catalogPath = resolve(projectDirectory, "src/data/exercises.json");
const publicDirectory = resolve(projectDirectory, "public");
const thumbnailDirectory = resolve(publicDirectory, "thumbs");
const defaultThumbnailReportPath = resolve(
  projectDirectory,
  "docs/qa/latest/thumbnail-report.json",
);
const fallbackThumbnailUrl = "/thumbs/fallback-exercise.jpg";
const minimumImageBytes = 1_000;
const maximumImageBytes = 15 * 1024 * 1024;
const minimumImageDimension = 64;

const allowedCategories = new Set([
  "upper_body",
  "lower_body",
  "core",
  "full_body",
  "cardio",
  "mobility",
  "other",
]);
const allowedMovementTypes = new Set([
  "compound",
  "isolation",
  "cardio",
  "stretch",
  "other",
]);
const allowedSources = new Set(["instagram", "tiktok"]);
const expectedCreators = new Map([
  ["coachingotf", { handle: "coachingotf", display_name: "Coach Rudy" }],
  [
    "trainingtall",
    { handle: "trainingtall", display_name: "Austin Hendrickson (Trainingtall)" },
  ],
]);
const rejectedImageHashes = new Set([
  "b421b00fd1791a1d1ab70dd1e9667f40ca79a8c8673989864f1be092295cd7da",
]);


function addUnique(errors, seen, kind, value, context) {
  if (!value || typeof value !== "string") {
    errors.push(`${context}: missing ${kind}`);
    return;
  }
  if (seen.has(value)) {
    errors.push(`${context}: duplicate ${kind} ${JSON.stringify(value)}`);
    return;
  }
  seen.add(value);
}


async function mapWithConcurrency(values, concurrency, worker) {
  let nextIndex = 0;
  const runners = Array.from(
    { length: Math.min(concurrency, values.length) },
    async () => {
      while (nextIndex < values.length) {
        const index = nextIndex;
        nextIndex += 1;
        await worker(values[index], index);
      }
    },
  );
  await Promise.all(runners);
}


async function validateThumbnail(thumbnail, errors) {
  if (typeof thumbnail !== "string" || !thumbnail.startsWith("/thumbs/")) {
    errors.push(`thumbnail ${JSON.stringify(thumbnail)} is not a local /thumbs/ path`);
    return;
  }

  const absolutePath = resolve(publicDirectory, thumbnail.slice(1));
  const relativeToThumbs = relative(thumbnailDirectory, absolutePath);
  if (relativeToThumbs.startsWith("..") || relativeToThumbs === "") {
    errors.push(`thumbnail path escapes public/thumbs: ${thumbnail}`);
    return;
  }

  let fileBuffer;
  try {
    const fileStats = await stat(absolutePath);
    if (!fileStats.isFile() || fileStats.size < minimumImageBytes) {
      errors.push(
        `${thumbnail}: thumbnail is smaller than ${minimumImageBytes} bytes`,
      );
      return;
    }
    if (fileStats.size > maximumImageBytes) {
      errors.push(
        `${thumbnail}: thumbnail is larger than ${maximumImageBytes} bytes`,
      );
      return;
    }
    fileBuffer = await readFile(absolutePath);
  } catch (error) {
    errors.push(`${thumbnail}: cannot read thumbnail (${error.message})`);
    return;
  }

  const hash = createHash("sha256").update(fileBuffer).digest("hex");
  if (rejectedImageHashes.has(hash)) {
    errors.push(`${thumbnail}: matches the known Instagram error-logo image`);
    return;
  }

  try {
    const decoder = sharp(fileBuffer, {
      failOn: "error",
      limitInputPixels: true,
    });
    const metadata = await decoder.metadata();
    // metadata() can succeed after parsing only a header. Rendering forces the
    // same complete decoder pass used by the thumbnail worker.
    await decoder.clone().resize(1, 1, { fit: "fill" }).raw().toBuffer();
    if (
      !metadata.width ||
      !metadata.height ||
      !metadata.format ||
      metadata.width < minimumImageDimension ||
      metadata.height < minimumImageDimension
    ) {
      errors.push(
        `${thumbnail}: image dimensions are too small or incomplete ` +
          `(${metadata.width ?? 0}x${metadata.height ?? 0})`,
      );
    }
  } catch (error) {
    errors.push(`${thumbnail}: image is not decodable (${error.message})`);
  }
}


function parseArguments(args) {
  let thumbnailReportPath = null;
  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    if (argument === "--thumbnail-report") {
      const value = args[index + 1];
      if (!value || value.startsWith("--")) {
        throw new Error("--thumbnail-report requires a path");
      }
      thumbnailReportPath = resolve(process.cwd(), value);
      index += 1;
      continue;
    }
    if (argument === "--latest-thumbnail-report") {
      thumbnailReportPath = defaultThumbnailReportPath;
      continue;
    }
    throw new Error(`unknown argument: ${argument}`);
  }
  return { thumbnailReportPath };
}


async function validateThumbnailReport({
  errors,
  fallbackVideoIds,
  thumbnailReportPath,
  videoCount,
}) {
  if (!thumbnailReportPath) return;

  let report;
  try {
    report = JSON.parse(await readFile(thumbnailReportPath, "utf8"));
  } catch (error) {
    errors.push(`thumbnail report cannot be read (${thumbnailReportPath}): ${error.message}`);
    return;
  }

  if (report?.after?.total !== videoCount) {
    errors.push(
      `thumbnail report covers ${report?.after?.total ?? "unknown"} videos; ` +
        `catalog contains ${videoCount}`,
    );
  }
  if (report?.after?.empty !== 0 || report?.after?.remote !== 0) {
    errors.push("thumbnail report still contains empty or remote references");
  }
  if (report?.after?.fallback !== fallbackVideoIds.size) {
    errors.push(
      `thumbnail report lists ${report?.after?.fallback ?? "unknown"} fallbacks; ` +
        `catalog contains ${fallbackVideoIds.size}`,
    );
  }

  const reportedFallbackIds = new Set(
    (report?.failures ?? [])
      .filter((failure) => Array.isArray(failure?.errors) && failure.errors.length > 0)
      .map((failure) => failure.video_id),
  );
  for (const videoId of fallbackVideoIds) {
    if (!reportedFallbackIds.has(videoId)) {
      errors.push(
        `fallback video ${videoId} has no explicit fallback/failure entry in the thumbnail report`,
      );
    }
  }
}


async function main() {
  const { thumbnailReportPath } = parseArguments(process.argv.slice(2));
  const catalog = JSON.parse(await readFile(catalogPath, "utf8"));
  if (!Array.isArray(catalog)) {
    throw new Error("src/data/exercises.json must contain an array");
  }

  const errors = [];
  const groupIds = new Set();
  const videoIds = new Set();
  const videoUrls = new Set();
  const thumbnails = new Set();
  const fallbackVideoIds = new Set();
  let videoCount = 0;

  for (const [groupIndex, exercise] of catalog.entries()) {
    const context = `exercise[${groupIndex}]`;
    addUnique(errors, groupIds, "exercise id", exercise?.id, context);
    if (!exercise?.exercise_name || typeof exercise.exercise_name !== "string") {
      errors.push(`${context}: missing exercise_name`);
    }
    if (!allowedCategories.has(exercise?.category)) {
      errors.push(`${context}: invalid category ${JSON.stringify(exercise?.category)}`);
    }
    if (!allowedMovementTypes.has(exercise?.movement_type)) {
      errors.push(`${context}: invalid movement_type ${JSON.stringify(exercise?.movement_type)}`);
    }
    for (const key of ["muscle_groups", "equipment", "coaching_cues"]) {
      if (!Array.isArray(exercise?.[key]) || exercise[key].some((item) => typeof item !== "string")) {
        errors.push(`${context}: ${key} must be an array of strings`);
      }
    }
    if (!Array.isArray(exercise?.videos) || exercise.videos.length === 0) {
      errors.push(`${context}: videos must be a nonempty array`);
      continue;
    }

    for (const [videoIndex, video] of exercise.videos.entries()) {
      videoCount += 1;
      const videoContext = `${context}.videos[${videoIndex}]`;
      addUnique(errors, videoIds, "video id", video?.id, videoContext);
      addUnique(errors, videoUrls, "video URL", video?.url, videoContext);
      if (!allowedSources.has(video?.source)) {
        errors.push(`${videoContext}: invalid source ${JSON.stringify(video?.source)}`);
      }

      const creator = video?.creator;
      const expectedCreator = expectedCreators.get(creator?.id);
      if (!expectedCreator) {
        errors.push(`${videoContext}: invalid creator ${JSON.stringify(creator?.id)}`);
      } else {
        if (creator.handle !== expectedCreator.handle) {
          errors.push(`${videoContext}: creator handle does not match ${creator.id}`);
        }
        if (creator.display_name !== expectedCreator.display_name) {
          errors.push(`${videoContext}: creator display_name does not match ${creator.id}`);
        }
        if (typeof creator.profile_url !== "string" || !creator.profile_url.startsWith("https://")) {
          errors.push(`${videoContext}: creator profile_url must be an HTTPS URL`);
        }
      }

      if (typeof video?.thumbnail !== "string" || !video.thumbnail.startsWith("/thumbs/")) {
        errors.push(`${videoContext}: thumbnail must be a nonempty local /thumbs/ path`);
      } else {
        thumbnails.add(video.thumbnail);
        if (video.thumbnail === fallbackThumbnailUrl) {
          fallbackVideoIds.add(video.id);
        }
      }
    }
  }

  await mapWithConcurrency([...thumbnails], 12, async (thumbnail) => {
    await validateThumbnail(thumbnail, errors);
  });
  await validateThumbnailReport({
    errors,
    fallbackVideoIds,
    thumbnailReportPath,
    videoCount,
  });

  if (errors.length > 0) {
    console.error(`Catalog integrity FAILED with ${errors.length} problem(s):`);
    for (const error of errors.slice(0, 100)) {
      console.error(`  - ${error}`);
    }
    if (errors.length > 100) {
      console.error(`  ... ${errors.length - 100} additional problem(s) omitted`);
    }
    process.exitCode = 1;
    return;
  }

  console.log(
    `Catalog integrity passed: ${catalog.length} exercise groups, ${videoCount} videos, ` +
      `${thumbnails.size} unique local thumbnails.`,
  );
}


await main();
