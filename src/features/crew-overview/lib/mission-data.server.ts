import "server-only";

import { readFile } from "node:fs/promises";
import path from "node:path";
import { cacheLife } from "next/cache";
import { buildMissionDataset, parseCrewDaily, parseEvents, parseTimeline, type MissionDataset } from "@/features/crew-health-data";

/**
 * Reads the UMBRAL mission CSVs from data/processed/ (server only) and returns the compact,
 * serializable dataset. Cached with "use cache" so the files are read once per build and the
 * result becomes part of the prerendered static shell.
 */
export async function loadMissionData(): Promise<MissionDataset> {
  "use cache";
  cacheLife("max");
  const [timeline, daily, events] = await Promise.all([
    readFile(path.join(process.cwd(), "data", "processed", "mission_timeline.csv"), "utf-8"),
    readFile(path.join(process.cwd(), "data", "processed", "crew_daily.csv"), "utf-8"),
    readFile(path.join(process.cwd(), "data", "processed", "crew_events.csv"), "utf-8"),
  ]);
  return buildMissionDataset(parseTimeline(timeline), parseCrewDaily(daily), parseEvents(events));
}
