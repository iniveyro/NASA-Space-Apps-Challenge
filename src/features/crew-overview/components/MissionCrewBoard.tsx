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

type HomeView = "crew" | "mission";

const VIEW_OPTIONS = [
  { value: "crew", label: "Crew health" },
  { value: "mission", label: "Mission in 3D" },
] as const;

const VIEW_HINT: Readonly<Record<HomeView, string>> = {
  crew: "Simulated readings for each crew member on the selected day.",
  mission: "Where the crew is on the selected day, and how long a signal takes to reach Earth.",
};

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
      <div id="crew-grid" data-selected-day={day} className="grid grid-cols-1 gap-4.5 sm:grid-cols-2" aria-label="Crew health overview">
        {PROFILES.map((person) => {
          const reading = readingFor(data, person.id, day);
          return (
            <CrewCard
              key={person.id}
              person={person}
              day={day}
              reading={reading}
              trends={{
                heartRate: [{ label: "heart rate", values: seriesWindow(data, person.id, "heartRate", day, 7) }],
                bloodPressure: [
                  { label: "systolic", values: seriesWindow(data, person.id, "systolic", day, 7) },
                  { label: "diastolic", values: seriesWindow(data, person.id, "diastolic", day, 7) },
                ],
                temperature: [{ label: "temperature", values: seriesWindow(data, person.id, "temperature", day, 7) }],
                radiation: [{ label: "cumulative dose", values: seriesWindow(data, person.id, "radiation", day, 7) }],
              }}
              events={cardEvents(data, person.id, day, reading?.event ?? null)}
            />
          );
        })}
      </div>
    </>
  );
}

/**
 * Mission-day selector plus what it drives: the crew cards, or the mission view (`mission`) when the visitor
 * switches to it. Both follow the same day. Defaults to the last mission day and the crew cards.
 */
export function MissionCrewBoard({ data, mission }: { data: MissionDataset; mission?: ReactNode }) {
  const total = data.days.length;
  const [day, setDay] = useState(total);
  const [view, setView] = useState<HomeView>("crew");
  const info = data.days[day - 1];
  const description = info
    ? `Simulated readings · Day ${info.day} · ${formatMissionDate(info.date)} · ${phaseLabel(info.phase)}`
    : "Simulated readings · Day unavailable";

  return (
    <MissionDayProvider value={{ data, day, onChange: setDay }}>
      {mission ? (
        <div className="mb-6 flex flex-wrap items-center gap-x-4 gap-y-2">
          <SegmentedToggle label="Screen" options={VIEW_OPTIONS} value={view} onChange={setView} dataKey="home-view" />
          <p id="home-view-hint" className="m-0 text-caption text-muted">
            {VIEW_HINT[view]}
          </p>
        </div>
      ) : null}
      <MissionDaySelector days={data.days} events={data.events} crew={PROFILES} value={day} onChange={setDay} />
      {mission && view === "mission" ? <div id="home-mission-view">{mission}</div> : <CrewGrid data={data} day={day} description={description} />}
    </MissionDayProvider>
  );
}
