import Link from "next/link";

/** Global header: ASTRO Health brand link and the UMBRAL mission wordmark. */
export function SiteHeader() {
  return (
    <header className="flex min-h-19 items-center justify-between gap-4 border-b border-border max-sm:min-h-0 max-sm:gap-3 max-sm:py-3.5">
      <Link
        href="/"
        aria-label="ASTRO Health home"
        data-brand-link="home"
        className="inline-flex min-w-0 items-center gap-3 text-left text-text no-underline focus-visible:outline-offset-5 max-xs:gap-2.5"
      >
        <span aria-hidden="true" className="grid size-12 shrink-0 place-items-center rounded-xl border border-border-strong bg-surface shadow-card text-primary-strong">
          <svg data-brand-symbol viewBox="0 0 48 48" className="size-12" focusable="false">
            <ellipse
              cx="24"
              cy="24"
              rx="21"
              ry="9.5"
              transform="rotate(-35 24 24)"
              className="fill-none stroke-current opacity-40"
              strokeWidth={1.5}
            />
            <path
              d="M14 37 24 10l10 27M18.25 25.5h11.5"
              className="fill-none stroke-current"
              strokeWidth={2.5}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d="M11 30h7l2.5-5 3.5 10 2.75-5H37"
              className="fill-none stroke-primary"
              strokeWidth={1.8}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </span>
        <span className="min-w-0">
          <strong className="block whitespace-nowrap text-md tracking-snug">ASTRO Health</strong>
        </span>
      </Link>
      <span className="shrink-0 whitespace-nowrap text-caption font-strong tracking-caps-wide text-text-secondary max-xs:text-xs">UMBRAL</span>
    </header>
  );
}
