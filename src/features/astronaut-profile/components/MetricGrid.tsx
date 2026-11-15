"use client";

import { metricNote, type MetricId } from "@/features/crew-health-data";
import { toneFor, toneSurface } from "@/shared/design-system";
import { cn } from "@/shared/lib/cn";
import { readingText, type DayReading } from "../lib/profile-day";

interface MetricGridProps {
  /** The ten readings of the selected mission day. */
  readings: readonly DayReading[];
  selectedMetricId: MetricId;
  onSelect: (metricId: MetricId) => void;
}

/** Ten reading cards for the selected mission day. Each card is a pressed-state button that selects the chart metric. */
export function MetricGrid({ readings, selectedMetricId, onSelect }: MetricGridProps) {
  return (
    <div id="metric-grid" className="grid grid-cols-5 gap-2.5 max-md:grid-cols-4 max-sm:grid-cols-2 max-sm:gap-2">
      {readings.map((reading) => {
        const { metric, formatted, scenario } = reading;
        const known = formatted !== "Unknown";
        const unit = metric.id === "mood" || metric.id === "stress" ? "of 5" : metric.unit;
        const pressed = metric.id === selectedMetricId;
        return (
          <button
            key={metric.id}
            type="button"
            data-metric={metric.id}
            data-status={scenario.status}
            aria-pressed={pressed}
            aria-label={`${metric.label}: ${readingText(reading)}. ${scenario.label}. ${metric.description} Select to view history.`}
            onClick={() => onSelect(metric.id)}
            className={cn(
              "metric-card flex min-h-33 min-w-0 cursor-pointer flex-col items-start justify-between gap-2 rounded-lg border-2 px-3.5 py-3.25 text-left hover:brightness-108 focus-visible:outline-primary-strong max-sm:min-h-31 max-sm:p-2.75",
              toneSurface[toneFor(scenario.status)],
              pressed ? "border-white shadow-selected" : "border-transparent",
            )}
          >
            <span className="text-caption font-strong text-white">{metric.label}</span>
            <strong className="metric-value text-3xl leading-tight tracking-tight text-white wrap-anywhere max-sm:text-xl">
              {formatted} {known ? <span className="text-caption font-medium tracking-normal text-console-text-soft">{unit}</span> : null}
            </strong>
            <span className="metric-status inline-flex items-center gap-1.5 text-xs leading-tight font-bold">{scenario.label}</span>
            <span className="text-xs text-console-text">{metricNote(metric.id)}</span>
          </button>
        );
      })}
    </div>
  );
}
