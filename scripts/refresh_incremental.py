#!/usr/bin/env python3
"""Safely add newly published creator videos to the exercise catalog.

The command always scans every configured source. It is a dry run unless
``--apply`` is supplied. A failed or incomplete source scan exits before any
tracked file is changed.
"""

from __future__ import annotations

import argparse
import copy
import datetime as dt
import http.cookiejar
import json
import os
import re
import subprocess
import sys
import tempfile
import time
import urllib.error
import urllib.parse
import urllib.request
from collections import Counter
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Callable


PROJECT_DIR = Path(__file__).resolve().parent.parent
SCRIPT_DIR = Path(__file__).resolve().parent
DEFAULT_CATALOG = PROJECT_DIR / "src" / "data" / "exercises.json"
DEFAULT_STATE = PROJECT_DIR / "data" / "refresh-state.json"
DEFAULT_OVERRIDES = PROJECT_DIR / "data" / "refresh-overrides.json"
DEFAULT_REPORT = PROJECT_DIR / "data" / "refresh-report.json"

INSTAGRAM_APP_ID = "936619743392459"
INSTAGRAM_PAGE_SIZE = 12
DEFAULT_INSTAGRAM_MAX_PAGES = 20
DEFAULT_TIKTOK_LIMIT = 250

COACH_RUDY = {
    "id": "coachingotf",
    "display_name": "Coach Rudy",
    "handle": "coachingotf",
    "profile_url": "https://www.instagram.com/coachingotf/",
}
TRAINING_TALL = {
    "id": "trainingtall",
    "display_name": "Austin Hendrickson (Trainingtall)",
    "handle": "trainingtall",
    "profile_url": "https://www.instagram.com/trainingtall/",
}
CREATORS = {
    "coachingotf": COACH_RUDY,
    "trainingtall": TRAINING_TALL,
}


class RefreshError(RuntimeError):
    """Raised when a refresh cannot safely produce a complete result."""


@dataclass(frozen=True)
class SourceScan:
    key: str
    platform: str
    handle: str
    cutoff_timestamp: int
    scanned_count: int
    page_count: int
    latest_seen_timestamp: int
    latest_seen_id: str
    stop_reason: str
    candidates: list[dict[str, Any]]

    def report_dict(self) -> dict[str, Any]:
        return {
            "platform": self.platform,
            "handle": self.handle,
            "cutoff_timestamp": self.cutoff_timestamp,
            "scanned_count": self.scanned_count,
            "page_count": self.page_count,
            "latest_seen_timestamp": self.latest_seen_timestamp,
            "latest_seen_id": self.latest_seen_id,
            "stop_reason": self.stop_reason,
            "candidate_count": len(self.candidates),
        }


def load_json(path: Path) -> Any:
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except FileNotFoundError as exc:
        raise RefreshError(f"Required file does not exist: {path}") from exc
    except json.JSONDecodeError as exc:
        raise RefreshError(f"Invalid JSON in {path}: {exc}") from exc


def atomic_write_json(path: Path, value: Any) -> None:
    """Write formatted JSON through a same-directory temporary file."""
    path.parent.mkdir(parents=True, exist_ok=True)
    descriptor, temporary_name = tempfile.mkstemp(
        prefix=f".{path.name}.", suffix=".tmp", dir=path.parent
    )
    temporary_path = Path(temporary_name)
    try:
        with os.fdopen(descriptor, "w", encoding="utf-8") as handle:
            json.dump(value, handle, indent=2, ensure_ascii=False)
            handle.write("\n")
            handle.flush()
            os.fsync(handle.fileno())
        os.replace(temporary_path, path)
    finally:
        temporary_path.unlink(missing_ok=True)


def utc_now() -> str:
    return dt.datetime.now(dt.UTC).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def timestamp_to_upload_date(timestamp: int) -> str:
    if not timestamp:
        return ""
    return dt.datetime.fromtimestamp(timestamp, tz=dt.UTC).strftime("%Y%m%d")


def slugify(name: str) -> str:
    slug = name.lower().strip()
    slug = re.sub(r"[^a-z0-9\s-]", "", slug)
    slug = re.sub(r"[\s-]+", "-", slug).strip("-")
    return slug[:80] or "unknown"


def canonical_creator(handle: str) -> dict[str, str]:
    key = handle.lower().lstrip("@")
    try:
        return dict(CREATORS[key])
    except KeyError as exc:
        raise RefreshError(f"Unrecognized creator handle: {handle}") from exc


class InstagramClient:
    """Small client for Instagram's public web profile and clips endpoints."""

    def __init__(self, *, max_retries: int = 3, retry_delay_seconds: float = 5.0) -> None:
        cookie_jar = http.cookiejar.CookieJar()
        self.opener = urllib.request.build_opener(
            urllib.request.HTTPCookieProcessor(cookie_jar)
        )
        self.cookie_jar = cookie_jar
        self.max_retries = max_retries
        self.retry_delay_seconds = retry_delay_seconds

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
        referer: str,
    ) -> dict[str, Any]:
        encoded_data = None
        headers = {
            "Accept": "*/*",
            "Accept-Language": "en-US,en;q=0.9",
            "User-Agent": (
                "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
                "AppleWebKit/537.36 (KHTML, like Gecko) "
                "Chrome/138.0.0.0 Safari/537.36"
            ),
            "x-ig-app-id": INSTAGRAM_APP_ID,
            "Referer": referer,
        }
        if data is not None:
            encoded_data = urllib.parse.urlencode(data).encode("utf-8")
            headers["Content-Type"] = "application/x-www-form-urlencoded"
            csrf = self._csrf_token()
            if csrf:
                headers["x-csrftoken"] = csrf

        last_error: BaseException | None = None
        for attempt in range(self.max_retries + 1):
            request = urllib.request.Request(url, data=encoded_data, headers=headers)
            try:
                with self.opener.open(request, timeout=30) as response:
                    payload = json.loads(response.read().decode("utf-8"))
                if payload.get("status") == "fail":
                    raise RefreshError(
                        f"Instagram rejected request: {payload.get('message', 'unknown error')}"
                    )
                return payload
            except urllib.error.HTTPError as exc:
                response_body = ""
                try:
                    response_body = exc.read().decode("utf-8", errors="replace")
                except Exception:
                    pass
                last_error = RefreshError(
                    f"Instagram HTTP {exc.code}: {response_body[:240] or exc.reason}"
                )
                retryable = exc.code in {401, 403, 408, 429} or exc.code >= 500
                if not retryable or attempt >= self.max_retries:
                    break
            except (urllib.error.URLError, TimeoutError, json.JSONDecodeError, RefreshError) as exc:
                last_error = exc
                if attempt >= self.max_retries:
                    break

            delay = self.retry_delay_seconds * (2**attempt)
            print(
                f"  Instagram request failed; retrying in {delay:g}s "
                f"({attempt + 1}/{self.max_retries})",
                file=sys.stderr,
            )
            time.sleep(delay)

        raise RefreshError(str(last_error or "Instagram request failed"))

    def profile_info(self, handle: str) -> dict[str, Any]:
        query = urllib.parse.urlencode({"username": handle})
        payload = self._request_json(
            f"https://www.instagram.com/api/v1/users/web_profile_info/?{query}",
            referer=f"https://www.instagram.com/{handle}/",
        )
        user = payload.get("data", {}).get("user")
        if not isinstance(user, dict) or not user.get("id"):
            raise RefreshError(f"Instagram returned no profile data for @{handle}")
        return user

    def clips_page(
        self, *, target_user_id: str, handle: str, max_id: str | None
    ) -> dict[str, Any]:
        data = {
            "target_user_id": target_user_id,
            "page_size": str(INSTAGRAM_PAGE_SIZE),
        }
        if max_id:
            data["max_id"] = max_id
        return self._request_json(
            "https://www.instagram.com/api/v1/clips/user/",
            data=data,
            referer=f"https://www.instagram.com/{handle}/reels/",
        )


class FixtureInstagramClient:
    """Read deterministic Instagram responses from a test fixture directory."""

    def __init__(self, fixture_dir: Path) -> None:
        self.fixture_dir = fixture_dir
        self.page_numbers: Counter[str] = Counter()

    def profile_info(self, handle: str) -> dict[str, Any]:
        return load_json(self.fixture_dir / f"instagram-{handle}-profile.json")

    def clips_page(
        self, *, target_user_id: str, handle: str, max_id: str | None
    ) -> dict[str, Any]:
        del target_user_id, max_id
        self.page_numbers[handle] += 1
        page = self.page_numbers[handle]
        path = self.fixture_dir / f"instagram-{handle}-page-{page:03d}.json"
        if not path.exists():
            raise RefreshError(f"Missing Instagram fixture page: {path}")
        return load_json(path)


def instagram_media_to_video(media: dict[str, Any], handle: str) -> dict[str, Any] | None:
    shortcode = media.get("code") or media.get("shortcode")
    if not shortcode:
        return None
    caption = media.get("caption") or {}
    description = caption.get("text", "") if isinstance(caption, dict) else ""
    candidates = media.get("image_versions2", {}).get("candidates") or []
    thumbnail = candidates[0].get("url", "") if candidates else ""
    timestamp = int(media.get("taken_at") or 0)
    return {
        "id": f"ig_{shortcode}",
        "url": f"https://www.instagram.com/reel/{shortcode}/",
        "description": description,
        "thumbnail": thumbnail,
        "duration": media.get("video_duration") or 0,
        "timestamp": timestamp,
        "upload_date": timestamp_to_upload_date(timestamp),
        "source": "instagram",
        "creator": canonical_creator(handle),
    }


def scan_instagram_source(
    *,
    handle: str,
    cutoff_timestamp: int,
    client: InstagramClient | FixtureInstagramClient,
    max_pages: int,
    page_delay_seconds: float,
) -> SourceScan:
    key = f"instagram:{handle}"
    profile = client.profile_info(handle)
    target_user_id = str(profile.get("id") or "")
    if not target_user_id:
        raise RefreshError(f"No Instagram user id returned for @{handle}")

    seen_ids: set[str] = set()
    scanned_count = 0
    candidates: list[dict[str, Any]] = []
    latest_seen_timestamp = 0
    latest_seen_id = ""
    max_id: str | None = None
    historical_page_streak = 0
    page_count = 0
    stop_reason = ""

    while page_count < max_pages:
        page_count += 1
        payload = client.clips_page(
            target_user_id=target_user_id, handle=handle, max_id=max_id
        )
        items = payload.get("items")
        if not isinstance(items, list):
            raise RefreshError(f"Instagram page {page_count} for @{handle} has no item list")

        page_newer_count = 0
        for item in items:
            media = item.get("media") if isinstance(item, dict) else None
            if not isinstance(media, dict):
                media = item if isinstance(item, dict) else {}
            video = instagram_media_to_video(media, handle)
            if not video:
                continue
            timestamp = int(video.get("timestamp") or 0)
            if timestamp > cutoff_timestamp:
                page_newer_count += 1
            if video["id"] in seen_ids:
                continue
            seen_ids.add(video["id"])
            scanned_count += 1
            if timestamp > latest_seen_timestamp:
                latest_seen_timestamp = timestamp
                latest_seen_id = video["id"]
            if timestamp > cutoff_timestamp:
                candidates.append(video)

        historical_page_streak = 0 if page_newer_count else historical_page_streak + 1
        paging = payload.get("paging_info") or {}
        more_available = bool(paging.get("more_available"))
        next_max_id = paging.get("max_id")

        print(
            f"  @{handle} page {page_count}: {len(items)} items, "
            f"{page_newer_count} newer"
        )

        if historical_page_streak >= 2:
            stop_reason = "two_consecutive_historical_pages"
            break
        if not more_available:
            stop_reason = "end_of_feed"
            break
        if not next_max_id:
            raise RefreshError(
                f"Instagram says more pages exist for @{handle} but returned no max_id"
            )
        max_id = str(next_max_id)
        if page_delay_seconds:
            time.sleep(page_delay_seconds)

    if not stop_reason:
        raise RefreshError(
            f"Instagram scan for @{handle} reached {max_pages} pages before a safe cutoff"
        )
    if scanned_count == 0:
        raise RefreshError(f"Instagram scan for @{handle} returned no reels")

    return SourceScan(
        key=key,
        platform="instagram",
        handle=handle,
        cutoff_timestamp=cutoff_timestamp,
        scanned_count=scanned_count,
        page_count=page_count,
        latest_seen_timestamp=latest_seen_timestamp,
        latest_seen_id=latest_seen_id,
        stop_reason=stop_reason,
        candidates=candidates,
    )


def _tiktok_timestamp(entry: dict[str, Any]) -> int:
    timestamp = int(entry.get("timestamp") or 0)
    if timestamp:
        return timestamp
    video_id = str(entry.get("id") or "")
    if video_id.isdigit():
        return int(video_id) >> 32
    return 0


def _load_tiktok_payload(handle: str, limit: int, fixture_dir: Path | None) -> dict[str, Any]:
    if fixture_dir:
        return load_json(fixture_dir / f"tiktok-{handle}.json")
    command = [
        "yt-dlp",
        "--no-update",
        "--flat-playlist",
        "--playlist-end",
        str(limit),
        "--dump-single-json",
        f"https://www.tiktok.com/@{handle}",
    ]
    try:
        result = subprocess.run(
            command,
            cwd=PROJECT_DIR,
            check=False,
            capture_output=True,
            text=True,
            timeout=180,
        )
    except (FileNotFoundError, subprocess.TimeoutExpired) as exc:
        raise RefreshError(f"TikTok scan could not run yt-dlp: {exc}") from exc
    if result.returncode != 0:
        raise RefreshError(f"TikTok scan failed: {result.stderr.strip()[:500]}")
    try:
        return json.loads(result.stdout)
    except json.JSONDecodeError as exc:
        raise RefreshError(f"TikTok scan returned invalid JSON: {exc}") from exc


def scan_tiktok_source(
    *, handle: str, cutoff_timestamp: int, limit: int, fixture_dir: Path | None
) -> SourceScan:
    payload = _load_tiktok_payload(handle, limit, fixture_dir)
    entries = payload.get("entries")
    if not isinstance(entries, list) or not entries:
        raise RefreshError(f"TikTok scan for @{handle} returned no entries")

    candidates: list[dict[str, Any]] = []
    seen_ids: set[str] = set()
    latest_seen_timestamp = 0
    latest_seen_id = ""
    reached_history = False
    for entry in entries:
        if not isinstance(entry, dict):
            continue
        video_id = str(entry.get("id") or "")
        if not video_id or video_id in seen_ids:
            continue
        seen_ids.add(video_id)
        timestamp = _tiktok_timestamp(entry)
        if not timestamp:
            raise RefreshError(f"TikTok entry {video_id} has no usable timestamp")
        if timestamp > latest_seen_timestamp:
            latest_seen_timestamp = timestamp
            latest_seen_id = video_id
        if timestamp <= cutoff_timestamp:
            reached_history = True
            continue
        thumbnails = entry.get("thumbnails") or []
        thumbnail = entry.get("thumbnail") or ""
        if not thumbnail and thumbnails:
            thumbnail = thumbnails[-1].get("url", "")
        candidates.append(
            {
                "id": video_id,
                "url": entry.get("webpage_url")
                or f"https://www.tiktok.com/@{handle}/video/{video_id}",
                "description": entry.get("description") or entry.get("title") or "",
                "thumbnail": thumbnail,
                "duration": entry.get("duration") or 0,
                "timestamp": timestamp,
                "upload_date": timestamp_to_upload_date(timestamp),
                "source": "tiktok",
                "creator": canonical_creator(handle),
            }
        )

    if len(entries) >= limit and not reached_history:
        raise RefreshError(
            f"TikTok scan for @{handle} exhausted its {limit}-entry limit before the cutoff"
        )
    return SourceScan(
        key=f"tiktok:{handle}",
        platform="tiktok",
        handle=handle,
        cutoff_timestamp=cutoff_timestamp,
        scanned_count=len(seen_ids),
        page_count=1,
        latest_seen_timestamp=latest_seen_timestamp,
        latest_seen_id=latest_seen_id,
        stop_reason="historical_entry_reached" if reached_history else "end_of_feed",
        candidates=candidates,
    )


def load_enricher() -> Callable[[dict[str, Any]], dict[str, Any]]:
    if str(SCRIPT_DIR) not in sys.path:
        sys.path.insert(0, str(SCRIPT_DIR))
    try:
        from enrich_local import enrich_video
    except ImportError as exc:
        raise RefreshError(f"Could not load scripts/enrich_local.py: {exc}") from exc
    return enrich_video


def validate_overrides(overrides: dict[str, Any]) -> None:
    rejected = set(overrides.get("rejected", {}))
    forced = set(overrides.get("force_include", {}))
    appended = set(overrides.get("append_to_group", {}))
    overlap = (rejected & forced) | (rejected & appended)
    if overlap:
        raise RefreshError(f"Override IDs are both rejected and included: {sorted(overlap)}")


def final_video(candidate: dict[str, Any]) -> dict[str, Any]:
    return {
        "id": candidate["id"],
        "url": candidate["url"],
        "source": candidate.get("source", "tiktok"),
        "thumbnail": candidate.get("thumbnail", ""),
        "description": candidate.get("description", ""),
        "creator": copy.deepcopy(candidate["creator"]),
    }


def preserve_existing_records(before: list[dict[str, Any]], after: list[dict[str, Any]]) -> None:
    after_groups = {group["id"]: group for group in after}
    before_videos = {
        video["id"]: copy.deepcopy(video)
        for group in before
        for video in group.get("videos", [])
    }
    after_videos = {
        video["id"]: video for group in after for video in group.get("videos", [])
    }
    missing_groups = [group["id"] for group in before if group["id"] not in after_groups]
    if missing_groups:
        raise RefreshError(f"Refresh removed existing exercise groups: {missing_groups[:5]}")
    for old_group in before:
        new_group = after_groups[old_group["id"]]
        for key, value in old_group.items():
            if key != "videos" and new_group.get(key) != value:
                raise RefreshError(
                    f"Refresh changed existing group metadata: {old_group['id']} ({key})"
                )
    for video_id, old_video in before_videos.items():
        if after_videos.get(video_id) != old_video:
            raise RefreshError(f"Refresh changed or removed existing video: {video_id}")


def _count_catalog(catalog: list[dict[str, Any]]) -> dict[str, Any]:
    videos = [video for group in catalog for video in group.get("videos", [])]
    return {
        "exercise_groups": len(catalog),
        "videos": len(videos),
        "videos_by_creator": dict(
            sorted(Counter(video.get("creator", {}).get("id", "") for video in videos).items())
        ),
        "videos_by_platform": dict(
            sorted(Counter(video.get("source", "") for video in videos).items())
        ),
    }


def build_updated_catalog(
    catalog: list[dict[str, Any]],
    candidates: list[dict[str, Any]],
    overrides: dict[str, Any],
) -> tuple[list[dict[str, Any]], dict[str, Any]]:
    validate_overrides(overrides)
    updated = copy.deepcopy(catalog)
    groups_by_id = {group["id"]: group for group in updated}
    if len(groups_by_id) != len(updated):
        raise RefreshError("Catalog contains duplicate exercise group IDs")

    existing_ids = {
        video["id"] for group in updated for video in group.get("videos", [])
    }
    existing_urls = {
        video["url"] for group in updated for video in group.get("videos", [])
    }
    seen_candidate_ids: set[str] = set()
    seen_candidate_urls: set[str] = set()
    rejected_overrides = overrides.get("rejected", {})
    force_overrides = overrides.get("force_include", {})
    append_overrides = overrides.get("append_to_group", {})
    title_overrides = overrides.get("title_overrides", {})
    enrich_video = load_enricher()

    decisions: dict[str, list[dict[str, Any]]] = {
        "accepted": [],
        "rejected": [],
        "skipped": [],
    }

    for candidate in sorted(
        candidates,
        key=lambda value: (int(value.get("timestamp") or 0), str(value.get("id") or "")),
    ):
        video_id = str(candidate.get("id") or "")
        url = str(candidate.get("url") or "")
        if not video_id or not url:
            raise RefreshError("Candidate is missing an id or URL")
        if video_id in seen_candidate_ids:
            decisions["skipped"].append({"id": video_id, "reason": "duplicate_candidate_id"})
            continue
        if url in seen_candidate_urls:
            raise RefreshError(f"Two candidates share URL {url}")
        seen_candidate_ids.add(video_id)
        seen_candidate_urls.add(url)
        if video_id in existing_ids:
            decisions["skipped"].append({"id": video_id, "reason": "already_present"})
            continue
        if url in existing_urls:
            raise RefreshError(f"Candidate URL is already present under another id: {url}")

        if video_id in rejected_overrides:
            value = rejected_overrides[video_id]
            reason = value.get("reason", "manual_reject") if isinstance(value, dict) else str(value)
            decisions["rejected"].append(
                {"id": video_id, "creator": candidate["creator"]["id"], "reason": reason}
            )
            continue

        target_group_id = append_overrides.get(video_id)
        metadata: dict[str, Any] | None = None
        classification = ""
        if target_group_id:
            classification = "explicit_append"
        elif video_id in force_overrides:
            metadata = copy.deepcopy(force_overrides[video_id])
            classification = "manual_force_include"
        else:
            enriched = enrich_video(copy.deepcopy(candidate)).get("enrichment", {})
            if not enriched.get("is_exercise_demo"):
                decisions["rejected"].append(
                    {
                        "id": video_id,
                        "creator": candidate["creator"]["id"],
                        "reason": "classifier_non_demo",
                    }
                )
                continue
            metadata = {
                "exercise_name": enriched.get("exercise_name"),
                "category": enriched.get("category", "other"),
                "muscle_groups": enriched.get("muscle_groups", []),
                "equipment": enriched.get("equipment", []),
                "movement_type": enriched.get("movement_type", "other"),
                "coaching_cues": enriched.get("coaching_cues", []),
            }
            classification = "classifier_accept"

        if metadata is not None and video_id in title_overrides:
            metadata["exercise_name"] = title_overrides[video_id]

        if target_group_id:
            target = groups_by_id.get(target_group_id)
            if target is None:
                raise RefreshError(
                    f"Append override for {video_id} references missing group {target_group_id}"
                )
        else:
            exercise_name = str((metadata or {}).get("exercise_name") or "").strip()
            if not exercise_name:
                raise RefreshError(f"Accepted candidate {video_id} has no exercise name")
            target_group_id = slugify(exercise_name)
            target = groups_by_id.get(target_group_id)
            if target is not None:
                if slugify(str(target.get("exercise_name") or "")) != target_group_id:
                    raise RefreshError(
                        f"Slug collision for {video_id}: {exercise_name} -> {target_group_id}"
                    )
                classification = "exact_slug_append"
            else:
                target = {
                    "id": target_group_id,
                    "exercise_name": exercise_name,
                    "category": metadata.get("category", "other"),
                    "muscle_groups": list(metadata.get("muscle_groups", [])),
                    "equipment": list(metadata.get("equipment", [])),
                    "movement_type": metadata.get("movement_type", "other"),
                    "coaching_cues": list(metadata.get("coaching_cues", []))[:10],
                    "videos": [],
                }
                groups_by_id[target_group_id] = target
                updated.append(target)
                classification = f"{classification}_new_group"

        target["videos"].append(final_video(candidate))
        existing_ids.add(video_id)
        existing_urls.add(url)
        decisions["accepted"].append(
            {
                "id": video_id,
                "creator": candidate["creator"]["id"],
                "source": candidate.get("source"),
                "exercise_group": target_group_id,
                "decision": classification,
            }
        )

    updated.sort(key=lambda group: (str(group.get("exercise_name", "")).lower(), group["id"]))
    preserve_existing_records(catalog, updated)
    return updated, decisions


def validate_initial_expectations(
    *,
    before_counts: dict[str, Any],
    decisions: dict[str, list[dict[str, Any]]],
    scans: list[SourceScan],
    state: dict[str, Any],
    overrides: dict[str, Any],
) -> None:
    expectations = overrides.get("initial_refresh_expectations") or {}
    if not expectations:
        return
    baseline_videos = int(expectations.get("baseline_videos") or 0)
    first_run = all(
        not source.get("last_successful_checked_at")
        for source in state.get("sources", {}).values()
    )
    if before_counts["videos"] != baseline_videos or not first_run:
        return

    candidate_counts = Counter(
        candidate["creator"]["id"] for scan in scans for candidate in scan.candidates
    )
    accepted_counts = Counter(item["creator"] for item in decisions["accepted"])
    for creator, minimum in expectations.get("minimum_candidates_by_creator", {}).items():
        if candidate_counts[creator] < int(minimum):
            raise RefreshError(
                f"Initial scan found only {candidate_counts[creator]} candidates for {creator}; "
                f"expected at least {minimum}"
            )
    for creator, minimum in expectations.get("minimum_accepted_by_creator", {}).items():
        if accepted_counts[creator] < int(minimum):
            raise RefreshError(
                f"Initial import accepted only {accepted_counts[creator]} videos for {creator}; "
                f"expected at least {minimum}"
            )
    new_group_count = sum(
        item["decision"].endswith("new_group") for item in decisions["accepted"]
    )
    explicit_append_count = sum(
        item["decision"] == "explicit_append" for item in decisions["accepted"]
    )
    minimum_new_groups = int(expectations.get("minimum_new_groups") or 0)
    minimum_explicit_appends = int(expectations.get("minimum_explicit_appends") or 0)
    if new_group_count < minimum_new_groups:
        raise RefreshError(
            f"Initial import created only {new_group_count} groups; "
            f"expected at least {minimum_new_groups}"
        )
    if explicit_append_count < minimum_explicit_appends:
        raise RefreshError(
            f"Initial import made only {explicit_append_count} reviewed appends; "
            f"expected at least {minimum_explicit_appends}"
        )


def run_refresh(args: argparse.Namespace) -> dict[str, Any]:
    catalog = load_json(args.catalog)
    state = load_json(args.state)
    overrides = load_json(args.overrides)
    if not isinstance(catalog, list):
        raise RefreshError("Exercise catalog must be a JSON array")

    fixture_dir = args.fixture_dir.resolve() if args.fixture_dir else None
    instagram_client: InstagramClient | FixtureInstagramClient
    if fixture_dir:
        instagram_client = FixtureInstagramClient(fixture_dir)
    else:
        instagram_client = InstagramClient(
            max_retries=args.retries,
            retry_delay_seconds=args.retry_delay_seconds,
        )

    scans: list[SourceScan] = []
    for handle in ("coachingotf", "trainingtall"):
        source_key = f"instagram:{handle}"
        source_state = state.get("sources", {}).get(source_key)
        if not isinstance(source_state, dict):
            raise RefreshError(f"Refresh state is missing {source_key}")
        print(f"Scanning Instagram @{handle}...")
        scans.append(
            scan_instagram_source(
                handle=handle,
                cutoff_timestamp=int(source_state.get("latest_seen_timestamp") or 0),
                client=instagram_client,
                max_pages=args.max_instagram_pages,
                page_delay_seconds=0 if fixture_dir else args.page_delay_seconds,
            )
        )

    tiktok_key = "tiktok:coachingotf"
    tiktok_state = state.get("sources", {}).get(tiktok_key)
    if not isinstance(tiktok_state, dict):
        raise RefreshError(f"Refresh state is missing {tiktok_key}")
    print("Scanning TikTok @coachingotf...")
    scans.append(
        scan_tiktok_source(
            handle="coachingotf",
            cutoff_timestamp=int(tiktok_state.get("latest_seen_timestamp") or 0),
            limit=args.tiktok_limit,
            fixture_dir=fixture_dir,
        )
    )

    all_candidates = [candidate for scan in scans for candidate in scan.candidates]
    updated, decisions = build_updated_catalog(catalog, all_candidates, overrides)
    before_counts = _count_catalog(catalog)
    after_counts = _count_catalog(updated)
    validate_initial_expectations(
        before_counts=before_counts,
        decisions=decisions,
        scans=scans,
        state=state,
        overrides=overrides,
    )

    checked_at = utc_now()
    fixture_metadata_path = fixture_dir / "scan-metadata.json" if fixture_dir else None
    source_evidence = (
        load_json(fixture_metadata_path)
        if fixture_metadata_path and fixture_metadata_path.exists()
        else {"source": "deterministic fixture"}
        if fixture_dir
        else {"source": "direct live scan"}
    )
    scan_mode = (
        "same-session-live-cache"
        if fixture_dir and source_evidence.get("source") == "same-session live scan"
        else "fixture"
        if fixture_dir
        else "live"
    )
    report = {
        "version": 1,
        "mode": "apply" if args.apply else "dry-run",
        "scan_mode": scan_mode,
        "checked_at": checked_at,
        "source_evidence": source_evidence,
        "baseline": copy.deepcopy(state.get("baseline", {})),
        "sources": {scan.key: scan.report_dict() for scan in scans},
        "counts_before": before_counts,
        "counts_after": after_counts,
        "candidate_count": len(all_candidates),
        "accepted_count": len(decisions["accepted"]),
        "rejected_count": len(decisions["rejected"]),
        "skipped_count": len(decisions["skipped"]),
        "accepted_by_creator": dict(
            sorted(Counter(item["creator"] for item in decisions["accepted"]).items())
        ),
        "rejected_by_creator": dict(
            sorted(Counter(item["creator"] for item in decisions["rejected"]).items())
        ),
        "decisions": decisions,
        "failures": [],
    }

    if args.apply:
        next_state = copy.deepcopy(state)
        for scan in scans:
            source_state = next_state["sources"][scan.key]
            source_state["latest_seen_timestamp"] = max(
                int(source_state.get("latest_seen_timestamp") or 0),
                scan.latest_seen_timestamp,
            )
            source_state["latest_seen_id"] = scan.latest_seen_id
            source_state["last_successful_checked_at"] = checked_at
        # Catalog first and state last keeps an interrupted run safely idempotent.
        atomic_write_json(args.catalog, updated)
        atomic_write_json(args.report, report)
        atomic_write_json(args.state, next_state)

    return report


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--apply", action="store_true", help="atomically update catalog/state/report")
    parser.add_argument("--catalog", type=Path, default=DEFAULT_CATALOG)
    parser.add_argument("--state", type=Path, default=DEFAULT_STATE)
    parser.add_argument("--overrides", type=Path, default=DEFAULT_OVERRIDES)
    parser.add_argument("--report", type=Path, default=DEFAULT_REPORT)
    parser.add_argument("--fixture-dir", type=Path, help="use deterministic local source fixtures")
    parser.add_argument("--max-instagram-pages", type=int, default=DEFAULT_INSTAGRAM_MAX_PAGES)
    parser.add_argument("--page-delay-seconds", type=float, default=1.0)
    parser.add_argument("--tiktok-limit", type=int, default=DEFAULT_TIKTOK_LIMIT)
    parser.add_argument("--retries", type=int, default=3)
    parser.add_argument("--retry-delay-seconds", type=float, default=5.0)
    return parser


def main() -> int:
    args = build_parser().parse_args()
    try:
        report = run_refresh(args)
    except RefreshError as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
        return 1

    before = report["counts_before"]
    after = report["counts_after"]
    print(
        f"Refresh {report['mode']} complete: {before['videos']} -> {after['videos']} videos, "
        f"{before['exercise_groups']} -> {after['exercise_groups']} exercise groups"
    )
    print(
        f"Accepted {report['accepted_count']}, rejected {report['rejected_count']}, "
        f"skipped {report['skipped_count']}"
    )
    if not args.apply:
        print("Dry run only; re-run with --apply to write tracked data.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
