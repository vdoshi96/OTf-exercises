import Fuse, { type IFuseOptions } from "fuse.js";
import type { Exercise } from "./types";

const fuseOptions: IFuseOptions<Exercise> = {
  keys: [
    { name: "exercise_name", weight: 2 },
    { name: "muscle_groups", weight: 1.5 },
    { name: "equipment", weight: 1 },
    { name: "coaching_cues", weight: 0.5 },
    { name: "description", weight: 0.3 },
  ],
  threshold: 0.3,
  includeScore: true,
};

export function createSearchIndex(exercises: Exercise[]): Fuse<Exercise> {
  return new Fuse(exercises, fuseOptions);
}

export function searchExercises(
  fuse: Fuse<Exercise>,
  exercises: Exercise[],
  query: string
): Exercise[] {
  if (!query.trim()) return exercises;
  return fuse.search(query).map((r) => r.item);
}

export function getFilterOptions(exercises: Exercise[]) {
  const categories = new Set<string>();
  const muscleGroups = new Set<string>();
  const equipment = new Set<string>();

  for (const ex of exercises) {
    categories.add(ex.category);
    ex.muscle_groups.forEach((mg) => muscleGroups.add(mg));
    ex.equipment.forEach((eq) => equipment.add(eq));
  }

  return {
    categories: Array.from(categories).sort(),
    muscleGroups: Array.from(muscleGroups).sort(),
    equipment: Array.from(equipment).sort(),
  };
}

export function filterExercises(
  exercises: Exercise[],
  filters: {
    category?: string | null;
    muscleGroup?: string | null;
    equipment?: string | null;
  }
): Exercise[] {
  return exercises.filter((ex) => {
    if (filters.category && ex.category !== filters.category) return false;
    if (
      filters.muscleGroup &&
      !ex.muscle_groups.includes(filters.muscleGroup)
    )
      return false;
    if (filters.equipment && !ex.equipment.includes(filters.equipment))
      return false;
    return true;
  });
}
