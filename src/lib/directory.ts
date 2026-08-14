import "server-only";

import coachingJson from "@/data/coaching.json";
import exercisesJson from "@/data/exercises.json";
import {
  CATEGORY_LABELS,
  type CoachingResource,
  type DirectoryCreatorSummary,
  type DirectoryFilterOption,
  type DirectoryFilterOptions,
  type DirectoryItemSummary,
  type DirectoryQuery,
  type DirectoryResponse,
  type DirectorySection,
  type DirectoryStats,
  type GroupedExercise,
  type Video,
} from "./types";
import { DIRECTORY_PAGE_SIZE } from "./query";
import {
  createCoachingSearchIndex,
  createSearchIndex,
  searchCoachingWithMatches,
  searchExercisesWithMatches,
  type SearchResult,
} from "./search";

const exercises = exercisesJson as GroupedExercise[];
const coachingResources = coachingJson as CoachingResource[];

const exerciseSearch = createSearchIndex(exercises);
const coachingSearch = createCoachingSearchIndex(coachingResources);

const SOURCE_LABELS: Record<Video["source"], string> = {
  instagram: "Instagram",
  tiktok: "TikTok",
};

const TOPIC_LABELS: Record<string, string> = {
  "movement-technique": "Movement technique",
  "class-delivery": "Class delivery",
  programming: "Programming",
  "safety-and-modifications": "Safety and modifications",
};

function humanize(value: string): string {
  return value
    .replace(/[_-]/g, " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function option(value: string, label?: string): DirectoryFilterOption {
  return { value, label: label ?? humanize(value) };
}

function sortedOptions(
  values: Iterable<string>,
  labels: Record<string, string> = {}
): DirectoryFilterOption[] {
  return Array.from(new Set(values))
    .map((value) => option(value, labels[value]))
    .sort((a, b) => a.label.localeCompare(b.label));
}

function uniqueCreators(videos: Video[]): DirectoryCreatorSummary[] {
  const creators = new Map<string, DirectoryCreatorSummary>();
  for (const video of videos) {
    creators.set(video.creator.id, {
      id: video.creator.id,
      display_name: video.creator.display_name,
    });
  }
  return Array.from(creators.values()).sort((a, b) =>
    a.display_name.localeCompare(b.display_name)
  );
}

function creatorOptions(section: DirectorySection): DirectoryCreatorSummary[] {
  const videos =
    section === "coaching"
      ? coachingResources.flatMap((resource) => resource.videos)
      : exercises.flatMap((exercise) => exercise.videos);
  return uniqueCreators(videos);
}

function filterOptions(section: DirectorySection): DirectoryFilterOptions {
  if (section === "coaching") {
    return {
      categories: [],
      muscles: [],
      equipment: [],
      sources: sortedOptions(
        coachingResources.flatMap((resource) =>
          resource.videos.map((video) => video.source)
        ),
        SOURCE_LABELS
      ),
      creators: creatorOptions(section),
      topics: sortedOptions(
        coachingResources.map((resource) => resource.topic),
        TOPIC_LABELS
      ),
    };
  }

  return {
    categories: sortedOptions(
      exercises.map((exercise) => exercise.category),
      CATEGORY_LABELS
    ),
    muscles: sortedOptions(
      exercises.flatMap((exercise) => exercise.muscle_groups)
    ),
    equipment: sortedOptions(
      exercises.flatMap((exercise) => exercise.equipment)
    ),
    sources: sortedOptions(
      exercises.flatMap((exercise) =>
        exercise.videos.map((video) => video.source)
      ),
      SOURCE_LABELS
    ),
    creators: creatorOptions(section),
    topics: [],
  };
}

function canonicalValues(
  values: string[],
  options: DirectoryFilterOption[]
): string[] {
  const canonical = new Map(
    options.map((entry) => [entry.value.toLocaleLowerCase("en-US"), entry.value])
  );
  const result = new Set<string>();

  for (const value of values) {
    const match = canonical.get(value.toLocaleLowerCase("en-US"));
    if (match) result.add(match);
  }

  return Array.from(result);
}

function canonicalCreators(
  values: string[],
  creators: DirectoryCreatorSummary[]
): string[] {
  const canonical = new Map(
    creators.map((creator) => [
      creator.id.toLocaleLowerCase("en-US"),
      creator.id,
    ])
  );
  const result = new Set<string>();

  for (const value of values) {
    const match = canonical.get(value.toLocaleLowerCase("en-US"));
    if (match) result.add(match);
  }

  return Array.from(result);
}

function canonicalQuery(
  query: DirectoryQuery,
  options: DirectoryFilterOptions
): DirectoryQuery {
  const common = {
    ...query,
    sources: canonicalValues(query.sources, options.sources),
    creators: canonicalCreators(query.creators, options.creators),
  };

  if (query.section === "coaching") {
    return {
      ...common,
      categories: [],
      muscles: [],
      equipment: [],
      topics: canonicalValues(query.topics, options.topics),
    };
  }

  return {
    ...common,
    categories: canonicalValues(query.categories, options.categories),
    muscles: canonicalValues(query.muscles, options.muscles),
    equipment: canonicalValues(query.equipment, options.equipment),
    topics: [],
  };
}

function includesAny(values: string[], active: string[]): boolean {
  return active.length === 0 || active.some((value) => values.includes(value));
}

function filterExerciseResults(
  results: SearchResult<GroupedExercise>[],
  query: DirectoryQuery
): SearchResult<GroupedExercise>[] {
  return results.filter(({ item }) => {
    if (!includesAny([item.category], query.categories)) return false;
    if (!includesAny(item.muscle_groups, query.muscles)) return false;
    if (!includesAny(item.equipment, query.equipment)) return false;
    if (
      !includesAny(
        item.videos.map((video) => video.source),
        query.sources
      )
    )
      return false;
    if (
      !includesAny(
        item.videos.map((video) => video.creator.id),
        query.creators
      )
    )
      return false;
    return true;
  });
}

function filterCoachingResults(
  results: SearchResult<CoachingResource>[],
  query: DirectoryQuery
): SearchResult<CoachingResource>[] {
  return results.filter(({ item }) => {
    if (!includesAny([item.topic], query.topics)) return false;
    if (
      !includesAny(
        item.videos.map((video) => video.source),
        query.sources
      )
    )
      return false;
    if (
      !includesAny(
        item.videos.map((video) => video.creator.id),
        query.creators
      )
    )
      return false;
    return true;
  });
}

function localThumbnail(videos: Video[]): string | null {
  return (
    videos.find(
      (video) => video.thumbnail && video.thumbnail.startsWith("/")
    )?.thumbnail ?? null
  );
}

function exerciseSummary(
  result: SearchResult<GroupedExercise>
): DirectoryItemSummary {
  const { item, matchedBy } = result;
  return {
    id: item.id,
    kind: "exercise",
    title: item.exercise_name,
    classification: item.category,
    classificationLabel: CATEGORY_LABELS[item.category] ?? humanize(item.category),
    muscleGroups: item.muscle_groups,
    equipment: item.equipment,
    thumbnail: localThumbnail(item.videos),
    videoCount: item.videos.length,
    sources: Array.from(new Set(item.videos.map((video) => video.source))),
    creators: uniqueCreators(item.videos),
    matchedBy,
  };
}

function coachingSummary(
  result: SearchResult<CoachingResource>
): DirectoryItemSummary {
  const { item, matchedBy } = result;
  return {
    id: item.id,
    kind: "coaching",
    title: item.title,
    classification: item.topic,
    classificationLabel: TOPIC_LABELS[item.topic] ?? humanize(item.topic),
    muscleGroups: [],
    equipment: [],
    thumbnail: localThumbnail(item.videos),
    videoCount: item.videos.length,
    sources: Array.from(new Set(item.videos.map((video) => video.source))),
    creators: uniqueCreators(item.videos),
    matchedBy,
  };
}

export function getDirectoryStats(section: DirectorySection): DirectoryStats {
  const resources = section === "coaching" ? coachingResources : exercises;
  const videos = resources.flatMap((resource) => resource.videos);
  return {
    items: resources.length,
    videos: videos.length,
    creators: uniqueCreators(videos).length,
  };
}

export function getDirectoryResponse(
  requestedQuery: DirectoryQuery,
  maximumPages = requestedQuery.page,
  mode: "accumulated" | "window" = "accumulated",
): DirectoryResponse {
  const options = filterOptions(requestedQuery.section);
  const query = canonicalQuery(requestedQuery, options);

  const summaries =
    query.section === "coaching"
      ? filterCoachingResults(
          searchCoachingWithMatches(
            coachingSearch,
            coachingResources,
            query.q
          ),
          query
        ).map(coachingSummary)
      : filterExerciseResults(
          searchExercisesWithMatches(exerciseSearch, exercises, query.q),
          query
        ).map(exerciseSummary);

  const availablePages = Math.max(
    1,
    Math.ceil(summaries.length / DIRECTORY_PAGE_SIZE)
  );
  const loadedPage = Math.max(
    1,
    Math.min(query.page, maximumPages, availablePages)
  );
  const normalizedQuery = { ...query, page: loadedPage };
  const startIndex =
    mode === "window" ? (loadedPage - 1) * DIRECTORY_PAGE_SIZE : 0;
  const visibleItems = summaries.slice(
    startIndex,
    loadedPage * DIRECTORY_PAGE_SIZE,
  );
  return {
    items: visibleItems,
    accumulated: mode === "accumulated" || loadedPage === 1,
    total: summaries.length,
    page: loadedPage,
    pageSize: DIRECTORY_PAGE_SIZE,
    hasMore: loadedPage * DIRECTORY_PAGE_SIZE < summaries.length,
    query: normalizedQuery,
    filterOptions: options,
    stats: getDirectoryStats(query.section),
  };
}
