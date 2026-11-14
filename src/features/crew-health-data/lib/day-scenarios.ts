/**
 * Authored per-day demo scenarios for the UMBRAL mission, taken from the scenario events in
 * data/processed/crew_events.csv. They are fixture states, never computed from the readings,
 * and imply no clinical threshold.
 */
import type { DayScenario, MetricId, ScenarioStatus } from "./types";

interface AuthoredDayScenario {
  /** Crew id, or "*" for every crew member. */
  crewId: string;
  metricId: MetricId;
  fromDay: number;
  toDay: number;
  status: ScenarioStatus;
}

export const DAY_SCENARIOS: readonly AuthoredDayScenario[] = [
  // Viral reactivation scenario (event day 120, effects on days 120–122).
  { crewId: "kanji", metricId: "heartRate", fromDay: 120, toDay: 122, status: "demo-alert" },
  // Orthostatic test scenario on Mars arrival.
  { crewId: "sofia", metricId: "bloodPressure", fromDay: 211, toDay: 211, status: "demo-alert" },
  // Solar storm scenario: event dose added to the cumulative total.
  { crewId: "*", metricId: "radiation", fromDay: 493, toDay: 493, status: "demo-deviation" },
];

const LABELS: Readonly<Record<ScenarioStatus | "unknown", string>> = {
  "within-demo-reference": "Reference",
  "demo-deviation": "Deviation",
  "demo-alert": "Alert",
  unknown: "Unknown",
};

function finite(value: unknown): boolean {
  return typeof value === "number" && Number.isFinite(value);
}

function complete(metricId: MetricId, reading: unknown): boolean {
  if (metricId === "bloodPressure") {
    const pair = reading as { systolic?: unknown; diastolic?: unknown } | null;
    return Boolean(pair && typeof pair === "object" && finite(pair.systolic) && finite(pair.diastolic));
  }
  return finite(reading);
}

/** Authored demo status for one crew member, metric, and mission day; "unknown" when the reading is missing. */
export function resolveDayScenario(crewId: string, metricId: MetricId, day: number, reading: unknown): DayScenario {
  if (!complete(metricId, reading)) return { status: "unknown", label: LABELS.unknown };
  const match = DAY_SCENARIOS.find(
    (scenario) => scenario.metricId === metricId && (scenario.crewId === "*" || scenario.crewId === crewId) && day >= scenario.fromDay && day <= scenario.toDay,
  );
  const status = match?.status ?? "within-demo-reference";
  return { status, label: LABELS[status] };
}
