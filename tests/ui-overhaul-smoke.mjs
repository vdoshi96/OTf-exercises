import { readFile } from "node:fs/promises";
import { chromium, webkit } from "playwright";

const baseURL = process.env.BASE_URL ?? "http://localhost:3000";
const fallbackThumbnail = "/thumbs/fallback-exercise.jpg";
const pageSize = 24;
const exercises = JSON.parse(
  await readFile(new URL("../src/data/exercises.json", import.meta.url), "utf8")
);
const coachingResources = await readFile(
  new URL("../src/data/coaching.json", import.meta.url),
  "utf8"
)
  .then(JSON.parse)
  .catch((error) => {
    if (error?.code === "ENOENT") return [];
    throw error;
  });
const legacyRouteLedger = JSON.parse(
  await readFile(
    new URL("../src/data/legacy-exercise-routes.json", import.meta.url),
    "utf8"
  )
);
const legacyRouteEntries = Object.entries(legacyRouteLedger.routes);
const legacyRedirectRoute = legacyRouteEntries.find(
  ([, route]) =>
    route.outcome === "redirect" && route.targets[0]?.kind === "exercise"
);
const legacySplitRoute = legacyRouteEntries.find(
  ([, route]) => route.outcome === "split"
);
const legacyRemovedRoute = legacyRouteEntries.find(
  ([, route]) => route.outcome === "removed"
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
const instagramExercise = exercises.find((exercise) =>
  exercise.videos.some((video) => video.source === "instagram")
);
const longestTitleExercise = exercises.reduce((longest, exercise) =>
  exercise.exercise_name.length > longest.exercise_name.length
    ? exercise
    : longest
);
const missingPath = "/__ui_smoke_missing__";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function assertCatalogFixtures() {
  assert(exercises.length > pageSize * 2, "Catalog needs more than 48 groups.");
  assert(fallbackExercise, "Catalog needs a durable fallback-thumbnail fixture.");
  assert(tiktokExercise, "Catalog needs a local-thumbnail TikTok fixture.");
  assert(instagramExercise, "Catalog needs an Instagram fixture.");
  assert(longestTitleExercise, "Catalog needs a longest-title fixture.");
  assert(coachingResources.length > 0, "Catalog needs a coaching fixture.");
  assert(legacyRedirectRoute, "Legacy ledger needs an exercise redirect fixture.");
  assert(legacySplitRoute, "Legacy ledger needs a split-recovery fixture.");
  assert(legacyRemovedRoute, "Legacy ledger needs a removed-recovery fixture.");
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

async function waitForDirectoryIdle(page) {
  await page.waitForFunction(
    () => document.querySelector("#directory")?.getAttribute("aria-busy") !== "true"
  );
}

async function loadMore(page, expected) {
  const control = page
    .getByRole("button", { name: /^Load \d+ more$/ })
    .or(page.getByRole("link", { name: /^Load \d+ more$/ }))
    .first();
  await expectVisible(control, "A load-more control should be available.");
  await control.click();
  await waitForDirectoryIdle(page);
  await expectCardCount(page, expected, "Load more should append one page");
}

async function searchAndExpectReset(page, query) {
  const expectedResponse = await page.request.get(
    `${baseURL}/api/directory?section=exercise&q=${encodeURIComponent(query)}`
  );
  assert(
    expectedResponse.ok(),
    `Search fixture ${query} returned HTTP ${expectedResponse.status()}.`
  );
  const expectedPayload = await expectedResponse.json();
  const expectedCount = Math.min(pageSize, expectedPayload.total);
  assert(expectedCount > 0, `Search fixture ${query} should return results.`);
  await page.getByRole("searchbox", { name: "Search exercises" }).fill(query);
  await page.waitForURL((url) => url.searchParams.get("q") === query);
  await waitForDirectoryIdle(page);
  await expectCardCount(
    page,
    expectedCount,
    "Changing search should reset pagination"
  );
}

async function clearSearch(page) {
  const clear = page.getByRole("button", { name: "Clear search" });
  await expectVisible(clear, "Filled search should expose a clear control.");
  await clear.click();
  await page.waitForURL((url) => !url.searchParams.has("q"));
  await waitForDirectoryIdle(page);
  await expectCardCount(page, pageSize, "Clearing search should reset results");
}

async function assertUnofficialHeader(page, label) {
  const header = page.locator("header");
  await expectVisible(
    header.getByText("Unofficial fan directory", { exact: true }),
    `${label}: unofficial identity should remain visible in the header.`
  );
  await expectVisible(
    header.getByText("Exercise Directory", { exact: true }),
    `${label}: directory identity should remain visible in the header.`
  );
  const home = header.getByRole("link", {
    name: "Unofficial OTF Exercise Directory home",
  });
  await expectVisible(home, `${label}: logo lockup should have an accessible name.`);
  assert(
    (await home.locator("img").getAttribute("alt")) === "",
    `${label}: the retained logo should be decorative beside visible identity copy.`
  );
}

async function assertPrimaryNav(page, expected) {
  const nav = page.getByRole("navigation", { name: "Primary" });
  const directory = nav.getByRole("link", { name: "Directory", exact: true });
  const coaching = nav.getByRole("link", { name: "Coaching", exact: true });
  assert(
    (await directory.getAttribute("aria-current")) ===
      (expected === "directory" ? "page" : null),
    `Directory aria-current should match the exact-route state ${expected ?? "none"}.`
  );
  assert(
    (await coaching.getAttribute("aria-current")) ===
      (expected === "coaching" ? "page" : null),
    `Coaching aria-current should match the exact-route state ${expected ?? "none"}.`
  );
}

async function assertSingleSearchClear(page) {
  const search = page.getByRole("searchbox", { name: "Search exercises" });
  assert(
    (await search.getAttribute("type")) === "search",
    "Directory search should retain semantic type=search."
  );
  await search.fill("cardio");
  await page.waitForURL((url) => url.searchParams.get("q") === "cardio");
  await waitForDirectoryIdle(page);
  const response = await page.request.get(
    `${baseURL}/api/directory?section=exercise&q=cardio`
  );
  assert(response.ok(), "Search clear fixture request should succeed.");
  const payload = await response.json();
  await expectCardCount(
    page,
    Math.min(pageSize, payload.total),
    "Search should render one bounded result page"
  );
  const clearControls = page.getByRole("button", { name: "Clear search" });
  assert(
    (await clearControls.count()) === 1 && (await clearControls.first().isVisible()),
    "A filled search should expose exactly one authored clear control."
  );

  const nativeCancelSuppressed = await page.evaluate(() => {
    const containsSuppression = (rules) => {
      for (const rule of rules) {
        if (
          rule.cssText?.includes("::-webkit-search-cancel-button") &&
          /(?:display\s*:\s*none|-webkit-appearance\s*:\s*none|appearance\s*:\s*none)/i.test(
            rule.cssText
          )
        ) {
          return true;
        }
        if (rule.cssRules && containsSuppression(rule.cssRules)) return true;
      }
      return false;
    };

    return [...document.styleSheets].some((sheet) => {
      try {
        return containsSuppression(sheet.cssRules);
      } catch {
        return false;
      }
    });
  });
  assert(
    nativeCancelSuppressed,
    "The browser-native WebKit search cancel control should be suppressed in CSS."
  );
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

function monitorPage(page, label, { javaScriptDisabled = false } = {}) {
  const failures = [];
  const localOrigin = new URL(baseURL).origin;

  page.on("console", (message) => {
    if (message.type() === "error") {
      const expectedMissingRouteConsole =
        new URL(page.url()).pathname === missingPath &&
        /status of 404|404 \(Not Found\)/i.test(message.text());
      if (expectedMissingRouteConsole) return;
      failures.push(`console: ${message.text()}`);
    }
  });
  page.on("pageerror", (error) => failures.push(`page: ${error.message}`));
  page.on("requestfailed", (request) => {
    const reason = request.failure()?.errorText ?? "unknown failure";
    const requestUrl = new URL(request.url());
    const expectedDisabledScriptBlock =
      javaScriptDisabled &&
      reason.toLocaleLowerCase("en-US") === "csp" &&
      requestUrl.origin === localOrigin &&
      /^\/_next\/static\/(?:immutable\/)?chunks\/.+\.js$/.test(
        requestUrl.pathname
      );
    if (expectedDisabledScriptBlock) return;
    if (!/abort|cancel/i.test(reason)) {
      failures.push(`request: ${request.method()} ${request.url()} (${reason})`);
    }
  });
  page.on("response", (response) => {
    if (response.status() < 400) return;
    try {
      const url = new URL(response.url());
      if (url.pathname === missingPath && response.status() === 404) return;
      if (url.origin === localOrigin) {
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
  const assertClean = monitorPage(page, label, {
    javaScriptDisabled: options.javaScriptEnabled === false,
  });
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
  const expected = new URL(href, baseURL);
  await Promise.all([
    page.waitForURL(
      (url) =>
        url.pathname === expected.pathname && url.search === expected.search
    ),
    card.click(),
  ]);
  return name;
}

async function assertSitemap(page) {
  const response = await page.request.get(`${baseURL}/sitemap.xml`);
  assert(response.ok(), `Sitemap returned HTTP ${response.status()}.`);
  const xml = await response.text();
  const urlPaths = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map(
    ([, location]) => new URL(location).pathname
  );
  const expectedPaths = new Set([
    "/",
    "/coaching",
    "/privacy",
    ...exercises.map((exercise) => `/exercise/${exercise.id}`),
    ...coachingResources.map((resource) => `/coaching/${resource.id}`),
  ]);
  assert(
    urlPaths.length === new Set(urlPaths).size,
    "Sitemap should not contain duplicate URLs."
  );
  const missing = [...expectedPaths].filter((path) => !urlPaths.includes(path));
  const unexpected = urlPaths.filter((path) => !expectedPaths.has(path));
  assert(
    missing.length === 0 && unexpected.length === 0,
    `Sitemap coverage differs. Missing: ${missing.join(", ") || "none"}; unexpected: ${unexpected.join(", ") || "none"}.`
  );
}

async function assertCatalogNotShipped(page) {
  const documentResponse = await page.request.get(baseURL);
  assert(documentResponse.ok(), "Home document should be available for bundle QA.");
  const documentText = await documentResponse.text();
  const scriptUrls = await page.locator("script[src]").evaluateAll((scripts) =>
    scripts.map((script) => script.src)
  );
  const localOrigin = new URL(baseURL).origin;
  const scriptTexts = await Promise.all(
    scriptUrls
      .filter((url) => new URL(url).origin === localOrigin)
      .map(async (url) => {
        const response = await page.request.get(url);
        return response.ok() ? response.text() : "";
      })
  );
  const shippedText = [documentText, ...scriptTexts].join("\n");
  const visibleHrefs = new Set(
    await page
      .locator("[data-testid='exercise-card']")
      .evaluateAll((cards) => cards.map((card) => card.getAttribute("href")))
  );
  const sentinels = exercises
    .slice(-5)
    .map((exercise) => exercise.id)
    .filter(
      (id) =>
        ![...visibleHrefs].some((href) => href?.startsWith(`/exercise/${id}`))
    );
  for (const id of sentinels) {
    assert(
      !shippedText.includes(`\"${id}\"`),
      `Home document/client scripts should not ship off-page catalog record ${id}.`
    );
  }
  assert(
    (shippedText.match(/\"exercise_name\"/g)?.length ?? 0) < pageSize,
    "Home payload should not contain the legacy full-catalog exercise schema."
  );
}

function resourceIdsInPayload(payload, segment) {
  const pathMatches = payload.matchAll(
    new RegExp(`/${segment}/([a-z0-9][a-z0-9-]*)`, "gi")
  );
  const summaryMatches = payload.matchAll(
    new RegExp(
      `"id":"([a-z0-9][a-z0-9-]*)","kind":"${segment}"`,
      "gi"
    )
  );
  return new Set(
    [...pathMatches, ...summaryMatches].map(([, id]) => id)
  );
}

function assertBoundedPayload(payload, segment, offWindowIds, label) {
  const payloadIds = resourceIdsInPayload(payload, segment);
  assert(payloadIds.size > 0, `${label} should contain its bounded card window.`);
  assert(
    payloadIds.size <= pageSize,
    `${label} contains ${payloadIds.size} distinct ${segment} cards; expected at most ${pageSize}.`
  );
  assert(
    (payload.match(/\"exercise_name\"/g)?.length ?? 0) < pageSize,
    `${label} should not contain the legacy full-catalog exercise schema.`
  );
  for (const id of offWindowIds) {
    assert(
      !payload.includes(id),
      `${label} should not contain off-window catalog record ${id}.`
    );
  }
}

async function assertDeepHostileServerWindow(page) {
  const hostileUrl = `${baseURL}/?page=100`;
  const [documentResponse, rscResponse] = await Promise.all([
    page.request.get(hostileUrl),
    page.request.get(`${hostileUrl}&_rsc=ui-smoke`, {
      headers: {
        Accept: "text/x-component",
        RSC: "1",
      },
    }),
  ]);
  assert(
    documentResponse.ok(),
    `Deep page document returned HTTP ${documentResponse.status()}.`
  );
  assert(
    rscResponse.ok(),
    `Deep page RSC response returned HTTP ${rscResponse.status()}.`
  );
  assert(
    /text\/x-component/i.test(rscResponse.headers()["content-type"] ?? ""),
    "Deep page RSC request should return a React Server Component payload."
  );

  await page.goto(hostileUrl, { waitUntil: "domcontentloaded" });
  const domCards = page.locator("[data-testid='exercise-card']");
  const domCount = await domCards.count();
  assert(
    domCount > 0 && domCount <= pageSize,
    `JavaScript-disabled deep-page DOM has ${domCount} cards; expected 1-${pageSize}.`
  );
  const visibleIds = new Set(
    (await domCards.evaluateAll((cards) =>
      cards.map((card) => new URL(card.href).pathname.split("/").at(-1))
    )).filter(Boolean)
  );
  const offWindowIds = exercises
    .map((exercise) => exercise.id)
    .filter((id) => id.length > 15 && !visibleIds.has(id))
    .slice(0, 5);
  assert(
    offWindowIds.length === 5,
    "Deep-page payload QA needs five off-window exercise sentinels."
  );

  const documentText = await documentResponse.text();
  const rscText = await rscResponse.text();
  assertBoundedPayload(
    documentText,
    "exercise",
    offWindowIds,
    "Deep page HTML document/RSC stream"
  );
  assertBoundedPayload(
    rscText,
    "exercise",
    offWindowIds,
    "Deep page standalone RSC payload"
  );
}

async function assertNoJavaScriptSectionPaging(
  page,
  { pathname, resourcePath, total, label }
) {
  const totalPages = Math.ceil(total / pageSize);
  assert(totalPages >= 2, `${label} needs at least two pages for no-JS paging QA.`);
  const secondToLastPage = totalPages - 1;
  const secondToLastCount = Math.min(
    pageSize,
    total - (secondToLastPage - 1) * pageSize
  );
  const lastCount = total - secondToLastPage * pageSize;
  const secondToLastUrl = new URL(pathname, baseURL);
  if (secondToLastPage > 1) {
    secondToLastUrl.searchParams.set("page", String(secondToLastPage));
  }

  await page.goto(secondToLastUrl.toString(), { waitUntil: "networkidle" });
  await expectCardCount(
    page,
    secondToLastCount,
    `${label} second-to-last no-JS window`
  );
  const secondToLastIds = new Set(
    await page.locator("[data-testid='exercise-card']").evaluateAll(
      (cards, segment) =>
        cards.map((card) =>
          new URL(card.href).pathname.replace(`/${segment}/`, "")
        ),
      resourcePath
    )
  );
  const summary = page
    .locator("p[aria-live='polite']")
    .filter({ hasText: "Showing" })
    .first();
  assert(
    (await summary.innerText()).includes(
      `Showing ${secondToLastCount.toLocaleString()} of ${total.toLocaleString()}`
    ),
    `${label} second-to-last window should report its bounded count.`
  );

  const next = page.getByRole("link", {
    name: `Load ${lastCount} more`,
    exact: true,
  });
  await expectVisible(next, `${label} should link from the second-to-last window.`);
  const nextUrl = new URL(await next.getAttribute("href"), baseURL);
  assert(
    nextUrl.pathname === pathname &&
      nextUrl.searchParams.getAll("page").length === 1 &&
      nextUrl.searchParams.get("page") === String(totalPages),
    `${label} no-JS Load more should link exactly once to page ${totalPages}.`
  );

  await Promise.all([
    page.waitForURL(
      (url) => url.searchParams.get("page") === String(totalPages),
      { waitUntil: "domcontentloaded" }
    ),
    next.click(),
  ]);
  await expectCardCount(page, lastCount, `${label} last no-JS window`);
  const lastIds = new Set(
    await page.locator("[data-testid='exercise-card']").evaluateAll(
      (cards, segment) =>
        cards.map((card) =>
          new URL(card.href).pathname.replace(`/${segment}/`, "")
        ),
      resourcePath
    )
  );
  assert(
    [...lastIds].every((id) => !secondToLastIds.has(id)),
    `${label} last window should not loop back to second-to-last items.`
  );
  assert(
    (await page
      .getByRole("link", { name: /^Load \d+ more$/ })
      .count()) === 0,
    `${label} last page should expose no further Load more link.`
  );
  assert(
    (await page
      .getByRole("button", { name: /^Load \d+ more$/ })
      .count()) === 0,
    `${label} last page should expose no looping Load more button.`
  );
  assert(
    (await summary.innerText()).includes(
      `Showing ${lastCount.toLocaleString()} of ${total.toLocaleString()}`
    ),
    `${label} last window should report its bounded count.`
  );
}

async function runNoJavaScriptAcceptance(browser) {
  const label = "Chromium JavaScript-disabled paging";
  const { context, page, assertClean } = await createPage(
    browser,
    {
      viewport: { width: 1280, height: 900 },
      javaScriptEnabled: false,
    },
    label
  );
  try {
    await assertNoJavaScriptSectionPaging(page, {
      pathname: "/",
      resourcePath: "exercise",
      total: exercises.length,
      label: "Exercise directory",
    });
    await assertNoJavaScriptSectionPaging(page, {
      pathname: "/coaching",
      resourcePath: "coaching",
      total: coachingResources.length,
      label: "Coaching directory",
    });
    await assertDeepHostileServerWindow(page);
    await assertClean();
    console.log(`PASS ${label}`);
  } finally {
    await context.close();
  }
}

async function chooseDesktopCategory(page, label) {
  const filters = page.locator(
    "button[aria-controls='desktop-exercise-filters']"
  );
  await expectVisible(filters, "Desktop filter trigger should be visible.");
  if ((await filters.getAttribute("aria-expanded")) !== "true") {
    await filters.click();
  }
  const choice = page
    .locator("#desktop-exercise-filters")
    .getByRole("button", { name: label, exact: true });
  await expectVisible(choice, `Desktop ${label} category should be available.`);
  await choice.click();
  await waitForDirectoryIdle(page);
}

async function assertAuthoritativeDirectoryState(context, page) {
  const stateQuery = "tiktok";
  const stateCategory = "upper_body";
  await searchAndExpectReset(page, stateQuery);
  await chooseDesktopCategory(page, "Upper Body");
  await page.waitForURL(
    (url) =>
      url.searchParams.get("q") === stateQuery &&
      url.searchParams.getAll("category").includes(stateCategory) &&
      !url.searchParams.has("page")
  );
  await expectCardCount(page, pageSize, "Filtering should retain one visible batch");

  await loadMore(page, pageSize * 2);
  await page.waitForURL((url) => url.searchParams.get("page") === "2");
  const sharedUrl = page.url();

  await page.evaluate(() => history.back());
  await page.waitForURL((url) => !url.searchParams.has("page"));
  await waitForDirectoryIdle(page);
  await expectCardCount(page, pageSize, "Back should restore the preceding page=1 state");
  assert(
    !new URL(page.url()).searchParams.has("page"),
    "Back should remove the page=2 URL state."
  );
  await page.evaluate(() => history.forward());
  await page.waitForURL((url) => url.searchParams.get("page") === "2");
  await waitForDirectoryIdle(page);
  await expectCardCount(page, pageSize * 2, "Forward should restore page=2");

  const card = page.locator("[data-testid='exercise-card']").first();
  const href = new URL(await card.getAttribute("href"), baseURL);
  assert(
    href.searchParams.get("q") === stateQuery &&
      href.searchParams.getAll("category").includes(stateCategory) &&
      href.searchParams.get("page") === "2",
    "Detail links should carry the normalized directory state."
  );
  await Promise.all([page.waitForURL(href.toString()), card.click()]);
  await assertPrimaryNav(page, "directory");
  const back = page.getByRole("link", { name: "Back to directory" });
  await expectVisible(back, "Detail should expose an explicit directory back link.");
  await page.waitForFunction(() => {
    const link = [...document.querySelectorAll("a")].find(
      (candidate) => candidate.textContent?.trim() === "Back to directory"
    );
    if (!link) return false;
    const url = new URL(link.href);
    return (
      url.searchParams.get("q") === "tiktok" &&
      url.searchParams.getAll("category").includes("upper_body") &&
      url.searchParams.get("page") === "2"
    );
  });
  const backHref = new URL(await back.getAttribute("href"), baseURL);
  assert(
    backHref.searchParams.get("q") === stateQuery &&
      backHref.searchParams.getAll("category").includes(stateCategory) &&
      backHref.searchParams.get("page") === "2",
    "The explicit back link should preserve q, filter, and page state."
  );
  await page.evaluate(() => history.back());
  await page.waitForURL((url) => url.pathname === "/");
  await waitForDirectoryIdle(page);
  await expectCardCount(
    page,
    pageSize * 2,
    "Browser Back from detail should restore the accumulated directory"
  );

  await page.goto("about:blank");
  await page.goto(sharedUrl, { waitUntil: "domcontentloaded" });
  await waitForDirectoryIdle(page);
  await expectCardCount(page, pageSize * 2, "Hard refresh should restore page=2");
  assert(
    (await page.getByRole("searchbox", { name: "Search exercises" }).inputValue()) ===
      stateQuery,
    "Hard refresh should restore q from the URL."
  );
  await expectVisible(
    page.getByLabel("Active filters").getByText("Category: Upper Body", {
      exact: true,
    }),
    "Hard refresh should restore the active category filter."
  );

  const sharedPage = await context.newPage();
  try {
    await sharedPage.goto(sharedUrl, { waitUntil: "domcontentloaded" });
    await waitForDirectoryIdle(sharedPage);
    await expectCardCount(
      sharedPage,
      pageSize * 2,
      "Opening a shared URL should restore page=2"
    );
    assert(
      (await sharedPage
        .getByRole("searchbox", { name: "Search exercises" })
        .inputValue()) === stateQuery,
      "A shared URL should restore the search query."
    );
  } finally {
    await sharedPage.close();
  }
}

async function assertSearchCategoryParity(page) {
  const [searchResponse, filterResponse] = await Promise.all([
    page.request.get(
      `${baseURL}/api/directory?section=exercise&q=cardio&page=100`
    ),
    page.request.get(
      `${baseURL}/api/directory?section=exercise&category=cardio&page=100`
    ),
  ]);
  assert(searchResponse.ok(), "Cardio search API request should succeed.");
  assert(filterResponse.ok(), "Cardio filter API request should succeed.");
  const searchPayload = await searchResponse.json();
  const filterPayload = await filterResponse.json();
  const searchIds = new Set(searchPayload.items.map((item) => item.id));
  const missing = filterPayload.items
    .map((item) => item.id)
    .filter((id) => !searchIds.has(id));
  assert(
    missing.length === 0,
    `q=cardio should include every Cardio-filter result; missing ${missing.join(", ")}.`
  );
  assert(
    searchPayload.total >= filterPayload.total,
    "Cardio search total should not be smaller than the Cardio filter total."
  );
  assert(
    searchPayload.items.every((item) => item.matchedBy.length > 0),
    "Search results should explain why they matched."
  );
}

async function assertMalformedUrlCanonicalization(page) {
  const malformed = new URL(baseURL);
  malformed.searchParams.append("category", "cardio");
  malformed.searchParams.append("category", "Cardio");
  malformed.searchParams.append("category", "definitely_unknown");
  malformed.searchParams.append("source", "tiktok");
  malformed.searchParams.append("source", "TIKTOK");
  malformed.searchParams.append("source", "definitely_unknown");
  malformed.searchParams.set("page", "2junk");
  malformed.searchParams.set("rogue", "1");

  await page.goto(malformed.toString(), { waitUntil: "networkidle" });
  await page.waitForURL((url) => {
    const params = url.searchParams;
    return (
      params.toString() === "category=cardio&source=tiktok" &&
      params.getAll("category").length === 1 &&
      params.getAll("source").length === 1
    );
  });
  await waitForDirectoryIdle(page);
  const canonical = new URL(page.url()).searchParams;
  assert(
    canonical.getAll("category").join(",") === "cardio" &&
      canonical.getAll("source").join(",") === "tiktok" &&
      !canonical.has("page") &&
      !canonical.has("rogue"),
    `Malformed URL should canonicalize to valid deduped state, found ${canonical}.`
  );
  await expectVisible(
    page.getByLabel("Active filters").getByText("Category: Cardio", {
      exact: true,
    }),
    "Canonical URL should retain the valid category filter."
  );
  await expectVisible(
    page.getByLabel("Active filters").getByText("Source: TikTok", {
      exact: true,
    }),
    "Canonical URL should retain the valid source filter."
  );
  const cards = await page.locator("[data-testid='exercise-card']").count();
  assert(
    cards > 0 && cards <= pageSize,
    `Canonical filters should render one bounded result page, found ${cards} cards.`
  );
}

async function assertApiPagingPrefixForSection(page, section, total) {
  const apiUrl = (requestedPage) =>
    `${baseURL}/api/directory?section=${section}&page=${requestedPage}`;
  const [pageOneResponse, pageTwoResponse, pageTwoRepeatResponse] =
    await Promise.all([
      page.request.get(apiUrl(1)),
      page.request.get(apiUrl(2)),
      page.request.get(apiUrl(2)),
    ]);
  for (const [label, response] of [
    [`${section} page 1`, pageOneResponse],
    [`${section} page 2`, pageTwoResponse],
    [`${section} repeated page 2`, pageTwoRepeatResponse],
  ]) {
    assert(response.ok(), `${label} API returned HTTP ${response.status()}.`);
  }

  const [pageOne, pageTwo, pageTwoRepeat] = await Promise.all([
    pageOneResponse.json(),
    pageTwoResponse.json(),
    pageTwoRepeatResponse.json(),
  ]);
  const pageOneIds = pageOne.items.map((item) => item.id);
  const pageTwoIds = pageTwo.items.map((item) => item.id);
  const repeatedIds = pageTwoRepeat.items.map((item) => item.id);
  assert(
    pageOne.accumulated && pageTwo.accumulated && pageTwoRepeat.accumulated,
    `${section} API responses should use accumulated paging semantics.`
  );
  assert(
    pageOne.page === 1 && pageOneIds.length === Math.min(pageSize, total),
    `${section} API page 1 should contain its first bounded prefix.`
  );
  assert(
    pageTwo.page === 2 &&
      pageTwoIds.length === Math.min(pageSize * 2, total),
    `${section} API page 2 should contain the first two accumulated pages.`
  );
  assert(
    pageOneIds.every((id, index) => pageTwoIds[index] === id),
    `${section} API page 1 must be an unchanged prefix of page 2.`
  );
  assert(
    pageTwoIds.join("\n") === repeatedIds.join("\n"),
    `${section} API page 2 ordering should be stable across repeated requests.`
  );
  assert(
    new Set(pageTwoIds).size === pageTwoIds.length,
    `${section} accumulated page 2 should not duplicate records.`
  );
}

async function assertApiPagingPrefix(page) {
  await assertApiPagingPrefixForSection(page, "exercise", exercises.length);
  await assertApiPagingPrefixForSection(
    page,
    "coaching",
    coachingResources.length
  );
}

async function assertRapidSearchRace(page) {
  const olderQuery = "squat";
  const latestQuery = "rower";
  const [olderPayloadResponse, latestPayloadResponse] = await Promise.all([
    page.request.get(
      `${baseURL}/api/directory?section=exercise&q=${olderQuery}`
    ),
    page.request.get(
      `${baseURL}/api/directory?section=exercise&q=${latestQuery}`
    ),
  ]);
  assert(olderPayloadResponse.ok(), "Older search fixture request should succeed.");
  assert(latestPayloadResponse.ok(), "Latest search fixture request should succeed.");
  const [olderPayloadText, latestPayload] = await Promise.all([
    olderPayloadResponse.text(),
    latestPayloadResponse.json(),
  ]);
  const latestFirstId = latestPayload.items[0]?.id;
  assert(latestFirstId, "Latest search fixture should contain at least one result.");

  let releaseOlder;
  let markOlderSeen;
  let markOlderSettled;
  let olderHeld = false;
  const olderGate = new Promise((resolve) => {
    releaseOlder = resolve;
  });
  const olderSeen = new Promise((resolve) => {
    markOlderSeen = resolve;
  });
  const olderSettled = new Promise((resolve) => {
    markOlderSettled = resolve;
  });
  const matcher = (url) => url.pathname === "/api/directory";
  const handler = async (route) => {
    const query = new URL(route.request().url()).searchParams.get("q");
    if (query === olderQuery && !olderHeld) {
      olderHeld = true;
      markOlderSeen();
      await olderGate;
      try {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: olderPayloadText,
        });
      } catch {
        // The component is allowed to abort the stale request before release.
      } finally {
        markOlderSettled();
      }
      return;
    }
    await route.continue();
  };

  await page.goto(baseURL, { waitUntil: "networkidle" });
  await page.route(matcher, handler);
  try {
    const search = page.getByRole("searchbox", { name: "Search exercises" });
    await search.fill(olderQuery);
    await Promise.race([
      olderSeen,
      page.waitForTimeout(5_000).then(() => {
        throw new Error("Older search request was not intercepted.");
      }),
    ]);

    await search.fill(latestQuery);
    await page.waitForURL((url) => url.searchParams.get("q") === latestQuery);
    await page.waitForFunction(
      (id) =>
        document
          .querySelector("[data-testid='exercise-card']")
          ?.getAttribute("href")
          ?.startsWith(`/exercise/${id}`),
      latestFirstId
    );
    await waitForDirectoryIdle(page);
    const latestHrefs = await page
      .locator("[data-testid='exercise-card']")
      .evaluateAll((cards) => cards.map((card) => card.getAttribute("href")));

    releaseOlder();
    await Promise.race([
      olderSettled,
      page.waitForTimeout(5_000).then(() => {
        throw new Error("Delayed older search request did not settle.");
      }),
    ]);
    await page.waitForTimeout(300);

    const settledHrefs = await page
      .locator("[data-testid='exercise-card']")
      .evaluateAll((cards) => cards.map((card) => card.getAttribute("href")));
    assert(
      new URL(page.url()).searchParams.get("q") === latestQuery &&
        (await search.inputValue()) === latestQuery,
      "A released stale response must not replace the latest query or URL."
    );
    assert(
      settledHrefs.join("\n") === latestHrefs.join("\n") &&
        settledHrefs[0]?.startsWith(`/exercise/${latestFirstId}`),
      "A released stale response must not replace the latest rendered results."
    );
    await waitForDirectoryIdle(page);
  } finally {
    releaseOlder?.();
    await page.unroute(matcher, handler);
  }
}

async function assertDelayedRequestCardNavigation(page) {
  const stateQuery = "tiktok";
  const stateCategory = "upper_body";
  await page.goto(baseURL, { waitUntil: "networkidle" });
  await searchAndExpectReset(page, stateQuery);
  const oldCardPaths = await page
    .locator("[data-testid='exercise-card']")
    .evaluateAll((cards) =>
      cards
        .slice(0, 5)
        .map((card) => new URL(card.href).pathname)
    );
  assert(
    oldCardPaths.length === 5,
    "Delayed-navigation QA needs five visible cards from the settled query."
  );

  let releaseRequest;
  let markRequestSeen;
  let markRequestSettled;
  let requestHeld = false;
  const requestGate = new Promise((resolve) => {
    releaseRequest = resolve;
  });
  const requestSeen = new Promise((resolve) => {
    markRequestSeen = resolve;
  });
  const requestSettled = new Promise((resolve) => {
    markRequestSettled = resolve;
  });
  const matcher = (url) => url.pathname === "/api/directory";
  const handler = async (route) => {
    const params = new URL(route.request().url()).searchParams;
    if (
      !requestHeld &&
      params.get("q") === stateQuery &&
      params.getAll("category").includes(stateCategory)
    ) {
      requestHeld = true;
      markRequestSeen();
      await requestGate;
      try {
        await route.continue();
      } catch {
        // Navigating to detail may abort the deliberately stale directory request.
      } finally {
        markRequestSettled();
      }
      return;
    }
    await route.continue();
  };

  await page.route(matcher, handler);
  try {
    const filters = page.locator(
      "button[aria-controls='desktop-exercise-filters']"
    );
    await expectVisible(filters, "Delayed-navigation QA needs desktop filters.");
    if ((await filters.getAttribute("aria-expanded")) !== "true") {
      await filters.click();
    }
    const upperBody = page
      .locator("#desktop-exercise-filters")
      .getByRole("button", { name: "Upper Body", exact: true });
    await expectVisible(
      upperBody,
      "Delayed-navigation QA needs the Upper Body filter."
    );
    await upperBody.click();
    await Promise.all([
      page.waitForURL(
        (url) =>
          url.searchParams.get("q") === stateQuery &&
          url.searchParams.getAll("category").includes(stateCategory)
      ),
      Promise.race([
        requestSeen,
        page.waitForTimeout(5_000).then(() => {
          throw new Error("Updated filter request was not intercepted.");
        }),
      ]),
    ]);
    await page.waitForFunction(
      () => document.querySelector("#directory")?.getAttribute("aria-busy") === "true"
    );

    const staleCards = page.locator("[data-testid='exercise-card']");
    await expectCardCount(
      page,
      pageSize,
      "The prior card window should remain visible while filtering"
    );
    const pendingPaths = await staleCards.evaluateAll((cards) =>
      cards
        .slice(0, 5)
        .map((card) => new URL(card.href).pathname)
    );
    assert(
      pendingPaths.join("\n") === oldCardPaths.join("\n"),
      "The held request should leave the prior cards visible for the click window."
    );

    const staleCard = staleCards.first();
    const authoritativeHref = new URL(
      await staleCard.getAttribute("href"),
      baseURL
    );
    assert(
      authoritativeHref.pathname === oldCardPaths[0] &&
        authoritativeHref.searchParams.get("q") === stateQuery &&
        authoritativeHref.searchParams.getAll("category").join(",") ===
          stateCategory,
      "A visible old card must link with the newer authoritative query and filter."
    );

    await Promise.all([
      page.waitForURL(
        (url) =>
          url.pathname === authoritativeHref.pathname &&
          url.searchParams.get("q") === stateQuery &&
          url.searchParams.getAll("category").join(",") === stateCategory
      ),
      staleCard.click(),
    ]);
    const detailUrl = new URL(page.url());
    assert(
      detailUrl.searchParams.get("q") === stateQuery &&
        detailUrl.searchParams.getAll("category").join(",") === stateCategory,
      "Clicking during the stale-card window must preserve the newer detail URL state."
    );

    const back = page.getByRole("link", { name: "Back to directory" });
    await expectVisible(
      back,
      "The delayed-navigation detail should expose its directory back link."
    );
    await page.waitForFunction(() => {
      const link = [...document.querySelectorAll("a")].find(
        (candidate) => candidate.textContent?.trim() === "Back to directory"
      );
      if (!link) return false;
      const url = new URL(link.href);
      return (
        url.searchParams.get("q") === "tiktok" &&
        url.searchParams.getAll("category").join(",") === "upper_body"
      );
    });
    const backHref = new URL(await back.getAttribute("href"), baseURL);
    assert(
      backHref.pathname === "/" &&
        backHref.searchParams.get("q") === stateQuery &&
        backHref.searchParams.getAll("category").join(",") === stateCategory,
      "The explicit back link must reconstruct the newer authoritative state."
    );

    releaseRequest();
    await Promise.race([
      requestSettled,
      page.waitForTimeout(5_000).then(() => {
        throw new Error("Held filter request did not settle after release.");
      }),
    ]);
  } finally {
    releaseRequest?.();
    await page.unroute(matcher, handler);
  }
}

async function assertJavaScriptPagingFocus(page) {
  await page.goto(baseURL, { waitUntil: "networkidle" });
  const intermediateControl = page.getByRole("link", {
    name: `Load ${pageSize} more`,
    exact: true,
  });
  await expectVisible(
    intermediateControl,
    "Exercise directory should expose an intermediate Load more control."
  );
  await intermediateControl.click();
  await waitForDirectoryIdle(page);
  await expectCardCount(
    page,
    pageSize * 2,
    "Intermediate focus paging should append a second page"
  );
  await page.waitForFunction(
    () =>
      document.activeElement?.matches("a") &&
      /^Load \d+ more$/.test(document.activeElement.textContent?.trim() ?? "")
  );
  const retainedControl = page.getByRole("link", { name: /^Load \d+ more$/ });
  assert(
    await retainedControl.evaluate(
      (element) => document.activeElement === element
    ),
    "Focus should remain on Load more while another page remains."
  );

  const totalPages = Math.ceil(coachingResources.length / pageSize);
  assert(totalPages >= 2, "Final focus paging needs at least two coaching pages.");
  const penultimatePage = totalPages - 1;
  const penultimateUrl = new URL("/coaching", baseURL);
  if (penultimatePage > 1) {
    penultimateUrl.searchParams.set("page", String(penultimatePage));
  }
  await page.goto(penultimateUrl.toString(), { waitUntil: "networkidle" });
  await waitForDirectoryIdle(page);
  const appendStart = penultimatePage * pageSize;
  await expectCardCount(
    page,
    appendStart,
    "Penultimate coaching page should hydrate its accumulated prefix"
  );
  const lastBatchCount = coachingResources.length - appendStart;
  const finalControl = page.getByRole("link", {
    name: `Load ${lastBatchCount} more`,
    exact: true,
  });
  await expectVisible(finalControl, "Penultimate page should expose its final batch.");
  await finalControl.click();
  await waitForDirectoryIdle(page);
  await expectCardCount(
    page,
    coachingResources.length,
    "Final focus paging should append every remaining coaching resource"
  );
  assert(
    (await page.getByRole("link", { name: /^Load \d+ more$/ }).count()) === 0,
    "Final accumulated page should remove the Load more control."
  );
  await page.waitForFunction(
    (index) =>
      document.activeElement ===
      document.querySelectorAll("[data-testid='exercise-card']")[index],
    appendStart
  );
  const firstAppended = page
    .locator("[data-testid='exercise-card']")
    .nth(appendStart);
  assert(
    await firstAppended.evaluate(
      (element) => document.activeElement === element
    ),
    "When Load more disappears, focus should move to the first appended card."
  );
}

async function assertMobileFilterControl(page, label) {
  const trigger = page.locator(
    "button[aria-controls='mobile-exercise-filters']"
  );
  await expectVisible(trigger, `${label}: mobile filter trigger should be visible.`);
  const panel = trigger.locator("xpath=ancestor::section[1]");
  const [triggerBox, panelBox, style] = await Promise.all([
    trigger.boundingBox(),
    panel.boundingBox(),
    panel.evaluate((element) => {
      const computed = getComputedStyle(element);
      return {
        backgroundColor: computed.backgroundColor,
        borderTopWidth: computed.borderTopWidth,
        children: Array.from(element.children).map((child) => {
          const childStyle = getComputedStyle(child);
          const box = child.getBoundingClientRect();
          return `${child.tagName.toLowerCase()}:${childStyle.display}:${childStyle.position}:${box.height}`;
        }),
      };
    }),
  ]);
  const viewport = page.viewportSize();
  assert(triggerBox && panelBox && viewport, `${label}: filter layout needs boxes.`);
  assert(
    triggerBox.width < viewport.width * 0.7,
    `${label}: filter trigger should shrink to its content instead of filling the row.`
  );
  assert(
    panelBox.height <= triggerBox.height + 4,
    `${label}: closed filters should not leave a full-width empty tray (${panelBox.height}px wrapper vs ${triggerBox.height}px trigger; children ${style.children.join(", ")}).`
  );
  assert(
    style.backgroundColor === "rgba(0, 0, 0, 0)" && style.borderTopWidth === "0px",
    `${label}: the closed mobile filter wrapper should be visually transparent.`
  );
}

async function assertInstagramBehavior(page) {
  const instagramRequests = [];
  const recordRequest = (request) => {
    if (/\.instagram\.com$|\.cdninstagram\.com$/i.test(new URL(request.url()).hostname)) {
      instagramRequests.push(request.url());
    }
  };
  page.on("request", recordRequest);
  try {
    await page.goto(`${baseURL}/exercise/${instagramExercise.id}`, {
      waitUntil: "networkidle",
    });
    const outbound = page
      .getByRole("link", { name: /Instagram.*new tab|original.*Instagram/i })
      .first();
    await expectVisible(
      outbound,
      "Instagram media should identify itself as an outbound original-post link."
    );
    assert(
      (await outbound.getAttribute("target")) === "_blank" &&
        /noopener/.test((await outbound.getAttribute("rel")) ?? ""),
      "Instagram media should open safely in a separate tab."
    );
    assert(
      /Open (?:original )?(?:on )?Instagram/i.test(await outbound.innerText()),
      "Instagram media should use explicit outbound wording instead of player wording."
    );
    assert(
      (await page.locator("iframe[src*='instagram.com']").count()) === 0,
      "Instagram should remain outbound rather than embedding a player."
    );
    assert(
      instagramRequests.length === 0,
      "Viewing a local Instagram preview should not contact Instagram."
    );
  } finally {
    page.off("request", recordRequest);
  }
}

async function assertLongestTitleDetail(page) {
  await page.goto(`${baseURL}/exercise/${longestTitleExercise.id}`, {
    waitUntil: "networkidle",
  });
  await expectVisible(
    page.getByRole("heading", {
      name: longestTitleExercise.exercise_name,
      level: 1,
    }),
    "Longest-title detail heading should render."
  );
  const firstVideo = longestTitleExercise.videos[0];
  const firstArticle = page
    .locator("section[aria-labelledby='video-library-heading'] article")
    .first();
  const mediaControl =
    firstVideo.source === "tiktok"
      ? firstArticle.getByRole("button", {
          name: `Play ${longestTitleExercise.exercise_name} on TikTok`,
        })
      : firstArticle
          .getByRole("link", { name: /Instagram.*new tab|original.*Instagram/i })
          .first();
  await expectVisible(mediaControl, "Longest title should not obscure first media control.");
  const box = await mediaControl.boundingBox();
  assert(box, "First media control should have a layout box.");
  assert(
    box.y < 900,
    `Longest-title first media control starts at ${box.y}px; expected it within 900px.`
  );
}

async function assertCoachingExperience(page) {
  await page.goto(`${baseURL}/coaching`, { waitUntil: "networkidle" });
  await assertPrimaryNav(page, "coaching");
  await expectVisible(
    page.getByRole("heading", { name: "Coaching resources", level: 2 }),
    "Coaching should have a separate public directory."
  );

  if (coachingResources.length === 0) {
    await expectVisible(
      page.getByText("No results found", { exact: true }),
      "An empty reviewed coaching catalog should use an honest empty state."
    );
    return;
  }

  await expectCardCount(
    page,
    Math.min(pageSize, coachingResources.length),
    "Coaching should use the same bounded initial page"
  );
  const firstCard = page.locator("[data-testid='exercise-card']").first();
  const href = await firstCard.getAttribute("href");
  assert(href?.startsWith("/coaching/"), "Coaching cards should link to coaching detail.");
  await Promise.all([
    page.waitForURL((url) => url.pathname === new URL(href, baseURL).pathname),
    firstCard.click(),
  ]);
  await assertPrimaryNav(page, "coaching");
  await expectVisible(
    page.getByRole("heading", { level: 1 }),
    "A reviewed coaching resource should have a detail page."
  );
}

function assertHeader(response, name, expected, label) {
  const actual = response.headers()[name.toLocaleLowerCase("en-US")];
  assert(actual, `${label} should include ${name}.`);
  if (expected instanceof RegExp) {
    assert(expected.test(actual), `${label} ${name} was ${actual}.`);
  } else {
    assert(actual === expected, `${label} ${name} was ${actual}.`);
  }
}

function cssDurationAtMost(value, maximumMilliseconds) {
  return value.split(",").every((duration) => {
    const normalized = duration.trim();
    const numeric = Number.parseFloat(normalized);
    if (!Number.isFinite(numeric)) return false;
    return normalized.endsWith("ms")
      ? numeric <= maximumMilliseconds
      : numeric * 1000 <= maximumMilliseconds;
  });
}

async function assertHttpSurface(page) {
  const exerciseUrl = `${baseURL}/exercise/${tiktokExercise.id}`;
  const coachingDetailUrl = `${baseURL}/coaching/${coachingResources[0].id}`;
  const [
    home,
    detail,
    coachingIndex,
    coachingDetail,
    privacy,
    robots,
    missing,
    missingExercise,
    missingCoaching,
  ] = await Promise.all([
    page.request.get(baseURL),
    page.request.get(exerciseUrl),
    page.request.get(`${baseURL}/coaching`),
    page.request.get(coachingDetailUrl),
    page.request.get(`${baseURL}/privacy`),
    page.request.get(`${baseURL}/robots.txt`),
    page.request.get(`${baseURL}${missingPath}`),
    page.request.get(`${baseURL}/exercise/__missing__`),
    page.request.get(`${baseURL}/coaching/__missing__`),
  ]);

  for (const [label, response] of [
    ["Home", home],
    ["Exercise detail", detail],
    ["Coaching index", coachingIndex],
    ["Coaching detail", coachingDetail],
    ["Privacy", privacy],
  ]) {
    assert(response.ok(), `${label} returned HTTP ${response.status()}.`);
    assertHeader(response, "X-Content-Type-Options", "nosniff", label);
    assertHeader(
      response,
      "Referrer-Policy",
      "strict-origin-when-cross-origin",
      label
    );
    assertHeader(response, "X-Frame-Options", "DENY", label);
    assertHeader(
      response,
      "Permissions-Policy",
      /camera=\(\).*microphone=\(\).*geolocation=\(\)/,
      label
    );
  }
  assertHeader(home, "Content-Security-Policy", /frame-src 'none'/, "Home");
  assertHeader(
    coachingIndex,
    "Content-Security-Policy",
    /frame-src 'none'/,
    "Coaching index"
  );
  assertHeader(
    privacy,
    "Content-Security-Policy",
    /frame-src 'none'/,
    "Privacy"
  );
  assertHeader(
    detail,
    "Content-Security-Policy",
    /frame-src https:\/\/www\.tiktok\.com/,
    "Exercise detail"
  );
  assertHeader(
    coachingDetail,
    "Content-Security-Policy",
    /frame-src https:\/\/www\.tiktok\.com/,
    "Coaching detail"
  );
  if (new URL(baseURL).protocol === "https:") {
    assertHeader(home, "Strict-Transport-Security", /max-age=/i, "HTTPS home");
  }

  assert(robots.ok(), `robots.txt returned HTTP ${robots.status()}.`);
  const robotsText = await robots.text();
  assert(/User-Agent:\s*\*/i.test(robotsText), "robots.txt should address all crawlers.");
  assert(/Allow:\s*\//i.test(robotsText), "robots.txt should allow the public site.");
  assert(
    /Sitemap:\s*https:\/\/o-tf-exercises\.vercel\.app\/sitemap\.xml/i.test(
      robotsText
    ),
    "robots.txt should point to the canonical sitemap."
  );

  assert(missing.status() === 404, `Missing route returned HTTP ${missing.status()}.`);
  assertHeader(
    missing,
    "Content-Security-Policy",
    /frame-src 'none'/,
    "Missing route"
  );
  const missingHtml = await missing.text();
  assert(
    /That movement is not here/i.test(missingHtml),
    "The true 404 response should contain branded recovery content."
  );

  for (const [label, response] of [
    ["Missing exercise detail", missingExercise],
    ["Missing coaching detail", missingCoaching],
  ]) {
    assert(
      response.status() === 404,
      `${label} returned HTTP ${response.status()}; expected a true 404.`
    );
    assertHeader(
      response,
      "Content-Security-Policy",
      /frame-src 'none'/,
      label
    );
    assert(
      !/frame-src https:\/\/www\.tiktok\.com/.test(
        response.headers()["content-security-policy"] ?? ""
      ),
      `${label} must not receive the valid-detail TikTok frame exception.`
    );
  }
}

async function assertLegacyRouteRecovery(page) {
  const [redirectId, redirectRoute] = legacyRedirectRoute;
  const redirectTarget = redirectRoute.targets[0];
  const legacyState = "q=cardio&category=cardio";
  const redirectSource = `${baseURL}/exercise/${redirectId}?${legacyState}`;
  const redirectResponse = await page.request.get(redirectSource, {
    maxRedirects: 0,
  });
  assert(
    redirectResponse.status() === 308,
    `Reviewed legacy redirect returned HTTP ${redirectResponse.status()}; expected 308.`
  );
  const redirectLocation = new URL(
    redirectResponse.headers().location,
    baseURL
  );
  assert(
    redirectLocation.pathname === redirectTarget.path &&
      redirectLocation.searchParams.get("q") === "cardio" &&
      redirectLocation.searchParams.getAll("category").join(",") ===
        "cardio",
    "A legacy exercise redirect should target its reviewed exercise and preserve directory state."
  );

  const followedRedirect = await page.goto(redirectSource, {
    waitUntil: "networkidle",
  });
  assert(
    followedRedirect?.status() === 200 &&
      new URL(page.url()).pathname === redirectTarget.path,
    "Following a legacy redirect should resolve to its live reviewed destination."
  );
  await assertPrimaryNav(page, "directory");

  const [splitId, splitRoute] = legacySplitRoute;
  const splitResponse = await page.goto(
    `${baseURL}/exercise/${splitId}?${legacyState}`,
    { waitUntil: "networkidle" }
  );
  assert(
    splitResponse?.status() === 200,
    `Legacy split recovery returned HTTP ${splitResponse?.status()}.`
  );
  await assertPrimaryNav(page, "directory");
  await expectVisible(
    page.getByRole("heading", { name: splitRoute.legacy_title, level: 1 }),
    "A split legacy listing should identify the reviewed former title."
  );
  await expectVisible(
    page.getByRole("heading", { name: "Reviewed destinations", level: 2 }),
    "A split legacy listing should explain its reviewed destinations."
  );
  const splitLinks = page.locator(
    "section[aria-labelledby='legacy-destinations'] a"
  );
  assert(
    (await splitLinks.count()) === splitRoute.targets.length,
    "A split recovery page should expose every reviewed destination exactly once."
  );
  const splitHrefs = await splitLinks.evaluateAll((links) =>
    links.map((link) => link.href)
  );
  for (const target of splitRoute.targets) {
    const targetUrl = splitHrefs
      .map((href) => new URL(href))
      .find((url) => url.pathname === target.path);
    assert(targetUrl, `Split recovery is missing ${target.path}.`);
    assert(
      targetUrl.searchParams.get("q") === "cardio",
      `${target.path} should preserve the legacy page search query.`
    );
    assert(
      targetUrl.searchParams.getAll("category").join(",") ===
        (target.kind === "exercise" ? "cardio" : ""),
      `${target.path} should carry only filters valid for its destination section.`
    );
  }

  const [removedId, removedRoute] = legacyRemovedRoute;
  const removedResponse = await page.goto(
    `${baseURL}/exercise/${removedId}?${legacyState}`,
    { waitUntil: "networkidle" }
  );
  assert(
    removedResponse?.status() === 200,
    `Legacy removed recovery returned HTTP ${removedResponse?.status()}.`
  );
  await assertPrimaryNav(page, "directory");
  await expectVisible(
    page.getByRole("heading", { name: removedRoute.legacy_title, level: 1 }),
    "A removed legacy listing should identify the reviewed former title."
  );
  await expectVisible(
    page.getByText(
      "This former listing is no longer published as an exercise after review.",
      { exact: false }
    ),
    "A removed legacy listing should explain why it no longer has a detail page."
  );
  assert(
    (await page
      .locator("section[aria-labelledby='legacy-destinations']")
      .count()) === 0,
    "A removed legacy listing must not invent replacement destinations."
  );
  await expectVisible(
    page.getByRole("link", { name: "Browse current exercises" }),
    "Legacy recovery should link to current exercises."
  );
  await expectVisible(
    page.getByRole("link", { name: "Browse coaching resources" }),
    "Legacy recovery should link to reviewed coaching resources."
  );
}

async function assertNotFoundRecovery(page) {
  const response = await page.goto(`${baseURL}${missingPath}`, {
    waitUntil: "networkidle",
  });
  assert(response?.status() === 404, "Unknown routes should retain a true 404 status.");
  await expectVisible(
    page.getByRole("heading", { name: "That movement is not here.", level: 1 }),
    "404 should render branded recovery guidance."
  );
  const form = page.getByRole("search");
  await expectVisible(
    form.getByRole("searchbox", { name: "Search the exercise directory" }),
    "404 should expose a plain GET directory search."
  );
  assert(
    (await form.getAttribute("method"))?.toLocaleLowerCase("en-US") === "get" &&
      new URL(await form.getAttribute("action"), baseURL).pathname === "/",
    "404 recovery search should submit GET / with q."
  );
  await expectVisible(
    page.getByRole("link", { name: "Browse all exercises" }),
    "404 should link back to the exercise directory."
  );
  await expectVisible(
    page.getByRole("link", { name: "Browse coaching resources" }),
    "404 should link to the coaching directory."
  );
}

async function assertReducedMotion(browser) {
  const label = "Chromium reduced motion 1280x900";
  const { context, page, assertClean } = await createPage(
    browser,
    {
      viewport: { width: 1280, height: 900 },
      reducedMotion: "reduce",
    },
    label
  );
  try {
    await gotoDirectory(page);
    const htmlScrollBehavior = await page.evaluate(
      () => getComputedStyle(document.documentElement).scrollBehavior
    );
    assert(
      htmlScrollBehavior === "auto",
      `Reduced motion should disable smooth document scrolling, found ${htmlScrollBehavior}.`
    );

    const card = page.locator("[data-testid='exercise-card']").first();
    await card.hover();
    const cardMotion = await card.evaluate((element) => {
      const computed = getComputedStyle(element);
      return {
        transform: computed.transform,
        transitionDuration: computed.transitionDuration,
      };
    });
    assert(
      cardMotion.transform === "none" || cardMotion.transform === "matrix(1, 0, 0, 1, 0, 0)",
      `Reduced motion should suppress hover translation, found ${cardMotion.transform}.`
    );
    assert(
      cssDurationAtMost(cardMotion.transitionDuration, 20),
      `Reduced motion should collapse transitions, found ${cardMotion.transitionDuration}.`
    );

    const filterTrigger = page.locator(
      "button[aria-controls='desktop-exercise-filters']"
    );
    await filterTrigger.click();
    const panel = page.locator("#desktop-exercise-filters");
    await expectVisible(panel, "Reduced-motion desktop filters should still open.");
    const panelAnimation = await panel.evaluate((element) => {
      const computed = getComputedStyle(element);
      return {
        name: computed.animationName,
        duration: computed.animationDuration,
        transform: computed.transform,
      };
    });
    assert(
      panelAnimation.name === "none" ||
        cssDurationAtMost(panelAnimation.duration, 20),
      `Reduced motion should suppress filter animation, found ${panelAnimation.name} ${panelAnimation.duration}.`
    );
    assert(
      panelAnimation.transform === "none" ||
        panelAnimation.transform === "matrix(1, 0, 0, 1, 0, 0)",
      `Reduced-motion filter panel should not translate, found ${panelAnimation.transform}.`
    );
    await assertClean();
    console.log(`PASS ${label}`);
  } finally {
    await context.close();
  }
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
      page
        .getByLabel("Active filters")
        .getByText("Category: Upper Body", { exact: true }),
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

async function assertTikTokBehavior(
  page,
  playerRequests,
  { assertFocus = true } = {}
) {
  const video = tiktokExercise.videos[0];
  await page.goto(`${baseURL}/exercise/${tiktokExercise.id}`, {
    waitUntil: "networkidle",
  });
  const play = page.getByRole("button", {
    name: `Play ${tiktokExercise.exercise_name} on TikTok`,
  });
  await expectVisible(play, "TikTok should initially render a local preview.");
  await expectVisible(
    play.getByText("Playing loads TikTok’s embedded player", { exact: true }),
    "TikTok preview should explain the third-party load before activation."
  );
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
  assert(
    (await iframe.getAttribute("referrerpolicy")) ===
      "strict-origin-when-cross-origin",
    "TikTok iframe should retain the expected strict-origin referrer policy."
  );
  assert(
    (await iframe.getAttribute("allowfullscreen")) !== null,
    "TikTok iframe should expose the allowfullscreen capability attribute."
  );
  assert(
    /(?:^|;)\s*fullscreen(?:;|$)/.test(
      (await iframe.getAttribute("allow")) ?? ""
    ),
    "TikTok iframe allow policy should include fullscreen capability."
  );
  if (assertFocus) {
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
  }
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
    await gotoDirectory(page);
    await assertUnofficialHeader(page, label);
    await assertPrimaryNav(page, "directory");
    await assertNoHorizontalOverflow(page, label);
    await expectCardCount(page, pageSize, "Desktop should render one bounded page");
    await expectVisible(
      page
        .getByRole("button", { name: /^Load \d+ more$/ })
        .or(page.getByRole("link", { name: /^Load \d+ more$/ }))
        .first(),
      "Desktop should paginate instead of rendering the full catalog."
    );
    await assertCatalogNotShipped(page);
    await assertSearchCategoryParity(page);
    await assertSingleSearchClear(page);
    await assertApiPagingPrefix(page);
    await assertMalformedUrlCanonicalization(page);
    await assertRapidSearchRace(page);
    await assertDelayedRequestCardNavigation(page);
    await assertJavaScriptPagingFocus(page);

    await gotoDirectory(page);
    await assertAuthoritativeDirectoryState(context, page);
    await assertLongestTitleDetail(page);
    await assertPrimaryNav(page, "directory");
    await assertInstagramBehavior(page);
    await assertPrimaryNav(page, "directory");
    await assertCoachingExperience(page);
    await assertSitemap(page);
    await assertHttpSurface(page);
    await assertLegacyRouteRecovery(page);
    await assertNotFoundRecovery(page);
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
    await assertUnofficialHeader(page, label);
    await assertPrimaryNav(page, "directory");
    await assertMobileFilterControl(page, label);
    await assertNoHorizontalOverflow(page, label);
    await loadMore(page, pageSize * 2);
    await assertSingleSearchClear(page);
    await clearSearch(page);
    await loadMore(page, pageSize * 2);
    await assertMobileDialog(page, { selectFilter: true });
    await assertNoHorizontalOverflow(page, `${label} filtered directory`);

    const detailName = await navigateFirstCard(page);
    await assertDetailOrder(page, detailName);
    await assertPrimaryNav(page, "directory");
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
    await assertUnofficialHeader(page, label);
    await assertPrimaryNav(page, "directory");
    await assertMobileFilterControl(page, label);
    await assertNoHorizontalOverflow(page, `${label} directory`);
    await loadMore(page, pageSize * 2);
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
    await assertPrimaryNav(page, "directory");
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

async function runDesktopWebKit(browser) {
  const label = "WebKit desktop 1280x900";
  const { context, page, assertClean } = await createPage(
    browser,
    { viewport: { width: 1280, height: 900 } },
    label
  );
  try {
    await gotoDirectory(page);
    await assertUnofficialHeader(page, label);
    await assertPrimaryNav(page, "directory");
    await assertNoHorizontalOverflow(page, label);
    await expectCardCount(page, pageSize, "WebKit desktop bounded first page");
    await loadMore(page, pageSize * 2);
    await page.waitForTimeout(2_000);
    await page.waitForLoadState("networkidle");
    await assertLongestTitleDetail(page);
    await assertPrimaryNav(page, "directory");
    await assertNoHorizontalOverflow(page, `${label} longest-title detail`);
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
  const playerRequests = [];
  page.on("request", (request) => {
    if (request.url().includes("https://www.tiktok.com/player/v1/")) {
      playerRequests.push(request.url());
    }
  });
  try {
    await gotoDirectory(page);
    await assertUnofficialHeader(page, label);
    await assertPrimaryNav(page, "directory");
    await assertMobileFilterControl(page, label);
    await assertNoHorizontalOverflow(page, label);
    await loadMore(page, pageSize * 2);
    await assertSingleSearchClear(page);
    await clearSearch(page);
    await assertMobileDialog(page, { selectFilter: false });
    const detailName = await navigateFirstCard(page);
    await assertDetailOrder(page, detailName);
    await assertPrimaryNav(page, "directory");
    await assertNoHorizontalOverflow(page, `${label} detail`);
    await assertTikTokBehavior(page, playerRequests, { assertFocus: false });
    await assertPrimaryNav(page, "directory");
    await assertNoHorizontalOverflow(page, `${label} activated TikTok iframe`);
    await assertClean();
    console.log(`PASS ${label}`);
  } finally {
    await context.close();
  }
}

async function runMobileWebKit320(browser) {
  const label = "WebKit mobile 320x844";
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
    await assertUnofficialHeader(page, label);
    await assertPrimaryNav(page, "directory");
    await assertMobileFilterControl(page, label);
    await assertNoHorizontalOverflow(page, `${label} directory`);
    await loadMore(page, pageSize * 2);
    const { dialog } = await openMobileFilters(page);
    const dialogBox = await dialog.boundingBox();
    assert(dialogBox, `${label} filter dialog should have a layout box.`);
    assert(
      dialogBox.x >= -1 && dialogBox.x + dialogBox.width <= 321,
      `${label} filter dialog should fit inside the viewport.`
    );
    await assertNoHorizontalOverflow(page, `${label} filter dialog`);
    await page.keyboard.press("Escape");
    await expectHidden(dialog, `${label} Escape should close filters.`);
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
    await assertReducedMotion(chromiumBrowser);
    await runNoJavaScriptAcceptance(chromiumBrowser);
  } finally {
    await chromiumBrowser.close();
  }

  const webkitBrowser = await webkit.launch({ headless: true });
  try {
    await runDesktopWebKit(webkitBrowser);
    await runMobileWebKit390(webkitBrowser);
    await runMobileWebKit320(webkitBrowser);
  } finally {
    await webkitBrowser.close();
  }

  console.log(
    `UI production smoke passed: ${exercises.length} exercises, ${coachingResources.length} coaching resources, 24-item paging.`
  );
}

run().catch((error) => {
  console.error(error.stack ?? error.message);
  process.exit(1);
});
