import { formatValue, latest } from "@/features/crew-health-data";

const RADIUS = 17;

/** Latest simulated SpO₂ point reading as a percentage ring with its visible value. */
export function OxygenRing({ profileId }: { profileId: string }) {
  const value = latest(profileId, "spo2");
  const formatted = formatValue("spo2", value);
  const valid = typeof value === "number" && Number.isFinite(value);
  const label = <span className="absolute top-12.5 text-micro text-console-faint">SpO₂</span>;

  if (!valid) {
    return (
      <span className="oxygen-reading relative grid size-12 flex-none place-items-center" role="img" aria-label={`SpO₂: ${formatted}. Fictional point reading.`}>
        <span className="oxygen-value z-1 text-caption font-bold text-white tabular-nums">{formatted}</span>
        {label}
      </span>
    );
  }

  const circumference = 2 * Math.PI * RADIUS;
  const offset = circumference * (1 - value / 100);
  return (
    <span className="oxygen-reading relative grid size-12 flex-none place-items-center" role="img" aria-label={`SpO₂: ${formatted}%. Fictional point reading.`}>
      <svg viewBox="0 0 44 44" aria-hidden="true" className="absolute inset-0 size-full -rotate-90">
        <circle className="fill-none stroke-console-ring" strokeWidth={3.5} cx={22} cy={22} r={RADIUS} />
        <circle
          className="fill-none stroke-console-progress"
          strokeWidth={3.5}
          strokeLinecap="round"
          cx={22}
          cy={22}
          r={RADIUS}
          strokeDasharray={circumference.toFixed(2)}
          strokeDashoffset={offset.toFixed(2)}
        />
      </svg>
      <span className="oxygen-value z-1 text-caption font-bold text-white tabular-nums">
        {formatted}
        <small className="text-3xs">%</small>
      </span>
      {label}
    </span>
  );
}
