---
name: OTF exercise directory
description: A compact equipment reference with attributed demonstrations.
colors:
  background: "#fff"
  ink: "#242e32"
  muted: "#59656b"
  accent: "#b74113"
  accent-strong: "#94330f"
  accent-soft: "#fff1e9"
  line: "#dce2e3"
  soft: "#f2f5f5"
typography:
  body:
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
    fontSize: "16px"
    lineHeight: 1.65
  headline:
    fontSize: "38px"
    fontWeight: 720
    lineHeight: 1.13
    letterSpacing: "-0.03em"
  title:
    fontSize: "17px"
    fontWeight: 700
    lineHeight: 1.25
    letterSpacing: "-0.02em"
rounded:
  control: "7px"
  thumbnail: "10px"
  media: "12px"
spacing:
  compact: "12px"
  standard: "16px"
  section: "24px"
components:
  search-submit:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.background}"
    padding: "12px 20px"
  media-action:
    backgroundColor: "{colors.background}"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    padding: "12px 18px"
  demo-option-selected:
    backgroundColor: "{colors.accent-soft}"
    textColor: "{colors.ink}"
    rounded: "9px"
    padding: "11px 13px"
---

# Design system: OTF exercise directory

## Overview

**Creative North Star: "Compact equipment reference"**

Movement names and search lead; reviewed imagery supports recognition. The interface uses white, cool gray, charcoal, and restrained orange. The existing logo and unofficial fan identity remain visible.

**Key Characteristics:**

- Compact, readable catalog entries with visible creator attribution.
- Flat sections separated by fine rules and tonal backgrounds.
- One selected demonstration with explicit platform actions.

## Colors

The frontmatter records shared primitives from `src/app/globals.css`. Accent orange identifies links, selected filters, and source actions. The stronger accent supports source-link hover; the pale accent marks selected surfaces. The active navigation underline uses bright orange (`#eb5b23`).

White is the page and control surface. Charcoal carries headings, main text, and search submission. Muted slate carries metadata. Cool gray groups directory introductions and search; fine gray separators divide entries and reading sections.

**The restrained accent rule.** Reserve orange for identity and interactive state; keep reading surfaces neutral.

## Typography

Use the system sans-serif stack for headings and body text, as approved for this operational reference. Directory and detail headings use the headline token; phone headings reduce to 30px. Catalog titles use the title token, reducing to 16px with 1.35 line height on phones. Coaching titles and reading section headings use 20px.

Supporting text ranges from 12px to 14px; phone result credits use 11px. Reading paragraphs use 1.85 line height. Detail introductions stay within 75 characters of measure. Allow long movement names and creator handles to wrap.

## Layout

The shared container has a 1280px maximum width and 40px gutters. At 1000px and narrower, gutters reduce to 28px; at 650px and narrower, they reduce to 20px. At 1500px and wider, the maximum grows to 1360px.

Desktop directories pair a 202px filter rail with three result columns and a 36px gap. Intermediate widths use a 180px rail and two columns. Coaching uses image-and-text rows for longer titles. At 650px and narrower, both directories use a single list with a 102px thumbnail column and a 16px text gap. Filters move into a bottom modal with expandable groups and full multi-select controls.

Details pair media and context in a 1.1:1 grid, then stack on phones. The media stage is 450px tall, 410px at intermediate widths, 370px on phones, and 490px on wide screens. Reading and recovery use narrow single columns with separators. Navigation wraps to its own row on phones.

## Elevation & Depth

Sections and catalog entries remain flat. Tonal backgrounds, white space, and thin separators establish hierarchy. The white action over media uses a restrained shadow (`0 4px 20px #0002`) for legibility. The mobile filter modal uses a dark translucent, blurred backdrop. Do not generalize either treatment to ordinary cards.

## Shapes

Use gently rounded controls and clipped media. Search and desktop thumbnails use the thumbnail radius; phone thumbnails use the control radius. The media stage uses the media radius. Demonstration choices use 9px corners, and the bottom modal rounds its upper corners. Reading sections and navigation remain square and unboxed.

## Components

### Search and buttons

Search combines a white bordered field and charcoal submit action in one rounded control. It is at least 58px tall on desktop and 52px on phones. Focus within the search control uses an orange outline. The submit action darkens on hover. Recovery forms stack on phones.

### Filters and chips

Desktop filter choices use compact rows with a square selection marker. Phone choices use bordered controls in expandable groups. Selected choices combine orange, a visible mark, and `aria-pressed`; active-filter chips provide individual removal. The native modal contains keyboard focus and restores focus when closed. Its action area stays separate from the scrolling choices.

### Catalog entries

Desktop exercise entries place name and equipment before imagery, followed by creator and platform metadata. Phone entries place imagery beside that text. Separators define each entry; there is no enclosing card border or shadow. Titles turn orange on hover. Preserve reviewed thumbnails and their source content.

### Navigation

The logo, directory identity, and unofficial status share the header. Exercises and Coaching use text links. Active navigation combines orange text, an underline, and `aria-current`. Phone navigation has 44px minimum height.

### Demonstrations

Show one media stage with an explicit platform action and adjacent creator credit. TikTok requires activation and retains a separate original-source link; Instagram opens the source post. Multiple demonstrations use numbered creator choices with a selected outline, pale orange fill, and SVG check. Each selection retains its platform, attribution, and caption. No-JavaScript source links keep every demonstration reachable.

**The attribution rule.** Keep source and creator context with each demonstration, including alternate selections and fallback states.

### Interaction states

Use visible keyboard outlines and textual or marked selection states. Phone filter controls and modal actions provide generous touch targets; desktop filter rows remain compact. Accordion and modal movement is brief. Reduced-motion preferences disable animations, transitions, and smooth scrolling.

## Do's and Don'ts

- **Do** preserve reviewed imagery, creator credit, and source links.
- **Do** let long names wrap without hiding equipment or attribution.
- **Do** pair selected color with a visible indicator and accessible state.
- **Do** preserve the system sans-serif typography approved for this reference.
- **Don't** wrap every section in a card or add decorative surface gradients.
- **Don't** replace source demonstrations with invented assets or advice.
- **Don't** simplify the full filter set or change query behavior to match a visual prototype.
