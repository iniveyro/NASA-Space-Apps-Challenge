import type { BodyRegion, MetricId } from "@/features/crew-health-data";

export const REGION_METRICS: Readonly<Record<BodyRegion, readonly MetricId[]>> = {
  heart: ["heartRate", "bloodPressure"],
  brain: ["sleep", "mood", "stress"],
  body: ["temperature", "activity", "spo2", "glucose", "radiation"],
};

export const REGION_DESCRIPTIONS: Readonly<Record<BodyRegion, string>> = {
  heart: "Heart-associated readings: heart rate and blood pressure.",
  brain: "Brain-associated signals: self-reported sleep and mood, and the computed stress index.",
  body: "Whole-body signals: temperature, activity, SpO₂, glucose, and radiation.",
};

export const DEFAULT_CALLOUT = "Regions are metric-navigation groups, not organ measurements.";

export const REGION_BUTTONS: ReadonlyArray<{ region: BodyRegion; label: string }> = [
  { region: "brain", label: "Brain" },
  { region: "heart", label: "Heart" },
  { region: "body", label: "Whole body" },
];

/** First metric selected when a region is chosen. */
export function firstMetricFor(region: BodyRegion): MetricId {
  return REGION_METRICS[region][0];
}

/** Maps a clicked muscle from the illustration to a navigation region. */
export function regionForMuscle(muscle: string | undefined | null): BodyRegion {
  const clicked = String(muscle || "").toLowerCase();
  if (clicked === "head" || clicked === "neck") return "brain";
  if (clicked === "chest") return "heart";
  return "body";
}
