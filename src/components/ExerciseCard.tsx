import Link from "next/link";
import { CATEGORY_COLORS, CATEGORY_LABELS, type Exercise } from "@/lib/types";

interface ExerciseCardProps {
  exercise: Exercise;
}

export default function ExerciseCard({ exercise }: ExerciseCardProps) {
  const categoryColor =
    CATEGORY_COLORS[exercise.category] || CATEGORY_COLORS.other;
  const categoryLabel =
    CATEGORY_LABELS[exercise.category] || exercise.category;

  return (
    <Link
      href={`/exercise/${exercise.id}`}
      className="group flex flex-col rounded-xl border border-zinc-800 bg-zinc-900/50 transition hover:border-zinc-700 hover:bg-zinc-900"
    >
      <div className="relative aspect-[9/16] max-h-48 w-full overflow-hidden rounded-t-xl bg-zinc-800">
        {exercise.thumbnail ? (
          <img
            src={exercise.thumbnail}
            alt={exercise.exercise_name}
            className="h-full w-full object-cover transition group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full items-center justify-center">
            <svg
              className="h-12 w-12 text-zinc-700"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"
              />
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          </div>
        )}
        <span
          className={`absolute left-2 top-2 rounded-md border px-2 py-0.5 text-xs font-semibold ${categoryColor}`}
        >
          {categoryLabel}
        </span>
      </div>

      <div className="flex flex-1 flex-col p-4">
        <h3 className="font-semibold text-zinc-100 group-hover:text-orange-400 transition">
          {exercise.exercise_name}
        </h3>

        <div className="mt-2 flex flex-wrap gap-1.5">
          {exercise.muscle_groups.slice(0, 3).map((mg) => (
            <span
              key={mg}
              className="rounded-md bg-zinc-800 px-2 py-0.5 text-xs text-zinc-400"
            >
              {mg}
            </span>
          ))}
          {exercise.muscle_groups.length > 3 && (
            <span className="rounded-md bg-zinc-800 px-2 py-0.5 text-xs text-zinc-500">
              +{exercise.muscle_groups.length - 3}
            </span>
          )}
        </div>

        {exercise.equipment.length > 0 && (
          <p className="mt-auto pt-3 text-xs text-zinc-600">
            {exercise.equipment.join(", ")}
          </p>
        )}
      </div>
    </Link>
  );
}
