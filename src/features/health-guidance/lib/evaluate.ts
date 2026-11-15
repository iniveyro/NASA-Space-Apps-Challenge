import { METRICS, getMetric, resolveMetricScenario, type MetricId, type MetricReading, type Profile } from "@/features/crew-health-data";
import { EVALUATION_POLICY_VERSION, GUIDANCE_VERSION, STALE_READING_MAX_AGE_MS, getGuidance } from "./catalog";
import type { DemoScenarioId, GuidanceEvaluation, GuidanceMode, GuidanceStatus, SymptomId } from "./types";

export const SEVERE_SYMPTOMS: readonly SymptomId[] = ["trouble-breathing", "chest-pain", "fainting", "confusion"];

export function isCompleteFiniteReading(metricId: MetricId, value: MetricReading): boolean {
  if (metricId === "bloodPressure") {
    if (!value || typeof value !== "object") return false;
    return Number.isFinite(value.systolic) && Number.isFinite(value.diastolic) && value.systolic > 0 && value.diastolic > 0 && value.systolic > value.diastolic;
  }
  if (typeof value !== "number" || !Number.isFinite(value)) return false;
  if ((metricId === "heartRate" || metricId === "sleep" || metricId === "glucose" || metricId === "temperature") && value < 0) return false;
  if ((metricId === "mood" || metricId === "stress") && (!Number.isInteger(value) || value < 1 || value > 5)) return false;
  if (metricId === "activity" && value < 0) return false;
  if (metricId === "spo2" && (value < 0 || value > 100)) return false;
  if (metricId === "radiation" && value < 0) return false;
  return true;
}

export function scenarioValue(scenarioId: DemoScenarioId): { metricId: MetricId; value: MetricReading } {
  if (scenarioId === "sleep-short") return { metricId: "sleep", value: 5.2 };
  if (scenarioId === "respiratory-symptoms") return { metricId: "spo2", value: 91 };
  return { metricId: "radiation", value: 153.09 };
}

export function evaluateReading(input: {
  person: Profile;
  metricId: MetricId;
  value: MetricReading;
  readingId: string;
  timestamp: string;
  now?: string;
  source: GuidanceEvaluation["source"];
  mode?: GuidanceMode;
  scenarioId?: DemoScenarioId;
  environmentalEvent?: boolean;
  symptoms?: SymptomId[];
  activityState?: GuidanceEvaluation["activityState"];
  unit?: string;
  quality?: "good" | "uncertain" | "invalid";
  referenceTime?: string;
}): GuidanceEvaluation {
  const { person, metricId, value, readingId, timestamp, source, scenarioId } = input;
  const symptoms = input.symptoms ?? [];
  const mode = input.mode ?? "demo";
  const current = input.now ?? input.referenceTime ?? timestamp;
  const time = Date.parse(timestamp);
  const reference = Date.parse(input.referenceTime ?? current);
  const isStale = !Number.isFinite(time) || !Number.isFinite(reference) || reference - time > STALE_READING_MAX_AGE_MS || time > reference + 5 * 60 * 1000;
  const expectedUnit = getMetric(metricId)?.unit ?? "";
  const unitValid = input.unit === undefined || input.unit === expectedUnit;
  const valid = isCompleteFiniteReading(metricId, value) && unitValid && input.quality !== "invalid" && input.quality !== "uncertain" && !isStale;

  let status: GuidanceStatus = "unknown";
  let reasonCode = "READING_UNAVAILABLE_OR_UNRELIABLE";
  let ruleId = "fail-closed-input-validation";
  const safetyEscalation = SEVERE_SYMPTOMS.some((symptom) => symptoms.includes(symptom));
  if (mode === "validated") {
    status = "unknown";
    reasonCode = "VALIDATED_RULESET_NOT_APPROVED";
    ruleId = EVALUATION_POLICY_VERSION;
  } else if (safetyEscalation) {
    status = "critical";
    reasonCode = valid ? "SEVERE_SYMPTOMS_OVERRIDE_READING" : "SEVERE_SYMPTOMS_WITH_UNRELIABLE_READING";
    ruleId = "demo-severe-symptom-safety-override";
  } else if (metricId === "radiation" && input.environmentalEvent && mode === "demo") {
    status = "critical";
    reasonCode = "ACTIVE_ENVIRONMENTAL_EVENT";
    ruleId = "environmental-event-demo";
  } else if (!valid) {
    status = "unknown";
    reasonCode = !unitValid ? "READING_UNIT_MISMATCH" : isStale ? "READING_STALE" : input.quality && input.quality !== "good" ? "READING_QUALITY_UNRELIABLE" : "READING_INVALID_OR_INCOMPLETE";
  } else if (source === "user") {
    status = "unknown";
    reasonCode = "NEW_READING_REQUIRES_REVIEW";
    ruleId = "follow-up-fails-closed";
  } else if (scenarioId === "sleep-short") {
    status = "warning";
    reasonCode = "DEMO_SLEEP_BELOW_AUTHORED_TARGET";
    ruleId = "demo-sleep-short-1";
  } else if (scenarioId === "respiratory-symptoms") {
    status = "critical";
    reasonCode = "DEMO_RESPIRATORY_CONCERN";
    ruleId = "demo-respiratory-concern-1";
  } else if (scenarioId === "radiation-event") {
    status = "warning";
    reasonCode = "CUMULATIVE_DOSE_CONTEXT_ONLY";
    ruleId = "radiation-dose-not-emergency-1";
  } else {
    const authored = resolveMetricScenario(person.id, metricId, value);
    if (authored.status === "within-demo-reference") {
      status = "normal";
      reasonCode = "AUTHORED_DEMO_PREVENTION_ONLY";
      ruleId = "authored-demo-prevention-1";
    } else if (authored.status === "demo-deviation") {
      status = "warning";
      reasonCode = "AUTHORED_DEMO_DEVIATION";
      ruleId = "authored-demo-warning-1";
    } else if (authored.status === "demo-alert" && metricId !== "activity" && metricId !== "radiation") {
      status = "critical";
      reasonCode = "AUTHORED_DEMO_ALERT_NOT_CLINICAL";
      ruleId = "authored-demo-alert-1";
    } else if (authored.status === "demo-alert") {
      status = "warning";
      reasonCode = metricId === "activity" ? "ACTIVITY_MINUTES_NOT_CRITICAL" : "CUMULATIVE_DOSE_NOT_CRITICAL";
      ruleId = "authored-demo-context-only-1";
    } else {
      status = "unknown";
      reasonCode = "NO_AUTHORED_DEMO_RULE";
    }
  }

  return {
    astronautId: person.id, metricId, readingId, value,
    unit: input.unit ?? expectedUnit, status, reasonCode, ruleId,
    ruleVersion: GUIDANCE_VERSION, evaluationPolicyVersion: EVALUATION_POLICY_VERSION, guideId: getGuidance(metricId, status)?.id ?? `${metricId}-${status}-${GUIDANCE_VERSION}`,
    source, isSimulated: true, evaluatedAt: current, timestamp, symptoms,
    activityState: input.activityState ?? "unknown", safetyEscalation, environmentalEvent: input.environmentalEvent === true && mode === "demo", scenarioId: mode === "demo" ? scenarioId : undefined,
  };
}

export function availableMetricIds(): MetricId[] {
  return METRICS.map((metric) => metric.id);
}
