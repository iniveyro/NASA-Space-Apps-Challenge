import { describe, expect, it } from "vitest";
import { buildChartSegments } from "./mini-chart";

describe("buildChartSegments", () => {
  it("preserves missing and non-finite samples as separate line segments", () => {
    const [segments] = buildChartSegments([{ label: "heart rate", values: [60, null, Number.NaN, 66] }]);

    expect(segments).toHaveLength(2);
    expect(segments[0]).toHaveLength(1);
    expect(segments[1]).toHaveLength(1);
    expect(segments[0][0].x).toBeLessThan(segments[1][0].x);
  });

  it("centers a single sample instead of inventing a waveform", () => {
    const [segments] = buildChartSegments([{ label: "temperature", values: [36.7] }]);

    expect(segments).toEqual([[{ x: 54, y: 12 }]]);
  });

  it("keeps flat series visible and aligns paired series on one scale", () => {
    const [flat, paired] = buildChartSegments([
      { label: "flat", values: [5, 5] },
      { label: "paired", values: [0, 10] },
    ]);

    expect(flat[0].map(({ y }) => y)).toEqual([12, 12]);
    expect(paired[0].map(({ y }) => y)).toEqual([22, 2]);
  });

  it("returns no segments when every history value is unavailable", () => {
    expect(buildChartSegments([{ label: "radiation", values: [null, Number.POSITIVE_INFINITY] }])).toEqual([[]]);
  });
});
