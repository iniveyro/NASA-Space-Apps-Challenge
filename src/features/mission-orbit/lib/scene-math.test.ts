import { describe, expect, it } from "vitest";
import { formatDegrees, formatDelay, formatDelayShort, formatMkm, pluralDays } from "./format";
import {
  PULSE_INTERVAL_SECONDS,
  PULSE_SECONDS_PER_MINUTE,
  SCENE_UNITS_PER_AU,
  cameraFrame,
  pulseProgress,
  pulseTravelSeconds,
  toScene,
  viewForPhase,
} from "./scene-math";

describe("toScene", () => {
  it("maps the ecliptic plane to the horizontal plane and keeps a right-handed frame", () => {
    expect(toScene([1, 0, 0])).toEqual([SCENE_UNITS_PER_AU, 0, -0]);
    expect(toScene([0, 1, 0])).toEqual([0, 0, -SCENE_UNITS_PER_AU]);
    expect(toScene([0, 0, 1])).toEqual([0, SCENE_UNITS_PER_AU, -0]);
  });
});

describe("signal pulses", () => {
  it("makes the on-screen travel time proportional to the real delay", () => {
    expect(pulseTravelSeconds(20)).toBeCloseTo(20 * PULSE_SECONDS_PER_MINUTE);
    expect(pulseTravelSeconds(10)! * 2).toBeCloseTo(pulseTravelSeconds(20)!);
    expect(pulseTravelSeconds(0.02)).toBeGreaterThan(0.3);
  });

  it("has no pulses without a finite, positive delay", () => {
    for (const value of [null, undefined, 0, -1, Number.NaN, Number.POSITIVE_INFINITY]) expect(pulseTravelSeconds(value)).toBeNull();
    expect(pulseProgress(1, 0)).toEqual([]);
    expect(pulseProgress(Number.NaN, 2)).toEqual([]);
  });

  it("keeps every pulse inside the link and emits them at a steady cadence", () => {
    const travel = pulseTravelSeconds(20)!;
    let seen = 0;
    for (let time = 0; time < 30; time += 0.05) {
      const progress = pulseProgress(time, travel);
      seen = Math.max(seen, progress.length);
      for (const value of progress) {
        expect(value).toBeGreaterThanOrEqual(0);
        expect(value).toBeLessThanOrEqual(1);
      }
    }
    // A longer delay means more pulses in flight at once.
    expect(seen).toBe(Math.ceil(travel / PULSE_INTERVAL_SECONDS));
    expect(Math.max(...Array.from({ length: 200 }, (_, index) => pulseProgress(index * 0.05, pulseTravelSeconds(1)!).length))).toBe(1);
  });
});

describe("camera", () => {
  const bodies = { earth: [-9.9, 0, -0.1] as const, mars: [13.9, -0.3, 0.02] as const, ship: [13.9, -0.3, 0.02] as const };

  it("uses the Mars view on the surface and the overview in transit", () => {
    expect(viewForPhase("transit_out")).toBe("overview");
    expect(viewForPhase("mars_arrival")).toBe("mars");
    expect(viewForPhase("surface")).toBe("mars");
    expect(viewForPhase("mars_departure")).toBe("mars");
    expect(viewForPhase("transit_return")).toBe("overview");
    expect(viewForPhase("landed")).toBe("overview");
    expect(viewForPhase(null)).toBe("overview");
  });

  it("frames the overview on the Sun and backs off on narrow viewports", () => {
    const wide = cameraFrame("overview", bodies, 16 / 9);
    const narrow = cameraFrame("overview", bodies, 0.6);
    expect(wide.target).toEqual([0, 0, 0]);
    expect(Math.hypot(...narrow.position)).toBeGreaterThan(Math.hypot(...wide.position));
  });

  it("places the Mars view beyond Mars, above the ecliptic, looking sunward", () => {
    const frame = cameraFrame("mars", bodies, 16 / 9);
    expect(Math.hypot(frame.position[0], frame.position[2])).toBeGreaterThan(Math.hypot(bodies.mars[0], bodies.mars[2]));
    expect(frame.position[1]).toBeGreaterThan(0);
    expect(Math.hypot(...frame.target)).toBeLessThan(Math.hypot(...bodies.mars));
  });

  it("looks from behind the spacecraft toward Earth, and falls back to the overview at Earth", () => {
    const frame = cameraFrame("crew", bodies, 16 / 9);
    const toEarth = [bodies.earth[0] - bodies.ship[0], bodies.earth[2] - bodies.ship[2]];
    const toCamera = [frame.position[0] - bodies.ship[0], frame.position[2] - bodies.ship[2]];
    expect(toEarth[0] * toCamera[0] + toEarth[1] * toCamera[1]).toBeLessThan(0);
    expect(cameraFrame("crew", { ...bodies, ship: bodies.earth }, 16 / 9)).toEqual(cameraFrame("overview", bodies, 16 / 9));
    for (const view of ["overview", "mars", "crew"] as const) {
      const { position, target } = cameraFrame(view, bodies, Number.NaN);
      expect([...position, ...target].every(Number.isFinite)).toBe(true);
    }
  });
});

describe("formatting", () => {
  it("formats signal times, distances and angles, and never prints NaN", () => {
    expect(formatDelay(0)).toBe("0 s");
    expect(formatDelay(0.02)).toBe("1 s");
    expect(formatDelay(4.07)).toBe("4 min 4 s");
    expect(formatDelay(19.85)).toBe("19 min 51 s");
    expect(formatDelay(0.9999)).toBe("1 min 0 s");
    expect(formatDelayShort(0.5)).toBe("30 s");
    expect(formatDelayShort(19.85)).toBe("19.9 min");
    expect(formatMkm(357.07)).toBe("357.07 million km");
    expect(formatDegrees(0.85)).toBe("0.85°");
    expect(pluralDays(1)).toBe("1 day");
    expect(pluralDays(17)).toBe("17 days");
    for (const value of [null, undefined, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(formatDelay(value)).toBe("Unknown");
      expect(formatDelayShort(value)).toBe("Unknown");
      expect(formatMkm(value)).toBe("Unknown");
      expect(formatDegrees(value)).toBe("Unknown");
    }
    expect(formatDelay(-1)).toBe("Unknown");
  });
});
