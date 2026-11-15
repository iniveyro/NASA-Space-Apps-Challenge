"use client";

import { useMemo, useState, useSyncExternalStore } from "react";
import { BodyMap, firstMetricFor, type RegionSignal } from "@/features/body-map";
import { METRICS, MISSION_END, formatValue, getMetric, latest, resolveMetricScenario, type BodyRegion, type MetricId, type Profile } from "@/features/crew-health-data";
import { GuidanceModal, type DemoScenarioId, evaluateReading, createEvent, guidanceStore, resetScenarioContext, type GuidanceEvaluation } from "@/features/health-guidance";
import { TrendPanel } from "@/features/trend-chart";
import { SectionHeading } from "@/shared/design-system";
import { MetricGrid } from "./MetricGrid";
import { MetricReference } from "./MetricReference";

function metricEvaluation(person: Profile, metricId: MetricId, activeScenario: DemoScenarioId | null, events: ReturnType<typeof guidanceStore.getSnapshot>["events"], ignoreSaved = false): GuidanceEvaluation {
  const scenarioMetric = activeScenario === "sleep-short" ? "sleep" : activeScenario === "respiratory-symptoms" ? "spo2" : activeScenario === "radiation-event" ? "radiation" : null;
  const usesScenario = activeScenario !== null && scenarioMetric === metricId;
  if (!ignoreSaved) {
    const saved = events.filter((event) => event.astronautId === person.id && event.metricId === metricId)
      .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))[0];
    const savedScenarioMatches = saved && (saved.currentEvaluation.scenarioId === activeScenario || saved.evaluation.scenarioId === activeScenario);
    if (saved && (!usesScenario || savedScenarioMatches)) return saved.currentEvaluation;
  }
  const value = usesScenario ? activeScenario === "sleep-short" ? 5.2 : activeScenario === "respiratory-symptoms" ? 91 : 153.09 : latest(person.id, metricId);
  const source = usesScenario ? "scenario" as const : "fixture" as const;
  return evaluateReading({
    person, metricId, value, readingId: `${source}:${person.id}:${metricId}:${usesScenario ? activeScenario : MISSION_END}`,
    timestamp: `${MISSION_END}T00:00:00.000Z`, referenceTime: `${MISSION_END}T00:00:00.000Z`, source,
    scenarioId: usesScenario ? activeScenario : undefined,
    environmentalEvent: activeScenario === "radiation-event" && metricId === "radiation",
    symptoms: activeScenario === "respiratory-symptoms" && metricId === "spo2" ? ["trouble-breathing"] : [],
    activityState: activeScenario === "respiratory-symptoms" ? "sleeping" : "unknown",
  });
}

/** The profile's latest readings with their authored demo states, as the body map displays them. */
function regionSignals(profileId: string): RegionSignal[] {
  return METRICS.map((item) => {
    const value = latest(profileId, item.id);
    const formatted = formatValue(item.id, value);
    const scenario = resolveMetricScenario(profileId, item.id, value);
    return { metricId: item.id, label: item.label, value: formatted === "Unknown" ? formatted : `${formatted} ${item.unit}`, status: scenario.status, statusLabel: scenario.label };
  });
}

/**
 * Interactive part of the profile: the selected metric drives the reference, chart, and body map.
 * State resets per profile because the route remounts this component.
 */
export function ProfileDashboard({ person }: { person: Profile }) {
  const [metricId, setMetricId] = useState<MetricId>("heartRate");
  const [days, setDays] = useState<7 | 30>(30);
  const [region, setRegion] = useState<BodyRegion | null>(null);
  const [guidanceOpen, setGuidanceOpen] = useState(false);
  const [guidanceMetricId, setGuidanceMetricId] = useState<MetricId>("heartRate");
  const [activeScenario, setActiveScenario] = useState<DemoScenarioId | null>(null);
  const storeSnapshot = useSyncExternalStore(guidanceStore.subscribe, guidanceStore.getSnapshot, guidanceStore.getServerSnapshot);
  const metric = getMetric(metricId)!;
  const signals = useMemo(() => regionSignals(person.id), [person.id]);
  const heartRate = latest(person.id, "heartRate");
  const guidanceEvaluation = useMemo(() => metricEvaluation(person, guidanceMetricId, activeScenario, storeSnapshot.events), [person, guidanceMetricId, activeScenario, storeSnapshot.events]);
  const currentEvaluations = useMemo(() => Object.fromEntries(METRICS.map((item) => [item.id, metricEvaluation(person, item.id, activeScenario, storeSnapshot.events)])) as Record<MetricId, GuidanceEvaluation>, [person, activeScenario, storeSnapshot.events]);

  function exitSimulation() {
    if (activeScenario) {
      const targetMetric: MetricId = activeScenario === "sleep-short" ? "sleep" : activeScenario === "respiratory-symptoms" ? "spo2" : "radiation";
      const existing = [...storeSnapshot.events].reverse().find((event) => event.astronautId === person.id && event.metricId === targetMetric &&
        (event.currentEvaluation.scenarioId === activeScenario || event.evaluation.scenarioId === activeScenario));
      if (existing) guidanceStore.updateEvent(resetScenarioContext(existing, metricEvaluation(person, targetMetric, null, [], true)));
    }
    setActiveScenario(null);
    setGuidanceOpen(false);
  }

  const selectMetric = (id: MetricId) => {
    const next = getMetric(id);
    if (!next) return;
    setMetricId(id);
    setRegion(next.region);
  };

  return (
    <>
      <section aria-labelledby="readings-title" className="mt-2 mb-6.25">
        <SectionHeading
          className="mb-3.25"
          title="Latest readings"
          titleId="readings-title"
          description="Fictional point readings · 12 Jun 2029"
          aside={<span className="text-caption text-muted">Colored states are authored demo scenarios, not medical assessments.</span>}
        />
        <div className="mb-3 rounded-xl border border-border bg-surface p-3" aria-label="Simulation controls">
          <p className="text-caption font-strong">Simulation · fictional overlays only; profile fixtures are unchanged</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <button type="button" aria-pressed={activeScenario === "sleep-short"} onClick={() => { setActiveScenario("sleep-short"); selectMetric("sleep"); }} className="rounded-md border border-border px-3 py-2 text-caption">A · Short sleep (5.2 h / demo target 7.5 h)</button>
            <button type="button" aria-pressed={activeScenario === "respiratory-symptoms"} onClick={() => { setActiveScenario("respiratory-symptoms"); selectMetric("spo2"); }} className="rounded-md border border-border px-3 py-2 text-caption">B · Respiratory symptoms (sleep state active)</button>
            <button type="button" aria-pressed={activeScenario === "radiation-event"} onClick={() => { setActiveScenario("radiation-event"); selectMetric("radiation"); }} className="rounded-md border border-border px-3 py-2 text-caption">C · Radiation environmental event</button>
            {activeScenario && <button type="button" onClick={exitSimulation} className="rounded-md border border-border px-3 py-2 text-caption">Exit simulation</button>}
            {!activeScenario && (currentEvaluations[metricId].scenarioId || currentEvaluations[metricId].environmentalEvent) && <button type="button" onClick={() => {
              const existing = guidanceStore.findEvent(currentEvaluations[metricId]);
              if (existing) guidanceStore.updateEvent(resetScenarioContext(existing, metricEvaluation(person, metricId, null, [], true)));
            }} className="rounded-md border border-border px-3 py-2 text-caption">Reset saved simulation context</button>}
          </div>
        </div>
        <MetricGrid person={person} selectedMetricId={metricId} evaluations={currentEvaluations} onSelect={selectMetric} onOpenGuidance={(id) => {
          const selectedEvaluation = metricEvaluation(person, id, activeScenario, storeSnapshot.events);
          guidanceStore.ensureEvent(selectedEvaluation, createEvent);
          setGuidanceMetricId(id);
          setGuidanceOpen(true);
        }} />
        <MetricReference person={person} metric={metric} />
      </section>
      <div className="grid grid-cols-[minmax(300px,.82fr)_minmax(0,1.55fr)] items-start gap-4 max-md:grid-cols-[minmax(0,.9fr)_minmax(0,1.3fr)] max-sm:grid-cols-1">
        <BodyMap
          region={region}
          onSelectRegion={(target) => selectMetric(firstMetricFor(target))}
          signals={signals}
          pulseBpm={typeof heartRate === "number" ? heartRate : null}
        />
        <TrendPanel person={person} metric={metric} days={days} onDaysChange={setDays} />
      </div>
      <GuidanceModal key={`${person.id}:${guidanceMetricId}`} open={guidanceOpen} person={person} evaluation={guidanceEvaluation} onClose={() => setGuidanceOpen(false)} />
    </>
  );
}
