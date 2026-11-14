import { expect, test } from "./fixtures";

test.describe("body map", () => {
  test("region buttons select their metric group by click and keyboard", async ({ page }) => {
    await page.goto("/astronaut/elias-okafor");
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
    await page.goto("/astronaut/elias-okafor");
    await page.locator("[data-metric='stress']").click();
    await expect(page.locator("[data-region='brain']")).toHaveAttribute("aria-pressed", "true");
  });

  test("the illustration renders and its head polygons select the brain group", async ({ page }) => {
    await page.goto("/astronaut/elias-okafor");
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
