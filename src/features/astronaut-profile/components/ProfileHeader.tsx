import Link from "next/link";
import { activityLabel, healthLabel, type Profile } from "@/features/crew-health-data";
import { Avatar, Eyebrow, StatusText } from "@/shared/design-system";

const demographicCell =
  "min-w-26 border-l border-border px-4.5 py-0.5 max-sm:min-w-0 max-sm:flex-1 max-sm:px-3 max-sm:first:border-l-0 max-sm:first:pl-0 max-sm:last:pr-0 max-xs:px-2";

/** Back link, identity, demographics, and independent health/activity labels. */
export function ProfileHeader({ person }: { person: Profile }) {
  const demographics = [
    { id: "profile-age", label: "Age", value: `${person.age} years` },
    { id: "profile-weight", label: "Weight", value: `${person.weightKg} kg` },
    { id: "profile-sex", label: "Sex", value: person.sex },
  ];
  return (
    <>
      <Link
        id="back-to-crew"
        href="/"
        className="mb-5.75 inline-flex items-center gap-2.25 text-body font-semibold text-text-secondary no-underline hover:text-primary-strong"
      >
        ← Back to crew overview
      </Link>
      <div className="flex items-center justify-between gap-7 border-y border-border py-5.25 max-sm:flex-col max-sm:items-start max-sm:gap-4">
        <div className="flex min-w-0 items-center gap-4 max-xs:gap-2.75">
          <Avatar id="profile-avatar" initials={person.initials} size="lg" className="avatar" />
          <div>
            <Eyebrow className="mb-1">ASTRONAUT PROFILE · SIMULATED</Eyebrow>
            <h1 id="detail-title" tabIndex={-1} className="mb-0.75 max-xs:text-display-sm">
              {person.name}
            </h1>
            <p id="profile-role" className="m-0 text-body text-muted">
              {person.role}
            </p>
          </div>
        </div>
        <div className="flex max-sm:w-full max-sm:border-t max-sm:border-border max-sm:pt-3" aria-label="Fictional profile details">
          {demographics.map((item) => (
            <div key={item.id} className={demographicCell}>
              <span className="mb-0.75 block text-caption text-muted">{item.label}</span>
              <strong id={item.id} className="block text-body">
                {item.value}
              </strong>
            </div>
          ))}
        </div>
      </div>
      <div className="flex items-start justify-between gap-5 pt-4.25 pb-5.25 max-sm:flex-col max-sm:gap-2.5">
        <div className="flex flex-wrap items-center gap-x-4.5 gap-y-2">
          <StatusText id="health-status" status={person.health} label={healthLabel(person.health)} />
          <StatusText id="activity-status" status={person.activity} label={activityLabel(person.activity)} />
        </div>
      </div>
    </>
  );
}
