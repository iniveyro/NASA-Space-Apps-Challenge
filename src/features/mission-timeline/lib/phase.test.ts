import { describe, expect, it } from "vitest";
import type { MissionDay } from "@/features/crew-health-data";
import { blackoutSegments, clampDay, commLabel, dayFromRatio, dayPosition, formatMissionDate, phaseLabel, phaseSegments } from "./phase";

function days(spec: Array<[MissionDay["phase"], number, MissionDay["comm"]?]>): MissionDay[] {
  const result: MissionDay[] = [];
  for (const [phase, count, comm = "link"] of spec) {
    for (let index = 0; index < count; index += 1) {
      result.push({ day: result.length + 1, date: "2026-11-14", phase, comm });
    }
  }
  return result;
}

describe("mission phase helpers", () => {
  it("groups consecutive days into phase segments with inclusive day ranges", () => {
    const timeline = days([["transit_out", 3], ["mars_arrival", 1], ["surface", 4], ["landed", 1]]);
    expect(phaseSegments(timeline)).toEqual([
      { phase: "transit_out", startDay: 1, endDay: 3, count: 3 },
      { phase: "mars_arrival", startDay: 4, endDay: 4, count: 1 },
      { phase: "surface", startDay: 5, endDay: 8, count: 4 },
      { phase: "landed", startDay: 9, endDay: 9, count: 1 },
    ]);
    expect(phaseSegments([])).toEqual([]);
  });

  it("finds communication blackout windows", () => {
    const timeline = days([["surface", 2], ["surface", 3, "blackout"], ["surface", 2], ["surface", 1, "blackout"]]);
    expect(blackoutSegments(timeline)).toEqual([
      { startDay: 3, endDay: 5, count: 3 },
      { startDay: 8, endDay: 8, count: 1 },
    ]);
  });

  it("maps a horizontal ratio on the band to a clamped mission day", () => {
    expect(dayFromRatio(0, 942)).toBe(1);
    expect(dayFromRatio(0.5, 942)).toBe(472);
    expect(dayFromRatio(0.9999, 942)).toBe(942);
    expect(dayFromRatio(1, 942)).toBe(942);
    expect(dayFromRatio(-3, 942)).toBe(1);
    expect(dayFromRatio(7, 942)).toBe(942);
    expect(dayFromRatio(Number.NaN, 942)).toBe(1);
  });

  it("places a day at the centre of its slot and clamps out-of-range days", () => {
    expect(dayPosition(1, 10)).toBe(5);
    expect(dayPosition(10, 10)).toBe(95);
    expect(clampDay(0, 942)).toBe(1);
    expect(clampDay(943, 942)).toBe(942);
    expect(clampDay(12.7, 942)).toBe(13);
  });

  it("labels phases, link state, and dates for display", () => {
    expect(phaseLabel("transit_out")).toBe("Transit out");
    expect(phaseLabel("mars_arrival")).toBe("Mars arrival");
    expect(phaseLabel("surface")).toBe("Mars surface");
    expect(phaseLabel("mars_departure")).toBe("Mars departure");
    expect(phaseLabel("transit_return")).toBe("Transit return");
    expect(phaseLabel("landed")).toBe("Landed");
    expect(commLabel("link")).toBe("Link");
    expect(commLabel("blackout")).toBe("Comm blackout");
    expect(commLabel("unknown")).toBe("Link unknown");
    expect(formatMissionDate("2027-06-12")).toBe("12 Jun 2027");
    expect(formatMissionDate("2029-01-05")).toBe("5 Jan 2029");
    expect(formatMissionDate("not-a-date")).toBe("Unknown date");
  });
});
