# Task 02B Handoff: Lint Verification Cleanup

## Owner

Worker Task 2B

## Scope

- Fixed the two baseline lint errors found during final verification.
- Preserved existing attribution behavior.
- Kept the CommonJS Instagram fetch script runnable under the current package configuration.

## Files Touched

- `src/components/TikTokEmbed.tsx`
- `scripts/fetch_instagram_posts.js`
- `docs/superpowers/handoffs/task-02b-lint-verification-cleanup.md`

## Root Cause

- `scripts/fetch_instagram_posts.js` is a CommonJS Node script, but ESLint applies `@typescript-eslint/no-require-imports` to JavaScript scripts.
- `src/components/TikTokEmbed.tsx` called `setError(true)` synchronously inside `useEffect` when `videoId` was missing, triggering `react-hooks/set-state-in-effect`; rendering already handles `!videoId`.

## Fix

- Added a file-level ESLint disable for `@typescript-eslint/no-require-imports` with a reason noting the script intentionally remains CommonJS because `package.json` is not `type=module`.
- Removed the redundant missing-`videoId` state update from `TikTokEmbed`; the effect now returns early and lets the existing `!videoId` render branch show the fallback.

## Verification

```bash
npm run lint
```

Outcome: passed with exit code 0. ESLint reported two existing `@next/next/no-img-element` warnings in `src/components/ExerciseCard.tsx` and `src/components/InstagramEmbed.tsx`, with 0 errors.

```bash
./node_modules/.bin/tsc --noEmit
```

Outcome: passed with exit code 0 and no output.

## Concerns

None.
