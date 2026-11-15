import { PROFILES } from "@/features/crew-health-data";
import { describe, expect, it } from "vitest";
import { createEvent, parseEventHistory, recordAction, recordEscalation, recordFollowUp, reportSymptoms, resolveEvent, reviewContext } from "./events";
import { evaluateReading } from "./evaluate";

const person = PROFILES[0];
const evaluation = evaluateReading({ person, metricId: "bloodPressure", value: { systolic: 122, diastolic: 68 }, readingId: "reading-original", timestamp: "2029-06-12T00:00:00.000Z", referenceTime: "2029-06-12T00:00:00.000Z", source: "fixture" });

describe("local demo event history", () => {
  it("appends immutable check, uncheck, recheck action audit records", () => {
    const event = createEvent(evaluation, "2029-06-12T01:00:00.000Z");
    const checked = recordAction(event, evaluation.guideId, evaluation.ruleVersion, "bp-warning:action-1", "Check cuff fit", true, "2029-06-12T01:01:00.000Z");
    const unchecked = recordAction(checked, evaluation.guideId, evaluation.ruleVersion, "bp-warning:action-1", "Check cuff fit", false, "2029-06-12T01:02:00.000Z");
    const rechecked = recordAction(unchecked, evaluation.guideId, evaluation.ruleVersion, "bp-warning:action-1", "Check cuff fit", true, "2029-06-12T01:03:00.000Z");
    expect(rechecked.actions.map(({ checked: state }) => state)).toEqual([true, false, true]);
    expect(rechecked.actions.map(({ at }) => at)).toEqual(["2029-06-12T01:01:00.000Z", "2029-06-12T01:02:00.000Z", "2029-06-12T01:03:00.000Z"]);
    expect(rechecked.evaluation).toEqual(evaluation);
    expect(new Set(rechecked.actions.map(({ id }) => id)).size).toBe(3);
  });

  it("stores a simulated escalation audit without mutating the original reading", () => {
    const event = createEvent(evaluation);
    const updated = recordEscalation(event, "Local-only escalation; no message sent", "2029-06-12T02:00:00.000Z");
    expect(updated.escalations).toHaveLength(1);
    expect(updated.escalations[0].kind).toBe("simulated-escalation");
    expect(updated.evaluation).toEqual(evaluation);
  });

  it("keeps severe symptoms through follow-up until explicit context review", () => {
    const initial = evaluateReading({ person, metricId: "spo2", value: 98, readingId: "respiratory-reading", timestamp: "2029-06-12T00:00:00.000Z", referenceTime: "2029-06-12T00:00:00.000Z", source: "scenario", scenarioId: "respiratory-symptoms", symptoms: ["trouble-breathing"], activityState: "sleeping" });
    const event = createEvent(initial);
    const updated = recordFollowUp(event, person, { metricId: "spo2", value: 99, unit: "%", timestamp: "2029-06-12T03:00:00.000Z" }, "respiratory-follow-up", "2029-06-12T03:00:00.000Z");
    expect(updated.evaluation).toEqual(initial);
    expect(updated.currentEvaluation.status).toBe("critical");
    expect(updated.currentEvaluation.symptoms).toContain("trouble-breathing");
    expect(updated.currentEvaluation.activityState).toBe("sleeping");
    expect(updated.followUps[0].unit).toBe("%");
    const reviewed = reviewContext(updated, person, { symptoms: [], environmentalEvent: false, activityState: "awake" }, "2029-06-12T04:00:00.000Z");
    expect(reviewed.contextHistory).toHaveLength(1);
    expect(reviewed.currentEvaluation.symptoms).toEqual([]);
    expect(reviewed.evaluation).toEqual(initial);
  });

  it("carries an active environmental event through a radiation follow-up", () => {
    const environmental = evaluateReading({ person, metricId: "radiation", value: 153.09, readingId: "rad-event", timestamp: "2029-06-12T00:00:00.000Z", referenceTime: "2029-06-12T00:00:00.000Z", source: "scenario", scenarioId: "radiation-event", environmentalEvent: true });
    const event = createEvent(environmental);
    const followUp = recordFollowUp(event, person, { metricId: "radiation", value: 153.1, unit: "mSv", timestamp: "2029-06-12T01:00:00.000Z" }, "rad-follow-up", "2029-06-12T01:00:00.000Z");
    expect(followUp.currentEvaluation.environmentalEvent).toBe(true);
    expect(followUp.currentEvaluation.status).toBe("critical");
    expect(followUp.evaluation.environmentalEvent).toBe(true);
    const reset = reviewContext(followUp, person, { symptoms: [], environmentalEvent: false, activityState: "unknown" }, "2029-06-12T02:00:00.000Z");
    expect(reset.currentEvaluation.environmentalEvent).toBe(false);
    expect(reset.contextHistory[0].kind).toBe("scenario-reset");
    expect(reset.evaluation.status).toBe("critical");
  });

  it("records report-symptoms without fabricating a reading and records justified manual resolution", () => {
    const event = createEvent(evaluation);
    const updated = reportSymptoms(event, person, ["chest-pain"], "2029-06-12T01:00:00.000Z");
    expect(updated.currentEvaluation.readingId).toBe(evaluation.readingId);
    expect(updated.currentEvaluation.value).toEqual(evaluation.value);
    expect(updated.currentEvaluation.status).toBe("critical");
    const closed = resolveEvent(updated, "Reviewed with demo supervisor", "2029-06-12T03:00:00.000Z");
    expect(closed.resolution?.reason).toBe("Reviewed with demo supervisor");
    expect(closed.contextHistory).toHaveLength(1);
  });

  it("keeps the same astronaut and metric separate across selected mission days and scenarios", () => {
    const day518 = evaluateReading({
      person, metricId: "spo2", value: 89, readingId: "ines:spo2:day:518:scenario:mission:demo-alert",
      timestamp: "2028-04-14T00:00:00.000Z", referenceTime: "2028-04-14T00:00:00.000Z", source: "fixture",
      missionDay: 518, missionDate: "2028-04-14", scenarioKey: "mission:demo-alert:spo2_alert",
    });
    const day519 = evaluateReading({
      person, metricId: "spo2", value: 97, readingId: "ines:spo2:day:519:scenario:mission:within-demo-reference",
      timestamp: "2028-04-15T00:00:00.000Z", referenceTime: "2028-04-15T00:00:00.000Z", source: "fixture",
      missionDay: 519, missionDate: "2028-04-15", scenarioKey: "mission:within-demo-reference:reference",
    });
    const first = recordAction(createEvent(day518), day518.guideId, day518.ruleVersion, "step-1", "Review the source day", true);
    const second = createEvent(day519);
    expect(first.readingId).not.toBe(second.readingId);
    expect(first.missionDay).toBe(518);
    expect(second.missionDay).toBe(519);
    expect(first.actions).toHaveLength(1);
    expect(second.actions).toHaveLength(0);
    expect(parseEventHistory(JSON.stringify([first, second]))).toEqual([first, second]);
  });

  it("validates nested identities, enums, action and timestamp records before parsing", () => {
    const event = createEvent(evaluation);
    const followUp = recordFollowUp(event, person, { metricId: "bloodPressure", value: { systolic: 118, diastolic: 72 }, unit: "mmHg", timestamp: "2029-06-12T02:00:00.000Z" }, "reading-follow-up", "2029-06-12T02:00:00.000Z");
    expect(parseEventHistory(JSON.stringify([followUp]))).toEqual([followUp]);
    const corruptions = [
      { ...followUp, actions: [{ ...recordAction(event, evaluation.guideId, evaluation.ruleVersion, "step", "step", true).actions[0], at: "invalid" }] },
      { ...followUp, currentEvaluation: { ...followUp.currentEvaluation, source: "other" } },
      { ...followUp, currentEvaluation: { ...followUp.currentEvaluation, scenarioId: "unregistered-scenario" } },
      { ...followUp, astronautId: "another-astronaut" },
      { ...followUp, metricId: "mood" },
      { ...followUp, followUps: [{ ...followUp.followUps[0], value: { systolic: 110 }, evaluation: { ...followUp.followUps[0].evaluation, timestamp: "not-a-date" } }] },
      { ...followUp, followUps: [{ ...followUp.followUps[0], metricId: "mood" }] },
      { ...followUp, followUps: [{ ...followUp.followUps[0], astronautId: "another-astronaut" }] },
      { ...followUp, followUps: [{ ...followUp.followUps[0], evaluation: { ...followUp.followUps[0].evaluation, symptoms: ["made-up-symptom"] } }] },
      { ...followUp, escalations: [{ id: "bad", kind: "sent-message", description: "invalid enum", at: "2029-06-12T01:00:00.000Z" }] },
      { ...followUp, contextHistory: [{ id: "bad", kind: "unknown-context", description: "invalid enum", at: "2029-06-12T01:00:00.000Z" }] },
    ];
    for (const corruption of corruptions) expect(() => parseEventHistory(JSON.stringify([corruption]))).toThrow(/malformed/i);
    expect(() => parseEventHistory("not-json")).toThrow();
  });

  it("migrates earlier demo events without dropping their actions", () => {
    const event = createEvent(evaluation);
    const legacy = {
      id: event.id, astronautId: event.astronautId, metricId: event.metricId, readingId: event.readingId,
      evaluation: { ...evaluation, safetyEscalation: undefined, environmentalEvent: undefined },
      actions: [{ stepId: "old-step", checked: true, at: "2029-06-12T01:00:00.000Z" }], followUps: [], createdAt: event.createdAt, updatedAt: event.updatedAt,
    };
    const migrated = parseEventHistory(JSON.stringify([legacy]));
    expect(migrated[0].schemaVersion).toBe(2);
    expect(migrated[0].actions[0].stepId).toBe("old-step");
    expect(migrated[0].evaluation).toMatchObject({
      astronautId: evaluation.astronautId, metricId: evaluation.metricId, readingId: evaluation.readingId,
      status: evaluation.status, ruleId: evaluation.ruleId, ruleVersion: evaluation.ruleVersion,
    });
  });
});
