# Approved directory redesign

## Scope and sequence

The September 4, 2026 approved reference defines the presentation for eight screens: exercise and coaching directories, both details, privacy, legacy split recovery, legacy removal recovery, and 404.

1. Replace the shared dark shell with white, cool gray, charcoal, and restrained orange. Keep the existing logo and prominent unofficial identity.
2. Simplify directory introductions, expose desktop filters beside results, and use readable mobile rows. Preserve the server directory module, Fuse.js ranking, multi-select semantics, URL history, and 24-item paging.
3. Introduce one selected demonstration with per-video attribution and alternate-video selection. Preserve click-gated TikTok, outbound Instagram, original-source fallbacks, resource summaries, and related exercises.
4. Restyle policy and recovery pages without changing reviewed destinations or HTTP status behavior.
5. Update regression checks for the approved presentation, verify all screens at desktop, 390px, and 320px widths, and run the existing release matrix.
6. Push, merge to main, verify the production deployment and rendered public site, sync canonical main, and remove the completed worktree.

## Invariants

Do not change reviewed catalogs, thumbnails, curation, redirects, query contracts, security headers, analytics behavior, or source attribution. Keep no-JavaScript forms and bounded paging. Every demonstration remains reachable without JavaScript through source links. Do not publish the proposal toolbar, iframe shell, synthetic loading states, or embedded catalog bundle.

## Verification

Use the existing Chromium and WebKit release suite plus explicit multiple-video selection checks and screenshots of all eight screens. Exercise search/filter combinations, pagination focus, return context, media gates, fallback images, related links, privacy, redirects, recovery, and genuine 404 responses. Record completed release evidence in `docs/qa/latest/design-qa.md`.
