/**
 * Small procedural textures for WebGL scenes, drawn on a 2D canvas (client only). Colors come in
 * as three.js colors read from design tokens, so no color is written here.
 */
import { CanvasTexture, Color, SRGBColorSpace } from "three";

function cssColor(color: Color, alpha: number): string {
  const [r, g, b] = [color.r, color.g, color.b].map((channel) => Math.round(Math.min(1, Math.max(0, channel)) * 255));
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function canvasTexture(size: number, draw: (context: CanvasRenderingContext2D, size: number) => void): CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext("2d");
  if (context) draw(context, size);
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  return texture;
}

/** Soft radial falloff from `inner` to transparent `outer`: glows, signal pulses, particles. */
export function glowTexture(inner: Color, outer: Color, core = 0.12): CanvasTexture {
  // Colors are stored in the linear working space; convert back to sRGB for the 2D canvas.
  const innerSrgb = inner.clone().convertLinearToSRGB();
  const outerSrgb = outer.clone().convertLinearToSRGB();
  return canvasTexture(128, (context, size) => {
    const half = size / 2;
    const gradient = context.createRadialGradient(half, half, 0, half, half, half);
    gradient.addColorStop(0, cssColor(innerSrgb, 1));
    gradient.addColorStop(core, cssColor(innerSrgb, 0.95));
    gradient.addColorStop(Math.min(0.5, core + 0.22), cssColor(outerSrgb, 0.32));
    gradient.addColorStop(1, cssColor(outerSrgb, 0));
    context.fillStyle = gradient;
    context.fillRect(0, 0, size, size);
  });
}

/** White ring for constant-size markers; tint it with the material color. */
export function ringTexture(): CanvasTexture {
  return canvasTexture(128, (context, size) => {
    const half = size / 2;
    context.lineWidth = size * 0.09;
    context.strokeStyle = cssColor(new Color(1, 1, 1), 1);
    context.beginPath();
    context.arc(half, half, half * 0.8, 0, Math.PI * 2);
    context.stroke();
  });
}
