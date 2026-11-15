import { describe, expect, it } from "vitest";
import { profileHref } from "./profile-route";

describe("profile route", () => {
  it("links to the bare profile when no day is given", () => {
    expect(profileHref("sofia")).toBe("/astronaut/sofia");
    expect(profileHref("sofia", undefined, 942)).toBe("/astronaut/sofia");
  });

  it("links to the bare profile on the latest day", () => {
    expect(profileHref("kanji", 942, 942)).toBe("/astronaut/kanji");
  });

  it("carries any other mission day as the day parameter", () => {
    expect(profileHref("sofia", 211, 942)).toBe("/astronaut/sofia?day=211");
    expect(profileHref("ines", 1, 942)).toBe("/astronaut/ines?day=1");
    expect(profileHref("malik", 120)).toBe("/astronaut/malik?day=120");
  });

  it("never writes a non-finite day into the link", () => {
    expect(profileHref("ines", Number.NaN, 942)).toBe("/astronaut/ines");
    expect(profileHref("ines", Number.POSITIVE_INFINITY, 942)).toBe("/astronaut/ines");
  });
});
