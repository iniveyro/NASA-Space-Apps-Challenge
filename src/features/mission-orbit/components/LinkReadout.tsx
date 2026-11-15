import type { CommStatus } from "@/features/crew-health-data";
import { commLabel, formatMissionDate, phaseLabel } from "@/features/mission-timeline";
import { StatusText } from "@/shared/design-system";
import { cn } from "@/shared/lib/cn";
import { formatDegrees, formatDelay, formatMkm, pluralDays } from "../lib/format";
import { SOLAR_EXCLUSION_DEG, blackoutSpans, delayMinutes, farthestDay, linkOutlook, type MissionGeometry } from "../lib/geometry";
import { DelayCurve } from "./DelayCurve";

interface LinkReadoutProps {
  geometry: MissionGeometry;
  day: number;
  /** One-way delay in minutes for every mission day (index `day - 1`). */
  delays: readonly (number | null)[];
  /** Longest round trip of the mission, in minutes; scales the waiting-time bar. */
  maxRoundTripMin: number;
  className?: string;
}

function Row({ label, value, readout, note }: { label: string; value: string; readout: string; note?: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-t border-console-divider py-2.25">
      <dt className="text-caption text-console-muted">{label}</dt>
      <dd className="m-0 text-right">
        <span data-readout={readout} className="block text-body font-strong text-console-text tabular-nums">
          {value}
        </span>
        {note ? <span className="block text-micro text-console-faint">{note}</span> : null}
      </dd>
    </div>
  );
}

/** Console card with the Earth-link figures for the selected mission day. Every value comes from the dataset. */
export function LinkReadout({ geometry, day, delays, maxRoundTripMin, className }: LinkReadoutProps) {
  const index = day - 1;
  const comm: CommStatus = geometry.comm[index] ?? "unknown";
  const phase = geometry.phase[index];
  const delay = delayMinutes(geometry, day);
  const roundTrip = delay === null ? null : delay * 2;
  const outlook = linkOutlook(geometry, day);
  const blackout = outlook.state === "blackout";
  const onSurface = phase === "mars_arrival" || phase === "surface" || phase === "mars_departure";
  const sol = geometry.marsSol[index];
  const ls = geometry.marsLsDeg[index];
  const fraction = blackout ? 1 : roundTrip !== null && maxRoundTripMin > 0 ? Math.min(1, roundTrip / maxRoundTripMin) : 0;

  let answer = roundTrip === null ? "Unknown" : formatDelay(roundTrip);
  let answerNote = "question out, answer back";
  if (outlook.state === "blackout") {
    answer = outlook.linkReturnsDay === null ? "No link" : `Not before ${formatMissionDate(geometry.date[outlook.linkReturnsDay - 1])}`;
    answerNote = outlook.daysUntilLink === null ? "no return in the dataset" : `link returns in ${pluralDays(outlook.daysUntilLink)}, on day ${outlook.linkReturnsDay}`;
  }

  return (
    <article
      id="link-readout"
      aria-labelledby="link-readout-title"
      data-comm={comm}
      className={cn("min-w-0 rounded-2xl border border-console-border bg-console p-4.5 text-console-text shadow-card max-sm:p-4", className)}
    >
      <p className="m-0 mb-1 text-eyebrow text-console-muted">
        EARTH LINK · DAY {day} · {formatMissionDate(geometry.date[index]).toUpperCase()}
      </p>
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
        <h2 id="link-readout-title" className="m-0 text-lg text-console-text">
          {phase ? phaseLabel(phase) : "Unknown phase"}
        </h2>
        <StatusText id="link-status" variant="console" status={comm} label={blackout ? "No Earth link" : commLabel(comm)} showDot />
      </div>

      <p className="m-0 mt-4 text-caption text-console-muted">One-way signal to Earth</p>
      <p data-readout="delay" className="m-0 text-display-sm leading-tight font-heavy tracking-tight text-white tabular-nums">
        {formatDelay(delay)}
      </p>
      {outlook.state === "blackout" ? (
        <p data-readout="blackout" className="m-0 mt-1 text-caption font-semibold text-console-text-soft">
          Day {outlook.dayOfBlackout} of {outlook.span.count} without contact. The signal cannot pass the Sun.
        </p>
      ) : outlook.state === "link" && outlook.daysToBlackout !== null && outlook.daysToBlackout <= 30 ? (
        <p data-readout="conjunction-countdown" className="m-0 mt-1 text-caption font-semibold text-status-warn-on-dark">
          Solar conjunction in {pluralDays(outlook.daysToBlackout)}: {pluralDays(outlook.nextBlackout?.count ?? 0)} without contact.
        </p>
      ) : null}

      <dl className="m-0 mt-3.5">
        <Row label="An answer from Earth" value={answer} readout="round-trip" note={answerNote} />
        <Row label="Distance to Earth" value={formatMkm(geometry.distEarthMkm[index])} readout="distance-earth" />
        <Row
          label="Distance to Mars"
          value={onSurface ? "On the surface" : formatMkm(geometry.distMarsMkm[index])}
          readout="distance-mars"
          note={onSurface && typeof sol === "number" ? `sol ${sol.toFixed(1)}${typeof ls === "number" ? ` · solar longitude ${ls.toFixed(1)}°` : ""}` : undefined}
        />
        <Row
          label="Sun–Earth–crew angle"
          value={formatDegrees(geometry.sunAngleDeg[index])}
          readout="sun-angle"
          note={`link is lost below ${SOLAR_EXCLUSION_DEG}°`}
        />
      </dl>

      <div className="mt-2 border-t border-console-divider pt-3">
        <DelayCurve delays={delays} day={day} blackouts={blackoutSpans(geometry.comm)} farthestDay={farthestDay(geometry)} />
      </div>

      <div className="mt-3 border-t border-console-divider pt-3">
        <p id="autonomy-label" className="m-0 mb-1.75 text-caption text-console-muted">
          Waiting time for an answer, against the longest of the mission
        </p>
        <div
          role="img"
          aria-labelledby="autonomy-label"
          aria-describedby="autonomy-scale"
          data-readout="autonomy"
          data-fraction={fraction.toFixed(3)}
          className="relative h-2.5 overflow-hidden rounded-xs bg-console-raised"
        >
          <span className={cn("absolute inset-y-0 left-0 rounded-xs", blackout ? "bg-status-unknown-border" : "bg-space-signal")} style={{ width: `${(fraction * 100).toFixed(1)}%` }} />
        </div>
        <p id="autonomy-scale" className="m-0 mt-1.5 flex justify-between gap-3 text-micro font-strong tracking-caps text-console-faint">
          <span>EARTH-DEPENDENT</span>
          <span className="text-right">EARTH-INDEPENDENT</span>
        </p>
      </div>
    </article>
  );
}
