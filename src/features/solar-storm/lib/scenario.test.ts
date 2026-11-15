import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { PROFILES, buildMissionDataset, parseCrewDaily, parseCsv, parseEvents, parseTimeline } from "@/features/crew-health-data";
import { buildStormScenario, earthSunSeparationDeg, parseStormDetail, type StormInputs, type Vec3 } from "./scenario";

const csv = (name: string) => readFileSync(path.join(process.cwd(), "data", "processed", name), "utf-8");

function column(text: string, name: string): string[] {
  const [header, ...rows] = parseCsv(text);
  const index = header.indexOf(name);
  return rows.map((cells) => cells[index] ?? "");
}

function inputs(): StormInputs {
  const timeline = csv("mission_timeline.csv");
  const positions = csv("mission_positions.csv");
  const numbers = (text: string, name: string) => column(text, name).map((value) => (value === "" ? null : Number(value)));
  const vectors = (body: string): Vec3[] => {
    const [x, y, z] = ["x", "y", "z"].map((axis) => numbers(positions, `${body}_${axis}_au`));
    return x.map((value, index) => [value ?? 0, y[index] ?? 0, z[index] ?? 0]);
  };
  const distance = numbers(timeline, "dist_earth_mkm");
  return {
    data: buildMissionDataset(parseTimeline(timeline), parseCrewDaily(csv("crew_daily.csv")), parseEvents(csv("crew_events.csv"))),
    profiles: PROFILES,
    dates: column(timeline, "date"),
    comm: column(timeline, "comm"),
    marsSol: numbers(timeline, "mars_sol"),
    distEarthMkm: distance,
    sunAngleDeg: numbers(timeline, "solar_elong_deg"),
    delayMin: distance.map((value) => (value === null ? null : (value * 1e6) / 299792.458 / 60)),
    earth: vectors("earth"),
    mars: vectors("mars"),
  };
}

describe("storm scenario", () => {
  const scenario = buildStormScenario(inputs())!;

  it("places the storm on the plot's day, inside the blackout", () => {
    expect(scenario.day).toBe(493);
    expect(scenario.date).toBe("2028-03-20");
    expect(scenario.dayOfBlackout).toBe(8);
    expect(scenario.blackoutDays).toBe(17);
    expect(scenario.lastContactDay).toBe(485);
    expect(scenario.lastContactDate).toBe("2028-03-12");
    expect(scenario.linkReturnsDay).toBe(503);
    expect(scenario.linkReturnsDate).toBe("2028-03-30");
    expect(scenario.daysUntilLink).toBe(10);
    expect(scenario.delayAtReturnMin! * 60).toBeCloseTo(19 * 60 + 55, 0);
    expect(scenario.distanceEarthMkm).toBeCloseTo(357.07, 2);
  });

  it("reads each person's place and event dose from crew_events.csv", () => {
    const byId = Object.fromEntries(scenario.crew.map((person) => [person.id, person]));
    expect(scenario.crew.map((person) => person.id)).toEqual(["ines", "kanji", "malik", "sofia"]);
    expect(byId.ines).toMatchObject({ place: "walk", eventDoseMsv: 8.1 });
    expect(byId.sofia).toMatchObject({ place: "walk", eventDoseMsv: 8.1 });
    expect(byId.kanji).toMatchObject({ place: "refuge", eventDoseMsv: 4 });
    expect(byId.malik).toMatchObject({ place: "refuge", eventDoseMsv: 4 });
  });

  it("agrees with the cumulative dose in crew_daily.csv: the day's increase covers the event dose", () => {
    for (const person of scenario.crew) {
      expect(person.doseBeforeMsv).not.toBeNull();
      expect(person.doseAfterMsv).not.toBeNull();
      const increase = person.doseAfterMsv! - person.doseBeforeMsv!;
      expect(increase).toBeGreaterThanOrEqual(person.eventDoseMsv!);
      // The rest of the increase is the routine surface dose of one day.
      expect(increase - person.eventDoseMsv!).toBeLessThan(1);
      expect(person.sleepHours!).toBeLessThan(5);
    }
  });

  it("finds Earth a fraction of a degree from the Sun in the Martian sky", () => {
    expect(scenario.sunAngleFromEarthDeg).toBeCloseTo(0.85, 2);
    expect(scenario.earthFromSunDeg!).toBeGreaterThan(0.3);
    expect(scenario.earthFromSunDeg!).toBeLessThan(scenario.sunAngleFromEarthDeg!);
  });

  it("parses event details defensively", () => {
    expect(parseStormDetail("event dose 8.1 mSv (EVA)")).toEqual({ dose: 8.1, place: "walk" });
    expect(parseStormDetail("event dose 4.0 mSv (refuge)")).toEqual({ dose: 4, place: "refuge" });
    expect(parseStormDetail("no figures here")).toEqual({ dose: null, place: null });
    expect(parseStormDetail("")).toEqual({ dose: null, place: null });
  });

  it("returns null instead of a made-up scenario when the dataset has no storm", () => {
    const base = inputs();
    expect(buildStormScenario({ ...base, data: { ...base.data, events: [] } })).toBeNull();
    expect(earthSunSeparationDeg(null, [1, 0, 0])).toBeNull();
    expect(earthSunSeparationDeg([0, 0, 0], [1, 0, 0])).toBeNull();
  });
});
