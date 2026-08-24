"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import type {
  DirectoryItemSummary,
  DirectoryQuery,
  GroupedExercise,
} from "@/lib/types";
import { directoryDetailHref } from "@/lib/query";
import ExercisePlaceholder from "./ExercisePlaceholder";

function summarizeList(items: string[], limit: number): string {
  if (items.length === 0) return "Equipment not specified";
  if (items.length <= limit) return items.join(", ");

  return `${items.slice(0, limit).join(", ")} +${items.length - limit}`;
}

interface ExerciseCardProps {
  item: DirectoryItemSummary;
  query: DirectoryQuery;
}

export default function ExerciseCard({
  item,
  query,
}: ExerciseCardProps) {
  const [thumbnailError, setThumbnailError] = useState(false);
  const sources = new Set(item.sources);
  const creatorSummary =
    item.creators.length === 0
      ? "Creator pending"
      : item.creators.length === 1
        ? item.creators[0].display_name
        : `${item.creators.length} creators`;

  return (
    <Link
      href={directoryDetailHref(query, item.id)}
      data-testid="exercise-card"
      className="group flex h-full min-h-36 flex-row overflow-hidden rounded-lg border border-white/15 bg-[#101111] shadow-xl shadow-black/20 transition duration-200 hover:border-orange-500/50 hover:shadow-orange-950/25 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-orange-400 sm:flex-col sm:hover:-translate-y-1"
    >
      <div className="relative w-[40%] max-w-40 shrink-0 overflow-hidden bg-[#151616] sm:aspect-[16/11] sm:w-full sm:max-w-none">
        {item.thumbnail && !thumbnailError ? (
          <Image
            src={item.thumbnail}
            alt={item.title}
            fill
            sizes="(max-width: 639px) 40vw, (min-width: 1280px) 25vw, (min-width: 1024px) 33vw, 50vw"
            loading="lazy"
            onError={() => setThumbnailError(true)}
            className="object-cover transition duration-300 group-hover:scale-105"
          />
        ) : (
          <ExercisePlaceholder
            category={
              item.kind === "exercise"
                ? (item.classification as GroupedExercise["category"])
                : "other"
            }
            exerciseName={item.title}
            muscleGroups={item.muscleGroups}
          />
        )}

        <div className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-black/90 to-transparent sm:h-24" />

        <div className="absolute left-2 top-2 flex flex-wrap gap-2 sm:left-3 sm:top-3">
          <span className="rounded-md border border-orange-500/40 bg-black/70 px-2 py-1 text-[10px] font-bold uppercase text-orange-400 shadow-sm shadow-black/30 backdrop-blur-sm sm:px-2.5 sm:text-xs">
            {item.classificationLabel}
          </span>
        </div>

        <div className="absolute right-2 top-2 hidden sm:right-3 sm:top-3 sm:block">
          <span className="rounded-md border border-white/15 bg-black/70 px-2 py-1 text-[10px] font-bold uppercase text-stone-100 backdrop-blur-sm sm:px-2.5 sm:text-xs">
            {item.videoCount} video{item.videoCount === 1 ? "" : "s"}
          </span>
        </div>

        <div className="absolute inset-x-2 bottom-2 flex items-center justify-between gap-2 sm:inset-x-3 sm:bottom-3 sm:gap-3">
          <span className="min-w-0 truncate text-[11px] font-semibold text-stone-100 sm:text-sm">
            {creatorSummary}
          </span>
          <span className="hidden shrink-0 gap-1.5 sm:flex">
            {sources.has("tiktok") && (
              <span
                aria-label="TikTok"
                className="flex h-7 w-7 items-center justify-center rounded-md border border-white/10 bg-black/70 text-stone-200 backdrop-blur-sm"
              >
                <svg
                  aria-hidden="true"
                  className="h-3.5 w-3.5"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                >
                  <path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.89-2.89 2.89 2.89 0 012.89-2.89c.28 0 .54.04.79.1V9.01a6.27 6.27 0 00-.79-.05 6.34 6.34 0 00-6.34 6.34 6.34 6.34 0 006.34 6.34 6.34 6.34 0 006.34-6.34V8.75a8.18 8.18 0 004.76 1.52V6.84a4.84 4.84 0 01-1-.15z" />
                </svg>
              </span>
            )}
            {sources.has("instagram") && (
              <span
                aria-label="Instagram"
                className="flex h-7 w-7 items-center justify-center rounded-md border border-white/10 bg-black/70 text-stone-200 backdrop-blur-sm"
              >
                <svg
                  aria-hidden="true"
                  className="h-3.5 w-3.5"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                >
                  <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z" />
                </svg>
              </span>
            )}
          </span>
        </div>
      </div>

      <div className="flex min-w-0 flex-1 flex-col gap-2 p-3 sm:gap-3 sm:p-4">
        <div>
          <h3 className="line-clamp-3 text-base font-bold leading-tight text-stone-50 transition group-hover:text-orange-200 sm:line-clamp-2 sm:text-xl">
            {item.title}
          </h3>
          {item.matchedBy.length > 0 && (
            <p className="mt-1 line-clamp-1 text-[11px] font-semibold text-[var(--signal)] sm:text-xs">
              Matched: {item.matchedBy.join(", ")}
            </p>
          )}
        </div>

        <div className="flex flex-wrap gap-1 sm:gap-1.5">
          {item.muscleGroups.slice(0, 3).map((mg, index) => (
            <span
              key={mg}
              className={`rounded-md border border-white/10 bg-[#181919] px-2 py-1 text-[10px] font-medium text-stone-300 sm:px-2.5 sm:py-1.5 sm:text-xs ${
                index === 2 ? "max-sm:hidden" : ""
              }`}
            >
              {mg}
            </span>
          ))}
          {item.muscleGroups.length > 3 && (
            <span className="rounded-md border border-white/10 bg-[#181919] px-2 py-1 text-[10px] font-medium text-stone-500 sm:px-2.5 sm:py-1.5 sm:text-xs">
              +{item.muscleGroups.length - 3}
            </span>
          )}
        </div>

        <p className="mt-auto flex items-center gap-1.5 border-t border-white/10 pt-2 text-xs leading-5 text-stone-400 sm:gap-2 sm:pt-3 sm:text-sm">
          <svg
            aria-hidden="true"
            className="h-4 w-4 shrink-0 text-[var(--signal)]"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M6 12h12M8 8v8m8-8v8M4 10v4m16-4v4"
            />
          </svg>
          {item.kind === "coaching"
            ? "Coaching resource"
            : summarizeList(item.equipment, 2)}
        </p>
      </div>
    </Link>
  );
}
