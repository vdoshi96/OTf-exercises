"use client";

import { useMemo, useState } from "react";
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

function formatLabel(value: string): string {
  return (
    CATEGORY_LABELS[value] ??
    value.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
  );
}

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      aria-hidden="true"
      className={`h-4 w-4 transition-transform duration-200 ${
        open ? "rotate-180" : ""
      }`}
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
      className={`max-w-full rounded-md border px-3 py-1.5 text-sm font-semibold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-400 ${
        active
          ? "border-orange-400/70 bg-orange-500/20 text-orange-100 shadow-sm shadow-orange-950/40"
          : "border-stone-800 bg-[#17100c] text-stone-400 hover:border-orange-500/40 hover:text-orange-100"
      }`}
    >
      <span className="break-words">{label}</span>
    </button>
  );
}

function ActiveFilterChip({ filter }: { filter: ActiveFilter }) {
  return (
    <span className="inline-flex max-w-full items-center gap-1.5 rounded-md border border-orange-500/35 bg-orange-500/15 px-2.5 py-1 text-sm font-semibold text-orange-100">
      <span className="break-words">{filter.label}</span>
      <button
        type="button"
        onClick={filter.onRemove}
        aria-label={`Remove ${filter.label} filter`}
        className="rounded-sm p-0.5 text-orange-200 transition hover:bg-orange-500/20 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-400"
      >
        <svg
          aria-hidden="true"
          className="h-3.5 w-3.5"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2.25}
            d="M6 18L18 6M6 6l12 12"
          />
        </svg>
      </button>
    </span>
  );
}

function FilterGroup({
  title,
  children,
  wide = false,
}: {
  title: string;
  children: React.ReactNode;
  wide?: boolean;
}) {
  return (
    <div className={wide ? "lg:col-span-2" : ""}>
      <h3 className="mb-2 text-sm font-semibold text-stone-300">{title}</h3>
      {children}
    </div>
  );
}

export default function FilterPanel({
  categories,
  muscleGroups,
  equipment,
  platforms,
  creators,
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
  const [panelOpen, setPanelOpen] = useState(false);
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

  const activeFilterCount = activeFilters.length;
  const hasFilters = activeFilterCount > 0;

  const clearFilters = () => {
    onCategoryChange(null);
    onMuscleGroupChange(null);
    onEquipmentChange(null);
    onPlatformChange(null);
    onCreatorChange(null);
  };

  return (
    <section className="rounded-lg border border-orange-950/70 bg-[#100b08]/80 shadow-sm shadow-black/30">
      <div className="flex flex-col gap-3 p-3 sm:p-4">
        <div className="flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => setPanelOpen((open) => !open)}
            aria-expanded={panelOpen}
            aria-controls="exercise-filters-panel"
            className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-orange-500/35 bg-orange-500/10 px-4 py-2 text-sm font-semibold text-orange-100 transition hover:bg-orange-500/15 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-400"
          >
            <FilterIcon />
            <span>Filters</span>
            {activeFilterCount > 0 && (
              <span className="rounded-md bg-orange-500 px-1.5 py-0.5 text-xs font-bold text-black">
                {activeFilterCount}
              </span>
            )}
            <ChevronIcon open={panelOpen} />
          </button>

          {hasFilters && (
            <button
              type="button"
              onClick={clearFilters}
              className="rounded-md px-2 py-1 text-sm font-semibold text-orange-300 transition hover:bg-orange-500/10 hover:text-orange-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-400"
            >
              Clear all
            </button>
          )}
        </div>

        {hasFilters && (
          <div
            aria-label="Active filters"
            className="flex flex-wrap gap-2 border-t border-orange-950/60 pt-3"
          >
            {activeFilters.map((filter) => (
              <ActiveFilterChip key={filter.key} filter={filter} />
            ))}
          </div>
        )}
      </div>

      {panelOpen && (
        <div
          id="exercise-filters-panel"
          className="animate-filter-panel border-t border-orange-950/70 p-4"
        >
          <div className="grid gap-5 lg:grid-cols-2">
            <FilterGroup title="Category">
              <div className="flex flex-wrap gap-2">
                {categories.map((cat) => (
                  <Chip
                    key={cat}
                    label={formatLabel(cat)}
                    active={activeCategory === cat}
                    onClick={() =>
                      onCategoryChange(activeCategory === cat ? null : cat)
                    }
                  />
                ))}
              </div>
            </FilterGroup>

            <FilterGroup title="Muscle group">
              <div className="flex flex-wrap gap-2">
                {muscleGroups.map((mg) => (
                  <Chip
                    key={mg}
                    label={formatLabel(mg)}
                    active={activeMuscleGroup === mg}
                    onClick={() =>
                      onMuscleGroupChange(activeMuscleGroup === mg ? null : mg)
                    }
                  />
                ))}
              </div>
            </FilterGroup>

            <FilterGroup title="Equipment">
              <div className="flex flex-wrap gap-2">
                {equipment.map((eq) => (
                  <Chip
                    key={eq}
                    label={formatLabel(eq)}
                    active={activeEquipment === eq}
                    onClick={() =>
                      onEquipmentChange(activeEquipment === eq ? null : eq)
                    }
                  />
                ))}
              </div>
            </FilterGroup>

            {platforms.length > 1 && (
              <FilterGroup title="Platform">
                <div className="flex flex-wrap gap-2">
                  {platforms.map((p) => (
                    <Chip
                      key={p}
                      label={PLATFORM_LABELS[p] ?? formatLabel(p)}
                      active={activePlatform === p}
                      onClick={() =>
                        onPlatformChange(activePlatform === p ? null : p)
                      }
                    />
                  ))}
                </div>
              </FilterGroup>
            )}

            <FilterGroup title="Creator" wide>
              <div className="max-h-52 overflow-y-auto pr-1">
                <div className="flex flex-wrap gap-2">
                  {creators.map((creator) => (
                    <Chip
                      key={creator.id}
                      label={creator.display_name}
                      active={activeCreators.includes(creator.id)}
                      onClick={() => onCreatorChange(creator.id)}
                    />
                  ))}
                </div>
              </div>
            </FilterGroup>
          </div>
        </div>
      )}
    </section>
  );
}
