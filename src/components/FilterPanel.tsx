"use client";

import { useState } from "react";
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
      onClick={onClick}
      aria-pressed={active}
      className={`rounded-lg border px-3 py-1.5 text-sm font-medium transition ${
        active
          ? "border-orange-500/50 bg-orange-500/20 text-orange-400"
          : "border-zinc-700/50 bg-zinc-800/50 text-zinc-400 hover:border-zinc-600 hover:text-zinc-300"
      }`}
    >
      {label}
    </button>
  );
}

function formatLabel(value: string): string {
  return CATEGORY_LABELS[value] ?? value.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      className={`h-4 w-4 text-zinc-500 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
    </svg>
  );
}

function FilterSection({
  title,
  children,
  defaultOpen = false,
  activeCount = 0,
}: {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
  activeCount?: number;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div>
      <button
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        className="flex w-full items-center justify-between py-1"
      >
        <div className="flex items-center gap-2">
          <p className="text-xs font-medium uppercase tracking-wider text-zinc-500">
            {title}
          </p>
          {activeCount > 0 && !open && (
            <span className="rounded-full bg-orange-500/20 px-2 py-0.5 text-[10px] font-semibold text-orange-400">
              {activeCount} active
            </span>
          )}
        </div>
        <ChevronIcon open={open} />
      </button>
      {open && <div className="mt-2 flex flex-wrap gap-2">{children}</div>}
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
  const hasFilters =
    activeCategory ||
    activeMuscleGroup ||
    activeEquipment ||
    activePlatform ||
    activeCreators.length > 0;
  const [panelOpen, setPanelOpen] = useState(false);

  const activeFilterCount =
    (activeCategory ? 1 : 0) +
    (activeMuscleGroup ? 1 : 0) +
    (activeEquipment ? 1 : 0) +
    (activePlatform ? 1 : 0) +
    activeCreators.length;

  const clearFilters = () => {
    onCategoryChange(null);
    onMuscleGroupChange(null);
    onEquipmentChange(null);
    onPlatformChange(null);
    onCreatorChange(null);
  };

  return (
    <div className="rounded-xl border border-zinc-800/50 bg-zinc-900/30">
      <div className="flex items-center justify-between gap-2 px-4 py-3">
        <button
          onClick={() => setPanelOpen(!panelOpen)}
          aria-expanded={panelOpen}
          className="flex min-w-0 flex-1 items-center justify-between"
        >
          <span className="flex items-center gap-3">
            <svg
              className="h-4 w-4 text-zinc-500"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z"
              />
            </svg>
            <span className="text-sm font-semibold uppercase tracking-wider text-zinc-400">
              Filters
            </span>
            {activeFilterCount > 0 && !panelOpen && (
              <span className="rounded-full bg-orange-500/20 px-2 py-0.5 text-xs font-semibold text-orange-400">
                {activeFilterCount}
              </span>
            )}
          </span>
          <ChevronIcon open={panelOpen} />
        </button>
        {hasFilters && (
          <button
            type="button"
            onClick={clearFilters}
            className="text-sm text-orange-400 hover:text-orange-300"
          >
            Clear all
          </button>
        )}
      </div>

      {panelOpen && (
        <div className="space-y-3 border-t border-zinc-800/50 px-4 pb-4 pt-3">
          <FilterSection title="Category" activeCount={activeCategory ? 1 : 0} defaultOpen>
            {categories.map((cat) => (
              <Chip
                key={cat}
                label={formatLabel(cat)}
                active={activeCategory === cat}
                onClick={() => onCategoryChange(activeCategory === cat ? null : cat)}
              />
            ))}
          </FilterSection>

          <FilterSection title="Muscle Group" activeCount={activeMuscleGroup ? 1 : 0}>
            {muscleGroups.map((mg) => (
              <Chip
                key={mg}
                label={formatLabel(mg)}
                active={activeMuscleGroup === mg}
                onClick={() => onMuscleGroupChange(activeMuscleGroup === mg ? null : mg)}
              />
            ))}
          </FilterSection>

          <FilterSection title="Equipment" activeCount={activeEquipment ? 1 : 0}>
            {equipment.map((eq) => (
              <Chip
                key={eq}
                label={formatLabel(eq)}
                active={activeEquipment === eq}
                onClick={() => onEquipmentChange(activeEquipment === eq ? null : eq)}
              />
            ))}
          </FilterSection>

          {platforms.length > 1 && (
            <FilterSection title="Platform" activeCount={activePlatform ? 1 : 0}>
              {platforms.map((p) => (
                <Chip
                  key={p}
                  label={PLATFORM_LABELS[p] ?? formatLabel(p)}
                  active={activePlatform === p}
                  onClick={() => onPlatformChange(activePlatform === p ? null : p)}
                />
              ))}
            </FilterSection>
          )}

          <FilterSection title="Creator" activeCount={activeCreators.length}>
            {creators.map((creator) => (
              <Chip
                key={creator.id}
                label={creator.display_name}
                active={activeCreators.includes(creator.id)}
                onClick={() => onCreatorChange(creator.id)}
              />
            ))}
          </FilterSection>
        </div>
      )}
    </div>
  );
}
