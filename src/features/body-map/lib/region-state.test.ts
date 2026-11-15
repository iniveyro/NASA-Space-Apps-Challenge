import { describe, expect, it } from "vitest";
import { calloutLines, describeRegion, summarizeRegions, type RegionSignal } from "./region-state";

const signal = (metricId: RegionSignal["metricId"], status: RegionSignal["status"], value = "1"): RegionSignal => ({
  metricId,
  label: metricId,
  value,
  status,
  statusLabel: { "within-demo-reference": "Reference", "demo-deviation": "Deviation", "demo-alert": "Alert", unknown: "Unknown" }[status],
});

describe("region summaries", () => {
  it("groups signals under their navigation region, in the region's metric order", () => {
    const summaries = summarizeRegions([signal("radiation", "within-demo-reference"), signal("bloodPressure", "within-demo-reference"), signal("heartRate", "within-demo-reference"), signal("sleep", "within-demo-reference")]);
    expect(summaries.heart.signals.map((item) => item.metricId)).toEqual(["heartRate", "bloodPressure"]);
    expect(summaries.brain.signals.map((item) => item.metricId)).toEqual(["sleep"]);
    expect(summaries.body.signals.map((item) => item.metricId)).toEqual(["radiation"]);
  });

  it("shows the most notable authored state of a region and names the signals that carry it", () => {
    const summaries = summarizeRegions([signal("heartRate", "demo-deviation", "78 bpm"), signal("bloodPressure", "demo-alert", "94/68 mmHg"), signal("sleep", "within-demo-reference")]);
    expect(summaries.heart.status).toBe("demo-alert");
    expect(summaries.heart.statusLabel).toBe("Alert");
    expect(summaries.heart.notable.map((item) => item.metricId)).toEqual(["bloodPressure"]);
    expect(describeRegion(summaries.heart)).toBe("Alert: bloodPressure 94/68 mmHg.");
    expect(summaries.brain.status).toBe("within-demo-reference");
    expect(summaries.brain.notable).toEqual([]);
    expect(describeRegion(summaries.brain)).toBe("Reference: sleep.");
  });

  it("lists the readings that carry the state first in the callout, with short names", () => {
    const summaries = summarizeRegions([signal("heartRate", "within-demo-reference", "67 bpm"), signal("bloodPressure", "demo-alert", "121/70 mmHg"), signal("sleep", "within-demo-reference", "6.5 h"), signal("mood", "within-demo-reference", "4 / 5"), signal("stress", "within-demo-reference", "2 / 5")]);
    expect(calloutLines(summaries.heart)).toEqual(["BP 121/70 mmHg"]);
    expect(calloutLines(summaries.brain)).toEqual(["Sleep 6.5 h", "Mood 4 / 5"]);
    expect(calloutLines(summaries.body)).toEqual([]);
  });

  it("keeps a known state when other signals of the region are unknown", () => {
    const summaries = summarizeRegions([signal("temperature", "unknown"), signal("glucose", "within-demo-reference")]);
    expect(summaries.body.status).toBe("within-demo-reference");
  });

  it("reads unknown, never a fabricated state, when a region has no signals or only unknown ones", () => {
    const empty = summarizeRegions([]);
    for (const region of ["brain", "heart", "body"] as const) {
      expect(empty[region].status).toBe("unknown");
      expect(empty[region].statusLabel).toBe("Unknown");
      expect(describeRegion(empty[region])).toBe("No signals for this region.");
    }
    expect(summarizeRegions([signal("mood", "unknown")]).brain.status).toBe("unknown");
  });
});
