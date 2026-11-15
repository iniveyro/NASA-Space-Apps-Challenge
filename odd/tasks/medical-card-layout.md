# Medical card layout

## Objective
Make the home crew medical cards easier to scan by removing the SpO₂ row and the visible “Reference” label, while giving the existing mini charts and dashboard grid more room.

## Problem and why
The four-card desktop grid compresses each metric tile and its mini chart. The extra oxygen row and repeated “Reference” labels add clutter without helping the requested card-level overview.

## Scope and constraints
- Change only the crew overview card/dashboard presentation and its e2e coverage.
- Hide SpO₂ only inside the crew cards; keep fixtures, domain statuses, profile metrics, and data unchanged.
- Keep the established light-gray page/card treatment and authored status colors/caveats.
- Do not change shared design-system tokens or unrelated features.

## Route and implementation plan
- Route: delegated direct (bounded writer).
- Trigger evidence: component layout and regression coverage are non-trivial changes across multiple files; reading was bundled with implementation. No parallel writer or SDD artifacts.
- TDD: tests after implementation, per user preference; strict TDD is not enabled for this task.
- Delivery strategy: `ask-on-risk`.
- Forecast: approximately 100 authored changed lines, one cohesive work unit, below the ~400-line planning heuristic.

## Tasks and acceptance
- [x] MCL-1 Remove the oxygen UI and visible “Reference” status label from crew cards without changing underlying data/statuses.
- [x] MCL-2 Use available desktop width for a two-column crew-card layout and enlarge the mini charts while preserving narrow-screen behavior and the light-gray page style.
- [x] MCL-3 Add e2e assertions for absent oxygen/reference card UI and for wider responsive mini charts.
- [x] MCL-4 Record the work-unit commit identity and close the task.

## Checks
- Baseline: `npm run lint -- --ignore-pattern '.artifacts/**'`, `npm run typecheck`, `npm test`, `npm run build`.
- Final: same scoped lint/typecheck/unit/build plus `npm run test:e2e`.
- RDD: off (confirmed by parent); no review lifecycle.

## Progress
- Baseline scoped lint, typecheck, unit tests, and build passed before source changes. Unscoped lint is known to fail on pre-existing `.artifacts` content; `.artifacts` and lint configuration remain out of scope.
- Implemented MCL-1–MCL-3 in `CrewCard`, `MissionCrewBoard`, `MetricMiniChart`, and `e2e/crew-overview.spec.ts`; source behavior changes only presentation, not data or statuses.
- Final verification passed and the implementation work unit is committed as `f74bd9e`.

## Verification evidence
- Baseline scoped lint: pass.
- Baseline typecheck: pass.
- Baseline unit tests: 14 files / 88 tests passed.
- Baseline production build: pass.
- Final scoped lint: pass (`npm run lint -- --ignore-pattern '.artifacts/**'`).
- Final typecheck: pass (`npm run typecheck`).
- Final unit tests: 14 files / 88 tests passed (`npm test`).
- Final production build: pass (`npm run build`).
- Final e2e: 45 tests passed (`npm run test:e2e`, 58.2s).
- `git diff --check`: pass.
- Work-unit commit: `f74bd9e` (`feat(crew-overview): expand medical card mini charts`).

## Next step
No remaining implementation work. The follow-up task-state commit records the work-unit identity.

## Rollback boundary
Revert this work-unit commit to restore the current crew-card layout and associated e2e assertions.
