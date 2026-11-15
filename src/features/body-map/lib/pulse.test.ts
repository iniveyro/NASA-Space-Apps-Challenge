import { describe, expect, it } from "vitest";
import { beatLevel, beatPeriod, validBpm } from "./pulse";

describe("pulse animation timing", () => {
  it("repeats once per beat at the given rate", () => {
    for (const bpm of [43, 61, 78]) {
      const period = 60 / bpm;
      for (const time of [0.05, 0.2, 0.61]) {
        expect(beatLevel(time + period, bpm)).toBeCloseTo(beatLevel(time, bpm), 6);
        expect(beatLevel(time + 5 * period, bpm)).toBeCloseTo(beatLevel(time, bpm), 6);
      }
    }
    expect(beatPeriod(60)).toBe(1);
    expect(beatPeriod(48)).toBe(1.25);
  });

  it("stays between 0 and 1 with a strong beat and a weaker second one", () => {
    const samples = Array.from({ length: 400 }, (_, index) => beatLevel(index / 400, 60));
    expect(Math.min(...samples)).toBeGreaterThanOrEqual(0);
    expect(Math.max(...samples)).toBeLessThanOrEqual(1);
    expect(Math.max(...samples)).toBeGreaterThan(0.95);
    expect(beatLevel(0.08, 60)).toBeGreaterThan(beatLevel(0.36, 60));
    expect(beatLevel(0.36, 60)).toBeGreaterThan(0.4);
    expect(beatLevel(0.75, 60)).toBeLessThan(0.02);
  });

  it("beats faster for a higher rate", () => {
    expect(beatPeriod(78)!).toBeLessThan(beatPeriod(48)!);
  });

  it("returns a steady zero instead of NaN for missing or invalid rates", () => {
    for (const bpm of [null, undefined, Number.NaN, 0, -60, Infinity, 500]) {
      expect(beatLevel(1.3, bpm)).toBe(0);
      expect(beatPeriod(bpm)).toBeNull();
      expect(validBpm(bpm)).toBe(false);
    }
    expect(beatLevel(Number.NaN, 60)).toBe(0);
  });
});
