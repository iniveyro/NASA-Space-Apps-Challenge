import Link from "next/link";

interface SiteHeaderProps {
  environment: string;
  missionDay: number;
}

const divider = "ml-3.5 border-l border-border pl-4.5 max-sm:ml-0 max-sm:pl-2.25 max-xs:pl-1.75";

/** Global header: brand (links to the crew overview) and mission context. */
export function SiteHeader({ environment, missionDay }: SiteHeaderProps) {
  return (
    <header className="flex min-h-19 items-center justify-between gap-6 border-b border-border max-sm:min-h-0 max-sm:flex-col max-sm:items-start max-sm:gap-3 max-sm:py-3.75">
      <Link
        href="/"
        aria-label="ASTRA Health crew overview"
        className="inline-flex items-center gap-3 text-left text-text no-underline focus-visible:outline-offset-5"
      >
        <span aria-hidden="true" className="grid size-9.5 place-items-center rounded-lg border border-border-strong bg-surface text-2xl font-bold text-primary-strong">
          A
        </span>
        <span>
          <strong className="block text-md tracking-snug">ASTRA Health</strong>
          <small className="mt-px block text-caption text-muted max-xs:text-micro">Mission wellness console</small>
        </span>
      </Link>
      <div className="flex items-center gap-2.25 text-caption font-strong tracking-caps text-muted max-sm:max-w-full max-sm:flex-wrap max-sm:justify-start max-sm:text-micro max-xs:gap-x-2.5 max-xs:gap-y-1.5 max-xs:leading-snug">
        <span>SIMULATED DATA · FICTIONAL</span>
        <span id="environment-label" className={`${divider} max-sm:border-l-0 max-sm:pl-0`}>
          ENVIRONMENT · {environment.toUpperCase()}
        </span>
        <span className={divider}>MISSION DAY {missionDay}</span>
      </div>
    </header>
  );
}
