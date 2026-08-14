#!/usr/bin/env python3
"""Safely add newly published creator videos to the exercise catalog.

The command always scans every configured source. It is a dry run unless
``--apply`` is supplied. A failed or incomplete source scan exits before any
tracked file is changed.
"""

from __future__ import annotations

import argparse
import contextlib
import copy
import datetime as dt
import fcntl
import hashlib
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
DEFAULT_COACHING = PROJECT_DIR / "src" / "data" / "coaching.json"
DEFAULT_STATE = PROJECT_DIR / "data" / "refresh-state.json"
DEFAULT_OVERRIDES = PROJECT_DIR / "data" / "refresh-overrides.json"
DEFAULT_CURATION = PROJECT_DIR / "data" / "catalog-curation.json"
DEFAULT_REVIEW_QUEUE = PROJECT_DIR / "data" / "catalog-review-queue.json"
DEFAULT_TRANSACTION_JOURNAL = PROJECT_DIR / "data" / "refresh-transaction.json"
DEFAULT_REFRESH_LOCK = PROJECT_DIR / "data" / "refresh.lock"
DEFAULT_REPORT = PROJECT_DIR / "data" / "refresh-report.json"

CANONICAL_TRANSACTION_TARGETS = {
    "catalog": DEFAULT_CATALOG,
    "coaching": DEFAULT_COACHING,
    "state": DEFAULT_STATE,
    "review_queue": DEFAULT_REVIEW_QUEUE,
    "transaction_journal": DEFAULT_TRANSACTION_JOURNAL,
    "report": DEFAULT_REPORT,
}

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
ALLOWED_CATEGORIES = {
    "upper_body",
    "lower_body",
    "core",
    "full_body",
    "cardio",
    "mobility",
    "other",
}
ALLOWED_MOVEMENT_TYPES = {"compound", "isolation", "cardio", "stretch", "other"}
ALLOWED_COACHING_TOPICS = {
    "movement-technique",
    "class-delivery",
    "programming",
    "safety-and-modifications",
}


class RefreshError(RuntimeError):
    """Raised when a refresh cannot safely produce a complete result."""


class SimulatedTransactionCrash(RuntimeError):
    """Test-only fault raised after a durable target replacement."""


_LOCKED_WORKFLOW_TOKEN = object()


@contextlib.contextmanager
def exclusive_refresh_lock(path: Path):
    """Fail fast unless this process exclusively owns the stable repo lock."""
    try:
        descriptor = os.open(path, os.O_RDWR)
    except FileNotFoundError as exc:
        raise RefreshError(f"Required refresh lock does not exist: {path}") from exc
    try:
        try:
            fcntl.flock(descriptor, fcntl.LOCK_EX | fcntl.LOCK_NB)
        except BlockingIOError as exc:
            raise RefreshError(
                "Another catalog refresh is already running; wait for it to finish "
                "before retrying"
            ) from exc
        try:
            yield
        finally:
            fcntl.flock(descriptor, fcntl.LOCK_UN)
    finally:
        os.close(descriptor)


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


def fsync_directory(path: Path) -> None:
    descriptor = os.open(path, os.O_RDONLY)
    try:
        os.fsync(descriptor)
    finally:
        os.close(descriptor)


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
        fsync_directory(path.parent)
    finally:
        temporary_path.unlink(missing_ok=True)


def serialized_json(value: Any) -> bytes:
    return (json.dumps(value, indent=2, ensure_ascii=False) + "\n").encode("utf-8")


def sha256_bytes(value: bytes) -> str:
    return hashlib.sha256(value).hexdigest()


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def stage_json(path: Path, value: Any) -> tuple[Path, str]:
    """Durably stage a target replacement without changing the target."""
    path.parent.mkdir(parents=True, exist_ok=True)
    descriptor, temporary_name = tempfile.mkstemp(
        prefix=f".{path.name}.refresh-stage-", suffix=".json", dir=path.parent
    )
    temporary_path = Path(temporary_name)
    content = serialized_json(value)
    try:
        with os.fdopen(descriptor, "wb") as handle:
            handle.write(content)
            handle.flush()
            os.fsync(handle.fileno())
        fsync_directory(path.parent)
    except BaseException:
        temporary_path.unlink(missing_ok=True)
        raise
    return temporary_path, sha256_bytes(content)


def validate_transaction_journal(journal: dict[str, Any], path: Path) -> None:
    if not isinstance(journal, dict) or journal.get("version") != 1:
        raise RefreshError(f"Refresh transaction journal is invalid: {path}")
    status = journal.get("status")
    if status == "idle":
        return
    if status != "active":
        raise RefreshError(f"Refresh transaction journal has invalid status: {status!r}")
    entries = journal.get("entries")
    if not isinstance(entries, list) or not entries:
        raise RefreshError("Active refresh transaction has no entries")
    labels = [entry.get("label") for entry in entries if isinstance(entry, dict)]
    expected_labels = [
        "exercise_catalog",
        "coaching_catalog",
        "review_queue",
        "report",
        "state",
    ]
    if labels != expected_labels:
        raise RefreshError(
            "Refresh transaction must contain the five expected replacements "
            "with source state last"
        )
    seen_targets: set[str] = set()
    for entry in entries:
        for field in ("label", "target", "staged", "sha256"):
            if not isinstance(entry.get(field), str) or not entry[field]:
                raise RefreshError(f"Refresh transaction entry has no {field}")
        if entry["target"] in seen_targets:
            raise RefreshError(
                f"Refresh transaction repeats target {entry['target']}"
            )
        seen_targets.add(entry["target"])
        if not re.fullmatch(r"[0-9a-f]{64}", entry["sha256"]):
            raise RefreshError(
                f"Refresh transaction entry {entry['label']} has an invalid digest"
            )


def idle_transaction_journal() -> dict[str, Any]:
    return {
        "version": 1,
        "status": "idle",
        "transaction_id": None,
    }


def complete_refresh_transaction(
    journal_path: Path,
    journal: dict[str, Any],
    *,
    fault_after_rename: int | None = None,
) -> None:
    """Complete or recover every replacement recorded in an active journal."""
    validate_transaction_journal(journal, journal_path)
    if journal["status"] == "idle":
        return
    replacements = 0
    for entry in journal["entries"]:
        target = Path(entry["target"])
        staged = Path(entry["staged"])
        expected_digest = entry["sha256"]
        if staged.exists():
            if sha256_file(staged) != expected_digest:
                raise RefreshError(
                    f"Staged refresh payload failed integrity check: {staged}"
                )
            target.parent.mkdir(parents=True, exist_ok=True)
            os.replace(staged, target)
            fsync_directory(target.parent)
            replacements += 1
            if fault_after_rename == replacements:
                raise SimulatedTransactionCrash(
                    f"Simulated crash after replacing {entry['label']}"
                )
        elif not target.exists() or sha256_file(target) != expected_digest:
            raise RefreshError(
                "Refresh recovery cannot find a valid staged or installed payload "
                f"for {entry['label']}"
            )

    atomic_write_json(journal_path, idle_transaction_journal())


def recover_refresh_transaction(journal_path: Path) -> bool:
    journal = load_json(journal_path)
    validate_transaction_journal(journal, journal_path)
    if journal["status"] == "idle":
        return False
    complete_refresh_transaction(journal_path, journal)
    return True


def commit_refresh_transaction(
    journal_path: Path,
    replacements: list[tuple[str, Path, Any]],
    *,
    created_at: str,
    fault_after_rename: int | None = None,
) -> None:
    """Stage a recoverable multi-file commit and keep source state last."""
    current = load_json(journal_path)
    validate_transaction_journal(current, journal_path)
    if current["status"] != "idle":
        raise RefreshError("Cannot start a refresh while recovery is pending")
    if not replacements or replacements[-1][0] != "state":
        raise RefreshError("Refresh transaction replacements must put source state last")

    entries: list[dict[str, str]] = []
    try:
        for label, target, value in replacements:
            staged, digest = stage_json(target, value)
            entries.append(
                {
                    "label": label,
                    "target": str(target.resolve()),
                    "staged": str(staged.resolve()),
                    "sha256": digest,
                }
            )
    except BaseException:
        for entry in entries:
            Path(entry["staged"]).unlink(missing_ok=True)
        raise

    journal = {
        "version": 1,
        "status": "active",
        "transaction_id": f"{created_at}-{os.getpid()}",
        "created_at": created_at,
        "entries": entries,
    }
    # The active manifest is durable before the first public-file rename. If
    # installing it fails ambiguously, retain staged payloads for inspection;
    # deleting them could invalidate a manifest that did reach disk.
    atomic_write_json(journal_path, journal)

    complete_refresh_transaction(
        journal_path,
        journal,
        fault_after_rename=fault_after_rename,
    )


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


def validate_nonempty_string(value: Any, context: str) -> None:
    if not isinstance(value, str) or not value.strip() or value != value.strip():
        raise RefreshError(f"{context} must be a nonempty trimmed string")


def validate_string_array(
    value: Any,
    context: str,
    *,
    require_nonempty: bool = False,
) -> None:
    if not isinstance(value, list) or (
        require_nonempty and not value
    ):
        suffix = "nonempty " if require_nonempty else ""
        raise RefreshError(f"{context} must be a {suffix}array of strings")
    for index, item in enumerate(value):
        validate_nonempty_string(item, f"{context}[{index}]")


def validate_reviewed_cue(cue: Any, context: str) -> None:
    validate_nonempty_string(cue, context)
    if re.search(r"[\r\n]", cue):
        raise RefreshError(f"{context} must not contain line breaks")
    if re.search(r"(^|\s)#[A-Za-z][A-Za-z0-9_]*", cue):
        raise RefreshError(f"{context} must not contain social hashtags")
    if re.search(r"\bso we want to kee$", cue, re.IGNORECASE):
        raise RefreshError(f"{context} is a known truncated source fragment")


def validate_curation(curation: dict[str, Any]) -> None:
    decisions = curation.get("decisions")
    if not isinstance(decisions, dict):
        raise RefreshError("Catalog curation must contain a decisions object")

    allowed_decisions = {"exercise", "coaching", "exclude"}
    allowed_exclusion_reasons = {
        "milestone",
        "promotion",
        "event",
        "personal",
        "duplicate",
        "unusable",
    }
    for video_id, value in decisions.items():
        if not video_id or not isinstance(value, dict):
            raise RefreshError("Catalog curation decisions require video IDs and objects")
        decision = value.get("decision")
        if decision not in allowed_decisions:
            raise RefreshError(f"Invalid curation decision for {video_id}: {decision!r}")
        if decision == "exclude":
            if value.get("reason") not in allowed_exclusion_reasons:
                raise RefreshError(
                    f"Excluded curation decision {video_id} needs a recognized reason"
                )
        elif not isinstance(value.get("destination_id"), str) or not value["destination_id"]:
            raise RefreshError(f"Curated {decision} decision {video_id} needs a destination_id")
        review_origin = value.get("review_origin")
        if review_origin not in {
            "legacy-other",
            "catalog-audit",
            "review-queue",
            "legacy-refresh",
        }:
            raise RefreshError(
                f"Curation decision {video_id} needs an explicit review_origin"
            )
        source_group_id = value.get("source_group_id")
        if review_origin in {"legacy-other", "catalog-audit"}:
            if not isinstance(source_group_id, str) or not source_group_id:
                raise RefreshError(
                    f"{review_origin} curation decision {video_id} needs a source_group_id"
                )
        elif source_group_id is not None:
            raise RefreshError(
                f"{review_origin} curation decision {video_id} must not have a source_group_id"
            )

    exercise_metadata = curation.get("exercise_metadata")
    if not isinstance(exercise_metadata, dict):
        raise RefreshError("Catalog curation must contain exercise_metadata")
    for destination_id, metadata in exercise_metadata.items():
        validate_nonempty_string(destination_id, "Exercise metadata destination ID")
        if not isinstance(metadata, dict):
            raise RefreshError(
                f"Exercise metadata {destination_id} must contain an object"
            )
        if "coaching_cues" in metadata:
            raise RefreshError(
                f"Exercise metadata {destination_id} must use reviewed_coaching_cues "
                "as the single cue ledger"
            )
        validate_nonempty_string(
            metadata.get("exercise_name"),
            f"Exercise metadata {destination_id}.exercise_name",
        )
        if metadata.get("category") not in ALLOWED_CATEGORIES:
            raise RefreshError(
                f"Exercise metadata {destination_id} has invalid category"
            )
        validate_string_array(
            metadata.get("muscle_groups"),
            f"Exercise metadata {destination_id}.muscle_groups",
            require_nonempty=True,
        )
        validate_string_array(
            metadata.get("equipment"),
            f"Exercise metadata {destination_id}.equipment",
        )
        if metadata.get("movement_type") not in ALLOWED_MOVEMENT_TYPES:
            raise RefreshError(
                f"Exercise metadata {destination_id} has invalid movement_type"
            )

    equipment_review_exceptions = curation.get(
        "equipment_review_exceptions", {}
    )
    if not isinstance(equipment_review_exceptions, dict):
        raise RefreshError(
            "Catalog curation equipment_review_exceptions must be an object"
        )
    allowed_equipment_exception_reasons = {
        "thumbnail-inconclusive",
        "movement-does-not-use-external-load",
        "support-only-is-complete",
    }
    for destination_id, exception in equipment_review_exceptions.items():
        validate_nonempty_string(
            destination_id, "Equipment review exception destination ID"
        )
        if destination_id not in exercise_metadata:
            raise RefreshError(
                f"Equipment review exception {destination_id} has no exercise metadata"
            )
        if not isinstance(exception, dict) or set(exception) != {"reason", "note"}:
            raise RefreshError(
                f"Equipment review exception {destination_id} must contain only reason and note"
            )
        if exception.get("reason") not in allowed_equipment_exception_reasons:
            raise RefreshError(
                f"Equipment review exception {destination_id} has an invalid reason"
            )
        validate_nonempty_string(
            exception.get("note"),
            f"Equipment review exception {destination_id}.note",
        )

    coaching_resources = curation.get("coaching_resources")
    if not isinstance(coaching_resources, dict):
        raise RefreshError("Catalog curation must contain coaching_resources")
    for destination_id, metadata in coaching_resources.items():
        validate_nonempty_string(destination_id, "Coaching metadata destination ID")
        if not isinstance(metadata, dict):
            raise RefreshError(
                f"Coaching metadata {destination_id} must contain an object"
            )
        validate_nonempty_string(
            metadata.get("title"), f"Coaching metadata {destination_id}.title"
        )
        validate_nonempty_string(
            metadata.get("summary"), f"Coaching metadata {destination_id}.summary"
        )
        if metadata.get("topic") not in ALLOWED_COACHING_TOPICS:
            raise RefreshError(
                f"Coaching metadata {destination_id} has invalid topic"
            )
        validate_string_array(
            metadata.get("related_exercise_ids"),
            f"Coaching metadata {destination_id}.related_exercise_ids",
        )

    reviewed_cues = curation.get("reviewed_coaching_cues")
    if not isinstance(reviewed_cues, dict):
        raise RefreshError("Catalog curation must contain reviewed_coaching_cues")
    for destination_id, cues in reviewed_cues.items():
        validate_nonempty_string(destination_id, "Reviewed cue destination ID")
        if not isinstance(cues, list) or len(cues) > 10:
            raise RefreshError(
                f"Reviewed cues {destination_id} must be an array of at most 10 cues"
            )
        for index, cue in enumerate(cues):
            validate_reviewed_cue(cue, f"Reviewed cues {destination_id}[{index}]")

    for video_id, value in decisions.items():
        decision = value["decision"]
        destination_id = value.get("destination_id")
        if decision == "exercise" and destination_id not in exercise_metadata:
            raise RefreshError(
                f"Exercise curation decision {video_id} has no reviewed metadata"
            )
        if decision == "coaching" and destination_id not in coaching_resources:
            raise RefreshError(
                f"Coaching curation decision {video_id} has no reviewed metadata"
            )


def validate_review_queue(queue: dict[str, Any]) -> None:
    if not isinstance(queue, dict) or queue.get("version") != 1:
        raise RefreshError("Catalog review queue must be a version 1 object")
    items = queue.get("items")
    if not isinstance(items, dict):
        raise RefreshError("Catalog review queue must contain an items object")

    seen_urls: dict[str, str] = {}
    for video_id, entry in items.items():
        if not video_id or not isinstance(entry, dict):
            raise RefreshError("Review queue entries require video IDs and objects")
        candidate = entry.get("candidate")
        if not isinstance(candidate, dict) or candidate.get("id") != video_id:
            raise RefreshError(
                f"Review queue entry {video_id} must contain its full candidate record"
            )
        url = str(candidate.get("url") or "")
        if not url:
            raise RefreshError(f"Review queue candidate {video_id} has no URL")
        if url in seen_urls and seen_urls[url] != video_id:
            raise RefreshError(
                f"Review queue candidates {seen_urls[url]} and {video_id} share URL {url}"
            )
        seen_urls[url] = video_id
        creator = candidate.get("creator")
        if not isinstance(creator, dict) or not creator.get("id"):
            raise RefreshError(f"Review queue candidate {video_id} has no creator")
        if not isinstance(entry.get("source_key"), str) or not entry["source_key"]:
            raise RefreshError(f"Review queue entry {video_id} has no source_key")
        for field in ("first_seen_at", "last_seen_at"):
            if not isinstance(entry.get(field), str) or not entry[field]:
                raise RefreshError(f"Review queue entry {video_id} has no {field}")


def candidate_source_key(candidate: dict[str, Any]) -> str:
    platform = str(candidate.get("source") or "")
    creator = candidate.get("creator") or {}
    handle = str(creator.get("handle") or creator.get("id") or "")
    if not platform or not handle:
        raise RefreshError(
            f"Candidate {candidate.get('id', '<unknown>')} has no source identity"
        )
    return f"{platform}:{handle}"


def merge_review_candidates(
    queue: dict[str, Any],
    scans: list[SourceScan],
) -> tuple[list[dict[str, Any]], dict[str, dict[str, Any]], set[str]]:
    """Merge persisted candidates with the newest scans without losing history."""
    validate_review_queue(queue)
    candidates_by_id = {
        video_id: copy.deepcopy(entry["candidate"])
        for video_id, entry in queue["items"].items()
    }
    lineage = copy.deepcopy(queue["items"])
    scanned_ids: set[str] = set()
    urls_by_id = {
        video_id: str(candidate.get("url") or "")
        for video_id, candidate in candidates_by_id.items()
    }
    ids_by_url = {url: video_id for video_id, url in urls_by_id.items()}

    for scan in scans:
        for candidate in scan.candidates:
            video_id = str(candidate.get("id") or "")
            url = str(candidate.get("url") or "")
            if not video_id or not url:
                raise RefreshError("Scanned candidate is missing an id or URL")
            scanned_ids.add(video_id)
            existing_url = urls_by_id.get(video_id)
            if existing_url and existing_url != url:
                raise RefreshError(
                    f"Candidate {video_id} changed URL from {existing_url} to {url}"
                )
            other_id = ids_by_url.get(url)
            if other_id and other_id != video_id:
                raise RefreshError(
                    f"Candidates {other_id} and {video_id} share URL {url}"
                )
            # The current scan may refresh an expiring source thumbnail while
            # the persisted candidate retains its first-seen audit metadata.
            candidates_by_id[video_id] = copy.deepcopy(candidate)
            urls_by_id[video_id] = url
            ids_by_url[url] = video_id
            previous = lineage.get(video_id, {})
            previous["source_key"] = scan.key
            lineage[video_id] = previous

    candidates = sorted(
        candidates_by_id.values(),
        key=lambda value: (int(value.get("timestamp") or 0), str(value.get("id") or "")),
    )
    return candidates, lineage, scanned_ids


def build_review_queue(
    previous: dict[str, Any],
    *,
    candidates: list[dict[str, Any]],
    lineage: dict[str, dict[str, Any]],
    scanned_ids: set[str],
    pending_ids: set[str],
    checked_at: str,
) -> dict[str, Any]:
    """Create the next durable queue from candidates still awaiting authority."""
    validate_review_queue(previous)
    candidates_by_id = {
        str(candidate.get("id") or ""): candidate for candidate in candidates
    }
    if "" in candidates_by_id:
        raise RefreshError("Queued candidate is missing an id")
    missing = pending_ids - set(candidates_by_id)
    if missing:
        raise RefreshError(f"Pending review IDs have no candidate data: {sorted(missing)}")

    enrich_video: Callable[[dict[str, Any]], dict[str, Any]] | None = None
    loader_error: str | None = None
    if pending_ids:
        try:
            enrich_video = load_enricher()
        except Exception as exc:  # Queue persistence is authoritative; advice is not.
            loader_error = f"{type(exc).__name__}: {exc}"[:500]
    items: dict[str, dict[str, Any]] = {}
    for video_id in sorted(pending_ids):
        candidate = copy.deepcopy(candidates_by_id[video_id])
        old_entry = previous["items"].get(video_id, {})
        source_key = lineage.get(video_id, {}).get("source_key") or candidate_source_key(
            candidate
        )
        suggested: dict[str, Any] = {}
        suggested_error: str | None = loader_error
        if enrich_video and not suggested_error:
            try:
                suggested = enrich_video(copy.deepcopy(candidate)).get(
                    "enrichment", {}
                )
            except Exception as exc:  # Advisory analysis must not block ingestion.
                suggested_error = f"{type(exc).__name__}: {exc}"[:500]
        entry = {
            "source_key": source_key,
            "first_seen_at": old_entry.get("first_seen_at") or checked_at,
            "last_seen_at": (
                checked_at
                if video_id in scanned_ids
                else old_entry.get("last_seen_at") or checked_at
            ),
            "status": "pending-review",
            "candidate": candidate,
            # Heuristics are advisory queue context only. They never authorize
            # public exercise/coaching placement or exclusion.
            "suggested_enrichment": copy.deepcopy(suggested),
        }
        if suggested_error:
            entry["suggested_enrichment_error"] = suggested_error
        items[video_id] = entry

    updated_at = previous.get("updated_at")
    if items != previous.get("items", {}):
        updated_at = checked_at
    queue = {"version": 1, "updated_at": updated_at, "items": items}
    validate_review_queue(queue)
    return queue


def validate_checkpoint_coverage(
    scanned_ids: set[str],
    *,
    public_ids: set[str],
    excluded_ids: set[str],
    queued_ids: set[str],
) -> None:
    unresolved = scanned_ids - public_ids - excluded_ids - queued_ids
    if unresolved:
        raise RefreshError(
            "Source checkpoints cannot advance because candidates are neither "
            f"public, excluded, nor queued: {sorted(unresolved)}"
        )


def final_video(candidate: dict[str, Any]) -> dict[str, Any]:
    return {
        "id": candidate["id"],
        "url": candidate["url"],
        "source": candidate.get("source", "tiktok"),
        "thumbnail": candidate.get("thumbnail", ""),
        "description": candidate.get("description", ""),
        "creator": copy.deepcopy(candidate["creator"]),
    }


def preserve_existing_records(
    before: list[dict[str, Any]],
    after: list[dict[str, Any]],
    *,
    reviewed_metadata_ids: set[str] | None = None,
) -> None:
    reviewed_metadata_ids = reviewed_metadata_ids or set()
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
        raise RefreshError(f"Refresh removed existing catalog records: {missing_groups[:5]}")
    for old_group in before:
        new_group = after_groups[old_group["id"]]
        for key, value in old_group.items():
            if (
                key != "videos"
                and old_group["id"] not in reviewed_metadata_ids
                and new_group.get(key) != value
            ):
                raise RefreshError(
                    f"Refresh changed existing catalog metadata: {old_group['id']} ({key})"
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


EXERCISE_METADATA_FIELDS = (
    "exercise_name",
    "category",
    "muscle_groups",
    "equipment",
    "movement_type",
)
COACHING_METADATA_FIELDS = (
    "title",
    "topic",
    "summary",
    "related_exercise_ids",
)


def _reviewed_metadata(
    curation: dict[str, Any], *, section: str, destination_id: str
) -> dict[str, Any]:
    if section == "exercise":
        collection = curation.get("exercise_metadata", {})
        required = EXERCISE_METADATA_FIELDS
    else:
        collection = curation.get("coaching_resources", {})
        required = COACHING_METADATA_FIELDS
    metadata = collection.get(destination_id) if isinstance(collection, dict) else None
    if not isinstance(metadata, dict) or any(key not in metadata for key in required):
        raise RefreshError(
            f"Curated {section} destination {destination_id} has incomplete reviewed metadata"
        )
    return metadata


def _reviewed_exercise_cues(
    curation: dict[str, Any], destination_id: str
) -> list[str]:
    cues = curation.get("reviewed_coaching_cues", {}).get(destination_id, [])
    return copy.deepcopy(cues)


def _apply_reviewed_metadata(
    record: dict[str, Any], metadata: dict[str, Any], fields: tuple[str, ...]
) -> bool:
    changed = False
    for field in fields:
        reviewed_value = copy.deepcopy(metadata[field])
        if record.get(field) != reviewed_value:
            record[field] = reviewed_value
            changed = True
    return changed


def reconcile_catalog_curation(
    catalog: list[dict[str, Any]],
    coaching: list[dict[str, Any]],
    curation: dict[str, Any],
) -> tuple[list[dict[str, Any]], list[dict[str, Any]], list[dict[str, Any]]]:
    """Reapply durable decisions to already-public records before source import.

    A later review can therefore move a video between sections, exclude it, or
    revise its destination metadata. Records without a durable decision remain
    byte-for-byte identical and in their original container.
    """
    validate_curation(curation)
    updated_catalog = copy.deepcopy(catalog)
    updated_coaching = copy.deepcopy(coaching)
    exercise_groups = {group["id"]: group for group in updated_catalog}
    coaching_resources = {resource["id"]: resource for resource in updated_coaching}
    if len(exercise_groups) != len(updated_catalog):
        raise RefreshError("Catalog contains duplicate exercise group IDs")
    if len(coaching_resources) != len(updated_coaching):
        raise RefreshError("Coaching catalog contains duplicate resource IDs")

    locations: dict[str, tuple[str, str, dict[str, Any]]] = {}
    urls: dict[str, str] = {}
    for section, records in (
        ("exercise", updated_catalog),
        ("coaching", updated_coaching),
    ):
        for record in records:
            for video in record.get("videos", []):
                video_id = str(video.get("id") or "")
                url = str(video.get("url") or "")
                if not video_id or not url:
                    raise RefreshError(f"Public {section} video is missing an id or URL")
                if video_id in locations:
                    raise RefreshError(f"Public video ID appears more than once: {video_id}")
                if url in urls:
                    raise RefreshError(
                        f"Public videos {urls[url]} and {video_id} share URL {url}"
                    )
                locations[video_id] = (section, record["id"], video)
                urls[url] = video_id

    decisions = curation["decisions"]
    uncurated_before = {
        video_id: (section, container_id, copy.deepcopy(video))
        for video_id, (section, container_id, video) in locations.items()
        if video_id not in decisions
    }
    exercise_metadata_before = {
        group["id"]: {key: copy.deepcopy(value) for key, value in group.items() if key != "videos"}
        for group in updated_catalog
    }
    coaching_metadata_before = {
        resource["id"]: {
            key: copy.deepcopy(value)
            for key, value in resource.items()
            if key != "videos"
        }
        for resource in updated_coaching
    }
    reviewed_exercise_destinations: set[str] = set()
    reviewed_coaching_destinations: set[str] = set()
    changes: list[dict[str, Any]] = []

    exercise_decision_destinations = {
        decision["destination_id"]
        for decision in decisions.values()
        if decision["decision"] == "exercise"
    }
    coaching_decision_destinations = {
        decision["destination_id"]
        for decision in decisions.values()
        if decision["decision"] == "coaching"
    }

    # Reviewed destination metadata is independently authoritative. Applying
    # it cannot depend on a particular video still carrying the original
    # migration decision (for example, a later equipment-only correction).
    for destination_id, metadata in curation["exercise_metadata"].items():
        target = exercise_groups.get(destination_id)
        if target is None:
            if destination_id not in exercise_decision_destinations:
                raise RefreshError(
                    f"Reviewed exercise metadata has no destination {destination_id}"
                )
            continue
        metadata_changed = _apply_reviewed_metadata(
            target, metadata, EXERCISE_METADATA_FIELDS
        )
        reviewed_cues = _reviewed_exercise_cues(curation, destination_id)
        if target.get("coaching_cues") != reviewed_cues:
            target["coaching_cues"] = reviewed_cues
            metadata_changed = True
        reviewed_exercise_destinations.add(destination_id)
        if metadata_changed:
            changes.append(
                {
                    "section": "exercise",
                    "destination_id": destination_id,
                    "metadata_updated": True,
                }
            )

    for destination_id, cues in curation["reviewed_coaching_cues"].items():
        target = exercise_groups.get(destination_id)
        if target is None:
            if destination_id not in exercise_decision_destinations:
                raise RefreshError(
                    f"Reviewed coaching cues have no exercise destination {destination_id}"
                )
            continue
        if target.get("coaching_cues") != cues:
            target["coaching_cues"] = copy.deepcopy(cues)
            reviewed_exercise_destinations.add(destination_id)
            changes.append(
                {
                    "section": "exercise",
                    "destination_id": destination_id,
                    "metadata_updated": True,
                }
            )

    for destination_id, metadata in curation["coaching_resources"].items():
        target = coaching_resources.get(destination_id)
        if target is None:
            if destination_id not in coaching_decision_destinations:
                raise RefreshError(
                    f"Reviewed coaching metadata has no destination {destination_id}"
                )
            continue
        if _apply_reviewed_metadata(target, metadata, COACHING_METADATA_FIELDS):
            changes.append(
                {
                    "section": "coaching",
                    "destination_id": destination_id,
                    "metadata_updated": True,
                }
            )
        reviewed_coaching_destinations.add(destination_id)

    def remove_video(section: str, container_id: str, video_id: str) -> dict[str, Any]:
        records_by_id = exercise_groups if section == "exercise" else coaching_resources
        record = records_by_id[container_id]
        matches = [video for video in record.get("videos", []) if video.get("id") == video_id]
        if len(matches) != 1:
            raise RefreshError(f"Could not reconcile public video {video_id}")
        record["videos"] = [
            video for video in record.get("videos", []) if video.get("id") != video_id
        ]
        return matches[0]

    for video_id, decision in decisions.items():
        location = locations.get(video_id)
        if location is None:
            continue
        source_section, source_id, _ = location
        target_section = decision["decision"]
        destination_id = decision.get("destination_id")

        if target_section == "exclude":
            remove_video(source_section, source_id, video_id)
            changes.append(
                {
                    "id": video_id,
                    "from": f"{source_section}:{source_id}",
                    "to": "exclude",
                    "reason": decision["reason"],
                }
            )
            continue

        if target_section == "exercise":
            metadata = _reviewed_metadata(
                curation, section="exercise", destination_id=destination_id
            )
            target = exercise_groups.get(destination_id)
            if target is None:
                target = {
                    "id": destination_id,
                    **{key: copy.deepcopy(metadata[key]) for key in EXERCISE_METADATA_FIELDS},
                    "coaching_cues": [],
                    "videos": [],
                }
                exercise_groups[destination_id] = target
                updated_catalog.append(target)
            metadata_changed = _apply_reviewed_metadata(
                target, metadata, EXERCISE_METADATA_FIELDS
            )
            reviewed_cues = _reviewed_exercise_cues(curation, destination_id)
            if target.get("coaching_cues") != reviewed_cues:
                target["coaching_cues"] = reviewed_cues
                metadata_changed = True
            reviewed_exercise_destinations.add(destination_id)
            if source_section != "exercise" or source_id != destination_id:
                moved_video = remove_video(source_section, source_id, video_id)
                target["videos"].append(moved_video)
                changes.append(
                    {
                        "id": video_id,
                        "from": f"{source_section}:{source_id}",
                        "to": f"exercise:{destination_id}",
                    }
                )
            elif metadata_changed:
                changes.append(
                    {
                        "id": video_id,
                        "from": f"exercise:{source_id}",
                        "to": f"exercise:{destination_id}",
                        "metadata_updated": True,
                    }
                )
        elif target_section == "coaching":
            metadata = _reviewed_metadata(
                curation, section="coaching", destination_id=destination_id
            )
            target = coaching_resources.get(destination_id)
            if target is None:
                target = {
                    "id": destination_id,
                    **{key: copy.deepcopy(metadata[key]) for key in COACHING_METADATA_FIELDS},
                    "videos": [],
                }
                coaching_resources[destination_id] = target
                updated_coaching.append(target)
            metadata_changed = _apply_reviewed_metadata(
                target, metadata, COACHING_METADATA_FIELDS
            )
            reviewed_coaching_destinations.add(destination_id)
            if source_section != "coaching" or source_id != destination_id:
                moved_video = remove_video(source_section, source_id, video_id)
                target["videos"].append(moved_video)
                changes.append(
                    {
                        "id": video_id,
                        "from": f"{source_section}:{source_id}",
                        "to": f"coaching:{destination_id}",
                    }
                )
            elif metadata_changed:
                changes.append(
                    {
                        "id": video_id,
                        "from": f"coaching:{source_id}",
                        "to": f"coaching:{destination_id}",
                        "metadata_updated": True,
                    }
                )

    updated_catalog = [group for group in updated_catalog if group.get("videos")]
    updated_coaching = [resource for resource in updated_coaching if resource.get("videos")]
    updated_catalog.sort(
        key=lambda group: (str(group.get("exercise_name", "")).lower(), group["id"])
    )
    updated_coaching.sort(
        key=lambda resource: (str(resource.get("title", "")).lower(), resource["id"])
    )

    after_locations: dict[str, tuple[str, str, dict[str, Any]]] = {}
    for section, records in (
        ("exercise", updated_catalog),
        ("coaching", updated_coaching),
    ):
        for record in records:
            for video in record.get("videos", []):
                video_id = video["id"]
                if video_id in after_locations:
                    raise RefreshError(f"Reconciliation duplicated public video {video_id}")
                after_locations[video_id] = (section, record["id"], video)

    for video_id, before in uncurated_before.items():
        if after_locations.get(video_id) != before:
            raise RefreshError(
                f"Curation reconciliation changed uncurated video {video_id}"
            )
    for group in updated_catalog:
        group_id = group["id"]
        if group_id in exercise_metadata_before and group_id not in reviewed_exercise_destinations:
            after_metadata = {key: value for key, value in group.items() if key != "videos"}
            if after_metadata != exercise_metadata_before[group_id]:
                raise RefreshError(
                    f"Curation reconciliation changed unreviewed exercise metadata {group_id}"
                )
    for resource in updated_coaching:
        resource_id = resource["id"]
        if (
            resource_id in coaching_metadata_before
            and resource_id not in reviewed_coaching_destinations
        ):
            after_metadata = {
                key: value for key, value in resource.items() if key != "videos"
            }
            if after_metadata != coaching_metadata_before[resource_id]:
                raise RefreshError(
                    f"Curation reconciliation changed unreviewed coaching metadata {resource_id}"
                )

    return updated_catalog, updated_coaching, changes


def build_updated_catalog(
    catalog: list[dict[str, Any]],
    candidates: list[dict[str, Any]],
    overrides: dict[str, Any],
    curation: dict[str, Any] | None = None,
    *,
    legacy_override_ids: set[str] | None = None,
) -> tuple[list[dict[str, Any]], dict[str, Any]]:
    validate_overrides(overrides)
    curation = curation or {
        "decisions": {},
        "exercise_metadata": {},
        "coaching_resources": {},
        "reviewed_coaching_cues": {},
        "equipment_review_exceptions": {},
    }
    validate_curation(curation)
    legacy_override_ids = legacy_override_ids or set()
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
    curation_decisions = curation.get("decisions", {})

    decisions: dict[str, list[dict[str, Any]]] = {
        "accepted": [],
        "rejected": [],
        "quarantined": [],
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

        curated = curation_decisions.get(video_id)
        if curated and curated["decision"] == "exclude":
            decisions["rejected"].append(
                {
                    "id": video_id,
                    "creator": candidate["creator"]["id"],
                    "reason": f"curation:{curated['reason']}",
                }
            )
            continue
        if curated and curated["decision"] == "coaching":
            decisions["quarantined"].append(
                {
                    "id": video_id,
                    "creator": candidate["creator"]["id"],
                    "reason": "reviewed_coaching_resource",
                    "destination_id": curated["destination_id"],
                }
            )
            continue

        legacy_override_allowed = video_id in legacy_override_ids
        if not curated and legacy_override_allowed and video_id in rejected_overrides:
            value = rejected_overrides[video_id]
            reason = value.get("reason", "manual_reject") if isinstance(value, dict) else str(value)
            decisions["rejected"].append(
                {"id": video_id, "creator": candidate["creator"]["id"], "reason": reason}
            )
            continue

        target_group_id = (
            curated.get("destination_id")
            if curated and curated["decision"] == "exercise"
            else append_overrides.get(video_id)
            if legacy_override_allowed
            else None
        )
        metadata: dict[str, Any] | None = None
        classification = ""
        if curated and curated["decision"] == "exercise":
            metadata = copy.deepcopy(
                _reviewed_metadata(
                    curation,
                    section="exercise",
                    destination_id=curated["destination_id"],
                )
            )
            # Cues are publishable only when the reviewed ledger supplies them.
            metadata["coaching_cues"] = _reviewed_exercise_cues(
                curation, curated["destination_id"]
            )
            classification = "curation_exercise"
        elif target_group_id:
            classification = "explicit_append"
        elif legacy_override_allowed and video_id in force_overrides:
            metadata = copy.deepcopy(force_overrides[video_id])
            classification = "manual_force_include"
        else:
            decisions["quarantined"].append(
                {
                    "id": video_id,
                    "creator": candidate["creator"]["id"],
                    "reason": "awaiting_durable_review",
                }
            )
            continue

        if (
            metadata is not None
            and not curated
            and legacy_override_allowed
            and video_id in title_overrides
        ):
            metadata["exercise_name"] = title_overrides[video_id]

        if (
            metadata is not None
            and metadata.get("category") == "other"
            and not metadata.get("muscle_groups")
        ):
            decisions["quarantined"].append(
                {
                    "id": video_id,
                    "creator": candidate["creator"]["id"],
                    "reason": "unresolved_other_without_muscle",
                }
            )
            continue

        if target_group_id:
            target = groups_by_id.get(target_group_id)
            if target is None:
                if not curated or metadata is None:
                    raise RefreshError(
                        f"Append override for {video_id} references missing group {target_group_id}"
                    )
                target = {
                    "id": target_group_id,
                    "exercise_name": metadata["exercise_name"],
                    "category": metadata["category"],
                    "muscle_groups": copy.deepcopy(metadata["muscle_groups"]),
                    "equipment": copy.deepcopy(metadata["equipment"]),
                    "movement_type": metadata["movement_type"],
                    "coaching_cues": copy.deepcopy(metadata["coaching_cues"]),
                    "videos": [],
                }
                groups_by_id[target_group_id] = target
                updated.append(target)
                classification = "curation_exercise_new_group"
            elif curated and metadata is not None:
                _apply_reviewed_metadata(target, metadata, EXERCISE_METADATA_FIELDS)
                target["coaching_cues"] = copy.deepcopy(metadata["coaching_cues"])
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
                    "coaching_cues": [],
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
    reviewed_metadata_ids = {
        decision["destination_id"]
        for video_id, decision in curation_decisions.items()
        if decision.get("decision") == "exercise"
        and any(candidate.get("id") == video_id for candidate in candidates)
    }
    preserve_existing_records(
        catalog, updated, reviewed_metadata_ids=reviewed_metadata_ids
    )
    return updated, decisions


def build_updated_coaching_catalog(
    coaching: list[dict[str, Any]],
    candidates: list[dict[str, Any]],
    curation: dict[str, Any],
    *,
    exercise_catalog: list[dict[str, Any]] | None = None,
) -> tuple[list[dict[str, Any]], dict[str, list[dict[str, Any]]]]:
    """Apply reviewed coaching decisions without inventing public metadata."""
    validate_curation(curation)
    updated = copy.deepcopy(coaching)
    resources_by_id = {resource["id"]: resource for resource in updated}
    if len(resources_by_id) != len(updated):
        raise RefreshError("Coaching catalog contains duplicate resource IDs")

    existing_ids = {
        video["id"] for resource in updated for video in resource.get("videos", [])
    }
    existing_urls = {
        video["url"] for resource in updated for video in resource.get("videos", [])
    }
    exercise_ids = {
        video["id"]
        for group in exercise_catalog or []
        for video in group.get("videos", [])
    }
    exercise_urls = {
        video["url"]
        for group in exercise_catalog or []
        for video in group.get("videos", [])
    }
    metadata_by_id = curation.get("coaching_resources", {})
    decisions: dict[str, list[dict[str, Any]]] = {
        "accepted": [],
        "skipped": [],
    }

    for candidate in sorted(
        candidates,
        key=lambda value: (int(value.get("timestamp") or 0), str(value.get("id") or "")),
    ):
        video_id = str(candidate.get("id") or "")
        url = str(candidate.get("url") or "")
        if not video_id or not url:
            raise RefreshError("Coaching candidate is missing an id or URL")
        curated = curation.get("decisions", {}).get(video_id)
        if not curated or curated.get("decision") != "coaching":
            raise RefreshError(f"Coaching candidate {video_id} has no coaching decision")
        if video_id in existing_ids:
            decisions["skipped"].append(
                {"id": video_id, "reason": "already_present_in_coaching"}
            )
            continue
        if url in existing_urls:
            raise RefreshError(
                f"Coaching candidate URL is already present under another id: {url}"
            )
        if video_id in exercise_ids or url in exercise_urls:
            raise RefreshError(
                f"Coaching candidate {video_id} conflicts with the exercise catalog"
            )

        destination_id = curated["destination_id"]
        metadata = metadata_by_id.get(destination_id)
        if not isinstance(metadata, dict):
            raise RefreshError(
                f"Coaching destination {destination_id} has no reviewed metadata"
            )
        required = ("title", "topic", "summary", "related_exercise_ids")
        if any(key not in metadata for key in required):
            raise RefreshError(
                f"Coaching destination {destination_id} has incomplete reviewed metadata"
            )

        resource = resources_by_id.get(destination_id)
        if resource is None:
            resource = {
                "id": destination_id,
                "title": metadata["title"],
                "topic": metadata["topic"],
                "summary": metadata["summary"],
                "related_exercise_ids": copy.deepcopy(
                    metadata["related_exercise_ids"]
                ),
                "videos": [],
            }
            resources_by_id[destination_id] = resource
            updated.append(resource)
        else:
            _apply_reviewed_metadata(resource, metadata, COACHING_METADATA_FIELDS)

        resource["videos"].append(final_video(candidate))
        existing_ids.add(video_id)
        existing_urls.add(url)
        decisions["accepted"].append(
            {
                "id": video_id,
                "creator": candidate["creator"]["id"],
                "source": candidate.get("source"),
                "coaching_resource": destination_id,
                "decision": "curation_coaching",
            }
        )

    updated.sort(key=lambda resource: (str(resource.get("title", "")).lower(), resource["id"]))
    reviewed_metadata_ids = {
        decision["destination_id"]
        for video_id, decision in curation.get("decisions", {}).items()
        if decision.get("decision") == "coaching"
        and any(candidate.get("id") == video_id for candidate in candidates)
    }
    preserve_existing_records(
        coaching, updated, reviewed_metadata_ids=reviewed_metadata_ids
    )
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


def _run_refresh_locked(
    args: argparse.Namespace, *, ownership_token: object
) -> dict[str, Any]:
    if ownership_token is not _LOCKED_WORKFLOW_TOKEN:
        raise RefreshError("Internal refresh entry point requires lock ownership")
    transaction_journal_path = getattr(
        args, "transaction_journal", DEFAULT_TRANSACTION_JOURNAL
    )
    pending_journal = load_json(transaction_journal_path)
    validate_transaction_journal(pending_journal, transaction_journal_path)
    if pending_journal["status"] == "active" and not args.apply:
        raise RefreshError(
            "A refresh transaction is pending; rerun with --apply to recover it "
            "before using dry-run mode"
        )
    recovered_transaction = (
        recover_refresh_transaction(transaction_journal_path)
        if pending_journal["status"] == "active"
        else False
    )
    catalog = load_json(args.catalog)
    coaching = load_json(getattr(args, "coaching", DEFAULT_COACHING))
    state = load_json(args.state)
    overrides = load_json(args.overrides)
    curation = load_json(getattr(args, "curation", DEFAULT_CURATION))
    review_queue_path = getattr(args, "review_queue", DEFAULT_REVIEW_QUEUE)
    review_queue = load_json(review_queue_path)
    if not isinstance(catalog, list):
        raise RefreshError("Exercise catalog must be a JSON array")
    if not isinstance(coaching, list):
        raise RefreshError("Coaching catalog must be a JSON array")
    validate_overrides(overrides)
    validate_curation(curation)
    validate_review_queue(review_queue)

    reconciled_catalog, reconciled_coaching, reconciliation_changes = (
        reconcile_catalog_curation(catalog, coaching, curation)
    )

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

    scanned_candidates = [candidate for scan in scans for candidate in scan.candidates]
    all_candidates, queue_lineage, scanned_ids = merge_review_candidates(
        review_queue, scans
    )
    curation_decisions = curation.get("decisions", {})
    coaching_candidates = [
        candidate
        for candidate in all_candidates
        if curation_decisions.get(candidate.get("id"), {}).get("decision")
        == "coaching"
    ]
    coaching_candidate_ids = {candidate.get("id") for candidate in coaching_candidates}
    exercise_candidates = [
        candidate
        for candidate in all_candidates
        if candidate.get("id") not in coaching_candidate_ids
    ]
    legacy_override_ids = {
        video["id"]
        for records in (catalog, coaching)
        for record in records
        for video in record.get("videos", [])
    }
    updated, decisions = build_updated_catalog(
        reconciled_catalog,
        exercise_candidates,
        overrides,
        curation,
        legacy_override_ids=legacy_override_ids,
    )
    updated_coaching, coaching_decisions = build_updated_coaching_catalog(
        reconciled_coaching,
        coaching_candidates,
        curation,
        exercise_catalog=updated,
    )
    decisions["accepted"].extend(coaching_decisions["accepted"])
    decisions["skipped"].extend(coaching_decisions["skipped"])
    decisions["reconciled"] = reconciliation_changes
    checked_at = utc_now()
    pending_ids = {item["id"] for item in decisions["quarantined"]}
    next_review_queue = build_review_queue(
        review_queue,
        candidates=all_candidates,
        lineage=queue_lineage,
        scanned_ids=scanned_ids,
        pending_ids=pending_ids,
        checked_at=checked_at,
    )

    public_ids = {
        video["id"]
        for records in (updated, updated_coaching)
        for record in records
        for video in record.get("videos", [])
    }
    excluded_ids = {
        video_id
        for video_id, decision in curation_decisions.items()
        if decision.get("decision") == "exclude"
    } | {
        video_id
        for video_id in overrides.get("rejected", {})
        if video_id not in curation_decisions and video_id in legacy_override_ids
    }
    queued_ids = set(next_review_queue["items"])
    validate_checkpoint_coverage(
        scanned_ids,
        public_ids=public_ids,
        excluded_ids=excluded_ids,
        queued_ids=queued_ids,
    )

    before_counts = _count_catalog(catalog)
    after_counts = _count_catalog(updated)
    coaching_before_counts = _count_catalog(coaching)
    coaching_after_counts = _count_catalog(updated_coaching)
    validate_initial_expectations(
        before_counts=before_counts,
        decisions=decisions,
        scans=scans,
        state=state,
        overrides=overrides,
    )

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
        "version": 2,
        "mode": "apply" if args.apply else "dry-run",
        "scan_mode": scan_mode,
        "checked_at": checked_at,
        "source_evidence": source_evidence,
        "recovered_transaction": recovered_transaction,
        "baseline": copy.deepcopy(state.get("baseline", {})),
        "sources": {scan.key: scan.report_dict() for scan in scans},
        "counts_before": before_counts,
        "counts_after": after_counts,
        "coaching_counts_before": coaching_before_counts,
        "coaching_counts_after": coaching_after_counts,
        "candidate_count": len(scanned_candidates),
        "processing_candidate_count": len(all_candidates),
        "accepted_count": len(decisions["accepted"]),
        "rejected_count": len(decisions["rejected"]),
        "quarantined_count": len(decisions["quarantined"]),
        "skipped_count": len(decisions["skipped"]),
        "reconciled_count": len(reconciliation_changes),
        "review_queue_added_count": len(
            queued_ids - set(review_queue.get("items", {}))
        ),
        "review_queue_resolved_count": len(
            set(review_queue.get("items", {})) - queued_ids
        ),
        "review_queue_remaining_count": len(queued_ids),
        "legacy_override_scope_count": len(legacy_override_ids),
        "accepted_by_creator": dict(
            sorted(Counter(item["creator"] for item in decisions["accepted"]).items())
        ),
        "rejected_by_creator": dict(
            sorted(Counter(item["creator"] for item in decisions["rejected"]).items())
        ),
        "quarantined_by_creator": dict(
            sorted(Counter(item["creator"] for item in decisions["quarantined"]).items())
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
        commit_refresh_transaction(
            transaction_journal_path,
            [
                ("exercise_catalog", args.catalog, updated),
                (
                    "coaching_catalog",
                    getattr(args, "coaching", DEFAULT_COACHING),
                    updated_coaching,
                ),
                ("review_queue", review_queue_path, next_review_queue),
                ("report", args.report, report),
                ("state", args.state, next_state),
            ],
            created_at=checked_at,
            fault_after_rename=getattr(
                args, "transaction_fault_after_rename", None
            ),
        )

    return report


def run_refresh(args: argparse.Namespace) -> dict[str, Any]:
    validate_refresh_lock_scope(args)
    lock_path = getattr(args, "lock_file", DEFAULT_REFRESH_LOCK)
    with exclusive_refresh_lock(lock_path):
        return _run_refresh_locked(args, ownership_token=_LOCKED_WORKFLOW_TOKEN)


def validate_refresh_lock_scope(args: argparse.Namespace) -> None:
    """Prevent canonical writes from escaping the repository refresh lock.

    Alternate lock files are useful for isolated fixture catalogs, but any
    transaction that can replace even one canonical repository target must use
    the one stable repository lock shared by the complete refresh workflow.
    """
    if not getattr(args, "apply", False):
        return

    lock_path = Path(getattr(args, "lock_file", DEFAULT_REFRESH_LOCK)).resolve()
    if lock_path == DEFAULT_REFRESH_LOCK.resolve():
        return

    canonical_targets = [
        f"--{attribute.replace('_', '-')}"
        for attribute, default_path in CANONICAL_TRANSACTION_TARGETS.items()
        if Path(getattr(args, attribute)).resolve() == default_path.resolve()
    ]
    if canonical_targets:
        joined = ", ".join(canonical_targets)
        raise RefreshError(
            "Canonical transaction target(s) require the canonical repository "
            f"refresh lock: {joined}. An alternate --lock-file is allowed only "
            "when every writable transaction target is alternate."
        )


def print_refresh_summary(report: dict[str, Any], *, apply: bool) -> None:
    before = report["counts_before"]
    after = report["counts_after"]
    print(
        f"Refresh {report['mode']} complete: {before['videos']} -> {after['videos']} videos, "
        f"{before['exercise_groups']} -> {after['exercise_groups']} exercise groups"
    )
    print(
        f"Accepted {report['accepted_count']}, rejected {report['rejected_count']}, "
        f"quarantined {report['quarantined_count']}, "
        f"skipped {report['skipped_count']}"
    )
    if not apply:
        print("Dry run only; re-run with --apply to write tracked data.")


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--apply", action="store_true", help="atomically update catalog/state/report")
    parser.add_argument("--catalog", type=Path, default=DEFAULT_CATALOG)
    parser.add_argument("--coaching", type=Path, default=DEFAULT_COACHING)
    parser.add_argument("--state", type=Path, default=DEFAULT_STATE)
    parser.add_argument("--overrides", type=Path, default=DEFAULT_OVERRIDES)
    parser.add_argument("--curation", type=Path, default=DEFAULT_CURATION)
    parser.add_argument("--review-queue", type=Path, default=DEFAULT_REVIEW_QUEUE)
    parser.add_argument(
        "--transaction-journal", type=Path, default=DEFAULT_TRANSACTION_JOURNAL
    )
    parser.add_argument("--lock-file", type=Path, default=DEFAULT_REFRESH_LOCK)
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

    print_refresh_summary(report, apply=args.apply)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
