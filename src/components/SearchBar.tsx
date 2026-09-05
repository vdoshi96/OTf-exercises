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
      className="search-form"
      method="get"
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
      <div className="search-control">
        <svg
          aria-hidden="true"
          className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted sm:left-5 sm:h-6 sm:w-6"
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
          name="q"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={
            itemNoun === "exercises"
              ? "Search by exercise, equipment, or muscle"
              : "Search coaching resources"
          }
          className="search-input"
        />
        {value && (
          <button
            type="button"
            aria-label="Clear search"
            onClick={onClear}
            className="search-clear"
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
        <button type="submit" className="search-submit">
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
