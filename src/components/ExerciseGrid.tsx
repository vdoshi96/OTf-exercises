"use client";

import { useMemo, useState, useSyncExternalStore } from "react";
import type { GroupedExercise } from "@/lib/types";
import ExerciseCard from "./ExerciseCard";

interface ExerciseGridProps {
  exercises: GroupedExercise[];
}

const PAGE_SIZE = 24;
const DESKTOP_MEDIA_QUERY = "(min-width: 640px)";

function subscribeToDesktopBreakpoint(onChange: () => void) {
  const mediaQuery = window.matchMedia(DESKTOP_MEDIA_QUERY);
  mediaQuery.addEventListener("change", onChange);
  return () => mediaQuery.removeEventListener("change", onChange);
}

function getDesktopSnapshot() {
  return window.matchMedia(DESKTOP_MEDIA_QUERY).matches;
}

function getServerDesktopSnapshot() {
  return false;
}

export default function ExerciseGrid({ exercises }: ExerciseGridProps) {
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const isDesktop = useSyncExternalStore(
    subscribeToDesktopBreakpoint,
    getDesktopSnapshot,
    getServerDesktopSnapshot
  );

  const visibleExercises = useMemo(
    () => (isDesktop ? exercises : exercises.slice(0, visibleCount)),
    [exercises, isDesktop, visibleCount]
  );
  const hasMore = !isDesktop && visibleCount < exercises.length;
  const remainingCount = Math.max(exercises.length - visibleExercises.length, 0);

  if (exercises.length === 0) {
    return (
      <div className="rounded-lg border border-white/10 bg-[#101111]/80 px-6 py-20 text-center">
        <svg
          aria-hidden="true"
          className="mx-auto mb-4 h-16 w-16 text-stone-700"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
        <p className="text-lg font-semibold text-stone-200">
          No exercises found
        </p>
        <p className="mt-1 text-sm text-stone-500">
          Try adjusting your search or filters
        </p>
      </div>
    );
  }

  return (
    <>
      <p className="sr-only" aria-live="polite" aria-atomic="true">
        Showing {visibleExercises.length} of {exercises.length} exercises
      </p>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-5 lg:grid-cols-3 xl:grid-cols-4">
        {visibleExercises.map((exercise, index) => (
          <ExerciseCard
            key={exercise.id}
            exercise={exercise}
            eager={index === 0}
          />
        ))}
      </div>
      {hasMore && (
        <div className="flex justify-center py-8 sm:hidden">
          <button
            type="button"
            onClick={() => setVisibleCount((count) => count + PAGE_SIZE)}
            className="inline-flex min-h-12 items-center justify-center rounded-md border border-orange-500/50 bg-orange-500 px-6 py-3 text-sm font-bold text-black shadow-lg shadow-orange-950/20 transition hover:bg-orange-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-orange-400"
          >
            Load {Math.min(PAGE_SIZE, remainingCount)} more
          </button>
        </div>
      )}
    </>
  );
}
