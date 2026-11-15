/** Client hooks for visitor and browser capabilities that several features need. */
import { useSyncExternalStore } from "react";

const REDUCED_MOTION = "(prefers-reduced-motion: reduce)";

function subscribeReducedMotion(onChange: () => void): () => void {
  const query = window.matchMedia(REDUCED_MOTION);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

/** True when the visitor asks for reduced motion. Always false during server rendering. */
export function usePrefersReducedMotion(): boolean {
  return useSyncExternalStore(
    subscribeReducedMotion,
    () => window.matchMedia(REDUCED_MOTION).matches,
    () => false,
  );
}

let webglSupport: boolean | null = null;

function probeWebgl(): boolean {
  if (webglSupport === null) {
    try {
      const canvas = document.createElement("canvas");
      const context = canvas.getContext("webgl2") ?? canvas.getContext("webgl");
      webglSupport = context !== null;
      context?.getExtension("WEBGL_lose_context")?.loseContext();
    } catch {
      webglSupport = false;
    }
  }
  return webglSupport;
}

const subscribeNever = () => () => {};

/**
 * True when the browser can create a WebGL context (probed once). Support is assumed while rendering
 * on the server and hydrating, so the 3D layout is what loads; it settles right after hydration.
 */
export function useWebglSupport(): boolean {
  return useSyncExternalStore(subscribeNever, probeWebgl, () => true);
}
