const { spawn } = require("node:child_process");
const fs = require("node:fs");
const net = require("node:net");
const path = require("node:path");
const { pathToFileURL } = require("node:url");
const { createHash } = require("node:crypto");

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
  const vendorRoot = path.join(root, "vendor/body-highlighter-3.0.2");
  const vendorSource = fs.readFileSync(path.join(vendorRoot, "body-highlighter.cjs.js"), "utf8");
  const vendorAdapter = fs.readFileSync(path.join(vendorRoot, "body-highlighter.browser.js"), "utf8");
  const vendorLicense = fs.readFileSync(path.join(vendorRoot, "LICENSE"), "utf8");
  const vendorNotice = fs.readFileSync(path.join(vendorRoot, "NOTICE.md"), "utf8");
  const vendorHash = createHash("sha256").update(vendorSource).digest("hex");
  if (vendorHash !== "fff86f7b4d9c2753256499f55a4d7f5ba320260a03998651e3a81298c5d184ff" || !vendorNotice.includes(vendorHash)) throw new Error(`Vendored body-highlighter source hash mismatch: ${vendorHash}`);
  if (!vendorLicense.startsWith("MIT License") || !vendorLicense.includes("Copyright (c) 2020 GV79")) throw new Error("Vendored body-highlighter MIT notice is missing.");
  if (!vendorAdapter.includes("const module = { exports: {} }") || !vendorAdapter.includes("const exports = module.exports") || !vendorAdapter.includes("global.AstraBodyHighlighter") || /require\s*\(|\bimport\s+|fetch\s*\(|XMLHttpRequest|new\s+Function|\beval\s*\(/.test(vendorSource + vendorAdapter) || /sourceMappingURL/.test(vendorAdapter)) throw new Error("Vendored browser adapter has an external dependency, network API, dynamic code, or stale source-map reference.");
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
  const initial = await evaluate("({hash:location.hash, count:document.querySelectorAll('.crew-card').length, visible:!document.querySelector('#crew-view').hidden, detailHidden:document.querySelector('#detail-view').hidden, copy:document.querySelector('#crew-view').textContent.replace(/\\s+/g,' ').trim(), anchors:document.querySelectorAll('a[href]').length, education:document.querySelectorAll('.bone-panel').length, cards:[...document.querySelectorAll('.crew-card')].map(card=>({name:card.querySelector('.crew-name').textContent, button:card.querySelector('.crew-card-action')?.tagName, reads:[...card.querySelectorAll('[data-metric-readout]')].map(tile=>({id:tile.dataset.metricReadout,value:tile.querySelector('.vital-value')?.textContent.trim()||tile.querySelector('.oxygen-value')?.textContent.replace(/\\s/g,''),text:tile.innerText.trim(),status:tile.querySelector('.metric-status')?.textContent.trim()})), spark:card.querySelector('.mini-sparkline')?.getAttribute('aria-label'), oxygen:card.querySelector('.oxygen-value')?.textContent.replace(/\\s/g,''), oxygenLabel:card.querySelector('.oxygen-reading')?.getAttribute('aria-label'), text:card.innerText, surface:getComputedStyle(card).backgroundColor, avatar:getComputedStyle(card.querySelector('.avatar')).backgroundColor})), environment:document.querySelector('#environment-label').textContent,font:getComputedStyle(document.body).fontFamily})");
  if (initial.hash !== "#crew" || initial.count !== 4 || initial.anchors !== 0 || initial.education !== 0 || initial.cards.some((card) => card.button !== "BUTTON" || card.reads.length !== 5 || !card.spark.includes("Seven daily") || !card.oxygen || !card.oxygenLabel.includes("Fictional point reading") || card.text.includes("Within demo reference") || card.text.includes("Demo deviation"))) throw new Error(`Crew overview mismatch: ${JSON.stringify(initial)}`);
  const green = "rgb(22, 101, 52)"; const amber = "rgb(133, 77, 14)"; const red = "rgb(153, 27, 27)";
  const crewTiles = initial.cards.flatMap((card) => card.reads);
  if (initial.cards.some((card) => card.surface !== "rgb(23, 33, 47)" || card.avatar !== initial.cards[0].avatar) || initial.environment !== "ENVIRONMENT · MICROGRAVITY") throw new Error(`Dark neutral cards or environment context missing: ${JSON.stringify(initial)}`);
  for (const [profileId, cardIndex] of [["mira-chen",0], ["elias-okafor",1], ["sofia-alvarez",2], ["noah-williams",3]]) {
    const card = initial.cards[cardIndex];
    const trendValues = await evaluate(`AstraData.getSeries('${profileId}','heartRate',7).map(point=>point.value).join(', ')`);
    if (!card.spark.includes(trendValues)) throw new Error(`Crew heart-rate sparkline does not expose the seven daily values for ${profileId}.`);
    for (const metricId of ["heartRate", "bloodPressure", "temperature", "radiation", "spo2"]) {
      const actual = card.reads.find((tile) => tile.id === metricId)?.value;
      const expected = await evaluate(`AstraData.formatValue('${metricId}',AstraData.latest('${profileId}','${metricId}'))`);
      if (!actual || (metricId === "spo2" ? !actual.startsWith(`${expected}%`) : !actual.startsWith(expected))) throw new Error(`Crew ${metricId} value mismatch for ${profileId}: ${actual} vs ${expected}`);
    }
  }
  if (!crewTiles.some((tile) => tile.status === "Alert") || !crewTiles.some((tile) => tile.status === "Deviation") || !crewTiles.some((tile) => tile.status === "Reference")) throw new Error(`Concise non-color scenario labels missing: ${JSON.stringify(crewTiles)}`);
  if (initial.cards[3].text.includes("Resting") && initial.cards[3].reads.some((tile) => tile.status !== "Reference" && tile.id !== "spo2")) throw new Error("Resting activity must remain independent of metric scenario states.");
  fs.writeFileSync(path.join(artifactDir, "colors-overview.png"), Buffer.from((await cdp.send("Page.captureScreenshot", { format: "png" })).data, "base64"));

  const overviewViewports = [];
  for (const width of [320, 390, 768, 1024, 1280, 1440, 1920, 2560, 3840]) {
    await cdp.send("Emulation.setDeviceMetricsOverride", { width, height: [320, 1024, 3840].includes(width) ? 420 : 960, deviceScaleFactor: 1, mobile: width < 760 });
    const layout = await evaluate("(() => { const visible = node => getComputedStyle(node).display !== 'none' && node.getClientRects().length > 0; const intersects = (a,b) => a.left < b.right - 1 && a.right > b.left + 1 && a.top < b.bottom - 1 && a.bottom > b.top + 1; const overlaps = nodes => { const hits=[]; for (let i=0;i<nodes.length;i++) for (let j=i+1;j<nodes.length;j++) if(intersects(nodes[i].getBoundingClientRect(),nodes[j].getBoundingClientRect())) hits.push((nodes[i].className||nodes[i].id||nodes[i].tagName)+' / '+(nodes[j].className||nodes[j].id||nodes[j].tagName)); return hits; }; const cardParts=[...document.querySelectorAll('.crew-card')].flatMap(card=>[[...card.querySelectorAll(':scope > .crew-card-heading, :scope > .crew-statuses, :scope > .crew-vitals, :scope > .card-link')].filter(visible), [...card.querySelectorAll('.vital-tile')].filter(visible), [...card.querySelectorAll('.crew-statuses > .status-text')].filter(visible)]); const clipSelectors='#crew-view h1, #crew-view h2, .crew-identity h3, .crew-identity p, .mission-context span, .crew-statuses .status-text, .crew-vitals dt, .crew-vitals dd, .metric-status, .card-link'; const clip=[...document.querySelectorAll(clipSelectors)].filter(el=>visible(el)&&el.clientWidth&&el.scrollWidth>el.clientWidth+1).map(el=>el.className||el.textContent.trim()); const visibleItems=[...document.querySelectorAll('.site-header, #crew-view > .page-heading, #crew-view > .overview-heading, #crew-view > .crew-grid, #crew-view > .page-footer')].filter(visible); const outOfBounds=[...document.querySelectorAll('.site-header, #crew-view .page-heading, #crew-view .overview-heading, #crew-view .crew-card, #crew-view .page-footer')].filter(visible).filter(el=>{const r=el.getBoundingClientRect();return r.left < -1 || r.right > window.innerWidth+1;}).map(el=>el.className||el.id); const cardOverlap=[...document.querySelectorAll('.crew-card')].map(card=>overlaps([...card.querySelectorAll('.vital-tile')].filter(visible))).flat(); const componentOverlap=cardParts.map(overlaps).flat(); const pillOverlap=[...document.querySelectorAll('.crew-card')].map(card=>overlaps([...card.querySelectorAll('.crew-statuses > .status-text')].filter(visible))).flat(); const valueWrap=[...document.querySelectorAll('.crew-vitals dd')].filter(el=>visible(el)&&el.getBoundingClientRect().height>parseFloat(getComputedStyle(el).lineHeight)+3).map(el=>el.textContent.trim()); const context=document.querySelector('.mission-context'); const contextText=[...context.children].map(el=>el.textContent.trim()).filter(Boolean).join(' '); return {viewport:window.innerWidth,documentWidth:document.documentElement.scrollWidth,bodyWidth:document.body.scrollWidth,crewCards:document.querySelectorAll('.crew-card').length,copy:document.querySelector('#crew-view').textContent.replace(/\\s+/g,' ').trim(),contextText,contextItemsVisible:[...context.children].every(visible),missionDayVisible:[...context.children].some(el=>el.textContent.includes('MISSION DAY 184')&&visible(el)),clip,outOfBounds,cardOverlap,componentOverlap,pillOverlap,valueWrap,topLevelOverlap:overlaps(visibleItems)}; })()");
    if (layout.viewport !== width || layout.documentWidth > width || layout.bodyWidth > width || layout.crewCards !== 4 || layout.contextText !== "SIMULATED DATA · FICTIONAL ENVIRONMENT · MICROGRAVITY MISSION DAY 184" || !layout.contextItemsVisible || !layout.missionDayVisible || layout.clip.length || layout.outOfBounds.length || layout.cardOverlap.length || layout.componentOverlap.length || layout.pillOverlap.length || layout.valueWrap.length || layout.topLevelOverlap.length) throw new Error(`Crew overview layout issue at ${width}px: ${JSON.stringify(layout)}`);
    overviewViewports.push({ width, documentWidth: layout.documentWidth, cards: layout.crewCards, clipped: layout.clip.length, overlaps: layout.topLevelOverlap.length + layout.componentOverlap.length + layout.pillOverlap.length + layout.cardOverlap.length, wrappedValues: layout.valueWrap.length });
    const screenshot = await cdp.send("Page.captureScreenshot", { format: "png", captureBeyondViewport: true });
    fs.writeFileSync(path.join(artifactDir, `overview-${width}.png`), Buffer.from(screenshot.data, "base64"));
  }
  await cdp.send("Emulation.setDeviceMetricsOverride", { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false });
  await evaluate("window.scrollTo(0,0)");

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
    const consistency = await evaluate(`({cards:[...document.querySelectorAll('.metric-card')].map(card=>({id:card.dataset.metric, text:card.querySelector('.metric-value').innerText.trim(),status:card.querySelector('.metric-status').innerText,color:getComputedStyle(card).backgroundColor,height:card.getBoundingClientRect().height})), latest:Object.fromEntries(AstraData.METRICS.map(metric=>[metric.id,AstraData.formatValue(metric.id,AstraData.latest('${id}',metric.id))])), reference:document.querySelector('#metric-reference').innerText, environment:document.querySelector('#environment-label').textContent, activity:document.querySelector('#activity-status').innerText})`);
    if (consistency.cards.some((card) => !consistency.latest[card.id] || !card.text.startsWith(consistency.latest[card.id]))) throw new Error(`Latest card values disagree with data for ${id}: ${JSON.stringify(consistency)}`);
    if (consistency.cards.some((card) => ![green, amber, red].includes(card.color) || card.height < 100 || !card.status)) throw new Error(`Detail metric card lacks visible semantic surface/status: ${JSON.stringify(consistency)}`);
  if (id === "sofia-alvarez" && (consistency.cards.find((card) => card.id === "heartRate").color !== red || !consistency.reference.includes("Alert") || !consistency.reference.includes("Fictional preflight value"))) throw new Error(`Sofia's authored heart-rate scenario/reference is not surfaced: ${JSON.stringify(consistency)}`);
    if (id === "noah-williams" && (!consistency.activity.includes("Resting") || consistency.cards.some((card) => card.color !== green))) throw new Error(`Resting status must not color or mask Noah's independent metric scenarios: ${JSON.stringify(consistency)}`);
    if (consistency.environment !== "ENVIRONMENT · MICROGRAVITY" || !consistency.reference.includes("no environment-specific medical ranges are validated") || !consistency.reference.includes("do not change values or statuses")) throw new Error("Environment context must not imply validated or changing ranges.");
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
  await evaluate(`document.querySelector('[data-profile-route="elias-okafor"]').click()`);
  await until(() => evaluate("location.hash === '#astronaut/elias-okafor' && document.querySelector('#detail-title')?.textContent === 'Elias Okafor'"), "card navigation");
  await cdp.send("Page.navigate", { url: `http://127.0.0.1:${httpPort}/#crew` });
  await until(() => evaluate("!document.querySelector('#crew-view').hidden"), "keyboard card navigation setup");
  await evaluate(`document.querySelector('[data-profile-route="sofia-alvarez"]').focus()`);
  await cdp.send("Input.dispatchKeyEvent", { type: "rawKeyDown", key: "Enter", code: "Enter", windowsVirtualKeyCode: 13 });
  await cdp.send("Input.dispatchKeyEvent", { type: "char", key: "Enter", code: "Enter", text: "\r", windowsVirtualKeyCode: 13 });
  await cdp.send("Input.dispatchKeyEvent", { type: "keyUp", key: "Enter", code: "Enter", windowsVirtualKeyCode: 13 });
  await until(() => evaluate("location.hash === '#astronaut/sofia-alvarez' && document.querySelector('#detail-title')?.textContent === 'Sofia Alvarez'"), "keyboard Enter card activation");
  await cdp.send("Page.navigate", { url: `http://127.0.0.1:${httpPort}/#crew` });
  await until(() => evaluate("!document.querySelector('#crew-view').hidden"), "keyboard Space card navigation setup");
  await evaluate(`document.querySelector('[data-profile-route="noah-williams"]').focus()`);
  await cdp.send("Input.dispatchKeyEvent", { type: "rawKeyDown", key: " ", code: "Space", windowsVirtualKeyCode: 32 });
  await cdp.send("Input.dispatchKeyEvent", { type: "char", key: " ", code: "Space", text: " ", windowsVirtualKeyCode: 32 });
  await cdp.send("Input.dispatchKeyEvent", { type: "keyUp", key: " ", code: "Space", windowsVirtualKeyCode: 32 });
  await until(() => evaluate("location.hash === '#astronaut/noah-williams' && document.querySelector('#detail-title')?.textContent === 'Noah Williams'"), "keyboard Space card activation");
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

  const polygonSelections = await evaluate(`(() => {
    const polygons=[...document.querySelectorAll('#body-model polygon')];
    const minY=polygon=>{const values=polygon.getAttribute('points').trim().split(/\\s+/).map(Number);return Math.min(...values.filter((_,index)=>index%2===1&&Number.isFinite(values[index])))};
    const headIndex=polygons.findIndex(polygon=>minY(polygon)<25);
    const activate=polygon=>polygon.dispatchEvent(new MouseEvent('click',{bubbles:true}));
    if(headIndex<0||!polygons.length)return {count:polygons.length,headIndex};
    activate(polygons[headIndex]);
    const head={pressed:document.querySelector('[data-region="brain"]').getAttribute('aria-pressed'),metric:document.querySelector('#chart-metric-title').textContent};
    activate(polygons[0]);
    const chest={pressed:document.querySelector('[data-region="heart"]').getAttribute('aria-pressed'),metric:document.querySelector('#chart-metric-title').textContent,chestFill:polygons[0].style.fill,headResetFill:polygons[headIndex].style.fill};
    return {count:polygons.length,headIndex,head,chest};
  })()`);
  if (polygonSelections.count < 10 || polygonSelections.headIndex < 0 || polygonSelections.head.pressed !== "true" || polygonSelections.head.metric !== "Sleep" || polygonSelections.chest.pressed !== "true" || polygonSelections.chest.metric !== "Heart rate") throw new Error(`Library head/chest polygons did not select associated metric groups: ${JSON.stringify(polygonSelections)}`);
  await evaluate(`document.querySelector('[data-region="brain"]').click()`);
  const selectedBrain = await evaluate(`({text:document.querySelector('#body-callout-text').textContent, pressed:document.querySelector('[data-region="brain"]').getAttribute('aria-pressed'), metric:document.querySelector('#chart-metric-title').textContent, labels:[...document.querySelectorAll('.body-target')].map(button=>button.textContent.trim()), noLungs:document.querySelectorAll('[data-region="lungs"]').length===0})`);
  if (!selectedBrain.text.includes("self-reports") || selectedBrain.pressed !== "true" || selectedBrain.metric !== "Sleep" || selectedBrain.labels.join("|") !== "Brain|Heart|Whole body" || !selectedBrain.noLungs) throw new Error(`Body map control selection or labels mismatch: ${JSON.stringify(selectedBrain)}`);
  await evaluate(`(() => { const target=document.querySelector('[data-region="heart"]'); const top=target.getBoundingClientRect().top+window.scrollY; window.scrollTo({top:Math.max(0,top-300),behavior:'instant'}); })()`);
  await pause(100);
  const heartRect = await evaluate(`(() => { const r=document.querySelector('[data-region="heart"]').getBoundingClientRect(); return {x:r.left+r.width/2,y:r.top+r.height/2}; })()`);
  await cdp.send("Input.dispatchMouseEvent", { type: "mouseMoved", x: heartRect.x, y: heartRect.y });
  const hovered = await evaluate(`({text:document.querySelector('#body-callout-text').textContent, brain:document.querySelector('[data-region="brain"]').getAttribute('aria-pressed'), preview:document.querySelector('[data-region="heart"]').classList.contains('preview')})`);
  await cdp.send("Input.dispatchMouseEvent", { type: "mouseMoved", x: 12, y: 12 });
  const restored = await evaluate("document.querySelector('#body-callout-text').textContent");
  if (!hovered.text.includes("Heart-associated") || hovered.brain !== "true" || !hovered.preview || restored !== selectedBrain.text) throw new Error(`Body hover preview did not restore selected region: ${JSON.stringify({ selectedBrain, hovered, restored })}`);
  const focusPreview = await evaluate(`document.querySelector('[data-region="heart"]').focus(); ({text:document.querySelector('#body-callout-text').textContent, selected:document.querySelector('[data-region="brain"]').getAttribute('aria-pressed')})`);
  const focusRestore = await evaluate(`document.querySelector('[data-region="heart"]').blur(); document.querySelector('#body-callout-text').textContent`);
  if (!focusPreview.text.includes("Heart-associated") || focusPreview.selected !== "true" || focusRestore !== selectedBrain.text) throw new Error("Body-map keyboard focus preview did not restore the selected description.");
  await evaluate(`document.querySelector('[data-region="heart"]').focus()`);
  await cdp.send("Input.dispatchKeyEvent", { type: "rawKeyDown", key: "Enter", code: "Enter", windowsVirtualKeyCode: 13 });
  await cdp.send("Input.dispatchKeyEvent", { type: "char", key: "Enter", code: "Enter", text: "\r", windowsVirtualKeyCode: 13 });
  await cdp.send("Input.dispatchKeyEvent", { type: "keyUp", key: "Enter", code: "Enter", windowsVirtualKeyCode: 13 });
  const keyboardHeart = await until(() => evaluate(`document.querySelector('[data-region="heart"]').getAttribute('aria-pressed')==='true' ? document.querySelector('#chart-metric-title').textContent : null`), "body selector Enter activation");
  await evaluate(`document.querySelector('[data-region="body"]').focus()`);
  await cdp.send("Input.dispatchKeyEvent", { type: "rawKeyDown", key: " ", code: "Space", windowsVirtualKeyCode: 32 });
  await cdp.send("Input.dispatchKeyEvent", { type: "char", key: " ", code: "Space", text: " ", windowsVirtualKeyCode: 32 });
  await cdp.send("Input.dispatchKeyEvent", { type: "keyUp", key: " ", code: "Space", windowsVirtualKeyCode: 32 });
  const keyboardBody = await until(() => evaluate(`document.querySelector('[data-region="body"]').getAttribute('aria-pressed')==='true' ? document.querySelector('#chart-metric-title').textContent : null`), "body selector Space activation");
  if (keyboardHeart !== "Heart rate" || keyboardBody !== "Temperature") throw new Error(`Body selector keyboard activation mismatch: ${JSON.stringify({ keyboardHeart, keyboardBody })}`);
  await evaluate(`document.querySelector('[data-region="brain"]').click()`);

  await cdp.send("Emulation.setDeviceMetricsOverride", { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false });
  await evaluate("window.scrollTo(0,0)");
  fs.writeFileSync(path.join(artifactDir, "colors-detail.png"), Buffer.from((await cdp.send("Page.captureScreenshot", { format: "png" })).data, "base64"));
  const overflows = [];
  for (const width of [320, 390, 768, 1024, 1280, 1440, 1920, 2560, 3840]) {
    const height = [320, 1024, 3840].includes(width) ? 420 : 900;
    await cdp.send("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: 1, mobile: width < 760 });
    const size = await evaluate("({viewport:window.innerWidth, height:window.innerHeight, document:document.documentElement.scrollWidth, body:document.body.scrollWidth, pageHeight:document.documentElement.scrollHeight, metrics:document.querySelectorAll('.metric-card').length, mapButtons:document.querySelectorAll('.body-target').length})");
    if (size.document > size.viewport || size.body > size.viewport || size.metrics !== 10 || size.mapButtons !== 3 || size.pageHeight < size.height) throw new Error(`Detail layout/scroll failed at ${width}x${height}: ${JSON.stringify(size)}`);
    overflows.push(size);
  }
  fs.writeFileSync(path.join(artifactDir, "detail-3840x420.png"), Buffer.from((await cdp.send("Page.captureScreenshot", { format: "png", captureBeyondViewport: true })).data, "base64"));
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
  fs.writeFileSync(path.join(artifactDir, "colors-mobile.png"), Buffer.from((await cdp.send("Page.captureScreenshot", { format: "png" })).data, "base64"));

  const runtimeErrors = cdp.events.filter((event) => event.method === "Runtime.exceptionThrown" || (event.method === "Log.entryAdded" && event.params.entry.level === "error"));
  const pageErrors = await evaluate("window.__smokeErrors || []");
  if (runtimeErrors.length || pageErrors.length) throw new Error(`Browser errors: ${JSON.stringify({ runtimeErrors, pageErrors })}`);
  console.log(JSON.stringify({ status: "PASS", chrome: debug.Browser, bodyHighlighter: { version: "3.0.2", sourceSha256: vendorHash, sourceBytes: Buffer.byteLength(vendorSource), adapterBytes: Buffer.byteLength(vendorAdapter), license: "MIT" }, overview: { count: initial.count, metricsPerCard: initial.cards[0].reads.length, darkNeutralCard: true, semanticStates: crewTiles.map((tile) => tile.status), independentRestStatus: true, viewports: overviewViewports }, profiles: routeProfiles.map((entry) => entry[1]), routing: ["valid deep links", "reload via direct URL", "invalid route fallback", "full-card click", "full-card keyboard Enter/Space", "back", "forward"], metrics, periods: { seven, thirty }, bodyMap: { selectedBrain, hovered, focusPreview, polygonSelections, keyboardHeart, keyboardBody }, overflow: overflows, reducedMotion, offMarkTouch: { targetDate: touchPoint.date, tooltip: touchTooltip.text }, screenshots: [".artifacts/overview-320.png", ".artifacts/overview-390.png", ".artifacts/overview-768.png", ".artifacts/overview-1024.png", ".artifacts/overview-1440.png", ".artifacts/colors-detail.png", ".artifacts/colors-mobile.png"], browserErrors: [] }, null, 2));
}

main().catch((error) => { console.error(error.stack || error); process.exitCode = 1; }).finally(async () => {
  if (cdp) { try { await cdp.send("Browser.close"); } catch {} cdp.close(); }
  if (browser && !browser.killed) browser.kill();
  if (server && !server.killed) server.kill();
});
