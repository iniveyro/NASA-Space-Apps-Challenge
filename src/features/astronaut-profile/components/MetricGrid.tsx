import { formatValue, metricNote, type MetricId, type Profile } from "@/features/crew-health-data";
import type { GuidanceEvaluation } from "@/features/health-guidance";
import { toneFor, toneSurface } from "@/shared/design-system";
import { cn } from "@/shared/lib/cn";
import type { DayReading } from "../lib/profile-day";

interface MetricGridProps {
  person: Profile;
  /** The ten readings of the selected mission day. */
  readings: readonly DayReading[];
  selectedMetricId: MetricId;
  onSelect: (metricId: MetricId) => void;
  onOpenGuidance: (metricId: MetricId) => void;
  evaluations: Record<MetricId, GuidanceEvaluation>;
}

function statusMetadata(evaluation: GuidanceEvaluation): { status: string; label: string; icon: string } {
  if (evaluation.status === "critical" || evaluation.safetyEscalation) return { status: "demo-alert", label: "Critical", icon: "‼" };
  if (evaluation.status === "warning") return { status: "demo-deviation", label: "Warning", icon: "!" };
  if (evaluation.status === "normal") return { status: "within-demo-reference", label: "Prevention", icon: "✓" };
  return { status: "unknown", label: "Unknown", icon: "?" };
}

/** Ten mission-day cards retain the authored data source while exposing the matching guidance state. */
export function MetricGrid({ person, readings, selectedMetricId, onSelect, onOpenGuidance, evaluations }: MetricGridProps) {
  return (
    <div id="metric-grid" className="grid grid-cols-5 gap-2.5 max-md:grid-cols-4 max-sm:grid-cols-2 max-sm:gap-2">
      {readings.map((reading) => {
        const { metric } = reading;
        const evaluation = evaluations[metric.id];
        const { status, label: statusLabel, icon } = statusMetadata(evaluation);
        const formatted = formatValue(metric.id, evaluation.value);
        const known = formatted !== "Unknown";
        const unit = metric.id === "mood" ? "of 5" : metric.unit;
        const sourceLabel = evaluation.source === "scenario"
          ? `Simulation · ${statusLabel}`
          : evaluation.source === "user"
            ? `Follow-up · ${statusLabel}`
            : `${reading.scenario.label} · ${statusLabel}`;
        const pressed = metric.id === selectedMetricId;
        return (
          <button
            key={metric.id}
            type="button"
            data-metric={metric.id}
            data-day={evaluation.missionDay}
            data-scenario={evaluation.scenarioKey}
            data-status={status}
            data-guidance-status={evaluation.status}
            aria-pressed={pressed}
            aria-label={`${person.name}: ${metric.label}: ${formatted} ${known ? unit : ""}. ${sourceLabel}. ${metric.description} Select to view guidance and history.`}
            onClick={() => { onSelect(metric.id); onOpenGuidance(metric.id); }}
            className={cn(
              "metric-card flex min-h-33 min-w-0 cursor-pointer flex-col items-start justify-between gap-2 rounded-lg border-2 px-3.5 py-3.25 text-left hover:brightness-108 focus-visible:outline-primary-strong max-sm:min-h-31 max-sm:p-2.75",
              toneSurface[toneFor(status)],
              pressed ? "border-white shadow-selected" : "border-transparent",
            )}
          >
            <span className="text-caption font-strong text-white">{metric.label}</span>
            <strong className="metric-value text-3xl leading-tight tracking-tight text-white wrap-anywhere max-sm:text-xl">
              {formatted} {known ? <span className="text-caption font-medium tracking-normal text-console-text-soft">{unit}</span> : null}
            </strong>
            <span className="metric-status inline-flex items-center gap-1.5 text-xs leading-tight font-bold"><span aria-hidden="true">{icon}</span>{sourceLabel}</span>
            <span className="text-xs text-console-text">{metricNote(metric.id)}</span>
          </button>
        );
      })}
    </div>
  );
}
