const { spawn } = require("node:child_process");
const fs = require("node:fs");
const net = require("node:net");
const path = require("node:path");

const root = process.cwd();
const chromeExe = "C:/Program Files/Google/Chrome/Application/chrome.exe";
const artifactDir = path.join(root, ".artifacts");
let server, browser, cdp;

const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
async function freePort() {
  const probe = net.createServer();
  await new Promise((resolve, reject) => probe.once("error", reject).listen(0, "127.0.0.1", resolve));
  const { port } = probe.address();
  await new Promise((resolve) => probe.close(resolve));
  return port;
}
async function until(fn, label) {
  let lastError;
  for (let attempt = 0; attempt < 60; attempt++) {
    try { const value = await fn(); if (value) return value; } catch (error) { lastError = error; }
    await pause(250);
  }
  throw new Error(`Timed out waiting for ${label}: ${lastError || "no response"}`);
}
function connectCdp(url) {
  return new Promise((resolve, reject) => {
    const socket = new WebSocket(url);
    const pending = new Map();
    const events = [];
    let nextId = 0;
    socket.addEventListener("open", () => resolve({
      events,
      send(method, params = {}) {
        return new Promise((done, fail) => {
          const id = ++nextId;
          const timer = setTimeout(() => { pending.delete(id); fail(new Error(`CDP timeout: ${method}`)); }, 8000);
          pending.set(id, { done, fail, timer });
          socket.send(JSON.stringify({ id, method, params }));
        });
      },
      close() { socket.close(); }
    }));
    socket.addEventListener("error", reject);
    socket.addEventListener("message", (event) => {
      const message = JSON.parse(event.data);
      if (!message.id) { events.push(message); return; }
      if (!pending.has(message.id)) return;
      const { done, fail, timer } = pending.get(message.id);
      pending.delete(message.id); clearTimeout(timer);
      message.error ? fail(new Error(message.error.message)) : done(message.result || {});
    });
  });
}

async function main() {
  if (!fs.existsSync(chromeExe)) throw new Error(`Chrome not found at ${chromeExe}`);
  fs.mkdirSync(artifactDir, { recursive: true });
  const httpPort = await freePort();
  const debugPort = await freePort();
  const profileDir = path.join(artifactDir, `smoke-profile-${Date.now()}`);
  server = spawn("python", ["-m", "http.server", String(httpPort), "--bind", "127.0.0.1"], { cwd: root, windowsHide: true, stdio: "ignore" });
  await until(async () => (await fetch(`http://127.0.0.1:${httpPort}`)).ok, "local HTTP preview");
  browser = spawn(chromeExe, ["--headless=new", "--no-sandbox", "--disable-gpu", "--no-first-run", "--no-default-browser-check", `--remote-debugging-port=${debugPort}`, `--user-data-dir=${profileDir}`, "about:blank"], { windowsHide: true, stdio: "ignore" });
  const debug = await until(async () => fetch(`http://127.0.0.1:${debugPort}/json/version`).then((response) => response.ok ? response.json() : null), "Chrome DevTools");
  const page = await fetch(`http://127.0.0.1:${debugPort}/json/new?http://127.0.0.1:${httpPort}`, { method: "PUT" }).then((response) => response.json());
  cdp = await connectCdp(page.webSocketDebuggerUrl);
  await cdp.send("Runtime.enable");
  await cdp.send("Page.enable");
  await cdp.send("Log.enable");
  await cdp.send("Emulation.setDeviceMetricsOverride", { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false });
  const evaluate = async (expression) => {
    const response = await cdp.send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
    if (response.exceptionDetails) throw new Error(JSON.stringify(response.exceptionDetails));
    return response.result && response.result.value;
  };
  await cdp.send("Page.navigate", { url: `http://127.0.0.1:${httpPort}` });
  await until(() => evaluate("document.readyState === 'complete'"), "document load");
  const diagnostic = await evaluate("({ scripts: [...document.scripts].map(script => script.src), chart: !!document.querySelector('#trend-chart'), content: document.body.innerText.slice(0,300) })");
  if (!await evaluate("!!document.querySelector('#trend-chart circle')")) throw new Error(`Dashboard scripts did not render: ${JSON.stringify({ diagnostic, events: cdp.events })}`);
  await evaluate("window.__smokeErrors = []; window.addEventListener('error', event => window.__smokeErrors.push(event.message))");

  const initial = await evaluate("({ crew: document.querySelectorAll('.crew-card').length, metrics: document.querySelectorAll('.metric-card').length, selected: document.querySelector('#profile-name').textContent, demo: document.querySelector('.demo-stamp').innerText })");
  if (initial.crew !== 4 || initial.metrics !== 6 || initial.selected !== "Mira Chen" || !initial.demo.includes("Simulated data")) throw new Error(`Initial dashboard mismatch: ${JSON.stringify(initial)}`);

  const crew = [];
  for (const id of ["mira-chen", "elias-okafor", "sofia-alvarez", "noah-williams"]) {
    const profile = await evaluate(`document.querySelector('[data-profile="${id}"]').click(); ({ name: document.querySelector('#profile-name').textContent, note: document.querySelector('#profile-note').textContent, tooltipHidden: document.querySelector('#chart-tooltip').hidden })`);
    if (!profile.name || !profile.note || !profile.tooltipHidden) throw new Error(`Crew profile did not refresh cleanly: ${id}`);
    crew.push(profile.name);
  }
  const restingCard = await evaluate("(() => { const text=document.querySelector('[data-profile=\"noah-williams\"]').innerText; const dots=[...document.querySelector('[data-profile=\"noah-williams\"]').querySelectorAll('.state-dot')].map(dot=>dot.className); return {text,dots}; })()");
  if (!restingCard.text.includes("Stable") || !restingCard.text.includes("Resting") || !restingCard.dots.some((name) => name.includes("resting"))) throw new Error(`Health and resting badges were not both displayed: ${JSON.stringify(restingCard)}`);
  for (const metric of ["heartRate", "bloodPressure", "temperature", "sleep", "mood", "activity"]) {
    const view = await evaluate(`document.querySelector('[data-metric="${metric}"]').click(); ({ title: document.querySelector('#chart-metric-title').textContent, points: document.querySelectorAll('#trend-chart [data-point]').length, series: new Set([...document.querySelectorAll('#trend-chart [data-point]')].map(node => node.dataset.series)).size, ticks: [...document.querySelectorAll('.chart-axis-label')].map(node => node.textContent), pathCount: document.querySelectorAll('#trend-chart .chart-line').length })`);
    if (!view.points) throw new Error(`No chart samples for ${metric}`);
    if (metric === "bloodPressure" && view.series !== 2) throw new Error("Blood pressure must expose both keyboard-navigable series.");
    if (metric === "activity" && view.ticks.some((tick) => Number(tick) < 0)) throw new Error(`Activity axis has negative tick: ${view.ticks}`);
    if (metric === "sleep" && new Set(view.ticks).size !== view.ticks.length) throw new Error(`Sleep axis has duplicate labels: ${view.ticks}`);
    if (metric === "mood" && (view.ticks.join(",") !== "5,4,3,2,1" || view.pathCount !== 0)) throw new Error(`Mood must retain categorical 1–5 marks: ${JSON.stringify(view)}`);
  }
  await evaluate("document.querySelector('[data-days=\"7\"]').click()");
  const seven = await evaluate("({ label: document.querySelector('#chart-range-label').textContent, count: new Set([...document.querySelectorAll('#trend-chart [data-point]')].map(node => node.getAttribute('data-point'))).size })");
  await evaluate("document.querySelector('[data-days=\"30\"]').click()");
  const thirty = await evaluate("({ label: document.querySelector('#chart-range-label').textContent, count: new Set([...document.querySelectorAll('#trend-chart [data-point]')].map(node => node.getAttribute('data-point'))).size })");
  if (seven.count !== 7 || thirty.count !== 30) throw new Error(`Range selection mismatch: ${JSON.stringify({ seven, thirty })}`);

  await evaluate("document.querySelector('[data-region=brain]').click()");
  const selectedBrain = await evaluate("({ text: document.querySelector('#body-callout-text').textContent, brain: document.querySelector('[data-region=brain]').getAttribute('aria-pressed'), heart: document.querySelector('[data-region=heart]').getAttribute('aria-pressed') })");
  await evaluate("document.documentElement.style.scrollBehavior = 'auto'; document.querySelector('[data-region=heart]').scrollIntoView({ block: 'center', behavior: 'auto' })");
  await pause(250);
  await evaluate("window.__pointerRegions = []; document.querySelector('.body-art').addEventListener('pointerover', event => window.__pointerRegions.push(event.target.className))");
  const heartBox = await evaluate("(() => { const r = document.querySelector('[data-region=heart]').getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; })()");
  await cdp.send("Input.dispatchMouseEvent", { type: "mouseMoved", x: heartBox.x, y: heartBox.y });
  const hoveredHeart = await evaluate("({ text: document.querySelector('#body-callout-text').textContent, brain: document.querySelector('[data-region=brain]').getAttribute('aria-pressed'), heart: document.querySelector('[data-region=heart]').getAttribute('aria-pressed'), preview: document.querySelector('[data-region=heart]').classList.contains('preview') })");
  await cdp.send("Input.dispatchMouseEvent", { type: "mouseMoved", x: 20, y: 20 });
  const restoredBrain = await evaluate("({ text: document.querySelector('#body-callout-text').textContent, brain: document.querySelector('[data-region=brain]').getAttribute('aria-pressed'), heart: document.querySelector('[data-region=heart]').getAttribute('aria-pressed') })");
  if (!selectedBrain.text.includes("Self-reported") || hoveredHeart.brain !== "true" || hoveredHeart.heart !== "false" || !hoveredHeart.text.includes("Heart-associated") || restoredBrain.text !== selectedBrain.text) throw new Error(`Hover preview/restore mismatch: ${JSON.stringify({ heartBox, target: await evaluate(`document.elementFromPoint(${heartBox.x},${heartBox.y})?.outerHTML`), events: await evaluate("window.__pointerRegions"), selectedBrain, hoveredHeart, restoredBrain })}`);
  const focusPreview = await evaluate("document.querySelector('[data-region=heart]').focus(); ({ text: document.querySelector('#body-callout-text').textContent, pressed: document.querySelector('[data-region=brain]').getAttribute('aria-pressed') })");
  const focusRestore = await evaluate("document.querySelector('[data-region=heart]').blur(); ({ text: document.querySelector('#body-callout-text').textContent, pressed: document.querySelector('[data-region=brain]').getAttribute('aria-pressed') })");
  if (!focusPreview.text.includes("Heart-associated") || focusPreview.pressed !== "true" || focusRestore.text !== selectedBrain.text || focusRestore.pressed !== "true") throw new Error(`Focus preview/restore mismatch: ${JSON.stringify({ focusPreview, focusRestore })}`);
  await evaluate("document.querySelector('[data-profile=\"elias-okafor\"]').click()");
  const crewReset = await evaluate("({ text: document.querySelector('#body-callout-text').textContent, pressed: [...document.querySelectorAll('.body-target')].some(button => button.getAttribute('aria-pressed') === 'true'), preview: [...document.querySelectorAll('.body-target')].some(button => button.classList.contains('preview')) })");
  if (crewReset.text !== "Choose a highlighted region." || crewReset.pressed || crewReset.preview) throw new Error(`Crew change retained body preview: ${JSON.stringify(crewReset)}`);

  await cdp.send("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
  await pause(100);
  const mobile390 = await evaluate("({ viewport: window.innerWidth, document: document.documentElement.scrollWidth })");
  if (mobile390.document > mobile390.viewport) throw new Error(`390px viewport overflows: ${JSON.stringify(mobile390)}`);
  await evaluate("window.scrollTo(0,0)");
  const image390 = await cdp.send("Page.captureScreenshot", { format: "png" });
  fs.writeFileSync(path.join(artifactDir, "astra-correction-390.png"), Buffer.from(image390.data, "base64"));
  await cdp.send("Emulation.setDeviceMetricsOverride", { width: 320, height: 900, deviceScaleFactor: 1, mobile: true });
  await cdp.send("Emulation.setTouchEmulationEnabled", { enabled: true, maxTouchPoints: 1 });
  await pause(120);
  await evaluate("document.querySelector('[data-metric=\"bloodPressure\"]').click(); document.querySelector('[data-days=\"30\"]').click()");
  await evaluate("window.scrollTo(0,0)");
  const image320 = await cdp.send("Page.captureScreenshot", { format: "png" });
  fs.writeFileSync(path.join(artifactDir, "astra-correction-320.png"), Buffer.from(image320.data, "base64"));
  await evaluate("document.documentElement.style.scrollBehavior = 'auto'; document.querySelector('#trend-chart').scrollIntoView({ block: 'center', behavior: 'auto' })");
  await pause(100);
  await evaluate("window.__touchEvents=[]; const svg=document.querySelector('#trend-chart'); for(const type of ['pointerover','pointermove','pointerdown']) svg.addEventListener(type,event => { const p=svg.createSVGPoint(); p.x=event.clientX; p.y=event.clientY; const x=p.matrixTransform(svg.getScreenCTM().inverse()).x; window.__touchEvents.push({event:type,type:event.pointerType,x:event.clientX,y:event.clientY,vx:x,index:Math.round((x-44)*29/(700-44-13)),tip:document.querySelector('#chart-tooltip').innerText}) })");
  const touchStart = await evaluate("(() => { const svg = document.querySelector('#trend-chart'); const r = svg.getBoundingClientRect(); const mark = svg.querySelector('[data-point=\"14\"][data-series=\"0\"]'); const m = mark.getBoundingClientRect(); const x = m.left + m.width / 2 + 6; const y = m.top + m.height / 2 + 5; const pointer=svg.createSVGPoint(); pointer.x=x; pointer.y=y; const vx=pointer.matrixTransform(svg.getScreenCTM().inverse()).x; const index = Math.max(0, Math.min(29, Math.round((vx-44)*29/(700-44-13)))); const date = AstraData.getSeries('elias-okafor','bloodPressure',30)[index].date; return {x,y,index,date:new Intl.DateTimeFormat('en',{month:'short',day:'numeric',timeZone:'UTC'}).format(new Date(date+'T00:00:00Z')), width:r.width, markWidth:m.width}; })()");
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: touchStart.x, y: touchStart.y, id: 1, radiusX: 1, radiusY: 1, force: 1 }] });
  const touchEvents = await evaluate("window.__touchEvents");
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  const bpTooltip = await evaluate("({ hidden: document.querySelector('#chart-tooltip').hidden, text: document.querySelector('#chart-tooltip').innerText, overflow: document.documentElement.scrollWidth - window.innerWidth })");
  if (bpTooltip.hidden || !bpTooltip.text.includes(touchStart.date) || !bpTooltip.text.includes("Systolic:") || !bpTooltip.text.includes("Diastolic:")) throw new Error(`Off-mark touch did not expose paired BP values: ${JSON.stringify({ touchStart, touchEvents, bpTooltip })}`);
  await evaluate("document.querySelector('[data-metric=\"activity\"]').click()");
  const activityPoint = await evaluate("(() => { const svg=document.querySelector('#trend-chart'); const r=svg.getBoundingClientRect(); const mark=svg.querySelector('[data-point=\"16\"]'); const m=mark.getBoundingClientRect(); const x=m.left+m.width/2+6; const y=r.top+r.height*.52; const pointer=svg.createSVGPoint(); pointer.x=x; pointer.y=y; const vx=pointer.matrixTransform(svg.getScreenCTM().inverse()).x; const index=Math.max(0,Math.min(29,Math.round((vx-44)*29/(700-44-13)))); const date=AstraData.getSeries('elias-okafor','activity',30)[index].date; return {x,y,index,date:new Intl.DateTimeFormat('en',{month:'short',day:'numeric',timeZone:'UTC'}).format(new Date(date+'T00:00:00Z')),width:r.width}; })()");
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: activityPoint.x, y: activityPoint.y, id: 2, radiusX: 1, radiusY: 1, force: 1 }] });
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  const activityTooltip = await evaluate("({ hidden: document.querySelector('#chart-tooltip').hidden, text: document.querySelector('#chart-tooltip').innerText, viewport: window.innerWidth, document: document.documentElement.scrollWidth })");
  if (activityTooltip.hidden || !activityTooltip.text.includes(activityPoint.date) || activityTooltip.document > activityTooltip.viewport) throw new Error(`Off-mark touch failed on activity chart: ${JSON.stringify({ activityPoint, activityTooltip })}`);

  const runtimeErrors = cdp.events.filter((event) => event.method === "Runtime.exceptionThrown" || (event.method === "Log.entryAdded" && event.params.entry.level === "error"));
  const pageErrors = await evaluate("window.__smokeErrors");
  if (runtimeErrors.length || pageErrors.length) throw new Error(`Browser errors: ${JSON.stringify({ runtimeErrors, pageErrors })}`);
  console.log(JSON.stringify({ status: "PASS", chrome: debug.Browser, initial, crew, restingCard, periods: { seven, thirty }, bodyPreview: { selectedBrain, hoveredHeart, restoredBrain, focusPreview, focusRestore, crewReset }, mobile: { at390: mobile390, at320: { viewport: activityTooltip.viewport, document: activityTooltip.document } }, touch: { viewport: 320, bloodPressure: { touchStart, result: bpTooltip.text }, activity: { activityPoint, result: activityTooltip.text } }, browserErrors: [] }, null, 2));
}

main().catch((error) => { console.error(error.stack || error); process.exitCode = 1; }).finally(async () => {
  if (cdp) { try { await cdp.send("Browser.close"); } catch {} cdp.close(); }
  if (browser && !browser.killed) browser.kill();
  if (server && !server.killed) server.kill();
});
