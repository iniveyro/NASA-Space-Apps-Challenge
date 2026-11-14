import type { CommStatus, MissionDay, MissionPhase } from "@/features/crew-health-data";

export interface PhaseSegment {
  phase: MissionPhase;
  startDay: number;
  endDay: number;
  count: number;
}

export interface DaySpan {
  startDay: number;
  endDay: number;
  count: number;
}

const PHASE_LABELS: Readonly<Record<MissionPhase, string>> = {
  transit_out: "Transit out",
  mars_arrival: "Mars arrival",
  surface: "Mars surface",
  mars_departure: "Mars departure",
  transit_return: "Transit return",
  landed: "Landed",
};

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** Consecutive runs of the same phase, in mission order. */
export function phaseSegments(days: readonly MissionDay[]): PhaseSegment[] {
  const segments: PhaseSegment[] = [];
  for (const { day, phase } of days) {
    const last = segments.at(-1);
    if (last && last.phase === phase && last.endDay === day - 1) {
      last.endDay = day;
      last.count += 1;
    } else {
      segments.push({ phase, startDay: day, endDay: day, count: 1 });
    }
  }
  return segments;
}

/** Consecutive runs of communication blackout days. */
export function blackoutSegments(days: readonly MissionDay[]): DaySpan[] {
  const spans: DaySpan[] = [];
  for (const { day, comm } of days) {
    if (comm !== "blackout") continue;
    const last = spans.at(-1);
    if (last && last.endDay === day - 1) {
      last.endDay = day;
      last.count += 1;
    } else {
      spans.push({ startDay: day, endDay: day, count: 1 });
    }
  }
  return spans;
}

export function clampDay(day: number, total: number): number {
  const rounded = Number.isFinite(day) ? Math.round(day) : 1;
  return Math.min(Math.max(rounded, 1), Math.max(total, 1));
}

/** Day under a pointer at `ratio` (0–1) of the band width; each day owns an equal slot. */
export function dayFromRatio(ratio: number, total: number): number {
  if (!Number.isFinite(ratio)) return 1;
  return clampDay(Math.floor(ratio * total) + 1, total);
}

/** Horizontal centre of a day's slot, in percent of the band width. */
export function dayPosition(day: number, total: number): number {
  return ((clampDay(day, total) - 0.5) / Math.max(total, 1)) * 100;
}

export function phaseLabel(phase: MissionPhase): string {
  return PHASE_LABELS[phase] ?? "Unknown phase";
}

export function commLabel(comm: CommStatus): string {
  if (comm === "blackout") return "Comm blackout";
  if (comm === "link") return "Link";
  return "Link unknown";
}

/** ISO `YYYY-MM-DD` → "12 Jun 2027", locale- and timezone-independent (stable across server and client). */
export function formatMissionDate(isoDate: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate);
  const month = match ? MONTHS[Number(match[2]) - 1] : undefined;
  if (!match || !month) return "Unknown date";
  return `${Number(match[3])} ${month} ${match[1]}`;
}
