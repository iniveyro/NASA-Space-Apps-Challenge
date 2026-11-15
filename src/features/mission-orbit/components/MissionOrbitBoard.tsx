"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { PROFILES } from "@/features/crew-health-data";
import { MissionDaySelector, formatMissionDate } from "@/features/mission-timeline";
import { Panel, PanelHeading, SegmentedToggle } from "@/shared/design-system";
import { cn } from "@/shared/lib/cn";
import { formatDelay, pluralDays } from "../lib/format";
import { SOLAR_STORM_EVENT, clampDay, delayMinutes, delaySeries, linkOutlook } from "../lib/geometry";
import type { MissionView } from "../lib/mission-view.server";
import { viewForPhase, type CameraView } from "../lib/scene-math";
import { usePrefersReducedMotion, useWebglSupport } from "../lib/use-media";
import { CrewDayPanel } from "./CrewDayPanel";
import { LinkReadout } from "./LinkReadout";
import { OrbitViewport } from "./OrbitViewport";
import { StoryPanel } from "./StoryPanel";

type ViewChoice = "auto" | CameraView;

const VIEW_OPTIONS: ReadonlyArray<{ value: ViewChoice; label: string }> = [
  { value: "auto", label: "Auto" },
  { value: "overview", label: "Overview" },
  { value: "mars", label: "Mars" },
  { value: "crew", label: "Crew" },
];
const MODE_OPTIONS = [
  { value: "3d", label: "3D" },
  { value: "2d", label: "2D" },
] as const;
const SPEED_OPTIONS = [
  { value: 30, label: "1×" },
  { value: 90, label: "3×" },
] as const;
/** Milliseconds the time-lapse rests on each story beat so it can be read. */
const BEAT_HOLD_MS = 1400;

const toolbarButton =
  "inline-flex min-h-8 cursor-pointer items-center gap-1.5 rounded-sm border border-border bg-surface-subtle px-3 text-caption font-bold text-text-strong hover:border-hover-border";

/** Interactive mission view: day selector, 3D scene, Earth-link readout, story, and crew readings. */
export function MissionOrbitBoard({ data, geometry, story }: MissionView) {
  const total = geometry.total;
  const params = useSearchParams();
  const [day, setDay] = useState(() => clampDay(Number(params.get("day") ?? 1), total));
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState<30 | 90>(30);
  const [viewChoice, setViewChoice] = useState<ViewChoice>("auto");
  const [viewNonce, setViewNonce] = useState(0);
  const [modeChoice, setModeChoice] = useState<"3d" | "2d" | null>(null);
  const [sceneKey, setSceneKey] = useState(0);
  const [fallbackReason, setFallbackReason] = useState<"slow" | "unavailable" | null>(null);
  const reducedMotion = usePrefersReducedMotion();
  const webgl = useWebglSupport();
  const dayRef = useRef(day);
  const touched = useRef(false);

  const mode: "3d" | "2d" = !webgl || fallbackReason === "unavailable" ? "2d" : (modeChoice ?? (fallbackReason === "slow" ? "2d" : "3d"));
  const phase = geometry.phase[day - 1];
  const view: CameraView = viewChoice === "auto" ? viewForPhase(phase) : viewChoice;
  const beatDays = useMemo(() => story.map((beat) => beat.day), [story]);
  const delays = useMemo(() => delaySeries(geometry), [geometry]);
  const maxRoundTripMin = useMemo(() => Math.max(0, ...delays.map((value) => (value ?? 0) * 2)), [delays]);
  const storm = data.events.some((event) => event.day === day && event.event === SOLAR_STORM_EVENT);

  useEffect(() => {
    dayRef.current = day;
  }, [day]);

  // Shareable deep link: once the visitor has picked a day, keep it in the address bar.
  useEffect(() => {
    if (playing || !touched.current) return;
    const url = new URL(window.location.href);
    if (url.searchParams.get("day") === String(day)) return;
    url.searchParams.set("day", String(day));
    window.history.replaceState(null, "", url);
  }, [day, playing]);

  // Time-lapse: advance the day at a steady rate and rest briefly on each story beat.
  useEffect(() => {
    if (!playing) return;
    let frame = 0;
    let last = performance.now();
    let carry = 0;
    let holdUntil = 0;
    const tick = (now: number) => {
      const elapsed = Math.min(0.1, (now - last) / 1000);
      last = now;
      if (now >= holdUntil) {
        carry += elapsed * speed;
        const steps = Math.floor(carry);
        if (steps > 0) {
          carry -= steps;
          const current = dayRef.current;
          let next = Math.min(total, current + steps);
          const beat = beatDays.find((beatDay) => beatDay > current && beatDay <= next);
          if (beat !== undefined) {
            next = beat;
            carry = 0;
            holdUntil = now + BEAT_HOLD_MS * (30 / speed);
          }
          dayRef.current = next;
          setDay(next);
          if (next >= total) {
            setPlaying(false);
            return;
          }
        }
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [playing, speed, total, beatDays]);

  const selectDay = (next: number) => {
    touched.current = true;
    setPlaying(false);
    setDay(clampDay(next, total));
  };

  const togglePlay = () => {
    touched.current = true;
    if (!playing && day >= total) {
      dayRef.current = 1;
      setDay(1);
    }
    setPlaying(!playing);
  };

  const chooseMode = (next: "3d" | "2d") => {
    if (next === "3d" && mode !== "3d") setSceneKey((key) => key + 1);
    setModeChoice(next);
    if (next === "3d" && fallbackReason === "slow") setFallbackReason(null);
  };

  const delay = delayMinutes(geometry, day);
  const outlook = linkOutlook(geometry, day);
  const linkNote =
    outlook.state === "blackout"
      ? `No Earth link on this day. These readings stay on board until the link returns${outlook.linkReturnsDay ? ` on ${formatMissionDate(geometry.date[outlook.linkReturnsDay - 1])}, in ${pluralDays(outlook.daysUntilLink ?? 0)}` : ""}.`
      : delay === null
        ? "Link state unknown for this day."
        : `Earth sees these readings ${formatDelay(delay)} after the crew does, and its answer takes as long to come back.`;

  return (
    <div id="mission-orbit-board" data-selected-day={day} data-comm={geometry.comm[day - 1]} data-phase={phase ?? ""} data-playing={playing}>
      <MissionDaySelector days={data.days} events={data.events} crew={PROFILES} value={day} onChange={selectDay} />

      <div className="grid grid-cols-[minmax(0,1fr)_minmax(280px,340px)] items-start gap-4 max-md:grid-cols-1">
        <Panel id="orbit-panel" aria-labelledby="orbit-title">
          <PanelHeading
            eyebrow="HELIOCENTRIC VIEW · POSITIONS FROM EPHEMERIDES"
            title="Where the crew is"
            titleId="orbit-title"
            className="flex-wrap"
            actions={webgl ? <SegmentedToggle label="Rendering" options={MODE_OPTIONS} value={mode} onChange={chooseMode} dataKey="mode" /> : null}
          />
          <div className="mt-3 mb-3 flex flex-wrap items-center gap-x-3 gap-y-2">
            <button type="button" id="mission-play" aria-pressed={playing} onClick={togglePlay} className={cn(toolbarButton, playing && "border-selected-border bg-selected")}>
              <span aria-hidden="true">{playing ? "❚❚" : "▶"}</span>
              {playing ? "Pause" : day >= total ? "Replay mission" : "Play mission"}
            </button>
            <SegmentedToggle label="Time-lapse speed" options={SPEED_OPTIONS} value={speed} onChange={setSpeed} dataKey="speed" />
            {mode === "3d" ? (
              <SegmentedToggle
                label="Camera view"
                options={VIEW_OPTIONS}
                value={viewChoice}
                onChange={(next) => {
                  setViewChoice(next);
                  setViewNonce((nonce) => nonce + 1);
                }}
                dataKey="view"
              />
            ) : null}
          </div>
          <OrbitViewport
            geometry={geometry}
            day={day}
            mode={mode}
            sceneKey={sceneKey}
            view={view}
            viewNonce={viewNonce}
            reducedMotion={reducedMotion}
            storm={storm}
            onSlow={() => setFallbackReason((reason) => reason ?? "slow")}
            onUnavailable={() => setFallbackReason("unavailable")}
          />
          <p id="orbit-notice" aria-live="polite" className="mt-2.5 mb-0 text-caption text-muted">
            {!webgl || fallbackReason === "unavailable"
              ? "3D is not available in this browser, so the same geometry is shown as a 2D diagram. "
              : fallbackReason === "slow" && mode === "2d"
                ? "3D was rendering slowly on this device, so the view switched to the 2D diagram. Select 3D to try again. "
                : ""}
            Distances between bodies are to scale. The Sun and planets are enlarged to stay visible. Simulated mission.
          </p>
        </Panel>
        <LinkReadout geometry={geometry} day={day} delays={delays} maxRoundTripMin={maxRoundTripMin} />
      </div>

      <div className="mt-4 grid grid-cols-2 items-start gap-4 max-md:grid-cols-1">
        <StoryPanel story={story} events={data.events} dates={geometry.date} day={day} onSelectDay={selectDay} />
        <CrewDayPanel data={data} day={day} linkNote={linkNote} />
      </div>
    </div>
  );
}
