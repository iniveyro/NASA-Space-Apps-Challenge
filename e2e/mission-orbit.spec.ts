import { readFileSync } from "node:fs";
import path from "node:path";
import type { Page } from "@playwright/test";
import { parseEvents } from "../src/features/crew-health-data";
import { formatDegrees, formatDelay, formatMkm } from "../src/features/mission-orbit/lib/format";
import { blackoutSpans, delayMinutes, farthestDay, parseMissionGeometry } from "../src/features/mission-orbit/lib/geometry";
import { buildStory } from "../src/features/mission-orbit/lib/story";
import { expect, expectNoHorizontalOverflow, supportsWebgl, test } from "./fixtures";

const csv = (name: string) => readFileSync(path.join(process.cwd(), "data", "processed", name), "utf-8");
const GEOMETRY = parseMissionGeometry(csv("mission_timeline.csv"), csv("mission_positions.csv"));
const EVENTS = parseEvents(csv("crew_events.csv"));
const STORY = buildStory(GEOMETRY, EVENTS);
const BLACKOUT = blackoutSpans(GEOMETRY.comm)[0];
const STORM_DAY = EVENTS.find((event) => event.event === "solar_storm")?.day ?? 0;

const board = (page: Page) => page.locator("#mission-orbit-board");
const readout = (page: Page, key: string) => page.locator(`#link-readout [data-readout='${key}']`);

/** Range fill is idempotent, so retrying it until React applies it also waits for hydration. */
async function selectDay(page: Page, day: number) {
  await expect(async () => {
    await page.locator("#mission-day-range").fill(String(day));
    await expect(board(page)).toHaveAttribute("data-selected-day", String(day), { timeout: 500 });
  }).toPass();
}

async function expectReadoutMatchesDataset(page: Page, day: number) {
  await expect(readout(page, "delay")).toHaveText(formatDelay(delayMinutes(GEOMETRY, day)));
  await expect(readout(page, "distance-earth")).toHaveText(formatMkm(GEOMETRY.distEarthMkm[day - 1]));
  await expect(readout(page, "sun-angle")).toHaveText(formatDegrees(GEOMETRY.sunAngleDeg[day - 1]));
  await expect(page.locator("#link-readout")).toHaveAttribute("data-comm", GEOMETRY.comm[day - 1]);
}

test.describe("mission geometry", () => {
  test("opens on day 1 and follows the dataset as the day changes", async ({ page }) => {
    await page.goto("/mission");
    await expect(page).toHaveTitle("ASTRA Health · Mission geometry");
    await expect(page.getByRole("heading", { level: 1, name: "Mission geometry" })).toBeVisible();
    await expect(board(page)).toHaveAttribute("data-selected-day", "1");
    await expect(page.locator("#story-panel")).toHaveAttribute("data-beat", "departure");

    for (const day of [120, 211, 300, GEOMETRY.total]) {
      await selectDay(page, day);
      await expect(board(page)).toHaveAttribute("data-phase", GEOMETRY.phase[day - 1] ?? "");
      await expectReadoutMatchesDataset(page, day);
      await expect(page.locator("#crew-day-panel")).toHaveAttribute("data-selected-day", String(day));
    }
    await expect(page).toHaveURL(new RegExp(`[?&]day=${GEOMETRY.total}$`));
  });

  test("a deep link opens the solar storm inside the blackout, with figures from the dataset", async ({ page }) => {
    expect(BLACKOUT).toBeDefined();
    expect(STORM_DAY).toBeGreaterThanOrEqual(BLACKOUT.startDay);
    expect(STORM_DAY).toBeLessThanOrEqual(BLACKOUT.endDay);
    const dayOfBlackout = STORM_DAY - BLACKOUT.startDay + 1;
    const daysUntilLink = BLACKOUT.endDay + 1 - STORM_DAY;

    await page.goto(`/mission?day=${STORM_DAY}`);
    await expect(board(page)).toHaveAttribute("data-selected-day", String(STORM_DAY));
    await expect(board(page)).toHaveAttribute("data-comm", "blackout");
    await expectReadoutMatchesDataset(page, STORM_DAY);
    await expect(page.locator("#orbit-status")).toHaveText(`NO EARTH LINK · DAY ${dayOfBlackout} OF ${BLACKOUT.count}`);
    await expect(page.locator("#orbit-storm")).toHaveText("SOLAR STORM · SCENARIO EVENT");
    await expect(page.locator("#orbit-viewport [data-legend='exclusion']")).toBeVisible();
    await expect(page.locator("#orbit-viewport [data-legend='storm']")).toContainText("illustrative");
    await expect(page.locator("#link-status")).toHaveText("No Earth link");
    await expect(readout(page, "blackout")).toContainText(`Day ${dayOfBlackout} of ${BLACKOUT.count} without contact`);
    await expect(readout(page, "round-trip")).toHaveText("Not before 30 Mar 2028");
    await expect(page.locator("#link-readout")).toContainText(`link returns in ${daysUntilLink} days, on day ${BLACKOUT.endDay + 1}`);

    await expect(page.locator("#story-panel")).toHaveAttribute("data-beat", "solar-storm");
    await expect(page.locator("#story-text")).toContainText(`another ${daysUntilLink} days`);
    const stormEvents = EVENTS.filter((event) => event.day === STORM_DAY);
    await expect(page.locator("[data-story-event]")).toHaveCount(stormEvents.length);
    for (const event of stormEvents) {
      await expect(page.locator(`[data-story-event='${event.crewId}']`)).toContainText(event.detail);
      await expect(page.locator(`[data-crew-row='${event.crewId}'] [data-crew-event='solar_storm']`)).toContainText(event.detail);
    }
    await expect(page.locator("#crew-link-note")).toContainText("No Earth link on this day");
  });

  test("the story steps through every beat on the day the dataset gives", async ({ page }) => {
    await page.goto("/mission");
    await expect(page.locator("[data-beat-id]")).toHaveCount(STORY.length);
    await selectDay(page, 1);
    for (const beat of STORY.slice(1, 5)) {
      await page.locator("#story-next").click();
      await expect(board(page)).toHaveAttribute("data-selected-day", String(beat.day));
      await expect(page.locator("#story-panel")).toHaveAttribute("data-beat", beat.id);
      await expect(page.locator("#story-title")).toHaveText(beat.title);
    }
    const farthest = farthestDay(GEOMETRY) ?? 0;
    await page.locator("[data-beat-id='farthest']").click();
    await expect(board(page)).toHaveAttribute("data-selected-day", String(farthest));
    await expect(page.locator("#story-text")).toContainText(formatDelay(delayMinutes(GEOMETRY, farthest)));
    await expect(readout(page, "delay-max")).toContainText(`day ${farthest}`);
    await expect(readout(page, "autonomy")).toHaveAttribute("data-fraction", "1.000");
  });

  test("the time-lapse advances the mission and stops when asked", async ({ page }) => {
    await page.goto("/mission");
    await selectDay(page, 1);
    await page.locator("#mission-play").click();
    await expect(board(page)).toHaveAttribute("data-playing", "true");
    await expect.poll(async () => Number(await board(page).getAttribute("data-selected-day"))).toBeGreaterThan(5);
    await page.locator("#mission-play").click();
    await expect(board(page)).toHaveAttribute("data-playing", "false");
    const stopped = await board(page).getAttribute("data-selected-day");
    await page.waitForTimeout(400);
    await expect(board(page)).toHaveAttribute("data-selected-day", stopped ?? "");
  });

  test("shows the 3D scene where WebGL exists and always keeps the 2D diagram available", async ({ page }) => {
    await page.goto("/mission?day=300");
    const viewport = page.locator("#orbit-viewport");
    await expect(viewport.locator("[data-orbit-diagram]")).toHaveCount(1);
    await expect(page.locator("#orbit-notice")).toContainText("Distances between bodies are to scale");
    await expect(board(page)).toHaveAttribute("data-selected-day", "300");
    if (await supportsWebgl(page)) {
      await expect(viewport).toHaveAttribute("data-mode", "3d");
      await expect(viewport).toHaveAttribute("data-scene-ready", "true", { timeout: 20_000 });
      await expect(viewport.locator("[data-scene-label='mars']")).toHaveText("Mars · crew");
      await page.locator("button[data-view='crew']").click();
      await page.locator("button[data-mode='2d']").click();
      await expect(viewport).toHaveAttribute("data-mode", "2d");
      await expect(viewport.locator("canvas")).toHaveCount(0);
      await page.locator("button[data-mode='3d']").click();
      await expect(viewport).toHaveAttribute("data-scene-ready", "true", { timeout: 20_000 });
    } else {
      await expect(viewport).toHaveAttribute("data-mode", "2d");
      await expect(page.locator("#orbit-notice")).toContainText("3D is not available in this browser");
    }
  });

  test("honors reduced motion", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto(`/mission?day=${STORM_DAY}`);
    await expectReadoutMatchesDataset(page, STORM_DAY);
    await selectDay(page, 546);
    await expectReadoutMatchesDataset(page, 546);
  });

  for (const width of [320, 390, 768, 1440]) {
    test(`no horizontal overflow at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(`/mission?day=${STORM_DAY}`);
      await expect(page.locator("[data-crew-row]")).toHaveCount(4);
      await expectNoHorizontalOverflow(page);
    });
  }
});
