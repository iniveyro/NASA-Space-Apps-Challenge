/**
 * The solar-storm scene as plain three.js objects: Mars' surface, the habitat, two people walking home, the
 * storm and the camera. React only mounts it and calls `update` once per frame (see StormScene); everything
 * that moves is mutated here, outside React state.
 */
import {
  AdditiveBlending,
  AmbientLight,
  BufferGeometry,
  Color,
  DirectionalLight,
  Float32BufferAttribute,
  Fog,
  Group,
  LineBasicMaterial,
  LineSegments,
  Points,
  PointsMaterial,
  Sprite,
  SpriteMaterial,
  Vector3,
  type Camera,
  type Scene,
} from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { seededRandom } from "@/shared/scene/random";
import { glowTexture } from "@/shared/scene/textures";
import { SUN_DIRECTION, cameraPlan, heightAt, walkerPlace, type StormView, type WalkerPlace } from "../../lib/surface";
import { ALARM_AT, ARRIVE_AT, clampProgress, stormIntensity } from "../../lib/timeline";
import { HABITAT_LABEL_HEIGHT, REFUGE_AT, buildHabitat, type Habitat } from "./habitat";
import { readPalette, type Disposable, type Palette } from "./palette";
import { buildTerrain, buildRocks, buildWalkMarks, SKY_RADIUS, SkyDome } from "./world";
import { buildWalker, poseWalker, WALKER_HEIGHT, type Walker } from "./walkers";

export type StormLabel = "walkerA" | "walkerB" | "habitat" | "refuge" | "sun";
export const STORM_LABELS: readonly StormLabel[] = ["walkerA", "walkerB", "habitat", "refuge", "sun"];
/** Pixels each label sits above its anchor. */
const LABEL_LIFT: Readonly<Record<StormLabel, number>> = { walkerA: 8, walkerB: 8, habitat: 10, refuge: 8, sun: 20 };

const DUST_COUNT = 2400;
const DUST_HALF = 125;
const DUST_HEIGHT = 24;
const STREAK_COUNT = 240;
const STREAK_TRAVEL = 330;
const STREAK_SPEED = 95;
const WIND: readonly [number, number] = [0.86, 0.51];

export interface StormFrame {
  camera: Camera;
  controls: OrbitControls | null;
  scene: Scene;
  width: number;
  height: number;
  /** Seconds since the scene started, and since the previous frame. */
  elapsed: number;
  delta: number;
  /** Position in the scene, 0–1; the scene glides to it. */
  progress: number;
  view: StormView;
  reducedMotion: boolean;
  /** True while the camera rig, not the visitor, drives the camera. */
  engaged: boolean;
  placeLabel: (key: StormLabel, x: number, y: number, visible: boolean) => void;
}

/** Orbit controls tuned for this scene: no panning, never below the ground, and vertical swipes still scroll the page. */
export function createStormControls(camera: Camera, element: HTMLElement, damping: boolean): OrbitControls {
  const controls = new OrbitControls(camera, element);
  controls.enablePan = false;
  controls.enableDamping = damping;
  controls.dampingFactor = 0.09;
  controls.rotateSpeed = 0.6;
  controls.zoomSpeed = 0.7;
  controls.minDistance = 4;
  controls.maxDistance = 95;
  controls.maxPolarAngle = Math.PI * 0.49;
  element.style.touchAction = "pan-y";
  return controls;
}

function smooth(from: number, to: number, value: number): number {
  const t = Math.min(1, Math.max(0, (value - from) / (to - from)));
  return t * t * (3 - 2 * t);
}

export class StormScene {
  readonly root = new Group();

  private readonly disposables: Disposable[] = [];
  private readonly palette: Palette;
  private readonly sky: SkyDome;
  private readonly habitat: Habitat;
  private readonly walkers: [Walker, Walker];
  private readonly sunLight: DirectionalLight;
  private readonly ambient: AmbientLight;
  private readonly sunGlow: SpriteMaterial;
  private readonly sunCore: SpriteMaterial;
  private readonly fog: Fog;
  private readonly dust: Points;
  private readonly dustSeeds: Float32Array;
  private readonly streaks: LineSegments;
  private readonly streakSeeds: Float32Array;
  private readonly fogColor = new Color();
  private readonly a = new Vector3();
  private readonly b = new Vector3();
  private readonly lastPlan = new Vector3();
  private shown: number;
  private framed = false;
  private fogAttached = false;
  private clock = 0;

  constructor(startProgress: number) {
    this.shown = clampProgress(startProgress);
    const keep = <T extends Disposable>(resource: T): T => {
      this.disposables.push(resource);
      return resource;
    };
    const palette = readPalette();
    this.palette = palette;

    this.sky = new SkyDome(palette, keep);
    this.root.add(this.sky.mesh);

    this.fog = new Fog(palette.mars.clone(), 70, 330);

    this.ambient = new AmbientLight(palette.mars.clone().lerp(palette.star, 0.25), 1.15);
    this.sunLight = new DirectionalLight(palette.sun, 3);
    this.sunLight.position.set(...SUN_DIRECTION).multiplyScalar(100);
    this.root.add(this.ambient, this.sunLight);

    const glow = keep(new SpriteMaterial({ map: keep(glowTexture(palette.sun, palette.sunGlow)), transparent: true, depthWrite: false, blending: AdditiveBlending, fog: false }));
    const core = keep(new SpriteMaterial({ map: keep(glowTexture(palette.sun, palette.sun, 0.5)), transparent: true, depthWrite: false, blending: AdditiveBlending, fog: false }));
    this.sunGlow = glow;
    this.sunCore = core;
    const glowSprite = new Sprite(glow);
    glowSprite.position.set(...SUN_DIRECTION).multiplyScalar(SKY_RADIUS * 0.85);
    glowSprite.scale.setScalar(190);
    const coreSprite = new Sprite(core);
    coreSprite.position.copy(glowSprite.position);
    coreSprite.scale.setScalar(46);
    this.root.add(glowSprite, coreSprite);

    this.root.add(buildTerrain(palette, keep), buildRocks(palette, keep), buildWalkMarks(palette, keep));
    this.habitat = buildHabitat(palette, keep);
    this.root.add(this.habitat.group);

    const ines = buildWalker(palette, keep, palette.sunGlow);
    const sofia = buildWalker(palette, keep, palette.signal);
    this.walkers = [ines, sofia];
    this.root.add(ines.group, ines.shadow, sofia.group, sofia.shadow);

    // Storm dust: soft sprites blown across the scene by the wind.
    const random = seededRandom(7);
    this.dustSeeds = new Float32Array(DUST_COUNT * 4);
    const dustPositions = new Float32Array(DUST_COUNT * 3);
    for (let index = 0; index < DUST_COUNT; index += 1) {
      dustPositions[index * 3] = (random() * 2 - 1) * DUST_HALF;
      dustPositions[index * 3 + 1] = 0.4 + random() * DUST_HEIGHT;
      dustPositions[index * 3 + 2] = (random() * 2 - 1) * DUST_HALF;
      this.dustSeeds.set([random() * 6.28, 0.6 + random() * 0.8, random(), random()], index * 4);
    }
    const dustGeometry = keep(new BufferGeometry());
    dustGeometry.setAttribute("position", new Float32BufferAttribute(dustPositions, 3));
    const dustMaterial = keep(
      new PointsMaterial({ map: keep(glowTexture(palette.mars.clone().lerp(palette.sun, 0.18), palette.mars, 0.25)), size: 7, sizeAttenuation: false, transparent: true, opacity: 0, depthWrite: false }),
    );
    this.dust = new Points(dustGeometry, dustMaterial);
    this.dust.frustumCulled = false;
    this.root.add(this.dust);

    // Particle tracks streaming from the Sun's direction: an illustration of the storm, not a measurement.
    this.streakSeeds = new Float32Array(STREAK_COUNT * 3);
    for (let index = 0; index < STREAK_COUNT; index += 1) this.streakSeeds.set([(random() * 2 - 1) * 170, random() * 70 - 14, random()], index * 3);
    const streakGeometry = keep(new BufferGeometry());
    streakGeometry.setAttribute("position", new Float32BufferAttribute(new Float32Array(STREAK_COUNT * 6), 3));
    const streakMaterial = keep(
      new LineBasicMaterial({ color: palette.star.clone().lerp(palette.sun, 0.4), transparent: true, opacity: 0, blending: AdditiveBlending, depthWrite: false, fog: false }),
    );
    this.streaks = new LineSegments(streakGeometry, streakMaterial);
    this.streaks.frustumCulled = false;
    this.root.add(this.streaks);
  }

  /** Advances the scene by one frame. Returns true while something is still moving (for on-demand rendering). */
  update(frame: StormFrame): boolean {
    const { delta, camera } = frame;
    const step = Math.min(delta, 0.1);
    const target = clampProgress(frame.progress);
    let moving = false;

    if (!this.fogAttached) {
      frame.scene.fog = this.fog;
      this.fogAttached = true;
    }

    // 1. Progress: glide to the requested position.
    const ease = frame.reducedMotion ? 1 : 1 - Math.exp(-step * 9);
    this.shown += (target - this.shown) * ease;
    if (Math.abs(target - this.shown) < 0.0004) this.shown = target;
    else moving = true;
    const progress = this.shown;
    const intensity = stormIntensity(progress);
    if (!frame.reducedMotion) this.clock += step;

    // 2. Sky, haze and light follow the storm.
    this.sky.update(intensity);
    this.sky.horizonColor(intensity, this.fogColor);
    this.fog.color.copy(this.fogColor);
    this.fog.near = 70 - 62 * intensity;
    this.fog.far = 330 - 235 * intensity;
    this.sunLight.intensity = 3 * (1 - 0.7 * intensity);
    this.ambient.intensity = 1.15 * (1 - 0.2 * intensity);
    this.sunGlow.opacity = 1 - 0.7 * intensity;
    this.sunCore.opacity = 1 - 0.85 * intensity;

    // 3. Habitat lights, alarm beacon and the refuge halo.
    const habitat = this.habitat;
    habitat.windows.color.copy(habitat.colors.windowsDim).lerp(habitat.colors.windowsLit, 0.25 + 0.75 * intensity);
    const alarm = progress >= ALARM_AT;
    const pulse = alarm ? 0.5 + 0.5 * Math.sin(this.clock * 5.5) : 0;
    habitat.beacon.color.copy(habitat.colors.beaconOff).lerp(this.palette.alert, pulse);
    habitat.beaconGlow.opacity = 0.9 * pulse;
    habitat.refugeGlow.opacity = smooth(ARRIVE_AT + 0.03, ARRIVE_AT + 0.12, progress) * (0.5 + 0.15 * Math.sin(this.clock * 2));

    // 4. The two people.
    const places: [WalkerPlace, WalkerPlace] = [walkerPlace(0, progress), walkerPlace(1, progress)];
    this.walkers.forEach((walker, index) => {
      const place = places[index];
      poseWalker(walker, place, heightAt(place.x, place.z), step, this.clock, index * 2.1);
      walker.lamp.opacity = 0.25 + 0.55 * intensity;
    });

    // 5. Dust and particle tracks.
    this.updateDust(intensity, step, frame.reducedMotion);
    this.updateStreaks(intensity);

    // 6. Camera rig: follow the people, or circle the habitat, until the visitor takes over.
    if (frame.controls) {
      const plan = cameraPlan(frame.view, progress, this.clock);
      this.a.set(...plan.position);
      this.b.set(...plan.target);
      if (frame.engaged) {
        const glide = frame.reducedMotion || !this.framed ? 1 : 1 - Math.exp(-step * 3);
        camera.position.lerp(this.a, glide);
        frame.controls.target.lerp(this.b, glide);
        if (camera.position.distanceTo(this.a) > 0.02) moving = true;
      } else if (this.framed) {
        // The visitor orbits freely, but the view keeps following the people.
        const shift = this.b.clone().sub(this.lastPlan);
        camera.position.add(shift);
        frame.controls.target.add(shift);
      }
      this.lastPlan.copy(this.b);
      this.framed = true;
      frame.controls.update();
    }

    // 7. Labels: project each anchor to the screen so the DOM labels can follow it.
    const label = (key: StormLabel, anchor: Vector3, show = true) => {
      this.a.copy(anchor).project(camera);
      const x = (this.a.x * 0.5 + 0.5) * frame.width;
      const y = (-this.a.y * 0.5 + 0.5) * frame.height;
      const visible = show && this.a.z < 1 && Math.abs(this.a.x) < 1.05 && Math.abs(this.a.y) < 1.05;
      frame.placeLabel(key, x, y - LABEL_LIFT[key], visible);
    };
    const head = (walker: Walker, hidden: boolean) => label(walker === this.walkers[0] ? "walkerA" : "walkerB", this.b.copy(walker.group.position).setY(walker.group.position.y + WALKER_HEIGHT + 0.7), !hidden);
    head(this.walkers[0], places[0].inside);
    head(this.walkers[1], places[1].inside);
    label("habitat", this.b.set(0, HABITAT_LABEL_HEIGHT + 3.2, 0));
    label("refuge", this.b.set(REFUGE_AT[0], 3.6, REFUGE_AT[1]), progress >= ARRIVE_AT);
    label("sun", this.b.set(...SUN_DIRECTION).multiplyScalar(SKY_RADIUS * 0.85));

    return moving;
  }

  private updateDust(intensity: number, step: number, reducedMotion: boolean): void {
    const geometry = this.dust.geometry;
    const positions = geometry.getAttribute("position") as Float32BufferAttribute;
    const array = positions.array as Float32Array;
    const material = this.dust.material as PointsMaterial;
    const visible = Math.floor(DUST_COUNT * Math.min(1, intensity * 1.15));
    geometry.setDrawRange(0, visible);
    material.opacity = 0.62 * Math.min(1, intensity * 1.4);
    this.dust.visible = visible > 0;
    if (visible === 0 || reducedMotion) return;
    const speed = 3 + 34 * intensity;
    for (let index = 0; index < visible; index += 1) {
      const seed = index * 4;
      const swirl = Math.sin(this.clock * 0.7 + this.dustSeeds[seed]) * 0.45;
      const reach = speed * this.dustSeeds[seed + 1] * step;
      let x = array[index * 3] + (WIND[0] + swirl * WIND[1]) * reach;
      let z = array[index * 3 + 2] + (WIND[1] - swirl * WIND[0]) * reach;
      let y = array[index * 3 + 1] + Math.sin(this.clock * 1.1 + this.dustSeeds[seed]) * 0.8 * step;
      if (x > DUST_HALF) x -= 2 * DUST_HALF;
      if (z > DUST_HALF) z -= 2 * DUST_HALF;
      y = Math.min(DUST_HEIGHT, Math.max(0.4, y));
      array[index * 3] = x;
      array[index * 3 + 1] = y;
      array[index * 3 + 2] = z;
    }
    positions.needsUpdate = true;
  }

  private updateStreaks(intensity: number): void {
    const material = this.streaks.material as LineBasicMaterial;
    const shown = intensity > 0.03;
    this.streaks.visible = shown;
    if (!shown) return;
    material.opacity = 0.75 * Math.min(1, intensity * 1.5);
    const positions = this.streaks.geometry.getAttribute("position") as Float32BufferAttribute;
    const array = positions.array as Float32Array;
    const length = 3 + 7 * intensity;
    // Tracks fall from the Sun's direction toward the scene.
    const dx = -SUN_DIRECTION[0];
    const dy = -SUN_DIRECTION[1];
    const dz = -SUN_DIRECTION[2];
    const sideX = -SUN_DIRECTION[2];
    const sideZ = SUN_DIRECTION[0];
    for (let index = 0; index < STREAK_COUNT; index += 1) {
      const seed = index * 3;
      const along = (this.clock * STREAK_SPEED + this.streakSeeds[seed + 2] * STREAK_TRAVEL) % STREAK_TRAVEL;
      const baseX = SUN_DIRECTION[0] * 260 + sideX * this.streakSeeds[seed];
      const baseY = SUN_DIRECTION[1] * 260 + this.streakSeeds[seed + 1];
      const baseZ = SUN_DIRECTION[2] * 260 + sideZ * this.streakSeeds[seed];
      const headX = baseX + dx * along;
      const headY = baseY + dy * along;
      const headZ = baseZ + dz * along;
      array.set([headX, headY, headZ, headX - dx * length, headY - dy * length, headZ - dz * length], index * 6);
    }
    positions.needsUpdate = true;
  }

  dispose(): void {
    this.root.removeFromParent();
    for (const resource of this.disposables) resource.dispose();
  }
}
