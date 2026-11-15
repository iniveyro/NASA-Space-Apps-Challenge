import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import * as data from "./crew-data";
import { parseCrewDaily } from "./mission-csv";
import type { BloodPressureReading, MetricScenario } from "./types";

type MutableBase = Record<string, unknown>;

function expectUnknownScenario(scenario: MetricScenario) {
  expect(scenario.status).toBe("unknown");
  expect(scenario.label).toBe("Unknown");
  expect(scenario.baseline).toBeNull();
  expect(scenario.baselineLabel).toBe("Reference unavailable");
  expect(scenario.reference).toMatch(/complete finite fictional reading and reference/i);
  expect(`${scenario.label} ${scenario.baselineLabel} ${scenario.reference} ${scenario.evidence}`).not.toMatch(/\b(?:undefined|NaN|Infinity)\b/);
}

describe("crew health data", () => {
  it("provides four uniquely identified fictional profiles with demographics and independent statuses", () => {
    expect(data.PROFILES).toHaveLength(4);
    expect(new Set(data.PROFILES.map((profile) => profile.id)).size).toBe(4);
    expect(data.PROFILES.every((profile) => profile.age > 0 && profile.weightKg > 0 && profile.sex)).toBe(true);
    expect(data.PROFILES.map((profile) => profile.id)).toEqual(["ines", "kanji", "malik", "sofia"]);
    expect(data.PROFILES[2].activity).toBe("resting");
    expect(data.PROFILES[2].health).toBe("stable");
    expect(data.PROFILES.map((profile) => profile.health)).toEqual(["stable", "monitoring", "stable", "simulated-alert"]);
  });

  it("anchors each profile baseline to its UMBRAL mission day-1 simulated reading", () => {
    const csv = readFileSync(new URL("../../../../data/processed/crew_daily.csv", import.meta.url), "utf-8");
    const dayOne = parseCrewDaily(csv).filter((reading) => reading.day === 1);
    expect(dayOne.map((reading) => reading.crewId)).toEqual(data.PROFILES.map((profile) => profile.id));
    for (const profile of data.PROFILES) {
      const reading = dayOne.find((item) => item.crewId === profile.id)!;
      expect(profile.base).toMatchObject({
        heartRate: reading.heartRate,
        systolic: reading.systolic,
        diastolic: reading.diastolic,
        temperature: reading.temperature,
        sleep: reading.sleep,
        mood: reading.mood,
        glucose: reading.glucose,
        radiation: reading.radiation,
      });
    }
    expect(data.MISSION_END).toBe("2029-06-12");
    expect(data.MISSION_DAY).toBe(942);
  });

  it("provides ten uniquely identified metrics with explicit units and regions", () => {
    expect(data.METRICS).toHaveLength(10);
    expect(new Set(data.METRICS.map((metric) => metric.id)).size).toBe(10);
    const metrics = Object.fromEntries(data.METRICS.map((metric) => [metric.id, metric]));
    expect(metrics.heartRate.unit).toBe("bpm");
    expect(metrics.bloodPressure.unit).toBe("mmHg");
    expect(metrics.temperature.unit).toBe("°C");
    expect(metrics.spo2.unit).toBe("%");
    expect(metrics.glucose.unit).toBe("mg/dL");
    expect(metrics.radiation.unit).toBe("mSv");
    expect(metrics.radiation.region).toBe("body");
    expect(metrics.sleep.region).toBe("brain");
    expect(metrics.sleep.description).toMatch(/self-reported/i);
    expect(metrics.stress.description).toMatch(/Baevsky.*RR intervals/i);
    expect(metrics.stress.unit).toBe("SI");
    expect(metrics.spo2.description).toMatch(/point reading.*not a continuous/i);
    expect(metrics.glucose.description).toMatch(/point reading.*not a continuous/i);
  });

  it("every profile and metric has deterministic 7- and 30-day histories with matching latest values", () => {
    for (const profile of data.PROFILES) {
      for (const metric of data.METRICS) {
        const history = data.getSeries(profile.id, metric.id, 30);
        const shortHistory = data.getSeries(profile.id, metric.id, 7);
        expect(history).toHaveLength(30);
        expect(shortHistory).toHaveLength(7);
        expect(data.getSeries(profile.id, metric.id, 30)).toEqual(history);
        expect(shortHistory).toEqual(history.slice(-7));
        expect(history.at(-1)!.date).toBe(data.MISSION_END);
        expect(history.at(-1)!.value).toEqual(data.latest(profile.id, metric.id));
      }
    }
  });

  it("blood pressure retains separate paired systolic and diastolic readings", () => {
    for (const profile of data.PROFILES) {
      const readings = data.getSeries(profile.id, "bloodPressure", 30).map(({ value }) => value as BloodPressureReading);
      expect(readings.every((value) => Number.isInteger(value.systolic) && Number.isInteger(value.diastolic))).toBe(true);
      expect(readings.every((value) => value.systolic > value.diastolic)).toBe(true);
      expect(data.formatValue("bloodPressure", readings.at(-1))).toBe(`${profile.base.systolic}/${profile.base.diastolic}`);
    }
  });

  it("cumulative radiation stays nonnegative, monotonically increasing, and formatted as dose", () => {
    for (const profile of data.PROFILES) {
      const readings = data.getSeries(profile.id, "radiation", 30).map(({ value }) => value as number);
      expect(readings.every((value) => value >= 0)).toBe(true);
      expect(readings.every((value, index) => index === 0 || value >= readings[index - 1])).toBe(true);
      expect(readings.some((value, index) => index > 0 && value > readings[index - 1])).toBe(true);
      expect(data.formatValue("radiation", readings.at(-1))).toMatch(/^\d+\.\d{2}$/);
    }
  });

  it("categorical self-reports stay on their declared five-point scale", () => {
    for (const profile of data.PROFILES) {
      for (const metricId of ["mood"]) {
        const values = data.getSeries(profile.id, metricId, 30).map(({ value }) => value as number);
        expect(values.every((value) => Number.isInteger(value) && value >= 1 && value <= 5)).toBe(true);
      }
    }
  });

  it("unknown metric identifiers fail rather than returning an empty history", () => {
    expect(() => data.getSeries("ines", "unknown", 30)).toThrow(/Unknown metric/);
  });

  it("every fictional profile has explicit demo reference scenarios for all ten metrics", () => {
    const states: string[] = [];
    for (const profile of data.PROFILES) {
      for (const metric of data.METRICS) {
        const scenario = data.resolveMetricScenario(profile.id, metric.id, data.latest(profile.id, metric.id));
        expect(["within-demo-reference", "demo-deviation", "demo-alert"], `${profile.id}/${metric.id}`).toContain(scenario.status);
        expect(scenario.label && scenario.reference && scenario.evidence.includes("not calculated")).toBeTruthy();
        expect(scenario.baseline, `${profile.id}/${metric.id} must show its fictional baseline context`).not.toBeNull();
        states.push(scenario.status);
      }
    }
    expect(states.filter((status) => status === "within-demo-reference").length).toBeGreaterThanOrEqual(38);
    expect(data.resolveMetricScenario("sofia", "bloodPressure", data.latest("sofia", "bloodPressure")).status).toBe("demo-alert");
    expect(data.resolveMetricScenario("kanji", "heartRate", data.latest("kanji", "heartRate")).status).toBe("demo-deviation");
    expect(data.METRICS.find((metric) => metric.id === "radiation")!.demoReference).toMatch(/not a personal-physiology baseline or a universal safe limit/i);
  });

  it("scenario resolution is metadata-driven, non-mutating, and unknown when required context is missing", () => {
    const before = JSON.stringify(data.PROFILES);
    expect(data.resolveMetricScenario("kanji", "heartRate", 1).status).toBe("demo-deviation");
    expect(data.resolveMetricScenario("kanji", "heartRate", null).status).toBe("unknown");
    expect(data.resolveMetricScenario("missing-profile", "heartRate", 72).status).toBe("unknown");
    expect(data.resolveMetricScenario("kanji", "missing-metric", 72).status).toBe("unknown");
    expect(JSON.stringify(data.PROFILES)).toBe(before);
    expect(data.ENVIRONMENT).toBe("Microgravity");
    expect(data.METRICS.find((metric) => metric.id === "sleep")!.demoReference).toMatch(/self-reported/i);
    expect(data.METRICS.find((metric) => metric.id === "stress")!.demoReference).toMatch(/not a clinical assessment/i);
  });

  it("incomplete or non-finite paired readings and baselines resolve to explicit unknown", () => {
    const profile = data.PROFILES.find((item) => item.id === "sofia")!;
    const base = profile.base as unknown as MutableBase;
    const complete = { systolic: 116, diastolic: 74 };
    const malformedReadings = [
      { systolic: 118 },
      { diastolic: 76 },
      { systolic: 118, diastolic: null },
      { systolic: Infinity, diastolic: 76 },
      { systolic: 118, diastolic: NaN },
    ];
    for (const reading of malformedReadings) {
      expectUnknownScenario(data.resolveMetricScenario(profile.id, "bloodPressure", reading));
      expect(data.formatValue("bloodPressure", reading)).toBe("Unknown");
    }
    expect(data.resolveMetricScenario(profile.id, "bloodPressure", complete).status).toBe("demo-alert");

    const original = base.diastolic;
    try {
      delete base.diastolic;
      expectUnknownScenario(data.resolveMetricScenario(profile.id, "bloodPressure", complete));
      for (const baseline of [null, NaN, Infinity, -Infinity]) {
        base.diastolic = baseline;
        expectUnknownScenario(data.resolveMetricScenario(profile.id, "bloodPressure", complete));
      }
    } finally {
      base.diastolic = original;
    }
  });

  it("non-finite scalar readings and baselines resolve to unknown without changing fixtures", () => {
    const profile = data.PROFILES.find((item) => item.id === "kanji")!;
    const base = profile.base as unknown as MutableBase;
    const original = base.heartRate;
    const before = JSON.stringify(data.PROFILES);
    try {
      for (const reading of [null, undefined, NaN, Infinity, -Infinity]) {
        expectUnknownScenario(data.resolveMetricScenario(profile.id, "heartRate", reading));
        expect(data.formatValue("heartRate", reading)).toBe("Unknown");
      }
      for (const baseline of [null, NaN, Infinity, -Infinity]) {
        base.heartRate = baseline;
        expectUnknownScenario(data.resolveMetricScenario(profile.id, "heartRate", 48));
      }
    } finally {
      base.heartRate = original;
    }
    expect(JSON.stringify(data.PROFILES)).toBe(before);
    expect(data.resolveMetricScenario(profile.id, "heartRate", data.latest(profile.id, "heartRate")).status).toBe("demo-deviation");
  });
});
