import { getSeries } from "@/features/crew-health-data";

/** Seven daily fictional heart-rate readings as a compact line. */
export function HeartRateSparkline({ profileId }: { profileId: string }) {
  const points = getSeries(profileId, "heartRate", 7).map((point) => point.value);
  if (points.length !== 7 || points.some((value) => typeof value !== "number" || !Number.isFinite(value))) {
    return <span className="text-xs text-console-faint">Unavailable</span>;
  }
  const values = points as number[];
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const coordinates = values.map((value, index) => [4 + index * 18, 27 - ((value - min) * 20) / range] as const);
  const path = coordinates.map(([x, y], index) => `${index ? "L" : "M"}${x} ${y}`).join(" ");
  const [lastX, lastY] = coordinates[coordinates.length - 1];
  return (
    <svg
      className="mini-sparkline h-7 w-[min(94px,55%)] overflow-visible"
      viewBox="0 0 116 32"
      role="img"
      aria-label={`Seven daily fictional heart-rate readings: ${values.join(", ")} beats per minute`}
    >
      <path d={path} className="fill-none stroke-console-trace" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={lastX} cy={lastY} r={2.5} className="fill-console-text-soft" />
    </svg>
  );
}
