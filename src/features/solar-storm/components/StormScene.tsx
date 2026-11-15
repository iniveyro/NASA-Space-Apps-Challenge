"use client";

import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useCallback, useEffect, useRef } from "react";
import type { Group } from "three";
import type { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import type { StormView } from "../lib/surface";
import { STORM_LABELS, StormScene as Scene3D, createStormControls, type StormLabel } from "./scene/storm-scene";

export type { StormLabel };

export interface StormSceneProps {
  /** Position in the scene, 0–1; the scene glides to it. */
  progress: number;
  view: StormView;
  /** Changes whenever the visitor asks for the camera to be re-framed. */
  viewNonce: number;
  reducedMotion: boolean;
  /** False while the scene is scrolled out of view, so it stops rendering. */
  active: boolean;
  /** Text of each label; an empty string hides the label. */
  labels: Readonly<Record<StormLabel, string>>;
  onReady: () => void;
  onSlow: () => void;
  onContextLost: () => void;
}

type PlaceLabel = (key: StormLabel, x: number, y: number, visible: boolean) => void;

interface InnerProps extends Omit<StormSceneProps, "labels" | "active"> {
  placeLabel: PlaceLabel;
}

/** Seconds of frames averaged by the performance watchdog, and the frame rate it treats as too slow. */
const WATCH_WINDOW_SECONDS = 3;
const SLOW_FPS = 12;

function Inner({ progress, view, viewNonce, reducedMotion, placeLabel, onReady, onSlow, onContextLost }: InnerProps) {
  const camera = useThree((state) => state.camera);
  const canvas = useThree((state) => state.gl.domElement);
  const invalidate = useThree((state) => state.invalidate);
  const setDpr = useThree((state) => state.setDpr);
  const mountRef = useRef<Group>(null);
  const sceneRef = useRef<Scene3D | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const live = useRef({ progress, view, reducedMotion, placeLabel, onReady, onSlow, onContextLost, engaged: true, ready: false, frames: 0, windowStart: 0, lowered: false, reported: false });

  useEffect(() => {
    Object.assign(live.current, { progress, view, reducedMotion, placeLabel, onReady, onSlow, onContextLost });
    invalidate();
  }, [progress, view, reducedMotion, placeLabel, onReady, onSlow, onContextLost, invalidate]);

  // A context lost while the scene is mounted means the GPU gave up; the one lost on unmount is expected.
  useEffect(() => {
    const report = () => live.current.onContextLost();
    canvas.addEventListener("webglcontextlost", report);
    return () => canvas.removeEventListener("webglcontextlost", report);
  }, [canvas]);

  // A new view request hands the camera back to the rig.
  useEffect(() => {
    live.current.engaged = true;
    invalidate();
  }, [view, viewNonce, invalidate]);

  useEffect(() => {
    const scene = new Scene3D(live.current.progress);
    sceneRef.current = scene;
    mountRef.current?.add(scene.root);
    invalidate();
    return () => {
      sceneRef.current = null;
      scene.dispose();
    };
  }, [invalidate]);

  useEffect(() => {
    const controls = createStormControls(camera, canvas, !reducedMotion);
    const release = () => {
      live.current.engaged = false;
    };
    const redraw = () => invalidate();
    controls.addEventListener("start", release);
    controls.addEventListener("change", redraw);
    controlsRef.current = controls;
    return () => {
      controls.removeEventListener("start", release);
      controls.removeEventListener("change", redraw);
      controls.dispose();
      controlsRef.current = null;
    };
  }, [camera, canvas, invalidate, reducedMotion]);

  useFrame((state, delta) => {
    const scene = sceneRef.current;
    const now = live.current;
    if (!scene) return;
    const moving = scene.update({
      camera: state.camera,
      controls: controlsRef.current,
      scene: state.scene,
      width: state.size.width,
      height: state.size.height,
      elapsed: state.clock.elapsedTime,
      delta,
      progress: now.progress,
      view: now.view,
      reducedMotion: now.reducedMotion,
      engaged: now.engaged,
      placeLabel: now.placeLabel,
    });
    if (moving) invalidate();

    if (!now.ready) {
      now.ready = true;
      now.onReady();
    }

    // Watchdog: a scene that stays slow first drops to 1x resolution, then asks for the 2D diagram.
    if (now.reducedMotion || now.reported) return;
    const time = state.clock.elapsedTime;
    now.frames += 1;
    if (time - now.windowStart < WATCH_WINDOW_SECONDS) return;
    const fps = now.frames / (time - now.windowStart);
    now.frames = 0;
    now.windowStart = time;
    if (time <= WATCH_WINDOW_SECONDS * 1.5 || fps >= SLOW_FPS) return;
    if (!now.lowered) {
      now.lowered = true;
      setDpr(1);
    } else {
      now.reported = true;
      now.onSlow();
    }
  });

  return <group ref={mountRef} />;
}

/** WebGL scene of the solar storm on Mars' surface. Loaded on the client only (see StormViewport). */
export default function StormScene({ labels, active, ...scene }: StormSceneProps) {
  const labelRefs = useRef<Record<StormLabel, HTMLSpanElement | null>>({ walkerA: null, walkerB: null, habitat: null, refuge: null, sun: null });
  const placeLabel = useCallback<PlaceLabel>((key, x, y, visible) => {
    const element = labelRefs.current[key];
    if (!element) return;
    element.style.opacity = visible ? "1" : "0";
    if (visible) element.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0)`;
  }, []);

  return (
    <div className="absolute inset-0" data-storm-scene="">
      <Canvas
        flat
        dpr={[1, 2]}
        frameloop={!active ? "never" : scene.reducedMotion ? "demand" : "always"}
        camera={{ fov: 52, near: 0.1, far: 900, position: [-58, 7, 30] }}
        gl={{ antialias: true, alpha: false, powerPreference: "high-performance" }}
        style={{ position: "absolute", inset: 0 }}
        aria-hidden="true"
      >
        <Inner {...scene} placeLabel={placeLabel} />
      </Canvas>
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
        {STORM_LABELS.map((key) => (
          <span
            key={key}
            ref={(element) => {
              labelRefs.current[key] = element;
            }}
            data-scene-label={key}
            hidden={!labels[key]}
            className="absolute top-0 left-0 opacity-0"
          >
            <span className="block -translate-x-1/2 -translate-y-full rounded-xs bg-space-void/70 px-1.5 py-0.5 text-xs font-semibold whitespace-nowrap text-console-text">{labels[key]}</span>
          </span>
        ))}
      </div>
    </div>
  );
}
