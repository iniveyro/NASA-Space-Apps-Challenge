import { STORAGE_KEY, parseEventHistory } from "./events";
import type { GuidanceEvent, GuidanceEvaluation } from "./types";

type PersistenceState = "loading" | "browser-local" | "session-only" | "history-error";
interface StoreSnapshot { events: GuidanceEvent[]; persistence: PersistenceState; message: string }
const SERVER_SNAPSHOT: StoreSnapshot = { events: [], persistence: "loading", message: "" };
let snapshot: StoreSnapshot = SERVER_SNAPSHOT;
let initialized = false;
const subscribers = new Set<() => void>();

function emit(next: StoreSnapshot) {
  snapshot = next;
  subscribers.forEach((subscriber) => subscriber());
}

function initialize() {
  if (initialized || typeof window === "undefined") return;
  initialized = true;
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    emit({ events: stored ? parseEventHistory(stored) : [], persistence: "browser-local", message: "" });
  } catch (error) {
    const historyError = error instanceof SyntaxError || (error instanceof Error && error.message.includes("malformed"));
    emit({ events: [], persistence: historyError ? "history-error" : "session-only", message: historyError
      ? "Saved history could not be read. The stored data was left untouched; clear it only if you choose to remove it."
      : "Browser storage is unavailable. Demo history will remain in this tab only." });
  }
}

function persist(events: GuidanceEvent[]) {
  if (snapshot.persistence === "history-error") {
    emit({ ...snapshot, events, message: "Stored history remains unreadable and was not overwritten. This session uses temporary in-memory events." });
    return;
  }
  try {
    if (typeof window === "undefined") throw new Error("Browser storage unavailable");
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(events));
    emit({ events, persistence: "browser-local", message: "" });
  } catch {
    emit({ events, persistence: "session-only", message: "Browser storage is unavailable. Demo history will remain in this tab only." });
  }
}

export const guidanceStore = {
  subscribe(callback: () => void) {
    subscribers.add(callback);
    initialize();
    return () => subscribers.delete(callback);
  },
  getSnapshot: () => snapshot,
  getServerSnapshot: () => SERVER_SNAPSHOT,
  findEvent(evaluation: GuidanceEvaluation) {
    return snapshot.events.find((event) => event.astronautId === evaluation.astronautId && event.metricId === evaluation.metricId &&
      (event.readingId === evaluation.readingId || event.currentEvaluation.readingId === evaluation.readingId) &&
      event.missionDay === evaluation.missionDay && event.missionDate === evaluation.missionDate && event.scenarioKey === evaluation.scenarioKey);
  },
  ensureEvent(evaluation: GuidanceEvaluation, create: (value: GuidanceEvaluation) => GuidanceEvent) {
    const existing = guidanceStore.findEvent(evaluation);
    if (existing) return existing;
    const next = create(evaluation);
    persist([next, ...snapshot.events]);
    return next;
  },
  updateEvent(updated: GuidanceEvent) {
    persist(snapshot.events.map((event) => event.id === updated.id ? updated : event));
  },
  clearHistory() {
    try {
      window.localStorage.removeItem(STORAGE_KEY);
      initialized = true;
      emit({ events: [], persistence: "browser-local", message: "" });
    } catch {
      emit({ events: [], persistence: "session-only", message: "Could not clear browser storage; history is cleared in this tab only." });
    }
  },
};
