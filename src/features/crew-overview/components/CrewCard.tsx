import Link from "next/link";
import { activityLabel, formatValue, getMetric, healthLabel, latest, resolveMetricScenario, type MetricId, type Profile } from "@/features/crew-health-data";
import { Avatar, StatusText, toneBorder, toneFor } from "@/shared/design-system";
import { cn } from "@/shared/lib/cn";

import { HeartRateSparkline } from "./HeartRateSparkline";
import { OxygenRing } from "./OxygenRing";

const VITALS: readonly MetricId[] = ["heartRate", "bloodPressure", "temperature", "radiation"];

function VitalTile({ person, metricId }: { person: Profile; metricId: MetricId }) {
  const metric = getMetric(metricId)!;
  const value = latest(person.id, metricId);
  const formatted = formatValue(metricId, value);
  const scenario = resolveMetricScenario(person.id, metricId, value);
  return (
    <span
      role="listitem"
      data-metric-readout={metricId}
      data-status={scenario.status}
      aria-label={`${metric.label}: ${formatted} ${metric.unit}. ${scenario.label}.`}
      className={cn(
        "vital-tile flex min-h-24.5 min-w-0 flex-col justify-between gap-1.25 rounded-md border bg-console-raised p-2.5",
        toneBorder[toneFor(scenario.status)],
      )}
    >
      <span className="text-caption font-strong text-console-text">{metric.label}</span>
      <span className="vital-value text-vital leading-tight font-heavy tracking-tight text-white tabular-nums wrap-anywhere">
        {formatted} <small className="text-micro font-medium tracking-normal text-console-text-soft">{metric.unit}</small>
      </span>
      <span className="metric-status inline-flex items-center gap-1.5 text-xs leading-tight font-bold">{scenario.label}</span>
      {metricId === "heartRate" ? (
        <span className="flex items-center justify-between gap-1 text-micro text-console-faint">
          <span>7-day trend</span>
          <HeartRateSparkline profileId={person.id} />
        </span>
      ) : null}
    </span>
  );
}

/** Dark crew summary card. The whole card is a single link to the astronaut profile. */
export function CrewCard({ person }: { person: Profile }) {
  return (
    <article className="crew-card min-w-0 rounded-2xl border border-console-border bg-console p-0 text-console-text shadow-card max-sm:p-4.25 lg:max-xl:p-4">
      <Link
        href={`/astronaut/${person.id}`}
        aria-label={`Open ${person.name} profile`}
        data-profile-route={person.id}
        className="crew-card-action block h-full w-full rounded-2xl p-4.5 text-left text-current no-underline hover:bg-console-hover"
      >
        <span className="flex min-w-0 items-center gap-3.5">
          <Avatar initials={person.initials} variant="console" className="avatar" />
          <span className="min-w-0">
            <span className="crew-name mb-0.5 block text-lg leading-snug font-strong wrap-anywhere" role="heading" aria-level={3}>
              {person.name}
            </span>
            <span className="block text-sm text-console-muted">{person.role}</span>
          </span>
        </span>
        <span className="mt-4.25 mb-3.5 flex flex-wrap items-center gap-2 border-t border-console-divider pt-3.5">
          <StatusText variant="console" status={person.health} label={healthLabel(person.health)} />
          <StatusText variant="console" status={person.activity} label={activityLabel(person.activity)} />
        </span>
        <span className="m-0 grid grid-cols-2 gap-2" role="list">
          {VITALS.map((metricId) => (
            <VitalTile key={metricId} person={person} metricId={metricId} />
          ))}
          <span
            role="listitem"
            data-metric-readout="spo2"
            className="vital-tile col-span-full flex min-h-17.5 min-w-0 flex-row items-center justify-start gap-3 rounded-md border border-console-tile-border bg-console-raised p-2.5"
          >
            <OxygenRing profileId={person.id} />
            <span className="text-xs text-console-muted">Simulated point reading</span>
          </span>
        </span>
        <span aria-hidden="true" className="mt-3.25 flex items-center justify-between border-t border-console-divider pt-2.5 text-caption font-semibold text-console-faint">
          Open profile <span className="text-lg">→</span>
        </span>
      </Link>
    </article>
  );
}
