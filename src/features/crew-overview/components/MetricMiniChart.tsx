import { buildChartSegments, type MiniChartSeries } from "../lib/mini-chart";
import type { MetricId } from "@/features/crew-health-data";

export type { MiniChartSeries } from "../lib/mini-chart";

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
  const paths = buildChartSegments(series, 144, 36, 3);
  const details = series
    .map(({ label, values }) => `${label}: ${values.map((value) => (typeof value === "number" && Number.isFinite(value) ? value : "unavailable")).join(", ")} ${unit}`)
    .join("; ");

  return (
    <svg
      className="mini-sparkline w-full aspect-[4/1] max-h-16 overflow-visible"
      viewBox="0 0 144 36"
      role="img"
      data-mini-chart={metricId}
      aria-label={`Simulated ${metricLabel} readings, days ${startDay}–${day}: ${details}`}
    >
      {paths.map((segments, seriesIndex) =>
        segments.map((points, segmentIndex) => (
          <g key={`${seriesIndex}-${segmentIndex}`}>
            <path
              d={points.map(({ x, y }, index) => `${index === 0 ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)}`).join(" ")}
              className="fill-none stroke-white"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeDasharray={seriesIndex === 1 ? "3 2" : undefined}
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
