import { METRICS, PROFILES, formatValue, latest } from "../src/features/crew-health-data";
import { expect, test } from "./fixtures";

test.describe("astronaut profile", () => {
  for (const person of PROFILES) {
    test(`deep link renders ${person.name} with demographics and ten matching metrics`, async ({ page }) => {
      await page.goto(`/astronaut/${person.id}`);
      await expect(page.locator("#detail-title")).toHaveText(person.name);
      await expect(page.locator("#profile-role")).toHaveText(person.role);
      await expect(page.locator("#profile-age")).toHaveText(`${person.age} years`);
      await expect(page.locator("#profile-weight")).toHaveText(`${person.weightKg} kg`);
      await expect(page.locator("#profile-sex")).toHaveText(person.sex);
      await expect(page.locator(".metric-card")).toHaveCount(10);
      for (const metric of METRICS) {
        await expect(page.locator(`[data-metric='${metric.id}'] .metric-value`)).toContainText(formatValue(metric.id, latest(person.id, metric.id)));
      }
    });
  }

  test("metric selection updates the reference detail and chart heading", async ({ page }) => {
    await page.goto("/astronaut/mira-chen");
    await expect(page.locator("[data-metric='heartRate']")).toHaveAttribute("aria-pressed", "true");
    await page.locator("[data-metric='bloodPressure']").click();
    await expect(page.locator("[data-metric='bloodPressure']")).toHaveAttribute("aria-pressed", "true");
    await expect(page.locator("[data-metric='heartRate']")).toHaveAttribute("aria-pressed", "false");
    await expect(page.locator("#metric-reference")).toContainText("Blood pressure · Deviation");
    await expect(page.locator("#metric-reference")).toHaveAttribute("data-status", "demo-deviation");
    await expect(page.locator("#chart-metric-title")).toHaveText("Blood pressure");
  });

  test("authored alert state is shown on Sofia's heart rate", async ({ page }) => {
    await page.goto("/astronaut/sofia-alvarez");
    await expect(page.locator("[data-metric='heartRate']")).toHaveAttribute("data-status", "demo-alert");
    await expect(page.locator("[data-metric='heartRate'] .metric-status")).toHaveText("Alert");
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
