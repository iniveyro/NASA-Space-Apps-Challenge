import type { Page } from "@playwright/test";
import { expect, supportsWebgl, test } from "./fixtures";

const toggle = (page: Page, view: "crew" | "mission") => page.locator(`[data-home-view="${view}"]`);

/** Range fill is idempotent, so retrying it until React applies it also waits for hydration. */
async function selectDay(page: Page, day: number) {
  await expect(async () => {
    await page.locator("#mission-day-range").fill(String(day));
    await expect(page.locator("#mission-day-selector")).toHaveAttribute("data-selected-day", String(day), { timeout: 500 });
  }).toPass();
}

test.describe("mission view on the home page", () => {
  test("opens on the crew cards and offers the mission view without leaving the page", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("#crew-grid")).toBeVisible();
    await expect(toggle(page, "crew")).toHaveAttribute("aria-pressed", "true");
    await expect(page.locator("#home-mission-view")).toHaveCount(0);
    await expect(page.locator("#orbit-viewport")).toHaveCount(0);

    await toggle(page, "mission").click();
    await expect(toggle(page, "mission")).toHaveAttribute("aria-pressed", "true");
    await expect(page.locator("#home-mission-view #mission-orbit-board")).toBeVisible();
    await expect(page.locator("#crew-grid")).toHaveCount(0);
    expect(new URL(page.url()).pathname).toBe("/");

    await toggle(page, "crew").click();
    await expect(page.locator("#crew-grid")).toBeVisible();
    await expect(page.locator("#home-mission-view")).toHaveCount(0);
  });

  test("one mission-day selector drives both the crew cards and the mission view", async ({ page }) => {
    await page.goto("/");
    await selectDay(page, 300);
    await expect(page.locator("#crew-grid")).toHaveAttribute("data-selected-day", "300");

    await toggle(page, "mission").click();
    const board = page.locator("#mission-orbit-board");
    await expect(board).toHaveAttribute("data-selected-day", "300");
    await expect(page.locator("#mission-day-selector")).toHaveCount(1);
    await expect(page.locator("#crew-day-panel")).toHaveAttribute("data-selected-day", "300");

    await selectDay(page, 493);
    await expect(board).toHaveAttribute("data-selected-day", "493");
    await expect(board).toHaveAttribute("data-comm", "blackout");
    await expect(page.locator("#orbit-storm")).toBeVisible();

    await toggle(page, "crew").click();
    await expect(page.locator("#crew-grid")).toHaveAttribute("data-selected-day", "493");
  });

  test("playing the mission moves the day for the whole page", async ({ page }) => {
    await page.goto("/");
    await toggle(page, "mission").click();
    await selectDay(page, 1);
    await page.locator("#mission-play").click();
    await expect(page.locator("#mission-orbit-board")).toHaveAttribute("data-playing", "true");
    await expect(page.locator("#mission-day-selector")).not.toHaveAttribute("data-selected-day", "1");
    await page.locator("#mission-play").click();
    await expect(page.locator("#mission-orbit-board")).toHaveAttribute("data-playing", "false");

    const day = await page.locator("#mission-orbit-board").getAttribute("data-selected-day");
    expect(Number(day)).toBeGreaterThan(1);
    await toggle(page, "crew").click();
    await expect(page.locator("#crew-grid")).toHaveAttribute("data-selected-day", String(day));
  });

  test("the 3D scene opens inside the home page when WebGL is available", async ({ page }) => {
    await page.goto("/");
    const webgl = await supportsWebgl(page);
    await toggle(page, "mission").click();
    const viewport = page.locator("#orbit-viewport");
    await expect(viewport).toBeVisible();
    if (webgl) await expect(viewport).toHaveAttribute("data-scene-ready", "true", { timeout: 30_000 });
    else await expect(viewport).toHaveAttribute("data-mode", "2d");
  });

  test("the crew cards say the profile has a 3D body, and the profile opens it", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("[data-crew='sofia']")).toContainText("Open profile · 3D body");
    await page.locator("[data-profile-route='sofia']").click();
    await expect(page).toHaveURL(/\/astronaut\/sofia$/);
  });
});
