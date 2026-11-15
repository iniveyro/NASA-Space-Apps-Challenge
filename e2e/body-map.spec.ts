import { expect, supportsWebgl, test } from "./fixtures";

test.describe("body map", () => {
  test("region buttons select their metric group by click and keyboard", async ({ page }) => {
    await page.goto("/astronaut/kanji");
    const callout = page.locator("#body-callout-text");
    await expect(callout).toHaveText("Regions are metric-navigation groups, not organ measurements.");

    await page.locator("[data-region='brain']").click();
    await expect(page.locator("[data-region='brain']")).toHaveAttribute("aria-pressed", "true");
    await expect(page.locator("[data-metric='sleep']")).toHaveAttribute("aria-pressed", "true");
    await expect(page.locator("#chart-metric-title")).toHaveText("Sleep");

    await page.locator("[data-region='heart']").focus();
    await expect(callout).toHaveText("Heart-associated readings: heart rate and blood pressure.");
    await page.keyboard.press("Enter");
    await expect(page.locator("[data-region='heart']")).toHaveAttribute("aria-pressed", "true");
    await expect(page.locator("[data-metric='heartRate']")).toHaveAttribute("aria-pressed", "true");

    await page.locator("[data-region='body']").focus();
    await page.keyboard.press("Space");
    await expect(page.locator("[data-metric='temperature']")).toHaveAttribute("aria-pressed", "true");
  });

  test("selecting a metric highlights its region", async ({ page }) => {
    await page.goto("/astronaut/kanji");
    await page.locator("[data-metric='mood']").click();
    await expect(page.locator("[data-region='brain']")).toHaveAttribute("aria-pressed", "true");
    // A metric the mission dataset does not record still navigates to its region.
    await page.locator("[data-metric='spo2']").click();
    await expect(page.locator("[data-region='body']")).toHaveAttribute("aria-pressed", "true");
  });

  test("region buttons carry the authored demo state of their grouped signals on the selected day", async ({ page }) => {
    await page.goto("/astronaut/sofia?day=211");
    await expect(page.locator("[data-region='heart']")).toHaveAttribute("data-state", "demo-alert");
    await expect(page.locator("[data-region='brain']")).toHaveAttribute("data-state", "within-demo-reference");
    await expect(page.locator("[data-region='body']")).toHaveAttribute("data-state", "within-demo-reference");
    await expect(page.locator("#body-region-state")).toHaveCount(0);
    await page.locator("[data-region='heart']").click();
    await expect(page.locator("#body-region-state")).toHaveAttribute("data-region-state", "demo-alert");
    await expect(page.locator("#body-region-state")).toContainText("Alert: Blood pressure");
    await expect(page.locator("#body-region-state")).toContainText("Authored demo state.");

    await page.goto("/astronaut/kanji?day=120");
    await expect(page.locator("[data-region='heart']")).toHaveAttribute("data-state", "demo-alert");
    await page.goto("/astronaut/kanji?day=493");
    await expect(page.locator("[data-region='heart']")).toHaveAttribute("data-state", "within-demo-reference");
    await expect(page.locator("[data-region='body']")).toHaveAttribute("data-state", "demo-deviation");
    await page.goto("/astronaut/ines");
    for (const region of ["brain", "heart", "body"]) {
      await expect(page.locator(`[data-region='${region}']`)).toHaveAttribute("data-state", "within-demo-reference");
    }
  });

  test("region states follow the mission-day selector", async ({ page }) => {
    await page.goto("/astronaut/sofia");
    await expect(page.locator("[data-region='heart']")).toHaveAttribute("data-state", "within-demo-reference");
    await expect(async () => {
      await page.locator("[data-event-day='211']").click();
      await expect(page.locator("#mission-day-selector")).toHaveAttribute("data-selected-day", "211", { timeout: 500 });
    }).toPass();
    await expect(page.locator("[data-region='heart']")).toHaveAttribute("data-state", "demo-alert");
    await page.locator("#mission-day-latest").click();
    await expect(page.locator("[data-region='heart']")).toHaveAttribute("data-state", "within-demo-reference");
  });

  test("shows the 3D figure where WebGL exists and keeps the 2D silhouette available", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/astronaut/sofia?day=211");
    const panel = page.locator(".body-panel");
    const stage = page.locator("#body-stage");
    if (!(await supportsWebgl(page))) {
      await expect(panel).toHaveAttribute("data-body-mode", "2d");
      await expect(page.locator("#body-model polygon").first()).toBeVisible();
      return;
    }
    await expect(panel).toHaveAttribute("data-body-mode", "3d");
    await stage.scrollIntoViewIfNeeded();
    await expect(stage).toHaveAttribute("data-scene-ready", "true", { timeout: 20_000 });
    await expect(stage).toHaveAttribute("aria-label", /Heart: Alert/);
    await expect(stage.locator("[data-callout='heart']")).toContainText("Alert");
    await expect(stage.locator("[data-callout='heart']")).toContainText("BP ");
    await expect(page.locator(".body-panel")).toContainText("The pulse marker beats at the simulated heart-rate reading");

    // The brain callout sits level with the head, which stays on the figure's vertical axis.
    const frame = (await stage.boundingBox())!;
    const callout = (await stage.locator("[data-callout='brain'] div").boundingBox())!;
    await page.mouse.click(frame.x + frame.width / 2, callout.y + callout.height / 2);
    await expect(page.locator("[data-region='brain']")).toHaveAttribute("aria-pressed", "true");
    await expect(page.locator("[data-metric='sleep']")).toHaveAttribute("aria-pressed", "true");

    await page.locator("button[data-body-mode='2d']").click();
    await expect(panel).toHaveAttribute("data-body-mode", "2d");
    await expect(stage.locator("canvas")).toHaveCount(0);
    await expect(page.locator("#body-model polygon").first()).toBeVisible();
    await page.locator("button[data-body-mode='3d']").click();
    await expect(stage).toHaveAttribute("data-scene-ready", "true", { timeout: 20_000 });
  });

  test("the illustration renders and its head polygons select the brain group", async ({ page }) => {
    await page.goto("/astronaut/kanji");
    const polygons = page.locator("#body-model polygon");
    await expect(polygons.first()).toBeAttached();
    const headIndex = await polygons.evaluateAll((nodes) =>
      nodes.findIndex((node) => {
        const values = (node.getAttribute("points") ?? "").trim().split(/[\s,]+/).map(Number);
        const ys = values.filter((_, index) => index % 2 === 1);
        return Math.min(...ys) < 25;
      }),
    );
    expect(headIndex).toBeGreaterThanOrEqual(0);
    await polygons.nth(headIndex).dispatchEvent("click");
    await expect(page.locator("[data-region='brain']")).toHaveAttribute("aria-pressed", "true");
    await expect(page.locator("[data-metric='sleep']")).toHaveAttribute("aria-pressed", "true");
  });
});
