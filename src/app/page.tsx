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
  const formattedExerciseCount = allExercises.length.toLocaleString();
  const formattedVideoCount = totalVideos.toLocaleString();
  const formattedCreatorCount = totalCreators.toLocaleString();

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
  const formattedResultCount = results.length.toLocaleString();
  const resultSetKey = [
    query,
    activeCategory,
    activeMuscleGroup,
    activeEquipment,
    activePlatform,
    activeCreators.join(","),
  ].join("|");

  return (
    <>
      <section className="border-b border-white/10">
        <div className="mx-auto max-w-[92rem] px-4 py-4 sm:px-6 sm:py-7 lg:px-8 lg:py-8">
          <div className="grid gap-4 sm:gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(420px,0.82fr)] lg:items-center">
            <div className="max-w-4xl">
              <h1 className="font-display display-tight max-w-4xl text-4xl font-semibold leading-[0.94] text-stone-50 sm:text-6xl lg:text-6xl">
                Find the movement before class starts.
              </h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-stone-300 sm:mt-3 sm:text-base sm:leading-7">
                Search exercise demos by muscle group, equipment, category, and
                creator so you can preview unfamiliar movements and walk into
                the studio with context.
              </p>
            </div>

            <div className="panel-glass rounded-lg border p-3 sm:p-5">
              <div className="grid grid-cols-3 divide-x divide-white/10">
                <div className="px-2 first:pl-0 sm:px-3">
                  <p className="font-display display-tight text-2xl font-semibold leading-none text-orange-500 sm:text-5xl">
                    {formattedExerciseCount}
                  </p>
                  <p className="mt-1 text-[11px] font-medium text-stone-300 sm:mt-3 sm:text-sm">
                    Exercises
                  </p>
                </div>
                <div className="px-2 sm:px-6">
                  <p className="font-display display-tight text-2xl font-semibold leading-none text-orange-500 sm:text-5xl">
                    {formattedVideoCount}
                  </p>
                  <p className="mt-1 text-[11px] font-medium text-stone-300 sm:mt-3 sm:text-sm">
                    <span className="sm:hidden">Videos</span>
                    <span className="hidden sm:inline">Video demos</span>
                  </p>
                </div>
                <div className="px-2 last:pr-0 sm:px-6">
                  <p className="font-display display-tight text-2xl font-semibold leading-none text-orange-500 sm:text-5xl">
                    {formattedCreatorCount}
                  </p>
                  <p className="mt-1 text-[11px] font-medium text-stone-300 sm:mt-3 sm:text-sm">
                    Creator{totalCreators === 1 ? "" : "s"}
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-4 space-y-3 sm:mt-5">
            <SearchBar
              onSearch={handleSearch}
              resultCount={results.length}
              totalCount={allExercises.length}
            />
            <div className="flex flex-col gap-4 border-b border-white/10 pb-3 sm:flex-row sm:items-start sm:justify-between">
              <FilterPanel
                categories={filterOptions.categories}
                muscleGroups={filterOptions.muscleGroups}
                equipment={filterOptions.equipment}
                platforms={filterOptions.platforms}
                creators={filterOptions.creators}
                resultCount={results.length}
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
              <p className="hidden shrink-0 pt-3 text-sm font-medium text-stone-400 sm:block sm:text-base">
                Showing{" "}
                <span className="font-semibold text-stone-100">
                  {formattedResultCount}
                </span>{" "}
                of {formattedExerciseCount}
              </p>
            </div>
          </div>
        </div>
      </section>

      <section
        id="directory"
        className="mx-auto max-w-[92rem] scroll-mt-24 px-4 py-3 sm:px-6 lg:px-8 lg:py-4"
      >
        <div className="mb-3 flex items-end justify-between gap-4 sm:mb-4">
          <h2 className="font-display display-tight text-2xl font-semibold text-stone-50 sm:text-4xl">
            Exercise reference
          </h2>
          <p className="shrink-0 text-xs font-medium text-stone-400 sm:hidden">
            {formattedResultCount} result{results.length === 1 ? "" : "s"}
          </p>
        </div>

        <ExerciseGrid key={resultSetKey} exercises={results} />
      </section>
    </>
  );
}
