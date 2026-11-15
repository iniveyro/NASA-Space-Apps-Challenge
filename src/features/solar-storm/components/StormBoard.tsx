"use client";

import { useEffect, useRef, useState } from "react";
import { formatValue } from "@/features/crew-health-data";
import { formatMissionDate, useMissionDay } from "@/features/mission-timeline";
import { Panel, PanelHeading, SegmentedToggle } from "@/shared/design-system";
import { cn } from "@/shared/lib/cn";
import { usePrefersReducedMotion, useWebglSupport } from "@/shared/lib/use-media";
import type { StormCrew, StormScenario } from "../lib/scenario";
import type { StormView } from "../lib/surface";
import { ARRIVE_AT, SCENE_SECONDS, STORM_PHASES, clampProgress, doseSoFar, phaseAt, type StormPhase } from "../lib/timeline";
import { StormViewport } from "./StormViewport";

const VIEW_OPTIONS = [
  { value: "follow", label: "Follow" },
  { value: "overview", label: "Overview" },
] as const;
const MODE_OPTIONS = [
  { value: "3d", label: "3D" },
  { value: "2d", label: "2D" },
] as const;

const toolbarButton =
  "inline-flex min-h-8 cursor-pointer items-center gap-1.5 rounded-sm border border-border bg-surface-subtle px-3 text-caption font-bold text-text-strong hover:border-hover-border";

interface StormData {
  scenario: StormScenario;
  /** One-way signal time on the day the link returns, e.g. "19 min 55 s". */
  delayAtReturn: string | null;
}

function msv(value: number | null): string {
  return value === null ? "Unknown" : `${value.toFixed(1)} mSv`;
}

function cumulative(value: number | null): string {
  return value === null ? "Unknown" : `${formatValue("radiation", value)} mSv`;
}

function caption(phase: StormPhase, scenario: StormScenario, names: readonly [string, string], delayAtReturn: string | null): string {
  const link =
    scenario.dayOfBlackout !== null && scenario.blackoutDays !== null
      ? `There is no link to Earth: day ${scenario.dayOfBlackout} of ${scenario.blackoutDays} of the blackout.`
      : "";
  if (phase === "walk") return `${names[0]} and ${names[1]} are outside on the surface, ${scenario.walkDistanceKm} km from the habitat.`;
  if (phase === "return") return `The radiation sensor rises and they turn back toward the airlock. ${link} The decision is the crew's.`;
  const returns =
    scenario.linkReturnsDay !== null && scenario.linkReturnsDate && scenario.daysUntilLink !== null
      ? ` Earth hears about it when the link returns on day ${scenario.linkReturnsDay}, ${formatMissionDate(scenario.linkReturnsDate)}, in ${scenario.daysUntilLink} days${delayAtReturn ? `, and a report then takes ${delayAtReturn} to arrive` : ""}.`
      : "";
  return `All four are in the refuge.${returns}`;
}

function placeLabel(crew: StormCrew): string {
  return crew.place === "walk" ? "On the surface · EVA" : crew.place === "refuge" ? "In the refuge" : "Place unknown";
}

function CrewRow({ crew, progress }: { crew: StormCrew; progress: number }) {
  const inside = crew.place === "walk" && progress >= ARRIVE_AT;
  return (
    <li data-crew={crew.id} className="border-t border-console-divider py-2.5">
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-body font-strong">{crew.name}</span>
        <span className="text-caption text-console-muted">{inside ? "In the refuge" : placeLabel(crew)}</span>
      </div>
      <p className="m-0 mt-1 flex items-baseline justify-between gap-3 text-caption text-console-muted">
        Storm dose so far
        <span data-dose-now className="text-body font-strong text-console-text tabular-nums">
          {msv(doseSoFar(crew.eventDoseMsv, progress))}
        </span>
      </p>
      <p className="m-0 mt-0.5 flex items-baseline justify-between gap-3 text-micro text-console-faint">
        Mission total, before → after
        <span className="tabular-nums">
          {cumulative(crew.doseBeforeMsv)} → {cumulative(crew.doseAfterMsv)}
        </span>
      </p>
    </li>
  );
}

/** The solar-storm scene with its controls, the crew's storm doses and the Earth-link facts, for the storm day. */
export function StormBoard({ scenario, delayAtReturn }: StormData) {
  const [progress, setProgress] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [view, setView] = useState<StormView>("follow");
  const [viewNonce, setViewNonce] = useState(0);
  const [modeChoice, setModeChoice] = useState<"3d" | "2d" | null>(null);
  const [sceneKey, setSceneKey] = useState(0);
  const [fallbackReason, setFallbackReason] = useState<"slow" | "unavailable" | null>(null);
  const reducedMotion = usePrefersReducedMotion();
  const webgl = useWebglSupport();
  const progressRef = useRef(0);
  const started = useRef(false);

  const mode: "3d" | "2d" = !webgl || fallbackReason === "unavailable" ? "2d" : (modeChoice ?? (fallbackReason === "slow" ? "2d" : "3d"));
  const walkers = scenario.crew.filter((person) => person.place === "walk");
  const names: readonly [string, string] = [walkers[0]?.name ?? "Crew member 1", walkers[1]?.name ?? "Crew member 2"];
  const phase = phaseAt(progress);
  const phaseLabel = STORM_PHASES.find((entry) => entry.id === phase)?.label ?? "";
  const linkChip =
    scenario.dayOfBlackout !== null && scenario.blackoutDays !== null ? `NO EARTH LINK · DAY ${scenario.dayOfBlackout} OF ${scenario.blackoutDays}` : null;

  // Play: advance the scene at a steady pace, updating React about a dozen times a second (the scene glides between updates).
  useEffect(() => {
    if (!playing) return;
    let frame = 0;
    let last = performance.now();
    let reported = progressRef.current;
    const tick = (now: number) => {
      const elapsed = Math.min(0.1, (now - last) / 1000);
      last = now;
      const next = Math.min(1, progressRef.current + elapsed / SCENE_SECONDS);
      progressRef.current = next;
      if (next - reported >= 0.0015 || next >= 1) {
        reported = next;
        setProgress(next);
      }
      if (next >= 1) {
        setPlaying(false);
        return;
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [playing]);

  const seek = (value: number) => {
    const next = clampProgress(value);
    progressRef.current = next;
    setProgress(next);
    setPlaying(false);
  };

  const togglePlay = () => {
    if (!playing && progress >= 1) {
      progressRef.current = 0;
      setProgress(0);
    }
    setPlaying(!playing);
  };

  // The first time the 3D scene draws a frame it starts playing, unless the visitor prefers reduced motion.
  const handleReady = () => {
    if (started.current || reducedMotion) return;
    started.current = true;
    setPlaying(true);
  };

  const chooseMode = (next: "3d" | "2d") => {
    if (next === "3d" && mode !== "3d") setSceneKey((key) => key + 1);
    setModeChoice(next);
    if (next === "3d" && fallbackReason === "slow") setFallbackReason(null);
  };

  return (
    <div id="storm-board" data-phase={phase} data-playing={playing} data-storm-day={scenario.day}>
      <div className="grid grid-cols-[minmax(0,1fr)_minmax(280px,340px)] items-start gap-4 max-md:grid-cols-1">
        <Panel id="storm-panel" aria-labelledby="storm-title">
          <PanelHeading
            eyebrow={`DAY ${scenario.day} · ${formatMissionDate(scenario.date).toUpperCase()} · MARS SURFACE`}
            title="The solar storm"
            titleId="storm-title"
            className="flex-wrap"
            actions={webgl ? <SegmentedToggle label="Rendering" options={MODE_OPTIONS} value={mode} onChange={chooseMode} dataKey="storm-mode" /> : null}
          />
          <div className="mt-3 mb-3 flex flex-wrap items-center gap-x-3 gap-y-2">
            <button type="button" id="storm-play" aria-pressed={playing} onClick={togglePlay} className={cn(toolbarButton, playing && "border-selected-border bg-selected")}>
              <span aria-hidden="true">{playing ? "❚❚" : "▶"}</span>
              {playing ? "Pause" : progress >= 1 ? "Replay" : progress > 0 ? "Resume" : "Play"}
            </button>
            {mode === "3d" ? (
              <SegmentedToggle
                label="Camera view"
                options={VIEW_OPTIONS}
                value={view}
                onChange={(next) => {
                  setView(next);
                  setViewNonce((nonce) => nonce + 1);
                }}
                dataKey="storm-view"
              />
            ) : null}
            <label htmlFor="storm-progress" className="sr-only">
              Position in the scene
            </label>
            <input
              id="storm-progress"
              type="range"
              min={0}
              max={1000}
              step={1}
              value={Math.round(progress * 1000)}
              aria-valuetext={phaseLabel}
              onChange={(event) => seek(Number(event.target.value) / 1000)}
              className="min-w-40 flex-1 cursor-pointer accent-primary"
            />
          </div>
          <StormViewport
            progress={progress}
            names={names}
            mode={mode}
            sceneKey={sceneKey}
            view={view}
            viewNonce={viewNonce}
            reducedMotion={reducedMotion}
            linkChip={linkChip}
            refugeVisible={progress >= ARRIVE_AT}
            onReady={handleReady}
            onSlow={() => setFallbackReason((reason) => reason ?? "slow")}
            onUnavailable={() => setFallbackReason("unavailable")}
          />
          <p id="storm-phase" aria-live="polite" className="mt-3 mb-0 text-body font-semibold text-text-strong">
            <span className="mr-2 text-caption font-bold tracking-caps text-text-subtle">{phaseLabel.toUpperCase()}</span>
            {caption(phase, scenario, names, delayAtReturn)}
          </p>
          <p id="storm-notice" className="mt-2 mb-0 text-caption text-muted">
            {!webgl || fallbackReason === "unavailable"
              ? "3D is not available in this browser, so the scene is shown as a plan. "
              : fallbackReason === "slow" && mode === "2d"
                ? "3D was rendering slowly on this device, so the scene switched to the plan. Select 3D to try again. "
                : ""}
            The storm and its timing are an authored scenario event; the dust and particle tracks are illustrative. Distances are compressed.
          </p>
        </Panel>

        <article id="storm-crew" aria-labelledby="storm-crew-title" className="min-w-0 rounded-2xl border border-console-border bg-console p-4.5 text-console-text shadow-card max-sm:p-4">
          <p className="m-0 text-xs font-bold tracking-caps-wide text-console-muted">DAY {scenario.day} · FROM THE MISSION DATASET</p>
          <h3 id="storm-crew-title" className="m-0 mt-1 mb-2 text-lg font-strong">
            Crew in the storm
          </h3>
          <ul className="m-0 list-none p-0">
            {scenario.crew.map((person) => (
              <CrewRow key={person.id} crew={person} progress={progress} />
            ))}
          </ul>
          <dl className="m-0 mt-3 border-t border-console-divider pt-2.5">
            <div className="flex items-baseline justify-between gap-3 py-1">
              <dt className="text-caption text-console-muted">Last data from Earth</dt>
              <dd className="m-0 text-right text-caption font-strong tabular-nums">
                {scenario.lastContactDay !== null && scenario.lastContactDate ? `Day ${scenario.lastContactDay} · ${formatMissionDate(scenario.lastContactDate)}` : "Unknown"}
              </dd>
            </div>
            <div className="flex items-baseline justify-between gap-3 py-1">
              <dt className="text-caption text-console-muted">Link returns</dt>
              <dd className="m-0 text-right text-caption font-strong tabular-nums">
                {scenario.linkReturnsDay !== null && scenario.linkReturnsDate ? `Day ${scenario.linkReturnsDay} · ${formatMissionDate(scenario.linkReturnsDate)}` : "Not in the dataset"}
              </dd>
            </div>
            <div className="flex items-baseline justify-between gap-3 py-1">
              <dt className="text-caption text-console-muted">A report then takes</dt>
              <dd className="m-0 text-right text-caption font-strong tabular-nums">{delayAtReturn ?? "Unknown"}</dd>
            </div>
          </dl>
          <p className="m-0 mt-3 text-micro text-console-faint">
            Doses are read from the mission dataset; the counters add up to them over the scene. Radiation is cumulative mission dose in mSv, not a rate and not a safe limit, and no thresholds are applied. Simulated data.
          </p>
        </article>
      </div>
    </div>
  );
}

/** The storm view on the home page: shown on the storm day; on any other day it offers to jump there. */
export function SolarStormEmbedded(data: StormData) {
  const mission = useMissionDay();
  if (!mission) return null;
  const { scenario } = data;
  if (mission.day !== scenario.day) {
    return (
      <Panel id="storm-away" aria-labelledby="storm-away-title" data-selected-day={mission.day}>
        <PanelHeading eyebrow="SOLAR STORM · SCENARIO EVENT" title="The storm happens on one day" titleId="storm-away-title" />
        <p className="mt-2 mb-3 text-body text-muted">
          The solar storm falls on mission day {scenario.day}, {formatMissionDate(scenario.date)}. You are on day {mission.day}.
        </p>
        <button type="button" id="storm-go" onClick={() => mission.onChange(scenario.day)} className={toolbarButton}>
          Go to day {scenario.day}
        </button>
      </Panel>
    );
  }
  return <StormBoard {...data} />;
}
