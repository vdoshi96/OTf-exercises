import Link from "next/link";

export default function NotFound() {
  return (
    <div className="recovery-page">
      <div className="recovery-content">
        <h1 className="font-display display-tight mt-2 text-4xl font-semibold text-ink sm:text-5xl">
          That page isn’t here.
        </h1>
        <p className="heading-context">404 · Page not found</p>
        <p className="mt-4 max-w-2xl leading-7 text-muted">
          The address may be outdated. Search the directory or browse exercises
          and coaching resources.
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
            className="min-h-12 min-w-0 flex-1 rounded-md border border-line bg-white px-4 text-ink placeholder:text-muted focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500/25"
          />
          <button
            type="submit"
            className="min-h-12 rounded-md bg-accent-soft px-5 py-2 font-semibold text-black transition hover:bg-orange-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-orange-400"
          >
            Search directory
          </button>
        </form>

        <div className="mt-5 flex flex-wrap gap-x-5 gap-y-2">
          <Link
            href="/#directory"
            className="inline-flex min-h-12 items-center rounded-md text-sm font-semibold text-accent underline decoration-orange-500/50 underline-offset-4 transition hover:text-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-orange-400"
          >
            Browse all exercises
          </Link>
          <Link
            href="/coaching"
            className="inline-flex min-h-12 items-center rounded-md text-sm font-semibold text-accent underline decoration-orange-500/50 underline-offset-4 transition hover:text-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-orange-400"
          >
            Browse coaching resources
          </Link>
        </div>
      </div>
    </div>
  );
}
