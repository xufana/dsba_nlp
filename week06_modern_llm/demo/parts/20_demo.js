"use strict";
const D = JSON.parse(document.getElementById("demo-data").textContent);

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
    document.dispatchEvent(new CustomEvent("revealed", { detail: btnId })); });
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
const SECTIONS = [["hero", "The claim", null], ["stop", "The bill", "00"], ["train", "The bill for training", "01"], ["parts", "What had to be replaced", "02"], ["serve", "The bill for serving", "03"], ["later", "Five years later", "04"], ["end", "Where this goes", "05"]];
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

/* code ↔ formula: hover any [data-f] and every element sharing a token lights up (week 3) */
function linkCodeAndFormulas() {
  const all = $$("[data-f]"); const toks = n => (n.dataset.f || "").split(/\s+/).filter(Boolean);
  all.forEach(n => { if (n._linked) return; n._linked = true;
    n.addEventListener("pointerenter", () => { const mine = toks(n); all.forEach(m => m.classList.toggle("hi", toks(m).some(t => mine.includes(t)))); });
    n.addEventListener("pointerleave", () => all.forEach(m => m.classList.remove("hi"))); });
}
/* a code panel from the notebook's own lines; `f` maps a substring of a line to its data-f tokens */
function code(host, text, f) {
  $(host).innerHTML = text.split("\n").map(l => { let tok = ""; for (const k in (f || {})) if (l.includes(k)) tok = f[k];
    const body = esc(l).replace(/^(\s*)(def|class|return|for|in|if|else|import|from|with)\b/g, '$1<span class="kw">$2</span>').replace(/(#.*)$/, '<span class="c">$1</span>');
    return `<span class="ln"${tok ? ` data-f="${tok}"` : ""}>${body}</span>`; }).join("");
  linkCodeAndFormulas();
}

/* ========================================================== number formats */
const human = x => { if (x == null || x === "") return "—"; x = Number(x); const a = Math.abs(x);
  if (a >= 1e15) return x.toExponential(2).replace("e+", " × 10^"); for (const [u, s] of [["T", 1e12], ["B", 1e9], ["M", 1e6]]) if (a >= s) return +(x / s).toPrecision(3) + u;
  if (a >= 100) return num(Math.round(x)); if (a >= 1) return String(+x.toPrecision(3)); return String(+x.toPrecision(3)); };
const sci = x => { const e = Math.floor(Math.log10(Math.abs(x))), m = x / Math.pow(10, e); return `${m.toFixed(2)} × 10<sup>${e}</sup>`; };
const gib = b => b / 2 ** 30;

/* =============================================================== 00 the bill, growing */
const BILL = D.bill, RES = D.results;
/* which reveal unlocks which column of the bill, and which rows */
const COL_GATE = { "N": "line", "D": "line", "tokens / param": "btn-plane-reveal", "train FLOPs": "btn-plane-reveal", "weights, GiB fp16": "btn-cache-reveal", "cache, KB / token": "btn-cache-reveal", "active N": "btn-moe-reveal" };
const ROW_GATE = r => /Mixtral|gpt-oss/.test(r) ? "btn-moe-reveal" : "line";
const RES_GATE = r => /week [145]/.test(r.model) ? "line" : /ModernBERT/.test(r.model) ? "btn-zs-reveal" : "btn-zs-reveal";
const ON = new Set(); let LAST = null;
const billCell = (col, v) => v == null ? "—" : /FLOPs/.test(col) ? sci(v) : /GiB/.test(col) ? v.toFixed(2) : /KB/.test(col) ? v.toFixed(1) : /tokens/.test(col) ? num(Math.round(v)) : human(v);
function drawBill(host, all) {
  const cols = BILL.cols.filter(c => all || COL_GATE[c] === "line" || ON.has(COL_GATE[c]));
  const rows = BILL.rows.filter(r => all || ROW_GATE(r) === "line" || ON.has(ROW_GATE(r)));
  table(host, [{ h: "model", f: r => `<b>${esc(r)}</b>` }].concat(cols.map(c => ({ h: c, num: 1, f: r => billCell(c, BILL.cells[r][c]) }))), rows.map(r => Object.assign(new String(r), { _new: !all && LAST && (COL_GATE[cols[cols.length - 1]] === LAST || ROW_GATE(r) === LAST) })));
  return cols.length;
}
const RES_COLS = [{ h: "model", f: r => esc(r.model) }, { h: "test acc", num: 1, f: r => `<b>${fmt(r["test acc"], 4)}</b>` }, { h: "note", mono: 1, f: r => `<span style="font-size:13.5px">${esc(r.note)}</span>` }];
function drawTables() {
  const n = drawBill($("#bill-0"), false);
  $("#bill-0-n").textContent = `${n} of ${BILL.cols.length} columns`;
  table($("#results-0"), RES_COLS, RES.filter(r => RES_GATE(r) === "line" || ON.has(RES_GATE(r))).map((r, i) => Object.assign({ _hl: i === 0, _new: ON.has(RES_GATE(r)) && LAST === RES_GATE(r) }, r)));
  drawBill($("#bill-1"), true);
  table($("#results-1"), RES_COLS, RES.map((r, i) => Object.assign({ _hl: i === 0 }, r)));
}
drawTables();
(function scoreboard() {
  const short = c => c.replace("tokens / param", "tokens/param").replace("train FLOPs", "6ND").replace("weights, GiB fp16", "weights").replace("cache, KB / token", "cache/token");
  function drawBoard() {
    $("#score").innerHTML = `<div class="t">the bill · columns</div>` + BILL.cols.map(c => { const vis = COL_GATE[c] === "line" || ON.has(COL_GATE[c]);
      return `<div class="row ${vis ? "on" : "off"}"><span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(short(c))}</span><span class="v">${vis ? "✓" : "·"}</span></div>`; }).join("") +
      `<div class="t" style="margin-top:8px">AG News · test acc</div>` + RES.map(r => { const vis = RES_GATE(r) === "line" || ON.has(RES_GATE(r));
      return `<div class="row ${vis ? "on" : "off"}"><span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(r.model.replace(/zero-shot scorer, /, "scorer, ").replace(/ \(week \d\)/, "").replace("fine-tuned ", "ft "))}</span><span class="v">${vis ? fmt(r["test acc"], 3) : "·"}</span></div>`; }).join("");
  }
  drawBoard();
  document.addEventListener("revealed", e => { ON.add(e.detail); LAST = e.detail; drawTables(); drawBoard(); });
})();
