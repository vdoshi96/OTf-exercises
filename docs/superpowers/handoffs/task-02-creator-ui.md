# Task 02 Handoff: Creator UI, Search, And Filtering

## Owner

Worker Task 2

## Scope

- Added creator-aware search, creator filter options, and creator filtering.
- Wired the homepage to shared search helpers and added single-select creator filtering.
- Added compact creator attribution to exercise cards, video embeds, and exercise detail pages.
- Replaced single-creator site copy with neutral multi-creator, unofficial fan directory wording.

## Files Touched

- `src/lib/search.ts`
- `src/app/page.tsx`
- `src/app/layout.tsx`
- `src/app/exercise/[id]/page.tsx`
- `src/components/FilterPanel.tsx`
- `src/components/ExerciseCard.tsx`
- `src/components/VideoEmbed.tsx`
- `README.md`
- `docs/superpowers/handoffs/task-02-creator-ui.md`

## Implementation Notes

- Creator data remains derived from `exercise.videos`; no group-level creator data was added.
- `getExerciseCreators` deduplicates creators per exercise by `creator.id` and sorts by `display_name`.
- `getFilterOptions` now returns `creators`, derived from all videos and sorted by `display_name`.
- Fuse search keys now include `videos.creator.display_name` and `videos.creator.handle`.
- `filterExercises` accepts a `creator` id filter and matches any video on the exercise.
- Homepage uses `createSearchIndex` and `searchExercises` from `src/lib/search.ts` instead of duplicating Fuse configuration.
- Filter chips now include `aria-pressed`; collapsible controls include `aria-expanded`.
- The filter panel clear action is now a separate button, not an interactive span inside another button.
- `ExerciseCard` shows one creator display name or `N creators` without adding nested links inside the card link.
- `VideoEmbed` shows creator display name and handle with a profile link next to the source badge.
- The detail sidebar lists deduplicated creator profile links.

## Review Findings And Resolutions

- Finding: The exercise detail sidebar prepended `@` unconditionally, which would render handles already stored with `@` as `@@handle`.
  Resolution: Added detail-page handle normalization matching `VideoEmbed`; handles now render with exactly one leading `@`.
- Finding: The header still linked to creator-specific Instagram and TikTok profiles, which was misleading for a multi-creator directory and left mobile icon-only links without accessible names.
  Resolution: Removed the creator-specific header buttons. The header now stays neutral with the directory logo link, and footer attribution remains neutral.

## Verification

```bash
node --experimental-strip-types --input-type=module <<'EOF'
import { getFilterOptions, filterExercises, createSearchIndex, searchExercises } from './src/lib/search.ts';
const exercises = [
  { id: 'one', exercise_name: 'Hammer Curl', category: 'upper_body', muscle_groups: ['biceps'], equipment: ['dumbbell'], movement_type: 'isolation', coaching_cues: [], videos: [{ id: 'v1', url: 'https://example.com/1', source: 'tiktok', thumbnail: '', description: '', creator: { id: 'alpha', display_name: 'Alpha Coach', handle: 'alphaotf', profile_url: 'https://example.com/a' } }] },
  { id: 'two', exercise_name: 'Goblet Squat', category: 'lower_body', muscle_groups: ['quads'], equipment: ['dumbbell'], movement_type: 'compound', coaching_cues: [], videos: [{ id: 'v2', url: 'https://example.com/2', source: 'instagram', thumbnail: '', description: '', creator: { id: 'beta', display_name: 'Beta Coach', handle: 'betaotf', profile_url: 'https://example.com/b' } }] }
];
const options = getFilterOptions(exercises);
if (!Array.isArray(options.creators)) throw new Error('expected creator filter options');
if (options.creators.map((c) => c.id).join(',') !== 'alpha,beta') throw new Error('expected creators sorted by display name');
const filtered = filterExercises(exercises, { creator: 'beta' });
if (filtered.length !== 1 || filtered[0].id !== 'two') throw new Error('expected creator filter to match videos');
const fuse = createSearchIndex(exercises);
const searchByHandle = searchExercises(fuse, exercises, 'betaotf');
if (searchByHandle.length !== 1 || searchByHandle[0].id !== 'two') throw new Error('expected search to include creator handles');
console.log('creator search/filter behavior passed');
EOF
```

Outcome: passed after implementation. Before implementation, the same check failed with `expected creator filter options`.

```bash
./node_modules/.bin/tsc --noEmit
```

Outcome: passed with exit code 0.

```bash
NEXT_TELEMETRY_DISABLED=1 npm run build
```

Outcome: passed with exit code 0. Next.js 16.2.1 compiled successfully and generated 1,058 static pages.

```bash
npm run lint
```

Outcome: failed with exit code 1 from pre-existing issues:

- `scripts/fetch_instagram_posts.js`: three `@typescript-eslint/no-require-imports` errors.
- `src/components/TikTokEmbed.tsx`: `react-hooks/set-state-in-effect` error.
- Existing `@next/next/no-img-element` warnings in `src/components/ExerciseCard.tsx` and `src/components/InstagramEmbed.tsx`.

## Concerns

- Lint is not clean because of the pre-existing errors listed above. I left the existing image-rendering pattern in `ExerciseCard` unchanged aside from adding creator text.
- Current data has one unique creator, so the creator UI is ready for multiple creators but only displays one option until additional creator data lands.
