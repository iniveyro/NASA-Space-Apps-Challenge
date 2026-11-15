"use client";

import dynamic from "next/dynamic";
import { Component, useEffect, useRef, useState, type ReactNode } from "react";
import { toneDot, toneFor } from "@/shared/design-system";
import { cn } from "@/shared/lib/cn";
import { formatDelay } from "../lib/format";
import { SOLAR_EXCLUSION_DEG, delayMinutes, linkOutlook, nearConjunction, type MissionGeometry } from "../lib/geometry";
import { PULSE_SECONDS_PER_MINUTE, type CameraView } from "../lib/scene-math";
import { TRAJECTORY_LEGS, type TrajectoryLeg } from "../lib/trajectory";
import { OrbitDiagram } from "./OrbitDiagram";
import type { SceneLabel } from "./OrbitScene";

// three.js needs a browser: the scene is its own client-only chunk, loaded when 3D is shown.
const OrbitScene = dynamic(() => import("./OrbitScene"), { ssr: false });

const LEG_SWATCH: Readonly<Record<TrajectoryLeg["id"], string>> = {
  out: "bg-chart-primary",
  surface: "bg-chart-secondary",
  return: "bg-chart-bar",
};

class SceneBoundary extends Component<{ onError: () => void; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch() {
    this.props.onError();
  }

  render() {
    return this.state.failed ? null : this.props.children;
  }
}

interface OrbitViewportProps {
  geometry: MissionGeometry;
  day: number;
  mode: "3d" | "2d";
  /** Changes every time the 3D scene is (re)mounted. */
  sceneKey: number;
  view: CameraView;
  viewNonce: number;
  reducedMotion: boolean;
  /** True on a solar-storm scenario day. */
  storm: boolean;
  onSlow: () => void;
  onUnavailable: () => void;
}

const legendItem = "inline-flex items-center gap-1.5";
const chip = "m-0 inline-flex max-w-full items-center gap-2 rounded-sm border border-console-border bg-space-void/85 px-2.5 py-1.25 text-xs font-bold tracking-caps text-console-text tabular-nums";

/** The dark "screen": 2D diagram underneath, the WebGL scene on top once its first frame is drawn. */
export function OrbitViewport({ geometry, day, mode, sceneKey, view, viewNonce, reducedMotion, storm, onSlow, onUnavailable }: OrbitViewportProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [onScreen, setOnScreen] = useState(true);
  const [readyKey, setReadyKey] = useState<number | null>(null);
  const sceneReady = mode === "3d" && readyKey === sceneKey;

  useEffect(() => {
    const container = containerRef.current;
    if (!container || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(([entry]) => setOnScreen(entry.isIntersecting), { rootMargin: "120px" });
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  const comm = geometry.comm[day - 1] ?? "unknown";
  const delay = delayMinutes(geometry, day);
  const outlook = linkOutlook(geometry, day);
  const onMars = (geometry.distMarsMkm[day - 1] ?? 1) < 0.5;
  const atEarth = (geometry.distEarthMkm[day - 1] ?? 1) < 0.5;
  const exclusionShown = nearConjunction(geometry, day);
  const labels: Record<SceneLabel, string> = {
    sun: "Sun",
    earth: atEarth ? "Earth · crew" : "Earth",
    mars: onMars ? "Mars · crew" : "Mars",
    crew: onMars || atEarth ? "" : "Crew",
    link: atEarth ? "" : outlook.state === "blackout" ? "No link" : formatDelay(delay),
  };
  const status =
    outlook.state === "blackout"
      ? `NO EARTH LINK · DAY ${outlook.dayOfBlackout} OF ${outlook.span.count}`
      : comm === "link"
        ? `LINK · ${formatDelay(delay).toUpperCase()} ONE-WAY`
        : "LINK UNKNOWN";

  return (
    <div
      ref={containerRef}
      id="orbit-viewport"
      data-mode={mode}
      data-scene-ready={sceneReady}
      data-comm={comm}
      data-storm={storm}
      className="group/viewport relative aspect-[16/10] min-h-80 w-full overflow-hidden rounded-xl border border-console-border bg-space-void text-console-text max-sm:aspect-[4/5]"
    >
      <OrbitDiagram geometry={geometry} day={day} storm={storm} className={cn("absolute inset-0 transition-opacity duration-500", sceneReady && "opacity-0")} />
      {mode === "3d" ? (
        <SceneBoundary key={sceneKey} onError={onUnavailable}>
          <OrbitScene
            geometry={geometry}
            day={day}
            view={view}
            viewNonce={viewNonce}
            reducedMotion={reducedMotion}
            storm={storm}
            active={onScreen}
            labels={labels}
            onReady={() => setReadyKey(sceneKey)}
            onSlow={onSlow}
            onContextLost={onUnavailable}
          />
        </SceneBoundary>
      ) : null}

      <div className="pointer-events-none absolute top-3 left-3 flex max-w-[calc(100%-1.5rem)] flex-col items-start gap-1.5">
        <p id="orbit-status" className={chip}>
          <span aria-hidden="true" className={cn("size-2 flex-none rounded-full", toneDot[toneFor(comm)])} />
          {status}
        </p>
        {storm ? (
          <p id="orbit-storm" className={chip}>
            <span aria-hidden="true" className="size-2 flex-none rounded-full bg-space-sun" />
            SOLAR STORM · SCENARIO EVENT
          </p>
        ) : null}
      </div>

      <ul className="pointer-events-none absolute bottom-3 left-3 m-0 flex max-w-[calc(100%-1.5rem)] list-none flex-wrap gap-x-3 gap-y-1 rounded-sm bg-space-void/85 px-2.5 py-1.5 text-micro font-semibold text-console-muted" aria-label="Legend">
        {TRAJECTORY_LEGS.map((leg) => (
          <li key={leg.id} className={legendItem}>
            <span aria-hidden="true" className={cn("h-0.75 w-3.5 rounded-xs", LEG_SWATCH[leg.id])} />
            {leg.label}
          </li>
        ))}
        <li className={legendItem}>
          <span aria-hidden="true" className={cn("h-0.75 w-3.5 rounded-xs", comm === "blackout" ? "bg-status-unknown-border" : "bg-space-signal")} />
          Earth link
        </li>
        {exclusionShown ? (
          <li data-legend="exclusion" className={legendItem}>
            <span aria-hidden="true" className="h-2 w-3.5 rounded-xs bg-space-sun-glow/60" />
            No-link zone: within {SOLAR_EXCLUSION_DEG}° of the Sun, seen from Earth
          </li>
        ) : null}
        {storm ? (
          <li data-legend="storm" className={legendItem}>
            <span aria-hidden="true" className="size-1.5 rounded-full bg-space-sun" />
            Storm particles (illustrative)
          </li>
        ) : null}
      </ul>

      {sceneReady && !reducedMotion && comm === "link" && !atEarth ? (
        <p className="pointer-events-none absolute right-3 bottom-3 m-0 rounded-sm bg-space-void/85 px-2.5 py-1.5 text-micro font-semibold text-console-muted max-sm:hidden">
          Signal pulses: 1 s on screen = {1 / PULSE_SECONDS_PER_MINUTE} min of travel
        </p>
      ) : null}
    </div>
  );
}
