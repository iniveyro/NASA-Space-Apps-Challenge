import { describe, expect, it } from "vitest";
import { getMetric, getSeries } from "@/features/crew-health-data";
import { CHART, PLOT_WIDTH, buildScales, nearestIndex, pointTooltip } from "./chart-geometry";

describe("trend chart geometry", () => {
  it("uses a fixed 1–5 domain for categorical self-reports", () => {
    const mood = getMetric("mood")!;
    const { y, ticks } = buildScales(mood, getSeries("mira-chen", "mood", 30));
    expect(ticks).toEqual([5, 4, 3, 2, 1]);
    expect(y(5)).toBe(CHART.top);
  });

  it("maps pointer positions to the nearest data index, clamped to the series", () => {
    const rect = { left: 0, width: CHART.width };
    expect(nearestIndex(CHART.left, rect, 30)).toBe(0);
    expect(nearestIndex(CHART.left + PLOT_WIDTH, rect, 30)).toBe(29);
    expect(nearestIndex(-500, rect, 30)).toBe(0);
    expect(nearestIndex(5000, rect, 7)).toBe(6);
  });

  it("describes paired blood pressure with both values", () => {
    const bp = getMetric("bloodPressure")!;
    const point = getSeries("mira-chen", "bloodPressure", 7).at(-1)!;
    expect(pointTooltip(bp, point)).toBe("Jun 18 · Systolic: 118 mmHg · Diastolic: 76 mmHg");
  });

  it("uses 'of 5' units for self-reported scales", () => {
    const stress = getMetric("stress")!;
    const point = getSeries("noah-williams", "stress", 7).at(-1)!;
    expect(pointTooltip(stress, point)).toBe("Jun 18 · Stress: 1 of 5");
  });
});
