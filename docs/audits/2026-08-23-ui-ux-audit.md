# UI/UX audit and remediation — 2026-08-23

## Verdict

**CONDITIONAL PASS — final local candidate**

The core product is usable, responsive, visually consistent, and fast after the
remediation. No Critical or High product defect remains. The strict audit result
is conditional because the deliberate custom 404 route generates one expected
browser-level 404 console error; changing that route to HTTP 200 would make the
product less correct.

Hard gates after remediation:

| Gate | Raw | Allowlisted | Reportable | Result |
| --- | ---: | ---: | ---: | --- |
| Console errors | 1 | 0 | 1 | Conditional — intentional true 404 only |
| Console warnings | 0 | 0 | 0 | Pass |
| Network 5xx | 0 | 0 | 0 | Pass |
| Layout collapse | 0 | 0 | 0 | Pass |
| axe Critical | 0 | 0 | 0 | Pass |
| axe Serious | 0 | 0 | 0 | Pass |
| Performance budget | 0 misses | — | 0 | Pass |

The five audited 200 routes have zero console errors or warnings. The unknown
route returns the required HTTP 404 and renders a useful recovery page. Axe also
reports one incomplete automated check per route; those items were manually
reviewed and are not represented as conclusive automated passes.

## Scope and persona

Primary persona: a time-pressed Orangetheory member or coach with moderate
technical comfort who wants to find and understand a movement in under one
minute, commonly on a phone shortly before class.

Audited routes:

1. `/`
2. `/coaching`
3. `/exercise/deadbug?q=dead+bug`
4. `/coaching/how-to-row-a-500m-test?q=row+pacing`
5. `/privacy`
6. `/audit-route-that-does-not-exist`

The walkthrough covered search, filtering, zero results, paging, directory to
detail and back, coaching search, keyboard navigation, offline and retry states,
slow responses, custom recovery, external media boundaries, mobile filtering,
and responsive layout. The app is public and read-only, so authentication,
permissions, destructive actions, write success, conflicts, and expired-session
scenarios do not exist in this product.

## Interaction manifest

The baseline interaction walkthrough ran from `2026-08-24T02:23:16.371Z` to
`2026-08-24T02:30:44.674Z` and produced 18 distinct captured checkpoints. Median
gap between checkpoints was 15.056 seconds; the minimum was 2.728 seconds, so
the audit-the-audit clustered-timestamp guard did not fire.

| Time (UTC) | Route / state | Interaction and observation |
| --- | --- | --- |
| 02:23:16 | `/` desktop | Loaded real production site; recorded normal console and network baseline. |
| 02:24:06 | `/` desktop | Typed `dead bug`; observed three results and URL-backed state. |
| 02:24:19 | `/` desktop | Submitted search and confirmed stable result count. |
| 02:24:43 | `/` desktop | Opened filters and inspected all filter groups. |
| 02:24:55 | `/` desktop | Added Lower Body to create a zero-result combination. |
| 02:25:20 | `/` desktop | Pressed Escape; reproduced that desktop filters stayed open. |
| 02:25:33 | exercise detail | Opened a result and checked media, creator, metadata, focus, and layout. |
| 02:25:36 | `/` desktop | Used Back to directory; search state and three results were restored. |
| 02:25:50 | `/coaching` desktop | Navigated to the separate coaching directory. |
| 02:26:07 | `/coaching` desktop | Typed `row pacing`; observed 18 results and relevant first matches. |
| 02:26:29 | `/` mobile | Repeated search at 390×844 and inspected tap targets. |
| 02:26:47 | `/` mobile | Opened the native filter dialog, used Escape, and confirmed focus return. |
| 02:29:23 | `/` keyboard | Tabbed through header, search, filters, cards, and focus indicators. |
| 02:29:38 | `/` responsive | Checked the 375/768/1024/1280/1440/1920 width matrix. |
| 02:29:49 | `/` offline | Disabled the network and reproduced raw `Failed to fetch` copy. |
| 02:30:01 | `/` recovery | Restored the network and used Try again. |
| 02:30:32 | `/` slow response | Delayed the API and inspected the small `Updating…` feedback. |
| 02:30:44 | six-route sweep | Read console, network, layout, axe, and performance evidence. |

Evidence is retained in `output/playwright/ux-audit-2026-08-23` for the working
run and in `docs/qa/latest` for the newest completed visual record. The baseline
contains more than two screenshots per route and the automated sweep records at
least one console read per route.

## Findings and fixes

### H-1 — Search and creator text failed contrast

- **Layer:** Visual / accessibility
- **Severity:** High
- **Surface:** `/`, `/coaching`, representative exercise and coaching details
- **Reproduce:** Run axe at 1440×900; inspect the orange Search button and muted
  creator handles.
- **Observed:** The baseline reported Serious `color-contrast` violations on
  both directory Search buttons and representative creator handles.
- **Expected:** Important text meets contrast requirements without changing the
  established black/orange visual system.
- **Evidence:** `before/automated-checks.json` and the desktop before screenshot.
- **Location:** `src/components/SearchBar.tsx`, `src/components/VideoEmbed.tsx`,
  `src/app/exercise/[id]/page.tsx`, `src/app/layout.tsx`.
- **Patch:** Use black text on orange actions and raise muted text from Stone 500
  to Stone 400 where needed.
- **After:** Zero axe Critical/Serious violations on all six audited routes.

### M-1 — Important mobile targets were 44 pixels or smaller

- **Layer:** Interaction
- **Severity:** Medium
- **Surface:** All six routes at 390×844
- **Reproduce:** Measure visible buttons, links, and form controls.
- **Observed:** Header navigation, filter actions, detail Back links, creator and
  related cards, privacy CTA, and 404 recovery controls measured 16–44 pixels.
- **Expected:** Isolated important controls provide at least a 48-pixel target.
- **Evidence:** Baseline route measurements and before mobile screenshot.
- **Location:** `SiteNav.tsx`, `SearchBar.tsx`, `FilterPanel.tsx`, detail routes,
  `VideoEmbed.tsx`, `TikTokEmbed.tsx`, privacy and not-found routes.
- **Patch:** Apply 48-pixel minimum heights and widths to the relevant controls.
- **After:** Only the intentionally hidden skip link and inline footer Privacy
  link remain below 48 pixels; both qualify for target-size exceptions.

### M-2 — Desktop filters ignored Escape

- **Layer:** Interaction
- **Severity:** Medium
- **Surface:** `/` and `/coaching`, desktop
- **Reproduce:** Open Filters, then press Escape.
- **Observed:** The panel stayed open and focus stayed inside it.
- **Expected:** Escape closes a disclosure and restores focus to its trigger.
- **Evidence:** Baseline desktop filter screenshot and interaction checkpoint.
- **Location:** `src/components/FilterPanel.tsx`.
- **Patch:** Add Escape handling, focus restoration, `aria-hidden`, `inert`, and
  an `aria-expanded` regression test.
- **After:** Chromium and WebKit production smoke pass; focus returns correctly.

### M-3 — Zero results lacked direct recovery

- **Layer:** Feedback
- **Severity:** Medium
- **Surface:** Directory empty state
- **Reproduce:** Search for `dead bug`, then add an incompatible category.
- **Observed:** The page explained the empty result but offered no action inside
  the state.
- **Expected:** Recovery should be adjacent to the problem.
- **Evidence:** `before/desktop-empty-state.png`.
- **Location:** `src/components/ExerciseGrid.tsx`.
- **Patch:** Add contextual Reset search and Clear filters actions.
- **After:** The permanent browser test resets an empty query and restores the
  first 24 results.

### M-4 — Offline errors exposed technical fetch copy

- **Layer:** Feedback
- **Severity:** Medium
- **Surface:** Directory request error
- **Reproduce:** Go offline, change the search query, and wait for the API call.
- **Observed:** The alert displayed `Failed to fetch`.
- **Expected:** Explain what happened and the next action in user language.
- **Evidence:** `before/desktop-offline-search.png`.
- **Location:** `src/components/ExerciseGrid.tsx`.
- **Patch:** Distinguish offline from generic request failure, preserve the last
  good results, and retain Try again.
- **After:** The alert says, “You're offline. Check your connection and try
  again.”

### L-1 — State changes used weak or ad hoc motion

- **Layer:** Delight / feedback
- **Severity:** Low
- **Surface:** desktop filter disclosure, mobile filter dialog, loading label
- **Reproduce:** Open and close Filters, then delay a directory API request.
- **Observed:** Desktop filters used a one-way 160 ms entrance only; the mobile
  bottom sheet appeared and disappeared abruptly; loading feedback was static.
- **Expected:** State changes should be legible, restrained, and reduced-motion
  safe.
- **Evidence:** Baseline filter and slow-loading screenshots.
- **Location:** `src/app/globals.css`, `src/components/FilterPanel.tsx`,
  `src/components/ExerciseGrid.tsx`.
- **Patch:** Apply transitions.dev accordion, panel-reveal, and shimmer patterns
  with app-specific timing tokens and required reduced-motion guards.
- **After:** Desktop disclosure is 250 ms; mobile sheet is 260/200 ms; shimmer is
  limited to real pending work. Tabs and write-success states do not exist.

## Responsive, stress, and performance coverage

- No horizontal overflow or clipped content at 375, 768, 1024, 1280, 1440, or
  1920 pixels.
- Mobile filter content scrolls independently while actions remain visible.
- The full public catalog naturally supplies heavy data: 765 exercises and 515
  coaching resources with bounded 24-item paging.
- Long titles, absent equipment, multiple sources, empty results, malformed URL
  state, rapid search races, delayed requests, offline retry, JavaScript-disabled
  paging, custom 404, and reduced motion are covered.
- There is no multi-pane workspace, authentication, role matrix, write form,
  optimistic save, destructive action, or concurrent editor to exercise.
- After local metrics: LCP 68 ms, CLS 0, INP 24 ms, TTFB 7 ms. Baseline live
  production metrics were also green: LCP 356 ms, CLS 0, INP 24 ms, TTFB 34 ms.

## Visual system review

The current Oswald/Inter typography, black surfaces, orange emphasis, compact
cards, and editorial density fit the pre-class lookup job. The remediation keeps
that identity instead of redesigning it. The Impeccable detector reports one
advisory for the existing decorative grid background; it is retained because it
is subtle, established, and does not compete with content.

## Regression verification

- `npm run lint`
- `npm run typecheck`
- `npm run test:data` — 26 passed
- `npm run test:directory` — 9 passed
- `npm run test:security` — 5 passed
- `npm run test:thumbnails` — 15 passed
- `npm run test:catalog` — 11 passed plus deterministic route and integrity gates
- `npm run test:docs` — 9 passed
- `npm run build` — 1,884 production pages compiled and typechecked
- `BASE_URL=http://127.0.0.1:3000 npm run test:e2e` — Chromium and WebKit at
  desktop, 390px, and 320px; reduced-motion and JavaScript-disabled variants

Permanent regression coverage now asserts 48-pixel touch targets, contextual
empty-state recovery, and desktop Escape/focus behavior.

## Audit self-critique

Fresh review drafted 7 candidate observations, kept 6, removed 1 duplicate, and
found 0 generic filler findings. It identified no missed Critical/High product
defect. It did require four reporting corrections that this document follows:

1. Separate the intentional 404 console error from clean 200 routes.
2. State zero axe violations while preserving the incomplete/manual-review note.
3. Report zero network 5xx rather than claiming no aborted requests; expected
   Next.js prefetch aborts are present in raw evidence.
4. Retain after evidence for filters, empty results, offline errors, the mobile
   sheet, and detail contrast.

## Remaining caveats

1. The strict all-route console hard gate remains red only because a true custom
   404 produces the browser's standard failed-resource message. No allowlist was
   added and the status was not weakened to 200.
2. Axe incomplete checks were reviewed manually but remain automation limits.
3. The inline footer Privacy link is smaller than 48 pixels under the inline-text
   exception.
4. Third-party TikTok playback and fullscreen behavior are outside bounded local
   verification; the click gate, iframe contract, privacy copy, and fallback link
   are verified.

## Final visual evidence

- [Desktop before](../qa/latest/before-desktop-directory-1440x900.png)
- [Desktop after](../qa/latest/after-desktop-directory-1440x900.png)
- [Mobile before](../qa/latest/before-mobile-directory-390x844.png)
- [Mobile after](../qa/latest/after-mobile-directory-390x844.png)
- [Desktop filters after](../qa/latest/after-desktop-filters-1440x900.png)
- [Desktop empty-state recovery after](../qa/latest/after-desktop-empty-state-1440x900.png)
- [Desktop detail contrast after](../qa/latest/after-desktop-detail-contrast-1440x900.png)
- [Mobile filters after](../qa/latest/after-mobile-filters-390x844.png)
- [Offline recovery after](../qa/latest/after-mobile-offline-390x844.png)
