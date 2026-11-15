import { readFileSync } from "node:fs";
import path from "node:path";
import type { Page } from "@playwright/test";
import {
  buildMissionDataset,
  formatValue,
  metricReading,
  parseCrewDaily,
  parseEvents,
  parseTimeline,
  readingFor,
  type MetricId,
} from "../src/features/crew-health-data";
import { expect } from "./fixtures";

const csv = (name: string) => readFileSync(path.join(process.cwd(), "data", "processed", name), "utf-8");

/** The mission dataset the app reads, built from the same CSV files. */
export const DATA = buildMissionDataset(parseTimeline(csv("mission_timeline.csv")), parseCrewDaily(csv("crew_daily.csv")), parseEvents(csv("crew_events.csv")));
export const TOTAL = DATA.days.length;

/** Metrics the mission dataset does not record; the interface shows them as "Unknown". */
export const UNRECORDED: readonly MetricId[] = ["spo2", "activity", "stress"];

/** Formatted dataset value of one metric for a crew member on a mission day. */
export function datasetValue(crewId: string, metricId: MetricId, day: number): string {
  return formatValue(metricId, metricReading(readingFor(DATA, crewId, day), metricId));
}

/**
 * The mission-day selector of the screen on display. Routes visited earlier stay in the document
 * (hidden), so the selector is matched by visibility.
 */
export const daySelector = (page: Page) => page.locator("#mission-day-selector").filter({ visible: true });

/** Range fill is idempotent, so retrying it until React applies it also waits for hydration. */
export async function selectDay(page: Page, day: number) {
  await expect(async () => {
    await page.locator("#mission-day-range").filter({ visible: true }).fill(String(day));
    await expect(daySelector(page)).toHaveAttribute("data-selected-day", String(day), { timeout: 500 });
  }).toPass();
}
