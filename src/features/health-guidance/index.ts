export { GuidanceModal } from "./components/GuidanceModal";
export { GUIDANCE_CATALOG, GUIDANCE_VERSION, getGuidance } from "./lib/catalog";
export { evaluateReading, isCompleteFiniteReading, scenarioValue, SEVERE_SYMPTOMS } from "./lib/evaluate";
export { STORAGE_KEY, createEvent, isGuidanceEvent, parseEventHistory, recordAction, recordEscalation, recordFollowUp, reportSymptoms, resetScenarioContext, resolveEvent, reviewContext } from "./lib/events";
export { guidanceStore } from "./lib/browser-store";
export type * from "./lib/types";
