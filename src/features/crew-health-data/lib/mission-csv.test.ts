import { describe, expect, it } from "vitest";
import { crewIdFromName, parseCrewDaily, parseCsv, parseEvents, parseTimeline } from "./mission-csv";

const TIMELINE = [
  "day,date,phase,dist_earth_mkm,dist_mars_mkm,delay_oneway_min,delay_roundtrip_min,solar_elong_deg,comm,mars_sol,mars_Ls_deg,gravity_g,dose_cum_mSv",
  "1,2026-11-14,transit_out,0.0,198.13,0.0,0.0,180.0,link,,21.6,0.0,0.0",
  "211,2027-06-12,mars_arrival,212.55,0.0,11.82,23.63,81.47,link,0.0,115.2,0.38,386.4",
  "487,2028-03-14,surface,356.29,0.0,19.81,39.61,1.76,blackout,268.6,271.2,0.38,563.0",
].join("\n");

const DAILY = [
  "day,date,crew,hr_rest_bpm,sbp_mmHg,dbp_mmHg,temp_C,sleep_h,hrv_rmssd_ms,glucose_mg_dL,mood_1to5,dose_cum_mSv,comm,event",
  "1,2026-11-14,Ines,61,122,68,36.6,6.4,48,72,4,151.8,link,",
  "120,2027-03-13,Kanji,78,114,,37.1,5.0,42,NaN,3,220.8,link,viral_reactivation",
].join("\r\n");

const EVENTS = [
  "day,date,crew,event,detail",
  '120,2027-03-13,Kanji,viral_reactivation,"rest HR 48->78, T +0.6 C, low HRV, 5 h sleep (days 120-122)"',
  "493,2028-03-20,Sofia,solar_storm,event dose 8.1 mSv (EVA)",
  "",
].join("\n");

describe("mission CSV parsing", () => {
  it("splits rows and keeps quoted fields with commas and escaped quotes intact", () => {
    expect(parseCsv('a,b,c\n1,"x, y",3\r\n4,"say ""hi""",\n')).toEqual([
      ["a", "b", "c"],
      ["1", "x, y", "3"],
      ["4", 'say "hi"', ""],
    ]);
  });

  it("maps crew display names to stable ascii ids", () => {
    expect(crewIdFromName("Ines")).toBe("ines");
    expect(crewIdFromName("Inés")).toBe("ines");
    expect(crewIdFromName(" Sofía ")).toBe("sofia");
  });

  it("parses the mission timeline into typed days with phase and link status", () => {
    expect(parseTimeline(TIMELINE)).toEqual([
      { day: 1, date: "2026-11-14", phase: "transit_out", comm: "link" },
      { day: 211, date: "2027-06-12", phase: "mars_arrival", comm: "link" },
      { day: 487, date: "2028-03-14", phase: "surface", comm: "blackout" },
    ]);
  });

  it("rejects unknown mission phases instead of guessing", () => {
    expect(() => parseTimeline("day,date,phase,comm\n1,2026-11-14,orbit,link")).toThrow(/Unknown mission phase/);
  });

  it("parses daily crew readings and resolves empty or non-finite cells to null", () => {
    const [ines, kanji] = parseCrewDaily(DAILY);
    expect(ines).toEqual({
      day: 1,
      date: "2026-11-14",
      crewId: "ines",
      heartRate: 61,
      systolic: 122,
      diastolic: 68,
      temperature: 36.6,
      sleep: 6.4,
      mood: 4,
      glucose: 72,
      radiation: 151.8,
      event: null,
    });
    expect(kanji.diastolic).toBeNull();
    expect(kanji.glucose).toBeNull();
    expect(kanji.event).toBe("viral_reactivation");
  });

  it("parses scenario events including quoted details", () => {
    expect(parseEvents(EVENTS)).toEqual([
      { day: 120, date: "2027-03-13", crewId: "kanji", event: "viral_reactivation", detail: "rest HR 48->78, T +0.6 C, low HRV, 5 h sleep (days 120-122)" },
      { day: 493, date: "2028-03-20", crewId: "sofia", event: "solar_storm", detail: "event dose 8.1 mSv (EVA)" },
    ]);
  });
});
