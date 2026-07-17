import { readFile } from "node:fs/promises";
import { chromium, webkit } from "playwright";

const baseURL = process.env.BASE_URL ?? "http://localhost:3000";
const fallbackThumbnail = "/thumbs/fallback-exercise.jpg";
const pageSize = 24;
const exercises = JSON.parse(
  await readFile(new URL("../src/data/exercises.json", import.meta.url), "utf8")
);
const fallbackExercise = exercises.find((exercise) =>
  exercise.videos.some((video) => video.thumbnail === fallbackThumbnail)
);
const tiktokExercise = exercises.find(
  (exercise) =>
    exercise.videos.length === 1 &&
    exercise.videos[0].source === "tiktok" &&
    exercise.videos[0].thumbnail?.startsWith("/thumbs/") &&
    exercise.videos[0].thumbnail !== fallbackThumbnail
);
const upperBodyCount = exercises.filter(
  (exercise) => exercise.category === "upper_body"
).length;

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function assertCatalogFixtures() {
  assert(exercises.length > pageSize * 2, "Catalog needs more than 48 groups.");
  assert(fallbackExercise, "Catalog needs a durable fallback-thumbnail fixture.");
  assert(tiktokExercise, "Catalog needs a local-thumbnail TikTok fixture.");
}

async function expectVisible(locator, message) {
  try {
    await locator.waitFor({ state: "visible", timeout: 10_000 });
  } catch (error) {
    throw new Error(`${message}\n${error.message}`);
  }
}

async function expectHidden(locator, message) {
  try {
    await locator.waitFor({ state: "hidden", timeout: 10_000 });
  } catch (error) {
    throw new Error(`${message}\n${error.message}`);
  }
}

async function expectCardCount(page, expected, label) {
  try {
    await page.waitForFunction(
      (count) =>
        [...document.querySelectorAll("[data-testid='exercise-card']")].filter(
          (card) => card.getClientRects().length > 0
        ).length === count,
      expected,
      { timeout: 10_000 }
    );
  } catch {
    const actual = await page
      .locator("[data-testid='exercise-card']")
      .evaluateAll(
        (cards) => cards.filter((card) => card.getClientRects().length > 0).length
      );
    throw new Error(`${label}: expected ${expected} cards, found ${actual}.`);
  }
}

async function loadMore(page, expected) {
  const button = page.getByRole("button", { name: /^Load \d+ more$/ });
  await expectVisible(button, "A load-more control should be available.");
  await button.click();
  await expectCardCount(page, expected, "Load more should append one page");
}

async function searchAndExpectReset(page, query) {
  await page.getByRole("searchbox", { name: "Search exercises" }).fill(query);
  await expectCardCount(
    page,
    pageSize,
    "Changing search should reset pagination"
  );
}

async function clearSearch(page) {
  const clear = page.getByRole("button", { name: "Clear search" });
  await expectVisible(clear, "Filled search should expose a clear control.");
  await clear.click();
  await expectCardCount(page, pageSize, "Clearing search should reset results");
}

async function assertNoHorizontalOverflow(page, label) {
  const dimensions = await page.evaluate(() => ({
    body: document.body.scrollWidth,
    document: document.documentElement.scrollWidth,
    viewport: document.documentElement.clientWidth,
  }));
  const widest = Math.max(dimensions.body, dimensions.document);
  assert(
    widest <= dimensions.viewport + 1,
    `${label}: horizontal overflow is ${widest}px in a ${dimensions.viewport}px viewport.`
  );
}

async function assertTouchTarget(locator, label, checkWidth = false) {
  await expectVisible(locator, `${label} should be visible.`);
  const box = await locator.boundingBox();
  assert(box, `${label} should have a measurable touch target.`);
  assert(box.height >= 44, `${label} is only ${box.height}px tall; expected 44px.`);
  if (checkWidth) {
    assert(box.width >= 44, `${label} is only ${box.width}px wide; expected 44px.`);
  }
}

async function assertLoadedImage(locator, label) {
  await expectVisible(locator, `${label} should be visible.`);
  const loaded = await locator.evaluate(
    (image) =>
      new Promise((resolve) => {
        if (image.complete) {
          resolve(image.naturalWidth > 0 && image.naturalHeight > 0);
          return;
        }

        const timeout = window.setTimeout(() => resolve(false), 10_000);
        image.addEventListener(
          "load",
          () => {
            window.clearTimeout(timeout);
            resolve(image.naturalWidth > 0 && image.naturalHeight > 0);
          },
          { once: true }
        );
        image.addEventListener(
          "error",
          () => {
            window.clearTimeout(timeout);
            resolve(false);
          },
          { once: true }
        );
      })
  );
  assert(loaded, `${label} should decode into a non-empty image.`);
}

function monitorPage(page, label) {
  const failures = [];
  const localOrigin = new URL(baseURL).origin;

  page.on("console", (message) => {
    if (message.type() === "error") {
      failures.push(`console: ${message.text()}`);
    }
  });
  page.on("pageerror", (error) => failures.push(`page: ${error.message}`));
  page.on("requestfailed", (request) => {
    const reason = request.failure()?.errorText ?? "unknown failure";
    if (!/abort|cancel/i.test(reason)) {
      failures.push(`request: ${request.method()} ${request.url()} (${reason})`);
    }
  });
  page.on("response", (response) => {
    if (response.status() < 400) return;
    try {
      if (new URL(response.url()).origin === localOrigin) {
        failures.push(`response: ${response.status()} ${response.url()}`);
      }
    } catch {
      failures.push(`response: ${response.status()} ${response.url()}`);
    }
  });

  return async () => {
    const overlayCount = await page
      .locator(
        "[data-nextjs-dialog], #webpack-dev-server-client-overlay, .vite-error-overlay"
      )
      .count();
    if (overlayCount > 0) failures.push("runtime error overlay is present");
    assert(
      failures.length === 0,
      `${label} emitted browser failures:\n${failures.join("\n")}`
    );
  };
}

async function createPage(browser, options, label) {
  const context = await browser.newContext(options);
  await context.route("https://www.tiktok.com/player/v1/**", (route) =>
    route.fulfill({
      status: 200,
      contentType: "text/html",
      body: "<!doctype html><html><body>Mock TikTok player</body></html>",
    })
  );
  const page = await context.newPage();
  page.setDefaultTimeout(10_000);
  page.setDefaultNavigationTimeout(30_000);
  const assertClean = monitorPage(page, label);
  return { context, page, assertClean };
}

async function gotoDirectory(page, expectedCards = pageSize) {
  await page.goto(baseURL, { waitUntil: "networkidle" });
  await expectVisible(
    page.getByRole("heading", {
      name: "Find the movement before class starts.",
    }),
    "Directory hero should render."
  );
  await expectVisible(
    page.getByRole("searchbox", { name: "Search exercises" }),
    "Directory search should render."
  );
  await expectCardCount(
    page,
    expectedCards,
    `Directory should start with ${expectedCards} visible results`
  );
}

async function assertDetailOrder(page, exerciseName) {
  await expectVisible(
    page.getByRole("heading", { name: exerciseName, level: 1 }),
    "Card navigation should open the matching detail page."
  );
  const videoLibrary = page.locator(
    "section[aria-labelledby='video-library-heading']"
  );
  const metadata = page.getByLabel("Exercise metadata");
  await expectVisible(videoLibrary, "Detail should expose its video library.");
  await expectVisible(metadata, "Detail should expose secondary metadata.");
  const libraryBeforeMetadata = await videoLibrary.evaluate(
    (library, aside) =>
      Boolean(
        library.compareDocumentPosition(aside) & Node.DOCUMENT_POSITION_FOLLOWING
      ),
    await metadata.elementHandle()
  );
  assert(
    libraryBeforeMetadata,
    "Video library should precede secondary detail metadata in DOM order."
  );
  const [libraryBox, metadataBox] = await Promise.all([
    videoLibrary.boundingBox(),
    metadata.boundingBox(),
  ]);
  assert(libraryBox && metadataBox, "Detail sections should have layout boxes.");
  assert(
    libraryBox.y < metadataBox.y,
    "Video library should appear above metadata on mobile."
  );
}

async function navigateFirstCard(page) {
  const card = page.locator("[data-testid='exercise-card']").first();
  const name = (await card.getByRole("heading", { level: 3 }).innerText()).trim();
  const href = await card.getAttribute("href");
  assert(href?.startsWith("/exercise/"), "A result card should link to detail.");
  await Promise.all([
    page.waitForURL((url) => url.pathname === href),
    card.click(),
  ]);
  return name;
}

async function assertSitemap(page) {
  const response = await page.request.get(`${baseURL}/sitemap.xml`);
  assert(response.ok(), `Sitemap returned HTTP ${response.status()}.`);
  const xml = await response.text();
  const urlCount = xml.match(/<url>/g)?.length ?? 0;
  assert(
    urlCount === exercises.length + 1,
    `Sitemap has ${urlCount} URLs; expected ${exercises.length + 1}.`
  );
}

async function openMobileFilters(page) {
  const trigger = page.locator(
    "button[aria-controls='mobile-exercise-filters']"
  );
  await expectVisible(trigger, "Mobile filter trigger should be visible.");
  await trigger.click();
  const dialog = page.getByRole("dialog", { name: "Filters" });
  await expectVisible(dialog, "Mobile filters should open as a native dialog.");
  const state = await dialog.evaluate((node) => ({
    open: node.open,
    focusContained: node.contains(document.activeElement),
  }));
  assert(state.open, "Mobile filters should use an open native dialog.");
  assert(state.focusContained, "Opening filters should move focus into the dialog.");
  return { dialog, trigger };
}

async function assertMobileDialog(page, { selectFilter = true } = {}) {
  const { dialog, trigger } = await openMobileFilters(page);
  const close = dialog.getByRole("button", { name: "Close filters" });
  const clear = dialog.getByRole("button", { name: "Clear", exact: true });
  const showResults = dialog.getByRole("button", {
    name: /^Show [\d,]+ results?$/,
  });
  await assertTouchTarget(close, "Dialog close button", true);
  await assertTouchTarget(clear, "Dialog clear action");
  await assertTouchTarget(showResults, "Dialog show-results action");

  if (selectFilter) {
    await dialog.locator("summary").filter({ hasText: "Category" }).click();
    const upperBody = dialog.getByRole("button", {
      name: "Upper Body",
      exact: true,
    });
    await assertTouchTarget(upperBody, "Mobile filter chip");
    await upperBody.click();
    await expectVisible(
      clear,
      "Clear and show actions should remain visible with an accordion open."
    );
    await showResults.click();
    await expectHidden(dialog, "Show-results should close the filter dialog.");
    await expectCardCount(
      page,
      pageSize,
      "Changing a filter should reset pagination"
    );
    await expectVisible(
      page.getByLabel("Active filters").getByText("Upper Body", { exact: true }),
      "Selected filters should remain visible outside the sheet."
    );
    assert(
      /\b1\b/.test(await trigger.innerText()),
      "Mobile filter trigger should show the active-filter count."
    );
  } else {
    await page.keyboard.press("Escape");
    await expectHidden(dialog, "Escape should close the native dialog.");
    await page.waitForFunction(
      () =>
        document.activeElement?.getAttribute("aria-controls") ===
        "mobile-exercise-filters"
    );
    assert(
      await trigger.evaluate((element) => document.activeElement === element),
      "Closing filters should restore focus to the trigger."
    );
  }
}

async function assertTikTokBehavior(page, playerRequests) {
  const video = tiktokExercise.videos[0];
  await page.goto(`${baseURL}/exercise/${tiktokExercise.id}`, {
    waitUntil: "networkidle",
  });
  const play = page.getByRole("button", {
    name: `Play ${tiktokExercise.exercise_name} on TikTok`,
  });
  await expectVisible(play, "TikTok should initially render a local preview.");
  const preview = play.locator("img[alt$='TikTok preview']");
  await assertLoadedImage(preview, "Exact local TikTok thumbnail");
  assert(
    !(await preview.getAttribute("src"))?.includes("fallback-exercise"),
    "Exact thumbnail fixture should not render the fallback image."
  );
  assert(
    (await page.locator("iframe[src*='tiktok.com/player/v1/']").count()) === 0,
    "TikTok iframe should not exist before activation."
  );
  await page.waitForTimeout(250);
  assert(
    playerRequests.length === 0,
    "TikTok player should make no request before activation."
  );

  const playerRequest = page.waitForRequest((request) =>
    request.url().includes(`/player/v1/${video.id}`)
  );
  await play.click();
  await playerRequest;
  const iframe = page.locator(
    `iframe[src*='tiktok.com/player/v1/${video.id}']`
  );
  await expectVisible(iframe, "Activation should insert the TikTok player iframe.");
  await page.waitForFunction(
    (id) =>
      document.activeElement?.matches(
        `iframe[src*='tiktok.com/player/v1/${id}']`
      ),
    video.id
  );
  assert(
    await iframe.evaluate((element) => document.activeElement === element),
    "TikTok iframe should receive focus when it replaces the play button."
  );
  assert(playerRequests.length === 1, "Activation should request one TikTok player.");
  const [frameBox, wrapperBox] = await Promise.all([
    iframe.boundingBox(),
    iframe.locator("xpath=..").boundingBox(),
  ]);
  assert(frameBox && wrapperBox, "TikTok player should have responsive layout boxes.");
  assert(
    Math.abs(frameBox.width - wrapperBox.width) <= 1 &&
      Math.abs(frameBox.height - wrapperBox.height) <= 1,
    "TikTok iframe should fill its responsive wrapper."
  );
  const viewport = page.viewportSize();
  assert(viewport, "TikTok test needs a fixed viewport.");
  assert(
    frameBox.x >= -1 && frameBox.x + frameBox.width <= viewport.width + 1,
    "TikTok iframe should not clip outside the mobile viewport."
  );
  const external = page.getByRole("link", {
    name: "Open original on TikTok",
  });
  await expectVisible(external, "TikTok should retain an external fallback link.");
  assert(
    new URL(await external.getAttribute("href")).toString() ===
      new URL(video.url).toString(),
    "External TikTok link should point to the original post."
  );
  assert(
    (await external.getAttribute("target")) === "_blank",
    "External TikTok link should open separately."
  );
}

async function assertFallbackThumbnail(page) {
  await page.goto(`${baseURL}/exercise/${fallbackExercise.id}`, {
    waitUntil: "networkidle",
  });
  const fallback = page.locator("img[src*='fallback-exercise.jpg']").first();
  await assertLoadedImage(fallback, "Durable local fallback thumbnail");
  assert(
    (await fallback.getAttribute("src"))?.includes("fallback-exercise.jpg"),
    "Unavailable media should keep a durable local fallback reference."
  );
}

async function runDesktopChromium(browser) {
  const label = "Chromium desktop 1280x900";
  const { context, page, assertClean } = await createPage(
    browser,
    { viewport: { width: 1280, height: 900 } },
    label
  );
  try {
    await gotoDirectory(page, exercises.length);
    await assertNoHorizontalOverflow(page, label);
    await expectHidden(
      page.getByRole("button", { name: /^Load \d+ more$/ }),
      "Desktop should render the full catalog without load-more pagination."
    );

    const filters = page.locator(
      "button[aria-controls='desktop-exercise-filters']"
    );
    await expectVisible(filters, "Desktop filter trigger should be visible.");
    await filters.click();
    const upperBody = page
      .locator("#desktop-exercise-filters")
      .getByRole("button", { name: "Upper Body", exact: true });
    await expectVisible(upperBody, "Desktop category filter should expand.");
    await upperBody.click();
    await expectCardCount(
      page,
      upperBodyCount,
      "Desktop should render every matching filtered result"
    );
    await expectHidden(
      page.getByRole("button", { name: /^Load \d+ more$/ }),
      "Desktop filters should not introduce load-more pagination."
    );
    await expectVisible(
      page.getByLabel("Active filters").getByText("Upper Body", { exact: true }),
      "Desktop should expose its active filter."
    );

    const detailName = await navigateFirstCard(page);
    await expectVisible(
      page.getByRole("heading", { name: detailName, level: 1 }),
      "Desktop card should navigate to its detail page."
    );
    await expectVisible(
      page.getByRole("heading", { name: "Video library" }),
      "Desktop detail should expose the video library."
    );
    await assertSitemap(page);
    await assertClean();
    console.log(`PASS ${label}`);
  } finally {
    await context.close();
  }
}

async function runMobileChromium390(browser) {
  const label = "Chromium mobile 390x844";
  const { context, page, assertClean } = await createPage(
    browser,
    {
      viewport: { width: 390, height: 844 },
      isMobile: true,
      hasTouch: true,
    },
    label
  );
  const playerRequests = [];
  page.on("request", (request) => {
    if (request.url().includes("https://www.tiktok.com/player/v1/")) {
      playerRequests.push(request.url());
    }
  });
  try {
    await gotoDirectory(page);
    await assertNoHorizontalOverflow(page, label);
    await loadMore(page, pageSize * 2);
    await searchAndExpectReset(page, "squat");
    await clearSearch(page);
    await loadMore(page, pageSize * 2);
    await assertMobileDialog(page, { selectFilter: true });
    await assertNoHorizontalOverflow(page, `${label} filtered directory`);

    const detailName = await navigateFirstCard(page);
    await assertDetailOrder(page, detailName);
    await assertTikTokBehavior(page, playerRequests);
    await assertNoHorizontalOverflow(page, `${label} active TikTok detail`);
    await assertFallbackThumbnail(page);
    await assertClean();
    console.log(`PASS ${label}`);
  } finally {
    await context.close();
  }
}

async function runMobileChromium320(browser) {
  const label = "Chromium mobile 320x844";
  const { context, page, assertClean } = await createPage(
    browser,
    {
      viewport: { width: 320, height: 844 },
      isMobile: true,
      hasTouch: true,
    },
    label
  );
  try {
    await gotoDirectory(page);
    await assertNoHorizontalOverflow(page, `${label} directory`);
    const { dialog } = await openMobileFilters(page);
    await assertNoHorizontalOverflow(page, `${label} filter dialog`);
    const dialogBox = await dialog.boundingBox();
    assert(dialogBox, "320px filter dialog should have a layout box.");
    assert(
      dialogBox.x >= -1 && dialogBox.x + dialogBox.width <= 321,
      "Filter dialog should fit inside the 320px viewport."
    );
    await page.keyboard.press("Escape");
    await expectHidden(dialog, "Escape should close filters at 320px.");
    await page.waitForFunction(
      () =>
        document.activeElement?.getAttribute("aria-controls") ===
        "mobile-exercise-filters"
    );
    await page.goto(`${baseURL}/exercise/${tiktokExercise.id}`, {
      waitUntil: "networkidle",
    });
    await assertNoHorizontalOverflow(page, `${label} detail`);
    assert(
      (await page.locator("iframe[src*='tiktok.com/player/v1/']").count()) === 0,
      "320px detail should retain the lazy TikTok preview."
    );
    await assertClean();
    console.log(`PASS ${label}`);
  } finally {
    await context.close();
  }
}

async function runMobileWebKit390(browser) {
  const label = "WebKit mobile 390x844";
  const { context, page, assertClean } = await createPage(
    browser,
    {
      viewport: { width: 390, height: 844 },
      isMobile: true,
      hasTouch: true,
    },
    label
  );
  try {
    await gotoDirectory(page);
    await assertNoHorizontalOverflow(page, label);
    await loadMore(page, pageSize * 2);
    await searchAndExpectReset(page, "squat");
    await clearSearch(page);
    await assertMobileDialog(page, { selectFilter: false });
    const detailName = await navigateFirstCard(page);
    await assertDetailOrder(page, detailName);
    await assertNoHorizontalOverflow(page, `${label} detail`);
    await assertClean();
    console.log(`PASS ${label}`);
  } finally {
    await context.close();
  }
}

async function run() {
  assertCatalogFixtures();

  const chromiumBrowser = await chromium.launch({ headless: true });
  try {
    await runDesktopChromium(chromiumBrowser);
    await runMobileChromium390(chromiumBrowser);
    await runMobileChromium320(chromiumBrowser);
  } finally {
    await chromiumBrowser.close();
  }

  const webkitBrowser = await webkit.launch({ headless: true });
  try {
    await runMobileWebKit390(webkitBrowser);
  } finally {
    await webkitBrowser.close();
  }

  console.log(
    `UI production smoke passed: ${exercises.length} exercise groups, ${
      exercises.length + 1
    } sitemap URLs.`
  );
}

run().catch((error) => {
  console.error(error.stack ?? error.message);
  process.exit(1);
});
