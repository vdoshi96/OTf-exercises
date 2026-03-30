"use client";

import { useCallback, useMemo, useState } from "react";
import Fuse, { type IFuseOptions } from "fuse.js";
import exercises from "@/data/exercises.json";
import type { Exercise } from "@/lib/types";
import { getFilterOptions, filterExercises } from "@/lib/search";
import SearchBar from "@/components/SearchBar";
import FilterPanel from "@/components/FilterPanel";
import ExerciseGrid from "@/components/ExerciseGrid";

const allExercises = exercises as Exercise[];

const fuseOptions: IFuseOptions<Exercise> = {
  keys: [
    { name: "exercise_name", weight: 2 },
    { name: "muscle_groups", weight: 1.5 },
    { name: "equipment", weight: 1 },
    { name: "coaching_cues", weight: 0.5 },
    { name: "description", weight: 0.3 },
  ],
  threshold: 0.3,
};

export default function Home() {
  const [query, setQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [activeMuscleGroup, setActiveMuscleGroup] = useState<string | null>(null);
  const [activeEquipment, setActiveEquipment] = useState<string | null>(null);

  const fuse = useMemo(() => new Fuse(allExercises, fuseOptions), []);
  const filterOptions = useMemo(() => getFilterOptions(allExercises), []);

  const handleSearch = useCallback((q: string) => {
    setQuery(q);
  }, []);

  const results = useMemo(() => {
    let filtered = query.trim()
      ? fuse.search(query).map((r) => r.item)
      : allExercises;

    filtered = filterExercises(filtered, {
      category: activeCategory,
      muscleGroup: activeMuscleGroup,
      equipment: activeEquipment,
    });

    return filtered;
  }, [query, activeCategory, activeMuscleGroup, activeEquipment, fuse]);

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <div className="mb-8">
        <h2 className="mb-2 text-3xl font-bold text-zinc-100">
          Browse Exercises
        </h2>
        <p className="text-zinc-500">
          OrangeTheory exercises demonstrated by Coach Rudy on TikTok
        </p>
      </div>

      <div className="mb-6">
        <SearchBar
          onSearch={handleSearch}
          resultCount={results.length}
          totalCount={allExercises.length}
        />
      </div>

      <div className="mb-8">
        <FilterPanel
          categories={filterOptions.categories}
          muscleGroups={filterOptions.muscleGroups}
          equipment={filterOptions.equipment}
          activeCategory={activeCategory}
          activeMuscleGroup={activeMuscleGroup}
          activeEquipment={activeEquipment}
          onCategoryChange={setActiveCategory}
          onMuscleGroupChange={setActiveMuscleGroup}
          onEquipmentChange={setActiveEquipment}
        />
      </div>

      <ExerciseGrid exercises={results} />
    </div>
  );
}
