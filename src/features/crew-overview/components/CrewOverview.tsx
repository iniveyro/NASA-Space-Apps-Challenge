import { Eyebrow, PageFooter } from "@/shared/design-system";
import { loadMissionData } from "../lib/mission-data.server";
import { MissionCrewBoard, type HomeView } from "./MissionCrewBoard";

/**
 * Crew overview view: the UMBRAL crew for a selectable mission day.
 * `views` are further screens the visitor can switch to in place; they follow the same mission day.
 */
export async function CrewOverview({ views }: { views?: readonly HomeView[] }) {
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
            Four fictional crew members on a simulated Mars mission. Pick a mission day, then select a person to explore individual trends, or switch screens to see where the crew is, how far a signal has to travel, and what the solar storm looks like.
          </p>
        </div>
      </div>
      <MissionCrewBoard data={data} views={views} />
      <PageFooter />
    </section>
  );
}
