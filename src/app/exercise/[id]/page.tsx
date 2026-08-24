import { notFound, permanentRedirect } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { Suspense } from "react";
import exercises from "@/data/exercises.json";
import legacyExerciseRoutesJson from "@/data/legacy-exercise-routes.json";
import type {
  DirectoryQuery,
  DirectorySection,
  GroupedExercise,
  LegacyExerciseRoute,
  LegacyExerciseRouteLedger,
  LegacyExerciseRouteTarget,
} from "@/lib/types";
import { CATEGORY_LABELS } from "@/lib/types";
import { getExerciseCreators } from "@/lib/search";
import { getDirectoryResponse } from "@/lib/directory";
import {
  directoryDetailHref,
  directoryPageHref,
  parseDirectoryQuery,
  type DirectorySearchParams,
} from "@/lib/query";
import { DirectoryBackLink } from "@/components/SiteNav";
import VideoEmbed from "@/components/VideoEmbed";

const allExercises = exercises as GroupedExercise[];
const legacyExerciseRouteLedger =
  legacyExerciseRoutesJson as LegacyExerciseRouteLedger;
const legacyExerciseRoutes = legacyExerciseRouteLedger.routes;

interface PageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<DirectorySearchParams>;
}

function formatCreatorHandle(handle: string) {
  return handle.startsWith("@") ? handle : `@${handle}`;
}

function formatValue(value: string) {
  return value.replace(/_/g, " ");
}

export function generateStaticParams() {
  return [
    ...allExercises.map((exercise) => exercise.id),
    ...Object.keys(legacyExerciseRoutes),
  ].map((id) => ({ id }));
}

function normalizedDirectoryQuery(
  searchParams: DirectorySearchParams,
  section: DirectorySection,
): DirectoryQuery {
  const requested = parseDirectoryQuery(searchParams, section);
  return getDirectoryResponse(requested, requested.page, "window").query;
}

function targetHref(
  target: LegacyExerciseRouteTarget,
  queries: Record<DirectorySection, DirectoryQuery>,
) {
  return directoryDetailHref(queries[target.kind], target.id);
}

function LegacyExerciseRecovery({
  route,
  queries,
}: {
  route: LegacyExerciseRoute;
  queries: Record<DirectorySection, DirectoryQuery>;
}) {
  const exerciseDirectoryHref =
    directoryPageHref("/", queries.exercise) + "#directory";
  const coachingDirectoryHref =
    directoryPageHref("/coaching", queries.coaching) + "#directory";
  const wasSplit = route.outcome === "split";

  return (
    <div className="mx-auto flex min-h-[60vh] max-w-4xl items-center px-4 py-12 sm:px-6 lg:px-8">
      <div className="w-full rounded-lg border border-white/10 bg-[#101111]/85 p-6 shadow-2xl shadow-black/20 sm:p-10">
        <p className="text-sm font-bold uppercase tracking-[0.14em] text-orange-500">
          Reviewed legacy listing
        </p>
        <h1 className="font-display display-tight mt-2 text-4xl font-semibold text-stone-50 sm:text-5xl">
          {route.legacy_title}
        </h1>
        <p className="mt-4 max-w-3xl leading-7 text-stone-300">
          {wasSplit
            ? "This former listing covered more than one movement or coaching topic. It has been separated into the reviewed destinations below."
            : "This former listing is no longer published as an exercise after review. Browse the current exercise and coaching directories instead."}
        </p>

        {wasSplit ? (
          <section aria-labelledby="legacy-destinations" className="mt-8">
            <h2
              id="legacy-destinations"
              className="font-display display-tight text-2xl font-semibold text-stone-50"
            >
              Reviewed destinations
            </h2>
            <ul className="mt-4 grid gap-3 sm:grid-cols-2">
              {route.targets.map((target) => (
                <li key={`${target.kind}:${target.id}`}>
                  <Link
                    href={targetHref(target, queries)}
                    className="block h-full rounded-md border border-white/10 bg-[#181919] p-4 transition hover:border-orange-500/50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-orange-400"
                  >
                    <span className="text-xs font-bold uppercase tracking-[0.1em] text-orange-400">
                      {target.kind === "exercise"
                        ? "Exercise"
                        : "Coaching resource"}
                    </span>
                    <span className="mt-1 block font-semibold text-stone-100">
                      {target.title}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        <div className="mt-7 flex flex-wrap gap-x-5 gap-y-2">
          <Link
            href={exerciseDirectoryHref}
            className="inline-flex min-h-12 items-center rounded-md text-sm font-semibold text-orange-300 underline decoration-orange-500/50 underline-offset-4 transition hover:text-orange-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-orange-400"
          >
            Browse current exercises
          </Link>
          <Link
            href={coachingDirectoryHref}
            className="inline-flex min-h-12 items-center rounded-md text-sm font-semibold text-orange-300 underline decoration-orange-500/50 underline-offset-4 transition hover:text-orange-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-orange-400"
          >
            Browse coaching resources
          </Link>
        </div>
      </div>
    </div>
  );
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { id } = await params;
  const exercise = allExercises.find((ex) => ex.id === id);
  if (!exercise) {
    const legacyRoute = legacyExerciseRoutes[id];
    if (!legacyRoute) return { title: "Exercise Not Found" };
    const redirectTarget =
      legacyRoute.outcome === "redirect" ? legacyRoute.targets[0] : undefined;
    return {
      title: redirectTarget?.title ?? legacyRoute.legacy_title,
      description:
        legacyRoute.outcome === "split"
          ? "This former exercise listing has been separated into reviewed exercise and coaching destinations."
          : legacyRoute.outcome === "removed"
            ? "This former exercise listing is no longer published after catalog review."
            : `This former exercise URL now points to ${redirectTarget?.title}.`,
      robots: { index: false, follow: true },
      ...(redirectTarget
        ? { alternates: { canonical: redirectTarget.path } }
        : {}),
    };
  }

  const muscleList =
    exercise.muscle_groups.length > 0
      ? exercise.muscle_groups.join(", ")
      : "muscle groups not yet specified";
  const videoCount = exercise.videos.length;
  return {
    title: exercise.exercise_name,
    description: `${exercise.exercise_name} — ${CATEGORY_LABELS[exercise.category] || exercise.category} exercise targeting ${muscleList}. ${videoCount} video demo${videoCount > 1 ? "s" : ""} in the unofficial OTF Exercise Directory.`,
    openGraph: {
      title: `Unofficial OTF Exercise Directory | ${exercise.exercise_name}`,
      description: `${exercise.exercise_name} targeting ${muscleList}. Watch ${videoCount} video demo${videoCount > 1 ? "s" : ""} in this unofficial fan directory.`,
      ...(exercise.videos[0]?.thumbnail
        ? { images: [exercise.videos[0].thumbnail] }
        : {}),
    },
  };
}

export default async function ExerciseDetailPage({
  params,
  searchParams,
}: PageProps) {
  const { id } = await params;
  const exercise = allExercises.find((ex) => ex.id === id);

  if (!exercise) {
    const legacyRoute = legacyExerciseRoutes[id];
    if (!legacyRoute) notFound();

    const rawSearchParams = await searchParams;
    if (legacyRoute.outcome === "redirect") {
      const target = legacyRoute.targets[0];
      const query = normalizedDirectoryQuery(rawSearchParams, target.kind);
      permanentRedirect(directoryDetailHref(query, target.id));
    }

    const queries = {
      exercise: normalizedDirectoryQuery(rawSearchParams, "exercise"),
      coaching: normalizedDirectoryQuery(rawSearchParams, "coaching"),
    };
    return <LegacyExerciseRecovery route={legacyRoute} queries={queries} />;
  }

  const categoryLabel =
    CATEGORY_LABELS[exercise.category] || exercise.category;
  const creators = getExerciseCreators(exercise);
  const sourceCount = new Set(exercise.videos.map((video) => video.source))
    .size;
  const backLinkClassName =
    "mb-3 inline-flex min-h-12 items-center gap-2 rounded-md text-sm font-semibold text-orange-400 transition hover:text-orange-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-orange-400 sm:mb-4 sm:min-h-0";

  return (
    <div className="mx-auto max-w-[92rem] px-4 py-4 sm:px-6 sm:py-5 lg:px-8 lg:py-6">
      <Suspense
        fallback={
          <Link href="/#directory" className={backLinkClassName}>
            Back to directory
          </Link>
        }
      >
        <DirectoryBackLink className={backLinkClassName} />
      </Suspense>

      <section className="mb-5 max-w-5xl border-b border-white/10 pb-5 sm:mb-6 sm:pb-6">
        <div>
          <span className="inline-block rounded-md text-sm font-bold uppercase text-orange-500">
            {categoryLabel}
          </span>
          <h1 className="font-display display-tight mt-1 text-[clamp(2rem,4.2vw,3.5rem)] font-semibold leading-[0.98] text-stone-50 sm:mt-2">
            {exercise.exercise_name}
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-stone-300 sm:mt-3 sm:text-base sm:leading-7">
            {exercise.videos.length} video
            {exercise.videos.length > 1 ? "s" : ""} with creator attribution,
            movement metadata, and coaching context.
          </p>
        </div>

      </section>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px] xl:grid-cols-[minmax(0,1fr)_420px]">
        <section
          aria-labelledby="video-library-heading"
          className="overflow-hidden rounded-lg border border-white/10 bg-[#101111]/80 shadow-xl shadow-black/20"
        >
          <div className="flex flex-col gap-2 border-b border-white/10 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5 sm:py-4">
            <h2
              id="video-library-heading"
              className="font-display display-tight text-2xl font-semibold text-stone-50 sm:text-3xl"
            >
              Video library
            </h2>
            {sourceCount > 1 && (
              <span className="w-fit text-xs font-bold uppercase text-stone-400">
                {sourceCount} sources
              </span>
            )}
          </div>

          <div className="space-y-4 p-3 sm:space-y-5 sm:p-5">
            {exercise.videos.map((video, i) => (
              <VideoEmbed
                key={video.id}
                video={video}
                exerciseName={exercise.exercise_name}
                index={i}
                total={exercise.videos.length}
              />
            ))}
          </div>
        </section>

        <aside
          aria-label="Exercise metadata"
          className="space-y-4 sm:space-y-5 lg:sticky lg:top-28 lg:self-start"
        >
          <section className="rounded-lg border border-white/10 bg-[#101111]/85 p-4 shadow-xl shadow-black/20 sm:p-5">
            <h2 className="font-display display-tight mb-4 border-b border-white/10 pb-3 text-2xl font-semibold text-stone-50 sm:mb-5 sm:pb-4">
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
                      Equipment not specified
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
                        className="flex min-h-12 items-center rounded-md border border-white/10 bg-[#181919] px-3 py-2 text-sm font-semibold text-stone-200 transition hover:border-orange-500/40 hover:text-orange-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-400"
                      >
                        {creator.display_name}{" "}
                        <span className="font-normal text-stone-400">
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
            <section className="rounded-lg border border-white/10 bg-[#101111]/85 p-4 shadow-xl shadow-black/20 sm:p-5">
              <h2 className="font-display display-tight mb-4 border-b border-white/10 pb-3 text-2xl font-semibold text-stone-50 sm:mb-5 sm:pb-4">
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
