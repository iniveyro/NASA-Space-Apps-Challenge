"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useRef, useState } from "react";
import type { BodyHighlighterInstance, Muscle } from "body-highlighter";
import type { BodyRegion } from "@/features/crew-health-data";
import { Panel, PanelHeading, SegmentedToggle, readToken, toneDot, toneFor, type Tone } from "@/shared/design-system";
import { cn } from "@/shared/lib/cn";
import { usePrefersReducedMotion, useWebglSupport } from "@/shared/lib/use-media";
import { SceneBoundary } from "@/shared/scene/SceneBoundary";
import { useOnScreen } from "@/shared/scene/use-on-screen";
import { validBpm } from "../lib/pulse";
import { calloutLines, describeRegion, summarizeRegions, type RegionSignal } from "../lib/region-state";
import { DEFAULT_CALLOUT, REGION_BUTTONS, REGION_DESCRIPTIONS, regionForMuscle } from "../lib/regions";
import type { RegionCallout } from "./BodyFigure3D";

// three.js needs a browser: the figure is its own client-only chunk, loaded when 3D is shown.
const BodyFigure3D = dynamic(() => import("./BodyFigure3D"), { ssr: false });

interface BodyMapProps {
  /** Currently selected region, or null before any selection. */
  region: BodyRegion | null;
  onSelectRegion: (region: BodyRegion) => void;
  /** The profile's signals with their authored demo states; they color the regions of the 3D figure. */
  signals?: readonly RegionSignal[];
  /** Simulated heart-rate reading in bpm; paces the pulse marker of the 3D figure. */
  pulseBpm?: number | null;
  className?: string;
}

type HighlighterModule = typeof import("body-highlighter");
type Mode = "3d" | "2d";

const UNAVAILABLE = "Body illustration unavailable. Region buttons remain available.";
const NO_SIGNALS: readonly RegionSignal[] = [];
const MODE_OPTIONS = [
  { value: "3d", label: "3D" },
  { value: "2d", label: "2D" },
] as const;
const REGION_TITLES: Readonly<Record<BodyRegion, string>> = { brain: "Brain", heart: "Heart", body: "Whole body" };

function musclesFor(api: HighlighterModule, region: BodyRegion): Muscle[] {
  const muscles = api.MuscleType;
  if (region === "brain") return [muscles.HEAD, muscles.NECK];
  if (region === "heart") return [muscles.CHEST];
  return [...new Set(Object.values(muscles))];
}

/**
 * Interactive body figure plus keyboard-accessible region buttons. Regions are navigation groups only.
 * With WebGL the figure is 3D and shows each region's authored demo state; the 2D silhouette stays
 * available as a choice and as the fallback.
 */
export function BodyMap({ region, onSelectRegion, signals = NO_SIGNALS, pulseBpm = null, className }: BodyMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const instanceRef = useRef<BodyHighlighterInstance | null>(null);
  const apiRef = useRef<HighlighterModule | null>(null);
  const onSelectRef = useRef(onSelectRegion);
  const regionRef = useRef(region);
  const [hoverRegion, setHoverRegion] = useState<BodyRegion | null>(null);
  const [focusRegion, setFocusRegion] = useState<BodyRegion | null>(null);
  const [unavailable, setUnavailable] = useState(false);
  const [modeChoice, setModeChoice] = useState<Mode | null>(null);
  const [sceneFailed, setSceneFailed] = useState(false);
  const [sceneReady, setSceneReady] = useState(false);
  const webgl = useWebglSupport();
  const reducedMotion = usePrefersReducedMotion();
  const onScreen = useOnScreen(stageRef);

  const canRender3d = webgl && !sceneFailed;
  const mode: Mode = canRender3d ? (modeChoice ?? "3d") : "2d";
  const summaries = useMemo(() => summarizeRegions(signals), [signals]);
  const hasSignals = signals.length > 0;
  const tones = useMemo(
    () => ({ brain: toneFor(summaries.brain.status), heart: toneFor(summaries.heart.status), body: toneFor(summaries.body.status) }) satisfies Record<BodyRegion, Tone>,
    [summaries],
  );
  const callouts = useMemo(() => {
    const callout = (target: BodyRegion): RegionCallout => ({ title: REGION_TITLES[target], state: summaries[target].statusLabel, lines: calloutLines(summaries[target]) });
    return { brain: callout("brain"), heart: callout("heart"), body: callout("body") };
  }, [summaries]);

  // Selecting commits the region and clears hover/focus previews (legacy behavior).
  const select = (target: BodyRegion) => {
    setHoverRegion(null);
    setFocusRegion(null);
    onSelectRegion(target);
  };

  useEffect(() => {
    onSelectRef.current = select;
    regionRef.current = region;
  });

  // The library touches the DOM, so it is loaded and created on the client only.
  useEffect(() => {
    let cancelled = false;
    import("body-highlighter")
      .then((api) => {
        const container = containerRef.current;
        if (cancelled || !container) return;
        apiRef.current = api;
        const current = regionRef.current;
        instanceRef.current = api.createBodyHighlighter({
          container,
          data: current ? [{ name: REGION_DESCRIPTIONS[current], muscles: musclesFor(api, current) }] : [],
          bodyColor: readToken("color-body-base"),
          highlightedColors: [readToken("color-body-highlight")],
          type: api.ModelType.ANTERIOR,
          wrapperClassName: "body-highlighter",
          style: { width: "100%", maxWidth: "280px", margin: "0 auto" },
          svgStyle: { display: "block", width: "100%", height: "auto" },
          onClick: ({ muscle }) => onSelectRef.current(regionForMuscle(muscle)),
        });
      })
      .catch(() => {
        if (!cancelled) setUnavailable(true);
      });
    return () => {
      cancelled = true;
      instanceRef.current?.destroy();
      instanceRef.current = null;
    };
  }, []);

  useEffect(() => {
    const api = apiRef.current;
    if (!api || !instanceRef.current || !region) return;
    instanceRef.current.update({ data: [{ name: REGION_DESCRIPTIONS[region], muscles: musclesFor(api, region) }] });
  }, [region]);

  const chooseMode = (next: Mode) => {
    if (next !== mode) setSceneReady(false);
    setModeChoice(next);
  };

  const preview = hoverRegion ?? focusRegion ?? region;
  const figureLabel = hasSignals
    ? `3D figure used for metric navigation. ${REGION_BUTTONS.map(({ region: target, label }) => `${label}: ${summaries[target].statusLabel}`).join(". ")}.`
    : "3D figure used for metric navigation";

  return (
    <Panel className={cn("body-panel", className)} aria-labelledby="body-title" data-body-mode={mode}>
      <PanelHeading
        eyebrow="INTERACTIVE GUIDE"
        title="Body map"
        titleId="body-title"
        className="flex-wrap"
        actions={canRender3d ? <SegmentedToggle label="Illustration" options={MODE_OPTIONS} value={mode} onChange={chooseMode} dataKey="body-mode" /> : null}
      />
      <p className="mt-2.75 mb-0 text-sm text-muted">
        Select a region to find related signals. Associations are navigation aids, not organ measurements.
      </p>
      <div className="mt-2.25 grid grid-cols-1 justify-items-center">
        <div
          className={cn(
            "body-art mx-auto grid w-full max-w-117.5 items-center gap-3",
            mode === "3d" ? "grid-cols-1" : "grid-cols-[minmax(0,1fr)_auto] max-sm:max-w-105 max-sm:grid-cols-1",
          )}
        >
          <div
            ref={stageRef}
            id="body-stage"
            data-scene-ready={mode === "3d" && sceneReady}
            role={mode === "3d" ? "img" : undefined}
            aria-label={mode === "3d" ? figureLabel : undefined}
            className={cn("relative w-full min-w-0", mode === "3d" && "@container aspect-[4/5] max-h-130 overflow-hidden rounded-xl border border-console-border bg-console")}
          >
            <div
              ref={containerRef}
              id="body-model"
              className={cn(
                "body-model grid min-h-62.5 w-full min-w-0 place-items-center [&_polygon]:cursor-pointer",
                // In 3D the silhouette stays mounted, out of sight, so switching back is instant.
                mode === "3d" && "pointer-events-none invisible absolute inset-0",
              )}
              role={unavailable ? "status" : "img"}
              aria-hidden={mode === "3d" ? true : undefined}
              aria-label={unavailable ? undefined : "Simplified muscle-group silhouette used for metric navigation"}
            >
              {unavailable ? UNAVAILABLE : null}
            </div>
            {mode === "3d" ? (
              <>
                {sceneReady ? null : <p className="absolute inset-0 m-0 grid place-items-center text-caption text-console-muted">Loading the 3D figure…</p>}
                <SceneBoundary onError={() => setSceneFailed(true)}>
                  <BodyFigure3D
                    selected={region}
                    preview={hoverRegion ?? focusRegion}
                    tones={tones}
                    callouts={callouts}
                    pulseBpm={validBpm(pulseBpm) ? pulseBpm : null}
                    reducedMotion={reducedMotion}
                    active={onScreen}
                    onSelect={select}
                    onHover={setHoverRegion}
                    onReady={() => setSceneReady(true)}
                    onContextLost={() => setSceneFailed(true)}
                  />
                </SceneBoundary>
              </>
            ) : null}
          </div>
          <div
            className={cn("flex gap-2", mode === "3d" ? "flex-row flex-wrap justify-center" : "flex-col max-sm:flex-row max-sm:flex-wrap max-sm:justify-center")}
            role="group"
            aria-label="Select a body region"
          >
            {REGION_BUTTONS.map(({ region: target, label }) => {
              const pressed = target === region;
              const previewing = target === hoverRegion || target === focusRegion;
              const summary = summaries[target];
              return (
                <button
                  key={target}
                  type="button"
                  data-region={target}
                  data-state={hasSignals ? summary.status : undefined}
                  aria-describedby="body-callout-text"
                  aria-pressed={pressed}
                  onClick={() => select(target)}
                  onPointerEnter={() => setHoverRegion(target)}
                  onPointerLeave={() => setHoverRegion(null)}
                  onFocus={() => setFocusRegion(target)}
                  onBlur={() => setFocusRegion(null)}
                  className={cn(
                    "body-target inline-flex min-h-9.5 min-w-23 cursor-pointer items-center justify-center gap-1.75 rounded-xs border px-2.5 py-1.5 max-xs:min-w-22 max-xs:px-2 max-xs:py-1.25",
                    pressed
                      ? "border-selected-border bg-selected text-text-strong"
                      : previewing
                        ? "preview border-hover-border bg-primary-soft text-text-secondary"
                        : "border-border-strong bg-surface text-text-secondary hover:border-hover-border hover:bg-primary-soft",
                  )}
                >
                  {hasSignals ? <span aria-hidden="true" className={cn("size-2 flex-none rounded-full", toneDot[tones[target]])} /> : null}
                  {label}
                  {hasSignals ? <span className="sr-only">, {summary.statusLabel}</span> : null}
                </button>
              );
            })}
          </div>
        </div>
        <p
          id="body-callout-text"
          aria-live="polite"
          className="m-0 min-h-10 w-full rounded-r-xs border-l-3 border-status-unknown bg-surface-subtle px-3 py-2.5 text-caption text-text-subtle"
        >
          {preview ? REGION_DESCRIPTIONS[preview] : DEFAULT_CALLOUT}
        </p>
        {hasSignals && preview ? (
          <p id="body-region-state" data-region-state={summaries[preview].status} className="m-0 mt-1.5 w-full px-3 text-caption text-text-subtle">
            <strong className="font-bold text-text-strong">{REGION_TITLES[preview]}</strong> · {describeRegion(summaries[preview])} Authored demo state.
          </p>
        ) : null}
      </div>
      <p className="mt-3.25 mb-0 text-caption text-muted">
        Brain includes self-reports; SpO₂ is a simulated point reading.
        {mode === "3d" && hasSignals ? " Region colors show the authored demo states of the grouped signals, not organ measurements." : ""}
        {mode === "3d" && validBpm(pulseBpm) ? ` The pulse marker beats at the simulated heart-rate reading, ${pulseBpm} bpm.` : ""}
      </p>
    </Panel>
  );
}
