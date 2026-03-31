#!/usr/bin/env python3
"""Group flat exercise entries by exercise_name into a grouped format.

Input: src/data/exercises.json (flat, from merge_and_filter.py)
Output: src/data/exercises.json (grouped, with videos array)
"""

import json
import os
import re
import sys
from collections import defaultdict
from difflib import SequenceMatcher

PROJECT_DIR = os.path.join(os.path.dirname(__file__), "..")
INPUT_FILE = os.path.join(PROJECT_DIR, "src", "data", "exercises_flat.json")
OUTPUT_FILE = os.path.join(PROJECT_DIR, "src", "data", "exercises.json")


def slugify(name: str) -> str:
    slug = name.lower().strip()
    slug = re.sub(r'[^a-z0-9\s-]', '', slug)
    slug = re.sub(r'[\s-]+', '-', slug)
    slug = slug.strip('-')
    return slug[:80] or "unknown"


def slug_similarity(a: str, b: str) -> float:
    return SequenceMatcher(None, slugify(a), slugify(b)).ratio()


def find_best_match(name: str, existing_names: list[str]) -> tuple[str | None, float]:
    """Find the best matching existing exercise name by slug similarity."""
    best_name = None
    best_score = 0.0
    slug_a = slugify(name)
    for existing in existing_names:
        if slugify(existing) == slug_a:
            return existing, 1.0
        score = SequenceMatcher(None, slug_a, slugify(existing)).ratio()
        if score > best_score:
            best_score = score
            best_name = existing
    return best_name, best_score


def group_exercises(flat_exercises: list[dict]) -> list[dict]:
    groups: dict[str, list[dict]] = defaultdict(list)

    merge_log: list[str] = []
    review_log: list[str] = []
    stats = {"exact": 0, "fuzzy": 0, "new": 0, "review": 0}

    for ex in flat_exercises:
        name = ex.get("exercise_name", "Unknown")
        existing_names = list(groups.keys())

        if name in groups:
            groups[name].append(ex)
            stats["exact"] += 1
            continue

        match_name, score = find_best_match(name, existing_names)

        if score >= 0.85:
            merge_log.append(f"MERGE: '{slugify(name)}' -> '{slugify(match_name)}' ({score:.0%})")
            groups[match_name].append(ex)
            stats["fuzzy"] += 1
        elif score >= 0.70:
            review_log.append(
                f"REVIEW: '{slugify(name)}' vs '{slugify(match_name)}' ({score:.0%}) — kept separate"
            )
            groups[name].append(ex)
            stats["review"] += 1
        else:
            groups[name].append(ex)
            stats["new"] += 1

    if merge_log:
        print(f"\nFuzzy merges ({len(merge_log)}):")
        for line in merge_log:
            print(f"  {line}")

    if review_log:
        print(f"\nNear matches kept separate ({len(review_log)}):")
        for line in review_log:
            print(f"  {line}")

    print(f"\nGrouping stats: {stats['exact']} exact, {stats['fuzzy']} fuzzy-merged, "
          f"{stats['review']} near-match (kept separate), {stats['new']} new")

    grouped = []
    for name, entries in groups.items():
        first = entries[0]

        all_muscle_groups: list[str] = []
        all_equipment: list[str] = []
        all_cues: list[str] = []
        seen_mg = set()
        seen_eq = set()
        seen_cues = set()

        for e in entries:
            for mg in e.get("muscle_groups", []):
                if mg not in seen_mg:
                    all_muscle_groups.append(mg)
                    seen_mg.add(mg)
            for eq in e.get("equipment", []):
                if eq not in seen_eq:
                    all_equipment.append(eq)
                    seen_eq.add(eq)
            for cue in e.get("coaching_cues", []):
                cue_key = cue.lower().strip()
                if cue_key not in seen_cues:
                    all_cues.append(cue)
                    seen_cues.add(cue_key)

        videos = []
        for e in entries:
            videos.append({
                "id": e["id"],
                "url": e["url"],
                "source": e.get("source", "tiktok"),
                "thumbnail": e.get("thumbnail", ""),
                "description": e.get("description", ""),
            })

        grouped.append({
            "id": slugify(name),
            "exercise_name": name,
            "category": first.get("category", "other"),
            "muscle_groups": all_muscle_groups,
            "equipment": all_equipment,
            "movement_type": first.get("movement_type", "other"),
            "coaching_cues": all_cues[:10],
            "videos": videos,
        })

    grouped.sort(key=lambda x: x["exercise_name"].lower())

    seen_ids = set()
    for g in grouped:
        while g["id"] in seen_ids:
            g["id"] = g["id"] + "-2"
        seen_ids.add(g["id"])

    return grouped


def main():
    flat_file = os.path.join(PROJECT_DIR, "src", "data", "exercises.json")
    if os.path.exists(INPUT_FILE):
        flat_file = INPUT_FILE

    with open(flat_file) as f:
        flat_exercises = json.load(f)

    if flat_exercises and "videos" in flat_exercises[0]:
        print("Input already looks grouped. Skipping.")
        return

    backup = flat_file.replace(".json", "_flat.json")
    if not os.path.exists(backup):
        with open(backup, "w") as f:
            json.dump(flat_exercises, f, indent=2)
        print(f"Backed up flat data to {backup}")

    grouped = group_exercises(flat_exercises)

    os.makedirs(os.path.dirname(OUTPUT_FILE), exist_ok=True)
    with open(OUTPUT_FILE, "w") as f:
        json.dump(grouped, f, indent=2)

    total_videos = sum(len(g["videos"]) for g in grouped)
    multi = sum(1 for g in grouped if len(g["videos"]) > 1)
    print(f"Grouped {total_videos} videos into {len(grouped)} exercises -> {OUTPUT_FILE}")
    print(f"  {multi} exercises have multiple videos")

    print(f"\nTop exercises by video count:")
    for g in sorted(grouped, key=lambda x: -len(x["videos"]))[:15]:
        sources = set(v["source"] for v in g["videos"])
        src_str = "+".join(sorted(sources))
        print(f"  {g['exercise_name']} ({len(g['videos'])} videos, {src_str})")


if __name__ == "__main__":
    main()
