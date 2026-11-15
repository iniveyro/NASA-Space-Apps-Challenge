import { CrewOverview } from "@/features/crew-overview";
import { MissionOrbitEmbed } from "@/features/mission-orbit";

export default function CrewPage() {
  return <CrewOverview mission={<MissionOrbitEmbed />} />;
}
