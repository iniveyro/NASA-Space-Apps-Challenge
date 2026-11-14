import { formatValue, isBloodPressure, type Metric, type MetricReading, type SeriesPoint } from "@/features/crew-health-data";
import { formatShortDate } from "@/shared/lib/format-date";

export const CHART = { width: 700, height: 270, left: 54, right: 16, top: 20, bottom: 45 } as const;
export const PLOT_WIDTH = CHART.width - CHART.left - CHART.right;
export const PLOT_HEIGHT = CHART.height - CHART.top - CHART.bottom;

export function chartValues(metric: Metric, value: MetricReading): number[] {
  if (metric.id === "bloodPressure" && isBloodPressure(value)) return [value.systolic, value.diastolic];
  return [value as number];
}

export function niceTicks(min: number, max: number, count: number): number[] {
  if (min === max) return [min];
  return Array.from({ length: count }, (_, index) => max - ((max - min) * index) / (count - 1));
}

export function formatTick(metric: Metric, value: number): string {
  if (metric.id === "temperature" || metric.id === "sleep" || metric.id === "radiation") return Number(value).toFixed(1);
  return String(Math.round(value));
}

export function pointTooltip(metric: Metric, point: SeriesPoint): string {
  if (metric.id === "bloodPressure" && isBloodPressure(point.value)) {
    return `${formatShortDate(point.date)} · Systolic: ${point.value.systolic} mmHg · Diastolic: ${point.value.diastolic} mmHg`;
  }
  const value = formatValue(metric.id, point.value);
  const unit = metric.id === "mood" || metric.id === "stress" ? "of 5" : metric.unit;
  return `${formatShortDate(point.date)} · ${metric.label}: ${value} ${unit}`;
}

/** Computes the y domain and scale functions exactly as the legacy chart did. */
export function buildScales(metric: Metric, data: SeriesPoint[]) {
  const values = data.flatMap((point) => chartValues(metric, point.value));
  let min = Math.min(...values);
  let max = Math.max(...values);
  if (metric.type === "category") {
    min = 1;
    max = 5;
  } else if (min === max) {
    min -= 1;
    max += 1;
  } else {
    const pad = (max - min) * 0.16;
    min -= pad;
    max += pad;
  }
  const x = (index: number) => CHART.left + (data.length === 1 ? 0 : (index * PLOT_WIDTH) / (data.length - 1));
  const y = (value: number) => CHART.top + ((max - value) * PLOT_HEIGHT) / (max - min);
  const ticks = metric.type === "category" ? [5, 4, 3, 2, 1] : niceTicks(min, max, 4);
  return { min, max, x, y, ticks };
}

/** Maps a pointer x (in client pixels) to the nearest data index. */
export function nearestIndex(clientX: number, rect: { left: number; width: number }, count: number): number {
  const svgX = ((clientX - rect.left) * CHART.width) / rect.width;
  const index = Math.round(((svgX - CHART.left) * (count - 1)) / PLOT_WIDTH);
  return Math.max(0, Math.min(count - 1, index));
}
