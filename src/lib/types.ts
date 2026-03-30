export interface Video {
  id: string;
  url: string;
  source: "tiktok" | "instagram";
  thumbnail: string;
  description: string;
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
  upper_body: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  lower_body: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
  core: "bg-amber-500/20 text-amber-400 border-amber-500/30",
  full_body: "bg-purple-500/20 text-purple-400 border-purple-500/30",
  cardio: "bg-red-500/20 text-red-400 border-red-500/30",
  mobility: "bg-teal-500/20 text-teal-400 border-teal-500/30",
  other: "bg-zinc-500/20 text-zinc-400 border-zinc-500/30",
};
