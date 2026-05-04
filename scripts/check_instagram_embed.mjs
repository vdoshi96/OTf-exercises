import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync(
  new URL("../src/components/InstagramEmbed.tsx", import.meta.url),
  "utf8",
);

assert.match(
  source,
  /from\s+["']next\/script["']/,
  "InstagramEmbed should load Instagram's official embed script with next/script.",
);
assert.match(
  source,
  /className="instagram-media"/,
  "InstagramEmbed should render Instagram's official blockquote target.",
);
assert.match(
  source,
  /data-instgrm-permalink=\{url\}/,
  "InstagramEmbed should pass the reel URL as the embed permalink.",
);
assert.match(
  source,
  /https:\/\/www\.instagram\.com\/embed\.js/,
  "InstagramEmbed should load Instagram embed.js.",
);
assert.doesNotMatch(
  source,
  /src=\{thumbnail\}/,
  "InstagramEmbed should not rely on expiring cdninstagram thumbnail URLs.",
);

console.log("Instagram preview uses official embed markup instead of expiring CDN thumbnails.");
