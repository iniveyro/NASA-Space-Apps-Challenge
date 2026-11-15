/** Pure timing of the pulse animation on the 3D figure. */

function bump(phase: number, centre: number, width: number): number {
  // Shortest distance around the cycle, so a bump near the end wraps into the next beat.
  const distance = Math.abs(((phase - centre + 0.5) % 1 + 1) % 1 - 0.5);
  return Math.exp(-((distance / width) ** 2));
}

/** True for a heart rate the animation can follow; anything else shows a steady marker. */
export function validBpm(bpm: number | null | undefined): bpm is number {
  return typeof bpm === "number" && Number.isFinite(bpm) && bpm > 0 && bpm <= 240;
}

/**
 * Brightness of the pulse marker (0–1) at `seconds`, for a rate in beats per minute: a strong beat
 * followed by a weaker one, repeated `bpm` times a minute. It only paces the animation by the
 * simulated reading; it is not a waveform. Returns 0 for a missing or invalid rate.
 */
export function beatLevel(seconds: number, bpm: number | null | undefined): number {
  if (!validBpm(bpm) || !Number.isFinite(seconds)) return 0;
  const phase = ((seconds * bpm) / 60) % 1;
  return Math.min(1, bump(phase, 0.08, 0.06) + 0.5 * bump(phase, 0.36, 0.075));
}

/** Seconds between two beats; null for a missing or invalid rate. */
export function beatPeriod(bpm: number | null | undefined): number | null {
  return validBpm(bpm) ? 60 / bpm : null;
}

/** Position inside the current beat (0–1); 0 for a missing or invalid rate. */
export function beatPhase(seconds: number, bpm: number | null | undefined): number {
  if (!validBpm(bpm) || !Number.isFinite(seconds)) return 0;
  return (((seconds * bpm) / 60) % 1 + 1) % 1;
}
