# Task 03 Handoff: Multi-Profile Pipeline Provenance

Owner: Worker Task 3

## Scope

- Parameterized Instagram scraping so the login account remains `--user` and target creator accounts come from `--profiles`.
- Preserved per-video `creator` metadata from raw Instagram records through enrichment, flat filtering, and final grouped videos.
- Backfilled legacy TikTok and Instagram records missing `creator` as Coach Rudy / `@coachingotf`.
- Changed the generated flat output to `src/data/exercises_flat.json` and made grouping default to that fresh flat file instead of falling back to stale grouped/backup input.
- Did not run live Instagram scraping and did not intentionally modify generated exercise data.

## Files Touched

- `scripts/scrape_instagram.py`
- `scripts/enrich_local.py`
- `scripts/merge_and_filter.py`
- `scripts/group_exercises.py`
- `scripts/refresh.sh`
- `docs/superpowers/handoffs/task-03-multi-profile-pipeline.md`

## Root Decisions

- `--profiles` accepts comma-separated handles and defaults to `coachingotf` for backward compatibility.
- `KNOWN_SHORTCODES` fallback is now only registered for `coachingotf`; other handles use `Profile.from_username`.
- Scraped Instagram records receive a `creator` object before writing `raw_instagram_videos.json`.
- `coachingotf` creator metadata uses the canonical Task 1 object: Coach Rudy, handle `coachingotf`, Instagram profile URL.
- Other Instagram creator metadata is derived from the resolved Instaloader profile: lowercase username id, `full_name` fallback to handle, and Instagram profile URL.
- `enrich_local.py` preserves any existing raw `creator`; records without one are defaulted to Coach Rudy.
- `merge_and_filter.py` now writes `src/data/exercises_flat.json` and copies `creator` into each accepted flat row.
- `group_exercises.py` defaults to `src/data/exercises_flat.json`, still accepts an explicit CLI input path, and defensively defaults missing flat-row creators to Coach Rudy in grouped `videos`.
- Duplicate Instagram scrape records are deduped by stable video `id` before writing raw output.
- Duplicate flat rows with the same video `id` are skipped within each grouped exercise.
- The old grouping backup creation was removed to avoid stale flat backup behavior.

## Verification

Command:

```bash
python3 -m py_compile scripts/scrape_instagram.py scripts/enrich_local.py scripts/merge_and_filter.py scripts/group_exercises.py
```

Outcome: passed with no output.

Command:

```bash
./node_modules/.bin/tsc --noEmit
```

Outcome: passed with no output.

Command:

```bash
npm run lint
```

Outcome: exited 0. ESLint reported 2 warnings outside Task 3 files:

```text
src/components/ExerciseCard.tsx
  35:11  warning  Using `<img>` could result in slower LCP and higher bandwidth  @next/next/no-img-element

src/components/InstagramEmbed.tsx
  23:13  warning  Using `<img>` could result in slower LCP and higher bandwidth  @next/next/no-img-element
```

Command:

```bash
python3 - <<'PY'
import importlib.util
import json
import sys
import tempfile
import types
from pathlib import Path

ROOT = Path.cwd()

fake_instaloader = types.ModuleType("instaloader")
fake_instaloader.Instaloader = type("Instaloader", (), {})
fake_instaloader.Profile = type("Profile", (), {})
fake_instaloader.Post = type("Post", (), {})
fake_exceptions = types.ModuleType("instaloader.exceptions")
fake_exceptions.ProfileNotExistsException = type("ProfileNotExistsException", (Exception,), {})
fake_exceptions.QueryReturnedNotFoundException = type("QueryReturnedNotFoundException", (Exception,), {})
fake_instaloader.exceptions = fake_exceptions
sys.modules["instaloader"] = fake_instaloader
sys.modules["instaloader.exceptions"] = fake_exceptions

def load(name, path):
    spec = importlib.util.spec_from_file_location(name, ROOT / path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module

scrape_instagram = load("scrape_instagram", "scripts/scrape_instagram.py")
enrich_local = load("enrich_local", "scripts/enrich_local.py")
merge_and_filter = load("merge_and_filter", "scripts/merge_and_filter.py")
group_exercises = load("group_exercises", "scripts/group_exercises.py")

deduped, duplicate_count = scrape_instagram.dedupe_videos_by_id([
    {"id": "ig_dup", "url": "https://example.com/1"},
    {"id": "ig_dup", "url": "https://example.com/1-copy"},
    {"id": "ig_unique", "url": "https://example.com/2"},
])
assert [video["id"] for video in deduped] == ["ig_dup", "ig_unique"], deduped
assert duplicate_count == 1, duplicate_count

custom_creator = {
    "id": "coachalpha",
    "display_name": "Coach Alpha",
    "handle": "coachalpha",
    "profile_url": "https://www.instagram.com/coachalpha/",
}

with tempfile.TemporaryDirectory() as tmp:
    tmp_path = Path(tmp)
    raw_tiktok = tmp_path / "raw_videos.json"
    raw_ig = tmp_path / "raw_instagram_videos.json"
    enriched_path = tmp_path / "enriched_videos.json"

    raw_tiktok.write_text(json.dumps([{
        "id": "tt_1",
        "url": "https://www.tiktok.com/@coachingotf/video/1",
        "description": "Goblet squat form. Keep your chest tall and control the tempo for each rep.",
        "thumbnail": "",
        "upload_date": "20260504",
    }]))
    raw_ig.write_text(json.dumps([{
        "id": "ig_1",
        "url": "https://www.instagram.com/reel/abc/",
        "description": "Hammer curl technique. Keep elbows still and squeeze the biceps through every rep.",
        "thumbnail": "",
        "upload_date": "20260504",
        "source": "instagram",
        "creator": custom_creator,
    }]))

    enrich_local.RAW_FILE = str(raw_tiktok)
    enrich_local.RAW_IG_FILE = str(raw_ig)
    loaded = enrich_local.load_combined_raw()
    assert loaded[0]["creator"]["id"] == "coachingotf", loaded[0]
    assert loaded[1]["creator"] == custom_creator, loaded[1]

    enriched = [enrich_local.enrich_video(video) for video in loaded]
    assert all(video["enrichment"]["is_exercise_demo"] for video in enriched), enriched
    enriched_path.write_text(json.dumps(enriched))

    flat = merge_and_filter.merge_and_filter(str(enriched_path))
    assert len(flat) == 2, flat
    assert {row["creator"]["id"] for row in flat} == {"coachingotf", "coachalpha"}, flat

    duplicate = dict(flat[0])
    flat.append(duplicate)
    flat.append({
        "id": "legacy_1",
        "url": "https://example.com/legacy",
        "source": "instagram",
        "thumbnail": "",
        "description": "Legacy row",
        "exercise_name": "Legacy Row",
        "muscle_groups": [],
        "equipment": [],
        "category": "other",
        "movement_type": "other",
        "coaching_cues": [],
    })
    grouped = group_exercises.group_exercises(flat)
    videos = [video for exercise in grouped for video in exercise["videos"]]
    video_ids = [video["id"] for video in videos]
    assert video_ids.count(flat[0]["id"]) == 1, video_ids
    assert all(video.get("creator", {}).get("id") for video in videos), videos
    assert any(video["creator"]["id"] == "coachalpha" for video in videos), videos
    assert any(video["id"] == "legacy_1" and video["creator"]["id"] == "coachingotf" for video in videos), videos

print("pipeline creator provenance and dedupe smoke passed")
PY
```

Outcome:

```text
Loaded 1 TikTok videos
Loaded 1 Instagram videos
Grouping stats: 1 exact, 0 fuzzy-merged, 0 near-match (kept separate), 3 new
pipeline creator provenance and dedupe smoke passed
```

The smoke test verified Instagram scrape dedupe, TikTok creator defaulting, Instagram creator preservation, creator copying into flat rows, grouped-video duplicate id suppression, and grouped-video defensive defaulting for a legacy flat row.

## Concerns And Limitations

- Live Instagram scraping was intentionally not run; session/rate-limit behavior still needs validation during the data import task.
- Non-`coachingotf` display names depend on `profile.full_name`; this is correct for provenance but may need manual cleanup if Instagram profile names are noisy.
- `refresh.sh` keeps Instagram failures non-fatal, matching existing behavior, so a refresh can continue with stale or missing raw Instagram data if scraping fails.
