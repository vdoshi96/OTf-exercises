import Image from "next/image";
import Link from "next/link";
import { CATEGORY_LABELS, type GroupedExercise } from "@/lib/types";
import { getExerciseCreators } from "@/lib/search";
import ExercisePlaceholder from "./ExercisePlaceholder";

function getLocalThumbnail(exercise: GroupedExercise): string | null {
  for (const v of exercise.videos) {
    if (v.thumbnail && v.thumbnail.startsWith("/")) return v.thumbnail;
  }
  return null;
}

function summarizeList(items: string[], limit: number): string {
  if (items.length === 0) return "Bodyweight";
  if (items.length <= limit) return items.join(", ");

  return `${items.slice(0, limit).join(", ")} +${items.length - limit}`;
}

interface ExerciseCardProps {
  exercise: GroupedExercise;
}

export default function ExerciseCard({ exercise }: ExerciseCardProps) {
  const categoryLabel =
    CATEGORY_LABELS[exercise.category] || exercise.category;

  const thumbnail = getLocalThumbnail(exercise);
  const videoCount = exercise.videos.length;
  const sources = new Set(exercise.videos.map((v) => v.source));
  const creators = getExerciseCreators(exercise);
  const creatorSummary =
    creators.length === 0
      ? "Creator pending"
      : creators.length === 1
        ? creators[0].display_name
        : `${creators.length} creators`;

  return (
    <Link
      href={`/exercise/${exercise.id}`}
      data-testid="exercise-card"
      className="group flex h-full flex-col overflow-hidden rounded-lg border border-stone-800 bg-[#110d0a] shadow-sm shadow-black/30 transition duration-200 hover:-translate-y-1 hover:border-orange-500/45 hover:shadow-lg hover:shadow-orange-950/30 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-orange-400"
    >
      <div className="relative aspect-[4/5] w-full overflow-hidden bg-[#17100c]">
        {thumbnail ? (
          <Image
            src={thumbnail}
            alt={exercise.exercise_name}
            fill
            sizes="(min-width: 1280px) 25vw, (min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
            className="object-cover transition duration-300 group-hover:scale-105"
          />
        ) : (
          <ExercisePlaceholder
            category={exercise.category}
            exerciseName={exercise.exercise_name}
            muscleGroups={exercise.muscle_groups}
          />
        )}

        <div className="absolute left-3 top-3 flex flex-wrap gap-2">
          <span className="rounded-md border border-orange-500/40 bg-orange-500/20 px-2.5 py-1 text-xs font-bold text-orange-50 shadow-sm shadow-black/30 backdrop-blur-sm">
            {categoryLabel}
          </span>
          {videoCount > 1 && (
            <span className="rounded-md border border-orange-400/30 bg-black/70 px-2.5 py-1 text-xs font-semibold text-orange-100 backdrop-blur-sm">
              {videoCount} videos
            </span>
          )}
        </div>

        <div className="absolute inset-x-0 bottom-0 flex justify-end gap-1.5 bg-gradient-to-t from-black/80 to-transparent p-3">
          {sources.has("tiktok") && (
            <span
              aria-label="TikTok"
              className="flex h-7 w-7 items-center justify-center rounded-md border border-white/10 bg-black/70 text-stone-200 backdrop-blur-sm"
            >
              <svg
                aria-hidden="true"
                className="h-3.5 w-3.5"
                viewBox="0 0 24 24"
                fill="currentColor"
              >
                <path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.89-2.89 2.89 2.89 0 012.89-2.89c.28 0 .54.04.79.1V9.01a6.27 6.27 0 00-.79-.05 6.34 6.34 0 00-6.34 6.34 6.34 6.34 0 006.34 6.34 6.34 6.34 0 006.34-6.34V8.75a8.18 8.18 0 004.76 1.52V6.84a4.84 4.84 0 01-1-.15z" />
              </svg>
            </span>
          )}
          {sources.has("instagram") && (
            <span
              aria-label="Instagram"
              className="flex h-7 w-7 items-center justify-center rounded-md border border-white/10 bg-black/70 text-stone-200 backdrop-blur-sm"
            >
              <svg
                aria-hidden="true"
                className="h-3.5 w-3.5"
                viewBox="0 0 24 24"
                fill="currentColor"
              >
                <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z" />
              </svg>
            </span>
          )}
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-3 p-4">
        <div>
          <h3 className="line-clamp-2 text-base font-bold leading-snug text-stone-50 transition group-hover:text-orange-200">
            {exercise.exercise_name}
          </h3>
          <p className="mt-1 text-xs font-semibold text-stone-500">
            {creatorSummary}
          </p>
        </div>

        <div className="flex flex-wrap gap-1.5">
          {exercise.muscle_groups.slice(0, 3).map((mg) => (
            <span
              key={mg}
              className="rounded-md border border-stone-800 bg-[#17100c] px-2 py-1 text-xs font-medium text-stone-300"
            >
              {mg}
            </span>
          ))}
          {exercise.muscle_groups.length > 3 && (
            <span className="rounded-md border border-stone-800 bg-[#17100c] px-2 py-1 text-xs font-medium text-stone-500">
              +{exercise.muscle_groups.length - 3}
            </span>
          )}
        </div>

        <p className="mt-auto border-t border-stone-800 pt-3 text-xs leading-5 text-stone-500">
          {summarizeList(exercise.equipment, 2)}
        </p>
      </div>
    </Link>
  );
}
