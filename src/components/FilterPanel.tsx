"use client";

import { useMemo, useRef, useState } from "react";
import { CATEGORY_LABELS, type Creator } from "@/lib/types";

const PLATFORM_LABELS: Record<string, string> = {
  tiktok: "TikTok",
  instagram: "Instagram",
};

interface FilterPanelProps {
  categories: string[];
  muscleGroups: string[];
  equipment: string[];
  platforms: string[];
  creators: Creator[];
  resultCount: number;
  activeCategory: string | null;
  activeMuscleGroup: string | null;
  activeEquipment: string | null;
  activePlatform: string | null;
  activeCreators: string[];
  onCategoryChange: (category: string | null) => void;
  onMuscleGroupChange: (muscleGroup: string | null) => void;
  onEquipmentChange: (equipment: string | null) => void;
  onPlatformChange: (platform: string | null) => void;
  onCreatorChange: (creatorId: string | null) => void;
}

interface ActiveFilter {
  key: string;
  label: string;
  onRemove: () => void;
}

interface FilterChoice {
  value: string;
  label: string;
}

interface FilterGroupConfig {
  title: string;
  choices: FilterChoice[];
  isActive: (value: string) => boolean;
  onToggle: (value: string) => void;
  wide?: boolean;
}

function formatLabel(value: string): string {
  return (
    CATEGORY_LABELS[value] ??
    value.replace(/_/g, " ").replace(/\b\w/g, (character) => character.toUpperCase())
  );
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

function DesktopFilterGroups({ groups }: { groups: FilterGroupConfig[] }) {
  return (
    <div className="grid gap-5 lg:grid-cols-2">
      {groups.map((group) => (
        <div key={group.title} className={group.wide ? "lg:col-span-2" : ""}>
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
                  label={choice.label}
                  active={group.isActive(choice.value)}
                  onClick={() => group.onToggle(choice.value)}
                />
              ))}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function MobileFilterGroups({ groups }: { groups: FilterGroupConfig[] }) {
  return (
    <div className="divide-y divide-white/10">
      {groups.map((group) => {
        const selectedCount = group.choices.filter((choice) =>
          group.isActive(choice.value)
        ).length;

        return (
          <details
            key={group.title}
            className="group/filter py-1"
          >
            <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 rounded-md px-1 text-sm font-bold uppercase text-stone-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-400 [&::-webkit-details-marker]:hidden">
              <span className="flex items-center gap-2">
                {group.title}
                {selectedCount > 0 && (
                  <span className="rounded-md bg-orange-500 px-1.5 py-0.5 text-xs text-black">
                    {selectedCount}
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
                  label={choice.label}
                  active={group.isActive(choice.value)}
                  onClick={() => group.onToggle(choice.value)}
                />
              ))}
            </div>
          </details>
        );
      })}
    </div>
  );
}

export default function FilterPanel({
  categories,
  muscleGroups,
  equipment,
  platforms,
  creators,
  resultCount,
  activeCategory,
  activeMuscleGroup,
  activeEquipment,
  activePlatform,
  activeCreators,
  onCategoryChange,
  onMuscleGroupChange,
  onEquipmentChange,
  onPlatformChange,
  onCreatorChange,
}: FilterPanelProps) {
  const [desktopPanelOpen, setDesktopPanelOpen] = useState(false);
  const mobileDialogRef = useRef<HTMLDialogElement>(null);
  const mobileTriggerRef = useRef<HTMLButtonElement>(null);
  const desktopTriggerRef = useRef<HTMLButtonElement>(null);
  const creatorById = useMemo(
    () => new Map(creators.map((creator) => [creator.id, creator])),
    [creators]
  );

  const activeFilters: ActiveFilter[] = [
    activeCategory
      ? {
          key: "category",
          label: formatLabel(activeCategory),
          onRemove: () => onCategoryChange(null),
        }
      : null,
    activeMuscleGroup
      ? {
          key: "muscle-group",
          label: formatLabel(activeMuscleGroup),
          onRemove: () => onMuscleGroupChange(null),
        }
      : null,
    activeEquipment
      ? {
          key: "equipment",
          label: formatLabel(activeEquipment),
          onRemove: () => onEquipmentChange(null),
        }
      : null,
    activePlatform
      ? {
          key: "platform",
          label: PLATFORM_LABELS[activePlatform] ?? formatLabel(activePlatform),
          onRemove: () => onPlatformChange(null),
        }
      : null,
    ...activeCreators.map((creatorId) => {
      const creator = creatorById.get(creatorId);

      return {
        key: `creator-${creatorId}`,
        label: creator?.display_name ?? creatorId,
        onRemove: () => onCreatorChange(creatorId),
      };
    }),
  ].filter(Boolean) as ActiveFilter[];

  const groups: FilterGroupConfig[] = [
    {
      title: "Category",
      choices: categories.map((value) => ({ value, label: formatLabel(value) })),
      isActive: (value) => activeCategory === value,
      onToggle: (value) =>
        onCategoryChange(activeCategory === value ? null : value),
    },
    {
      title: "Muscle group",
      choices: muscleGroups.map((value) => ({ value, label: formatLabel(value) })),
      isActive: (value) => activeMuscleGroup === value,
      onToggle: (value) =>
        onMuscleGroupChange(activeMuscleGroup === value ? null : value),
    },
    {
      title: "Equipment",
      choices: equipment.map((value) => ({ value, label: formatLabel(value) })),
      isActive: (value) => activeEquipment === value,
      onToggle: (value) =>
        onEquipmentChange(activeEquipment === value ? null : value),
    },
    ...(platforms.length > 1
      ? [
          {
            title: "Platform",
            choices: platforms.map((value) => ({
              value,
              label: PLATFORM_LABELS[value] ?? formatLabel(value),
            })),
            isActive: (value: string) => activePlatform === value,
            onToggle: (value: string) =>
              onPlatformChange(activePlatform === value ? null : value),
          },
        ]
      : []),
    {
      title: "Creator",
      choices: creators.map((creator) => ({
        value: creator.id,
        label: creator.display_name,
      })),
      isActive: (value) => activeCreators.includes(value),
      onToggle: (value) => onCreatorChange(value),
      wide: true,
    },
  ];

  const activeFilterCount = activeFilters.length;
  const hasFilters = activeFilterCount > 0;

  const clearFilters = () => {
    onCategoryChange(null);
    onMuscleGroupChange(null);
    onEquipmentChange(null);
    onPlatformChange(null);
    onCreatorChange(null);
  };

  const openMobileDialog = () => {
    mobileDialogRef.current?.showModal();
  };

  const closeMobileDialog = () => {
    mobileDialogRef.current?.close();
  };

  const restoreFilterTriggerFocus = () => {
    const mobileTrigger = mobileTriggerRef.current;
    const desktopTrigger = desktopTriggerRef.current;
    const mobileTriggerIsVisible =
      mobileTrigger && window.getComputedStyle(mobileTrigger).display !== "none";

    (mobileTriggerIsVisible ? mobileTrigger : desktopTrigger)?.focus();
  };

  return (
    <section className="w-full rounded-lg border border-white/10 bg-[#101111]/90 shadow-xl shadow-black/20 sm:max-w-5xl">
      <div className="flex flex-col gap-3 p-3">
        <div className="flex items-center justify-between gap-3">
          <button
            ref={mobileTriggerRef}
            type="button"
            onClick={openMobileDialog}
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
              onClick={clearFilters}
              className="hidden rounded-md px-2 py-1 text-sm font-semibold text-orange-300 transition hover:bg-orange-500/10 hover:text-orange-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-400 sm:block"
            >
              Clear all
            </button>
          )}
        </div>

        {hasFilters && (
          <div
            aria-label="Active filters"
            className="flex flex-wrap gap-2 border-t border-white/10 pt-3"
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
          <DesktopFilterGroups groups={groups} />
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
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            event.preventDefault();
            closeMobileDialog();
          }
        }}
        onClose={restoreFilterTriggerFocus}
        onClick={(event) => {
          if (event.target === event.currentTarget) closeMobileDialog();
        }}
        className="fixed inset-x-0 bottom-0 top-auto m-0 max-h-[88dvh] w-full max-w-none flex-col overflow-hidden rounded-t-2xl border border-white/15 bg-[#0b0c0c] p-0 text-stone-100 shadow-2xl shadow-black open:flex backdrop:bg-black/80 backdrop:backdrop-blur-sm sm:hidden"
      >
        <div className="flex shrink-0 items-center justify-between gap-4 border-b border-white/10 bg-[#101111] px-4 py-3">
          <div>
            <p className="text-xs font-bold uppercase text-orange-400">
              Refine directory
            </p>
            <h2
              id="mobile-filter-heading"
              className="font-display display-tight mt-0.5 text-2xl font-semibold text-stone-50"
            >
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
          <MobileFilterGroups groups={groups} />
        </div>

        <div className="grid shrink-0 grid-cols-[0.8fr_1.2fr] gap-3 border-t border-white/10 bg-[#101111] p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
          <button
            type="button"
            onClick={clearFilters}
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
            Show {resultCount.toLocaleString()} result
            {resultCount === 1 ? "" : "s"}
          </button>
        </div>
      </dialog>
    </section>
  );
}
