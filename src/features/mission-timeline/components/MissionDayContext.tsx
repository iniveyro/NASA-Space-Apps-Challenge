"use client";

import { createContext, use, type ReactNode } from "react";
import type { MissionDataset } from "@/features/crew-health-data";

/** The mission day a screen is showing, how to change it, and the dataset that day belongs to. */
export interface MissionDayState {
  data: MissionDataset;
  day: number;
  onChange: (day: number) => void;
}

const MissionDayContext = createContext<MissionDayState | null>(null);

/** Lets views rendered inside a screen follow that screen's mission-day selector instead of keeping their own. */
export function MissionDayProvider({ value, children }: { value: MissionDayState; children: ReactNode }) {
  return <MissionDayContext value={value}>{children}</MissionDayContext>;
}

/** The surrounding screen's selected mission day, or null when the view is rendered on its own. */
export function useMissionDay(): MissionDayState | null {
  return use(MissionDayContext);
}
