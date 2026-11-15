/** The habitat: pressurized module, airlock, solar panels, antenna and beacon, plus the half-buried refuge. */
import {
  AdditiveBlending,
  BoxGeometry,
  CylinderGeometry,
  DoubleSide,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshLambertMaterial,
  SphereGeometry,
  Sprite,
  SpriteMaterial,
  TorusGeometry,
  type Color,
} from "three";
import { glowTexture } from "@/shared/scene/textures";
import { AIRLOCK } from "../../lib/surface";
import type { Keep, Palette } from "./palette";
import { groundDisc, placeShadow, shadowBlob } from "./world";

/** Where the refuge sits, and the height at which labels float above the habitat. */
export const REFUGE_AT = [6, 11.5] as const;
export const HABITAT_LABEL_HEIGHT = 8.4;

export interface Habitat {
  group: Group;
  /** Lit windows and the airlock door: brighter as the storm darkens the sky. */
  windows: MeshBasicMaterial;
  door: MeshBasicMaterial;
  /** Radiation alarm beacon on its mast, and its glow. */
  beacon: MeshBasicMaterial;
  beaconGlow: SpriteMaterial;
  /** Ring of light on the refuge once the whole crew is inside. */
  refugeGlow: SpriteMaterial;
  colors: { windowsDim: Color; windowsLit: Color; beaconOff: Color };
}

export function buildHabitat(palette: Palette, keep: Keep): Habitat {
  const group = new Group();
  const hull = keep(new MeshLambertMaterial({ color: palette.hull.clone().multiplyScalar(0.9) }));
  const trim = keep(new MeshLambertMaterial({ color: palette.trim }));
  const panel = keep(new MeshLambertMaterial({ color: palette.earth.clone().multiplyScalar(0.32) }));
  const regolith = keep(new MeshLambertMaterial({ color: palette.mars.clone().multiplyScalar(0.55) }));
  const colors = { windowsDim: palette.sun.clone().multiplyScalar(0.55), windowsLit: palette.sun.clone(), beaconOff: palette.alert.clone().multiplyScalar(0.25) };
  const windows = keep(new MeshBasicMaterial({ color: colors.windowsDim.clone() }));
  const door = keep(new MeshBasicMaterial({ color: palette.sun.clone() }));
  const beacon = keep(new MeshBasicMaterial({ color: colors.beaconOff.clone() }));

  const pad = groundDisc(keep, palette.mars.clone().lerp(palette.hull, 0.18).multiplyScalar(0.55), 11);
  group.add(pad);

  // Pressurized module lying along z, with domed ends and ribs.
  const body = new Mesh(keep(new CylinderGeometry(3, 3, 12, 28)), hull);
  body.rotation.x = Math.PI / 2;
  body.position.y = 3.05;
  group.add(body);
  const dome = keep(new SphereGeometry(3, 28, 14, 0, Math.PI * 2, 0, Math.PI / 2));
  const front = new Mesh(dome, hull);
  front.rotation.x = Math.PI / 2;
  front.position.set(0, 3.05, 6);
  const back = new Mesh(dome, hull);
  back.rotation.x = -Math.PI / 2;
  back.position.set(0, 3.05, -6);
  group.add(front, back);
  const rib = keep(new TorusGeometry(3.02, 0.09, 6, 32));
  [-4.2, -1.4, 1.4, 4.2].forEach((z) => {
    const ring = new Mesh(rib, trim);
    ring.position.set(0, 3.05, z);
    group.add(ring);
  });
  const strip = keep(new BoxGeometry(0.08, 0.55, 7.4));
  [-2.99, 2.99].forEach((x) => {
    const lit = new Mesh(strip, windows);
    lit.position.set(x, 3.6, 0);
    group.add(lit);
  });

  // Airlock on the side the walkers come back to; the walk ends at its door.
  const lock = new Mesh(keep(new CylinderGeometry(1.25, 1.25, 2.4, 22)), hull);
  lock.rotation.z = Math.PI / 2;
  lock.position.set(AIRLOCK[0] + 1.4, 1.5, 0);
  group.add(lock);
  const lockRim = new Mesh(keep(new TorusGeometry(1.25, 0.1, 6, 24)), trim);
  lockRim.rotation.y = Math.PI / 2;
  lockRim.position.set(AIRLOCK[0] + 0.2, 1.5, 0);
  group.add(lockRim);
  const hatch = new Mesh(keep(new BoxGeometry(0.1, 1.7, 1.1)), door);
  hatch.position.set(AIRLOCK[0] + 0.18, 1.15, 0);
  group.add(hatch);

  // Solar panels facing the low Sun.
  const stand = keep(new CylinderGeometry(0.1, 0.1, 1.8, 6));
  const board = keep(new BoxGeometry(6, 0.12, 2.6));
  [-9, -1.5, 6].forEach((z) => {
    const post = new Mesh(stand, trim);
    post.position.set(10.5, 0.9, z);
    const tilted = new Mesh(board, panel);
    tilted.position.set(10.5, 2, z);
    tilted.rotation.z = -1;
    group.add(post, tilted);
  });

  // Antenna on its mast.
  const mast = new Mesh(keep(new CylinderGeometry(0.1, 0.14, 3.4, 8)), trim);
  mast.position.set(1.2, 7.75, -2.4);
  const dish = new Mesh(keep(new SphereGeometry(1.5, 22, 8, 0, Math.PI * 2, 0, 1)), keep(new MeshLambertMaterial({ color: palette.suit, side: DoubleSide })));
  dish.position.set(1.2, 9.5, -2.4);
  dish.rotation.z = -0.9;
  group.add(mast, dish);

  // Radiation alarm beacon.
  const beaconPost = new Mesh(keep(new CylinderGeometry(0.07, 0.07, 1, 6)), trim);
  beaconPost.position.set(-1.6, 6.5, 3.5);
  const bulb = new Mesh(keep(new SphereGeometry(0.24, 12, 8)), beacon);
  bulb.position.set(-1.6, 7.1, 3.5);
  const glowMap = keep(glowTexture(palette.alert, palette.alert, 0.2));
  const beaconGlow = keep(new SpriteMaterial({ map: glowMap, transparent: true, opacity: 0, depthWrite: false, blending: AdditiveBlending }));
  const glow = new Sprite(beaconGlow);
  glow.position.copy(bulb.position);
  glow.scale.setScalar(3.4);
  group.add(beaconPost, bulb, glow);

  // Refuge: shielded shelter under a mound of regolith.
  const mound = new Mesh(keep(new SphereGeometry(4.2, 28, 12, 0, Math.PI * 2, 0, Math.PI / 2)), regolith);
  mound.scale.set(1.4, 0.62, 1);
  mound.position.set(REFUGE_AT[0], 0, REFUGE_AT[1]);
  const refugeDoor = new Mesh(keep(new BoxGeometry(1.1, 1.3, 0.12)), door);
  refugeDoor.position.set(REFUGE_AT[0], 0.75, REFUGE_AT[1] - 4.15);
  group.add(mound, refugeDoor);
  const refugeGlow = keep(new SpriteMaterial({ map: keep(glowTexture(palette.signal, palette.signal, 0.25)), transparent: true, opacity: 0, depthWrite: false, blending: AdditiveBlending }));
  const halo = new Sprite(refugeGlow);
  halo.position.set(REFUGE_AT[0], 2.2, REFUGE_AT[1]);
  halo.scale.setScalar(16);
  group.add(halo);

  // Long shadows of the low Sun.
  const shade = shadowBlob(keep, palette.void, 26, 5.4, 0.3);
  placeShadow(shade, 0, 0, 22);
  const refugeShade = shadowBlob(keep, palette.void, 12, 3.4, 0.28);
  placeShadow(refugeShade, REFUGE_AT[0], REFUGE_AT[1], 9);
  group.add(shade, refugeShade);

  return { group, windows, door, beacon, beaconGlow, refugeGlow, colors };
}
