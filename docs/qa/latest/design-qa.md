# Design QA — September 4, 2026 redesign

## Scope

The approved white, cool-gray, charcoal, and orange redesign covers the exercise
and coaching directories, both details, privacy, legacy split recovery, legacy
removal recovery, and 404. The catalog, curation records, thumbnail assets,
legacy-route ledger, query helpers, search ranking, and security configuration
have no changes.

## Verification

The local Next.js production build passes typecheck and lint. The refresh
fixtures, directory-query, security, thumbnail, catalog/legacy, and documentation
suites pass. The Chromium and WebKit release matrix covers desktop, 390px, and
320px, plus Chromium reduced-motion and JavaScript-disabled paging.

The redesign suite checks all eight screens at 1280px, 390px, and 320px, with no
horizontal overflow and intended HTTP statuses. It verifies one selected media
area, every alternate selector, per-video attribution, no selector for a single
video, source links without JavaScript, and discovery shortcuts that preserve
search and other filter values. Selecting a demo does not load an iframe.

Eleven axe WCAG A/AA scans cover all eight mobile screens, multiple demos, the
filter dialog, and a real failed directory request. There are zero violations.
The directory and request-error scans retain the `aria-valid-attr-value`
incomplete item; the multiple-demo scan retains a `color-contrast` incomplete
item for manual review. These items are automation limits, not automated passes.
The browser matrix separately verifies the visible control, open native dialog,
focus containment, and focus restoration.

## Independent visual review

The finish reviewer validated all 27 screen and multiple-demo captures. Its
verdict pass scored four requested fixes resolved: discovery shortcuts, metadata
following headings, legible TikTok source links, and the SVG selection indicator.
The disposition was `ship` for those scored fixes, with no observed regressions
from that batch. This is not a claim of exhaustive review of every catalog item.

## Media and recovery boundaries

Automated TikTok playback tests intercept the third-party player and establish
click-gating, iframe focus, and fallback links. They do not establish reliable
provider playback or signed-in Instagram access. Unknown routes deliberately
return HTTP 404; a browser may log the corresponding failed-resource message.
No usability improvement or performance benchmark is inferred from this QA.

## Evidence

The newest completed screen captures and machine-readable results are in
[redesign](redesign/results.json). Historical audit conclusions remain in their
dated documents; their screenshot links point to the historical Git commit.
`thumbnail-report.json` remains the independent catalog-integrity record.

## Production verification

Implementation commit `452be78045532895303221fa7e7b27218936a46f` merged through
[PR #24](https://github.com/vdoshi96/OTf-exercises/pull/24). Vercel deployment
`dpl_5qN5au8aWiRmE6i1NKMX2NEDcvi3` reached Ready, and inspection confirmed
[the public production URL](https://o-tf-exercises.vercel.app) resolved to
[that immutable deployment](https://o-tf-exercises-99ix993sm-vdoshi96s-projects.vercel.app).

The complete Chromium/WebKit matrix passed against the public URL, including
all three viewport sizes, reduced motion, and JavaScript-disabled paging.
The 24 screen/viewport checks, alternate-video and discovery-link checks, and
11 accessibility scans also passed on production. The retained captures and
results come from that live run and replace the local captures. Browser checks
cover security headers, catalog-backed iframe policy, legacy redirects and
reviewed recoveries, true HTTP 404s, robots, and sitemap cardinality.

A Vercel error-level log query for this deployment over the preceding 10 minutes
returned no entries during QA. This is a bounded observation, not a promise of
ongoing monitoring. The evidence closeout changes documentation only; it does
not alter the verified application source or catalog.
