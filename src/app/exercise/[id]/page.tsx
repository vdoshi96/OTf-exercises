import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import exercises from "@/data/exercises.json";
import type { Exercise } from "@/lib/types";
import { CATEGORY_COLORS, CATEGORY_LABELS } from "@/lib/types";
import TikTokEmbed from "@/components/TikTokEmbed";

const allExercises = exercises as Exercise[];

interface PageProps {
  params: Promise<{ id: string }>;
}

export async function generateStaticParams() {
  return allExercises.map((ex) => ({ id: ex.id }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const exercise = allExercises.find((ex) => ex.id === id);
  if (!exercise) return { title: "Exercise Not Found" };

  const muscleList = exercise.muscle_groups.join(", ");
  return {
    title: exercise.exercise_name,
    description: `${exercise.exercise_name} — ${CATEGORY_LABELS[exercise.category] || exercise.category} exercise targeting ${muscleList}. Watch Coach Rudy's demonstration and coaching cues.`,
    openGraph: {
      title: `${exercise.exercise_name} | OTF Exercise Directory`,
      description: `${exercise.exercise_name} targeting ${muscleList}. Watch the video demo from Coach Rudy.`,
      ...(exercise.thumbnail ? { images: [exercise.thumbnail] } : {}),
    },
  };
}

export default async function ExerciseDetailPage({ params }: PageProps) {
  const { id } = await params;
  const exercise = allExercises.find((ex) => ex.id === id);

  if (!exercise) notFound();

  const categoryColor =
    CATEGORY_COLORS[exercise.category] || CATEGORY_COLORS.other;
  const categoryLabel =
    CATEGORY_LABELS[exercise.category] || exercise.category;

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
      <Link
        href="/"
        className="mb-6 inline-flex items-center gap-2 text-sm text-zinc-500 hover:text-zinc-300 transition"
      >
        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        Back to directory
      </Link>

      <div className="grid gap-8 lg:grid-cols-[1fr_360px]">
        <div>
          <div className="mb-6">
            <span
              className={`inline-block rounded-md border px-2.5 py-1 text-xs font-semibold ${categoryColor}`}
            >
              {categoryLabel}
            </span>
            <h1 className="mt-3 text-3xl font-bold text-zinc-100">
              {exercise.exercise_name}
            </h1>
            {exercise.description && (
              <p className="mt-2 text-zinc-400">{exercise.description}</p>
            )}
          </div>

          <TikTokEmbed url={exercise.url} />
        </div>

        <aside className="space-y-6">
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-5">
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-zinc-500">
              Details
            </h2>
            <dl className="space-y-3">
              <div>
                <dt className="text-xs text-zinc-600">Movement Type</dt>
                <dd className="text-sm font-medium text-zinc-300 capitalize">
                  {exercise.movement_type.replace(/_/g, " ")}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-zinc-600">Muscle Groups</dt>
                <dd className="mt-1 flex flex-wrap gap-1.5">
                  {exercise.muscle_groups.map((mg) => (
                    <span
                      key={mg}
                      className="rounded-md bg-zinc-800 px-2 py-0.5 text-xs text-zinc-300"
                    >
                      {mg}
                    </span>
                  ))}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-zinc-600">Equipment</dt>
                <dd className="mt-1 flex flex-wrap gap-1.5">
                  {exercise.equipment.map((eq) => (
                    <span
                      key={eq}
                      className="rounded-md bg-zinc-800 px-2 py-0.5 text-xs text-zinc-300"
                    >
                      {eq}
                    </span>
                  ))}
                </dd>
              </div>
            </dl>
          </div>

          {exercise.coaching_cues.length > 0 && (
            <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-5">
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-zinc-500">
                Coaching Cues
              </h2>
              <ul className="space-y-2">
                {exercise.coaching_cues.map((cue, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-zinc-300">
                    <span className="mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-orange-500" />
                    {cue}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <a
            href={exercise.url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-orange-500 py-3 font-medium text-white transition hover:bg-orange-600"
          >
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
              <path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.89-2.89 2.89 2.89 0 012.89-2.89c.28 0 .54.04.79.1V9.01a6.27 6.27 0 00-.79-.05 6.34 6.34 0 00-6.34 6.34 6.34 6.34 0 006.34 6.34 6.34 6.34 0 006.34-6.34V8.75a8.18 8.18 0 004.76 1.52V6.84a4.84 4.84 0 01-1-.15z" />
            </svg>
            Watch on TikTok
          </a>
        </aside>
      </div>
    </div>
  );
}
