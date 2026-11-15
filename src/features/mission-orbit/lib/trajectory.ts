import { phaseDay, type MissionGeometry } from "./geometry";

export interface TrajectoryLeg {
  id: "out" | "surface" | "return";
  label: string;
  /** Design token of the leg color; the same tokens fill the phases of the mission-day band. */
  token: string;
  /** First and last mission day of the leg, inclusive. */
  days: (geometry: MissionGeometry) => [number, number];
}

/** The three legs of the mission trajectory, in mission order. */
export const TRAJECTORY_LEGS: readonly TrajectoryLeg[] = [
  { id: "out", label: "Transit out", token: "color-chart-primary", days: (geometry) => [1, phaseDay(geometry, "mars_arrival") ?? geometry.total] },
  {
    id: "surface",
    label: "Mars surface",
    token: "color-chart-secondary",
    days: (geometry) => [phaseDay(geometry, "mars_arrival") ?? geometry.total, phaseDay(geometry, "mars_departure") ?? geometry.total],
  },
  { id: "return", label: "Transit return", token: "color-chart-bar", days: (geometry) => [phaseDay(geometry, "mars_departure") ?? geometry.total, geometry.total] },
];
