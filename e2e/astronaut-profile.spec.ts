import { METRICS, PROFILES } from "../src/features/crew-health-data";
import { expect, test } from "./fixtures";
import { DATA, TOTAL, datasetValue, daySelector, selectDay } from "./mission-dataset";
import type { Page } from "@playwright/test";

const metricValue = (page: Page, metricId: string) => page.locator(`[data-metric='${metricId}'] .metric-value`).filter({ visible: true });

async function expectMetricsMatchDay(page: Page, crewId: string, day: number) {
  for (const metric of METRICS) {
    await expect(metricValue(page, metric.id)).toContainText(datasetValue(crewId, metric.id, day));
  }
}

test.describe("astronaut profile", () => {
  for (const person of PROFILES) {
    test(`deep link renders ${person.name} with demographics and the latest mission-day readings`, async ({ page }) => {
      await page.goto(`/astronaut/${person.id}`);
      await expect(page.locator("#detail-title")).toHaveText(person.name);
      await expect(page.locator("#profile-role")).toHaveText(person.role);
      await expect(page.locator("#profile-age")).toHaveText(`${person.age} years`);
      await expect(page.locator("#profile-weight")).toHaveText(`${person.weightKg} kg`);
      await expect(page.locator("#profile-sex")).toHaveText(person.sex);
      await expect(page.locator("#health-status, #activity-status")).toHaveCount(0);
      await expect(page.locator(".metric-card")).toHaveCount(10);
      await expect(daySelector(page)).toHaveAttribute("data-selected-day", String(TOTAL));
      await expect(page.locator("#readings-title")).toHaveText("Latest readings");
      await expectMetricsMatchDay(page, person.id, TOTAL);
      for (const metricId of ["spo2", "activity", "stress"]) {
        await expect(metricValue(page, metricId)).not.toHaveText("Unknown");
      }
      await expect(page.locator("#metric-grid")).not.toContainText(/NaN|undefined/);
    });
  }

  test("metric selection updates the reference detail and chart heading", async ({ page }) => {
    await page.goto("/astronaut/kanji");
    await expect(page.locator("[data-metric='heartRate']")).toHaveAttribute("aria-pressed", "true");
    await page.locator("[data-metric='bloodPressure']").click();
    await expect(page.locator("[data-metric='bloodPressure']")).toHaveAttribute("aria-pressed", "true");
    await page.keyboard.press("Escape");
    await expect(page.locator("[data-metric='heartRate']")).toHaveAttribute("aria-pressed", "false");
    await expect(page.locator("#metric-reference")).toContainText("Blood pressure · Reference");
    await expect(page.locator("#metric-reference")).toContainText(`${datasetValue("kanji", "bloodPressure", TOTAL)} mmHg`);
    await expect(page.locator("#metric-reference")).toHaveAttribute("data-status", "within-demo-reference");
    await expect(page.locator("#chart-metric-title")).toHaveText("Blood pressure");

    await page.locator("[data-metric='spo2']").click();
    await page.keyboard.press("Escape");
    await expect(page.locator("#metric-reference")).toContainText("SpO₂ · Reference");
    await expect(page.locator("#metric-reference")).toContainText(`${datasetValue("kanji", "spo2", TOTAL)} %`);
    await expect(page.locator("#metric-reference")).toHaveAttribute("data-status", "within-demo-reference");
    await expect(page.locator("#metric-reference")).not.toContainText(/NaN|undefined/);
  });

  test("Inés's SpO₂ reads as an authored alert during the surface EVA on day 518", async ({ page }) => {
    await page.goto("/astronaut/ines?day=518");
    await expect(daySelector(page)).toHaveAttribute("data-selected-day", "518");
    await expect(metricValue(page, "spo2")).toContainText("89");
    await expect(page.locator("[data-metric='spo2']")).toHaveAttribute("data-status", "demo-alert");
    await expect(page.locator("[data-metric='spo2'] .metric-status")).toContainText("Alert");
    await expectMetricsMatchDay(page, "ines", 518);

    await page.goto("/astronaut/ines?day=519");
    await expect(page.locator("[data-metric='spo2']")).toHaveAttribute("data-status", "within-demo-reference");
  });

  test("authored states follow the mission day on Sofía's blood pressure and Kanji's heart rate", async ({ page }) => {
    await page.goto("/astronaut/sofia?day=211");
    await expect(daySelector(page)).toHaveAttribute("data-selected-day", "211");
    await expect(page.locator("#readings-title")).toHaveText("Day 211 readings");
    await expect(page.getByText("Fictional point readings · 12 Jun 2027")).toBeVisible();
    await expect(page.locator("[data-metric='bloodPressure']")).toHaveAttribute("data-status", "demo-alert");
    await page.locator("[data-metric='bloodPressure']").click();
    await page.keyboard.press("Escape");
    await expect(page.locator("[data-metric='bloodPressure'] .metric-status")).toContainText("Alert");
    await expect(page.locator("#metric-reference")).toContainText(`${datasetValue("sofia", "bloodPressure", 211)} mmHg`);
    await expect(page.locator("[data-metric='heartRate']")).toHaveAttribute("data-status", "within-demo-reference");

    await page.goto("/astronaut/kanji?day=120");
    await expect(page.locator("[data-metric='heartRate']")).toHaveAttribute("data-status", "demo-alert");
    await page.locator("[data-metric='heartRate']").click();
    await expect(page.locator("[data-metric='heartRate'] .metric-status")).toContainText("Alert");
    await page.keyboard.press("Escape");
    await expect(page.locator("#metric-reference")).toContainText("Heart rate · Alert");
    await expectMetricsMatchDay(page, "kanji", 120);

    await page.goto("/astronaut/sofia");
    await expect(page.locator("[data-metric='bloodPressure']")).toHaveAttribute("data-status", "within-demo-reference");
    await page.locator("[data-metric='bloodPressure']").click();
    await page.keyboard.press("Escape");
    await expect(page.locator("[data-metric='bloodPressure'] .metric-status")).toContainText("Reference");
  });

  test("changing the mission day updates the readings and the address, and Latest returns to the last day", async ({ page }) => {
    await page.goto("/astronaut/ines");
    await expect(page).toHaveURL(/\/astronaut\/ines$/);
    await expect(page.locator("#mission-day-latest")).toBeDisabled();

    await page.locator("[data-metric='bloodPressure']").click();
    await page.keyboard.press("Escape");
    await page.locator("[data-days='7']").click();
    await selectDay(page, 211);
    await expect(page).toHaveURL(/\/astronaut\/ines\?day=211$/);
    await expect(page.locator("#readings-title")).toHaveText("Day 211 readings");
    await expectMetricsMatchDay(page, "ines", 211);
    // Changing the day keeps the selected metric and chart range.
    await expect(page.locator("[data-metric='bloodPressure']")).toHaveAttribute("aria-pressed", "true");
    await expect(page.locator("[data-days='7']")).toHaveAttribute("aria-pressed", "true");
    await expect(page.locator("#metric-reference")).toContainText(`${datasetValue("ines", "bloodPressure", 211)} mmHg`);

    await page.locator("#mission-day-next").click();
    await expect(daySelector(page)).toHaveAttribute("data-selected-day", "212");
    await expect(page).toHaveURL(/\/astronaut\/ines\?day=212$/);
    await expectMetricsMatchDay(page, "ines", 212);

    await page.locator("[data-event-day='493']").click();
    await expect(page).toHaveURL(/\/astronaut\/ines\?day=493$/);
    await expect(page.locator("[data-metric='radiation']")).toHaveAttribute("data-status", "demo-alert");
    await expect(page.locator("[data-metric='radiation']")).toHaveAttribute("data-guidance-status", "critical");

    await expect(page.locator("#mission-day-latest")).toBeEnabled();
    await page.locator("#mission-day-latest").click();
    await expect(daySelector(page)).toHaveAttribute("data-selected-day", String(TOTAL));
    await expect(page).toHaveURL(/\/astronaut\/ines$/);
    await expect(page.locator("#mission-day-latest")).toBeDisabled();
    await expect(page.locator("#readings-title")).toHaveText("Latest readings");
    await expectMetricsMatchDay(page, "ines", TOTAL);

    // A reload opens the day kept in the address bar.
    await selectDay(page, 120);
    await expect(page).toHaveURL(/\/astronaut\/ines\?day=120$/);
    await page.reload();
    await expect(daySelector(page)).toHaveAttribute("data-selected-day", "120");
    await expectMetricsMatchDay(page, "ines", 120);
  });

  test("a missing, invalid, or out-of-range day resolves to a valid mission day", async ({ page }) => {
    for (const [query, day] of [["?day=abc", TOTAL], ["?day=9999", TOTAL], ["?day=", TOTAL], ["?day=0", 1], ["?day=-7", 1], ["?day=120.4", 120]] as const) {
      await page.goto(`/astronaut/malik${query}`);
      await expect(daySelector(page)).toHaveAttribute("data-selected-day", String(day));
      await expect(page.locator(".metric-card")).toHaveCount(10);
      await expectMetricsMatchDay(page, "malik", day);
      await expect(page.locator("#detail-view")).not.toContainText(/NaN|undefined/);
    }
    await expect(page.locator("#readings-title")).toHaveText("Day 120 readings");
    expect(DATA.days[119].date).toBe("2027-03-13");
    await expect(page.getByText("Fictional point readings · 13 Mar 2027")).toBeVisible();
  });

  test("unknown profile ids render the not-found page", async ({ page, browserErrors }) => {
    // With Cache Components the static shell may already be streaming, so Next keeps HTTP 200
    // and renders the not-found UI with a noindex tag (documented framework behavior).
    const response = await page.goto("/astronaut/unknown-person");
    expect([200, 404]).toContain(response?.status());
    await expect(page.getByRole("heading", { level: 1, name: "Profile not found" })).toBeVisible();
    await expect(page.locator("meta[name='robots'][content='noindex']")).toHaveCount(1);
    await expect(page.locator(".metric-card")).toHaveCount(0);
    await page.getByRole("link", { name: "← Back to crew overview" }).click();
    await expect(page.locator(".crew-card")).toHaveCount(4);
    // A 404 document response is logged by the browser as a console error; that one is expected.
    browserErrors.splice(0, browserErrors.length, ...browserErrors.filter((message) => !message.includes("404")));
  });
});
