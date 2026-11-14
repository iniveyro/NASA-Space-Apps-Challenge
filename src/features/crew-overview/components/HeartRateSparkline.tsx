/** Daily simulated heart-rate readings ending at the selected mission day, as a compact line. */
export function HeartRateSparkline({ values, endDay }: { values: readonly (number | null)[]; endDay: number }) {
  if (values.length < 2 || values.some((value) => typeof value !== "number" || !Number.isFinite(value))) {
    return <span className="mini-sparkline-unavailable text-xs text-console-faint">Unavailable</span>;
  }
  const points = values as number[];
  const min = Math.min(...points);
  const max = Math.max(...points);
  const range = max - min || 1;
  const step = 108 / (points.length - 1);
  const coordinates = points.map((value, index) => [4 + index * step, 27 - ((value - min) * 20) / range] as const);
  const path = coordinates.map(([x, y], index) => `${index ? "L" : "M"}${x.toFixed(1)} ${y.toFixed(1)}`).join(" ");
  const [lastX, lastY] = coordinates[coordinates.length - 1];
  const startDay = endDay - points.length + 1;
  return (
    <svg
      className="mini-sparkline h-7 w-[min(94px,55%)] overflow-visible"
      viewBox="0 0 116 32"
      role="img"
      aria-label={`Simulated heart-rate readings, days ${startDay}–${endDay}: ${points.join(", ")} beats per minute`}
    >
      <path d={path} className="fill-none stroke-console-trace" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={lastX.toFixed(1)} cy={lastY.toFixed(1)} r={2.5} className="fill-console-text-soft" />
    </svg>
  );
}
