/**
 * Day-indexed access to the UMBRAL mission dataset. Pure and serializable, so it runs on the
 * server (building the dataset) and in client components (reading the selected day).
 */
import type {
  CrewDayReading,
  CrewEvent,
  CrewSeries,
  CrewSeriesField,
  MetricId,
  MetricReading,
  MissionDataset,
  MissionDay,
} from "./types";

const SERIES_FIELDS: readonly CrewSeriesField[] = ["heartRate", "systolic", "diastolic", "temperature", "sleep", "mood", "glucose", "radiation"];

function emptySeries(length: number): CrewSeries {
  const series = Object.fromEntries(SERIES_FIELDS.map((field) => [field, Array<number | null>(length).fill(null)])) as Record<CrewSeriesField, (number | null)[]>;
  return { ...series, event: Array<string | null>(length).fill(null) };
}

/** Builds compact per-crew arrays (index = day - 1) aligned to the mission timeline. */
export function buildMissionDataset(days: readonly MissionDay[], readings: readonly CrewDayReading[], events: readonly CrewEvent[]): MissionDataset {
  const ordered = [...days].sort((a, b) => a.day - b.day);
  const crew: Record<string, CrewSeries> = {};
  for (const reading of readings) {
    if (reading.day < 1 || reading.day > ordered.length) continue;
    const series = (crew[reading.crewId] ??= emptySeries(ordered.length));
    const index = reading.day - 1;
    for (const field of SERIES_FIELDS) series[field][index] = reading[field];
    series.event[index] = reading.event;
  }
  return { days: ordered, crew, events: [...events].sort((a, b) => a.day - b.day) };
}

/** One crew member's readings on a mission day; null when the day or crew member is unknown. */
export function readingFor(data: MissionDataset, crewId: string, day: number): CrewDayReading | null {
  const series = data.crew[crewId];
  const info = data.days[day - 1];
  if (!series || !info || !Number.isInteger(day)) return null;
  const index = day - 1;
  const values = Object.fromEntries(SERIES_FIELDS.map((field) => [field, series[field][index] ?? null])) as Record<CrewSeriesField, number | null>;
  return { day, date: info.date, crewId, ...values, event: series.event[index] ?? null };
}

function finite(value: number | null | undefined): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

/** Maps a day reading onto a dashboard metric. Metrics the simulation does not record resolve to null. */
export function metricReading(reading: CrewDayReading | null, metricId: MetricId): MetricReading {
  if (!reading) return null;
  switch (metricId) {
    case "bloodPressure": {
      const systolic = finite(reading.systolic);
      const diastolic = finite(reading.diastolic);
      return systolic !== null && diastolic !== null ? { systolic, diastolic } : null;
    }
    case "heartRate":
    case "temperature":
    case "sleep":
    case "mood":
    case "glucose":
    case "radiation":
      return finite(reading[metricId]);
    default:
      return null;
  }
}

/** The `length` values ending at `day` (inclusive), clipped at mission day 1. */
export function seriesWindow(data: MissionDataset, crewId: string, field: CrewSeriesField, day: number, length: number): (number | null)[] {
  const series = data.crew[crewId]?.[field];
  if (!series) return [];
  const end = Math.min(day, series.length);
  const start = Math.max(1, end - length + 1);
  return series.slice(start - 1, end).map((value) => finite(value));
}

export function eventsOn(data: MissionDataset, day: number, crewId?: string): CrewEvent[] {
  return data.events.filter((event) => event.day === day && (crewId === undefined || event.crewId === crewId));
}

/** "orthostatic_test" → "Orthostatic test". */
export function eventLabel(code: string): string {
  const words = code.replace(/[_-]+/g, " ").trim();
  return words ? words[0].toUpperCase() + words.slice(1) : "Event";
}
