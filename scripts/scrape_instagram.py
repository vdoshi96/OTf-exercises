#!/usr/bin/env python3
"""Scrape Instagram reels/video metadata from @coachingotf using instaloader.

Outputs raw_instagram_videos.json with the same shape as raw_videos.json
but with source="instagram".

Usage:
  python3 scripts/scrape_instagram.py                    # prompts for login
  python3 scripts/scrape_instagram.py --user YOUR_USER   # login as specific user
"""

import argparse
import json
import os
import sys

try:
    import instaloader
except ImportError:
    print("Install instaloader: pip3 install instaloader --break-system-packages")
    sys.exit(1)

PROFILE = "coachingotf"
OUTPUT_FILE = os.path.join(os.path.dirname(__file__), "..", "raw_instagram_videos.json")


def scrape_profile(username: str | None = None) -> list[dict]:
    L = instaloader.Instaloader(
        download_pictures=False,
        download_videos=False,
        download_video_thumbnails=False,
        download_geotags=False,
        download_comments=False,
        save_metadata=False,
        compress_json=False,
    )

    if username:
        try:
            L.load_session_from_file(username)
            print(f"Loaded saved session for {username}")
        except FileNotFoundError:
            print(f"No saved session found. Logging in as {username}...")
            L.interactive_login(username)
            L.save_session_to_file()
            print("Session saved for future runs.")
    else:
        print("WARNING: Running without login. Instagram may block requests.")
        print("For reliable scraping, use: python3 scrape_instagram.py --user YOUR_USERNAME")

    print(f"Loading profile: {PROFILE}")
    profile = instaloader.Profile.from_username(L.context, PROFILE)
    print(f"Profile loaded: {profile.full_name} ({profile.mediacount} posts)")

    videos = []
    count = 0
    for post in profile.get_posts():
        count += 1
        if count % 25 == 0:
            print(f"  Processed {count} posts ({len(videos)} videos)...")

        if not post.is_video:
            continue

        caption = post.caption or ""
        shortcode = post.shortcode

        url = f"https://www.instagram.com/reel/{shortcode}/"
        if post.typename == "GraphSidecar":
            url = f"https://www.instagram.com/p/{shortcode}/"

        videos.append({
            "id": f"ig_{shortcode}",
            "url": url,
            "description": caption,
            "thumbnail": str(post.url) if post.url else "",
            "duration": post.video_duration or 0,
            "timestamp": int(post.date_utc.timestamp()) if post.date_utc else 0,
            "upload_date": post.date_utc.strftime("%Y%m%d") if post.date_utc else "",
            "source": "instagram",
        })

    print(f"\nTotal posts scanned: {count}")
    print(f"Videos/reels found: {len(videos)}")
    return videos


def main():
    parser = argparse.ArgumentParser(description="Scrape Instagram reels from @coachingotf")
    parser.add_argument("--user", "-u", help="Instagram username for login")
    args = parser.parse_args()

    videos = scrape_profile(args.user)

    with open(OUTPUT_FILE, "w") as f:
        json.dump(videos, f, indent=2)

    print(f"Saved {len(videos)} videos -> {OUTPUT_FILE}")


if __name__ == "__main__":
    main()
