# ASTRA Health

ASTRA Health is a local, fictional astronaut wellness dashboard. The crew overview compares four people at once; an individual profile presents simulated readings, history, and an interactive body-map guide. It is an interface prototype, not telemetry or medical guidance.

## Quick start

1. Open `index.html` directly in a current browser. No build step, runtime dependency, or network request is required.
2. Select **View profile** to open `#astronaut/<id>`, or use **Back to crew overview**. Both routes work as direct links and retain browser back/forward behavior.
3. Select any metric, body-map region, or 7/30-day range to explore the deterministic fictional history.

An optional local preview server is available with Python:

```sh
python -m http.server 4173 --bind 127.0.0.1
```

## What the prototype shows

- Four fictional profiles with age, weight, sex, independent health/activity labels, and four crew-overview readings: heart rate, paired blood pressure, temperature, and cumulative radiation dose.
- Dark neutral crew cards show each overview metric as a large green, amber, or red surface; avatar colors do not identify or rank people. Each metric has its own authored simulated scenario, so one alert can stand out without making the whole profile red.
- Ten individual readings: heart rate, blood pressure, temperature, sleep, mood, activity, SpO₂, glucose, self-reported stress, and cumulative radiation.
- Metric details show the current fictional value, fictional preflight context, and the authored demo reference description that explains the displayed status. Missing scenario context resolves to gray/unknown rather than green.
- Microgravity is the current mission context. Earth, Moon, and Mars are context labels only; this prototype has no environment simulator or environment-specific validated medical ranges, and changing context would not change readings or statuses.
- Deterministic 30-day histories; the 7-day view is the latest week of the same data. Blood pressure keeps separate systolic and diastolic series.
- SpO₂ and glucose are simulated point readings, not continuous sensor streams. Mood and stress are self-reported scales, not brain measurements.
- Radiation is cumulative, nonnegative, nondecreasing mGy; it is not shown as a rate. Bone-health information is educational only and does not estimate personal bone density or future loss.
- The body map is a navigation aid. Hover/focus previews a region, while selecting it changes the related history. Plot-wide pointer and touch selection finds the nearest date.

All names, values, dates, labels, and statuses are fictional fixtures. Green/amber/red states are authored for the interface, not inferred from numerical thresholds or medically validated ranges. Radiation is a cumulative mission exposure scenario, not a personal-physiology baseline or universal safe limit. No clinical thresholds or treatment recommendations are used. Bone-health background: [NASA, Risk of Spaceflight-Induced Bone Changes](https://www.nasa.gov/reference/risk-of-spaceflight-induced-bone-changes/).

## Verification

```sh
node --check app.js
node --check data.js
node --test tests/*.test.cjs
node tests/browser-smoke.cjs
```

The browser smoke test uses local Python and Chrome at `C:/Program Files/Google/Chrome/Application/chrome.exe`; it does not install packages or access remote services. It checks routes/history, profile and metric consistency, semantic metric colors and surfaces, reference/environment wording, body-map behavior, chart periods, nearest-date touch interaction, reduced motion, and 1440px/390px/320px overflow. Screenshots are written to ignored `.artifacts/` files.

## Files

| File | Purpose |
| --- | --- |
| `index.html` | Accessible two-view structure and inline body illustration |
| `styles.css` | Responsive light interface, focus states, and reduced-motion behavior |
| `data.js` | Fictional profiles, metric definitions, and deterministic histories |
| `app.js` | Hash routing, view rendering, body-map interaction, and SVG charts |
| `tests/data.test.cjs` | Built-in Node tests for data invariants |
| `tests/browser-smoke.cjs` | Local Chrome/CDP regression checks |
