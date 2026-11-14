(function () {
  "use strict";
  const { METRICS, PROFILES, ENVIRONMENT, getProfile, getSeries, latest, formatValue, resolveMetricScenario } = window.AstraData;
  const state = { profileId: PROFILES[0].id, metricId: "heartRate", days: 30, region: null, hoverRegion: null, focusRegion: null, lastTouchAt: 0, bodyHighlighter: null };
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));
  const escapeHtml = (value) => String(value).replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]);
  const metricFor = (id) => METRICS.find((metric) => metric.id === id);
  const stateClass = (status) => status === "monitoring" ? "monitoring" : status === "simulated-alert" ? "simulated-alert" : "stable";
  const healthLabel = (status) => ({ stable: "Stable", monitoring: "Monitoring", "simulated-alert": "Simulated alert" })[status];
  const metricStatusClass = (status) => ["within-demo-reference", "demo-deviation", "demo-alert"].includes(status) ? status : "unknown";
  const regionMetrics = {
    heart: ["heartRate", "bloodPressure"],
    brain: ["sleep", "mood", "stress"],
    body: ["temperature", "activity", "spo2", "glucose", "radiation"]
  };
  const regionDescriptions = {
    heart: "Heart-associated readings: heart rate and blood pressure.",
    brain: "Brain-associated self-reports: sleep, mood, and stress.",
    body: "Whole-body signals: temperature, activity, SpO₂, glucose, and radiation."
  };

  function dateLabel(date) {
    return new Intl.DateTimeFormat("en", { month: "short", day: "numeric", timeZone: "UTC" }).format(new Date(date + "T00:00:00Z"));
  }
  function selectedProfile() { return getProfile(state.profileId); }
  function heartRateSparkline(profileId) {
    const points = getSeries(profileId, "heartRate", 7).map((point) => point.value);
    if (points.length !== 7 || points.some((value) => !Number.isFinite(value))) return "<span class=\"trend-unavailable\">Unavailable</span>";
    const min = Math.min(...points); const max = Math.max(...points); const range = max - min || 1;
    const coordinates = points.map((value, index) => [4 + index * 18, 27 - (value - min) * 20 / range]);
    const path = coordinates.map(([x, y], index) => `${index ? "L" : "M"}${x} ${y}`).join(" ");
    const accessibleValues = points.join(", ");
    return `<svg class="mini-sparkline" viewBox="0 0 116 32" role="img" aria-label="Seven daily fictional heart-rate readings: ${accessibleValues} beats per minute"><path d="${path}"/><circle cx="${coordinates.at(-1)[0]}" cy="${coordinates.at(-1)[1]}" r="2.5"/></svg>`;
  }
  function oxygenRing(profileId) {
    const value = latest(profileId, "spo2");
    const formatted = formatValue("spo2", value);
    const valid = typeof value === "number" && Number.isFinite(value);
    if (!valid) return `<span class="oxygen-reading oxygen-unavailable" role="img" aria-label="SpO₂: ${escapeHtml(formatted)}. Fictional point reading."><span class="oxygen-value">${escapeHtml(formatted)}</span><span class="oxygen-label">SpO₂</span></span>`;
    const circumference = 2 * Math.PI * 17;
    const offset = circumference * (1 - value / 100);
    return `<span class="oxygen-reading" role="img" aria-label="SpO₂: ${escapeHtml(formatted)}%. Fictional point reading."><svg viewBox="0 0 44 44" aria-hidden="true"><circle class="oxygen-track" cx="22" cy="22" r="17"/><circle class="oxygen-progress" cx="22" cy="22" r="17" stroke-dasharray="${circumference.toFixed(2)}" stroke-dashoffset="${offset.toFixed(2)}"/></svg><span class="oxygen-value">${escapeHtml(formatted)}<small>%</small></span><span class="oxygen-label">SpO₂</span></span>`;
  }
  function renderCrew() {
    $("#crew-grid").innerHTML = PROFILES.map((person) => {
      const values = [
        ["heartRate", latest(person.id, "heartRate")],
        ["bloodPressure", latest(person.id, "bloodPressure")],
        ["temperature", latest(person.id, "temperature")],
        ["radiation", latest(person.id, "radiation")],
        ["spo2", latest(person.id, "spo2")]
      ];
      const healthClass = stateClass(person.health);
      const activityClass = person.activity === "resting" ? "resting" : "active";
      return `<article class="crew-card">
        <button class="crew-card-action" type="button" data-profile-route="${escapeHtml(person.id)}" aria-label="Open ${escapeHtml(person.name)} profile">
        <span class="crew-card-heading"><span class="avatar" aria-hidden="true">${escapeHtml(person.initials)}</span><span class="crew-identity"><span class="crew-name" role="heading" aria-level="3">${escapeHtml(person.name)}</span><span class="crew-role">${escapeHtml(person.role)}</span></span></span>
        <span class="crew-statuses"><span class="status-text ${healthClass}">${escapeHtml(healthLabel(person.health))}</span><span class="status-text ${activityClass}">${person.activity === "resting" ? "Resting" : "Active"}</span></span>
        <span class="crew-vitals" role="list">${values.map(([metricId, value]) => {
          const metric = metricFor(metricId);
          const formatted = formatValue(metricId, value);
          const scenario = resolveMetricScenario(person.id, metricId, value);
          const statusClass = metricStatusClass(scenario.status);
          if (metricId === "spo2") return `<span class="vital-tile oxygen-tile" data-metric-readout="spo2" role="listitem">${oxygenRing(person.id)}<span class="oxygen-note">Simulated point reading</span></span>`;
          const trend = metricId === "heartRate" ? `<span class="mini-trend"><span>7-day trend</span>${heartRateSparkline(person.id)}</span>` : "";
          return `<span class="vital-tile ${statusClass}" data-metric-readout="${metricId}" role="listitem" aria-label="${escapeHtml(metric.label)}: ${escapeHtml(formatted)} ${escapeHtml(metric.unit)}. ${escapeHtml(scenario.label)}."><span class="vital-label">${escapeHtml(metric.label)}</span><span class="vital-value">${escapeHtml(formatted)} <small>${escapeHtml(metric.unit)}</small></span><span class="metric-status">${escapeHtml(scenario.label)}</span>${trend}</span>`;
        }).join("")}</span>
        <span class="card-action-hint" aria-hidden="true">Open profile <span>→</span></span>
        </button>
      </article>`;
    }).join("");
  }

  function renderProfile() {
    const person = selectedProfile();
    $("#profile-avatar").className = "avatar";
    $("#profile-avatar").textContent = person.initials;
    $("#detail-title").textContent = person.name;
    $("#profile-role").textContent = person.role;
    $("#profile-age").textContent = `${person.age} years`;
    $("#profile-weight").textContent = `${person.weightKg} kg`;
    $("#profile-sex").textContent = person.sex;
    const health = $("#health-status");
    health.className = `status-text ${stateClass(person.health)}`;
    health.textContent = healthLabel(person.health);
    const activity = $("#activity-status");
    activity.className = `status-text ${person.activity === "resting" ? "resting" : "active"}`;
    activity.textContent = person.activity === "resting" ? "Resting" : "Active";
  }

  function renderMetrics() {
    const person = selectedProfile();
    $("#metric-grid").innerHTML = METRICS.map((metric) => {
      const value = latest(person.id, metric.id);
      const formatted = formatValue(metric.id, value);
      const scenario = resolveMetricScenario(person.id, metric.id, value);
      const statusClass = metricStatusClass(scenario.status);
      const display = metric.id === "mood" || metric.id === "stress" ? `${formatted} <span>of 5</span>` : `${formatted} <span>${escapeHtml(metric.unit)}</span>`;
      const note = metric.id === "spo2" || metric.id === "glucose" ? "Simulated point reading" : metric.id === "stress" || metric.id === "mood" ? "Self-reported" : metric.id === "radiation" ? "Cumulative dose" : "Latest simulated value";
      return `<button class="metric-card ${statusClass}" type="button" data-metric="${metric.id}" aria-pressed="${metric.id === state.metricId}" aria-label="${escapeHtml(metric.label)}: ${escapeHtml(formatted)} ${escapeHtml(metric.unit)}. ${escapeHtml(scenario.label)}. ${escapeHtml(metric.description)} Select to view history.">
        <span class="metric-label">${escapeHtml(metric.label)}</span><strong class="metric-value">${display}</strong><span class="metric-status">${escapeHtml(scenario.label)}</span><span class="metric-note">${escapeHtml(note)}</span>
      </button>`;
    }).join("");
    renderReference(person, metricFor(state.metricId));
  }

  function renderReference(person, metric) {
    const value = latest(person.id, metric.id);
    const scenario = resolveMetricScenario(person.id, metric.id, value);
    const statusClass = metricStatusClass(scenario.status);
    const reading = formatValue(metric.id, value);
    const baseline = scenario.baseline == null ? "Unavailable" : formatValue(metric.id, scenario.baseline);
    $("#metric-reference").innerHTML = `<div><p class="eyebrow">SIMULATED REFERENCE · ${escapeHtml(ENVIRONMENT.toUpperCase())} CONTEXT</p><h3>${escapeHtml(metric.label)} · ${escapeHtml(scenario.label)}</h3></div><dl class="reference-values"><div><dt>Current fictional reading</dt><dd>${escapeHtml(reading)} ${escapeHtml(metric.unit)}</dd></div><div><dt>${escapeHtml(scenario.baselineLabel || "Fictional baseline")}</dt><dd>${escapeHtml(baseline)} ${escapeHtml(metric.unit)}</dd></div></dl><p class="reference-description">${escapeHtml(scenario.reference)}</p><p class="reference-caveat">${escapeHtml(scenario.evidence || "Status is unavailable because an authored demo reference or reading is missing.")} Environment is context only; no environment-specific medical ranges are validated. Earth, Moon, and Mars are supported as context labels only and do not change values or statuses.</p>`;
    $("#metric-reference").className = `metric-reference ${statusClass}`;
  }

  function niceTicks(min, max, count) {
    if (min === max) return [min];
    return Array.from({ length: count }, (_, index) => max - (max - min) * index / (count - 1));
  }
  function formatTick(metric, value) {
    if (metric.id === "temperature" || metric.id === "sleep" || metric.id === "radiation") return Number(value).toFixed(metric.id === "radiation" ? 1 : 1);
    return String(Math.round(value));
  }
  function chartValue(metricId, value) { return metricId === "bloodPressure" ? [value.systolic, value.diastolic] : [value]; }
  function pointTooltip(metric, point) {
    if (metric.id === "bloodPressure") return `${dateLabel(point.date)} · Systolic: ${point.value.systolic} mmHg · Diastolic: ${point.value.diastolic} mmHg`;
    const value = formatValue(metric.id, point.value);
    const unit = metric.id === "mood" || metric.id === "stress" ? "of 5" : metric.unit;
    return `${dateLabel(point.date)} · ${metric.label}: ${value} ${unit}`;
  }
  function renderChart() {
    const person = selectedProfile();
    const metric = metricFor(state.metricId);
    const data = getSeries(person.id, metric.id, state.days);
    const svg = $("#trend-chart");
    const width = 700; const height = 270; const left = 54; const right = 16; const top = 20; const bottom = 45;
    const plotWidth = width - left - right; const plotHeight = height - top - bottom;
    const values = data.flatMap((point) => chartValue(metric.id, point.value));
    let min = Math.min(...values); let max = Math.max(...values);
    if (metric.type === "category") { min = 1; max = 5; }
    else if (min === max) { min -= 1; max += 1; }
    else { const pad = (max - min) * 0.16; min -= pad; max += pad; }
    const x = (index) => left + (data.length === 1 ? 0 : index * plotWidth / (data.length - 1));
    const y = (value) => top + (max - value) * plotHeight / (max - min);
    const colors = metric.id === "bloodPressure" ? ["#2563eb", "#64748b"] : ["#2563eb"];
    const ticks = metric.type === "category" ? [5, 4, 3, 2, 1] : niceTicks(min, max, 4);
    let markup = `<title>${escapeHtml(metric.label)} history for ${escapeHtml(person.name)}</title><desc>${state.days} days of deterministic fictional readings. Values are not for clinical use.</desc>`;
    ticks.forEach((tick) => {
      const ty = y(tick);
      markup += `<line class="chart-gridline" x1="${left}" y1="${ty}" x2="${width - right}" y2="${ty}"/><text class="chart-axis-label" x="${left - 10}" y="${ty + 4}" text-anchor="end">${escapeHtml(formatTick(metric, tick))}</text>`;
    });
    const labelIndices = [...new Set([0, Math.floor((data.length - 1) / 3), Math.floor((data.length - 1) * 2 / 3), data.length - 1])];
    labelIndices.forEach((index) => { markup += `<text class="chart-date-label" x="${x(index)}" y="${height - 12}" text-anchor="middle">${escapeHtml(dateLabel(data[index].date))}</text>`; });
    if (metric.type === "bar") {
      const baseY = y(Math.max(min, 0));
      const barWidth = Math.max(4, Math.min(16, plotWidth / data.length * 0.56));
      data.forEach((point, index) => {
        const py = y(point.value); const barY = Math.min(py, baseY); const barHeight = Math.max(1, Math.abs(baseY - py));
        markup += `<rect class="chart-bar" x="${x(index) - barWidth / 2}" y="${barY}" width="${barWidth}" height="${barHeight}" rx="2"/>`;
      });
    } else if (metric.type === "category") {
      data.forEach((point, index) => { markup += `<circle class="chart-mark" cx="${x(index)}" cy="${y(point.value)}" r="4"/>`; });
    } else {
      const seriesCount = metric.id === "bloodPressure" ? 2 : 1;
      for (let series = 0; series < seriesCount; series += 1) {
        const path = data.map((point, index) => `${index ? "L" : "M"}${x(index)} ${y(chartValue(metric.id, point.value)[series])}`).join(" ");
        markup += `<path class="chart-line" stroke="${colors[series]}" d="${path}"/>`;
        data.forEach((point, index) => { markup += `<circle class="chart-mark" fill="${colors[series]}" cx="${x(index)}" cy="${y(chartValue(metric.id, point.value)[series])}" r="3"/>`; });
      }
    }
    data.forEach((point, index) => {
      const accessible = pointTooltip(metric, point);
      markup += `<circle class="chart-hit-target" data-point="${index}" tabindex="0" role="button" aria-label="${escapeHtml(accessible)}" cx="${x(index)}" cy="${top + plotHeight / 2}" r="12" fill="transparent"/>`;
    });
    svg.innerHTML = markup;
    svg.setAttribute("aria-label", `${metric.label} for ${person.name}, last ${state.days} days. Fictional point readings.`);
    $("#chart-metric-title").textContent = metric.label;
    $("#chart-metric-unit").textContent = metric.unit;
    $("#chart-range-label").textContent = `LAST ${state.days} DAYS`;
    $("#chart-legend").innerHTML = metric.id === "bloodPressure" ? `<span><i class="legend-dot systolic"></i>Systolic</span><span><i class="legend-dot diastolic"></i>Diastolic</span>` : `<span><i class="legend-dot"></i>${escapeHtml(metric.label)}</span>`;
    $$("[data-days]").forEach((button) => button.setAttribute("aria-pressed", String(Number(button.dataset.days) === state.days)));
    $("#chart-tooltip").hidden = true;
  }

  function renderBody() {
    const selected = state.hoverRegion || state.focusRegion || state.region;
    $("#body-callout-text").textContent = selected ? regionDescriptions[selected] : "Regions are metric-navigation groups, not organ measurements.";
    $$(".body-target").forEach((button) => {
      button.setAttribute("aria-pressed", String(button.dataset.region === state.region));
      button.classList.toggle("preview", button.dataset.region === state.hoverRegion || button.dataset.region === state.focusRegion);
    });
  }
  function selectRegion(region) {
    const firstMetric = regionMetrics[region] && regionMetrics[region][0];
    if (!firstMetric) return;
    state.region = region; state.hoverRegion = null; state.focusRegion = null;
    setMetric(firstMetric);
  }
  function initializeBodyHighlighter() {
    const api = window.AstraBodyHighlighter;
    const container = $("#body-model");
    if (!api || !container) {
      if (container) { container.setAttribute("role", "status"); container.textContent = "Body illustration unavailable. Region buttons remain available."; }
      return;
    }
    try {
      const muscles = api.MuscleType;
      const groupMuscles = {
        brain: [muscles.HEAD, muscles.NECK],
        heart: [muscles.CHEST],
        body: [...new Set(Object.values(muscles))]
      };
      state.bodyHighlighter = api.createBodyHighlighter({
        container,
        data: [],
        bodyColor: "#dce2e8",
        highlightedColors: ["#8da4ba"],
        type: api.ModelType.ANTERIOR,
        wrapperClassName: "body-highlighter",
        style: { width: "100%", maxWidth: "280px", margin: "0 auto" },
        svgStyle: { display: "block", width: "100%", height: "auto" },
        onClick: ({ muscle }) => {
          const clicked = String(muscle || "").toLowerCase();
          selectRegion(clicked === "head" || clicked === "neck" ? "brain" : clicked === "chest" ? "heart" : "body");
        }
      });
      if (state.region) state.bodyHighlighter.update({ data: [{ name: regionDescriptions[state.region], muscles: groupMuscles[state.region] }] });
    } catch {
      state.bodyHighlighter = null;
      container.replaceChildren();
      container.setAttribute("role", "status");
      container.textContent = "Body illustration unavailable. Region buttons remain available.";
    }
  }
  function setMetric(id) {
    const metric = metricFor(id);
    if (!metric) return;
    state.metricId = id;
    if (metric.region) state.region = metric.region;
    if (state.bodyHighlighter && state.region) {
      const muscles = window.AstraBodyHighlighter.MuscleType;
      const groupMuscles = {
        brain: [muscles.HEAD, muscles.NECK],
        heart: [muscles.CHEST],
        body: [...new Set(Object.values(muscles))]
      };
      state.bodyHighlighter.update({ data: [{ name: regionDescriptions[state.region], muscles: groupMuscles[state.region] }] });
    }
    $("#chart-tooltip").hidden = true;
    renderMetrics(); renderChart(); renderBody();
  }
  function showTooltip(index, clientX, clientY) {
    const person = selectedProfile(); const metric = metricFor(state.metricId); const data = getSeries(person.id, metric.id, state.days);
    const point = data[Math.max(0, Math.min(data.length - 1, index))];
    if (!point) return;
    const tooltip = $("#chart-tooltip");
    tooltip.textContent = pointTooltip(metric, point); tooltip.hidden = false;
    const wrap = tooltip.parentElement.getBoundingClientRect();
    const localX = clientX - wrap.left; const localY = clientY - wrap.top;
    tooltip.style.left = `${Math.max(8, Math.min(wrap.width - tooltip.offsetWidth - 8, localX + 10))}px`;
    tooltip.style.top = `${Math.max(4, localY - tooltip.offsetHeight - 10)}px`;
  }
  function hideTooltip() { $("#chart-tooltip").hidden = true; }
  function renderRoute(focusHeading = false) {
    const raw = location.hash.slice(1);
    const match = raw.match(/^astronaut\/([a-z0-9-]+)$/);
    const person = match && PROFILES.find((profile) => profile.id === match[1]);
    const detail = Boolean(person);
    if (raw && raw !== "crew" && !detail) history.replaceState(null, "", `${location.pathname}${location.search}#crew`);
    if (!raw) history.replaceState(null, "", `${location.pathname}${location.search}#crew`);
    const nextProfile = detail ? person.id : state.profileId;
    const profileChanged = detail && state.profileId !== nextProfile;
    state.profileId = nextProfile;
    if (profileChanged) { state.metricId = "heartRate"; state.days = 30; state.region = null; state.hoverRegion = null; state.focusRegion = null; }
    $("#crew-view").hidden = detail;
    $("#detail-view").hidden = !detail;
    if (detail) {
      if (profileChanged || !$("#detail-title").textContent) { renderProfile(); renderMetrics(); renderChart(); renderBody(); }
      document.title = `ASTRA Health · ${person.name}`;
    } else document.title = "ASTRA Health · Crew wellness";
    if (focusHeading) {
      const heading = detail ? $("#detail-title") : $("#crew-title");
      window.scrollTo(0, 0); heading.focus({ preventScroll: true });
    }
  }

  $("#environment-label").textContent = `ENVIRONMENT · ${ENVIRONMENT.toUpperCase()}`;

  function bindEvents() {
    window.addEventListener("hashchange", () => renderRoute(true));
    $("#crew-grid").addEventListener("click", (event) => { const button = event.target.closest("[data-profile-route]"); if (button) location.hash = `#astronaut/${button.dataset.profileRoute}`; });
    $$("[data-route]").forEach((button) => button.addEventListener("click", () => { location.hash = button.dataset.route; }));
    $("#metric-grid").addEventListener("click", (event) => { const button = event.target.closest("[data-metric]"); if (button) setMetric(button.dataset.metric); });
    $$("[data-days]").forEach((button) => button.addEventListener("click", () => { state.days = Number(button.dataset.days); renderChart(); }));
    $(".body-art").addEventListener("click", (event) => {
      const button = event.target.closest(".body-target"); if (!button) return;
      selectRegion(button.dataset.region);
    });
    $(".body-art").addEventListener("pointerover", (event) => { const button = event.target.closest(".body-target"); if (button) { state.hoverRegion = button.dataset.region; renderBody(); } });
    $(".body-art").addEventListener("pointerout", (event) => { const from = event.target.closest(".body-target"); const to = event.relatedTarget && event.relatedTarget.closest ? event.relatedTarget.closest(".body-target") : null; if (from && from !== to) { state.hoverRegion = null; renderBody(); } });
    $(".body-art").addEventListener("focusin", (event) => { const button = event.target.closest(".body-target"); if (button) { state.focusRegion = button.dataset.region; renderBody(); } });
    $(".body-art").addEventListener("focusout", (event) => { const from = event.target.closest(".body-target"); const to = event.relatedTarget && event.relatedTarget.closest ? event.relatedTarget.closest(".body-target") : null; if (from && from !== to) { state.focusRegion = null; renderBody(); } });
    const chart = $("#trend-chart");
    chart.addEventListener("pointermove", (event) => {
      const rect = chart.getBoundingClientRect(); const svgX = (event.clientX - rect.left) * 700 / rect.width;
      const index = Math.round((svgX - 54) * (state.days - 1) / (700 - 54 - 16));
      showTooltip(index, event.clientX, event.clientY);
    });
    chart.addEventListener("pointerleave", () => { if (Date.now() - state.lastTouchAt > 700) hideTooltip(); });
    chart.addEventListener("focusin", (event) => { const target = event.target.closest("[data-point]"); if (target) { const rect = chart.getBoundingClientRect(); showTooltip(Number(target.dataset.point), rect.left + rect.width / 2, rect.top + 8); } });
    chart.addEventListener("focusout", hideTooltip);
    chart.addEventListener("touchstart", (event) => { state.lastTouchAt = Date.now(); if (event.touches.length) { const touch = event.touches[0]; const rect = chart.getBoundingClientRect(); const svgX = (touch.clientX - rect.left) * 700 / rect.width; const index = Math.round((svgX - 54) * (state.days - 1) / (700 - 54 - 16)); showTooltip(index, touch.clientX, touch.clientY); } }, { passive: true });
  }

  renderCrew();
  bindEvents();
  initializeBodyHighlighter();
  renderRoute(false);
})();
