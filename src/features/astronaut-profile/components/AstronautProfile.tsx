import type { Profile } from "@/features/crew-health-data";
import { PageFooter } from "@/shared/design-system";
import { ProfileDashboard } from "./ProfileDashboard";
import { ProfileHeader } from "./ProfileHeader";

/** Astronaut profile view. */
export function AstronautProfile({ person }: { person: Profile }) {
  return (
    <section id="detail-view" className="pt-9" aria-labelledby="detail-title">
      <ProfileHeader person={person} />
      <ProfileDashboard key={person.id} person={person} />
      <PageFooter />
    </section>
  );
}
