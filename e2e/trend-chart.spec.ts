import { formatShortDate } from "../src/shared/lib/format-date";
import { expect, test } from "./fixtures";
import { DATA, TOTAL, datasetValue } from "./mission-dataset";

const heartRateTooltip = (crewId: string, day: number) => `${formatShortDate(DATA.days[day - 1].date)} · Heart rate: ${datasetValue(crewId, "heartRate", day)} bpm`;

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
    await page.locator("[data-metric='mood']").click();
    await expect(page.locator("#trend-chart .chart-line")).toHaveCount(0);
    await expect(page.locator("#trend-chart .chart-mark")).toHaveCount(30);
  });

  test("pointer and keyboard show the nearest reading of the mission dataset", async ({ page }) => {
    await page.goto("/astronaut/ines");
    const tooltip = page.locator("#chart-tooltip");
    await expect(tooltip).toBeHidden();
    // The body-map illustration is created in an effect, so its polygons signal that hydration finished.
    await expect(page.locator("#body-model polygon").first()).toBeAttached();
    const chart = page.locator("#trend-chart");
    const box = (await chart.boundingBox())!;
    await chart.hover({ position: { x: box.width - 4, y: box.height / 2 } });
    await expect(tooltip).toBeVisible();
    await expect(tooltip).toHaveText(heartRateTooltip("ines", TOTAL));

    await page.locator("[data-days='7']").click();
    await page.locator("#trend-chart [data-point='0']").focus();
    await expect(tooltip).toHaveText(heartRateTooltip("ines", TOTAL - 6));
  });

  test("the history window ends at the selected mission day and is clipped at day 1", async ({ page }) => {
    await page.goto("/astronaut/ines?day=211");
    await expect(page.locator("#trend-chart [data-point]")).toHaveCount(30);
    await expect(page.locator("#trend-chart [data-point='29']")).toHaveAttribute("aria-label", heartRateTooltip("ines", 211));
    await expect(page.locator("#trend-chart [data-point='0']")).toHaveAttribute("aria-label", heartRateTooltip("ines", 182));

    await page.goto("/astronaut/ines?day=3");
    await expect(page.locator("#trend-chart [data-point]")).toHaveCount(3);
    await expect(page.locator("#trend-chart [data-point='0']")).toHaveAttribute("aria-label", heartRateTooltip("ines", 1));

    await page.goto("/astronaut/ines?day=1");
    await expect(page.locator("#trend-chart [data-point]")).toHaveCount(1);
    await page.locator("[data-metric='bloodPressure']").click();
    await expect(page.locator("#trend-chart .chart-mark")).toHaveCount(2);
    await page.locator("[data-metric='sleep']").click();
    await expect(page.locator("#trend-chart .chart-bar")).toHaveCount(1);
  });

  test("metrics the mission dataset does not record show an empty state instead of a chart", async ({ page }) => {
    await page.goto("/astronaut/ines");
    await expect(page.locator("#trend-chart")).toBeVisible();
    await expect(page.locator("#chart-empty")).toHaveCount(0);
    for (const metricId of ["spo2", "activity", "stress"]) {
      await page.locator(`[data-metric='${metricId}']`).click();
      await expect(page.locator("#chart-empty")).toHaveText("No readings recorded for this metric in the mission dataset.");
      await expect(page.locator("#trend-chart")).toHaveCount(0);
      await page.locator("[data-days='7']").click();
      await expect(page.locator("#chart-empty")).toBeVisible();
      await page.locator("[data-days='30']").click();
    }
    await page.locator("[data-metric='heartRate']").click();
    await expect(page.locator("#chart-empty")).toHaveCount(0);
    await expect(page.locator("#trend-chart [data-point]")).toHaveCount(30);
  });
});
