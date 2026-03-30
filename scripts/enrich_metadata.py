#!/usr/bin/env python3
"""Enrich raw video metadata with structured exercise data using Claude Haiku API.

Requires ANTHROPIC_API_KEY environment variable.
Install: pip3 install anthropic
"""

import json
import os
import sys
import time

try:
    import anthropic
except ImportError:
    print("Install the Anthropic SDK: pip3 install anthropic")
    sys.exit(1)

RAW_FILE = os.path.join(os.path.dirname(__file__), "..", "raw_videos.json")
OUTPUT_FILE = os.path.join(os.path.dirname(__file__), "..", "enriched_videos.json")

PROMPT_TEMPLATE = """You are parsing TikTok video descriptions from an OrangeTheory fitness coach.
Given the description below, extract structured exercise information.
If the video is NOT an exercise demonstration (e.g., it's a meme, vlog, or promo), set is_exercise_demo to false and leave other fields empty/null.

Description:
"{description}"

Respond with ONLY valid JSON, no markdown fences:
{{
  "exercise_name": string or null,
  "muscle_groups": string[] or [],
  "equipment": string[] or [],
  "category": "upper_body" | "lower_body" | "core" | "full_body" | "cardio" | "mobility" | "other",
  "movement_type": "compound" | "isolation" | "cardio" | "stretch" | "other",
  "coaching_cues": string[] or [],
  "is_exercise_demo": boolean
}}"""


def enrich_video(client: anthropic.Anthropic, description: str) -> dict:
    prompt = PROMPT_TEMPLATE.format(description=description)
    message = client.messages.create(
        model="claude-haiku-4-5-20251001",
        max_tokens=512,
        messages=[{"role": "user", "content": prompt}],
    )
    text = message.content[0].text.strip()
    return json.loads(text)


def main():
    api_key = os.environ.get("ANTHROPIC_API_KEY")
    if not api_key:
        print("Set ANTHROPIC_API_KEY environment variable")
        sys.exit(1)

    client = anthropic.Anthropic(api_key=api_key)

    raw_file = sys.argv[1] if len(sys.argv) > 1 else RAW_FILE
    with open(raw_file) as f:
        videos = json.load(f)

    enriched = []
    for i, video in enumerate(videos):
        desc = video.get("description", "")
        if not desc.strip():
            video["enrichment"] = {"is_exercise_demo": False}
            enriched.append(video)
            continue

        try:
            result = enrich_video(client, desc)
            video["enrichment"] = result
        except Exception as e:
            print(f"  Error enriching {video.get('id')}: {e}")
            video["enrichment"] = {"is_exercise_demo": False, "error": str(e)}

        enriched.append(video)
        if i % 10 == 0:
            print(f"  Enriched {i + 1}/{len(videos)}...")
        time.sleep(0.2)

    with open(OUTPUT_FILE, "w") as f:
        json.dump(enriched, f, indent=2)

    demo_count = sum(1 for v in enriched if v.get("enrichment", {}).get("is_exercise_demo"))
    print(f"Enriched {len(enriched)} videos ({demo_count} exercise demos) -> {OUTPUT_FILE}")


if __name__ == "__main__":
    main()
