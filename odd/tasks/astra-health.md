# ASTRA Health visual prototype

## Two-screen redesign — authorized follow-up
- Objective: replace the single-screen selection with a crew-wide overview and individual detail, using the user's approved plan.
- Scope: four overview metrics per astronaut (heart rate, blood pressure, temperature, cumulative radiation); detail profile age, weight, sex; simulated SpO2, glucose and self-reported stress; informational bone health; retain body map and chart interactions.
- Constraints: local-only, English UI, no real medical inference, invented clinical thresholds, external services, or edits outside this repository. Preserve existing uncommitted work. Route: delegated writer for multiple nontrivial files, independent verifier for high/unassessable risk. TDD not configured; run ordinary functional checks.
- [ ] R1: Implement two-view accessible hash navigation and crew-wide overview.
- [ ] R2: Extend fictional profiles, metrics, individual detail and sober responsive visual design.
- [ ] R3: Test navigation, data integrity, mobile and desktop interactions; document checks and limitations.
- Checks: `node --check app.js`, `node --check data.js`, `node --test tests/*.test.cjs`, `node tests/browser-smoke.cjs`. Forecast: over 400 changed lines. Previous delivery choice remains unresolved; do not commit, publish, push, or create PRs without resolving it.
- Acceptance: each overview card shows its own four metrics; valid detail links and browser history work locally; no stale profile or charts; radiation is cumulative mGy, all added readings fictional; bone section contains no personalized projection; visual layout accessible, responsive and reduced-motion aware.

## Objective
Build a local, single-screen crew health dashboard with fictional data, English UI, an interactive 2D body map, and selectable chart periods.

## Authorized scope and constraints
- Work only in this repository. Do not modify or further inspect the Obsidian vault.
- Four fictional crew profiles; health and activity are independent.
- Six metrics: heart rate, blood pressure, temperature, sleep, mood, and activity.
- White/light-gray medical-space visual direction and the approved semantic palette.
- HTML/CSS/JavaScript with inline SVG, no application dependencies or build step.
- No backend, real telemetry, clinical decisions, remote access, publication, or extra screens.

## Routing and checks
- Route: delegated direct; new logic across multiple source files triggers the writer boundary.
- Source work and self-verification: one bounded writer. Independent verification follows native risk assessment.
- TDD: not enabled; fresh empty repository has no TDD configuration or runner. Ordinary functional tests are required.
- Exact planned runner: `node --test tests/*.test.cjs`; syntax: `node --check app.js` and `node --check data.js`.
- Browser checks: local HTTP, desktop/mobile, crew selection, six metrics, 7/30-day periods, body focus/click, keyboard, reduced motion, and browser errors.
- RDD: off, global setting observed with `gentle-ai review mode status`; do not start or enable native review.

## Tasks
- [ ] T1: Build the responsive dashboard and deterministic fictional profiles, including demo labels and independent activity badges.
- [ ] T2: Implement synchronized person/metric/period selection, accessible 2D anatomy detail, SVG charts and tooltips.
- [ ] T3: Verify data/UI behavior, fix observed issues, and document local usage and limitations.

## Acceptance criteria
- All individual views reflect the selected crew member without stale data.
- Heart links to pulse/pressure; brain region links to sleep/mood; whole-body access covers temperature/activity.
- Chart types, units, axes, and tooltip values match the metric and period.
- Hover/focus and click/touch provide equivalent body information.
- Responsive layout, visible keyboard focus, text status labels, and reduced-motion support.
- No diagnosis, real clinical thresholds, external resources, or unlabelled fake readings.

## Delivery and progress
- Branch: `feat/astra-health`; repository initially empty, no base commit.
- Delivery strategy: `ask-on-risk`; forecast 900–1,300 authored lines, generated files excluded.
- Chain strategy not selected. Before committing a range above 400 lines, request the user's chain decision; do not publish, push, or create PRs.
- Commit identities: pending. Implemented items remain open until checks and work-unit commit evidence exist.
- T1/T2/T3 implementation and functional verification are complete; checkbox closure is pending only the delivery-strategy decision and local work-unit commits.
- Independent verification: PASS after one scoped functional correction. Verified actual off-mark Chrome touch at 320px, nearest date and both BP values, body hover/focus preview restoration, crew-preview reset, separate health/rest badges, and distinct/nonnegative axes. Source/test SHA-256 hashes unchanged by verifier. Desktop 1440px and mobile 390px/320px screenshots inspected; no clipping or horizontal overflow observed. Owned Chrome and preview processes stopped.
- Parent spot check: reran both JavaScript syntax checks and `node --test tests/*.test.cjs`; 6/6 passed. Native risk assessment returned `high/unassessable` for untracked initial files; therefore independent verification was required and completed, without starting RDD (globally off).
- Implementation evidence (uncommitted): body-map hover/focus now previews region descriptions without changing selected-region aria state, restores the selected description on leave/blur, and clears preview on crew changes. Plot-wide nearest-date pointer/touch selection replaces the tiny mark hit area; touch tooltips retain paired systolic/diastolic values. Activity domains are clamped nonnegative; sleep ticks use distinct decimal labels and mood remains categorical. Crew cards show independent health and activity/rest badges, and key labels were enlarged for mobile readability. `node --check app.js`, `node --check data.js`, `node --check tests/browser-smoke.cjs`, and `node --test tests/*.test.cjs` passed (6/6). `node tests/browser-smoke.cjs` passed in Chrome 157: all profiles/metrics/ranges, hover/focus restoration, crew reset, axis labels, actual off-mark touch at 320px for paired BP and activity, and no horizontal overflow at 320px/390px. Browser errors: none. Authored project files total 957 lines excluding this task document; no commit created while chain strategy is pending.
- Candidate boundary recommendation: fixture helpers plus data tests remain a coherent foundation unit; the integrated dashboard, regression smoke test, styles and docs exceed the 400-line review budget. Confirm chain strategy before committing; do not split interface behavior artificially.
- Rollback boundary: the new standalone prototype, tests, and README, without touching external folders.
- Next step: parent reconciles verification evidence and obtains the pending chain decision before any work-unit commits.
- Engram mirror: `odd/astra-health/tasks` in project `unknown`; memory tool currently resolves the outer workspace to an unrelated root, so use this unique topic.
