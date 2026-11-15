function finite(value: number | null | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

/** Signal travel time from minutes: "8 s", "4 min 6 s", "19 min 51 s". Missing values read "Unknown". */
export function formatDelay(minutes: number | null | undefined): string {
  if (!finite(minutes) || minutes < 0) return "Unknown";
  const totalSeconds = Math.round(minutes * 60);
  if (totalSeconds < 60) return `${totalSeconds} s`;
  const seconds = totalSeconds % 60;
  return `${Math.floor(totalSeconds / 60)} min ${seconds} s`;
}

/** Compact variant for tight labels: "8 s", "4.1 min". */
export function formatDelayShort(minutes: number | null | undefined): string {
  if (!finite(minutes) || minutes < 0) return "Unknown";
  if (minutes < 1) return `${Math.round(minutes * 60)} s`;
  return `${minutes.toFixed(1)} min`;
}

/** "357.07 million km"; missing values read "Unknown". */
export function formatMkm(value: number | null | undefined): string {
  if (!finite(value)) return "Unknown";
  return `${value.toFixed(2)} million km`;
}

export function formatDegrees(value: number | null | undefined): string {
  if (!finite(value)) return "Unknown";
  return `${value.toFixed(2)}°`;
}

export function pluralDays(count: number): string {
  return `${count} ${count === 1 ? "day" : "days"}`;
}
