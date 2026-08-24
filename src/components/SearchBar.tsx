"use client";

interface SearchBarProps {
  value: string;
  onChange: (query: string) => void;
  onSubmit: () => void;
  onClear: () => void;
  resultCount: number;
  totalCount: number;
  isLoading?: boolean;
  itemNoun: string;
}

export default function SearchBar({
  value,
  onChange,
  onSubmit,
  onClear,
  resultCount,
  totalCount,
  isLoading = false,
  itemNoun,
}: SearchBarProps) {
  const searchLabel = `Search ${itemNoun}`;
  return (
    <form
      className="w-full"
      role="search"
      aria-busy={isLoading}
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit();
      }}
    >
      <label htmlFor="exercise-search" className="sr-only">
        {searchLabel}
      </label>
      <div className="relative flex min-h-12 overflow-hidden rounded-lg border border-white/15 bg-[#111313]/90 shadow-2xl shadow-black/30 transition focus-within:border-orange-400 focus-within:ring-2 focus-within:ring-orange-500/30 sm:min-h-14">
        <svg
          aria-hidden="true"
          className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-stone-300 sm:left-5 sm:h-6 sm:w-6"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
          />
        </svg>
        <input
          id="exercise-search"
          type="search"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder="Search directory…"
          className="search-input min-w-0 flex-1 bg-transparent py-3 pl-11 pr-12 text-base font-medium text-stone-50 outline-none placeholder:text-stone-400 sm:py-4 sm:pl-14 sm:pr-44 sm:text-lg"
        />
        {value && (
          <button
            type="button"
            aria-label="Clear search"
            onClick={onClear}
            className="absolute right-32 top-1/2 flex min-h-12 min-w-12 -translate-y-1/2 items-center justify-center rounded-md text-stone-400 transition hover:bg-white/10 hover:text-orange-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-400 max-sm:right-0"
          >
            <svg
              aria-hidden="true"
              className="h-5 w-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        )}
        <button
          type="submit"
          className="hidden min-w-32 items-center justify-center bg-orange-500 px-6 text-base font-bold text-black transition hover:bg-orange-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-4px] focus-visible:outline-orange-100 sm:inline-flex"
        >
          Search
        </button>
      </div>
      <p className="sr-only" aria-live="polite">
        {value
          ? `${resultCount} result${resultCount !== 1 ? "s" : ""} found`
          : `${totalCount} ${itemNoun}`}
      </p>
    </form>
  );
}
