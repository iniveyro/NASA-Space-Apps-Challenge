/**
 * Story beats of the UMBRAL plot, placed on the mission timeline. The wording is authored fiction;
 * every day and figure is looked up in the dataset, so the narrative cannot drift from the data.
 */
import type { CrewEvent } from "@/features/crew-health-data";
import { formatDelay, formatMkm, pluralDays } from "./format";
import { SOLAR_STORM_EVENT, blackoutSpans, delaySeries, farthestDay, firstDay, phaseDay, type MissionGeometry } from "./geometry";

export interface StoryBeat {
  id: string;
  day: number;
  title: string;
  text: string;
  /** Scenario event code from crew_events.csv when the beat is one of the authored events. */
  eventCode?: string;
}

/** Days before the conjunction on which the plot switches monitoring to autonomous mode. */
const AUTONOMY_LEAD_DAYS = 6;
/** Mars solar longitude at which the dust-storm season starts. */
const DUST_SEASON_LS_DEG = 180;

function eventDay(events: readonly CrewEvent[], code: string): number | null {
  return events.find((event) => event.event === code)?.day ?? null;
}

/** Builds the ordered story for a dataset. Beats whose day cannot be found in the data are left out. */
export function buildStory(geometry: MissionGeometry, events: readonly CrewEvent[]): StoryBeat[] {
  const { total, distEarthMkm, distMarsMkm, marsLsDeg } = geometry;
  const delayMin = delaySeries(geometry);
  const delay = (day: number) => formatDelay(delayMin[day - 1]);
  const distance = (day: number) => formatMkm(distEarthMkm[day - 1]);
  const arrival = phaseDay(geometry, "mars_arrival");
  const departure = phaseDay(geometry, "mars_departure");
  const landing = phaseDay(geometry, "landed");
  const outboundEnd = departure ?? total;
  const blackout = blackoutSpans(geometry.comm)[0] ?? null;
  const beats: (StoryBeat | null)[] = [];
  const add = (id: string, day: number | null, build: (day: number) => Omit<StoryBeat, "id" | "day">) => {
    if (day !== null && day >= 1 && day <= total) beats.push({ id, day, ...build(day) });
  };
  const closer = (fromDay: number, toDay: number, toMars: boolean): number | null => {
    for (let day = Math.max(1, fromDay); day <= Math.min(toDay, total); day += 1) {
      const earth = distEarthMkm[day - 1];
      const mars = distMarsMkm[day - 1];
      if (typeof earth !== "number" || typeof mars !== "number") continue;
      if (toMars ? mars < earth : earth < mars) return day;
    }
    return null;
  };

  add("departure", phaseDay(geometry, "transit_out"), () => ({
    title: "Departure",
    text: "The crew leaves for Mars. A reply from Earth still takes seconds.",
  }));
  add("delay-1", firstDay(delayMin, 1, outboundEnd, (value) => value >= 1), () => ({
    title: "The delay passes one minute",
    text: "A signal now needs more than a minute to reach Earth, and as long to come back.",
  }));
  const closerToMars = closer(1, arrival ?? total, true);
  add("closer-to-mars", closerToMars, () => ({
    title: "Closer to Mars than to Earth",
    text: "From here on, the destination is nearer than home.",
  }));
  add("viral-reactivation", eventDay(events, "viral_reactivation"), (day) => ({
    title: "A deviation from his own baseline",
    text: `Scenario event. The on-board monitor flags Kanji's resting heart rate against his personal baseline. A report takes ${delay(day)} to reach Earth and the reply takes as long to come back, so the crew acts first.`,
    eventCode: "viral_reactivation",
  }));
  add("delay-5", firstDay(delayMin, 1, outboundEnd, (value) => value >= 5), () => ({
    title: "The delay passes 5 minutes",
    text: "A conversation with Earth is no longer possible: every exchange is a message and a wait.",
  }));
  add("delay-10", firstDay(delayMin, 1, outboundEnd, (value) => value >= 10), () => ({
    title: "The delay passes 10 minutes",
    text: "A question sent now gets its answer more than 20 minutes later.",
  }));
  add("mars-arrival", arrival, (day) => ({
    title: "Arrival at Mars",
    text: `After ${pluralDays(day - 1)} in microgravity the crew lands at Arcadia Planitia, ${distance(day)} from Earth, and runs standing checks before leaving the lander.`,
    eventCode: "orthostatic_test",
  }));
  add("delay-15", firstDay(delayMin, 1, outboundEnd, (value) => value >= 15), () => ({
    title: "Half an hour per answer",
    text: "The one-way delay passes 15 minutes: every question now waits half an hour for its answer.",
  }));
  add(
    "dust-season",
    arrival === null ? null : firstDay(marsLsDeg, arrival, outboundEnd, (value) => value >= DUST_SEASON_LS_DEG),
    () => ({
      title: "Dust-storm season begins",
      text: "Mars reaches solar longitude 180°. Less sunlight reaches the surface and the crew spends more time indoors.",
    }),
  );
  if (blackout) {
    const linkBack = blackout.endDay + 1;
    add("autonomous-mode", blackout.startDay - AUTONOMY_LEAD_DAYS, () => ({
      title: "Last full downlink",
      text: `${AUTONOMY_LEAD_DAYS} days before the conjunction the crew sends the last complete data set and each person's baseline is fixed. Monitoring switches to autonomous mode.`,
    }));
    add("blackout", blackout.startDay, () => ({
      title: "Behind the Sun",
      text: `Solar conjunction: the Sun sits between Mars and Earth and the link is lost for ${pluralDays(blackout.count)}.`,
    }));
    add("solar-storm", eventDay(events, SOLAR_STORM_EVENT), (day) => ({
      title: "A solar storm, and no link",
      text:
        linkBack > day
          ? `Scenario event. Inés and Sofía are on a surface walk 1.2 km from the habitat when the radiation sensor rises. The crew handles it with on-board monitoring: Earth cannot be reached for another ${pluralDays(linkBack - day)}.`
          : "Scenario event. Inés and Sofía are on a surface walk 1.2 km from the habitat when the radiation sensor rises.",
      eventCode: SOLAR_STORM_EVENT,
    }));
    add("link-returns", linkBack, (day) => ({
      title: "The link returns",
      text: `The queued reports go out by priority, the storm first. They reach Earth ${delay(day)} later, when the storm is long over.`,
    }));
  }
  add("farthest", farthestDay(geometry), (day) => ({
    title: "Farthest from Earth",
    text: `${distance(day)} away. A signal needs ${delay(day)} each way, the longest of the mission.`,
  }));
  add("mars-departure", departure, (day) => ({
    title: "Departure from Mars",
    text: `After ${pluralDays(day - (arrival ?? day))} on the surface the crew starts the cruise home, and the delay begins to fall.`,
  }));
  if (departure !== null) {
    add("closer-to-earth", closer(departure, total, false), () => ({
      title: "Closer to Earth again",
      text: closerToMars === null ? "Home is nearer than Mars again." : `For the first time since day ${closerToMars}, home is nearer than Mars.`,
    }));
    add("delay-below-1", firstDay(delayMin, departure, total, (value) => value < 1), () => ({
      title: "The threshold, crossed back",
      text: "A reply from Earth takes less than a minute again.",
    }));
  }
  add("landing", landing, (day) => ({
    title: "Landing",
    text: `${pluralDays(day)} after departure the crew is back on Earth. Their record becomes the baseline for the next crew.`,
  }));

  return beats.filter((beat): beat is StoryBeat => beat !== null).sort((a, b) => a.day - b.day);
}

/** The beat in force on a mission day: the latest beat at or before it. */
export function beatFor(story: readonly StoryBeat[], day: number): StoryBeat | null {
  let current: StoryBeat | null = null;
  for (const beat of story) {
    if (beat.day <= day) current = beat;
  }
  return current;
}
