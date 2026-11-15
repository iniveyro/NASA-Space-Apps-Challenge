/**
 * The solar-storm scenario day as plain data for the scene. Every figure is read from the mission
 * dataset (crew_events.csv, crew_daily.csv, mission_timeline.csv, mission_positions.csv); only the
 * walk distance is an authored plot detail. Pure and serializable.
 */
import type { CrewEvent, MissionDataset, Profile } from "@/features/crew-health-data";

export type Vec3 = readonly [number, number, number];

/** Distance of the surface walk from the habitat when the sensor rises, from the plot. */
export const WALK_DISTANCE_KM = 1.2;

export const STORM_EVENT = "solar_storm";

export type StormPlace = "walk" | "refuge";

export interface StormCrew {
  id: string;
  name: string;
  role: string;
  /** Where the person is when the storm starts, from the event detail in crew_events.csv. */
  place: StormPlace | null;
  /** Event dose in mSv from crew_events.csv; null when it cannot be read. */
  eventDoseMsv: number | null;
  /** Cumulative mission dose the day before and on the storm day, from crew_daily.csv. */
  doseBeforeMsv: number | null;
  doseAfterMsv: number | null;
  /** Self-reported sleep that night, in hours. */
  sleepHours: number | null;
  /** The event row as written in the dataset. */
  detail: string;
}

export interface StormScenario {
  day: number;
  /** ISO dates. */
  date: string;
  marsSol: number | null;
  distanceEarthMkm: number | null;
  /** Blackout the storm falls in; nulls when the storm day has a link. */
  dayOfBlackout: number | null;
  blackoutDays: number | null;
  lastContactDay: number | null;
  lastContactDate: string | null;
  linkReturnsDay: number | null;
  linkReturnsDate: string | null;
  daysUntilLink: number | null;
  /** One-way signal time on the day the link returns, in minutes. */
  delayAtReturnMin: number | null;
  /** Angle between the Sun and Earth in the Martian sky, in degrees. */
  earthFromSunDeg: number | null;
  /** Sun–Earth–crew angle seen from Earth, in degrees (the link is lost below 2°). */
  sunAngleFromEarthDeg: number | null;
  walkDistanceKm: number;
  crew: StormCrew[];
}

export interface StormInputs {
  data: MissionDataset;
  profiles: readonly Pick<Profile, "id" | "name" | "role">[];
  /** Per-day arrays indexed by `day - 1`. */
  dates: readonly string[];
  comm: readonly string[];
  marsSol: readonly (number | null)[];
  distEarthMkm: readonly (number | null)[];
  sunAngleDeg: readonly (number | null)[];
  delayMin: readonly (number | null)[];
  earth: readonly (Vec3 | null)[];
  mars: readonly (Vec3 | null)[];
}

function finite(value: number | null | undefined): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

/** Reads "event dose 8.1 mSv (EVA)" → { dose: 8.1, place: "walk" }. Unreadable parts stay null. */
export function parseStormDetail(detail: string): { dose: number | null; place: StormPlace | null } {
  const dose = /(\d+(?:\.\d+)?)\s*mSv/i.exec(detail);
  const place = /\(\s*(EVA|refuge)\s*\)/i.exec(detail)?.[1]?.toLowerCase();
  return { dose: dose ? Number(dose[1]) : null, place: place === "eva" ? "walk" : place === "refuge" ? "refuge" : null };
}

/** Angle at Mars between the directions to the Sun (the origin) and to Earth, in degrees. */
export function earthSunSeparationDeg(mars: Vec3 | null | undefined, earth: Vec3 | null | undefined): number | null {
  if (!mars || !earth) return null;
  const toSun: Vec3 = [-mars[0], -mars[1], -mars[2]];
  const toEarth: Vec3 = [earth[0] - mars[0], earth[1] - mars[1], earth[2] - mars[2]];
  const sunLength = Math.hypot(...toSun);
  const earthLength = Math.hypot(...toEarth);
  if (sunLength < 1e-9 || earthLength < 1e-9) return null;
  const cosine = (toSun[0] * toEarth[0] + toSun[1] * toEarth[1] + toSun[2] * toEarth[2]) / (sunLength * earthLength);
  return (Math.acos(Math.min(1, Math.max(-1, cosine))) * 180) / Math.PI;
}

/** Builds the scenario for the first solar-storm event in the dataset; null when there is none. */
export function buildStormScenario(inputs: StormInputs): StormScenario | null {
  const { data, profiles, dates, comm } = inputs;
  const events: CrewEvent[] = data.events.filter((event) => event.event === STORM_EVENT);
  const day = events[0]?.day;
  if (day === undefined || day < 1 || day > dates.length) return null;
  const index = day - 1;

  let start = index;
  let end = index;
  const inBlackout = comm[index] === "blackout";
  if (inBlackout) {
    while (start > 0 && comm[start - 1] === "blackout") start -= 1;
    while (end < comm.length - 1 && comm[end + 1] === "blackout") end += 1;
  }
  const lastContactDay = inBlackout && start >= 1 ? start : null;
  const linkReturnsDay = inBlackout && end + 2 <= dates.length && comm[end + 1] === "link" ? end + 2 : null;

  const crew = profiles.map((person): StormCrew => {
    const event = events.find((candidate) => candidate.crewId === person.id && candidate.day === day);
    const parsed = parseStormDetail(event?.detail ?? "");
    const series = data.crew[person.id];
    return {
      id: person.id,
      name: person.name,
      role: person.role,
      place: parsed.place,
      eventDoseMsv: parsed.dose,
      doseBeforeMsv: index >= 1 ? finite(series?.radiation[index - 1]) : null,
      doseAfterMsv: finite(series?.radiation[index]),
      sleepHours: finite(series?.sleep[index]),
      detail: event?.detail ?? "",
    };
  });

  return {
    day,
    date: dates[index] ?? "",
    marsSol: finite(inputs.marsSol[index]),
    distanceEarthMkm: finite(inputs.distEarthMkm[index]),
    dayOfBlackout: inBlackout ? index - start + 1 : null,
    blackoutDays: inBlackout ? end - start + 1 : null,
    lastContactDay,
    lastContactDate: lastContactDay === null ? null : (dates[lastContactDay - 1] ?? null),
    linkReturnsDay,
    linkReturnsDate: linkReturnsDay === null ? null : (dates[linkReturnsDay - 1] ?? null),
    daysUntilLink: linkReturnsDay === null ? null : linkReturnsDay - day,
    delayAtReturnMin: linkReturnsDay === null ? null : finite(inputs.delayMin[linkReturnsDay - 1]),
    earthFromSunDeg: earthSunSeparationDeg(inputs.mars[index], inputs.earth[index]),
    sunAngleFromEarthDeg: finite(inputs.sunAngleDeg[index]),
    walkDistanceKm: WALK_DISTANCE_KM,
    crew,
  };
}
