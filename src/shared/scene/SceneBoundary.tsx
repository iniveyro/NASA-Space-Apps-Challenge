"use client";

import { Component, type ReactNode } from "react";

interface SceneBoundaryProps {
  /** Called once when the scene throws, so the caller can switch to its 2D fallback. */
  onError: () => void;
  children: ReactNode;
}

/** Error boundary for a WebGL scene: a scene that fails renders nothing instead of breaking the page. */
export class SceneBoundary extends Component<SceneBoundaryProps, { failed: boolean }> {
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
