import { PROFILES } from "@/features/crew-health-data";
import { Eyebrow, PageFooter, SectionHeading } from "@/shared/design-system";
import { CrewCard } from "./CrewCard";

/** Crew overview view: all four fictional profiles side by side. */
export function CrewOverview() {
  return (
    <section id="crew-view" className="pt-9" aria-labelledby="crew-title">
      <div className="mb-9 flex items-center justify-between gap-6 max-sm:mb-7 max-sm:items-start">
        <div>
          <Eyebrow>ARTEMIS TRANSIT · CREW HEALTH MONITOR</Eyebrow>
          <h1 id="crew-title" tabIndex={-1} className="mb-1.75">
            Crew overview
          </h1>
          <p className="m-0 text-body text-muted">Four fictional crew profiles. Select a person to explore individual trends.</p>
        </div>
      </div>
      <SectionHeading
        className="mb-4"
        title="Mission crew"
        description="Latest fictional readings · 18 Jun 2042"
        aside={
          <span id="crew-count" className="text-xs font-bold tracking-caps-wide text-text-subtle">
            {PROFILES.length} CREW MEMBERS
          </span>
        }
      />
      <div id="crew-grid" className="grid grid-cols-2 gap-4.5 max-sm:grid-cols-1 lg:grid-cols-4" aria-label="Crew health overview">
        {PROFILES.map((person) => (
          <CrewCard key={person.id} person={person} />
        ))}
      </div>
      <PageFooter />
    </section>
  );
}
