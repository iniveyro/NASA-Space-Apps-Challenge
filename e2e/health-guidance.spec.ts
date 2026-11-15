import { METRICS } from "../src/features/crew-health-data";
import { expect, test } from "./fixtures";

test.describe("educational health guidance", () => {
  test("every metric card opens its guide and keeps the existing selection behavior", async ({ page }, testInfo) => {
    await page.goto("/astronaut/ines");
    for (const metric of METRICS) {
      await page.locator(`[data-metric='${metric.id}']`).click();
      await expect(page.getByRole("dialog")).toBeVisible();
      await expect(page.getByRole("dialog").locator("h2")).toBeVisible();
      await expect(page.getByText("Every guide needs medical review")).toBeVisible();
      if (metric.id === METRICS[0].id) {
        await page.screenshot({ path: testInfo.outputPath("health-guidance-desktop.png"), fullPage: true });
        await page.setViewportSize({ width: 390, height: 844 });
        await page.screenshot({ path: testInfo.outputPath("health-guidance-mobile.png"), fullPage: true });
        await page.setViewportSize({ width: 1280, height: 900 });
      }
      await page.getByRole("button", { name: "Close health guidance" }).click();
      await expect(page.getByRole("dialog")).not.toBeVisible();
    }
    await expect(page.locator("[data-metric='radiation']")).toHaveAttribute("aria-pressed", "true");
    await expect(page.locator("#chart-metric-title")).toHaveText("Cumulative radiation");
  });

  test("reversible A/B/C simulations are scoped and do not confuse status with sleeping", async ({ page }) => {
    await page.goto("/astronaut/ines");
    await page.getByRole("button", { name: /A · Short sleep/ }).click();
    await expect(page.locator("[data-metric='sleep'] .metric-value")).toContainText("5.2");
    await expect(page.locator("[data-metric='sleep']")).toHaveAttribute("data-status", "demo-deviation");
    await page.locator("[data-metric='sleep']").click();
    await expect(page.locator("dialog[open] [aria-label='Current reading']")).toContainText("Warning · simulated");
    await page.getByRole("button", { name: "Close health guidance" }).click();

    await page.getByRole("button", { name: /B · Respiratory symptoms/ }).click();
    await expect(page.locator("[data-metric='spo2'] .metric-value")).toContainText("91");
    await page.locator("[data-metric='spo2']").click();
    await expect(page.locator("dialog[open] aside[role='alert']")).toContainText("number appears normal");
    await expect(page.getByText("Activity state: sleeping")).toBeVisible();
    await page.getByLabel("New SpO₂ (%)").fill("99");
    await page.getByRole("button", { name: "Save follow-up" }).click();
    await expect(page.locator("[data-metric='spo2']")).toHaveAttribute("data-guidance-status", "critical");
    await expect(page.getByText("Current reading: 99 %")).toBeVisible();
    await page.getByRole("button", { name: "Close health guidance" }).click();
    await page.locator("[data-metric='spo2']").click();
    await expect(page.getByText("Reported symptoms: Trouble breathing")).toBeVisible();
    await expect(page.getByText("Initial: CRITICAL")).toBeVisible();
    await page.getByRole("button", { name: "Close health guidance" }).click();

    await page.getByRole("button", { name: /C · Radiation environmental event/ }).click();
    await page.locator("[data-metric='radiation']").click();
    await expect(page.locator("dialog[open] aside[role='alert']")).toContainText("Active-event procedure");
    await expect(page.getByText("Current reading: 153.09 mSv")).toBeVisible();
    await page.getByLabel("New Cumulative radiation (mSv)").fill("153.1");
    await page.getByRole("button", { name: "Save follow-up" }).click();
    await expect(page.locator("[data-metric='radiation']")).toHaveAttribute("data-guidance-status", "critical");
    await expect(page.getByText("Current reading: 153.10 mSv")).toBeVisible();
    await expect(page.getByText(/active simulated environmental event/i)).toBeVisible();
    await page.getByRole("button", { name: "Close health guidance" }).click();
    await page.getByRole("button", { name: "Exit simulation" }).click();
    await page.goto("/astronaut/kanji");
    await expect(page.locator("[data-metric='sleep'] .metric-value")).not.toContainText("5.2");
  });

  test("logs actions, paired follow-up, resolution, and history across reload", async ({ page }) => {
    await page.goto("/astronaut/sofia");
    await page.locator("[data-metric='bloodPressure']").click();
    const dialog = page.getByRole("dialog");
    const action = dialog.getByRole("checkbox", { name: "Mark action 1 complete" });
    await action.check();
    await action.uncheck();
    await action.check();
    await dialog.getByRole("button", { name: "Record simulated escalation" }).click();
    await dialog.getByLabel("Systolic (mmHg)").fill("118");
    await dialog.getByLabel("Diastolic (mmHg)").fill("72");
    await dialog.getByRole("button", { name: "Save follow-up" }).click();
    await expect(dialog.getByRole("status")).toContainText("Follow-up saved");
    await expect(dialog.getByText("Current reading: 118/72 mmHg")).toBeVisible();
    await expect(dialog.locator("[aria-label='Current reading']")).toContainText("Unknown · not normal");
    await expect(dialog.locator("li p").filter({ hasText: /Follow-up .* unknown/ })).toBeVisible();
    await dialog.getByLabel("Resolution reason").fill("Reviewed for demo history");
    await dialog.getByRole("button", { name: "Record resolution" }).click();
    await expect(dialog.getByText(/Resolved manually: Reviewed for demo history/)).toBeVisible();
    await page.reload();
    await page.locator("[data-metric='bloodPressure']").click();
    await expect(page.getByRole("dialog").getByText("Event history (1)")).toBeVisible();
    await expect(page.getByRole("dialog").getByText(/Follow-up .* unknown/)).toBeVisible();
    const auditActions = page.getByRole("dialog").locator("li p").filter({ hasText: /^Action:/ });
    await expect(auditActions).toHaveCount(3);
    await expect(auditActions.filter({ hasText: /— checked ·/ })).toHaveCount(2);
    await expect(auditActions.filter({ hasText: /— unchecked ·/ })).toHaveCount(1);
    await expect(page.getByRole("dialog").getByText(/Simulated escalation: .*no message sent/)).toBeVisible();
    await expect(page.getByLabel("Mark action 1 complete")).not.toBeChecked();
    await expect(page.getByRole("dialog").locator("li p").filter({ hasText: "Current: UNKNOWN" })).toContainText("118/72 mmHg");
  });

  test("keeps malformed browser history visible and untouched until an explicit clear", async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem("astro-health.educational-guidance.v1", "not-json"));
    await page.goto("/astronaut/ines");
    await page.locator("[data-metric='heartRate']").click();
    await expect(page.getByRole("status")).toContainText("Stored history remains unreadable");
    await expect(page.getByText("Event history (1)")).toBeVisible();
    await page.getByRole("button", { name: "Clear local history" }).click();
    await expect(page.getByRole("status")).toContainText("cleared");
  });

  test("falls back to visible session-only events when browser storage is blocked", async ({ page }) => {
    await page.addInitScript(() => Object.defineProperty(window, "localStorage", {
      configurable: true,
      get() { throw new DOMException("Storage access denied", "SecurityError"); },
    }));
    await page.goto("/astronaut/ines");
    await page.locator("[data-metric='heartRate']").click();
    await expect(page.getByRole("status")).toContainText("Browser storage is unavailable");
    await expect(page.getByText("Event history (1)")).toBeVisible();
  });

  test("falls back visibly when browser storage writes fail", async ({ page }) => {
    await page.addInitScript(() => {
      const original = Storage.prototype.setItem;
      Storage.prototype.setItem = function (key, value) {
        if (key === "astro-health.educational-guidance.v1") throw new DOMException("Quota exceeded", "QuotaExceededError");
        return original.call(this, key, value);
      };
    });
    await page.goto("/astronaut/ines");
    await page.locator("[data-metric='heartRate']").click();
    await expect(page.getByRole("status")).toContainText("Browser storage is unavailable");
    await expect(page.getByText("Event history (1)")).toBeVisible();
  });

  test("keeps the original malformed payload after nested schema corruption", async ({ page }) => {
    const malformed = JSON.stringify([{ schemaVersion: 2, id: "corrupt", astronautId: "ines", metricId: "heartRate", readingId: "r", evaluation: { status: "normal" }, currentEvaluation: { status: "normal" }, actions: [{ at: "invalid" }], followUps: [], escalations: [], contextHistory: [], createdAt: "not-a-date", updatedAt: "not-a-date" }]);
    await page.addInitScript((value) => localStorage.setItem("astro-health.educational-guidance.v1", value), malformed);
    await page.goto("/astronaut/ines");
    await page.locator("[data-metric='heartRate']").click();
    await expect(page.getByRole("status")).toContainText("Stored history remains unreadable");
    await page.getByRole("checkbox", { name: "Mark action 1 complete" }).check();
    expect(await page.evaluate(() => localStorage.getItem("astro-health.educational-guidance.v1"))).toBe(malformed);
  });

  test("supports native dialog Escape and returns focus to the selected card", async ({ page }) => {
    await page.goto("/astronaut/ines");
    const card = page.locator("[data-metric='heartRate']");
    await card.focus();
    await page.keyboard.press("Enter");
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    const before = await page.evaluate(() => document.activeElement?.getAttribute("aria-label"));
    await page.keyboard.press("Tab");
    expect(await page.evaluate(() => document.activeElement?.getAttribute("aria-label"))).not.toBe(before);
    await page.keyboard.press("Escape");
    await expect(dialog).not.toBeVisible();
    await expect(card).toBeFocused();
  });

  test("opens the local guide and records actions while offline without contacting an API", async ({ page }) => {
    const apiRequests: string[] = [];
    page.on("request", (request) => { if (new URL(request.url()).pathname.startsWith("/api/")) apiRequests.push(request.url()); });
    await page.goto("/astronaut/ines");
    await expect(page.locator("#body-model polygon").first()).toBeAttached();
    await page.waitForLoadState("networkidle");
    await page.context().setOffline(true);
    await page.locator("[data-metric='heartRate']").click();
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByRole("heading", { name: "Heart rate: prevention" })).toBeVisible();
    await dialog.getByRole("checkbox", { name: "Mark action 1 complete" }).check();
    expect(apiRequests).toEqual([]);
  });
});
