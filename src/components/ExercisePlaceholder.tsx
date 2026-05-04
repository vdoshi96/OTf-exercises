import { CATEGORY_COLORS, type GroupedExercise } from "@/lib/types";

interface ExercisePlaceholderProps {
  category: GroupedExercise["category"];
  exerciseName: string;
  muscleGroups: string[];
}

const CATEGORY_ICONS: Record<string, string> = {
  upper_body: "M12 2a4 4 0 0 0-4 4v1H6a2 2 0 0 0-2 2v2a2 2 0 0 0 2 2h1v5a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2v-5h1a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-2V6a4 4 0 0 0-4-4z",
  lower_body: "M12 2v6m0 0-4 6m4-6 4 6m-8 0v4l-2 4m6-8v4l2 4",
  core: "M12 2a8 8 0 0 0-8 8v4a8 8 0 0 0 16 0v-4a8 8 0 0 0-8-8zm0 4v8m-3-6h6",
  full_body: "M12 2a3 3 0 1 0 0 6 3 3 0 0 0 0-6zm-4 8h8m-4 0v6m-3-3h6m-6 3-2 5m5-5 2 5",
  cardio: "M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z",
  mobility: "M12 2v4m0 12v4M4.93 4.93l2.83 2.83m8.48 8.48 2.83 2.83M2 12h4m12 0h4M4.93 19.07l2.83-2.83m8.48-8.48 2.83-2.83",
  other: "M12 2 2 7l10 15L22 7z",
};

export default function ExercisePlaceholder({
  category,
  exerciseName,
  muscleGroups,
}: ExercisePlaceholderProps) {
  const colorClasses = CATEGORY_COLORS[category] || CATEGORY_COLORS.other;
  const bgClass = colorClasses.split(" ")[0]; // e.g. "bg-blue-500/20"
  const textClass = colorClasses.split(" ")[1]; // e.g. "text-blue-400"
  const iconPath = CATEGORY_ICONS[category] || CATEGORY_ICONS.other;

  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-2 bg-zinc-800/80 p-3 text-center">
      <div
        className={`flex h-10 w-10 items-center justify-center rounded-full ${bgClass}`}
      >
        <svg
          className={`h-5 w-5 ${textClass}`}
          fill="none"
          stroke="currentColor"
          strokeWidth={1.5}
          strokeLinecap="round"
          strokeLinejoin="round"
          viewBox="0 0 24 24"
        >
          <path d={iconPath} />
        </svg>
      </div>
      <p className="line-clamp-2 text-xs font-medium leading-tight text-zinc-400">
        {exerciseName}
      </p>
      {muscleGroups.length > 0 && (
        <p className="line-clamp-1 text-[10px] text-zinc-600">
          {muscleGroups.slice(0, 3).join(" · ")}
        </p>
      )}
    </div>
  );
}
