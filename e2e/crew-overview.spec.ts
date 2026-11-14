import { PROFILES, formatValue, getSeries, latest } from "../src/features/crew-health-data";
import { expect, test } from "./fixtures";

test.describe("crew overview", () => {
  test("shows four crew cards with four vitals and an SpO₂ ring each, matching the data module", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveTitle("ASTRA Health · Crew wellness");
    await expect(page.getByRole("heading", { level: 1, name: "Crew overview" })).toBeVisible();
    await expect(page.locator("#environment-label")).toHaveText("ENVIRONMENT · MICROGRAVITY");
    const cards = page.locator(".crew-card");
    await expect(cards).toHaveCount(4);

    for (const [index, person] of PROFILES.entries()) {
      const card = cards.nth(index);
      await expect(card.locator(".crew-name")).toHaveText(person.name);
      const vitals = card.locator("[data-metric-readout]:not([data-metric-readout='spo2'])");
      await expect(vitals).toHaveCount(4);
      for (const metricId of ["heartRate", "bloodPressure", "temperature", "radiation"]) {
        await expect(card.locator(`[data-metric-readout='${metricId}'] .vital-value`)).toContainText(formatValue(metricId, latest(person.id, metricId)));
      }
      await expect(card.locator(".oxygen-value")).toHaveText(`${formatValue("spo2", latest(person.id, "spo2"))}%`);
      const sevenDays = getSeries(person.id, "heartRate", 7).map((point) => point.value).join(", ");
      await expect(card.locator(".mini-sparkline")).toHaveAttribute("aria-label", `Seven daily fictional heart-rate readings: ${sevenDays} beats per minute`);
    }
  });

  test("shows concise non-color scenario labels and independent activity state", async ({ page }) => {
    await page.goto("/");
    const statuses = await page.locator(".crew-card .metric-status").allTextContents();
    expect(statuses).toContain("Alert");
    expect(statuses).toContain("Deviation");
    expect(statuses).toContain("Reference");
    await expect(page.locator(".crew-card").nth(3)).toContainText("Resting");
    await expect(page.locator(".crew-card").nth(3)).toContainText("Stable");
  });

  test("each full card navigates to its profile by click and keyboard, with history", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("link", { name: "Open Sofia Alvarez profile" }).click();
    await expect(page).toHaveURL(/\/astronaut\/sofia-alvarez$/);
    await expect(page.getByRole("heading", { level: 1, name: "Sofia Alvarez" })).toBeVisible();
    await expect(page).toHaveTitle("ASTRA Health · Sofia Alvarez");

    await page.goBack();
    await expect(page).toHaveURL(/\/$/);
    await expect(page.locator(".crew-card")).toHaveCount(4);
    await page.goForward();
    await expect(page.getByRole("heading", { level: 1, name: "Sofia Alvarez" })).toBeVisible();

    await page.getByRole("link", { name: "← Back to crew overview" }).click();
    await expect(page).toHaveURL(/\/$/);
    await page.getByRole("link", { name: "Open Noah Williams profile" }).focus();
    await page.keyboard.press("Enter");
    await expect(page.getByRole("heading", { level: 1, name: "Noah Williams" })).toBeVisible();
  });
});
