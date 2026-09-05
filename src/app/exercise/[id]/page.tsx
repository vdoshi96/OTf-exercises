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
import VideoGallery from "@/components/VideoGallery";

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
    <div className="recovery-page">
      <div className="recovery-content">
        <h1 className="font-display display-tight mt-2 text-4xl font-semibold text-ink sm:text-5xl">
          {route.legacy_title}
        </h1>
        <p className="heading-context">Reviewed legacy listing</p>
        <p className="mt-4 max-w-3xl leading-7 text-muted">
          {wasSplit
            ? "This former listing covered more than one movement or coaching topic. It has been separated into the reviewed destinations below."
            : "This former listing is no longer published as an exercise after review. Browse the current exercise and coaching directories instead."}
        </p>

        {wasSplit ? (
          <section aria-labelledby="legacy-destinations" className="mt-8">
            <h2
              id="legacy-destinations"
              className="font-display display-tight text-2xl font-semibold text-ink"
            >
              Reviewed destinations
            </h2>
            <ul className="mt-4 grid gap-3 sm:grid-cols-2">
              {route.targets.map((target) => (
                <li key={`${target.kind}:${target.id}`}>
                  <Link
                    href={targetHref(target, queries)}
                    className="block h-full rounded-md border border-line bg-white p-4 transition hover:border-orange-500/50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-orange-400"
                  >
                    <span className="text-xs font-bold uppercase tracking-[0.1em] text-accent">
                      {target.kind === "exercise"
                        ? "Exercise"
                        : "Coaching resource"}
                    </span>
                    <span className="mt-1 block font-semibold text-ink">
                      {target.title}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {!wasSplit && (
          <form
            action="/"
            method="get"
            role="search"
            className="recovery-search"
          >
            <label htmlFor="legacy-search" className="sr-only">
              Search exercises
            </label>
            <input
              id="legacy-search"
              name="q"
              type="search"
              placeholder="Search exercises"
            />
            <button type="submit">Search directory</button>
          </form>
        )}
        <div className="mt-7 flex flex-wrap gap-x-5 gap-y-2">
          <Link
            href={exerciseDirectoryHref}
            className="inline-flex min-h-12 items-center rounded-md text-sm font-semibold text-accent underline decoration-orange-500/50 underline-offset-4 transition hover:text-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-orange-400"
          >
            Browse current exercises
          </Link>
          <Link
            href={coachingDirectoryHref}
            className="inline-flex min-h-12 items-center rounded-md text-sm font-semibold text-accent underline decoration-orange-500/50 underline-offset-4 transition hover:text-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-orange-400"
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

  const categoryLabel = CATEGORY_LABELS[exercise.category] || exercise.category;
  const creators = getExerciseCreators(exercise);
  const backLinkClassName =
    "mb-3 inline-flex min-h-12 items-center gap-2 rounded-md text-sm font-semibold text-accent transition hover:text-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-orange-400 sm:mb-4 sm:min-h-0";

  return (
    <div className="page-width detail-page">
      <Suspense
        fallback={
          <Link href="/#directory" className={backLinkClassName}>
            Back to directory
          </Link>
        }
      >
        <DirectoryBackLink className={backLinkClassName} />
      </Suspense>

      <section className="detail-heading">
        <div>
          <h1 className="font-display display-tight mt-1 text-[clamp(2rem,4.2vw,3.5rem)] font-semibold leading-[0.98] text-ink sm:mt-2">
            {exercise.exercise_name}
          </h1>
          <span className="heading-context">{categoryLabel}</span>
          <p>
            {exercise.equipment.length
              ? exercise.equipment.join(" · ")
              : "Equipment not specified"}
          </p>
        </div>
      </section>

      <VideoGallery
        key={exercise.id}
        videos={exercise.videos}
        title={exercise.exercise_name}
      >
        <section className="rounded-lg border border-line bg-white p-4 sm:p-5">
          <h2 className="font-display display-tight mb-4 border-b border-line pb-3 text-2xl font-semibold text-ink sm:mb-5 sm:pb-4">
            Details
          </h2>
          <dl className="space-y-5">
            <div>
              <dt className="flex items-center gap-2 text-xs font-bold uppercase text-muted">
                <span className="h-2 w-2 rounded-sm bg-accent-soft" />
                Movement Type
              </dt>
              <dd className="mt-1 text-sm font-semibold capitalize text-ink">
                {formatValue(exercise.movement_type)}
              </dd>
            </div>
            <div>
              <dt className="flex items-center gap-2 text-xs font-bold uppercase text-muted">
                <span className="h-2 w-2 rounded-sm bg-accent-soft" />
                Muscle Groups
              </dt>
              <dd className="mt-1 flex flex-wrap gap-1.5">
                {exercise.muscle_groups.map((mg) => (
                  <span
                    key={mg}
                    className="rounded-md border border-line bg-white px-2.5 py-1.5 text-xs font-medium text-muted"
                  >
                    {mg}
                  </span>
                ))}
              </dd>
            </div>
            <div>
              <dt className="flex items-center gap-2 text-xs font-bold uppercase text-muted">
                <span className="h-2 w-2 rounded-sm bg-accent-soft" />
                Equipment
              </dt>
              <dd className="mt-1 flex flex-wrap gap-1.5">
                {exercise.equipment.length > 0 ? (
                  exercise.equipment.map((eq) => (
                    <span
                      key={eq}
                      className="rounded-md border border-line bg-white px-2.5 py-1.5 text-xs font-medium text-muted"
                    >
                      {eq}
                    </span>
                  ))
                ) : (
                  <span className="rounded-md border border-line bg-white px-2.5 py-1.5 text-xs font-medium text-muted">
                    Equipment not specified
                  </span>
                )}
              </dd>
            </div>
            {creators.length > 0 && (
              <div>
                <dt className="flex items-center gap-2 text-xs font-bold uppercase text-muted">
                  <span className="h-2 w-2 rounded-sm bg-accent-soft" />
                  Creators
                </dt>
                <dd className="mt-2 space-y-2">
                  {creators.map((creator) => (
                    <a
                      key={creator.id}
                      href={creator.profile_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex min-h-12 items-center rounded-md border border-line bg-white px-3 py-2 text-sm font-semibold text-ink transition hover:border-orange-500/40 hover:text-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-400"
                    >
                      {creator.display_name}{" "}
                      <span className="font-normal text-muted">
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
          <section className="rounded-lg border border-line bg-white p-4 sm:p-5">
            <h2 className="font-display display-tight mb-4 border-b border-line pb-3 text-2xl font-semibold text-ink sm:mb-5 sm:pb-4">
              Coaching Cues
            </h2>
            <ul className="space-y-2">
              {exercise.coaching_cues.map((cue, i) => (
                <li
                  key={i}
                  className="flex items-start gap-2 text-sm leading-6 text-muted"
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
      </VideoGallery>
    </div>
  );
}
