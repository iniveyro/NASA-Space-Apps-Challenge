# ASTRA Health

By the T2H Team.

ASTRA Health is a local, fictional astronaut wellness dashboard with a crew overview and individual profiles. It is an interface prototype, not telemetry or medical guidance.

## Quick start

1. Open `index.html` in a current browser. No package manager, build step, or network request is required; the body-map library is included locally.
2. Select a crew card to open `#astronaut/<id>`, or use **Back to crew overview**. Hash routes retain browser back/forward behavior.
3. Select a metric, body-map group, or 7/30-day range to explore deterministic fictional history.

For a local HTTP preview, run:

```sh
python -m http.server 4173 --bind 127.0.0.1
```

## Prototype boundaries

- Four fictional profiles show demographics, independent health/activity labels, daily heart-rate history, paired blood pressure, temperature, cumulative radiation, and a latest SpO₂ percentage ring.
- Ten individual readings use deterministic 30-day histories; the 7-day view is the latest week. Blood pressure keeps systolic and diastolic series distinct.
- SpO₂ and glucose are simulated point readings, not continuous sensor streams. Mood and stress are self-reported scales, not brain measurements.
- Brain, Heart, and Whole body are navigation groups for existing metrics, not organ measurements. The body map supports pointer selection; its adjacent buttons are keyboard accessible.
- Green, amber, and red statuses are authored for this interface, not inferred from thresholds or validated clinical ranges. Missing context remains unknown, and no treatment recommendations are provided.
- Radiation is cumulative, nonnegative, nondecreasing mGy; it is not displayed as a rate or personal-physiology baseline.

All names, values, dates, labels, and statuses are fictional fixtures. The interface contains one concise simulated-data notice.

## Vendored body map

The browser loads `vendor/body-highlighter-3.0.2/body-highlighter.browser.js` as a local classic script so direct `file://` and local HTTP launch paths remain available. It is adapted from the standalone CommonJS distribution of [`body-highlighter` 3.0.2](https://www.npmjs.com/package/body-highlighter) (source: [GitHub](https://github.com/GV79/body-highlighter)); the upstream MIT license is included beside it. The adapter supplies a local `module`/`exports` wrapper and exposes only the needed API. No package scripts or runtime network requests are used. The upstream CJS source SHA-256 is `fff86f7b4d9c2753256499f55a4d7f5ba320260a03998651e3a81298c5d184ff`.

## Verification

```sh
node --check app.js
node --check data.js
node --test tests/*.test.cjs
node --check tests/browser-smoke.cjs
node tests/browser-smoke.cjs
```

The browser smoke test uses local Python and Chrome at `C:/Program Files/Google/Chrome/Application/chrome.exe`; it does not install packages or access remote services. It checks `file://` and HTTP routes/history, profile and metric consistency, body-map clicks and keyboard controls, charts, nearest-date touch selection, reduced motion, responsive overview/detail layouts, and horizontal overflow from 320–3840px. Screenshots are written to ignored `.artifacts/` files.

## Files

| File | Purpose |
| --- | --- |
| `index.html` | Accessible two-view structure and local body-map script |
| `styles.css` | Responsive interface, focus states, and reduced-motion behavior |
| `data.js` | Fictional profiles, metrics, and deterministic histories |
| `app.js` | Hash routing, view rendering, map interaction, and SVG charts |
| `tests/data.test.cjs` | Built-in Node tests for data invariants |
| `tests/browser-smoke.cjs` | Local Chrome/CDP regression checks |
| `vendor/body-highlighter-3.0.2/` | Pinned distribution, browser adapter, MIT license, and provenance |
