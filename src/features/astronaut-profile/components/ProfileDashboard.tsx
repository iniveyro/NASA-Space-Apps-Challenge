"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { BodyMap, firstMetricFor, type RegionSignal } from "@/features/body-map";
import { getMetric, type BodyRegion, type MetricId, type MissionDataset, type Profile } from "@/features/crew-health-data";
import { MissionDaySelector, formatMissionDate } from "@/features/mission-timeline";
import { TrendPanel } from "@/features/trend-chart";
import { SectionHeading } from "@/shared/design-system";
import { dayReadings, daySeries, parseDayParam, readingText, type DayReading } from "../lib/profile-day";
import { MetricGrid } from "./MetricGrid";
import { MetricReference } from "./MetricReference";

/** The selected day's readings with their authored demo states, as the body map displays them. */
function regionSignals(readings: readonly DayReading[]): RegionSignal[] {
  return readings.map((reading) => ({
    metricId: reading.metric.id,
    label: reading.metric.label,
    value: readingText(reading),
    status: reading.scenario.status,
    statusLabel: reading.scenario.label,
  }));
}

interface ProfileDashboardProps {
  person: Profile;
  /** Mission dataset narrowed to this crew member. */
  data: MissionDataset;
}

/**
 * Interactive part of the profile. Next.js keeps recently visited routes mounted (hidden) and restores their
 * state, so a link that opens this profile on another day would otherwise show the day selected on the last
 * visit. Keying the dashboard on the navigation makes each fresh navigation read ?day= again, while
 * back/forward still restores the day, metric, and range the visitor left.
 */
export function ProfileDashboard(props: ProfileDashboardProps) {
  const { bfcacheId } = useRouter();
  return <DayDashboard key={bfcacheId} {...props} />;
}

/**
 * The mission day (seeded from ?day=, kept in the address bar) selects the readings, and the selected metric
 * drives the reference, chart, and body map.
 */
function DayDashboard({ person, data }: ProfileDashboardProps) {
  const params = useSearchParams();
  const total = data.days.length;
  const [day, setDay] = useState(() => parseDayParam(params.get("day"), total));
  const [metricId, setMetricId] = useState<MetricId>("heartRate");
  const [days, setDays] = useState<7 | 30>(30);
  const [region, setRegion] = useState<BodyRegion | null>(null);
  const metric = getMetric(metricId)!;
  const readings = useMemo(() => dayReadings(data, person, day), [data, person, day]);
  const signals = useMemo(() => regionSignals(readings), [readings]);
  const series = useMemo(() => daySeries(data, person.id, metricId, day, days), [data, person.id, metricId, day, days]);
  const selected = readings.find((reading) => reading.metric.id === metricId)!;
  const heartRate = readings.find((reading) => reading.metric.id === "heartRate")?.value;
  const latest = day >= total;

  const selectMetric = (id: MetricId) => {
    const next = getMetric(id);
    if (!next) return;
    setMetricId(id);
    setRegion(next.region);
  };

  // Shareable deep link: the latest day is the default, so it keeps the address bare.
  const selectDay = (next: number) => {
    setDay(next);
    const url = new URL(window.location.href);
    if (next >= total) url.searchParams.delete("day");
    else url.searchParams.set("day", String(next));
    if (url.href !== window.location.href) window.history.replaceState(null, "", url);
  };

  return (
    <>
      <MissionDaySelector days={data.days} events={data.events} crew={[person]} value={day} onChange={selectDay} />
      <section aria-labelledby="readings-title" className="mt-2 mb-6.25">
        <SectionHeading
          className="mb-3.25"
          title={latest ? "Latest readings" : `Day ${day} readings`}
          titleId="readings-title"
          description={`Fictional point readings · ${formatMissionDate(data.days[day - 1]?.date ?? "")}`}
          aside={<span className="text-caption text-muted">Colored states are authored demo scenarios, not medical assessments.</span>}
        />
        <MetricGrid readings={readings} selectedMetricId={metricId} onSelect={selectMetric} />
        <MetricReference reading={selected} />
      </section>
      <div className="grid grid-cols-[minmax(300px,.82fr)_minmax(0,1.55fr)] items-start gap-4 max-md:grid-cols-[minmax(0,.9fr)_minmax(0,1.3fr)] max-sm:grid-cols-1">
        <BodyMap
          region={region}
          onSelectRegion={(target) => selectMetric(firstMetricFor(target))}
          signals={signals}
          pulseBpm={typeof heartRate === "number" ? heartRate : null}
        />
        <TrendPanel person={person} metric={metric} days={days} onDaysChange={setDays} series={series} />
      </div>
    </>
  );
}
