/**
 * The stylized 3D figure, described as plain data: lathe outlines, capsules and spheres in metres. The figure stands
 * on y = 0 and faces +z. It is a navigation aid like the 2D silhouette, not an anatomical model.
 */
import type { BodyRegion } from "@/features/crew-health-data";

export type Vec3 = readonly [number, number, number];

/** One point of a lathe outline: [radius, height], listed from the bottom of the part to its top. */
export type ProfilePoint = readonly [number, number];

export interface FigurePart {
  id: string;
  /** Navigation group the part selects: head and neck → brain, chest → heart, everything else → whole body. */
  region: BodyRegion;
  /** "lathe" revolves `profile` around the vertical axis; spheres and capsules use `radius` and `length`. */
  shape: "sphere" | "capsule" | "lathe";
  /** Sphere or capsule radius; for a lathe, the widest radius of its profile. */
  radius: number;
  /** Distance between the two cap centres of a capsule; height of a lathe profile; 0 for spheres. */
  length: number;
  profile?: readonly ProfilePoint[];
  position: Vec3;
  /** Rotation around the z axis in radians (leans a limb sideways). */
  tilt?: number;
  /** Rotation around the x axis in radians (lays a part forward). */
  pitch?: number;
  /** Per-axis stretch, e.g. to flatten the torso front to back. */
  scale?: Vec3;
}

/** Standing height of the figure in metres. */
export const FIGURE_HEIGHT = 1.78;

/** Front-to-back flattening of the trunk: a body is wider than it is deep. */
const TRUNK_DEPTH = 0.64;

function lathe(id: string, region: BodyRegion, profile: readonly ProfilePoint[], position: Vec3, extra: Partial<FigurePart> = {}): FigurePart {
  const heights = profile.map(([, height]) => height);
  return {
    id,
    region,
    shape: "lathe",
    radius: Math.max(...profile.map(([radius]) => radius)),
    length: Math.max(...heights) - Math.min(...heights),
    profile,
    position,
    ...extra,
  };
}

const HEAD: readonly ProfilePoint[] = [[0, -0.12], [0.04, -0.114], [0.066, -0.09], [0.08, -0.05], [0.09, 0], [0.094, 0.045], [0.088, 0.085], [0.068, 0.109], [0.034, 0.12], [0, 0.123]];
const NECK: readonly ProfilePoint[] = [[0.052, -0.07], [0.046, -0.01], [0.048, 0.05]];
const CHEST: readonly ProfilePoint[] = [[0.148, -0.19], [0.162, -0.11], [0.178, -0.02], [0.188, 0.07], [0.184, 0.125], [0.152, 0.163], [0.09, 0.183], [0.05, 0.19]];
const ABDOMEN: readonly ProfilePoint[] = [[0, -0.145], [0.1, -0.13], [0.156, -0.095], [0.172, -0.04], [0.16, 0.03], [0.146, 0.09], [0.148, 0.13]];
const UPPER_ARM: readonly ProfilePoint[] = [[0, -0.155], [0.036, -0.145], [0.043, -0.06], [0.051, 0.06], [0.05, 0.13], [0, 0.155]];
const FOREARM: readonly ProfilePoint[] = [[0, -0.14], [0.028, -0.13], [0.034, -0.05], [0.044, 0.07], [0.04, 0.125], [0, 0.14]];
const THIGH: readonly ProfilePoint[] = [[0, -0.225], [0.048, -0.212], [0.056, -0.11], [0.074, 0.07], [0.08, 0.16], [0.062, 0.212], [0, 0.225]];
const SHIN: readonly ProfilePoint[] = [[0, -0.21], [0.033, -0.2], [0.038, -0.09], [0.056, 0.06], [0.052, 0.16], [0, 0.2]];

type Side = -1 | 1;

function limb(side: Side): FigurePart[] {
  const name = side === 1 ? "left" : "right";
  return [
    { id: `shoulder-${name}`, region: "body", shape: "sphere", radius: 0.054, length: 0, position: [side * 0.192, 1.408, 0] },
    lathe(`upper-arm-${name}`, "body", UPPER_ARM, [side * 0.232, 1.255, 0], { tilt: side * 0.12 }),
    lathe(`forearm-${name}`, "body", FOREARM, [side * 0.266, 0.985, 0.02], { tilt: side * 0.07, pitch: -0.1 }),
    { id: `hand-${name}`, region: "body", shape: "sphere", radius: 0.047, length: 0, position: [side * 0.282, 0.812, 0.04], scale: [0.62, 1.25, 0.9] },
    lathe(`thigh-${name}`, "body", THIGH, [side * 0.092, 0.648, 0], { tilt: side * 0.03 }),
    lathe(`shin-${name}`, "body", SHIN, [side * 0.102, 0.262, -0.006]),
    { id: `foot-${name}`, region: "body", shape: "capsule", radius: 0.041, length: 0.11, position: [side * 0.106, 0.043, 0.05], pitch: Math.PI / 2 },
  ];
}

export const FIGURE_PARTS: readonly FigurePart[] = [
  lathe("head", "brain", HEAD, [0, 1.657, 0.008], { scale: [1, 1, 1.1] }),
  lathe("neck", "brain", NECK, [0, 1.5, -0.002]),
  lathe("chest", "heart", CHEST, [0, 1.29, 0], { scale: [1, 1, TRUNK_DEPTH] }),
  lathe("abdomen", "body", ABDOMEN, [0, 0.975, 0], { scale: [1, 1, TRUNK_DEPTH] }),
  ...limb(1),
  ...limb(-1),
];

/** Point each region's callout line starts from, on the front of the figure. */
export const REGION_ANCHORS: Readonly<Record<BodyRegion, Vec3>> = {
  brain: [0, 1.69, 0.1],
  heart: [0.045, 1.33, 0.11],
  body: [0, 0.98, 0.1],
};

/** Where the pulse marker sits: left of the sternum, inside the chest. */
export const HEART_POSITION: Vec3 = [0.04, 1.33, 0.03];

/** Navigation region of a figure part; unknown ids fall back to the whole body, like the 2D silhouette. */
export function regionForPart(partId: string | null | undefined): BodyRegion {
  return FIGURE_PARTS.find((part) => part.id === partId)?.region ?? "body";
}

/** Lowest and highest point of the figure, from the part list. */
export function figureBounds(parts: readonly FigurePart[] = FIGURE_PARTS): { minY: number; maxY: number; halfWidth: number } {
  let minY = Infinity;
  let maxY = -Infinity;
  let halfWidth = 0;
  for (const part of parts) {
    const [sx, sy] = part.scale ?? [1, 1, 1];
    const heights = part.profile?.map(([, height]) => height * sy);
    const lying = Math.abs(Math.cos(part.pitch ?? 0));
    const reach = (part.radius + (part.length / 2) * lying) * sy;
    minY = Math.min(minY, part.position[1] + (heights ? Math.min(...heights) : -reach));
    maxY = Math.max(maxY, part.position[1] + (heights ? Math.max(...heights) : reach));
    halfWidth = Math.max(halfWidth, Math.abs(part.position[0]) + part.radius * sx);
  }
  return { minY, maxY, halfWidth };
}
