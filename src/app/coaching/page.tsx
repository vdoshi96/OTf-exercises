import type { Metadata } from "next";
import ExerciseGrid from "@/components/ExerciseGrid";
import { getDirectoryResponse, getDirectoryStats } from "@/lib/directory";
import { parseDirectoryQuery, type DirectorySearchParams } from "@/lib/query";

export const metadata: Metadata = {
  title: "Coaching Resources",
  description:
    "Reviewed coaching craft, movement technique, programming, and safety resources in the unofficial OTF directory.",
};

interface CoachingPageProps {
  searchParams: Promise<DirectorySearchParams>;
}

export default async function CoachingPage({
  searchParams,
}: CoachingPageProps) {
  const stats = getDirectoryStats("coaching");
  const query = parseDirectoryQuery(await searchParams, "coaching");
  const initialResponse = getDirectoryResponse(query, query.page, "window");

  return (
    <>
      <section className="directory-intro">
        <div className="page-width intro-heading">
          <div>
            <h1>Coaching resources.</h1>
            <p>
              Technique, class delivery, and context from the original creators.
            </p>
          </div>
          <p className="catalog-count">
            {stats.items.toLocaleString()} resources ·{" "}
            {stats.videos.toLocaleString()} videos
          </p>
        </div>
      </section>

      <ExerciseGrid initialResponse={initialResponse} pathname="/coaching" />
    </>
  );
}
