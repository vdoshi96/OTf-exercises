#!/usr/bin/env python3
"""Local enrichment of video metadata using keyword/pattern analysis.

No API key needed. Processes descriptions to extract exercise information
using pattern matching and fitness domain knowledge.
"""

import json
import os
import re
import sys

RAW_FILE = os.path.join(os.path.dirname(__file__), "..", "raw_videos.json")
OUTPUT_FILE = os.path.join(os.path.dirname(__file__), "..", "enriched_videos.json")

EXERCISE_KEYWORDS = {
    "squat": {"muscle_groups": ["quads", "glutes"], "category": "lower_body", "movement_type": "compound"},
    "goblet squat": {"muscle_groups": ["quads", "glutes", "core"], "category": "lower_body", "movement_type": "compound"},
    "sumo squat": {"muscle_groups": ["quads", "glutes", "inner thighs"], "category": "lower_body", "movement_type": "compound"},
    "sumo deadlift": {"muscle_groups": ["glutes", "hamstrings", "quads"], "category": "lower_body", "movement_type": "compound"},
    "front squat": {"muscle_groups": ["quads", "core", "shoulders"], "category": "lower_body", "movement_type": "compound"},
    "transverse squat": {"muscle_groups": ["quads", "glutes", "adductors"], "category": "lower_body", "movement_type": "compound"},
    "split squat": {"muscle_groups": ["quads", "glutes"], "category": "lower_body", "movement_type": "compound"},
    "bulgarian": {"muscle_groups": ["quads", "glutes"], "category": "lower_body", "movement_type": "compound"},
    "lunge": {"muscle_groups": ["quads", "glutes", "hamstrings"], "category": "lower_body", "movement_type": "compound"},
    "lateral lunge": {"muscle_groups": ["quads", "glutes", "adductors"], "category": "lower_body", "movement_type": "compound"},
    "reverse lunge": {"muscle_groups": ["quads", "glutes"], "category": "lower_body", "movement_type": "compound"},
    "speed skater": {"muscle_groups": ["quads", "glutes"], "category": "lower_body", "movement_type": "compound"},
    "deadlift": {"muscle_groups": ["hamstrings", "glutes", "back"], "category": "lower_body", "movement_type": "compound"},
    "rdl": {"muscle_groups": ["hamstrings", "glutes"], "category": "lower_body", "movement_type": "compound"},
    "romanian deadlift": {"muscle_groups": ["hamstrings", "glutes"], "category": "lower_body", "movement_type": "compound"},
    "hip bridge": {"muscle_groups": ["glutes", "hamstrings"], "category": "lower_body", "movement_type": "compound"},
    "hip hinge": {"muscle_groups": ["hamstrings", "glutes", "back"], "category": "lower_body", "movement_type": "compound"},
    "glute bridge": {"muscle_groups": ["glutes", "hamstrings"], "category": "lower_body", "movement_type": "isolation"},
    "calf raise": {"muscle_groups": ["calves"], "category": "lower_body", "movement_type": "isolation"},
    "step up": {"muscle_groups": ["quads", "glutes"], "category": "lower_body", "movement_type": "compound"},
    "step-up": {"muscle_groups": ["quads", "glutes"], "category": "lower_body", "movement_type": "compound"},
    "leg press": {"muscle_groups": ["quads", "glutes"], "category": "lower_body", "movement_type": "compound"},

    "bench press": {"muscle_groups": ["chest", "triceps", "shoulders"], "category": "upper_body", "movement_type": "compound"},
    "chest press": {"muscle_groups": ["chest", "triceps"], "category": "upper_body", "movement_type": "compound"},
    "push-up": {"muscle_groups": ["chest", "triceps", "shoulders"], "category": "upper_body", "movement_type": "compound"},
    "pushup": {"muscle_groups": ["chest", "triceps", "shoulders"], "category": "upper_body", "movement_type": "compound"},
    "push up": {"muscle_groups": ["chest", "triceps", "shoulders"], "category": "upper_body", "movement_type": "compound"},
    "shoulder press": {"muscle_groups": ["shoulders", "triceps"], "category": "upper_body", "movement_type": "compound"},
    "overhead press": {"muscle_groups": ["shoulders", "triceps"], "category": "upper_body", "movement_type": "compound"},
    "lateral raise": {"muscle_groups": ["shoulders", "deltoids"], "category": "upper_body", "movement_type": "isolation"},
    "front raise": {"muscle_groups": ["shoulders", "deltoids"], "category": "upper_body", "movement_type": "isolation"},
    "y-raise": {"muscle_groups": ["shoulders", "upper back"], "category": "upper_body", "movement_type": "isolation"},
    "y raise": {"muscle_groups": ["shoulders", "upper back"], "category": "upper_body", "movement_type": "isolation"},
    "reverse fly": {"muscle_groups": ["rear deltoids", "upper back"], "category": "upper_body", "movement_type": "isolation"},
    "rear delt": {"muscle_groups": ["rear deltoids"], "category": "upper_body", "movement_type": "isolation"},
    "bicep curl": {"muscle_groups": ["biceps"], "category": "upper_body", "movement_type": "isolation"},
    "hammer curl": {"muscle_groups": ["biceps", "forearms"], "category": "upper_body", "movement_type": "isolation"},
    "curl": {"muscle_groups": ["biceps"], "category": "upper_body", "movement_type": "isolation"},
    "tricep": {"muscle_groups": ["triceps"], "category": "upper_body", "movement_type": "isolation"},
    "skull crusher": {"muscle_groups": ["triceps"], "category": "upper_body", "movement_type": "isolation"},
    "kickback": {"muscle_groups": ["triceps"], "category": "upper_body", "movement_type": "isolation"},
    "row": {"muscle_groups": ["back", "biceps"], "category": "upper_body", "movement_type": "compound"},
    "low row": {"muscle_groups": ["back", "biceps"], "category": "upper_body", "movement_type": "compound"},
    "high row": {"muscle_groups": ["upper back", "biceps"], "category": "upper_body", "movement_type": "compound"},
    "pullover": {"muscle_groups": ["lats", "chest"], "category": "upper_body", "movement_type": "compound"},
    "pull-up": {"muscle_groups": ["back", "biceps"], "category": "upper_body", "movement_type": "compound"},
    "lat pulldown": {"muscle_groups": ["lats", "biceps"], "category": "upper_body", "movement_type": "compound"},
    "fly": {"muscle_groups": ["chest"], "category": "upper_body", "movement_type": "isolation"},
    "chest fly": {"muscle_groups": ["chest"], "category": "upper_body", "movement_type": "isolation"},
    "upright row": {"muscle_groups": ["shoulders", "traps"], "category": "upper_body", "movement_type": "compound"},

    "plank": {"muscle_groups": ["core", "shoulders"], "category": "core", "movement_type": "isolation"},
    "hollow hold": {"muscle_groups": ["core", "abs"], "category": "core", "movement_type": "isolation"},
    "dead bug": {"muscle_groups": ["core", "abs"], "category": "core", "movement_type": "isolation"},
    "crunch": {"muscle_groups": ["abs"], "category": "core", "movement_type": "isolation"},
    "sit-up": {"muscle_groups": ["abs", "hip flexors"], "category": "core", "movement_type": "isolation"},
    "sit up": {"muscle_groups": ["abs", "hip flexors"], "category": "core", "movement_type": "isolation"},
    "ab dolly": {"muscle_groups": ["core", "abs"], "category": "core", "movement_type": "isolation"},
    "v-up": {"muscle_groups": ["abs", "hip flexors"], "category": "core", "movement_type": "isolation"},
    "knee tuck": {"muscle_groups": ["abs", "hip flexors"], "category": "core", "movement_type": "isolation"},
    "rollout": {"muscle_groups": ["core", "abs"], "category": "core", "movement_type": "isolation"},
    "torso rotation": {"muscle_groups": ["obliques", "core"], "category": "core", "movement_type": "isolation"},
    "woodchop": {"muscle_groups": ["obliques", "core"], "category": "core", "movement_type": "compound"},
    "russian twist": {"muscle_groups": ["obliques", "core"], "category": "core", "movement_type": "isolation"},
    "bicycle": {"muscle_groups": ["abs", "obliques"], "category": "core", "movement_type": "isolation"},
    "bird dog": {"muscle_groups": ["core", "lower back"], "category": "core", "movement_type": "isolation"},
    "mountain climber": {"muscle_groups": ["core", "shoulders", "quads"], "category": "core", "movement_type": "compound"},
    "side plank": {"muscle_groups": ["obliques", "core"], "category": "core", "movement_type": "isolation"},

    "burpee": {"muscle_groups": ["full body"], "category": "full_body", "movement_type": "compound"},
    "clean": {"muscle_groups": ["full body"], "category": "full_body", "movement_type": "compound"},
    "clean and press": {"muscle_groups": ["full body"], "category": "full_body", "movement_type": "compound"},
    "snatch": {"muscle_groups": ["full body"], "category": "full_body", "movement_type": "compound"},
    "thruster": {"muscle_groups": ["quads", "shoulders", "core"], "category": "full_body", "movement_type": "compound"},
    "man maker": {"muscle_groups": ["full body"], "category": "full_body", "movement_type": "compound"},
    "turkish get up": {"muscle_groups": ["full body"], "category": "full_body", "movement_type": "compound"},
    "devil press": {"muscle_groups": ["full body"], "category": "full_body", "movement_type": "compound"},

    "treadmill": {"muscle_groups": ["quads", "hamstrings", "calves"], "category": "cardio", "movement_type": "cardio"},
    "tread": {"muscle_groups": ["quads", "hamstrings", "calves"], "category": "cardio", "movement_type": "cardio"},
    "run": {"muscle_groups": ["quads", "hamstrings", "calves"], "category": "cardio", "movement_type": "cardio"},
    "rowing": {"muscle_groups": ["back", "legs", "core"], "category": "full_body", "movement_type": "compound"},
    "rower": {"muscle_groups": ["back", "legs", "core"], "category": "full_body", "movement_type": "compound"},
    "bike": {"muscle_groups": ["quads", "hamstrings"], "category": "cardio", "movement_type": "cardio"},
    "strider": {"muscle_groups": ["legs", "core"], "category": "cardio", "movement_type": "cardio"},

    "stretch": {"muscle_groups": ["flexibility"], "category": "mobility", "movement_type": "stretch"},
    "hip flexor stretch": {"muscle_groups": ["hip flexors"], "category": "mobility", "movement_type": "stretch"},
    "mobility": {"muscle_groups": ["flexibility"], "category": "mobility", "movement_type": "stretch"},
    "foam roll": {"muscle_groups": ["flexibility"], "category": "mobility", "movement_type": "stretch"},
}

EQUIPMENT_KEYWORDS = {
    "dumbbell": ["dumbbell", "db", "dumbbells", "dbs"],
    "TRX straps": ["trx", "strap", "straps", "suspension"],
    "bench": ["bench"],
    "rower": ["rower", "rowing", "water rower", "row machine"],
    "treadmill": ["treadmill", "tread"],
    "bosu": ["bosu", "bosu ball"],
    "ab dolly": ["ab dolly", "dolly"],
    "medicine ball": ["medicine ball", "med ball"],
    "mini band": ["mini band", "band"],
    "resistance band": ["band", "mid band", "resistance band"],
    "bodyweight": ["bodyweight", "body weight", "no equipment"],
    "bike": ["bike"],
    "strider": ["strider"],
    "foam roller": ["foam roll", "foam roller"],
    "barbell": ["barbell"],
    "kettlebell": ["kettlebell", "kb"],
}

NON_EXERCISE_PATTERNS = [
    r"(?i)^just\s+play",
    r"(?i)^for\s+all\s+the\s+coaches",
    r"(?i)brag\s+board",
    r"(?i)happy\s+(mother|father|valentine|holiday|birthday|new\s+year)",
    r"(?i)teachers?\s+pet",
    r"(?i)nobody\s*is\s*perfect",
    r"(?i)^psa\b",
    r"(?i)^(who|what|when|where|why)\s+(else|do|did|is|are|was|were)\b",
    r"(?i)pto:",
    r"(?i)^pto\b",
    r"(?i)day\s+off",
    r"(?i)meme",
    r"(?i)^(5|3|10)\s+(things|reasons|ways)\b",
    r"(?i)weight\s+rack\s+organization",
    r"(?i)3\s+types?\s+of\s+learners?",
    r"(?i)coaching\s+tip!?$",
    r"(?i)just\s+tryin",
    r"(?i)we\s+all\s+mess\s+up",
    r"(?i)my\s+one\s+day\s+off",
]

EXERCISE_STRONG_SIGNALS = [
    r"(?i)(set\s+up|form|technique|execution|how\s+to)",
    r"(?i)(reps?|sets?|tempo|eccentric|concentric)",
    r"(?i)(muscle|activation|engage|squeeze|contract)",
    r"(?i)(hip\s+hinge|push|pull|press|raise|curl|extension|flexion)",
    r"(?i)(keep\s+(your|the)|make\s+sure|don'?t\s+(let|allow|swing))",
    r"(?i)(coaching|cue|form\s+check|breakdown)",
]


def is_exercise_demo(desc: str) -> bool:
    if not desc or len(desc.strip()) < 15:
        return False

    for pattern in NON_EXERCISE_PATTERNS:
        if re.search(pattern, desc):
            return False

    desc_lower = desc.lower()

    exercise_signals = 0
    for pattern in EXERCISE_STRONG_SIGNALS:
        if re.search(pattern, desc):
            exercise_signals += 1

    for keyword in EXERCISE_KEYWORDS:
        if keyword in desc_lower:
            exercise_signals += 2

    return exercise_signals >= 2


def extract_exercise_name(desc: str) -> str | None:
    desc_lower = desc.lower()

    best_match = None
    best_len = 0
    for keyword in sorted(EXERCISE_KEYWORDS.keys(), key=len, reverse=True):
        if keyword in desc_lower and len(keyword) > best_len:
            best_match = keyword
            best_len = len(keyword)

    if best_match:
        return best_match.title()

    first_line = desc.split(".")[0].split(":")[0].split("!")[0].strip()
    if len(first_line) < 60:
        return first_line

    return None


def extract_equipment(desc: str) -> list[str]:
    desc_lower = desc.lower()
    found = []
    for equip, keywords in EQUIPMENT_KEYWORDS.items():
        for kw in keywords:
            if kw in desc_lower:
                found.append(equip)
                break
    return found if found else ["bodyweight"]


def extract_coaching_cues(desc: str) -> list[str]:
    cues = []

    sentences = re.split(r'[.!]\s+', desc)
    for sent in sentences:
        sent = sent.strip()
        if not sent:
            continue
        cue_patterns = [
            r"(?i)^(make\s+sure|keep|don'?t|ensure|try\s+to|focus\s+on|remember)",
            r"(?i)(should|must|need\s+to|want\s+to)\s",
            r"(?i)(squeeze|engage|activate|control|maintain|drive)",
        ]
        for pat in cue_patterns:
            if re.search(pat, sent):
                clean = sent.strip().rstrip(".!,")
                if 10 < len(clean) < 150:
                    cues.append(clean)
                break

    numbered = re.findall(r'(?:^|\s)(\d+)\.\s*([^.0-9]+)', desc)
    for _, item in numbered[:5]:
        item = item.strip().rstrip(".!,")
        if 5 < len(item) < 150:
            cues.append(item)

    return cues[:5]


NAME_NORMALIZATIONS = {
    "push up": "Push-Up",
    "pushup": "Push-Up",
    "push-up": "Push-Up",
    "sit up": "Sit-Up",
    "sit-up": "Sit-Up",
    "step up": "Step-Up",
    "step-up": "Step-Up",
    "rdl": "Romanian Deadlift",
    "romanian deadlift": "Romanian Deadlift",
    "coaching tip": None,
    "run": "Treadmill Run",
    "tread": "Treadmill Run",
    "treadmill": "Treadmill Run",
    "rower": "Rowing",
    "rowing": "Rowing",
    "bike": "Bike / Strider",
    "strider": "Bike / Strider",
}


def normalize_name(name: str) -> str | None:
    key = name.lower().strip()
    if key in NAME_NORMALIZATIONS:
        return NAME_NORMALIZATIONS[key]
    return name


def enrich_video(video: dict) -> dict:
    desc = video.get("description", "")

    if not is_exercise_demo(desc):
        video["enrichment"] = {"is_exercise_demo": False}
        return video

    exercise_name = extract_exercise_name(desc)
    if not exercise_name:
        video["enrichment"] = {"is_exercise_demo": False}
        return video

    exercise_name = normalize_name(exercise_name)
    if exercise_name is None:
        video["enrichment"] = {"is_exercise_demo": False}
        return video

    desc_lower = desc.lower()
    info = {"muscle_groups": [], "category": "other", "movement_type": "other"}
    for keyword in sorted(EXERCISE_KEYWORDS.keys(), key=len, reverse=True):
        if keyword in desc_lower:
            info = EXERCISE_KEYWORDS[keyword]
            break

    equipment = extract_equipment(desc)
    coaching_cues = extract_coaching_cues(desc)

    video["enrichment"] = {
        "exercise_name": exercise_name,
        "muscle_groups": info["muscle_groups"],
        "equipment": equipment,
        "category": info["category"],
        "movement_type": info["movement_type"],
        "coaching_cues": coaching_cues,
        "is_exercise_demo": True,
    }
    return video


def main():
    raw_file = sys.argv[1] if len(sys.argv) > 1 else RAW_FILE
    with open(raw_file) as f:
        videos = json.load(f)

    enriched = [enrich_video(v) for v in videos]

    with open(OUTPUT_FILE, "w") as f:
        json.dump(enriched, f, indent=2)

    demo_count = sum(1 for v in enriched if v.get("enrichment", {}).get("is_exercise_demo"))
    print(f"Enriched {len(enriched)} videos ({demo_count} exercise demos) -> {OUTPUT_FILE}")

    demos = [v for v in enriched if v.get("enrichment", {}).get("is_exercise_demo")]
    print(f"\nExercise breakdown by category:")
    cats = {}
    for d in demos:
        cat = d["enrichment"]["category"]
        cats[cat] = cats.get(cat, 0) + 1
    for cat, count in sorted(cats.items(), key=lambda x: -x[1]):
        print(f"  {cat}: {count}")


if __name__ == "__main__":
    main()
