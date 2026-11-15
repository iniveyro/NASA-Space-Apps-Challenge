import Link from "next/link";
import {
  PROFILES,
  eventLabel,
  eventsOn,
  formatValue,
  getMetric,
  metricReading,
  readingFor,
  resolveDayScenario,
  type MetricId,
  type MissionDataset,
} from "@/features/crew-health-data";
import { Panel, PanelHeading, toneFor, toneSoft } from "@/shared/design-system";
import { cn } from "@/shared/lib/cn";

const METRICS: readonly MetricId[] = ["heartRate", "bloodPressure", "temperature", "sleep", "radiation"];

interface CrewDayPanelProps {
  data: MissionDataset;
  day: number;
  /** One-line statement of the Earth link on this day, e.g. "A report reaches Earth in 4 min 4 s." */
  linkNote: string;
  className?: string;
}

/** The four crew members' simulated readings on the selected mission day, with authored demo states. */
export function CrewDayPanel({ data, day, linkNote, className }: CrewDayPanelProps) {
  return (
    <Panel id="crew-day-panel" aria-labelledby="crew-day-title" data-selected-day={day} className={className}>
      <PanelHeading eyebrow="SIMULATED READINGS · ON-BOARD MONITOR" title={`Crew on day ${day}`} titleId="crew-day-title" />
      <p id="crew-link-note" className="mt-2 mb-0 text-sm text-muted">
        {linkNote}
      </p>
      <ul className="m-0 mt-3 flex list-none flex-col gap-2.5 p-0">
        {PROFILES.map((person) => {
          const reading = readingFor(data, person.id, day);
          const events = eventsOn(data, day, person.id);
          return (
            <li key={person.id} data-crew-row={person.id} className="min-w-0 border-t border-divider pt-2.5">
              <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
                <Link href={`/astronaut/${person.id}`} className="text-body font-bold text-text-strong underline-offset-3 hover:text-primary-strong">
                  {person.name}
                </Link>
                <span className="text-caption text-muted">{person.role}</span>
              </div>
              <dl className="m-0 mt-1.5 grid grid-cols-5 gap-1.5 max-md:grid-cols-3 max-xs:grid-cols-2">
                {METRICS.map((metricId) => {
                  const metric = getMetric(metricId);
                  const value = metricReading(reading, metricId);
                  const scenario = resolveDayScenario(person.id, metricId, day, value);
                  return (
                    <div
                      key={metricId}
                      data-crew-metric={metricId}
                      data-status={scenario.status}
                      className={cn("min-w-0 rounded-r-xs border-l-3 px-2 py-1.25", toneSoft[toneFor(scenario.status)])}
                    >
                      <dt className="text-micro font-semibold">{metric?.label ?? metricId}</dt>
                      <dd className="m-0 text-caption font-bold tabular-nums wrap-anywhere">
                        {formatValue(metricId, value)} <span className="font-medium">{metric?.unit}</span>
                        <span className="block text-micro font-semibold">{scenario.label}</span>
                      </dd>
                    </div>
                  );
                })}
              </dl>
              {events.map((event) => (
                <p key={event.event} data-crew-event={event.event} className="mt-1.5 mb-0 text-caption text-text-subtle">
                  <strong className="font-bold text-text-strong">Scenario event · {eventLabel(event.event)}</strong>
                  {event.detail ? ` · ${event.detail}` : ""}
                </p>
              ))}
            </li>
          );
        })}
      </ul>
      <p className="mt-3 mb-0 text-caption text-muted">
        Simulated readings; sleep is self-reported. Radiation is the cumulative mission dose, not a rate or a safe limit. Colored states are authored demo
        scenarios, not medical assessments.
      </p>
    </Panel>
  );
}
