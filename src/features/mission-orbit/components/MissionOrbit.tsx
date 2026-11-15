import Link from "next/link";
import { Suspense } from "react";
import { Eyebrow, PageFooter } from "@/shared/design-system";
import { loadMissionView } from "../lib/mission-view.server";
import { MissionOrbitBoard } from "./MissionOrbitBoard";

function BoardPlaceholder() {
  return (
    <div id="mission-orbit-loading" className="min-h-120 rounded-xl border border-border bg-surface p-5 text-body text-muted max-sm:p-4">
      Loading the mission view…
    </div>
  );
}

/** Mission geometry view: where the crew is on each mission day and how far a signal has to travel. */
export async function MissionOrbit() {
  const view = await loadMissionView();
  return (
    <section id="mission-view" className="pt-9" aria-labelledby="mission-title">
      <Link id="back-to-crew" href="/" className="mb-5.75 inline-flex items-center gap-2.25 text-body font-semibold text-text-secondary no-underline hover:text-primary-strong">
        ← Back to crew overview
      </Link>
      <div className="mb-7">
        <Eyebrow>UMBRAL MARS MISSION · FROM EARTH-DEPENDENT TO EARTH-INDEPENDENT</Eyebrow>
        <h1 id="mission-title" tabIndex={-1} className="mb-1.75">
          Mission geometry
        </h1>
        <p className="m-0 max-w-220 text-body text-muted">
          Where the four crew members are on each mission day, and how long a signal takes to reach Earth and come back. Positions come from planetary
          ephemerides and agree with JPL Horizons; the mission, the crew and their readings are simulated.
        </p>
      </div>
      {/* The board reads ?day= from the address bar, so it renders on the client inside this boundary. */}
      <Suspense fallback={<BoardPlaceholder />}>
        <MissionOrbitBoard {...view} />
      </Suspense>
      <PageFooter />
    </section>
  );
}
