#!/usr/bin/env python3
"""Review and correct enrichment of Instagram posts.

Coach Rudy's Instagram captions are often just the exercise name (e.g.
"Back Extension", "Sumo Squat") which the keyword enricher misses because
it needs multiple signal hits. This script reclassifies false negatives
by recognizing the @coachingotf caption pattern: short title = exercise name.
"""

import json
import os
import re

ENRICHED_FILE = os.path.join(os.path.dirname(__file__), "..", "enriched_videos.json")

TRUE_NON_DEMO_PATTERNS = [
    r"(?i)transformation\s+challenge",
    r"(?i)dri[- ]?tri",
    r"(?i)hell\s*week",
    r"(?i)(happy|merry)\s+(halloween|thanksgiving|christmas|holiday|birthday|new\s+year|mother|father|valentine|easter)",
    r"(?i)national\s+coaches?\s+day",
    r"(?i)veteran'?s?\s+day",
    r"(?i)marine\s+corps\s+bday",
    r"(?i)OTFit\s+(coach\s+)?training",
    r"(?i)launch\s+(illinois|michigan|florida|texas|california|new\s+york)",
    r"(?i)coach\s+training\s+\(?aka\s+launch",
    r"(?i)(first|newest)\s+(crew|group|class)\s+to\s+go\s+through",
    r"(?i)congrats\s+to\s+the\s+newest",
    r"(?i)(TRX|suspension)\s+(training|certification)\s+course",
    r"(?i)hype\s+class",
    r"(?i)fitness\s+workshop",
    r"(?i)check-?\s*in",
    r"(?i)halfway\s+check",
    r"(?i)I'?ve\s+wanted\s+to\s+move",
    r"(?i)I\s+got\s+the\s+chance\s+to\s+take",
    r"(?i)coaching\s+tip!?\s*$",
    r"(?i)^\"?coaches\"?$",
    r"(?i)what\s+does\s+a\s+\w+\s+work\??",
    r"(?i)gaming\s+\"?inferno\"?",
    r"(?i)cluster\s+sets$",
    r"(?i)proximity\s+to\s+the\s+console",
    r"(?i)know\s+your\s+athletes",
    r"(?i)don'?t\s+disrespect",
    r"(?i)we\s+need\s+to\s+(lean|use)",
    r"(?i)^(people|disclaimer|sorry|usually|first,|in\s+launch|you\s+can\s+give|best\s+way\s+to\s+get)",
    r"(?i)slow\s+tempo$",
    r"(?i)strength\s+dri[- ]?tri\s+ROM",
    r"(?i)basic\s+guide\s+to",
    r"(?i)catch\s+me\s+if\s+you\s+can",
]

EXERCISE_KEYWORDS_EXTRA = {
    "airplane": {"muscle_groups": ["glutes", "core"], "category": "lower_body", "movement_type": "compound"},
    "toe tap": {"muscle_groups": ["core", "hip flexors"], "category": "core", "movement_type": "isolation"},
    "back extension": {"muscle_groups": ["lower back", "glutes"], "category": "upper_body", "movement_type": "isolation"},
    "deadbug": {"muscle_groups": ["core", "abs"], "category": "core", "movement_type": "isolation"},
    "dead bug": {"muscle_groups": ["core", "abs"], "category": "core", "movement_type": "isolation"},
    "power skip": {"muscle_groups": ["quads", "glutes", "calves"], "category": "cardio", "movement_type": "cardio"},
    "shuffle": {"muscle_groups": ["quads", "glutes"], "category": "cardio", "movement_type": "cardio"},
    "lateral shift": {"muscle_groups": ["quads", "glutes", "core"], "category": "lower_body", "movement_type": "compound"},
    "step over": {"muscle_groups": ["quads", "glutes", "hip flexors"], "category": "lower_body", "movement_type": "compound"},
    "knee drive": {"muscle_groups": ["core", "hip flexors", "quads"], "category": "core", "movement_type": "compound"},
    "downdog": {"muscle_groups": ["shoulders", "hamstrings", "calves"], "category": "mobility", "movement_type": "stretch"},
    "bound": {"muscle_groups": ["quads", "glutes", "calves"], "category": "lower_body", "movement_type": "compound"},
    "pick-up": {"muscle_groups": ["full body"], "category": "full_body", "movement_type": "compound"},
    "pick up": {"muscle_groups": ["full body"], "category": "full_body", "movement_type": "compound"},
    "halo": {"muscle_groups": ["shoulders", "core"], "category": "upper_body", "movement_type": "compound"},
    "farmer": {"muscle_groups": ["core", "grip", "shoulders"], "category": "full_body", "movement_type": "compound"},
    "march": {"muscle_groups": ["core", "hip flexors"], "category": "core", "movement_type": "compound"},
    "rainbow": {"muscle_groups": ["shoulders", "core"], "category": "upper_body", "movement_type": "compound"},
    "heisman": {"muscle_groups": ["quads", "glutes", "core"], "category": "cardio", "movement_type": "cardio"},
    "sit up": {"muscle_groups": ["abs", "hip flexors"], "category": "core", "movement_type": "isolation"},
    "sit-up": {"muscle_groups": ["abs", "hip flexors"], "category": "core", "movement_type": "isolation"},
    "good morning": {"muscle_groups": ["hamstrings", "glutes", "lower back"], "category": "lower_body", "movement_type": "compound"},
    "crab": {"muscle_groups": ["core", "shoulders", "triceps"], "category": "core", "movement_type": "compound"},
    "superhero": {"muscle_groups": ["lower back", "glutes"], "category": "core", "movement_type": "isolation"},
    "cobra": {"muscle_groups": ["lower back", "core"], "category": "mobility", "movement_type": "stretch"},
    "arnold press": {"muscle_groups": ["shoulders", "triceps"], "category": "upper_body", "movement_type": "compound"},
    "press": {"muscle_groups": ["shoulders", "chest", "triceps"], "category": "upper_body", "movement_type": "compound"},
    "bridge": {"muscle_groups": ["glutes", "hamstrings"], "category": "lower_body", "movement_type": "compound"},
    "hop over": {"muscle_groups": ["quads", "calves", "core"], "category": "cardio", "movement_type": "cardio"},
    "walkout": {"muscle_groups": ["core", "shoulders"], "category": "core", "movement_type": "compound"},
    "alligator": {"muscle_groups": ["core", "shoulders"], "category": "core", "movement_type": "compound"},
    "reach": {"muscle_groups": ["core", "shoulders"], "category": "core", "movement_type": "compound"},
    "rotation": {"muscle_groups": ["core", "obliques"], "category": "core", "movement_type": "compound"},
    "chop": {"muscle_groups": ["obliques", "core", "shoulders"], "category": "core", "movement_type": "compound"},
    "lift": {"muscle_groups": ["obliques", "core", "shoulders"], "category": "core", "movement_type": "compound"},
    "hyperextension": {"muscle_groups": ["lower back", "glutes"], "category": "core", "movement_type": "isolation"},
    "v-up": {"muscle_groups": ["abs", "hip flexors"], "category": "core", "movement_type": "isolation"},
    "jack press": {"muscle_groups": ["shoulders", "legs"], "category": "full_body", "movement_type": "compound"},
    "fast feet": {"muscle_groups": ["quads", "calves"], "category": "cardio", "movement_type": "cardio"},
    "toe reach": {"muscle_groups": ["abs", "core"], "category": "core", "movement_type": "isolation"},
    "leg raise": {"muscle_groups": ["abs", "hip flexors"], "category": "core", "movement_type": "isolation"},
    "hip airplane": {"muscle_groups": ["glutes", "core"], "category": "lower_body", "movement_type": "compound"},
    "uppercut": {"muscle_groups": ["shoulders", "core"], "category": "upper_body", "movement_type": "compound"},
    "swing": {"muscle_groups": ["glutes", "hamstrings", "core"], "category": "full_body", "movement_type": "compound"},
    "skier": {"muscle_groups": ["glutes", "hamstrings", "core"], "category": "full_body", "movement_type": "compound"},
    "tall kneeling": {"muscle_groups": ["core", "glutes"], "category": "core", "movement_type": "compound"},
    "kneeling": {"muscle_groups": ["core", "glutes"], "category": "core", "movement_type": "compound"},
    "incline": {"muscle_groups": ["quads", "calves", "hamstrings"], "category": "cardio", "movement_type": "cardio"},
    "speed skater": {"muscle_groups": ["quads", "glutes"], "category": "lower_body", "movement_type": "compound"},
    "squeezer": {"muscle_groups": ["core", "abs"], "category": "core", "movement_type": "isolation"},
    "around the world": {"muscle_groups": ["shoulders"], "category": "upper_body", "movement_type": "isolation"},
    "rollout": {"muscle_groups": ["core", "abs"], "category": "core", "movement_type": "isolation"},
    "step-down": {"muscle_groups": ["quads", "glutes"], "category": "lower_body", "movement_type": "compound"},
}

EQUIPMENT_KEYWORDS = {
    "dumbbell": ["dumbbell", "db", "dumbbells", "dbs"],
    "TRX straps": ["trx", "strap", "straps", "suspension"],
    "bench": ["bench", "low bench"],
    "bosu": ["bosu", "bosu ball"],
    "mini band": ["mini band", "low band", "mid band"],
    "resistance band": ["band", "resistance band"],
    "medicine ball": ["medicine ball", "med ball"],
    "y-bell": ["y-bell", "y bell", "ybell"],
    "ab dolly": ["ab dolly", "dolly"],
    "foam roller": ["foam roll", "foam roller"],
    "barbell": ["barbell"],
    "kettlebell": ["kettlebell", "kb"],
    "bodyweight": [],
}


def classify_extra(desc: str) -> dict | None:
    desc_lower = desc.lower()
    for keyword in sorted(EXERCISE_KEYWORDS_EXTRA.keys(), key=len, reverse=True):
        if keyword in desc_lower:
            return EXERCISE_KEYWORDS_EXTRA[keyword]
    return None


def extract_equipment(desc: str) -> list[str]:
    desc_lower = desc.lower()
    found = []
    for equip, keywords in EQUIPMENT_KEYWORDS.items():
        if equip == "bodyweight":
            continue
        for kw in keywords:
            if kw in desc_lower:
                found.append(equip)
                break
    return found if found else ["bodyweight"]


def is_true_non_demo(desc: str) -> bool:
    """Check if a post is definitely NOT an exercise demo."""
    for pattern in TRUE_NON_DEMO_PATTERNS:
        if re.search(pattern, desc):
            return True
    if len(desc.strip()) < 3:
        return True
    return False


def is_legacy_coachingotf_instagram_record(video: dict) -> bool:
    """Limit Instagram caption corrections to legacy Coach Rudy/coachingotf data."""
    if video.get("source") != "instagram":
        return False

    creator = video.get("creator")
    creator_id = creator.get("id") if isinstance(creator, dict) else None
    return creator_id in (None, "", "coachingotf")


def get_exercise_name(desc: str) -> str:
    """Extract exercise name from the first line of the caption."""
    text = re.split(r'[#\n]', desc, maxsplit=1)[0].strip()
    line = re.split(r'[.!?]', text, maxsplit=1)[0].strip()
    line = re.sub(r'\s+', ' ', line)
    # Remove leading quotes
    line = line.strip('""\'"')
    if 3 <= len(line) <= 100:
        return line
    return desc[:80].strip()


def main():
    with open(ENRICHED_FILE) as f:
        data = json.load(f)

    ig_non_demos = [
        v for v in data
        if is_legacy_coachingotf_instagram_record(v)
        and not v.get("enrichment", {}).get("is_exercise_demo")
    ]

    reclassified = 0
    kept_non_demo = 0

    for v in ig_non_demos:
        desc = v.get("description", "")

        if is_true_non_demo(desc):
            kept_non_demo += 1
            continue

        # This is likely an exercise demo — reclassify it
        name = get_exercise_name(desc)
        info = classify_extra(desc)

        if info:
            v["enrichment"] = {
                "exercise_name": name,
                "muscle_groups": info["muscle_groups"],
                "equipment": extract_equipment(desc),
                "category": info["category"],
                "movement_type": info["movement_type"],
                "coaching_cues": [],
                "is_exercise_demo": True,
            }
        else:
            v["enrichment"] = {
                "exercise_name": name,
                "muscle_groups": [],
                "equipment": extract_equipment(desc),
                "category": "other",
                "movement_type": "other",
                "coaching_cues": [],
                "is_exercise_demo": True,
            }
        reclassified += 1

    with open(ENRICHED_FILE, "w") as f:
        json.dump(data, f, indent=2)

    demos = sum(1 for v in data if v.get("enrichment", {}).get("is_exercise_demo"))
    print(f"Corrections applied:")
    print(f"  Reclassified as exercise demos: {reclassified}")
    print(f"  Confirmed non-demos: {kept_non_demo}")
    print(f"  Total exercise demos now: {demos}")


if __name__ == "__main__":
    main()
