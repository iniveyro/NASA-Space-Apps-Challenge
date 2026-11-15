import { describe, expect, it } from "vitest";
import { MIN_BEATS, baevskyStressIndex, parseRrIntervals } from "./stress-index";

const repeat = (value: number, count: number) => Array<number>(count).fill(value);

describe("baevskyStressIndex", () => {
  it("applies SI = AMo / (2 · Mo · MxDMn) on 50 ms bins", () => {
    // Bin 800–849 ms holds 15 of 20 beats: Mo = 0.825 s, AMo = 75 %, MxDMn = 0.900 − 0.800 = 0.1 s.
    const rr = [...repeat(800, 10), ...repeat(820, 5), ...repeat(900, 5)];
    expect(baevskyStressIndex(rr)).toBeCloseTo(75 / (2 * 0.825 * 0.1), 6);
  });

  it("uses the shortest modal bin when two bins tie", () => {
    // Bins 700–749 and 750–799 hold 10 beats each: Mo = 0.725 s, AMo = 50 %, MxDMn = 0.05 s.
    const rr = [...repeat(700, 10), ...repeat(750, 10)];
    expect(baevskyStressIndex(rr)).toBeCloseTo(50 / (2 * 0.725 * 0.05), 6);
  });

  it("does not depend on beat order", () => {
    const rr = [910, 1005, 980, 1040, 955, 1010, 990, 1075, 965, 1000, 1020, 940, 985, 1060, 995, 1015, 970, 1030, 1001, 950];
    expect(baevskyStressIndex([...rr].reverse())).toBe(baevskyStressIndex(rr));
  });

  it("requires at least 20 beats", () => {
    expect(MIN_BEATS).toBe(20);
    const rr = [...repeat(800, 10), ...repeat(900, 9)];
    expect(baevskyStressIndex(rr)).toBeNull();
    expect(baevskyStressIndex([...rr, 850])).not.toBeNull();
  });

  it("is unknown when every beat has the same interval (MxDMn = 0)", () => {
    expect(baevskyStressIndex(repeat(800, 25))).toBeNull();
  });

  it("is unknown when any interval is not a finite positive number", () => {
    const rr = [...repeat(800, 10), ...repeat(900, 10)];
    expect(baevskyStressIndex([...rr, Number.NaN])).toBeNull();
    expect(baevskyStressIndex([...rr, 0])).toBeNull();
    expect(baevskyStressIndex([...rr, -800])).toBeNull();
  });
});

describe("parseRrIntervals", () => {
  it("reads space-separated milliseconds", () => {
    expect(parseRrIntervals("812 790  845")).toEqual([812, 790, 845]);
  });

  it("returns no beats for an empty or missing cell", () => {
    expect(parseRrIntervals("")).toEqual([]);
    expect(parseRrIntervals(undefined)).toEqual([]);
  });

  it("drops the whole window when a token is not a number", () => {
    expect(parseRrIntervals("812 abc 845")).toEqual([]);
  });
});
