import type { ReactNode } from "react";
import { Eyebrow, PageFooter } from "@/shared/design-system";
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
      <div className="mb-9 flex items-center justify-between gap-6 max-sm:mb-7 max-sm:items-start">
        <div>
          <Eyebrow>UMBRAL MARS MISSION · CREW HEALTH MONITOR</Eyebrow>
          <h1 id="crew-title" tabIndex={-1} className="mb-1.75">
            Crew overview
          </h1>
          <p className="m-0 text-body text-muted">
            Four fictional crew members on a simulated Mars mission. Pick a mission day, then select a person to explore individual trends, or switch to the mission view to see where the crew is and how far a signal has to travel.
          </p>
        </div>
      </div>
      <MissionCrewBoard data={data} mission={mission} />
      <PageFooter />
    </section>
  );
}
