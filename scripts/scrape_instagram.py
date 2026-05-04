#!/usr/bin/env python3
"""Scrape Instagram reels/video metadata from target profiles using instaloader.

Uses timeout-protected strategies to avoid getting stuck in Instagram's
429 rate-limit retry loops. Falls back to discovering the profile via
known post shortcodes when the profile API is blocked.

Outputs raw_instagram_videos.json with source="instagram".

Usage:
  python3 scripts/scrape_instagram.py --user YOUR_IG_USERNAME
  python3 scripts/scrape_instagram.py --user YOUR_IG_USERNAME --profiles coachingotf,coachfajardo

  # Non-interactive (password via env var):
  IG_PASSWORD=xxx python3 scripts/scrape_instagram.py --user YOUR_IG_USERNAME
"""

import argparse
import json
import os
import signal
import sys
import time

try:
    import instaloader
    from instaloader.exceptions import (
        ProfileNotExistsException,
        QueryReturnedNotFoundException,
    )
except ImportError:
    print("Install instaloader: pip3 install instaloader --break-system-packages")
    sys.exit(1)

DEFAULT_PROFILE = "coachingotf"
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
OUTPUT_FILE = os.path.join(SCRIPT_DIR, "..", "raw_instagram_videos.json")

DEFAULT_CREATOR = {
    "id": "coachingotf",
    "display_name": "Coach Rudy",
    "handle": "coachingotf",
    "profile_url": "https://www.instagram.com/coachingotf/",
}

KNOWN_SHORTCODES = [
    "DF5s0iAOhWJ",
    "DVceVlwjTqj",
    "C8GN60NtC-q",
    "C6Ox4ZfCmQH",
]

STRATEGY_TIMEOUT = 30


class StrategyTimeout(Exception):
    pass


def _alarm_handler(signum, frame):
    raise StrategyTimeout()


def run_with_timeout(fn, *args, timeout=STRATEGY_TIMEOUT):
    """Run fn(*args) with a SIGALRM timeout to escape instaloader's retry loops."""
    prev = signal.signal(signal.SIGALRM, _alarm_handler)
    signal.alarm(timeout)
    try:
        result = fn(*args)
        signal.alarm(0)
        return result
    except StrategyTimeout:
        print("  Timed out (rate-limited, moving on)")
        return None
    finally:
        signal.alarm(0)
        signal.signal(signal.SIGALRM, prev)


def create_loader() -> instaloader.Instaloader:
    return instaloader.Instaloader(
        download_pictures=False,
        download_videos=False,
        download_video_thumbnails=False,
        download_geotags=False,
        download_comments=False,
        save_metadata=False,
        compress_json=False,
        max_connection_attempts=1,
    )


def login(L: instaloader.Instaloader, username: str, force_fresh: bool = False) -> None:
    if not force_fresh:
        try:
            L.load_session_from_file(username)
            print(f"Loaded saved session for {username}")
            return
        except FileNotFoundError:
            pass

    password = os.environ.get("IG_PASSWORD")
    if password:
        print(f"Logging in as {username} (via IG_PASSWORD)...")
        L.login(username, password)
    else:
        print(f"Logging in as {username} (interactive)...")
        L.interactive_login(username)
    L.save_session_to_file()
    print("Session saved.")


# --------------- Profile resolution strategies ---------------

def parse_profiles(profiles: str) -> list[str]:
    handles = []
    seen = set()
    for raw_handle in profiles.split(","):
        handle = raw_handle.strip().lstrip("@")
        if not handle:
            continue
        key = handle.lower()
        if key not in seen:
            handles.append(handle)
            seen.add(key)
    return handles or [DEFAULT_PROFILE]


def creator_from_profile(profile: instaloader.Profile) -> dict:
    handle = profile.username
    if handle.lower() == DEFAULT_PROFILE:
        return dict(DEFAULT_CREATOR)

    display_name = (profile.full_name or "").strip() or handle
    return {
        "id": handle.lower(),
        "display_name": display_name,
        "handle": handle,
        "profile_url": f"https://www.instagram.com/{handle}/",
    }


def dedupe_videos_by_id(videos: list[dict]) -> tuple[list[dict], int]:
    deduped = []
    seen_ids = set()
    duplicate_count = 0

    for video in videos:
        video_id = video.get("id")
        if video_id and video_id in seen_ids:
            duplicate_count += 1
            continue
        if video_id:
            seen_ids.add(video_id)
        deduped.append(video)

    return deduped, duplicate_count


def _from_username(L: instaloader.Instaloader, handle: str) -> instaloader.Profile | None:
    profile = instaloader.Profile.from_username(L.context, handle)
    print(f"  OK — {profile.full_name} ({profile.mediacount} posts)")
    return profile


def _from_shortcode(L: instaloader.Instaloader, handle: str) -> instaloader.Profile | None:
    for sc in KNOWN_SHORTCODES:
        try:
            print(f"  Loading post {sc}...")
            post = instaloader.Post.from_shortcode(L.context, sc)
            owner = post.owner_username
            if owner and owner.lower() == handle.lower():
                profile = post.owner_profile
                print(f"  OK — @{profile.username} via post {sc}")
                return profile
            print(f"  Post belongs to @{owner}, not @{handle}")
        except QueryReturnedNotFoundException:
            print(f"  Post {sc} not found")
        except StrategyTimeout:
            raise
        except Exception as e:
            print(f"  Error on {sc}: {e}")
        time.sleep(2)
    return None


def resolve_profile(L: instaloader.Instaloader, handle: str) -> instaloader.Profile | None:
    strategies = [("Profile.from_username", _from_username)]
    if handle.lower() == DEFAULT_PROFILE:
        strategies.append(("Known post -> owner_profile", _from_shortcode))

    for name, fn in strategies:
        print(f"\n[Strategy] {name}")
        profile = run_with_timeout(fn, L, handle, timeout=STRATEGY_TIMEOUT)
        if profile:
            return profile

    return None


# --------------- Post scanning ---------------

def scrape_videos(profile: instaloader.Profile) -> list[dict]:
    videos: list[dict] = []
    count = 0
    errors = 0
    creator = creator_from_profile(profile)

    print(f"\nScanning posts from @{profile.username}...")
    try:
        for post in profile.get_posts():
            count += 1
            if count % 10 == 0:
                print(f"  {count} posts scanned ({len(videos)} videos)...")
                time.sleep(1)

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
                "creator": dict(creator),
            })
    except KeyboardInterrupt:
        print(f"\n  Interrupted — keeping {len(videos)} videos collected so far")
    except Exception as e:
        errors += 1
        print(f"\n  Error during scan: {e}")
        if videos:
            print(f"  Keeping {len(videos)} videos collected before error")

    print(f"\nTotal posts scanned: {count}")
    print(f"Videos/reels found: {len(videos)}")
    return videos


# --------------- Main ---------------

def main():
    parser = argparse.ArgumentParser(description="Scrape Instagram reels from target profiles")
    parser.add_argument("--user", "-u", required=True, help="Your Instagram username")
    parser.add_argument(
        "--profiles",
        default=DEFAULT_PROFILE,
        help="Comma-separated target Instagram handles to scrape (default: coachingotf)",
    )
    args = parser.parse_args()
    handles = parse_profiles(args.profiles)

    L = create_loader()
    login(L, args.user)

    videos_by_id = {}
    failed_handles = []
    duplicate_count = 0
    for handle in handles:
        print("\n" + "=" * 60)
        print(f"Resolving @{handle}")
        print("=" * 60)
        profile = resolve_profile(L, handle)

        if not profile:
            print("\n--- Retrying with fresh login ---")
            L = create_loader()
            login(L, args.user, force_fresh=True)
            time.sleep(3)
            profile = resolve_profile(L, handle)

        if not profile:
            failed_handles.append(handle)
            print(f"\nERROR: Could not access @{handle}'s profile.")
            continue

        profile_videos, duplicates = dedupe_videos_by_id(scrape_videos(profile))
        duplicate_count += duplicates
        for video in profile_videos:
            video_id = video.get("id")
            if video_id and video_id in videos_by_id:
                duplicate_count += 1
                continue
            videos_by_id[video_id or f"missing_id_{len(videos_by_id)}"] = video

    videos = list(videos_by_id.values())

    if not videos:
        session_path = os.path.expanduser(f"~/.config/instaloader/session-{args.user}")
        failed = ", ".join(f"@{handle}" for handle in failed_handles) or "requested profiles"
        print("\n" + "=" * 60)
        print(f"ERROR: Could not collect videos from {failed}.")
        print("=" * 60)
        print()
        print("Instagram is blocking automated access. Try:")
        print()
        print("1. Wait 15-30 minutes for rate limits to clear, then re-run.")
        print()
        print("2. Check your Instagram account has a birthday set (must be 18+):")
        print("   Settings > Accounts Center > Personal details > Birthday")
        print()
        print("3. Delete session and re-login:")
        print(f"   rm {session_path}")
        print(f"   python3 scripts/scrape_instagram.py --user {args.user} --profiles {','.join(handles)}")
        print()
        print("4. Visit target profiles in your browser to confirm you can see them while logged in.")
        print("No videos found.")
        sys.exit(1)

    with open(OUTPUT_FILE, "w") as f:
        json.dump(videos, f, indent=2)

    print(f"\nSaved {len(videos)} videos from {len(handles) - len(failed_handles)} profiles -> {OUTPUT_FILE}")
    if duplicate_count:
        print(f"Skipped {duplicate_count} duplicate videos by id")
    if failed_handles:
        print("Profiles skipped due to access errors: " + ", ".join(f"@{handle}" for handle in failed_handles))


if __name__ == "__main__":
    main()
