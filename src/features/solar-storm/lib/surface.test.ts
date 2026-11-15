import { describe, expect, it } from "vitest";
import { AIRLOCK, FAR_POINT, PATH_LENGTH, SUN_DIRECTION, cameraPlan, distanceToPath, heightAt, pathHeading, pathPoint, walkSpeed, walkerPlace } from "./surface";
import { ALARM_AT, ARRIVE_AT } from "./timeline";

const finite = (values: readonly number[]) => values.every((value) => Number.isFinite(value));

describe("the walk", () => {
  it("runs from the far point to the airlock", () => {
    expect(pathPoint(0)[0]).toBeCloseTo(FAR_POINT[0], 6);
    expect(pathPoint(0)[1]).toBeCloseTo(FAR_POINT[1], 6);
    expect(pathPoint(1)[0]).toBeCloseTo(AIRLOCK[0], 6);
    expect(pathPoint(1)[1]).toBeCloseTo(AIRLOCK[1], 6);
    expect(PATH_LENGTH).toBeGreaterThan(55);
  });

  it("moves at an even pace along its length and clamps bad fractions", () => {
    const step = (from: number, to: number) => Math.hypot(pathPoint(to)[0] - pathPoint(from)[0], pathPoint(to)[1] - pathPoint(from)[1]);
    expect(step(0, 0.1)).toBeCloseTo(step(0.5, 0.6), 0);
    expect(pathPoint(-3)).toEqual(pathPoint(0));
    expect(pathPoint(7)).toEqual(pathPoint(1));
    expect(finite(pathPoint(Number.NaN))).toBe(true);
  });

  it("heads toward the habitat", () => {
    for (const fraction of [0.05, 0.3, 0.6, 0.95]) {
      const heading = pathHeading(fraction);
      expect(Math.cos(heading)).toBeGreaterThan(0.3);
    }
  });
});

describe("the ground", () => {
  it("is flat along the walk and around the habitat, and finite everywhere", () => {
    for (const fraction of [0, 0.25, 0.5, 0.75, 1]) {
      const [x, z] = pathPoint(fraction);
      expect(Math.abs(heightAt(x, z))).toBeLessThan(0.05);
    }
    expect(Math.abs(heightAt(0, 0))).toBeLessThan(0.05);
    expect(distanceToPath(...AIRLOCK)).toBeCloseTo(0, 6);
    for (let x = -150; x <= 150; x += 25) for (let z = -150; z <= 150; z += 25) expect(Number.isFinite(heightAt(x, z))).toBe(true);
  });

  it("rises into ridges on the horizon", () => {
    const far = Math.max(...Array.from({ length: 36 }, (_, index) => heightAt(Math.cos(index * 0.17) * 140, Math.sin(index * 0.17) * 140)));
    expect(far).toBeGreaterThan(5);
  });

  it("has the Sun low over the horizon, as a unit vector", () => {
    expect(Math.hypot(...SUN_DIRECTION)).toBeCloseTo(1, 6);
    expect(SUN_DIRECTION[1]).toBeGreaterThan(0);
    expect(SUN_DIRECTION[1]).toBeLessThan(0.3);
  });
});

describe("the walkers", () => {
  it("stand at the far point until the sensor rises, then walk home and go inside", () => {
    expect(walkerPlace(0, 0).stride).toBe(0);
    const waiting = walkerPlace(0, ALARM_AT - 0.01);
    expect(Math.hypot(waiting.x - FAR_POINT[0], waiting.z - FAR_POINT[1])).toBeLessThan(0.5);
    expect(walkSpeed((ALARM_AT + ARRIVE_AT) / 2)).toBeGreaterThan(0.5);
    expect(walkerPlace(0, ARRIVE_AT).stride).toBe(0);
    expect(walkerPlace(0, ARRIVE_AT).inside).toBe(false);
    expect(walkerPlace(0, ARRIVE_AT + 0.05).inside).toBe(true);
    expect(walkerPlace(1, 1).inside).toBe(true);
  });

  it("only ever get closer to the airlock, and the second person trails the first", () => {
    let last = Infinity;
    for (let step = 0; step <= 100; step += 1) {
      const place = walkerPlace(0, step / 100);
      const distance = Math.hypot(place.x - AIRLOCK[0], place.z - AIRLOCK[1]);
      expect(distance).toBeLessThanOrEqual(last + 1e-6);
      last = distance;
    }
    const mid = (ALARM_AT + ARRIVE_AT) / 2;
    const lead = walkerPlace(0, mid);
    const trail = walkerPlace(1, mid);
    expect(Math.hypot(lead.x - AIRLOCK[0], lead.z - AIRLOCK[1])).toBeLessThan(Math.hypot(trail.x - AIRLOCK[0], trail.z - AIRLOCK[1]));
    expect(Math.hypot(lead.x - trail.x, lead.z - trail.z)).toBeGreaterThan(1);
  });
});

describe("the camera", () => {
  it("is finite, above the ground and continuous through the whole scene in both views", () => {
    for (const view of ["follow", "overview"] as const) {
      let last = cameraPlan(view, 0, 0);
      for (let step = 1; step <= 400; step += 1) {
        const plan = cameraPlan(view, step / 400, step * 0.1);
        expect(finite([...plan.position, ...plan.target])).toBe(true);
        expect(plan.position[1]).toBeGreaterThan(2);
        const jump = Math.hypot(plan.position[0] - last.position[0], plan.position[1] - last.position[1], plan.position[2] - last.position[2]);
        expect(jump).toBeLessThan(3);
        last = plan;
      }
    }
  });

  it("looks at the habitat once everyone is inside", () => {
    const plan = cameraPlan("follow", 1, 10);
    expect(plan.target[0]).toBeCloseTo(0, 6);
    expect(Math.hypot(plan.position[0], plan.position[2])).toBeCloseTo(24, 6);
  });
});
