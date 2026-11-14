import { cn } from "@/shared/lib/cn";
import { toneDot, toneFor, type Tone } from "../status";

interface StatusTextProps {
  /** Domain status value, e.g. "stable", "monitoring", "simulated-alert", "resting". */
  status: string;
  label: string;
  /** `light` for white surfaces, `console` for dark crew cards. */
  variant?: "light" | "console";
  showDot?: boolean;
  id?: string;
}

const consoleInk: Partial<Record<Tone, string>> = {
  warn: "text-status-warn-on-dark",
  alert: "text-status-alert-on-dark",
};

/** Text label for a status. The label carries meaning; color is supplementary. */
export function StatusText({ status, label, variant = "light", showDot = false, id }: StatusTextProps) {
  const tone = toneFor(status);
  return (
    <span
      id={id}
      data-status={status}
      className={cn(
        "inline-flex items-center gap-1.75 font-semibold",
        variant === "light"
          ? "text-sm text-text-secondary"
          : cn("text-caption leading-tight", consoleInk[tone] ?? "text-console-text-soft"),
      )}
    >
      {showDot ? <span aria-hidden="true" className={cn("inline-block size-2 flex-none rounded-full", toneDot[tone])} /> : null}
      {label}
    </span>
  );
}
