export interface MiniChartSeries {
  label: string;
  values: readonly (number | null)[];
}

export interface ChartPoint {
  x: number;
  y: number;
}

/** Maps finite history values to a shared scale while preserving missing-day gaps. */
export function buildChartSegments(
  series: readonly MiniChartSeries[],
  width = 108,
  height = 24,
  padding = 2,
): ChartPoint[][][] {
  const finiteValues = series.flatMap(({ values }) => values.filter((value): value is number => typeof value === "number" && Number.isFinite(value)));
  if (finiteValues.length === 0) return series.map(() => []);

  const min = Math.min(...finiteValues);
  const max = Math.max(...finiteValues);
  const range = max - min;
  const plotHeight = height - padding * 2;
  const denominator = Math.max(...series.map(({ values }) => values.length)) - 1;

  return series.map(({ values }) => {
    const segments: ChartPoint[][] = [];
    let segment: ChartPoint[] = [];
    values.forEach((value, index) => {
      if (typeof value !== "number" || !Number.isFinite(value)) {
        if (segment.length) segments.push(segment);
        segment = [];
        return;
      }

      const x = denominator <= 0 ? width / 2 : padding + (index / denominator) * (width - padding * 2);
      const y = range === 0 ? height / 2 : height - padding - ((value - min) / range) * plotHeight;
      segment.push({ x, y });
    });
    if (segment.length) segments.push(segment);
    return segments;
  });
}
