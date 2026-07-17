from __future__ import annotations

import argparse
import copy
import importlib.util
import json
import shutil
import sys
import tempfile
import unittest
from pathlib import Path


PROJECT_DIR = Path(__file__).resolve().parent.parent
MODULE_PATH = PROJECT_DIR / "scripts" / "refresh_incremental.py"
SPEC = importlib.util.spec_from_file_location("refresh_incremental", MODULE_PATH)
assert SPEC and SPEC.loader
refresh = importlib.util.module_from_spec(SPEC)
sys.modules[SPEC.name] = refresh
SPEC.loader.exec_module(refresh)


def candidate(
    video_id: str,
    description: str,
    *,
    creator: str = "coachingotf",
    timestamp: int = 200,
) -> dict:
    return {
        "id": video_id,
        "url": f"https://www.instagram.com/reel/{video_id.removeprefix('ig_')}/",
        "source": "instagram",
        "thumbnail": "https://example.test/thumb.jpg",
        "description": description,
        "timestamp": timestamp,
        "creator": refresh.canonical_creator(creator),
    }


def base_catalog() -> list[dict]:
    return [
        {
            "id": "reverse-lunge",
            "exercise_name": "Reverse Lunge",
            "category": "lower_body",
            "muscle_groups": ["quads", "glutes"],
            "equipment": ["bodyweight"],
            "movement_type": "compound",
            "coaching_cues": [],
            "videos": [
                {
                    "id": "old-video",
                    "url": "https://example.test/old",
                    "source": "instagram",
                    "thumbnail": "/thumbs/old.jpg",
                    "description": "Reverse Lunge",
                    "creator": copy.deepcopy(refresh.COACH_RUDY),
                }
            ],
        }
    ]


class EndlessInstagramClient:
    def profile_info(self, handle: str) -> dict:
        return {"id": handle}

    def clips_page(self, *, target_user_id: str, handle: str, max_id: str | None) -> dict:
        del target_user_id, max_id
        return {
            "items": [
                {
                    "media": {
                        "code": f"{handle}new",
                        "taken_at": 200,
                        "caption": {"text": "Goblet Squat Form Tips"},
                    }
                }
            ],
            "paging_info": {"more_available": True, "max_id": "next"},
        }


class RefreshIncrementalTests(unittest.TestCase):
    def setUp(self) -> None:
        self.fixture_dir = PROJECT_DIR / "tests" / "fixtures" / "refresh_incremental"

    def test_pinned_old_page_does_not_hide_newer_second_page(self) -> None:
        scan = refresh.scan_instagram_source(
            handle="coachingotf",
            cutoff_timestamp=100,
            client=refresh.FixtureInstagramClient(self.fixture_dir),
            max_pages=10,
            page_delay_seconds=0,
        )
        self.assertEqual([video["id"] for video in scan.candidates], ["ig_NEWCOACH"])
        self.assertEqual(scan.page_count, 4)
        self.assertEqual(scan.stop_reason, "two_consecutive_historical_pages")

    def test_max_page_limit_fails_closed(self) -> None:
        with self.assertRaisesRegex(refresh.RefreshError, "safe cutoff"):
            refresh.scan_instagram_source(
                handle="coachingotf",
                cutoff_timestamp=100,
                client=EndlessInstagramClient(),
                max_pages=2,
                page_delay_seconds=0,
            )

    def test_explicit_append_preserves_group_and_old_video(self) -> None:
        before = base_catalog()
        old_group = copy.deepcopy(before[0])
        new_video = candidate("ig_APPEND", "Anything")
        after, decisions = refresh.build_updated_catalog(
            before,
            [new_video],
            {
                "rejected": {},
                "force_include": {},
                "append_to_group": {"ig_APPEND": "reverse-lunge"},
                "title_overrides": {},
            },
        )
        group = next(item for item in after if item["id"] == "reverse-lunge")
        self.assertEqual(group["videos"][0], old_group["videos"][0])
        self.assertEqual(group["videos"][1]["id"], "ig_APPEND")
        for key, value in old_group.items():
            if key != "videos":
                self.assertEqual(group[key], value)
        self.assertEqual(decisions["accepted"][0]["decision"], "explicit_append")

    def test_similar_name_is_not_fuzzy_merged(self) -> None:
        before = base_catalog()
        after, _ = refresh.build_updated_catalog(
            before,
            [candidate("ig_FLY", "Alternating Reverse Fly")],
            {
                "rejected": {},
                "append_to_group": {},
                "title_overrides": {},
                "force_include": {
                    "ig_FLY": {
                        "exercise_name": "Alternating Reverse Fly",
                        "category": "upper_body",
                        "muscle_groups": ["rear deltoids"],
                        "equipment": ["dumbbell"],
                        "movement_type": "isolation",
                        "coaching_cues": [],
                    }
                },
            },
        )
        self.assertEqual({group["id"] for group in after}, {"reverse-lunge", "alternating-reverse-fly"})

    def test_manual_rejection_wins_over_positive_classifier(self) -> None:
        before = base_catalog()
        after, decisions = refresh.build_updated_catalog(
            before,
            [candidate("ig_PROMO", "Goblet Squat Form Tips")],
            {
                "rejected": {"ig_PROMO": {"reason": "reviewed promotion"}},
                "force_include": {},
                "append_to_group": {},
                "title_overrides": {},
            },
        )
        self.assertEqual(after, before)
        self.assertEqual(decisions["accepted"], [])
        self.assertEqual(decisions["rejected"][0]["reason"], "reviewed promotion")

    def test_duplicate_candidate_id_is_idempotently_skipped(self) -> None:
        before = base_catalog()
        value = candidate("ig_DUP", "Goblet Squat Form Tips")
        after, decisions = refresh.build_updated_catalog(
            before,
            [value, copy.deepcopy(value)],
            {"rejected": {}, "force_include": {}, "append_to_group": {}, "title_overrides": {}},
        )
        videos = [video for group in after for video in group["videos"]]
        self.assertEqual(sum(video["id"] == "ig_DUP" for video in videos), 1)
        self.assertEqual(decisions["skipped"], [{"id": "ig_DUP", "reason": "duplicate_candidate_id"}])

    def test_fixture_apply_updates_catalog_report_and_state(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            catalog_path = root / "exercises.json"
            state_path = root / "refresh-state.json"
            overrides_path = root / "refresh-overrides.json"
            report_path = root / "refresh-report.json"
            catalog_path.write_text(json.dumps(base_catalog()), encoding="utf-8")
            state = {
                "version": 1,
                "baseline": {"production_commit": "fixture"},
                "sources": {
                    key: {
                        "latest_seen_timestamp": 100,
                        "latest_seen_id": "",
                        "last_successful_checked_at": None,
                    }
                    for key in (
                        "instagram:coachingotf",
                        "instagram:trainingtall",
                        "tiktok:coachingotf",
                    )
                },
            }
            state_path.write_text(json.dumps(state), encoding="utf-8")
            overrides_path.write_text(
                json.dumps(
                    {
                        "rejected": {},
                        "force_include": {},
                        "append_to_group": {},
                        "title_overrides": {},
                    }
                ),
                encoding="utf-8",
            )
            args = argparse.Namespace(
                apply=True,
                catalog=catalog_path,
                state=state_path,
                overrides=overrides_path,
                report=report_path,
                fixture_dir=self.fixture_dir,
                max_instagram_pages=10,
                page_delay_seconds=0,
                tiktok_limit=250,
                retries=0,
                retry_delay_seconds=0,
            )
            report = refresh.run_refresh(args)
            updated = json.loads(catalog_path.read_text(encoding="utf-8"))
            updated_state = json.loads(state_path.read_text(encoding="utf-8"))
            self.assertEqual(report["accepted_count"], 2)
            self.assertEqual(len(updated), 3)
            self.assertEqual(sum(len(group["videos"]) for group in updated), 3)
            self.assertTrue(report_path.exists())
            self.assertEqual(
                updated_state["sources"]["instagram:trainingtall"]["latest_seen_timestamp"],
                210,
            )
            self.assertIsNotNone(
                updated_state["sources"]["instagram:coachingotf"]["last_successful_checked_at"]
            )

    def test_incomplete_fixture_scan_writes_nothing(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            fixtures = root / "fixtures"
            shutil.copytree(self.fixture_dir, fixtures)
            (fixtures / "instagram-coachingotf-page-004.json").unlink()
            catalog_path = root / "exercises.json"
            state_path = root / "refresh-state.json"
            overrides_path = root / "refresh-overrides.json"
            report_path = root / "refresh-report.json"
            catalog_bytes = json.dumps(base_catalog()).encode()
            state = {
                "version": 1,
                "baseline": {},
                "sources": {
                    key: {"latest_seen_timestamp": 100, "last_successful_checked_at": None}
                    for key in (
                        "instagram:coachingotf",
                        "instagram:trainingtall",
                        "tiktok:coachingotf",
                    )
                },
            }
            state_bytes = json.dumps(state).encode()
            catalog_path.write_bytes(catalog_bytes)
            state_path.write_bytes(state_bytes)
            overrides_path.write_text(
                json.dumps({"rejected": {}, "force_include": {}, "append_to_group": {}}),
                encoding="utf-8",
            )
            args = argparse.Namespace(
                apply=True,
                catalog=catalog_path,
                state=state_path,
                overrides=overrides_path,
                report=report_path,
                fixture_dir=fixtures,
                max_instagram_pages=10,
                page_delay_seconds=0,
                tiktok_limit=250,
                retries=0,
                retry_delay_seconds=0,
            )
            with self.assertRaisesRegex(refresh.RefreshError, "Missing Instagram fixture"):
                refresh.run_refresh(args)
            self.assertEqual(catalog_path.read_bytes(), catalog_bytes)
            self.assertEqual(state_path.read_bytes(), state_bytes)
            self.assertFalse(report_path.exists())


if __name__ == "__main__":
    unittest.main()
