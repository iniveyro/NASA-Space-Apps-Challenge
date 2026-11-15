import "server-only";

import { readFile } from "node:fs/promises";
import path from "node:path";
import { cacheLife } from "next/cache";
import { buildMissionDataset, parseCrewDaily, parseEvents, parseTimeline, type MissionDataset } from "@/features/crew-health-data";
import { parseMissionGeometry, type MissionGeometry } from "./geometry";
import { buildStory, type StoryBeat } from "./story";

export interface MissionView {
  data: MissionDataset;
  geometry: MissionGeometry;
  story: StoryBeat[];
}

function processed(name: string): Promise<string> {
  return readFile(path.join(process.cwd(), "data", "processed", name), "utf-8");
}

/**
 * Reads the UMBRAL CSVs from data/processed/ (server only): crew readings, events, and the mission
 * geometry with its 3D positions. Cached with "use cache", so the files are read once per build.
 */
export async function loadMissionView(): Promise<MissionView> {
  "use cache";
  cacheLife("max");
  const [timeline, positions, daily, events] = await Promise.all([
    processed("mission_timeline.csv"),
    processed("mission_positions.csv"),
    processed("crew_daily.csv"),
    processed("crew_events.csv"),
  ]);
  const data = buildMissionDataset(parseTimeline(timeline), parseCrewDaily(daily), parseEvents(events));
  const geometry = parseMissionGeometry(timeline, positions);
  return { data, geometry, story: buildStory(geometry, data.events) };
}
