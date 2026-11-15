/**
 * Single mapping from domain status values to design-system tones.
 * Features pass domain values; primitives resolve the visual treatment.
 */
export type Tone = "ok" | "warn" | "alert" | "unknown" | "info";

const TONE_BY_STATUS: Record<string, Tone> = {
  // Authored metric scenarios
  "within-demo-reference": "ok",
  "demo-deviation": "warn",
  "demo-alert": "alert",
  unknown: "unknown",
  // Crew health / activity labels
  stable: "ok",
  active: "ok",
  monitoring: "warn",
  "simulated-alert": "alert",
  resting: "info",
  // Spacecraft–Earth link (mission timeline)
  link: "ok",
  blackout: "unknown",
};

export function toneFor(status: string | null | undefined): Tone {
  return (status && TONE_BY_STATUS[status]) || "unknown";
}

/** Filled tile (white text) — metric cards and crew vitals. */
export const toneSurface: Record<Tone, string> = {
  ok: "bg-status-ok-surface text-white",
  warn: "bg-status-warn-surface text-white",
  alert: "bg-status-alert-surface text-white",
  unknown: "bg-status-unknown-surface text-white",
  info: "bg-primary text-white",
};

/** Border accent for filled tiles on dark console surfaces. */
export const toneBorder: Record<Tone, string> = {
  ok: "border-status-ok-border",
  warn: "border-status-warn-border",
  alert: "border-status-alert-border",
  unknown: "border-status-unknown-border",
  info: "border-primary",
};

/** Soft callout (light background, dark ink, strong left accent). */
export const toneSoft: Record<Tone, string> = {
  ok: "bg-status-ok-soft text-status-ok-ink border-l-status-ok-surface",
  warn: "bg-status-warn-soft text-status-warn-ink border-l-status-warn-surface",
  alert: "bg-status-alert-soft text-status-alert-ink border-l-status-alert-surface",
  unknown: "bg-status-unknown-soft text-status-unknown-ink border-l-status-unknown-surface",
  info: "bg-primary-soft text-text-strong border-l-primary",
};

/** Small indicator dot. */
export const toneDot: Record<Tone, string> = {
  ok: "bg-status-ok",
  warn: "bg-status-warn",
  alert: "bg-status-alert",
  unknown: "bg-status-unknown",
  info: "bg-status-info",
};

/**
 * Token name per tone for canvas/WebGL accents on dark surfaces, e.g. `readToken(toneToken[tone])`.
 * These are the same colors as `toneBorder`; use the classes above wherever a class can be used.
 */
export const toneToken: Record<Tone, string> = {
  ok: "color-status-ok-border",
  warn: "color-status-warn-border",
  alert: "color-status-alert-border",
  unknown: "color-status-unknown-border",
  info: "color-primary",
};
