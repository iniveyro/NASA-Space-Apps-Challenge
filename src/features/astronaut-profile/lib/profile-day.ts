/**
 * The astronaut profile for one mission day: which day the URL asks for, the ten readings of that
 * day with their authored demo states, and the history window the chart plots. Pure, so the
 * client dashboard and the unit tests share it. Nothing here computes a status from a reading.
 */
import {
  METRICS,
  formatValue,
  metricReading,
  readingFor,
  resolveDayScenario,
  resolveMetricScenario,
  seriesWindow,
  type CrewSeriesField,
  type Metric,
  type MetricId,
  type MetricReading,
  type MetricScenario,
  type MissionDataset,
  type Profile,
  type SeriesPoint,
} from "@/features/crew-health-data";

/** One metric of a profile on one mission day. */
export interface DayReading {
  metric: Metric;
  /** Dataset value; null when the mission dataset has no complete reading for that day. */
  value: MetricReading;
  /** Display text; "Unknown" when the value is missing. */
  formatted: string;
  /** Fictional baseline context of the metric with the authored state of that day. */
  scenario: MetricScenario;
}

/** Dataset column behind each single-value metric. SpO₂, activity, and stress are not recorded. */
const SERIES_FIELD: Partial<Record<MetricId, CrewSeriesField>> = {
  heartRate: "heartRate",
  temperature: "temperature",
  sleep: "sleep",
  mood: "mood",
  glucose: "glucose",
  radiation: "radiation",
};

/** Mission day requested by the `?day=` parameter; the latest day when it is missing or not a number. */
export function parseDayParam(raw: string | null, total: number): number {
  const latest = Math.max(Math.trunc(total) || 0, 1);
  const text = raw?.trim();
  if (!text) return latest;
  const value = Number(text);
  if (!Number.isFinite(value)) return latest;
  return Math.min(Math.max(Math.round(value), 1), latest);
}

/** The dataset narrowed to one crew member: the full timeline, their series, and their events. */
export function crewDataset(data: MissionDataset, crewId: string): MissionDataset {
  const series = data.crew[crewId];
  return {
    days: data.days,
    crew: series ? { [crewId]: series } : {},
    events: data.events.filter((event) => event.crewId === crewId),
  };
}

/** The ten profile metrics on a mission day, in `METRICS` order. Missing readings resolve to "Unknown". */
export function dayReadings(data: MissionDataset, person: Profile, day: number): DayReading[] {
  const reading = readingFor(data, person.id, day);
  return METRICS.map((metric) => {
    const value = metricReading(reading, metric.id);
    const context = resolveMetricScenario(person.id, metric.id, value);
    const { status, label } = resolveDayScenario(person.id, metric.id, day, value);
    return { metric, value, formatted: formatValue(metric.id, value), scenario: { ...context, status, label } };
  });
}

/** A reading with its unit, e.g. "61 bpm". A missing reading stays "Unknown", with no unit attached. */
export function readingText({ metric, formatted }: DayReading): string {
  return formatted === "Unknown" ? formatted : `${formatted} ${metric.unit}`;
}

/**
 * Chart points for the `length` days ending at `day` (clipped at mission day 1). Days without a
 * complete reading are left out, and metrics the dataset does not record return no points.
 */
export function daySeries(data: MissionDataset, crewId: string, metricId: MetricId, day: number, length: number): SeriesPoint[] {
  const valuesOf = (field: CrewSeriesField) => seriesWindow(data, crewId, field, day, length);
  const dated = (values: readonly MetricReading[]): SeriesPoint[] => {
    // seriesWindow ends at `day`, or at the last mission day when `day` is beyond it.
    const firstIndex = Math.min(day, data.days.length) - values.length;
    return values.flatMap((value, offset) => {
      const date = data.days[firstIndex + offset]?.date;
      return value === null || date === undefined ? [] : [{ date, value }];
    });
  };

  if (metricId === "bloodPressure") {
    const diastolic = valuesOf("diastolic");
    return dated(
      valuesOf("systolic").map((systolic, index) => {
        const paired = diastolic[index] ?? null;
        return systolic !== null && paired !== null ? { systolic, diastolic: paired } : null;
      }),
    );
  }
  const field = SERIES_FIELD[metricId];
  return field ? dated(valuesOf(field)) : [];
}
