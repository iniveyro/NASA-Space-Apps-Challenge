import "server-only";

import { readFile } from "node:fs/promises";
import path from "node:path";
import { cacheLife } from "next/cache";
import { buildMissionDataset, parseCrewDaily, parseEvents, parseTimeline, type MissionDataset } from "@/features/crew-health-data";
import { crewDataset } from "./profile-day";

/**
 * Reads the UMBRAL mission CSVs from data/processed/ (server only) and returns the dataset narrowed
 * to one crew member: the full timeline, their series, and their events. Cached with "use cache",
 * so the files are read at build time and the result is part of the prerendered profile.
 */
export async function loadProfileMissionData(crewId: string): Promise<MissionDataset> {
  "use cache";
  cacheLife("max");
  const [timeline, daily, events] = await Promise.all([
    readFile(path.join(process.cwd(), "data", "processed", "mission_timeline.csv"), "utf-8"),
    readFile(path.join(process.cwd(), "data", "processed", "crew_daily.csv"), "utf-8"),
    readFile(path.join(process.cwd(), "data", "processed", "crew_events.csv"), "utf-8"),
  ]);
  return crewDataset(buildMissionDataset(parseTimeline(timeline), parseCrewDaily(daily), parseEvents(events)), crewId);
}
