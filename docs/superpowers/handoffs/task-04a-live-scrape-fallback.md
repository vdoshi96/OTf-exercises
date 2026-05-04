# Task 04A: Live Scrape Fallback

Status: DONE

## Context

Live run failed immediately:

```bash
python3 scripts/scrape_instagram.py --user vizhal007 --profiles trainingtall,coach.fajardo,brookerooney,lustertraining,coachgarin
```

Instaloader returned `ProfileNotExistsException` during profile resolution for all target handles, so the script could not reach post scanning.

Direct Instagram web API was confirmed to work for at least `trainingtall`:

- `GET https://www.instagram.com/api/v1/users/web_profile_info/?username=trainingtall`
- Required headers: `x-ig-app-id: 936619743392459`, `User-Agent: Mozilla/5.0`
- Returned profile id and timeline metadata.
- `POST https://www.instagram.com/api/v1/clips/user/` with `target_user_id=452950430&page_size=12` and headers including `x-ig-app-id`, `User-Agent`, `x-csrftoken`, `Referer` returned reels plus `paging_info.max_id` / `more_available`.

## Changes

- Kept the existing Instaloader path intact when profile resolution succeeds.
- Caught `ProfileNotExistsException` and other profile-resolution errors per handle so the import can continue.
- Fixed the live fallback control-flow failure:
  - `Profile.from_username` returning not found for a target handle no longer triggers a forced fresh login before fallback.
  - The script now tries the web API fallback immediately after Instaloader profile resolution fails for that handle.
  - `login(..., force_fresh=True)` is guarded so a future fresh-login caller requires either `IG_PASSWORD` or an interactive stdin, avoiding `EOFError` in non-interactive shells.
- Added a stdlib-only `urllib` Instagram web API fallback:
  - Resolves creator metadata from `/api/v1/users/web_profile_info/?username={handle}`.
  - Pages `/api/v1/clips/user/` using `target_user_id`, `page_size`, and `max_id`.
  - Stops when `more_available` is false or the `WEB_API_MAX_PAGES` safety limit is reached.
  - Sleeps briefly between pages.
  - Converts reel media to the existing raw JSON shape, adding `is_video: true` for fallback records.
  - Deduplicates fallback records by `id`.
- One handle failing in either Instaloader or fallback no longer crashes the whole import.

No new dependencies were added. The fallback uses Python stdlib `urllib`; `requests` was not needed.

## Live EOFError Follow-Up

A subsequent live run reached this sequence for `@trainingtall`:

1. Saved-session login loaded first.
2. `Profile.from_username` returned not found for the target handle.
3. `main()` retried with `login(..., force_fresh=True)` before reaching the web API fallback.
4. In the non-interactive shell, `interactive_login()` attempted to prompt and raised `EOFError`.

The fix removes that normal profile-resolution fresh-login retry from `main()`, so one handle's Instaloader resolution failure proceeds to web API fallback and does not crash the remaining handles. Any future explicit fresh-login path is now documented in code via `can_attempt_fresh_login`: it is only safe when `IG_PASSWORD` is present or stdin is interactive.

## Verification

Compile:

```bash
python3 -m py_compile scripts/scrape_instagram.py
```

Non-network smoke for conversion and dedupe:

```bash
python3 - <<'PY'
import importlib.util
spec = importlib.util.spec_from_file_location('scrape_instagram', 'scripts/scrape_instagram.py')
mod = importlib.util.module_from_spec(spec)
spec.loader.exec_module(mod)
creator = mod.creator_from_web_profile({'username': 'TrainingTall', 'full_name': ''})
assert creator == {
    'id': 'trainingtall',
    'display_name': 'TrainingTall',
    'handle': 'TrainingTall',
    'profile_url': 'https://www.instagram.com/TrainingTall/',
}
media = {
    'code': 'ABC123',
    'caption': {'text': 'row tips'},
    'image_versions2': {'candidates': [{'url': 'https://thumb.test/a.jpg'}]},
    'video_duration': 12.4,
    'taken_at': 1700000000,
}
converted = mod.reel_media_to_raw_video(media, creator)
assert converted['id'] == 'ig_ABC123'
assert converted['url'] == 'https://www.instagram.com/reel/ABC123/'
assert converted['description'] == 'row tips'
assert converted['thumbnail'] == 'https://thumb.test/a.jpg'
assert converted['upload_date'] == '20231114'
assert converted['source'] == 'instagram'
assert converted['is_video'] is True
videos, duplicates = mod.dedupe_videos_by_id([converted, dict(converted)])
assert len(videos) == 1
assert duplicates == 1
print('smoke ok')
PY
```

Both commands passed.

## Concerns

- I did not run the full live scrape, per task instruction.
- The fallback depends on Instagram's private web API and may still be sensitive to cookies, headers, or rate limiting.
- Fallback records include `is_video: true`; the pre-existing Instaloader records were left unchanged to avoid changing working behavior.
