/**
 * Ground of the solar-storm scene: where the habitat, the walk and the walkers are, the height of the
 * terrain, and where the camera goes. Distances are compressed for the screen (the plot's walk is
 * 1.2 km), so the units here are scene units, not meters. Pure functions of position and `progress`.
 */
import { ALARM_AT, ARRIVE_AT, clampProgress, walkRemaining } from "./timeline";

export type Vec2 = readonly [number, number];
export type Vec3 = readonly [number, number, number];
export type StormView = "follow" | "overview";

/** Waypoints of the walk on the ground (x, z), from the far point to the airlock. The habitat sits at the origin. */
const WAYPOINTS: readonly Vec2[] = [
  [-58, 25],
  [-44, 14],
  [-29, 11],
  [-15, 4],
  [-5.2, 0],
];
export const FAR_POINT: Vec2 = WAYPOINTS[0];
export const AIRLOCK: Vec2 = WAYPOINTS[WAYPOINTS.length - 1];

/** Direction of the Sun, low over the horizon beyond the habitat as the walkers head home. */
export const SUN_DIRECTION: Vec3 = (() => {
  const elevation = 0.14;
  const azimuth = -0.28;
  return [Math.cos(elevation) * Math.cos(azimuth), Math.sin(elevation), Math.cos(elevation) * Math.sin(azimuth)];
})();

function smoothstep(from: number, to: number, value: number): number {
  const t = Math.min(1, Math.max(0, (value - from) / (to - from)));
  return t * t * (3 - 2 * t);
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

const SEGMENT_STEPS = 40;

/** Catmull-Rom curve through the waypoints, sampled once with its arc length so the walk is paced by distance. */
const TABLE = (() => {
  const xs: number[] = [];
  const zs: number[] = [];
  for (let segment = 0; segment < WAYPOINTS.length - 1; segment += 1) {
    const p0 = WAYPOINTS[Math.max(0, segment - 1)];
    const p1 = WAYPOINTS[segment];
    const p2 = WAYPOINTS[segment + 1];
    const p3 = WAYPOINTS[Math.min(WAYPOINTS.length - 1, segment + 2)];
    for (let step = 0; step < SEGMENT_STEPS; step += 1) {
      const t = step / SEGMENT_STEPS;
      const point = [0, 1].map(
        (axis) =>
          0.5 *
          (2 * p1[axis] + (-p0[axis] + p2[axis]) * t + (2 * p0[axis] - 5 * p1[axis] + 4 * p2[axis] - p3[axis]) * t * t + (-p0[axis] + 3 * p1[axis] - 3 * p2[axis] + p3[axis]) * t * t * t),
      );
      xs.push(point[0]);
      zs.push(point[1]);
    }
  }
  xs.push(AIRLOCK[0]);
  zs.push(AIRLOCK[1]);
  const length: number[] = [0];
  for (let index = 1; index < xs.length; index += 1) length.push(length[index - 1] + Math.hypot(xs[index] - xs[index - 1], zs[index] - zs[index - 1]));
  return { xs, zs, length };
})();

/** Length of the walk in scene units. */
export const PATH_LENGTH = TABLE.length[TABLE.length.length - 1];

/** Ground position (x, z) a fraction of the way along the walk: 0 at the far point, 1 at the airlock. */
export function pathPoint(fraction: number): Vec2 {
  const target = Math.min(1, Math.max(0, Number.isFinite(fraction) ? fraction : 0)) * PATH_LENGTH;
  let low = 0;
  let high = TABLE.length.length - 1;
  while (high - low > 1) {
    const middle = (low + high) >> 1;
    if (TABLE.length[middle] <= target) low = middle;
    else high = middle;
  }
  const span = TABLE.length[high] - TABLE.length[low];
  const t = span > 0 ? (target - TABLE.length[low]) / span : 0;
  return [lerp(TABLE.xs[low], TABLE.xs[high], t), lerp(TABLE.zs[low], TABLE.zs[high], t)];
}

/** Direction of travel along the walk, as an angle on the ground plane: atan2(dz, dx). */
export function pathHeading(fraction: number): number {
  const before = pathPoint(Math.max(0, fraction - 0.01));
  const after = pathPoint(Math.min(1, fraction + 0.01));
  return Math.atan2(after[1] - before[1], after[0] - before[0]);
}

/** Shortest distance from a ground position to the walk. */
export function distanceToPath(x: number, z: number): number {
  let best = Infinity;
  for (let index = 0; index < TABLE.xs.length; index += 1) best = Math.min(best, Math.hypot(x - TABLE.xs[index], z - TABLE.zs[index]));
  return best;
}

/** Terrain height: rolling ground that is flat along the walk and around the habitat, with ridges on the horizon. */
export function heightAt(x: number, z: number): number {
  const rolling = 1.9 * Math.sin(x * 0.07 + 1.3) * Math.cos(z * 0.06 + 0.4) + 0.9 * Math.sin(x * 0.19 + z * 0.13) + 0.5 * Math.sin(z * 0.23 - x * 0.05 + 2);
  const radius = Math.hypot(x, z);
  const flat = smoothstep(2, 15, distanceToPath(x, z)) * smoothstep(9, 28, radius);
  const bearing = Math.atan2(z, x);
  const ridge = smoothstep(75, 150, radius) * Math.max(0, 10 + 7 * Math.sin(bearing * 3 + 0.7) + 3 * Math.sin(bearing * 7));
  return rolling * flat + ridge;
}

export interface WalkerPlace {
  x: number;
  z: number;
  /** Direction the person faces, as an angle on the ground plane: atan2(dz, dx). */
  heading: number;
  /** 0 standing still, 1 at full walking pace. */
  stride: number;
  /** True once the person has gone through the airlock. */
  inside: boolean;
}

/** How fast the walkers move at `progress`, from 0 (standing) to 1 (full pace). */
export function walkSpeed(progress: number): number {
  const p = clampProgress(progress);
  if (p <= ALARM_AT || p >= ARRIVE_AT) return 0;
  const step = 0.004;
  const speed = (walkRemaining(progress - step) - walkRemaining(progress + step)) / (2 * step);
  return Math.min(1, Math.max(0, speed / 1.9));
}

/** Where walker 0 (leads) or 1 (a few steps behind and to the side) is at `progress`. */
export function walkerPlace(index: 0 | 1, progress: number): WalkerPlace {
  const remaining = walkRemaining(progress);
  const lag = index === 1 ? 0.045 * smoothstep(0, 0.1, remaining) : 0;
  const along = Math.max(0, 1 - remaining - lag);
  const [x, z] = pathPoint(along);
  const heading = pathHeading(along);
  const side = index === 1 ? lerp(0.7, 1.5, smoothstep(0, 0.2, remaining)) : -0.25;
  return {
    x: x - Math.sin(heading) * side,
    z: z + Math.cos(heading) * side,
    heading,
    stride: walkSpeed(progress),
    inside: clampProgress(progress) >= ARRIVE_AT + 0.03,
  };
}

export interface CameraPlan {
  position: Vec3;
  target: Vec3;
}

function wrapAngle(angle: number): number {
  return Math.atan2(Math.sin(angle), Math.cos(angle));
}

/** The "follow" camera before it swings round the habitat: a few steps behind and above the two people. */
function chasePlan(progress: number): CameraPlan {
  const lead = walkerPlace(0, progress);
  const trail = walkerPlace(1, progress);
  const direction: Vec2 = [Math.cos(lead.heading), Math.sin(lead.heading)];
  const distance = 7 + 5 * smoothstep(ALARM_AT, ALARM_AT + 0.15, progress);
  const middle: Vec2 = [(lead.x + trail.x) / 2, (lead.z + trail.z) / 2];
  return {
    position: [middle[0] - direction[0] * distance + direction[1] * 3, 3 + distance * 0.06, middle[1] - direction[1] * distance - direction[0] * 3],
    target: [middle[0] + direction[0] * 1.5, 1.4, middle[1] + direction[1] * 1.5],
  };
}

/**
 * Where the camera should be at `progress` (`elapsed` seconds add a slow drift). "follow" walks behind the two
 * people, pulls back as the storm builds, then circles the habitat from where it stood once they are inside;
 * "overview" circles from far enough to see the whole walk.
 */
export function cameraPlan(view: StormView, progress: number, elapsed: number): CameraPlan {
  const p = clampProgress(progress);
  if (view === "overview") {
    const angle = -0.6 + elapsed * 0.05;
    const radius = 54;
    return { position: [-24 + Math.cos(angle) * radius, 24, 9 + Math.sin(angle) * radius], target: [-24, 1, 9] };
  }
  const chase = chasePlan(p);
  const refuge = smoothstep(ARRIVE_AT - 0.05, ARRIVE_AT + 0.08, p);
  if (refuge === 0) return chase;
  // Blend in polar coordinates around the habitat, so the camera never cuts through it on the way round.
  const settled = chasePlan(ARRIVE_AT).position;
  const orbitAngle = Math.atan2(settled[2], settled[0]) + 0.7 * (p - ARRIVE_AT) + 0.03 * elapsed;
  const chaseAngle = Math.atan2(chase.position[2], chase.position[0]);
  const angle = chaseAngle + wrapAngle(orbitAngle - chaseAngle) * refuge;
  const radius = lerp(Math.hypot(chase.position[0], chase.position[2]), 24, refuge);
  return {
    position: [Math.cos(angle) * radius, lerp(chase.position[1], 8, refuge), Math.sin(angle) * radius],
    target: [lerp(chase.target[0], 0, refuge), lerp(chase.target[1], 2, refuge), lerp(chase.target[2], 0, refuge)],
  };
}
