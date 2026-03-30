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
      <div className="relative">
        <svg
          className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-zinc-500"
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
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Search exercises, muscle groups, equipment..."
          className="w-full rounded-xl border border-zinc-700/50 bg-zinc-900/80 py-3.5 pl-12 pr-4 text-zinc-100 placeholder-zinc-500 outline-none ring-orange-500/40 backdrop-blur-sm transition focus:border-orange-500/50 focus:ring-2"
        />
        {value && (
          <button
            onClick={() => setValue("")}
            className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>
      <p className="mt-2 text-sm text-zinc-500">
        {value
          ? `${resultCount} result${resultCount !== 1 ? "s" : ""} found`
          : `${totalCount} exercises`}
      </p>
    </div>
  );
}
