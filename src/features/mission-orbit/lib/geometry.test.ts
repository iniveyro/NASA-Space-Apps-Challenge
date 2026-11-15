import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  AU_MKM,
  SOLAR_EXCLUSION_DEG,
  blackoutSpans,
  clampDay,
  delayMinutes,
  delaySeries,
  distanceAu,
  farthestDay,
  firstDay,
  linkOutlook,
  parseMissionGeometry,
  phaseDay,
  positionAt,
  sunEarthShipAngle,
} from "./geometry";

const csv = (name: string) => readFileSync(path.join(process.cwd(), "data", "processed", name), "utf-8");
const GEOMETRY = parseMissionGeometry(csv("mission_timeline.csv"), csv("mission_positions.csv"));

describe("parseMissionGeometry", () => {
  it("builds one entry per mission day from the real dataset", () => {
    expect(GEOMETRY.total).toBe(942);
    for (const key of ["date", "phase", "comm", "earth", "mars", "ship", "distEarthMkm", "delayMin", "sunAngleDeg", "marsLsDeg"] as const) {
      expect(GEOMETRY[key]).toHaveLength(942);
    }
    expect(GEOMETRY.date[0]).toBe("2026-11-14");
    expect(GEOMETRY.date[941]).toBe("2029-06-12");
    expect(GEOMETRY.earth.every((vector) => vector !== null && vector.every(Number.isFinite))).toBe(true);
  });

  it("keeps the 3D positions consistent with the timeline distances for every day", () => {
    for (let index = 0; index < GEOMETRY.total; index += 1) {
      const earth = GEOMETRY.earth[index]!;
      const mars = GEOMETRY.mars[index]!;
      const ship = GEOMETRY.ship[index]!;
      expect(Math.abs(distanceAu(ship, earth) * AU_MKM - GEOMETRY.distEarthMkm[index]!)).toBeLessThan(0.01);
      expect(Math.abs(distanceAu(ship, mars) * AU_MKM - GEOMETRY.distMarsMkm[index]!)).toBeLessThan(0.01);
    }
  });

  it("puts every blackout day inside the solar exclusion angle, and no linked day on Mars inside it", () => {
    for (let index = 0; index < GEOMETRY.total; index += 1) {
      const angle = sunEarthShipAngle(GEOMETRY.earth[index]!, GEOMETRY.ship[index]!);
      if (GEOMETRY.comm[index] === "blackout") {
        expect(angle).not.toBeNull();
        expect(angle!).toBeLessThan(SOLAR_EXCLUSION_DEG);
        expect(Math.abs(angle! - GEOMETRY.sunAngleDeg[index]!)).toBeLessThan(0.02);
      } else if (GEOMETRY.phase[index] === "surface") {
        expect(angle!).toBeGreaterThanOrEqual(SOLAR_EXCLUSION_DEG);
      }
    }
  });

  it("turns missing or non-finite cells into null and tolerates missing position rows", () => {
    const timeline = "day,date,phase,dist_earth_mkm,dist_mars_mkm,delay_oneway_min,solar_elong_deg,comm,mars_sol,mars_Ls_deg\n1,2026-11-14,transit_out,abc,,NaN,180,link,,21.6\n2,2026-11-15,holiday,0.32,196.56,0.02,103.77,static,,22\n";
    const positions = "day,date,earth_x_au,earth_y_au,earth_z_au,mars_x_au,mars_y_au,mars_z_au,ship_x_au,ship_y_au,ship_z_au\n1,2026-11-14,0.6,0.7,0,-0.4,1.5,,0.6,0.7,Infinity\n";
    const parsed = parseMissionGeometry(timeline, positions);
    expect(parsed.total).toBe(2);
    expect(parsed.distEarthMkm).toEqual([null, 0.32]);
    expect(parsed.delayMin).toEqual([null, 0.02]);
    expect(parsed.phase).toEqual(["transit_out", null]);
    expect(parsed.comm).toEqual(["link", "unknown"]);
    expect(parsed.earth).toEqual([[0.6, 0.7, 0], null]);
    expect(parsed.mars).toEqual([null, null]);
    expect(parsed.ship).toEqual([null, null]);
    expect(JSON.stringify(parsed)).not.toMatch(/NaN|undefined|Infinity/);
  });

  it("rejects a timeline with a gap, which would shift every day index", () => {
    expect(() => parseMissionGeometry("day,date,phase,comm\n1,2026-11-14,transit_out,link\n3,2026-11-16,transit_out,link\n", "day\n")).toThrow(/contiguous/);
  });
});

describe("day helpers", () => {
  it("clamps days and interpolates positions between daily samples", () => {
    expect(clampDay(0, 942)).toBe(1);
    expect(clampDay(2000, 942)).toBe(942);
    expect(clampDay(Number.NaN, 942)).toBe(1);
    const track = [[0, 0, 0], [2, 4, 6], null] as const;
    expect(positionAt(track, 1)).toEqual([0, 0, 0]);
    expect(positionAt(track, 1.5)).toEqual([1, 2, 3]);
    expect(positionAt(track, 2.5)).toBeNull();
    expect(positionAt(track, Number.NaN)).toBeNull();
    expect(positionAt(GEOMETRY.ship, 942)).toEqual(GEOMETRY.ship[941]);
    expect(positionAt(GEOMETRY.ship, 5000)).toEqual(GEOMETRY.ship[941]);
  });

  it("finds the conjunction blackout of 13–29 Mar 2028", () => {
    const spans = blackoutSpans(GEOMETRY.comm);
    expect(spans).toEqual([{ startDay: 486, endDay: 502, count: 17 }]);
    expect(GEOMETRY.date[485]).toBe("2028-03-13");
    expect(GEOMETRY.date[501]).toBe("2028-03-29");
  });

  it("describes the link before, during and after the blackout", () => {
    expect(linkOutlook(GEOMETRY, 480)).toEqual({ state: "link", nextBlackout: { startDay: 486, endDay: 502, count: 17 }, daysToBlackout: 6 });
    expect(linkOutlook(GEOMETRY, 493)).toEqual({
      state: "blackout",
      span: { startDay: 486, endDay: 502, count: 17 },
      dayOfBlackout: 8,
      linkReturnsDay: 503,
      daysUntilLink: 10,
    });
    expect(linkOutlook(GEOMETRY, 503)).toEqual({ state: "link", nextBlackout: null, daysToBlackout: null });
    expect(linkOutlook(GEOMETRY, 5000)).toEqual({ state: "unknown" });
  });

  it("locates thresholds, maxima and phase days in the dataset", () => {
    const delays = delaySeries(GEOMETRY);
    expect(firstDay(delays, 1, 942, (value) => value >= 1)).toBe(55);
    expect(firstDay(delays, 1, 10, (value) => value >= 15)).toBeNull();
    expect(farthestDay(GEOMETRY)).toBe(546);
    expect(GEOMETRY.delayMin[545]).toBe(20.06);
    expect(GEOMETRY.date[545]).toBe("2028-05-12");
    expect(farthestDay(parseMissionGeometry("day\n", "day\n"))).toBeNull();
    expect(phaseDay(GEOMETRY, "mars_arrival")).toBe(211);
    expect(phaseDay(GEOMETRY, "mars_departure")).toBe(732);
    expect(phaseDay(GEOMETRY, "landed")).toBe(942);
  });

  it("derives the signal time from the Earth distance and stays within rounding of the delay column", () => {
    for (let day = 1; day <= GEOMETRY.total; day += 1) {
      expect(Math.abs(delayMinutes(GEOMETRY, day)! - GEOMETRY.delayMin[day - 1]!)).toBeLessThan(0.006);
    }
    expect(delayMinutes(GEOMETRY, 0)).toBeNull();
    expect(delayMinutes(GEOMETRY, 943)).toBeNull();
    const rounded = parseMissionGeometry("day,date,phase,comm,delay_oneway_min\n1,2026-11-14,transit_out,link,3.5\n", "day\n");
    expect(delayMinutes(rounded, 1)).toBe(3.5);
  });

  it("returns no solar angle when the spacecraft is at Earth", () => {
    expect(sunEarthShipAngle([1, 0, 0], [1, 0, 0])).toBeNull();
    expect(sunEarthShipAngle([1, 0, 0], [-1, 0, 0])).toBeCloseTo(0, 6);
    expect(sunEarthShipAngle([1, 0, 0], [2, 0, 0])).toBeCloseTo(180, 6);
  });
});
