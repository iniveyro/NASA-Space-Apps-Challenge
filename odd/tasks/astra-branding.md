# ASTRA Health application branding

## Objective
Replace the global header's plain lettermark and mission metadata with a code-native ASTRA Health logo and the concise `UMBRAL` wordmark.

## Scope and constraints
- Add an original SVG brand symbol combining an A, orbit, and subtle heartbeat; use existing theme tokens/currentColor only.
- Keep the visible ASTRA Health wordmark, accessible home link, and existing tagline.
- Replace the header's simulated-data/environment/mission-day block with `UMBRAL` only.
- Update `layout.tsx` only as needed to remove obsolete header props/imports.
- Preserve all other simulation caveats elsewhere; no new tokens, dependencies, bitmap assets, or unrelated UI changes.

## Route and implementation plan
- Route: delegated direct (bounded writer).
- Trigger evidence: a contained shared header and root-layout update plus matching browser regression coverage; no parallel writer or SDD artifacts.
- TDD: tests after implementation, per user preference; strict TDD is not enabled for this task.
- Delivery strategy: `ask-on-risk`.
- Forecast: approximately 120 authored changed lines, one work unit, below the ~400-line planning heuristic.

## Tasks and acceptance
- [x] AB-1 Replace the boxed A with a token-colored code-native SVG ASTRA mark and preserve accessible home navigation and wordmark.
- [x] AB-2 Replace top-right metadata with `UMBRAL`; remove obsolete header props and layout imports.
- [x] AB-3 Add e2e assertions for branding, removed header metadata, and responsive layout; capture desktop/mobile header screenshots for visual inspection.
- [ ] AB-4 Run the required checks and record the conventional-commit identity.

## Checks
- Baseline: `npm run lint -- --ignore-pattern '.artifacts/**'`, `npm run typecheck`, `npm test`, `npm run build`.
- Final: same checks plus `npm run test:e2e` and `git diff --check`.
- RDD: off (confirmed by parent); no review lifecycle.

## Progress
- Baseline scoped lint passed.
- Baseline typecheck passed.
- Baseline unit tests passed (14 files / 88 tests).
- Baseline production build passed.
- Implemented the inline ASTRA A/orbit/pulse logo, visible ASTRA Health wordmark, existing tagline, accessible home link, and UMBRAL-only header right side.
- Removed obsolete `SiteHeader` props and root-layout fixture imports; preserved simulation caveats elsewhere.
- Focused e2e passed (16 tests) and full e2e passed (47 tests); desktop/mobile screenshots were inspected and show a compact, overflow-free header.
- Final verification passed; commit pending.

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

## Next step
Record the implementation commit identity and mirror the completed task state.

## Rollback boundary
Revert the branding work-unit commit to restore the prior header mark and mission metadata.
