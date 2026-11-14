const { spawn } = require("node:child_process");
const fs = require("node:fs");
const net = require("node:net");
const path = require("node:path");
const { pathToFileURL } = require("node:url");

const root = process.cwd();
const chromeExe = "C:/Program Files/Google/Chrome/Application/chrome.exe";
const artifactDir = path.join(root, ".artifacts");
let server; let browser; let cdp;
const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function freePort() {
  const probe = net.createServer();
  await new Promise((resolve, reject) => probe.once("error", reject).listen(0, "127.0.0.1", resolve));
  const port = probe.address().port;
  await new Promise((resolve) => probe.close(resolve));
  return port;
}
async function until(fn, label) {
  let lastError;
  for (let attempt = 0; attempt < 60; attempt += 1) {
    try { const value = await fn(); if (value) return value; } catch (error) { lastError = error; }
    await pause(250);
  }
  throw new Error(`Timed out waiting for ${label}: ${lastError || "no response"}`);
}
function connectCdp(url) {
  return new Promise((resolve, reject) => {
    const socket = new WebSocket(url); const pending = new Map(); const events = []; let nextId = 0;
    socket.addEventListener("open", () => resolve({
      events,
      send(method, params = {}) {
        return new Promise((done, fail) => {
          const id = ++nextId; const timer = setTimeout(() => { pending.delete(id); fail(new Error(`CDP timeout: ${method}`)); }, 8000);
          pending.set(id, { done, fail, timer }); socket.send(JSON.stringify({ id, method, params }));
        });
      },
      close() { socket.close(); }
    }));
    socket.addEventListener("error", reject);
    socket.addEventListener("message", (event) => {
      const message = JSON.parse(event.data);
      if (!message.id) { events.push(message); return; }
      if (!pending.has(message.id)) return;
      const { done, fail, timer } = pending.get(message.id); pending.delete(message.id); clearTimeout(timer);
      message.error ? fail(new Error(message.error.message)) : done(message.result || {});
    });
  });
}

async function main() {
  if (!fs.existsSync(chromeExe)) throw new Error(`Chrome not found at ${chromeExe}`);
  fs.mkdirSync(artifactDir, { recursive: true });
  const httpPort = await freePort(); const debugPort = await freePort();
  const profileDir = path.join(artifactDir, `redesign-profile-${Date.now()}`);
  server = spawn("python", ["-m", "http.server", String(httpPort), "--bind", "127.0.0.1"], { cwd: root, windowsHide: true, stdio: "ignore" });
  await until(async () => (await fetch(`http://127.0.0.1:${httpPort}`)).ok, "loopback preview");
  browser = spawn(chromeExe, ["--headless=new", "--no-sandbox", "--disable-gpu", "--no-first-run", "--no-default-browser-check", `--remote-debugging-port=${debugPort}`, `--user-data-dir=${profileDir}`, "about:blank"], { windowsHide: true, stdio: "ignore" });
  const debug = await until(async () => fetch(`http://127.0.0.1:${debugPort}/json/version`).then((response) => response.ok ? response.json() : null), "Chrome DevTools");
  const page = await fetch(`http://127.0.0.1:${debugPort}/json/new?about:blank`, { method: "PUT" }).then((response) => response.json());
  cdp = await connectCdp(page.webSocketDebuggerUrl);
  await cdp.send("Runtime.enable"); await cdp.send("Page.enable"); await cdp.send("Log.enable");
  await cdp.send("Emulation.setDeviceMetricsOverride", { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false });
  const evaluate = async (expression) => {
    const response = await cdp.send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
    if (response.exceptionDetails) throw new Error(JSON.stringify(response.exceptionDetails));
    return response.result && response.result.value;
  };
  await cdp.send("Page.navigate", { url: `http://127.0.0.1:${httpPort}/#crew` });
  await until(() => evaluate("document.readyState === 'complete' && document.querySelectorAll('.crew-card').length === 4"), "crew overview");
  await evaluate("window.__smokeErrors=[]; window.addEventListener('error', event => window.__smokeErrors.push(event.message))");
  const initial = await evaluate("({hash:location.hash, count:document.querySelectorAll('.crew-card').length, visible:!document.querySelector('#crew-view').hidden, detailHidden:document.querySelector('#detail-view').hidden, cards:[...document.querySelectorAll('.crew-card')].map(card=>({name:card.querySelector('h3').textContent, metrics:card.querySelectorAll('.crew-vitals dt').length, values:card.querySelectorAll('.crew-vitals dd').length, text:card.innerText})), font:getComputedStyle(document.body).fontFamily})");
  if (initial.hash !== "#crew" || initial.count !== 4 || initial.cards.some((card) => card.metrics !== 4 || card.values !== 4) || !initial.cards.every((card) => card.text.includes("Cumulative radiation"))) throw new Error(`Crew overview mismatch: ${JSON.stringify(initial)}`);
  fs.writeFileSync(path.join(artifactDir, "redesign-overview.png"), Buffer.from((await cdp.send("Page.captureScreenshot", { format: "png" })).data, "base64"));

  const routeProfiles = [
    ["mira-chen", "Mira Chen", "38 years", "64 kg", "Female"],
    ["elias-okafor", "Elias Okafor", "42 years", "79 kg", "Male"],
    ["sofia-alvarez", "Sofia Alvarez", "35 years", "58 kg", "Female"],
    ["noah-williams", "Noah Williams", "31 years", "73 kg", "Male"]
  ];
  for (const [id, name, age, weight, sex] of routeProfiles) {
    await cdp.send("Page.navigate", { url: `http://127.0.0.1:${httpPort}/#astronaut/${id}` });
    const profile = await until(() => evaluate(`(() => { const value={name:document.querySelector('#detail-title')?.textContent, visible:!document.querySelector('#detail-view').hidden, hash:location.hash, age:document.querySelector('#profile-age').textContent, weight:document.querySelector('#profile-weight').textContent, sex:document.querySelector('#profile-sex').textContent, metrics:document.querySelectorAll('.metric-card').length}; return value.name === ${JSON.stringify(name)} && value.visible && value.hash === ${JSON.stringify(`#astronaut/${id}`)} && value.metrics === 10 ? value : null; })()`), `profile ${id}`);
    if (!profile || profile.age !== age || profile.weight !== weight || profile.sex !== sex) throw new Error(`Profile/deep link mismatch: ${id}: ${JSON.stringify(profile)}`);
    const consistency = await evaluate(`({cards:[...document.querySelectorAll('.metric-card')].map(card=>({id:card.dataset.metric, text:card.querySelector('.metric-value').innerText.trim()})), latest:Object.fromEntries(AstraData.METRICS.map(metric=>[metric.id,AstraData.formatValue(metric.id,AstraData.latest('${id}',metric.id))]))})`);
    if (consistency.cards.some((card) => !consistency.latest[card.id] || !card.text.startsWith(consistency.latest[card.id]))) throw new Error(`Latest card values disagree with data for ${id}: ${JSON.stringify(consistency)}`);
  }

  await cdp.send("Page.navigate", { url: `http://127.0.0.1:${httpPort}/#astronaut/mira-chen` });
  await until(() => evaluate("document.querySelector('#detail-title')?.textContent === 'Mira Chen'"), "reload target");
  await cdp.send("Page.reload", { ignoreCache: true });
  await until(() => evaluate("document.querySelector('#detail-title')?.textContent === 'Mira Chen' && document.querySelectorAll('.metric-card').length === 10"), "reloaded deep link");
  const fileUrl = `${pathToFileURL(path.join(root, "index.html")).href}#astronaut/noah-williams`;
  await cdp.send("Page.navigate", { url: fileUrl });
  const fileOpen = await until(() => evaluate("document.querySelector('#detail-title')?.textContent === 'Noah Williams' && document.querySelectorAll('.metric-card').length === 10 ? ({protocol:location.protocol, metrics:document.querySelectorAll('.metric-card').length, styles:getComputedStyle(document.body).backgroundColor}) : null"), "direct file deep link");
  if (fileOpen.protocol !== "file:" || fileOpen.metrics !== 10) throw new Error(`Direct file route failed: ${JSON.stringify(fileOpen)}`);

  await cdp.send("Page.navigate", { url: `http://127.0.0.1:${httpPort}/#astronaut/noah-williams` });
  await until(() => evaluate("document.querySelector('#detail-title')?.textContent === 'Noah Williams'"), "Noah detail");
  await evaluate("document.querySelector('#back-to-crew').click()");
  await until(() => evaluate("location.hash === '#crew' && !document.querySelector('#crew-view').hidden"), "back to overview");
  await cdp.send("Page.navigate", { url: `http://127.0.0.1:${httpPort}/#astronaut/mira-chen` });
  await until(() => evaluate("document.querySelector('#detail-title')?.textContent === 'Mira Chen'"), "Mira detail");
  await cdp.send("Page.navigate", { url: `http://127.0.0.1:${httpPort}/#not-a-route` });
  await until(() => evaluate("location.hash === '#crew' && !document.querySelector('#crew-view').hidden"), "invalid route fallback");
  await cdp.send("Page.navigate", { url: `http://127.0.0.1:${httpPort}/#crew` });
  await evaluate(`document.querySelector('a[href="#astronaut/elias-okafor"]').click()`);
  await until(() => evaluate("location.hash === '#astronaut/elias-okafor' && document.querySelector('#detail-title')?.textContent === 'Elias Okafor'"), "card navigation");
  await cdp.send("Page.navigate", { url: "about:blank" });
  await cdp.send("Page.navigate", { url: `http://127.0.0.1:${httpPort}/#astronaut/mira-chen` });
  await until(() => evaluate("document.querySelector('#detail-title')?.textContent === 'Mira Chen'"), "history start");
  await evaluate("location.hash='#astronaut/sofia-alvarez'");
  await until(() => evaluate("document.querySelector('#detail-title')?.textContent === 'Sofia Alvarez'"), "forward route");
  await evaluate("history.back()");
  await until(() => evaluate("location.hash === '#astronaut/mira-chen' && document.querySelector('#detail-title')?.textContent === 'Mira Chen'"), "browser back");
  await evaluate("history.forward()");
  await until(() => evaluate("location.hash === '#astronaut/sofia-alvarez' && document.querySelector('#detail-title')?.textContent === 'Sofia Alvarez'"), "browser forward");

  const metricIds = ["heartRate", "bloodPressure", "temperature", "sleep", "mood", "activity", "spo2", "glucose", "stress", "radiation"];
  const metrics = [];
  for (const id of metricIds) {
    const view = await evaluate(`document.querySelector('[data-metric="${id}"]').click(); ({title:document.querySelector('#chart-metric-title').textContent, points:document.querySelectorAll('#trend-chart [data-point]').length, bpSeries:document.querySelectorAll('#trend-chart .chart-line').length, selected:document.querySelector('[data-metric="${id}"]').getAttribute('aria-pressed'), tooltipHidden:document.querySelector('#chart-tooltip').hidden})`);
    if (!view.points || view.selected !== "true" || !view.tooltipHidden) throw new Error(`Metric/chart did not update cleanly: ${id} ${JSON.stringify(view)}`);
    if (id === "bloodPressure" && view.bpSeries !== 2) throw new Error("Blood pressure chart must keep systolic and diastolic series distinct.");
    metrics.push(id);
  }
  await evaluate(`document.querySelector('[data-days="7"]').click()`);
  const seven = await evaluate("({label:document.querySelector('#chart-range-label').textContent, count:document.querySelectorAll('#trend-chart [data-point]').length})");
  await evaluate(`document.querySelector('[data-days="30"]').click()`);
  const thirty = await evaluate("({label:document.querySelector('#chart-range-label').textContent, count:document.querySelectorAll('#trend-chart [data-point]').length})");
  if (seven.count !== 7 || thirty.count !== 30) throw new Error(`Range selection mismatch: ${JSON.stringify({ seven, thirty })}`);

  await evaluate(`document.querySelector('[data-region="brain"]').click()`);
  const selectedBrain = await evaluate(`({text:document.querySelector('#body-callout-text').textContent, pressed:document.querySelector('[data-region="brain"]').getAttribute('aria-pressed'), metric:document.querySelector('#chart-metric-title').textContent})`);
  if (!selectedBrain.text.includes("Self-reported") || selectedBrain.pressed !== "true" || selectedBrain.metric !== "Sleep") throw new Error(`Body map click did not select related signals: ${JSON.stringify(selectedBrain)}`);
  const heartRect = await evaluate(`(() => { const r=document.querySelector('[data-region="heart"]').getBoundingClientRect(); return {x:r.left+r.width/2,y:r.top+r.height/2}; })()`);
  await cdp.send("Input.dispatchMouseEvent", { type: "mouseMoved", x: heartRect.x, y: heartRect.y });
  const hovered = await evaluate(`({text:document.querySelector('#body-callout-text').textContent, brain:document.querySelector('[data-region="brain"]').getAttribute('aria-pressed'), preview:document.querySelector('[data-region="heart"]').classList.contains('preview')})`);
  await cdp.send("Input.dispatchMouseEvent", { type: "mouseMoved", x: 12, y: 12 });
  const restored = await evaluate("document.querySelector('#body-callout-text').textContent");
  if (!hovered.text.includes("Heart-associated") || hovered.brain !== "true" || !hovered.preview || restored !== selectedBrain.text) throw new Error(`Body hover preview did not restore selected region: ${JSON.stringify({ selectedBrain, hovered, restored })}`);
  const focusPreview = await evaluate(`document.querySelector('[data-region="lungs"]').focus(); ({text:document.querySelector('#body-callout-text').textContent, selected:document.querySelector('[data-region="brain"]').getAttribute('aria-pressed')})`);
  const focusRestore = await evaluate(`document.querySelector('[data-region="lungs"]').blur(); document.querySelector('#body-callout-text').textContent`);
  if (!focusPreview.text.includes("SpO₂") || focusPreview.selected !== "true" || focusRestore !== selectedBrain.text) throw new Error("Body-map keyboard focus preview did not restore the selected description.");

  await cdp.send("Emulation.setDeviceMetricsOverride", { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false });
  await evaluate("window.scrollTo(0,0)");
  fs.writeFileSync(path.join(artifactDir, "redesign-detail.png"), Buffer.from((await cdp.send("Page.captureScreenshot", { format: "png" })).data, "base64"));
  const overflows = [];
  for (const width of [1440, 390, 320]) {
    await cdp.send("Emulation.setDeviceMetricsOverride", { width, height: width === 1440 ? 1000 : 900, deviceScaleFactor: 1, mobile: width < 760 });
    const size = await evaluate("({viewport:window.innerWidth, document:document.documentElement.scrollWidth, body:document.body.scrollWidth})");
    if (size.document > size.viewport || size.body > size.viewport) throw new Error(`Horizontal overflow at ${width}px: ${JSON.stringify(size)}`);
    overflows.push({ width, ...size });
  }
  await cdp.send("Emulation.setEmulatedMedia", { features: [{ name: "prefers-reduced-motion", value: "reduce" }] });
  const reducedMotion = await evaluate("({matches:matchMedia('(prefers-reduced-motion: reduce)').matches, scrollBehavior:getComputedStyle(document.documentElement).scrollBehavior})");
  if (!reducedMotion.matches || reducedMotion.scrollBehavior !== "auto") throw new Error(`Reduced-motion preference was not respected: ${JSON.stringify(reducedMotion)}`);

  await cdp.send("Emulation.setDeviceMetricsOverride", { width: 320, height: 900, deviceScaleFactor: 1, mobile: true });
  await cdp.send("Emulation.setTouchEmulationEnabled", { enabled: true, maxTouchPoints: 1 });
  await evaluate(`document.querySelector('[data-metric="bloodPressure"]').click(); document.querySelector('[data-days="30"]').click(); window.scrollTo(0,0)`);
  await evaluate("document.querySelector('#trend-chart').scrollIntoView({block:'center',behavior:'auto'})");
  const touchPoint = await evaluate("(() => { const svg=document.querySelector('#trend-chart'); const r=svg.getBoundingClientRect(); const x=r.left+r.width*.59; const y=r.top+r.height*.48; const index=Math.max(0,Math.min(29,Math.round(((x-r.left)*700/r.width-54)*29/(700-54-16)))); const date=AstraData.getSeries('sofia-alvarez','bloodPressure',30)[index].date; return {x,y,index,date:new Intl.DateTimeFormat('en',{month:'short',day:'numeric',timeZone:'UTC'}).format(new Date(date+'T00:00:00Z')),pointCenters:[...svg.querySelectorAll('[data-point]')].map(node=>{const b=node.getBoundingClientRect();return b.left+b.width/2})}; })()");
  if (touchPoint.pointCenters.some((center) => Math.abs(center - touchPoint.x) < 2)) throw new Error("Touch test point unexpectedly overlaps an explicit chart mark.");
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: touchPoint.x, y: touchPoint.y, id: 1, radiusX: 1, radiusY: 1, force: 1 }] });
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  const touchTooltip = await evaluate("({hidden:document.querySelector('#chart-tooltip').hidden,text:document.querySelector('#chart-tooltip').textContent,overflow:document.documentElement.scrollWidth-window.innerWidth})");
  if (touchTooltip.hidden || !touchTooltip.text.includes(touchPoint.date) || !touchTooltip.text.includes("Systolic:") || !touchTooltip.text.includes("Diastolic:") || touchTooltip.overflow > 0) throw new Error(`Plot-wide touch did not show the nearest paired BP value: ${JSON.stringify({ touchPoint, touchTooltip })}`);
  await evaluate("window.scrollTo(0,0)");
  fs.writeFileSync(path.join(artifactDir, "redesign-mobile.png"), Buffer.from((await cdp.send("Page.captureScreenshot", { format: "png" })).data, "base64"));

  const runtimeErrors = cdp.events.filter((event) => event.method === "Runtime.exceptionThrown" || (event.method === "Log.entryAdded" && event.params.entry.level === "error"));
  const pageErrors = await evaluate("window.__smokeErrors || []");
  if (runtimeErrors.length || pageErrors.length) throw new Error(`Browser errors: ${JSON.stringify({ runtimeErrors, pageErrors })}`);
  console.log(JSON.stringify({ status: "PASS", chrome: debug.Browser, overview: { count: initial.count, metricsPerCard: 4 }, profiles: routeProfiles.map((entry) => entry[1]), routing: ["valid deep links", "reload via direct URL", "invalid route fallback", "card navigation", "back", "forward"], metrics, periods: { seven, thirty }, bodyMap: { selectedBrain, hovered, focusPreview }, overflow: overflows, reducedMotion, offMarkTouch: { targetDate: touchPoint.date, tooltip: touchTooltip.text }, screenshots: [".artifacts/redesign-overview.png", ".artifacts/redesign-detail.png", ".artifacts/redesign-mobile.png"], browserErrors: [] }, null, 2));
}

main().catch((error) => { console.error(error.stack || error); process.exitCode = 1; }).finally(async () => {
  if (cdp) { try { await cdp.send("Browser.close"); } catch {} cdp.close(); }
  if (browser && !browser.killed) browser.kill();
  if (server && !server.killed) server.kill();
});
