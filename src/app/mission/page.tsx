import type { Metadata } from "next";
import { MissionOrbit } from "@/features/mission-orbit";

export const metadata: Metadata = { title: "Mission geometry" };

export default function MissionPage() {
  return <MissionOrbit />;
}
