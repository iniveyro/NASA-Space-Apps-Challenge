import { describe, expect, it } from "vitest";
import { ALARM_AT, ARRIVE_AT, STORM_PHASES, clampProgress, doseFraction, doseSoFar, phaseAt, stormIntensity, walkRemaining } from "./timeline";

const samples = Array.from({ length: 501 }, (_, index) => index / 500);

describe("storm scene timeline", () => {
  it("plays the three phases of the plot in order", () => {
    expect(STORM_PHASES.map((phase) => phase.id)).toEqual(["walk", "return", "refuge"]);
    expect(phaseAt(0)).toBe("walk");
    expect(phaseAt(ALARM_AT - 0.001)).toBe("walk");
    expect(phaseAt(ALARM_AT)).toBe("return");
    expect(phaseAt(ARRIVE_AT - 0.001)).toBe("return");
    expect(phaseAt(ARRIVE_AT)).toBe("refuge");
    expect(phaseAt(1)).toBe("refuge");
  });

  it("clamps progress and never yields NaN", () => {
    expect(clampProgress(-3)).toBe(0);
    expect(clampProgress(7)).toBe(1);
    expect(clampProgress(Number.NaN)).toBe(0);
    for (const value of [Number.NaN, -1, 2, Infinity]) {
      expect(Number.isFinite(walkRemaining(value))).toBe(true);
      expect(Number.isFinite(stormIntensity(value))).toBe(true);
      expect(Number.isFinite(doseFraction(value))).toBe(true);
    }
  });

  it("keeps the walkers at the far point until the alarm and brings them home without going back", () => {
    expect(walkRemaining(0)).toBe(1);
    expect(walkRemaining(ALARM_AT)).toBe(1);
    expect(walkRemaining(ARRIVE_AT)).toBe(0);
    expect(walkRemaining(1)).toBe(0);
    for (let index = 1; index < samples.length; index += 1) {
      expect(walkRemaining(samples[index])).toBeLessThanOrEqual(walkRemaining(samples[index - 1]) + 1e-12);
    }
  });

  it("is quiet before the sensor rises and stays between 0 and 1", () => {
    expect(stormIntensity(0)).toBe(0);
    expect(stormIntensity(ALARM_AT - 0.05)).toBe(0);
    expect(stormIntensity(ALARM_AT)).toBeGreaterThan(0);
    for (const value of samples) {
      expect(stormIntensity(value)).toBeGreaterThanOrEqual(0);
      expect(stormIntensity(value)).toBeLessThanOrEqual(1);
    }
    expect(Math.max(...samples.map(stormIntensity))).toBeGreaterThan(0.9);
  });

  it("accumulates the event dose without ever decreasing and ends exactly on the dataset total", () => {
    expect(doseFraction(0)).toBe(0);
    expect(doseFraction(1)).toBe(1);
    for (let index = 1; index < samples.length; index += 1) {
      expect(doseFraction(samples[index])).toBeGreaterThanOrEqual(doseFraction(samples[index - 1]));
    }
    expect(doseSoFar(8.1, 1)).toBe(8.1);
    expect(doseSoFar(4, 1)).toBe(4);
    expect(doseSoFar(8.1, 0)).toBe(0);
    expect(doseSoFar(8.1, 0.5)!).toBeGreaterThan(0);
    expect(doseSoFar(8.1, 0.5)!).toBeLessThan(8.1);
  });

  it("keeps a missing event dose unknown instead of inventing a value", () => {
    expect(doseSoFar(null, 0.7)).toBeNull();
    expect(doseSoFar(Number.NaN, 0.7)).toBeNull();
  });
});
