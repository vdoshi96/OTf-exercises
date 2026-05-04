#!/usr/bin/env python3
"""Local enrichment of video metadata using keyword/pattern analysis.

No API key needed. Processes descriptions to extract exercise information
using pattern matching and fitness domain knowledge.

Supports both TikTok and Instagram video entries (uses 'source' field).
"""

import json
import os
import re
import sys

RAW_FILE = os.path.join(os.path.dirname(__file__), "..", "raw_videos.json")
RAW_IG_FILE = os.path.join(os.path.dirname(__file__), "..", "raw_instagram_videos.json")
OUTPUT_FILE = os.path.join(os.path.dirname(__file__), "..", "enriched_videos.json")

DEFAULT_CREATOR = {
    "id": "coachingotf",
    "display_name": "Coach Rudy",
    "handle": "coachingotf",
    "profile_url": "https://www.instagram.com/coachingotf/",
}

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
    "scaption": {"muscle_groups": ["shoulders"], "category": "upper_body", "movement_type": "isolation"},

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
    "pull through": {"muscle_groups": ["core", "glutes"], "category": "core", "movement_type": "compound"},

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
    "t-spine": {"muscle_groups": ["thoracic spine", "upper back"], "category": "mobility", "movement_type": "stretch"},
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
    r"(?i)coaching\s+tip!?\s*$",
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

IMPORT_PROMO_NON_DEMO_PATTERNS = [
    r"(?i)\bpre[-\s]?book\b",
    r"(?i)\bbook\s+(your\s+)?(class|classes|session|spot)\b",
    r"(?i)\bspots?\s+(are\s+)?(available|open|left)\b",
    r"(?i)\b(coaching|taking)\s+((the\s+)?\d{1,2}(:\d{2})?\s*(am|pm)|class(es)?)\b",
    r"(?i)\bcome\s+see\s+(me|us)\b",
    r"(?i)\bwho\s+(will|am)\s+i\s+see\b",
    r"(?i)\b(classes|schedule)\s+(are\s+)?back\b",
    r"(?i)\b(back\s+on|on)\s+schedule\b",
    r"(?i)\b(playlist|theme\s+party|glow\s+party)\b",
]

IMPORT_EVENT_NON_DEMO_PATTERNS = [
    r"(?i)\btransformation\s+challenge\b",
    r"(?i)\bdri\s*tri\b",
    r"(?i)\bcapture\s+the\s+flag\b",
    r"(?i)\ball\s+out\s+with\s+aoki\b",
    r"(?i)\borange\s+everest\b",
    r"(?i)\bmarathon\s+month\b",
    r"(?i)\bmayhem\b",
    r"(?i)\btornado\b",
    r"(?i)\b12\s+days\s+of\s+fitness\b",
    r"(?i)\bmember\s+appreciation\b",
    r"(?i)\bbenchmark\b.*\b(tomorrow|today|class|pre[-\s]?book)\b",
    r"(?i)\b(tomorrow|today)\b.*\bbenchmark\b",
]

IMPORT_CONTEXTUAL_STUDIO_PROMO_PATTERNS = [
    r"(?i)\bcatch\s+me\s+if\s+you\s+can\b",
    r"(?i)\bclimbing\s+over\s+rowers\b.*\bbouncing\s+over\s+treadmills\b",
    r"(?i)\binferno\b.*\btomorrow\b",
    r"(?i)\btread\s*50\b.*\bdon'?t\s+miss\b",
    r"(?i)\borange\s+lights\b",
    r"(?i)\botf\s+(friends|crew|champaign)\b",
    r"(?i)\bheart\s+rates?\s+(are\s+)?now\s+tracked\b",
    r"(?i)\btechnology\s+and\s+backed\s+by\s+science\b",
    r"(?i)\bday\s+1\s+tomorrow\b",
    r"(?i)\btomorrow\b.*\b(who'?s\s+(ready|coming)|who\s+is\s+coming|who\s+will\s+i\s+be\s+seeing|don'?t\s+miss|book\s+into|join\s+me|coaching|crush)\b",
    r"(?i)\b(who'?s\s+(ready|coming)|who\s+is\s+coming|who\s+will\s+i\s+be\s+seeing|don'?t\s+miss|book\s+into|join\s+me|coaching|crush)\b.*\btomorrow\b",
    r"(?i)\b(cookie\s+exchange|templates?)\b.*\btomorrow\b",
    r"(?i)\btomorrow\b.*\b(cookie\s+exchange|templates?)\b",
    r"(?i)\bchipping\b.*\b(don'?t\s+miss|tomorrow)\b",
    r"(?i)\b(don'?t\s+miss|tomorrow)\b.*\bchipping\b",
    r"(?i)\bp\.?r\.?'?s\b.*\b(benchmark|proud\s+of\s+everyone)\b",
    r"(?i)\bbenchmark\s+row\b.*\b(proud\s+of\s+everyone|showed\s+up|gave\s+it\s+their\s+all)\b",
    r"(?i)\bdid\s+you\s+really\s+do\s+the\s+full\s+workout\b",
    r"(?i)\bwe\s+are\s+ready\s+to\s+sail\s+into\s+another\s+week\b",
    r"(?i)\bat\s+least\s+\d+\s+days?\s+per\s+week\b.*\bstudio\b",
]

IMPORT_LIFESTYLE_NON_DEMO_PATTERNS = [
    r"(?i)\b(newborn|birth|labor|labour|postpartum)\b",
    r"(?i)\b(baby\s+(is|was|arrived|here|announcement)|welcome\s+(baby|to\s+the\s+world))\b",
    r"(?i)\b(wedding|proposal|honeymoon|vacation|travel recap|travel day|trip recap|event recap)\b",
    r"(?i)\b(bjj|jiu[-\s]?jitsu)\b.*\b(tournament|date night)\b",
    r"(?i)\b(date night|self[-\s]?defense)\b",
    r"(?i)\b(kids'? business|muddy buddies|italian sodas?)\b",
]

IMPORT_CONTEXTUAL_LIFESTYLE_NON_DEMO_PATTERNS = [
    r"(?i)\bpregnan(cy|t)\b",
]

IMPORT_SPORTS_SKILL_NON_DEMO_PATTERNS = [
    r"(?i)\bday\s+\d+\s*/\s*30\s+of\s+making\s+you\s+a\s+college\s+basketball\s+player\b",
    r"(?i)\b(form\s+shoot|shooting\s+gun|no\s+jump\s+threes|free\s+throws?|layup|college\s+basketball|basketball\s+advice|basketball\s+players?|basketball\s+recruiting)\b",
    r"(?i)#(?:basketballdrills|collegebasketballdrills|basketballadvice|basketballplayers|collegebasketballdreams|roadtocollegebasketball)\b",
]

IMPORT_CONTEXTUAL_SPORTS_NON_DEMO_PATTERNS = [
    r"(?i)\b(open\s*gym|hoops?|basketball\s+scene|basketball\s+content)\b",
    r"(?i)\b(5|6)\s*am\s+runs\b.*\b(basketball|comp|hoops?|shot|layup)\b",
    r"(?i)\b(pass|shot|layup|scoring)\b.*\b(basketball|runs|comp|hoops?)\b",
    r"(?i)\bfollow\s+for\s+lifting\s+and\s+basketball\s+content\b",
    r"(?i)#(?:basketball|opengym|hoops|basketballtraining|basketballmotivation)\b",
]

IMPORT_NUTRITION_PRODUCT_NON_DEMO_PATTERNS = [
    r"(?i)\bprotein\s+powder\b",
    r"(?i)\boatmeal\s+recipe\b",
    r"(?i)\brolled\s+oats\b",
    r"(?i)\b(recipe|calories|macros?|protein)\b.*\b(oatmeal|peanut\s+butter|blueberries|supplements?)\b",
    r"(?i)\b(oatmeal|peanut\s+butter|blueberries|supplements?)\b.*\b(recipe|calories|macros?|protein)\b",
    r"(?i)\bsponsor(s|ed)?\s+me\b",
    r"(?i)\bpromote\s+a\s+lot\s+of\s+products\b",
    r"(?i)\b(link|l[ıi]nk)\s+in\s+(my\s+)?(bio|b[ıi]o)\b",
    r"(?i)\bcheck\s+it\s+out\b.*\b(supporting\s+me|link|l[ıi]nk)\b",
    r"(?i)\bcalorie\s+deficit\b",
    r"(?i)\bsingle\s+ingredient\s+foods\b",
    r"(?i)\b(clean\s+up\s+your\s+diet|diet\s+consist|diet\s+help|nutrition\s+advice)\b",
    r"(?i)#(?:diethelp|simplenutrition|simplehabits|nutrition)\b",
]

IMPORT_COACH_WORK_LIFE_NON_DEMO_PATTERNS = [
    r"(?i)\bare\s+you\s+an\s+opener\b",
    r"(?i)\b(opening|closing)\s+coaches\b",
    r"(?i)\bclopens?\b",
    r"(?i)\bsilent\s+studio\b",
    r"(?i)\bclosed?\s+for\s+years\b",
    r"(?i)\blots\s+of\s+prep\s+for\s+the\s+next\s+day\b",
]

IMPORT_OUTDOOR_LIFESTYLE_NON_DEMO_PATTERNS = [
    r"(?i)\bwood\s*chopping\b",
    r"(?i)\bwoodtherapy\b",
    r"(?i)\bpracticing\s+for\s+the\s+end\s+of\s+the\s+world\b",
    r"(?i)#(?:pnw|pnwlife|pnwwonderland|woodchopping|woodtherapy|couple|couplegoals|fitcouple)\b",
]

IMPORT_NEAR_EMPTY_NON_DEMO_PATTERNS = [
    r"(?i)^helpful\??$",
    r"(?i)^we\s+did\s+it!?$",
    r"(?i)^today\s+was\s+a\s+big\s+day$",
]

IMPORT_INSTRUCTION_SIGNAL_PATTERNS = [
    r"(?i)\bhow\s+to\s+(properly\s+)?(perform|do|fix|improve|regress|progress|set\s*up|row|run|squat|lunge|push|pull|press|hinge|lift|deadlift|brace|move)\b",
    r"(?i)\b(form|form\s+check|technique|execution|breakdown)\b",
    r"(?i)\b(row|rowing|run|running|squat|lunge|pushup|push-up|deadlift|trx|burpee|plank|press|hinge|exercise|movement)\s+set\s*up\b",
    r"(?i)\bset\s*up\s+(your|the)\s+(rower|treadmill|trx|bench|stance|feet|hands|body|movement|exercise)\b",
    r"(?i)\b(reps|\d+\s+sets|sets?\s+of\s+\d+|tempo|eccentric|concentric)\b",
    r"(?i)\b(engage|squeeze|contract|activate|maintain|brace)\b",
    r"(?i)\bdrive\s+(with|through|your|the)\s+(knees?|legs?|floor|heels?|feet|hips?)\b",
    r"(?i)\bcontrol\s+(the|your|each|every)\s+(motion|rep|reps|weight|movement|body)\b",
    r"(?i)\bhip\s+hinge\b",
    r"(?i)\bkeep\s+(your|the)\s+(knee|knees|hips?|back|chest|shoulders?|elbows?|feet|hands|core|spine|torso|body|heels?)\b",
    r"(?i)\bmake\s+sure\s+(your|the)\s+(knee|knees|hips?|back|chest|shoulders?|elbows?|feet|hands|core)\b",
    r"(?i)\bdon'?t\s+(let|allow|swing|round|arch|drop|bend)\b",
    r"(?i)\b(cue|cues|tips|tip\s+of\s+the\s+day|tutorial|mistakes?|avoid|try\s+this|drill|fix|improve)\b",
    r"(?i)\bdo\s+not\s+(lift|let|allow|overstride|round|swing|arch|bend|drop)\b",
    r"(?i)\bfeet\s+(wide|close)\b",
    r"(?i)\bprotects?\s+your\s+lower\s+back\b",
]

IMPORT_HASHTAG_ONLY_DEMO_TERMS = re.compile(
    r"(?i)\b(workout|fitness|exercise|form|formcheck|technique|exercisetechnique|coach|coaching|tips?)\b"
)

IMPORT_VISIBLE_GENERIC_FITNESS_TERMS = {
    "bike",
    "row",
    "rower",
    "rowing",
    "run",
    "strider",
    "stretch",
    "tread",
    "treadmill",
}

IMPORT_VISIBLE_DEMO_TITLE_PATTERNS = [
    r"(?i)\b(secret|truth|reason|mistakes?|tips?|tutorial|guide|how\s+to|form|technique|breakdown)\b.*\b({exercise})\b",
    r"(?i)\b({exercise})\b.*\b(secret|truth|reason|mistakes?|tips?|tutorial|guide|form|technique|breakdown)\b",
    r"(?i)\b(pain|hurts?|struggle|hard|hate|better|fix|avoid|regress|progress)\b.*\b({exercise})\b",
    r"(?i)\b({exercise})\b.*\b(pain|hurts?|struggle|hard|hate|better|fix|avoid|regress|progress)\b",
    r"(?i)\b({exercise})s?\s+(are|is|can|will|should|during|for)\b",
    r"(?i)\b(should|can|will|during|for)\s+(your\s+)?\b({exercise})s?\b",
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


def is_non_legacy_instagram_creator(video: dict) -> bool:
    """Identify imported Instagram creators outside the legacy coachingotf path."""
    creator = video.get("creator")
    creator_id = creator.get("id") if isinstance(creator, dict) else None
    return video.get("source") == "instagram" and bool(creator_id) and creator_id != "coachingotf"


def has_import_instruction_signal(desc: str) -> bool:
    """Detect captions that are likely giving exercise instruction, not only promoting an event."""
    return any(re.search(pattern, desc) for pattern in IMPORT_INSTRUCTION_SIGNAL_PATTERNS)


def get_visible_caption(desc: str) -> str:
    """Return caption text before hashtags."""
    return re.split(r'#', desc, maxsplit=1)[0].strip()


def get_visible_first_line(desc: str) -> str:
    """Return the first visible caption line with emoji/punctuation normalized."""
    visible_caption = get_visible_caption(desc)
    lines = [line.strip() for line in visible_caption.splitlines() if line.strip()]
    if not lines:
        return ""
    first_line = re.sub(r"[^\w\s?'-]", " ", lines[0])
    first_line = re.sub(r"\s+", " ", first_line)
    return first_line.strip(" .!?\n\t")


def has_import_visible_exercise_demo_signal(desc: str) -> bool:
    """Require visible demo-like exercise language, not hashtag/generic fitness noise."""
    visible_caption = get_visible_caption(desc)
    if not visible_caption:
        return False

    first_line = get_visible_first_line(desc)
    visible_lower = visible_caption.lower()

    for keyword in sorted(EXERCISE_KEYWORDS, key=len, reverse=True):
        if keyword in IMPORT_VISIBLE_GENERIC_FITNESS_TERMS:
            continue
        if keyword not in visible_lower:
            continue

        exercise = re.escape(keyword)
        for pattern in IMPORT_VISIBLE_DEMO_TITLE_PATTERNS:
            if re.search(pattern.format(exercise=exercise), first_line):
                return True

    if re.search(r"(?i)\b(row|rowing|rower|run|running|treadmill|tread|incline)\b", visible_caption):
        return bool(re.search(
            r"(?i)\b(tips?|tutorial|form|technique|strategy|cue|mistakes?|avoid|fix|improve|overstrid|sprinting|stroke|incline-focused)\b",
            visible_caption,
        ))

    return False


def normalize_near_empty_caption(desc: str) -> str:
    """Strip hashtags, emoji/punctuation, and CTA filler from short caption checks."""
    visible_caption = get_visible_caption(desc)
    visible_caption = re.sub(r"(?i)\bfollow\s+for\s+more\b", " ", visible_caption)
    visible_caption = re.sub(r"[^\w\s?]", " ", visible_caption)
    visible_caption = re.sub(r"\s+", " ", visible_caption)
    return visible_caption.strip(" .!?\n\t")


def has_hashtag_only_demo_terms(desc: str) -> bool:
    hashtags_text = " ".join(re.findall(r'#(\w+)', desc))
    return bool(IMPORT_HASHTAG_ONLY_DEMO_TERMS.search(hashtags_text)) or has_exercise_keyword(hashtags_text)


def is_import_quality_non_demo(video: dict) -> bool:
    """Reject obvious non-demo imports for new Instagram creators without touching legacy/TikTok."""
    if not is_non_legacy_instagram_creator(video):
        return False

    desc = video.get("description", "")
    if not desc:
        return False

    if any(re.search(pattern, desc) for pattern in IMPORT_PROMO_NON_DEMO_PATTERNS):
        return True

    has_instruction = has_import_instruction_signal(desc)

    if not has_instruction and any(re.search(pattern, desc) for pattern in IMPORT_EVENT_NON_DEMO_PATTERNS):
        return True

    if not has_instruction and any(re.search(pattern, desc) for pattern in IMPORT_CONTEXTUAL_STUDIO_PROMO_PATTERNS):
        return True

    if any(re.search(pattern, desc) for pattern in IMPORT_LIFESTYLE_NON_DEMO_PATTERNS):
        return True

    if any(re.search(pattern, desc) for pattern in IMPORT_SPORTS_SKILL_NON_DEMO_PATTERNS):
        return True

    if not has_instruction and any(re.search(pattern, desc) for pattern in IMPORT_CONTEXTUAL_SPORTS_NON_DEMO_PATTERNS):
        return True

    if any(re.search(pattern, desc) for pattern in IMPORT_NUTRITION_PRODUCT_NON_DEMO_PATTERNS):
        return True

    if any(re.search(pattern, desc) for pattern in IMPORT_COACH_WORK_LIFE_NON_DEMO_PATTERNS):
        return True

    if any(re.search(pattern, desc) for pattern in IMPORT_OUTDOOR_LIFESTYLE_NON_DEMO_PATTERNS):
        return True

    if not has_instruction and any(re.search(pattern, desc) for pattern in IMPORT_CONTEXTUAL_LIFESTYLE_NON_DEMO_PATTERNS):
        return True

    visible_caption = normalize_near_empty_caption(desc)
    if (
        len(visible_caption) <= 40
        and not has_exercise_keyword(visible_caption)
        and has_hashtag_only_demo_terms(desc)
        and any(re.search(pattern, visible_caption) for pattern in IMPORT_NEAR_EMPTY_NON_DEMO_PATTERNS)
    ):
        return True

    if not has_instruction and not has_import_visible_exercise_demo_signal(desc):
        return True

    return False


def get_first_line(desc: str) -> str:
    """Extract the first meaningful line from a description, stripping hashtags."""
    text = re.split(r'#', desc, maxsplit=1)[0].strip()
    line = re.split(r'[.!?\n]', text, maxsplit=1)[0].strip()
    line = re.sub(r'\s+', ' ', line)
    return line


def has_exercise_keyword(text: str) -> bool:
    """Check if text contains at least one exercise keyword."""
    text_lower = text.lower()
    return any(kw in text_lower for kw in EXERCISE_KEYWORDS)


def extract_exercise_name(desc: str) -> str | None:
    first_line = get_first_line(desc)

    if 3 <= len(first_line) <= 80 and has_exercise_keyword(first_line):
        return first_line

    desc_lower = desc.lower()
    best_match = None
    best_len = 0
    for keyword in sorted(EXERCISE_KEYWORDS.keys(), key=len, reverse=True):
        if keyword in desc_lower and len(keyword) > best_len:
            best_match = keyword
            best_len = len(keyword)

    if best_match:
        if 3 <= len(first_line) <= 80:
            return first_line
        return best_match.title()

    if 3 <= len(first_line) <= 60:
        return first_line

    return None


def classify_exercise(desc: str) -> dict:
    """Get category/muscle/movement classification from keyword match."""
    desc_lower = desc.lower()
    for keyword in sorted(EXERCISE_KEYWORDS.keys(), key=len, reverse=True):
        if keyword in desc_lower:
            return EXERCISE_KEYWORDS[keyword]
    return {"muscle_groups": [], "category": "other", "movement_type": "other"}


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


def enrich_video(video: dict) -> dict:
    desc = video.get("description", "")

    if is_import_quality_non_demo(video):
        video["enrichment"] = {"is_exercise_demo": False}
        return video

    if not is_exercise_demo(desc):
        video["enrichment"] = {"is_exercise_demo": False}
        return video

    exercise_name = extract_exercise_name(desc)
    if not exercise_name:
        video["enrichment"] = {"is_exercise_demo": False}
        return video

    info = classify_exercise(desc)
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


def ensure_creator(video: dict) -> dict:
    """Preserve existing creator metadata and backfill legacy records."""
    if not video.get("creator"):
        video["creator"] = dict(DEFAULT_CREATOR)
    return video


def load_combined_raw() -> list[dict]:
    """Load TikTok + Instagram raw data, adding source field."""
    videos = []

    if os.path.exists(RAW_FILE):
        with open(RAW_FILE) as f:
            tiktok = json.load(f)
        for v in tiktok:
            v.setdefault("source", "tiktok")
            ensure_creator(v)
            videos.append(v)
        print(f"  Loaded {len(tiktok)} TikTok videos")

    if os.path.exists(RAW_IG_FILE):
        with open(RAW_IG_FILE) as f:
            instagram = json.load(f)
        for v in instagram:
            v.setdefault("source", "instagram")
            ensure_creator(v)
            videos.append(v)
        print(f"  Loaded {len(instagram)} Instagram videos")

    if not videos:
        print("No raw video files found!")
    return videos


def main():
    print("Loading raw video data...")
    videos = load_combined_raw()

    enriched = [enrich_video(v) for v in videos]

    with open(OUTPUT_FILE, "w") as f:
        json.dump(enriched, f, indent=2)

    demo_count = sum(1 for v in enriched if v.get("enrichment", {}).get("is_exercise_demo"))
    print(f"\nEnriched {len(enriched)} videos ({demo_count} exercise demos) -> {OUTPUT_FILE}")

    demos = [v for v in enriched if v.get("enrichment", {}).get("is_exercise_demo")]
    print(f"\nExercise breakdown by category:")
    cats = {}
    for d in demos:
        cat = d["enrichment"]["category"]
        cats[cat] = cats.get(cat, 0) + 1
    for cat, count in sorted(cats.items(), key=lambda x: -x[1]):
        print(f"  {cat}: {count}")

    names = set(d["enrichment"]["exercise_name"] for d in demos)
    print(f"\nUnique exercise names: {len(names)}")


if __name__ == "__main__":
    main()
