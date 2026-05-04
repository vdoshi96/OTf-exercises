import type { GroupedExercise } from "@/lib/types";

interface ExercisePlaceholderProps {
  category: GroupedExercise["category"];
  className?: string;
}

const ACCENT = "#f97316"; // orange-500
const OUTLINE = "#a1a1aa"; // zinc-400
const BG = "#27272a"; // zinc-800

function UpperBody() {
  return (
    <svg viewBox="0 0 80 120" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Head */}
      <circle cx="40" cy="16" r="8" stroke={OUTLINE} strokeWidth="1.5" />
      {/* Neck */}
      <line x1="40" y1="24" x2="40" y2="30" stroke={OUTLINE} strokeWidth="1.5" />
      {/* Torso */}
      <line x1="40" y1="30" x2="40" y2="70" stroke={OUTLINE} strokeWidth="1.5" />
      {/* Shoulders + Arms */}
      <line x1="40" y1="34" x2="18" y2="42" stroke={ACCENT} strokeWidth="2.5" />
      <line x1="18" y1="42" x2="12" y2="60" stroke={ACCENT} strokeWidth="2.5" />
      <line x1="40" y1="34" x2="62" y2="42" stroke={ACCENT} strokeWidth="2.5" />
      <line x1="62" y1="42" x2="68" y2="60" stroke={ACCENT} strokeWidth="2.5" />
      {/* Chest highlight */}
      <ellipse cx="40" cy="42" rx="12" ry="8" fill={ACCENT} opacity="0.2" />
      {/* Legs */}
      <line x1="40" y1="70" x2="30" y2="100" stroke={OUTLINE} strokeWidth="1.5" />
      <line x1="40" y1="70" x2="50" y2="100" stroke={OUTLINE} strokeWidth="1.5" />
      <line x1="30" y1="100" x2="28" y2="114" stroke={OUTLINE} strokeWidth="1.5" />
      <line x1="50" y1="100" x2="52" y2="114" stroke={OUTLINE} strokeWidth="1.5" />
    </svg>
  );
}

function LowerBody() {
  return (
    <svg viewBox="0 0 80 120" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="40" cy="16" r="8" stroke={OUTLINE} strokeWidth="1.5" />
      <line x1="40" y1="24" x2="40" y2="30" stroke={OUTLINE} strokeWidth="1.5" />
      <line x1="40" y1="30" x2="40" y2="70" stroke={OUTLINE} strokeWidth="1.5" />
      {/* Arms */}
      <line x1="40" y1="34" x2="18" y2="42" stroke={OUTLINE} strokeWidth="1.5" />
      <line x1="18" y1="42" x2="12" y2="60" stroke={OUTLINE} strokeWidth="1.5" />
      <line x1="40" y1="34" x2="62" y2="42" stroke={OUTLINE} strokeWidth="1.5" />
      <line x1="62" y1="42" x2="68" y2="60" stroke={OUTLINE} strokeWidth="1.5" />
      {/* Legs highlighted */}
      <line x1="40" y1="70" x2="30" y2="100" stroke={ACCENT} strokeWidth="2.5" />
      <line x1="40" y1="70" x2="50" y2="100" stroke={ACCENT} strokeWidth="2.5" />
      <line x1="30" y1="100" x2="28" y2="114" stroke={ACCENT} strokeWidth="2.5" />
      <line x1="50" y1="100" x2="52" y2="114" stroke={ACCENT} strokeWidth="2.5" />
      {/* Quad/glute highlight */}
      <ellipse cx="35" cy="82" rx="6" ry="12" fill={ACCENT} opacity="0.2" />
      <ellipse cx="45" cy="82" rx="6" ry="12" fill={ACCENT} opacity="0.2" />
    </svg>
  );
}

function Core() {
  return (
    <svg viewBox="0 0 80 120" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="40" cy="16" r="8" stroke={OUTLINE} strokeWidth="1.5" />
      <line x1="40" y1="24" x2="40" y2="30" stroke={OUTLINE} strokeWidth="1.5" />
      {/* Torso highlighted */}
      <line x1="40" y1="30" x2="40" y2="70" stroke={ACCENT} strokeWidth="2.5" />
      {/* Core highlight */}
      <rect x="30" y="44" width="20" height="22" rx="4" fill={ACCENT} opacity="0.25" />
      {/* Arms */}
      <line x1="40" y1="34" x2="18" y2="42" stroke={OUTLINE} strokeWidth="1.5" />
      <line x1="18" y1="42" x2="12" y2="60" stroke={OUTLINE} strokeWidth="1.5" />
      <line x1="40" y1="34" x2="62" y2="42" stroke={OUTLINE} strokeWidth="1.5" />
      <line x1="62" y1="42" x2="68" y2="60" stroke={OUTLINE} strokeWidth="1.5" />
      {/* Legs */}
      <line x1="40" y1="70" x2="30" y2="100" stroke={OUTLINE} strokeWidth="1.5" />
      <line x1="40" y1="70" x2="50" y2="100" stroke={OUTLINE} strokeWidth="1.5" />
      <line x1="30" y1="100" x2="28" y2="114" stroke={OUTLINE} strokeWidth="1.5" />
      <line x1="50" y1="100" x2="52" y2="114" stroke={OUTLINE} strokeWidth="1.5" />
    </svg>
  );
}

function FullBody() {
  return (
    <svg viewBox="0 0 80 120" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="40" cy="16" r="8" stroke={ACCENT} strokeWidth="2" />
      <line x1="40" y1="24" x2="40" y2="30" stroke={ACCENT} strokeWidth="2" />
      <line x1="40" y1="30" x2="40" y2="70" stroke={ACCENT} strokeWidth="2.5" />
      {/* Arms */}
      <line x1="40" y1="34" x2="18" y2="42" stroke={ACCENT} strokeWidth="2.5" />
      <line x1="18" y1="42" x2="12" y2="60" stroke={ACCENT} strokeWidth="2.5" />
      <line x1="40" y1="34" x2="62" y2="42" stroke={ACCENT} strokeWidth="2.5" />
      <line x1="62" y1="42" x2="68" y2="60" stroke={ACCENT} strokeWidth="2.5" />
      {/* Legs */}
      <line x1="40" y1="70" x2="30" y2="100" stroke={ACCENT} strokeWidth="2.5" />
      <line x1="40" y1="70" x2="50" y2="100" stroke={ACCENT} strokeWidth="2.5" />
      <line x1="30" y1="100" x2="28" y2="114" stroke={ACCENT} strokeWidth="2.5" />
      <line x1="50" y1="100" x2="52" y2="114" stroke={ACCENT} strokeWidth="2.5" />
      {/* Full body glow */}
      <ellipse cx="40" cy="52" rx="16" ry="24" fill={ACCENT} opacity="0.12" />
    </svg>
  );
}

function Cardio() {
  return (
    <svg viewBox="0 0 80 120" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Running figure */}
      <circle cx="44" cy="16" r="8" stroke={ACCENT} strokeWidth="2" />
      <line x1="44" y1="24" x2="42" y2="30" stroke={OUTLINE} strokeWidth="1.5" />
      <line x1="42" y1="30" x2="38" y2="62" stroke={OUTLINE} strokeWidth="1.5" />
      {/* Arms in running motion */}
      <line x1="40" y1="36" x2="24" y2="30" stroke={ACCENT} strokeWidth="2" />
      <line x1="40" y1="36" x2="56" y2="48" stroke={ACCENT} strokeWidth="2" />
      {/* Legs in running stride */}
      <line x1="38" y1="62" x2="22" y2="88" stroke={ACCENT} strokeWidth="2.5" />
      <line x1="22" y1="88" x2="18" y2="108" stroke={ACCENT} strokeWidth="2" />
      <line x1="38" y1="62" x2="56" y2="84" stroke={ACCENT} strokeWidth="2.5" />
      <line x1="56" y1="84" x2="62" y2="100" stroke={ACCENT} strokeWidth="2" />
      {/* Motion lines */}
      <line x1="10" y1="40" x2="18" y2="40" stroke={ACCENT} strokeWidth="1" opacity="0.5" />
      <line x1="8" y1="50" x2="16" y2="50" stroke={ACCENT} strokeWidth="1" opacity="0.4" />
      <line x1="10" y1="60" x2="18" y2="60" stroke={ACCENT} strokeWidth="1" opacity="0.3" />
    </svg>
  );
}

function Mobility() {
  return (
    <svg viewBox="0 0 80 120" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Stretching figure */}
      <circle cx="40" cy="16" r="8" stroke={OUTLINE} strokeWidth="1.5" />
      <line x1="40" y1="24" x2="40" y2="30" stroke={OUTLINE} strokeWidth="1.5" />
      <line x1="40" y1="30" x2="40" y2="64" stroke={OUTLINE} strokeWidth="1.5" />
      {/* Arms reaching up */}
      <line x1="40" y1="34" x2="22" y2="18" stroke={ACCENT} strokeWidth="2" />
      <line x1="40" y1="34" x2="58" y2="18" stroke={ACCENT} strokeWidth="2" />
      {/* Flexibility arcs */}
      <path d="M22 18 Q 20 10, 24 6" stroke={ACCENT} strokeWidth="1.5" fill="none" />
      <path d="M58 18 Q 60 10, 56 6" stroke={ACCENT} strokeWidth="1.5" fill="none" />
      {/* Legs in wide stance */}
      <line x1="40" y1="64" x2="24" y2="100" stroke={OUTLINE} strokeWidth="1.5" />
      <line x1="40" y1="64" x2="56" y2="100" stroke={OUTLINE} strokeWidth="1.5" />
      <line x1="24" y1="100" x2="22" y2="114" stroke={OUTLINE} strokeWidth="1.5" />
      <line x1="56" y1="100" x2="58" y2="114" stroke={OUTLINE} strokeWidth="1.5" />
      {/* Flexibility indicator circles at joints */}
      <circle cx="40" cy="34" r="3" fill={ACCENT} opacity="0.3" />
      <circle cx="40" cy="64" r="3" fill={ACCENT} opacity="0.3" />
    </svg>
  );
}

function Other() {
  return (
    <svg viewBox="0 0 80 120" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="40" cy="16" r="8" stroke={OUTLINE} strokeWidth="1.5" />
      <line x1="40" y1="24" x2="40" y2="30" stroke={OUTLINE} strokeWidth="1.5" />
      <line x1="40" y1="30" x2="40" y2="70" stroke={OUTLINE} strokeWidth="1.5" />
      <line x1="40" y1="34" x2="18" y2="42" stroke={OUTLINE} strokeWidth="1.5" />
      <line x1="18" y1="42" x2="12" y2="60" stroke={OUTLINE} strokeWidth="1.5" />
      <line x1="40" y1="34" x2="62" y2="42" stroke={OUTLINE} strokeWidth="1.5" />
      <line x1="62" y1="42" x2="68" y2="60" stroke={OUTLINE} strokeWidth="1.5" />
      <line x1="40" y1="70" x2="30" y2="100" stroke={OUTLINE} strokeWidth="1.5" />
      <line x1="40" y1="70" x2="50" y2="100" stroke={OUTLINE} strokeWidth="1.5" />
      <line x1="30" y1="100" x2="28" y2="114" stroke={OUTLINE} strokeWidth="1.5" />
      <line x1="50" y1="100" x2="52" y2="114" stroke={OUTLINE} strokeWidth="1.5" />
      {/* Dumbbell */}
      <rect x="8" y="58" width="8" height="4" rx="1" fill={ACCENT} opacity="0.6" />
      <rect x="64" y="58" width="8" height="4" rx="1" fill={ACCENT} opacity="0.6" />
    </svg>
  );
}

const CATEGORY_DIAGRAMS: Record<string, () => React.JSX.Element> = {
  upper_body: UpperBody,
  lower_body: LowerBody,
  core: Core,
  full_body: FullBody,
  cardio: Cardio,
  mobility: Mobility,
  other: Other,
};

export default function ExercisePlaceholder({
  category,
  className = "",
}: ExercisePlaceholderProps) {
  const Diagram = CATEGORY_DIAGRAMS[category] || Other;

  return (
    <div
      className={`flex h-full w-full items-center justify-center ${className}`}
      style={{ backgroundColor: BG }}
    >
      <div className="w-1/2 max-w-[60px] opacity-70">
        <Diagram />
      </div>
    </div>
  );
}
