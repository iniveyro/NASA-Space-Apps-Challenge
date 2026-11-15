import { PROFILES } from "@/features/crew-health-data";
import { describe, expect, it } from "vitest";
import { GUIDANCE_CATALOG } from "./catalog";
import { evaluateReading, isCompleteFiniteReading, scenarioValue } from "./evaluate";

const person = PROFILES[0];
const input = { person, metricId: "spo2" as const, value: 98, readingId: "r1", timestamp: "2029-06-12T00:00:00.000Z", now: "2029-06-12T00:05:00.000Z", source: "fixture" as const };

describe("educational guidance catalog and evaluator", () => {
  it("has prevention, warning, critical, and unknown reviewed guides for every metric", () => {
    expect(GUIDANCE_CATALOG).toHaveLength(40);
    for (const metricId of ["heartRate", "bloodPressure", "temperature", "sleep", "mood", "activity", "spo2", "glucose", "stress", "radiation"] as const) {
      const guides = GUIDANCE_CATALOG.filter((guide) => guide.metricId === metricId);
      expect(new Set(guides.map((guide) => guide.status))).toEqual(new Set(["normal", "warning", "critical", "unknown"]));
      for (const guide of guides) {
        expect(guide.possibleCauses.length).toBeLessThanOrEqual(3);
        expect(guide.recommendedActions.length).toBeGreaterThanOrEqual(2);
        expect(guide.recommendedActions.length).toBeLessThanOrEqual(4);
        expect(guide.recommendedActions[0]).not.toBe(GUIDANCE_CATALOG.find((other) => other.metricId !== metricId && other.status === guide.status)?.recommendedActions[0]);
        expect(guide.reviewStatus).toBe("needs_medical_review");
      }
    }
  });

  it("fails closed for validated mode, stale values, bad quality, malformed BP, and ordinal scale values", () => {
    expect(evaluateReading({ ...input, mode: "validated" }).status).toBe("unknown");
    expect(evaluateReading({ ...input, timestamp: "2029-06-10T00:00:00.000Z" }).reasonCode).toBe("READING_STALE");
    expect(evaluateReading({ ...input, quality: "uncertain" }).status).toBe("unknown");
    expect(evaluateReading({ ...input, unit: "kPa" }).reasonCode).toBe("READING_UNIT_MISMATCH");
    expect(isCompleteFiniteReading("bloodPressure", { systolic: 120, diastolic: Number.NaN })).toBe(false);
    expect(isCompleteFiniteReading("bloodPressure", { systolic: 60, diastolic: 70 })).toBe(false);
    expect(isCompleteFiniteReading("bloodPressure", { systolic: 0, diastolic: 0 })).toBe(false);
    for (const metricId of ["heartRate", "sleep", "glucose", "temperature"] as const) expect(isCompleteFiniteReading(metricId, -0.1)).toBe(false);
    expect(isCompleteFiniteReading("mood", 5.2)).toBe(false);
    expect(isCompleteFiniteReading("stress", 0)).toBe(false);
    expect(isCompleteFiniteReading("mood", 1)).toBe(true);
    expect(isCompleteFiniteReading("stress", 5)).toBe(true);
  });

  it("escalates severe symptoms even when values are normal, missing, or unreliable", () => {
    for (const value of [98, null]) {
      expect(evaluateReading({ ...input, value, symptoms: ["trouble-breathing"] }).status).toBe("critical");
    }
    expect(evaluateReading({ ...input, value: null, quality: "invalid", symptoms: ["chest-pain"] }).status).toBe("critical");
  });

  it("does not turn cumulative radiation into an emergency without an environmental event", () => {
    const radiation = { ...input, metricId: "radiation" as const, value: 153.09 };
    expect(evaluateReading(radiation).status).toBe("normal");
    expect(evaluateReading({ ...radiation, environmentalEvent: true }).status).toBe("critical");
    expect(scenarioValue("radiation-event")).toEqual({ metricId: "radiation", value: 153.09 });
  });

  it("does not treat low logged activity alone as critical", () => {
    expect(evaluateReading({ ...input, metricId: "activity", value: 0 }).status).not.toBe("critical");
  });

  it("keeps activity state independent and explains opposite mood/stress scale directions", () => {
    expect(evaluateReading({ ...input, scenarioId: "respiratory-symptoms", activityState: "sleeping" }).status).toBe("critical");
    expect(GUIDANCE_CATALOG.find((guide) => guide.metricId === "mood" && guide.status === "normal")?.whatIsHappening).toMatch(/5 means more positive and 1 means lower mood/i);
    expect(GUIDANCE_CATALOG.find((guide) => guide.metricId === "stress" && guide.status === "normal")?.whatIsHappening).toMatch(/5 means more reported stress and 1 means less/i);
    expect(evaluateReading({ ...input, source: "user" }).status).toBe("unknown");
    expect(evaluateReading({ ...input, scenarioId: "sleep-short", metricId: "sleep" }).status).toBe("warning");
    expect(evaluateReading({ ...input, scenarioId: "respiratory-symptoms", symptoms: [] }).status).toBe("critical");
  });

  it("does not enable synthetic scenarios or environmental events in validated mode", () => {
    const validatedEnvironment = evaluateReading({ ...input, metricId: "radiation", value: 153.09, mode: "validated", environmentalEvent: true, scenarioId: "radiation-event" });
    expect(validatedEnvironment.status).toBe("unknown");
    expect(validatedEnvironment.reasonCode).toBe("VALIDATED_RULESET_NOT_APPROVED");
    expect(validatedEnvironment.ruleId).not.toBe("environmental-event-demo");
    expect(validatedEnvironment.environmentalEvent).toBe(false);
    const validatedSymptoms = evaluateReading({ ...input, mode: "validated", symptoms: ["trouble-breathing"] });
    expect(validatedSymptoms.status).toBe("unknown");
    expect(validatedSymptoms.safetyEscalation).toBe(true);
    expect(validatedSymptoms.ruleId).not.toContain("demo-severe");
  });

  it("preserves a mismatched input unit rather than relabeling it", () => {
    const result = evaluateReading({ ...input, unit: "kPa" });
    expect(result.status).toBe("unknown");
    expect(result.unit).toBe("kPa");
  });

  it("keeps radiation dose-only and activity minutes-only out of critical status even for authored alerts", () => {
    const radiation = evaluateReading({ ...input, metricId: "radiation", value: 153.09, person: { ...person, id: "sofia" } });
    const activity = evaluateReading({ ...input, metricId: "activity", value: 0, person: { ...person, id: "sofia" } });
    expect(radiation.status).not.toBe("critical");
    expect(activity.status).not.toBe("critical");
  });
});
