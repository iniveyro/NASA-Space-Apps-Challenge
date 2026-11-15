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
import { daySelector, selectDay as selectVisibleDay } from "./mission-dataset";

const csv = (name: string) => readFileSync(path.join(process.cwd(), "data", "processed", name), "utf-8");
const DATA = buildMissionDataset(parseTimeline(csv("mission_timeline.csv")), parseCrewDaily(csv("crew_daily.csv")), parseEvents(csv("crew_events.csv")));
const TOTAL = DATA.days.length;
const VITALS: MetricId[] = ["heartRate", "bloodPressure", "temperature", "radiation"];
const TRENDS = [
  { id: "heartRate", label: "heart rate", fields: ["heartRate"], unit: "bpm" },
  { id: "bloodPressure", label: "blood pressure", fields: ["systolic", "diastolic"], unit: "mmHg" },
  { id: "temperature", label: "temperature", fields: ["temperature"], unit: "°C" },
  { id: "radiation", label: "cumulative radiation", fields: ["radiation"], unit: "mSv" },
] as const;

const selector = (page: Page) => page.locator("#mission-day-selector");
const card = (page: Page, crewId: string) => page.locator(`.crew-card[data-crew='${crewId}']`);

function contrastRatio(first: string, second: string) {
  const luminance = (color: string) => {
    const channels = color.match(/[\d.]+/g)?.slice(0, 3).map(Number) ?? [];
    const linear = channels.map((channel) => {
      const value = channel / 255;
      return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2];
  };
  const [lighter, darker] = [luminance(first), luminance(second)].sort((a, b) => b - a);
  return (lighter + 0.05) / (darker + 0.05);
}

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

async function expectChartsMatchDay(page: Page, day: number) {
  for (const person of PROFILES) {
    const crewCard = card(page, person.id);
    for (const { id, label, fields, unit } of TRENDS) {
      const expected = fields
        .map((field) => `${field === "systolic" || field === "diastolic" ? field : id === "radiation" ? "cumulative dose" : label}: ${seriesWindow(DATA, person.id, field, day, 7).map((value) => value ?? "unavailable").join(", ")} ${unit}`)
        .join("; ");
      const chart = crewCard.locator(`[data-mini-chart='${id}']`);
      await expect(chart).toHaveAttribute("aria-label", `Simulated ${label} readings, days ${Math.max(1, day - 6)}–${day}: ${expected}`);
    }
  }
}

test.describe("crew overview", () => {
  test("defaults to the last mission day with four cards matching the mission dataset", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveTitle("ASTRO Health · Crew wellness");
    await expect(page.getByRole("heading", { level: 1, name: "Crew overview" })).toBeVisible();
    await expect(page.getByText("Simulated readings for each crew member on the selected day.", { exact: true })).toHaveCount(0);
    await expect(selector(page)).toHaveAttribute("data-selected-day", String(TOTAL));
    await expect(selector(page)).toHaveAttribute("data-phase", "landed");
    await expect(page.locator("#mission-day-selector").getByText(`UMBRAL MISSION TIMELINE · ${TOTAL} DAYS`, { exact: true })).toBeVisible();
    await expect(page.locator("#mission-day-selector")).not.toContainText("SIMULATED DAYS");
    await expect(page.locator("#mission-day-readout")).toHaveText("Day #942 · 12 Jun 2029");
    await expect(page.getByText("Simulated readings · Day 942 · 12 Jun 2029 · Landed")).toBeVisible();

    const cards = page.locator(".crew-card");
    await expect(cards).toHaveCount(4);
    for (const [index, person] of PROFILES.entries()) {
      const current = cards.nth(index);
      await expect(current.locator(".crew-name")).toHaveText(person.name);
      await expect(current.getByText("7-day trend", { exact: true })).toHaveCount(0);
      await expect(current.getByText(/^(Stable|Monitoring|Simulated alert|Active|Resting)$/)).toHaveCount(0);
      await expect(current.locator("[data-metric-readout]")).toHaveCount(4);
      await expect(current.locator("[data-metric-readout='spo2']")).toHaveCount(0);
      await expect(current.locator("[data-metric-readout='radiation']")).toBeVisible();
      await expect(current).not.toContainText("Cumulative · not a rate or safe limit");
      await expect(current).not.toContainText(/reference|SpO₂|oxygen/i);
      await expect(current.locator(".mini-sparkline")).toHaveCount(4);
      const tiles = current.locator(".vital-tile");
      await expect(tiles).toHaveCount(4);
      const divider = current.locator("[data-crew-divider]");
      await expect(divider).toHaveCount(1);
      await expect(divider).toHaveAttribute("aria-hidden", "true");
      expect(await divider.evaluate((node) => getComputedStyle(node).borderTopWidth)).toBe("1px");
      const chartBounds = await current.locator("svg[data-mini-chart]").first().boundingBox();
      const tileBounds = await tiles.first().boundingBox();
      expect(chartBounds?.width).toBeGreaterThan(50);
      expect(chartBounds!.width / tileBounds!.width).toBeGreaterThan(0.7);
      const styles = await tiles.evaluateAll((nodes) => nodes.map((node) => ({
        background: getComputedStyle(node).backgroundColor,
        borderWidth: getComputedStyle(node).borderTopWidth,
        borderColor: getComputedStyle(node).borderTopColor,
      })));
      expect(styles.every(({ background, borderWidth, borderColor }) => background !== "rgba(0, 0, 0, 0)" && borderWidth === "2px" && borderColor !== "rgba(0, 0, 0, 0)")).toBe(true);
      const graphics = await tiles.evaluateAll((nodes) => nodes.flatMap((node) => {
        const background = getComputedStyle(node).backgroundColor;
        return [
          ...Array.from(node.querySelectorAll("svg[data-mini-chart] path"), (path) => ({ background, paint: getComputedStyle(path).stroke })),
          ...Array.from(node.querySelectorAll("svg[data-mini-chart] circle"), (circle) => ({ background, paint: getComputedStyle(circle).fill })),
        ];
      }));
      expect(graphics.length).toBeGreaterThan(0);
      expect(graphics.every(({ background, paint }) => contrastRatio(background, paint) >= 3)).toBe(true);
      const statusBackgrounds = await page.evaluate(() => {
        const probe = document.createElement("span");
        document.body.append(probe);
        const backgrounds = ["ok", "warn", "alert", "unknown"].map((tone) => {
          probe.className = `bg-status-${tone}-surface`;
          return getComputedStyle(probe).backgroundColor;
        });
        probe.remove();
        return backgrounds;
      });
      expect(statusBackgrounds.every((background) => graphics.every(({ paint }) => contrastRatio(background, paint) >= 3))).toBe(true);
      const bpLines = current.locator("[data-metric-readout='bloodPressure'] svg[data-mini-chart] path");
      const dashPatterns = await bpLines.evaluateAll((paths) => paths.map((path) => getComputedStyle(path).strokeDasharray));
      expect(dashPatterns.length).toBeGreaterThanOrEqual(2);
      expect(dashPatterns.some((pattern) => pattern !== "none")).toBe(true);
    }
    await expectCardsMatchDay(page, TOTAL);
    await expectChartsMatchDay(page, TOTAL);
  });

  test("aligns the overview title and view controls on desktop and stacks them on mobile", async ({ page }, testInfo) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/");
    const title = page.locator("[data-crew-overview-title]");
    const controls = page.locator("[data-home-view-toggle]");
    const titleBounds = await title.boundingBox();
    const controlsBounds = await controls.boundingBox();
    expect(titleBounds).not.toBeNull();
    expect(controlsBounds).not.toBeNull();
    expect(controlsBounds!.x).toBeGreaterThanOrEqual(titleBounds!.x + titleBounds!.width);
    expect(await title.evaluate((node) => Number.parseFloat(getComputedStyle(node).fontSize))).toBeLessThan(38);
    await page.locator("[data-crew-overview-header]").screenshot({ path: testInfo.outputPath("astro-crew-heading-desktop.png") });

    await page.getByRole("button", { name: "Mission in 3D" }).click();
    await expect(page.locator("#home-mission-view")).toBeVisible();
    await page.getByRole("button", { name: "Crew health" }).click();
    await expect(page.locator("#crew-grid")).toBeVisible();

    await page.setViewportSize({ width: 390, height: 844 });
    await expectNoHorizontalOverflow(page);
    const mobileTitle = await title.boundingBox();
    const mobileControls = await controls.boundingBox();
    expect(mobileTitle).not.toBeNull();
    expect(mobileControls).not.toBeNull();
    expect(mobileControls!.y).toBeGreaterThanOrEqual(mobileTitle!.y + mobileTitle!.height);
    await page.locator("[data-crew-overview-header]").screenshot({ path: testInfo.outputPath("astro-crew-heading-mobile.png") });
  });

  test("uses four desktop columns and wraps a fifth card onto the next row", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto("/");
    const grid = page.locator("#crew-grid");
    const layout = await grid.evaluate((element) => {
      const cards = Array.from(element.querySelectorAll<HTMLElement>(".crew-card"));
      const first = cards[0].getBoundingClientRect();
      const columnCount = getComputedStyle(element).gridTemplateColumns.trim().split(/\s+/).length;
      const fifth = cards[0].cloneNode(true) as HTMLElement;
      fifth.dataset.crew = "fifth-card-test";
      element.append(fifth);
      const fifthBounds = fifth.getBoundingClientRect();
      return {
        cardCount: cards.length,
        columnCount,
        firstTop: first.top,
        firstLeft: first.left,
        fifthTop: fifthBounds.top,
        fifthLeft: fifthBounds.left,
      };
    });

    expect(layout.cardCount).toBe(4);
    expect(layout.columnCount).toBe(4);
    expect(layout.fifthTop).toBeGreaterThan(layout.firstTop);
    expect(layout.fifthLeft).toBeCloseTo(layout.firstLeft, 0);
  });

  test("the keyboard slider and prev/next buttons change the day and every card", async ({ page }) => {
    await page.goto("/");
    await selectDay(page, 211);
    await expect(selector(page)).toHaveAttribute("data-phase", "mars_arrival");
    await expect(page.locator("#mission-day-readout")).toHaveText("Day #211 · 12 Jun 2027");
    await expectCardsMatchDay(page, 211);
    await expectChartsMatchDay(page, 211);
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
    const firstDayHeartRate = seriesWindow(DATA, "ines", "heartRate", 1, 7);
    const firstDayChart = card(page, "ines").locator("[data-mini-chart='heartRate']");
    if (firstDayHeartRate.some((value) => typeof value === "number" && Number.isFinite(value))) {
      await expect(firstDayChart).toHaveAttribute("aria-label", `Simulated heart rate readings, days 1–1: heart rate: ${firstDayHeartRate[0]} bpm`);
      await expect(firstDayChart.locator("circle")).toHaveCount(1);
    } else {
      await expect(firstDayChart).toHaveClass(/mini-sparkline-unavailable/);
    }
  });

  test("event markers jump to scenario days and show authored states", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("[data-event-day]")).toHaveCount(4);
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
    await expect(page.locator("#mission-day-readout")).toHaveText("Day #493 · 20 Mar 2028");
    const statuses = await page.locator("[data-metric-readout='radiation']").evaluateAll((nodes) => nodes.map((node) => node.getAttribute("data-status")));
    expect(statuses).toEqual(["demo-deviation", "demo-deviation", "demo-deviation", "demo-deviation"]);
    await expect(page.locator(".crew-card .metric-status").filter({ hasText: "Deviation" })).toHaveCount(4);

    await page.locator("[data-event-day='518']").click();
    await expect(selector(page)).toHaveAttribute("data-selected-day", "518");
    await expect(card(page, "ines").locator("[data-crew-event='spo2_alert']")).toContainText("SpO₂ alert");
    await expect(card(page, "ines").locator("[data-crew-event='spo2_alert']")).toContainText("during surface EVA");
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
    await expect(page).toHaveTitle(`ASTRO Health · ${fourth.name}`);

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

  test("the Latest button returns to the last mission day", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("#mission-day-latest")).toBeDisabled();
    await selectDay(page, 211);
    await expect(page.locator("#mission-day-latest")).toBeEnabled();
    await page.getByRole("button", { name: "Back to latest day" }).click();
    await expect(selector(page)).toHaveAttribute("data-selected-day", String(TOTAL));
    await expect(page.locator("#mission-day-latest")).toBeDisabled();
    await expect(page.locator("#mission-day-next")).toBeDisabled();
    await expectCardsMatchDay(page, TOTAL);
  });

  test("a card opens its profile on the selected mission day", async ({ page }) => {
    await page.goto("/");
    for (const person of PROFILES) {
      await expect(card(page, person.id).locator("[data-profile-route]")).toHaveAttribute("href", `/astronaut/${person.id}`);
    }
    await selectDay(page, 211);
    for (const person of PROFILES) {
      await expect(card(page, person.id).locator("[data-profile-route]")).toHaveAttribute("href", `/astronaut/${person.id}?day=211`);
    }
    await page.getByRole("link", { name: "Open Sofía profile" }).click();
    await expect(page).toHaveURL(/\/astronaut\/sofia\?day=211$/);
    await expect(page.getByRole("heading", { level: 1, name: "Sofía" })).toBeVisible();
    // The home page stays in the document (hidden) after the navigation, so match the visible selector.
    await expect(daySelector(page)).toHaveAttribute("data-selected-day", "211");
    await expect(page.locator("[data-metric='bloodPressure']")).toHaveAttribute("data-status", "demo-alert");
    await expect(page.locator("[data-metric='bloodPressure'] .metric-value")).toContainText(formatValue("bloodPressure", metricReading(readingFor(DATA, "sofia", 211), "bloodPressure")));
  });

  test("opening a profile again from another mission day shows that day", async ({ page }) => {
    const heartRate = (day: number) => formatValue("heartRate", metricReading(readingFor(DATA, "sofia", day), "heartRate"));
    const profileHeartRate = page.locator("[data-metric='heartRate'] .metric-value").filter({ visible: true });
    await page.goto("/");
    await selectVisibleDay(page, 211);
    await page.getByRole("link", { name: "Open Sofía profile" }).click();
    await expect(page).toHaveURL(/\/astronaut\/sofia\?day=211$/);
    await expect(daySelector(page)).toHaveAttribute("data-selected-day", "211");

    await page.getByRole("link", { name: "← Back to crew overview" }).click();
    await expect(page).toHaveURL(/\/$/);
    await selectVisibleDay(page, 120);
    await page.getByRole("link", { name: "Open Sofía profile" }).click();
    await expect(page).toHaveURL(/\/astronaut\/sofia\?day=120$/);
    await expect(daySelector(page)).toHaveAttribute("data-selected-day", "120");
    await expect(page.getByRole("heading", { level: 2, name: "Day 120 readings" })).toBeVisible();
    await expect(profileHeartRate).toContainText(heartRate(120));

    // Back and forward return to the day left in the address bar.
    await selectVisibleDay(page, 300);
    await expect(page).toHaveURL(/\/astronaut\/sofia\?day=300$/);
    await page.goBack();
    await expect(page).toHaveURL(/\/$/);
    await page.goForward();
    await expect(page).toHaveURL(/\/astronaut\/sofia\?day=300$/);
    await expect(daySelector(page)).toHaveAttribute("data-selected-day", "300");
    await expect(profileHeartRate).toContainText(heartRate(300));
  });
});
