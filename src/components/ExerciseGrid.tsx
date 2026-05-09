import type { GroupedExercise } from "@/lib/types";
import ExerciseCard from "./ExerciseCard";

interface ExerciseGridProps {
  exercises: GroupedExercise[];
}

export default function ExerciseGrid({ exercises }: ExerciseGridProps) {
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
    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {exercises.map((exercise) => (
        <ExerciseCard key={exercise.id} exercise={exercise} />
      ))}
    </div>
  );
}
