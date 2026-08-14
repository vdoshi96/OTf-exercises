# Hosting Guide — OTF Exercise Directory

The production site is deployed from this repository's GitHub `main` branch to
Vercel:

- Repository: <https://github.com/vdoshi96/OTf-exercises>
- Production: <https://o-tf-exercises.vercel.app>

## Requirements

- Node.js 22.18 or newer (the release tests use Node's built-in TypeScript
  type stripping)
- npm
- Git access to the repository
- Access to the existing Vercel project when deployment inspection or settings
  changes are required

The app is a Next.js 16 static-data site. Its reviewed exercise and coaching
catalogs and local thumbnail assets are bundled during the production build;
only compact paged summaries cross the directory client boundary.

## Release workflow

Start from an up-to-date, clean `main` branch and create a scoped branch:

```bash
git fetch --prune origin
git switch main
git pull --ff-only origin main
git switch -c vishal/<short-change-name>
```

For a creator-content refresh, preview source completeness before applying any
data changes:

```bash
npm run refresh
```

New candidates persist in `data/catalog-review-queue.json`; heuristic
classification is advisory and cannot publish or reject them. After every
candidate has a durable video-ID decision in `data/catalog-curation.json`,
apply the refresh. `data/refresh-overrides.json` is retired and all four legacy
maps must remain empty:

```bash
npm run refresh:apply
```

The apply command holds `data/refresh.lock` across the importer, thumbnail
worker, and catalog-integrity gate. The importer stages exercise, coaching,
review-queue, report, and state replacements behind
`data/refresh-transaction.json`; apply mode rolls a pending transaction forward
after a crash, while dry-run mode fails closed and writes nothing. Do not
advance source state after an incomplete or rate-limited scan.

The direct `scripts/refresh_incremental.py` entry point accepts alternate paths
for isolated fixtures, but any apply touching even one canonical repository
transaction target must use the canonical repository lock. The full workflow
rejects alternate apply targets because its thumbnail and integrity stages are
repository-scoped.

`data/refresh-report.json` currently preserves the last actual applied source
scan (`2026-08-14T15:13:18Z`, schema v1). The next reviewed apply writes the
queue-aware schema v2; do not regenerate the report merely to make a curation
migration look like a new source scan.

## Required local verification

Run the complete release checks before publishing:

```bash
npm run test:data
npm run test:directory
npm run test:security
npm run test:thumbnails
npm run test:catalog
npm run legacy-routes:check
npm run test:docs
npm run docs:check
npm run lint -- --ignore-pattern .vercel
npm run typecheck
npm run build -- --webpack
```

Then start the production build locally and run the browser matrix:

```bash
npm start
BASE_URL=http://localhost:3000 npm run test:e2e
```

Webpack is the verified deterministic local production path for this release.
The managed Codex host prevented Turbopack's CSS helper from binding a local
worker port (`EPERM`); that sandbox constraint did not affect the Webpack build
or either browser engine.

The browser suite covers Chromium and WebKit at 1280x900, 390x844, and 320x844,
plus reduced-motion Chromium and JavaScript-disabled paging. It verifies search
and filter parity, URL history and sharing, out-of-order response safety,
24-item paging, exercise and coaching details, media request gates, privacy,
branding, local thumbnails, historical exercise-route recovery, true 404s,
security headers, robots, and exact sitemap cardinality.

## Publish and deploy

Push the scoped branch, merge it into GitHub `main`, and update local `main` to
the same commit. Vercel deploys the repository's `main` branch automatically.
Remove the completed branch or worktree after the merge.

After Vercel reports the deployment ready, verify the deployed catalog rather
than treating deployment status alone as proof:

```bash
BASE_URL=https://o-tf-exercises.vercel.app npm run test:e2e
```

Also confirm `/`, `/coaching`, `/privacy`, `/robots.txt`, representative
exercise and coaching routes, their `/thumbs/` assets, and `/sitemap.xml`
return the intended statuses and hardening headers. The sitemap must contain
the homepage, coaching index, privacy page, every public exercise, and every
public coaching detail route. It intentionally omits legacy redirect/recovery
routes.

The immutable historical-route manifest covers all 1,309 exercise slugs from
baseline commit `7d059a7`. `npm run legacy-routes:check` proves that every slug
is still canonical or has an exact curation-derived redirect/recovery outcome;
unknown slugs must remain true 404 responses.

Production responses intentionally have different CSPs. Directory, privacy,
robots, sitemap, recovery, and 404 responses deny child frames. The request
proxy permits `https://www.tiktok.com` frames only when the slug belongs to a
current catalog-backed exercise or coaching detail. A missing URL under either
detail prefix still receives `frame-src 'none'`; every route denies framing by
another site.

## Custom domains and project settings

Manage domains, environment variables, analytics, usage, and deployment logs in
the existing Vercel project. Follow the DNS records Vercel displays for the
selected domain; do not rely on hard-coded records or historical pricing in this
repository.

## Troubleshooting

### Production build fails

Run the required local verification commands and inspect the first failing
boundary. `npm run build` includes the documentation-parity check.

### A thumbnail fails to refresh

Run `npm run thumbnails`, inspect `docs/qa/latest/thumbnail-report.json`, and
then run `npm run test:catalog`. Source platforms can remove posts or change
metadata endpoints; an unrecoverable source must have an explicit report entry
and use the durable local fallback.

### A TikTok player is unavailable

TikTok loads only after the visitor activates the local preview. The exercise
page retains an original-post link when the embedded player is blocked or the
source post is unavailable.

### A deployment is ready but the app is not

Check the production browser suite, route responses, asset responses, sitemap,
and deployment logs. A ready deployment is not a substitute for rendered-flow
verification.
