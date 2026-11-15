/**
 * Fictional UMBRAL crew profiles, metrics, and deterministic profile histories.
 * Baselines are the day-1 simulated readings from data/processed/crew_daily.csv; activity is the
 * simulator's assumed daily exercise baseline, and stress is the day-1 Baevsky index.
 * All names, values, dates, labels, and statuses are fictional fixtures.
 */
import type {
  BloodPressureReading,
  Metric,
  MetricId,
  MetricReading,
  MetricScenario,
  Profile,
  ScenarioStatus,
  SeriesPoint,
} from "./types";

export const MISSION_START = "2026-11-14";
export const MISSION_END = "2029-06-12";
export const ENVIRONMENT = "Microgravity";
export const MISSION_DAY = 942;

export const METRICS: readonly Metric[] = [
  { id: "heartRate", label: "Heart rate", unit: "bpm", region: "heart", type: "line", description: "Fictional daily resting-pulse reading.", demoReference: "Interface-only comparison against this profile's fictional preflight reading; no clinical range is asserted." },
  { id: "bloodPressure", label: "Blood pressure", unit: "mmHg", region: "heart", type: "paired", description: "Fictional paired systolic and diastolic point readings.", demoReference: "Paired fictional preflight reading shown for context; no clinical range is asserted." },
  { id: "temperature", label: "Temperature", unit: "°C", region: "body", type: "line", description: "Fictional daily body-temperature reading.", demoReference: "Fictional preflight value for an interface comparison only; not a validated medical range." },
  { id: "sleep", label: "Sleep", unit: "h", region: "brain", type: "bar", description: "Self-reported sleep duration; not a brain measurement.", demoReference: "Self-reported fictional preflight context; this does not define a sleep-health range." },
  { id: "mood", label: "Mood", unit: "/ 5", region: "brain", type: "category", description: "Self-reported mood on a five-point scale.", demoReference: "Self-reported fictional preflight context on this demo scale; not a clinical assessment." },
  { id: "activity", label: "Activity", unit: "min", region: "body", type: "bar", description: "Fictional minutes of logged daily activity.", demoReference: "Fictional preflight activity context; no target or health threshold is implied." },
  { id: "spo2", label: "SpO₂", unit: "%", region: "body", type: "line", description: "Simulated point reading; not a continuous sensor stream.", demoReference: "Fictional point-reading context; no clinical range is asserted." },
  { id: "glucose", label: "Glucose", unit: "mg/dL", region: "body", type: "line", description: "Simulated point reading; not a continuous sensor stream.", demoReference: "Fictional point-reading context; no clinical range is asserted." },
  { id: "stress", label: "Stress index", unit: "SI", region: "brain", type: "line", description: "Baevsky stress index computed from the day's simulated RR intervals (at least 20 beats); not a brain measurement.", demoReference: "Computed from simulated heartbeat intervals for interface comparison only; not a clinical assessment." },
  { id: "radiation", label: "Cumulative radiation", unit: "mSv", region: "body", type: "line", description: "Simulated cumulative mission dose; values are nondecreasing and are not a dose rate.", demoReference: "Mission exposure scenario only: cumulative mission dose, not a personal-physiology baseline or a universal safe limit." },
];

const BONE_NOTE = "Spaceflight can affect bone health. Individual responses vary; this demo does not estimate bone density or loss.";

export const PROFILES: readonly Profile[] = [
  { id: "ines", name: "Inés", role: "Commander · EVA lead", initials: "IN", color: "blue", health: "stable", activity: "active", age: 44, weightKg: 62, sex: "Female", boneNote: BONE_NOTE, base: { heartRate: 61, systolic: 122, diastolic: 68, temperature: 36.6, sleep: 6.4, mood: 4, activity: 45, spo2: 98, glucose: 72, stress: 187, radiation: 151.8 } },
  { id: "kanji", name: "Kanji", role: "Flight engineer · Systems", initials: "KA", color: "green", health: "monitoring", activity: "active", age: 47, weightKg: 70, sex: "Male", boneNote: BONE_NOTE, base: { heartRate: 43, systolic: 114, diastolic: 72, temperature: 36.5, sleep: 5.5, mood: 4, activity: 40, spo2: 97, glucose: 77, stress: 75, radiation: 1.8 } },
  { id: "malik", name: "Malik", role: "Mission specialist · Geologist", initials: "MA", color: "orange", health: "stable", activity: "resting", age: 39, weightKg: 81, sex: "Male", boneNote: BONE_NOTE, base: { heartRate: 60, systolic: 116, diastolic: 74, temperature: 36.7, sleep: 6.1, mood: 4, activity: 35, spo2: 98, glucose: 77, stress: 157, radiation: 1.8 } },
  { id: "sofia", name: "Sofía", role: "Pilot · EVA specialist", initials: "SO", color: "slate", health: "simulated-alert", activity: "active", age: 36, weightKg: 58, sex: "Female", boneNote: BONE_NOTE, base: { heartRate: 67, systolic: 121, diastolic: 70, temperature: 36.8, sleep: 6.5, mood: 4, activity: 50, spo2: 98, glucose: 76, stress: 179, radiation: 1.8 } },
];

export const STATUS_LABELS: Readonly<Record<ScenarioStatus, string>> = {
  "within-demo-reference": "Reference",
  "demo-deviation": "Deviation",
  "demo-alert": "Alert",
};

const ALL_REFERENCE: Record<MetricId, ScenarioStatus> = {
  heartRate: "within-demo-reference", bloodPressure: "within-demo-reference", temperature: "within-demo-reference", sleep: "within-demo-reference", mood: "within-demo-reference", activity: "within-demo-reference", spo2: "within-demo-reference", glucose: "within-demo-reference", stress: "within-demo-reference", radiation: "within-demo-reference",
};

// Authored fixture states, deliberately independent of any reading or medical threshold.
export const SCENARIOS: Readonly<Record<string, Readonly<Record<MetricId, ScenarioStatus>>>> = {
  ines: { ...ALL_REFERENCE },
  kanji: { ...ALL_REFERENCE, heartRate: "demo-deviation" },
  malik: { ...ALL_REFERENCE },
  sofia: { ...ALL_REFERENCE, bloodPressure: "demo-alert" },
};

const SHAPES = {
  heartRate: [2, 1, 0, -1, 1, 3, 1, -2, -1, 0, 2, 1, -1, 0, 2, 1, -2, -1, 1, 2, 0, -1, 1, 3, 1, -2, 0, 1, -1, 0],
  systolic: [2, 0, -1, 1, 3, 1, -2, 0, 1, -1, 2, 1, 0, -2, 1, 3, 0, -1, 1, 2, -2, 0, 1, 2, -1, 0, 2, -1, 1, 0],
  temperature: [0.1, 0, -0.1, 0.2, 0, -0.1, 0.1, 0, -0.2, 0.1, 0, 0.1, -0.1, 0.2, 0, -0.1, 0, 0.1, -0.1, 0.2, 0, -0.2, 0.1, 0, 0.1, -0.1, 0, 0.2, -0.1, 0],
  sleep: [0.3, -0.4, 0.6, 0.1, -0.7, 0.4, 0.2, -0.3, 0.5, -0.2, 0.4, -0.5, 0.2, 0.3, -0.1, 0.6, -0.4, 0.1, -0.2, 0.5, -0.6, 0.3, 0.2, -0.1, 0.4, -0.3, 0.5, -0.4, 0.2, 0],
  mood: [0, 0, 1, 0, -1, 0, 1, 0, 0, -1, 0, 1, 0, 0, -1, 0, 1, 0, 0, 1, -1, 0, 0, 1, 0, -1, 0, 1, 0, 0],
  activity: [8, -5, 12, -4, 3, 9, -8, 4, -3, 6, -6, 10, 2, -7, 5, 8, -4, 1, -9, 7, -2, 6, -5, 4, 10, -6, 2, -3, 5, 0],
  spo2: [0, 1, 0, -1, 0, 1, -1, 0, 0, 1, 0, -1, 1, 0, 0, -1, 0, 1, 0, -1, 0, 1, 0, 0, -1, 1, 0, -1, 0, 0],
  glucose: [2, -3, 1, 0, -2, 4, -1, 3, -2, 0, 1, -4, 2, 0, 3, -1, -2, 4, 0, -3, 1, 2, -1, -2, 3, 0, -4, 2, 1, 0],
  stress: [0, 0, 1, 0, -1, 0, 1, 0, 0, -1, 0, 1, 0, 0, -1, 0, 1, 0, 0, 1, -1, 0, 0, 1, 0, -1, 0, 1, 0, 0],
  dose: [0.04, 0.05, 0.03, 0.06, 0.04, 0.05, 0.04, 0.03, 0.05, 0.04, 0.06, 0.03, 0.04, 0.05, 0.04, 0.03, 0.06, 0.04, 0.05, 0.03, 0.04, 0.05, 0.04, 0.06, 0.03, 0.04, 0.05, 0.04, 0.03, 0.05],
} as const;

/** Returns the profile with the given id, or the first profile as a fallback (legacy behavior). */
export function getProfile(id: string): Profile {
  return PROFILES.find((item) => item.id === id) ?? PROFILES[0];
}

/** Returns the profile with the given id, or undefined when the id is unknown. */
export function findProfile(id: string): Profile | undefined {
  return PROFILES.find((item) => item.id === id);
}

export function getMetric(id: string): Metric | undefined {
  return METRICS.find((metric) => metric.id === id);
}

function dayStamp(daysAgo: number): string {
  const date = new Date(MISSION_END + "T00:00:00Z");
  date.setUTCDate(date.getUTCDate() - daysAgo);
  return date.toISOString().slice(0, 10);
}

function shapeAt(metricId: keyof typeof SHAPES, index: number): number {
  return SHAPES[metricId][index];
}

function valueFor(person: Profile, metricId: MetricId, ago: number): MetricReading {
  const index = 29 - ago;
  switch (metricId) {
    case "heartRate": return person.base.heartRate + shapeAt("heartRate", index);
    case "bloodPressure": return { systolic: person.base.systolic + SHAPES.systolic[index], diastolic: person.base.diastolic + Math.round(SHAPES.systolic[index] * 0.6) };
    case "temperature": return Number((person.base.temperature + shapeAt("temperature", index)).toFixed(1));
    case "sleep": return Number(Math.max(3.5, Math.min(10, person.base.sleep + shapeAt("sleep", index))).toFixed(1));
    case "mood": return Math.max(1, Math.min(5, person.base.mood + shapeAt("mood", index)));
    case "activity": return Math.max(0, person.base.activity + shapeAt("activity", index));
    case "spo2": return Math.max(90, Math.min(100, person.base.spo2 + shapeAt("spo2", index)));
    case "glucose": return Math.max(50, person.base.glucose + shapeAt("glucose", index));
    case "stress": return Math.max(0, person.base.stress + shapeAt("stress", index) * 10);
    case "radiation": return Number((person.base.radiation + SHAPES.dose.slice(0, index + 1).reduce((sum, dose) => sum + dose, 0)).toFixed(2));
    default: return null;
  }
}

export function getSeries(profileId: string, metricId: string, days: number): SeriesPoint[] {
  if (!METRICS.some((item) => item.id === metricId)) throw new Error("Unknown metric: " + metricId);
  const person = getProfile(profileId);
  const count = days === 7 ? 7 : 30;
  return Array.from({ length: count }, (_, index) => {
    const ago = count - index - 1;
    return { date: dayStamp(ago), value: valueFor(person, metricId as MetricId, ago) };
  });
}

export function latest(profileId: string, metricId: string): MetricReading {
  return getSeries(profileId, metricId, 30).at(-1)!.value;
}

function finiteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

export function isBloodPressure(value: unknown): value is BloodPressureReading {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function completeReading(metricId: string, value: unknown): boolean {
  if (metricId === "bloodPressure") {
    return isBloodPressure(value) && finiteNumber(value.systolic) && finiteNumber(value.diastolic);
  }
  return finiteNumber(value);
}

function baselineFor(person: Profile, metricId: string): MetricReading {
  return metricId === "bloodPressure"
    ? { systolic: person.base.systolic, diastolic: person.base.diastolic }
    : (person.base as unknown as Record<string, number>)[metricId];
}

export function formatValue(metricId: string, value: unknown): string {
  if (!completeReading(metricId, value)) return "Unknown";
  if (metricId === "bloodPressure") {
    const reading = value as BloodPressureReading;
    return reading.systolic + "/" + reading.diastolic;
  }
  if (metricId === "temperature") return Number(value).toFixed(1);
  if (metricId === "sleep") return Number(value).toFixed(1);
  if (metricId === "radiation") return Number(value).toFixed(2);
  if (metricId === "stress") return String(Math.round(Number(value)));
  return String(value);
}

export function resolveMetricScenario(profileId: string, metricId: string, reading: unknown): MetricScenario {
  const person = PROFILES.find((item) => item.id === profileId);
  const metric = METRICS.find((item) => item.id === metricId);
  const status = SCENARIOS[profileId]?.[metricId as MetricId];
  const baselineValue = person && person.base && baselineFor(person, metricId);
  const unavailable: MetricScenario = {
    status: "unknown",
    label: "Unknown",
    baseline: null,
    baselineLabel: "Reference unavailable",
    reference: "No complete finite fictional reading and reference are available for this metric.",
    evidence: "No demo status is assigned when required reading or baseline data is missing or invalid.",
  };
  if (!person || !metric || !status || !STATUS_LABELS[status] || !metric.demoReference ||
    !completeReading(metricId, reading) || !completeReading(metricId, baselineValue)) {
    return unavailable;
  }
  return {
    status,
    label: STATUS_LABELS[status],
    baseline: baselineValue as MetricReading,
    baselineLabel: metricId === "radiation" ? "Mission-start dose (fixture context)" : "Fictional preflight value",
    reference: metric.demoReference,
    evidence: "Authored demo scenario; status is not calculated from the reading.",
  };
}
