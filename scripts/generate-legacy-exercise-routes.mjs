#!/usr/bin/env node

import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { promisify } from "node:util";
import { readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const execFileAsync = promisify(execFile);
const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const projectDirectory = resolve(scriptDirectory, "..");

export const BASELINE_CATALOG_COMMIT =
  "7d059a706b585d5340fa91bc953db0193095d2b2";
export const BASELINE_CATALOG_PATH = "src/data/exercises.json";
export const BASELINE_CATALOG_SHA256 =
  "49621385469905c7ce9da075dc01efbbf741d68a8f9ee74a3275e88294ccb2c7";
export const BASELINE_ROUTES_SHA256 =
  "9f08565d076f653b1829eca7e4f7b80617895d8e972f0589dc43c8777bffb5c9";
export const BASELINE_EXERCISE_COUNT = 1_309;
export const BASELINE_VIDEO_COUNT = 2_072;

const baselineManifestPath = resolve(
  projectDirectory,
  "data/catalog-baseline-exercise-routes.json",
);
const catalogPath = resolve(projectDirectory, "src/data/exercises.json");
const coachingPath = resolve(projectDirectory, "src/data/coaching.json");
const curationPath = resolve(projectDirectory, "data/catalog-curation.json");
const legacyRouteLedgerPath = resolve(
  projectDirectory,
  "src/data/legacy-exercise-routes.json",
);

function compareStrings(left, right) {
  return left < right ? -1 : left > right ? 1 : 0;
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function json(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function assertPlainObject(value, context) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${context} must be an object`);
  }
}

/**
 * Reduce the historical catalog to the immutable information needed to keep
 * its public exercise URLs resolvable. The raw source is accepted only when
 * it is byte-for-byte the reviewed baseline commit.
 */
export function buildBaselineExerciseRouteManifest(rawCatalog) {
  if (sha256(rawCatalog) !== BASELINE_CATALOG_SHA256) {
    throw new Error(
      `historical catalog does not match ${BASELINE_CATALOG_COMMIT}:${BASELINE_CATALOG_PATH}`,
    );
  }

  const catalog = JSON.parse(rawCatalog);
  if (!Array.isArray(catalog) || catalog.length !== BASELINE_EXERCISE_COUNT) {
    throw new Error(
      `historical catalog must contain ${BASELINE_EXERCISE_COUNT} exercise routes`,
    );
  }

  const seenRouteIds = new Set();
  const seenVideoIds = new Set();
  const routes = catalog
    .map((exercise, index) => {
      const context = `historical exercise[${index}]`;
      if (!exercise?.id || typeof exercise.id !== "string") {
        throw new Error(`${context} needs a string id`);
      }
      if (seenRouteIds.has(exercise.id)) {
        throw new Error(`${context} duplicates route ${exercise.id}`);
      }
      seenRouteIds.add(exercise.id);
      if (!exercise.exercise_name || typeof exercise.exercise_name !== "string") {
        throw new Error(`${context} needs an exercise_name`);
      }
      if (!Array.isArray(exercise.videos) || exercise.videos.length === 0) {
        throw new Error(`${context} needs at least one video`);
      }

      const videoIds = exercise.videos
        .map((video, videoIndex) => {
          if (!video?.id || typeof video.id !== "string") {
            throw new Error(`${context}.videos[${videoIndex}] needs a string id`);
          }
          if (seenVideoIds.has(video.id)) {
            throw new Error(`${context} duplicates historical video ${video.id}`);
          }
          seenVideoIds.add(video.id);
          return video.id;
        })
        .sort(compareStrings);

      return {
        id: exercise.id,
        title: exercise.exercise_name,
        video_ids: videoIds,
      };
    })
    .sort((left, right) => compareStrings(left.id, right.id));

  if (seenVideoIds.size !== BASELINE_VIDEO_COUNT) {
    throw new Error(
      `historical catalog must contain ${BASELINE_VIDEO_COUNT} unique videos`,
    );
  }
  if (sha256(JSON.stringify(routes)) !== BASELINE_ROUTES_SHA256) {
    throw new Error("historical exercise route projection has an unexpected hash");
  }

  return {
    version: 1,
    source_commit: BASELINE_CATALOG_COMMIT,
    source_path: BASELINE_CATALOG_PATH,
    source_sha256: BASELINE_CATALOG_SHA256,
    routes_sha256: BASELINE_ROUTES_SHA256,
    exercise_count: routes.length,
    video_count: seenVideoIds.size,
    routes,
  };
}

export function validateBaselineExerciseRouteManifest(manifest) {
  assertPlainObject(manifest, "baseline exercise route manifest");
  const expectedKeys = [
    "exercise_count",
    "routes",
    "routes_sha256",
    "source_commit",
    "source_path",
    "source_sha256",
    "version",
    "video_count",
  ];
  if (
    JSON.stringify(Object.keys(manifest).sort()) !==
    JSON.stringify(expectedKeys)
  ) {
    throw new Error("baseline exercise route manifest has unexpected fields");
  }
  if (
    manifest.version !== 1 ||
    manifest.source_commit !== BASELINE_CATALOG_COMMIT ||
    manifest.source_path !== BASELINE_CATALOG_PATH ||
    manifest.source_sha256 !== BASELINE_CATALOG_SHA256 ||
    manifest.routes_sha256 !== BASELINE_ROUTES_SHA256 ||
    manifest.exercise_count !== BASELINE_EXERCISE_COUNT ||
    manifest.video_count !== BASELINE_VIDEO_COUNT
  ) {
    throw new Error("baseline exercise route manifest provenance is invalid");
  }
  if (!Array.isArray(manifest.routes)) {
    throw new Error("baseline exercise route manifest routes must be an array");
  }

  const seenRouteIds = new Set();
  const seenVideoIds = new Set();
  let previousRouteId = null;
  for (const [index, route] of manifest.routes.entries()) {
    const context = `baseline route[${index}]`;
    assertPlainObject(route, context);
    if (
      JSON.stringify(Object.keys(route).sort()) !==
      JSON.stringify(["id", "title", "video_ids"])
    ) {
      throw new Error(`${context} has unexpected fields`);
    }
    if (!route.id || typeof route.id !== "string") {
      throw new Error(`${context} needs a string id`);
    }
    if (previousRouteId !== null && compareStrings(previousRouteId, route.id) >= 0) {
      throw new Error("baseline exercise routes must be uniquely sorted by id");
    }
    previousRouteId = route.id;
    seenRouteIds.add(route.id);
    if (!route.title || typeof route.title !== "string") {
      throw new Error(`${context} needs a title`);
    }
    if (!Array.isArray(route.video_ids) || route.video_ids.length === 0) {
      throw new Error(`${context} needs video_ids`);
    }
    let previousVideoId = null;
    for (const videoId of route.video_ids) {
      if (!videoId || typeof videoId !== "string") {
        throw new Error(`${context} contains an invalid video id`);
      }
      if (previousVideoId !== null && compareStrings(previousVideoId, videoId) >= 0) {
        throw new Error(`${context} video_ids must be uniquely sorted`);
      }
      previousVideoId = videoId;
      if (seenVideoIds.has(videoId)) {
        throw new Error(`${context} duplicates historical video ${videoId}`);
      }
      seenVideoIds.add(videoId);
    }
  }

  if (
    seenRouteIds.size !== BASELINE_EXERCISE_COUNT ||
    seenVideoIds.size !== BASELINE_VIDEO_COUNT ||
    sha256(JSON.stringify(manifest.routes)) !== BASELINE_ROUTES_SHA256
  ) {
    throw new Error("baseline exercise route manifest content is incomplete");
  }
}

function currentDestinations(catalog, coaching) {
  if (!Array.isArray(catalog)) {
    throw new Error("exercise catalog must be an array");
  }
  if (!Array.isArray(coaching)) {
    throw new Error("coaching catalog must be an array");
  }

  const exercises = new Map();
  for (const [index, exercise] of catalog.entries()) {
    if (!exercise?.id || !exercise?.exercise_name) {
      throw new Error(`exercise[${index}] needs an id and exercise_name`);
    }
    if (exercises.has(exercise.id)) {
      throw new Error(`exercise catalog duplicates id ${exercise.id}`);
    }
    exercises.set(exercise.id, exercise.exercise_name);
  }

  const coachingResources = new Map();
  for (const [index, resource] of coaching.entries()) {
    if (!resource?.id || !resource?.title) {
      throw new Error(`coaching[${index}] needs an id and title`);
    }
    if (coachingResources.has(resource.id)) {
      throw new Error(`coaching catalog duplicates id ${resource.id}`);
    }
    coachingResources.set(resource.id, resource.title);
  }

  return { exercises, coachingResources };
}

/**
 * Map every removed historical slug through its video-level curation
 * decisions. Current exercise slugs remain canonical and are intentionally
 * absent from the legacy map.
 */
export function buildLegacyExerciseRouteLedger({
  baseline,
  catalog,
  coaching,
  curation,
}) {
  validateBaselineExerciseRouteManifest(baseline);
  const { exercises, coachingResources } = currentDestinations(
    catalog,
    coaching,
  );
  assertPlainObject(curation, "catalog curation");
  assertPlainObject(curation.decisions, "catalog curation decisions");

  const routes = {};
  let preservedCurrentRoutes = 0;
  let redirectRoutes = 0;
  let splitRecoveryRoutes = 0;
  let removedRecoveryRoutes = 0;

  for (const baselineRoute of baseline.routes) {
    if (exercises.has(baselineRoute.id)) {
      preservedCurrentRoutes += 1;
      continue;
    }

    const targetsByKey = new Map();
    const excluded = [];
    for (const videoId of baselineRoute.video_ids) {
      const decision = curation.decisions[videoId];
      assertPlainObject(decision, `curation decision for ${videoId}`);

      if (decision.decision === "exclude") {
        if (!decision.reason || typeof decision.reason !== "string") {
          throw new Error(`excluded historical video ${videoId} needs a reason`);
        }
        excluded.push({ video_id: videoId, reason: decision.reason });
        continue;
      }

      if (!(["exercise", "coaching"].includes(decision.decision))) {
        throw new Error(
          `historical video ${videoId} has invalid curation decision ${JSON.stringify(decision.decision)}`,
        );
      }
      if (!decision.destination_id || typeof decision.destination_id !== "string") {
        throw new Error(`historical video ${videoId} needs a destination_id`);
      }

      const destinationMap =
        decision.decision === "exercise" ? exercises : coachingResources;
      const title = destinationMap.get(decision.destination_id);
      if (!title) {
        throw new Error(
          `historical video ${videoId} points to missing ${decision.decision} destination ${decision.destination_id}`,
        );
      }

      const targetKey = `${decision.decision}:${decision.destination_id}`;
      const target = targetsByKey.get(targetKey) ?? {
        kind: decision.decision,
        id: decision.destination_id,
        title,
        path: `/${decision.decision}/${decision.destination_id}`,
        video_ids: [],
      };
      target.video_ids.push(videoId);
      targetsByKey.set(targetKey, target);
    }

    const targets = [...targetsByKey.values()]
      .map((target) => ({
        ...target,
        video_ids: target.video_ids.sort(compareStrings),
      }))
      .sort((left, right) =>
        compareStrings(`${left.kind}:${left.id}`, `${right.kind}:${right.id}`),
      );
    excluded.sort((left, right) => compareStrings(left.video_id, right.video_id));

    const outcome =
      targets.length === 1
        ? "redirect"
        : targets.length > 1
          ? "split"
          : "removed";
    if (outcome === "redirect") redirectRoutes += 1;
    if (outcome === "split") splitRecoveryRoutes += 1;
    if (outcome === "removed") removedRecoveryRoutes += 1;

    routes[baselineRoute.id] = {
      legacy_title: baselineRoute.title,
      outcome,
      targets,
      excluded,
    };
  }

  return {
    version: 1,
    baseline_commit: BASELINE_CATALOG_COMMIT,
    baseline_routes_sha256: BASELINE_ROUTES_SHA256,
    stats: {
      baseline_routes: baseline.routes.length,
      current_exercise_routes: exercises.size,
      preserved_current_routes: preservedCurrentRoutes,
      legacy_routes: Object.keys(routes).length,
      redirect_routes: redirectRoutes,
      split_recovery_routes: splitRecoveryRoutes,
      removed_recovery_routes: removedRecoveryRoutes,
    },
    routes,
  };
}

export function legacyExerciseRouteIntegrityErrors({
  baseline,
  ledger,
  catalog,
  coaching,
  curation,
}) {
  try {
    const expected = buildLegacyExerciseRouteLedger({
      baseline,
      catalog,
      coaching,
      curation,
    });
    if (json(ledger) !== json(expected)) {
      return [
        "legacy exercise route ledger is stale; run npm run legacy-routes:generate",
      ];
    }
    return [];
  } catch (error) {
    return [`legacy exercise route ledger is invalid: ${error.message}`];
  }
}

async function readJson(path) {
  return JSON.parse(await readFile(path, "utf8"));
}

async function buildCurrentLedger() {
  const [baseline, catalog, coaching, curation] = await Promise.all([
    readJson(baselineManifestPath),
    readJson(catalogPath),
    readJson(coachingPath),
    readJson(curationPath),
  ]);
  return buildLegacyExerciseRouteLedger({
    baseline,
    catalog,
    coaching,
    curation,
  });
}

async function writeBaselineManifest() {
  const revision = `${BASELINE_CATALOG_COMMIT}:${BASELINE_CATALOG_PATH}`;
  const { stdout } = await execFileAsync("git", ["show", revision], {
    cwd: projectDirectory,
    encoding: "utf8",
    maxBuffer: 10 * 1024 * 1024,
  });
  const manifest = buildBaselineExerciseRouteManifest(stdout);
  await writeFile(baselineManifestPath, json(manifest), "utf8");
  console.log(
    `Wrote ${manifest.exercise_count} historical exercise routes to ${baselineManifestPath}`,
  );
}

async function main() {
  const [mode] = process.argv.slice(2);
  if (mode === "--write-baseline") {
    await writeBaselineManifest();
    return;
  }
  if (!(["--write", "--check"].includes(mode))) {
    throw new Error("usage: generate-legacy-exercise-routes.mjs --write|--check|--write-baseline");
  }

  const ledger = await buildCurrentLedger();
  const rendered = json(ledger);
  if (mode === "--write") {
    await writeFile(legacyRouteLedgerPath, rendered, "utf8");
    console.log(
      `Wrote ${ledger.stats.legacy_routes} legacy exercise routes to ${legacyRouteLedgerPath}`,
    );
    return;
  }

  let existing;
  try {
    existing = await readFile(legacyRouteLedgerPath, "utf8");
  } catch (error) {
    throw new Error(
      `cannot read ${legacyRouteLedgerPath}; run npm run legacy-routes:generate (${error.message})`,
    );
  }
  if (existing !== rendered) {
    throw new Error(
      "legacy exercise route ledger is stale; run npm run legacy-routes:generate",
    );
  }
  console.log(
    `Legacy exercise route ledger is current: ${ledger.stats.legacy_routes} historical slugs resolved.`,
  );
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  await main();
}
