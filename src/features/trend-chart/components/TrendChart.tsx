"use client";

import { useLayoutEffect, useRef, useState } from "react";
import { getSeries, type Metric, type Profile, type SeriesPoint } from "@/features/crew-health-data";
import { formatShortDate } from "@/shared/lib/format-date";
import { cn } from "@/shared/lib/cn";
import { CHART, PLOT_HEIGHT, buildScales, chartValues, formatTick, nearestIndex, plottablePoints, pointTooltip } from "../lib/chart-geometry";

interface TrendChartProps {
  person: Profile;
  metric: Metric;
  days: 7 | 30;
  /** History to plot instead of the profile's generated one. Points without a complete reading are skipped. */
  series?: readonly SeriesPoint[];
}

interface TooltipState {
  index: number;
  clientX: number;
  clientY: number;
}

const SERIES_STROKE = ["stroke-chart-primary", "stroke-chart-secondary"] as const;
const SERIES_FILL = ["fill-chart-primary", "fill-chart-secondary"] as const;

/** SVG history chart for one metric. Pointer, touch, and keyboard show the nearest reading. */
export function TrendChart({ person, metric, days, series }: TrendChartProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const lastTouchAt = useRef(-Infinity);
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);
  const [position, setPosition] = useState({ left: 0, top: 0 });

  const data = series ? plottablePoints(metric, series) : getSeries(person.id, metric.id, days);
  const { x, y, ticks, min } = buildScales(metric, data);
  const { width, height, left, right, top } = CHART;
  const seriesCount = metric.id === "bloodPressure" ? 2 : 1;
  const labelIndices = [...new Set([0, Math.floor((data.length - 1) / 3), Math.floor(((data.length - 1) * 2) / 3), data.length - 1])];
  const activePoint = tooltip ? data[Math.max(0, Math.min(data.length - 1, tooltip.index))] : undefined;

  // Position the tooltip after it renders so its own size is known (same clamping as the legacy chart).
  useLayoutEffect(() => {
    const element = tooltipRef.current;
    if (!tooltip || !element?.parentElement) return;
    const wrap = element.parentElement.getBoundingClientRect();
    const localX = tooltip.clientX - wrap.left;
    const localY = tooltip.clientY - wrap.top;
    setPosition({
      left: Math.max(8, Math.min(wrap.width - element.offsetWidth - 8, localX + 10)),
      top: Math.max(4, localY - element.offsetHeight - 10),
    });
  }, [tooltip]);

  if (data.length === 0) {
    return (
      <p id="chart-empty" role="status" className="mt-2.5 mb-0 grid min-h-40 place-items-center rounded-md border border-border bg-surface-subtle px-4 py-6 text-center text-body text-muted">
        No readings recorded for this metric in the mission dataset.
      </p>
    );
  }

  const showAt = (clientX: number, clientY: number) => {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) return;
    setTooltip({ index: nearestIndex(clientX, rect, data.length), clientX, clientY });
  };

  const showForFocus = (index: number) => {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) return;
    setTooltip({ index, clientX: rect.left + rect.width / 2, clientY: rect.top + 8 });
  };

  const barWidth = Math.max(4, Math.min(16, (width - left - right) / data.length * 0.56));
  const baseY = y(Math.max(min, 0));

  return (
    <div className="relative mt-2.5 w-full">
      <div
        ref={tooltipRef}
        id="chart-tooltip"
        role="status"
        hidden={!activePoint}
        style={{ left: position.left, top: position.top }}
        className="pointer-events-none absolute z-3 max-w-[min(310px,90%)] rounded-sm border border-border-strong bg-surface px-2.5 py-2 text-caption text-text shadow-popover"
      >
        {activePoint ? pointTooltip(metric, activePoint) : null}
      </div>
      <svg
        ref={svgRef}
        id="trend-chart"
        className="block h-auto w-full touch-pan-y overflow-visible"
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label={`${metric.label} for ${person.name}, last ${days} days. Fictional point readings.`}
        onPointerMove={(event) => showAt(event.clientX, event.clientY)}
        onPointerLeave={(event) => {
          // Touch emits a pointerleave right after touchstart; keep the touched reading visible.
          if (event.timeStamp - lastTouchAt.current > 700) setTooltip(null);
        }}
        onTouchStart={(event) => {
          lastTouchAt.current = event.timeStamp;
          const touch = event.touches[0];
          if (touch) showAt(touch.clientX, touch.clientY);
        }}
        onBlur={() => setTooltip(null)}
      >
        <title>{`${metric.label} history for ${person.name}`}</title>
        <desc>{`${days} days of deterministic fictional readings. Values are not for clinical use.`}</desc>
        {ticks.map((tick) => (
          <g key={tick}>
            <line className="stroke-chart-grid" strokeWidth={1} x1={left} y1={y(tick)} x2={width - right} y2={y(tick)} />
            <text className="fill-chart-axis text-xs" x={left - 10} y={y(tick) + 4} textAnchor="end">
              {formatTick(metric, tick)}
            </text>
          </g>
        ))}
        {labelIndices.map((index) => (
          <text key={index} className="fill-chart-axis text-xs" x={x(index)} y={height - 12} textAnchor="middle">
            {formatShortDate(data[index].date)}
          </text>
        ))}
        {metric.type === "bar"
          ? data.map((point, index) => {
              const py = y(point.value as number);
              return (
                <rect
                  key={point.date}
                  className="chart-bar fill-chart-bar"
                  x={x(index) - barWidth / 2}
                  y={Math.min(py, baseY)}
                  width={barWidth}
                  height={Math.max(1, Math.abs(baseY - py))}
                  rx={2}
                />
              );
            })
          : null}
        {metric.type === "category"
          ? data.map((point, index) => (
              <circle key={point.date} className="chart-mark stroke-white" strokeWidth={1.25} cx={x(index)} cy={y(point.value as number)} r={4} />
            ))
          : null}
        {metric.type === "line" || metric.type === "paired"
          ? Array.from({ length: seriesCount }, (_, series) => {
              const path = data.map((point, index) => `${index ? "L" : "M"}${x(index)} ${y(chartValues(metric, point.value)[series])}`).join(" ");
              return (
                <g key={series}>
                  <path className={cn("chart-line fill-none", SERIES_STROKE[series])} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" d={path} />
                  {data.map((point, index) => (
                    <circle
                      key={point.date}
                      className={cn("chart-mark stroke-white", SERIES_FILL[series])}
                      strokeWidth={1.25}
                      cx={x(index)}
                      cy={y(chartValues(metric, point.value)[series])}
                      r={3}
                    />
                  ))}
                </g>
              );
            })
          : null}
        {data.map((point, index) => (
          <circle
            key={point.date}
            className="chart-hit-target cursor-crosshair fill-transparent focus:stroke-primary-strong focus:outline-none"
            style={{ pointerEvents: "all" }}
            strokeWidth={2}
            data-point={index}
            tabIndex={0}
            role="button"
            aria-label={pointTooltip(metric, point)}
            cx={x(index)}
            cy={top + PLOT_HEIGHT / 2}
            r={12}
            onFocus={() => showForFocus(index)}
          />
        ))}
      </svg>
    </div>
  );
}
