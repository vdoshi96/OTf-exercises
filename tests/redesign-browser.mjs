import assert from "node:assert/strict";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { chromium } from "playwright";
import { createRequire } from "node:module";
const axePath = createRequire(import.meta.url).resolve("axe-core/axe.min.js");
const baseURL = process.env.BASE_URL || "http://127.0.0.1:3013";
const output = process.env.QA_OUTPUT || "output/playwright/redesign";
const exercises = JSON.parse(await readFile("src/data/exercises.json", "utf8"));
const ledger = JSON.parse(
  await readFile("src/data/legacy-exercise-routes.json", "utf8"),
).routes;
const split = Object.keys(ledger).find((id) => ledger[id].outcome === "split");
const removed = Object.keys(ledger).find(
  (id) => ledger[id].outcome === "removed",
);
const multi = exercises.find(
  (item) =>
    item.videos.length > 1 &&
    new Set(item.videos.map((v) => v.source)).size > 1,
);
const single = exercises.find((item) => item.videos.length === 1);
const routes = [
  ["directory", "/"],
  ["exercise-detail", "/exercise/goblet-squat"],
  ["coaching", "/coaching"],
  ["coaching-detail", "/coaching/how-to-row-your-best-1000-meter-row"],
  ["privacy", "/privacy"],
  ["split", `/exercise/${split}`],
  ["removed", `/exercise/${removed}`],
  ["not-found", "/__redesign_missing__"],
];
await mkdir(output, { recursive: true });
const browser = await chromium.launch();
const results = [];
const accessibility = [];
async function checkAccessibility(page, name) {
  await page.addScriptTag({ path: axePath });
  const audit = await page.evaluate(
    async () =>
      await window.axe.run(document, {
        runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21aa"] },
      }),
  );
  accessibility.push({
    name,
    violations: audit.violations,
    incomplete: audit.incomplete.map((item) => item.id),
  });
  assert.deepEqual(
    audit.violations.map((item) => ({
      id: item.id,
      nodes: item.nodes.map((node) => node.target),
    })),
    [],
    `${name}: accessibility violations`,
  );
}

try {
  for (const width of [1280, 390, 320]) {
    const context = await browser.newContext({
      viewport: { width, height: 900 },
      reducedMotion: "reduce",
    });
    const page = await context.newPage();
    for (const [name, path] of routes) {
      const response = await page.goto(baseURL + path, {
        waitUntil: "networkidle",
      });
      assert.equal(response.status(), name === "not-found" ? 404 : 200);
      assert.equal(await page.locator("h1").count(), 1);
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth,
      );
      assert.equal(overflow, false, `${name} at ${width}px overflows`);
      await page.locator("img").evaluateAll((images) =>
        images.forEach((image) => {
          image.loading = "eager";
        }),
      );
      await page.waitForFunction(() =>
        [...document.images].every((image) => image.complete),
      );
      await page.screenshot({
        path: `${output}/${width}-${name}.png`,
        fullPage: true,
      });
      results.push({ width, name, status: response.status(), overflow });
      if (width === 390) await checkAccessibility(page, name);
    }
    await page.goto(`${baseURL}/exercise/${multi.id}`, {
      waitUntil: "networkidle",
    });
    const options = page.locator(".demo-option");
    assert.equal(await options.count(), multi.videos.length);
    assert.equal(await page.locator(".video-article").count(), 1);
    const second = multi.videos.findIndex(
      (v) => v.source !== multi.videos[0].source,
    );
    await options.nth(second).click();
    assert.equal(
      await options.nth(second).getAttribute("aria-pressed"),
      "true",
    );
    assert.equal(await page.locator(".video-article").count(), 1);
    assert.equal(
      await page
        .locator(".video-credit")
        .getByRole("link")
        .getAttribute("href"),
      multi.videos[second].creator.profile_url,
    );
    assert.equal(
      await page.locator("iframe").count(),
      0,
      "selection must not consent to third-party media",
    );
    await page.waitForFunction(() =>
      [...document.querySelectorAll(".video-article img")].every(
        (image) => image.complete && image.naturalWidth > 0,
      ),
    );
    if (width === 390) await checkAccessibility(page, "multiple-demos");
    await page.screenshot({
      path: `${output}/${width}-multiple-demos.png`,
      fullPage: true,
    });
    await page.goto(`${baseURL}/exercise/${single.id}`, {
      waitUntil: "networkidle",
    });
    assert.equal(await page.locator(".demo-selector").count(), 0);
    if (width === 390) {
      await page.goto(`${baseURL}/?q=squat&equipment=bodyweight`, {
        waitUntil: "networkidle",
      });
      const shortcuts = page.getByRole("navigation", {
        name: "Browse by equipment",
      });
      await shortcuts
        .getByRole("link", { name: "Dumbbells", exact: true })
        .click();
      await page.waitForFunction(() =>
        new URL(location.href).searchParams
          .getAll("equipment")
          .includes("dumbbell"),
      );
      assert.equal(new URL(page.url()).searchParams.get("q"), "squat");
      assert.ok(
        new URL(page.url()).searchParams
          .getAll("equipment")
          .includes("bodyweight"),
      );
      await page.goto(`${baseURL}/coaching?source=instagram`, {
        waitUntil: "networkidle",
      });
      await page
        .getByRole("navigation", { name: "Browse coaching topics" })
        .getByRole("link", { name: "Programming", exact: true })
        .click();
      await page.waitForFunction(
        () =>
          new URL(location.href).searchParams.get("topic") === "programming",
      );
      assert.equal(new URL(page.url()).searchParams.get("source"), "instagram");
      await page.goto(baseURL, { waitUntil: "networkidle" });
      await page.locator('[aria-controls="mobile-exercise-filters"]').click();
      await checkAccessibility(page, "filter-dialog");
      await page.screenshot({ path: `${output}/390-filters.png` });
      await page.keyboard.press("Escape");
      await page.route("**/api/directory*", (route) => route.abort());
      await page.getByRole("searchbox").fill("squat");
      await page
        .getByText("We couldn't update the directory. Try again.", {
          exact: true,
        })
        .waitFor();
      await checkAccessibility(page, "request-error");
      await page.screenshot({ path: `${output}/390-error.png` });
    }
    await context.close();
  }
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  await page.goto(`${baseURL}/exercise/${multi.id}`);
  for (const video of multi.videos)
    assert.ok(await page.locator(`noscript a[href="${video.url}"]`).count());
  await context.close();
  await writeFile(
    `${output}/results.json`,
    JSON.stringify(
      {
        baseURL,
        results,
        multipleVideoFixture: multi.id,
        singleVideoFixture: single.id,
        noJavaScriptSources: true,
        accessibility,
      },
      null,
      2,
    ),
  );
  console.log(
    `PASS redesign: ${results.length} screen/viewport checks, multiple-video selection at all widths, single-video selector omission, no-JavaScript source access.`,
  );
} finally {
  await browser.close();
}
