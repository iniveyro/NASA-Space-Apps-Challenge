"use client";

import { cn } from "@/shared/lib/cn";

interface SegmentedToggleOption<T extends string | number> {
  value: T;
  label: string;
}

interface SegmentedToggleProps<T extends string | number> {
  label: string;
  options: ReadonlyArray<SegmentedToggleOption<T>>;
  value: T;
  onChange: (value: T) => void;
  /** Adds `data-<dataKey>="<value>"` to each button, e.g. "days". */
  dataKey?: string;
}

/** Group of mutually exclusive pressed buttons (e.g. a date-range switch). */
export function SegmentedToggle<T extends string | number>({ label, options, value, onChange, dataKey }: SegmentedToggleProps<T>) {
  return (
    <div role="group" aria-label={label} className="inline-flex rounded-md border border-border bg-surface-subtle p-0.75">
      {options.map((option) => {
        const pressed = option.value === value;
        const dataAttribute = dataKey ? { [`data-${dataKey}`]: String(option.value) } : {};
        return (
          <button
            key={String(option.value)}
            type="button"
            aria-pressed={pressed}
            {...dataAttribute}
            onClick={() => onChange(option.value)}
            className={cn(
              "min-h-8 cursor-pointer rounded-xs border-0 px-2.5 py-1.25 text-caption font-semibold max-xs:px-2",
              pressed ? "bg-surface text-primary-strong shadow-toggle" : "bg-transparent text-text-subtle",
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
