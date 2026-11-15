import { Color } from "three";
import { readToken } from "@/shared/design-system";

/** Reads a design token as a three.js color (client only). Unknown tokens resolve to white instead of throwing. */
export function tokenColor(name: string): Color {
  const color = new Color();
  const value = readToken(name);
  if (value) color.set(value);
  return color;
}
