"use client";

import { useEffect, useRef, useState, useSyncExternalStore, type FormEvent } from "react";
import { formatValue, getMetric, type MetricReading, type Profile } from "@/features/crew-health-data";
import { guidanceStore } from "../lib/browser-store";
import { recordAction, recordEscalation, recordFollowUp, reportSymptoms, resolveEvent, reviewContext } from "../lib/events";
import { isCompleteFiniteReading } from "../lib/evaluate";
import { getGuidance } from "../lib/catalog";
import type { GuidanceEvaluation, SymptomId } from "../lib/types";

const symptomOptions: { id: SymptomId; label: string }[] = [
  { id: "trouble-breathing", label: "Trouble breathing" },
  { id: "chest-pain", label: "Chest pain" },
  { id: "fainting", label: "Fainting" },
  { id: "confusion", label: "New confusion" },
];

const REASON_EXPLANATIONS: Record<string, string> = {
  AUTHORED_DEMO_PREVENTION_ONLY: "The authored fixture is routed to educational prevention text; this is not a finding that the person is healthy.",
  AUTHORED_DEMO_DEVIATION: "The fixture author marked this demo observation for review; the value is not compared with a clinical threshold.",
  AUTHORED_DEMO_ALERT_NOT_CLINICAL: "This alert status was authored for the demo. It is not a diagnosis or a validated medical limit.",
  DEMO_SLEEP_BELOW_AUTHORED_TARGET: "This simulation compares a fictional 5.2-hour reading with an invented 7.5-hour demo target only.",
  DEMO_RESPIRATORY_CONCERN: "This simulation includes breathing symptoms; safety instructions do not depend on the displayed point estimate.",
  ACTIVE_ENVIRONMENTAL_EVENT: "A simulated environmental radiation event is active. Cumulative dose alone does not trigger this instruction.",
  CUMULATIVE_DOSE_CONTEXT_ONLY: "A cumulative dose total is historical context, not dose rate, a safe limit, or an emergency by itself.",
  NEW_READING_REQUIRES_REVIEW: "A newly entered value is not assigned a normal status until a human reviews it.",
  VALIDATED_RULESET_NOT_APPROVED: "No validated mission rule set is installed, so this mode fails closed to unknown.",
  READING_STALE: "The demo freshness policy marks this timestamp stale; the policy is not clinically validated.",
  READING_UNIT_MISMATCH: "The entered unit does not match the metric unit; the entered unit is preserved below for traceability.",
  READING_QUALITY_UNRELIABLE: "The measurement quality was marked uncertain or invalid, so the display does not treat it as normal.",
  READING_INVALID_OR_INCOMPLETE: "The value is missing, incomplete, or outside the demo data-quality constraints.",
  SEVERE_SYMPTOMS_OVERRIDE_READING: "A severe symptom was reported; it is handled independently of the numeric result.",
  SEVERE_SYMPTOMS_WITH_UNRELIABLE_READING: "A severe symptom was reported while the reading was unreliable; do not wait for another number.",
  READING_UNAVAILABLE_OR_UNRELIABLE: "Required reading context is unavailable; unknown does not mean normal.",
};

function formatTimestamp(timestamp: string): string {
  if (!Number.isFinite(Date.parse(timestamp))) return "Invalid timestamp (stored data needs review)";
  return new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" }).format(new Date(timestamp)) + " UTC";
}

function statusText(evaluation: GuidanceEvaluation): { label: string; icon: string } {
  if (evaluation.status === "critical") return { label: "Critical · simulated", icon: "‼" };
  if (evaluation.status === "warning") return { label: "Warning · simulated", icon: "!" };
  if (evaluation.status === "normal") return { label: "Prevention · demo only", icon: "✓" };
  return { label: "Unknown · not normal", icon: "?" };
}

function ValueSummary({ value, metricId, unit }: { value: MetricReading; metricId: GuidanceEvaluation["metricId"]; unit: string }) {
  return <span className="font-strong">{formatValue(metricId, value)} {metricId === "mood" || metricId === "stress" ? "of 5" : unit}</span>;
}

export function GuidanceModal({ open, person, evaluation, onClose }: {
  open: boolean;
  person: Profile;
  evaluation: GuidanceEvaluation | null;
  onClose: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const snapshot = useSyncExternalStore(guidanceStore.subscribe, guidanceStore.getSnapshot, guidanceStore.getServerSnapshot);
  const [followUpValue, setFollowUpValue] = useState("");
  const [systolic, setSystolic] = useState("");
  const [diastolic, setDiastolic] = useState("");
  const [newSymptoms, setNewSymptoms] = useState<SymptomId[]>([]);
  const [reviewedSymptoms, setReviewedSymptoms] = useState<SymptomId[]>(() => evaluation?.symptoms ?? []);
  const [reviewedActivity, setReviewedActivity] = useState<GuidanceEvaluation["activityState"]>(() => evaluation?.activityState ?? "unknown");
  const [reviewedEnvironmentalEvent, setReviewedEnvironmentalEvent] = useState(() => evaluation?.environmentalEvent ?? false);
  const [resolutionReason, setResolutionReason] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  const metric = evaluation ? getMetric(evaluation.metricId) : undefined;
  const guide = evaluation ? getGuidance(evaluation.metricId, evaluation.status) : undefined;
  const activeEvent = evaluation && guidanceStore.findEvent(evaluation);
  const history = snapshot.events.filter((event) => event.astronautId === person.id && event.metricId === evaluation?.metricId)
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
  const status = evaluation ? statusText(evaluation) : null;

  if (!evaluation || !metric || !guide || !status) return <dialog ref={dialogRef} aria-label="Health guidance" onClose={onClose} />;
  const selectedMetric = metric;
  const selectedGuide = guide;

  function updateAction(stepId: string, stepText: string, checked: boolean) {
    if (!activeEvent) return;
    guidanceStore.updateEvent(recordAction(activeEvent, selectedGuide.id, selectedGuide.version, stepId, stepText, checked));
  }

  function saveFollowUp(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!activeEvent) return;
    let value: MetricReading;
    if (selectedMetric.id === "bloodPressure") value = { systolic: Number(systolic), diastolic: Number(diastolic) };
    else value = Number(followUpValue);
    if (!isCompleteFiniteReading(selectedMetric.id, value)) {
      setMessage("Enter a complete finite reading in the expected format. Blood pressure requires two positive values with systolic higher than diastolic; mood/stress require whole numbers 1–5.");
      return;
    }
    const timestamp = new Date().toISOString();
    const updated = recordFollowUp(activeEvent, person, { metricId: selectedMetric.id, value, unit: selectedMetric.unit, timestamp, symptoms: newSymptoms.length ? newSymptoms : undefined }, `follow-up-${timestamp}`, timestamp);
    guidanceStore.updateEvent(updated);
    setMessage("Follow-up saved. The dashboard now reflects this evaluation; prior symptoms/events and the initial reading remain in history.");
    setFollowUpValue(""); setSystolic(""); setDiastolic(""); setNewSymptoms([]);
  }

  function saveSymptoms(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!activeEvent || newSymptoms.length === 0) {
      setMessage("Select at least one symptom to record a context update.");
      return;
    }
    guidanceStore.updateEvent(reportSymptoms(activeEvent, person, newSymptoms));
    setReviewedSymptoms((current) => [...new Set([...current, ...newSymptoms])]);
    setMessage("Symptoms were recorded against the current reading without creating a new reading. Safety guidance is shown independently of the number.");
    setNewSymptoms([]);
  }

  function saveContextReview(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!activeEvent) return;
    guidanceStore.updateEvent(reviewContext(activeEvent, person, { symptoms: reviewedSymptoms, environmentalEvent: reviewedEnvironmentalEvent, activityState: reviewedActivity }));
    setMessage("Reviewed context saved. Earlier symptoms, event state, readings, and evaluations remain in the audit history.");
  }

  function saveResolution(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!activeEvent) return;
    try {
      guidanceStore.updateEvent(resolveEvent(activeEvent, resolutionReason));
      setResolutionReason(""); setMessage("Manual demo resolution recorded. This does not indicate medical clearance.");
    } catch {
      setMessage("Enter a reason to record a manual demo resolution.");
    }
  }

  const currentSymptoms = evaluation.symptoms;
  return (
    <dialog ref={dialogRef} aria-labelledby="guidance-title" onClose={onClose} className="m-auto max-h-[92dvh] w-[min(760px,calc(100vw-24px))] max-w-none overflow-y-auto rounded-2xl border border-border bg-surface p-0 text-text shadow-card backdrop:bg-console/65">
      <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-border bg-surface px-5 py-4">
        <div>
          <p className="text-eyebrow tracking-eyebrow text-muted">EDUCATIONAL DEMO · NOT A MEDICAL ASSESSMENT</p>
          <h2 id="guidance-title" className="mt-1">{guide.title}</h2>
          <p className="mt-1 text-caption text-muted">{person.name} · {metric.label}</p>
        </div>
        <button type="button" onClick={() => dialogRef.current?.close()} aria-label="Close health guidance" className="rounded-md border border-border px-3 py-2 text-sm hover:bg-surface-muted">Close</button>
      </div>
      <div className="space-y-5 p-5">
        <section aria-label="Current reading" className="rounded-xl bg-surface-muted p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p>Current reading: <ValueSummary value={evaluation.value} metricId={evaluation.metricId} unit={evaluation.unit} /></p>
            <span className="inline-flex items-center gap-1 rounded-full border border-border px-3 py-1 text-caption font-strong"><span aria-hidden="true">{status.icon}</span>{status.label}</span>
          </div>
          <p className="mt-1 text-caption text-muted">Recorded {formatTimestamp(evaluation.timestamp)} · Evaluated {formatTimestamp(evaluation.evaluatedAt)}</p>
          <p className="mt-1 text-caption text-muted">Activity state: {evaluation.activityState}; it never suppresses medical-status or symptom safety guidance.</p>
          {evaluation.scenarioId && <p className="mt-2 text-caption font-strong">Simulation: {evaluation.scenarioId.replaceAll("-", " ")} · scoped to {person.name}. No fixture was changed.</p>}
          {evaluation.environmentalEvent && <p className="mt-2 text-caption font-strong">Active simulated environmental event; cumulative dose alone is not an emergency signal.</p>}
          {currentSymptoms.length > 0 && <p className="mt-2 text-caption font-strong">Reported symptoms: {currentSymptoms.map((symptom) => symptomOptions.find((option) => option.id === symptom)?.label ?? symptom).join(", ")}</p>}
        </section>

        {evaluation.safetyEscalation && <aside role="alert" className="rounded-xl border-2 border-status-alert-border bg-status-alert-soft p-4 text-status-alert-ink"><strong>Independent safety escalation: stop risky activity when safe, move to a safe position, notify a crewmate and mission lead, and follow the approved mission procedure.</strong> This applies even when medical status is unknown or the number appears normal. This demo sends no notification.</aside>}
        {evaluation.environmentalEvent && <aside role="alert" className="rounded-xl border-2 border-status-alert-border bg-status-alert-soft p-4 text-status-alert-ink"><strong>Active-event procedure:</strong> follow authorized radiation protection/shelter instructions, contact mission control, and do not improvise shielding changes.</aside>}
        <p className="rounded-lg border border-border bg-surface-muted p-3 text-caption">{REASON_EXPLANATIONS[evaluation.reasonCode] ?? "This result comes from an authored demonstration or a fail-closed data-quality check; it is not a clinical finding."}</p>

        <section><h3>What&apos;s happening?</h3><p className="mt-1">{guide.whatIsHappening}</p><p className="mt-2 text-caption text-muted">Every guide needs medical review; none is approved for a mission. No diagnosis, treatment, medication, or life-support change is provided.</p></section>
        <section><h3>Possible causes</h3><ul className="mt-2 list-disc space-y-1 pl-5">{guide.possibleCauses.map((cause) => <li key={cause}>{cause}</li>)}</ul></section>
        <section><h3>Recommended actions</h3><ol className="mt-2 list-decimal space-y-2 pl-6">{guide.recommendedActions.map((step, index) => {
          const stepId = `${guide.id}:action-${index + 1}`;
          const matching = activeEvent?.actions.filter((action) => action.guideId === guide.id && action.guideVersion === guide.version && action.stepId === stepId) ?? [];
          const latestAction = matching.at(-1);
          return <li key={stepId} className="rounded-lg border border-border p-3"><label className="flex gap-3"><input aria-label={`Mark action ${index + 1} complete`} type="checkbox" checked={latestAction?.checked ?? false} onChange={(change) => updateAction(stepId, step, change.target.checked)} /><span>{step}</span></label></li>;
        })}</ol></section>
        <section><h3>When to seek help</h3><ul className="mt-2 list-disc space-y-1 pl-5">{guide.whenToSeekHelp.map((item) => <li key={item}>{item}</li>)}</ul><p className="mt-2 text-caption text-muted">{guide.followUp}</p><button type="button" className="mt-3 rounded-md border border-border px-3 py-2 text-sm" onClick={() => {
          if (activeEvent) { guidanceStore.updateEvent(recordEscalation(activeEvent, "Simulated escalation recorded locally; no message sent.")); setMessage("Simulated escalation saved locally with a timestamp. No contact or notification was made."); }
        }}>Record simulated escalation</button></section>

        <section className="rounded-xl border border-border p-4"><h3>Report symptoms independently</h3><p className="mt-1 text-caption text-muted">This adds context to the current reading; it does not fabricate another measurement. Severe symptoms are considered even if the number is normal, missing, or unreliable.</p><form className="mt-3 space-y-3" onSubmit={saveSymptoms}><fieldset><legend className="text-caption font-strong">Symptoms to report</legend><div className="mt-2 flex flex-wrap gap-3">{symptomOptions.map((symptom) => <label key={symptom.id} className="inline-flex items-center gap-1 text-caption"><input type="checkbox" checked={newSymptoms.includes(symptom.id)} onChange={() => setNewSymptoms((current) => current.includes(symptom.id) ? current.filter((item) => item !== symptom.id) : [...current, symptom.id])} />{symptom.label}</label>)}</div></fieldset><button type="submit" className="rounded-md border border-border px-3 py-2">Report symptoms</button></form></section>

        <section className="rounded-xl border border-border p-4"><h3>Record a follow-up reading</h3><p className="mt-1 text-caption text-muted">The dashboard updates to the latest evaluation. A new reading does not inherit a normal status; prior severe symptoms or an active environmental event carry forward until explicitly reviewed.</p>
          <form className="mt-3 space-y-3" onSubmit={saveFollowUp}>
            {metric.id === "bloodPressure" ? <div className="grid grid-cols-2 gap-3"><label className="text-caption">Systolic (mmHg)<input required type="number" step="any" value={systolic} onChange={(event) => setSystolic(event.target.value)} className="mt-1 w-full rounded-md border border-border bg-surface p-2" /></label><label className="text-caption">Diastolic (mmHg)<input required type="number" step="any" value={diastolic} onChange={(event) => setDiastolic(event.target.value)} className="mt-1 w-full rounded-md border border-border bg-surface p-2" /></label></div> : <label className="block text-caption">New {metric.label} ({metric.id === "mood" || metric.id === "stress" ? "whole number 1–5" : metric.unit})<input required type="number" step={metric.id === "mood" || metric.id === "stress" ? "1" : "any"} value={followUpValue} onChange={(event) => setFollowUpValue(event.target.value)} className="mt-1 w-full rounded-md border border-border bg-surface p-2" /></label>}
            <button className="rounded-md bg-primary px-4 py-2 text-white" type="submit">Save follow-up</button>
          </form>
        </section>

        <section className="rounded-xl border border-border p-4"><h3>Review or reset context</h3><p className="mt-1 text-caption text-muted">Context is carried forward until you explicitly review it. Each review is logged; prior context is not erased.</p><form className="mt-3 space-y-3" onSubmit={saveContextReview}><fieldset><legend className="text-caption font-strong">Symptoms currently in effect</legend><div className="mt-2 flex flex-wrap gap-3">{symptomOptions.map((symptom) => <label key={symptom.id} className="inline-flex items-center gap-1 text-caption"><input type="checkbox" checked={reviewedSymptoms.includes(symptom.id)} onChange={() => setReviewedSymptoms((current) => current.includes(symptom.id) ? current.filter((item) => item !== symptom.id) : [...current, symptom.id])} />{symptom.label}</label>)}</div></fieldset>
          <label className="block text-caption">Operational activity state<select value={reviewedActivity} onChange={(event) => setReviewedActivity(event.target.value as GuidanceEvaluation["activityState"])} className="mt-1 block rounded-md border border-border bg-surface p-2"><option value="unknown">Unknown</option><option value="awake">Awake</option><option value="sleeping">Sleeping</option></select></label>
          {metric.id === "radiation" && <label className="inline-flex items-center gap-2 text-caption"><input type="checkbox" checked={reviewedEnvironmentalEvent} onChange={(event) => setReviewedEnvironmentalEvent(event.target.checked)} />Active environmental event remains in effect</label>}
          <button type="submit" className="rounded-md border border-border px-3 py-2">Save reviewed context</button>
        </form></section>

        <section className="rounded-xl border border-border p-4"><h3>Manual demo resolution</h3><p className="mt-1 text-caption text-muted">Resolution is a user-entered record, not a medical all-clear. Earlier readings and guide versions stay in history.</p><form className="mt-3 flex flex-col gap-2 sm:flex-row" onSubmit={saveResolution}><label className="sr-only" htmlFor="resolution-reason">Resolution reason</label><input id="resolution-reason" value={resolutionReason} onChange={(event) => setResolutionReason(event.target.value)} placeholder="Reason for closing this demo event" className="min-w-0 flex-1 rounded-md border border-border bg-surface p-2" /><button type="submit" className="rounded-md border border-border px-3 py-2">Record resolution</button></form>{activeEvent?.resolution && <p className="mt-2 text-caption">Resolved manually: {activeEvent.resolution.reason} · {formatTimestamp(activeEvent.resolution.at)}</p>}</section>

        <section><div className="flex items-center justify-between gap-3"><h3>Event history ({history.length})</h3><button type="button" onClick={() => { guidanceStore.clearHistory(); setMessage("Browser-local demo history cleared."); }} className="text-caption underline">Clear local history</button></div><p className="mt-1 text-caption text-muted">Stored only in this browser when available; this is not secure, confidential storage and browser users may share it. Do not enter real health data. No server sync or notifications.</p>{snapshot.message && <p role="status" className="mt-2 rounded-lg border border-status-warn-border bg-status-warn-soft p-3 text-caption">{snapshot.message}</p>}
          {history.length === 0 ? <p className="mt-2 text-caption text-muted">No recorded events for this metric.</p> : <ol className="mt-3 space-y-2">{history.map((event) => <li key={event.id} className="rounded-lg border border-border p-3"><p className="font-strong">Initial: {event.evaluation.status.toUpperCase()} · {event.evaluation.reasonCode} · {formatTimestamp(event.evaluation.timestamp)}</p><p className="text-caption">Current: {event.currentEvaluation.status.toUpperCase()} · {formatValue(event.metricId, event.currentEvaluation.value)} {event.currentEvaluation.unit} · {event.currentEvaluation.reasonCode}</p><p className="text-caption">Initial guide {event.evaluation.guideId} · current guide {event.currentEvaluation.guideId} · rule {event.currentEvaluation.ruleVersion}</p>
            {event.actions.map((action) => <p key={action.id} className="text-caption">Action: {action.stepText} — {action.checked ? "checked" : "unchecked"} · {formatTimestamp(action.at)} · guide {action.guideId} v{action.guideVersion}</p>)}
            {event.escalations.map((record) => <p key={record.id} className="text-caption">Simulated escalation: {record.description} · {formatTimestamp(record.at)} · no message sent</p>)}
            {event.contextHistory.map((record) => <p key={record.id} className="text-caption">Context {record.kind}: {record.description} · {formatTimestamp(record.at)}</p>)}
            {event.followUps.map((followUp) => <p key={followUp.readingId} className="text-caption">Follow-up {formatTimestamp(followUp.timestamp)}: {formatValue(event.metricId, followUp.value)} {followUp.unit} · {followUp.evaluation.status} ({followUp.evaluation.reasonCode}) · symptoms: {followUp.evaluation.symptoms.join(", ") || "none"}</p>)}
            {event.resolution && <p className="text-caption">Manual resolution: {event.resolution.reason} · {formatTimestamp(event.resolution.at)}</p>}</li>)}</ol>}
        </section>
        <details className="rounded-lg border border-border p-3"><summary className="cursor-pointer font-strong">Evaluation trace (demo identifiers)</summary><dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-caption"><dt>Reason code</dt><dd>{evaluation.reasonCode}</dd><dt>Rule</dt><dd>{evaluation.ruleId} · {evaluation.ruleVersion}</dd><dt>Guide</dt><dd>{evaluation.guideId}</dd><dt>Source</dt><dd>{evaluation.source} · simulated</dd><dt>Entered unit</dt><dd>{evaluation.unit}</dd><dt>Freshness policy</dt><dd>{evaluation.ruleVersion}; 24-hour demo-only rule, not clinically validated</dd></dl></details>
        <section><h3>Sources and scope</h3><ul className="mt-2 list-disc space-y-2 pl-5">{guide.sources.map((source) => <li key={source.url}><a href={source.url} target={source.url.startsWith("http") ? "_blank" : undefined} rel={source.url.startsWith("http") ? "noreferrer" : undefined} className="underline">{source.label}</a><span className="block text-caption text-muted">{source.scope}</span></li>)}</ul><p className="mt-3 text-caption text-muted">Sources provide context, not validation. The guide catalog is local and works offline; no clinical API or AI call is made.</p></section>
        {message && <p role="status" className="rounded-lg bg-surface-muted p-3 text-caption">{message}</p>}
        <p className="text-caption text-muted">Simulated values and authored states are fictional. No NASA threshold or approved mission medical protocol is installed.</p>
      </div>
    </dialog>
  );
}
