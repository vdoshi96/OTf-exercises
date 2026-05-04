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
import datetime as dt
import json
import os
import signal
import sys
import time
import urllib.error
import urllib.parse
import urllib.request

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
WEB_API_APP_ID = "936619743392459"
WEB_API_PAGE_SIZE = 12
WEB_API_MAX_PAGES = 25
WEB_API_PAGE_DELAY_SECONDS = 1


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


def can_attempt_fresh_login(
    env: dict[str, str] | os._Environ[str] = os.environ,
    stdin_is_interactive: bool | None = None,
) -> bool:
    if env.get("IG_PASSWORD"):
        return True
    if stdin_is_interactive is None:
        stdin_is_interactive = sys.stdin.isatty()
    return stdin_is_interactive


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
        if force_fresh and not can_attempt_fresh_login():
            raise RuntimeError(
                "Fresh login requires IG_PASSWORD or an interactive stdin; "
                "skipping to avoid EOFError in non-interactive runs."
            )
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


def _first_thumbnail_url(media: dict) -> str:
    candidates = media.get("image_versions2", {}).get("candidates", [])
    if not candidates:
        return ""
    return candidates[0].get("url", "") or ""


def _caption_text(media: dict) -> str:
    caption = media.get("caption") or {}
    if isinstance(caption, dict):
        return caption.get("text") or ""
    return ""


def creator_from_web_profile(profile_data: dict) -> dict:
    username = (profile_data.get("username") or "").strip()
    handle = username or (profile_data.get("handle") or "").strip()
    display_name = (profile_data.get("full_name") or "").strip() or handle

    return {
        "id": handle.lower(),
        "display_name": display_name,
        "handle": handle,
        "profile_url": f"https://www.instagram.com/{handle}/",
    }


def reel_media_to_raw_video(media: dict, creator: dict) -> dict | None:
    code = media.get("code") or media.get("shortcode")
    if not code:
        return None

    timestamp = int(media.get("taken_at") or 0)
    upload_date = ""
    if timestamp:
        upload_date = dt.datetime.fromtimestamp(timestamp, tz=dt.UTC).strftime("%Y%m%d")

    return {
        "id": f"ig_{code}",
        "url": f"https://www.instagram.com/reel/{code}/",
        "description": _caption_text(media),
        "thumbnail": _first_thumbnail_url(media),
        "duration": media.get("video_duration") or 0,
        "timestamp": timestamp,
        "upload_date": upload_date,
        "source": "instagram",
        "creator": dict(creator),
        "is_video": True,
    }


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
        try:
            profile = run_with_timeout(fn, L, handle, timeout=STRATEGY_TIMEOUT)
        except ProfileNotExistsException:
            print(f"  Profile @{handle} not found via Instaloader")
            profile = None
        except Exception as e:
            print(f"  Error resolving @{handle}: {e}")
            profile = None
        if profile:
            return profile

    return None


# --------------- Instagram web API fallback ---------------

class InstagramWebAPI:
    def __init__(self) -> None:
        cookie_processor = urllib.request.HTTPCookieProcessor()
        self.opener = urllib.request.build_opener(cookie_processor)
        self.cookie_jar = cookie_processor.cookiejar

    def _csrf_token(self) -> str:
        for cookie in self.cookie_jar:
            if cookie.name == "csrftoken":
                return cookie.value
        return ""

    def _request_json(
        self,
        url: str,
        *,
        data: dict[str, str] | None = None,
        referer: str = "https://www.instagram.com/",
    ) -> dict:
        encoded_data = None
        headers = {
            "User-Agent": "Mozilla/5.0",
            "x-ig-app-id": WEB_API_APP_ID,
            "Referer": referer,
        }
        if data is not None:
            encoded_data = urllib.parse.urlencode(data).encode("utf-8")
            headers["Content-Type"] = "application/x-www-form-urlencoded"
            csrf = self._csrf_token()
            if csrf:
                headers["x-csrftoken"] = csrf

        request = urllib.request.Request(url, data=encoded_data, headers=headers)
        with self.opener.open(request, timeout=30) as response:
            return json.loads(response.read().decode("utf-8"))

    def profile_info(self, handle: str) -> dict:
        query = urllib.parse.urlencode({"username": handle})
        url = f"https://www.instagram.com/api/v1/users/web_profile_info/?{query}"
        payload = self._request_json(url, referer=f"https://www.instagram.com/{handle}/")
        user = payload.get("data", {}).get("user")
        if not user:
            raise ValueError(f"No web profile data returned for @{handle}")
        return user

    def clips_page(
        self,
        *,
        target_user_id: str,
        handle: str,
        max_id: str | None = None,
    ) -> dict:
        data = {
            "target_user_id": target_user_id,
            "page_size": str(WEB_API_PAGE_SIZE),
        }
        if max_id:
            data["max_id"] = max_id
        return self._request_json(
            "https://www.instagram.com/api/v1/clips/user/",
            data=data,
            referer=f"https://www.instagram.com/{handle}/reels/",
        )


def _extract_clip_media(item: dict) -> dict:
    media = item.get("media")
    if isinstance(media, dict):
        return media
    return item


def scrape_videos_web_api(handle: str) -> list[dict]:
    print(f"\n[Fallback] Instagram web API for @{handle}")
    api = InstagramWebAPI()
    profile_data = api.profile_info(handle)
    creator = creator_from_web_profile(profile_data)
    target_user_id = str(profile_data.get("id") or "")
    if not target_user_id:
        raise ValueError(f"No target user id returned for @{handle}")

    videos: list[dict] = []
    seen_ids = set()
    max_id = None
    page_count = 0
    more_available = True

    while more_available and page_count < WEB_API_MAX_PAGES:
        page_count += 1
        payload = api.clips_page(target_user_id=target_user_id, handle=creator["handle"], max_id=max_id)
        items = payload.get("items") or []
        print(f"  Web API page {page_count}: {len(items)} reels")

        for item in items:
            video = reel_media_to_raw_video(_extract_clip_media(item), creator)
            if not video:
                continue
            video_id = video.get("id")
            if video_id in seen_ids:
                continue
            seen_ids.add(video_id)
            videos.append(video)

        paging_info = payload.get("paging_info") or {}
        more_available = bool(paging_info.get("more_available"))
        max_id = paging_info.get("max_id")
        if more_available and max_id:
            time.sleep(WEB_API_PAGE_DELAY_SECONDS)
        else:
            more_available = False

    if page_count >= WEB_API_MAX_PAGES and more_available:
        print(f"  Reached web API page safety limit ({WEB_API_MAX_PAGES}) for @{handle}")

    print(f"Videos/reels found via web API: {len(videos)}")
    return videos


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
            print(f"\nCould not access @{handle}'s profile via Instaloader; trying Web API fallback.")
            try:
                profile_videos, duplicates = dedupe_videos_by_id(scrape_videos_web_api(handle))
            except (urllib.error.URLError, urllib.error.HTTPError, ValueError, json.JSONDecodeError) as e:
                failed_handles.append(handle)
                print(f"\nERROR: Web API fallback failed for @{handle}: {e}")
                continue
            except Exception as e:
                failed_handles.append(handle)
                print(f"\nERROR: Unexpected web API fallback failure for @{handle}: {e}")
                continue
        else:
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
