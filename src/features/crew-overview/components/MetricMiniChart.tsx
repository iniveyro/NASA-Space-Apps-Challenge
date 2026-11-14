import { buildChartSegments, type MiniChartSeries } from "../lib/mini-chart";
import type { MetricId } from "@/features/crew-health-data";

export type { MiniChartSeries } from "../lib/mini-chart";

const STROKES = ["stroke-chart-primary", "stroke-chart-secondary"];

interface MetricMiniChartProps {
  day: number;
  metricLabel: string;
  metricId: MetricId;
  unit: string;
  series: readonly MiniChartSeries[];
}

/** Shows the actual seven mission-day samples; missing samples stay gaps, never interpolated. */
export function MetricMiniChart({ day, metricLabel, metricId, unit, series }: MetricMiniChartProps) {
  const length = Math.max(0, ...series.map(({ values }) => values.length));
  const startDay = day - length + 1;
  const hasReading = series.some(({ values }) => values.some((value) => typeof value === "number" && Number.isFinite(value)));
  if (!hasReading) {
    return (
      <span
        className="mini-sparkline-unavailable text-xs text-white/90"
        data-mini-chart={metricId}
        role="img"
        aria-label={`Simulated ${metricLabel} readings unavailable for days ${startDay}–${day}.`}
      >
        Unavailable
      </span>
    );
  }
  const paths = buildChartSegments(series);
  const details = series
    .map(({ label, values }) => `${label}: ${values.map((value) => (typeof value === "number" && Number.isFinite(value) ? value : "unavailable")).join(", ")} ${unit}`)
    .join("; ");

  return (
    <svg
      className="mini-sparkline h-7 w-[min(94px,55%)] overflow-visible"
      viewBox="0 0 108 24"
      role="img"
      data-mini-chart={metricId}
      aria-label={`Simulated ${metricLabel} readings, days ${startDay}–${day}: ${details}`}
    >
      {paths.map((segments, seriesIndex) =>
        segments.map((points, segmentIndex) => (
          <g key={`${seriesIndex}-${segmentIndex}`}>
            <path
              d={points.map(({ x, y }, index) => `${index === 0 ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)}`).join(" ")}
              className={`fill-none ${STROKES[seriesIndex % STROKES.length]}`}
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            {points.map(({ x, y }, pointIndex) => (
              <circle key={pointIndex} cx={x.toFixed(1)} cy={y.toFixed(1)} r={1.6} className="fill-white" />
            ))}
          </g>
        )),
      )}
    </svg>
  );
}
