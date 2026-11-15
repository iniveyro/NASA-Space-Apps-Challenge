"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState, useSyncExternalStore } from "react";
import { BodyMap, firstMetricFor, type RegionSignal } from "@/features/body-map";
import { getMetric, type BodyRegion, type MetricId, type MissionDataset, type Profile } from "@/features/crew-health-data";
import { GuidanceModal, type DemoScenarioId, evaluateReading, createEvent, guidanceStore, type GuidanceEvaluation } from "@/features/health-guidance";
import { MissionDaySelector, formatMissionDate } from "@/features/mission-timeline";
import { TrendPanel } from "@/features/trend-chart";
import { SectionHeading } from "@/shared/design-system";
import { dayReadings, daySeries, parseDayParam, readingText, type DayReading } from "../lib/profile-day";
import { MetricGrid } from "./MetricGrid";
import { MetricReference } from "./MetricReference";

interface ProfileDashboardProps {
  person: Profile;
  /** Mission dataset narrowed to this crew member. */
  data: MissionDataset;
}

function scenarioMetric(scenario: DemoScenarioId): MetricId {
  return scenario === "sleep-short" ? "sleep" : scenario === "respiratory-symptoms" ? "spo2" : "radiation";
}

function regionSignals(readings: readonly DayReading[]): RegionSignal[] {
  return readings.map((reading) => ({
    metricId: reading.metric.id,
    label: reading.metric.label,
    value: readingText(reading),
    status: reading.scenario.status,
    statusLabel: reading.scenario.label,
  }));
}

/**
 * Next.js can retain recently visited routes. Keying on navigation re-reads ?day= on fresh links
 * while back/forward restores the selected day, metric, and chart range.
 */
export function ProfileDashboard(props: ProfileDashboardProps) {
  const { bfcacheId } = useRouter();
  return <DayDashboard key={`${props.person.id}:${bfcacheId}`} {...props} />;
}

function DayDashboard({ person, data }: ProfileDashboardProps) {
  const params = useSearchParams();
  const total = data.days.length;
  const [day, setDay] = useState(() => parseDayParam(params.get("day"), total));
  const [metricId, setMetricId] = useState<MetricId>("heartRate");
  const [days, setDays] = useState<7 | 30>(30);
  const [region, setRegion] = useState<BodyRegion | null>(null);
  const [guidanceOpen, setGuidanceOpen] = useState(false);
  const [guidanceMetricId, setGuidanceMetricId] = useState<MetricId>("heartRate");
  const [activeScenario, setActiveScenario] = useState<DemoScenarioId | null>(null);
  const storeSnapshot = useSyncExternalStore(guidanceStore.subscribe, guidanceStore.getSnapshot, guidanceStore.getServerSnapshot);
  const metric = getMetric(metricId)!;
  const missionDate = data.days[day - 1]?.date ?? "";
  const missionTimestamp = `${missionDate}T00:00:00.000Z`;
  const readings = useMemo(() => dayReadings(data, person, day), [data, person, day]);
  const signals = useMemo(() => regionSignals(readings), [readings]);
  const series = useMemo(() => daySeries(data, person.id, metricId, day, days), [data, person.id, metricId, day, days]);
  const selected = readings.find((reading) => reading.metric.id === metricId)!;
  const heartRate = readings.find((reading) => reading.metric.id === "heartRate")?.value;
  const latest = day >= total;
  const currentEvaluations = useMemo(() => Object.fromEntries(readings.map((reading) => {
    const demoScenario = activeScenario && scenarioMetric(activeScenario) === reading.metric.id ? activeScenario : null;
    const value = demoScenario === "sleep-short" ? 5.2 : demoScenario === "respiratory-symptoms" ? 91 : demoScenario === "radiation-event" ? 153.09 : reading.value;
    const missionEvents = data.events.filter((event) => event.day === day && event.crewId === person.id);
    const scenarioKey = demoScenario
      ? `demo:${demoScenario}`
      : `mission:${reading.scenario.status}:${missionEvents.map((event) => event.event).sort().join("+") || "reference"}`;
    const environmentalEvent = reading.metric.id === "radiation" && (demoScenario === "radiation-event" || missionEvents.some((event) => event.event === "solar_storm"));
    const readingId = `${person.id}:metric:${reading.metric.id}:day:${day}:date:${missionDate}:scenario:${scenarioKey}`;
    const evaluated = evaluateReading({
      person,
      metricId: reading.metric.id,
      value,
      unit: reading.metric.unit,
      readingId,
      timestamp: missionTimestamp,
      now: missionTimestamp,
      referenceTime: missionTimestamp,
      source: demoScenario ? "scenario" : "fixture",
      authoredScenario: reading.scenario,
      missionDay: day,
      missionDate,
      scenarioKey,
      scenarioId: demoScenario ?? undefined,
      environmentalEvent,
      symptoms: demoScenario === "respiratory-symptoms" ? ["trouble-breathing"] : [],
      activityState: demoScenario === "respiratory-symptoms" ? "sleeping" : "unknown",
    });
    const saved = storeSnapshot.events.find((event) => event.astronautId === person.id && event.metricId === reading.metric.id &&
      event.readingId === readingId && event.missionDay === day && event.missionDate === missionDate && event.scenarioKey === scenarioKey);
    return [reading.metric.id, saved?.currentEvaluation ?? evaluated];
  })) as Record<MetricId, GuidanceEvaluation>, [readings, person, activeScenario, data.events, day, missionDate, missionTimestamp, storeSnapshot.events]);

  const selectMetric = (id: MetricId) => {
    const next = getMetric(id);
    if (!next) return;
    setMetricId(id);
    setRegion(next.region);
  };

  const selectDay = (next: number) => {
    setGuidanceOpen(false);
    setActiveScenario(null);
    setDay(next);
    const url = new URL(window.location.href);
    if (next >= total) url.searchParams.delete("day");
    else url.searchParams.set("day", String(next));
    if (url.href !== window.location.href) window.history.replaceState(null, "", url);
  };

  const openGuidance = (id: MetricId) => {
    guidanceStore.ensureEvent(currentEvaluations[id], createEvent);
    setGuidanceMetricId(id);
    setGuidanceOpen(true);
  };

  const guidanceEvaluation = currentEvaluations[guidanceMetricId];
  const activateScenario = (scenario: DemoScenarioId) => {
    setActiveScenario(scenario);
    selectMetric(scenarioMetric(scenario));
  };

  return (
    <>
      <MissionDaySelector days={data.days} events={data.events} crew={[person]} value={day} onChange={selectDay} />
      <section aria-labelledby="readings-title" className="mt-2 mb-6.25">
        <SectionHeading
          className="mb-3.25"
          title={latest ? "Latest readings" : `Day ${day} readings`}
          titleId="readings-title"
          description={`Fictional point readings · ${formatMissionDate(missionDate)}`}
          aside={<span className="text-caption text-muted">Colored states are authored demo scenarios, not medical assessments.</span>}
        />
        <div className="mb-3 rounded-xl border border-border bg-surface p-3" aria-label="Simulation controls">
          <p className="text-caption font-strong">Simulation · fictional overlays only; mission-day data is unchanged</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <button type="button" aria-pressed={activeScenario === "sleep-short"} onClick={() => activateScenario("sleep-short")} className="rounded-md border border-border px-3 py-2 text-caption">A · Short sleep (5.2 h / demo target 7.5 h)</button>
            <button type="button" aria-pressed={activeScenario === "respiratory-symptoms"} onClick={() => activateScenario("respiratory-symptoms")} className="rounded-md border border-border px-3 py-2 text-caption">B · Respiratory symptoms (sleep state active)</button>
            <button type="button" aria-pressed={activeScenario === "radiation-event"} onClick={() => activateScenario("radiation-event")} className="rounded-md border border-border px-3 py-2 text-caption">C · Radiation environmental event</button>
            {activeScenario && <button type="button" onClick={() => { setActiveScenario(null); setGuidanceOpen(false); }} className="rounded-md border border-border px-3 py-2 text-caption">Exit simulation</button>}
          </div>
        </div>
        <MetricGrid person={person} readings={readings} selectedMetricId={metricId} evaluations={currentEvaluations} onSelect={selectMetric} onOpenGuidance={openGuidance} />
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
      <GuidanceModal
        key={`${person.id}:${day}:${missionDate}:${guidanceMetricId}:${guidanceEvaluation.scenarioKey}`}
        open={guidanceOpen}
        person={person}
        evaluation={guidanceEvaluation}
        onClose={() => setGuidanceOpen(false)}
      />
    </>
  );
}
