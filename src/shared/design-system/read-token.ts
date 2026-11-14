/**
 * Reads a design token at runtime (client only), e.g. readToken("color-chart-primary").
 * Use it only for APIs that cannot take Tailwind classes (third-party SVG/canvas libraries).
 */
export function readToken(name: string, fallback = ""): string {
  if (typeof window === "undefined") return fallback;
  const value = getComputedStyle(document.documentElement).getPropertyValue(`--${name}`).trim();
  return value || fallback;
}
