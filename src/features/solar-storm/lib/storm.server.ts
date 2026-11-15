import "server-only";

import { cacheLife } from "next/cache";
import { PROFILES } from "@/features/crew-health-data";
import { formatDelay, loadMissionView } from "@/features/mission-orbit";
import { buildStormScenario, type StormScenario } from "./scenario";

export interface StormData {
  scenario: StormScenario;
  /** One-way signal time on the day the link returns, e.g. "19 min 55 s"; null when it is not known. */
  delayAtReturn: string | null;
}

/** The solar-storm day from the mission dataset, or null when the dataset has none. Cached, so the CSVs are read once per build. */
export async function loadStormData(): Promise<StormData | null> {
  "use cache";
  cacheLife("max");
  const { data, geometry } = await loadMissionView();
  const scenario = buildStormScenario({
    data,
    profiles: PROFILES,
    dates: geometry.date,
    comm: geometry.comm,
    marsSol: geometry.marsSol,
    distEarthMkm: geometry.distEarthMkm,
    sunAngleDeg: geometry.sunAngleDeg,
    delayMin: geometry.delayMin,
    earth: geometry.earth,
    mars: geometry.mars,
  });
  if (!scenario) return null;
  return { scenario, delayAtReturn: scenario.delayAtReturnMin === null ? null : formatDelay(scenario.delayAtReturnMin) };
}
