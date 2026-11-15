/**
 * The 3D figure as plain three.js objects. React only mounts it and calls `update` once per frame
 * (see BodyFigure3D); everything that moves is mutated here, outside React state.
 */
import {
  AdditiveBlending,
  CapsuleGeometry,
  Color,
  DoubleSide,
  Group,
  LatheGeometry,
  Mesh,
  MeshBasicMaterial,
  RingGeometry,
  ShaderMaterial,
  SphereGeometry,
  SplineCurve,
  Sprite,
  SpriteMaterial,
  Vector2,
  Vector3,
  type BufferGeometry,
  type Camera,
} from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import type { BodyRegion } from "@/features/crew-health-data";
import { toneToken, type Tone } from "@/shared/design-system";
import { glowTexture, ringTexture } from "@/shared/scene/textures";
import { tokenColor } from "@/shared/scene/tokens";
import { FIGURE_HEIGHT, FIGURE_PARTS, HEART_POSITION, REGION_ANCHORS, type FigurePart } from "../../lib/figure";
import { beatLevel, beatPhase, validBpm } from "../../lib/pulse";

export const BODY_REGIONS: readonly BodyRegion[] = ["brain", "heart", "body"];

/** Vertical field of view of the figure camera, in degrees. */
export const FIGURE_FOV = 30;
/** The camera looks at the figure's middle from slightly above; these are metres. */
const TARGET_HEIGHT = 0.9;
const CAMERA_LIFT = 0.08;
/** Height and width the view must cover: the figure with its floor rings, and the figure hand to hand. */
const FRAMED_HEIGHT = 2.06;
const FRAMED_WIDTH = 0.66;
const TAN_HALF_FOV = Math.tan((FIGURE_FOV * Math.PI) / 360);

/** Camera distance that fits the figure's height, and its width between the two callout columns. */
export function figureDistance(width: number, height: number, calloutReserve: number): number {
  const aspect = width / Math.max(1, height);
  const free = Math.max(width * 0.25, width - 2 * calloutReserve);
  const neededWidth = (FRAMED_WIDTH * width) / Math.max(1, free);
  return Math.max(FRAMED_HEIGHT, neededWidth / Math.max(aspect, 0.01)) / (2 * TAN_HALF_FOV);
}
/** Idle sway of the figure: radians to each side, and its angular speed. */
const SWAY_ANGLE = 0.5;
const SWAY_SPEED = 0.45;
/** Seconds the scan line takes to travel from the floor to the head. */
const SCAN_SECONDS = 4.2;

const VERTEX = /* glsl */ `
  varying vec3 vNormal;
  varying vec3 vView;
  varying float vHeight;
  void main() {
    vec4 world = modelMatrix * vec4(position, 1.0);
    vec4 view = viewMatrix * world;
    vNormal = normalize(normalMatrix * normal);
    vView = normalize(-view.xyz);
    vHeight = world.y;
    gl_Position = projectionMatrix * view;
  }
`;

// Translucent shell: faint where the surface faces the viewer, bright along its outline.
const FRAGMENT = /* glsl */ `
  uniform vec3 uColor;
  uniform float uFill;
  uniform float uRim;
  uniform float uScan;
  uniform float uScanGain;
  varying vec3 vNormal;
  varying vec3 vView;
  varying float vHeight;
  void main() {
    float facing = abs(dot(normalize(vNormal), normalize(vView)));
    float rim = pow(1.0 - facing, 1.7);
    float scan = uScanGain * exp(-pow((vHeight - uScan) / 0.03, 2.0));
    float stripes = 0.9 + 0.1 * sin(vHeight * 260.0);
    float alpha = clamp((uFill + rim * uRim) * stripes + scan, 0.0, 1.0);
    gl_FragColor = vec4(uColor * (1.05 + 0.75 * rim + scan), alpha);
    #include <colorspace_fragment>
  }
`;

export interface BodyFrame {
  camera: Camera;
  controls: OrbitControls | null;
  width: number;
  height: number;
  /** Pixels kept free on each side for the callouts; the camera backs away until the figure fits between them. */
  calloutReserve: number;
  /** Seconds since the scene started, and since the previous frame. */
  elapsed: number;
  delta: number;
  reducedMotion: boolean;
  selected: BodyRegion | null;
  preview: BodyRegion | null;
  tones: Readonly<Record<BodyRegion, Tone>>;
  /** Simulated heart-rate reading that paces the pulse marker; null shows a steady marker. */
  bpm: number | null;
  /** True until the visitor turns the figure: the rig frames it and it sways on its own. */
  idle: boolean;
  placeLabel: (region: BodyRegion, x: number, y: number, visible: boolean) => void;
}

interface Part {
  region: BodyRegion;
  material: ShaderMaterial;
  /** Current emphasis (0 resting, 1 selected), eased toward its target every frame. */
  emphasis: number;
}

/** Creates orbit controls for the figure: turn only, with touch gestures that still let the page scroll. */
export function createFigureControls(camera: Camera, element: HTMLElement, damping: boolean): OrbitControls {
  const controls = new OrbitControls(camera, element);
  controls.enablePan = false;
  controls.enableZoom = false;
  controls.enableDamping = damping;
  controls.dampingFactor = 0.1;
  controls.rotateSpeed = 0.7;
  controls.minPolarAngle = Math.PI / 2 - 0.35;
  controls.maxPolarAngle = Math.PI / 2 + 0.12;
  controls.target.set(0, TARGET_HEIGHT, 0);
  element.style.touchAction = "pan-y";
  return controls;
}

function partGeometry(part: FigurePart): BufferGeometry {
  if (part.shape === "lathe" && part.profile) {
    // A spline through the outline rounds the silhouette; the radius is clamped so closed ends stay on the axis.
    const outline = new SplineCurve(part.profile.map(([radius, height]) => new Vector2(radius, height))).getPoints(part.profile.length * 5);
    for (const point of outline) point.x = Math.max(0, point.x);
    return new LatheGeometry(outline, 40);
  }
  if (part.shape === "capsule") return new CapsuleGeometry(part.radius, part.length, 8, 24);
  return new SphereGeometry(part.radius, 28, 20);
}

export class BodyScene {
  readonly root = new Group();

  private readonly figure = new Group();
  private readonly parts: Part[] = [];
  private readonly disposables: { dispose: () => void }[] = [];
  private readonly toneColors: Record<Tone, Color>;
  private readonly heart: Sprite;
  private readonly wave: Sprite;
  private readonly white = new Color(1, 1, 1);
  private readonly a = new Vector3();
  private readonly color = new Color();

  constructor() {
    const keep = <T extends { dispose: () => void }>(resource: T): T => {
      this.disposables.push(resource);
      return resource;
    };
    this.toneColors = Object.fromEntries(Object.entries(toneToken).map(([tone, token]) => [tone, tokenColor(token)])) as Record<Tone, Color>;

    const geometries = new Map<string, BufferGeometry>();
    for (const part of FIGURE_PARTS) {
      // Left and right limbs share one geometry.
      const key = part.id.replace(/-(left|right)$/, "");
      let geometry = geometries.get(key);
      if (!geometry) {
        geometry = keep(partGeometry(part));
        geometries.set(key, geometry);
      }
      const material = keep(
        new ShaderMaterial({
          vertexShader: VERTEX,
          fragmentShader: FRAGMENT,
          transparent: true,
          uniforms: { uColor: { value: new Color() }, uFill: { value: 0.16 }, uRim: { value: 0.8 }, uScan: { value: -1 }, uScanGain: { value: 0 } },
        }),
      );
      const mesh = new Mesh(geometry, material);
      mesh.position.set(...part.position);
      mesh.rotation.set(part.pitch ?? 0, 0, part.tilt ?? 0);
      if (part.scale) mesh.scale.set(...part.scale);
      mesh.userData.region = part.region;
      this.figure.add(mesh);
      this.parts.push({ region: part.region, material, emphasis: 0 });
    }

    // Pulse marker inside the chest, and the ring that leaves it on every beat.
    const soft = tokenColor("color-console-text");
    this.heart = new Sprite(keep(new SpriteMaterial({ map: keep(glowTexture(soft, soft, 0.2)), transparent: true, depthWrite: false, depthTest: false, blending: AdditiveBlending })));
    this.heart.position.set(...HEART_POSITION);
    this.heart.renderOrder = 3;
    this.wave = new Sprite(keep(new SpriteMaterial({ map: keep(ringTexture()), transparent: true, opacity: 0, depthWrite: false, depthTest: false, blending: AdditiveBlending })));
    this.wave.position.set(...HEART_POSITION);
    this.wave.renderOrder = 3;
    this.figure.add(this.heart, this.wave);

    // Floor rings: they ground the figure and stay still while it turns.
    const floor = keep(new MeshBasicMaterial({ color: tokenColor("color-console-ring"), transparent: true, opacity: 0.85, side: DoubleSide, depthWrite: false }));
    const faint = keep(new MeshBasicMaterial({ color: tokenColor("color-console-ring"), transparent: true, opacity: 0.35, side: DoubleSide, depthWrite: false }));
    for (const [inner, outer, material] of [
      [0.36, 0.366, floor],
      [0.52, 0.524, faint],
      [0, 0.36, keep(new MeshBasicMaterial({ color: tokenColor("color-console-raised"), transparent: true, opacity: 0.55, side: DoubleSide, depthWrite: false }))],
    ] as const) {
      const ring = new Mesh(keep(new RingGeometry(inner, outer, 72)), material);
      ring.rotation.x = -Math.PI / 2;
      ring.renderOrder = -1;
      this.root.add(ring);
    }

    this.root.add(this.figure);
  }

  /** Advances the scene by one frame. Returns true while something is still easing toward its target. */
  update(frame: BodyFrame): boolean {
    const step = Math.min(frame.delta, 0.1);
    const ease = frame.reducedMotion ? 1 : 1 - Math.exp(-step * 9);
    let moving = false;

    // 1. Regions: hue from the authored demo state, emphasis from selection and preview.
    const scanning = !frame.reducedMotion;
    const scan = scanning ? ((frame.elapsed % SCAN_SECONDS) / SCAN_SECONDS) * (FIGURE_HEIGHT + 0.2) - 0.1 : -1;
    const level = frame.reducedMotion ? 0 : beatLevel(frame.elapsed, frame.bpm);
    for (const part of this.parts) {
      const target = part.region === frame.selected ? 1 : part.region === frame.preview ? 0.55 : 0;
      part.emphasis += (target - part.emphasis) * ease;
      if (Math.abs(target - part.emphasis) > 0.01) moving = true;
      const uniforms = part.material.uniforms;
      const quiet = frame.selected !== null && part.region !== frame.selected ? 0.75 : 1;
      (uniforms.uColor.value as Color).lerp(this.toneColors[frame.tones[part.region]], ease);
      uniforms.uFill.value = (0.2 + 0.3 * part.emphasis + (part.region === "heart" ? 0.1 * level : 0)) * quiet;
      uniforms.uRim.value = (0.8 + 0.2 * part.emphasis) * quiet;
      uniforms.uScan.value = scan;
      uniforms.uScanGain.value = scanning ? 0.4 : 0;
    }

    // 2. Pulse marker: paced by the simulated heart-rate reading; steady when there is no reading or no motion.
    const paced = validBpm(frame.bpm) && !frame.reducedMotion;
    this.color.copy(this.toneColors[frame.tones.heart]).lerp(this.white, 0.6);
    this.heart.material.color.copy(this.color);
    this.heart.material.opacity = paced ? 0.55 + 0.45 * level : 0.8;
    this.heart.scale.setScalar(0.1 * (paced ? 1 + 0.5 * level : 1.1));
    const phase = beatPhase(frame.elapsed, frame.bpm);
    this.wave.visible = paced;
    this.wave.material.color.copy(this.color);
    this.wave.material.opacity = 0.55 * (1 - phase) ** 2;
    this.wave.scale.setScalar(0.09 + 0.3 * phase);

    // 3. Idle sway until the visitor takes over; then the figure settles facing forward.
    const sway = frame.idle && !frame.reducedMotion ? Math.sin(frame.elapsed * SWAY_SPEED) * SWAY_ANGLE : 0;
    this.figure.rotation.y += (sway - this.figure.rotation.y) * (frame.idle ? 1 : ease * 0.4);
    if (Math.abs(sway - this.figure.rotation.y) > 0.002) moving = true;

    // 4. Camera: keep the figure framed between the callouts at any viewport size; the visitor only turns it.
    if (frame.controls) {
      const distance = figureDistance(frame.width, frame.height, frame.calloutReserve);
      frame.controls.target.set(0, TARGET_HEIGHT, 0);
      if (frame.idle) this.a.set(0, CAMERA_LIFT, 1);
      else this.a.copy(frame.camera.position).sub(frame.controls.target);
      frame.camera.position.copy(frame.controls.target).addScaledVector(this.a.normalize(), distance);
      frame.controls.update();
    }

    // 5. Callouts: project each region's anchor so the DOM labels can follow the figure.
    this.figure.updateMatrixWorld();
    for (const region of BODY_REGIONS) {
      this.a.set(...REGION_ANCHORS[region]).applyMatrix4(this.figure.matrixWorld).project(frame.camera);
      const x = (this.a.x * 0.5 + 0.5) * frame.width;
      const y = (-this.a.y * 0.5 + 0.5) * frame.height;
      frame.placeLabel(region, x, y, this.a.z < 1);
    }

    return moving || (!frame.reducedMotion && (frame.idle || paced));
  }

  dispose(): void {
    this.root.removeFromParent();
    for (const resource of this.disposables) resource.dispose();
  }
}
