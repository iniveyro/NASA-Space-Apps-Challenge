# ASTRA Health

ASTRA Health is a responsive, single-screen crew wellness dashboard prototype. It uses local fictional profiles to demonstrate how a mission team might browse wellness signals; it does not connect to spacecraft systems or provide medical guidance.

## Quick start

1. Open `index.html` directly in a current desktop or mobile browser. The prototype has no build step, runtime dependencies, or network requests.
2. Select a crew profile, a metric card, a body-map region, or the 7/30-day range to explore the linked view.
3. Run the checks below after changing the data helpers or interface.

Optional loopback preview:

```sh
python -m http.server 4173 --bind 127.0.0.1
```

Then open `http://127.0.0.1:4173` in a browser.

## Demo behavior

- Four fictional crew profiles include stable, monitoring, simulated-alert, and resting examples. Activity/rest state is separate from the health-scenario label.
- Six selectable metrics show deterministic 30-day histories; the 7-day view is the latest week of the same history.
- Heart-rate, temperature, and blood-pressure histories use lines; sleep and activity use bars; mood uses a labelled 1–5 scale. Blood pressure retains distinct systolic and diastolic series.
- The front-view body map is a navigation aid: heart opens pulse and pressure, brain opens self-reported sleep and mood, and whole body opens temperature and activity. These associations do not measure organs.
- Hover or focus a body-map region to preview its description; pointer exit or blur restores the selected region. Tap/click selects it.
- Chart marks support keyboard focus. Pointer movement and touch anywhere in the plot select the nearest date; blood-pressure tooltips show paired systolic and diastolic values.

All readings, names, dates, statuses, and observations are authored fictional fixtures. Values are not generated from clinical thresholds, are not telemetry, and must not be used for diagnosis, treatment, or operational decisions.

## Verification

```sh
node --check app.js
node --check data.js
node --test tests/*.test.cjs
```

Optional browser regression smoke (requires local Python and Chrome at `C:/Program Files/Google/Chrome/Application/chrome.exe`; no packages are installed):

```sh
node tests/browser-smoke.cjs
```

The smoke runner starts a loopback-only HTTP server and a temporary headless Chrome profile, checks body previews, metric/range changes, axis labels and off-mark touch selection at 320px, and stops both processes on exit.

## Structure

| File | Purpose |
| --- | --- |
| `index.html` | Semantic dashboard structure and inline anatomy illustration |
| `styles.css` | Responsive light medical-space interface and reduced-motion rules |
| `data.js` | Deterministic fictional fixtures and testable history helpers |
| `app.js` | Crew, metric, body-map, period, and SVG chart interactions |
| `tests/data.test.cjs` | Built-in Node tests for fixture and series invariants |
