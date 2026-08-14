import assert from "node:assert/strict";
import test from "node:test";

import exercises from "../src/data/exercises.json" with { type: "json" };
import coaching from "../src/data/coaching.json" with { type: "json" };
import {
  directoryApiHref,
  directoryDetailHref,
  directoryPageHref,
  parseDirectoryQuery,
  serializeDirectoryQuery,
} from "../src/lib/query.ts";
import {
  createCoachingSearchIndex,
  createSearchIndex,
  searchCoachingWithMatches,
  searchExercisesWithMatches,
} from "../src/lib/search.ts";

test("directory query normalizes public repeated params without exposing section", () => {
  const params = new URLSearchParams();
  params.set("q", "  cardio   intervals  ");
  params.append("category", "Cardio");
  params.append("category", "cardio");
  params.append("muscle", "Core");
  params.append("source", "instagram");
  params.append("creator", "coach-rudy");
  params.set("page", "250");
  params.set("section", "coaching");

  const query = parseDirectoryQuery(params, "exercise");

  assert.equal(query.section, "exercise");
  assert.equal(query.q, "cardio intervals");
  assert.deepEqual(query.categories, ["Cardio"]);
  assert.deepEqual(query.muscles, ["Core"]);
  assert.deepEqual(query.sources, ["instagram"]);
  assert.deepEqual(query.creators, ["coach-rudy"]);
  assert.equal(query.page, 100);

  const publicParams = serializeDirectoryQuery(query);
  assert.equal(publicParams.has("section"), false);
  assert.deepEqual(publicParams.getAll("category"), ["Cardio"]);
  assert.equal(publicParams.get("source"), "instagram");
  assert.equal(publicParams.get("page"), "100");
});

test("directory queries are capped at the public 100-character contract", () => {
  const params = new URLSearchParams({ q: `  ${"a".repeat(120)}  ` });
  const query = parseDirectoryQuery(params, "exercise");

  assert.equal(query.q.length, 100);
  assert.equal(query.q, "a".repeat(100));
});

test("malformed page values are discarded instead of partially parsed", () => {
  for (const value of ["2junk", "2.5", "+2", "0", "-1", "Infinity"]) {
    const query = parseDirectoryQuery(
      new URLSearchParams({ page: value }),
      "exercise",
    );
    assert.equal(query.page, 1, `expected ${value} to normalize to page 1`);
  }
  assert.equal(
    parseDirectoryQuery(new URLSearchParams({ page: "2" }), "exercise").page,
    2,
  );
});

test("directory helpers preserve normalized state on public and detail links", () => {
  const query = parseDirectoryQuery(
    new URLSearchParams(
      "q=row&category=cardio&source=instagram&creator=coachingotf&page=2"
    ),
    "exercise"
  );

  assert.equal(
    directoryPageHref("/", query),
    "/?q=row&category=cardio&source=instagram&creator=coachingotf&page=2"
  );
  assert.equal(
    directoryDetailHref(query, "rowing"),
    "/exercise/rowing?q=row&category=cardio&source=instagram&creator=coachingotf&page=2"
  );
  assert.equal(
    directoryApiHref(query),
    "/api/directory?q=row&category=cardio&source=instagram&creator=coachingotf&page=2&section=exercise"
  );
});

test("coaching links use their section route and public topic/source keys", () => {
  const query = parseDirectoryQuery(
    new URLSearchParams(
      "topic=movement-technique&source=instagram&creator=coachingotf"
    ),
    "coaching"
  );

  assert.equal(
    directoryDetailHref(query, "rower-compression"),
    "/coaching/rower-compression?source=instagram&creator=coachingotf&topic=movement-technique"
  );
  assert.equal(
    directoryPageHref("/coaching", query),
    "/coaching?source=instagram&creator=coachingotf&topic=movement-technique"
  );
});

test("cardio alias search contains every exercise classified as Cardio", () => {
  const index = createSearchIndex(exercises);
  const results = searchExercisesWithMatches(index, exercises, "cardio");
  const expectedIds = exercises
    .filter((exercise) => exercise.category === "cardio")
    .map((exercise) => exercise.id)
    .sort();
  const actualIds = results
    .filter(({ item }) => item.category === "cardio")
    .map(({ item }) => item.id)
    .sort();

  assert.deepEqual(actualIds, expectedIds);
});

test("exact category, equipment, and source aliases are deterministic", () => {
  const index = createSearchIndex(exercises);
  const cases = [
    ["core", (exercise) => exercise.category === "core", "Category"],
    ["rower", (exercise) => exercise.equipment.includes("rower"), "Equipment"],
    [
      "Instagram",
      (exercise) => exercise.videos.some((video) => video.source === "instagram"),
      "Source",
    ],
    [
      "TikTok",
      (exercise) => exercise.videos.some((video) => video.source === "tiktok"),
      "Source",
    ],
  ];

  for (const [query, predicate, label] of cases) {
    const expected = exercises.filter(predicate).map((exercise) => exercise.id);
    const first = searchExercisesWithMatches(index, exercises, query);
    const second = searchExercisesWithMatches(index, exercises, query);
    assert.deepEqual(
      first.map(({ item }) => item.id),
      second.map(({ item }) => item.id),
      `${query} ordering should be stable`,
    );
    assert.deepEqual(
      first.slice(0, expected.length).map(({ item }) => item.id),
      expected,
      `${query} should lead with every deterministic exact match`,
    );
    assert.ok(
      first.slice(0, expected.length).every(({ matchedBy }) =>
        matchedBy.includes(label),
      ),
      `${query} exact matches should explain ${label}`,
    );
  }
});

test("coaching source aliases include every resource from that source", () => {
  const index = createCoachingSearchIndex(coaching);
  for (const [query, source] of [
    ["Instagram", "instagram"],
    ["TikTok", "tiktok"],
  ]) {
    const expected = coaching
      .filter((resource) =>
        resource.videos.some((video) => video.source === source),
      )
      .map((resource) => resource.id);
    const results = searchCoachingWithMatches(index, coaching, query);
    assert.deepEqual(
      results.slice(0, expected.length).map(({ item }) => item.id),
      expected,
    );
    assert.ok(
      results.slice(0, expected.length).every(({ matchedBy }) =>
        matchedBy.includes("Source"),
      ),
    );
  }
});

test("non-title search matches explain the matching field", () => {
  const index = createSearchIndex(exercises);
  const result = searchExercisesWithMatches(index, exercises, "bosu").find(
    ({ item, matchedBy }) =>
      !item.exercise_name.toLocaleLowerCase("en-US").includes("bosu") &&
      matchedBy.includes("Equipment")
  );

  assert.ok(result, "expected at least one BOSU equipment match with a label");
});
