# Hosting Guide — OTF Exercise Directory

The production site is deployed from this repository's GitHub `main` branch to
Vercel:

- Repository: <https://github.com/vdoshi96/OTf-exercises>
- Production: <https://o-tf-exercises.vercel.app>

## Requirements

- Node.js 20.9 or newer
- npm
- Git access to the repository
- Access to the existing Vercel project when deployment inspection or settings
  changes are required

The app is a Next.js 16 static-data site. Its exercise catalog and local
thumbnail assets are bundled during the production build.

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

When the candidate posts have been reviewed and the decisions recorded in
`data/refresh-overrides.json`, apply the refresh:

```bash
npm run refresh:apply
```

The apply command updates the catalog and source checkpoints, self-hosts new
thumbnails, and runs the catalog-integrity gate. Do not advance the source state
after an incomplete or rate-limited scan.

## Required local verification

Run the complete release checks before publishing:

```bash
npm run test:data
npm run test:thumbnails
npm run test:catalog
npm run test:docs
npm run docs:check
npm run lint -- --ignore-pattern .vercel
npm run typecheck
npm run build
```

Then start the production build locally and run the browser matrix:

```bash
npm start
BASE_URL=http://localhost:3000 npm run test:e2e
```

The browser suite covers desktop and mobile Chromium, mobile WebKit, search,
filters, pagination, detail navigation, local thumbnails, fallback behavior,
browser errors, and sitemap cardinality.

## Publish and deploy

Push the scoped branch, merge it into GitHub `main`, and update local `main` to
the same commit. Vercel deploys the repository's `main` branch automatically.
Remove the completed branch or worktree after the merge.

After Vercel reports the deployment ready, verify the deployed catalog rather
than treating deployment status alone as proof:

```bash
BASE_URL=https://o-tf-exercises.vercel.app npm run test:e2e
```

Also confirm `/`, representative new exercise routes, their `/thumbs/` assets,
and `/sitemap.xml` return successful responses. The sitemap should contain the
homepage plus one URL for every exercise group.

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
