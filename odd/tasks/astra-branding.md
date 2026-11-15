# ASTRO Health application branding

## Objective
Replace the global header's plain lettermark and mission metadata with a code-native ASTRO Health logo and the concise `UMBRAL` wordmark.

## Scope and constraints
- Add an original SVG brand symbol combining an A, orbit, and subtle heartbeat; use existing theme tokens/currentColor only.
- Keep the visible ASTRO Health wordmark and accessible home link; the later authorized cleanup removes the header tagline.
- Replace the header's simulated-data/environment/mission-day block with `UMBRAL` only.
- Update `layout.tsx` only as needed to remove obsolete header props/imports.
- Preserve all other simulation caveats elsewhere; no new tokens, dependencies, bitmap assets, or unrelated UI changes.

## Authorized follow-up: ASTRO rebrand and crew heading layout
- Rename current tracked ASTRA brand copy to ASTRO (including case variants and the npm package identifier), while preserving commit history and not rewriting historical commit evidence/messages.
- Increase the logo symbol about 20-25% without changing its drawing or adding tokens.
- Make the Crew overview title slightly smaller and place the existing Crew health / Mission in 3D controls to its right on desktop; retain a clean responsive stack on mobile.
- Remove only the exact selected-day sentence: `Simulated readings for each crew member on the selected day.`
- Preserve all other feature behavior, data, caveats, and styling.

## Authorized follow-up: concise health-screen labels
- Remove the `Mission wellness console` tagline from `SiteHeader` only; leave the footer's similarly worded label unchanged.
- Change the timeline eyebrow from `${total} SIMULATED DAYS` to `${total} DAYS` by removing only `SIMULATED`.
- Remove only `Cumulative · not a rate or safe limit` from the crew-card radiation caption; preserve cumulative metric name/unit and other caveats. Remove it from astronaut metric UI only if the exact same caption exists there; do not edit fixture descriptions.
- Remove the high-level health/activity badges from every astronaut profile. Preserve authored profile data and all metric-level scenario statuses/colors.
- Keep all existing uncommitted ASTRO branding/layout changes. Do not commit or create remote artifacts while delivery is pending; no additional chain-strategy prompt during this implementation.

## Route and implementation plan
- Route: delegated direct (bounded writer).
- Trigger evidence: a contained shared header and root-layout update plus matching browser regression coverage; no parallel writer or SDD artifacts.
- TDD: tests after implementation, per user preference; strict TDD is not enabled for this task.
- Delivery strategy: `ask-on-risk`.
- Forecast: approximately 120 authored changed lines, one work unit, below the ~400-line planning heuristic.
- Follow-up forecast: approximately 160-220 authored changed lines across current tracked brand files and targeted regression coverage. Existing feature-branch work is approximately 289 authored lines by `git diff --numstat main...HEAD`; the follow-up may take cumulative branch scope past 400. Delivery strategy remains `ask-on-risk`; notify the parent before committing if the observed cumulative count exceeds 400.

## Tasks and acceptance
- [x] AB-1 Replace the boxed A with a token-colored code-native SVG ASTRO mark and preserve accessible home navigation and wordmark.
- [x] AB-2 Replace top-right metadata with `UMBRAL`; remove obsolete header props and layout imports.
- [x] AB-3 Add e2e assertions for branding, removed header metadata, and responsive layout; capture desktop/mobile header screenshots for visual inspection.
- [x] AB-4 Run the required checks and record the conventional-commit identity.
- [x] AB-5 Rename current tracked ASTRA brand references and package identifier to ASTRO; preserve historical evidence.
- [x] AB-6 Enlarge the existing logo symbol by approximately 20-25%.
- [x] AB-7 Refine Crew overview heading hierarchy and align existing view controls to the right on desktop, stacking responsively on mobile.
- [x] AB-8 Remove the exact simulated-readings sentence and add/adjust browser assertions for the requested copy and responsive layout.
- [x] AB-9 Run baseline and final verification; all required checks passed.
- [ ] AB-10 Record the new work-unit commit and update this task document and its Engram mirror after delivery authorization.
- [x] AB-11 Remove the header tagline and the `SIMULATED` token from the mission-day timeline eyebrow, with negative e2e assertions.
- [x] AB-12 Remove the exact cumulative-radiation card caption while retaining the metric identity/unit and unrelated caveats.
- [x] AB-13 Remove fixture-derived high-level health/activity badges from all astronaut profiles without changing profile data or metric statuses.
- [x] AB-14 Add/adjust e2e regression coverage for all removals and run required checks; keep the work uncommitted.

## Checks
- Baseline: `npm run lint -- --ignore-pattern '.artifacts/**'`, `npm run typecheck`, `npm test`, `npm run build`.
- Final: same checks plus `npm run test:e2e` and `git diff --check`.
- RDD: off (confirmed by parent); no review lifecycle.

## Progress
- Baseline scoped lint passed.
- Baseline typecheck passed.
- Baseline unit tests passed (14 files / 88 tests).
- Baseline production build passed.
- Follow-up baseline scoped lint, typecheck, unit tests (88), and production build passed before implementation.
- Implemented the inline ASTRO A/orbit/pulse logo, visible ASTRO Health wordmark, existing tagline, accessible home link, and UMBRAL-only header right side.
- Removed obsolete `SiteHeader` props and root-layout fixture imports; preserved simulation caveats elsewhere.
- Renamed current app/docs/package branding and npm package slug to ASTRO; retained historical commit messages, screenshot paths, and old branch names as evidence.
- Enlarged the SVG mark to 48px, moved the 28px Crew overview heading and existing view toggle onto one desktop row, and stacks them below 761px.
- Removed the exact selected-day hint sentence; retained mission-view hint and all day/health data behavior.
- Added responsive geometry, toggle interaction, package branding, title, logo-size, and exact-copy regression assertions.
- Removed only the header tagline, `SIMULATED` timeline token, crew-card cumulative-radiation caption, and high-level profile health/activity badges; retained footer label, radiation metric, and metric-level statuses.
- Confirmed the profile badges were rendered from authored `person.health` / `person.activity` fields by `ProfileHeader`; only their presentation was removed, with no data/domain edits.
- The exact radiation caption occurred only in `CrewCard`; no matching astronaut metric UI caption or fixture description was changed.
- This cleanup remains uncommitted as requested.
- Focused e2e passed (16 tests) and full e2e passed (47 tests); desktop/mobile screenshots were inspected and show a compact, overflow-free header.
- Final verification passed; implementation commit `10195b89f5fc298753dcf67ca48c2899236a096f` recorded.

## Verification evidence
- Baseline scoped lint: pass (`npm run lint -- --ignore-pattern '.artifacts/**'`).
- Baseline typecheck: pass (`npm run typecheck`).
- Baseline unit tests: 14 files / 88 tests passed (`npm test`).
- Baseline build: pass (`npm run build`).
- Focused e2e: 16 tests passed (`npm run test:e2e -- e2e/layout.spec.ts e2e/crew-overview.spec.ts`).
- Final scoped lint: pass (`npm run lint -- --ignore-pattern '.artifacts/**'`).
- Final typecheck: pass (`npm run typecheck`).
- Final unit tests: 14 files / 88 tests passed (`npm test`).
- Final build: pass (`npm run build`).
- Full e2e: 47 tests passed (`npm run test:e2e`, 53.3s).
- `git diff --check`: pass.
- Visual QA screenshots: `test-results/layout-responsive-layout-s-c2378-ark-without-header-metadata-chromium/astra-branding-desktop.png` and `test-results/layout-responsive-layout-s-c2378-ark-without-header-metadata-chromium/astra-branding-mobile.png`.
- Follow-up scoped lint: pass (`npm run lint -- --ignore-pattern '.artifacts/**'`).
- Follow-up typecheck: pass (`npm run typecheck`).
- Follow-up unit tests: 14 files / 88 tests passed (`npm test`).
- Follow-up build: pass (`npm run build`).
- Follow-up focused e2e: 17 tests passed (`npm run test:e2e -- e2e/layout.spec.ts e2e/crew-overview.spec.ts`).
- Follow-up full e2e: 48 tests passed (`npm run test:e2e`).
- Follow-up `git diff --check`: pass.
- Follow-up desktop/mobile heading screenshots inspected: `test-results/crew-overview-crew-overvie-59589-p-and-stacks-them-on-mobile-chromium/astro-crew-heading-desktop.png` and `.../astro-crew-heading-mobile.png`.
- Follow-up desktop/mobile brand screenshots inspected: `test-results/layout-responsive-layout-s-e79a2-ark-without-header-metadata-chromium/astro-branding-desktop.png` and `.../astro-branding-mobile.png`.
- Cumulative branch diff before task-record completion: 404 authored lines (additions plus deletions; includes prior feature work).
- Cleanup scoped lint: pass (`npm run lint -- --ignore-pattern '.artifacts/**'`).
- Cleanup typecheck: pass (`npm run typecheck`).
- Cleanup unit tests: 14 files / 88 tests passed (`npm test`).
- Cleanup build: pass (`npm run build`).
- Cleanup focused e2e: 24 tests passed (`npm run test:e2e -- e2e/layout.spec.ts e2e/crew-overview.spec.ts e2e/astronaut-profile.spec.ts`).
- Cleanup full e2e: 48 tests passed (`npm run test:e2e`).
- Cleanup `git diff --check`: pass.

## Next step
AB-11 through AB-14 are verified. Existing commit delivery remains pending; do not commit, push, or create a PR until authorized by the parent/user delivery decision.

## Work-unit commit
- `10195b89f5fc298753dcf67ca48c2899236a096f` - `feat(design-system): add ASTRA Health header branding`

## Rollback boundary
Revert `10195b89f5fc298753dcf67ca48c2899236a096f` to restore the prior header mark and mission metadata.

## Historical evidence exceptions
- The original branding work-unit commit message `feat(design-system): add ASTRA Health header branding` remains exact; commit history is not rewritten.
- The original screenshot paths retain their historical `astra-branding` filenames.
- The prior task's recorded branch name `feat/astra-health` is retained as historical evidence.
