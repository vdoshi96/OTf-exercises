"use client";

import { CATEGORY_LABELS } from "@/lib/types";

const PLATFORM_LABELS: Record<string, string> = {
  tiktok: "TikTok",
  instagram: "Instagram",
};

interface FilterPanelProps {
  categories: string[];
  muscleGroups: string[];
  equipment: string[];
  platforms: string[];
  activeCategory: string | null;
  activeMuscleGroup: string | null;
  activeEquipment: string | null;
  activePlatform: string | null;
  onCategoryChange: (category: string | null) => void;
  onMuscleGroupChange: (muscleGroup: string | null) => void;
  onEquipmentChange: (equipment: string | null) => void;
  onPlatformChange: (platform: string | null) => void;
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

export default function FilterPanel({
  categories,
  muscleGroups,
  equipment,
  platforms,
  activeCategory,
  activeMuscleGroup,
  activeEquipment,
  activePlatform,
  onCategoryChange,
  onMuscleGroupChange,
  onEquipmentChange,
  onPlatformChange,
}: FilterPanelProps) {
  const hasFilters = activeCategory || activeMuscleGroup || activeEquipment || activePlatform;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-zinc-500">
          Filters
        </h3>
        {hasFilters && (
          <button
            onClick={() => {
              onCategoryChange(null);
              onMuscleGroupChange(null);
              onEquipmentChange(null);
              onPlatformChange(null);
            }}
            className="text-sm text-orange-400 hover:text-orange-300"
          >
            Clear all
          </button>
        )}
      </div>

      <div>
        <p className="mb-2 text-xs font-medium uppercase tracking-wider text-zinc-600">
          Category
        </p>
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
      </div>

      <div>
        <p className="mb-2 text-xs font-medium uppercase tracking-wider text-zinc-600">
          Muscle Group
        </p>
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
      </div>

      <div>
        <p className="mb-2 text-xs font-medium uppercase tracking-wider text-zinc-600">
          Equipment
        </p>
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
      </div>

      {platforms.length > 1 && (
        <div>
          <p className="mb-2 text-xs font-medium uppercase tracking-wider text-zinc-600">
            Platform
          </p>
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
        </div>
      )}
    </div>
  );
}
