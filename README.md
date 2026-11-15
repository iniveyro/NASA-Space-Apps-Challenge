# T2H Team - AstroHealth

NASA Space Apps Challenge 2026 · AstroHealth: astronaut health self-monitoring, demonstrated on UMBRAL, a simulated crewed Mars mission (2026-2029).

## Mission data

Data and scripts for the demo are in `data/` and `scripts/`. See [data/README.md](data/README.md) for the file list, sources, assumptions and how to rebuild.

## ASTRA Health

ASTRA Health is a fictional astronaut wellness dashboard with a crew overview and individual profiles. It is an interface prototype, not telemetry or medical guidance.

Built with Next.js 16 (App Router), React 19, TypeScript, and Tailwind CSS v4. Deployed on Vercel.

### Quick start

Requires Node.js 22.12+ (24 recommended) and npm.

```sh
npm ci          # install the locked dependencies
npm run dev     # http://localhost:3000
```

Routes:

- `/` — crew overview. Each card links to its profile.
- `/astronaut/<id>` — profile (`ines`, `kanji`, `malik`, `sofia`). The four profiles are prerendered at build time; unknown ids show a not-found page.
- `/mission` — mission geometry: 3D view of the Sun, Earth, Mars and the crew on each mission day, the Earth-link delay, and the story beats. `?day=<n>` opens a given day. Falls back to a 2D diagram without WebGL.

### Scripts

| Command | Purpose |
| --- | --- |
| `npm run dev` | Development server |
| `npm run build` / `npm start` | Production build / serve |
| `npm run lint` | ESLint, including architecture-boundary and design-token rules |
| `npm run typecheck` | Route type generation + `tsc --noEmit` |
| `npm test` | Vitest unit tests (data invariants, chart geometry, body-map regions) |
| `npm run test:e2e` | Playwright end-to-end tests. Builds and starts the app; locally it uses installed Google Chrome. Set `PW_BUNDLED_CHROMIUM=1` to use Playwright's Chromium (`npx playwright install chromium`). |

### Project structure

```
src/
  app/                      thin routes only (layout, pages, not-found)
  features/
    crew-health-data/       fictional profiles, metrics, deterministic histories, labels
    crew-overview/          crew cards, heart-rate sparkline, SpO₂ ring
    astronaut-profile/      profile header, metric grid, reference detail, dashboard state
    trend-chart/            SVG history chart and "Wellness trends" panel
    body-map/               3D figure with region states (three.js), 2D body-highlighter fallback, region selectors
    mission-orbit/          3D mission geometry (three.js), Earth-link readout, story beats
  shared/
    design-system/          theme.css tokens, status tones, UI primitives
    lib/                    cn(), date formatting, reduced-motion and WebGL support hooks
    scene/                  three.js helpers: token colors, glow textures, error boundary, on-screen hook
e2e/                        Playwright specs, one per feature
docs/design-system.md       tokens, primitives, do/don't
```

Features are independent folders with a public `index.ts`. Coding agents work one feature per branch; see [AGENTS.md](AGENTS.md) for the full contribution contract and [docs/design-system.md](docs/design-system.md) for the shared visual language.

### Prototype boundaries

- Four fictional profiles show demographics, independent health/activity labels, daily heart-rate history, paired blood pressure, temperature, cumulative radiation, and a latest SpO₂ percentage ring.
- Ten individual readings use deterministic 30-day histories; the 7-day view is the latest week. Blood pressure keeps systolic and diastolic series distinct.
- SpO₂ and glucose are simulated point readings, not continuous sensor streams. Mood and stress are self-reported scales, not brain measurements.
- Brain, Heart, and Whole body are navigation groups for existing metrics, not organ measurements. The body map supports pointer selection; its adjacent buttons are keyboard accessible.
- Green, amber, and red statuses are authored for this interface, not inferred from thresholds or validated clinical ranges. Missing context remains unknown, and no treatment recommendations are provided.
- Radiation is cumulative, nonnegative, nondecreasing mSv (UMBRAL simulation); it is not displayed as a rate or personal-physiology baseline.

All names, values, dates, labels, and statuses are fictional fixtures. The interface contains one concise simulated-data notice.

### Body map library

The illustration uses [`body-highlighter`](https://www.npmjs.com/package/body-highlighter) 3.0.2 (MIT), installed from npm with an exact version pin and loaded on the client only. Its published CommonJS build matches the SHA-256 recorded for the earlier vendored copy (`fff86f7b4d9c2753256499f55a4d7f5ba320260a03998651e3a81298c5d184ff`).

### Deploying to Vercel

1. Import the GitHub repository in the Vercel dashboard. The Next.js preset is detected automatically; no `vercel.json` is needed.
2. Keep the defaults: install `npm ci` (from `package-lock.json`), build `npm run build`, root directory `/`.
3. Every pull request gets a preview deployment; `main` deploys to production.

CI (`.github/workflows/ci.yml`) runs lint, typecheck, unit tests, build, and Playwright on every pull request.
