"use client";

import { useEffect, useRef, useState } from "react";

interface SearchBarProps {
  onSearch: (query: string) => void;
  resultCount: number;
  totalCount: number;
}

export default function SearchBar({
  onSearch,
  resultCount,
  totalCount,
}: SearchBarProps) {
  const [value, setValue] = useState("");
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(null);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      onSearch(value);
    }, 200);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [value, onSearch]);

  return (
    <form
      className="w-full"
      role="search"
      onSubmit={(event) => {
        event.preventDefault();
        onSearch(value);
      }}
    >
      <label htmlFor="exercise-search" className="sr-only">
        Search exercises
      </label>
      <div className="relative flex min-h-14 overflow-hidden rounded-lg border border-white/15 bg-[#111313]/90 shadow-2xl shadow-black/30 transition focus-within:border-orange-400 focus-within:ring-2 focus-within:ring-orange-500/30">
        <svg
          aria-hidden="true"
          className="absolute left-5 top-1/2 h-6 w-6 -translate-y-1/2 text-stone-300"
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
          onChange={(e) => setValue(e.target.value)}
          placeholder="Search exercises, muscles, equipment, creators..."
          className="min-w-0 flex-1 bg-transparent py-4 pl-14 pr-11 text-base font-medium text-stone-50 outline-none placeholder:text-stone-500 sm:text-lg"
        />
        {value && (
          <button
            type="button"
            aria-label="Clear search"
            onClick={() => setValue("")}
            className="absolute right-32 top-1/2 -translate-y-1/2 rounded-md p-1 text-stone-500 transition hover:bg-white/10 hover:text-orange-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-400 max-sm:right-4"
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
          className="hidden min-w-32 items-center justify-center bg-orange-500 px-6 text-base font-bold text-white transition hover:bg-orange-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-4px] focus-visible:outline-orange-100 sm:inline-flex"
        >
          Search
        </button>
      </div>
      <p className="sr-only" aria-live="polite">
        {value
          ? `${resultCount} result${resultCount !== 1 ? "s" : ""} found`
          : `${totalCount} exercises`}
      </p>
    </form>
  );
}
