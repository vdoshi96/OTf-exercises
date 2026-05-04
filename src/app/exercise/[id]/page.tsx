import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import exercises from "@/data/exercises.json";
import type { GroupedExercise } from "@/lib/types";
import { CATEGORY_LABELS } from "@/lib/types";
import { getExerciseCreators } from "@/lib/search";
import VideoEmbed from "@/components/VideoEmbed";

const allExercises = exercises as GroupedExercise[];

interface PageProps {
  params: Promise<{ id: string }>;
}

function formatCreatorHandle(handle: string) {
  return handle.startsWith("@") ? handle : `@${handle}`;
}

export async function generateStaticParams() {
  return allExercises.map((ex) => ({ id: ex.id }));
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { id } = await params;
  const exercise = allExercises.find((ex) => ex.id === id);
  if (!exercise) return { title: "Exercise Not Found" };

  const muscleList = exercise.muscle_groups.join(", ");
  const videoCount = exercise.videos.length;
  return {
    title: exercise.exercise_name,
    description: `${exercise.exercise_name} — ${CATEGORY_LABELS[exercise.category] || exercise.category} exercise targeting ${muscleList}. ${videoCount} video demo${videoCount > 1 ? "s" : ""} in the OTF Exercise Directory.`,
    openGraph: {
      title: `${exercise.exercise_name} | OTF Exercise Directory`,
      description: `${exercise.exercise_name} targeting ${muscleList}. Watch ${videoCount} video demo${videoCount > 1 ? "s" : ""} in this unofficial fan directory.`,
      ...(exercise.videos[0]?.thumbnail
        ? { images: [exercise.videos[0].thumbnail] }
        : {}),
    },
  };
}

export default async function ExerciseDetailPage({ params }: PageProps) {
  const { id } = await params;
  const exercise = allExercises.find((ex) => ex.id === id);

  if (!exercise) notFound();

  const categoryLabel =
    CATEGORY_LABELS[exercise.category] || exercise.category;
  const creators = getExerciseCreators(exercise);

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:py-10">
      <Link
        href="/"
        className="mb-7 inline-flex items-center gap-2 rounded-md text-sm font-semibold text-stone-500 transition hover:text-orange-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-orange-400"
      >
        <svg
          aria-hidden="true"
          className="h-4 w-4"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M15 19l-7-7 7-7"
          />
        </svg>
        Back to directory
      </Link>

      <section className="mb-8 border-b border-orange-950/70 pb-8">
        <span className="inline-block rounded-md border border-orange-500/40 bg-orange-500/20 px-2.5 py-1 text-xs font-bold text-orange-50">
          {categoryLabel}
        </span>
        <h1 className="mt-4 font-display text-4xl font-semibold leading-tight text-stone-50 sm:text-5xl">
          {exercise.exercise_name}
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-stone-400">
          {exercise.videos.length} video
          {exercise.videos.length > 1 ? "s" : ""} with creator attribution,
          movement metadata, and coaching context.
        </p>
      </section>

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_340px]">
        <section aria-labelledby="video-library-heading">
          <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-sm font-semibold uppercase text-orange-300">
                Demos
              </p>
              <h2
                id="video-library-heading"
                className="mt-1 font-display text-3xl font-semibold text-stone-50"
              >
                Video library
              </h2>
            </div>
            {exercise.videos.length > 1 && (
              <span className="w-fit rounded-md border border-orange-500/35 bg-orange-500/15 px-3 py-1 text-sm font-semibold text-orange-100">
                {exercise.videos.length} sources
              </span>
            )}
          </div>

          <div className="space-y-5">
            {exercise.videos.map((video, i) => (
              <VideoEmbed
                key={video.id}
                video={video}
                index={i}
                total={exercise.videos.length}
              />
            ))}
          </div>
        </section>

        <aside
          aria-label="Exercise metadata"
          className="space-y-5 lg:sticky lg:top-28 lg:self-start"
        >
          <section className="rounded-lg border border-stone-800 bg-[#110d0a] p-5 shadow-sm shadow-black/30">
            <h2 className="mb-4 border-b border-orange-950/70 pb-3 text-sm font-semibold uppercase text-orange-300">
              Details
            </h2>
            <dl className="space-y-4">
              <div>
                <dt className="text-xs font-semibold text-stone-600">
                  Movement Type
                </dt>
                <dd className="mt-1 text-sm font-semibold capitalize text-stone-200">
                  {exercise.movement_type.replace(/_/g, " ")}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-semibold text-stone-600">
                  Muscle Groups
                </dt>
                <dd className="mt-1 flex flex-wrap gap-1.5">
                  {exercise.muscle_groups.map((mg) => (
                    <span
                      key={mg}
                      className="rounded-md border border-stone-800 bg-[#17100c] px-2 py-1 text-xs font-medium text-stone-300"
                    >
                      {mg}
                    </span>
                  ))}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-semibold text-stone-600">
                  Equipment
                </dt>
                <dd className="mt-1 flex flex-wrap gap-1.5">
                  {exercise.equipment.length > 0 ? (
                    exercise.equipment.map((eq) => (
                      <span
                        key={eq}
                        className="rounded-md border border-stone-800 bg-[#17100c] px-2 py-1 text-xs font-medium text-stone-300"
                      >
                        {eq}
                      </span>
                    ))
                  ) : (
                    <span className="rounded-md border border-stone-800 bg-[#17100c] px-2 py-1 text-xs font-medium text-stone-400">
                      Bodyweight
                    </span>
                  )}
                </dd>
              </div>
              {creators.length > 0 && (
                <div>
                  <dt className="text-xs font-semibold text-stone-600">
                    Creators
                  </dt>
                  <dd className="mt-2 space-y-2">
                    {creators.map((creator) => (
                      <a
                        key={creator.id}
                        href={creator.profile_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block rounded-md border border-stone-800 bg-[#17100c] px-3 py-2 text-sm font-semibold text-stone-200 transition hover:border-orange-500/35 hover:text-orange-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-400"
                      >
                        {creator.display_name}{" "}
                        <span className="font-normal text-stone-600">
                          {formatCreatorHandle(creator.handle)}
                        </span>
                      </a>
                    ))}
                  </dd>
                </div>
              )}
            </dl>
          </section>

          {exercise.coaching_cues.length > 0 && (
            <section className="rounded-lg border border-stone-800 bg-[#110d0a] p-5 shadow-sm shadow-black/30">
              <h2 className="mb-4 border-b border-orange-950/70 pb-3 text-sm font-semibold uppercase text-orange-300">
                Coaching Cues
              </h2>
              <ul className="space-y-2">
                {exercise.coaching_cues.map((cue, i) => (
                  <li
                    key={i}
                    className="flex items-start gap-2 text-sm leading-6 text-stone-300"
                  >
                    <span className="mt-2 h-1.5 w-1.5 flex-shrink-0 rounded-sm bg-orange-500" />
                    {cue}
                  </li>
                ))}
              </ul>
            </section>
          )}
        </aside>
      </div>
    </div>
  );
}
