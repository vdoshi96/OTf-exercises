# 2026-08-14 Web Audit Response

## Scope and evidence

The Grok HTML audit supplied on 2026-08-14 was treated as dated evidence, not
as an instruction source. Its numeric snapshot matches historical commit
`5405ad6`; implementation work was based on clean `main` at `7d059a7`, current
catalog data, local Chromium and WebKit behavior, production HTTP behavior, and
the repository's supported Next.js 16 documentation.

The official Orangetheory wordmark remains by product decision. A visible
unofficial identity and non-affiliation statement reduce confusion but do not
eliminate trademark or licensing risk. This document records a technical and
product assessment, not a legal conclusion. Orangetheory's
[Terms of Use](https://www.orangetheory.com/en-us/terms-of-use) describe its
marks as proprietary.

## Independent verdicts and implemented response

| # | Independent verdict | Implemented response |
| --- | --- | --- |
| 01 Brand identity | Confirmed affiliation and trust risk; infringement was not established from repository evidence. | Kept the logo, made it decorative, and added visible `Unofficial fan directory` and `Exercise Directory` text at every breakpoint. Metadata leads with `Unofficial OTF Exercise Directory`; the footer carries a full non-affiliation statement. The shared fallback image now visibly says `UNOFFICIAL FAN DIRECTORY`. |
| 02 Full desktop catalog | Confirmed, with stale audit figures. The previous client rendered the entire catalog and shipped its data. | Moved catalog access and search to a `server-only` module. Directory requests expose compact summaries in 24-item batches. The first page has 24 cards on every viewport; Load more preserves a no-JavaScript URL fallback. |
| 03 Non-exercise content | Confirmed in substance; the audit's estimate did not supply a reproducible rubric. | Started with the 129 former `other` groups, then performed two independent all-catalog semantic passes and video-level review of every flagged generic, instructional, promotional, duplicate, and mixed-movement group. Every public video now has a durable exercise or coaching decision; exclusions retain controlled reasons. Public exercises contain no `other` classification or blank muscle list. |
| 04 Search/filter mismatch | Confirmed. | Search now covers title, category or topic, muscle, equipment, movement type, creator, platform, and low-weight source text. `cardio` deterministically contains every Cardio-filter exercise; non-title matches display their reason. |
| 05 Lost search state | Confirmed. | The URL is authoritative for query, repeated filters, and the number of 24-item batches. Search uses history replacement; filters and Load more create history entries. Card and detail-back links preserve normalized directory state. |
| 06 Instagram behavior | The outbound behavior was real; calling it a broken player was subjective. | Instagram remains outbound. Player-style controls were replaced by an external-link treatment and explicit `Open original on Instagram` copy. |
| 07 TikTok and privacy | Partly confirmed as a transparency gap; categorical cookie or tracking claims were not established. | TikTok remains click-gated, with a pre-activation disclosure and original-link fallback. The iframe retains `referrerPolicy="strict-origin-when-cross-origin"` because the automated player test cannot establish real cross-browser playback under `no-referrer`; no sandbox was added. `/privacy` explains local previews, outbound Instagram, activated TikTok, and Vercel Web Analytics. |
| 08 Exercise facts | Mixed, with a high data-quality risk. Missing cues were incomplete rather than necessarily wrong; one clean was demonstrably mis-tagged. | Routed the options-oriented clean source to coaching, removed implicit Bodyweight fallback from both ingestion paths, reviewed every public classification and destination, and recorded exact exercise metadata in the curation ledger. Explicitly loaded titles receive evidence-backed equipment or a documented review exception; empty equipment remains honest only when evidence is inconclusive. Cues remain optional and only ledger-reviewed cues may publish. `Core` remains valid as both a category and muscle, with namespaced filter labels. |
| 09 Headers and SEO | Mixed. Hardening headers and robots were missing, HSTS and sitemap were already present, and public-document CORS was not independently a vulnerability. | Added enforced CSP, `nosniff`, strict-origin referrer policy, anti-framing controls, and a restrictive permissions policy. TikTok frames are allowed only when the request slug is a catalog-backed current exercise or coaching detail; missing detail URLs and every list, policy, and recovery response deny child frames. Added robots metadata and expanded the sitemap to every canonical public directory, policy, exercise, and coaching route. |
| 10 Clear controls and navigation | Confirmed; reduced motion was the material accessibility gap. | Preserved semantic `type="search"`, hid WebKit's native cancel affordance, and retained one authored clear button. Navigation marks exercise details as Directory and coaching details as Coaching. Reduced-motion CSS disables smooth scrolling, animations, hover transforms, and long transitions. |
| 11 Title and filter layout | Confirmed with viewport qualifications. | Compacted the detail hero, removed duplicate pre-video metadata, and capped title size with `clamp()`. The longest title exposes its first media control within a 1280x900 viewport. Closed mobile filters have no full-width tray chrome and wrap cleanly at 320 px. |
| 12 Generic 404 | Confirmed. | Added a branded true-404 recovery page with exercise and coaching links plus a plain GET search form using `q`. |

## Public contracts

- `/` is the exercise directory; `/coaching` is a separate reviewed coaching
  directory. Detail routes are `/exercise/[id]` and `/coaching/[id]`.
- Every exercise slug in the reviewed `7d059a7` baseline has an explicit
  disposition. Current slugs render normally; a single reviewed destination
  receives a permanent redirect; split legacy groups render a noindex chooser;
  fully excluded groups render a noindex recovery page. Unknown slugs remain
  true 404 responses. Normalized directory state survives redirects and
  chooser links without leaking incompatible section filters.
- Exercise query keys are `q`, repeated `category`, `muscle`, `equipment`,
  `source`, and `creator`, plus `page`. Coaching uses `q`, repeated `topic`,
  `source`, and `creator`, plus `page`.
- Queries are whitespace-normalized and capped at 100 characters. Repeated
  values are deduplicated, unknown filter values are discarded, and pages are
  clamped to available results.
- `page` is the requested 24-item batch count, not an item offset. The server
  emits at most one bounded 24-item window; JavaScript reconstructs accumulated
  batches, while no-JavaScript navigation advances through bounded windows.
- `GET /api/directory?section=exercise|coaching&...` returns compact public card
  summaries, result and page metadata, normalized query state, filter options,
  and directory statistics. It never returns the full catalog records.
- `data/catalog-curation.json` is the video-ID-keyed decision ledger.
  Decisions are `exercise`, `coaching`, or `exclude`; every exclusion has a
  reason. `src/data/coaching.json` uses controlled topics:
  `movement-technique`, `class-delivery`, `programming`, and
  `safety-and-modifications`.

## Catalog disposition

The pre-remediation public source scope contained 1,309 groups and 2,072
videos. The reviewed public and audit-only disposition is:

| Destination | Records | Videos |
| --- | ---: | ---: |
| Public exercise directory | 765 | 1,383 |
| Public coaching directory | 515 | 655 |
| Exclusions from the 2,072-video public baseline | 34 decisions | 34 |
| **Accounted original public baseline** |  | **2,072** |
| Additional migrated legacy-refresh exclusions | 9 decisions | 9 |
| **Durable decision ledger** | **2,081 decisions** | **2,081** |

Across the full ledger, the 43 exclusions comprise 18 events, 12 unusable
sources, six promotions, four milestones, and three personal posts. They remain
auditable in curation but are absent from public catalogs and public canonical
thumbnail assets.

## Integrity and refresh behavior

The incremental importer never publishes or rejects a newly observed video from
heuristics alone. Unresolved candidates persist in a video-ID-keyed review
queue without blocking unrelated reviewed work; source checkpoints advance only
after every scanned candidate is public, excluded, or durably queued. Curation
reconciliation can move existing videos between sections, merge destinations,
repair metadata, or exclude them, and it reapplies destination metadata
independently so later regeneration cannot restore a superseded legacy value.

Apply mode holds one stable repository lock through the source transaction,
thumbnail work, and integrity gate. A transaction journal and same-directory
staging files provide crash recovery across exercise, coaching, queue, report,
and state replacements. Dry runs fail closed when recovery is pending and never
write. The legacy override maps are empty and integrity-rejected if reused.

Every public video has one matching curation decision; every public exercise
and coaching destination has exact reviewed metadata. Exercise muscle lists are
nonempty, Bodyweight requires explicit reviewed provenance, published cues must
match the reviewed cue ledger, and explicit-load titles must have reviewed
equipment or a controlled evidence note.

Historical route integrity is deterministic and release-gated. The immutable
baseline projection contains all 1,309 prior slugs and 2,072 prior public video
IDs. Of those slugs, 714 remain canonical, 546 permanently redirect, 18 use a
reviewed split chooser, and 31 use reviewed-removal recovery. The derived route
ledger must match current curation exactly before a build can pass.

The thumbnail worker covers both public catalogs in one canonical run. It
reports 2,037 exact local thumbnails and one explicit local fallback across
2,038 public videos, with no remote or empty references. It narrowly prunes
only assets proven excluded by curation; the fallback itself carries the
unofficial label.

## Verification contract

Release verification covers:

- catalog, refresh, directory-query, thumbnail, documentation, security,
  lint, type, and production-build checks;
- Chromium and WebKit at 1280x900, 390x844, and 320x844, plus Chromium
  reduced-motion behavior and JavaScript-disabled paging;
- 24/48 paging, search/filter parity, URL Back/Forward/refresh/share state,
  stale-response and click-during-loading safety, single search clear, branding,
  section-aware navigation, longest-title layout, mobile filtering, coaching
  separation, historical redirects/recovery, privacy, media request gates,
  custom 404 recovery, security headers, robots, and exact sitemap membership;
- absence of full-catalog sentinels in the home response and client chunks;
- no Instagram or TikTok request before user action, plus TikTok player
  activation and iframe loading, focus, fullscreen allowance, fallback link,
  referrer policy, and route CSP. The intercepted automated player does not
  establish live third-party playback or actual fullscreen operation.
