import Link from "next/link";

export default function NotFound() {
  return (
    <div className="mx-auto flex min-h-[60vh] max-w-3xl items-center px-4 py-12 sm:px-6 lg:px-8">
      <div className="w-full rounded-lg border border-white/10 bg-[#101111]/85 p-6 shadow-2xl shadow-black/20 sm:p-10">
        <p className="text-sm font-bold uppercase tracking-[0.14em] text-orange-500">
          404 · Page not found
        </p>
        <h1 className="font-display display-tight mt-2 text-4xl font-semibold text-stone-50 sm:text-5xl">
          That movement is not here.
        </h1>
        <p className="mt-4 max-w-2xl leading-7 text-stone-300">
          The address may be outdated, or the exercise may have a different
          name. Search the directory or browse every available movement.
        </p>

        <form
          action="/"
          method="get"
          role="search"
          className="mt-7 flex flex-col gap-3 sm:flex-row"
        >
          <label htmlFor="not-found-search" className="sr-only">
            Search the exercise directory
          </label>
          <input
            id="not-found-search"
            type="search"
            name="q"
            placeholder="Search exercises"
            className="min-h-12 min-w-0 flex-1 rounded-md border border-white/15 bg-[#181919] px-4 text-stone-100 placeholder:text-stone-400 focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500/25"
          />
          <button
            type="submit"
            className="min-h-12 rounded-md bg-orange-500 px-5 py-2 font-semibold text-black transition hover:bg-orange-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-orange-400"
          >
            Search directory
          </button>
        </form>

        <div className="mt-5 flex flex-wrap gap-x-5 gap-y-2">
          <Link
            href="/#directory"
            className="inline-flex min-h-12 items-center rounded-md text-sm font-semibold text-orange-300 underline decoration-orange-500/50 underline-offset-4 transition hover:text-orange-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-orange-400"
          >
            Browse all exercises
          </Link>
          <Link
            href="/coaching"
            className="inline-flex min-h-12 items-center rounded-md text-sm font-semibold text-orange-300 underline decoration-orange-500/50 underline-offset-4 transition hover:text-orange-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-orange-400"
          >
            Browse coaching resources
          </Link>
        </div>
      </div>
    </div>
  );
}
