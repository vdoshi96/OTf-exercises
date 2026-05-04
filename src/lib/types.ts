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
