# UI Overhaul Design

**Goal:** Redesign the OTF Exercise Directory into a cleaner, more professional exercise reference site while preserving the existing search, filter, card, and detail-page behavior.

**Approved direction:** Use the premium editorial structure from the selected mockup, paired with a black Orangetheory studio-inspired palette and modestly increased orange coverage. The site should feel polished and trustworthy without becoming a generic fitness-app dashboard.

## Visual Thesis

The redesign is a premium black reference site with warm OTF-orange accents, editorial typography, restrained surfaces, and video-led exercise cards. Orange should appear with more confidence than the current UI, but remain an accent for hierarchy, active state, and energy rather than covering the whole page.

Use the existing Orangetheory logo asset from `public/otf-logo.svg`. Do not replace it with a drawn mark, abstract blob, or alternate brand treatment.

## Homepage Structure

The homepage should lead with a professional header, a large editorial hero, search, collapsible filters, and the exercise grid. Do not add a featured exercise module or hero-selected movement; the directory should feel like a neutral browsing surface, not a promoted workout feed.

Hero copy:

```text
Find the movement before class starts.
```

Supporting copy should position the site as a pre-class lookup tool for exercise demos and metadata. Avoid visible warning or note-style copy about phone use; the wording should simply avoid implying the site is meant to be used during class.

## Search and Filters

Search stays primary and always visible near the top of the browsing experience. Filters should be collapsed by default behind a clear "Filters" control, with active filter chips shown inline so users can understand current constraints without opening the panel.

When expanded, filters should keep the current capabilities:

- Category
- Muscle group
- Equipment
- Platform
- Creator

The expanded filter panel should feel lighter and more organized than the current collapsed accordion stack. It can open inline below search on desktop and mobile, but should not permanently occupy a left rail in the default state.

## Exercise Cards

Cards remain video-led and should use the current exercise data shape. Each card should make the thumbnail or placeholder the dominant element, then clearly show:

- Exercise name
- Category
- Video count when more than one video exists
- Creator summary
- Key muscle groups
- Equipment summary

Cards should feel more polished through stronger spacing, clearer type hierarchy, warmer orange accents, and better hover/focus states. Keep cards useful for scanning; do not hide important metadata behind decorative treatments.

## Detail Page

The detail page should preserve the current video-first layout with a metadata sidebar. The redesign should make the video area feel more intentional and the sidebar easier to scan.

The sidebar should continue to show:

- Movement type
- Muscle groups
- Equipment
- Creators
- Coaching cues when present

Video embeds should keep creator and platform attribution visible. The redesign should not change data contracts or embedded-video behavior unless the later implementation plan explicitly calls for it.

## Color and Typography

Use a black or near-black base with dark warm surfaces. Orange should appear in:

- Header accent line or active navigation state
- Hero emphasis
- Active filters and filter count states
- Card category/video badges
- Focus rings and hover affordances
- Detail-page section accents

Typography should move away from purely utilitarian app styling. Pair a strong editorial display treatment for hero/page titles with readable sans-serif UI text. If implementation uses `next/font`, keep the choice performant and avoid external font loading outside the Next.js font pipeline.

## Interaction and Accessibility

The redesign should include subtle, purposeful interaction polish:

- Card hover lift or thumbnail emphasis
- Clear keyboard focus rings using the orange accent
- Collapsible filter transition that does not shift context abruptly
- Mobile layout that keeps search first and filters easy to open

Maintain semantic structure with `header`, `main`, `section`, `nav`, `button`, and real links. Preserve WCAG AA contrast for text and controls, especially orange-on-dark combinations.

## Scope Boundaries

This design spec covers visual direction, layout structure, and interaction expectations. It does not require:

- Changing the exercise data model
- Adding featured exercises
- Replacing the existing logo asset
- Adding a new component library
- Changing scrape, thumbnail, or creator-ingestion pipelines
- Adding authentication, personalization, saved lists, or workout planning

## Implementation Notes

The implementation plan should likely touch:

- `src/app/layout.tsx` for header/footer and brand framing
- `src/app/page.tsx` for homepage structure and copy
- `src/app/exercise/[id]/page.tsx` for detail-page layout polish
- `src/components/SearchBar.tsx` for search presentation
- `src/components/FilterPanel.tsx` for collapsed/expanded filter behavior
- `src/components/ExerciseCard.tsx` and `src/components/ExerciseGrid.tsx` for card/grid polish
- `src/app/globals.css` for theme tokens and base styling

Keep the first implementation PR focused on visual/UI changes only. Data and thumbnail work should remain separate.

## Self-Review

- Placeholder scan: no placeholders or TBDs remain.
- Scope check: focused on UI overhaul design, not implementation or data pipeline changes.
- Ambiguity check: "more orange" is constrained to accent and active-state coverage, not an all-orange theme.
- Consistency check: the approved feedback is reflected: real logo, no featured exercise, collapsible filters, and "before class starts" hero copy.
