import type { MetricId, MetricReading } from "@/features/crew-health-data";

export type GuidanceStatus = "normal" | "warning" | "critical" | "unknown";
export type GuidanceMode = "demo" | "validated";
export type DemoScenarioId = "sleep-short" | "respiratory-symptoms" | "radiation-event";
export type SymptomId = "trouble-breathing" | "chest-pain" | "fainting" | "confusion";

export interface SourceReference {
  label: string;
  url: string;
  scope: string;
}

export interface GuidanceRecord {
  id: string;
  metricId: MetricId;
  status: GuidanceStatus;
  title: string;
  whatIsHappening: string;
  possibleCauses: string[];
  recommendedActions: string[];
  whenToSeekHelp: string[];
  followUp: string;
  sources: SourceReference[];
  reviewStatus: "needs_medical_review";
  version: string;
}

export interface GuidanceEvaluation {
  astronautId: string;
  metricId: MetricId;
  readingId: string;
  value: MetricReading;
  unit: string;
  status: GuidanceStatus;
  reasonCode: string;
  ruleId: string;
  ruleVersion: string;
  evaluationPolicyVersion: string;
  guideId: string;
  source: "fixture" | "scenario" | "user";
  isSimulated: true;
  evaluatedAt: string;
  timestamp: string;
  symptoms: SymptomId[];
  activityState: "awake" | "sleeping" | "unknown";
  safetyEscalation: boolean;
  environmentalEvent: boolean;
  scenarioId?: DemoScenarioId;
  /** Selected mission-data context; absent only on migrated pre-merge browser history. */
  missionDay?: number;
  missionDate?: string;
  scenarioKey?: string;
}

export interface GuidanceActionAudit {
  id: string;
  guideId: string;
  guideVersion: string;
  stepId: string;
  stepText: string;
  checked: boolean;
  at: string;
}

export interface GuidanceEscalationAudit {
  id: string;
  kind: "simulated-escalation";
  description: string;
  at: string;
}

export interface GuidanceContextAudit {
  id: string;
  kind: "symptoms-reported" | "symptoms-reviewed" | "scenario-reset";
  description: string;
  at: string;
}

export interface GuidanceEvent {
  id: string;
  astronautId: string;
  metricId: MetricId;
  readingId: string;
  schemaVersion: 2;
  /** Mission context prevents a checklist or follow-up from crossing selected days/scenarios. */
  missionDay?: number;
  missionDate?: string;
  scenarioKey?: string;
  /** Immutable first reading evaluation; never rewritten by later actions or context. */
  evaluation: GuidanceEvaluation;
  /** Latest reading/context projection; updated only by follow-up or explicit context review. */
  currentEvaluation: GuidanceEvaluation;
  actions: GuidanceActionAudit[];
  escalations: GuidanceEscalationAudit[];
  contextHistory: GuidanceContextAudit[];
  followUps: { readingId: string; astronautId: string; metricId: MetricId; value: MetricReading; unit: string; timestamp: string; evaluation: GuidanceEvaluation }[];
  resolution?: { reason: string; at: string };
  createdAt: string;
  updatedAt: string;
}

export type NewReading = { metricId: MetricId; value: MetricReading; unit: string; timestamp: string; symptoms?: SymptomId[] };
