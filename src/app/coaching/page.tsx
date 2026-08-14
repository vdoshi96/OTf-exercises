import type { Metadata } from "next";
import ExerciseGrid from "@/components/ExerciseGrid";
import { getDirectoryResponse, getDirectoryStats } from "@/lib/directory";
import {
  parseDirectoryQuery,
  type DirectorySearchParams,
} from "@/lib/query";

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
      <section className="border-b border-white/10">
        <div className="mx-auto max-w-[92rem] px-4 py-4 sm:px-6 sm:py-7 lg:px-8 lg:py-8">
          <div className="grid gap-4 sm:gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(420px,0.82fr)] lg:items-center">
            <div className="max-w-4xl">
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-orange-500">
                Separate from the exercise directory
              </p>
              <h1 className="font-display display-tight mt-2 max-w-4xl text-4xl font-semibold leading-[0.94] text-stone-50 sm:text-6xl">
                Coaching craft and movement context.
              </h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-stone-300 sm:mt-3 sm:text-base sm:leading-7">
                Browse reviewed technique, class-delivery, programming, and
                safety resources without mixing them into exercise results.
              </p>
            </div>

            <div className="panel-glass rounded-lg border p-3 sm:p-5">
              <div className="grid grid-cols-3 divide-x divide-white/10">
                <div className="px-2 first:pl-0 sm:px-3">
                  <p className="font-display display-tight text-2xl font-semibold leading-none text-orange-500 sm:text-5xl">
                    {stats.items.toLocaleString()}
                  </p>
                  <p className="mt-1 text-[11px] font-medium text-stone-300 sm:mt-3 sm:text-sm">
                    Resources
                  </p>
                </div>
                <div className="px-2 sm:px-6">
                  <p className="font-display display-tight text-2xl font-semibold leading-none text-orange-500 sm:text-5xl">
                    {stats.videos.toLocaleString()}
                  </p>
                  <p className="mt-1 text-[11px] font-medium text-stone-300 sm:mt-3 sm:text-sm">
                    Videos
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

      <ExerciseGrid initialResponse={initialResponse} pathname="/coaching" />
    </>
  );
}
