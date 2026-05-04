"use client";

import { useCallback, useMemo, useState } from "react";
import exercises from "@/data/exercises.json";
import type { GroupedExercise } from "@/lib/types";
import {
  createSearchIndex,
  getFilterOptions,
  filterExercises,
  searchExercises,
} from "@/lib/search";
import SearchBar from "@/components/SearchBar";
import FilterPanel from "@/components/FilterPanel";
import ExerciseGrid from "@/components/ExerciseGrid";

const allExercises = exercises as GroupedExercise[];

export default function Home() {
  const [query, setQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [activeMuscleGroup, setActiveMuscleGroup] = useState<string | null>(
    null
  );
  const [activeEquipment, setActiveEquipment] = useState<string | null>(null);
  const [activePlatform, setActivePlatform] = useState<string | null>(null);
  const [activeCreator, setActiveCreator] = useState<string | null>(null);

  const fuse = useMemo(() => createSearchIndex(allExercises), []);
  const filterOptions = useMemo(() => getFilterOptions(allExercises), []);

  const handleSearch = useCallback((q: string) => {
    setQuery(q);
  }, []);

  const totalVideos = useMemo(
    () => allExercises.reduce((sum, ex) => sum + ex.videos.length, 0),
    []
  );
  const totalCreators = filterOptions.creators.length;

  const results = useMemo(() => {
    let filtered = query.trim()
      ? searchExercises(fuse, allExercises, query)
      : allExercises;

    filtered = filterExercises(filtered, {
      category: activeCategory,
      muscleGroup: activeMuscleGroup,
      equipment: activeEquipment,
      platform: activePlatform,
      creator: activeCreator,
    });

    return filtered;
  }, [
    query,
    activeCategory,
    activeMuscleGroup,
    activeEquipment,
    activePlatform,
    activeCreator,
    fuse,
  ]);

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <div className="mb-8">
        <h2 className="mb-2 text-3xl font-bold text-zinc-100">
          Browse Exercises
        </h2>
        <p className="text-zinc-500">
          {allExercises.length} exercises across {totalVideos} videos from{" "}
          {totalCreators} creator{totalCreators === 1 ? "" : "s"}
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
          platforms={filterOptions.platforms}
          creators={filterOptions.creators}
          activeCategory={activeCategory}
          activeMuscleGroup={activeMuscleGroup}
          activeEquipment={activeEquipment}
          activePlatform={activePlatform}
          activeCreator={activeCreator}
          onCategoryChange={setActiveCategory}
          onMuscleGroupChange={setActiveMuscleGroup}
          onEquipmentChange={setActiveEquipment}
          onPlatformChange={setActivePlatform}
          onCreatorChange={setActiveCreator}
        />
      </div>

      <ExerciseGrid exercises={results} />
    </div>
  );
}
