(function () {
  "use strict";

  const { METRICS, PROFILES, getProfile, getSeries, latest, formatValue } = window.AstraData;
  const state = { profileId: PROFILES[0].id, metricId: "heartRate", days: 30, region: null, hoverRegion: null, focusRegion: null, lastTouchAt: 0 };
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));
  const esc = (value) => String(value).replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]);

  const iconPaths = {
    pulse: '<path d="M2 9h4l2-5 4 12 3-7 2 3h5"/>',
    pressure: '<path d="M4 16a8 8 0 1 1 16 0"/><path d="m12 12 4-3M7 17h10"/>',
    temperature: '<path d="M14 14.8V5a2 2 0 0 0-4 0v9.8a4 4 0 1 0 4 0Z"/><path d="M12 10v7"/>',
    sleep: '<path d="M18 15.5A7.5 7.5 0 0 1 8.5 6 7.5 7.5 0 1 0 18 15.5Z"/><path d="M16 4v4m-2-2h4"/>',
    mood: '<circle cx="12" cy="12" r="9"/><path d="M8 14s1.5 2 4 2 4-2 4-2M9 9h.01M15 9h.01"/>',
    activity: '<path d="M3 12h4l2-6 4 12 3-8 2 2h3"/>'
  };
  const toneFor = (profile) => profile.health === "warning" ? "warning" : profile.health === "alert" ? "alert" : "stable";
  const healthLabel = (status) => ({ stable: "Stable", warning: "Monitoring", alert: "Simulated alert" })[status];
  const regionDescriptions = {
    heart: "Heart-associated navigation: heart rate and paired blood pressure history.",
    brain: "Self-reported sleep and mood history; these are not brain measurements.",
    body: "Whole-body navigation: temperature and logged activity history."
  };

  function renderCrew() {
    $("#crew-list").innerHTML = PROFILES.map((person) => {
      return `<button class="crew-card" type="button" data-profile="${esc(person.id)}" aria-pressed="${person.id === state.profileId}">
        <span class="avatar avatar-${esc(person.color)}">${esc(person.initials)}</span><span class="crew-card-copy"><strong>${esc(person.name)}</strong><small>${esc(person.role.split(" · ")[0])}</small><span class="mini-status"><span class="health-mini"><i class="state-dot ${toneFor(person)}"></i>${esc(healthLabel(person.health))}</span><span class="activity-mini"><i class="state-dot ${person.activity === "resting" ? "resting" : "active-state"}"></i>${person.activity === "resting" ? "Resting" : "Active"}</span></span></span>
      </button>`;
    }).join("");
  }

  function renderProfile() {
    const person = getProfile(state.profileId);
    const healthBadge = $("#health-badge");
    $("#greeting-name").textContent = person.name.split(" ")[0];
    $("#profile-avatar").className = `avatar avatar-${person.color}`;
    $("#profile-avatar").textContent = person.initials;
    $("#profile-name").textContent = person.name;
    $("#profile-role").textContent = person.role;
    $("#profile-note").textContent = person.note;
    healthBadge.className = `status-badge ${toneFor(person)}`;
    healthBadge.textContent = "● " + healthLabel(person.health);
    $$(".crew-card").forEach((button) => button.setAttribute("aria-pressed", String(button.dataset.profile === person.id)));
  }

  function metricStatusText(person) {
    return person.health === "alert" ? "Simulated alert scenario" : person.health === "warning" ? "Monitoring scenario" : "Stable scenario";
  }

  function renderMetrics() {
    const person = getProfile(state.profileId);
    $("#metric-grid").innerHTML = METRICS.map((metric) => {
      const value = latest(person.id, metric.id);
      const valueLabel = metric.id === "mood" ? `${value} / 5` : `${formatValue(metric.id, value)} <span>${esc(metric.unit)}</span>`;
      return `<button class="metric-card" type="button" data-metric="${metric.id}" aria-pressed="${metric.id === state.metricId}" aria-label="${esc(metric.label)}: ${esc(formatValue(metric.id, value))} ${esc(metric.unit)}. ${esc(metricStatusText(person))}. Select to view trend.">
        <span class="metric-card-top"><span>${esc(metric.label)}</span><span class="metric-icon" aria-hidden="true"><svg viewBox="0 0 24 24">${iconPaths[metric.icon]}</svg></span></span>
        <span class="metric-value"><strong>${valueLabel}</strong></span>
        <span class="metric-note"><i class="state-dot ${toneFor(person)}"></i>${esc(metricStatusText(person))}</span>
      </button>`;
    }).join("");
  }

  function selectedMetric() { return METRICS.find((metric) => metric.id === state.metricId); }
  function displayDate(date) {
    const parsed = new Date(date + "T00:00:00Z");
    return new Intl.DateTimeFormat("en", { month: "short", day: "numeric", timeZone: "UTC" }).format(parsed);
  }
  function seriesParts(metricId, data) {
    if (metricId === "bloodPressure") return [
      { name: "Systolic", color: "#7b6ab8", values: data.map((point) => point.value.systolic), unit: "mmHg" },
      { name: "Diastolic", color: "#83a8c5", values: data.map((point) => point.value.diastolic), unit: "mmHg" }
    ];
    return [{ name: selectedMetric().label, color: metricId === "mood" ? "#7b6ab8" : metricId === "temperature" ? "#d28b5a" : metricId === "activity" ? "#5d9e8d" : metricId === "sleep" ? "#8494c6" : "#7b6ab8", values: data.map((point) => point.value), unit: selectedMetric().unit }];
  }

  function clearTooltip() { $("#chart-tooltip").hidden = true; }

  function previewRegion(region) {
    return regionDescriptions[region];
  }

  function refreshBodyCallout() {
    const preview = state.focusRegion || state.hoverRegion;
    const descriptionRegion = preview || state.region;
    $$(".body-target").forEach((button) => button.classList.toggle("preview", button.dataset.region === preview));
    $("#body-callout-text").textContent = descriptionRegion ? previewRegion(descriptionRegion) : "Choose a highlighted region.";
  }

  function tooltipFor(pointIndex, seriesIndex, eventTarget, cx, cy) {
    const person = getProfile(state.profileId);
    const metric = selectedMetric();
    const data = getSeries(person.id, metric.id, state.days);
    const value = data[pointIndex].value;
    const series = seriesParts(metric.id, data)[seriesIndex];
    const shown = metric.id === "bloodPressure"
      ? `Systolic: ${value.systolic} mmHg · Diastolic: ${value.diastolic} mmHg`
      : `${formatValue(metric.id, value)} ${metric.unit}`;
    const tooltip = $("#chart-tooltip");
    tooltip.innerHTML = `<strong>${esc(displayDate(data[pointIndex].date))}</strong><span>${esc(shown)}</span>`;
    const svg = $("#trend-chart");
    const box = svg.getBoundingClientRect();
    const wrapBox = $("#chart-wrap").getBoundingClientRect();
    const scaleX = box.width / 700;
    const scaleY = box.height / 250;
    let x = cx * scaleX;
    let y = cy * scaleY;
    if (eventTarget && eventTarget.getBoundingClientRect) {
      const targetBox = eventTarget.getBoundingClientRect();
      if (eventTarget.matches(":focus")) { x = targetBox.left - box.left + targetBox.width / 2; y = targetBox.top - box.top; }
    }
    tooltip.style.left = `${Math.max(48, Math.min(box.width - 48, x))}px`;
    tooltip.style.top = `${Math.max(20, box.top - wrapBox.top + y)}px`;
    tooltip.hidden = false;
  }

  function handleChartPlotPointer(event) {
    if (event.pointerType === "touch") state.lastTouchAt = Date.now();
    if (event.type === "pointermove" && event.pointerType === "touch") return;
    const svg = $("#trend-chart");
    const pointer = svg.createSVGPoint();
    pointer.x = event.clientX;
    pointer.y = event.clientY;
    const svgPoint = pointer.matrixTransform(svg.getScreenCTM().inverse());
    const viewX = svgPoint.x;
    const viewY = svgPoint.y;
    const left = 44, right = 13, top = 14, bottom = 34;
    if (viewX < left || viewX > 700 - right || viewY < top || viewY > 250 - bottom) {
      if (event.pointerType !== "touch") clearTooltip();
      return;
    }
    const count = state.days;
    const plotWidth = 700 - left - right;
    const pointIndex = Math.max(0, Math.min(count - 1, Math.round((viewX - left) * (count - 1) / plotWidth)));
    const person = getProfile(state.profileId);
    const metric = selectedMetric();
    const points = getSeries(person.id, metric.id, state.days);
    const values = seriesParts(metric.id, points);
    const allValues = values.flatMap((part) => part.values);
    let min = metric.id === "mood" ? 1 : Math.min(...allValues);
    let max = metric.id === "mood" ? 5 : Math.max(...allValues);
    if (min === max) { min -= 1; max += 1; }
    if (metric.id !== "mood") {
      const pad = (max - min) * .22 || 1;
      min = Math.max(0, min - pad);
      max += pad;
    }
    const plotHeight = 250 - top - bottom;
    const yValue = (value) => top + (max - value) * plotHeight / (max - min);
    const targetValue = metric.id === "bloodPressure" ? points[pointIndex].value.systolic : points[pointIndex].value;
    tooltipFor(pointIndex, 0, null, 44 + pointIndex * plotWidth / Math.max(1, count - 1), yValue(targetValue));
  }

  function renderChart() {
    clearTooltip();
    const person = getProfile(state.profileId);
    const metric = selectedMetric();
    const points = getSeries(person.id, metric.id, state.days);
    const parts = seriesParts(metric.id, points);
    const W = 700, H = 250, left = 44, right = 13, top = 14, bottom = 34;
    const plotW = W - left - right, plotH = H - top - bottom;
    const allValues = parts.flatMap((part) => part.values);
    let min = metric.id === "mood" ? 1 : Math.min(...allValues);
    let max = metric.id === "mood" ? 5 : Math.max(...allValues);
    if (min === max) { min -= 1; max += 1; }
    if (metric.id !== "mood") { const pad = (max - min) * .22 || 1; min = Math.max(0, min - pad); max += pad; }
    const x = (index) => left + index * plotW / Math.max(1, points.length - 1);
    const y = (value) => top + (max - value) * plotH / (max - min);
    let ticks = metric.id === "mood" ? [5, 4, 3, 2, 1] : Array.from({ length: 4 }, (_, index) => max - (max - min) * index / 3);
    const decimalTicks = metric.id === "sleep" || metric.id === "temperature";
    if (!decimalTicks && metric.id !== "mood") {
      const low = Math.ceil(min), high = Math.floor(max);
      const integers = Array.from({ length: Math.max(0, high - low + 1) }, (_, index) => high - index);
      ticks = integers.length > 4 ? [0, 1, 2, 3].map((index) => integers[Math.round(index * (integers.length - 1) / 3)]) : integers;
    }
    const tickLabel = (tick) => metric.id === "mood" ? String(tick) : decimalTicks ? tick.toFixed(1) : String(Math.round(tick));
    const grid = ticks.map((tick) => `<line class="chart-grid" x1="${left}" y1="${y(tick)}" x2="${W - right}" y2="${y(tick)}"/><text class="chart-axis-label" x="${left - 9}" y="${y(tick) + 3}" text-anchor="end">${tickLabel(tick)}</text>`).join("");
    const dateIndexes = [...new Set([0, Math.round((points.length - 1) / 2), points.length - 1])];
    const dates = dateIndexes.map((index) => `<text class="chart-date-label" x="${x(index)}" y="${H - 10}" text-anchor="${index === 0 ? "start" : index === points.length - 1 ? "end" : "middle"}">${displayDate(points[index].date)}</text>`).join("");
    let shapes = "";
    shapes += `<rect class="chart-hit-area" x="${left}" y="${top}" width="${plotW}" height="${plotH}" fill="transparent" aria-hidden="true"/>`;
    parts.forEach((part, partIndex) => {
      if (metric.type === "bar") {
        const baseY = top + plotH;
        const barWidth = Math.max(3, plotW / points.length * .54);
        shapes += part.values.map((value, index) => {
          const barTop = y(value);
          return `<rect class="chart-bar" tabindex="0" role="button" aria-label="${esc(displayDate(points[index].date))}: ${esc(value)} ${esc(metric.unit)}" data-point="${index}" data-series="${partIndex}" x="${x(index) - barWidth / 2}" y="${barTop}" width="${barWidth}" height="${Math.max(2, baseY - barTop)}" fill="${part.color}" opacity=".78"/>`;
        }).join("");
      } else {
        const path = part.values.map((value, index) => `${index ? "L" : "M"}${x(index).toFixed(2)},${y(value).toFixed(2)}`).join(" ");
        if (metric.type !== "mood") shapes += `<path class="chart-line" d="${path}" stroke="${part.color}"/>`;
        shapes += part.values.map((value, index) => `<circle class="chart-point" tabindex="0" role="button" aria-label="${esc(displayDate(points[index].date))}: ${esc(part.name)} ${esc(value)} ${esc(part.unit)}" data-point="${index}" data-series="${partIndex}" cx="${x(index)}" cy="${y(value)}" r="${state.days === 7 ? 3.8 : 2.7}" fill="${part.color}"/>`).join("");
      }
    });
    const svg = $("#trend-chart");
    svg.setAttribute("role", "group");
    svg.setAttribute("aria-label", `${metric.label} over the last ${state.days} days. ${metric.description}`);
    svg.innerHTML = `<g aria-hidden="true">${grid}${dates}</g><g>${shapes}</g>`;
    $("#chart-metric-title").textContent = metric.label;
    $("#chart-metric-unit").textContent = metric.unit;
    $("#chart-range-label").textContent = `LAST ${state.days} DAYS`;
    $("#chart-legend").innerHTML = parts.map((part) => `<span class="legend-item"><i class="legend-swatch ${metric.type === "bar" ? "bar" : ""}" style="--swatch:${part.color}"></i>${esc(part.name)}</span>`).join("");
    $$(".range-toggle button").forEach((button) => button.setAttribute("aria-pressed", String(Number(button.dataset.days) === state.days)));
    $$(".metric-card").forEach((button) => button.setAttribute("aria-pressed", String(button.dataset.metric === metric.id)));
  }

  function handleChartMarkPointer(event) {
    if (event.pointerType === "touch") return;
    if (event.pointerType === "mouse" && Date.now() - state.lastTouchAt < 750) return;
    const target = event.target.closest("[data-point]");
    if (!target) return;
    tooltipFor(Number(target.dataset.point), Number(target.dataset.series), target, Number(target.getAttribute("cx") || (Number(target.getAttribute("x")) + Number(target.getAttribute("width")) / 2)), Number(target.getAttribute("cy") || target.getAttribute("y")));
  }
  function handleChartFocus(event) {
    if (Date.now() - state.lastTouchAt < 750) return;
    const target = event.target.closest("[data-point]");
    if (!target) return;
    tooltipFor(Number(target.dataset.point), Number(target.dataset.series), target, Number(target.getAttribute("cx") || (Number(target.getAttribute("x")) + Number(target.getAttribute("width")) / 2)), Number(target.getAttribute("cy") || target.getAttribute("y")));
  }

  $("#trend-chart").addEventListener("pointermove", handleChartPlotPointer);
  $("#trend-chart").addEventListener("pointerdown", handleChartPlotPointer);
  $("#trend-chart").addEventListener("pointerover", handleChartMarkPointer);
  $("#trend-chart").addEventListener("pointerleave", (event) => { if (event.pointerType !== "touch") clearTooltip(); });
  $("#chart-wrap").addEventListener("focusin", handleChartFocus);
  $("#chart-wrap").addEventListener("focusout", (event) => { if (!event.currentTarget.contains(event.relatedTarget)) clearTooltip(); });

  function setRegion(region) {
    state.region = region;
    const matches = METRICS.filter((metric) => metric.region === region);
    $$(".body-target").forEach((button) => button.setAttribute("aria-pressed", String(button.dataset.region === region)));
    refreshBodyCallout();
    if (matches.length) state.metricId = matches[0].id;
    renderChart();
  }

  document.addEventListener("click", (event) => {
    const crewButton = event.target.closest("[data-profile]");
    const metricButton = event.target.closest("[data-metric]");
    const regionButton = event.target.closest("[data-region]");
    const dayButton = event.target.closest("[data-days]");
    if (crewButton) {
      state.profileId = crewButton.dataset.profile;
      state.region = null;
      state.hoverRegion = null;
      state.focusRegion = null;
      $$(".body-target").forEach((button) => button.setAttribute("aria-pressed", "false"));
      refreshBodyCallout();
      clearTooltip();
      renderProfile(); renderMetrics(); renderChart();
    } else if (metricButton) {
      state.metricId = metricButton.dataset.metric;
      state.region = selectedMetric().region;
      $$(".body-target").forEach((button) => button.setAttribute("aria-pressed", String(button.dataset.region === state.region)));
      refreshBodyCallout();
      renderChart();
    } else if (regionButton) {
      setRegion(regionButton.dataset.region);
    } else if (dayButton) {
      state.days = Number(dayButton.dataset.days);
      renderChart();
    }
  });

  $(".body-art").addEventListener("pointerover", (event) => {
    const target = event.target.closest("[data-region]");
    if (!target || target.contains(event.relatedTarget)) return;
    state.hoverRegion = target.dataset.region;
    refreshBodyCallout();
  });
  $(".body-art").addEventListener("pointerout", (event) => {
    const target = event.target.closest("[data-region]");
    if (!target || target.contains(event.relatedTarget)) return;
    state.hoverRegion = event.relatedTarget && event.relatedTarget.closest ? event.relatedTarget.closest("[data-region]")?.dataset.region || null : null;
    refreshBodyCallout();
  });
  $(".body-art").addEventListener("focusin", (event) => {
    const target = event.target.closest("[data-region]");
    if (!target) return;
    state.focusRegion = target.dataset.region;
    refreshBodyCallout();
  });
  $(".body-art").addEventListener("focusout", (event) => {
    const nextTarget = event.relatedTarget && event.relatedTarget.closest ? event.relatedTarget.closest("[data-region]") : null;
    state.focusRegion = nextTarget?.dataset.region || null;
    refreshBodyCallout();
  });

  renderCrew();
  renderProfile();
  renderMetrics();
  renderChart();
})();
