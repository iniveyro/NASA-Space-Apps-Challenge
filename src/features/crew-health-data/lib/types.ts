export type MetricId =
  | "heartRate"
  | "bloodPressure"
  | "temperature"
  | "sleep"
  | "mood"
  | "activity"
  | "spo2"
  | "glucose"
  | "stress"
  | "radiation";

export type BodyRegion = "brain" | "heart" | "body";
export type MetricChartType = "line" | "paired" | "bar" | "category";

export interface Metric {
  id: MetricId;
  label: string;
  unit: string;
  region: BodyRegion;
  type: MetricChartType;
  description: string;
  demoReference: string;
}

export type HealthStatus = "stable" | "monitoring" | "simulated-alert";
export type ActivityStatus = "active" | "resting";

export interface ProfileBaseline {
  heartRate: number;
  systolic: number;
  diastolic: number;
  temperature: number;
  sleep: number;
  mood: number;
  activity: number;
  spo2: number;
  glucose: number;
  stress: number;
  radiation: number;
}

export interface Profile {
  id: string;
  name: string;
  role: string;
  initials: string;
  color: string;
  health: HealthStatus;
  activity: ActivityStatus;
  age: number;
  weightKg: number;
  sex: string;
  boneNote: string;
  base: ProfileBaseline;
}

export interface BloodPressureReading {
  systolic: number;
  diastolic: number;
}

export type MetricReading = number | BloodPressureReading | null;

export interface SeriesPoint {
  date: string;
  value: MetricReading;
}

export type ScenarioStatus = "within-demo-reference" | "demo-deviation" | "demo-alert";

export interface MetricScenario {
  status: ScenarioStatus | "unknown";
  label: string;
  baseline: MetricReading;
  baselineLabel: string;
  reference: string;
  evidence: string;
}

/** UMBRAL mission phases, in mission order (see data/processed/mission_timeline.csv). */
export type MissionPhase = "transit_out" | "mars_arrival" | "surface" | "mars_departure" | "transit_return" | "landed";

/** Spacecraft–Earth link state for a mission day. */
export type CommStatus = "link" | "blackout" | "unknown";

export interface MissionDay {
  day: number;
  date: string;
  phase: MissionPhase;
  comm: CommStatus;
}

/** One crew member's simulated readings for one mission day. Missing or non-finite cells are null. */
export interface CrewDayReading {
  day: number;
  date: string;
  crewId: string;
  heartRate: number | null;
  systolic: number | null;
  diastolic: number | null;
  temperature: number | null;
  sleep: number | null;
  mood: number | null;
  glucose: number | null;
  /** Cumulative mission dose in mSv: nondecreasing, not a rate, not a safe limit. */
  radiation: number | null;
  event: string | null;
}

/** Authored scenario event from data/processed/crew_events.csv. */
export interface CrewEvent {
  day: number;
  date: string;
  crewId: string;
  event: string;
  detail: string;
}

export type CrewSeriesField = "heartRate" | "systolic" | "diastolic" | "temperature" | "sleep" | "mood" | "glucose" | "radiation";

/** Compact, serializable per-crew series: index `day - 1` holds that mission day's value. */
export type CrewSeries = Record<CrewSeriesField, (number | null)[]> & { event: (string | null)[] };

export interface MissionDataset {
  days: MissionDay[];
  crew: Record<string, CrewSeries>;
  events: CrewEvent[];
}

export interface DayScenario {
  status: ScenarioStatus | "unknown";
  label: string;
}
