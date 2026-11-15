import type { Color } from "three";
import { tokenColor } from "@/shared/scene/tokens";

/** Anything three.js can free: geometries, materials, textures. */
export type Disposable = { dispose: () => void };
export type Keep = <T extends Disposable>(resource: T) => T;

/** The design-token colors the storm scene is painted with; nothing in the scene is written as a raw color. */
export interface Palette {
  void: Color;
  sun: Color;
  sunGlow: Color;
  mars: Color;
  earth: Color;
  signal: Color;
  star: Color;
  suit: Color;
  hull: Color;
  trim: Color;
  alert: Color;
}

export function readPalette(): Palette {
  return {
    void: tokenColor("color-space-void"),
    sun: tokenColor("color-space-sun"),
    sunGlow: tokenColor("color-space-sun-glow"),
    mars: tokenColor("color-space-mars"),
    earth: tokenColor("color-space-earth"),
    signal: tokenColor("color-space-signal"),
    star: tokenColor("color-space-star"),
    suit: tokenColor("color-console-text"),
    hull: tokenColor("color-console-muted"),
    trim: tokenColor("color-console-raised"),
    alert: tokenColor("color-status-alert"),
  };
}
