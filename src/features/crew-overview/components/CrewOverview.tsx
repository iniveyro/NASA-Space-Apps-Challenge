import type { ReactNode } from "react";
import { PageFooter } from "@/shared/design-system";
import { loadMissionData } from "../lib/mission-data.server";
import { MissionCrewBoard } from "./MissionCrewBoard";

/**
 * Crew overview view: the UMBRAL crew for a selectable mission day.
 * `mission` is the mission view shown on request next to the crew cards; it follows the same mission day.
 */
export async function CrewOverview({ mission }: { mission?: ReactNode }) {
  const data = await loadMissionData();
  return (
    <section id="crew-view" className="pt-9" aria-labelledby="crew-title">
      <MissionCrewBoard data={data} mission={mission} />
      <PageFooter />
    </section>
  );
}
