"use client";

import { useMemo, useRef, useState } from "react";
import type {
  DirectoryFilterOption,
  DirectoryFilterOptions,
  DirectoryQuery,
  DirectorySection,
} from "@/lib/types";

export type DirectoryFilterKey =
  | "categories"
  | "muscles"
  | "equipment"
  | "sources"
  | "creators"
  | "topics";

interface FilterPanelProps {
  section: DirectorySection;
  options: DirectoryFilterOptions;
  query: DirectoryQuery;
  resultCount: number;
  onToggle: (key: DirectoryFilterKey, value: string) => void;
  onClear: () => void;
}

interface ActiveFilter {
  key: string;
  label: string;
  onRemove: () => void;
}

interface FilterGroupConfig {
  key: DirectoryFilterKey;
  title: string;
  choices: DirectoryFilterOption[];
  active: string[];
  wide?: boolean;
}

function ChevronIcon({ open }: { open?: boolean }) {
  return (
    <svg
      aria-hidden="true"
      className={`h-4 w-4 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M19 9l-7 7-7-7"
      />
    </svg>
  );
}

function FilterIcon() {
  return (
    <svg
      aria-hidden="true"
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M3 5h18M7 12h10M10 19h4"
      />
    </svg>
  );
}

function CloseIcon() {
  return (
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
        d="M6 18 18 6M6 6l12 12"
      />
    </svg>
  );
}

function choiceLabel(group: DirectoryFilterKey, choice: DirectoryFilterOption) {
  if (choice.value.toLocaleLowerCase("en-US") !== "core") return choice.label;
  if (group === "categories") return "Category: Core";
  if (group === "muscles") return "Muscle: Core";
  return choice.label;
}

function Chip({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`min-h-11 max-w-full rounded-md border px-3 py-2 text-sm font-semibold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-400 ${
        active
          ? "border-orange-400/70 bg-orange-500/20 text-orange-100 shadow-sm shadow-orange-950/40"
          : "border-white/10 bg-[#161717] text-stone-300 hover:border-orange-500/50 hover:text-orange-100"
      }`}
    >
      <span className="break-words">{label}</span>
    </button>
  );
}

function ActiveFilterChip({ filter }: { filter: ActiveFilter }) {
  return (
    <span className="inline-flex max-w-full items-center gap-1.5 rounded-md border border-orange-500/35 bg-orange-500/15 px-2.5 py-1.5 text-sm font-semibold text-orange-100">
      <span className="break-words">{filter.label}</span>
      <button
        type="button"
        onClick={filter.onRemove}
        aria-label={`Remove ${filter.label} filter`}
        className="-my-2 -mr-2 flex min-h-11 min-w-11 items-center justify-center rounded-sm text-orange-200 transition hover:bg-orange-500/20 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-400 sm:my-0 sm:mr-0 sm:min-h-0 sm:min-w-0 sm:p-0.5"
      >
        <CloseIcon />
      </button>
    </span>
  );
}

function DesktopFilterGroups({
  groups,
  onToggle,
}: {
  groups: FilterGroupConfig[];
  onToggle: (key: DirectoryFilterKey, value: string) => void;
}) {
  return (
    <div className="grid gap-5 lg:grid-cols-2">
      {groups.map((group) => (
        <div key={group.key} className={group.wide ? "lg:col-span-2" : ""}>
          <h3 className="mb-2 text-xs font-bold uppercase text-stone-500">
            {group.title}
          </h3>
          <div
            className={
              group.wide
                ? "thin-scrollbar max-h-52 overflow-y-auto pr-1"
                : undefined
            }
          >
            <div className="flex flex-wrap gap-2">
              {group.choices.map((choice) => (
                <Chip
                  key={choice.value}
                  label={choiceLabel(group.key, choice)}
                  active={group.active.includes(choice.value)}
                  onClick={() => onToggle(group.key, choice.value)}
                />
              ))}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function MobileFilterGroups({
  groups,
  onToggle,
}: {
  groups: FilterGroupConfig[];
  onToggle: (key: DirectoryFilterKey, value: string) => void;
}) {
  return (
    <div className="divide-y divide-white/10">
      {groups.map((group) => (
        <details key={group.key} className="group/filter py-1">
          <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 rounded-md px-1 text-sm font-bold uppercase text-stone-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-400 [&::-webkit-details-marker]:hidden">
            <span className="flex items-center gap-2">
              {group.title}
              {group.active.length > 0 && (
                <span className="rounded-md bg-orange-500 px-1.5 py-0.5 text-xs text-black">
                  {group.active.length}
                </span>
              )}
            </span>
            <span className="transition-transform group-open/filter:rotate-180">
              <ChevronIcon />
            </span>
          </summary>
          <div className="flex flex-wrap gap-2 pb-4 pt-2">
            {group.choices.map((choice) => (
              <Chip
                key={choice.value}
                label={choiceLabel(group.key, choice)}
                active={group.active.includes(choice.value)}
                onClick={() => onToggle(group.key, choice.value)}
              />
            ))}
          </div>
        </details>
      ))}
    </div>
  );
}

export default function FilterPanel({
  section,
  options,
  query,
  resultCount,
  onToggle,
  onClear,
}: FilterPanelProps) {
  const [desktopPanelOpen, setDesktopPanelOpen] = useState(false);
  const mobileDialogRef = useRef<HTMLDialogElement>(null);
  const mobileTriggerRef = useRef<HTMLButtonElement>(null);
  const desktopTriggerRef = useRef<HTMLButtonElement>(null);

  const groups = useMemo<FilterGroupConfig[]>(() => {
    const creators = options.creators.map((creator) => ({
      value: creator.id,
      label: creator.display_name,
    }));

    if (section === "coaching") {
      return [
        { key: "topics", title: "Topic", choices: options.topics, active: query.topics },
        { key: "sources", title: "Source", choices: options.sources, active: query.sources },
        { key: "creators", title: "Creator", choices: creators, active: query.creators, wide: true },
      ];
    }

    return [
      { key: "categories", title: "Category", choices: options.categories, active: query.categories },
      { key: "muscles", title: "Muscle", choices: options.muscles, active: query.muscles },
      { key: "equipment", title: "Equipment", choices: options.equipment, active: query.equipment },
      { key: "sources", title: "Source", choices: options.sources, active: query.sources },
      { key: "creators", title: "Creator", choices: creators, active: query.creators, wide: true },
    ];
  }, [options, query, section]);

  const activeFilters = groups.flatMap<ActiveFilter>((group) =>
    group.active.map((value) => {
      const choice = group.choices.find((candidate) => candidate.value === value);
      return {
        key: `${group.key}-${value}`,
        label: `${group.title}: ${choice?.label ?? value}`,
        onRemove: () => onToggle(group.key, value),
      };
    })
  );
  const activeFilterCount = activeFilters.length;
  const hasFilters = activeFilterCount > 0;

  const closeMobileDialog = () => mobileDialogRef.current?.close();
  const restoreFilterTriggerFocus = () => {
    const mobileTrigger = mobileTriggerRef.current;
    const desktopTrigger = desktopTriggerRef.current;
    const mobileVisible =
      mobileTrigger && window.getComputedStyle(mobileTrigger).display !== "none";
    (mobileVisible ? mobileTrigger : desktopTrigger)?.focus();
  };

  return (
    <section
      className={
        "w-fit max-w-full max-sm:bg-transparent " +
        (desktopPanelOpen
          ? "sm:w-full sm:max-w-5xl sm:rounded-lg sm:border sm:border-white/10 sm:bg-[#101111]/90 sm:shadow-xl sm:shadow-black/20"
          : "sm:w-fit")
      }
    >
      <div
        className={
          "inline-flex max-w-full flex-wrap items-center gap-2 " +
          (desktopPanelOpen
            ? "sm:flex sm:flex-col sm:items-stretch sm:gap-3 sm:p-3"
            : "sm:inline-flex")
        }
      >
        <div className="flex flex-wrap items-center gap-2 sm:justify-between sm:gap-3">
          <button
            ref={mobileTriggerRef}
            type="button"
            onClick={() => mobileDialogRef.current?.showModal()}
            aria-haspopup="dialog"
            aria-controls="mobile-exercise-filters"
            className="inline-flex min-h-11 items-center gap-2 rounded-md border border-white/15 bg-[#181919] px-4 py-2 text-sm font-semibold text-stone-100 transition hover:border-orange-500/50 hover:text-orange-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-400 sm:hidden"
          >
            <FilterIcon />
            <span>Filters</span>
            {activeFilterCount > 0 && (
              <span className="rounded-md bg-orange-500 px-1.5 py-0.5 text-xs font-bold text-black">
                {activeFilterCount}
              </span>
            )}
          </button>

          <button
            ref={desktopTriggerRef}
            type="button"
            onClick={() => setDesktopPanelOpen((open) => !open)}
            aria-expanded={desktopPanelOpen}
            aria-controls="desktop-exercise-filters"
            className="hidden min-h-11 items-center gap-2 rounded-md border border-white/15 bg-[#181919] px-4 py-2 text-sm font-semibold text-stone-100 transition hover:border-orange-500/50 hover:text-orange-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-400 sm:inline-flex"
          >
            <FilterIcon />
            <span>Filters</span>
            {activeFilterCount > 0 && (
              <span className="rounded-md bg-orange-500 px-1.5 py-0.5 text-xs font-bold text-black">
                {activeFilterCount}
              </span>
            )}
            <ChevronIcon open={desktopPanelOpen} />
          </button>

          {hasFilters && (
            <button
              type="button"
              onClick={onClear}
              className="rounded-md px-2 py-1 text-sm font-semibold text-orange-300 transition hover:bg-orange-500/10 hover:text-orange-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-400"
            >
              Clear all
            </button>
          )}
        </div>

        {hasFilters && (
          <div
            aria-label="Active filters"
            className="flex min-w-0 flex-1 flex-wrap gap-2 sm:border-t sm:border-white/10 sm:pt-3"
          >
            {activeFilters.map((filter) => (
              <ActiveFilterChip key={filter.key} filter={filter} />
            ))}
          </div>
        )}
      </div>

      {desktopPanelOpen && (
        <div
          id="desktop-exercise-filters"
          className="animate-filter-panel hidden border-t border-white/10 p-4 sm:block"
        >
          <DesktopFilterGroups groups={groups} onToggle={onToggle} />
        </div>
      )}

      <dialog
        ref={mobileDialogRef}
        id="mobile-exercise-filters"
        aria-labelledby="mobile-filter-heading"
        onCancel={(event) => {
          event.preventDefault();
          closeMobileDialog();
        }}
        onClose={restoreFilterTriggerFocus}
        onClick={(event) => {
          if (event.target === event.currentTarget) closeMobileDialog();
        }}
        className="fixed inset-x-0 bottom-0 top-auto m-0 max-h-[88dvh] w-full max-w-none flex-col overflow-hidden rounded-t-2xl border border-white/15 bg-[#0b0c0c] p-0 text-stone-100 shadow-2xl shadow-black open:flex backdrop:bg-black/80 backdrop:backdrop-blur-sm sm:hidden"
      >
        <div className="flex shrink-0 items-center justify-between gap-4 border-b border-white/10 bg-[#101111] px-4 py-3">
          <div>
            <p className="text-xs font-bold uppercase text-orange-400">Refine directory</p>
            <h2 id="mobile-filter-heading" className="font-display display-tight mt-0.5 text-2xl font-semibold text-stone-50">
              Filters
            </h2>
          </div>
          <button
            type="button"
            onClick={closeMobileDialog}
            aria-label="Close filters"
            className="flex min-h-11 min-w-11 items-center justify-center rounded-md border border-white/10 bg-[#181919] text-stone-300 transition hover:border-orange-500/50 hover:text-orange-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-400"
          >
            <CloseIcon />
          </button>
        </div>

        <div className="thin-scrollbar min-h-0 flex-1 overflow-y-auto px-4 py-2">
          <MobileFilterGroups groups={groups} onToggle={onToggle} />
        </div>

        <div className="grid shrink-0 grid-cols-[0.8fr_1.2fr] gap-3 border-t border-white/10 bg-[#101111] p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
          <button
            type="button"
            onClick={onClear}
            disabled={!hasFilters}
            className="min-h-12 rounded-md border border-white/15 px-4 text-sm font-bold text-stone-200 transition hover:border-orange-500/50 hover:text-orange-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-400 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Clear
          </button>
          <button
            type="button"
            onClick={closeMobileDialog}
            className="min-h-12 rounded-md bg-orange-500 px-4 text-sm font-bold text-black transition hover:bg-orange-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-300"
          >
            Show {resultCount.toLocaleString()} result{resultCount === 1 ? "" : "s"}
          </button>
        </div>
      </dialog>
    </section>
  );
}
