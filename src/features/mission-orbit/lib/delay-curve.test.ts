import { describe, expect, it } from "vitest";
import { buildDelayCurve, curveX, curveY } from "./delay-curve";

describe("delay curve", () => {
  it("maps the first and last day to the two edges", () => {
    expect(curveX(1, 942, 300)).toBe(0);
    expect(curveX(942, 942, 300)).toBe(300);
    expect(curveX(471.5, 942, 300)).toBeCloseTo(150, 5);
  });

  it("clamps days outside the mission and never returns NaN", () => {
    expect(curveX(0, 942, 300)).toBe(0);
    expect(curveX(5000, 942, 300)).toBe(300);
    expect(curveX(Number.NaN, 942, 300)).toBe(0);
    expect(curveX(1, 1, 300)).toBe(0);
  });

  it("puts zero delay on the baseline and the maximum at the top", () => {
    expect(curveY(0, 20, 56)).toBe(56);
    expect(curveY(20, 20, 56)).toBe(0);
    expect(curveY(10, 20, 56)).toBe(28);
    expect(curveY(null, 20, 56)).toBe(56);
    expect(curveY(5, 0, 56)).toBe(56);
  });

  it("builds a line through every known day and reports the maximum", () => {
    const curve = buildDelayCurve([0, 10, 20], 100, 50);
    expect(curve.maxMin).toBe(20);
    expect(curve.line).toBe("M0.0 50.0L50.0 25.0L100.0 0.0");
    expect(curve.area).toBe("M0.0 50.0L50.0 25.0L100.0 0.0L100.0 50L0.0 50Z");
  });

  it("breaks the line at unknown days instead of drawing them as zero", () => {
    const curve = buildDelayCurve([4, null, 8], 100, 50);
    expect(curve.line).toBe("M0.0 25.0M100.0 0.0");
    expect(curve.line).not.toContain("NaN");
    expect(curve.area.match(/Z/g)).toHaveLength(2);
  });

  it("returns empty paths for an empty series", () => {
    expect(buildDelayCurve([], 100, 50)).toEqual({ line: "", area: "", maxMin: 0 });
  });
});
