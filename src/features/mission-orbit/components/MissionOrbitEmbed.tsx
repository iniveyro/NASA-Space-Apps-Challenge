import { loadMissionView } from "../lib/mission-view.server";
import { MissionOrbitEmbedded } from "./MissionOrbitBoard";

/**
 * The mission view for placing inside another screen, such as the home page. It follows that screen's
 * mission-day selector (see `MissionDayProvider`) and only sends the mission geometry and story: the
 * dataset it shows comes from the screen it sits in.
 */
export async function MissionOrbitEmbed() {
  const { geometry, story } = await loadMissionView();
  return <MissionOrbitEmbedded geometry={geometry} story={story} />;
}
