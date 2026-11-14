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
