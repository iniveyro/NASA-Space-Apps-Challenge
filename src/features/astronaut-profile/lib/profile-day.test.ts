import { describe, expect, it } from "vitest";
import {
  METRICS,
  PROFILES,
  buildMissionDataset,
  type CrewDayReading,
  type CrewEvent,
  type MetricId,
  type MissionDay,
} from "@/features/crew-health-data";
import { crewDataset, dayReadings, daySeries, parseDayParam, readingText } from "./profile-day";

const TOTAL = 220;
const DAYS: MissionDay[] = Array.from({ length: TOTAL }, (_, index) => {
  const date = new Date(Date.UTC(2026, 10, 14 + index));
  return { day: index + 1, date: date.toISOString().slice(0, 10), phase: index < 210 ? "transit_out" : "surface", comm: "link" };
});

function reading(crewId: string, day: number, overrides: Partial<CrewDayReading> = {}): CrewDayReading {
  return {
    day,
    date: DAYS[day - 1].date,
    crewId,
    heartRate: 60 + (day % 7),
    systolic: 110 + (day % 5),
    diastolic: 70 + (day % 3),
    temperature: 36.6,
    sleep: 6.5,
    mood: 4,
    glucose: 80,
    radiation: Number((day * 1.8).toFixed(1)),
    event: null,
    ...overrides,
  };
}

const READINGS: CrewDayReading[] = [
  ...DAYS.map(({ day }) => reading("sofia", day, day === 5 ? { heartRate: null, diastolic: null } : {})),
  ...DAYS.map(({ day }) => reading("kanji", day)),
];

const EVENTS: CrewEvent[] = [
  { day: 120, date: DAYS[119].date, crewId: "kanji", event: "viral_reactivation", detail: "rest HR 48->78" },
  { day: 211, date: DAYS[210].date, crewId: "sofia", event: "orthostatic_test", detail: "standing 94/68 mmHg" },
  { day: 211, date: DAYS[210].date, crewId: "kanji", event: "orthostatic_test", detail: "standing 114/74 mmHg" },
];

const DATA = buildMissionDataset(DAYS, READINGS, EVENTS);
const SOFIA = PROFILES.find((profile) => profile.id === "sofia")!;
const KANJI = PROFILES.find((profile) => profile.id === "kanji")!;
const UNRECORDED: readonly MetricId[] = ["spo2", "activity", "stress"];

describe("parseDayParam", () => {
  it("falls back to the latest day when the parameter is missing or not a number", () => {
    for (const raw of [null, "", "   ", "abc", "12abc", "NaN", "Infinity", "-Infinity"]) {
      expect(parseDayParam(raw, 942)).toBe(942);
    }
  });

  it("returns an integer day clamped to the mission", () => {
    expect(parseDayParam("211", 942)).toBe(211);
    expect(parseDayParam("1", 942)).toBe(1);
    expect(parseDayParam("942", 942)).toBe(942);
    expect(parseDayParam("9999", 942)).toBe(942);
    expect(parseDayParam("0", 942)).toBe(1);
    expect(parseDayParam("-4", 942)).toBe(1);
    expect(parseDayParam("120.6", 942)).toBe(121);
    expect(parseDayParam(" 120 ", 942)).toBe(120);
  });

  it("never returns a day below 1, even for an empty dataset", () => {
    expect(parseDayParam(null, 0)).toBe(1);
    expect(parseDayParam("7", 0)).toBe(1);
  });
});

describe("crewDataset", () => {
  it("keeps the timeline and only the requested crew member's series and events", () => {
    const narrowed = crewDataset(DATA, "sofia");
    expect(narrowed.days).toEqual(DATA.days);
    expect(Object.keys(narrowed.crew)).toEqual(["sofia"]);
    expect(narrowed.crew.sofia).toEqual(DATA.crew.sofia);
    expect(narrowed.events).toEqual([EVENTS[1]]);
    expect(JSON.parse(JSON.stringify(narrowed))).toEqual(narrowed);
  });

  it("returns no series for an unknown crew member", () => {
    const narrowed = crewDataset(DATA, "nobody");
    expect(narrowed.crew).toEqual({});
    expect(narrowed.events).toEqual([]);
    expect(narrowed.days).toHaveLength(TOTAL);
  });
});

describe("dayReadings", () => {
  it("returns one entry per metric, in metric order, with the dataset value of that day", () => {
    const readings = dayReadings(DATA, SOFIA, 10);
    expect(readings.map((entry) => entry.metric.id)).toEqual(METRICS.map((metric) => metric.id));
    const byId = Object.fromEntries(readings.map((entry) => [entry.metric.id, entry]));
    expect(byId.heartRate.value).toBe(63);
    expect(byId.heartRate.formatted).toBe("63");
    expect(byId.bloodPressure.value).toEqual({ systolic: 110, diastolic: 71 });
    expect(byId.bloodPressure.formatted).toBe("110/71");
    expect(byId.temperature.formatted).toBe("36.6");
    expect(byId.sleep.formatted).toBe("6.5");
    expect(byId.radiation.formatted).toBe("18.00");
  });

  it("keeps the fictional baseline context and takes the state from the authored day scenario", () => {
    const sofia = dayReadings(DATA, SOFIA, 211).find((entry) => entry.metric.id === "bloodPressure")!;
    expect(sofia.scenario.status).toBe("demo-alert");
    expect(sofia.scenario.label).toBe("Alert");
    expect(sofia.scenario.baseline).toEqual({ systolic: SOFIA.base.systolic, diastolic: SOFIA.base.diastolic });
    expect(sofia.scenario.baselineLabel).toBe("Fictional preflight value");
    expect(sofia.scenario.reference).toBe(sofia.metric.demoReference);
    expect(sofia.scenario.evidence).toMatch(/authored demo scenario/i);

    const other = dayReadings(DATA, SOFIA, 210).find((entry) => entry.metric.id === "bloodPressure")!;
    expect(other.scenario.status).toBe("within-demo-reference");
    expect(other.scenario.label).toBe("Reference");
  });

  it("follows the day for Kanji's heart rate instead of the fixed profile scenario", () => {
    const heartRate = (day: number) => dayReadings(DATA, KANJI, day).find((entry) => entry.metric.id === "heartRate")!.scenario;
    expect(heartRate(120).status).toBe("demo-alert");
    expect(heartRate(122).status).toBe("demo-alert");
    expect(heartRate(123)).toMatchObject({ status: "within-demo-reference", label: "Reference" });
    expect(heartRate(220)).toMatchObject({ status: "within-demo-reference", label: "Reference" });
  });

  it("reads metrics the dataset does not record as Unknown", () => {
    const readings = dayReadings(DATA, SOFIA, 10).filter((entry) => UNRECORDED.includes(entry.metric.id));
    expect(readings).toHaveLength(3);
    for (const entry of readings) {
      expect(entry.value).toBeNull();
      expect(entry.formatted).toBe("Unknown");
      expect(entry.scenario.status).toBe("unknown");
      expect(entry.scenario.label).toBe("Unknown");
      expect(entry.scenario.baseline).toBeNull();
    }
  });

  it("reads gaps, unknown days, and unknown crew members as Unknown, never NaN or undefined", () => {
    const gap = Object.fromEntries(dayReadings(DATA, SOFIA, 5).map((entry) => [entry.metric.id, entry]));
    expect(gap.heartRate.formatted).toBe("Unknown");
    expect(gap.heartRate.scenario.status).toBe("unknown");
    expect(gap.bloodPressure.value).toBeNull();
    expect(gap.bloodPressure.formatted).toBe("Unknown");
    expect(gap.temperature.formatted).toBe("36.6");

    const malik = PROFILES.find((profile) => profile.id === "malik")!;
    for (const readings of [dayReadings(DATA, SOFIA, 0), dayReadings(DATA, SOFIA, TOTAL + 1), dayReadings(DATA, malik, 10)]) {
      expect(readings).toHaveLength(METRICS.length);
      for (const entry of readings) {
        expect(entry.value).toBeNull();
        expect(entry.formatted).toBe("Unknown");
        expect(entry.scenario.status).toBe("unknown");
        expect(JSON.stringify(entry)).not.toMatch(/NaN|undefined|Infinity/);
      }
    }
  });
});

describe("readingText", () => {
  it("joins a reading with its unit and leaves a missing reading without one", () => {
    const byId = Object.fromEntries(dayReadings(DATA, SOFIA, 10).map((entry) => [entry.metric.id, entry]));
    expect(readingText(byId.heartRate)).toBe("63 bpm");
    expect(readingText(byId.bloodPressure)).toBe("110/71 mmHg");
    expect(readingText(byId.spo2)).toBe("Unknown");
    expect(readingText(byId.stress)).toBe("Unknown");
  });
});

describe("daySeries", () => {
  it("returns the trailing window ending at the selected day with the mission dates", () => {
    const series = daySeries(DATA, "kanji", "heartRate", 30, 7);
    expect(series).toHaveLength(7);
    expect(series.map((point) => point.date)).toEqual(DAYS.slice(23, 30).map((day) => day.date));
    expect(series.map((point) => point.value)).toEqual([24, 25, 26, 27, 28, 29, 30].map((day) => 60 + (day % 7)));
    expect(daySeries(DATA, "kanji", "heartRate", 220, 30)).toHaveLength(30);
    expect(daySeries(DATA, "kanji", "heartRate", 220, 30).at(-1)).toEqual({ date: DAYS[219].date, value: 60 + (220 % 7) });
  });

  it("clips the window at mission day 1", () => {
    const series = daySeries(DATA, "kanji", "sleep", 3, 30);
    expect(series).toEqual(DAYS.slice(0, 3).map((day) => ({ date: day.date, value: 6.5 })));
    expect(daySeries(DATA, "kanji", "sleep", 1, 7)).toEqual([{ date: DAYS[0].date, value: 6.5 }]);
  });

  it("pairs systolic and diastolic for blood pressure", () => {
    const series = daySeries(DATA, "kanji", "bloodPressure", 12, 2);
    expect(series).toEqual([
      { date: DAYS[10].date, value: { systolic: 111, diastolic: 72 } },
      { date: DAYS[11].date, value: { systolic: 112, diastolic: 70 } },
    ]);
  });

  it("drops days without a complete reading instead of emitting nulls", () => {
    const heartRate = daySeries(DATA, "sofia", "heartRate", 7, 7);
    expect(heartRate).toHaveLength(6);
    expect(heartRate.map((point) => point.date)).not.toContain(DAYS[4].date);
    const pressure = daySeries(DATA, "sofia", "bloodPressure", 7, 7);
    expect(pressure).toHaveLength(6);
    expect(pressure.map((point) => point.date)).not.toContain(DAYS[4].date);
    for (const point of [...heartRate, ...pressure]) expect(point.value).not.toBeNull();
  });

  it("is empty for metrics the dataset does not record and for unknown crew or days", () => {
    for (const metricId of UNRECORDED) expect(daySeries(DATA, "sofia", metricId, 30, 30)).toEqual([]);
    expect(daySeries(DATA, "nobody", "heartRate", 30, 7)).toEqual([]);
    expect(daySeries(DATA, "sofia", "heartRate", 0, 7)).toEqual([]);
  });

  it("stops at the last mission day when the selected day is beyond it", () => {
    const series = daySeries(DATA, "kanji", "heartRate", TOTAL + 50, 7);
    expect(series).toHaveLength(7);
    expect(series.at(-1)!.date).toBe(DAYS[TOTAL - 1].date);
  });
});
