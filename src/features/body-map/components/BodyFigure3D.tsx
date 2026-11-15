"use client";

import { Canvas, useFrame, useThree, type ThreeEvent } from "@react-three/fiber";
import { useCallback, useEffect, useRef } from "react";
import type { Group } from "three";
import type { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import type { BodyRegion } from "@/features/crew-health-data";
import { toneDot, type Tone } from "@/shared/design-system";
import { cn } from "@/shared/lib/cn";
import { BODY_REGIONS, BodyScene, FIGURE_FOV, createFigureControls } from "./scene/body-scene";

export interface RegionCallout {
  title: string;
  /** Authored demo state of the region, e.g. "Alert". */
  state: string;
  /** Short reading lines, e.g. "BP 121/70 mmHg". */
  lines: readonly string[];
}

export interface BodyFigure3DProps {
  selected: BodyRegion | null;
  /** Region previewed by hover or focus, from the figure or from the region buttons. */
  preview: BodyRegion | null;
  tones: Readonly<Record<BodyRegion, Tone>>;
  callouts: Readonly<Record<BodyRegion, RegionCallout>>;
  /** Simulated heart-rate reading that paces the pulse marker; null shows a steady marker. */
  pulseBpm: number | null;
  reducedMotion: boolean;
  /** False while the figure is scrolled out of view, so it stops rendering. */
  active: boolean;
  onSelect: (region: BodyRegion) => void;
  onHover: (region: BodyRegion | null) => void;
  onReady: () => void;
  onContextLost: () => void;
}

type PlaceLabel = (region: BodyRegion, x: number, y: number, visible: boolean) => void;

interface SceneProps extends Omit<BodyFigure3DProps, "callouts" | "active"> {
  placeLabel: PlaceLabel;
}

/** Callouts sit on the side with more free room: the head and trunk to the left, the chest to the right. */
const CALLOUT_SIDE: Readonly<Record<BodyRegion, "left" | "right">> = { brain: "left", heart: "right", body: "left" };
/** Pixels between the viewport edge and a callout, and the farthest a pointer may travel during a click. */
const EDGE = 10;
const CLICK_SLOP = 6;
/**
 * Callout width by figure width, matching the container-query classes below: hidden under 19rem,
 * narrow under 24rem, full above. The camera keeps this much room free on each side.
 */
function calloutReserve(width: number): number {
  if (width < 304) return 0;
  return (width < 384 ? 100 : 116) + EDGE + 8;
}

function regionOf(event: ThreeEvent<PointerEvent | MouseEvent>): BodyRegion | null {
  const region = event.object.userData.region as BodyRegion | undefined;
  return region ?? null;
}

function Scene({ selected, preview, tones, pulseBpm, reducedMotion, placeLabel, onSelect, onHover, onReady, onContextLost }: SceneProps) {
  const camera = useThree((state) => state.camera);
  const canvas = useThree((state) => state.gl.domElement);
  const invalidate = useThree((state) => state.invalidate);
  const mountRef = useRef<Group>(null);
  const sceneRef = useRef<BodyScene | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const live = useRef({ selected, preview, tones, pulseBpm, reducedMotion, placeLabel, onReady, onContextLost, idle: true, ready: false, hover: null as BodyRegion | null });

  useEffect(() => {
    Object.assign(live.current, { selected, preview, tones, pulseBpm, reducedMotion, placeLabel, onReady, onContextLost });
    invalidate();
  }, [selected, preview, tones, pulseBpm, reducedMotion, placeLabel, onReady, onContextLost, invalidate]);

  useEffect(() => {
    const scene = new BodyScene();
    sceneRef.current = scene;
    mountRef.current?.add(scene.root);
    invalidate();
    return () => {
      sceneRef.current = null;
      scene.dispose();
    };
  }, [invalidate]);

  useEffect(() => {
    const controls = createFigureControls(camera, canvas, !reducedMotion);
    const takeOver = () => {
      live.current.idle = false;
    };
    const redraw = () => invalidate();
    controls.addEventListener("start", takeOver);
    controls.addEventListener("change", redraw);
    controlsRef.current = controls;
    return () => {
      controls.removeEventListener("start", takeOver);
      controls.removeEventListener("change", redraw);
      controls.dispose();
      controlsRef.current = null;
    };
  }, [camera, canvas, invalidate, reducedMotion]);

  // A context lost while the figure is mounted means the GPU gave up; the one lost on unmount is expected.
  useEffect(() => {
    const report = () => live.current.onContextLost();
    canvas.addEventListener("webglcontextlost", report);
    return () => canvas.removeEventListener("webglcontextlost", report);
  }, [canvas]);

  useFrame((state, delta) => {
    const scene = sceneRef.current;
    const now = live.current;
    if (!scene) return;
    const moving = scene.update({
      camera: state.camera,
      controls: controlsRef.current,
      width: state.size.width,
      height: state.size.height,
      calloutReserve: calloutReserve(state.size.width),
      elapsed: state.clock.elapsedTime,
      delta,
      reducedMotion: now.reducedMotion,
      selected: now.selected,
      preview: now.preview,
      tones: now.tones,
      bpm: now.pulseBpm,
      idle: now.idle,
      placeLabel: now.placeLabel,
    });
    if (moving) invalidate();
    if (!now.ready) {
      now.ready = true;
      now.onReady();
    }
  });

  const hover = (region: BodyRegion | null) => {
    if (live.current.hover === region) return;
    live.current.hover = region;
    onHover(region);
  };

  return (
    <group
      ref={mountRef}
      onPointerMove={(event) => {
        event.stopPropagation();
        hover(regionOf(event));
      }}
      onPointerOut={() => hover(null)}
      onClick={(event) => {
        event.stopPropagation();
        const region = regionOf(event);
        // A drag that turns the figure also ends in a click; only a still pointer selects.
        if (region && event.delta <= CLICK_SLOP) onSelect(region);
      }}
    />
  );
}

/** WebGL figure with per-region callouts. Loaded on the client only (see BodyMap). */
export default function BodyFigure3D({ callouts, active, ...scene }: BodyFigure3DProps) {
  const lineRefs = useRef<Record<BodyRegion, HTMLSpanElement | null>>({ brain: null, heart: null, body: null });
  const chipRefs = useRef<Record<BodyRegion, HTMLDivElement | null>>({ brain: null, heart: null, body: null });
  const layerRef = useRef<HTMLDivElement>(null);

  const placeLabel = useCallback<PlaceLabel>((region, x, y, visible) => {
    const line = lineRefs.current[region];
    const chip = chipRefs.current[region];
    const layer = layerRef.current;
    if (!line || !chip || !layer) return;
    const width = layer.clientWidth;
    const height = layer.clientHeight;
    const top = Math.min(Math.max(y, 30), Math.max(30, height - 30));
    const right = CALLOUT_SIDE[region] === "right";
    const from = right ? x : EDGE;
    const length = Math.max(0, right ? width - EDGE - x : x - EDGE);
    line.style.opacity = visible ? "1" : "0";
    chip.style.opacity = visible ? "1" : "0";
    line.style.transform = `translate3d(${from.toFixed(1)}px, ${top.toFixed(1)}px, 0) scaleX(${length.toFixed(1)})`;
    chip.style.transform = `translate3d(0, ${top.toFixed(1)}px, 0) translateY(-50%)`;
  }, []);

  return (
    <div className={cn("absolute inset-0", scene.preview && "cursor-pointer")} data-body-figure="">
      <Canvas
        flat
        dpr={[1, 2]}
        frameloop={!active ? "never" : scene.reducedMotion ? "demand" : "always"}
        camera={{ fov: FIGURE_FOV, near: 0.1, far: 50, position: [0, 0.98, 4.15] }}
        gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
        style={{ position: "absolute", inset: 0 }}
        aria-hidden="true"
      >
        <Scene {...scene} placeLabel={placeLabel} />
      </Canvas>
      <div ref={layerRef} className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
        {BODY_REGIONS.map((region) => {
          const callout = callouts[region];
          const right = CALLOUT_SIDE[region] === "right";
          const emphasized = region === scene.selected || region === scene.preview;
          return (
            <div key={region} data-callout={region} className="@max-[19rem]:hidden">
              <span
                ref={(element) => {
                  lineRefs.current[region] = element;
                }}
                className="absolute top-0 left-0 h-px w-px origin-left bg-console-ring opacity-0"
              />
              <div
                ref={(element) => {
                  chipRefs.current[region] = element;
                }}
                className={cn(
                  "absolute top-0 w-29 rounded-sm border bg-console px-2 py-1.25 opacity-0 @max-[24rem]:w-25",
                  right ? "right-2.5" : "left-2.5",
                  emphasized ? "border-console-avatar-border" : "border-console-border",
                )}
              >
                <span className="flex items-center gap-1.5 text-xs font-bold text-console-text">
                  <span className={cn("size-2 flex-none rounded-full", toneDot[scene.tones[region]])} />
                  {callout.title}
                </span>
                <span className="block text-micro font-semibold text-console-text-soft">{callout.state}</span>
                {callout.lines.map((line) => (
                  <span key={line} className="block text-micro text-console-muted tabular-nums">
                    {line}
                  </span>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
