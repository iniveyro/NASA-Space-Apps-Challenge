import { describe, expect, it } from "vitest";
import { METRICS } from "@/features/crew-health-data";
import { REGION_METRICS, firstMetricFor, regionForMuscle } from "./regions";

describe("body map regions", () => {
  it("groups every metric under exactly the region declared in its metadata", () => {
    for (const metric of METRICS) {
      expect(REGION_METRICS[metric.region]).toContain(metric.id);
    }
    expect(Object.values(REGION_METRICS).flat()).toHaveLength(METRICS.length);
  });

  it("selects the first metric of each region", () => {
    expect(firstMetricFor("heart")).toBe("heartRate");
    expect(firstMetricFor("brain")).toBe("sleep");
    expect(firstMetricFor("body")).toBe("temperature");
  });

  it("maps illustration muscles to navigation regions", () => {
    expect(regionForMuscle("head")).toBe("brain");
    expect(regionForMuscle("NECK")).toBe("brain");
    expect(regionForMuscle("chest")).toBe("heart");
    expect(regionForMuscle("quadriceps")).toBe("body");
    expect(regionForMuscle(undefined)).toBe("body");
  });
});
