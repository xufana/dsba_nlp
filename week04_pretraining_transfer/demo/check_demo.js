/* Check the built demo page in headless Chrome over the DevTools protocol.

   Run from week04_pretraining_transfer/demo/ after build_demo.py:
       node check_demo.js                 # checks + screenshots into check_out/
       node check_demo.js week04_demo.html check_steps.json

   Loads the page, then evaluates the steps in check_steps.json one at a time, each with its
   own timeout, so a hang is attributed to a step. The `figures` list renders the page's SVG
   schematics to PNG (light theme, 2x) into ../figures/ — the notebook embeds those, so the
   picture in the notebook and in the demo is one drawing. The steps compare the in-browser tokenizer
   and LSTM against the numbers export_demo_data.py wrote from PyTorch, click every reveal, and
   look for SVG labels that are clipped or overlap. (Chrome's --dump-dom is not usable here:
   it never returns on a page that runs a few seconds of synchronous JS during load.) */
const { spawn } = require("child_process");
const fs = require("fs");
const path = require("path");

const CH = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const PAGE = path.resolve(process.argv[2] || "week04_demo.html");
const STEPS = JSON.parse(fs.readFileSync(process.argv[3] || path.join(__dirname, "check_steps.json"), "utf8"));
const OUT = path.join(__dirname, "check_out");
fs.mkdirSync(OUT, { recursive: true });
const PORT = 9333 + Math.floor(Math.random() * 100);

const chrome = spawn(CH, ["--headless=new", "--disable-gpu", "--no-sandbox", "--hide-scrollbars", `--remote-debugging-port=${PORT}`,
  "--window-size=1400,1000", "--user-data-dir=" + path.join(OUT, "chrome-profile-" + PORT), "about:blank"], { stdio: ["ignore", "ignore", fs.openSync(path.join(OUT, "chrome.log"), "w")] });
process.on("exit", () => { try { chrome.kill("SIGKILL"); } catch (_) { } });
const sleep = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  let targets = null;
  for (let i = 0; i < 240 && !targets; i++) { await sleep(250); try { targets = await (await fetch(`http://127.0.0.1:${PORT}/json`)).json(); } catch (_) { } }
  if (!targets) { console.log("chrome did not start"); process.exit(1); }
  const page = targets.find(t => t.type === "page");
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise(r => ws.onopen = r);
  let id = 0; const pending = new Map(); const events = [];
  ws.onmessage = m => {
    const d = JSON.parse(m.data);
    if (d.id && pending.has(d.id)) { pending.get(d.id)(d); pending.delete(d.id); }
    else if (d.method) events.push(d);
  };
  const send = (method, params, timeout) => new Promise((res, rej) => {
    const i = ++id; pending.set(i, res); ws.send(JSON.stringify({ id: i, method, params: params || {} }));
    if (timeout) setTimeout(() => { if (pending.has(i)) { pending.delete(i); rej(new Error("timeout " + method)); } }, timeout);
  });
  await send("Page.enable"); await send("Runtime.enable");
  const t0 = Date.now();
  await send("Page.navigate", { url: "file://" + PAGE });
  for (let i = 0; i < 400; i++) { await sleep(100); if (events.some(e => e.method === "Page.loadEventFired")) break; }
  console.log(`loaded in ${((Date.now() - t0) / 1000).toFixed(1)}s`);
  const errs = () => events.filter(e => e.method === "Runtime.exceptionThrown").map(e => e.params.exceptionDetails.exception && e.params.exceptionDetails.exception.description || e.params.exceptionDetails.text);
  console.log("load-time exceptions:", JSON.stringify(errs().slice(0, 5)));

  for (const st of STEPS.steps || []) {
    const t = Date.now();
    try {
      const r = await send("Runtime.evaluate", { expression: `(async function(){ try { return String(await (function(){ ${st.expr} })()); } catch (e) { return "EXC " + e.message + " @ " + (e.stack || "").split("\\n")[1]; } })()`, returnByValue: true, awaitPromise: true }, st.timeout || 20000);
      const v = r.result && r.result.result ? r.result.result.value : JSON.stringify(r);
      console.log(`[${((Date.now() - t) / 1000).toFixed(2)}s] ${st.name}: ${String(v).slice(0, 4000)}`);
    } catch (e) { console.log(`[HANG] ${st.name}: ${e.message}`); break; }
  }
  const late = errs(); if (late.length) console.log("exceptions during steps:", JSON.stringify(late.slice(0, 8)));
  for (const sc of STEPS.screens || []) {
    try {
      await send("Emulation.setDeviceMetricsOverride", { width: sc.width || 1400, height: sc.height || 1000, deviceScaleFactor: 1, mobile: false });
      if (sc.expr) await send("Runtime.evaluate", { expression: sc.expr, returnByValue: true }, 20000);
      await send("Runtime.evaluate", { expression: `document.querySelector(${JSON.stringify(sc.sel)}).scrollIntoView({block:"start"}); window.scrollBy(0, ${sc.dy || -12});`, returnByValue: true }, 5000);
      await sleep(sc.wait || 400);
      const shot = await send("Page.captureScreenshot", { format: "png" }, 30000);
      fs.writeFileSync(path.join(OUT, sc.file), Buffer.from(shot.result.data, "base64"));
      console.log("screenshot", sc.file);
    } catch (e) { console.log("screenshot failed", sc.file, e.message); }
  }
  // figures for the notebook: each SVG is serialised in its state and rendered alone, light theme, on a page of its own size
  const figs = STEPS.figures || [];
  const grabbed = [];
  for (const fg of figs) {
    try {
      const r = await send("Runtime.evaluate", { expression: `(function(){ document.documentElement.setAttribute("data-theme", "light"); document.body.classList.remove("present"); ${fg.expr || ""}; const n = document.querySelector(${JSON.stringify(fg.sel)}); const d = n.closest("details"); if (d) d.open = true; redrawAll(); const sv = n.querySelector("svg") || n; const vb = sv.viewBox && sv.viewBox.baseVal; const b = n.getBoundingClientRect(); return JSON.stringify({ html: sv.outerHTML, w: vb && vb.width ? vb.width : b.width, h: vb && vb.height ? vb.height : b.height, style: document.querySelector("style").textContent, links: [...document.querySelectorAll("link")].map(l => l.outerHTML).join("") }); })()`, returnByValue: true }, 20000);
      grabbed.push({ fg, ...JSON.parse(r.result.result.value) });
    } catch (e) { console.log("figure grab failed", fg.file, e.message); }
  }
  const out = path.resolve(__dirname, STEPS.figuresDir || "../figures"); fs.mkdirSync(out, { recursive: true });
  const tmp = path.join(OUT, "fig-pages"); fs.mkdirSync(tmp, { recursive: true });
  for (const g of grabbed) {
    try {
      const pad = g.fg.pad == null ? 12 : g.fg.pad, W = Math.ceil(g.w) + 2 * pad, H = Math.ceil(g.h) + 2 * pad;
      const html = `<!doctype html><html lang="en" data-theme="light"><head><meta charset="utf-8">${g.links}<style>${g.style}</style><style>html,body{margin:0;background:var(--ground)}body{padding:${pad}px;width:${Math.ceil(g.w)}px}svg{display:block;width:${Math.ceil(g.w)}px;height:${Math.ceil(g.h)}px}</style></head><body>${g.html}</body></html>`;
      const file = path.join(tmp, g.fg.file.replace(/\.png$/, ".html")); fs.writeFileSync(file, html);
      events.length = 0;
      await send("Emulation.setDeviceMetricsOverride", { width: W, height: H, deviceScaleFactor: g.fg.scale || 2, mobile: false });
      await send("Page.navigate", { url: "file://" + file });
      for (let i = 0; i < 100; i++) { await sleep(100); if (events.some(e => e.method === "Page.loadEventFired")) break; }
      await send("Runtime.evaluate", { expression: "document.fonts ? document.fonts.ready.then(() => 1) : 1", awaitPromise: true, returnByValue: true }, 15000);
      await sleep(150);
      const shot = await send("Page.captureScreenshot", { format: "png" }, 30000);
      fs.writeFileSync(path.join(out, g.fg.file), Buffer.from(shot.result.data, "base64"));
      console.log("figure", g.fg.file, `${W}x${H} @${g.fg.scale || 2}x`);
    } catch (e) { console.log("figure failed", g.fg.file, e.message); }
  }
  ws.close(); chrome.kill("SIGKILL"); process.exit(0);
})().catch(e => { console.log("fatal", e); chrome.kill("SIGKILL"); process.exit(1); });
