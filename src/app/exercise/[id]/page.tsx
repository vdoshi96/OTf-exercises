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

function formatValue(value: string) {
  return value.replace(/_/g, " ");
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
  const sourceCount = new Set(exercise.videos.map((video) => video.source))
    .size;
  const muscleSummary = exercise.muscle_groups.join(", ");
  const equipmentSummary =
    exercise.equipment.length > 0
      ? exercise.equipment.join(", ")
      : "Bodyweight";
  const creatorSummary =
    creators.length > 0
      ? `${creators.length} creator${creators.length === 1 ? "" : "s"}`
      : "Creator pending";

  return (
    <div className="mx-auto max-w-[92rem] px-4 py-7 sm:px-6 lg:px-8 lg:py-9">
      <Link
        href="/"
        className="mb-8 inline-flex items-center gap-2 rounded-md text-sm font-semibold text-orange-400 transition hover:text-orange-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-orange-400"
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

      <section className="mb-8 grid gap-8 border-b border-white/10 pb-8 lg:grid-cols-[minmax(0,0.82fr)_minmax(520px,1fr)] lg:items-end">
        <div>
          <span className="inline-block rounded-md text-sm font-bold uppercase text-orange-500">
            {categoryLabel}
          </span>
          <h1 className="font-display display-tight mt-3 text-6xl font-semibold leading-[0.92] text-stone-50 sm:text-7xl lg:text-8xl">
            {exercise.exercise_name}
          </h1>
          <p className="mt-4 max-w-2xl text-base leading-7 text-stone-300">
            {exercise.videos.length} video
            {exercise.videos.length > 1 ? "s" : ""} with creator attribution,
            movement metadata, and coaching context.
          </p>
        </div>

        <div className="grid gap-4 rounded-lg border border-white/10 bg-[#101111]/80 p-5 sm:grid-cols-4">
          <div className="border-white/10 sm:border-r sm:pr-4">
            <p className="text-xs font-bold uppercase text-stone-500">
              Movement Type
            </p>
            <p className="mt-2 text-sm font-semibold capitalize text-stone-100">
              {formatValue(exercise.movement_type)}
            </p>
          </div>
          <div className="border-white/10 sm:border-r sm:pr-4">
            <p className="text-xs font-bold uppercase text-stone-500">
              Muscle Groups
            </p>
            <p className="mt-2 text-sm font-semibold text-stone-100">
              {muscleSummary}
            </p>
          </div>
          <div className="border-white/10 sm:border-r sm:pr-4">
            <p className="text-xs font-bold uppercase text-stone-500">
              Equipment
            </p>
            <p className="mt-2 text-sm font-semibold text-stone-100">
              {equipmentSummary}
            </p>
          </div>
          <div>
            <p className="text-xs font-bold uppercase text-stone-500">
              Creators
            </p>
            <p className="mt-2 text-sm font-semibold text-stone-100">
              {creatorSummary}
            </p>
          </div>
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px] xl:grid-cols-[minmax(0,1fr)_420px]">
        <section
          aria-labelledby="video-library-heading"
          className="overflow-hidden rounded-lg border border-white/10 bg-[#101111]/80 shadow-xl shadow-black/20"
        >
          <div className="flex flex-col gap-3 border-b border-white/10 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
            <h2
              id="video-library-heading"
              className="font-display display-tight text-3xl font-semibold text-stone-50"
            >
              Video library
            </h2>
            {sourceCount > 1 && (
              <span className="w-fit text-xs font-bold uppercase text-stone-400">
                {sourceCount} sources
              </span>
            )}
          </div>

          <div className="space-y-5 p-5">
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
          <section className="rounded-lg border border-white/10 bg-[#101111]/85 p-5 shadow-xl shadow-black/20">
            <h2 className="font-display display-tight mb-5 border-b border-white/10 pb-4 text-2xl font-semibold text-stone-50">
              Details
            </h2>
            <dl className="space-y-5">
              <div>
                <dt className="flex items-center gap-2 text-xs font-bold uppercase text-stone-500">
                  <span className="h-2 w-2 rounded-sm bg-orange-500" />
                  Movement Type
                </dt>
                <dd className="mt-1 text-sm font-semibold capitalize text-stone-200">
                  {formatValue(exercise.movement_type)}
                </dd>
              </div>
              <div>
                <dt className="flex items-center gap-2 text-xs font-bold uppercase text-stone-500">
                  <span className="h-2 w-2 rounded-sm bg-orange-500" />
                  Muscle Groups
                </dt>
                <dd className="mt-1 flex flex-wrap gap-1.5">
                  {exercise.muscle_groups.map((mg) => (
                    <span
                      key={mg}
                      className="rounded-md border border-white/10 bg-[#181919] px-2.5 py-1.5 text-xs font-medium text-stone-300"
                    >
                      {mg}
                    </span>
                  ))}
                </dd>
              </div>
              <div>
                <dt className="flex items-center gap-2 text-xs font-bold uppercase text-stone-500">
                  <span className="h-2 w-2 rounded-sm bg-orange-500" />
                  Equipment
                </dt>
                <dd className="mt-1 flex flex-wrap gap-1.5">
                  {exercise.equipment.length > 0 ? (
                    exercise.equipment.map((eq) => (
                      <span
                        key={eq}
                        className="rounded-md border border-white/10 bg-[#181919] px-2.5 py-1.5 text-xs font-medium text-stone-300"
                      >
                        {eq}
                      </span>
                    ))
                  ) : (
                    <span className="rounded-md border border-white/10 bg-[#181919] px-2.5 py-1.5 text-xs font-medium text-stone-400">
                      Bodyweight
                    </span>
                  )}
                </dd>
              </div>
              {creators.length > 0 && (
                <div>
                  <dt className="flex items-center gap-2 text-xs font-bold uppercase text-stone-500">
                    <span className="h-2 w-2 rounded-sm bg-orange-500" />
                    Creators
                  </dt>
                  <dd className="mt-2 space-y-2">
                    {creators.map((creator) => (
                      <a
                        key={creator.id}
                        href={creator.profile_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block rounded-md border border-white/10 bg-[#181919] px-3 py-2 text-sm font-semibold text-stone-200 transition hover:border-orange-500/40 hover:text-orange-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-400"
                      >
                        {creator.display_name}{" "}
                        <span className="font-normal text-stone-500">
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
            <section className="rounded-lg border border-white/10 bg-[#101111]/85 p-5 shadow-xl shadow-black/20">
              <h2 className="font-display display-tight mb-5 border-b border-white/10 pb-4 text-2xl font-semibold text-stone-50">
                Coaching Cues
              </h2>
              <ul className="space-y-2">
                {exercise.coaching_cues.map((cue, i) => (
                  <li
                    key={i}
                    className="flex items-start gap-2 text-sm leading-6 text-stone-300"
                  >
                    <span className="mt-1.5 flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-full border border-[var(--signal)] text-[var(--signal)]">
                      <svg
                        aria-hidden="true"
                        className="h-2.5 w-2.5"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={3}
                          d="m5 13 4 4L19 7"
                        />
                      </svg>
                    </span>
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
