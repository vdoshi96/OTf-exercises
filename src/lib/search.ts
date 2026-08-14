import Fuse, { type FuseResult, type IFuseOptions } from "fuse.js";
import type { CoachingResource, Creator, GroupedExercise } from "./types";

export interface SearchResult<T> {
  item: T;
  matchedBy: string[];
}

const MATCH_LABELS: Record<string, string> = {
  exercise_name: "Title",
  title: "Title",
  category: "Category",
  movement_type: "Movement type",
  muscle_groups: "Muscle group",
  equipment: "Equipment",
  "videos.source": "Source",
  "videos.creator.display_name": "Creator",
  "videos.creator.handle": "Creator",
  "videos.description": "Video description",
  coaching_cues: "Coaching cue",
  topic: "Topic",
  summary: "Summary",
};

const fuseOptions: IFuseOptions<GroupedExercise> = {
  keys: [
    { name: "exercise_name", weight: 2 },
    { name: "category", weight: 1.8 },
    { name: "movement_type", weight: 1.5 },
    { name: "muscle_groups", weight: 1.5 },
    { name: "equipment", weight: 1 },
    { name: "videos.source", weight: 0.9 },
    { name: "videos.creator.display_name", weight: 1 },
    { name: "videos.creator.handle", weight: 1 },
    { name: "videos.description", weight: 0.35 },
    { name: "coaching_cues", weight: 0.5 },
  ],
  threshold: 0.3,
  includeScore: true,
  includeMatches: true,
};

const coachingFuseOptions: IFuseOptions<CoachingResource> = {
  keys: [
    { name: "title", weight: 2 },
    { name: "topic", weight: 1.5 },
    { name: "summary", weight: 1 },
    { name: "videos.creator.display_name", weight: 1 },
    { name: "videos.creator.handle", weight: 1 },
    { name: "videos.source", weight: 0.9 },
    { name: "videos.description", weight: 0.35 },
  ],
  threshold: 0.3,
  includeScore: true,
  includeMatches: true,
};

const CATEGORY_ALIASES: Record<string, GroupedExercise["category"]> = {
  cardio: "cardio",
  core: "core",
  fullbody: "full_body",
  lowerbody: "lower_body",
  mobility: "mobility",
  other: "other",
  upperbody: "upper_body",
};

const SOURCE_ALIASES: Record<string, GroupedExercise["videos"][number]["source"]> = {
  instagram: "instagram",
  tiktok: "tiktok",
};

const EQUIPMENT_ALIASES: Record<string, string> = {
  rower: "rower",
};

function normalizeAlias(value: string): string {
  return value.toLocaleLowerCase("en-US").replace(/[^a-z0-9]+/g, "");
}

function matchLabels<T>(result: FuseResult<T>): string[] {
  const labels = new Set<string>();

  for (const match of result.matches ?? []) {
    if (!match.key) continue;
    const label = MATCH_LABELS[match.key];
    if (label) labels.add(label);
  }

  labels.delete("Title");
  return Array.from(labels);
}

export function createSearchIndex(
  exercises: GroupedExercise[]
): Fuse<GroupedExercise> {
  return new Fuse(exercises, fuseOptions);
}

export function searchExercises(
  fuse: Fuse<GroupedExercise>,
  exercises: GroupedExercise[],
  query: string
): GroupedExercise[] {
  if (!query.trim()) return exercises;
  return fuse.search(query).map((r) => r.item);
}

export function searchExercisesWithMatches(
  fuse: Fuse<GroupedExercise>,
  exercises: GroupedExercise[],
  query: string
): SearchResult<GroupedExercise>[] {
  if (!query.trim()) {
    return exercises.map((item) => ({ item, matchedBy: [] }));
  }

  const fuseResults = fuse.search(query);
  const byId = new Map(
    fuseResults.map((result) => [
      result.item.id,
      { item: result.item, matchedBy: matchLabels(result) },
    ])
  );
  const normalizedQuery = normalizeAlias(query);
  const exactCategory = CATEGORY_ALIASES[normalizedQuery];
  const exactSource = SOURCE_ALIASES[normalizedQuery];
  const exactEquipment = EQUIPMENT_ALIASES[normalizedQuery];

  if (!exactCategory && !exactSource && !exactEquipment) {
    return Array.from(byId.values());
  }

  const exactMatches = exercises
    .filter(
      (exercise) =>
        exercise.category === exactCategory ||
        exercise.equipment.includes(exactEquipment ?? "") ||
        exercise.videos.some((video) => video.source === exactSource),
    )
    .map((item) => {
      const matched = byId.get(item.id);
      byId.delete(item.id);
      const matchedBy = new Set(matched?.matchedBy ?? []);
      if (item.category === exactCategory) matchedBy.add("Category");
      if (item.equipment.includes(exactEquipment ?? "")) {
        matchedBy.add("Equipment");
      }
      if (item.videos.some((video) => video.source === exactSource)) {
        matchedBy.add("Source");
      }
      return { item, matchedBy: Array.from(matchedBy) };
    });

  return [...exactMatches, ...byId.values()];
}

export function createCoachingSearchIndex(
  resources: CoachingResource[]
): Fuse<CoachingResource> {
  return new Fuse(resources, coachingFuseOptions);
}

export function searchCoachingWithMatches(
  fuse: Fuse<CoachingResource>,
  resources: CoachingResource[],
  query: string
): SearchResult<CoachingResource>[] {
  if (!query.trim()) {
    return resources.map((item) => ({ item, matchedBy: [] }));
  }

  const fuseResults = fuse.search(query);
  const byId = new Map(
    fuseResults.map((result) => [
      result.item.id,
      { item: result.item, matchedBy: matchLabels(result) },
    ]),
  );
  const exactSource = SOURCE_ALIASES[normalizeAlias(query)];
  if (!exactSource) return Array.from(byId.values());

  const sourceMatches = resources
    .filter((resource) =>
      resource.videos.some((video) => video.source === exactSource),
    )
    .map((item) => {
      const matched = byId.get(item.id);
      byId.delete(item.id);
      return {
        item,
        matchedBy: Array.from(new Set([...(matched?.matchedBy ?? []), "Source"])),
      };
    });

  return [...sourceMatches, ...byId.values()];
}

export function getExerciseCreators(exercise: GroupedExercise): Creator[] {
  const creators = new Map<string, Creator>();

  for (const video of exercise.videos) {
    creators.set(video.creator.id, video.creator);
  }

  return Array.from(creators.values()).sort((a, b) =>
    a.display_name.localeCompare(b.display_name)
  );
}

export function getCreatorOptions(exercises: GroupedExercise[]): Creator[] {
  const creators = new Map<string, Creator>();

  for (const ex of exercises) {
    for (const creator of getExerciseCreators(ex)) {
      creators.set(creator.id, creator);
    }
  }

  return Array.from(creators.values()).sort((a, b) =>
    a.display_name.localeCompare(b.display_name)
  );
}

export function getFilterOptions(exercises: GroupedExercise[]) {
  const categories = new Set<string>();
  const muscleGroups = new Set<string>();
  const equipment = new Set<string>();
  const platforms = new Set<string>();

  for (const ex of exercises) {
    categories.add(ex.category);
    ex.muscle_groups.forEach((mg) => muscleGroups.add(mg));
    ex.equipment.forEach((eq) => equipment.add(eq));
    ex.videos.forEach((v) => platforms.add(v.source));
  }

  return {
    categories: Array.from(categories).sort(),
    muscleGroups: Array.from(muscleGroups).sort(),
    equipment: Array.from(equipment).sort(),
    platforms: Array.from(platforms).sort(),
    creators: getCreatorOptions(exercises),
  };
}

export function filterExercises(
  exercises: GroupedExercise[],
  filters: {
    category?: string | null;
    muscleGroup?: string | null;
    equipment?: string | null;
    platform?: string | null;
    creators?: string[];
  }
): GroupedExercise[] {
  return exercises.filter((ex) => {
    if (filters.category && ex.category !== filters.category) return false;
    if (
      filters.muscleGroup &&
      !ex.muscle_groups.includes(filters.muscleGroup)
    )
      return false;
    if (filters.equipment && !ex.equipment.includes(filters.equipment))
      return false;
    if (
      filters.platform &&
      !ex.videos.some((v) => v.source === filters.platform)
    )
      return false;
    if (
      filters.creators &&
      filters.creators.length > 0 &&
      !ex.videos.some((v) => filters.creators!.includes(v.creator.id))
    )
      return false;
    return true;
  });
}
