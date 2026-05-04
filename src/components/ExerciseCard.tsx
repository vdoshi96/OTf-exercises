import Link from "next/link";
import {
  CATEGORY_COLORS,
  CATEGORY_LABELS,
  type GroupedExercise,
} from "@/lib/types";
import { getExerciseCreators } from "@/lib/search";

interface ExerciseCardProps {
  exercise: GroupedExercise;
}

export default function ExerciseCard({ exercise }: ExerciseCardProps) {
  const categoryColor =
    CATEGORY_COLORS[exercise.category] || CATEGORY_COLORS.other;
  const categoryLabel =
    CATEGORY_LABELS[exercise.category] || exercise.category;

  const firstVideo = exercise.videos[0];
  const videoCount = exercise.videos.length;
  const sources = new Set(exercise.videos.map((v) => v.source));
  const creators = getExerciseCreators(exercise);
  const creatorSummary =
    creators.length === 1
      ? creators[0].display_name
      : `${creators.length} creators`;

  return (
    <Link
      href={`/exercise/${exercise.id}`}
      className="group flex flex-col rounded-xl border border-zinc-800 bg-zinc-900/50 transition hover:border-zinc-700 hover:bg-zinc-900"
    >
      <div className="relative aspect-[9/16] max-h-48 w-full overflow-hidden rounded-t-xl bg-zinc-800">
        {firstVideo?.thumbnail ? (
          <img
            src={firstVideo.thumbnail}
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
        {videoCount > 1 && (
          <span className="absolute right-2 top-2 rounded-md bg-zinc-900/80 px-2 py-0.5 text-xs font-medium text-zinc-300 backdrop-blur-sm">
            {videoCount} videos
          </span>
        )}
        <div className="absolute bottom-2 right-2 flex gap-1">
          {sources.has("tiktok") && (
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-zinc-900/80 backdrop-blur-sm">
              <svg className="h-3 w-3 text-zinc-300" viewBox="0 0 24 24" fill="currentColor">
                <path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.89-2.89 2.89 2.89 0 012.89-2.89c.28 0 .54.04.79.1V9.01a6.27 6.27 0 00-.79-.05 6.34 6.34 0 00-6.34 6.34 6.34 6.34 0 006.34 6.34 6.34 6.34 0 006.34-6.34V8.75a8.18 8.18 0 004.76 1.52V6.84a4.84 4.84 0 01-1-.15z" />
              </svg>
            </span>
          )}
          {sources.has("instagram") && (
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-zinc-900/80 backdrop-blur-sm">
              <svg className="h-3 w-3 text-zinc-300" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z" />
              </svg>
            </span>
          )}
        </div>
      </div>

      <div className="flex flex-1 flex-col p-4">
        <h3 className="font-semibold text-zinc-100 group-hover:text-orange-400 transition">
          {exercise.exercise_name}
        </h3>

        {creators.length > 0 && (
          <p className="mt-1 text-xs font-medium text-zinc-500">
            {creatorSummary}
          </p>
        )}

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
