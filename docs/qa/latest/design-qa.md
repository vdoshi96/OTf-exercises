# Catalog refresh QA — September 5, 2026

## Reviewed update

The source refresh adds 22 Coach Rudy exercise videos: nine demonstrations join
existing exercise groups and 13 create distinct variations. One personal
Marathon Month recap is excluded. TrainingTall's newest Instagram reel matches
the previous checkpoint, and the live TikTok scan finds no newer videos.

The public catalog contains 778 exercises with 1,405 demonstrations and 515
coaching resources with 655 videos. All original video records remain identical.
Two reviewed equipment lists include the dumbbells visible in the added videos.
All 1,309 historical exercise slugs retain their canonical or recovery outcome.

The public source fields, date checks, checkpoint overlap, and review decisions
are retained in `data/refresh-browser-scan.json` and `data/refresh-report.json`.
The browser capture contains concise summaries of public captions and excludes
private account metadata, comments, and messages. All 22 new thumbnails were
visually checked and normalized with the existing thumbnail pipeline.

## Local verification

Import, directory-query, security, thumbnail, catalog/legacy-route, documentation,
lint, typecheck, and the Webpack production build pass. The typecheck passes
after the build finishes generating Next.js types. The first apply integrity
gate identified an outdated review counter and route statistics; updating the
provenance counter and canonical route generator resolved both findings.
Replaying the captured source delta after apply produces no further changes.

Chromium and WebKit pass at desktop, 390px, and 320px sizes. Reduced-motion and
JavaScript-disabled checks also pass. The responsive suite passes 24 screen
checks and alternate-video selection, source links, and discovery filters.
Eleven automated accessibility scans report zero violations. Any manual-review
items remain recorded in `redesign/results.json`.

## Production verification

Release commit `0d82fe9bd181c30f608265f72354133a7211743c` merged through
[PR #27](https://github.com/vdoshi96/OTf-exercises/pull/27). Vercel deployment
`dpl_Hb2Rng4KvfCg9qF5fVstgP4hDc4d` reached Ready, and inspection confirmed
[the public production URL](https://o-tf-exercises.vercel.app) resolved to
[that deployment](https://o-tf-exercises-3etcy3gu0-vdoshi96s-projects.vercel.app).

The full Chromium/WebKit and responsive suites pass on production. All 22 new
video IDs appear on their exercise pages, every new thumbnail matches its local
SHA-256 hash, and the sitemap has the expected 1,296 URLs. The checks are saved
in `creator-refresh-production.json` and `creator-refresh-browser.log`.

Manual browser review confirms the new Reciprocating Hammer Curl page renders
its exact thumbnail and source link, and selecting demonstration 3 on Heavy
Hip Bridge shows the newly imported Bridge video.

A deployment-specific error-log query covering the preceding 10 minutes
returned no entries during QA. This is a bounded observation.

The retained screenshots and responsive results in `redesign/` come from the
production run and replace the previous completed captures. The independent
thumbnail report covers all 2,060 public video thumbnails. The existing fallback
for TikTok video `7254008823747300650` remains; none of the 22 new videos uses it.

The tests verify provider links, previews, and click-gating. They do not promise
third-party playback availability. The earlier redesign review remains available
in the Git history at commit `9a054ac`.
