/** The two suited people on the surface. Faces along local +x; the scene turns them to their heading. */
import { AdditiveBlending, CapsuleGeometry, CylinderGeometry, Group, Mesh, MeshLambertMaterial, SphereGeometry, Sprite, SpriteMaterial, BoxGeometry, type Color } from "three";
import { glowTexture } from "@/shared/scene/textures";
import type { WalkerPlace } from "../../lib/surface";
import type { Keep, Palette } from "./palette";
import { placeShadow, shadowBlob } from "./world";

export const WALKER_HEIGHT = 2.1;

export interface Walker {
  group: Group;
  shadow: Mesh;
  legs: [Group, Group];
  arms: [Group, Group];
  lamp: SpriteMaterial;
  phase: number;
  stride: number;
}

function limb(keep: Keep, material: MeshLambertMaterial, radius: number, length: number, hangs: number): Group {
  const pivot = new Group();
  const mesh = new Mesh(keep(new CapsuleGeometry(radius, length, 4, 8)), material);
  mesh.position.y = -hangs;
  pivot.add(mesh);
  return pivot;
}

/** A person in an EVA suit, with a colored band to tell the two apart. */
export function buildWalker(palette: Palette, keep: Keep, accent: Color): Walker {
  const group = new Group();
  const suit = keep(new MeshLambertMaterial({ color: palette.suit, emissive: palette.suit, emissiveIntensity: 0.14 }));
  const band = keep(new MeshLambertMaterial({ color: accent, emissive: accent, emissiveIntensity: 0.35 }));
  const visor = keep(new MeshLambertMaterial({ color: palette.void, emissive: palette.sunGlow, emissiveIntensity: 0.18 }));
  const pack = keep(new MeshLambertMaterial({ color: palette.hull.clone().multiplyScalar(0.8) }));

  const torso = new Mesh(keep(new CapsuleGeometry(0.42, 0.5, 4, 10)), suit);
  torso.position.y = 1.35;
  const stripe = new Mesh(keep(new CylinderGeometry(0.445, 0.445, 0.12, 16)), band);
  stripe.position.y = 1.2;
  const helmet = new Mesh(keep(new SphereGeometry(0.37, 16, 12)), suit);
  helmet.position.y = 2.02;
  const glass = new Mesh(keep(new SphereGeometry(0.31, 14, 10)), visor);
  glass.scale.set(0.8, 0.82, 1);
  glass.position.set(0.21, 2.03, 0);
  const backpack = new Mesh(keep(new BoxGeometry(0.34, 0.85, 0.62)), pack);
  backpack.position.set(-0.44, 1.4, 0);
  group.add(torso, stripe, helmet, glass, backpack);

  const legs: [Group, Group] = [limb(keep, suit, 0.17, 0.55, 0.42), limb(keep, suit, 0.17, 0.55, 0.42)];
  legs[0].position.set(0, 0.95, 0.2);
  legs[1].position.set(0, 0.95, -0.2);
  const arms: [Group, Group] = [limb(keep, suit, 0.12, 0.5, 0.32), limb(keep, suit, 0.12, 0.5, 0.32)];
  arms[0].position.set(0, 1.65, 0.52);
  arms[1].position.set(0, 1.65, -0.52);
  group.add(...legs, ...arms);

  const lampMaterial = keep(new SpriteMaterial({ map: keep(glowTexture(palette.sun, palette.sunGlow, 0.3)), transparent: true, opacity: 0.4, depthWrite: false, blending: AdditiveBlending }));
  const lamp = new Sprite(lampMaterial);
  lamp.position.set(0.4, 2.1, 0);
  lamp.scale.setScalar(0.9);
  group.add(lamp);

  const shadow = shadowBlob(keep, palette.void, 7, 0.55, 0.34);
  return { group, shadow, legs, arms, lamp: lampMaterial, phase: 0, stride: 0 };
}

/** Puts the walker on the ground at `place` and swings its limbs by `delta` seconds of walking. */
export function poseWalker(walker: Walker, place: WalkerPlace, groundY: number, delta: number, elapsed: number, seed: number): void {
  // Ease the stride so the legs wind up and down instead of snapping.
  walker.stride += (place.stride - walker.stride) * Math.min(1, delta * 6);
  walker.phase += delta * walker.stride * 9;
  const swing = Math.sin(walker.phase) * 0.62 * walker.stride;
  const sway = Math.sin(elapsed * 1.3 + seed) * 0.03 * (1 - walker.stride);
  walker.legs[0].rotation.z = swing;
  walker.legs[1].rotation.z = -swing;
  walker.arms[0].rotation.z = -swing * 0.8 + sway;
  walker.arms[1].rotation.z = swing * 0.8 - sway;
  walker.group.position.set(place.x, groundY + Math.abs(Math.sin(walker.phase)) * 0.07 * walker.stride, place.z);
  walker.group.rotation.y = -place.heading;
  walker.group.visible = !place.inside;
  placeShadow(walker.shadow, place.x, place.z, 3.6);
  walker.shadow.visible = !place.inside;
}
