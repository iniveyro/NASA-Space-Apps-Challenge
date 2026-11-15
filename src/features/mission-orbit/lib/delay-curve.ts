/**
 * Geometry of the "delay across the mission" chart. Pure, so the drawing can be unit-tested:
 * x is the mission day, y is the one-way signal time (0 at the bottom, the mission maximum at the top).
 */
export interface DelayCurve {
  /** SVG path of the delay line, and of the filled area under it. Empty when there is no data. */
  line: string;
  area: string;
  /** Longest one-way delay in the series, in minutes (0 when there is no data). */
  maxMin: number;
}

/** Horizontal position of a mission day in a chart `width` units wide. */
export function curveX(day: number, total: number, width: number): number {
  if (!(total > 1) || !Number.isFinite(day)) return 0;
  return (Math.min(Math.max(day, 1), total) - 1) / (total - 1) * width;
}

/** Vertical position of a delay in a chart `height` units tall (SVG y grows downward). Unknown values sit on the baseline. */
export function curveY(minutes: number | null | undefined, maxMin: number, height: number): number {
  if (typeof minutes !== "number" || !Number.isFinite(minutes) || !(maxMin > 0)) return height;
  return height - (Math.min(Math.max(minutes, 0), maxMin) / maxMin) * height;
}

/** Builds the line and area paths. Days without a value break the line instead of being drawn as zero. */
export function buildDelayCurve(delays: readonly (number | null)[], width: number, height: number): DelayCurve {
  const total = delays.length;
  const maxMin = delays.reduce<number>((max, value) => (typeof value === "number" && Number.isFinite(value) && value > max ? value : max), 0);
  const line: string[] = [];
  const area: string[] = [];
  let runStart: number | null = null;
  let lastX = 0;
  const closeRun = () => {
    if (runStart === null) return;
    area.push(`L${lastX.toFixed(1)} ${height}L${runStart.toFixed(1)} ${height}Z`);
    runStart = null;
  };
  delays.forEach((value, index) => {
    if (typeof value !== "number" || !Number.isFinite(value)) {
      closeRun();
      return;
    }
    const x = curveX(index + 1, total, width);
    const point = `${x.toFixed(1)} ${curveY(value, maxMin, height).toFixed(1)}`;
    line.push(`${runStart === null ? "M" : "L"}${point}`);
    area.push(`${runStart === null ? "M" : "L"}${point}`);
    if (runStart === null) runStart = x;
    lastX = x;
  });
  closeRun();
  return { line: line.join(""), area: area.join(""), maxMin };
}
