#!/usr/bin/env node
/**
 * Phase 2 only — visit each Instagram post to extract metadata.
 *
 * Reads shortcodes from ig_shortcodes.txt (already collected), visits each
 * post page in a Playwright browser, extracts caption/thumbnail/type from
 * the DOM, and writes results directly to raw_instagram_videos.json.
 *
 * The Playwright browser saves its session to .playwright-data/ so you only
 * need to log into Instagram once.
 *
 * Usage:
 *   node scripts/fetch_instagram_posts.js
 */

const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");

const PROJECT_DIR = path.join(__dirname, "..");
const SHORTCODES_FILE = path.join(PROJECT_DIR, "ig_shortcodes.txt");
const OUTPUT_FILE = path.join(PROJECT_DIR, "raw_instagram_videos.json");
const BROWSER_DATA = path.join(PROJECT_DIR, ".playwright-data");

function formatDate(ts) {
  if (!ts) return "";
  const d = new Date(ts * 1000);
  return (
    String(d.getFullYear()) +
    String(d.getMonth() + 1).padStart(2, "0") +
    String(d.getDate()).padStart(2, "0")
  );
}

function randomDelay(min = 600, max = 1500) {
  return Math.floor(Math.random() * (max - min) + min);
}

// ── Login check ────────────────────────────────────────────────────────

async function ensureLoggedIn(page) {
  await page.goto("https://www.instagram.com/coachingotf/", {
    waitUntil: "domcontentloaded",
    timeout: 30000,
  });
  await page.waitForTimeout(3000);

  const loggedIn = await page.evaluate(() => {
    if (document.querySelector('input[name="username"]')) return false;
    const btn = document.querySelector('button[type="submit"]');
    if (btn && /log\s*in/i.test(btn.textContent || "")) return false;
    if (document.querySelectorAll('a[href*="/p/"], a[href*="/reel/"]').length > 3) return true;
    if (document.querySelector('svg[aria-label="Home"]')) return true;
    return false;
  });

  if (loggedIn) {
    console.log("Logged into Instagram.\n");
    return;
  }

  console.log("\n┌──────────────────────────────────────────────────────┐");
  console.log("│ Please log into Instagram in the browser window.     │");
  console.log("│ The script will continue once you're logged in.      │");
  console.log("│ (Your session will be saved for future runs.)        │");
  console.log("└──────────────────────────────────────────────────────┘\n");

  for (let waited = 0; waited < 300000; waited += 3000) {
    await page.waitForTimeout(3000);
    const ok = await page.evaluate(() => {
      return (
        document.querySelectorAll('a[href*="/p/"], a[href*="/reel/"]').length > 3 ||
        !!document.querySelector('svg[aria-label="Home"]')
      );
    }).catch(() => false);

    if (ok) {
      console.log("Login detected. Continuing...\n");
      return;
    }
    if (waited > 0 && waited % 30000 === 0) {
      console.log(`  Still waiting... (${waited / 1000}s)`);
    }
  }
  throw new Error("Timed out waiting for login.");
}

// ── Extract data from a single post page ───────────────────────────────

async function extractPost(page, shortcode) {
  const url = `https://www.instagram.com/p/${shortcode}/`;
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 15000 });
  await page.waitForTimeout(randomDelay(1000, 2000));

  const data = await page.evaluate(() => {
    const meta = (prop) => {
      const el =
        document.querySelector(`meta[property="${prop}"]`) ||
        document.querySelector(`meta[name="${prop}"]`);
      return (el && el.getAttribute("content")) || "";
    };

    const ogDesc = meta("og:description");
    const ogImage = meta("og:image");
    const ogType = meta("og:type");
    const title = meta("og:title") || document.title || "";

    // Caption extraction — try multiple sources
    let caption = "";

    // 1) Try the main article spans (usually the caption)
    const spans = document.querySelectorAll("article span[dir='auto']");
    for (const s of spans) {
      const text = (s.textContent || "").trim();
      if (text.length > 20 && text.length > caption.length) {
        caption = text;
      }
    }

    // 2) Fall back to og:description (has "N Likes, N Comments - user: ...")
    if (!caption && ogDesc) {
      const m = ogDesc.match(
        /(?:\d[\d,.]*\s+likes?,\s*\d[\d,.]*\s+comments?\s*-\s*[^:]+:\s*["""]?)(.+)/i
      );
      if (m) caption = m[1].replace(/[""]$/, "").trim();
      else caption = ogDesc;
    }

    // 3) Check for page meta description
    if (!caption) {
      const desc = meta("description");
      if (desc) {
        const m2 = desc.match(/:\s*["""]?(.+)/);
        caption = m2 ? m2[1].replace(/[""]$/, "").trim() : desc;
      }
    }

    // Video detection
    const isVideo =
      ogType === "video" ||
      !!document.querySelector("video") ||
      /reel/i.test(window.location.href) ||
      /video/i.test(title);

    // Timestamp from <time datetime="...">
    let timestamp = 0;
    const timeEl = document.querySelector("time[datetime]");
    if (timeEl) {
      const dt = timeEl.getAttribute("datetime");
      if (dt) timestamp = Math.floor(new Date(dt).getTime() / 1000);
    }

    return { caption, isVideo, thumbnail: ogImage, timestamp };
  });

  return data;
}

// ── Main ───────────────────────────────────────────────────────────────

async function main() {
  if (!fs.existsSync(SHORTCODES_FILE)) {
    console.error(`Shortcodes file not found: ${SHORTCODES_FILE}`);
    process.exit(1);
  }

  const shortcodes = fs
    .readFileSync(SHORTCODES_FILE, "utf-8")
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);

  console.log(`=== Instagram Post Fetcher ===`);
  console.log(`Shortcodes to process: ${shortcodes.length}\n`);

  // Load any existing progress
  let results = [];
  const done = new Set();
  if (fs.existsSync(OUTPUT_FILE)) {
    try {
      const existing = JSON.parse(fs.readFileSync(OUTPUT_FILE, "utf-8"));
      if (Array.isArray(existing) && existing.length > 10) {
        results = existing;
        for (const r of results) {
          const sc = r.id?.replace("ig_", "") || "";
          if (sc) done.add(sc);
        }
        console.log(`Resuming: ${done.size} already done, ${shortcodes.length - done.size} remaining.\n`);
      }
    } catch {}
  }

  const context = await chromium.launchPersistentContext(BROWSER_DATA, {
    headless: false,
    viewport: { width: 1280, height: 900 },
    args: [
      "--disable-blink-features=AutomationControlled",
      "--no-first-run",
      "--no-default-browser-check",
    ],
  });

  const page = context.pages()[0] || (await context.newPage());

  await ensureLoggedIn(page);

  let processed = 0;
  let withCaption = 0;
  let errors = 0;

  for (const sc of shortcodes) {
    if (done.has(sc)) continue;

    try {
      const data = await extractPost(page, sc);
      const urlPath = data.isVideo ? "reel" : "p";

      results.push({
        id: `ig_${sc}`,
        url: `https://www.instagram.com/${urlPath}/${sc}/`,
        description: data.caption || "",
        thumbnail: data.thumbnail || "",
        duration: 0,
        timestamp: data.timestamp || 0,
        upload_date: formatDate(data.timestamp),
        source: "instagram",
        is_video: data.isVideo,
      });
      done.add(sc);
      processed++;
      if (data.caption) withCaption++;

      // Save every 25 posts
      if (processed % 25 === 0) {
        fs.writeFileSync(OUTPUT_FILE, JSON.stringify(results, null, 2));
        console.log(
          `  ${done.size}/${shortcodes.length} done (${withCaption} with captions, ${errors} errors)`
        );
      }
    } catch (err) {
      errors++;
      console.log(`  Error on ${sc}: ${err.message}`);

      if (errors > 20 && errors > processed * 0.5) {
        console.log("Too many errors. Stopping.");
        break;
      }

      // On rate limit or navigation error, wait longer
      await page.waitForTimeout(randomDelay(5000, 10000));
    }
  }

  // Final save
  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(results, null, 2));

  console.log(`\n=== Done ===`);
  console.log(`Total posts: ${results.length}`);
  console.log(`New this run: ${processed}`);
  console.log(`With captions: ${withCaption}`);
  console.log(`Errors: ${errors}`);
  console.log(`Saved to ${OUTPUT_FILE}`);

  await context.close();
}

main().catch((err) => {
  console.error("Fatal:", err.message);
  process.exit(1);
});
