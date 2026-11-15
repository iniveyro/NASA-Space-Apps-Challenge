import { expect, test } from "./fixtures";

test.describe("trend chart", () => {
  test("switches between 30 and 7 day ranges", async ({ page }) => {
    await page.goto("/astronaut/kanji");
    await expect(page.locator("#chart-range-label")).toHaveText("LAST 30 DAYS");
    await expect(page.locator("#trend-chart [data-point]")).toHaveCount(30);
    await page.locator("[data-days='7']").click();
    await expect(page.locator("[data-days='7']")).toHaveAttribute("aria-pressed", "true");
    await expect(page.locator("#chart-range-label")).toHaveText("LAST 7 DAYS");
    await expect(page.locator("#trend-chart [data-point]")).toHaveCount(7);
  });

  test("blood pressure keeps systolic and diastolic as separate series", async ({ page }) => {
    await page.goto("/astronaut/ines");
    await page.locator("[data-metric='bloodPressure']").click();
    await expect(page.locator("#trend-chart .chart-line")).toHaveCount(2);
    await expect(page.locator("#chart-legend")).toHaveText(/Systolic\s*Diastolic/);
  });

  test("bar and category metrics render their own mark types", async ({ page }) => {
    await page.goto("/astronaut/ines");
    await page.locator("[data-metric='sleep']").click();
    await expect(page.locator("#trend-chart .chart-bar")).toHaveCount(30);
    await page.getByRole("button", { name: "Close health guidance" }).click();
    await page.locator("[data-metric='mood']").click();
    await expect(page.locator("#trend-chart .chart-line")).toHaveCount(0);
    await expect(page.locator("#trend-chart .chart-mark")).toHaveCount(30);
  });

  test("pointer and keyboard show the nearest reading", async ({ page }) => {
    await page.goto("/astronaut/ines");
    const tooltip = page.locator("#chart-tooltip");
    await expect(tooltip).toBeHidden();
    // The body-map illustration is created in an effect, so its polygons signal that hydration finished.
    await expect(page.locator("#body-model polygon").first()).toBeAttached();
    const chart = page.locator("#trend-chart");
    const box = (await chart.boundingBox())!;
    await chart.hover({ position: { x: box.width - 4, y: box.height / 2 } });
    await expect(tooltip).toBeVisible();
    await expect(tooltip).toHaveText("Jun 12 · Heart rate: 61 bpm");

    await page.locator("[data-days='7']").click();
    await page.locator("#trend-chart [data-point='0']").focus();
    await expect(tooltip).toHaveText("Jun 6 · Heart rate: 64 bpm");
  });
});
