#!/usr/bin/env python3
"""Merge enriched video data and filter to exercise demos only.

Outputs exercises.json ready for the frontend.
"""

import json
import os
import sys

ENRICHED_FILE = os.path.join(os.path.dirname(__file__), "..", "enriched_videos.json")
OUTPUT_FILE = os.path.join(os.path.dirname(__file__), "..", "src", "data", "exercises.json")


def merge_and_filter(enriched_file: str) -> list[dict]:
    with open(enriched_file) as f:
        videos = json.load(f)

    exercises = []
    for video in videos:
        enrichment = video.get("enrichment", {})
        if not enrichment.get("is_exercise_demo", False):
            continue

        exercises.append({
            "id": video.get("id"),
            "url": video.get("url"),
            "source": video.get("source", "tiktok"),
            "thumbnail": video.get("thumbnail", ""),
            "upload_date": video.get("upload_date", ""),
            "description": video.get("description", ""),
            "exercise_name": enrichment.get("exercise_name"),
            "muscle_groups": enrichment.get("muscle_groups", []),
            "equipment": enrichment.get("equipment", []),
            "category": enrichment.get("category", "other"),
            "movement_type": enrichment.get("movement_type", "other"),
            "coaching_cues": enrichment.get("coaching_cues", []),
        })

    exercises.sort(key=lambda x: x.get("exercise_name") or "")
    return exercises


def main():
    enriched_file = sys.argv[1] if len(sys.argv) > 1 else ENRICHED_FILE
    exercises = merge_and_filter(enriched_file)

    os.makedirs(os.path.dirname(OUTPUT_FILE), exist_ok=True)
    with open(OUTPUT_FILE, "w") as f:
        json.dump(exercises, f, indent=2)

    print(f"Filtered to {len(exercises)} exercise demos -> {OUTPUT_FILE}")

    print("\nExercise summary:")
    for ex in exercises:
        print(f"  - {ex['exercise_name']} ({ex['category']}, {', '.join(ex['muscle_groups'])})")


if __name__ == "__main__":
    main()
