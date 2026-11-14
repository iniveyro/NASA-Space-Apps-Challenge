"use client";

import { useState } from "react";
import { BodyMap, firstMetricFor } from "@/features/body-map";
import { getMetric, type BodyRegion, type MetricId, type Profile } from "@/features/crew-health-data";
import { TrendPanel } from "@/features/trend-chart";
import { SectionHeading } from "@/shared/design-system";
import { MetricGrid } from "./MetricGrid";
import { MetricReference } from "./MetricReference";

/**
 * Interactive part of the profile: the selected metric drives the reference, chart, and body map.
 * State resets per profile because the route remounts this component.
 */
export function ProfileDashboard({ person }: { person: Profile }) {
  const [metricId, setMetricId] = useState<MetricId>("heartRate");
  const [days, setDays] = useState<7 | 30>(30);
  const [region, setRegion] = useState<BodyRegion | null>(null);
  const metric = getMetric(metricId)!;

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
        <MetricGrid person={person} selectedMetricId={metricId} onSelect={selectMetric} />
        <MetricReference person={person} metric={metric} />
      </section>
      <div className="grid grid-cols-[minmax(300px,.82fr)_minmax(0,1.55fr)] items-start gap-4 max-md:grid-cols-[minmax(0,.9fr)_minmax(0,1.3fr)] max-sm:grid-cols-1">
        <BodyMap region={region} onSelectRegion={(target) => selectMetric(firstMetricFor(target))} />
        <TrendPanel person={person} metric={metric} days={days} onDaysChange={setDays} />
      </div>
    </>
  );
}
