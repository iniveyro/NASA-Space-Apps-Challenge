/**
 * Pure helpers that turn mission geometry into 3D scene coordinates, camera framing, and signal
 * animation timing. No three.js imports here, so everything is unit-testable in Node.
 */
import type { MissionPhase } from "@/features/crew-health-data";
import type { Vec3 } from "./geometry";

/** Scene units per astronomical unit. Distances between bodies are to scale; body sizes are not. */
export const SCENE_UNITS_PER_AU = 10;

/** Display radii in scene units. Real radii would be invisible at this scale, so bodies are enlarged. */
export const BODY_RADIUS = { sun: 0.7, earth: 0.38, mars: 0.3 } as const;

/** Seconds of animation per minute of real signal travel time. */
export const PULSE_SECONDS_PER_MINUTE = 0.25;
const PULSE_MIN_SECONDS = 0.45;
/** Seconds between two pulses leaving the same end of the link. */
export const PULSE_INTERVAL_SECONDS = 1.3;

/** Ecliptic (x, y, z north) → scene (x right, y up, z toward the viewer). Keeps a right-handed frame. */
export function toScene(position: Vec3): Vec3 {
  return [position[0] * SCENE_UNITS_PER_AU, position[2] * SCENE_UNITS_PER_AU, -position[1] * SCENE_UNITS_PER_AU];
}

/** On-screen travel time of one signal pulse. Proportional to the real delay, with a visible minimum. */
export function pulseTravelSeconds(delayMin: number | null | undefined): number | null {
  if (typeof delayMin !== "number" || !Number.isFinite(delayMin) || delayMin <= 0) return null;
  return Math.max(PULSE_MIN_SECONDS, delayMin * PULSE_SECONDS_PER_MINUTE);
}

/** Progress (0–1) along the link of each pulse in flight at `time` seconds. */
export function pulseProgress(time: number, travelSeconds: number, offset = 0): number[] {
  if (!(travelSeconds > 0) || !Number.isFinite(time)) return [];
  const count = Math.max(1, Math.ceil(travelSeconds / PULSE_INTERVAL_SECONDS));
  const cycle = count * PULSE_INTERVAL_SECONDS;
  const progress: number[] = [];
  for (let index = 0; index < count; index += 1) {
    const elapsed = (((time + offset + index * PULSE_INTERVAL_SECONDS) % cycle) + cycle) % cycle;
    if (elapsed <= travelSeconds) progress.push(elapsed / travelSeconds);
  }
  return progress;
}

export type CameraView = "overview" | "mars" | "crew";

/** View used by the automatic camera for each mission phase. */
export function viewForPhase(phase: MissionPhase | null | undefined): CameraView {
  return phase === "mars_arrival" || phase === "surface" || phase === "mars_departure" ? "mars" : "overview";
}

export interface CameraFrame {
  position: Vec3;
  target: Vec3;
}

const UP: Vec3 = [0, 1, 0];

function add(a: Vec3, b: Vec3): Vec3 {
  return [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
}

function scale(a: Vec3, factor: number): Vec3 {
  return [a[0] * factor, a[1] * factor, a[2] * factor];
}

function length(a: Vec3): number {
  return Math.hypot(a[0], a[1], a[2]);
}

function normalize(a: Vec3, fallback: Vec3): Vec3 {
  const size = length(a);
  return size > 1e-6 ? scale(a, 1 / size) : fallback;
}

function cross(a: Vec3, b: Vec3): Vec3 {
  return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
}

/** Extra distance so the whole scene still fits when the viewport is taller than it is wide. */
function aspectFit(aspect: number): number {
  return Number.isFinite(aspect) && aspect > 0 ? Math.max(1, 1.35 / aspect) : 1;
}

/**
 * Camera framing for a view, in scene coordinates.
 * - overview: the whole inner solar system, seen from above the ecliptic at an angle.
 * - mars: from behind Mars looking sunward, so the Mars–Sun–Earth line reads at a glance.
 * - crew: over the spacecraft's shoulder, looking home along the link.
 */
export function cameraFrame(view: CameraView, bodies: { earth: Vec3; mars: Vec3; ship: Vec3 }, aspect: number): CameraFrame {
  const fit = aspectFit(aspect);
  if (view === "mars") {
    const outward = normalize([bodies.mars[0], 0, bodies.mars[2]], [1, 0, 0]);
    const reach = length(bodies.mars);
    return {
      position: add(scale(outward, reach + 15 * fit), scale(UP, 11.5 * fit)),
      target: scale(outward, reach * 0.3),
    };
  }
  if (view === "crew") {
    const toEarth: Vec3 = [bodies.earth[0] - bodies.ship[0], bodies.earth[1] - bodies.ship[1], bodies.earth[2] - bodies.ship[2]];
    const range = length(toEarth);
    if (range > 0.5) {
      const forward = normalize(toEarth, [0, 0, -1]);
      const side = normalize(cross(forward, UP), [1, 0, 0]);
      const back = Math.min(9, 3.5 + range * 0.35) * fit;
      return {
        position: add(add(bodies.ship, scale(forward, -back)), add(scale(UP, back * 0.42), scale(side, back * 0.3))),
        target: add(bodies.ship, scale(forward, range * 0.55)),
      };
    }
  }
  return { position: [0, 31 * fit, 27 * fit], target: [0, 0, 0] };
}
