"use client";

import { useState } from "react";
import { PROFILES, eventLabel, eventsOn, readingFor, seriesWindow, type MissionDataset } from "@/features/crew-health-data";
import { MissionDaySelector, formatMissionDate, phaseLabel } from "@/features/mission-timeline";
import { SectionHeading } from "@/shared/design-system";
import { CrewCard, type CrewCardEvent } from "./CrewCard";

function cardEvents(data: MissionDataset, crewId: string, day: number, dailyCode: string | null): CrewCardEvent[] {
  const listed = eventsOn(data, day, crewId).map((event) => ({ code: event.event, label: eventLabel(event.event), detail: event.detail }));
  if (dailyCode && !listed.some((event) => event.code === dailyCode)) {
    listed.push({ code: dailyCode, label: eventLabel(dailyCode), detail: "" });
  }
  return listed;
}

/** Mission-day selector plus the crew cards it drives. Defaults to the last mission day. */
export function MissionCrewBoard({ data }: { data: MissionDataset }) {
  const total = data.days.length;
  const [day, setDay] = useState(total);
  const info = data.days[day - 1];
  const description = info
    ? `Simulated readings · Day ${info.day} · ${formatMissionDate(info.date)} · ${phaseLabel(info.phase)}`
    : "Simulated readings · Day unavailable";

  return (
    <>
      <MissionDaySelector days={data.days} events={data.events} crew={PROFILES} value={day} onChange={setDay} />
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
