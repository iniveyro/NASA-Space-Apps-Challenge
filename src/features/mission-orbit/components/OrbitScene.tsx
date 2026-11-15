"use client";

import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useCallback, useEffect, useRef } from "react";
import type { Group } from "three";
import type { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import type { MissionGeometry } from "../lib/geometry";
import type { CameraView } from "../lib/scene-math";
import { MissionScene, SCENE_LABELS, createControls, type SceneLabel } from "./scene/mission-scene";

export type { SceneLabel };

export interface OrbitSceneProps {
  geometry: MissionGeometry;
  /** Selected mission day; the scene glides to it. */
  day: number;
  view: CameraView;
  /** Changes whenever the visitor asks for the camera to be re-framed. */
  viewNonce: number;
  reducedMotion: boolean;
  /** True on a solar-storm scenario day. */
  storm: boolean;
  /** False while the scene is scrolled out of view, so it stops rendering. */
  active: boolean;
  /** Text of each label; an empty string hides the label. */
  labels: Readonly<Record<SceneLabel, string>>;
  onReady: () => void;
  onSlow: () => void;
  onContextLost: () => void;
}

type PlaceLabel = (key: SceneLabel, x: number, y: number, visible: boolean) => void;

interface SceneProps extends Omit<OrbitSceneProps, "labels" | "active"> {
  placeLabel: PlaceLabel;
}

/** Seconds of frames averaged by the performance watchdog, and the frame rate it treats as too slow. */
const WATCH_WINDOW_SECONDS = 3;
const SLOW_FPS = 12;

function Scene({ geometry, day, view, viewNonce, reducedMotion, storm, placeLabel, onReady, onSlow, onContextLost }: SceneProps) {
  const camera = useThree((state) => state.camera);
  const canvas = useThree((state) => state.gl.domElement);
  const invalidate = useThree((state) => state.invalidate);
  const setDpr = useThree((state) => state.setDpr);
  const mountRef = useRef<Group>(null);
  const sceneRef = useRef<MissionScene | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const live = useRef({ day, view, reducedMotion, storm, placeLabel, onReady, onSlow, onContextLost, engaged: true, ready: false, frames: 0, windowStart: 0, lowered: false, reported: false });

  useEffect(() => {
    Object.assign(live.current, { day, view, reducedMotion, storm, placeLabel, onReady, onSlow, onContextLost });
    invalidate();
  }, [day, view, reducedMotion, storm, placeLabel, onReady, onSlow, onContextLost, invalidate]);

  // A context lost while the scene is mounted means the GPU gave up; the one lost on unmount is expected.
  useEffect(() => {
    const report = () => live.current.onContextLost();
    canvas.addEventListener("webglcontextlost", report);
    return () => canvas.removeEventListener("webglcontextlost", report);
  }, [canvas]);

  // A new view request, or an automatic view change on a new mission phase, hands the camera back to the rig.
  useEffect(() => {
    live.current.engaged = true;
    invalidate();
  }, [view, viewNonce, invalidate]);

  useEffect(() => {
    const scene = new MissionScene(geometry, live.current.day);
    sceneRef.current = scene;
    mountRef.current?.add(scene.root);
    invalidate();
    return () => {
      sceneRef.current = null;
      scene.dispose();
    };
  }, [geometry, invalidate]);

  useEffect(() => {
    const controls = createControls(camera, canvas, !reducedMotion);
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
      width: state.size.width,
      height: state.size.height,
      elapsed: state.clock.elapsedTime,
      delta,
      day: now.day,
      view: now.view,
      reducedMotion: now.reducedMotion,
      storm: now.storm,
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

/** WebGL scene of the mission geometry. Loaded on the client only (see OrbitViewport). */
export default function OrbitScene({ labels, active, ...scene }: OrbitSceneProps) {
  const labelRefs = useRef<Record<SceneLabel, HTMLSpanElement | null>>({ sun: null, earth: null, mars: null, crew: null, link: null });
  const placeLabel = useCallback<PlaceLabel>((key, x, y, visible) => {
    const element = labelRefs.current[key];
    if (!element) return;
    element.style.opacity = visible ? "1" : "0";
    if (visible) element.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0)`;
  }, []);

  return (
    <div className="absolute inset-0" data-orbit-scene="">
      <Canvas
        flat
        dpr={[1, 2]}
        frameloop={!active ? "never" : scene.reducedMotion ? "demand" : "always"}
        camera={{ fov: 42, near: 0.1, far: 800, position: [0, 31, 27] }}
        gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
        style={{ position: "absolute", inset: 0 }}
        aria-hidden="true"
      >
        <Scene {...scene} placeLabel={placeLabel} />
      </Canvas>
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
        {SCENE_LABELS.map((key) => (
          <span
            key={key}
            ref={(element) => {
              labelRefs.current[key] = element;
            }}
            data-scene-label={key}
            hidden={!labels[key]}
            className="absolute top-0 left-0 opacity-0"
          >
            <span
              className={
                key === "link"
                  ? "block -translate-x-1/2 -translate-y-full rounded-xs bg-space-void/80 px-1.5 py-0.5 text-xs font-bold whitespace-nowrap text-space-signal tabular-nums group-data-[comm=blackout]/viewport:text-console-muted"
                  : "block -translate-x-1/2 -translate-y-full text-xs font-semibold whitespace-nowrap text-console-text"
              }
            >
              {labels[key]}
            </span>
          </span>
        ))}
      </div>
    </div>
  );
}
