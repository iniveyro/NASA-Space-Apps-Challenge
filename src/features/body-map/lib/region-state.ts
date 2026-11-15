/**
 * Groups a profile's signals under the three navigation regions and picks the demo state each
 * region displays. States are the authored scenario states passed in; nothing here is computed
 * from the readings, and a region state is not an organ measurement.
 */
import type { BodyRegion, MetricId, ScenarioStatus } from "@/features/crew-health-data";
import { REGION_METRICS } from "./regions";

export type SignalStatus = ScenarioStatus | "unknown";

export interface RegionSignal {
  metricId: MetricId;
  label: string;
  /** Formatted reading with its unit, e.g. "61 bpm"; "Unknown" when the reading is missing. */
  value: string;
  /** Authored demo state of the signal. */
  status: SignalStatus;
  statusLabel: string;
}

export interface RegionSummary {
  region: BodyRegion;
  /** Most notable authored state among the region's signals; "unknown" when none has a state. */
  status: SignalStatus;
  statusLabel: string;
  /** The region's signals, in the region's metric order. */
  signals: RegionSignal[];
  /** Signals that carry the displayed state when it is a deviation or an alert. */
  notable: RegionSignal[];
}

/** Short metric names for the callouts on the figure, where a full label does not fit. */
export const SHORT_LABELS: Readonly<Record<MetricId, string>> = {
  heartRate: "HR",
  bloodPressure: "BP",
  temperature: "Temp",
  sleep: "Sleep",
  mood: "Mood",
  activity: "Activity",
  spo2: "SpO₂",
  glucose: "Glucose",
  stress: "Stress",
  radiation: "Dose",
};

/** Up to `limit` reading lines for a region's callout: the signals that carry its state first, e.g. "BP 121/70 mmHg". */
export function calloutLines(summary: RegionSummary, limit = 2): string[] {
  const shown = summary.notable.length ? summary.notable : summary.signals;
  return shown.slice(0, limit).map((signal) => `${SHORT_LABELS[signal.metricId]} ${signal.value}`);
}

const ORDER: readonly SignalStatus[] = ["unknown", "within-demo-reference", "demo-deviation", "demo-alert"];
const REGIONS: readonly BodyRegion[] = ["brain", "heart", "body"];

function rank(status: SignalStatus): number {
  return ORDER.indexOf(status);
}

/** One summary per region. Regions without signals read "Unknown". */
export function summarizeRegions(signals: readonly RegionSignal[]): Record<BodyRegion, RegionSummary> {
  const summaries = {} as Record<BodyRegion, RegionSummary>;
  for (const region of REGIONS) {
    const own = REGION_METRICS[region]
      .map((metricId) => signals.find((signal) => signal.metricId === metricId))
      .filter((signal): signal is RegionSignal => signal !== undefined);
    const top = own.reduce<RegionSignal | null>((best, signal) => (best === null || rank(signal.status) > rank(best.status) ? signal : best), null);
    const status = top?.status ?? "unknown";
    summaries[region] = {
      region,
      status,
      statusLabel: top?.statusLabel ?? "Unknown",
      signals: own,
      notable: status === "demo-deviation" || status === "demo-alert" ? own.filter((signal) => signal.status === status) : [],
    };
  }
  return summaries;
}

/** One-line description of a region's state, e.g. "Alert: Blood pressure 121/70 mmHg". */
export function describeRegion(summary: RegionSummary): string {
  if (summary.signals.length === 0) return "No signals for this region.";
  if (summary.notable.length === 0) return `${summary.statusLabel}: ${summary.signals.map((signal) => signal.label.toLowerCase()).join(", ")}.`;
  return `${summary.statusLabel}: ${summary.notable.map((signal) => `${signal.label} ${signal.value}`).join(", ")}.`;
}
