#!/usr/bin/env node

import { createHash } from "node:crypto";
import { readFile, readdir, stat } from "node:fs/promises";
import { dirname, relative, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import sharp from "sharp";
import { legacyExerciseRouteIntegrityErrors } from "./generate-legacy-exercise-routes.mjs";


const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const projectDirectory = resolve(scriptDirectory, "..");
const catalogPath = resolve(projectDirectory, "src/data/exercises.json");
const coachingPath = resolve(projectDirectory, "src/data/coaching.json");
const curationPath = resolve(projectDirectory, "data/catalog-curation.json");
const refreshOverridesPath = resolve(
  projectDirectory,
  "data/refresh-overrides.json",
);
const refreshTransactionPath = resolve(
  projectDirectory,
  "data/refresh-transaction.json",
);
const dataDirectory = resolve(projectDirectory, "data");
const baselineVideoIdsPath = resolve(
  projectDirectory,
  "data/catalog-baseline-video-ids.txt",
);
const baselineExerciseRoutesPath = resolve(
  projectDirectory,
  "data/catalog-baseline-exercise-routes.json",
);
const legacyExerciseRoutesPath = resolve(
  projectDirectory,
  "src/data/legacy-exercise-routes.json",
);
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
const allowedCoachingTopics = new Set([
  "movement-technique",
  "class-delivery",
  "programming",
  "safety-and-modifications",
]);
const allowedCurationDecisions = new Set(["exercise", "coaching", "exclude"]);
const allowedExclusionReasons = new Set([
  "milestone",
  "promotion",
  "event",
  "personal",
  "duplicate",
  "unusable",
]);
export const EXPLICIT_LOAD_TITLE_PATTERN = /biceps? curls?|hammer curls?|shoulder press|chest press|chest (?:fly|flys|flies)|reverse fly|(?<!knee )front raise|lateral raise|upright row|low row|high row|deadlift|snatch|thruster|pullover|triceps? extension|goblet|front loaded|farmer|scaption|high pull|clean(?: |$)|heavy hip bridge|single arm hip hinge swing|skier swing|around the world raise|clock press|arnold press|bicycle press|v[ -]?up with press|push press|lunge to (?:single arm )?squat to press|reverse lunge to press|reciprocating row|sprint rows?|jack press|single leg front press|angled press|squat to press|reverse lunge to (?:full )?step[ -]?up (?:to|and) knee raise|transverse (?:full )?step[ -]?up to knee raise|knee raise with torso rotation|forward lunge with y[ -]?raise/i;
export const SUPPORT_ONLY_EQUIPMENT = new Set([
  "bench",
  "bosu",
  "bodyweight",
]);
const allowedEquipmentReviewExceptionReasons = new Set([
  "thumbnail-inconclusive",
  "movement-does-not-use-external-load",
  "support-only-is-complete",
]);
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

function canonicalThumbnailFilenameForVideoId(videoId) {
  const instagram = /^ig_([A-Za-z0-9_-]+)$/.exec(videoId);
  if (instagram) return `${instagram[1]}.jpg`;

  const tiktok = /^(?:tt_)?(\d+)$/.exec(videoId);
  if (tiktok) return `tiktok-${tiktok[1]}.jpg`;

  return null;
}


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


export function requiredMuscleGroupError(exercise, context = "exercise") {
  if (
    Array.isArray(exercise?.muscle_groups) &&
    exercise.muscle_groups.length === 0
  ) {
    return `${context}: public exercise has no reviewed muscle group`;
  }
  return null;
}

export function legacyOverrideErrors(refreshOverrides) {
  const errors = [];
  for (const legacyKey of [
    "rejected",
    "force_include",
    "append_to_group",
    "title_overrides",
  ]) {
    const legacyOverrides = refreshOverrides?.[legacyKey];
    if (
      !legacyOverrides ||
      typeof legacyOverrides !== "object" ||
      Array.isArray(legacyOverrides)
    ) {
      errors.push(`legacy refresh ${legacyKey} overrides must be an object`);
    } else if (Object.keys(legacyOverrides).length > 0) {
      errors.push(
        `legacy refresh ${legacyKey} overrides must be migrated to catalog-curation decisions`,
      );
    }
  }
  return errors;
}

export function publicDecisionError(videoId, location, decision) {
  if (
    decision?.decision === location.kind &&
    decision.destination_id === location.destinationId
  ) {
    return null;
  }
  return (
    `${location.kind} video ${videoId} has no matching durable ` +
    "curation decision"
  );
}

export function missingMetadataErrors(kind, ids, metadata) {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    return [];
  }
  return [...ids]
    .filter((id) => !Object.hasOwn(metadata, id))
    .map((id) => `${kind} ${id} has no reviewed metadata ledger entry`);
}

export function duplicateNormalizedTitleErrors(kind, records, titleKey) {
  const byTitle = new Map();
  for (const record of records) {
    const normalized = String(record?.[titleKey] ?? "")
      .normalize("NFKD")
      .toLocaleLowerCase("en-US")
      .replace(/[^a-z0-9]+/g, " ")
      .trim();
    if (!normalized) continue;
    byTitle.set(normalized, [...(byTitle.get(normalized) ?? []), record.id]);
  }
  return [...byTitle.entries()]
    .filter(([, ids]) => ids.length > 1)
    .map(
      ([title, ids]) =>
        `${kind} normalized title ${JSON.stringify(title)} is duplicated by ${ids.join(", ")}`,
    );
}

export function explicitLoadReviewClass(exercise) {
  const title = String(exercise?.exercise_name ?? "");
  const equipment = Array.isArray(exercise?.equipment)
    ? exercise.equipment
    : [];
  if (!EXPLICIT_LOAD_TITLE_PATTERN.test(title)) return null;
  if (equipment.length === 0) return "empty_explicit_load";
  if (
    equipment.every((item) => SUPPORT_ONLY_EQUIPMENT.has(item))
  ) {
    return "support_only_loaded_action";
  }
  return null;
}

export function equipmentReviewErrors(exercises, exceptions) {
  const errors = [];
  if (!exceptions || typeof exceptions !== "object" || Array.isArray(exceptions)) {
    return ["catalog curation must contain equipment_review_exceptions"];
  }

  const exercisesById = new Map(exercises.map((exercise) => [exercise.id, exercise]));
  const flagged = new Map(
    exercises
      .map((exercise) => [exercise.id, explicitLoadReviewClass(exercise)])
      .filter(([, reviewClass]) => reviewClass !== null),
  );

  for (const [exerciseId, reviewClass] of flagged) {
    if (!Object.hasOwn(exceptions, exerciseId)) {
      errors.push(
        `exercise ${exerciseId} needs reviewed equipment or an explicit ` +
          `equipment exception (${reviewClass})`,
      );
    }
  }

  for (const [exerciseId, exception] of Object.entries(exceptions)) {
    if (!exercisesById.has(exerciseId)) {
      errors.push(`equipment review exception references missing exercise ${exerciseId}`);
      continue;
    }
    if (!flagged.has(exerciseId)) {
      errors.push(
        `equipment review exception ${exerciseId} no longer matches explicit-load-v1`,
      );
    }
    if (
      !exception ||
      typeof exception !== "object" ||
      Array.isArray(exception) ||
      JSON.stringify(Object.keys(exception).sort()) !==
        JSON.stringify(["note", "reason"])
    ) {
      errors.push(
        `equipment review exception ${exerciseId} must contain only reason and note`,
      );
      continue;
    }
    if (!allowedEquipmentReviewExceptionReasons.has(exception.reason)) {
      errors.push(
        `equipment review exception ${exerciseId} has an invalid reason`,
      );
    }
    if (typeof exception.note !== "string" || !exception.note.trim()) {
      errors.push(
        `equipment review exception ${exerciseId} needs a nonempty note`,
      );
    }
  }
  return errors;
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
  accountedVideoCount,
}) {
  if (!thumbnailReportPath) return;

  let report;
  try {
    report = JSON.parse(await readFile(thumbnailReportPath, "utf8"));
  } catch (error) {
    errors.push(`thumbnail report cannot be read (${thumbnailReportPath}): ${error.message}`);
    return;
  }

  if (report?.after?.total !== accountedVideoCount) {
    errors.push(
      `thumbnail report covers ${report?.after?.total ?? "unknown"} videos; ` +
        `public exercise and coaching catalogs contain ${accountedVideoCount}`,
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
  const [
    catalog,
    coaching,
    curation,
    refreshOverrides,
    refreshTransaction,
    baselineVideoIdsText,
    baselineExerciseRoutes,
    legacyExerciseRoutes,
    dataDirectoryEntries,
  ] = await Promise.all([
    readFile(catalogPath, "utf8").then(JSON.parse),
    readFile(coachingPath, "utf8").then(JSON.parse),
    readFile(curationPath, "utf8").then(JSON.parse),
    readFile(refreshOverridesPath, "utf8").then(JSON.parse),
    readFile(refreshTransactionPath, "utf8").then(JSON.parse),
    readFile(baselineVideoIdsPath, "utf8"),
    readFile(baselineExerciseRoutesPath, "utf8").then(JSON.parse),
    readFile(legacyExerciseRoutesPath, "utf8").then(JSON.parse),
    readdir(dataDirectory),
  ]);
  if (!Array.isArray(catalog)) {
    throw new Error("src/data/exercises.json must contain an array");
  }
  if (!Array.isArray(coaching)) {
    throw new Error("src/data/coaching.json must contain an array");
  }
  if (!curation || typeof curation !== "object" || Array.isArray(curation)) {
    throw new Error("data/catalog-curation.json must contain an object");
  }
  if (
    !refreshOverrides ||
    typeof refreshOverrides !== "object" ||
    Array.isArray(refreshOverrides)
  ) {
    throw new Error("data/refresh-overrides.json must contain an object");
  }

  const errors = [];
  const groupIds = new Set();
  const exerciseById = new Map();
  const coachingIds = new Set();
  const coachingById = new Map();
  const videoIds = new Set();
  const videoUrls = new Set();
  const videoLocations = new Map();
  const thumbnails = new Set();
  const fallbackVideoIds = new Set();
  const reviewedCoachingCues = curation?.reviewed_coaching_cues;
  let exerciseVideoCount = 0;
  let coachingVideoCount = 0;

  errors.push(
    ...duplicateNormalizedTitleErrors(
      "exercise",
      catalog,
      "exercise_name",
    ),
    ...duplicateNormalizedTitleErrors("coaching resource", coaching, "title"),
    ...equipmentReviewErrors(
      catalog,
      curation?.equipment_review_exceptions,
    ),
  );

  if (
    !refreshTransaction ||
    typeof refreshTransaction !== "object" ||
    Array.isArray(refreshTransaction) ||
    refreshTransaction.version !== 1 ||
    refreshTransaction.status !== "idle" ||
    refreshTransaction.transaction_id !== null
  ) {
    errors.push(
      "refresh transaction must be a valid idle journal before catalog validation or release",
    );
  }
  const stagedRefreshFiles = dataDirectoryEntries.filter((entry) =>
    /^\..+\.refresh-stage-.+\.json$/.test(entry),
  );
  if (stagedRefreshFiles.length > 0) {
    errors.push(
      `orphaned refresh stage files must be recovered before release: ${stagedRefreshFiles.join(", ")}`,
    );
  }

  errors.push(...legacyOverrideErrors(refreshOverrides));
  errors.push(
    ...legacyExerciseRouteIntegrityErrors({
      baseline: baselineExerciseRoutes,
      ledger: legacyExerciseRoutes,
      catalog,
      coaching,
      curation,
    }),
  );

  function validateVideoRecord(video, context, kind, destinationId) {
    const expectedVideoKeys = [
      "creator",
      "description",
      "id",
      "source",
      "thumbnail",
      "url",
    ];
    if (
      !video ||
      typeof video !== "object" ||
      JSON.stringify(Object.keys(video).sort()) !== JSON.stringify(expectedVideoKeys)
    ) {
      errors.push(`${context}: video must use the canonical Video shape`);
    }

    const alreadySeen = videoIds.has(video?.id);
    addUnique(errors, videoIds, "video id", video?.id, context);
    addUnique(errors, videoUrls, "video URL", video?.url, context);
    if (!alreadySeen && typeof video?.id === "string") {
      videoLocations.set(video.id, { kind, destinationId });
    }
    if (typeof video?.url !== "string" || !video.url.startsWith("https://")) {
      errors.push(`${context}: video URL must be HTTPS`);
    }
    if (typeof video?.description !== "string") {
      errors.push(`${context}: description must be a string`);
    }
    if (!allowedSources.has(video?.source)) {
      errors.push(`${context}: invalid source ${JSON.stringify(video?.source)}`);
    }

    const creator = video?.creator;
    const expectedCreator = expectedCreators.get(creator?.id);
    if (!expectedCreator) {
      errors.push(`${context}: invalid creator ${JSON.stringify(creator?.id)}`);
    } else {
      if (creator.handle !== expectedCreator.handle) {
        errors.push(`${context}: creator handle does not match ${creator.id}`);
      }
      if (creator.display_name !== expectedCreator.display_name) {
        errors.push(`${context}: creator display_name does not match ${creator.id}`);
      }
      if (typeof creator.profile_url !== "string" || !creator.profile_url.startsWith("https://")) {
        errors.push(`${context}: creator profile_url must be an HTTPS URL`);
      }
    }

    if (typeof video?.thumbnail !== "string" || !video.thumbnail.startsWith("/thumbs/")) {
      errors.push(`${context}: thumbnail must be a nonempty local /thumbs/ path`);
    } else {
      thumbnails.add(video.thumbnail);
      if (video.thumbnail === fallbackThumbnailUrl) {
        fallbackVideoIds.add(video.id);
      }
    }
  }

  for (const [groupIndex, exercise] of catalog.entries()) {
    const context = `exercise[${groupIndex}]`;
    addUnique(errors, groupIds, "exercise id", exercise?.id, context);
    if (typeof exercise?.id === "string" && !exerciseById.has(exercise.id)) {
      exerciseById.set(exercise.id, exercise);
    }
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
    if (
      Array.isArray(exercise?.equipment) &&
      exercise.equipment.includes("bodyweight") &&
      !curation?.exercise_metadata?.[exercise.id]?.equipment?.includes(
        "bodyweight",
      ) &&
      !/body[ -]?weight|no equipment/i.test(exercise.exercise_name ?? "")
    ) {
      errors.push(
        `${context}: bodyweight equipment lacks reviewed or title-explicit provenance`,
      );
    }
    const expectedCues = reviewedCoachingCues?.[exercise?.id] ?? [];
    if (
      Array.isArray(exercise?.coaching_cues) &&
      JSON.stringify(exercise.coaching_cues) !== JSON.stringify(expectedCues)
    ) {
      errors.push(
        `${context}: coaching_cues differ from the reviewed curation ledger`,
      );
    }
    const missingMuscleError = requiredMuscleGroupError(exercise, context);
    if (missingMuscleError) errors.push(missingMuscleError);
    if (Array.isArray(exercise?.coaching_cues)) {
      for (const [cueIndex, cue] of exercise.coaching_cues.entries()) {
        const cueContext = `${context}.coaching_cues[${cueIndex}]`;
        if (!cue || cue !== cue.trim()) {
          errors.push(`${cueContext}: cue must be nonempty and trimmed`);
        }
        if (/[\r\n]/.test(cue)) {
          errors.push(`${cueContext}: cue contains a line break`);
        }
        if (/(^|\s)#[A-Za-z][A-Za-z0-9_]*/.test(cue)) {
          errors.push(`${cueContext}: cue contains social hashtags`);
        }
        if (/\bso we want to kee$/i.test(cue)) {
          errors.push(`${cueContext}: cue is a known truncated source fragment`);
        }
      }
    }
    if (!Array.isArray(exercise?.videos) || exercise.videos.length === 0) {
      errors.push(`${context}: videos must be a nonempty array`);
      continue;
    }

    for (const [videoIndex, video] of exercise.videos.entries()) {
      exerciseVideoCount += 1;
      const videoContext = `${context}.videos[${videoIndex}]`;
      validateVideoRecord(video, videoContext, "exercise", exercise.id);
    }
  }

  for (const [resourceIndex, resource] of coaching.entries()) {
    const context = `coaching[${resourceIndex}]`;
    const expectedResourceKeys = [
      "id",
      "related_exercise_ids",
      "summary",
      "title",
      "topic",
      "videos",
    ];
    if (
      !resource ||
      typeof resource !== "object" ||
      JSON.stringify(Object.keys(resource).sort()) !== JSON.stringify(expectedResourceKeys)
    ) {
      errors.push(`${context}: resource must use the canonical CoachingResource shape`);
    }
    addUnique(errors, coachingIds, "coaching resource id", resource?.id, context);
    if (typeof resource?.id === "string" && !coachingById.has(resource.id)) {
      coachingById.set(resource.id, resource);
    }
    if (!resource?.title || typeof resource.title !== "string") {
      errors.push(`${context}: missing title`);
    }
    if (!resource?.summary || typeof resource.summary !== "string") {
      errors.push(`${context}: missing summary`);
    }
    if (!allowedCoachingTopics.has(resource?.topic)) {
      errors.push(`${context}: invalid topic ${JSON.stringify(resource?.topic)}`);
    }
    if (
      !Array.isArray(resource?.related_exercise_ids) ||
      resource.related_exercise_ids.some((id) => typeof id !== "string")
    ) {
      errors.push(`${context}: related_exercise_ids must be an array of strings`);
    } else {
      for (const exerciseId of resource.related_exercise_ids) {
        if (!groupIds.has(exerciseId)) {
          errors.push(`${context}: related exercise does not exist: ${exerciseId}`);
        }
      }
    }
    if (!Array.isArray(resource?.videos) || resource.videos.length === 0) {
      errors.push(`${context}: videos must be a nonempty array`);
      continue;
    }
    for (const [videoIndex, video] of resource.videos.entries()) {
      coachingVideoCount += 1;
      validateVideoRecord(
        video,
        `${context}.videos[${videoIndex}]`,
        "coaching",
        resource.id,
      );
    }
  }

  const knownClean = exerciseById.get("hang-power-clean-options");
  if (
    knownClean &&
    (!knownClean.equipment.includes("dumbbell") ||
      knownClean.equipment.includes("bodyweight"))
  ) {
    errors.push(
      "hang-power-clean-options must be reviewed as dumbbell equipment, not bodyweight",
    );
  }

  const curationDecisions = curation?.decisions;
  const legacyOtherSourceGroups = new Set();
  const catalogAuditSourceGroups = new Set();
  let legacyOtherReviewedVideos = 0;
  let catalogAuditReviewedVideos = 0;
  let reviewQueueReviewedVideos = 0;
  let legacyRefreshReviewedVideos = 0;
  let excludedVideoCount = 0;
  if (
    !curationDecisions ||
    typeof curationDecisions !== "object" ||
    Array.isArray(curationDecisions)
  ) {
    errors.push("catalog curation must contain a decisions object");
  } else {
    for (const [videoId, decision] of Object.entries(curationDecisions)) {
      const context = `curation.decisions[${JSON.stringify(videoId)}]`;
      if (!decision || typeof decision !== "object" || Array.isArray(decision)) {
        errors.push(`${context}: decision must be an object`);
        continue;
      }
      if (!allowedCurationDecisions.has(decision.decision)) {
        errors.push(`${context}: invalid decision ${JSON.stringify(decision.decision)}`);
        continue;
      }
      if (decision.review_origin === "legacy-other") {
        legacyOtherReviewedVideos += 1;
        if (!decision.source_group_id || typeof decision.source_group_id !== "string") {
          errors.push(`${context}: legacy-other decision needs source_group_id`);
        } else {
          legacyOtherSourceGroups.add(decision.source_group_id);
        }
      } else if (decision.review_origin === "catalog-audit") {
        catalogAuditReviewedVideos += 1;
        if (!decision.source_group_id || typeof decision.source_group_id !== "string") {
          errors.push(`${context}: catalog-audit decision needs source_group_id`);
        } else {
          catalogAuditSourceGroups.add(decision.source_group_id);
        }
      } else if (decision.review_origin === "review-queue") {
        reviewQueueReviewedVideos += 1;
        if (Object.hasOwn(decision, "source_group_id")) {
          errors.push(`${context}: review-queue decision must not have source_group_id`);
        }
      } else if (decision.review_origin === "legacy-refresh") {
        legacyRefreshReviewedVideos += 1;
        if (Object.hasOwn(decision, "source_group_id")) {
          errors.push(`${context}: legacy-refresh decision must not have source_group_id`);
        }
      } else {
        errors.push(`${context}: invalid review_origin ${JSON.stringify(decision.review_origin)}`);
      }

      const location = videoLocations.get(videoId);
      if (decision.decision === "exclude") {
        excludedVideoCount += 1;
        if (!allowedExclusionReasons.has(decision.reason)) {
          errors.push(`${context}: exclusion needs a recognized reason`);
        }
        if (location) {
          errors.push(`${context}: excluded video is still public in ${location.kind}`);
        }
        const excludedFilename = canonicalThumbnailFilenameForVideoId(videoId);
        if (!excludedFilename) {
          errors.push(`${context}: cannot derive canonical excluded thumbnail path`);
        } else {
          try {
            await stat(resolve(thumbnailDirectory, excludedFilename));
            errors.push(
              `${context}: excluded thumbnail is still publicly shipped as ${excludedFilename}`,
            );
          } catch (error) {
            if (error?.code !== "ENOENT") {
              errors.push(
                `${context}: excluded thumbnail path could not be checked (${error.message})`,
              );
            }
          }
        }
        continue;
      }

      if (!decision.destination_id || typeof decision.destination_id !== "string") {
        errors.push(`${context}: ${decision.decision} decision needs destination_id`);
        continue;
      }
      if (!location) {
        errors.push(`${context}: curated video is missing from public data`);
      } else if (
        location.kind !== decision.decision ||
        location.destinationId !== decision.destination_id
      ) {
        errors.push(
          `${context}: expected ${decision.decision}/${decision.destination_id}, ` +
            `found ${location.kind}/${location.destinationId}`,
        );
      }
    }
  }

  if (
    !knownClean &&
    curationDecisions?.["7413564894362111278"]?.decision !== "coaching"
  ) {
    errors.push(
      "the reviewed Hang Power Clean Options video must remain a corrected dumbbell exercise or route to coaching",
    );
  }

  for (const [videoId, location] of videoLocations) {
    const error = publicDecisionError(
      videoId,
      location,
      curationDecisions?.[videoId],
    );
    if (error) errors.push(error);
  }

  const scope = curation?.source_scope;
  const expectedScopeKeys = [
    "catalog_audit_reviewed_groups",
    "catalog_audit_reviewed_videos",
    "catalog_commit",
    "legacy_other_reviewed_groups",
    "legacy_other_reviewed_videos",
    "legacy_refresh_reviewed_videos",
    "review_queue_reviewed_videos",
  ];
  if (
    !scope ||
    typeof scope !== "object" ||
    Array.isArray(scope) ||
    JSON.stringify(Object.keys(scope).sort()) !== JSON.stringify(expectedScopeKeys)
  ) {
    errors.push("curation source_scope must use the canonical provenance counters");
  }
  if (!scope?.catalog_commit || typeof scope.catalog_commit !== "string") {
    errors.push("curation source_scope.catalog_commit must identify the reviewed baseline");
  }
  if (scope?.legacy_other_reviewed_groups !== legacyOtherSourceGroups.size) {
    errors.push(
      "curation source_scope.legacy_other_reviewed_groups does not match legacy source groups",
    );
  }
  if (scope?.legacy_other_reviewed_videos !== legacyOtherReviewedVideos) {
    errors.push(
      "curation source_scope.legacy_other_reviewed_videos does not match decisions",
    );
  }
  if (scope?.catalog_audit_reviewed_groups !== catalogAuditSourceGroups.size) {
    errors.push(
      "curation source_scope.catalog_audit_reviewed_groups does not match source groups",
    );
  }
  if (scope?.catalog_audit_reviewed_videos !== catalogAuditReviewedVideos) {
    errors.push(
      "curation source_scope.catalog_audit_reviewed_videos does not match decisions",
    );
  }
  if (scope?.review_queue_reviewed_videos !== reviewQueueReviewedVideos) {
    errors.push(
      "curation source_scope.review_queue_reviewed_videos does not match decisions",
    );
  }
  if (scope?.legacy_refresh_reviewed_videos !== legacyRefreshReviewedVideos) {
    errors.push(
      "curation source_scope.legacy_refresh_reviewed_videos does not match decisions",
    );
  }

  if (
    !reviewedCoachingCues ||
    typeof reviewedCoachingCues !== "object" ||
    Array.isArray(reviewedCoachingCues)
  ) {
    errors.push("catalog curation must contain reviewed_coaching_cues");
  } else {
    for (const [exerciseId, cues] of Object.entries(reviewedCoachingCues)) {
      if (!exerciseById.has(exerciseId)) {
        errors.push(`reviewed coaching cues reference missing exercise ${exerciseId}`);
      }
      if (
        !Array.isArray(cues) ||
        cues.some((cue) => typeof cue !== "string" || !cue.trim())
      ) {
        errors.push(`reviewed coaching cues are invalid for ${exerciseId}`);
      }
    }
  }

  const baselineVideoIds = baselineVideoIdsText
    .split(/\r?\n/)
    .filter(Boolean);
  const uniqueBaselineVideoIds = new Set(baselineVideoIds);
  if (
    baselineVideoIds.length !== 2072 ||
    uniqueBaselineVideoIds.size !== baselineVideoIds.length
  ) {
    errors.push(
      "catalog baseline manifest must contain 2,072 unique historical video IDs",
    );
  }
  const accountedVideoIds = new Set(videoIds);
  for (const [videoId, decision] of Object.entries(curationDecisions ?? {})) {
    if (decision?.decision === "exclude") accountedVideoIds.add(videoId);
  }
  for (const videoId of uniqueBaselineVideoIds) {
    if (!accountedVideoIds.has(videoId)) {
      errors.push(`historical baseline video is unaccounted for: ${videoId}`);
    }
  }

  const curatedExerciseMetadata = curation?.exercise_metadata;
  if (
    !curatedExerciseMetadata ||
    typeof curatedExerciseMetadata !== "object" ||
    Array.isArray(curatedExerciseMetadata)
  ) {
    errors.push("catalog curation must contain exercise_metadata");
  } else {
    for (const [exerciseId, metadata] of Object.entries(curatedExerciseMetadata)) {
      const exercise = exerciseById.get(exerciseId);
      if (!exercise) {
        errors.push(`curated exercise metadata references missing exercise ${exerciseId}`);
        continue;
      }
      for (const key of [
        "exercise_name",
        "category",
        "muscle_groups",
        "equipment",
        "movement_type",
      ]) {
        if (JSON.stringify(exercise[key]) !== JSON.stringify(metadata?.[key])) {
          errors.push(`curated exercise metadata drifted for ${exerciseId}.${key}`);
        }
      }
    }
    errors.push(
      ...missingMetadataErrors("exercise", groupIds, curatedExerciseMetadata),
    );
  }

  const curatedCoachingMetadata = curation?.coaching_resources;
  if (
    !curatedCoachingMetadata ||
    typeof curatedCoachingMetadata !== "object" ||
    Array.isArray(curatedCoachingMetadata)
  ) {
    errors.push("catalog curation must contain coaching_resources");
  } else {
    for (const [resourceId, metadata] of Object.entries(curatedCoachingMetadata)) {
      const resource = coachingById.get(resourceId);
      if (!resource) {
        errors.push(`curated coaching metadata references missing resource ${resourceId}`);
        continue;
      }
      for (const key of ["title", "topic", "summary", "related_exercise_ids"]) {
        if (JSON.stringify(resource[key]) !== JSON.stringify(metadata?.[key])) {
          errors.push(`curated coaching metadata drifted for ${resourceId}.${key}`);
        }
      }
    }
    errors.push(
      ...missingMetadataErrors("coaching resource", coachingIds, curatedCoachingMetadata),
    );
  }

  await mapWithConcurrency([...thumbnails], 12, async (thumbnail) => {
    await validateThumbnail(thumbnail, errors);
  });
  await validateThumbnailReport({
    errors,
    fallbackVideoIds,
    thumbnailReportPath,
    accountedVideoCount: exerciseVideoCount + coachingVideoCount,
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
    `Catalog integrity passed: ${catalog.length} exercise groups / ` +
      `${exerciseVideoCount} videos, ${coaching.length} coaching resources / ` +
      `${coachingVideoCount} videos, ${excludedVideoCount} reviewed exclusions, ` +
      `${thumbnails.size} unique public thumbnails.`,
  );
}


if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  await main();
}
