import { readFileSync } from "node:fs";
import path from "node:path";
import {
  PROFILES,
  buildMissionDataset,
  formatValue,
  metricReading,
  parseCrewDaily,
  parseEvents,
  parseTimeline,
  readingFor,
  seriesWindow,
  type MetricId,
} from "../src/features/crew-health-data";
import type { Page } from "@playwright/test";
import { expect, expectNoHorizontalOverflow, test } from "./fixtures";

const csv = (name: string) => readFileSync(path.join(process.cwd(), "data", "processed", name), "utf-8");
const DATA = buildMissionDataset(parseTimeline(csv("mission_timeline.csv")), parseCrewDaily(csv("crew_daily.csv")), parseEvents(csv("crew_events.csv")));
const TOTAL = DATA.days.length;
const VITALS: MetricId[] = ["heartRate", "bloodPressure", "temperature", "radiation"];

const selector = (page: Page) => page.locator("#mission-day-selector");
const card = (page: Page, crewId: string) => page.locator(`.crew-card[data-crew='${crewId}']`);

/** Range fill is idempotent, so retrying it until React applies it also waits for hydration. */
async function selectDay(page: Page, day: number) {
  await expect(async () => {
    await page.locator("#mission-day-range").fill(String(day));
    await expect(selector(page)).toHaveAttribute("data-selected-day", String(day), { timeout: 500 });
  }).toPass();
}

async function expectCardsMatchDay(page: Page, day: number) {
  for (const person of PROFILES) {
    const reading = readingFor(DATA, person.id, day);
    for (const metricId of VITALS) {
      await expect(card(page, person.id).locator(`[data-metric-readout='${metricId}'] .vital-value`)).toContainText(formatValue(metricId, metricReading(reading, metricId)));
    }
  }
}

test.describe("crew overview", () => {
  test("defaults to the last mission day with four cards matching the mission dataset", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveTitle("ASTRA Health · Crew wellness");
    await expect(page.getByRole("heading", { level: 1, name: "Crew overview" })).toBeVisible();
    await expect(page.locator("#environment-label")).toHaveText("ENVIRONMENT · MICROGRAVITY");
    await expect(selector(page)).toHaveAttribute("data-selected-day", String(TOTAL));
    await expect(selector(page)).toHaveAttribute("data-phase", "landed");
    await expect(page.locator("#mission-day-readout")).toHaveText("Day 942 · 12 Jun 2029 · Landed · Link");
    await expect(page.getByText("Simulated readings · Day 942 · 12 Jun 2029 · Landed")).toBeVisible();

    const cards = page.locator(".crew-card");
    await expect(cards).toHaveCount(4);
    for (const [index, person] of PROFILES.entries()) {
      const current = cards.nth(index);
      await expect(current.locator(".crew-name")).toHaveText(person.name);
      await expect(current.locator("[data-metric-readout]:not([data-metric-readout='spo2'])")).toHaveCount(4);
      await expect(current.locator(".oxygen-value")).toHaveText("Unknown");
      const week = seriesWindow(DATA, person.id, "heartRate", TOTAL, 7);
      await expect(current.locator(".mini-sparkline")).toHaveAttribute(
        "aria-label",
        `Simulated heart-rate readings, days ${TOTAL - 6}–${TOTAL}: ${week.join(", ")} beats per minute`,
      );
    }
    await expectCardsMatchDay(page, TOTAL);
  });

  test("the keyboard slider and prev/next buttons change the day and every card", async ({ page }) => {
    await page.goto("/");
    await selectDay(page, 211);
    await expect(selector(page)).toHaveAttribute("data-phase", "mars_arrival");
    await expect(page.locator("#mission-day-readout")).toHaveText("Day 211 · 12 Jun 2027 · Mars arrival · Link");
    await expectCardsMatchDay(page, 211);
    await expect(card(page, "sofia").locator("[data-metric-readout='bloodPressure']")).toHaveAttribute("data-status", "demo-alert");
    await expect(card(page, "sofia").locator("[data-metric-readout='bloodPressure'] .metric-status")).toHaveText("Alert");
    await expect(card(page, "malik").locator("[data-metric-readout='bloodPressure']")).toHaveAttribute("data-status", "within-demo-reference");
    for (const person of PROFILES) {
      await expect(card(page, person.id).locator("[data-crew-event='orthostatic_test']")).toContainText("Orthostatic test");
    }

    await page.locator("#mission-day-next").click();
    await expect(selector(page)).toHaveAttribute("data-selected-day", "212");
    await expect(selector(page)).toHaveAttribute("data-phase", "surface");
    await expect(page.locator("[data-crew-event]")).toHaveCount(0);
    await expectCardsMatchDay(page, 212);

    await page.locator("#mission-day-prev").click();
    await page.locator("#mission-day-prev").click();
    await expect(selector(page)).toHaveAttribute("data-selected-day", "210");
    await expect(selector(page)).toHaveAttribute("data-phase", "transit_out");

    await page.locator("#mission-day-range").focus();
    await page.keyboard.press("ArrowRight");
    await expect(selector(page)).toHaveAttribute("data-selected-day", "211");

    await selectDay(page, 1);
    await expect(page.locator("#mission-day-prev")).toBeDisabled();
    await expect(card(page, "ines").locator(".mini-sparkline-unavailable")).toHaveCount(1);
  });

  test("event markers jump to scenario days and show authored states", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("[data-event-day]")).toHaveCount(3);
    await expect(async () => {
      await page.locator("[data-event-day='120']").click();
      await expect(selector(page)).toHaveAttribute("data-selected-day", "120", { timeout: 500 });
    }).toPass();
    await expect(page.locator("[data-event-day='120']")).toHaveAttribute("aria-pressed", "true");
    await expect(card(page, "kanji").locator("[data-metric-readout='heartRate']")).toHaveAttribute("data-status", "demo-alert");
    await expect(card(page, "kanji").locator("[data-crew-event='viral_reactivation']")).toContainText("rest HR 48->78");
    await expect(card(page, "ines").locator("[data-metric-readout='heartRate']")).toHaveAttribute("data-status", "within-demo-reference");
    await expectCardsMatchDay(page, 120);

    await page.locator("#mission-day-next").click();
    await expect(card(page, "kanji").locator("[data-metric-readout='heartRate']")).toHaveAttribute("data-status", "demo-alert");
    await expect(card(page, "kanji").locator("[data-crew-event='viral_reactivation']")).toContainText("Viral reactivation");

    await page.locator("[data-event-day='493']").click();
    await expect(selector(page)).toHaveAttribute("data-selected-day", "493");
    await expect(selector(page)).toHaveAttribute("data-comm", "blackout");
    await expect(page.locator("#mission-day-readout")).toHaveText("Day 493 · 20 Mar 2028 · Mars surface · Comm blackout");
    const statuses = await page.locator("[data-metric-readout='radiation']").evaluateAll((nodes) => nodes.map((node) => node.getAttribute("data-status")));
    expect(statuses).toEqual(["demo-deviation", "demo-deviation", "demo-deviation", "demo-deviation"]);
    await expect(page.locator(".crew-card .metric-status").filter({ hasText: "Deviation" })).toHaveCount(4);
  });

  test("the phase band and legend are clickable and phases are distinguishable", async ({ page }) => {
    await page.goto("/");
    for (const phase of ["transit_out", "surface", "transit_return"]) {
      await expect(page.locator(`[data-phase-segment='${phase}']`)).toHaveCount(1);
    }
    for (const phase of ["mars_arrival", "mars_departure", "landed"]) {
      await expect(page.locator(`[data-phase-milestone='${phase}']`)).toHaveCount(1);
    }
    await expect(page.locator("[data-blackout]")).toHaveCount(1);
    const labels = { transit_out: "Transit out", surface: "Mars surface", transit_return: "Transit return" };
    for (const [phase, label] of Object.entries(labels)) {
      await expect(page.locator(`[data-phase-label='${phase}']`)).toHaveText(label);
      const glow = (await page.locator(`[data-phase-label='${phase}']`).boundingBox())!;
      const fill = (await page.locator(`[data-phase-segment='${phase}']`).boundingBox())!;
      expect(glow.y + glow.height).toBeLessThanOrEqual(fill.y + 1);
      expect(Math.abs(glow.x - fill.x)).toBeLessThanOrEqual(1);
      expect(Math.abs(glow.width - fill.width)).toBeLessThanOrEqual(1);
    }
    const colors = await page
      .locator("[data-phase-segment='transit_out'], [data-phase-segment='surface'], [data-phase-segment='transit_return'], [data-phase-milestone='mars_arrival']")
      .evaluateAll((nodes) => nodes.map((node) => getComputedStyle(node).backgroundColor));
    expect(new Set(colors).size).toBe(4);

    await expect(async () => {
      await page.locator("[data-phase-jump='surface']").click();
      await expect(selector(page)).toHaveAttribute("data-selected-day", "212", { timeout: 500 });
    }).toPass();
    await expect(page.locator("[data-phase-jump='surface']")).toHaveAttribute("aria-pressed", "true");

    const band = page.locator("#mission-phase-band");
    const box = (await band.boundingBox())!;
    await band.click({ position: { x: box.width * 0.9, y: box.height / 2 } });
    await expect(selector(page)).toHaveAttribute("data-phase", "transit_return");
    const selected = Number(await selector(page).getAttribute("data-selected-day"));
    expect(Math.abs(selected - Math.floor(0.9 * TOTAL) - 1)).toBeLessThanOrEqual(1);
    await expectCardsMatchDay(page, selected);
  });

  test("the day steppers flank the phase band, which replaces the visible slider and its date labels", async ({ page }) => {
    await page.goto("/");
    const band = (await page.locator("#mission-phase-band").boundingBox())!;
    const prev = (await page.locator("#mission-day-prev").boundingBox())!;
    const next = (await page.locator("#mission-day-next").boundingBox())!;
    expect(prev.x + prev.width).toBeLessThanOrEqual(band.x);
    expect(next.x).toBeGreaterThanOrEqual(band.x + band.width);
    for (const button of [prev, next]) {
      expect(button.y).toBeGreaterThanOrEqual(band.y);
      expect(button.y + button.height).toBeLessThanOrEqual(band.y + band.height + 1);
    }
    const range = (await page.locator("#mission-day-range").boundingBox())!;
    expect(range.width).toBeLessThanOrEqual(1);
    await expect(selector(page).getByText(/^Day 1 · /)).toHaveCount(0);
  });

  test("has no horizontal overflow on a narrow screen after selecting a day", async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 900 });
    await page.goto("/");
    await selectDay(page, 120);
    await expectNoHorizontalOverflow(page);
  });

  test("each full card navigates to its profile by click and keyboard, with history", async ({ page }) => {
    const [, , third, fourth] = PROFILES;
    await page.goto("/");
    await page.getByRole("link", { name: `Open ${fourth.name} profile` }).click();
    await expect(page).toHaveURL(new RegExp(`/astronaut/${fourth.id}$`));
    await expect(page.getByRole("heading", { level: 1, name: fourth.name })).toBeVisible();
    await expect(page).toHaveTitle(`ASTRA Health · ${fourth.name}`);

    await page.goBack();
    await expect(page).toHaveURL(/\/$/);
    await expect(page.locator(".crew-card")).toHaveCount(4);
    await page.goForward();
    await expect(page.getByRole("heading", { level: 1, name: fourth.name })).toBeVisible();

    await page.getByRole("link", { name: "← Back to crew overview" }).click();
    await expect(page).toHaveURL(/\/$/);
    await page.getByRole("link", { name: `Open ${third.name} profile` }).focus();
    await page.keyboard.press("Enter");
    await expect(page.getByRole("heading", { level: 1, name: third.name })).toBeVisible();
  });
});
