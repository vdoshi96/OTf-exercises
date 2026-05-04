import { readFile } from "node:fs/promises";
import { chromium } from "playwright";

const baseURL = process.env.BASE_URL ?? "http://localhost:3000";
const exercises = JSON.parse(
  await readFile(new URL("../src/data/exercises.json", import.meta.url), "utf8")
);
const detailExercise =
  exercises.find((exercise) => exercise.coaching_cues?.length > 0) ??
  exercises[0];

async function expectVisible(locator, message) {
  try {
    await locator.waitFor({ state: "visible", timeout: 7000 });
  } catch (error) {
    throw new Error(`${message}\n${error.message}`);
  }
}

async function run() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const consoleErrors = [];

  page.on("console", (message) => {
    if (message.type() === "error") {
      consoleErrors.push(message.text());
    }
  });

  try {
    await page.goto(baseURL, { waitUntil: "networkidle" });

    await expectVisible(
      page.getByRole("heading", {
        name: "Find the movement before class starts.",
      }),
      "Homepage should show the approved editorial hero headline."
    );
    await expectVisible(
      page.getByRole("searchbox", {
        name: "Search exercises",
      }),
      "Search should remain primary and visible near the top."
    );

    const filtersButton = page.getByRole("button", { name: /Filters/ });
    await expectVisible(
      filtersButton,
      "Collapsed filter control should be visible."
    );
    const initialExpanded = await filtersButton.getAttribute("aria-expanded");
    if (initialExpanded !== "false") {
      throw new Error("Filters should be collapsed by default.");
    }

    await filtersButton.click();
    await expectVisible(
      page.getByRole("button", { name: "Upper Body" }),
      "Expanded filters should expose category chips."
    );
    await page.getByRole("button", { name: "Upper Body" }).click();
    await filtersButton.click();
    await expectVisible(
      page.getByLabel("Active filters").getByText("Upper Body"),
      "Collapsed filters should show active filter chips inline."
    );

    await expectVisible(
      page.locator("[data-testid='exercise-card']").first(),
      "Exercise cards should render in the directory grid."
    );
    await expectVisible(
      page.locator("[data-testid='exercise-card'] img").first(),
      "Exercise cards should stay video-thumbnail led."
    );

    await page.goto(`${baseURL}/exercise/${detailExercise.id}`, {
      waitUntil: "networkidle",
    });
    await expectVisible(
      page.getByRole("heading", { name: detailExercise.exercise_name }),
      "Detail page should show the selected exercise heading."
    );
    await expectVisible(
      page.getByRole("heading", { name: "Video library" }),
      "Detail page should make the video area intentional."
    );
    await expectVisible(
      page.getByText("Movement Type"),
      "Detail page sidebar should preserve movement metadata."
    );

    if (consoleErrors.length > 0) {
      throw new Error(`Console errors found:\n${consoleErrors.join("\n")}`);
    }
  } finally {
    await browser.close();
  }
}

run().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
