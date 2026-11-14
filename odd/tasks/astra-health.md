# ASTRA Health visual prototype

## Objective
Provide a local, English-language fictional astronaut health dashboard with a crew-wide overview and individual detail views.

## Authorized scope and constraints
- Work only in this repository. Do not access the Obsidian vault, perform remote operations, install/download dependencies, publish, or create commits/branches/staging/PRs; the user owns Git delivery.
- Two views use hash routes: `#crew` and `#astronaut/<id>`. They support direct file loading, deep links, reload, browser history, and graceful fallback for invalid IDs.
- Four fictional astronauts; the overview shows all four simultaneously with heart rate, blood pressure, temperature, cumulative radiation, and independent health/activity states.
- Detail includes fictional demographics, ten simulated metrics, deterministic 30-day histories, selectable 7/30-day charts, and an accessible 2D body map.
- Radiation is cumulative nonnegative mGy, not a rate. Bone health is educational only; no individual BMD estimates, monthly loss, treatment guidance, or threshold-based inference.
- HTML/CSS/JavaScript and inline SVG only; no external dependencies/assets/fonts, backend, real telemetry, or clinical decisions. Preserve unrelated/user changes.
- Visual direction: sober light medical-space UI, accessible, responsive, reduced-motion aware.
- TDD is not enabled; use ordinary functional checks. RDD is globally off; do not start or enable review.

## Route, checks, and acceptance
- Route: delegated direct writer because implementation spans multiple non-trivial files; parent performs independent verification.
- Exact checks: `node --check app.js`, `node --check data.js`, `node --test tests/*.test.cjs`, `node tests/browser-smoke.cjs`.
- Acceptance: four overview cards with four values each; correct profile/deep-link and back/forward behavior; detail has ten metrics and demographics; deterministic/latest/chart values agree; body interactions and touch plot picking work; no stale data, mobile overflow, browser errors, or fabricated bone projections.

## Tasks
- [x] R1: Implement two-view hash routing, crew overview, and detail navigation. Verified direct file deep link, valid/invalid routes, profile navigation, reload, browser back/forward.
- [x] R2: Extend fictional data/metrics and implement accessible responsive detail UI. Verified demographics, ten latest metrics, independent status labels, body-map hover/focus/select, chart periods, and cumulative radiation semantics.
- [x] R3: Extend data and browser tests; document usage, limitations, and observed verification. Added deterministic-data invariants and expanded Chrome/CDP smoke coverage; updated README.

## Delivery and progress
- Branch at start: `feat/astra-health`; repository was clean at delegation.
- Git delivery is user-owned. No commits, branches, staging, pushes, or PRs are authorized; do not block on a chain decision or commit evidence.
- Prior single-view prototype remains the starting point. Its data/browser checks had passed before this redesign; the current tasks specifically cover the approved two-view follow-up.
- RDD: globally off; no review lifecycle.
- Verification observed: `node --check app.js` PASS; `node --check data.js` PASS; `node --test tests/*.test.cjs` PASS (7/7); `node --check tests/browser-smoke.cjs` PASS; `node tests/browser-smoke.cjs` PASS in Chrome 157. Checked four overview cards/four vitals each, four detail profiles/demographics, ten latest-value matches, 7/30-day history, paired BP, deep links/reload/file:///invalid fallback/back/forward, body-map click/hover/focus restoration, off-mark touch showing nearest paired BP date, reduced motion, no horizontal overflow at 1440/390/320 px, and no browser errors. Screenshots: `.artifacts/redesign-overview.png`, `.artifacts/redesign-detail.png`, `.artifacts/redesign-mobile.png`.
- Changed files: `index.html`, `styles.css`, `app.js`, `data.js`, `tests/data.test.cjs`, `tests/browser-smoke.cjs`, `README.md`, and this task document. No dependencies installed and no Git operations performed. Parent performs independent verification.
- Independent verification: PASS; read-only verifier reran syntax, 7/7 data tests and actual Chrome/CDP smoke, inspected application/harness/screenshots and found no scoped defects. Parent spot check reran 7/7 data tests. Full-page visual clipping was not exhaustively checked; viewport captures and horizontal overflow checks passed.
- Next step: user reviews the local prototype and retains all Git delivery decisions. No agent-created branches or commits during this redesign.

## Approved visual refinement iteration
- [x] C1: Give the crew cards a dark neutral surface and make each of the four overview metrics a prominent, accessible semantic status surface; use no fixed identity colors.
- [x] C2: Add authored fictional per-profile/per-metric scenario metadata for all ten metrics, a robust non-mutating resolver with unknown shown as gray, and metric-specific reference detail without clinical thresholds or environment-driven inference.
- [x] C3: Extend data and browser coverage; update README and this task evidence after the exact checks and screenshot inspection pass.
- Constraints: all values/scenarios simulated; statuses are explicitly demo references only; radiation is an exposure scenario, not a universal safe limit or physiology baseline; other environments are context-only and do not change values/states.

### Verification evidence
- `node --check app.js` — PASS.
- `node --check data.js` — PASS.
- `node --test tests/*.test.cjs` — PASS (9/9, including all-profile/all-metric scenarios, metadata-driven independence, unknown fallback, and fixture non-mutation).
- `node tests/browser-smoke.cjs` — PASS in Chrome 157.0.8103.78; verified 16 prominent colored overview surfaces (14 green, one amber, one red), neutral avatars, dark cards, detail colors/reference copy, independent resting state, all existing hash/file/history, metric/chart/body-map/keyboard/touch checks, and 1440/390/320px no-horizontal-overflow checks; no browser errors.
- Screenshots inspected: `.artifacts/colors-overview.png` shows four dark neutral crew cards with 14 green, one amber, and one standout red metric tile; `.artifacts/colors-detail.png` shows Sofia's red heart-rate card, green remaining metrics, and the matching authored reference; `.artifacts/colors-mobile.png` confirms visible status surfaces without horizontal overflow at 320px. Captures are viewport screenshots, so below-fold detail content is not visible in the mobile image.
- README updated to explain semantic demo states, fictional references, radiation caveat, and environment context. All files remain local; no dependencies or Git operations were used.
- Changed files in this iteration: `app.js`, `data.js`, `index.html`, `styles.css`, `tests/data.test.cjs`, `tests/browser-smoke.cjs`, `README.md`, and this task tracker.

## Resolver completeness follow-up
- [x] C4: Reject incomplete/non-finite current readings and baselines in the demo scenario resolver; keep fallback gray/unknown with explicit safe reference copy.
- [x] C5: Add regressions for missing/non-finite BP pairs, non-finite scalar values and baseline fields, and ensure malformed values never format as `undefined` or `NaN`.
- [x] C6: Run the exact syntax, data-test, and browser-smoke commands; record results and refresh the Engram task mirror.
- Constraint: keep status metadata-driven; add no numerical/clinical thresholds and do not mutate fixtures in production code.

### Follow-up verification evidence
- `node --check app.js` — PASS; `node --check data.js` — PASS.
- `node --test tests/*.test.cjs` — PASS (11/11). New cases cover missing/null/non-finite current BP components, missing/null/non-finite baseline diastolic, non-finite scalar current readings and baselines, explicit Unknown reference text, and safe formatting instead of `undefined`/`NaN`.
- `node tests/browser-smoke.cjs` — PASS in Chrome 157.0.8103.78; no browser errors, 1440/390/320px overflow checks passed, and prior color/reference/routing/chart/body-map interactions remain intact.
- Resolver and formatter changes are limited to `data.js`; regressions are in `tests/data.test.cjs`. This follow-up made no visual changes or Git mutations.
