/**
 * Timing of the solar-storm scene. The scene plays the plot's sequence of events (surface walk,
 * call back, refuge); its pace and the shape of the storm are illustrative, not a measured profile.
 * Everything here is a pure function of `progress`, the 0–1 position in the scene.
 */

export type StormPhase = "walk" | "return" | "refuge";

/** Progress at which the radiation sensor rises, and at which the walkers reach the habitat. */
export const ALARM_AT = 0.14;
export const ARRIVE_AT = 0.78;

/** Seconds the whole scene takes at normal speed. */
export const SCENE_SECONDS = 38;

export const STORM_PHASES: ReadonlyArray<{ id: StormPhase; label: string; from: number }> = [
  { id: "walk", label: "Surface walk", from: 0 },
  { id: "return", label: "Return to the habitat", from: ALARM_AT },
  { id: "refuge", label: "In the refuge", from: ARRIVE_AT },
];

export function clampProgress(progress: number): number {
  return Number.isFinite(progress) ? Math.min(1, Math.max(0, progress)) : 0;
}

function smoothstep(from: number, to: number, value: number): number {
  const t = Math.min(1, Math.max(0, (value - from) / (to - from)));
  return t * t * (3 - 2 * t);
}

export function phaseAt(progress: number): StormPhase {
  const p = clampProgress(progress);
  return p < ALARM_AT ? "walk" : p < ARRIVE_AT ? "return" : "refuge";
}

/** Fraction of the walk still to cover (1 at the far point, 0 at the airlock). Never increases. */
export function walkRemaining(progress: number): number {
  const p = clampProgress(progress);
  if (p <= ALARM_AT) return 1;
  if (p >= ARRIVE_AT) return 0;
  const t = (p - ALARM_AT) / (ARRIVE_AT - ALARM_AT);
  // A steady pace with a short start and stop, so the walkers do not jump into motion.
  return 1 - (0.85 * t + 0.15 * smoothstep(0, 1, t));
}

/** Relative strength of the storm (0–1): quiet, a fast rise as the sensor trips, then a slow decline. */
export function stormIntensity(progress: number): number {
  const p = clampProgress(progress);
  const rise = smoothstep(ALARM_AT - 0.05, ALARM_AT + 0.16, p);
  const decline = 1 - 0.55 * smoothstep(0.55, 1, p);
  return rise * decline;
}

const STEPS = 400;
const CUMULATIVE: readonly number[] = (() => {
  const sums = [0];
  for (let index = 1; index <= STEPS; index += 1) {
    sums.push(sums[index - 1] + (stormIntensity((index - 0.5) / STEPS)));
  }
  const total = sums[STEPS];
  return sums.map((value) => value / total);
})();

/**
 * Share of the event dose accumulated so far (0 at the start, exactly 1 at the end, never
 * decreasing): the running total of `stormIntensity`. The scene multiplies it by each person's
 * event dose from the dataset, so the counters always end on the dataset values.
 */
export function doseFraction(progress: number): number {
  const position = clampProgress(progress) * STEPS;
  const lower = Math.floor(position);
  if (lower >= STEPS) return 1;
  const t = position - lower;
  return CUMULATIVE[lower] + (CUMULATIVE[lower + 1] - CUMULATIVE[lower]) * t;
}

/** Event dose shown at `progress` for a person whose event total is `totalMsv`; null stays null. */
export function doseSoFar(totalMsv: number | null, progress: number): number | null {
  return typeof totalMsv === "number" && Number.isFinite(totalMsv) ? totalMsv * doseFraction(progress) : null;
}
