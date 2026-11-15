import { describe, expect, it } from "vitest";
import { getMetric, getSeries } from "@/features/crew-health-data";
import { CHART, PLOT_WIDTH, buildScales, nearestIndex, plottablePoints, pointTooltip } from "./chart-geometry";

describe("trend chart geometry", () => {
  it("uses a fixed 1–5 domain for categorical self-reports", () => {
    const mood = getMetric("mood")!;
    const { y, ticks } = buildScales(mood, getSeries("ines", "mood", 30));
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
    const point = getSeries("ines", "bloodPressure", 7).at(-1)!;
    expect(pointTooltip(bp, point)).toBe("Jun 12 · Systolic: 122 mmHg · Diastolic: 68 mmHg");
  });

  it("uses 'of 5' units for self-reported scales", () => {
    const stress = getMetric("stress")!;
    const point = getSeries("malik", "stress", 7).at(-1)!;
    expect(pointTooltip(stress, point)).toBe("Jun 12 · Stress: 1 of 5");
  });

  it("keeps only complete finite readings from an external series", () => {
    const heartRate = getMetric("heartRate")!;
    const bp = getMetric("bloodPressure")!;
    expect(
      plottablePoints(heartRate, [
        { date: "2027-06-10", value: 61 },
        { date: "2027-06-11", value: null },
        { date: "2027-06-12", value: Number.NaN },
        { date: "2027-06-13", value: { systolic: 120, diastolic: 70 } },
        { date: "2027-06-14", value: 63 },
      ]),
    ).toEqual([
      { date: "2027-06-10", value: 61 },
      { date: "2027-06-14", value: 63 },
    ]);
    expect(
      plottablePoints(bp, [
        { date: "2027-06-10", value: { systolic: 120, diastolic: 70 } },
        { date: "2027-06-11", value: { systolic: 120, diastolic: Number.NaN } },
        { date: "2027-06-12", value: 118 },
        { date: "2027-06-13", value: null },
      ]),
    ).toEqual([{ date: "2027-06-10", value: { systolic: 120, diastolic: 70 } }]);
    expect(plottablePoints(heartRate, [])).toEqual([]);
  });

  it("scales a single-point series without non-finite coordinates", () => {
    const heartRate = getMetric("heartRate")!;
    const { x, y, ticks } = buildScales(heartRate, [{ date: "2026-11-14", value: 61 }]);
    expect(x(0)).toBe(CHART.left);
    expect(Number.isFinite(y(61))).toBe(true);
    expect(ticks.every((tick) => Number.isFinite(tick))).toBe(true);
    expect(nearestIndex(400, { left: 0, width: CHART.width }, 1)).toBe(0);
  });
});
