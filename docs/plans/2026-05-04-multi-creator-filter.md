# Multi-Select Creator Filter & Creator Cleanup

> **Branch:** `feat/multi-creator-filter`
> **Base:** `main`

**Goal:** Change the creator filter from single-select to multi-select so users can filter by multiple creators at once. Remove all creators except Austin Hendrickson (Trainingtall) and Coach Rudy. Update Austin's display name to include his alias.

**Architecture:** Change `activeCreator: string | null` to `activeCreators: string[]` throughout the filter pipeline (page state, FilterPanel, search.ts). Remove exercises/videos from other creators in `exercises.json`. Update Austin's `display_name` to include "Trainingtall".

**Tech Stack:** React state, TypeScript types

---

## Current State

- 5 creators in data:
  - `coachingotf` — Coach Rudy (1747 videos)
  - `trainingtall` — Austin Hendrickson (206 videos)
  - `lustertraining` — Bryce Luster (15 videos)
  - `brookerooney` — SHE LIFTS (6 videos)
  - `coach.fajardo` — David Fajardo (6 videos)
- Creator filter is single-select: `activeCreator: string | null`
- FilterPanel uses `Chip` component with toggle behavior
- `filterExercises()` in `search.ts` checks `filters.creator` as a single string

## Task 1: Clean Up Creator Data

**Files:**
- Create: `scripts/cleanup-creators.mjs`
- Modify: `src/data/exercises.json`

- [ ] **Step 1: Write the cleanup script**

```javascript
// scripts/cleanup-creators.mjs
import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

const EXERCISES_PATH = join(process.cwd(), 'src/data/exercises.json');
const KEEP_CREATORS = new Set(['coachingotf', 'trainingtall']);

const exercises = JSON.parse(readFileSync(EXERCISES_PATH, 'utf-8'));

let removedVideos = 0;
let removedExercises = 0;

const cleaned = exercises
  .map((ex) => {
    const kept = ex.videos.filter((v) => KEEP_CREATORS.has(v.creator.id));
    removedVideos += ex.videos.length - kept.length;
    return { ...ex, videos: kept };
  })
  .filter((ex) => {
    if (ex.videos.length === 0) {
      removedExercises++;
      return false;
    }
    return true;
  });

// Update Austin's display_name
for (const ex of cleaned) {
  for (const v of ex.videos) {
    if (v.creator.id === 'trainingtall') {
      v.creator.display_name = 'Austin Hendrickson (Trainingtall)';
    }
  }
}

writeFileSync(EXERCISES_PATH, JSON.stringify(cleaned, null, 2) + '\n');

console.log(`Removed ${removedVideos} videos from non-kept creators`);
console.log(`Removed ${removedExercises} exercises with no remaining videos`);
console.log(`Remaining: ${cleaned.length} exercises`);
```

- [ ] **Step 2: Run the cleanup script**

Run: `node scripts/cleanup-creators.mjs`
Expected: Removes ~27 videos (15+6+6), possibly removes a few exercises that only had those creators.

- [ ] **Step 3: Verify cleanup**

Run: `node -e "const d=require('./src/data/exercises.json'); const c=new Set(); d.forEach(e=>e.videos.forEach(v=>c.add(v.creator.id))); console.log('Remaining creators:', [...c])"`
Expected: `Remaining creators: [ 'coachingotf', 'trainingtall' ]`

## Task 2: Change Creator Filter to Multi-Select

**Files:**
- Modify: `src/lib/search.ts` — change `creator` filter from single string to array
- Modify: `src/app/page.tsx` — change state from `string | null` to `string[]`
- Modify: `src/components/FilterPanel.tsx` — change props and chip toggle logic

- [ ] **Step 4: Update `filterExercises` in `search.ts`**

Change the `creator` filter parameter from `string | null` to `string[]` and update the filtering logic to match any of the selected creators.

```typescript
// In filterExercises, change:
//   creator?: string | null;
// To:
//   creators?: string[];

// And change filter logic from:
//   if (filters.creator && !ex.videos.some((v) => v.creator.id === filters.creator)) return false;
// To:
//   if (filters.creators?.length && !ex.videos.some((v) => filters.creators!.includes(v.creator.id))) return false;
```

- [ ] **Step 5: Update `page.tsx` state management**

```typescript
// Change:
//   const [activeCreator, setActiveCreator] = useState<string | null>(null);
// To:
//   const [activeCreators, setActiveCreators] = useState<string[]>([]);

// Update filterExercises call:
//   creator: activeCreator,
// To:
//   creators: activeCreators,

// Update toggle handler:
//   onCreatorChange={(id) => setActiveCreators(prev =>
//     prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id]
//   )}

// Update clear:
//   setActiveCreators([]) in clearFilters equivalent
```

- [ ] **Step 6: Update `FilterPanel.tsx` props and behavior**

Change from single-select to multi-select:
- `activeCreator: string | null` → `activeCreators: string[]`
- `onCreatorChange: (creator: string | null) => void` → `onCreatorChange: (creatorId: string) => void`
- Chip `active` check: `activeCreator === creator.id` → `activeCreators.includes(creator.id)`
- Active count: `activeCreator ? 1 : 0` → `activeCreators.length`
- Filter count calculation updated

- [ ] **Step 7: Build and verify**

Run: `npm run build`
Expected: Build succeeds with 0 TypeScript errors

- [ ] **Step 8: Visual verification**

Run: `npm run dev`
Open browser, check that:
1. Only Austin Hendrickson (Trainingtall) and Coach Rudy appear as creator filter options
2. Both can be selected simultaneously (multi-select)
3. Clicking a selected creator deselects it
4. "Clear all" resets creator selection
5. Filter count badge shows correct number
6. Exercise grid properly filters when creators are selected

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "feat: multi-select creator filter, remove non-primary creators"
```

## Verification Checklist

- [ ] Only 2 creators in data: Coach Rudy, Austin Hendrickson (Trainingtall)
- [ ] Austin's display name shows "Austin Hendrickson (Trainingtall)"
- [ ] Creator filter supports selecting multiple creators
- [ ] Filter works correctly (AND with other filters, OR between selected creators)
- [ ] Active filter count is correct
- [ ] Clear all works
- [ ] `npm run build` succeeds
- [ ] Visual check in browser passes
