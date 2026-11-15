/** The ground, the sky and the rocks of the storm scene. */
import {
  BackSide,
  BufferGeometry,
  CircleGeometry,
  Color,
  CylinderGeometry,
  DodecahedronGeometry,
  Float32BufferAttribute,
  Group,
  InstancedMesh,
  Line,
  LineDashedMaterial,
  Mesh,
  MeshBasicMaterial,
  MeshLambertMaterial,
  Object3D,
  PlaneGeometry,
  SphereGeometry,
  Vector3,
} from "three";
import { seededRandom } from "@/shared/scene/random";
import { FAR_POINT, SUN_DIRECTION, distanceToPath, heightAt, pathPoint } from "../../lib/surface";
import type { Keep, Palette } from "./palette";

/** Radius of the sky dome; the camera stays well inside it. */
export const SKY_RADIUS = 420;

/** Bare, rolling ground with vertex colors: darker in the hollows, lighter on the rises. */
export function buildTerrain(palette: Palette, keep: Keep): Mesh {
  const geometry = keep(new PlaneGeometry(320, 320, 128, 128));
  geometry.rotateX(-Math.PI / 2);
  const position = geometry.getAttribute("position");
  const colors = new Float32Array(position.count * 3);
  const dark = palette.mars.clone().multiplyScalar(0.4);
  const light = palette.mars.clone().lerp(palette.sun, 0.24);
  const color = new Color();
  for (let index = 0; index < position.count; index += 1) {
    const x = position.getX(index);
    const z = position.getZ(index);
    const y = heightAt(x, z);
    position.setY(index, y);
    const grain = 0.5 + 0.5 * Math.sin(x * 0.31 + Math.sin(z * 0.17) * 2.1) * Math.sin(z * 0.27 - x * 0.09);
    color.copy(dark).lerp(light, Math.min(1, Math.max(0, 0.3 + 0.45 * grain + 0.035 * y)));
    colors[index * 3] = color.r;
    colors[index * 3 + 1] = color.g;
    colors[index * 3 + 2] = color.b;
  }
  geometry.setAttribute("color", new Float32BufferAttribute(colors, 3));
  geometry.computeVertexNormals();
  return new Mesh(geometry, keep(new MeshLambertMaterial({ vertexColors: true })));
}

/** Scattered rocks, kept off the walk and away from the habitat. */
export function buildRocks(palette: Palette, keep: Keep, count = 170): InstancedMesh {
  const random = seededRandom(493);
  const mesh = keep(new InstancedMesh(keep(new DodecahedronGeometry(1, 0)), keep(new MeshLambertMaterial({ flatShading: true })), count));
  const dummy = new Object3D();
  const color = new Color();
  let placed = 0;
  while (placed < count) {
    const angle = random() * Math.PI * 2;
    const radius = 14 + Math.sqrt(random()) * 130;
    const x = Math.cos(angle) * radius;
    const z = Math.sin(angle) * radius;
    if (distanceToPath(x, z) < 3.5) continue;
    const scale = 0.25 + random() ** 2.2 * 1.9;
    dummy.position.set(x, heightAt(x, z) + scale * 0.25, z);
    dummy.rotation.set(random() * 3, random() * 6, random() * 3);
    dummy.scale.set(scale * (0.8 + random() * 0.5), scale * (0.5 + random() * 0.4), scale * (0.8 + random() * 0.5));
    dummy.updateMatrix();
    mesh.setMatrixAt(placed, dummy.matrix);
    color.copy(palette.mars).multiplyScalar(0.35 + random() * 0.35);
    mesh.setColorAt(placed, color);
    placed += 1;
  }
  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  return mesh;
}

/** Dashed line over the ground along the walk, and a cairn at the far point where the walk starts. */
export function buildWalkMarks(palette: Palette, keep: Keep): Group {
  const group = new Group();
  const points: number[] = [];
  for (let step = 0; step <= 160; step += 1) {
    const [x, z] = pathPoint(step / 160);
    points.push(x, 0.12, z);
  }
  const geometry = keep(new BufferGeometry());
  geometry.setAttribute("position", new Float32BufferAttribute(points, 3));
  const line = new Line(geometry, keep(new LineDashedMaterial({ color: palette.signal, dashSize: 1.1, gapSize: 0.9, transparent: true, opacity: 0.7, depthWrite: false })));
  line.computeLineDistances();
  group.add(line);

  const stone = keep(new DodecahedronGeometry(1, 0));
  const stoneMaterial = keep(new MeshLambertMaterial({ color: palette.mars.clone().multiplyScalar(0.55), flatShading: true }));
  const cairn = new Group();
  cairn.position.set(FAR_POINT[0] + 9, 0, FAR_POINT[1] + 7);
  [
    { x: 0, y: 0.35, z: 0, s: 0.7 },
    { x: 0.5, y: 0.25, z: 0.4, s: 0.5 },
    { x: 0.1, y: 0.85, z: 0.1, s: 0.4 },
  ].forEach((rock) => {
    const mesh = new Mesh(stone, stoneMaterial);
    mesh.position.set(rock.x, rock.y, rock.z);
    mesh.scale.setScalar(rock.s);
    cairn.add(mesh);
  });
  group.add(cairn);
  return group;
}

/** A soft dark oval on the ground that stands in for a long low-Sun shadow (no shadow maps). */
export function shadowBlob(keep: Keep, color: Color, length: number, width: number, opacity: number): Mesh {
  const geometry = keep(new CircleGeometry(1, 28));
  geometry.rotateX(-Math.PI / 2);
  const mesh = new Mesh(geometry, keep(new MeshBasicMaterial({ color, transparent: true, opacity, depthWrite: false })));
  mesh.scale.set(length, 1, width);
  mesh.renderOrder = 1;
  return mesh;
}

/** Unit direction on the ground (x, z) in which shadows fall: away from the Sun. */
export const SHADOW_DIRECTION: readonly [number, number] = (() => {
  const length = Math.hypot(SUN_DIRECTION[0], SUN_DIRECTION[2]);
  return [-SUN_DIRECTION[0] / length, -SUN_DIRECTION[2] / length];
})();

/** Places a shadow blob so one end sits at (x, z) and it lies along the shadow direction. */
export function placeShadow(blob: Mesh, x: number, z: number, length: number): void {
  blob.position.set(x + SHADOW_DIRECTION[0] * length, 0.07, z + SHADOW_DIRECTION[1] * length);
  blob.rotation.y = -Math.atan2(SHADOW_DIRECTION[1], SHADOW_DIRECTION[0]);
}

const horizonQuiet = (palette: Palette) => palette.sunGlow.clone().lerp(palette.mars, 0.55).multiplyScalar(0.95);
const zenithQuiet = (palette: Palette) => palette.mars.clone().lerp(palette.void, 0.55);
const horizonStorm = (palette: Palette) => palette.mars.clone().lerp(palette.void, 0.45);
const zenithStorm = (palette: Palette) => palette.mars.clone().lerp(palette.void, 0.62);

/** Sky dome whose colors drift from a clear butterscotch sky to a dust-filled one as the storm builds. */
export class SkyDome {
  readonly mesh: Mesh;
  private readonly colors: Float32Array;
  private readonly attribute: Float32BufferAttribute;
  private readonly directions: Vector3[] = [];
  private readonly palette: Palette;
  private readonly horizon: Color[];
  private readonly zenith: Color[];
  private shown = -1;

  constructor(palette: Palette, keep: Keep) {
    this.palette = palette;
    this.horizon = [horizonQuiet(palette), horizonStorm(palette)];
    this.zenith = [zenithQuiet(palette), zenithStorm(palette)];
    const geometry = keep(new SphereGeometry(SKY_RADIUS, 40, 20));
    const position = geometry.getAttribute("position");
    for (let index = 0; index < position.count; index += 1) this.directions.push(new Vector3(position.getX(index), position.getY(index), position.getZ(index)).normalize());
    this.attribute = new Float32BufferAttribute(position.count * 3, 3);
    this.colors = this.attribute.array as Float32Array;
    geometry.setAttribute("color", this.attribute);
    const material = keep(new MeshBasicMaterial({ vertexColors: true, side: BackSide, depthWrite: false, fog: false }));
    this.mesh = new Mesh(geometry, material);
    this.mesh.renderOrder = -1;
    this.mesh.frustumCulled = false;
    this.update(0);
  }

  /** Color of the horizon, which the haze (fog) follows. */
  horizonColor(intensity: number, out: Color): Color {
    return out.copy(this.horizon[0]).lerp(this.horizon[1], intensity);
  }

  update(intensity: number): void {
    if (Math.abs(intensity - this.shown) < 0.01) return;
    this.shown = intensity;
    const horizon = this.horizonColor(intensity, new Color());
    const zenith = this.zenith[0].clone().lerp(this.zenith[1], intensity);
    const color = new Color();
    const glow = this.palette.sun;
    const glowStrength = 0.55 * (1 - 0.85 * intensity);
    this.directions.forEach((direction, index) => {
      const height = Math.pow(Math.max(0, direction.y), 0.55);
      color.copy(horizon).lerp(zenith, height);
      const toSun = Math.max(0, direction.x * SUN_DIRECTION[0] + direction.y * SUN_DIRECTION[1] + direction.z * SUN_DIRECTION[2]);
      color.lerp(glow, glowStrength * Math.pow(toSun, 7));
      this.colors[index * 3] = color.r;
      this.colors[index * 3 + 1] = color.g;
      this.colors[index * 3 + 2] = color.b;
    });
    this.attribute.needsUpdate = true;
  }
}

export function groundDisc(keep: Keep, color: Color, radius: number): Mesh {
  const mesh = new Mesh(keep(new CylinderGeometry(radius, radius * 1.05, 0.2, 40)), keep(new MeshLambertMaterial({ color })));
  mesh.position.y = 0.1;
  return mesh;
}
