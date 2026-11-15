"use client";

import { useId, useMemo } from "react";
import { buildDelayCurve, curveX, curveY } from "../lib/delay-curve";
import { formatDelay } from "../lib/format";
import type { DaySpan } from "../lib/geometry";

const WIDTH = 300;
const HEIGHT = 56;

interface DelayCurveProps {
  /** One-way delay in minutes per mission day (index `day - 1`). */
  delays: readonly (number | null)[];
  day: number;
  blackouts: readonly DaySpan[];
  /** Day of the longest delay, from the position vectors. */
  farthestDay: number | null;
}

/** One-way signal delay across the whole mission, with the selected day marked. Drawn for the dark console card. */
export function DelayCurve({ delays, day, blackouts, farthestDay }: DelayCurveProps) {
  const clipId = useId();
  const curve = useMemo(() => buildDelayCurve(delays, WIDTH, HEIGHT), [delays]);
  const total = delays.length;
  const selected = delays[day - 1];
  const x = curveX(day, total, WIDTH);
  const y = curveY(selected, curve.maxMin, HEIGHT);
  const longest = farthestDay === null ? null : delays[farthestDay - 1];
  const summary = `One-way signal delay across the ${total} mission days. Longest: ${formatDelay(longest)}${farthestDay === null ? "" : ` on day ${farthestDay}`}. Day ${day}: ${formatDelay(selected)}.`;

  return (
    <figure className="m-0" data-readout="delay-curve" data-day={day}>
      <figcaption className="mb-1.75 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 text-caption text-console-muted">
        <span>One-way delay across the mission</span>
        <span data-readout="delay-max" className="text-micro text-console-faint tabular-nums">
          longest {formatDelay(longest)}
          {farthestDay === null ? "" : ` · day ${farthestDay}`}
        </span>
      </figcaption>
      <div className="relative">
        <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} preserveAspectRatio="none" role="img" aria-label={summary} className="block h-14 w-full overflow-visible">
          <defs>
            <clipPath id={clipId}>
              <rect x={0} y={0} width={x} height={HEIGHT} />
            </clipPath>
          </defs>
          {blackouts.map((span) => {
            const from = curveX(span.startDay - 0.5, total, WIDTH);
            const to = curveX(span.endDay + 0.5, total, WIDTH);
            return <rect key={span.startDay} data-curve-blackout="" x={from} y={0} width={Math.max(1.5, to - from)} height={HEIGHT} className="fill-status-unknown-border/45" />;
          })}
          <path d={curve.area} className="fill-space-signal/12" />
          <path d={curve.area} clipPath={`url(#${clipId})`} className="fill-space-signal/30" />
          <path d={curve.line} className="fill-none stroke-space-signal" strokeWidth={1.5} strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
          <line x1={x} x2={x} y1={0} y2={HEIGHT} className="stroke-console-text" strokeWidth={1} vectorEffect="non-scaling-stroke" />
        </svg>
        <span
          aria-hidden="true"
          className="pointer-events-none absolute size-2.25 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-console bg-console-text"
          style={{ left: `${((x / WIDTH) * 100).toFixed(2)}%`, top: `${((y / HEIGHT) * 100).toFixed(2)}%` }}
        />
      </div>
      <p className="m-0 mt-1.5 flex justify-between gap-3 text-micro text-console-faint tabular-nums">
        <span>Day 1</span>
        {blackouts.length ? <span>shaded: no Earth link</span> : null}
        <span>Day {total}</span>
      </p>
    </figure>
  );
}
