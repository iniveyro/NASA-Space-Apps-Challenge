import { loadStormData } from "../lib/storm.server";
import { SolarStormEmbedded } from "./StormBoard";

/** The solar-storm view for placing inside another screen, such as the home page. It follows that screen's mission-day selector. */
export async function SolarStormEmbed() {
  const data = await loadStormData();
  if (!data) {
    return (
      <p id="storm-missing" className="rounded-xl border border-border bg-surface p-5 text-body text-muted">
        This mission dataset has no solar-storm event.
      </p>
    );
  }
  return <SolarStormEmbedded {...data} />;
}
