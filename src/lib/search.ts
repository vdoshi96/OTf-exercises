import Fuse, { type IFuseOptions } from "fuse.js";
import type { GroupedExercise } from "./types";

const fuseOptions: IFuseOptions<GroupedExercise> = {
  keys: [
    { name: "exercise_name", weight: 2 },
    { name: "muscle_groups", weight: 1.5 },
    { name: "equipment", weight: 1 },
    { name: "coaching_cues", weight: 0.5 },
  ],
  threshold: 0.3,
  includeScore: true,
};

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
  };
}

export function filterExercises(
  exercises: GroupedExercise[],
  filters: {
    category?: string | null;
    muscleGroup?: string | null;
    equipment?: string | null;
    platform?: string | null;
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
    return true;
  });
}
