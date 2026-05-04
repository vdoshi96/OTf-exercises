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
  const [activeCreators, setActiveCreators] = useState<string[]>([]);

  const fuse = useMemo(() => createSearchIndex(allExercises), []);
  const filterOptions = useMemo(() => getFilterOptions(allExercises), []);

  const handleSearch = useCallback((q: string) => {
    setQuery(q);
  }, []);

  const handleCreatorToggle = useCallback((creatorId: string | null) => {
    if (creatorId === null) {
      setActiveCreators([]);
    } else {
      setActiveCreators((prev) =>
        prev.includes(creatorId)
          ? prev.filter((c) => c !== creatorId)
          : [...prev, creatorId]
      );
    }
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
      creators: activeCreators,
    });

    return filtered;
  }, [
    query,
    activeCategory,
    activeMuscleGroup,
    activeEquipment,
    activePlatform,
    activeCreators,
    fuse,
  ]);

  return (
    <>
      <section className="border-b border-orange-950/70 bg-[#070504]">
        <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 sm:py-16 lg:py-20">
          <div className="max-w-4xl">
            <p className="mb-4 text-sm font-semibold uppercase text-orange-300">
              OTF Exercise Directory
            </p>
            <h1 className="font-display max-w-3xl text-5xl font-semibold leading-[1.02] text-stone-50 sm:text-6xl lg:text-7xl">
              Find the movement before class starts.
            </h1>
            <p className="mt-5 max-w-2xl text-base leading-7 text-stone-300 sm:text-lg">
              Search exercise demos by muscle group, equipment, category, and
              creator so you can preview unfamiliar movements and walk into the
              studio with context.
            </p>
          </div>

          <div className="mt-8 grid gap-3 sm:grid-cols-3">
            <div className="border-l-2 border-orange-500 pl-4">
              <p className="font-display text-3xl font-semibold text-stone-50">
                {allExercises.length}
              </p>
              <p className="text-sm text-stone-500">Exercises</p>
            </div>
            <div className="border-l-2 border-orange-500/70 pl-4">
              <p className="font-display text-3xl font-semibold text-stone-50">
                {totalVideos}
              </p>
              <p className="text-sm text-stone-500">Video demos</p>
            </div>
            <div className="border-l-2 border-orange-500/40 pl-4">
              <p className="font-display text-3xl font-semibold text-stone-50">
                {totalCreators}
              </p>
              <p className="text-sm text-stone-500">
                Creator{totalCreators === 1 ? "" : "s"}
              </p>
            </div>
          </div>
        </div>
      </section>

      <section
        id="directory"
        className="mx-auto max-w-7xl scroll-mt-24 px-4 py-8 sm:px-6 lg:py-10"
      >
        <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase text-orange-300">
              Browse
            </p>
            <h2 className="mt-1 font-display text-3xl font-semibold text-stone-50 sm:text-4xl">
              Exercise reference
            </h2>
          </div>
          <p className="text-sm text-stone-500">
            Showing{" "}
            <span className="font-semibold text-stone-200">
              {results.length}
            </span>{" "}
            of {allExercises.length}
          </p>
        </div>

        <div className="mb-8 space-y-3">
          <SearchBar
            onSearch={handleSearch}
            resultCount={results.length}
            totalCount={allExercises.length}
          />
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
            activeCreators={activeCreators}
            onCategoryChange={setActiveCategory}
            onMuscleGroupChange={setActiveMuscleGroup}
            onEquipmentChange={setActiveEquipment}
            onPlatformChange={setActivePlatform}
            onCreatorChange={handleCreatorToggle}
          />
        </div>

        <ExerciseGrid exercises={results} />
      </section>
    </>
  );
}
