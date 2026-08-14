export interface Creator {
  id: string;
  display_name: string;
  handle: string;
  profile_url: string;
}

export interface Video {
  id: string;
  url: string;
  source: "tiktok" | "instagram";
  thumbnail: string;
  description: string;
  creator: Creator;
}

export interface GroupedExercise {
  id: string;
  exercise_name: string;
  category:
    | "upper_body"
    | "lower_body"
    | "core"
    | "full_body"
    | "cardio"
    | "mobility"
    | "other";
  muscle_groups: string[];
  equipment: string[];
  movement_type:
    | "compound"
    | "isolation"
    | "cardio"
    | "stretch"
    | "other";
  coaching_cues: string[];
  videos: Video[];
}

export type DirectorySection = "exercise" | "coaching";

export type CoachingTopic =
  | "movement-technique"
  | "class-delivery"
  | "programming"
  | "safety-and-modifications";

export interface CoachingResource {
  id: string;
  title: string;
  topic: CoachingTopic;
  summary: string;
  related_exercise_ids: string[];
  videos: Video[];
}

export type LegacyExerciseRouteOutcome = "redirect" | "split" | "removed";

export interface LegacyExerciseRouteTarget {
  kind: DirectorySection;
  id: string;
  title: string;
  path: string;
  video_ids: string[];
}

export interface LegacyExerciseRouteExclusion {
  video_id: string;
  reason: string;
}

export interface LegacyExerciseRoute {
  legacy_title: string;
  outcome: LegacyExerciseRouteOutcome;
  targets: LegacyExerciseRouteTarget[];
  excluded: LegacyExerciseRouteExclusion[];
}

export interface LegacyExerciseRouteLedger {
  version: 1;
  baseline_commit: string;
  baseline_routes_sha256: string;
  stats: {
    baseline_routes: number;
    current_exercise_routes: number;
    preserved_current_routes: number;
    legacy_routes: number;
    redirect_routes: number;
    split_recovery_routes: number;
    removed_recovery_routes: number;
  };
  routes: Record<string, LegacyExerciseRoute>;
}

export interface DirectoryQuery {
  section: DirectorySection;
  q: string;
  categories: string[];
  muscles: string[];
  equipment: string[];
  sources: string[];
  creators: string[];
  topics: string[];
  page: number;
}

export interface DirectoryItemSummary {
  id: string;
  kind: DirectorySection;
  title: string;
  classification: string;
  classificationLabel: string;
  muscleGroups: string[];
  equipment: string[];
  thumbnail: string | null;
  videoCount: number;
  sources: Video["source"][];
  creators: DirectoryCreatorSummary[];
  matchedBy: string[];
}

export type DirectoryCreatorSummary = Pick<Creator, "id" | "display_name">;

export interface DirectoryFilterOption {
  value: string;
  label: string;
}

export interface DirectoryFilterOptions {
  categories: DirectoryFilterOption[];
  muscles: DirectoryFilterOption[];
  equipment: DirectoryFilterOption[];
  sources: DirectoryFilterOption[];
  creators: DirectoryCreatorSummary[];
  topics: DirectoryFilterOption[];
}

export interface DirectoryStats {
  items: number;
  videos: number;
  creators: number;
}

export interface DirectoryResponse {
  items: DirectoryItemSummary[];
  accumulated: boolean;
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
  query: DirectoryQuery;
  filterOptions: DirectoryFilterOptions;
  stats: DirectoryStats;
}

export const CATEGORY_LABELS: Record<string, string> = {
  upper_body: "Upper Body",
  lower_body: "Lower Body",
  core: "Core",
  full_body: "Full Body",
  cardio: "Cardio",
  mobility: "Mobility",
  other: "Other",
};

export const CATEGORY_COLORS: Record<string, string> = {
  upper_body: "bg-orange-500/20 text-orange-100 border-orange-500/35",
  lower_body: "bg-amber-500/20 text-amber-100 border-amber-500/35",
  core: "bg-red-500/15 text-red-100 border-red-500/30",
  full_body: "bg-orange-600/20 text-orange-100 border-orange-400/35",
  cardio: "bg-rose-500/15 text-rose-100 border-rose-500/30",
  mobility: "bg-stone-500/20 text-stone-100 border-stone-500/30",
  other: "bg-zinc-500/20 text-zinc-100 border-zinc-500/30",
};
