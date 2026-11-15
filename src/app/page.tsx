import { CrewOverview } from "@/features/crew-overview";
import { MissionOrbitEmbed } from "@/features/mission-orbit";
import { STORM_EVENT, SolarStormEmbed } from "@/features/solar-storm";

export default function CrewPage() {
  return (
    <CrewOverview
      views={[
        { id: "mission", label: "Mission in 3D", hint: "Where the crew is on the selected day, and how long a signal takes to reach Earth.", content: <MissionOrbitEmbed /> },
        {
          id: "storm",
          label: "Solar storm",
          hint: "The solar-storm scenario on Mars' surface: who is outside, who is sheltered, and no link to Earth.",
          opensOnEvent: STORM_EVENT,
          content: <SolarStormEmbed />,
        },
      ]}
    />
  );
}
