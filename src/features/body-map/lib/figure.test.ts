import { describe, expect, it } from "vitest";
import { FIGURE_HEIGHT, FIGURE_PARTS, HEART_POSITION, REGION_ANCHORS, figureBounds, regionForPart } from "./figure";

describe("3D figure", () => {
  it("maps parts to the same navigation regions as the 2D silhouette", () => {
    expect(regionForPart("head")).toBe("brain");
    expect(regionForPart("neck")).toBe("brain");
    expect(regionForPart("chest")).toBe("heart");
    expect(regionForPart("abdomen")).toBe("body");
    expect(regionForPart("thigh-left")).toBe("body");
    expect(regionForPart("not-a-part")).toBe("body");
    expect(regionForPart(null)).toBe("body");
  });

  it("covers every region and uses unique part ids", () => {
    const ids = FIGURE_PARTS.map((part) => part.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(new Set(FIGURE_PARTS.map((part) => part.region))).toEqual(new Set(["brain", "heart", "body"]));
  });

  it("is mirrored left to right", () => {
    for (const left of FIGURE_PARTS.filter((part) => part.id.endsWith("-left"))) {
      const right = FIGURE_PARTS.find((part) => part.id === left.id.replace("-left", "-right"));
      expect(right, left.id).toBeDefined();
      expect(right!.position[0]).toBeCloseTo(-left.position[0], 9);
      expect(right!.position[1]).toBe(left.position[1]);
      expect(right!.tilt ?? 0).toBeCloseTo(-(left.tilt ?? 0), 9);
    }
  });

  it("stands on the floor at the stated height with finite dimensions", () => {
    const { minY, maxY, halfWidth } = figureBounds();
    expect(minY).toBeGreaterThanOrEqual(0);
    expect(minY).toBeLessThan(0.02);
    expect(maxY).toBeCloseTo(FIGURE_HEIGHT, 1);
    expect(halfWidth).toBeGreaterThan(0.25);
    expect(halfWidth).toBeLessThan(0.4);
    for (const part of FIGURE_PARTS) {
      expect(part.radius).toBeGreaterThan(0);
      expect(part.length).toBeGreaterThanOrEqual(0);
      expect(part.position.every(Number.isFinite)).toBe(true);
      if (part.shape === "lathe") {
        expect(part.profile!.length).toBeGreaterThan(2);
        // Outlines run bottom to top, so the surface faces outward and never folds back.
        const heights = part.profile!.map(([, height]) => height);
        expect([...heights].sort((a, b) => a - b)).toEqual(heights);
        expect(part.profile!.every(([radius]) => radius >= 0)).toBe(true);
      }
    }
  });

  it("anchors every callout inside the height of the figure and puts the pulse in the chest", () => {
    for (const anchor of Object.values(REGION_ANCHORS)) {
      expect(anchor[1]).toBeGreaterThan(0);
      expect(anchor[1]).toBeLessThan(FIGURE_HEIGHT);
    }
    const chest = FIGURE_PARTS.find((part) => part.id === "chest")!;
    expect(Math.abs(HEART_POSITION[1] - chest.position[1])).toBeLessThan(chest.length / 2);
    expect(HEART_POSITION[0]).toBeGreaterThan(0);
  });
});
