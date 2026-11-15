<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# AGENTS.md — onboarding contract for coding agents

Read this before writing code on a new branch. It tells you where your work goes, what you must not touch, and how to finish so your branch merges without colliding with other agents.

**Stack:** Next.js 16 (App Router, Cache Components on) · React 19 · TypeScript strict · Tailwind CSS v4 · Vitest · Playwright · npm · deployed on Vercel.

## 1. Start here (every new branch)

1. Sync main: `git switch main && git pull --ff-only`
2. Branch: `git switch -c <type>/<name>`
   - `feat/<feature>` — new or extended feature (e.g. `feat/radiation-timeline`)
   - `fix/<feature>` — bug fix inside one feature
   - `chore/<topic>` — tooling, deps, CI, docs
   - `feat/design-system-<x>` — new token or shared primitive (see §5)
3. Optional, for parallel agents on one machine — one worktree per branch:
   `git worktree add ../Repo-worktrees/<branch-name> -b <branch-name> main` (sibling of the repo, never under a temp dir), then run `npm ci` inside it.
4. Install exactly the locked deps: `npm ci` (use `npm install` only when you change dependencies).
5. Confirm a green baseline **before** changing anything:
   `npm run lint && npm run typecheck && npm test && npm run build`
   If the baseline is red on `main`, stop and report it; do not fix unrelated breakage in your feature branch.

## 2. Ownership map

| Path | Who may change it |
| --- | --- |
| `src/features/<name>/**` | Only the branch that owns `<name>` |
| `src/app/<route>/page.tsx` (new route) | The feature branch that adds the route |
| `e2e/<name>.spec.ts` | The owning feature branch |
| `src/app/layout.tsx`, `src/app/globals.css`, `src/app/not-found.tsx` | **Shared hotspot** |
| `src/shared/**` (design system, `cn`, date helpers) | **Shared hotspot** — `feat/design-system-*` or `chore/*` |
| `src/shared/design-system/theme.css` | **Shared hotspot** — `feat/design-system-*` only |
| `src/features/crew-health-data/**` | **Shared hotspot** — data used by every feature |
| `package.json`, `package-lock.json` | **Shared hotspot** — dependency commit only (§6) |
| `eslint.config.mjs`, `tsconfig.json`, `next.config.ts`, `vitest.config.mts`, `playwright.config.ts` | **Shared hotspot** — `chore/*` |
| `.github/**` (CI, PR template) | **Shared hotspot** — `chore/*` |
| `AGENTS.md`, `CLAUDE.md`, `docs/**`, `README.md` | `chore/*`, or append-only notes from a feature PR |
| `data/**`, `scripts/**` (Python mission data) | Data owners only; the web app does not read them yet |

Current features: `crew-health-data` (fictional data + domain logic, UMBRAL mission CSV parsers), `crew-overview`, `astronaut-profile`, `trend-chart`, `body-map`, `mission-timeline` (mission-day selector and the `MissionDayProvider` context that screens share with embedded views), `mission-orbit` (3D mission geometry at `/mission`, also shown on the home page through `MissionOrbitEmbed`; reads `mission_positions.csv`), `solar-storm` (the day-493 storm on the Mars surface, shown on the home page through `SolarStormEmbed`; figures come from `crew_events.csv`/`crew_daily.csv` and the mission geometry via the `mission-orbit` index).

## 3. Add a new feature, step by step

1. Create the folder with only what you need:

   ```
   src/features/<name>/
     components/        React components ("use client" only where state/effects are needed)
     hooks/             client hooks (optional)
     lib/               pure logic, types, constants
     lib/*.test.ts      Vitest unit tests, colocated
     index.ts           public API — the ONLY file other code may import
   ```

2. Export only what others need from `index.ts`:

   ```ts
   // src/features/radiation-timeline/index.ts
   export { RadiationTimeline } from "./components/RadiationTimeline";
   export type { TimelineEntry } from "./lib/types";
   ```

3. Add the route as a thin page — no logic, just composition:

   ```tsx
   // src/app/radiation/page.tsx
   import type { Metadata } from "next";
   import { RadiationTimeline } from "@/features/radiation-timeline";

   export const metadata: Metadata = { title: "Radiation" }; // renders "ASTRA Health · Radiation"

   export default function RadiationPage() {
     return <RadiationTimeline />;
   }
   ```

   Dynamic segments: export `generateStaticParams()` (it must return at least one param with Cache Components), `await params`, and call `notFound()` for unknown ids. See `src/app/astronaut/[id]/page.tsx`.
4. Navigation: there is no nav menu yet. Link to your route from your own feature UI. If a shared nav is introduced, add exactly one entry for your feature (append-only).
5. Add `e2e/<name>.spec.ts` using `import { test, expect } from "./fixtures"` (fails on any browser console error). Use stable `id`/`data-*` hooks, not styling classes.
6. Read the Next.js docs in `node_modules/next/dist/docs/` for any API you use (this Next version differs from older training data).

## 4. Import rules (enforced by `npm run lint`)

| From | May import | Must not import |
| --- | --- | --- |
| `src/app/**` | `@/features/<name>` (index only), `@/shared/**` | `@/features/<name>/<anything>` |
| `src/features/A/**` | own files (relative), `@/features/B` (index only), `@/shared/**` | `@/features/B/lib/x`, `../../B/...`, `@/app/**` |
| `src/shared/**` | other `src/shared/**`, npm packages | anything in `@/features/**` or `@/app/**` |

```ts
import { TrendPanel } from "@/features/trend-chart";            // ✅ public API
import { getSeries } from "@/features/crew-health-data";         // ✅
import { buildScales } from "@/features/trend-chart/lib/chart-geometry"; // ❌ deep import
import { CrewCard } from "../../crew-overview/components/CrewCard";      // ❌ relative cross-feature
```

Need something another feature keeps private? Ask its owner to export it from `index.ts` (small PR on their branch), or move pure domain logic to `crew-health-data` via a hotspot PR.

## 5. Design-system rules

Single source of truth: `src/shared/design-system/theme.css` (Tailwind v4 `@theme`). The default Tailwind palette, fonts, tracking, and shadows are **disabled** and the type scale is replaced — `bg-red-500`, `text-blue-600`, `shadow-lg` generate no CSS, and `text-sm` means the project's 13px, not stock Tailwind's 14px. Full reference: `docs/design-system.md`.

- Use token utilities only: `bg-surface`, `text-muted`, `border-border`, `bg-status-alert-surface`, `rounded-xl`, `text-caption`, `font-strong`, `tracking-eyebrow`, `shadow-card`.
- Never write raw colors (`#hex`, `rgb()`, `bg-[#...]`) in features or routes — lint fails. Arbitrary values are allowed only for **layout** (grid tracks like `grid-cols-[minmax(0,1fr)_auto]`, `clamp()` widths).
- Map domain status → visuals only through `toneFor()` + `toneSurface` / `toneSoft` / `toneBorder` / `toneDot`. Never re-implement status colors.
- Third-party libraries that need a color string: `readToken("color-body-base")` (client only).
- Reuse primitives from `@/shared/design-system`: `SiteHeader`, `PageFooter`, `Panel`, `PanelHeading`, `SectionHeading`, `Eyebrow`, `StatusText`, `Avatar`, `SegmentedToggle`.

**Token groups:** canvas/surfaces (`canvas`, `surface`, `surface-muted`, `surface-subtle`, `border`, `border-strong`, `divider`) · text (`text`, `text-strong`, `text-secondary`, `text-subtle`, `muted`) · interactive (`primary`, `primary-strong`, `primary-deep`, `primary-soft`, `selected`, `selected-border`, `hover-border`) · dark console cards (`console`, `console-hover`, `console-raised`, `console-border`, `console-divider`, `console-tile-border`, `console-text`, `console-muted`, …) · status `ok|warn|alert|unknown` × (`base`, `-surface`, `-border`, `-soft`, `-ink`) plus `status-info` · charts (`chart-primary`, `chart-secondary`, `chart-grid`, `chart-bar`, `chart-axis`, `body-base`, `body-highlight`) · radius `xs 5 / sm 7 / md 8 / lg 10 / xl 12 / 2xl 16` · type `3xs 8 … display` + `eyebrow`, `vital` · weights `medium/semibold/strong/bold/heavy` · breakpoints `xs 431 / sm 761 / md 1051 / lg 1200 / xl 1360` (use `max-sm:` for "≤760px").

**Need a new token or primitive?** Open `feat/design-system-<x>` with only that change (token + docs entry), get it merged first, then rebase your feature branch on `main`. Do not add tokens inside a feature PR.

## 6. Hotspot protocol

- Touching a shared hotspot: keep the edit minimal and append-only where possible (new export line, new token, new route file). Call it out in the PR template under "Shared files touched".
- Dependencies: `npm install --save-exact <pkg>@<version>` in a **separate commit** (`chore(deps): add <pkg>`). No other changes in that commit.
- Lockfile conflict: rebase on `main`, resolve `package.json` by hand if needed, then run `npm install` (npm regenerates `package-lock.json`). **Never hand-edit `package-lock.json`.** Commit the result.
- npm is the only package manager. Never commit `pnpm-lock.yaml` or `yarn.lock`.

## 7. Data rules

- All names, values, dates, statuses are **fictional fixtures** (`src/features/crew-health-data`). Do not present them as telemetry.
- Demo statuses (`within-demo-reference` / `demo-deviation` / `demo-alert` / `unknown`) are **authored**, never computed from readings. Add **no clinical thresholds**, diagnoses, or treatment guidance.
- Keep caveats visible: "Simulated point reading" (SpO₂, glucose), "Self-reported" (mood, stress, sleep), radiation is **cumulative mGy, nondecreasing, not a rate and not a safe limit**.
- Body regions (Brain/Heart/Whole body) are metric-navigation groups, not organ measurements.
- Missing or non-finite data resolves to "Unknown" (gray) — never `NaN`, `undefined`, or a fabricated value.
- Mission geometry and crew CSVs live in `data/processed/` (see `data/README.md`); integrate them through a new feature, not by editing fixtures in place.

## 8. Definition of done

```sh
npm run lint        # ESLint incl. architecture + token rules
npm run typecheck   # next typegen + tsc --noEmit
npm test            # Vitest unit tests
npm run build       # production build
npm run test:e2e    # Playwright (builds + starts the app; uses local Chrome outside CI)
```

- All five pass locally; CI runs the same commands.
- Conventional commits: `feat(radiation-timeline): add cumulative dose chart`, `fix(trend-chart): ...`, `chore(deps): ...`.
- **No AI attribution** — no `Co-Authored-By` lines, no "Generated with" footers in commits or PRs.
- Small PRs (aim < 400 changed lines). Split large work into stacked PRs.
- Rebase on `main` before opening the PR; fill in `.github/pull_request_template.md`.
- New user-visible behavior has an e2e spec; new pure logic has a colocated unit test.

## 9. Do NOT

- Edit another feature's folder, or import its internals.
- Add colors, font sizes, radii, or shadows outside `theme.css`; use stock Tailwind palette classes (they produce no CSS).
- Put logic in `src/app/**` pages or make `src/shared/**` depend on features.
- Add `"use client"` to a whole page when only one component needs state.
- Mix package managers, hand-edit `package-lock.json`, or bundle dependency bumps with feature code.
- Change fixture values, authored statuses, or caveat copy without a dedicated data PR.
- Add clinical claims, thresholds, or anything implying real medical monitoring.
- Commit `.artifacts/`, `.next/`, `test-results/`, `playwright-report/`, or secrets.
- Push to `main` directly or force-push shared branches.
