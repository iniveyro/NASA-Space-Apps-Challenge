/** three.js building blocks for the mission scene: daily tracks, fat lines, the star field and particle streams. */
import { BufferAttribute, BufferGeometry, Vector3, type Color, type InterleavedBufferAttribute } from "three";
import { Line2 } from "three/examples/jsm/lines/Line2.js";
import { LineGeometry } from "three/examples/jsm/lines/LineGeometry.js";
import { LineMaterial } from "three/examples/jsm/lines/LineMaterial.js";
import { seededRandom } from "@/shared/scene/random";
import type { MissionGeometry, Vec3 } from "../../lib/geometry";
import { toScene } from "../../lib/scene-math";

export interface SceneTracks {
  total: number;
  /** Scene-space xyz triples per mission day (index `(day - 1) * 3`). */
  earth: Float32Array;
  mars: Float32Array;
  ship: Float32Array;
}

function trackFor(positions: readonly (Vec3 | null)[]): Float32Array {
  const track = new Float32Array(positions.length * 3);
  let last: Vec3 = [0, 0, 0];
  positions.forEach((position, index) => {
    // A missing sample holds the previous position, so the scene never receives NaN.
    if (position) last = toScene(position);
    track.set(last, index * 3);
  });
  return track;
}

export function buildTracks(geometry: MissionGeometry): SceneTracks {
  return { total: geometry.total, earth: trackFor(geometry.earth), mars: trackFor(geometry.mars), ship: trackFor(geometry.ship) };
}

/** Writes the position on a fractional mission day into `out` (linear interpolation between days). */
export function sampleTrack(track: Float32Array, day: number, out: Vector3): Vector3 {
  const count = track.length / 3;
  if (count === 0) return out.set(0, 0, 0);
  const clamped = Math.min(Math.max(day, 1), count);
  const lower = Math.floor(clamped);
  const a = (lower - 1) * 3;
  const b = Math.min(lower, count - 1) * 3;
  const t = clamped - lower;
  return out.set(track[a] + (track[b] - track[a]) * t, track[a + 1] + (track[b + 1] - track[a + 1]) * t, track[a + 2] + (track[b + 2] - track[a + 2]) * t);
}

/** Closed orbit line through the first `days` daily samples of a track. */
export function orbitGeometry(track: Float32Array, days: number): BufferGeometry {
  const count = Math.min(days, track.length / 3);
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new BufferAttribute(track.slice(0, count * 3), 3));
  return geometry;
}

export interface FatLineOptions {
  color: Color;
  /** Width in CSS pixels. */
  width: number;
  opacity?: number;
}

/** Screen-space line with a constant pixel width through `positions` (flat xyz triples). */
export function fatLine(positions: ArrayLike<number>, { color, width, opacity = 1 }: FatLineOptions): Line2 {
  const geometry = new LineGeometry();
  geometry.setPositions(positions as Float32Array);
  const material = new LineMaterial({ color, linewidth: width, transparent: true, opacity, depthWrite: false });
  const line = new Line2(geometry, material);
  line.frustumCulled = false;
  return line;
}

/** Moves the two ends of a single-segment fat line without reallocating its buffers. */
export function setSegment(line: Line2, from: Vector3, to: Vector3): void {
  const start = line.geometry.getAttribute("instanceStart") as InterleavedBufferAttribute;
  const array = start.data.array as Float32Array;
  array[0] = from.x;
  array[1] = from.y;
  array[2] = from.z;
  array[3] = to.x;
  array[4] = to.y;
  array[5] = to.z;
  start.data.needsUpdate = true;
}

export function disposeLine(line: Line2): void {
  line.geometry.dispose();
  line.material.dispose();
}

/** Per-particle constants of a particle stream: phase (0–1), two offsets inside the unit disc, and a speed factor. */
export const STREAM_SEED_SIZE = 4;
export function streamSeeds(count: number): Float32Array {
  const random = seededRandom(493);
  const seeds = new Float32Array(count * STREAM_SEED_SIZE);
  for (let index = 0; index < count; index += 1) {
    const radius = Math.sqrt(random());
    const angle = random() * Math.PI * 2;
    seeds.set([random(), radius * Math.cos(angle), radius * Math.sin(angle), 0.75 + random() * 0.5], index * STREAM_SEED_SIZE);
  }
  return seeds;
}

/** Empty point cloud of `count` points whose positions and brightness are rewritten every frame. */
export function streamGeometry(count: number): BufferGeometry {
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new BufferAttribute(new Float32Array(count * 3), 3));
  geometry.setAttribute("color", new BufferAttribute(new Float32Array(count * 3), 3));
  return geometry;
}

/** Deterministic background stars on a far sphere. */
export function starGeometry(count: number, radius: number): BufferGeometry {
  const random = seededRandom(2026);
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  for (let index = 0; index < count; index += 1) {
    const u = random() * 2 - 1;
    const angle = random() * Math.PI * 2;
    const ring = Math.sqrt(1 - u * u);
    const distance = radius * (0.9 + random() * 0.2);
    positions.set([ring * Math.cos(angle) * distance, u * distance, ring * Math.sin(angle) * distance], index * 3);
    const brightness = 0.35 + random() * 0.65;
    colors.set([brightness, brightness, brightness], index * 3);
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new BufferAttribute(positions, 3));
  geometry.setAttribute("color", new BufferAttribute(colors, 3));
  return geometry;
}
