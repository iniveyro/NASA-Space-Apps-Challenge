import { readFileSync } from "node:fs";
import path from "node:path";
import type { Page } from "@playwright/test";
import { parseEvents } from "../src/features/crew-health-data";
import { parseStormDetail } from "../src/features/solar-storm/lib/scenario";
import { expect, expectNoHorizontalOverflow, supportsWebgl, test } from "./fixtures";

const EVENTS = parseEvents(readFileSync(path.join(process.cwd(), "data", "processed", "crew_events.csv"), "utf-8")).filter((event) => event.event === "solar_storm");
const STORM_DAY = EVENTS[0]?.day ?? 0;

const toggle = (page: Page, view: "crew" | "mission" | "storm") => page.locator(`[data-home-view="${view}"]`);
const board = (page: Page) => page.locator("#storm-board");

/** Range fill is idempotent, so retrying it until React applies it also waits for hydration. */
async function selectDay(page: Page, day: number) {
  await expect(async () => {
    await page.locator("#mission-day-range").fill(String(day));
    await expect(page.locator("#mission-day-selector")).toHaveAttribute("data-selected-day", String(day), { timeout: 500 });
  }).toPass();
}

/** Opens the storm view from the home page; the click is retried until the page has hydrated. */
async function openStorm(page: Page) {
  await page.goto("/");
  await expect(async () => {
    await toggle(page, "storm").click();
    await expect(board(page)).toBeVisible({ timeout: 500 });
  }).toPass();
}

/** Moves the scene to a position (0–1000) and waits for it to be applied; seeking also pauses the play. */
async function seek(page: Page, position: number) {
  await expect(async () => {
    await page.locator("#storm-progress").fill(String(position));
    await expect(page.locator("#storm-play")).toHaveAttribute("aria-pressed", "false", { timeout: 500 });
    await expect(page.locator("#storm-progress")).toHaveValue(String(position), { timeout: 500 });
  }).toPass();
}

test.describe("solar-storm view on the home page", () => {
  test("the dataset has a storm day with two people outside and two in the refuge", () => {
    expect(STORM_DAY).toBeGreaterThan(0);
    const places = EVENTS.map((event) => parseStormDetail(event.detail).place);
    expect(places.filter((place) => place === "walk")).toHaveLength(2);
    expect(places.filter((place) => place === "refuge")).toHaveLength(2);
  });

  test("opens from the home switch on the storm day, without leaving the page", async ({ page }) => {
    await page.goto("/");
    await expect(toggle(page, "crew")).toHaveAttribute("aria-pressed", "true");
    await expect(page.locator("#home-storm-view")).toHaveCount(0);
    await expect(async () => {
      await toggle(page, "storm").click();
      await expect(toggle(page, "storm")).toHaveAttribute("aria-pressed", "true", { timeout: 500 });
    }).toPass();

    await expect(page.locator("#home-storm-view #storm-board")).toBeVisible();
    await expect(board(page)).toHaveAttribute("data-storm-day", String(STORM_DAY));
    await expect(page.locator("#mission-day-selector")).toHaveAttribute("data-selected-day", String(STORM_DAY));
    await expect(page.locator("#crew-grid")).toHaveCount(0);
    expect(new URL(page.url()).pathname).toBe("/");

    await toggle(page, "crew").click();
    await expect(page.locator("#crew-grid")).toHaveAttribute("data-selected-day", String(STORM_DAY));
    await expect(page.locator("#home-storm-view")).toHaveCount(0);
  });

  test("on any other day it says where the storm is and takes you there", async ({ page }) => {
    await openStorm(page);
    await selectDay(page, 300);
    await expect(board(page)).toHaveCount(0);
    await expect(page.locator("#storm-away")).toContainText(`day ${STORM_DAY}`);

    await page.locator("#storm-go").click();
    await expect(board(page)).toBeVisible();
    await expect(page.locator("#mission-day-selector")).toHaveAttribute("data-selected-day", String(STORM_DAY));
    await expect(page.locator("#storm-away")).toHaveCount(0);
  });

  test("the scene steps through the plot and the doses add up to the dataset", async ({ page }) => {
    await openStorm(page);
    await expect(board(page)).toHaveAttribute("data-phase", /^(walk|return|refuge)$/);

    await seek(page, 40);
    await expect(board(page)).toHaveAttribute("data-phase", "walk");
    await expect(page.locator("#storm-phase")).toContainText("outside on the surface");
    for (const event of EVENTS) await expect(page.locator(`[data-crew='${event.crewId}'] [data-dose-now]`)).toHaveText("0.0 mSv");

    await seek(page, 450);
    await expect(board(page)).toHaveAttribute("data-phase", "return");
    await expect(page.locator("#storm-phase")).toContainText("no link to Earth");

    await seek(page, 1000);
    await expect(board(page)).toHaveAttribute("data-phase", "refuge");
    await expect(page.locator("#storm-phase")).toContainText("All four are in the refuge");
    for (const event of EVENTS) {
      const dose = parseStormDetail(event.detail).dose;
      expect(dose).not.toBeNull();
      await expect(page.locator(`[data-crew='${event.crewId}'] [data-dose-now]`)).toHaveText(`${(dose ?? 0).toFixed(1)} mSv`);
    }
    await expect(page.locator("#storm-crew")).toContainText("not a rate and not a safe limit");
  });

  test("states that the storm is a scenario and the particles are illustrative", async ({ page }) => {
    await openStorm(page);
    await expect(page.locator("#storm-notice")).toContainText("authored scenario event");
    await expect(page.locator("#storm-notice")).toContainText("illustrative");
    await expect(page.locator("#storm-crew")).toContainText("Simulated data");
  });

  test("shows the 3D scene when WebGL is available, and a plan of it otherwise or on request", async ({ page }) => {
    await openStorm(page);
    const viewport = page.locator("#storm-viewport");
    await expect(viewport).toBeVisible();
    if (await supportsWebgl(page)) {
      await expect(viewport).toHaveAttribute("data-scene-ready", "true", { timeout: 30_000 });
      await expect(page.locator("#storm-viewport canvas")).toBeVisible();
      await page.locator("[data-storm-mode='2d']").click();
      await expect(viewport).toHaveAttribute("data-mode", "2d");
    } else {
      await expect(viewport).toHaveAttribute("data-mode", "2d");
      await expect(page.locator("#storm-notice")).toContainText("3D is not available");
    }
    await expect(page.locator("[data-storm-diagram]")).toBeVisible();
    await expect(page.locator("[data-storm-diagram] [data-walker]")).toHaveCount(2);
  });

  test("fits a narrow phone screen", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await openStorm(page);
    await expect(page.locator("#storm-viewport")).toBeVisible();
    await expectNoHorizontalOverflow(page);
  });
});
