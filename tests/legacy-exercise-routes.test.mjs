import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  BASELINE_CATALOG_COMMIT,
  BASELINE_EXERCISE_COUNT,
  BASELINE_ROUTES_SHA256,
  BASELINE_VIDEO_COUNT,
  buildLegacyExerciseRouteLedger,
  legacyExerciseRouteIntegrityErrors,
  validateBaselineExerciseRouteManifest,
} from "../scripts/generate-legacy-exercise-routes.mjs";

async function readJson(path) {
  return JSON.parse(await readFile(new URL(path, import.meta.url), "utf8"));
}

const [baseline, catalog, coaching, curation, ledger] = await Promise.all([
  readJson("../data/catalog-baseline-exercise-routes.json"),
  readJson("../src/data/exercises.json"),
  readJson("../src/data/coaching.json"),
  readJson("../data/catalog-curation.json"),
  readJson("../src/data/legacy-exercise-routes.json"),
]);

test("the immutable exercise route baseline has exact reviewed provenance", () => {
  assert.doesNotThrow(() => validateBaselineExerciseRouteManifest(baseline));
  assert.equal(baseline.source_commit, BASELINE_CATALOG_COMMIT);
  assert.equal(baseline.routes_sha256, BASELINE_ROUTES_SHA256);
  assert.equal(baseline.exercise_count, BASELINE_EXERCISE_COUNT);
  assert.equal(baseline.video_count, BASELINE_VIDEO_COUNT);

  const changed = structuredClone(baseline);
  changed.routes[0].title = "Unreviewed replacement";
  assert.throws(
    () => validateBaselineExerciseRouteManifest(changed),
    /content is incomplete/,
  );
});

test("every historical slug is either current or explicitly resolved", () => {
  const currentIds = new Set(catalog.map((exercise) => exercise.id));
  const legacyIds = new Set(Object.keys(ledger.routes));

  assert.equal(baseline.routes.length, BASELINE_EXERCISE_COUNT);
  for (const route of baseline.routes) {
    assert.equal(
      currentIds.has(route.id) || legacyIds.has(route.id),
      true,
      `historical route ${route.id} is unaccounted for`,
    );
    assert.equal(
      currentIds.has(route.id) && legacyIds.has(route.id),
      false,
      `current route ${route.id} must not be shadowed by the legacy ledger`,
    );
  }
  assert.equal(
    ledger.stats.preserved_current_routes + ledger.stats.legacy_routes,
    BASELINE_EXERCISE_COUNT,
  );
});

test("legacy outcomes have valid cardinality and current destinations", () => {
  const exerciseIds = new Set(catalog.map((exercise) => exercise.id));
  const coachingIds = new Set(coaching.map((resource) => resource.id));
  const outcomes = new Set();

  for (const [legacyId, route] of Object.entries(ledger.routes)) {
    outcomes.add(route.outcome);
    if (route.outcome === "redirect") assert.equal(route.targets.length, 1);
    if (route.outcome === "split") assert.ok(route.targets.length > 1);
    if (route.outcome === "removed") assert.equal(route.targets.length, 0);

    for (const target of route.targets) {
      const ids = target.kind === "exercise" ? exerciseIds : coachingIds;
      assert.equal(
        ids.has(target.id),
        true,
        `${legacyId} points to missing ${target.kind}/${target.id}`,
      );
      assert.equal(target.path, `/${target.kind}/${target.id}`);
      assert.ok(target.video_ids.length > 0);
    }
    if (route.outcome === "removed") assert.ok(route.excluded.length > 0);
  }

  assert.deepEqual(
    outcomes,
    new Set(["redirect", "split", "removed"]),
    "the production ledger must exercise every recovery behavior",
  );
});

test("the checked-in legacy ledger is an exact deterministic derivation", () => {
  const first = buildLegacyExerciseRouteLedger({
    baseline,
    catalog,
    coaching,
    curation,
  });
  const second = buildLegacyExerciseRouteLedger({
    baseline,
    catalog,
    coaching,
    curation,
  });
  assert.deepEqual(first, second);
  assert.deepEqual(first, ledger);
  assert.deepEqual(
    legacyExerciseRouteIntegrityErrors({
      baseline,
      ledger,
      catalog,
      coaching,
      curation,
    }),
    [],
  );

  const stale = structuredClone(ledger);
  stale.stats.legacy_routes -= 1;
  assert.match(
    legacyExerciseRouteIntegrityErrors({
      baseline,
      ledger: stale,
      catalog,
      coaching,
      curation,
    })[0],
    /ledger is stale/,
  );
});
