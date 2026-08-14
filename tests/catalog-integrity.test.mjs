import assert from "node:assert/strict";
import test from "node:test";

import {
  duplicateNormalizedTitleErrors,
  equipmentReviewErrors,
  explicitLoadReviewClass,
  legacyOverrideErrors,
  missingMetadataErrors,
  publicDecisionError,
  requiredMuscleGroupError,
} from "../scripts/check_catalog_integrity.mjs";

test("all public exercise categories require a reviewed muscle group", () => {
  assert.match(
    requiredMuscleGroupError(
      { category: "upper_body", muscle_groups: [] },
      "fixture",
    ),
    /public exercise has no reviewed muscle group/,
  );
  assert.equal(
    requiredMuscleGroupError({ category: "other", muscle_groups: ["core"] }),
    null,
  );
});

test("legacy refresh authority must be migrated into curation", () => {
  const empty = {
    rejected: {},
    force_include: {},
    append_to_group: {},
    title_overrides: {},
  };
  assert.deepEqual(legacyOverrideErrors(empty), []);
  assert.match(
    legacyOverrideErrors({
      ...empty,
      force_include: { ig_example: { exercise_name: "Example" } },
    })[0],
    /force_include overrides must be migrated/,
  );
});

test("every public video needs a matching durable curation decision", () => {
  const location = { kind: "exercise", destinationId: "squat" };
  assert.equal(
    publicDecisionError("video-1", location, {
      decision: "exercise",
      destination_id: "squat",
    }),
    null,
  );
  assert.match(
    publicDecisionError("video-1", location, {
      decision: "coaching",
      destination_id: "squat-technique",
    }),
    /exercise video video-1 has no matching durable curation decision/,
  );
});

test("every public destination needs reviewed metadata", () => {
  assert.deepEqual(
    missingMetadataErrors(
      "exercise",
      new Set(["squat", "deadlift"]),
      { squat: {} },
    ),
    ["exercise deadlift has no reviewed metadata ledger entry"],
  );
});

test("public directory titles are unique after normalization", () => {
  assert.deepEqual(
    duplicateNormalizedTitleErrors(
      "coaching resource",
      [
        { id: "one", title: "Rower Set-Up" },
        { id: "two", title: "Rower set up" },
      ],
      "title",
    ),
    [
      'coaching resource normalized title "rower set up" is duplicated by one, two',
    ],
  );
});

test("explicit-load exercise titles require reviewed equipment or an exception", () => {
  const corrected = {
    id: "alternating-hammer-curl",
    exercise_name: "Alternating Hammer Curl",
    equipment: ["dumbbell"],
  };
  const unresolved = {
    id: "heavy-hip-bridge",
    exercise_name: "Heavy Hip Bridge",
    equipment: [],
  };
  assert.equal(explicitLoadReviewClass(corrected), null);
  assert.equal(explicitLoadReviewClass(unresolved), "empty_explicit_load");
  assert.deepEqual(equipmentReviewErrors([corrected], {}), []);
  assert.match(
    equipmentReviewErrors([unresolved], {})[0],
    /needs reviewed equipment or an explicit equipment exception/,
  );
  assert.deepEqual(
    equipmentReviewErrors([unresolved], {
      "heavy-hip-bridge": {
        reason: "thumbnail-inconclusive",
        note: "The local still does not show the implement clearly.",
      },
    }),
    [],
  );

  assert.equal(
    explicitLoadReviewClass({
      id: "alternating-arnold-press",
      exercise_name: "Alternating Arnold Press",
      equipment: [],
    }),
    "empty_explicit_load",
  );
  assert.equal(
    explicitLoadReviewClass({
      id: "low-bench-alternating-bicycle-press",
      exercise_name: "Low Bench Alternating Bicycle Press",
      equipment: ["bench"],
    }),
    "support_only_loaded_action",
  );
  assert.equal(
    explicitLoadReviewClass({
      id: "short-sprint-rows",
      exercise_name: "Short Sprint Rows",
      equipment: ["rower"],
    }),
    null,
  );
});

test("equipment exception ledger rejects stale and orphaned entries", () => {
  const corrected = {
    id: "goblet-squat",
    exercise_name: "Goblet Squat",
    equipment: ["dumbbell"],
  };
  const staleErrors = equipmentReviewErrors([corrected], {
    "goblet-squat": {
      reason: "thumbnail-inconclusive",
      note: "Previously unresolved.",
    },
    missing: {
      reason: "support-only-is-complete",
      note: "Fixture orphan.",
    },
  });
  assert.ok(
    staleErrors.some((error) => /no longer matches explicit-load-v1/.test(error)),
  );
  assert.ok(
    staleErrors.some((error) => /references missing exercise missing/.test(error)),
  );
});
