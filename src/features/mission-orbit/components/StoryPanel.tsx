"use client";

import { useEffect, useRef } from "react";
import { PROFILES, eventLabel, type CrewEvent } from "@/features/crew-health-data";
import { formatMissionDate } from "@/features/mission-timeline";
import { Panel, PanelHeading } from "@/shared/design-system";
import { cn } from "@/shared/lib/cn";
import { beatFor, type StoryBeat } from "../lib/story";

interface StoryPanelProps {
  story: readonly StoryBeat[];
  events: readonly CrewEvent[];
  /** ISO dates per mission day (index `day - 1`). */
  dates: readonly string[];
  day: number;
  onSelectDay: (day: number) => void;
  className?: string;
}

const stepButton =
  "min-h-8 cursor-pointer rounded-sm border border-border bg-surface-subtle px-2.5 text-caption font-bold text-text-strong hover:border-hover-border disabled:cursor-not-allowed disabled:text-muted";

function crewName(crewId: string): string {
  return PROFILES.find((person) => person.id === crewId)?.name ?? crewId;
}

/** The plot beat in force on the selected day, plus the full beat list as a jump menu. */
export function StoryPanel({ story, events, dates, day, onSelectDay, className }: StoryPanelProps) {
  const current = beatFor(story, day);
  const position = current ? story.indexOf(current) : -1;
  const previous = position > 0 ? story[position - 1] : null;
  const next = story.find((beat) => beat.day > day) ?? null;
  const details = current?.eventCode ? events.filter((event) => event.day === current.day && event.event === current.eventCode) : [];
  const listRef = useRef<HTMLOListElement>(null);
  const currentId = current?.id;

  // Keep the beat in force visible inside the list, without scrolling the page itself.
  useEffect(() => {
    const list = listRef.current;
    const active = list?.querySelector<HTMLElement>('[aria-pressed="true"]');
    if (!list || !active) return;
    const frame = list.getBoundingClientRect();
    const item = active.getBoundingClientRect();
    if (item.top < frame.top) list.scrollTop -= frame.top - item.top + 4;
    else if (item.bottom > frame.bottom) list.scrollTop += item.bottom - frame.bottom + 4;
  }, [currentId]);

  return (
    <Panel id="story-panel" aria-labelledby="story-title" data-beat={current?.id ?? ""} className={className}>
      <PanelHeading
        eyebrow={current ? `MISSION STORY · BEAT ${position + 1} OF ${story.length}` : "MISSION STORY"}
        title={current?.title ?? "Before departure"}
        titleId="story-title"
        className="flex-wrap"
        actions={
          <div className="flex items-center gap-1.5" role="group" aria-label="Step through the story">
            <button type="button" id="story-prev" disabled={!previous} onClick={() => previous && onSelectDay(previous.day)} className={stepButton}>
              ◀ <span className="sr-only">Previous beat</span>
            </button>
            <button type="button" id="story-next" disabled={!next} onClick={() => next && onSelectDay(next.day)} className={stepButton}>
              <span className="sr-only">Next beat</span> ▶
            </button>
          </div>
        }
      />
      {current ? (
        <div aria-live="polite">
          <p className="mt-2 mb-0 text-caption font-semibold text-text-subtle tabular-nums">
            Day {current.day} · {formatMissionDate(dates[current.day - 1] ?? "")}
            {current.day !== day ? ` · in force on day ${day}` : ""}
          </p>
          <p id="story-text" className="mt-1.75 mb-0 text-body text-text-secondary">
            {current.text}
          </p>
          {details.length ? (
            <ul className="m-0 mt-2.5 flex list-none flex-col gap-1 p-0" aria-label={`Scenario event · ${eventLabel(current.eventCode ?? "")}`}>
              {details.map((event) => (
                <li key={event.crewId} data-story-event={event.crewId} className="rounded-r-xs border-l-3 border-status-unknown bg-surface-subtle px-2.5 py-1.5 text-caption text-text-subtle">
                  <strong className="font-bold text-text-strong">{crewName(event.crewId)}</strong> · {event.detail}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
      <ol ref={listRef} className="m-0 mt-3.5 flex max-h-56 list-none flex-col gap-1 overflow-y-auto border-t border-divider p-0 pt-3" aria-label="Story beats">
        {story.map((beat) => {
          const active = beat === current;
          return (
            <li key={beat.id}>
              <button
                type="button"
                data-beat-day={beat.day}
                data-beat-id={beat.id}
                aria-pressed={active}
                onClick={() => onSelectDay(beat.day)}
                className={cn(
                  "flex min-h-8 w-full cursor-pointer items-baseline gap-2.5 rounded-sm border px-2.5 py-1 text-left text-caption",
                  active ? "border-selected-border bg-selected text-text-strong" : "border-transparent bg-transparent text-text-secondary hover:border-hover-border hover:bg-primary-soft",
                )}
              >
                <span className="w-13 flex-none font-semibold text-muted tabular-nums">Day {beat.day}</span>
                <span className="font-semibold">{beat.title}</span>
              </button>
            </li>
          );
        })}
      </ol>
      <p className="mt-3 mb-0 text-caption text-muted">Fictional plot. Days, distances and delays are read from the mission dataset.</p>
    </Panel>
  );
}
