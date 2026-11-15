/**
 * The mission scene as plain three.js objects. React only mounts it and calls `update` once per
 * frame (see OrbitScene); everything that moves is mutated here, outside React state.
 */
import {
  AdditiveBlending,
  AmbientLight,
  ConeGeometry,
  DoubleSide,
  Float32BufferAttribute,
  Group,
  LineBasicMaterial,
  LineLoop,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  PointLight,
  Points,
  PointsMaterial,
  SphereGeometry,
  Sprite,
  SpriteMaterial,
  Vector3,
  type BufferAttribute,
  type Camera,
  type Color,
} from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import type { Line2 } from "three/examples/jsm/lines/Line2.js";
import { SOLAR_EXCLUSION_DEG, delayMinutes, nearConjunction, type MissionGeometry } from "../../lib/geometry";
import { BODY_RADIUS, SCENE_UNITS_PER_AU, cameraFrame, pulseProgress, pulseTravelSeconds, type CameraView } from "../../lib/scene-math";
import { TRAJECTORY_LEGS } from "../../lib/trajectory";
import {
  STREAM_SEED_SIZE,
  buildTracks,
  fatLine,
  glowTexture,
  orbitGeometry,
  ringTexture,
  sampleTrack,
  setSegment,
  starGeometry,
  streamGeometry,
  streamSeeds,
  tokenColor,
  type SceneTracks,
} from "./scene-kit";

export type SceneLabel = "sun" | "earth" | "mars" | "crew" | "link";
export const SCENE_LABELS: readonly SceneLabel[] = ["sun", "earth", "mars", "crew", "link"];

const EARTH_ORBIT_DAYS = 367;
const MARS_ORBIT_DAYS = 688;
const PULSE_POOL = 8;
/** The exclusion cone is modelled one unit long and scaled each frame to end just past the crew. */
const CONE_SLOPE = Math.tan((SOLAR_EXCLUSION_DEG * Math.PI) / 180);
const CONE_OVERSHOOT = 0.45 * SCENE_UNITS_PER_AU;
const CONE_RINGS = 24;
/** Illustrative particle stream of a solar-storm day: particle count, widening per unit of distance, and Sun-to-crew seconds. */
const STORM_PARTICLES = 380;
const STORM_SPREAD = 0.15;
const STORM_TRAVEL_SECONDS = 3.6;
const STORM_OVERSHOOT = 0.3 * SCENE_UNITS_PER_AU;
/** Below this spacecraft–planet distance (scene units) the crew is drawn as being at the planet. */
const DOCKED_DISTANCE = 0.12;
const DOWN = new Vector3(0, -1, 0);
const UP = new Vector3(0, 1, 0);
/** Pixels each label sits above its anchor. */
const LABEL_LIFT: Readonly<Record<SceneLabel, number>> = { sun: 24, earth: 14, mars: 14, crew: 18, link: 8 };
/** The delay label is hidden while the link is shorter than this on screen, where it would cover the bodies. */
const LINK_LABEL_MIN_PIXELS = 90;

export interface SceneFrame {
  camera: Camera;
  controls: OrbitControls | null;
  width: number;
  height: number;
  /** Seconds since the scene started, and since the previous frame. */
  elapsed: number;
  delta: number;
  day: number;
  view: CameraView;
  reducedMotion: boolean;
  /** True on a solar-storm scenario day: draws the illustrative particle stream. */
  storm: boolean;
  /** True while the camera rig, not the visitor, drives the camera. */
  engaged: boolean;
  placeLabel: (key: SceneLabel, x: number, y: number, visible: boolean) => void;
}

interface Leg {
  fromDay: number;
  segments: number;
  planned: Line2;
  travelled: Line2;
}

/** Creates orbit controls tuned for this scene: no panning, and touch gestures that still let the page scroll. */
export function createControls(camera: Camera, element: HTMLElement, damping: boolean): OrbitControls {
  const controls = new OrbitControls(camera, element);
  controls.enablePan = false;
  controls.enableDamping = damping;
  controls.dampingFactor = 0.09;
  controls.rotateSpeed = 0.6;
  controls.zoomSpeed = 0.7;
  controls.minDistance = 3;
  controls.maxDistance = 110;
  // Vertical swipes keep scrolling the page on touch screens; horizontal drags orbit the camera.
  element.style.touchAction = "pan-y";
  return controls;
}

/**
 * Brightness along the exclusion cone (additive, so darker means fainter): dim on the Earth side,
 * brightest just behind the Sun, fading toward the far end. `positions` are the unit cone's vertices.
 */
function coneShade(positions: ArrayLike<number>): number[] {
  const shade: number[] = [];
  for (let index = 1; index < positions.length; index += 3) {
    const along = -(positions[index] ?? 0);
    // Dim on the Earth side, full just behind the Sun, then a slow fall that reaches zero at the open end.
    const value = along < 0.4 ? 0.25 + 0.75 * (along / 0.4) ** 2 : along < 0.8 ? 1 - 0.45 * ((along - 0.4) / 0.4) : 0.55 * (1 - ((along - 0.8) / 0.2) ** 2);
    shade.push(value, value, value);
  }
  return shade;
}

export class MissionScene {
  readonly root = new Group();

  private readonly geometry: MissionGeometry;
  private readonly tracks: SceneTracks;
  private readonly disposables: { dispose: () => void }[] = [];
  private readonly colors: { signal: Color; noLink: Color };
  private readonly earth: Mesh;
  private readonly mars: Mesh;
  private readonly crew = new Group();
  private readonly cone: Mesh;
  private readonly storm: Points;
  private readonly stormSeeds = streamSeeds(STORM_PARTICLES);
  private readonly legs: Leg[];
  private readonly link: Line2;
  private readonly toEarth: Sprite[];
  private readonly toCrew: Sprite[];
  private readonly earthAt = new Vector3();
  private readonly marsAt = new Vector3();
  private readonly crewAt = new Vector3();
  private readonly a = new Vector3();
  private readonly b = new Vector3();
  private readonly c = new Vector3();
  private shownDay: number;
  private framed = false;

  constructor(geometry: MissionGeometry, startDay: number) {
    this.geometry = geometry;
    this.tracks = buildTracks(geometry);
    this.shownDay = startDay;
    const keep = <T extends { dispose: () => void }>(resource: T): T => {
      this.disposables.push(resource);
      return resource;
    };
    const sun = tokenColor("color-space-sun");
    const signal = tokenColor("color-space-signal");
    this.colors = { signal, noLink: tokenColor("color-status-unknown-border") };

    this.root.add(new AmbientLight(undefined, 0.5), new PointLight(undefined, 3.2, 0, 0));

    const stars = new Points(
      keep(starGeometry(1500, 240)),
      keep(new PointsMaterial({ color: tokenColor("color-space-star"), size: 1.6, sizeAttenuation: false, vertexColors: true, transparent: true, opacity: 0.85, depthWrite: false })),
    );
    stars.frustumCulled = false;
    this.root.add(stars);

    const sphere = (radius: number) => keep(new SphereGeometry(radius, 32, 24));
    this.root.add(new Mesh(sphere(BODY_RADIUS.sun), keep(new MeshBasicMaterial({ color: sun }))));
    const glow = new Sprite(
      keep(new SpriteMaterial({ map: keep(glowTexture(sun, tokenColor("color-space-sun-glow"))), transparent: true, depthWrite: false, blending: AdditiveBlending })),
    );
    glow.scale.setScalar(BODY_RADIUS.sun * 9);
    this.root.add(glow);

    const orbitMaterial = keep(new LineBasicMaterial({ color: tokenColor("color-space-orbit") }));
    this.root.add(new LineLoop(keep(orbitGeometry(this.tracks.earth, EARTH_ORBIT_DAYS)), orbitMaterial));
    this.root.add(new LineLoop(keep(orbitGeometry(this.tracks.mars, MARS_ORBIT_DAYS)), orbitMaterial));

    // Apex at the origin, opening along -y; `update` points it from Earth through the Sun and sets its length.
    const coneGeometry = keep(new ConeGeometry(CONE_SLOPE, 1, 40, CONE_RINGS, true));
    coneGeometry.translate(0, -0.5, 0);
    coneGeometry.setAttribute("color", new Float32BufferAttribute(coneShade(coneGeometry.getAttribute("position").array), 3));
    this.cone = new Mesh(
      coneGeometry,
      keep(new MeshBasicMaterial({ color: tokenColor("color-space-sun-glow"), vertexColors: true, transparent: true, opacity: 0.2, side: DoubleSide, depthWrite: false, blending: AdditiveBlending })),
    );
    this.cone.visible = false;
    this.cone.renderOrder = 1;
    this.root.add(this.cone);

    this.storm = new Points(
      keep(streamGeometry(STORM_PARTICLES)),
      keep(new PointsMaterial({ map: keep(glowTexture(sun, sun, 0.3)), size: 7, sizeAttenuation: false, vertexColors: true, transparent: true, depthWrite: false, blending: AdditiveBlending })),
    );
    this.storm.frustumCulled = false;
    this.storm.visible = false;
    this.storm.renderOrder = 2;
    this.root.add(this.storm);

    this.legs = TRAJECTORY_LEGS.map((leg) => {
      const [fromDay, toDay] = leg.days(geometry);
      const positions = this.tracks.ship.slice((fromDay - 1) * 3, toDay * 3);
      const color = tokenColor(leg.token);
      const planned = fatLine(positions, { color, width: 1.4, opacity: 0.5 });
      const travelled = fatLine(positions, { color, width: 2.8 });
      this.disposables.push(planned.geometry, planned.material, travelled.geometry, travelled.material);
      this.root.add(planned, travelled);
      return { fromDay, segments: Math.max(0, toDay - fromDay), planned, travelled };
    });

    this.link = fatLine([0, 0, 0, 1, 0, 0], { color: signal.clone(), width: 1.6, opacity: 0.85 });
    this.link.material.dashSize = 0.5;
    this.link.material.gapSize = 0.45;
    this.disposables.push(this.link.geometry, this.link.material);
    this.root.add(this.link);

    const pulseTexture = keep(glowTexture(signal, signal, 0.3));
    const pulses = (scale: number, opacity: number) =>
      Array.from({ length: PULSE_POOL }, () => {
        const sprite = new Sprite(
          keep(new SpriteMaterial({ map: pulseTexture, color: signal, transparent: true, opacity, depthWrite: false, depthTest: false, blending: AdditiveBlending, sizeAttenuation: false })),
        );
        sprite.scale.setScalar(scale);
        sprite.visible = false;
        sprite.userData.opacity = opacity;
        this.root.add(sprite);
        return sprite;
      });
    this.toEarth = pulses(0.034, 1);
    this.toCrew = pulses(0.024, 0.65);

    this.earth = new Mesh(sphere(BODY_RADIUS.earth), keep(new MeshStandardMaterial({ color: tokenColor("color-space-earth"), roughness: 0.85, metalness: 0 })));
    this.mars = new Mesh(sphere(BODY_RADIUS.mars), keep(new MeshStandardMaterial({ color: tokenColor("color-space-mars"), roughness: 0.95, metalness: 0 })));
    const ring = new Sprite(
      keep(new SpriteMaterial({ map: keep(ringTexture()), color: tokenColor("color-console-text"), transparent: true, depthWrite: false, depthTest: false, sizeAttenuation: false })),
    );
    ring.scale.setScalar(0.04);
    ring.renderOrder = 3;
    this.crew.add(ring);
    this.root.add(this.earth, this.mars, this.crew);
  }

  /** Advances the scene by one frame. Returns true while something is still gliding toward its target. */
  update(frame: SceneFrame): boolean {
    const { geometry, tracks, earthAt, marsAt, crewAt, a, b, c } = this;
    const step = Math.min(frame.delta, 0.1);
    let moving = false;

    // 1. Glide the displayed day toward the selected day, through the real positions in between.
    const gap = frame.day - this.shownDay;
    if (frame.reducedMotion || Math.abs(gap) < 0.02) this.shownDay = frame.day;
    else {
      this.shownDay += gap * (1 - Math.exp(-step * 7));
      moving = true;
    }
    const shown = this.shownDay;
    const dayIndex = Math.min(tracks.total, Math.max(1, Math.round(shown))) - 1;
    this.earth.position.copy(sampleTrack(tracks.earth, shown, earthAt));
    this.mars.position.copy(sampleTrack(tracks.mars, shown, marsAt));
    this.crew.position.copy(sampleTrack(tracks.ship, shown, crewAt));

    // 2. Trajectory: draw the travelled part of each leg up to the displayed day.
    for (const leg of this.legs) {
      const count = Math.min(leg.segments, Math.max(0, Math.floor(shown - leg.fromDay)));
      leg.travelled.geometry.instanceCount = count;
      leg.travelled.visible = count > 0;
    }

    // 3. Earth link and signal pulses.
    const linked = crewAt.distanceTo(earthAt) > DOCKED_DISTANCE * 2;
    const blackout = geometry.comm[dayIndex] === "blackout";
    this.link.visible = linked;
    if (linked) {
      setSegment(this.link, crewAt, earthAt);
      this.link.material.color.copy(blackout ? this.colors.noLink : this.colors.signal);
      this.link.material.opacity = blackout ? 0.6 : 0.85;
      if (this.link.material.dashed !== blackout) {
        this.link.material.dashed = blackout;
        this.link.material.needsUpdate = true;
      }
      if (blackout) this.link.computeLineDistances();
    }
    const travel = linked ? pulseTravelSeconds(delayMinutes(geometry, dayIndex + 1)) : null;
    // During the blackout the pulses die where the line of sight meets the Sun.
    a.subVectors(earthAt, crewAt);
    const sunAlong = blackout ? Math.min(1, Math.max(0, -crewAt.dot(a) / Math.max(a.lengthSq(), 1e-6))) : 1;
    const place = (sprites: Sprite[], progress: number[], fromCrew: boolean) => {
      sprites.forEach((sprite, index) => {
        const value = progress[index];
        if (value === undefined || (blackout && !fromCrew)) {
          sprite.visible = false;
          return;
        }
        const fade = blackout ? Math.min(1, Math.max(0, (sunAlong - 0.03 - value) / 0.12)) : 1;
        sprite.visible = fade > 0;
        sprite.material.opacity = (sprite.userData.opacity as number) * fade;
        sprite.position.lerpVectors(fromCrew ? crewAt : earthAt, fromCrew ? earthAt : crewAt, value);
      });
    };
    if (travel === null) {
      place(this.toEarth, [], true);
      place(this.toCrew, [], false);
    } else if (frame.reducedMotion) {
      // No motion: evenly spaced marks still show how many signals are in flight at once.
      const count = Math.min(PULSE_POOL, Math.max(1, Math.round(travel)));
      place(this.toEarth, Array.from({ length: count }, (_, index) => (index + 0.5) / count), true);
      place(this.toCrew, [], false);
    } else {
      place(this.toEarth, pulseProgress(frame.elapsed, travel).slice(0, PULSE_POOL), true);
      place(this.toCrew, pulseProgress(frame.elapsed, travel, 0.65).slice(0, PULSE_POOL), false);
    }

    // 4. Solar exclusion zone: a 2° cone from Earth through the Sun, shown as the conjunction approaches.
    this.cone.visible = nearConjunction(geometry, dayIndex + 1) && crewAt.distanceTo(marsAt) < DOCKED_DISTANCE;
    if (this.cone.visible) {
      this.cone.position.copy(earthAt);
      this.cone.quaternion.setFromUnitVectors(DOWN, a.copy(earthAt).multiplyScalar(-1).normalize());
      this.cone.scale.setScalar(earthAt.distanceTo(crewAt) + CONE_OVERSHOOT);
    }

    // 5. Solar-storm scenario day: particles stream from the Sun past the crew (illustrative, not a transport model).
    this.storm.visible = frame.storm;
    if (frame.storm) {
      const reach = crewAt.length() + STORM_OVERSHOOT - BODY_RADIUS.sun;
      a.copy(crewAt).normalize();
      b.crossVectors(a, UP).normalize();
      c.crossVectors(a, b);
      const positions = this.storm.geometry.getAttribute("position") as BufferAttribute;
      const shades = this.storm.geometry.getAttribute("color") as BufferAttribute;
      const seeds = this.stormSeeds;
      for (let index = 0; index < STORM_PARTICLES; index += 1) {
        const seed = index * STREAM_SEED_SIZE;
        const along = frame.reducedMotion ? seeds[seed] : (seeds[seed] + frame.elapsed / (STORM_TRAVEL_SECONDS * seeds[seed + 3])) % 1;
        const distance = BODY_RADIUS.sun + along * reach;
        const side = seeds[seed + 1] * distance * STORM_SPREAD;
        const lift = seeds[seed + 2] * distance * STORM_SPREAD;
        positions.setXYZ(index, a.x * distance + b.x * side + c.x * lift, a.y * distance + b.y * side + c.y * lift, a.z * distance + b.z * side + c.z * lift);
        const shade = Math.sin(Math.PI * along) ** 0.6;
        shades.setXYZ(index, shade, shade, shade);
      }
      positions.needsUpdate = true;
      shades.needsUpdate = true;
    }

    // 6. Camera rig: frame the requested view until the visitor takes over.
    if (frame.controls) {
      if (frame.engaged) {
        const wanted = cameraFrame(
          frame.view,
          { earth: [earthAt.x, earthAt.y, earthAt.z], mars: [marsAt.x, marsAt.y, marsAt.z], ship: [crewAt.x, crewAt.y, crewAt.z] },
          frame.width / Math.max(1, frame.height),
        );
        const ease = frame.reducedMotion || !this.framed ? 1 : 1 - Math.exp(-step * 2.4);
        a.set(...wanted.position);
        b.set(...wanted.target);
        frame.camera.position.lerp(a, ease);
        frame.controls.target.lerp(b, ease);
        this.framed = true;
        if (frame.camera.position.distanceTo(a) > 0.02) moving = true;
      }
      frame.controls.update();
    }

    // 7. Labels: project each anchor to the screen so the DOM labels can follow it.
    const label = (key: SceneLabel, anchor: Vector3, show = true): [number, number] => {
      a.copy(anchor).project(frame.camera);
      const x = (a.x * 0.5 + 0.5) * frame.width;
      const y = (-a.y * 0.5 + 0.5) * frame.height;
      const visible = show && a.z < 1 && Math.abs(a.x) < 1.05 && Math.abs(a.y) < 1.05;
      frame.placeLabel(key, x, y - LABEL_LIFT[key], visible);
      return [x, y];
    };
    label("sun", b.set(0, 0, 0));
    const [earthX, earthY] = label("earth", earthAt);
    label("mars", marsAt);
    const [crewX, crewY] = label("crew", crewAt);
    // The delay sits mid-link; during the blackout the "no link" note sits on the stretch before the Sun.
    const reach = blackout ? sunAlong : 1;
    label("link", b.lerpVectors(crewAt, earthAt, reach * 0.5), Math.hypot(earthX - crewX, earthY - crewY) * reach >= LINK_LABEL_MIN_PIXELS);

    return moving;
  }

  dispose(): void {
    this.root.removeFromParent();
    for (const resource of this.disposables) resource.dispose();
  }
}
