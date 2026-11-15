import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { parseEvents } from "@/features/crew-health-data";
import { parseMissionGeometry } from "./geometry";
import { beatFor, buildStory } from "./story";

const csv = (name: string) => readFileSync(path.join(process.cwd(), "data", "processed", name), "utf-8");
const GEOMETRY = parseMissionGeometry(csv("mission_timeline.csv"), csv("mission_positions.csv"));
const EVENTS = parseEvents(csv("crew_events.csv"));
const STORY = buildStory(GEOMETRY, EVENTS);

describe("buildStory", () => {
  it("places every beat on the day the plot gives for it", () => {
    expect(Object.fromEntries(STORY.map((beat) => [beat.id, beat.day]))).toEqual({
      departure: 1,
      "delay-1": 55,
      "closer-to-mars": 109,
      "viral-reactivation": 120,
      "delay-5": 133,
      "delay-10": 192,
      "mars-arrival": 211,
      "delay-15": 266,
      "dust-season": 339,
      "autonomous-mode": 480,
      blackout: 486,
      "solar-storm": 493,
      "link-returns": 503,
      farthest: 546,
      "mars-departure": 732,
      "closer-to-earth": 856,
      "delay-below-1": 904,
      landing: 942,
    });
  });

  it("is ordered by day and quotes figures from the dataset", () => {
    const days = STORY.map((beat) => beat.day);
    expect(days).toEqual([...days].sort((a, b) => a - b));
    const text = (id: string) => STORY.find((beat) => beat.id === id)!.text;
    expect(text("viral-reactivation")).toContain("4 min 4 s");
    expect(text("mars-arrival")).toContain("After 210 days");
    expect(text("mars-arrival")).toContain("212.55 million km");
    expect(text("blackout")).toContain("17 days");
    expect(text("solar-storm")).toContain("another 10 days");
    expect(text("link-returns")).toContain("19 min 55 s");
    expect(text("farthest")).toContain("20 min 4 s");
    expect(text("mars-departure")).toContain("After 521 days");
    expect(text("closer-to-earth")).toContain("since day 109");
    expect(text("landing")).toContain("942 days");
    for (const beat of STORY) expect(beat.text).not.toMatch(/Unknown|NaN|undefined|null/);
  });

  it("links the authored scenario events to their codes in crew_events.csv", () => {
    const codes = Object.fromEntries(STORY.filter((beat) => beat.eventCode).map((beat) => [beat.id, beat.eventCode]));
    expect(codes).toEqual({ "viral-reactivation": "viral_reactivation", "mars-arrival": "orthostatic_test", "solar-storm": "solar_storm" });
    for (const code of Object.values(codes)) expect(EVENTS.some((event) => event.event === code)).toBe(true);
  });

  it("leaves out beats whose day is missing from the data instead of inventing one", () => {
    const empty = parseMissionGeometry("day,date,phase,comm\n1,2026-11-14,transit_out,link\n2,2026-11-15,transit_out,link\n", "day\n");
    expect(buildStory(empty, []).map((beat) => beat.id)).toEqual(["departure"]);
  });
});

describe("beatFor", () => {
  it("returns the latest beat at or before a day", () => {
    expect(beatFor(STORY, 1)?.id).toBe("departure");
    expect(beatFor(STORY, 54)?.id).toBe("departure");
    expect(beatFor(STORY, 493)?.id).toBe("solar-storm");
    expect(beatFor(STORY, 502)?.id).toBe("solar-storm");
    expect(beatFor(STORY, 942)?.id).toBe("landing");
    expect(beatFor(STORY, 0)).toBeNull();
    expect(beatFor([], 10)).toBeNull();
  });
});
