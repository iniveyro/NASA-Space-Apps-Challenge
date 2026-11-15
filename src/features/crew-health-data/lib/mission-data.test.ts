import { describe, expect, it } from "vitest";
import { buildMissionDataset, eventLabel, eventsOn, metricReading, readingFor, seriesWindow } from "./mission-data";
import { resolveDayScenario } from "./day-scenarios";
import type { CrewDayReading, CrewEvent, MissionDay } from "./types";

const DAYS: MissionDay[] = Array.from({ length: 10 }, (_, index) => ({
  day: index + 1,
  date: `2026-11-${String(14 + index).padStart(2, "0")}`,
  phase: index < 5 ? "transit_out" : "surface",
  comm: index === 7 ? "blackout" : "link",
}));

function reading(crewId: string, day: number, overrides: Partial<CrewDayReading> = {}): CrewDayReading {
  return {
    day,
    date: DAYS[day - 1].date,
    crewId,
    heartRate: 60 + day,
    systolic: 110 + day,
    diastolic: 70,
    temperature: 36.6,
    sleep: 6.5,
    mood: 4,
    glucose: 80,
    activity: 30,
    spo2: 97,
    stress: 120,
    radiation: day * 1.8,
    event: null,
    ...overrides,
  };
}

const READINGS = [
  ...DAYS.map((day) => reading("ines", day.day, day.day === 4 ? { event: "solar_storm" } : {})),
  ...DAYS.filter((day) => day.day !== 6).map((day) => reading("kanji", day.day, day.day === 3 ? { heartRate: null } : {})),
];

const EVENTS: CrewEvent[] = [
  { day: 4, date: DAYS[3].date, crewId: "ines", event: "solar_storm", detail: "event dose 8.1 mSv (EVA)" },
  { day: 4, date: DAYS[3].date, crewId: "kanji", event: "solar_storm", detail: "event dose 4.0 mSv (refuge)" },
];

describe("mission dataset", () => {
  const data = buildMissionDataset(DAYS, READINGS, EVENTS);

  it("stores compact per-crew arrays indexed by mission day", () => {
    expect(data.days).toHaveLength(10);
    expect(Object.keys(data.crew).sort()).toEqual(["ines", "kanji"]);
    expect(data.crew.ines.heartRate).toHaveLength(10);
    expect(data.crew.ines.heartRate[0]).toBe(61);
    expect(data.crew.ines.event[3]).toBe("solar_storm");
    expect(JSON.parse(JSON.stringify(data))).toEqual(data);
  });

  it("reads one crew member's values for a selected day and keeps gaps as null", () => {
    expect(readingFor(data, "ines", 2)).toMatchObject({ day: 2, crewId: "ines", heartRate: 62, systolic: 112, radiation: 3.6 });
    const missing = readingFor(data, "kanji", 6)!;
    expect(missing.heartRate).toBeNull();
    expect(missing.radiation).toBeNull();
    expect(readingFor(data, "kanji", 3)!.heartRate).toBeNull();
    expect(readingFor(data, "ines", 0)).toBeNull();
    expect(readingFor(data, "ines", 11)).toBeNull();
    expect(readingFor(data, "nobody", 2)).toBeNull();
  });

  it("maps a day reading to dashboard metrics and keeps missing values null", () => {
    const day2 = readingFor(data, "ines", 2);
    expect(metricReading(day2, "heartRate")).toBe(62);
    expect(metricReading(day2, "bloodPressure")).toEqual({ systolic: 112, diastolic: 70 });
    expect(metricReading(day2, "radiation")).toBe(3.6);
    expect(metricReading(day2, "spo2")).toBe(97);
    expect(metricReading(day2, "activity")).toBe(30);
    expect(metricReading({ ...day2!, activity: 0 }, "activity")).toBe(0);
    expect(metricReading(day2, "stress")).toBe(120);
    expect(metricReading({ ...day2!, stress: null }, "stress")).toBeNull();
    expect(metricReading({ ...day2!, diastolic: null }, "bloodPressure")).toBeNull();
    expect(metricReading(null, "heartRate")).toBeNull();
  });

  it("returns the trailing window ending at the selected day, clipped at mission start", () => {
    expect(seriesWindow(data, "ines", "heartRate", 9, 7)).toEqual([63, 64, 65, 66, 67, 68, 69]);
    expect(seriesWindow(data, "ines", "heartRate", 2, 7)).toEqual([61, 62]);
    expect(seriesWindow(data, "kanji", "heartRate", 4, 3)).toEqual([62, null, 64]);
  });

  it("lists events of a day, optionally for one crew member", () => {
    expect(eventsOn(data, 4)).toHaveLength(2);
    expect(eventsOn(data, 4, "kanji")).toEqual([EVENTS[1]]);
    expect(eventsOn(data, 5)).toEqual([]);
    expect(eventLabel("orthostatic_test")).toBe("Orthostatic test");
    expect(eventLabel("viral_reactivation")).toBe("Viral reactivation");
    expect(eventLabel("solar_storm")).toBe("Solar storm");
    expect(eventLabel("spo2_alert")).toBe("SpO₂ alert");
  });
});

describe("authored day scenarios", () => {
  it("marks Kanji's heart rate as a demo alert on days 120 to 122 only", () => {
    for (const day of [120, 121, 122]) expect(resolveDayScenario("kanji", "heartRate", day, 78).status).toBe("demo-alert");
    expect(resolveDayScenario("kanji", "heartRate", 119, 48).status).toBe("within-demo-reference");
    expect(resolveDayScenario("kanji", "heartRate", 123, 48).status).toBe("within-demo-reference");
    expect(resolveDayScenario("ines", "heartRate", 120, 60).status).toBe("within-demo-reference");
  });

  it("marks Sofia's blood pressure as a demo alert on day 211", () => {
    const scenario = resolveDayScenario("sofia", "bloodPressure", 211, { systolic: 116, diastolic: 74 });
    expect(scenario).toEqual({ status: "demo-alert", label: "Alert" });
    expect(resolveDayScenario("malik", "bloodPressure", 211, { systolic: 120, diastolic: 78 }).status).toBe("within-demo-reference");
  });

  it("marks every crew member's cumulative radiation as a demo deviation on day 493", () => {
    for (const crewId of ["ines", "kanji", "malik", "sofia"]) {
      expect(resolveDayScenario(crewId, "radiation", 493, 571.6)).toEqual({ status: "demo-deviation", label: "Deviation" });
      expect(resolveDayScenario(crewId, "radiation", 494, 572.2).status).toBe("within-demo-reference");
    }
  });

  it("marks Inés's SpO₂ as a demo alert on day 518 only", () => {
    expect(resolveDayScenario("ines", "spo2", 518, 89)).toEqual({ status: "demo-alert", label: "Alert" });
    expect(resolveDayScenario("ines", "spo2", 519, 97).status).toBe("within-demo-reference");
    expect(resolveDayScenario("sofia", "spo2", 518, 98).status).toBe("within-demo-reference");
  });

  it("is independent of the reading value and unknown when the reading is missing", () => {
    expect(resolveDayScenario("kanji", "heartRate", 120, 1).status).toBe("demo-alert");
    expect(resolveDayScenario("kanji", "heartRate", 120, null)).toEqual({ status: "unknown", label: "Unknown" });
    expect(resolveDayScenario("kanji", "heartRate", 5, Number.NaN).status).toBe("unknown");
    expect(resolveDayScenario("sofia", "bloodPressure", 211, { systolic: 116, diastolic: Number.NaN }).status).toBe("unknown");
    expect(resolveDayScenario("sofia", "spo2", 10, null).status).toBe("unknown");
  });
});
