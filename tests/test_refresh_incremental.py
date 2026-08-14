from __future__ import annotations

import argparse
import copy
import importlib.util
import json
import shutil
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path
from unittest import mock


PROJECT_DIR = Path(__file__).resolve().parent.parent
MODULE_PATH = PROJECT_DIR / "scripts" / "refresh_incremental.py"
SPEC = importlib.util.spec_from_file_location("refresh_incremental", MODULE_PATH)
assert SPEC and SPEC.loader
refresh = importlib.util.module_from_spec(SPEC)
sys.modules[SPEC.name] = refresh
SPEC.loader.exec_module(refresh)

WORKFLOW_PATH = PROJECT_DIR / "scripts" / "run_refresh_workflow.py"
WORKFLOW_SPEC = importlib.util.spec_from_file_location(
    "run_refresh_workflow", WORKFLOW_PATH
)
assert WORKFLOW_SPEC and WORKFLOW_SPEC.loader
workflow = importlib.util.module_from_spec(WORKFLOW_SPEC)
sys.modules[WORKFLOW_SPEC.name] = workflow
WORKFLOW_SPEC.loader.exec_module(workflow)


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


def empty_curation() -> dict:
    return {
        "version": 1,
        "decisions": {},
        "exercise_metadata": {},
        "coaching_resources": {},
        "reviewed_coaching_cues": {},
        "equipment_review_exceptions": {},
    }


def empty_review_queue() -> dict:
    return {"version": 1, "updated_at": None, "items": {}}


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

    def write_refresh_case(
        self,
        root: Path,
        *,
        catalog: list[dict],
        coaching: list[dict],
        curation: dict,
        cutoff: int = 1_000,
    ) -> tuple[argparse.Namespace, dict[str, Path]]:
        paths = {
            "catalog": root / "exercises.json",
            "coaching": root / "coaching.json",
            "state": root / "refresh-state.json",
            "overrides": root / "refresh-overrides.json",
            "curation": root / "catalog-curation.json",
            "queue": root / "catalog-review-queue.json",
            "report": root / "refresh-report.json",
            "journal": root / "refresh-transaction.json",
            "lock": root / "refresh.lock",
        }
        state = {
            "version": 1,
            "baseline": {"production_commit": "fixture"},
            "sources": {
                key: {
                    "latest_seen_timestamp": cutoff,
                    "latest_seen_id": "fixture-old",
                    "last_successful_checked_at": None,
                }
                for key in (
                    "instagram:coachingotf",
                    "instagram:trainingtall",
                    "tiktok:coachingotf",
                )
            },
        }
        values = {
            "catalog": catalog,
            "coaching": coaching,
            "state": state,
            "overrides": {
                "rejected": {},
                "force_include": {},
                "append_to_group": {},
                "title_overrides": {},
            },
            "curation": curation,
            "queue": empty_review_queue(),
            "report": {"version": 0, "status": "before"},
            "journal": refresh.idle_transaction_journal(),
            "lock": "test refresh lock",
        }
        for key, value in values.items():
            paths[key].write_text(json.dumps(value), encoding="utf-8")
        args = argparse.Namespace(
            apply=True,
            catalog=paths["catalog"],
            coaching=paths["coaching"],
            state=paths["state"],
            overrides=paths["overrides"],
            curation=paths["curation"],
            review_queue=paths["queue"],
            transaction_journal=paths["journal"],
            lock_file=paths["lock"],
            report=paths["report"],
            fixture_dir=self.fixture_dir,
            max_instagram_pages=10,
            page_delay_seconds=0,
            tiktok_limit=250,
            retries=0,
            retry_delay_seconds=0,
            transaction_fault_after_rename=None,
        )
        return args, paths

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
            legacy_override_ids={"ig_APPEND"},
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
            legacy_override_ids={"ig_FLY"},
        )
        self.assertEqual({group["id"] for group in after}, {"reverse-lunge", "alternating-reverse-fly"})

    def test_manual_rejection_excludes_an_uncurated_candidate(self) -> None:
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
            legacy_override_ids={"ig_PROMO"},
        )
        self.assertEqual(after, before)
        self.assertEqual(decisions["accepted"], [])
        self.assertEqual(decisions["rejected"][0]["reason"], "reviewed promotion")

    def test_new_ids_cannot_bypass_review_through_legacy_overrides(self) -> None:
        forced_metadata = {
            "exercise_name": "Goblet Squat",
            "category": "lower_body",
            "muscle_groups": ["quads", "glutes"],
            "equipment": ["dumbbell"],
            "movement_type": "compound",
            "coaching_cues": [],
        }
        cases = {
            "reject": {
                "rejected": {"ig_NEW": {"reason": "new rejection"}},
                "force_include": {},
                "append_to_group": {},
                "title_overrides": {},
            },
            "force": {
                "rejected": {},
                "force_include": {"ig_NEW": forced_metadata},
                "append_to_group": {},
                "title_overrides": {},
            },
            "append": {
                "rejected": {},
                "force_include": {},
                "append_to_group": {"ig_NEW": "reverse-lunge"},
                "title_overrides": {},
            },
        }

        for label, overrides in cases.items():
            with self.subTest(label=label):
                updated, decisions = refresh.build_updated_catalog(
                    base_catalog(),
                    [candidate("ig_NEW", "Goblet Squat")],
                    overrides,
                    legacy_override_ids=set(),
                )
                self.assertEqual(updated, base_catalog())
                self.assertEqual(decisions["accepted"], [])
                self.assertEqual(decisions["rejected"], [])
                self.assertEqual(
                    decisions["quarantined"][0]["reason"],
                    "awaiting_durable_review",
                )

    def test_durable_curation_supersedes_a_legacy_rejection(self) -> None:
        reviewed = candidate("ig_REVIEWED", "Reverse Lunge")
        curation = {
            "decisions": {
                "ig_REVIEWED": {
                    "decision": "exercise",
                    "destination_id": "reverse-lunge",
                    "review_origin": "review-queue",
                }
            },
            "exercise_metadata": {
                "reverse-lunge": {
                    "exercise_name": "Reverse Lunge",
                    "category": "lower_body",
                    "muscle_groups": ["quads", "glutes"],
                    "equipment": ["bodyweight"],
                    "movement_type": "compound",
                }
            },
            "coaching_resources": {},
            "reviewed_coaching_cues": {
                "reverse-lunge": ["Keep your front knee aligned."]
            },
        }

        updated, decisions = refresh.build_updated_catalog(
            base_catalog(),
            [reviewed],
            {
                "rejected": {"ig_REVIEWED": {"reason": "stale rejection"}},
                "force_include": {},
                "append_to_group": {},
                "title_overrides": {},
            },
            curation,
            legacy_override_ids={"ig_REVIEWED"},
        )

        self.assertEqual(decisions["rejected"], [])
        self.assertEqual(decisions["accepted"][0]["decision"], "curation_exercise")
        self.assertEqual(
            next(group for group in updated if group["id"] == "reverse-lunge")[
                "coaching_cues"
            ],
            ["Keep your front knee aligned."],
        )
        self.assertIn(
            "ig_REVIEWED",
            [video["id"] for group in updated for video in group["videos"]],
        )

    def test_duplicate_candidate_id_is_idempotently_skipped(self) -> None:
        before = base_catalog()
        value = candidate("ig_DUP", "Goblet Squat Form Tips")
        after, decisions = refresh.build_updated_catalog(
            before,
            [value, copy.deepcopy(value)],
            {
                "rejected": {},
                "force_include": {},
                "append_to_group": {"ig_DUP": "reverse-lunge"},
                "title_overrides": {},
            },
            legacy_override_ids={"ig_DUP"},
        )
        videos = [video for group in after for video in group["videos"]]
        self.assertEqual(sum(video["id"] == "ig_DUP" for video in videos), 1)
        self.assertEqual(decisions["skipped"], [{"id": "ig_DUP", "reason": "duplicate_candidate_id"}])

    def test_every_uncurated_candidate_awaits_durable_review(self) -> None:
        before = base_catalog()
        after, decisions = refresh.build_updated_catalog(
            before,
            [
                candidate("ig_UNKNOWN", "Mystery movement form with 10 reps"),
                candidate("ig_VALID", "Goblet Squat Form Tips"),
            ],
            {"rejected": {}, "force_include": {}, "append_to_group": {}, "title_overrides": {}},
        )
        self.assertEqual(
            decisions["quarantined"],
            [
                {
                    "id": "ig_UNKNOWN",
                    "creator": "coachingotf",
                    "reason": "awaiting_durable_review",
                },
                {
                    "id": "ig_VALID",
                    "creator": "coachingotf",
                    "reason": "awaiting_durable_review",
                },
            ],
        )
        self.assertEqual(decisions["accepted"], [])
        self.assertEqual(
            sum(
                video["id"] in {"ig_UNKNOWN", "ig_VALID"}
                for group in after
                for video in group["videos"]
            ),
            0,
        )

    def test_checkpoint_coverage_fails_closed_for_an_unaccounted_candidate(self) -> None:
        with self.assertRaisesRegex(refresh.RefreshError, "neither public, excluded, nor queued"):
            refresh.validate_checkpoint_coverage(
                {"public", "excluded", "queued", "lost"},
                public_ids={"public"},
                excluded_ids={"excluded"},
                queued_ids={"queued"},
            )

    def test_curation_review_origin_controls_source_group_provenance(self) -> None:
        with self.assertRaisesRegex(refresh.RefreshError, "needs a source_group_id"):
            refresh.validate_curation(
                {
                    "decisions": {
                        "legacy": {
                            "decision": "exclude",
                            "reason": "event",
                            "review_origin": "legacy-other",
                        }
                    }
                }
            )
        with self.assertRaisesRegex(refresh.RefreshError, "must not have a source_group_id"):
            refresh.validate_curation(
                {
                    "decisions": {
                        "queued": {
                            "decision": "exclude",
                            "reason": "event",
                            "review_origin": "review-queue",
                            "source_group_id": "other",
                        }
                    }
                }
            )
        with self.assertRaisesRegex(refresh.RefreshError, "needs a source_group_id"):
            refresh.validate_curation(
                {
                    "decisions": {
                        "audited": {
                            "decision": "exclude",
                            "reason": "duplicate",
                            "review_origin": "catalog-audit",
                        }
                    }
                }
            )
        with self.assertRaisesRegex(refresh.RefreshError, "must not have a source_group_id"):
            refresh.validate_curation(
                {
                    "decisions": {
                        "refreshed": {
                            "decision": "exclude",
                            "reason": "promotion",
                            "review_origin": "legacy-refresh",
                            "source_group_id": "not-allowed",
                        }
                    }
                }
            )

        refresh.validate_curation(
            {
                "decisions": {
                    "audited": {
                        "decision": "exclude",
                        "reason": "duplicate",
                        "review_origin": "catalog-audit",
                        "source_group_id": "already-public-group",
                    },
                    "refreshed": {
                        "decision": "exclude",
                        "reason": "promotion",
                        "review_origin": "legacy-refresh",
                    },
                },
                "exercise_metadata": {},
                "coaching_resources": {},
                "reviewed_coaching_cues": {},
            }
        )

    def test_unknown_equipment_does_not_default_to_bodyweight(self) -> None:
        refresh.load_enricher()
        from apply_corrections import extract_equipment as extract_corrected_equipment
        from enrich_local import extract_equipment

        self.assertEqual(extract_equipment("Goblet Squat Form Tips"), [])
        self.assertEqual(extract_equipment("Bodyweight Squat Form Tips"), ["bodyweight"])
        self.assertEqual(extract_equipment("Quarter Mile Benchmark"), [])
        self.assertEqual(extract_equipment("Low Bench Step-Up"), ["bench"])
        self.assertEqual(extract_equipment("Y-Bell Squat"), ["y-bell"])
        self.assertEqual(extract_corrected_equipment("Goblet Squat Form Tips"), [])
        self.assertEqual(
            extract_corrected_equipment("Bodyweight Squat Form Tips"), ["bodyweight"]
        )
        self.assertEqual(extract_corrected_equipment("Quarter Mile Benchmark"), [])
        self.assertEqual(
            extract_corrected_equipment("Low Bench Step-Up"), ["bench"]
        )
        self.assertEqual(extract_corrected_equipment("Y-Bell Squat"), ["y-bell"])

    def test_reviewed_coaching_candidate_is_published_in_coaching_catalog(self) -> None:
        reviewed = candidate("ig_COACHING", "How to cue a safer row finish")
        curation = {
            "decisions": {
                "ig_COACHING": {
                    "decision": "coaching",
                    "destination_id": "row-finish-cue",
                    "review_origin": "review-queue",
                }
            },
            "exercise_metadata": {},
            "coaching_resources": {
                "row-finish-cue": {
                    "title": "Cueing the Row Finish",
                    "topic": "movement-technique",
                    "summary": "Explains a clear finish-position cue.",
                    "related_exercise_ids": ["reverse-lunge"],
                }
            },
            "reviewed_coaching_cues": {
                "reverse-lunge": ["Keep your front knee aligned."]
            },
        }

        updated, decisions = refresh.build_updated_coaching_catalog(
            [], [reviewed], curation, exercise_catalog=base_catalog()
        )

        self.assertEqual(updated[0]["id"], "row-finish-cue")
        self.assertEqual(updated[0]["videos"][0]["id"], "ig_COACHING")
        self.assertEqual(decisions["accepted"][0]["decision"], "curation_coaching")

    def test_reconciliation_moves_existing_videos_and_updates_reviewed_metadata(self) -> None:
        catalog = base_catalog()
        untouched_video = {
            "id": "untouched-video",
            "url": "https://example.test/untouched",
            "source": "instagram",
            "thumbnail": "/thumbs/untouched.jpg",
            "description": "Unreviewed but public",
            "creator": copy.deepcopy(refresh.COACH_RUDY),
        }
        catalog[0]["videos"].append(copy.deepcopy(untouched_video))
        catalog[0]["coaching_cues"] = ["unreviewed cue"]
        catalog.append(
            {
                "id": "discard-me",
                "exercise_name": "Discard Me",
                "category": "other",
                "muscle_groups": [],
                "equipment": [],
                "movement_type": "other",
                "coaching_cues": [],
                "videos": [
                    {
                        "id": "discard-video",
                        "url": "https://example.test/discard",
                        "source": "instagram",
                        "thumbnail": "/thumbs/discard.jpg",
                        "description": "Event post",
                        "creator": copy.deepcopy(refresh.COACH_RUDY),
                    }
                ],
            }
        )
        coaching_video = {
            "id": "coaching-video",
            "url": "https://example.test/coaching",
            "source": "instagram",
            "thumbnail": "/thumbs/coaching.jpg",
            "description": "Actually an exercise",
            "creator": copy.deepcopy(refresh.COACH_RUDY),
        }
        coaching = [
            {
                "id": "old-coaching",
                "title": "Old coaching",
                "topic": "movement-technique",
                "summary": "Old",
                "related_exercise_ids": [],
                "videos": [coaching_video],
            }
        ]
        curation = {
            "decisions": {
                "old-video": {
                    "decision": "coaching",
                    "destination_id": "lunge-coaching",
                    "review_origin": "review-queue",
                },
                "coaching-video": {
                    "decision": "exercise",
                    "destination_id": "reverse-lunge",
                    "review_origin": "review-queue",
                },
                "discard-video": {
                    "decision": "exclude",
                    "reason": "event",
                    "review_origin": "review-queue",
                },
            },
            "exercise_metadata": {
                "reverse-lunge": {
                    "exercise_name": "Reviewed Reverse Lunge",
                    "category": "lower_body",
                    "muscle_groups": ["glutes", "quads"],
                    "equipment": [],
                    "movement_type": "compound",
                }
            },
            "coaching_resources": {
                "lunge-coaching": {
                    "title": "Reverse Lunge Coaching",
                    "topic": "movement-technique",
                    "summary": "Reviewed lunge coaching.",
                    "related_exercise_ids": ["reverse-lunge"],
                }
            },
            "reviewed_coaching_cues": {
                "reverse-lunge": ["Keep your front knee aligned."]
            },
        }

        updated, updated_coaching, changes = refresh.reconcile_catalog_curation(
            catalog, coaching, curation
        )

        reverse_lunge = next(group for group in updated if group["id"] == "reverse-lunge")
        self.assertEqual(reverse_lunge["exercise_name"], "Reviewed Reverse Lunge")
        self.assertEqual(
            reverse_lunge["coaching_cues"], ["Keep your front knee aligned."]
        )
        self.assertEqual(
            [video["id"] for video in reverse_lunge["videos"]],
            ["untouched-video", "coaching-video"],
        )
        self.assertEqual(reverse_lunge["videos"][0], untouched_video)
        self.assertNotIn("discard-me", {group["id"] for group in updated})
        self.assertEqual([resource["id"] for resource in updated_coaching], ["lunge-coaching"])
        self.assertEqual(updated_coaching[0]["videos"][0]["id"], "old-video")
        self.assertEqual(len(changes), 4)

    def test_reconciliation_repairs_independent_destination_metadata_drift(self) -> None:
        catalog = base_catalog()
        catalog[0]["exercise_name"] = "Drifted Lunge"
        catalog[0]["equipment"] = ["dumbbell"]
        coaching = [
            {
                "id": "existing-coaching",
                "title": "Drifted title",
                "topic": "programming",
                "summary": "Drifted summary",
                "related_exercise_ids": [],
                "videos": [
                    {
                        "id": "existing-coaching-video",
                        "url": "https://example.test/existing-coaching",
                        "source": "instagram",
                        "thumbnail": "/thumbs/existing-coaching.jpg",
                        "description": "Existing coaching",
                        "creator": copy.deepcopy(refresh.COACH_RUDY),
                    }
                ],
            }
        ]
        curation = {
            "version": 1,
            "decisions": {},
            "exercise_metadata": {
                "reverse-lunge": {
                    "exercise_name": "Reverse Lunge",
                    "category": "lower_body",
                    "muscle_groups": ["quads", "glutes"],
                    "equipment": ["bodyweight"],
                    "movement_type": "compound",
                }
            },
            "coaching_resources": {
                "existing-coaching": {
                    "title": "Reviewed coaching title",
                    "topic": "movement-technique",
                    "summary": "Reviewed coaching summary.",
                    "related_exercise_ids": ["reverse-lunge"],
                }
            },
            "reviewed_coaching_cues": {
                "reverse-lunge": ["Keep your front knee aligned."]
            },
        }

        updated, updated_coaching, changes = refresh.reconcile_catalog_curation(
            catalog, coaching, curation
        )

        self.assertEqual(updated[0]["exercise_name"], "Reverse Lunge")
        self.assertEqual(updated[0]["equipment"], ["bodyweight"])
        self.assertEqual(
            updated[0]["coaching_cues"], ["Keep your front knee aligned."]
        )
        self.assertEqual(updated_coaching[0]["title"], "Reviewed coaching title")
        self.assertEqual(updated_coaching[0]["topic"], "movement-technique")
        self.assertEqual(
            {change["section"] for change in changes}, {"exercise", "coaching"}
        )

    def test_orphan_reviewed_metadata_is_rejected(self) -> None:
        curation = empty_curation()
        curation["exercise_metadata"]["missing-exercise"] = {
            "exercise_name": "Missing Exercise",
            "category": "lower_body",
            "muscle_groups": ["quads"],
            "equipment": [],
            "movement_type": "compound",
        }
        with self.assertRaisesRegex(refresh.RefreshError, "has no destination"):
            refresh.reconcile_catalog_curation(base_catalog(), [], curation)

    def test_invalid_reviewed_metadata_writes_nothing(self) -> None:
        case_names = (
            "category",
            "movement",
            "muscles",
            "equipment",
            "cue",
            "topic",
            "related",
        )
        for case_name in case_names:
            with self.subTest(case=case_name):
                curation = {
                    "version": 1,
                    "decisions": {},
                    "exercise_metadata": {
                        "reverse-lunge": {
                            "exercise_name": "Reverse Lunge",
                            "category": "lower_body",
                            "muscle_groups": ["quads", "glutes"],
                            "equipment": ["bodyweight"],
                            "movement_type": "compound",
                        }
                    },
                    "coaching_resources": {},
                    "reviewed_coaching_cues": {},
                }
                if case_name == "category":
                    curation["exercise_metadata"]["reverse-lunge"]["category"] = "bogus"
                elif case_name == "movement":
                    curation["exercise_metadata"]["reverse-lunge"][
                        "movement_type"
                    ] = "bogus"
                elif case_name == "muscles":
                    curation["exercise_metadata"]["reverse-lunge"][
                        "muscle_groups"
                    ] = "quads"
                elif case_name == "equipment":
                    curation["exercise_metadata"]["reverse-lunge"]["equipment"] = [1]
                elif case_name == "cue":
                    curation["reviewed_coaching_cues"]["reverse-lunge"] = [
                        "Broken\ncue"
                    ]
                else:
                    curation["coaching_resources"]["bad-coaching"] = {
                        "title": "Bad coaching",
                        "topic": (
                            "bogus" if case_name == "topic" else "movement-technique"
                        ),
                        "summary": "Reviewed summary.",
                        "related_exercise_ids": (
                            "reverse-lunge"
                            if case_name == "related"
                            else ["reverse-lunge"]
                        ),
                    }

                with tempfile.TemporaryDirectory() as temporary:
                    args, paths = self.write_refresh_case(
                        Path(temporary),
                        catalog=base_catalog(),
                        coaching=[],
                        curation=curation,
                    )
                    before = {key: path.read_bytes() for key, path in paths.items()}
                    with self.assertRaises(refresh.RefreshError):
                        refresh.run_refresh(args)
                    self.assertEqual(
                        {key: path.read_bytes() for key, path in paths.items()},
                        before,
                    )

    def test_fixture_apply_updates_catalog_report_and_state(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            catalog_path = root / "exercises.json"
            coaching_path = root / "coaching.json"
            state_path = root / "refresh-state.json"
            overrides_path = root / "refresh-overrides.json"
            curation_path = root / "catalog-curation.json"
            queue_path = root / "catalog-review-queue.json"
            journal_path = root / "refresh-transaction.json"
            lock_path = root / "refresh.lock"
            report_path = root / "refresh-report.json"
            catalog_path.write_text(json.dumps(base_catalog()), encoding="utf-8")
            coaching_path.write_text("[]", encoding="utf-8")
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
            curation_path.write_text(json.dumps(empty_curation()), encoding="utf-8")
            queue_path.write_text(json.dumps(empty_review_queue()), encoding="utf-8")
            journal_path.write_text(
                json.dumps(refresh.idle_transaction_journal()), encoding="utf-8"
            )
            lock_path.write_text("test refresh lock", encoding="utf-8")
            args = argparse.Namespace(
                apply=True,
                catalog=catalog_path,
                coaching=coaching_path,
                state=state_path,
                overrides=overrides_path,
                curation=curation_path,
                review_queue=queue_path,
                transaction_journal=journal_path,
                lock_file=lock_path,
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
            updated_queue = json.loads(queue_path.read_text(encoding="utf-8"))
            self.assertEqual(report["accepted_count"], 0)
            self.assertEqual(report["review_queue_added_count"], 2)
            self.assertEqual(len(updated), 1)
            self.assertEqual(sum(len(group["videos"]) for group in updated), 1)
            self.assertEqual(
                set(updated_queue["items"]), {"ig_NEWCOACH", "ig_NEWTRAIN"}
            )
            self.assertEqual(
                updated_queue["items"]["ig_NEWCOACH"]["status"], "pending-review"
            )
            self.assertIn(
                "suggested_enrichment", updated_queue["items"]["ig_NEWCOACH"]
            )
            self.assertTrue(report_path.exists())
            self.assertEqual(
                updated_state["sources"]["instagram:trainingtall"]["latest_seen_timestamp"],
                210,
            )
            self.assertIsNotNone(
                updated_state["sources"]["instagram:coachingotf"]["last_successful_checked_at"]
            )

            curation_path.write_text(
                json.dumps(
                    {
                        "version": 1,
                        "decisions": {
                            "ig_NEWCOACH": {
                                "decision": "exercise",
                                "destination_id": "reverse-lunge",
                                "review_origin": "review-queue",
                            },
                            "ig_NEWTRAIN": {
                                "decision": "exclude",
                                "reason": "unusable",
                                "review_origin": "review-queue",
                            },
                        },
                        "exercise_metadata": {
                            "reverse-lunge": {
                                "exercise_name": "Reverse Lunge",
                                "category": "lower_body",
                                "muscle_groups": ["quads", "glutes"],
                                "equipment": ["bodyweight"],
                                "movement_type": "compound",
                            }
                        },
                        "coaching_resources": {},
                        "reviewed_coaching_cues": {},
                    }
                ),
                encoding="utf-8",
            )
            second_report = refresh.run_refresh(args)
            resolved_queue = json.loads(queue_path.read_text(encoding="utf-8"))
            resolved_catalog = json.loads(catalog_path.read_text(encoding="utf-8"))
            self.assertEqual(second_report["candidate_count"], 0)
            self.assertEqual(second_report["processing_candidate_count"], 2)
            self.assertEqual(second_report["accepted_count"], 1)
            self.assertEqual(second_report["rejected_count"], 1)
            self.assertEqual(second_report["review_queue_resolved_count"], 2)
            self.assertEqual(resolved_queue["items"], {})
            self.assertEqual(
                [
                    video["id"]
                    for group in resolved_catalog
                    for video in group["videos"]
                ],
                ["old-video", "ig_NEWCOACH"],
            )

    def test_advisory_enrichment_error_keeps_queue_and_allows_reviewed_publish(self) -> None:
        curation = {
            "version": 1,
            "decisions": {
                "ig_NEWCOACH": {
                    "decision": "exercise",
                    "destination_id": "reverse-lunge",
                    "review_origin": "review-queue",
                }
            },
            "exercise_metadata": {
                "reverse-lunge": {
                    "exercise_name": "Reverse Lunge",
                    "category": "lower_body",
                    "muscle_groups": ["quads", "glutes"],
                    "equipment": ["bodyweight"],
                    "movement_type": "compound",
                }
            },
            "coaching_resources": {},
            "reviewed_coaching_cues": {},
        }
        with tempfile.TemporaryDirectory() as temporary:
            args, paths = self.write_refresh_case(
                Path(temporary),
                catalog=base_catalog(),
                coaching=[],
                curation=curation,
                cutoff=100,
            )

            def broken_enricher(value: dict) -> dict:
                raise ValueError(f"cannot enrich {value['id']}")

            with mock.patch.object(
                refresh, "load_enricher", return_value=broken_enricher
            ):
                report = refresh.run_refresh(args)

            queue = json.loads(paths["queue"].read_text(encoding="utf-8"))
            catalog = json.loads(paths["catalog"].read_text(encoding="utf-8"))
            self.assertEqual(report["accepted_count"], 1)
            self.assertEqual(set(queue["items"]), {"ig_NEWTRAIN"})
            self.assertEqual(
                queue["items"]["ig_NEWTRAIN"]["suggested_enrichment"], {}
            )
            self.assertIn(
                "ValueError: cannot enrich ig_NEWTRAIN",
                queue["items"]["ig_NEWTRAIN"]["suggested_enrichment_error"],
            )
            self.assertIn(
                "ig_NEWCOACH",
                [video["id"] for group in catalog for video in group["videos"]],
            )

    def test_transaction_recovery_after_every_rename_for_bidirectional_moves(self) -> None:
        exercise_metadata = {
            "reverse-lunge": {
                "exercise_name": "Reverse Lunge",
                "category": "lower_body",
                "muscle_groups": ["quads", "glutes"],
                "equipment": ["bodyweight"],
                "movement_type": "compound",
            }
        }
        coaching_metadata = {
            "lunge-coaching": {
                "title": "Reverse Lunge Coaching",
                "topic": "movement-technique",
                "summary": "Reviewed reverse-lunge coaching.",
                "related_exercise_ids": ["reverse-lunge"],
            }
        }
        coaching_video = {
            "id": "coaching-video",
            "url": "https://example.test/coaching-video",
            "source": "instagram",
            "thumbnail": "/thumbs/coaching-video.jpg",
            "description": "Reverse Lunge",
            "creator": copy.deepcopy(refresh.COACH_RUDY),
        }
        cases = {
            "exercise-to-coaching": {
                "catalog": base_catalog(),
                "coaching": [],
                "video_id": "old-video",
                "expected_section": "coaching",
                "curation": {
                    "version": 1,
                    "decisions": {
                        "old-video": {
                            "decision": "coaching",
                            "destination_id": "lunge-coaching",
                            "review_origin": "review-queue",
                        }
                    },
                    "exercise_metadata": {},
                    "coaching_resources": coaching_metadata,
                    "reviewed_coaching_cues": {},
                },
            },
            "coaching-to-exercise": {
                "catalog": base_catalog(),
                "coaching": [
                    {
                        "id": "old-coaching",
                        "title": "Old coaching",
                        "topic": "movement-technique",
                        "summary": "Old coaching classification.",
                        "related_exercise_ids": [],
                        "videos": [coaching_video],
                    }
                ],
                "video_id": "coaching-video",
                "expected_section": "exercise",
                "curation": {
                    "version": 1,
                    "decisions": {
                        "coaching-video": {
                            "decision": "exercise",
                            "destination_id": "reverse-lunge",
                            "review_origin": "review-queue",
                        }
                    },
                    "exercise_metadata": exercise_metadata,
                    "coaching_resources": {},
                    "reviewed_coaching_cues": {},
                },
            },
        }

        for label, case in cases.items():
            for fault_after in range(1, 6):
                with self.subTest(direction=label, fault_after=fault_after):
                    with tempfile.TemporaryDirectory() as temporary:
                        args, paths = self.write_refresh_case(
                            Path(temporary),
                            catalog=copy.deepcopy(case["catalog"]),
                            coaching=copy.deepcopy(case["coaching"]),
                            curation=copy.deepcopy(case["curation"]),
                        )
                        initial_state = json.loads(
                            paths["state"].read_text(encoding="utf-8")
                        )
                        args.transaction_fault_after_rename = fault_after

                        with self.assertRaises(refresh.SimulatedTransactionCrash):
                            refresh.run_refresh(args)

                        journal = json.loads(
                            paths["journal"].read_text(encoding="utf-8")
                        )
                        self.assertEqual(journal["status"], "active")
                        state_after_crash = json.loads(
                            paths["state"].read_text(encoding="utf-8")
                        )
                        if fault_after < 5:
                            self.assertEqual(state_after_crash, initial_state)
                        else:
                            self.assertNotEqual(state_after_crash, initial_state)

                        bytes_before_dry_run = {
                            key: path.read_bytes() for key, path in paths.items()
                        }
                        args.apply = False
                        args.transaction_fault_after_rename = None
                        with self.assertRaisesRegex(
                            refresh.RefreshError,
                            "pending; rerun with --apply",
                        ):
                            refresh.run_refresh(args)
                        self.assertEqual(
                            {key: path.read_bytes() for key, path in paths.items()},
                            bytes_before_dry_run,
                        )

                        args.apply = True
                        recovery_report = refresh.run_refresh(args)
                        self.assertTrue(recovery_report["recovered_transaction"])

                        exercise_catalog = json.loads(
                            paths["catalog"].read_text(encoding="utf-8")
                        )
                        coaching_catalog = json.loads(
                            paths["coaching"].read_text(encoding="utf-8")
                        )
                        locations = [
                            section
                            for section, records in (
                                ("exercise", exercise_catalog),
                                ("coaching", coaching_catalog),
                            )
                            for record in records
                            for video in record.get("videos", [])
                            if video["id"] == case["video_id"]
                        ]
                        self.assertEqual(locations, [case["expected_section"]])
                        self.assertEqual(
                            json.loads(paths["queue"].read_text(encoding="utf-8"))[
                                "items"
                            ],
                            {},
                        )
                        self.assertEqual(
                            json.loads(paths["report"].read_text(encoding="utf-8"))[
                                "mode"
                            ],
                            "apply",
                        )
                        self.assertEqual(
                            json.loads(paths["journal"].read_text(encoding="utf-8"))[
                                "status"
                            ],
                            "idle",
                        )
                        self.assertFalse(
                            list(Path(temporary).glob(".*.refresh-stage-*"))
                        )

    def test_second_refresh_fails_fast_while_repo_lock_is_held(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            args, paths = self.write_refresh_case(
                Path(temporary),
                catalog=base_catalog(),
                coaching=[],
                curation=empty_curation(),
            )
            before = {key: path.read_bytes() for key, path in paths.items()}

            with refresh.exclusive_refresh_lock(paths["lock"]):
                with self.assertRaisesRegex(
                    refresh.RefreshError, "Another catalog refresh is already running"
                ):
                    refresh.run_refresh(args)

            self.assertEqual(
                {key: path.read_bytes() for key, path in paths.items()}, before
            )

    def test_full_workflow_lock_blocks_interleaving_through_thumbnail_failure(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            args, paths = self.write_refresh_case(
                Path(temporary),
                catalog=base_catalog(),
                coaching=[],
                curation=empty_curation(),
            )
            commands: list[list[str]] = []

            def failing_thumbnail_runner(
                command: list[str], *, cwd: Path, check: bool
            ) -> None:
                self.assertEqual(cwd, PROJECT_DIR)
                self.assertTrue(check)
                commands.append(command)
                snapshot = {key: path.read_bytes() for key, path in paths.items()}
                with self.assertRaisesRegex(
                    refresh.RefreshError, "Another catalog refresh is already running"
                ):
                    workflow.run_workflow(
                        args,
                        command_runner=lambda *unused_args, **unused_kwargs: self.fail(
                            "contending workflow reached a child command"
                        ),
                    )
                self.assertEqual(
                    {key: path.read_bytes() for key, path in paths.items()}, snapshot
                )
                raise subprocess.CalledProcessError(7, command)

            with self.assertRaises(subprocess.CalledProcessError):
                workflow.run_workflow(
                    args, command_runner=failing_thumbnail_runner
                )

            self.assertEqual(len(commands), 1)
            self.assertTrue(commands[0][-1].endswith("ensure-thumbnails.mjs"))
            self.assertEqual(
                json.loads(paths["report"].read_text(encoding="utf-8"))["mode"],
                "apply",
            )

            # The failure releases the workflow lock; a later dry run can
            # acquire it and remains byte-for-byte read-only.
            args.apply = False
            after_failure = {key: path.read_bytes() for key, path in paths.items()}
            workflow.run_workflow(
                args,
                command_runner=lambda *unused_args, **unused_kwargs: self.fail(
                    "dry workflow ran a child command"
                ),
            )
            self.assertEqual(
                {key: path.read_bytes() for key, path in paths.items()}, after_failure
            )

    def test_full_workflow_apply_rejects_alternate_repository_paths(self) -> None:
        parser = refresh.build_parser()
        canonical = parser.parse_args(["--apply"])
        workflow.validate_apply_paths(canonical)

        alternate = parser.parse_args(
            ["--apply", "--catalog", "/tmp/alternate-exercises.json"]
        )
        with self.assertRaisesRegex(
            refresh.RefreshError,
            r"canonical repository paths.*--catalog.*refresh_incremental\.py",
        ):
            workflow.validate_apply_paths(alternate)

        dry_run = parser.parse_args(
            ["--catalog", "/tmp/alternate-exercises.json"]
        )
        workflow.validate_apply_paths(dry_run)

    def test_direct_apply_cannot_escape_canonical_repository_lock(self) -> None:
        parser = refresh.build_parser()
        partially_alternate = parser.parse_args(
            [
                "--apply",
                "--catalog",
                "/tmp/alternate-exercises.json",
                "--lock-file",
                "/tmp/alternate-refresh.lock",
            ]
        )
        with self.assertRaisesRegex(
            refresh.RefreshError,
            r"Canonical transaction target\(s\).*--coaching.*--state",
        ):
            refresh.validate_refresh_lock_scope(partially_alternate)

        fully_alternate = parser.parse_args(
            [
                "--apply",
                "--catalog",
                "/tmp/alternate-exercises.json",
                "--coaching",
                "/tmp/alternate-coaching.json",
                "--state",
                "/tmp/alternate-state.json",
                "--review-queue",
                "/tmp/alternate-review-queue.json",
                "--transaction-journal",
                "/tmp/alternate-transaction.json",
                "--report",
                "/tmp/alternate-report.json",
                "--lock-file",
                "/tmp/alternate-refresh.lock",
            ]
        )
        refresh.validate_refresh_lock_scope(fully_alternate)

    def test_equipment_review_exception_schema_is_durable(self) -> None:
        curation = empty_curation()
        curation["exercise_metadata"]["heavy-hip-bridge"] = {
            "exercise_name": "Heavy Hip Bridge",
            "category": "lower_body",
            "muscle_groups": ["glutes", "hamstrings"],
            "equipment": [],
            "movement_type": "compound",
        }
        curation["equipment_review_exceptions"]["heavy-hip-bridge"] = {
            "reason": "thumbnail-inconclusive",
            "note": "The local still does not reveal the external implement.",
        }
        refresh.validate_curation(curation)

        invalid_reason = copy.deepcopy(curation)
        invalid_reason["equipment_review_exceptions"]["heavy-hip-bridge"][
            "reason"
        ] = "unknown"
        with self.assertRaisesRegex(refresh.RefreshError, "invalid reason"):
            refresh.validate_curation(invalid_reason)

        orphan = copy.deepcopy(curation)
        orphan["equipment_review_exceptions"]["missing"] = {
            "reason": "support-only-is-complete",
            "note": "Fixture orphan.",
        }
        with self.assertRaisesRegex(refresh.RefreshError, "has no exercise metadata"):
            refresh.validate_curation(orphan)

    def test_incomplete_fixture_scan_writes_nothing(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            fixtures = root / "fixtures"
            shutil.copytree(self.fixture_dir, fixtures)
            (fixtures / "instagram-coachingotf-page-004.json").unlink()
            catalog_path = root / "exercises.json"
            coaching_path = root / "coaching.json"
            state_path = root / "refresh-state.json"
            overrides_path = root / "refresh-overrides.json"
            curation_path = root / "catalog-curation.json"
            queue_path = root / "catalog-review-queue.json"
            journal_path = root / "refresh-transaction.json"
            lock_path = root / "refresh.lock"
            report_path = root / "refresh-report.json"
            catalog_bytes = json.dumps(base_catalog()).encode()
            coaching_bytes = b"[]"
            queue_bytes = json.dumps(empty_review_queue()).encode()
            journal_bytes = json.dumps(refresh.idle_transaction_journal()).encode()
            lock_bytes = b"test refresh lock"
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
            coaching_path.write_bytes(coaching_bytes)
            state_path.write_bytes(state_bytes)
            queue_path.write_bytes(queue_bytes)
            journal_path.write_bytes(journal_bytes)
            lock_path.write_bytes(lock_bytes)
            overrides_path.write_text(
                json.dumps({"rejected": {}, "force_include": {}, "append_to_group": {}}),
                encoding="utf-8",
            )
            curation_path.write_text(json.dumps(empty_curation()), encoding="utf-8")
            args = argparse.Namespace(
                apply=True,
                catalog=catalog_path,
                coaching=coaching_path,
                state=state_path,
                overrides=overrides_path,
                curation=curation_path,
                review_queue=queue_path,
                transaction_journal=journal_path,
                lock_file=lock_path,
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
            self.assertEqual(coaching_path.read_bytes(), coaching_bytes)
            self.assertEqual(state_path.read_bytes(), state_bytes)
            self.assertEqual(queue_path.read_bytes(), queue_bytes)
            self.assertEqual(journal_path.read_bytes(), journal_bytes)
            self.assertEqual(lock_path.read_bytes(), lock_bytes)
            self.assertFalse(report_path.exists())


if __name__ == "__main__":
    unittest.main()
