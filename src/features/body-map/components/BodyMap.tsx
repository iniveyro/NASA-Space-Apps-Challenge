"use client";

import { useEffect, useRef, useState } from "react";
import type { BodyHighlighterInstance, Muscle } from "body-highlighter";
import type { BodyRegion } from "@/features/crew-health-data";
import { Panel, PanelHeading, readToken } from "@/shared/design-system";
import { cn } from "@/shared/lib/cn";
import { DEFAULT_CALLOUT, REGION_BUTTONS, REGION_DESCRIPTIONS, regionForMuscle } from "../lib/regions";

interface BodyMapProps {
  /** Currently selected region, or null before any selection. */
  region: BodyRegion | null;
  onSelectRegion: (region: BodyRegion) => void;
  className?: string;
}

type HighlighterModule = typeof import("body-highlighter");

const UNAVAILABLE = "Body illustration unavailable. Region buttons remain available.";

function musclesFor(api: HighlighterModule, region: BodyRegion): Muscle[] {
  const muscles = api.MuscleType;
  if (region === "brain") return [muscles.HEAD, muscles.NECK];
  if (region === "heart") return [muscles.CHEST];
  return [...new Set(Object.values(muscles))];
}

/** Interactive body silhouette plus keyboard-accessible region buttons. Regions are navigation groups only. */
export function BodyMap({ region, onSelectRegion, className }: BodyMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const instanceRef = useRef<BodyHighlighterInstance | null>(null);
  const apiRef = useRef<HighlighterModule | null>(null);
  const onSelectRef = useRef(onSelectRegion);
  const regionRef = useRef(region);
  const [hoverRegion, setHoverRegion] = useState<BodyRegion | null>(null);
  const [focusRegion, setFocusRegion] = useState<BodyRegion | null>(null);
  const [unavailable, setUnavailable] = useState(false);

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

  const preview = hoverRegion ?? focusRegion ?? region;

  return (
    <Panel className={cn("body-panel", className)} aria-labelledby="body-title">
      <PanelHeading eyebrow="INTERACTIVE GUIDE" title="Body map" titleId="body-title" />
      <p className="mt-2.75 mb-0 text-sm text-muted">
        Select a region to find related signals. Associations are navigation aids, not organ measurements.
      </p>
      <div className="mt-2.25 grid grid-cols-1 justify-items-center">
        <div className="body-art mx-auto grid w-full max-w-117.5 grid-cols-[minmax(0,1fr)_auto] items-center gap-3 max-sm:max-w-105 max-sm:grid-cols-1">
          <div
            ref={containerRef}
            id="body-model"
            className="body-model grid min-h-62.5 w-full min-w-0 place-items-center [&_polygon]:cursor-pointer"
            role={unavailable ? "status" : "img"}
            aria-label={unavailable ? undefined : "Simplified muscle-group silhouette used for metric navigation"}
          >
            {unavailable ? UNAVAILABLE : null}
          </div>
          <div className="flex flex-col gap-2 max-sm:flex-row max-sm:flex-wrap max-sm:justify-center" role="group" aria-label="Select a body region">
            {REGION_BUTTONS.map(({ region: target, label }) => {
              const pressed = target === region;
              const previewing = target === hoverRegion || target === focusRegion;
              return (
                <button
                  key={target}
                  type="button"
                  data-region={target}
                  aria-describedby="body-callout-text"
                  aria-pressed={pressed}
                  onClick={() => select(target)}
                  onPointerEnter={() => setHoverRegion(target)}
                  onPointerLeave={() => setHoverRegion(null)}
                  onFocus={() => setFocusRegion(target)}
                  onBlur={() => setFocusRegion(null)}
                  className={cn(
                    "body-target min-h-9.5 min-w-23 cursor-pointer rounded-xs border px-2.5 py-1.5 max-xs:min-w-22 max-xs:px-2 max-xs:py-1.25",
                    pressed
                      ? "border-selected-border bg-selected text-text-strong"
                      : previewing
                        ? "preview border-hover-border bg-primary-soft text-text-secondary"
                        : "border-border-strong bg-surface text-text-secondary hover:border-hover-border hover:bg-primary-soft",
                  )}
                >
                  {label}
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
      </div>
      <p className="mt-3.25 mb-0 text-caption text-muted">Brain includes self-reports; SpO₂ is a simulated point reading.</p>
    </Panel>
  );
}
