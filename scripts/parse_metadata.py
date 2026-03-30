#!/usr/bin/env python3
"""Parse yt-dlp .info.json files into a unified raw_videos.json."""

import json
import glob
import os
import sys

METADATA_DIR = os.path.join(os.path.dirname(__file__), "..", "metadata")
OUTPUT_FILE = os.path.join(os.path.dirname(__file__), "..", "raw_videos.json")


def parse_info_files(metadata_dir: str) -> list[dict]:
    files = glob.glob(os.path.join(metadata_dir, "*.info.json"))
    if not files:
        print(f"No .info.json files found in {metadata_dir}")
        return []

    videos = []
    for filepath in sorted(files):
        with open(filepath) as f:
            data = json.load(f)
        videos.append({
            "id": data.get("id"),
            "url": data.get("webpage_url"),
            "description": data.get("description", ""),
            "thumbnail": data.get("thumbnail", ""),
            "duration": data.get("duration", 0),
            "timestamp": data.get("timestamp", 0),
            "upload_date": data.get("upload_date", ""),
        })

    return videos


def main():
    metadata_dir = sys.argv[1] if len(sys.argv) > 1 else METADATA_DIR
    videos = parse_info_files(metadata_dir)

    with open(OUTPUT_FILE, "w") as f:
        json.dump(videos, f, indent=2)

    print(f"Parsed {len(videos)} videos -> {OUTPUT_FILE}")


if __name__ == "__main__":
    main()
