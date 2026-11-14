import { ENVIRONMENT, formatValue, latest, resolveMetricScenario, type Metric, type Profile } from "@/features/crew-health-data";
import { toneFor, toneSoft } from "@/shared/design-system";
import { cn } from "@/shared/lib/cn";

/** Reference detail for the selected metric: reading, fictional baseline, and caveats. */
export function MetricReference({ person, metric }: { person: Profile; metric: Metric }) {
  const value = latest(person.id, metric.id);
  const scenario = resolveMetricScenario(person.id, metric.id, value);
  const reading = formatValue(metric.id, value);
  const baseline = scenario.baseline == null ? "Unavailable" : formatValue(metric.id, scenario.baseline);
  return (
    <article
      id="metric-reference"
      aria-live="polite"
      aria-label="Selected metric reference detail"
      data-status={scenario.status}
      className={cn(
        "mt-3 grid grid-cols-[minmax(160px,.8fr)_minmax(240px,1fr)_minmax(200px,1fr)] items-center gap-3.5 rounded-md border-l-5 px-4.25 py-3.75 max-sm:grid-cols-1 max-sm:gap-2.25",
        toneSoft[toneFor(scenario.status)],
      )}
    >
      <div>
        <p className="mb-0.75 text-2xs font-bold tracking-eyebrow text-current">SIMULATED REFERENCE · {ENVIRONMENT.toUpperCase()} CONTEXT</p>
        <h3 className="m-0 text-body">
          {metric.label} · {scenario.label}
        </h3>
      </div>
      <dl className="m-0 flex flex-wrap gap-x-5 gap-y-2">
        <div className="min-w-30">
          <dt className="text-xs font-strong">Current fictional reading</dt>
          <dd className="mt-0.5 ml-0 text-md font-heavy">
            {reading} {metric.unit}
          </dd>
        </div>
        <div className="min-w-30">
          <dt className="text-xs font-strong">{scenario.baselineLabel || "Fictional baseline"}</dt>
          <dd className="mt-0.5 ml-0 text-md font-heavy">
            {baseline} {metric.unit}
          </dd>
        </div>
      </dl>
      <p className="m-0 text-xs leading-snug">{scenario.reference}</p>
      <p className="col-span-full m-0 text-xs leading-snug opacity-90 max-sm:col-auto">
        {scenario.evidence || "Status is unavailable because an authored demo reference or reading is missing."} Environment is context only; no
        environment-specific medical ranges are validated. Earth, Moon, and Mars are supported as context labels only and do not change values or
        statuses.
      </p>
    </article>
  );
}
