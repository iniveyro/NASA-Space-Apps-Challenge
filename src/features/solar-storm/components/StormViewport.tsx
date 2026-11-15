"use client";

import dynamic from "next/dynamic";
import { useRef, useState } from "react";
import { cn } from "@/shared/lib/cn";
import { SceneBoundary } from "@/shared/scene/SceneBoundary";
import { useOnScreen } from "@/shared/scene/use-on-screen";
import { StormDiagram } from "./StormDiagram";
import type { StormLabel } from "./StormScene";
import type { StormView } from "../lib/surface";

// three.js needs a browser: the scene is its own client-only chunk, loaded when 3D is shown.
const StormScene = dynamic(() => import("./StormScene"), { ssr: false });

interface StormViewportProps {
  progress: number;
  /** Names of the two people on the surface, in the order the scene draws them. */
  names: readonly [string, string];
  mode: "3d" | "2d";
  /** Changes every time the 3D scene is (re)mounted. */
  sceneKey: number;
  view: StormView;
  viewNonce: number;
  reducedMotion: boolean;
  /** Text for the "no Earth link" chip, e.g. "NO EARTH LINK · DAY 8 OF 17"; null hides it. */
  linkChip: string | null;
  refugeVisible: boolean;
  onReady: () => void;
  onSlow: () => void;
  onUnavailable: () => void;
}

const chip = "m-0 inline-flex max-w-full items-center gap-2 rounded-sm border border-console-border bg-space-void/85 px-2.5 py-1.25 text-xs font-bold tracking-caps text-console-text tabular-nums";

/** The dark "screen": the plan view underneath, the WebGL scene on top once its first frame is drawn. */
export function StormViewport({ progress, names, mode, sceneKey, view, viewNonce, reducedMotion, linkChip, refugeVisible, onReady, onSlow, onUnavailable }: StormViewportProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const onScreen = useOnScreen(containerRef);
  const [readyKey, setReadyKey] = useState<number | null>(null);
  const sceneReady = mode === "3d" && readyKey === sceneKey;
  const labels: Record<StormLabel, string> = { walkerA: names[0], walkerB: names[1], habitat: "Habitat", refuge: refugeVisible ? "Refuge · all four inside" : "Refuge", sun: "Sun" };

  return (
    <div
      ref={containerRef}
      id="storm-viewport"
      data-mode={mode}
      data-scene-ready={sceneReady}
      className="relative aspect-[16/10] min-h-80 w-full overflow-hidden rounded-xl border border-console-border bg-space-void text-console-text max-sm:aspect-[4/5]"
    >
      <StormDiagram progress={progress} names={names} className={cn("absolute inset-0 transition-opacity duration-500", sceneReady && "opacity-0")} />
      {mode === "3d" ? (
        <SceneBoundary key={sceneKey} onError={onUnavailable}>
          <StormScene
            progress={progress}
            view={view}
            viewNonce={viewNonce}
            reducedMotion={reducedMotion}
            active={onScreen}
            labels={labels}
            onReady={() => {
              setReadyKey(sceneKey);
              onReady();
            }}
            onSlow={onSlow}
            onContextLost={onUnavailable}
          />
        </SceneBoundary>
      ) : null}

      <div className="pointer-events-none absolute top-3 left-3 flex max-w-[calc(100%-1.5rem)] flex-col items-start gap-1.5">
        {linkChip ? (
          <p id="storm-link-chip" className={chip}>
            <span aria-hidden="true" className="size-2 flex-none rounded-full bg-status-unknown-border" />
            {linkChip}
          </p>
        ) : null}
        <p id="storm-event-chip" className={chip}>
          <span aria-hidden="true" className="size-2 flex-none rounded-full bg-space-sun" />
          SOLAR STORM · SCENARIO EVENT
        </p>
      </div>

      <ul className="pointer-events-none absolute bottom-3 left-3 m-0 flex max-w-[calc(100%-1.5rem)] list-none flex-wrap gap-x-3 gap-y-1 rounded-sm bg-space-void/85 px-2.5 py-1.5 text-micro font-semibold text-console-muted" aria-label="Legend">
        <li className="inline-flex items-center gap-1.5">
          <span aria-hidden="true" className="h-0.75 w-3.5 rounded-xs bg-space-signal" />
          The walk
        </li>
        <li className="inline-flex items-center gap-1.5">
          <span aria-hidden="true" className="size-1.5 rounded-full bg-space-sun" />
          Dust and particle tracks (illustrative)
        </li>
        <li>Distances compressed</li>
      </ul>
    </div>
  );
}
