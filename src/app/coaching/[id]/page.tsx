import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { DirectoryBackLink } from "@/components/SiteNav";
import VideoGallery from "@/components/VideoGallery";
import coachingJson from "@/data/coaching.json";
import exercisesJson from "@/data/exercises.json";
import type { CoachingResource, GroupedExercise, Video } from "@/lib/types";

const coachingResources = coachingJson as CoachingResource[];
const exercises = exercisesJson as GroupedExercise[];

const TOPIC_LABELS: Record<CoachingResource["topic"], string> = {
  "movement-technique": "Movement technique",
  "class-delivery": "Class delivery",
  programming: "Programming",
  "safety-and-modifications": "Safety and modifications",
};

interface CoachingDetailProps {
  params: Promise<{ id: string }>;
}

function uniqueCreators(videos: Video[]) {
  const creators = new Map(
    videos.map((video) => [video.creator.id, video.creator]),
  );
  return Array.from(creators.values()).sort((a, b) =>
    a.display_name.localeCompare(b.display_name),
  );
}

export function generateStaticParams() {
  return coachingResources.map((resource) => ({ id: resource.id }));
}

export async function generateMetadata({
  params,
}: CoachingDetailProps): Promise<Metadata> {
  const { id } = await params;
  const resource = coachingResources.find((item) => item.id === id);
  if (!resource) return { title: "Coaching Resource Not Found" };

  return {
    title: resource.title,
    description: `${resource.summary} Reviewed ${TOPIC_LABELS[resource.topic].toLowerCase()} in the unofficial OTF directory.`,
    openGraph: {
      title: `Unofficial OTF Exercise Directory | ${resource.title}`,
      description: resource.summary,
      ...(resource.videos[0]?.thumbnail
        ? { images: [resource.videos[0].thumbnail] }
        : {}),
    },
  };
}

export default async function CoachingDetailPage({
  params,
}: CoachingDetailProps) {
  const { id } = await params;
  const resource = coachingResources.find((item) => item.id === id);
  if (!resource) notFound();

  const creators = uniqueCreators(resource.videos);
  const relatedExercises = resource.related_exercise_ids
    .map((exerciseId) =>
      exercises.find((exercise) => exercise.id === exerciseId),
    )
    .filter((exercise): exercise is GroupedExercise => Boolean(exercise));
  const backLinkClassName =
    "mb-3 inline-flex min-h-12 items-center gap-2 rounded-md text-sm font-semibold text-accent transition hover:text-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-orange-400 sm:mb-4 sm:min-h-0";

  return (
    <div className="page-width detail-page">
      <Suspense
        fallback={
          <Link href="/coaching#directory" className={backLinkClassName}>
            Back to coaching
          </Link>
        }
      >
        <DirectoryBackLink className={backLinkClassName} section="coaching" />
      </Suspense>

      <section className="detail-heading">
        <h1 className="font-display display-tight mt-1 max-w-5xl text-3xl font-semibold leading-tight text-ink sm:mt-2 sm:text-5xl sm:leading-none lg:text-6xl">
          {resource.title}
        </h1>
        <p className="heading-context">{TOPIC_LABELS[resource.topic]}</p>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-muted sm:text-base sm:leading-7">
          {resource.summary}
        </p>
      </section>

      <VideoGallery
        key={resource.id}
        videos={resource.videos}
        title={resource.title}
      >
        <section className="rounded-lg border border-line bg-white p-4 sm:p-5">
          <h2 className="font-display display-tight border-b border-line pb-3 text-2xl font-semibold text-ink">
            Resource details
          </h2>
          <dl className="mt-4 space-y-5">
            <div>
              <dt className="text-xs font-bold uppercase text-muted">Topic</dt>
              <dd className="mt-1 text-sm font-semibold text-ink">
                {TOPIC_LABELS[resource.topic]}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-bold uppercase text-muted">
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
                    {creator.display_name}
                  </a>
                ))}
              </dd>
            </div>
          </dl>
        </section>

        {relatedExercises.length > 0 ? (
          <section className="rounded-lg border border-line bg-white p-4 sm:p-5">
            <h2 className="font-display display-tight text-2xl font-semibold text-ink">
              Related exercises
            </h2>
            <div className="mt-3 space-y-2">
              {relatedExercises.map((exercise) => (
                <Link
                  key={exercise.id}
                  href={`/exercise/${exercise.id}`}
                  className="flex min-h-12 items-center rounded-md border border-line bg-white px-3 py-2 text-sm font-semibold text-ink transition hover:border-orange-500/40 hover:text-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-400"
                >
                  {exercise.exercise_name}
                </Link>
              ))}
            </div>
          </section>
        ) : null}
      </VideoGallery>
    </div>
  );
}
