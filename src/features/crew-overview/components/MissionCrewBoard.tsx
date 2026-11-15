"use client";

import { useState, type ReactNode } from "react";
import { PROFILES, eventLabel, eventsOn, readingFor, seriesWindow, type MissionDataset } from "@/features/crew-health-data";
import { MissionDayProvider, MissionDaySelector, formatMissionDate, phaseLabel } from "@/features/mission-timeline";
import { SectionHeading, SegmentedToggle } from "@/shared/design-system";
import { CrewCard, type CrewCardEvent } from "./CrewCard";

function cardEvents(data: MissionDataset, crewId: string, day: number, dailyCode: string | null): CrewCardEvent[] {
  const listed = eventsOn(data, day, crewId).map((event) => ({ code: event.event, label: eventLabel(event.event), detail: event.detail }));
  if (dailyCode && !listed.some((event) => event.code === dailyCode)) {
    listed.push({ code: dailyCode, label: eventLabel(dailyCode), detail: "" });
  }
  return listed;
}

/** A screen the home page can switch to in place, beside the crew cards. */
export interface HomeView {
  id: string;
  label: string;
  /** One line under the switch while this screen is open. */
  hint: string;
  /** When the screen is about one scenario day: opens the mission day of the first event with this code. */
  opensOnEvent?: string;
  content: ReactNode;
}

const CREW_VIEW = { id: "crew", label: "Crew health", hint: "Simulated readings for each crew member on the selected day." } as const;

/** The crew cards for one mission day. */
function CrewGrid({ data, day, description }: { data: MissionDataset; day: number; description: string }) {
  return (
    <>
      <SectionHeading
        className="mb-4"
        title="Mission crew"
        description={description}
        aside={
          <span id="crew-count" className="text-xs font-bold tracking-caps-wide text-text-subtle">
            {PROFILES.length} CREW MEMBERS
          </span>
        }
      />
      <div id="crew-grid" data-selected-day={day} className="grid grid-cols-2 gap-4.5 max-sm:grid-cols-1 lg:grid-cols-4" aria-label="Crew health overview">
        {PROFILES.map((person) => {
          const reading = readingFor(data, person.id, day);
          return (
            <CrewCard
              key={person.id}
              person={person}
              day={day}
              reading={reading}
              heartRateTrend={seriesWindow(data, person.id, "heartRate", day, 7)}
              events={cardEvents(data, person.id, day, reading?.event ?? null)}
            />
          );
        })}
      </div>
    </>
  );
}

/**
 * Mission-day selector plus what it drives: the crew cards, or one of `views` when the visitor switches to it.
 * Every screen follows the same day. Defaults to the last mission day and the crew cards.
 */
export function MissionCrewBoard({ data, views = [] }: { data: MissionDataset; views?: readonly HomeView[] }) {
  const total = data.days.length;
  const [day, setDay] = useState(total);
  const [viewId, setViewId] = useState<string>(CREW_VIEW.id);
  const info = data.days[day - 1];
  const description = info
    ? `Simulated readings · Day ${info.day} · ${formatMissionDate(info.date)} · ${phaseLabel(info.phase)}`
    : "Simulated readings · Day unavailable";
  const active = views.find((view) => view.id === viewId);
  const options = [CREW_VIEW, ...views].map((view) => ({ value: view.id, label: view.label }));

  const selectView = (id: string) => {
    setViewId(id);
    const eventCode = views.find((view) => view.id === id)?.opensOnEvent;
    const event = eventCode ? data.events.find((candidate) => candidate.event === eventCode) : undefined;
    if (event) setDay(event.day);
  };

  return (
    <MissionDayProvider value={{ data, day, onChange: setDay }}>
      {views.length > 0 ? (
        <div className="mb-6 flex flex-wrap items-center gap-x-4 gap-y-2">
          <SegmentedToggle label="Screen" options={options} value={active?.id ?? CREW_VIEW.id} onChange={selectView} dataKey="home-view" />
          <p id="home-view-hint" className="m-0 text-caption text-muted">
            {(active ?? CREW_VIEW).hint}
          </p>
        </div>
      ) : null}
      <MissionDaySelector days={data.days} events={data.events} crew={PROFILES} value={day} onChange={setDay} />
      {active ? <div id={`home-${active.id}-view`}>{active.content}</div> : <CrewGrid data={data} day={day} description={description} />}
    </MissionDayProvider>
  );
}
