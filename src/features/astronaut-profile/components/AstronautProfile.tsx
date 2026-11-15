import { Suspense } from "react";
import type { Profile } from "@/features/crew-health-data";
import { PageFooter } from "@/shared/design-system";
import { loadProfileMissionData } from "../lib/mission-data.server";
import { ProfileDashboard } from "./ProfileDashboard";
import { ProfileHeader } from "./ProfileHeader";

function DashboardPlaceholder() {
  return (
    <div id="profile-dashboard-loading" className="mt-2 mb-6.25 min-h-120 rounded-xl border border-border bg-surface p-5 text-body text-muted max-sm:p-4">
      Loading the readings…
    </div>
  );
}

/** Astronaut profile view: the crew member's readings from the mission dataset for a selectable mission day. */
export async function AstronautProfile({ person }: { person: Profile }) {
  const data = await loadProfileMissionData(person.id);
  return (
    <section id="detail-view" className="pt-9" aria-labelledby="detail-title">
      <ProfileHeader person={person} />
      {/* The dashboard reads ?day= from the address bar, so it renders on the client inside this boundary. */}
      <Suspense fallback={<DashboardPlaceholder />}>
        <ProfileDashboard key={person.id} person={person} data={data} />
      </Suspense>
      <PageFooter />
    </section>
  );
}
