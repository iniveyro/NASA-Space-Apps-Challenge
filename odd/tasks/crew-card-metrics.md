# Brighter crew cards and mission mini charts

## Outcome and scope
Make astronaut cards lighter and four vital tiles visibly status-tinted with strong borders. Add meaningful charts from existing mission history. Keep oxygen, authored statuses, fixture values, caveats, shared tokens/config and unrelated features unchanged.

- Branch: `feat/crew-card-metrics`; base: `ada07917e609e417de0257d20c309f62b6e5bef7`.
- Authorized roots: `src/features/crew-overview/**`, `e2e/crew-overview.spec.ts`, `e2e/layout.spec.ts` (card surface assertion only), this recovery document.
- Preserve pre-existing `package-lock.json` edits. No install, remote operation, push or PR.
- TDD: disabled by explicit user choice (tests after implementation). Runner: `npm test` (Vitest); runtime: `npm run test:e2e` (Playwright).
- RDD: off globally. Delivery strategy: ask-on-risk. Forecast: about 250–350 authored changed lines; one cohesive work unit. No PR planned.

## Tasks
- [x] T1 — Implement lighter cards, status fills/strong borders and four mission-backed mini charts; add focused tests and e2e coverage, verify, and commit as one behavior unit.
  - Route: delegated direct. Evidence: multiple non-trivial UI files and testing; writer reads its own preparation.
  - Acceptance: existing design tokens and tone mappings only; chart values follow mission day; missing/non-finite samples remain missing; no fake waveform or clinical thresholds; BP shows both pressure series if charted; radiation remains cumulative with its existing displayed unit (mSv; AGENTS.md says mGy, a pre-existing discrepancy left outside this change); SpO2 untouched; responsive and accessible.
  - Checks: `npm run lint -- --ignore-pattern ".artifacts/**"`; `npm run typecheck`; `npm test`; `npm run build`; `npm run test:e2e`.
  - Baseline: first four commands pass, 39 unit tests; ordinary lint fails on generated `.artifacts` files.
  - Implementation: lighter raised card surface; status-mapped filled vital tiles with 2px tone borders; seven-day SVG charts for heart rate, paired systolic/diastolic pressure, temperature, and cumulative radiation. Missing samples remain gaps; no-reading history is labeled unavailable; a single sample renders a point. Oxygen markup and data flow are unchanged.
  - Verification: `npm run lint -- --ignore-pattern ".artifacts/**"` passed; `npm run typecheck` passed; `npm test` passed (43 tests); `npm run build` passed; `npm run test:e2e` passed (28 tests).
  - Visual screenshot: `.artifacts/crew-card-metrics-desktop.png`, captured with installed Chrome and inspected by parent. Independent verification: focused unit tests 4/4 and overview e2e 6/6 passed; no functional findings.
  - Runtime harness: Playwright crew overview flow.
  - Rollback: overview styling/history charts and their tests only; shared data and other features unaffected.
  - Commit: `bb3f9ca` (feature, tests and evidence). RDD: disabled/unmanaged. Authored line count: 260 including the task document, excluding pre-existing lockfile edits. Native risk assessment unavailable due to untracked-file declaration; treated high for verification and independent verifier completed. Parent spot check: mini-chart unit tests 4/4 passed.

- [ ] T2 — Correct the card surface to very light gray, improve chart contrast, and remove crew health/activity badges and visible "7-day trend" text.
  - User feedback: T1 stayed dark navy and did not meet the intended light background; supersede that visual choice, preserve its mission charts.
  - Route: delegated direct; multiple UI files and matching e2e assertions require coordinated changes.
  - Acceptance: existing bg-surface-muted with dark readable card text; status tiles retain vivid fills; high-contrast chart strokes and dashed BP secondary trace; no visible trend caption or crew health/activity badges; metric status labels and oxygen data semantics retained. Existing shared tokens only.
  - Scope extension: e2e/layout.spec.ts only to update the card background assertion; no other feature or shared config/data edits.
  - Checks: same full suite as T1 with .artifacts excluded from lint; screenshot with installed Chrome to verify actual light-gray background and chart contrast.
  - TDD: off, explicit user choice to test after implementation. RDD: off, unchanged.
  - Forecast: about 100–130 additional authored lines; feature total expected under 400. Commit/check evidence pending.
  - Implementation: outer card and link now use `bg-surface-muted` with readable dark text; crew health/activity badges and visible trend captions are removed; per-metric scenario labels and accessible chart history labels remain. Chart paths/markers use white and blood-pressure diastolic is dashed; the SpO₂ row/data remain unchanged.
  - Contrast verification: e2e reads the compiled status-fill and chart paint values and asserts every chart path/marker is at least 3:1 against each status fill. White-to-fill ratios: ok 7.13:1; warn 6.85:1; alert 8.31:1; unknown 7.58:1.
  - Verification: `npm run lint -- --ignore-pattern ".artifacts/**"` passed; `npm run typecheck` passed; `npm test` passed (43 tests); `npm run build` passed; `npm run test:e2e` passed (28 tests).
  - Screenshots: `.artifacts/crew-card-metrics-t2-desktop.png` and `.artifacts/crew-card-metrics-t2-mobile.png`, captured with installed Chrome and visually inspected.
  - Commit: pending parent diff readback. No RDD review was started.
  - Rollback: T2 presentation and its e2e assertions, without reverting existing chart/data behavior.

## Progress and next step
T1 committed; T2 implementation and verification complete, pending parent diff readback and commit. Preserve oxygen and pre-existing lockfile edits. No push or PR performed. Engram mirror topic: `odd/crew-card-metrics/tasks`.
