"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import type { DirectoryQuery, DirectoryResponse } from "@/lib/types";
import {
  DIRECTORY_QUERY_MAX_LENGTH,
  directoryApiHref,
  directoryPageHref,
  directoryQueryKey,
  parseDirectoryQuery,
} from "@/lib/query";
import ExerciseCard from "./ExerciseCard";
import FilterPanel, { type DirectoryFilterKey } from "./FilterPanel";
import SearchBar from "./SearchBar";

interface ExerciseGridProps {
  initialResponse: DirectoryResponse;
  pathname: "/" | "/coaching";
}

interface RequestError {
  key: string;
  message: string;
}

function toggleValue(values: string[], value: string): string[] {
  return values.includes(value)
    ? values.filter((candidate) => candidate !== value)
    : [...values, value];
}

function isDirectoryResponse(value: unknown): value is DirectoryResponse {
  if (!value || typeof value !== "object") return false;
  const response = value as Partial<DirectoryResponse>;
  return (
    Array.isArray(response.items) &&
    typeof response.accumulated === "boolean" &&
    typeof response.total === "number" &&
    typeof response.page === "number" &&
    typeof response.hasMore === "boolean" &&
    Boolean(response.query) &&
    Boolean(response.filterOptions)
  );
}

function requestErrorMessage() {
  if (typeof navigator !== "undefined" && !navigator.onLine) {
    return "You're offline. Check your connection and try again.";
  }
  return "We couldn't update the directory. Try again.";
}

export default function ExerciseGrid({
  initialResponse,
  pathname,
}: ExerciseGridProps) {
  const searchParams = useSearchParams();
  const serializedSearchParams = searchParams.toString();
  const queryFromUrl = useMemo(
    () =>
      parseDirectoryQuery(
        new URLSearchParams(serializedSearchParams),
        initialResponse.query.section,
      ),
    [initialResponse.query.section, serializedSearchParams],
  );
  const queryKey = directoryQueryKey(queryFromUrl);

  const [response, setResponse] = useState(initialResponse);
  const [searchDraft, setSearchDraft] = useState({
    sourceQuery: queryFromUrl.q,
    value: queryFromUrl.q,
  });
  const [requestError, setRequestError] = useState<RequestError | null>(null);
  const [retryNonce, setRetryNonce] = useState(0);
  const requestSequence = useRef(0);
  const loadMoreRef = useRef<HTMLAnchorElement>(null);
  const pendingAppendStart = useRef<number | null>(null);
  const responseKey = directoryQueryKey(response.query);
  const draftQuery =
    searchDraft.sourceQuery === queryFromUrl.q
      ? searchDraft.value
      : queryFromUrl.q;
  const needsRequest =
    !response.accumulated ||
    responseKey !== queryKey ||
    response.page < queryFromUrl.page;
  const hasCurrentError = requestError?.key === queryKey;
  const isLoading = needsRequest && !hasCurrentError;
  // A deep no-JavaScript page is intentionally a bounded server window. It
  // still needs an accumulated API response after hydration, but the HTML
  // must not announce a permanent busy/disabled state before JavaScript runs.
  const isInteractiveRequestLoading = isLoading && response.accumulated;

  const writeQuery = useCallback(
    (query: DirectoryQuery, mode: "push" | "replace") => {
      const href = directoryPageHref(pathname, query);
      if (mode === "push") window.history.pushState(null, "", href);
      else window.history.replaceState(null, "", href);
    },
    [pathname],
  );

  useEffect(() => {
    const normalizedDraft = draftQuery
      .trim()
      .replace(/\s+/g, " ")
      .slice(0, DIRECTORY_QUERY_MAX_LENGTH);
    if (normalizedDraft === queryFromUrl.q) return;

    const timeout = window.setTimeout(() => {
      writeQuery({ ...queryFromUrl, q: normalizedDraft, page: 1 }, "replace");
    }, 250);
    return () => window.clearTimeout(timeout);
  }, [draftQuery, queryFromUrl, writeQuery]);

  useEffect(() => {
    const sequence = ++requestSequence.current;
    if (
      response.accumulated &&
      responseKey === queryKey &&
      response.page === queryFromUrl.page
    ) {
      return;
    }

    const controller = new AbortController();

    void fetch(directoryApiHref(queryFromUrl), {
      method: "GET",
      headers: { Accept: "application/json" },
      signal: controller.signal,
    })
      .then(async (apiResponse) => {
        if (!apiResponse.ok) {
          throw new Error(`Directory request failed (${apiResponse.status})`);
        }
        const payload: unknown = await apiResponse.json();
        if (!isDirectoryResponse(payload)) {
          throw new Error("Directory response was incomplete");
        }
        return payload;
      })
      .then((payload) => {
        if (controller.signal.aborted || sequence !== requestSequence.current)
          return;

        setResponse(payload);
        setRequestError(null);

        const canonicalHref = directoryPageHref(pathname, payload.query);
        const currentHref = `${window.location.pathname}${window.location.search}`;
        if (canonicalHref !== currentHref) {
          window.history.replaceState(null, "", canonicalHref);
        }
      })
      .catch(() => {
        if (controller.signal.aborted || sequence !== requestSequence.current)
          return;
        setRequestError({ key: queryKey, message: requestErrorMessage() });
      });

    return () => controller.abort();
  }, [
    pathname,
    queryFromUrl,
    queryKey,
    response.accumulated,
    response.page,
    responseKey,
    retryNonce,
  ]);

  useEffect(() => {
    const appendedAt = pendingAppendStart.current;
    if (appendedAt === null || isLoading || !response.accumulated) return;

    if (response.hasMore) {
      loadMoreRef.current?.focus();
    } else {
      const appendedCard = document.querySelectorAll<HTMLElement>(
        "[data-testid='exercise-card']",
      )[appendedAt];
      appendedCard?.focus();
    }
    pendingAppendStart.current = null;
  }, [
    isLoading,
    response.accumulated,
    response.hasMore,
    response.items.length,
  ]);

  const submitSearch = () => {
    writeQuery(
      {
        ...queryFromUrl,
        q: draftQuery
          .trim()
          .replace(/\s+/g, " ")
          .slice(0, DIRECTORY_QUERY_MAX_LENGTH),
        page: 1,
      },
      "replace",
    );
  };

  const clearSearch = () => {
    setSearchDraft({ sourceQuery: queryFromUrl.q, value: "" });
    writeQuery({ ...queryFromUrl, q: "", page: 1 }, "replace");
  };

  const toggleFilter = (key: DirectoryFilterKey, value: string) => {
    writeQuery(
      {
        ...queryFromUrl,
        [key]: toggleValue(queryFromUrl[key], value),
        page: 1,
      },
      "push",
    );
  };

  const clearFilters = () => {
    writeQuery(
      {
        ...queryFromUrl,
        categories: [],
        muscles: [],
        equipment: [],
        sources: [],
        creators: [],
        topics: [],
        page: 1,
      },
      "push",
    );
  };

  const loadMore = () => {
    pendingAppendStart.current = response.items.length;
    writeQuery({ ...queryFromUrl, page: queryFromUrl.page + 1 }, "push");
  };

  const visibleCount = response.items.length;
  const formattedTotal = response.total.toLocaleString();
  const itemLabel =
    response.query.section === "coaching" ? "resources" : "exercises";
  const hasSearchQuery = queryFromUrl.q.length > 0;
  const hasActiveFilters = [
    queryFromUrl.categories,
    queryFromUrl.muscles,
    queryFromUrl.equipment,
    queryFromUrl.sources,
    queryFromUrl.creators,
    queryFromUrl.topics,
  ].some((values) => values.length > 0);

  const shortcutGroup =
    response.query.section === "coaching" ? "topics" : "equipment";
  const shortcuts =
    response.query.section === "coaching"
      ? [
          { value: "movement-technique", label: "Movement technique" },
          { value: "programming", label: "Programming" },
          { value: "safety-and-modifications", label: "Modifications" },
        ]
      : [
          { value: "dumbbell", label: "Dumbbells" },
          { value: "TRX straps", label: "TRX straps" },
          { value: "rower", label: "Rower" },
          { value: "treadmill", label: "Treadmill" },
        ];

  return (
    <>
      <section className="directory-search">
        <div className="page-width">
          <div className="search-width">
            <div className="min-w-[min(100%,16rem)] flex-1">
              <SearchBar
                value={draftQuery}
                onChange={(value) =>
                  setSearchDraft({ sourceQuery: queryFromUrl.q, value })
                }
                onSubmit={submitSearch}
                onClear={clearSearch}
                resultCount={response.total}
                totalCount={response.stats.items}
                isLoading={isInteractiveRequestLoading}
                itemNoun={
                  response.query.section === "coaching"
                    ? "coaching resources"
                    : "exercises"
                }
              />
            </div>
          </div>
          <nav
            className="browse-shortcuts"
            aria-label={
              response.query.section === "coaching"
                ? "Browse coaching topics"
                : "Browse by equipment"
            }
          >
            <span>
              {response.query.section === "coaching"
                ? "Explore:"
                : "Browse by equipment:"}
            </span>
            {shortcuts.map(({ value, label }) => (
              <a
                key={value}
                href={directoryPageHref(pathname, {
                  ...queryFromUrl,
                  [shortcutGroup]: toggleValue(
                    queryFromUrl[shortcutGroup],
                    value,
                  ),
                  page: 1,
                })}
                aria-current={
                  queryFromUrl[shortcutGroup].includes(value)
                    ? "true"
                    : undefined
                }
                onClick={(event) => {
                  if (
                    event.metaKey ||
                    event.ctrlKey ||
                    event.shiftKey ||
                    event.altKey
                  )
                    return;
                  event.preventDefault();
                  toggleFilter(shortcutGroup, value);
                }}
              >
                {label}
              </a>
            ))}
          </nav>
        </div>
      </section>

      <div className="page-width directory-layout">
        <div className="filter-rail">
          <FilterPanel
            section={response.query.section}
            options={response.filterOptions}
            query={queryFromUrl}
            resultCount={response.total}
            onToggle={toggleFilter}
            onClear={clearFilters}
          />
        </div>

        <section
          id="directory"
          aria-busy={isInteractiveRequestLoading}
          className="directory-results"
        >
          <div className="mb-3 flex flex-wrap items-end justify-between gap-2 sm:mb-4">
            <h2 className="sr-only">
              {response.query.section === "coaching"
                ? "Coaching resources"
                : "Exercise reference"}
            </h2>
            <p
              className="mt-3 text-sm font-medium text-muted"
              aria-live="polite"
            >
              Showing{" "}
              <span className="font-semibold text-ink">
                {visibleCount.toLocaleString()}
              </span>{" "}
              of {formattedTotal} matching {itemLabel}
            </p>
            {isInteractiveRequestLoading && (
              <span
                className="t-shimmer directory-loading-label text-xs font-semibold"
                data-text="Updating…"
                role="status"
              >
                Updating…
              </span>
            )}
          </div>

          {hasCurrentError && (
            <div
              className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-red-400/30 bg-red-500/10 p-4 text-sm text-red-900"
              role="alert"
            >
              <span>{requestError.message}</span>
              <button
                type="button"
                onClick={() => {
                  setRequestError(null);
                  setRetryNonce((value) => value + 1);
                }}
                className="min-h-12 rounded-md border border-red-300/40 px-4 font-semibold transition hover:bg-red-300/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-800"
              >
                Try again
              </button>
            </div>
          )}

          {response.items.length === 0 ? (
            <div
              data-testid="empty-results"
              className="rounded-lg border border-line bg-white px-6 py-20 text-center"
            >
              <p className="text-lg font-semibold text-ink">No results found</p>
              <p className="mt-1 text-sm text-muted">
                Try adjusting your search or filters
              </p>
              {(hasSearchQuery || hasActiveFilters) && (
                <div className="mt-5 flex flex-wrap justify-center gap-3">
                  {hasSearchQuery && (
                    <button
                      type="button"
                      onClick={clearSearch}
                      className="min-h-12 rounded-md bg-accent px-4 text-sm font-bold text-white transition hover:bg-orange-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-orange-300"
                    >
                      Reset search
                    </button>
                  )}
                  {hasActiveFilters && (
                    <button
                      type="button"
                      onClick={clearFilters}
                      className="min-h-12 rounded-md border border-line px-4 text-sm font-bold text-ink transition hover:border-orange-500/50 hover:text-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-orange-400"
                    >
                      Clear filters
                    </button>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div
              className={`result-grid ${response.query.section === "coaching" ? "coaching-results" : ""}`}
            >
              {response.items.map((item) => (
                <ExerciseCard key={item.id} item={item} query={queryFromUrl} />
              ))}
            </div>
          )}

          {response.hasMore && (
            <div className="flex justify-center py-8">
              <a
                ref={loadMoreRef}
                href={`${directoryPageHref(pathname, {
                  ...queryFromUrl,
                  page: queryFromUrl.page + 1,
                })}#directory`}
                aria-disabled={isInteractiveRequestLoading || undefined}
                onClick={(event) => {
                  if (isLoading && !response.accumulated) return;
                  event.preventDefault();
                  if (!isLoading) loadMore();
                }}
                className="inline-flex min-h-12 items-center justify-center rounded-md border border-orange-500/50 bg-accent-soft px-6 py-3 text-sm font-bold text-black transition hover:bg-orange-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-orange-400 aria-disabled:cursor-wait aria-disabled:opacity-60"
              >
                Load{" "}
                {Math.min(
                  response.pageSize,
                  response.total - response.page * response.pageSize,
                )}{" "}
                more
              </a>
            </div>
          )}
        </section>
      </div>
    </>
  );
}
