import { METRICS, type Profile } from "@/features/crew-health-data";
import type { GuidanceContextAudit, GuidanceEvent, GuidanceEvaluation, GuidanceEscalationAudit, NewReading, SymptomId } from "./types";
import { evaluateReading, isCompleteFiniteReading } from "./evaluate";
import type { GuidanceMode } from "./types";

export const STORAGE_KEY = "astro-health.educational-guidance.v1";

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function isTimestamp(value: unknown): value is string {
  return typeof value === "string" && Number.isFinite(Date.parse(value));
}

function validReading(value: unknown): boolean {
  if (value === null) return true;
  if (typeof value === "number") return Number.isFinite(value);
  return isRecord(value) && typeof value.systolic === "number" && Number.isFinite(value.systolic) &&
    typeof value.diastolic === "number" && Number.isFinite(value.diastolic);
}

type MissionContextShape = { missionDay?: unknown; missionDate?: unknown; scenarioKey?: unknown };

function validMissionContext(value: MissionContextShape): boolean {
  return (value.missionDay === undefined || (typeof value.missionDay === "number" && Number.isInteger(value.missionDay) && value.missionDay > 0)) &&
    (value.missionDate === undefined || (typeof value.missionDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value.missionDate) && Number.isFinite(Date.parse(`${value.missionDate}T00:00:00Z`)))) &&
    (value.scenarioKey === undefined || (typeof value.scenarioKey === "string" && value.scenarioKey.length > 0));
}

function sameMissionContext(left: MissionContextShape, right: MissionContextShape): boolean {
  return left.missionDay === right.missionDay && left.missionDate === right.missionDate && left.scenarioKey === right.scenarioKey;
}

function validEvaluation(value: unknown): value is GuidanceEvaluation {
  if (!isRecord(value)) return false;
  const statuses = ["normal", "warning", "critical", "unknown"];
  const knownMetric = METRICS.some((metric) => metric.id === value.metricId);
  return knownMetric && (value.value === null ? value.status === "unknown" || value.status === "critical" : isCompleteFiniteReading(value.metricId as GuidanceEvaluation["metricId"], value.value as GuidanceEvaluation["value"])) &&
    typeof value.astronautId === "string" &&
    typeof value.readingId === "string" && validReading(value.value) && typeof value.unit === "string" &&
    statuses.includes(String(value.status)) && typeof value.reasonCode === "string" && typeof value.ruleId === "string" &&
    typeof value.ruleVersion === "string" && typeof value.evaluationPolicyVersion === "string" && typeof value.guideId === "string" && isTimestamp(value.timestamp) &&
    isTimestamp(value.evaluatedAt) && Array.isArray(value.symptoms) && value.symptoms.every((item) => ["trouble-breathing", "chest-pain", "fainting", "confusion"].includes(String(item))) &&
    ["fixture", "scenario", "user"].includes(String(value.source)) && ["awake", "sleeping", "unknown"].includes(String(value.activityState)) &&
    typeof value.safetyEscalation === "boolean" && typeof value.environmentalEvent === "boolean" && value.isSimulated === true &&
    (value.scenarioId === undefined || ["sleep-short", "respiratory-symptoms", "radiation-event"].includes(String(value.scenarioId))) && validMissionContext(value);
}

function validContextAudit(value: unknown): value is GuidanceContextAudit {
  return isRecord(value) && typeof value.id === "string" && typeof value.description === "string" && isTimestamp(value.at) &&
    ["symptoms-reported", "symptoms-reviewed", "scenario-reset"].includes(String(value.kind));
}

function valuesMatch(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

export function isGuidanceEvent(value: unknown): value is GuidanceEvent {
  if (!isRecord(value) || value.schemaVersion !== 2 || !validEvaluation(value.evaluation) || !validEvaluation(value.currentEvaluation)) return false;
  const initial = value.evaluation;
  const current = value.currentEvaluation;
  const metricIsKnown = METRICS.some((metric) => metric.id === value.metricId);
  const actionsAreValid = Array.isArray(value.actions) && new Set(value.actions.map((action) => isRecord(action) ? action.id : undefined)).size === value.actions.length && value.actions.every((action) => isRecord(action) &&
    typeof action.id === "string" && typeof action.stepId === "string" && typeof action.stepText === "string" &&
    typeof action.guideId === "string" && typeof action.guideVersion === "string" && typeof action.checked === "boolean" && isTimestamp(action.at));
  const escalationsAreValid = Array.isArray(value.escalations) && new Set(value.escalations.map((item) => isRecord(item) ? item.id : undefined)).size === value.escalations.length && value.escalations.every((item) => isRecord(item) &&
    typeof item.id === "string" && item.kind === "simulated-escalation" && typeof item.description === "string" && isTimestamp(item.at));
  const followUpsAreValid = Array.isArray(value.followUps) && value.followUps.every((followUp) => isRecord(followUp) &&
    typeof followUp.readingId === "string" && validReading(followUp.value) && typeof followUp.unit === "string" &&
    isTimestamp(followUp.timestamp) && validEvaluation(followUp.evaluation) && followUp.readingId === followUp.evaluation.readingId &&
    followUp.astronautId === initial.astronautId && followUp.metricId === initial.metricId && followUp.metricId === value.metricId &&
    followUp.evaluation.astronautId === followUp.astronautId && followUp.evaluation.metricId === followUp.metricId && sameMissionContext(followUp.evaluation, initial) &&
    followUp.timestamp === followUp.evaluation.timestamp && followUp.unit === followUp.evaluation.unit && valuesMatch(followUp.value, followUp.evaluation.value));
  const resolution = value.resolution;
  const latestFollowUp = Array.isArray(value.followUps) ? value.followUps.at(-1) : undefined;
  const currentReadingExists = current.readingId === initial.readingId || (isRecord(latestFollowUp) && latestFollowUp.readingId === current.readingId);
  return typeof value.id === "string" && value.astronautId === initial.astronautId && value.astronautId === current.astronautId &&
    metricIsKnown && value.metricId === initial.metricId && value.metricId === current.metricId && typeof value.readingId === "string" &&
    value.readingId === initial.readingId && currentReadingExists && typeof initial.guideId === "string" && actionsAreValid && escalationsAreValid &&
    validMissionContext(value) && sameMissionContext(value, initial) && sameMissionContext(value, current) &&
    Array.isArray(value.contextHistory) && value.contextHistory.every(validContextAudit) && followUpsAreValid &&
    isTimestamp(value.createdAt) && isTimestamp(value.updatedAt) &&
    (resolution === undefined || (isRecord(resolution) && typeof resolution.reason === "string" && resolution.reason.trim().length > 0 && isTimestamp(resolution.at)));
}

function migrateLegacyEvent(value: unknown): unknown {
  if (!isRecord(value) || value.schemaVersion === 2) return value;
  if (!isRecord(value.evaluation) || !Array.isArray(value.actions) || !Array.isArray(value.followUps)) return value;
  const oldEvaluation = value.evaluation;
  const evaluation = {
    ...oldEvaluation,
    source: oldEvaluation.source ?? "fixture",
    evaluationPolicyVersion: oldEvaluation.evaluationPolicyVersion ?? "demo-data-quality-1.0.0",
    isSimulated: true,
    symptoms: Array.isArray(oldEvaluation.symptoms) ? oldEvaluation.symptoms : [],
    activityState: oldEvaluation.activityState ?? "unknown",
    safetyEscalation: oldEvaluation.safetyEscalation ?? false,
    environmentalEvent: oldEvaluation.environmentalEvent ?? oldEvaluation.ruleId === "environmental-event-demo",
  };
  if (!validEvaluation(evaluation)) return value;
  const actions = value.actions.map((action, index) => isRecord(action) ? {
    id: `${String(value.id)}:migrated-action:${index}`,
    stepId: String(action.stepId ?? "legacy-action"),
    stepText: String(action.stepId ?? "Previously recorded action"),
    guideId: evaluation.guideId,
    guideVersion: evaluation.ruleVersion,
    checked: action.checked === true,
    at: action.at,
  } : action);
  const followUps = value.followUps.map((item) => isRecord(item) && isRecord(item.evaluation) ? {
    ...item, astronautId: item.evaluation.astronautId, metricId: item.evaluation.metricId, unit: item.evaluation.unit,
  } : item);
  return { ...value, schemaVersion: 2, evaluation, currentEvaluation: evaluation, actions, followUps, escalations: [], contextHistory: [] };
}

export function parseEventHistory(raw: string): GuidanceEvent[] {
  const decoded: unknown = JSON.parse(raw);
  if (!Array.isArray(decoded)) throw new Error("Stored demo history is malformed and was not loaded.");
  const migrated = decoded.map(migrateLegacyEvent);
  if (!migrated.every(isGuidanceEvent)) throw new Error("Stored demo history is malformed and was not loaded.");
  return migrated;
}

export function createEvent(evaluation: GuidanceEvaluation, now = new Date().toISOString()): GuidanceEvent {
  return {
    id: `event-${evaluation.astronautId}-${evaluation.metricId}-${evaluation.readingId}`,
    astronautId: evaluation.astronautId, metricId: evaluation.metricId, readingId: evaluation.readingId, schemaVersion: 2,
    missionDay: evaluation.missionDay, missionDate: evaluation.missionDate, scenarioKey: evaluation.scenarioKey,
    evaluation, currentEvaluation: evaluation, actions: [], escalations: [], contextHistory: [], followUps: [], createdAt: now, updatedAt: now,
  };
}

export function recordAction(event: GuidanceEvent, guideId: string, guideVersion: string, stepId: string, stepText: string, checked: boolean, at = new Date().toISOString()): GuidanceEvent {
  const action: GuidanceEvent["actions"][number] = {
    id: `${event.id}:action:${event.actions.length + 1}`, guideId, guideVersion, stepId, stepText, checked, at,
  };
  return { ...event, actions: [...event.actions, action], updatedAt: at };
}

export function recordEscalation(event: GuidanceEvent, description: string, at = new Date().toISOString()): GuidanceEvent {
  const record: GuidanceEscalationAudit = { id: `${event.id}:escalation:${event.escalations.length + 1}`, kind: "simulated-escalation", description, at };
  return { ...event, escalations: [...event.escalations, record], updatedAt: at };
}

export function recordFollowUp(event: GuidanceEvent, person: Profile, reading: NewReading, readingId: string, now = new Date().toISOString(), mode: GuidanceMode = "demo"): GuidanceEvent {
  if (reading.metricId !== event.metricId || person.id !== event.astronautId) throw new Error("Follow-up must use the original profile and metric event.");
  if (!isCompleteFiniteReading(reading.metricId, reading.value)) throw new Error("Follow-up value is outside the demo data-quality constraints.");
  const prior = event.currentEvaluation;
  const symptoms = reading.symptoms === undefined ? prior.symptoms : [...new Set([...prior.symptoms, ...reading.symptoms])];
  const evaluation = evaluateReading({
    person, metricId: reading.metricId, value: reading.value, unit: reading.unit, readingId, timestamp: reading.timestamp, now,
    source: "user", mode, symptoms, environmentalEvent: prior.environmentalEvent, activityState: prior.activityState,
    scenarioId: prior.scenarioId, missionDay: prior.missionDay, missionDate: prior.missionDate, scenarioKey: prior.scenarioKey,
  });
  return {
    ...event, currentEvaluation: evaluation,
    followUps: [...event.followUps, { readingId, astronautId: person.id, metricId: reading.metricId, value: reading.value, unit: reading.unit, timestamp: reading.timestamp, evaluation }],
    updatedAt: now,
  };
}

function evaluateContext(event: GuidanceEvent, person: Profile, symptoms: SymptomId[], environmentalEvent: boolean, activityState: GuidanceEvaluation["activityState"], now: string, mode: GuidanceMode): GuidanceEvaluation {
  const prior = event.currentEvaluation;
  return evaluateReading({ person, metricId: event.metricId, value: prior.value, unit: prior.unit, readingId: prior.readingId,
    timestamp: prior.timestamp, referenceTime: prior.timestamp, now, source: prior.source, mode,
    scenarioId: prior.scenarioId === "radiation-event" && !environmentalEvent ? undefined : prior.scenarioId,
    missionDay: prior.missionDay, missionDate: prior.missionDate, scenarioKey: prior.scenarioKey,
    symptoms, environmentalEvent, activityState });
}

export function reportSymptoms(event: GuidanceEvent, person: Profile, reported: SymptomId[], now = new Date().toISOString(), mode: GuidanceMode = "demo"): GuidanceEvent {
  const symptoms = [...new Set([...event.currentEvaluation.symptoms, ...reported])];
  const currentEvaluation = evaluateContext(event, person, symptoms, event.currentEvaluation.environmentalEvent, event.currentEvaluation.activityState, now, mode);
  const record: GuidanceContextAudit = { id: `${event.id}:symptoms:${event.contextHistory.length + 1}`, kind: "symptoms-reported", description: `Symptoms reported: ${reported.join(", ") || "none"}`, at: now };
  return { ...event, currentEvaluation, contextHistory: [...event.contextHistory, record], updatedAt: now };
}

export function reviewContext(event: GuidanceEvent, person: Profile, input: { symptoms: SymptomId[]; environmentalEvent: boolean; activityState: GuidanceEvaluation["activityState"] }, now = new Date().toISOString(), mode: GuidanceMode = "demo"): GuidanceEvent {
  const currentEvaluation = evaluateContext(event, person, input.symptoms, input.environmentalEvent, input.activityState, now, mode);
  const kind: GuidanceContextAudit["kind"] = event.currentEvaluation.environmentalEvent && !input.environmentalEvent ? "scenario-reset" : "symptoms-reviewed";
  const record: GuidanceContextAudit = { id: `${event.id}:context:${event.contextHistory.length + 1}`, kind,
    description: `Context explicitly reviewed; symptoms: ${input.symptoms.join(", ") || "none"}; environmental event: ${input.environmentalEvent ? "active" : "inactive"}; activity: ${input.activityState}.`, at: now };
  return { ...event, currentEvaluation, contextHistory: [...event.contextHistory, record], updatedAt: now };
}

export function resetScenarioContext(event: GuidanceEvent, baseline: GuidanceEvaluation, now = new Date().toISOString()): GuidanceEvent {
  if (baseline.astronautId !== event.astronautId || baseline.metricId !== event.metricId) throw new Error("Scenario reset must stay within the same profile and metric.");
  const record: GuidanceContextAudit = { id: `${event.id}:context:${event.contextHistory.length + 1}`, kind: "scenario-reset",
    description: "Simulation overlay was explicitly reset; the original event remains in history.", at: now };
  return { ...event, currentEvaluation: baseline, contextHistory: [...event.contextHistory, record], updatedAt: now };
}

export function resolveEvent(event: GuidanceEvent, reason: string, at = new Date().toISOString()): GuidanceEvent {
  if (!reason.trim()) throw new Error("A manual resolution reason is required.");
  return { ...event, resolution: { reason: reason.trim(), at }, updatedAt: at };
}

export function toggleSymptom(current: SymptomId[], symptom: SymptomId): SymptomId[] {
  return current.includes(symptom) ? current.filter((item) => item !== symptom) : [...current, symptom];
}
