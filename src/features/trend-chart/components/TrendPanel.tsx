"use client";

import type { Metric, Profile, SeriesPoint } from "@/features/crew-health-data";
import { Panel, PanelHeading, SegmentedToggle } from "@/shared/design-system";
import { cn } from "@/shared/lib/cn";
import { TrendChart } from "./TrendChart";

interface TrendPanelProps {
  person: Profile;
  metric: Metric;
  days: 7 | 30;
  onDaysChange: (days: 7 | 30) => void;
  /** History to plot instead of the profile's generated one; an empty series shows the chart's empty state. */
  series?: readonly SeriesPoint[];
  className?: string;
}

const RANGE_OPTIONS = [
  { value: 7, label: "7 days" },
  { value: 30, label: "30 days" },
] as const;

/** "Wellness trends" panel: range switch, selected metric header, chart, and legend. */
export function TrendPanel({ person, metric, days, onDaysChange, series, className }: TrendPanelProps) {
  return (
    <Panel className={cn("trend-panel", className)} aria-labelledby="trend-title">
      <PanelHeading
        className="items-center"
        eyebrow="PERSONAL HISTORY"
        title="Wellness trends"
        titleId="trend-title"
        actions={<SegmentedToggle label="Chart date range" dataKey="days" options={RANGE_OPTIONS} value={days} onChange={onDaysChange} />}
      />
      <div className="mt-5.75 flex items-center justify-between gap-3 border-b border-divider pb-2.5 max-xs:flex-col max-xs:items-start max-xs:gap-1.25">
        <div className="flex items-baseline gap-2.25">
          <span id="chart-metric-title" className="text-body font-strong">
            {metric.label}
          </span>
          <span id="chart-metric-unit" className="text-caption text-muted">
            {metric.unit}
          </span>
        </div>
        <span id="chart-range-label" className="text-micro font-bold tracking-caps text-muted">
          LAST {days} DAYS
        </span>
      </div>
      <TrendChart key={`${metric.id}-${days}`} person={person} metric={metric} days={days} series={series} />
      <div id="chart-legend" className="flex flex-wrap gap-3.75 pt-1.75 pl-11 text-caption text-text-subtle max-xs:pl-8.5">
        {metric.id === "bloodPressure" ? (
          <>
            <LegendItem label="Systolic" dotClass="bg-chart-primary" />
            <LegendItem label="Diastolic" dotClass="bg-chart-secondary" />
          </>
        ) : (
          <LegendItem label={metric.label} dotClass="bg-chart-primary" />
        )}
      </div>
      <div className="mt-2.75 text-xs text-muted">
        <span>Daily fictional point readings · not for clinical use</span>
      </div>
    </Panel>
  );
}

function LegendItem({ label, dotClass }: { label: string; dotClass: string }) {
  return (
    <span className="inline-flex items-center gap-1.75">
      <i className={cn("inline-block size-2 rounded-full", dotClass)} />
      {label}
    </span>
  );
}
