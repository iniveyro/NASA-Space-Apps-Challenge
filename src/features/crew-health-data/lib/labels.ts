import type { ActivityStatus, HealthStatus, MetricId } from "./types";

const HEALTH_LABELS: Record<HealthStatus, string> = {
  stable: "Stable",
  monitoring: "Monitoring",
  "simulated-alert": "Simulated alert",
};

export function healthLabel(status: HealthStatus): string {
  return HEALTH_LABELS[status];
}

export function activityLabel(status: ActivityStatus): string {
  return status === "resting" ? "Resting" : "Active";
}

/** Short provenance note shown under each detail metric card. */
export function metricNote(metricId: MetricId): string {
  if (metricId === "spo2" || metricId === "glucose") return "Simulated point reading";
  if (metricId === "stress" || metricId === "mood") return "Self-reported";
  if (metricId === "radiation") return "Cumulative dose";
  return "Latest simulated value";
}
