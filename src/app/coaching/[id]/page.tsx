import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { DirectoryBackLink } from "@/components/SiteNav";
import VideoEmbed from "@/components/VideoEmbed";
import coachingJson from "@/data/coaching.json";
import exercisesJson from "@/data/exercises.json";
import type {
  CoachingResource,
  GroupedExercise,
  Video,
} from "@/lib/types";

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
  const creators = new Map(videos.map((video) => [video.creator.id, video.creator]));
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
    .map((exerciseId) => exercises.find((exercise) => exercise.id === exerciseId))
    .filter((exercise): exercise is GroupedExercise => Boolean(exercise));
  const backLinkClassName =
    "mb-3 inline-flex min-h-12 items-center gap-2 rounded-md text-sm font-semibold text-orange-400 transition hover:text-orange-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-orange-400 sm:mb-4 sm:min-h-0";

  return (
    <div className="mx-auto max-w-[92rem] px-4 py-4 sm:px-6 sm:py-5 lg:px-8 lg:py-6">
      <Suspense
        fallback={
          <Link href="/coaching#directory" className={backLinkClassName}>
            Back to coaching
          </Link>
        }
      >
        <DirectoryBackLink className={backLinkClassName} section="coaching" />
      </Suspense>

      <section className="mb-5 border-b border-white/10 pb-5 sm:mb-6 sm:pb-6">
        <p className="text-sm font-bold uppercase tracking-[0.12em] text-orange-500">
          {TOPIC_LABELS[resource.topic]}
        </p>
        <h1 className="font-display display-tight mt-1 max-w-5xl text-3xl font-semibold leading-tight text-stone-50 sm:mt-2 sm:text-5xl sm:leading-none lg:text-6xl">
          {resource.title}
        </h1>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-stone-300 sm:text-base sm:leading-7">
          {resource.summary}
        </p>
      </section>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px] xl:grid-cols-[minmax(0,1fr)_420px]">
        <section
          aria-labelledby="coaching-video-heading"
          className="overflow-hidden rounded-lg border border-white/10 bg-[#101111]/80 shadow-xl shadow-black/20"
        >
          <div className="border-b border-white/10 px-4 py-3 sm:px-5 sm:py-4">
            <h2
              id="coaching-video-heading"
              className="font-display display-tight text-2xl font-semibold text-stone-50 sm:text-3xl"
            >
              Coaching videos
            </h2>
          </div>
          <div className="space-y-4 p-3 sm:space-y-5 sm:p-5">
            {resource.videos.map((video, index) => (
              <VideoEmbed
                key={video.id}
                video={video}
                exerciseName={resource.title}
                index={index}
                total={resource.videos.length}
              />
            ))}
          </div>
        </section>

        <aside className="space-y-4 lg:sticky lg:top-28 lg:self-start">
          <section className="rounded-lg border border-white/10 bg-[#101111]/85 p-4 shadow-xl shadow-black/20 sm:p-5">
            <h2 className="font-display display-tight border-b border-white/10 pb-3 text-2xl font-semibold text-stone-50">
              Resource details
            </h2>
            <dl className="mt-4 space-y-5">
              <div>
                <dt className="text-xs font-bold uppercase text-stone-500">Topic</dt>
                <dd className="mt-1 text-sm font-semibold text-stone-200">
                  {TOPIC_LABELS[resource.topic]}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-bold uppercase text-stone-500">Creators</dt>
                <dd className="mt-2 space-y-2">
                  {creators.map((creator) => (
                    <a
                      key={creator.id}
                      href={creator.profile_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex min-h-12 items-center rounded-md border border-white/10 bg-[#181919] px-3 py-2 text-sm font-semibold text-stone-200 transition hover:border-orange-500/40 hover:text-orange-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-400"
                    >
                      {creator.display_name}
                    </a>
                  ))}
                </dd>
              </div>
            </dl>
          </section>

          {relatedExercises.length > 0 ? (
            <section className="rounded-lg border border-white/10 bg-[#101111]/85 p-4 shadow-xl shadow-black/20 sm:p-5">
              <h2 className="font-display display-tight text-2xl font-semibold text-stone-50">
                Related exercises
              </h2>
              <div className="mt-3 space-y-2">
                {relatedExercises.map((exercise) => (
                  <Link
                    key={exercise.id}
                    href={`/exercise/${exercise.id}`}
                    className="flex min-h-12 items-center rounded-md border border-white/10 bg-[#181919] px-3 py-2 text-sm font-semibold text-stone-200 transition hover:border-orange-500/40 hover:text-orange-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-400"
                  >
                    {exercise.exercise_name}
                  </Link>
                ))}
              </div>
            </section>
          ) : null}
        </aside>
      </div>
    </div>
  );
}
