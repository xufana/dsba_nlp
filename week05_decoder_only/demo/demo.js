"use strict";
const D = JSON.parse(document.getElementById("demo-data").textContent);

/* ---------------------------------------------------------------- codecs */
function b64bytes(s) { const bin = atob(s), out = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i); return out; }
function f16(s) {
  const b = b64bytes(s), u = new Uint16Array(b.buffer, b.byteOffset, b.byteLength / 2), out = new Float32Array(u.length);
  for (let i = 0; i < u.length; i++) { const h = u[i], sg = (h & 0x8000) >> 15, e = (h & 0x7c00) >> 10, f = h & 0x03ff;
    out[i] = e === 0 ? (sg ? -1 : 1) * Math.pow(2, -14) * (f / 1024) : e === 31 ? (f ? NaN : (sg ? -Infinity : Infinity)) : (sg ? -1 : 1) * Math.pow(2, e - 15) * (1 + f / 1024); }
  return out;
}
/* --------------------------------------------------------------- helpers */
const $ = (s, r) => (r || document).querySelector(s);
const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const fmt = (x, d) => x == null ? "—" : Number(x).toFixed(d === undefined ? 4 : d);
const pct = (x, d) => (100 * x).toFixed(d || 0) + "%";
const num = x => Number(x).toLocaleString("en-US");
const last = a => Array.isArray(a) ? a[a.length - 1] : a;
const NS = "http://www.w3.org/2000/svg";
function svg(w, h) { const s = document.createElementNS(NS, "svg"); s.setAttribute("viewBox", `0 0 ${w} ${h}`); s.setAttribute("width", "100%"); return s; }
const PAINT = { fill: 1, stroke: 1 };
function el(tag, attrs, text) {
  const n = document.createElementNS(NS, tag); let style = "";
  for (const k in attrs) { const v = attrs[k]; if (PAINT[k] && typeof v === "string" && v.startsWith("var(")) style += `${k}:${v};`; else n.setAttribute(k, v); }
  if (style) n.setAttribute("style", style); if (text != null) n.textContent = text; return n;
}
const TIP = $("#tip");
function tipOn(node, html) {
  node.addEventListener("pointerenter", e => { TIP.innerHTML = html; TIP.style.opacity = "1"; moveTip(e); });
  node.addEventListener("pointermove", moveTip); node.addEventListener("pointerleave", () => { TIP.style.opacity = "0"; });
}
function moveTip(e) { const pad = 14, r = TIP.getBoundingClientRect(); let x = e.clientX + pad, y = e.clientY + pad; if (x + r.width > innerWidth - 8) x = e.clientX - r.width - pad; if (y + r.height > innerHeight - 8) y = e.clientY - r.height - pad; TIP.style.left = x + "px"; TIP.style.top = y + "px"; }
function css(name) { return `var(${name})`; }

function lineChart(host, o) {
  host.innerHTML = "";
  const W = o.W || 1000, H = o.H || 340, L = o.L || 74, R = o.R || 22, T = o.T || 18, B = o.B || 52, fs = o.fs || 14;
  const s = svg(W, H); const xs = [], ys = [];
  o.series.forEach(sr => sr.x.forEach((x, i) => { if (isFinite(sr.y[i]) && sr.y[i] != null) { xs.push(x); ys.push(sr.y[i]); } }));
  (o.hlines || []).forEach(h => ys.push(h.y));
  const xlog = !!o.xlog, ylog = !!o.ylog; const tx = v => xlog ? Math.log10(v) : v, ty = v => ylog ? Math.log10(v) : v;
  let x0 = o.xmin != null ? o.xmin : Math.min(...xs), x1 = o.xmax != null ? o.xmax : Math.max(...xs);
  let y0 = o.ymin != null ? o.ymin : Math.min(...ys), y1 = o.ymax != null ? o.ymax : Math.max(...ys);
  if (o.ymin == null && !ylog) { const p = (y1 - y0) * 0.08 || 1; y0 -= p; y1 += p; }
  if (x0 === x1) { x0 -= 1; x1 += 1; }
  const X = v => L + (tx(v) - tx(x0)) / (tx(x1) - tx(x0)) * (W - L - R);
  const Y = v => H - B - (ty(v) - ty(y0)) / (ty(y1) - ty(y0)) * (H - T - B);
  const yt = o.yticks || (ylog ? logTicks(y0, y1) : linTicks(y0, y1, 5));
  const xt = o.xticks || (xlog ? logTicks(x0, x1) : linTicks(x0, x1, o.nx || 6));
  yt.forEach(v => { s.appendChild(el("line", { x1: L, x2: W - R, y1: Y(v), y2: Y(v), stroke: css("--rule") }));
    s.appendChild(el("text", { x: L - 8, y: Y(v) + fs * .35, "font-size": fs, "text-anchor": "end", fill: css("--ink-3") }, o.yfmt ? o.yfmt(v) : tickFmt(v))); });
  xt.forEach(v => { const lab = o.xlabels ? o.xlabels[v] : (o.xfmt ? o.xfmt(v) : tickFmt(v)); if (lab == null) return;
    s.appendChild(el("line", { x1: X(v), x2: X(v), y1: H - B, y2: H - B + 5, stroke: css("--rule-strong") }));
    s.appendChild(el("text", { x: X(v), y: H - B + fs + 8, "font-size": fs, "text-anchor": "middle", fill: css("--ink-3") }, lab)); });
  s.appendChild(el("line", { x1: L, x2: W - R, y1: H - B, y2: H - B, stroke: css("--rule-strong") }));
  s.appendChild(el("line", { x1: L, x2: L, y1: T, y2: H - B, stroke: css("--rule-strong") }));
  if (o.xlabel) s.appendChild(el("text", { x: (L + W - R) / 2, y: H - 6, "font-size": fs, "text-anchor": "middle", fill: css("--ink-2") }, o.xlabel));
  if (o.ylabel) s.appendChild(el("text", { x: 14, y: (T + H - B) / 2, "font-size": fs, "text-anchor": "middle", fill: css("--ink-2"), transform: `rotate(-90 14 ${(T + H - B) / 2})` }, o.ylabel));
  (o.hlines || []).forEach(h => { s.appendChild(el("line", { x1: L, x2: W - R, y1: Y(h.y), y2: Y(h.y), stroke: h.color || css("--ink-3"), "stroke-dasharray": "5 4", "stroke-width": 1.5 }));
    if (h.label) s.appendChild(el("text", { x: W - R - 4, y: Y(h.y) - 5, "font-size": fs - 1, "text-anchor": "end", fill: h.color || css("--ink-2") }, h.label)); });
  (o.vlines || []).forEach(h => { s.appendChild(el("line", { x1: X(h.x), x2: X(h.x), y1: T, y2: H - B, stroke: h.color || css("--ink-3"), "stroke-dasharray": "3 4", "stroke-width": 1.2 }));
    if (h.label) s.appendChild(el("text", { x: X(h.x) + 4, y: H - B - 6, "font-size": fs - 1, fill: h.color || css("--ink-2") }, h.label)); });
  o.series.forEach(sr => {
    const pts = sr.x.map((x, i) => [x, sr.y[i]]).filter(p => p[1] != null && isFinite(p[1]));
    if (pts.length > 1) s.appendChild(el("polyline", { points: pts.map(p => `${X(p[0]).toFixed(1)},${Y(p[1]).toFixed(1)}`).join(" "), fill: "none", stroke: sr.color || css("--ink"), "stroke-width": sr.sw || 2.2, "stroke-dasharray": sr.dash ? "6 5" : "none", "stroke-linejoin": "round" }));
    if (!sr.nodots) pts.forEach(p => { const c = el("circle", { cx: X(p[0]), cy: Y(p[1]), r: sr.r || 4, fill: sr.color || css("--ink"), stroke: sr.color || css("--ink"), "stroke-width": 2 }); if (sr.tip) tipOn(c, sr.tip(p[0], p[1])); s.appendChild(c);
      if (sr.labels) s.appendChild(el("text", { x: X(p[0]), y: Y(p[1]) - 10, "font-size": fs - 1, "text-anchor": "middle", fill: css("--ink-2") }, sr.labels[sr.x.indexOf(p[0])])); });
  });
  let lx = (o.legendX != null ? o.legendX : L + 12), ly = T + 4 + fs;
  o.series.filter(sr => sr.label).forEach(sr => { s.appendChild(el("line", { x1: lx, x2: lx + 26, y1: ly - fs * .35, y2: ly - fs * .35, stroke: sr.color || css("--ink"), "stroke-width": 2.5, "stroke-dasharray": sr.dash ? "6 5" : "none" }));
    s.appendChild(el("text", { x: lx + 34, y: ly, "font-size": fs, fill: css("--ink-2") }, sr.label)); ly += fs + 6; });
  host.appendChild(s); return { X, Y, s };
}
function linTicks(a, b, n) { const span = b - a, raw = span / n, mag = Math.pow(10, Math.floor(Math.log10(raw))); const step = [1, 2, 2.5, 5, 10].map(m => m * mag).find(st => span / st <= n + 1) || mag; const out = []; for (let v = Math.ceil(a / step) * step; v <= b + 1e-9; v += step) out.push(+v.toFixed(10)); return out; }
function logTicks(a, b) { const out = []; for (let e = Math.floor(Math.log10(a)); e <= Math.ceil(Math.log10(b)); e++) { const v = Math.pow(10, e); if (v >= a && v <= b) out.push(v); } return out; }
function tickFmt(v) { if (Math.abs(v) >= 1e6) return +(v / 1e6).toFixed(1) + "M"; if (Math.abs(v) >= 1000) return +(v / 1000).toFixed(1) + "k"; if (Math.abs(v) >= 10 || v === 0) return String(Math.round(v * 10) / 10); return String(+v.toPrecision(3)); }
function probBars(host, rows, o) {
  host.innerHTML = rows.map(r => `<div class="pbar${r.kept === false ? " cut" : ""}"><span class="lab" title="${esc(r.label)}">${esc(r.label)}</span><span class="bar"><i style="width:${(100 * r.p / (o && o.max || 1)).toFixed(1)}%${r.color ? ";background:" + r.color : ""}"></i></span><span class="v">${r.text != null ? r.text : (r.p < 0.001 ? r.p.toExponential(1) : r.p.toFixed(3))}</span></div>`).join("");
}
function makeBet(host, options, answer) {
  const h = typeof host === "string" ? $(host) : host;
  h.insertAdjacentHTML("beforeend", options.map((o, i) => `<button data-opt="${i}">${esc(o)}</button>`).join("") + `<span class="verdict"></span>`);
  const st = { pick: null, revealed: false, answer };
  h.addEventListener("click", e => { const b = e.target.closest("button[data-opt]"); if (!b || st.revealed) return; st.pick = +b.dataset.opt; $$("button[data-opt]", h).forEach(x => x.classList.toggle("pick", x === b)); });
  st.reveal = (ans) => { if (ans !== undefined) st.answer = ans; st.revealed = true; const v = $(".verdict", h);
    $$("button[data-opt]", h).forEach(x => { const i = +x.dataset.opt; x.classList.toggle("right", i === st.answer); x.classList.toggle("wrong", i === st.pick && i !== st.answer); });
    if (st.pick === null) { v.textContent = "no bet placed"; v.className = "verdict"; } else if (st.pick === st.answer) { v.textContent = "you were right"; v.className = "verdict ok"; } else { v.textContent = "not this time"; v.className = "verdict no"; }
    return st.pick === st.answer; };
  return st;
}
function reveal(btnId, outIds, noteId, bets, after) {
  $("#" + btnId).addEventListener("click", e => { (bets || []).forEach(b => b.reveal()); outIds.forEach(id => { const n = $("#" + id); if (n) n.hidden = false; }); if (noteId) $("#" + noteId).hidden = false;
    const veil = e.target.closest(".panel").querySelector(".veil"); if (veil) veil.remove(); e.target.disabled = true; e.target.textContent = "revealed";
    if (after) after();
    document.dispatchEvent(new CustomEvent("revealed", { detail: btnId })); redrawAll(); });
}
function table(host, cols, rows) {
  host.innerHTML = `<thead><tr>${cols.map(c => `<th class="${c.num ? "num" : ""}">${c.h}</th>`).join("")}</tr></thead><tbody>` +
    rows.map(r => `<tr class="${r._hl ? "hl" : ""}${r._new ? " new" : ""}">${cols.map(c => `<td class="${c.num ? "num" : ""}${c.mono ? " mono" : ""}">${c.f(r)}</td>`).join("")}</tr>`).join("") + "</tbody>";
}
const stat = (v, k) => `<div class="stat"><span class="v">${v}</span><span class="k">${k}</span></div>`;
const tok = (t, cls) => `<span class="tok ${cls || ""}">${esc(t)}</span>`;
const ck = (host, ok, text) => { $(host).innerHTML = `<b class="${ok ? "" : "no"}">${ok ? "✓" : "✗"}</b> ${esc(text)}`; };
function toggle(id, on) { const h = $("#" + id); let mode = $("button.sel", h).dataset.m; h.addEventListener("click", e => { const b = e.target.closest("button[data-m]"); if (!b) return; mode = b.dataset.m; $$("button", h).forEach(x => x.classList.toggle("sel", x === b)); on(mode); }); return () => mode; }

/* ------------------------------------------------------------------ nav */
const SECTIONS = [["hero", "The claim", null], ["stop", "Two tables", "00"], ["decoder", "The decoder, alone", "01"], ["positions", "Positions", "02"], ["cost", "One pass, or T", "03"], ["prefix", "Design first", "04"], ["reveal", "The reveal", "05"], ["end", "Where this goes", "06"]];
(function buildNav() {
  const nav = $("#nav"); nav.innerHTML = SECTIONS.map(([id, t, n]) => `<a href="#${id}" data-id="${id}"><span>${n === null ? "·" : n}</span><span>${esc(t)}</span></a>`).join("");
  const links = $$("#nav a"); const io = new IntersectionObserver(ents => { ents.forEach(e => { if (e.isIntersecting) links.forEach(a => a.classList.toggle("on", a.dataset.id === e.target.id)); }); }, { rootMargin: "-15% 0px -70% 0px" });
  SECTIONS.forEach(([id]) => { const n = document.getElementById(id); if (n) io.observe(n); });
})();
const REDRAW = [];
function redrawAll() { REDRAW.forEach(f => { try { f(); } catch (_) { } }); }
$("#btn-theme").addEventListener("click", () => { const cur = document.documentElement.getAttribute("data-theme"); const dark = cur ? cur === "dark" : matchMedia("(prefers-color-scheme: dark)").matches; document.documentElement.setAttribute("data-theme", dark ? "light" : "dark"); redrawAll(); });
$("#btn-present").addEventListener("click", e => { document.body.classList.toggle("present"); e.target.classList.toggle("on", document.body.classList.contains("present")); });
addEventListener("keydown", e => { if (/^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement.tagName)) return; if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
  const ys = SECTIONS.map(([id]) => document.getElementById(id)).filter(Boolean); const cur = ys.findIndex(n => n.getBoundingClientRect().top > 40);
  let i = e.key === "ArrowRight" ? (cur === -1 ? ys.length - 1 : cur) : Math.max(0, (cur === -1 ? ys.length : cur) - 2); i = Math.max(0, Math.min(ys.length - 1, i)); ys[i].scrollIntoView({ behavior: "smooth" }); e.preventDefault(); });

/* =============================================================== 00 two tables */
const DATA = D.data, RES = D.results, COSTS = D.costs, CLS = DATA.classes;
$("#data-split").textContent = `${num(DATA.nTrain)} train · ${num(DATA.nTest)} test · ${CLS.length} classes`;
$("#data-example").innerHTML = `<div class="order-row"><span class="k">target_text</span><span>${esc(DATA.example.text)}</span></div><div class="order-row"><span class="k">strip_text</span><span class="mono">${esc(DATA.example.stripped)}</span></div><span class="chip" style="margin-top:8px"><span class="dot c${DATA.example.label}"></span>label ${DATA.example.label} = ${esc(CLS[DATA.example.label])}</span>`;
const RES_COLS = [{ h: "model", f: r => esc(r.model) }, { h: "test acc", num: 1, f: r => `<b>${fmt(r["test acc"], 4)}</b>` }, { h: "note", mono: 1, f: r => `<span style="font-size:13.5px">${esc(r.note)}</span>` }];
const COST_COLS = [{ h: "task", f: r => `<b>${esc(r.task)}</b>` }, { h: "body", f: r => esc(r.body) }, { h: "passes / item", num: 1, f: r => esc(r["passes / item"]) }, { h: "tokens read", num: 1, f: r => esc(r["tokens read"]) }, { h: "tokens written", num: 1, f: r => esc(r["tokens written"]) },
  { h: "ms / 1 000 items", num: 1, f: r => r["ms / 1000 items"] == null ? "—" : num(Math.round(r["ms / 1000 items"])) }, { h: "quality", num: 1, f: r => `<b>${fmt(r.quality, typeof r.quality === "number" && r.quality > 1 ? 1 : 4)}</b>` }, { h: "note", mono: 1, f: r => `<span style="font-size:12.5px">${esc(r.note)}</span>` }];
/* which reveal unlocks which row: quality rows by model name, cost rows by task */
const RES_GATE = r => /week 1/.test(r.model) ? "line" : /week 4/.test(r.model) ? null : "btn-zs-reveal";
const COST_GATE = r => ({ classify: "btn-zs-reveal", "punctuation + case": "btn-punct-reveal", typos: "btn-typos-reveal", NER: "btn-ner-reveal", "extractive QA": "btn-qa-reveal" })[r.task];
const ON = new Set();
function drawTables() {
  const resVis = RES.filter(r => { const g = RES_GATE(r); return g === null || g === "line" || ON.has(g); });
  table($("#results-0"), RES_COLS, resVis.map((r, i) => Object.assign({ _hl: i === 0, _new: ON.has(RES_GATE(r)) && LAST === RES_GATE(r) }, r)));
  const costVis = COSTS.filter(r => ON.has(COST_GATE(r)));
  table($("#costs-0"), COST_COLS, costVis.map(r => Object.assign({ _new: LAST === COST_GATE(r) }, r)));
  $("#costs-0-n").textContent = costVis.length ? `${costVis.length} of ${COSTS.length} rows` : "rows appear at each reveal";
  table($("#results-1"), RES_COLS, RES.map((r, i) => Object.assign({ _hl: i === 0 }, r)));
  table($("#costs-1"), COST_COLS, COSTS);
}
let LAST = null;
drawTables();
(function scoreboard() {
  const short = m => m.replace("TF-IDF + logreg (week 1)", "TF-IDF, week 1").replace("zero-shot through [MASK], BERT (week 4)", "[MASK], week 4").replace("fine-tuned BERT, everything (week 4)", "fine-tuned BERT, week 4").replace("zero-shot scorer, GPT-2, class names as written", "scorer, class names").replace(/^zero-shot scorer, GPT-2, .*/, "scorer, one token each");
  function drawBoard() {
    $("#score").innerHTML = `<div class="t">AG News · test acc</div>` + RES.map(r => { const g = RES_GATE(r), vis = g === null || g === "line" || ON.has(g);
      return `<div class="row ${g === "line" ? "line" : vis ? "on" : "off"}"><span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(short(r.model))}</span><span class="v">${vis ? fmt(r["test acc"], 4) : "·"}</span></div>`; }).join("") +
      `<div class="t" style="margin-top:8px">cost rows</div>` + COSTS.map(r => { const vis = ON.has(COST_GATE(r)); return `<div class="row ${vis ? "on" : "off"}"><span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(r.task)} · ${esc(r.body.split(",")[0])}</span><span class="v">${vis ? (r["ms / 1000 items"] == null ? "—" : (r["ms / 1000 items"] / 1000).toFixed(1) + "s") : "·"}</span></div>`; }).join("");
  }
  drawBoard();
  document.addEventListener("revealed", e => { ON.add(e.detail); LAST = e.detail; drawTables(); drawBoard(); });
})();
$("#end-prose").innerHTML = `<p>${TXT("end-prose")}</p>`;

/* ====================================================== schematics and interactives */
const code = (host, text) => { $(host).innerHTML = text.split("\n").map(l => `<span class="ln">${esc(l)}</span>`).join(""); };
const TEXT_W = (t, fs) => String(t).length * fs * 0.61 + 14;
function box(s, x, y, w, h, label, o) { o = o || {}; let fs = o.fs || 14;
  if (label != null && label !== "") { const need = TEXT_W(label, fs);
    if (need > w) { if (o.grow) { const cx = x + w / 2; w = need; x = cx - w / 2; } else fs = Math.max(8, fs * (w - 6) / (need - 8)); } }
  const r = el("rect", { x, y, width: w, height: h, rx: o.rx == null ? 6 : o.rx, fill: "none", stroke: o.stroke || css("--rule-strong"), "stroke-width": o.sw || 1.4, "stroke-dasharray": o.dash ? "5 4" : "none" }); r.style.fill = o.fill || "var(--panel-sunk)"; s.appendChild(r);
  if (label != null) { const t = el("text", { x: x + w / 2, y: y + h / 2 + fs * .36, "font-size": fs, "text-anchor": "middle", fill: o.color || css("--ink"), "font-weight": o.bold ? "600" : "400" }, label); s.appendChild(t); if (fs < (o.fs || 14) - 2 && String(label).length > 6) tipOn(r, esc(label)); }
  r.box = { x, y, w, h }; return r; }
function txt(s, x, y, t, o) { o = o || {}; return s.appendChild(el("text", { x, y, "font-size": o.fs || 13.5, "text-anchor": o.anchor || "middle", fill: o.color || css("--ink-2"), "font-weight": o.bold ? "600" : "400", "font-style": o.italic ? "italic" : "normal" }, t)); }
function arrow(s, x1, y1, x2, y2, o) { o = o || {}; const color = o.color || css("--ink-2"), id = "arr-" + String(color).replace(/[^a-z0-9]/gi, "");
  if (!s.querySelector("#" + id)) { let defs = s.querySelector("defs"); if (!defs) { defs = el("defs", {}); s.appendChild(defs); } const m = el("marker", { id, viewBox: "0 0 10 10", refX: 9, refY: 5, markerWidth: 6, markerHeight: 6, orient: "auto-start-reverse" }); m.appendChild(el("path", { d: "M 0 0 L 10 5 L 0 10 z", fill: color })); defs.appendChild(m); }
  s.appendChild(el("path", { d: o.d || `M ${x1} ${y1} L ${x2} ${y2}`, fill: "none", stroke: color, "stroke-width": o.sw || 1.6, "stroke-dasharray": o.dash ? "4 4" : "none", "marker-end": `url(#${id})` })); }
const TINT = (v, pct) => `color-mix(in srgb, var(${v}) ${pct}%, var(--panel))`;
const SUNK = () => css("--panel-sunk");
function states(btnsId, draw) {
  let mode = $(`#${btnsId} button.sel`).dataset.m; draw(mode); REDRAW.push(() => draw(mode));
  $(`#${btnsId}`).addEventListener("click", e => { const b = e.target.closest("button[data-m]"); if (!b) return; mode = b.dataset.m; $$(`#${btnsId} button`).forEach(x => x.classList.toggle("sel", x === b)); draw(mode); });
  return m => { mode = m; $$(`#${btnsId} button`).forEach(x => x.classList.toggle("sel", x.dataset.m === m)); draw(m); };
}
const CLSC = ["--cls-0", "--cls-1", "--cls-2", "--cls-3"];

/* ---- 00 three bodies, one picture */
function figBodies() {
  const host = $("#fig-bodies"); host.innerHTML = ""; const W = 1000, H = 360, s = svg(W, H);
  const cols = [
    { x: 20, title: "encoder (week 4)", reads: "reads everything, both ways", out: "a vector per position", task: "the task lives in the head", passes: "1 pass per item", head: "head: a Linear per task", color: "--cls-0", dir: "both" },
    { x: 350, title: "encoder–decoder (week 3)", reads: "reads everything; writes left to right", out: "a distribution per position", task: "the task lives in the pair (source, target)", passes: "T_out passes per item", head: "head: the target vocabulary", color: "--cls-2", dir: "encdec" },
    { x: 680, title: "decoder-only (today)", reads: "reads left to right — the prompt too", out: "a distribution per position", task: "the task lives in the prefix", passes: "T_out passes (or one per candidate)", head: "head: the vocabulary, fixed", color: "--cls-1", dir: "left" }];
  cols.forEach(c => {
    txt(s, c.x + 150, 22, c.title, { fs: 14.5, bold: 1, color: css("--ink") });
    const bx = c.x + 40, by = 70, bw = 220, bh = 120;
    if (c.dir === "encdec") { box(s, bx, by, 100, bh, "encoder", { fill: TINT(c.color, 10), stroke: css(c.color) }); box(s, bx + 120, by, 100, bh, "decoder", { fill: TINT(c.color, 10), stroke: css(c.color) }); arrow(s, bx + 100, by + bh / 2, bx + 120, by + bh / 2, { color: css(c.color) }); txt(s, bx + 110, by + bh / 2 - 8, "cross-attn", { fs: 10.5, color: css(c.color) }); }
    else box(s, bx, by, bw, bh, c.dir === "both" ? "encoder × N" : "decoder × N", { fill: TINT(c.color, 10), stroke: css(c.color) });
    // the token row and how it is read
    const n = 6, tw = 30, tx0 = bx + (bw - n * tw) / 2 + 2;
    for (let i = 0; i < n; i++) { box(s, tx0 + i * tw, by + bh + 26, tw - 4, 22, null, { fill: css("--panel"), rx: 3 }); arrow(s, tx0 + i * tw + (tw - 4) / 2, by + bh + 26, tx0 + i * tw + (tw - 4) / 2, by + bh + 2, { color: css("--ink-3"), sw: 1 }); }
    if (c.dir === "both") { arrow(s, tx0 + 2 * tw, by + bh + 62, tx0 + 4 * tw, by + bh + 62, { color: css("--ink-3") }); arrow(s, tx0 + 4 * tw, by + bh + 70, tx0 + 2 * tw, by + bh + 70, { color: css("--ink-3") }); }
    else arrow(s, tx0, by + bh + 66, tx0 + n * tw - 4, by + bh + 66, { color: css("--ink-3") });
    txt(s, c.x + 150, by + bh + 92, c.reads, { fs: 12 });
    // what comes out
    arrow(s, bx + bw / 2, by, bx + bw / 2, by - 20, { color: css(c.color) });
    txt(s, c.x + 150, by - 26, c.out, { fs: 12.5, color: css("--ink") });
    txt(s, c.x + 150, H - 34, c.task, { fs: 13, bold: 1, color: css(c.color) });
    txt(s, c.x + 150, H - 14, c.passes, { fs: 12 });
  });
  host.appendChild(s);
}
REDRAW.push(figBodies);

/* ---- 01 the stack, two readers */
const SH = D.shapes;
function figBlock(mode) {
  const host = $("#fig-block"); host.innerHTML = ""; const W = 1000, H = 330, s = svg(W, H);
  const toks = ["Fears", "for", "T", "N", "pension", "after", "…"], n = toks.length, cw = 62, x0 = 120, yTok = H - 30;
  const gpt = mode === "gpt", color = gpt ? "--cls-1" : "--cls-0";
  box(s, x0 - 30, 84, n * cw + 60, 184, null, { fill: TINT(color, 6), stroke: css(color) });
  txt(s, x0 - 16, 100, gpt ? "GPT-2 · 12 decoder blocks, one column per position" : "BERT · 12 encoder blocks, one column per position", { anchor: "start", fs: 12.5, bold: 1, color: css(color) });
  [0, 1, 2].forEach(k => { const y = 250 - k * 52; box(s, x0, y - 40, n * cw, 20, gpt ? "masked self-attention · 12 heads" : "self-attention · 12 heads", { fill: css("--panel"), fs: 11.5 }); box(s, x0, y - 18, n * cw, 16, "FFN 768 → 3072 → 768", { fill: css("--panel"), fs: 11 }); });
  toks.forEach((t, i) => { const cx = x0 + i * cw + cw / 2; box(s, cx - 26, yTok - 14, 52, 24, t, { fill: css("--panel"), fs: 12, rx: 3 }); arrow(s, cx, yTok - 16, cx, 270, { color: css("--ink-3"), sw: 1 }); arrow(s, cx, 84, cx, 56, { color: css(color) }); });
  if (gpt) { toks.forEach((t, i) => { const cx = x0 + i * cw + cw / 2; for (let b = 0; b < 5; b++) { const h = [22, 9, 14, 5, 3][(b + i) % 5]; s.appendChild(el("rect", { x: cx - 18 + b * 7, y: 50 - h, width: 5, height: h, fill: css("--cls-1") })); } });
    txt(s, x0 + n * cw + 24, 40, "[1, 33, 50 257]", { anchor: "start", fs: 14, bold: 1, color: css("--ink") }); txt(s, x0 + n * cw + 24, 58, "a distribution over the vocabulary per token —", { anchor: "start", fs: 12 }); txt(s, x0 + n * cw + 24, 74, "the head is built in", { anchor: "start", fs: 12 });
    box(s, 8, 130, 80, 100, null, { fill: TINT("--cls-1", 14), stroke: css("--cls-1") }); txt(s, 48, 175, "wteᵀ", { fs: 14, bold: 1, color: css("--ink") }); txt(s, 48, 192, "50 257 × 768", { fs: 10.5 }); txt(s, 48, 210, "tied to the input", { fs: 10.5 });
    arrow(s, 88, 180, x0 - 30, 180, { color: css("--cls-1"), dash: 1 }); }
  else { toks.forEach((t, i) => { const cx = x0 + i * cw + cw / 2; s.appendChild(el("rect", { x: cx - 18, y: 34, width: 36, height: 18, rx: 3, fill: TINT("--cls-0", 40), stroke: css("--cls-0") })); });
    txt(s, x0 + n * cw + 24, 40, "[1, 32, 768]", { anchor: "start", fs: 14, bold: 1, color: css("--ink") }); txt(s, x0 + n * cw + 24, 58, "a vector per token — nothing to read", { anchor: "start", fs: 12 }); txt(s, x0 + n * cw + 24, 74, "until a head is attached", { anchor: "start", fs: 12 }); }
  const H2 = mode === "gpt" && n; host.appendChild(s);
  $("#fig-block-note").innerHTML = gpt ? TXT("fig-block-note-gpt", { total: num(SH.params.total), wte_m: (SH.params.wte / 1e6).toFixed(1), blocks_m: (SH.params.blocks / 1e6).toFixed(1), wpe_m: (SH.params.wpe / 1e6).toFixed(1), tied: SH.params.tied })
    : TXT("fig-block-note-bert", { total: num(SH.params.bert) });
}
states("fig-block-btns", figBlock);
probBars($("#params-bars"), [["wte — token embedding = the head", SH.params.wte, "var(--cls-1)"], ["12 blocks (attention + FFN)", SH.params.blocks, "var(--ink-3)"], ["wpe — 1 024 position rows", SH.params.wpe, "var(--cls-3)"]].map(([l, v, c]) => ({ label: l, p: v / SH.params.total, text: `${(v / 1e6).toFixed(1)}M · ${pct(v / SH.params.total)}`, color: c })), { max: 0.75 });
$("#ppl-line").textContent = `cross-entropy ${SH.ppl.loss.toFixed(3)} nats → perplexity ${SH.ppl.ppl.toFixed(1)} on ${SH.ppl.n} news texts`;

/* ---- 01 logit lens */
(function lens() {
  const DP = D.depth, L = DP.layers, agree = DP.agreement, ppl = DP.perplexity;
  const half = agree.findIndex(a => a >= 0.5);
  const bet = makeBet("#bet-lens", L.map(k => "layer " + k), half);
  REDRAW.push(() => {
    lineChart($("#lens-agree"), { W: 520, H: 300, L: 64, fs: 13, series: [{ x: L, y: agree, color: css("--cls-1"), label: "top-1 agrees with the final layer", tip: (x, y) => `layer ${x}: ${fmt(y, 3)}` }], xticks: L, xlabel: "layer (0 = embeddings)", ylabel: "share of positions", ymin: 0, ymax: 1.02, hlines: [{ y: 0.5, label: "half", color: css("--ink-3") }] });
    lineChart($("#lens-ppl"), { W: 520, H: 300, L: 74, fs: 13, ylog: 1, series: [{ x: L.slice(1), y: ppl.slice(1), color: css("--cls-0"), label: "perplexity if the model stopped here", tip: (x, y) => `layer ${x}: ${tickFmt(y)}` }], xticks: L, xlabel: "layer", ylabel: "perplexity (log)", yfmt: v => tickFmt(v) });
  });
  $("#lens-stats").innerHTML = TXT("lens-stats", { n_texts: num(DP.n_texts), n_tokens: num(DP.n_tokens), ppl_0: ppl[0].toExponential(1) });
  reveal("btn-lens-reveal", ["lens-out"], "lens-note", [bet]);
  $("#lens-note").innerHTML = TXT("lens-note", { half, agree_half: pct(agree[half]), ppl_1: num(Math.round(ppl[1])), ppl_11: num(Math.round(ppl[11])), ppl_12: num(Math.round(ppl[12])) });
  // the strip: one text, every position
  const LN = D.lens, toks = LN.tokens, T = toks.length;
  let pos = 4;
  $("#lens-toks").innerHTML = toks.map((t, i) => `<span class="tok${i === pos ? " on" : ""}${i === T - 1 ? " dim" : ""}" data-i="${i}">${esc(t)}</span>`).join("");
  function drawStrip() {
    $$("#lens-toks .tok").forEach(n => n.classList.toggle("on", +n.dataset.i === pos));
    const gold = pos + 1 < T ? toks[pos + 1] : null, rows = LN.top5[pos], finalTop = rows[LN.n_layers][0][0];
    $("#lens-pos-line").textContent = `prefix '${toks.slice(0, pos + 1).join("")}' → next token ${gold === null ? "(end)" : "'" + gold + "'"}`;
    $("#lens-strip").innerHTML = rows.map((g, k) => `<div class="col"><div class="h">layer ${k}</div>${g.map(([t, p]) => `<div class="g${t === gold ? " gold" : ""}${t === finalTop ? " same" : ""}" title="${esc(t)} ${p}">${esc(t)}<i>${p >= 0.01 ? Math.round(p * 100) + "%" : ""}</i></div>`).join("")}</div>`).join("");
  }
  $("#lens-toks").addEventListener("click", e => { const t = e.target.closest(".tok"); if (!t) return; pos = Math.min(+t.dataset.i, T - 2); drawStrip(); });
  drawStrip();
})();

/* ---- 01 attention on one prompt */
(function attention() {
  const A = D.attention, [NL, NH, T] = A.shape, P = A.n_prompt, raw = b64bytes(A.data);
  const at = (l, h, i, j) => raw[((l * NH + h) * T + i) * T + j] / A.scale;
  const lastShare = A.to_prompt.slice(8).reduce((a, b) => a + b, 0) / 4, sinkShare = A.to_first.slice(8).reduce((a, b) => a + b, 0) / 4;
  const betShare = makeBet("#bet-att-share", ["under 0.3", "about half", "0.75 or more"], lastShare < 0.4 ? 0 : lastShare < 0.65 ? 1 : 2);
  const betSink = makeBet("#bet-att-sink", ["a small part", "about half of it", "most of it"], sinkShare / lastShare < 0.35 ? 0 : sinkShare / lastShare < 0.65 ? 1 : 2);
  const cv = $("#att-canvas"), ctx = cv.getContext("2d"); cv.width = T; cv.height = T;
  let layer = 6, head = 0, sink = true;
  function draw() {
    const img = ctx.createImageData(T, T);
    for (let i = 0; i < T; i++) { const row = new Float32Array(T); let sum = 0;
      for (let j = 0; j <= i; j++) { let v = 0; if (head === 0) { for (let h = 0; h < NH; h++) v += at(layer - 1, h, i, j); v /= NH; } else v = at(layer - 1, head - 1, i, j); if (!sink && j === 0) v = 0; row[j] = v; sum += v; }
      for (let j = 0; j < T; j++) { const v = sum > 0 ? row[j] / sum : 0, t = Math.pow(Math.min(1, v * (sink ? 1 : 1)), 0.5); const k = 4 * (i * T + j); img.data[k] = 250 - 210 * t; img.data[k + 1] = 250 - 150 * t; img.data[k + 2] = 250 - 60 * t; img.data[k + 3] = j > i ? 30 : 255; } }
    ctx.putImageData(img, 0, 0);
    // the prompt boundary
    ctx.strokeStyle = "rgba(20,22,26,.8)"; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(P, 0); ctx.lineTo(P, T); ctx.moveTo(0, P); ctx.lineTo(T, P); ctx.stroke();
    $("#att-layer-v").textContent = layer; $("#att-head-v").textContent = head === 0 ? "mean of 12" : head;
  }
  $("#att-layer").addEventListener("input", e => { layer = +e.target.value; draw(); });
  $("#att-head").addEventListener("input", e => { head = +e.target.value; draw(); });
  toggle("att-sink-tgl", m => { sink = m === "on"; draw(); });
  cv.addEventListener("pointermove", e => { const r = cv.getBoundingClientRect(), i = Math.floor((e.clientY - r.top) / r.height * T), j = Math.floor((e.clientX - r.left) / r.width * T); if (i < 0 || j < 0 || i >= T || j >= T || j > i) { $("#att-cell").textContent = ""; return; }
    let v = 0; if (head === 0) { for (let h = 0; h < NH; h++) v += at(layer - 1, h, i, j); v /= NH; } else v = at(layer - 1, head - 1, i, j); $("#att-cell").textContent = `'${A.tokens[i]}' → '${A.tokens[j]}' ${v.toFixed(3)}`; });
  REDRAW.push(() => { draw(); lineChart($("#att-chart"), { W: 460, H: 300, L: 60, fs: 12.5, series: [{ x: A.to_prompt.map((_, i) => i + 1), y: A.to_prompt, color: css("--cls-0"), label: "on the prompt (32 tokens)", tip: (x, y) => `layer ${x}: ${fmt(y, 3)}` }, { x: A.to_first.map((_, i) => i + 1), y: A.to_first, color: css("--cls-1"), label: "on token 0 alone", tip: (x, y) => `layer ${x}: ${fmt(y, 3)}` }], xticks: A.to_prompt.map((_, i) => i + 1), xlabel: "layer", ylabel: "share of attention", ymin: 0, ymax: 1, hlines: [{ y: P / (T - 1), label: "the prompt's share of positions", color: css("--ink-3") }] }); });
  reveal("btn-att-reveal", ["att-out"], "att-note", [betShare, betSink]);
  $("#att-note").innerHTML = TXT("att-note", { early_lo: fmt(Math.min(...A.to_prompt.slice(0, 5)), 2), early_hi: fmt(Math.max(...A.to_prompt.slice(0, 5)), 2), late_lo: fmt(Math.min(...A.to_prompt.slice(5)), 2), late_hi: fmt(Math.max(...A.to_prompt.slice(5)), 2), sink_lo: fmt(Math.min(...A.to_first.slice(5)), 2), sink_hi: fmt(Math.max(...A.to_first.slice(5)), 2) });
})();

/* ---- 02 RoPE: the rotation, running here */
const RP = D.rope, DIM = RP.d;
function rotate(x, pos, base) { base = base || 10000; const out = new Float64Array(x.length); for (let i = 0; i < x.length / 2; i++) { const a = pos * Math.pow(base, -2 * i / x.length), c = Math.cos(a), s = Math.sin(a), x1 = x[2 * i], x2 = x[2 * i + 1]; out[2 * i] = x1 * c - x2 * s; out[2 * i + 1] = x1 * s + x2 * c; } return out; }
const dot = (a, b) => { let s = 0; for (let i = 0; i < a.length; i++) s += a[i] * b[i]; return s; };
(function ropeDials() {
  const q = RP.q, k = RP.k;
  const bad = RP.check.filter(c => Math.abs(dot(rotate(q, c.m), rotate(k, c.n)) - c.rope) > 1e-4 || (RP.tableRows[c.m] && RP.tableRows[c.n] && Math.abs(dot(q.map((v, i) => v + RP.tableRows[c.m][i]), k.map((v, i) => v + RP.tableRows[c.n][i])) - c.learned) > 1e-3));
  ck("#rope-ck", bad.length === 0, bad.length ? `${bad.length} of ${RP.check.length} pairs differ from Python` : `matches the notebook on ${RP.check.length} (m, n) pairs`);
  // a learned table for the sliders: the notebook's rows where it exported them, a seeded stand-in elsewhere (the point is the arithmetic)
  let seed = 7; const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
  const gauss = () => { const u = 1 - rnd(), v = rnd(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); };
  const TABLE = Array.from({ length: 1024 }, () => Float64Array.from({ length: DIM }, gauss));
  for (const r in RP.tableRows) TABLE[+r] = Float64Array.from(RP.tableRows[r]);
  const clocksHost = $("#rope-clocks"), CW = 800, CH = 120, s = svg(CW, CH), hands = [], R = 9;
  for (let i = 0; i < DIM / 2; i++) { const cx = 34 + i * 23.5, cy = 40; s.appendChild(el("circle", { cx, cy, r: R, fill: "none", stroke: css("--rule-strong") })); const hd = el("line", { x1: cx, y1: cy, x2: cx + R, y2: cy, stroke: css("--cls-1"), "stroke-width": 2 }); s.appendChild(hd); hands.push([hd, cx, cy]);
    if (i % 4 === 0 || i === DIM / 2 - 1) txt(s, cx, 66, "pair " + i, { fs: 10 }); }
  txt(s, CW / 2, 96, "the query at position m: pair 0 turns every 6 positions, pair 31 once every 47 117", { fs: 12 });
  clocksHost.appendChild(s);
  const sl = { m: $("#rope-m"), n: $("#rope-n"), s: $("#rope-s") };
  let lastL = null, lastR = null;
  function update() {
    const shift = +sl.s.value, m = Math.min(1023, +sl.m.value + shift), n = Math.min(1023, +sl.n.value + shift);
    $("#rope-m-v").textContent = m; $("#rope-n-v").textContent = n; $("#rope-s-v").textContent = shift;
    const learned = dot(q.map((v, i) => v + TABLE[m][i]), k.map((v, i) => v + TABLE[n][i])), rp = dot(rotate(q, m), rotate(k, n));
    const bl = $("#rope-learned"), br = $("#rope-rope");
    $(".v", bl).textContent = learned.toFixed(2); $(".v", br).textContent = rp.toFixed(4);
    bl.className = "box " + (lastL !== null && Math.abs(learned - lastL) > 1e-9 ? "moved" : ""); br.className = "box " + (lastR !== null && Math.abs(rp - lastR) < 1e-9 ? "still" : "");
    lastL = learned; lastR = rp;
    hands.forEach(([hd, cx, cy], i) => { const a = m * Math.pow(10000, -2 * i / DIM); hd.setAttribute("x2", cx + R * Math.cos(a)); hd.setAttribute("y2", cy - R * Math.sin(a)); });
    $("#rope-learned .k").textContent = `learned table · offset ${m - n}`; $("#rope-rope .k").textContent = `RoPE · offset ${m - n}`;
  }
  Object.values(sl).forEach(x => x.addEventListener("input", update)); update();
})();

/* ---- 02 past the window */
function pplByBucket(nll, b) { const out = []; for (let i = 0; i + b <= nll.length; i += b) { let s = 0; for (let j = i; j < i + b; j++) s += nll[j]; out.push([i + b, Math.exp(s / b)]); } return out; }
(function ropeCurves() {
  const RA = RP.artifact, M = RA.models, names = Object.keys(M), colors = { 0: "--ink-3", 1: "--cls-1", 2: "--cls-2", 3: "--cls-0" };
  const ext = M[names[1]].nll_by_position, int_ = M[names[2]].nll_by_position;
  const mean = (a, lo, hi) => Math.exp(a.slice(lo, hi).reduce((x, y) => x + y, 0) / (hi - lo));
  const inExt = mean(ext, 0, 2048), inInt = mean(int_, 0, 2048), lastExt = mean(ext, ext.length - 256, ext.length), lastInt = mean(int_, int_.length - 256, int_.length);
  // where the wall starts: first 64-position window past the training window at twice the in-window perplexity
  let wall = null; for (let i = 2048; i + 64 <= ext.length; i += 16) { if (mean(ext, i, i + 64) > 2 * mean(ext, 1536, 2048)) { wall = i; break; } }
  const betG = makeBet("#bet-rope-gpt", ["an error — no such row", "a worse prediction", "the same as at 1 024"], 0);
  const betE = makeBet("#bet-rope-ext", ["flat, it extrapolates", "a slow climb", "a wall right away", "flat for a while, then a wall"], wall === null ? 0 : wall > 2048 + 256 ? 3 : 2);
  const betI = makeBet("#bet-rope-int", ["better", "the same", "worse"], inInt > inExt * 1.05 ? 2 : inInt < inExt * 0.95 ? 0 : 1);
  let bucket = 128;
  function draw() {
    const series = names.map((nm, i) => { const pts = pplByBucket(M[nm].nll_by_position, bucket); return { x: pts.map(p => p[0]), y: pts.map(p => p[1]), color: css(colors[i]), label: `${nm} (trained at ${num(M[nm].window)})`, r: 3, tip: (x, y) => `${nm}<br>positions ${num(x - bucket + 1)}–${num(x)}: ${y.toFixed(1)}` }; });
    lineChart($("#rope-chart"), { W: 1000, H: 360, L: 70, fs: 13, ylog: 1, series, xlabel: "position in the stream", ylabel: `perplexity, ${bucket}-position buckets (log)`, yfmt: v => tickFmt(v), vlines: [{ x: 1024, label: "gpt2's table ends", color: css("--ink-3") }, { x: 2048, label: "pythia's training window", color: css("--ink-3") }], xmin: 0, xmax: RA.stream_len, legendX: 90 });
    $("#rope-b-v").textContent = bucket;
  }
  $("#rope-b").addEventListener("input", e => { bucket = +e.target.value; draw(); });
  REDRAW.push(draw);
  $("#rope-err").innerHTML = `gpt2 at position ${num(M[names[0]].window + 1)}: <span class="miss">${esc(M[names[0]].error_past_window)}</span>`;
  const cols = [{ h: "model", f: r => `<b>${esc(r.name)}</b>` }].concat([512, 1024, 1536, 2048, 2560, 3072].map(p => ({ h: `≤ ${num(p)}`, num: 1, f: r => { const pts = pplByBucket(r.nll, 512).find(q => q[0] === p); return pts ? pts[1].toFixed(1) : "—"; } })));
  table($("#rope-table"), cols, names.map(nm => ({ name: nm, nll: M[nm].nll_by_position })));
  reveal("btn-rope-reveal", ["rope-out"], "rope-note", [betG, betE, betI]);
  const yarn = M[names[3]] ? M[names[3]].nll_by_position : null;
  const yarn_line = yarn ? " " + TXT("rope-note-yarn", { yarn_last: mean(yarn, yarn.length - 256, yarn.length).toFixed(0), yarn_inside: mean(yarn, 0, 2048).toFixed(0) }) : "";
  $("#rope-note").innerHTML = TXT("rope-note", { flat_for: num(Math.round((wall - 2048) / 100) * 100), ext_last: lastExt.toFixed(0), int_last: lastInt.toFixed(0), int_inside: inInt.toFixed(0), ext_inside: inExt.toFixed(0), yarn_line, n_streams: RA.n_streams });
})();

/* ---- 02 YaRN */
(function yarn() {
  const wl = RP.wavelength, L = 2048;
  const mult = (s, a, b) => wl.map(w => { const g = Math.min(1, Math.max(0, (L / w - a) / (b - a))); return (1 - g) / s + g; });
  const bad = Object.entries(RP.yarnCheck).filter(([s, v]) => { const m = mult(+s, 1, 32); return v.some((x, i) => Math.abs(x - m[i]) > 1e-5); });
  ck("#yarn-ck", bad.length === 0, bad.length ? "differs from the notebook at s = " + bad.map(b => b[0]).join(", ") : `matches the notebook's yarn_multiplier at s = ${Object.keys(RP.yarnCheck).join(", ")}`);
  const sl = { s: $("#yarn-s"), a: $("#yarn-a"), b: $("#yarn-b") };
  function draw() {
    const s = +sl.s.value, a = +sl.a.value, b = +sl.b.value; $("#yarn-s-v").textContent = s; $("#yarn-a-v").textContent = a; $("#yarn-b-v").textContent = b;
    const m = mult(s, a, b), x = wl.map((_, i) => i);
    lineChart($("#yarn-chart"), { W: 520, H: 300, L: 76, fs: 12.5, series: [{ x, y: x.map(() => 1 / s), color: css("--ink-3"), dash: 1, nodots: 1, label: `linear: every pair / ${s}` }, { x, y: m, color: css("--cls-1"), r: 3, label: `YaRN, s = ${s}`, tip: (i, y) => `pair ${i}: a turn every ${num(Math.round(wl[i]))} positions · ${(L / wl[i]).toFixed(1)} turns inside L · × ${y.toFixed(3)}` }], xlabel: "pair i (0 = fastest)", ylabel: "multiplier on θ_i", ymin: 0, ymax: 1.05, xticks: [0, 4, 8, 12, 16, 20, 24, 28, 31] });
    const t = Math.pow(0.1 * Math.log(s) + 1, 2), untouched = m.filter(v => v > 0.999).length, full = m.filter(v => Math.abs(v - 1 / s) < 1e-6).length;
    $("#yarn-stats").innerHTML = stat(untouched, "pairs untouched") + stat(full, "pairs fully squeezed") + stat(t.toFixed(2) + "×", "on the logits (1/t)");
    const temp_note = s <= 2 ? TXT("yarn-temp-small") : TXT("yarn-temp-big");
    $("#yarn-note").innerHTML = TXT("yarn-note", { s, beta: b, alpha: a, temperature: t.toFixed(2), temp_note, inside: M2() });
  }
  const M2 = () => { const M = RP.artifact.models, k = Object.keys(M); if (!M[k[3]]) return "—"; const mean = (a, lo, hi) => Math.exp(a.slice(lo, hi).reduce((x, y) => x + y, 0) / (hi - lo)); return TXT("yarn-m2", { yarn_inside: mean(M[k[3]].nll_by_position, 0, 2048).toFixed(0), native_inside: mean(M[k[1]].nll_by_position, 0, 2048).toFixed(0) }); };
  Object.values(sl).forEach(x => x.addEventListener("input", draw)); REDRAW.push(draw);
})();

/* ---- 03 the KV cache, step by step */
(function kvFig() {
  const P = 3, MAXT = 6; let t = 0, mode = "nocache";
  const toks = ["The", "match", "ended", "after", "ninety", "minutes", "of", "extra", "time", "."];
  function draw(m) { mode = m || mode; const host = $("#fig-kv"); host.innerHTML = ""; const W = 1000, H = 250, s = svg(W, H), cw = 76, x0 = 40;
    const T = P + t;
    txt(s, x0, 22, mode === "nocache" ? "no cache: every step re-reads the whole prefix — every column below is evaluated again" : "KV cache: the prefix's keys and values are kept per layer — only the new column is evaluated", { anchor: "start", fs: 13, color: css("--ink") });
    for (let step = 0; step <= t; step++) { const y = step === 0 ? 46 : 118; if (step > 0 && step < t) continue; const row = step === 0 ? "prefill" : `step ${step}`; txt(s, x0, y + 14, row, { anchor: "start", fs: 11.5 });
      const n = P + step; for (let i = 0; i < n; i++) { const fresh = mode === "nocache" || step === 0 || i === n - 1; const isNew = step > 0 && i === n - 1;
        box(s, x0 + 60 + i * cw, y, cw - 6, 22, toks[i], { fill: fresh ? (isNew ? TINT("--cls-1", 40) : TINT("--cls-0", 26)) : css("--panel"), stroke: fresh ? css(isNew ? "--cls-1" : "--cls-0") : css("--rule"), fs: 11.5, rx: 3, dash: !fresh }); }
      if (step === t && t > 0) { arrow(s, x0 + 60 + n * cw - 2, y + 11, x0 + 60 + n * cw + 26, y + 11, { color: css("--cls-1") }); txt(s, x0 + 60 + n * cw + 34, y + 15, `→ '${toks[n]}'`, { anchor: "start", fs: 12, color: css("--cls-1") }); }
      if (step === 0 && t > 1) txt(s, x0 + 8, y + 46, "⋮", { anchor: "start", fs: 13 }); }
    const evalN = mode === "nocache" ? Array.from({ length: t + 1 }, (_, k) => P + k).reduce((a, b) => a + b, 0) : P + t, need = P + t;
    $("#kv-t").textContent = t; $("#kv-eval").textContent = evalN; $("#kv-need").textContent = need;
    txt(s, x0, H - 42, `positions evaluated: ${evalN} · needed: ${need} · after T steps: ${mode === "nocache" ? "P·T + T(T+1)/2" : "P + T"}`, { anchor: "start", fs: 13, color: css("--ink"), bold: 1 });
    const lg = [["evaluated this step", "--cls-0", 26], ["the new token", "--cls-1", 40]]; if (mode === "cache") lg.push(["from the cache", null, 0]);
    lg.forEach(([l, c, p], i) => { const x = x0 + i * 200; box(s, x, H - 24, 16, 12, null, { fill: c ? TINT(c, p) : css("--panel"), stroke: c ? css(c) : css("--rule"), rx: 2, dash: !c }); txt(s, x + 22, H - 14, l, { anchor: "start", fs: 11.5 }); });
    host.appendChild(s); }
  const set = states("fig-kv-btns", draw);
  $("#kv-step").addEventListener("click", () => { t = Math.min(MAXT, t + 1); draw(); });
  $("#kv-reset").addEventListener("click", () => { t = 0; draw(); });
})();
(function kvNumbers() {
  const K = D.kv, ratio64 = K.sixtyFourMs / K.onePassMs, r896 = K.table.find(r => r.n === 896);
  const betOne = makeBet("#bet-kv-one", ["about 2×", "about 10×", "about 40×", "about 64×"], ratio64 < 5 ? 0 : ratio64 < 25 ? 1 : ratio64 < 55 ? 2 : 3);
  const betR = makeBet("#bet-kv-ratio", ["about 500", "about 50", "under 5"], r896.ratio > 100 ? 0 : r896.ratio > 20 ? 1 : 2);
  $("#kv-stats").innerHTML = stat(K.onePassMs.toFixed(0) + " ms", `one pass, ${K.promptTokens} tokens`) + stat(K.sixtyFourMs.toFixed(0) + " ms", "64 generated tokens") + stat(ratio64.toFixed(0) + "×", "slower") + stat((K.sixtyFourMs / 64).toFixed(0) + " ms", "one cached step, one token");
  table($("#kv-table"), [{ h: "new tokens", num: 1, f: r => r.n }, { h: "no cache, s", num: 1, f: r => r.noCache.toFixed(2) }, { h: "cache, s", num: 1, f: r => r.cache.toFixed(2) }, { h: "ratio", num: 1, f: r => `<b>${r.ratio.toFixed(1)}</b>` }, { h: "by token-passes", num: 1, f: r => (K.promptTokens + r.n / 2).toFixed(0) }], K.table);
  REDRAW.push(() => lineChart($("#kv-chart"), { W: 460, H: 280, L: 64, fs: 12.5, ylog: 1, series: [{ x: K.table.map(r => r.n), y: K.table.map(r => r.ratio), color: css("--cls-1"), label: "measured ratio, M4", tip: (x, y) => `${x} tokens: ${y.toFixed(1)}×` }, { x: K.table.map(r => r.n), y: K.table.map(r => K.promptTokens + r.n / 2), color: css("--ink-3"), dash: 1, label: "P + T/2, by token-passes", tip: (x, y) => `${x} tokens: ${y.toFixed(0)}×` }], xlabel: "new tokens", ylabel: "no cache / cache (log)", yfmt: v => tickFmt(v), ymin: 1, ymax: 5000 }));
  reveal("btn-kv-reveal", ["kv-out"], "kv-note", [betOne, betR]);
  $("#kv-note").innerHTML = TXT("kv-note", { predicted_896: (K.promptTokens + 448).toFixed(0), ratio_64: K.table[0].ratio.toFixed(1), ratio_896: r896.ratio.toFixed(1), step_ms: (K.sixtyFourMs / 64).toFixed(0), prompt_tokens: K.promptTokens, pass_ms: K.onePassMs.toFixed(0) });
})();

/* ---- 04 zero-shot: the artifact and the verbalizer builder */
(function zeroShot() {
  const Z = D.zeroShot, R = Z.artifact.results, live = Z.live;
  const asWritten = R["class names, sum"].accuracy;
  const bet = makeBet("#bet-zs", ["about 0.25", "about 0.4", "about 0.6", "about 0.8"], asWritten < 0.32 ? 0 : asWritten < 0.5 ? 1 : asWritten < 0.7 ? 2 : 3);
  $("#zs-stats").innerHTML = stat(fmt(asWritten, 3), "class names as written, 7 600 texts") + stat(fmt(live.accuracy, 3), `live cell, ${live.n} texts`) + stat(Object.entries(live.tokensPerName).map(([c, n]) => `${c.replace("Sci/Tech", "Sci/Tech")} ${n}`).join(" · "), "tokens per class name");
  table($("#zs-table"), [{ h: "verbalizer", f: r => `<b>${esc(r.k)}</b>` }, { h: "words", mono: 1, f: r => esc(r.words.join(" ")) }, { h: "tokens", num: 1, f: r => r.tokens_per_word.join(" ") }, { h: "accuracy", num: 1, f: r => `<b>${fmt(r.accuracy, 4)}</b>` }].concat(CLS.map(c => ({ h: c, num: 1, f: r => fmt(r.per_class[c], 3) }))), Object.keys(R).map(k => Object.assign({ k }, R[k])));
  reveal("btn-zs-reveal", ["zs-out"], "zs-note", [bet]);
  $("#zs-note").innerHTML = TXT("zs-note", { n_live: live.n, n_scitech: live.predictedAs["Sci/Tech"] || 0, n_world: live.predictedAs.World, per_token_loss: Math.round(100 * (R["class names, sum"].accuracy - R["class names, per token"].accuracy)), verbalizer_gain: Math.round(100 * (R["one token each, sum"].accuracy - R["class names, sum"].accuracy)), verbalizer_acc: fmt(R["one token each, sum"].accuracy, 2) });
  // the builder
  const PL = Z.pool, W = PL.words, N = PL.n, sums = f16(PL.sums), nTok = PL.tokensPerWord, gold = PL.gold;
  $("#vb-n").textContent = num(N);
  const assign = new Array(W.length).fill(-1);
  [" world", " sports", " business", " technology"].forEach((w, c) => { assign[W.indexOf(w)] = c; });
  let how = "sum";
  function evalSet() {
    const pred = new Int8Array(N), have = [0, 1, 2, 3].map(c => assign.some(a => a === c));
    for (let i = 0; i < N; i++) { let best = -1, bs = -Infinity; for (let c = 0; c < 4; c++) { let sc = -Infinity; for (let w = 0; w < W.length; w++) if (assign[w] === c) { const v = sums[i * W.length + w] / (how === "per" ? nTok[w] : 1); if (v > sc) sc = v; } if (sc > bs) { bs = sc; best = c; } } pred[i] = best; }
    const conf = [[0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]]; let hit = 0; for (let i = 0; i < N; i++) { if (pred[i] >= 0) conf[gold[i]][pred[i]]++; if (pred[i] === gold[i]) hit++; }
    return { acc: hit / N, conf, per: conf.map((row, c) => row[c] / row.reduce((a, b) => a + b, 0)), have };
  }
  function draw() {
    $("#vb").innerHTML = CLS.map((c, ci) => `<div class="cls c${ci}"><div class="h t${ci}">${esc(c)}</div><div class="words">${W.map((w, wi) => `<button data-w="${wi}" data-c="${ci}" class="${assign[wi] === ci ? "on" : ""}">${esc(w.trim())}<i>${nTok[wi]}</i></button>`).join("")}</div></div>`).join("");
    const r = evalSet();
    $("#vb-acc").innerHTML = stat(fmt(r.acc, 4), "accuracy") + CLS.map((c, ci) => stat(r.have[ci] ? fmt(r.per[ci], 2) : "—", c)).join("") + `<span class="small-note">${how === "sum" ? "summed log-prob" : "log-prob per token"} · a class takes its best word</span>`;
    $("#vb-conf").innerHTML = `<tr><th></th>${CLS.map(c => `<th>→ ${esc(c)}</th>`).join("")}</tr>` + r.conf.map((row, g) => `<tr><th>${esc(CLS[g])}</th>${row.map((v, p) => `<td class="${p === g ? "hit" : v ? "" : "miss"}">${v}</td>`).join("")}</tr>`).join("");
  }
  $("#vb").addEventListener("click", e => { const b = e.target.closest("button[data-w]"); if (!b) return; const w = +b.dataset.w, c = +b.dataset.c; assign[w] = assign[w] === c ? -1 : c; draw(); });
  toggle("vb-how", m => { how = m; draw(); });
  draw();
  // parity with Python on the four fixed sets
  const checks = Z.poolCheck, saved = assign.slice(), savedHow = how; const bad = [];
  for (const [name, c] of Object.entries(checks)) { assign.fill(-1); c.words.forEach((w, ci) => { assign[W.indexOf(w)] = ci; }); how = /PerToken/.test(name) ? "per" : "sum"; const r = evalSet(); if (Math.abs(r.acc - c.accuracy) > 5e-4) bad.push(`${name} ${r.acc.toFixed(4)} vs ${c.accuracy}`); }
  assign.splice(0, assign.length, ...saved); how = savedHow;
  ck("#vb-ck", bad.length === 0, bad.length ? bad.join("; ") : `argmax here = Python on ${Object.keys(checks).length} verbalizers`);
})();

/* ---- 04 the card */
(function card() {
  const TASKS = { punct: { title: "3.1 · restore punctuation and capitalisation", text: "A speech recogniser writes everything in lower case with no punctuation. One million utterances a day. Return the text as a person would have typed it.", items: 1000000, tin: 60, tout: 60, follow: "and NASA? U.S.? iPhone? 3.5? — and if the words arrive one at a time, from a live stream?" },
    typos: { title: "3.2 · fix the typos in search queries", text: "A hundred thousand queries a minute, a tenth of them with a typo. Return the corrected query.", items: 100000 * 60 * 24, tin: 8, tout: 8, follow: "alot → a lot, ca n't → can't: the number of words changes — and if the misspelt word is a brand?" },
    ner: { title: "3.3 · extract the entities", text: "Named entities, four types, twenty milliseconds per document. You built this one last week — [B, L, 9], BIO tags, entity F1 of 0.89 on CoNLL-2003. The card asks you to do it the other way, and to say what it would cost.", items: 1000000, tin: 40, tout: 24, follow: "Bank of America — an organisation with a location inside it — a new entity type every month — the client wants JSON: where do the boundaries come from?" } };
  const FIELDS = [["body", ["encoder", "decoder", "encoder–decoder"]], ["use", ["head", "scorer", "generator", "transformer"]], ["output", ["[B, C]", "[B, L, C]", "[B, L, 2]", "a sequence over the vocabulary"]], ["enumerable", ["yes → a head", "no → the prefix"]], ["guaranteed", ["a label", "a copy of the input", "a substring", "nothing"]], ["passes", ["1", "candidates", "T_out"]]];
  const state = {}; let cur = "punct";
  function estimate(passes, items, tin, tout, candidates) { candidates = candidates || 4; const p = { "1": 1, candidates, T_out: tout }[passes]; const read = tin * (passes === "candidates" ? candidates : 1) + (passes === "T_out" ? tout : 0), written = passes === "T_out" ? tout : 0; return { "passes / day": p * items, "tokens read / day": read * items, "tokens written / day": written * items }; }
  const bad = D.cards.estimateCheck.filter(c => { const e = estimate(c.passes, c.items, c.tin, c.tout); return Object.keys(c.out).some(k => e[k] !== c.out[k]); });
  ck("#est-ck", bad.length === 0, bad.length ? `${bad.length} estimates differ from the notebook` : `estimate here = the notebook's estimate on ${D.cards.estimateCheck.length} cases`);
  function draw() {
    const T = TASKS[cur], st = state[cur] = state[cur] || { items: T.items, tin: T.tin, tout: T.tout };
    $("#card-task").innerHTML = `<p style="margin:0"><b>${esc(T.title)}</b> — <em>${esc(T.text)}</em></p>`;
    $("#card").innerHTML = FIELDS.map(([k, opts]) => `<span class="k">${k}</span><span class="btnrow row-btns" data-k="${k}">${opts.map(o => `<button data-v="${esc(o)}" class="${st[k] === o ? "sel" : ""}">${esc(o)}</button>`).join("")}</span>`).join("") +
      `<span class="k">items / day</span><span><input type="text" data-n="items" value="${st.items}"></span><span class="k">tokens in</span><span><input type="text" data-n="tin" value="${st.tin}"></span><span class="k">tokens out</span><span><input type="text" data-n="tout" value="${st.tout}"></span><span class="k">follow-up</span><span style="font-size:15.5px;color:var(--ink-2)">${esc(T.follow)}</span>`;
    const p = st.passes ? { "1": "1", candidates: "candidates", T_out: "T_out" }[st.passes] : null;
    $("#card-est").innerHTML = p ? Object.entries(estimate(p, +st.items || 0, +st.tin || 0, +st.tout || 0)).map(([k, v]) => stat(v >= 1e9 ? (v / 1e9).toFixed(1) + "B" : v >= 1e6 ? (v / 1e6).toFixed(1) + "M" : num(v), k)).join("") : `<span class="small-note">${TXT("card-est-empty")}</span>`;
    const why = st.guaranteed === "nothing" ? TXT("card-why-nothing") : st.guaranteed === "a label" ? TXT("card-why-label") : st.guaranteed === "a substring" ? TXT("card-why-substring") : TXT("card-why-copy");
    $("#card-note").innerHTML = st.guaranteed ? TXT("card-note", { guaranteed: esc(st.guaranteed), why }) : TXT("card-note-empty");
  }
  $("#card-tabs").addEventListener("click", e => { const b = e.target.closest("button[data-c]"); if (!b) return; cur = b.dataset.c; $$("#card-tabs button").forEach(x => x.classList.toggle("sel", x === b)); draw(); });
  $("#card").addEventListener("click", e => { const b = e.target.closest("button[data-v]"); if (!b) return; const k = b.closest("[data-k]").dataset.k; state[cur][k] = state[cur][k] === b.dataset.v ? null : b.dataset.v; draw(); });
  $("#card").addEventListener("input", e => { const i = e.target.closest("input[data-n]"); if (!i) return; state[cur][i.dataset.n] = i.value.replace(/[^0-9]/g, ""); const p = state[cur].passes; if (p) $("#card-est").innerHTML = Object.entries(estimate(p, +state[cur].items || 0, +state[cur].tin || 0, +state[cur].tout || 0)).map(([k, v]) => stat(v >= 1e9 ? (v / 1e9).toFixed(1) + "B" : v >= 1e6 ? (v / 1e6).toFixed(1) + "M" : num(v), k)).join(""); });
  draw();
})();

/* ---- 04 word_label, running here */
const PU = D.punct, CASES = PU.cases, PUNCTS = PU.puncts;
const stripText = t => t.toLowerCase().replace(/[^a-z0-9' ]/g, "");
function wordLabel(word) {
  const tail = word.match(/[^A-Za-z0-9']*$/)[0], inner = word.slice(0, word.length - tail.length);
  let punct = PUNCTS.includes(tail) ? tail : "other";
  if (inner.replace(/[^A-Za-z0-9']/g, "") !== inner) punct = "other";
  const letters = inner.replace(/[^A-Za-z]/g, ""); let cs;
  if (letters === letters.toLowerCase()) cs = "lower"; else if (letters === letters.toUpperCase() && letters.length > 1) cs = "CAPS"; else if (letters === letters[0].toUpperCase() + letters.slice(1).toLowerCase()) cs = "Cap"; else cs = "other";
  return cs + "|" + punct;
}
function applyLabel(stripped, label) { const [cs, punct] = label.split("|"); const w = { lower: stripped, Cap: stripped[0] ? stripped[0].toUpperCase() + stripped.slice(1) : stripped, CAPS: stripped.toUpperCase(), other: stripped }[cs]; return w + (punct !== "other" ? punct : ""); }
(function wordLabels() {
  const bad = PU.labelCheck.filter(c => wordLabel(c.word) !== c.label || applyLabel(stripText(c.word), c.label) !== c.rebuilt);
  ck("#wl-ck", bad.length === 0, bad.length ? "differs on " + bad.map(b => b.word).join(", ") : `word_label here = Python on ${PU.labelCheck.length} words`);
  function draw() { const words = $("#wl-in").value.split(/\s+/).filter(Boolean), labs = words.map(wordLabel), unx = labs.filter(l => /other/.test(l)).length;
    $("#wl-out").innerHTML = words.map((w, i) => `<span class="tok${/other/.test(labs[i]) ? " unx" : ""}">${esc(w)}<i>${esc(labs[i])}</i></span>`).join("");
    $("#wl-line").innerHTML = TXT("wl-line", { unx, n_words: words.length, n_labels: PU.labels.length, n_live: num(PU.liveCeiling.n), live_pct: pct(PU.liveCeiling.unexpressible, 1), live_words: num(PU.liveCeiling.nWords), n_test: num(PU.artifact.n_test), test_pct: pct(PU.artifact.ceiling.unexpressible, 1) }); }
  $("#wl-in").addEventListener("input", draw); draw();
})();

/* ---- 04 add_noise, running here */
const TY = D.typos, OPS = TY.ops;
function addNoise(text, opsSeq, ks, cs) {
  // the notebook's add_noise with a scripted rng: an op is drawn only for words longer than 2 letters (rate 1), k likewise, c for every word
  const words = text.split(" "), noisy = [], ops = [], flags = []; let i = 0, oi = 0, ki = 0, ci = 0;
  while (i < words.length) { const w = words[i]; let op = w.length > 2 ? opsSeq[oi++] : "none"; const k = w.length > 2 ? ks[ki++] : 0, c = cs[ci++]; let out;
    if (op === "merge" && i + 1 === words.length) op = "none";
    if (op === "none") out = [w]; else if (op === "sub") out = [w.slice(0, k) + c + w.slice(k + 1)]; else if (op === "del") out = [w.slice(0, k) + w.slice(k + 1)]; else if (op === "ins") out = [w.slice(0, k) + c + w.slice(k)];
    else if (op === "swap") out = [w.slice(0, k) + w[k + 1] + w[k] + w.slice(k + 2)]; else if (op === "split") out = [w.slice(0, k), w.slice(k)]; else { out = [w + words[i + 1]]; ops.push("merge"); i += 1; }
    noisy.push(...out); ops.push(op); for (let j = 0; j < out.length; j++) flags.push(op !== "none"); i += 1; }
  return { noisy: noisy.join(" "), ops, flags };
}
(function noise() {
  const bad = TY.noiseCheck.filter(c => { const r = addNoise(c.text, c.ops, c.ks.concat(c.ks, c.ks), c.cs.concat(c.cs, c.cs)); return r.noisy !== c.noisy || r.ops.join() !== c.opsOut.join() || r.flags.join() !== c.flags.join(); });
  ck("#noise-ck", bad.length === 0, bad.length ? `differs from Python on '${bad[0].text}'` : `add_noise here = Python on ${TY.noiseCheck.length} scripted cases`);
  $("#noise-ops").innerHTML = OPS.map((o, i) => `<button data-op="${o}" class="${i === 0 ? "on" : ""}">${o}</button>`).join("");
  let op = "sub";
  function draw() { const words = $("#noise-in").value.trim().split(/\s+/).filter(Boolean); if (!words.length) return; const wsl = $("#noise-w"), ksl = $("#noise-k"); wsl.max = words.length - 1; const wi = Math.min(+wsl.value, words.length - 1); wsl.value = wi; const w = words[wi]; ksl.max = Math.max(1, w.length - 2); const k = Math.min(+ksl.value, Math.max(1, w.length - 2)); ksl.value = k;
    $("#noise-w-v").textContent = `${wi} · '${w}'`; $("#noise-k-v").textContent = k;
    const seq = words.map((x, i) => i === wi ? op : "none"), r = addNoise(words.join(" "), seq.filter((_, i) => words[i].length > 2), words.map(() => k), words.map(() => "x"));
    const out = $("#noise-out"); out.textContent = r.noisy; const changed = r.noisy.split(" ").length !== words.length; out.className = "out " + (changed ? "no" : "ok");
    const tail = changed ? TXT("noise-changed") : TXT("noise-same");
    $("#noise-line").innerHTML = w.length <= 2 ? TXT("noise-short", { w: esc(w) }) : TXT("noise-line", { op, k, w: esc(w), n_out: r.noisy.split(" ").length, n_in: words.length, tail }); }
  $("#noise-ops").addEventListener("click", e => { const b = e.target.closest("button[data-op]"); if (!b) return; op = b.dataset.op; $$("#noise-ops button").forEach(x => x.classList.toggle("on", x === b)); draw(); });
  ["noise-in", "noise-w", "noise-k"].forEach(id => $("#" + id).addEventListener("input", draw)); draw();
})();

/* ---- 04 / 05 NER: the formats, parsed back — the notebook's parsers, ported */
const NE = D.ner, TYPES = ["PER", "ORG", "LOC", "MISC"];
function bioSpans(tags) { const spans = []; let start = null; const t2 = tags.concat(["O"]); for (let i = 0; i < t2.length; i++) { const t = t2[i]; if (start !== null && !t.startsWith("I-")) { spans.push([start, i, tags[start].slice(2)]); start = null; } if (t.startsWith("B-")) start = i; } return spans; }
function toInline(words, tags) { const out = []; let i = 0; for (const [s, e, t] of bioSpans(tags)) { out.push(...words.slice(i, s), `[${t} ${words.slice(s, e).join(" ")}]`); i = e; } return out.concat(words.slice(i)).join(" "); }
function toList(words, tags) { return bioSpans(tags).map(([s, e, t]) => `${words.slice(s, e).join(" ")}: ${t}`).join("; ") || "none"; }
/* difflib.SequenceMatcher(autojunk=False).get_matching_blocks, for sequences of words */
function matchingBlocks(a, b) {
  const blocks = [], queue = [[0, a.length, 0, b.length]];
  while (queue.length) { const [alo, ahi, blo, bhi] = queue.pop(); let bi = alo, bj = blo, bk = 0; const prev = new Map();
    for (let i = alo; i < ahi; i++) { const cur = new Map(); for (let j = blo; j < bhi; j++) { if (a[i] === b[j]) { const k = (prev.get(j - 1) || 0) + 1; cur.set(j, k); if (k > bk) { bi = i - k + 1; bj = j - k + 1; bk = k; } } } prev.clear(); cur.forEach((v, kk) => prev.set(kk, v)); }
    if (bk) { blocks.push([bi, bj, bk]); if (alo < bi && blo < bj) queue.push([alo, bi, blo, bj]); if (bi + bk < ahi && bj + bk < bhi) queue.push([bi + bk, ahi, bj + bk, bhi]); } }
  return blocks;
}
function parseInline(text, words) {
  const plain = [], ents = []; let cur = null;
  for (const t of text.split(/\s+/).filter(Boolean)) { const m = t.match(/^\[(PER|ORG|LOC|MISC)$/); if (m) { cur = [m[1], plain.length]; continue; } const closing = t.endsWith("]"); plain.push(t.replace(/\]+$/, "")); if (closing && cur) { ents.push([cur[1], plain.length, cur[0]]); cur = null; } }
  const tags = words.map(() => "O"); let unmatched = 0; const pairs = new Map();
  for (const [i, j, k] of matchingBlocks(plain, words)) for (let q = 0; q < k; q++) pairs.set(i + q, j + q);
  for (const [s, e, typ] of ents) { let ok = e > s; for (let i = s; i < e; i++) if (!pairs.has(i)) ok = false; if (ok) { let k = 0; for (let i = s; i < e; i++) tags[pairs.get(i)] = (k++ === 0 ? "B-" : "I-") + typ; } else unmatched++; }
  return [tags, unmatched];
}
function parseList(text, words) {
  const tags = words.map(() => "O"); let unmatched = 0; if (text.trim() === "none") return [tags, 0];
  for (const item of text.split(";")) { const p = item.lastIndexOf(":"); const spanS = (p < 0 ? "" : item.slice(0, p)).trim(), typ = (p < 0 ? item : item.slice(p + 1)).trim(); const span = spanS.split(/\s+/).filter(Boolean);
    const hits = []; for (let i = 0; i + span.length <= words.length; i++) if (span.length && words.slice(i, i + span.length).every((w, q) => w === span[q]) && tags[i] === "O") hits.push(i);
    if (TYPES.includes(typ) && hits.length) { for (let q = 0; q < span.length; q++) tags[hits[0] + q] = (q === 0 ? "B-" : "I-") + typ; } else unmatched++; }
  return [tags, unmatched];
}
function entLine(words, tags, wrongIdx) { const spans = bioSpans(tags), out = []; let i = 0; for (const [s, e, t] of spans) { out.push(esc(words.slice(i, s).join(" "))); out.push(`<span class="ent ${t}${wrongIdx && wrongIdx.has(s) ? " wrong" : ""}">${esc(words.slice(s, e).join(" "))}<i>${t}</i></span>`); i = e; } out.push(esc(words.slice(i).join(" "))); return out.filter(Boolean).join(" "); }
(function nerWriter() {
  const bad = NE.parseCheck.filter(c => { const [tags, un] = (c.fmt === "inline" ? parseInline : parseList)(c.text, c.words); return tags.join() !== c.tags.join() || un !== c.unmatched; });
  ck("#ner-ck", bad.length === 0, bad.length ? `${bad.length} of ${NE.parseCheck.length} parses differ from Python` : `parse_inline / parse_list here = Python on ${NE.parseCheck.length} strings`);
  const demos = NE.artifact.formats.inline.demo, d = demos.find(x => bioSpans(x.gold).length >= 2 && x.words.length <= 20) || demos[0], li = NE.artifact.formats.list.demo[demos.indexOf(d)];
  $("#ner-sent").innerHTML = entLine(d.words, d.gold) + ` <span class="small-note" style="display:inline">← gold</span>`;
  $("#ner-inline").placeholder = "e.g. " + toInline(d.words, d.gold); $("#ner-list").placeholder = "e.g. " + toList(d.words, d.gold);
  $("#ner-inline").value = d.generated; $("#ner-list").value = li.generated;
  function show(fmt) { const text = $(fmt === "inline" ? "#ner-inline" : "#ner-list").value, [tags, un] = (fmt === "inline" ? parseInline : parseList)(text, d.words);
    const goldSpans = new Map(bioSpans(d.gold).map(([s, e, t]) => [s, e + ":" + t])), wrong = new Set(bioSpans(tags).filter(([s, e, t]) => goldSpans.get(s) !== e + ":" + t).map(([s]) => s));
    $(fmt === "inline" ? "#ner-inline-out" : "#ner-list-out").innerHTML = `<div class="ent-line" style="font-size:16px">${entLine(d.words, tags, wrong)}</div><div class="small-note">${TXT("ner-parsed", { n_ents: bioSpans(tags).length, unmatched: un, n_wrong: wrong.size, suffix: text === (fmt === "inline" ? d.generated : li.generated) ? " · " + TXT("ner-model-wrote") : "" })}</div>`; }
  $("#ner-inline").addEventListener("input", () => show("inline")); $("#ner-list").addEventListener("input", () => show("list")); show("inline"); show("list");
})();

/* ---- 04 lightning round */
(function lightning() {
  const Q = [["Language identification, 100 000 requests per second.", [1], "Character n-grams and a linear model; no transformer at all. The trap is reaching for a model that reads 100 000 texts a second through twelve layers."],
    ["Autocomplete in a search box, on every keystroke.", [2], "A trie of frequent completions, or a small n-gram / RNN language model — one step per keystroke, no prefix re-read. The trap: GPT-2 at 60 ms per keystroke."],
    ["Spam / phishing on incoming mail.", [1, 4], "TF-IDF beat frozen BERT on topics; a fine-tuned encoder wins on phishing. One pass. The trap: \"just ask an LLM\" — one pass becomes ten, and the answer is not calibrated."],
    ["Translation, fifty language pairs, server-side batches.", [3], "Encoder–decoder — the source is read bidirectionally and only once; with a cache, a decoder-only reads it once too, but causally. The trap is \"always enc-dec\" and \"always decoder\"."],
    ["Question answering over the company's internal documents, the answer must be a quote.", [4], "Two pointers, [B, L, 2] — the answer is a substring by construction. The trap: a generator that usually quotes."],
    ["A chat assistant, a thousand concurrent users.", [5], "A decoder; the prefix is the conversation; the cost is T_out per turn and the cache per user. The trap: budgeting by FLOPs and forgetting memory — next week."]];
  const picks = Q.map(() => null); let done = false;
  $("#lr").innerHTML = Q.map((q, i) => `<div class="lr"><span>${i + 1}. ${esc(q[0])}</span><span class="pick" data-i="${i}">${[1, 2, 3, 4, 5].map(w => `<button data-w="${w}">week ${w}</button>`).join("")}</span><span class="ans" hidden><b>Week ${q[1].join(" or ")}.</b> ${esc(q[2])}</span></div>`).join("");
  $("#lr").addEventListener("click", e => { const b = e.target.closest("button[data-w]"); if (!b || done) return; const i = +b.closest("[data-i]").dataset.i; picks[i] = +b.dataset.w; $$("button", b.parentElement).forEach(x => x.classList.toggle("on", x === b)); $("#lr-score").innerHTML = TXT("lr-score-picked", { n_picked: picks.filter(p => p !== null).length, n_q: Q.length }); });
  $("#btn-lr-reveal").addEventListener("click", e => { done = true; let right = 0; $$("#lr .pick").forEach((p, i) => { $$("button", p).forEach(x => { const w = +x.dataset.w, ok = Q[i][1].includes(w); x.classList.toggle("right", ok); x.classList.toggle("wrong", picks[i] === w && !ok); }); if (Q[i][1].includes(picks[i])) right++; });
    $$("#lr .ans").forEach(a => a.hidden = false); $("#lr-score").innerHTML = TXT("lr-score-final", { n_right: right, n_q: Q.length }); e.target.disabled = true; e.target.textContent = "revealed"; });
})();

/* ---- 05 punctuation: label it yourself, then the reveal */
(function punctLabel() {
  const demos = PU.artifact.demo; let i = 0, checked = false;
  function draw() { checked = false; const d = demos[i]; $("#pl-i").textContent = i; $("#pl-score").textContent = "";
    $("#pl").innerHTML = d.words.map((w, wi) => `<span class="w${/other/.test(w.label) ? " unx" : ""}" data-i="${wi}"><span class="s">${esc(w.stripped)}</span><select>${PU.labels.map(l => `<option value="${esc(l)}"${l === "lower|" ? " selected" : ""}>${esc(l)}</option>`).join("")}</select><span class="g"></span></span>`).join(""); }
  $("#pl-prev").addEventListener("click", () => { i = (i + demos.length - 1) % demos.length; draw(); }); $("#pl-next").addEventListener("click", () => { i = (i + 1) % demos.length; draw(); });
  $("#btn-pl-check").addEventListener("click", () => { const d = demos[i]; let hit = 0, encHit = 0; $$("#pl .w").forEach(n => { const w = d.words[+n.dataset.i], pick = $("select", n).value, ok = applyLabel(w.stripped, pick) === w.gold; n.classList.toggle("hit", ok); n.classList.toggle("miss", !ok); if (ok) hit++; const encOk = w.encoder === w.gold; if (encOk) encHit++; $(".g", n).textContent = `gold ${w.label} · enc ${w.encoder == null ? "—" : wordLabel(w.encoder)}${encOk ? "" : " ✗"}`; });
    $("#pl-score").innerHTML = TXT("pl-score", { hit, n_words: d.words.length, enc_hit: encHit, n_unx: d.words.filter(w => /other/.test(w.label)).length }); });
  draw();
})();
(function punctReveal() {
  const A = PU.artifact, E = A.encoder, Dd = A.decoder;
  const betAll = makeBet("#bet-punct-all", ["the encoder, clearly", "the decoder, clearly", "within a point of each other"], Math.abs(E.accuracy - Dd.accuracy) < 0.01 ? 2 : E.accuracy > Dd.accuracy ? 0 : 1);
  const capE = (E.by_case.accuracy.Cap + E.by_punct.accuracy[","] + E.by_punct.accuracy["."]) / 3, capD = (Dd.by_case.accuracy.Cap + Dd.by_punct.accuracy[","] + Dd.by_punct.accuracy["."]) / 3;
  const betCap = makeBet("#bet-punct-cap", ["the encoder", "the decoder"], capE >= capD ? 0 : 1);
  const betChg = makeBet("#bet-punct-chg", ["under 1%", "about 5%", "over 10%"], Dd.changed < 0.01 ? 0 : Dd.changed < 0.1 ? 1 : 2);
  $("#punct-stats").innerHTML = stat(fmt(E.accuracy, 3), "encoder, word accuracy") + stat(fmt(Dd.accuracy, 3), "decoder, word accuracy") + stat(pct(A.ceiling.unexpressible, 1), "ceiling: unexpressible words") + stat(pct(Dd.changed, 1), "changed by the decoder") + stat(`${(E.ms_per_1000 / 1000).toFixed(1)}s / ${(Dd.ms_per_1000 / 1000).toFixed(0)}s`, "per 1 000 items, T4");
  const pairs = (host, key) => { const rows = Object.keys(E[key].words); host.innerHTML = rows.map(r => `<div class="pair${r === "other" ? " hl" : ""}"><span class="lab">${esc(r === "" ? "none" : r)}</span><span class="bar e" title="encoder"><i style="width:${(100 * E[key].accuracy[r]).toFixed(1)}%"></i></span><span class="bar d" title="decoder"><i style="width:${(100 * Dd[key].accuracy[r]).toFixed(1)}%"></i></span><span class="n">${fmt(E[key].accuracy[r], 2)} / ${fmt(Dd[key].accuracy[r], 2)} · ${num(E[key].words[r])}</span></div>`).join(""); };
  pairs($("#punct-case"), "by_case"); pairs($("#punct-punct"), "by_punct");
  const d0 = A.demo[0], dropped = d0.words.filter(w => w.decoder == null).length;
  $("#punct-drop").innerHTML = d0.words.map(w => w.decoder == null ? `<span class="drop">${esc(w.gold)}</span>` : stripText(w.decoder) !== stripText(w.gold) ? `<span class="chg">${esc(w.decoder)}</span>` : esc(w.decoder === w.gold ? w.gold : w.decoder)).join(" ") + `<div class="small-note">${TXT("punct-drop-note", { dropped, n_words: d0.words.length })}</div>`;
  reveal("btn-punct-reveal", ["punct-out"], "punct-note", [betAll, betCap, betChg]);
  $("#punct-note").innerHTML = TXT("punct-note", { enc_acc: fmt(E.accuracy, 2), dec_acc: fmt(Dd.accuracy, 2), enc_cap: fmt(E.by_case.accuracy.Cap, 2), dec_cap: fmt(Dd.by_case.accuracy.Cap, 2), enc_comma: fmt(E.by_punct.accuracy[","], 2), dec_comma: fmt(Dd.by_punct.accuracy[","], 2), enc_period: fmt(E.by_punct.accuracy["."], 2), dec_period: fmt(Dd.by_punct.accuracy["."], 2), dec_other_case: fmt(Dd.by_case.accuracy.other, 2), dec_other_punct: fmt(Dd.by_punct.accuracy.other, 2), speed_ratio: (Dd.ms_per_1000 / E.ms_per_1000).toFixed(0), L: Math.round(E.n_words / A.n_test), dropped, n_words: d0.words.length });
})();

/* ---- 05 typos */
(function typos() {
  const A = TY.artifact, E = A.encoder, Dd = A.decoder, rows = ["none"].concat(OPS), picks = {};
  const zero = op => E.by_op.accuracy[op] < 0.02;
  function draw(revealed) { $("#typos-table").innerHTML = `<thead><tr><th>kind of noise</th><th class="num">words</th><th>zero by construction?</th><th class="num">encoder + dictionary</th><th class="num">decoder</th></tr></thead><tbody>` +
    rows.map(op => `<tr><td><b>${op}</b></td><td class="num">${num(E.by_op.words[op])}</td><td class="b">${op === "none" ? "" : ["yes", "no"].map(v => `<button data-op="${op}" data-v="${v}" class="${picks[op] === v ? "pick" : ""}${revealed ? (v === (zero(op) ? "yes" : "no") ? " right" : picks[op] === v ? " wrong" : "") : ""}">${v}</button>`).join(" ")}</td><td class="num${revealed && zero(op) ? " zero" : ""}">${revealed ? fmt(E.by_op.accuracy[op], 3) : "·"}</td><td class="num">${revealed ? fmt(Dd.by_op.accuracy[op], 3) : "·"}</td></tr>`).join("") + "</tbody>"; }
  $("#typos-table").addEventListener("click", e => { const b = e.target.closest("button[data-op]"); if (!b || b.classList.contains("right") || b.classList.contains("wrong")) return; picks[b.dataset.op] = b.dataset.v; draw(false); });
  draw(false);
  $("#typos-stats").innerHTML = stat(fmt(E.accuracy, 3), "encoder + dictionary, word accuracy") + stat(fmt(Dd.accuracy, 3), "decoder") + stat(`${fmt(E.detection_precision, 2)} / ${fmt(E.detection_recall, 2)}`, "detector precision / recall") + stat(`${(E.ms_per_1000 / 1000).toFixed(1)}s / ${(Dd.ms_per_1000 / 1000).toFixed(0)}s`, "per 1 000 items, T4");
  $("#typos-demo").innerHTML = A.demo.slice(0, 4).map(d => `<div class="order-row"><span class="k">noisy</span><span class="mono" style="font-size:14.5px">${esc(d.input)}</span></div><div class="order-row"><span class="k">gold</span><span>${esc(d.gold)}</span></div><div class="order-row"><span class="k">enc + dict</span><span>${esc(d.encoder)}${d.encoder === d.gold ? ' <b style="color:var(--good)">✓</b>' : ""}</span></div><div class="order-row" style="margin-bottom:10px"><span class="k">decoder</span><span>${esc(d.decoder)}${d.decoder === d.gold ? ' <b style="color:var(--good)">✓</b>' : d.decoder === d.input ? ' <b style="color:var(--bad)">left as is</b>' : ""}</span></div>`).join("");
  reveal("btn-typos-reveal", ["typos-out"], "typos-note", [], () => draw(true));
  const ops4 = ["sub", "del", "ins", "swap"], encAhead = ops4.filter(o => E.by_op.accuracy[o] > Dd.by_op.accuracy[o]);
  $("#typos-note").innerHTML = TXT("typos-note", { dec_split: fmt(Dd.by_op.accuracy.split, 2), dec_merge: fmt(Dd.by_op.accuracy.merge, 2), n_enc_ahead: encAhead.length, enc_ahead_list: encAhead.map(o => `${o} ${fmt(Dd.by_op.accuracy[o], 2)} to ${fmt(E.by_op.accuracy[o], 2)}`).join(", "), dec_none: fmt(Dd.by_op.accuracy.none, 3), one_in: Math.round(1 / (1 - Dd.by_op.accuracy.none)), dec_acc: fmt(Dd.accuracy, 3), enc_acc: fmt(E.accuracy, 3) });
})();

/* ---- 05 NER reveal */
(function nerReveal() {
  const F = NE.artifact.formats, W4 = NE.week4, inl = F.inline, lst = F.list;
  const betF1 = makeBet("#bet-ner-f1", ["above BERT", "within 2 points", "3–5 points below", "more than 10 below"], (() => { const d = W4.entity_f1 - Math.max(inl.entity_f1, lst.entity_f1); return d < 0 ? 0 : d < 0.02 ? 1 : d < 0.06 ? 2 : 3; })());
  const betFmt = makeBet("#bet-ner-fmt", ["inline ahead", "list ahead", "within a point"], Math.abs(inl.entity_f1 - lst.entity_f1) < 0.01 ? 2 : inl.entity_f1 > lst.entity_f1 ? 0 : 1);
  const betUn = makeBet("#bet-ner-unm", ["under 5%", "5–15%", "over 15%"], Math.max(inl.unmatched_share, lst.unmatched_share) < 0.05 ? 0 : Math.max(inl.unmatched_share, lst.unmatched_share) < 0.15 ? 1 : 2);
  const rows = [{ k: "BERT, token head (week 4)", f1: W4.entity_f1, PER: W4.f1_PER, ORG: W4.f1_ORG, LOC: W4.f1_LOC, MISC: W4.f1_MISC }].concat(["inline", "list"].map(f => ({ k: "GPT-2, " + f, f1: F[f].entity_f1, ...F[f].f1_by_type, unm: F[f].unmatched_share, wt: F[f].wrong_type_share, tw: F[f].tokens_written_mean, ms: F[f].ms_per_1000 })));
  table($("#ner-table"), [{ h: "model", f: r => `<b>${esc(r.k)}</b>` }, { h: "entity F1", num: 1, f: r => `<b>${fmt(r.f1, 3)}</b>` }].concat(TYPES.map(t => ({ h: t, num: 1, f: r => fmt(r[t], 2) }))).concat([{ h: "unmatched", num: 1, f: r => r.unm == null ? "—" : pct(r.unm, 1) }, { h: "wrong type", num: 1, f: r => r.wt == null ? "—" : pct(r.wt, 1) }, { h: "tokens written", num: 1, f: r => r.tw == null ? "0" : r.tw }, { h: "s / 1 000", num: 1, f: r => r.ms == null ? "not timed" : (r.ms / 1000).toFixed(1) }]), rows);
  let fmt_ = "inline", i = 0;
  function demo() { const d = F[fmt_].demo[i]; $("#ner-demo-i").textContent = `${i + 1} / ${F[fmt_].demo.length}`; const goldSpans = new Map(bioSpans(d.gold).map(([s, e, t]) => [s, e + ":" + t])), wrong = new Set(bioSpans(d.parsed).filter(([s, e, t]) => goldSpans.get(s) !== e + ":" + t).map(([s]) => s));
    $("#ner-demo").innerHTML = `<div class="order-row"><span class="k">gold</span><span class="ent-line" style="font-size:16px">${entLine(d.words, d.gold)}</span></div><div class="order-row"><span class="k">written</span><span class="mono" style="font-size:14.5px">${esc(d.generated)}</span></div><div class="order-row"><span class="k">parsed</span><span class="ent-line" style="font-size:16px">${entLine(d.words, d.parsed, wrong)}${d.unmatched ? ` <b style="color:var(--bad)">${d.unmatched} unmatched — not in the text</b>` : ""}</span></div>`; }
  $("#ner-demo-btns").addEventListener("click", e => { const b = e.target.closest("button"); if (!b) return; if (b.dataset.m) { fmt_ = b.dataset.m; $$("#ner-demo-btns [data-m]").forEach(x => x.classList.toggle("sel", x === b)); } else if (b.id === "ner-demo-prev") i = (i + F[fmt_].demo.length - 1) % F[fmt_].demo.length; else if (b.id === "ner-demo-next") i = (i + 1) % F[fmt_].demo.length; demo(); });
  demo();
  reveal("btn-ner-reveal", ["ner-out"], "ner-note", [betF1, betFmt, betUn]);
  $("#ner-note").innerHTML = TXT("ner-note", { inline_f1: fmt(inl.entity_f1, 2), bert_f1: fmt(W4.entity_f1, 2), list_tokens: lst.tokens_written_mean, inline_tokens: inl.tokens_written_mean, inline_unmatched: pct(inl.unmatched_share, 1), list_unmatched: pct(lst.unmatched_share, 1), list_wrong_type: pct(lst.wrong_type_share, 0), inline_wrong_type: pct(inl.wrong_type_share, 0) });
})();

/* ---- 05 QA: the schematic with two orders, the reveal, the demos */
function figOrder(mode) {
  const host = $("#fig-order"); host.innerHTML = ""; const W = 1000, H = 200, s = svg(W, H);
  const cq = mode === "cq", ctxW = 420, qW = 200, gap = 20, x0 = 60, y = 60, h = 44;
  const first = cq ? { x: x0, w: ctxW, l: "the paragraph · ~150 tokens", c: "--cls-0" } : { x: x0, w: qW, l: "the question", c: "--cls-1" };
  const second = cq ? { x: x0 + ctxW + gap, w: qW, l: "the question", c: "--cls-1" } : { x: x0 + qW + gap, w: ctxW, l: "the paragraph · ~150 tokens", c: "--cls-0" };
  [first, second].forEach(b => box(s, b.x, y, b.w, h, b.l, { fill: TINT(b.c, 12), stroke: css(b.c), fs: 13 }));
  const ax = second.x + second.w + gap; box(s, ax, y, 120, h, "the answer →", { fill: TINT("--cls-2", 12), stroke: css("--cls-2"), fs: 13 });
  // who sees whom: causal arrows
  arrow(s, second.x + second.w / 2, y + h + 18, first.x + first.w / 2, y + h + 18, { color: css("--ink-2") }); txt(s, (first.x + first.w / 2 + second.x + second.w / 2) / 2, y + h + 36, `every token of "${cq ? "the question" : "the paragraph"}" sees all of "${cq ? "the paragraph" : "the question"}"`, { fs: 12 });
  arrow(s, first.x + first.w / 2, y - 14, second.x + second.w / 2, y - 14, { color: css("--bad"), dash: 1 }); txt(s, (first.x + first.w / 2 + second.x + second.w / 2) / 2, y - 22, `"${cq ? "the paragraph" : "the question"}" was encoded without seeing "${cq ? "the question" : "the paragraph"}"`, { fs: 12, color: css("--bad") });
  arrow(s, ax + 60, y + h + 52, second.x + second.w - 10, y + h + 52, { color: css("--cls-2") }); txt(s, (ax + 60 + second.x + second.w - 10) / 2, y + h + 70, `the answer is written right after ${cq ? "the question" : "the paragraph"}`, { fs: 12, color: css("--cls-2") });
  host.appendChild(s);
  $("#fig-order-note").innerHTML = cq ? TXT("fig-order-note-cq") : TXT("fig-order-note-qc");
}
states("fig-order-btns", figOrder);
(function qaReveal() {
  const A = D.qa.artifact, O = A.orders, W4 = D.qa.week4, names = Object.keys(O), cq = O["context, question"], qc = O["question, context"];
  const best = Math.max(cq.exact_match, qc.exact_match);
  const betEm = makeBet("#bet-qa-em", ["above BERT", "within 3 points", "5–10 points below", "more than 15 below"], (() => { const d = W4.exact_match - best; return d < 0 ? 0 : d < 3 ? 1 : d < 12 ? 2 : 3; })());
  const betOrd = makeBet("#bet-qa-order", ["context, question", "question, context", "a tie"], Math.abs(cq.exact_match - qc.exact_match) < 1 ? 2 : cq.exact_match > qc.exact_match ? 0 : 1);
  const betSub = makeBet("#bet-qa-sub", ["under 5%", "5–15%", "over 15%"], Math.max(cq.not_substring, qc.not_substring) < 0.05 ? 0 : Math.max(cq.not_substring, qc.not_substring) < 0.15 ? 1 : 2);
  table($("#qa-table"), [{ h: "model", f: r => `<b>${esc(r.k)}</b>` }, { h: "exact match", num: 1, f: r => `<b>${fmt(r.em, 1)}</b>` }, { h: "F1", num: 1, f: r => fmt(r.f1, 1) }, { h: "not a substring", num: 1, f: r => pct(r.ns, 1) }, { h: "tokens read", num: 1, f: r => r.tr == null ? "L" : r.tr }, { h: "s / 1 000", num: 1, f: r => r.ms == null ? "not timed" : (r.ms / 1000).toFixed(1) }],
    [{ k: "BERT, two pointers (week 4)", em: W4.exact_match, f1: W4.f1, ns: 0 }].concat(names.map(n => ({ k: "GPT-2, " + n, em: O[n].exact_match, f1: O[n].f1, ns: O[n].not_substring, tr: O[n].tokens_read_mean, ms: O[n].ms_per_1000 }))));
  let order = "context, question", i = 0;
  function demo() { const d = O[order].demo[i]; $("#qa-demo-i").textContent = `${i + 1} / ${O[order].demo.length}`; const p = d.pred.trim(), lc = d.context.toLowerCase(), at = p ? lc.indexOf(p.toLowerCase()) : -1;
    const ctx = at >= 0 ? esc(d.context.slice(0, at)) + `<mark class="pred">${esc(d.context.slice(at, at + p.length))}</mark>` + esc(d.context.slice(at + p.length)) : esc(d.context);
    $("#qa-demo").innerHTML = `<div class="ctx" style="font-size:15.5px;color:var(--ink-2)">${order === "context, question" ? ctx + ` <span class="q">${esc(d.question)}</span>` : `<span class="q">${esc(d.question)}</span> ` + ctx}</div><div class="order-row" style="margin-top:8px"><span class="k">written</span><span>${at >= 0 ? `<b>${esc(d.pred)}</b>` : `<b class="nosub">${esc(d.pred || "(nothing)")}</b> — not a substring`} <span class="small-note" style="display:inline">EM ${d.em} · F1 ${fmt(d.f1, 2)}</span></span></div><div class="order-row"><span class="k">gold</span><span>${esc([...new Set(d.gold)].join(" / "))}</span></div>`; }
  toggle("qa-order-tgl", m => { order = m; demo(); });
  $("#qa-demo-prev").addEventListener("click", () => { i = (i + O[order].demo.length - 1) % O[order].demo.length; demo(); }); $("#qa-demo-next").addEventListener("click", () => { i = (i + 1) % O[order].demo.length; demo(); });
  demo();
  reveal("btn-qa-reveal", ["qa-out"], "qa-note", [betEm, betOrd, betSub]);
  const win = cq.exact_match >= qc.exact_match ? cq : qc, lose = win === cq ? qc : cq;
  const direction = win === cq ? TXT("qa-dir-opposite") : TXT("qa-dir-predicted"), left_out = win === cq ? TXT("qa-left-out") : "";
  $("#qa-note").innerHTML = TXT("qa-note", { bert_em: fmt(W4.exact_match, 1), gen_em: fmt(best, 1), n_train: num(A.n_train), not_substring: pct(win.not_substring, 0), direction, em_gap: (win.exact_match - lose.exact_match).toFixed(1), f1_gap: (win.f1 - lose.f1).toFixed(1), left_out });
})();

/* ---- 06 the course table */
(function course() {
  const zsBest = Math.max(...Object.values(D.zeroShot.artifact.results).map(r => r.accuracy));
  const rows = [["1", "TF-IDF, n-grams", "none — counting", "the head (logreg)", "1", fmt(DATA.tfidf.accuracy, 2)], ["1", "word2vec / fastText", "skip-gram, CBOW", "the head, over averaged vectors", "1", "below TF-IDF"], ["2", "RNN language model", "next token", "the decoding rule", "T_out", "—"], ["2–3", "seq2seq LSTM ± attention", "conditional next token", "the pair (source, target)", "T_out", "—"], ["3", "transformer encoder–decoder", "conditional next token", "the pair", "T_out", "—"], ["4", "BERT encoder", "MLM (+ NSP)", "the head: shape, attachment, axis", "1", fmt(RES.find(r => /fine-tuned BERT/.test(r.model))["test acc"], 2) + " fine-tuned"], ["5", "GPT decoder", "next token", "the prefix", "candidates or T_out", fmt(zsBest, 2) + " zero-shot"]];
  $("#course").innerHTML = `<thead><tr><th>week</th><th>body</th><th>pretraining</th><th>where the task lives</th><th>passes / item</th><th>AG News</th></tr></thead><tbody>` + rows.map((r, i) => `<tr class="${i === rows.length - 1 ? "now" : ""}">${r.map(c => `<td>${esc(c)}</td>`).join("")}</tr>`).join("") + "</tbody>";
})();

redrawAll();
