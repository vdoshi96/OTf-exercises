import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

// Static contract test for the Instagram preview component.
//
// History: an earlier fix used Instagram's official embed.js (the
// `<blockquote class="instagram-media" data-instgrm-permalink>` pattern), but
// embed.js renders Instagram's own "the link to this photo or video may be
// broken" UI for many of these reels. We now render a self-hosted thumbnail
// card that links out to Instagram, with a clean branded fallback when no
// thumbnail is available.

const source = readFileSync(
  new URL("../src/components/InstagramEmbed.tsx", import.meta.url),
  "utf8",
);

assert.doesNotMatch(
  source,
  /from\s+["']next\/script["']/,
  "InstagramEmbed should not load Instagram's embed.js — it renders a broken-link state for many reels.",
);
assert.doesNotMatch(
  source,
  /https:\/\/www\.instagram\.com\/embed\.js/,
  "InstagramEmbed should not load embed.js.",
);
assert.doesNotMatch(
  source,
  /className="instagram-media"/,
  "InstagramEmbed should not render Instagram's blockquote embed target.",
);

assert.match(
  source,
  /thumbnail\?:\s*string/,
  "InstagramEmbed should accept an optional self-hosted thumbnail prop.",
);
assert.match(
  source,
  /thumbnail\.startsWith\(["']\/thumbs\/["']\)/,
  "InstagramEmbed should only render the preview <img> for self-hosted /thumbs/ paths (cdninstagram URLs expire).",
);
assert.match(
  source,
  /Watch on Instagram/,
  "InstagramEmbed should always provide a clear 'Watch on Instagram' affordance.",
);
assert.match(
  source,
  /target="_blank"/,
  "InstagramEmbed should open the reel in a new tab.",
);

console.log(
  "Instagram preview renders self-hosted /thumbs/<sc>.jpg with a branded 'Watch on Instagram' fallback (no embed.js).",
);
