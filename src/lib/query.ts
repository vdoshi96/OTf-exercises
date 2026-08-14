import type { DirectoryQuery, DirectorySection } from "./types";

export const DIRECTORY_PAGE_SIZE = 24;
export const DIRECTORY_QUERY_MAX_LENGTH = 100;
const MAX_PAGE = 100;

export type DirectorySearchParams = Record<
  string,
  string | string[] | undefined
>;

type QueryInput = URLSearchParams | DirectorySearchParams;

const REPEATED_PARAM_KEYS = [
  "category",
  "muscle",
  "equipment",
  "source",
  "creator",
  "topic",
] as const;

function valuesFor(input: QueryInput, key: string): string[] {
  if (input instanceof URLSearchParams) return input.getAll(key);

  const value = input[key];
  if (Array.isArray(value)) return value;
  return typeof value === "string" ? [value] : [];
}

function normalizeRepeated(values: string[]): string[] {
  const normalized = new Map<string, string>();

  for (const value of values) {
    const trimmed = value.trim();
    if (!trimmed) continue;
    const key = trimmed.toLocaleLowerCase("en-US");
    if (!normalized.has(key)) normalized.set(key, trimmed);
  }

  return Array.from(normalized.values());
}

function firstValue(input: QueryInput, key: string): string | undefined {
  return valuesFor(input, key)[0];
}

function normalizePage(value: string | undefined): number {
  if (!value || !/^[1-9]\d*$/.test(value)) return 1;
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed)) return 1;
  return Math.min(parsed, MAX_PAGE);
}

export function parseDirectoryQuery(
  input: QueryInput,
  section: DirectorySection
): DirectoryQuery {
  const q = (firstValue(input, "q") ?? "")
    .trim()
    .replace(/\s+/g, " ")
    .slice(0, DIRECTORY_QUERY_MAX_LENGTH);

  return {
    section,
    q,
    categories: normalizeRepeated(valuesFor(input, "category")),
    muscles: normalizeRepeated(valuesFor(input, "muscle")),
    equipment: normalizeRepeated(valuesFor(input, "equipment")),
    sources: normalizeRepeated(valuesFor(input, "source")),
    creators: normalizeRepeated(valuesFor(input, "creator")),
    topics: normalizeRepeated(valuesFor(input, "topic")),
    page: normalizePage(firstValue(input, "page")),
  };
}

export function serializeDirectoryQuery(query: DirectoryQuery): URLSearchParams {
  const params = new URLSearchParams();

  if (query.q) params.set("q", query.q);

  const valuesByKey: Record<(typeof REPEATED_PARAM_KEYS)[number], string[]> = {
    category: query.categories,
    muscle: query.muscles,
    equipment: query.equipment,
    source: query.sources,
    creator: query.creators,
    topic: query.topics,
  };

  for (const key of REPEATED_PARAM_KEYS) {
    for (const value of normalizeRepeated(valuesByKey[key])) {
      params.append(key, value);
    }
  }

  if (query.page > 1) params.set("page", String(query.page));
  return params;
}

export function directoryQueryKey(query: DirectoryQuery): string {
  const params = serializeDirectoryQuery(query);
  params.set("section", query.section);
  return params.toString();
}

export function directoryPageHref(
  pathname: "/" | "/coaching",
  query: DirectoryQuery
): string {
  const serialized = serializeDirectoryQuery(query).toString();
  return serialized ? `${pathname}?${serialized}` : pathname;
}

export function directoryDetailHref(
  query: DirectoryQuery,
  id: string
): string {
  const pathname =
    query.section === "coaching" ? `/coaching/${id}` : `/exercise/${id}`;
  const serialized = serializeDirectoryQuery(query).toString();
  return serialized ? `${pathname}?${serialized}` : pathname;
}

export function directoryApiHref(query: DirectoryQuery): string {
  const params = serializeDirectoryQuery(query);
  params.set("section", query.section);
  return `/api/directory?${params.toString()}`;
}
