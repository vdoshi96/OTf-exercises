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
    <div className="w-full">
      <label htmlFor="exercise-search" className="sr-only">
        Search exercises
      </label>
      <div className="relative">
        <svg
          aria-hidden="true"
          className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-orange-300"
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
          className="w-full rounded-lg border border-orange-950/80 bg-[#120d0a] py-4 pl-12 pr-12 text-base text-stone-50 shadow-sm shadow-black/30 outline-none transition placeholder:text-stone-600 focus:border-orange-400 focus:ring-2 focus:ring-orange-500/35"
        />
        {value && (
          <button
            type="button"
            aria-label="Clear search"
            onClick={() => setValue("")}
            className="absolute right-4 top-1/2 -translate-y-1/2 rounded-md p-1 text-stone-500 transition hover:bg-orange-500/10 hover:text-orange-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-400"
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
      </div>
      <p className="mt-2 text-sm text-stone-500">
        {value
          ? `${resultCount} result${resultCount !== 1 ? "s" : ""} found`
          : `${totalCount} exercises`}
      </p>
    </div>
  );
}
