"use client";

import type { MouseEvent } from "react";
import { eventLabel, type CrewEvent, type MissionDay, type MissionPhase, type Profile } from "@/features/crew-health-data";
import { PanelHeading } from "@/shared/design-system";
import { cn } from "@/shared/lib/cn";
import { blackoutSegments, clampDay, commLabel, dayFromRatio, dayPosition, formatMissionDate, phaseLabel, phaseSegments } from "../lib/phase";

/**
 * Phase visuals from existing chart/console tokens: `fill` paints the progress bar and `glow` is the
 * gradient that rises above a multi-day phase and carries its name. Single-day milestones render as dark ticks.
 */
const PHASE_STYLE: Readonly<Record<MissionPhase, { fill: string; glow: string }>> = {
  transit_out: { fill: "bg-chart-primary", glow: "from-chart-primary/40" },
  mars_arrival: { fill: "bg-console", glow: "from-console/30" },
  surface: { fill: "bg-chart-secondary", glow: "from-chart-secondary/40" },
  mars_departure: { fill: "bg-console", glow: "from-console/30" },
  transit_return: { fill: "bg-chart-bar", glow: "from-chart-bar/50" },
  landed: { fill: "bg-console", glow: "from-console/30" },
};

const STEP_BUTTON =
  "grid size-8 cursor-pointer place-items-center rounded-md border border-border bg-surface-subtle p-0 text-caption font-bold text-text-strong hover:border-hover-border disabled:cursor-not-allowed disabled:text-muted";

interface MissionDaySelectorProps {
  days: readonly MissionDay[];
  events: readonly CrewEvent[];
  /** Crew profiles used to name the crew members in event marker descriptions. */
  crew?: readonly Pick<Profile, "id" | "name">[];
  value: number;
  onChange: (day: number) => void;
}

function describeDay(info: MissionDay | undefined): string {
  if (!info) return "Unknown day";
  return `Day #${info.day} · ${formatMissionDate(info.date)}`;
}

/** Controlled mission-day picker: labelled phase band flanked by ±1 day buttons, plus scenario event markers. */
export function MissionDaySelector({ days, events, crew = [], value, onChange }: MissionDaySelectorProps) {
  const total = days.length;
  const day = clampDay(value, total);
  const info = days[day - 1];
  const segments = phaseSegments(days);
  const blackouts = blackoutSegments(days);
  const eventDays = [...new Set(events.map((event) => event.day))].filter((eventDay) => eventDay >= 1 && eventDay <= total);
  const nameOf = (crewId: string) => crew.find((person) => person.id === crewId)?.name ?? crewId;
  const select = (next: number) => onChange(clampDay(next, total));

  const selectFromBand = (event: MouseEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    if (rect.width > 0) select(dayFromRatio((event.clientX - rect.left) / rect.width, total));
  };

  if (!info) return null;

  return (
    <section
      id="mission-day-selector"
      aria-labelledby="mission-day-title"
      data-selected-day={day}
      data-phase={info.phase}
      data-comm={info.comm}
      className="mb-7 min-w-0 rounded-xl border border-border bg-surface p-5 max-sm:p-4"
    >
      <PanelHeading
        eyebrow={`UMBRAL MISSION TIMELINE · ${total} DAYS`}
        title="Mission day"
        titleId="mission-day-title"
        className="mb-3 flex-wrap"
        actions={
          <div className="flex items-center gap-1.5" role="group" aria-label="Step one day">
            <button
              type="button"
              id="mission-day-prev"
              aria-label="Previous day"
              disabled={day <= 1}
              onClick={() => select(day - 1)}
              className="min-h-8 min-w-8 cursor-pointer rounded-sm border border-border bg-surface-subtle px-2 text-caption font-bold text-text-strong hover:border-hover-border disabled:cursor-not-allowed disabled:text-muted"
            >
              ◀
            </button>
            <button
              type="button"
              id="mission-day-next"
              aria-label="Next day"
              disabled={day >= total}
              onClick={() => select(day + 1)}
              className="min-h-8 min-w-8 cursor-pointer rounded-sm border border-border bg-surface-subtle px-2 text-caption font-bold text-text-strong hover:border-hover-border disabled:cursor-not-allowed disabled:text-muted"
            >
              ▶
            </button>
          </div>
        }
      />

      <p id="mission-day-readout" aria-live="polite" className="mb-3 text-body font-semibold text-text-strong tabular-nums">
        {describeDay(info)}
      </p>

      <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-end gap-x-2 max-sm:gap-x-1.5">
        <button type="button" id="mission-day-prev" aria-label="Previous day" disabled={day <= 1} onClick={() => select(day - 1)} className={STEP_BUTTON}>
          ◀
        </button>

        {/* The ring shows while the visually hidden range input (the keyboard and screen-reader control) has focus. */}
        <div className="relative min-w-0 rounded-md focus-within:outline-3 focus-within:outline-offset-3 focus-within:outline-primary">
          {/* Pointer shortcut: each day owns an equal horizontal slot of the band. */}
          <div id="mission-phase-band" aria-hidden="true" onClick={selectFromBand} className="cursor-pointer">
            <div className="flex h-10">
              {segments.map((segment) => {
                const multiDay = segment.count > 1;
                const current = day >= segment.startDay && day <= segment.endDay;
                return (
                  <span
                    key={`label-${segment.phase}-${segment.startDay}`}
                    data-phase-label={multiDay ? segment.phase : undefined}
                    className="relative min-w-0"
                    style={{ flexGrow: segment.count, flexBasis: 0 }}
                  >
                    {multiDay ? (
                      <>
                        <span className={cn("absolute inset-0 rounded-t-md bg-linear-to-t", PHASE_STYLE[segment.phase].glow, !current && "opacity-50")} />
                        <span
                          className={cn(
                            "absolute inset-x-0 bottom-0 truncate px-1.5 pb-1 text-center text-caption max-sm:text-xs",
                            current ? "font-bold text-text-strong" : "font-semibold text-text-secondary",
                          )}
                        >
                          {phaseLabel(segment.phase)}
                        </span>
                      </>
                    ) : null}
                  </span>
                );
              })}
            </div>

            <div className="relative">
              <div className="relative h-8 overflow-hidden rounded-md bg-surface-muted">
                <div className="flex h-full w-full">
                  {segments.map((segment) => (
                    <span
                      key={`${segment.phase}-${segment.startDay}`}
                      data-phase-segment={segment.phase}
                      className={cn("h-full min-w-0", segment.count > 1 ? PHASE_STYLE[segment.phase].fill : "bg-transparent")}
                      style={{ flexGrow: segment.count, flexBasis: 0 }}
                    />
                  ))}
                </div>
                {blackouts.map((span) => (
                  <span
                    key={`blackout-${span.startDay}`}
                    data-blackout={`${span.startDay}-${span.endDay}`}
                    className="absolute inset-y-0 min-w-1 bg-status-unknown-soft"
                    style={{ left: `${((span.startDay - 1) / total) * 100}%`, width: `${(span.count / total) * 100}%` }}
                  />
                ))}
                {segments
                  .filter((segment) => segment.count === 1)
                  .map((segment) => (
                    <span
                      key={`milestone-${segment.startDay}`}
                      data-phase-milestone={segment.phase}
                      className={cn("absolute inset-y-0 w-1 -translate-x-1/2", PHASE_STYLE[segment.phase].fill)}
                      style={{ left: `${dayPosition(segment.startDay, total)}%` }}
                    />
                  ))}
              </div>
              <span
                className="pointer-events-none absolute -top-1 -bottom-1 w-0.75 -translate-x-1/2 rounded-xs bg-text-strong"
                style={{ left: `${dayPosition(day, total)}%` }}
              />
            </div>
          </div>

          <label htmlFor="mission-day-range" className="sr-only">
            Mission day
          </label>
          <input
            id="mission-day-range"
            type="range"
            min={1}
            max={total}
            step={1}
            value={day}
            aria-valuetext={describeDay(info)}
            onChange={(event) => select(Number(event.target.value))}
            className="sr-only"
          />
        </div>

        <button type="button" id="mission-day-next" aria-label="Next day" disabled={day >= total} onClick={() => select(day + 1)} className={STEP_BUTTON}>
          ▶
        </button>

        <div className="relative col-start-2 mt-1 h-7" aria-label="Scenario events" role="group">
          {eventDays.map((eventDay) => {
            const dayEvents = events.filter((event) => event.day === eventDay);
            const kinds = [...new Set(dayEvents.map((event) => eventLabel(event.event)))].join(", ");
            const detail = dayEvents.map((event) => `${nameOf(event.crewId)}: ${eventLabel(event.event)} — ${event.detail}`).join("\n");
            const selected = eventDay === day;
            return (
              <button
                key={eventDay}
                type="button"
                data-event-day={eventDay}
                aria-pressed={selected}
                aria-label={`Jump to day ${eventDay}: ${kinds}`}
                title={`Day ${eventDay} · ${detail}`}
                onClick={() => select(eventDay)}
                className="absolute top-0 grid size-7 -translate-x-1/2 cursor-pointer place-items-center rounded-full border-0 bg-transparent p-0"
                style={{ left: `${dayPosition(eventDay, total)}%` }}
              >
                <span
                  aria-hidden="true"
                  className={cn("block size-3 rotate-45 rounded-xs border-2 border-surface", selected ? "bg-primary shadow-selected" : "bg-text-strong")}
                />
              </button>
            );
          })}
        </div>
      </div>

      <ul className="m-0 mt-3 flex list-none flex-wrap gap-x-2 gap-y-1.5 p-0" aria-label="Mission phases">
        {segments.map((segment) => (
          <li key={`legend-${segment.phase}-${segment.startDay}`}>
            <button
              type="button"
              data-phase-jump={segment.phase}
              aria-pressed={info.phase === segment.phase}
              onClick={() => select(segment.startDay)}
              className={cn(
                "inline-flex min-h-7 cursor-pointer items-center gap-1.5 rounded-sm border px-2 py-0.5 text-xs font-semibold text-text-secondary",
                info.phase === segment.phase ? "border-selected-border bg-selected" : "border-border bg-surface",
              )}
            >
              <span aria-hidden="true" className={cn("size-2.5 rounded-xs", PHASE_STYLE[segment.phase].fill)} />
              {phaseLabel(segment.phase)}
              <span className="font-medium text-muted tabular-nums">
                {segment.count > 1 ? `Days ${segment.startDay}–${segment.endDay}` : `Day ${segment.startDay}`}
              </span>
            </button>
          </li>
        ))}
        {blackouts.length ? (
          <li className="inline-flex min-h-7 items-center gap-1.5 px-2 py-0.5 text-xs font-semibold text-text-secondary">
            <span aria-hidden="true" className="size-2.5 rounded-xs border border-border-strong bg-status-unknown-soft" />
            Comm blackout
            <span className="font-medium text-muted tabular-nums">
              {blackouts.map((span) => (span.count > 1 ? `Days ${span.startDay}–${span.endDay}` : `Day ${span.startDay}`)).join(", ")}
            </span>
          </li>
        ) : null}
      </ul>
    </section>
  );
}
