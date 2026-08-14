import ExerciseGrid from "@/components/ExerciseGrid";
import { getDirectoryResponse, getDirectoryStats } from "@/lib/directory";
import {
  parseDirectoryQuery,
  type DirectorySearchParams,
} from "@/lib/query";

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
      <section className="border-b border-white/10">
        <div className="mx-auto max-w-[92rem] px-4 py-4 sm:px-6 sm:py-7 lg:px-8 lg:py-8">
          <div className="grid gap-4 sm:gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(420px,0.82fr)] lg:items-center">
            <div className="max-w-4xl">
              <h1 className="font-display display-tight max-w-4xl text-4xl font-semibold leading-[0.94] text-stone-50 sm:text-6xl lg:text-6xl">
                Find the movement before class starts.
              </h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-stone-300 sm:mt-3 sm:text-base sm:leading-7">
                Search exercise demos by muscle group, equipment, category, and
                creator so you can preview unfamiliar movements and walk into
                the studio with context.
              </p>
            </div>

            <div className="panel-glass rounded-lg border p-3 sm:p-5">
              <div className="grid grid-cols-3 divide-x divide-white/10">
                <div className="px-2 first:pl-0 sm:px-3">
                  <p className="font-display display-tight text-2xl font-semibold leading-none text-orange-500 sm:text-5xl">
                    {stats.items.toLocaleString()}
                  </p>
                  <p className="mt-1 text-[11px] font-medium text-stone-300 sm:mt-3 sm:text-sm">
                    Exercises
                  </p>
                </div>
                <div className="px-2 sm:px-6">
                  <p className="font-display display-tight text-2xl font-semibold leading-none text-orange-500 sm:text-5xl">
                    {stats.videos.toLocaleString()}
                  </p>
                  <p className="mt-1 text-[11px] font-medium text-stone-300 sm:mt-3 sm:text-sm">
                    <span className="sm:hidden">Videos</span>
                    <span className="hidden sm:inline">Video demos</span>
                  </p>
                </div>
                <div className="px-2 last:pr-0 sm:px-6">
                  <p className="font-display display-tight text-2xl font-semibold leading-none text-orange-500 sm:text-5xl">
                    {stats.creators.toLocaleString()}
                  </p>
                  <p className="mt-1 text-[11px] font-medium text-stone-300 sm:mt-3 sm:text-sm">
                    Creator{stats.creators === 1 ? "" : "s"}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <ExerciseGrid initialResponse={initialResponse} pathname="/" />
    </>
  );
}
