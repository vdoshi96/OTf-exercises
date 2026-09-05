import ExerciseGrid from "@/components/ExerciseGrid";
import { getDirectoryResponse, getDirectoryStats } from "@/lib/directory";
import { parseDirectoryQuery, type DirectorySearchParams } from "@/lib/query";

interface HomeProps {
  searchParams: Promise<DirectorySearchParams>;
}

export default async function Home({ searchParams }: HomeProps) {
  const stats = getDirectoryStats("exercise");
  const query = parseDirectoryQuery(await searchParams, "exercise");
  // Deep links preserve the requested batch, but the initial document stays
  // bounded to one 24-item window. The client reconstructs accumulated state
  // after hydration; without JavaScript, Load more behaves as next-page
  // navigation instead of expanding the server-rendered DOM without limit.
  const initialResponse = getDirectoryResponse(query, query.page, "window");

  return (
    <>
      <section className="directory-intro">
        <div className="page-width intro-heading">
          <div>
            <h1>Find a movement.</h1>
            <p>Preview an unfamiliar exercise before class.</p>
          </div>
          <p className="catalog-count">
            {stats.items.toLocaleString()} exercises ·{" "}
            {stats.videos.toLocaleString()} demos
          </p>
        </div>
      </section>

      <ExerciseGrid initialResponse={initialResponse} pathname="/" />
    </>
  );
}
