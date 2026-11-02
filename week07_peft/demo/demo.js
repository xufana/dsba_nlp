/* week 7 — the interactive part. demo_base/base.js (TXT) is prepended at build; the data is in #demo-data. */
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

/* ====================================================== schematics and interactives */
const TEXT_W = (t, fs) => String(t).length * fs * 0.61 + 14;
function box(s, x, y, w, h, label, o) { o = o || {}; let fs = o.fs || 14;
  if (label != null && label !== "") { const need = TEXT_W(label, fs); if (need > w) { if (o.grow) { const cx = x + w / 2; w = need; x = cx - w / 2; } else fs = Math.max(8, fs * (w - 6) / (need - 8)); } }
  const r = el("rect", { x, y, width: w, height: h, rx: o.rx == null ? 6 : o.rx, fill: "none", stroke: o.stroke || css("--rule-strong"), "stroke-width": o.sw || 1.4, "stroke-dasharray": o.dash ? "5 4" : "none" }); r.style.fill = o.fill || "var(--panel-sunk)"; s.appendChild(r);
  if (label != null) { const t = el("text", { x: x + w / 2, y: y + h / 2 + fs * .36, "font-size": fs, "text-anchor": "middle", fill: o.color || css("--ink"), "font-weight": o.bold ? "600" : "400" }, label); s.appendChild(t); }
  r.box = { x, y, w, h }; return r; }
function txt(s, x, y, t, o) { o = o || {}; return s.appendChild(el("text", { x, y, "font-size": o.fs || 13.5, "text-anchor": o.anchor || "middle", fill: o.color || css("--ink-2"), "font-weight": o.bold ? "600" : "400", "font-style": o.italic ? "italic" : "normal", "font-family": o.mono ? "var(--mono)" : "inherit" }, t)); }
function arrow(s, x1, y1, x2, y2, o) { o = o || {}; const color = o.color || css("--ink-2"), id = "arr-" + String(color).replace(/[^a-z0-9]/gi, "");
  if (!s.querySelector("#" + id)) { let defs = s.querySelector("defs"); if (!defs) { defs = el("defs", {}); s.appendChild(defs); } const m = el("marker", { id, viewBox: "0 0 10 10", refX: 9, refY: 5, markerWidth: 6, markerHeight: 6, orient: "auto-start-reverse" }); m.appendChild(el("path", { d: "M 0 0 L 10 5 L 0 10 z", fill: color })); defs.appendChild(m); }
  s.appendChild(el("path", { d: o.d || `M ${x1} ${y1} L ${x2} ${y2}`, fill: "none", stroke: color, "stroke-width": o.sw || 1.6, "stroke-dasharray": o.dash ? "4 4" : "none", "marker-end": o.noHead ? "none" : `url(#${id})` })); }
const TINT = (v, pct) => `color-mix(in srgb, var(${v}) ${pct}%, var(--panel))`;
function states(btnsId, draw) {
  let mode = $(`#${btnsId} button.sel`).dataset.m; draw(mode); REDRAW.push(() => draw(mode));
  $(`#${btnsId}`).addEventListener("click", e => { const b = e.target.closest("button[data-m]"); if (!b) return; mode = b.dataset.m; $$(`#${btnsId} button`).forEach(x => x.classList.toggle("sel", x === b)); draw(mode); });
  return m => { mode = m; $$(`#${btnsId} button`).forEach(x => x.classList.toggle("sel", x.dataset.m === m)); draw(m); };
}
const slider = (id, fmt, on) => { const inp = $("#" + id), lab = $("#" + id + "-v"); const f = () => { if (lab) lab.textContent = fmt(+inp.value); on(+inp.value); }; inp.addEventListener("input", f); f(); return f; };
const CLSC = ["--cls-0", "--cls-1", "--cls-2", "--cls-3"];
const bar = (host, rows) => { host.innerHTML = rows.map(r => `<div class="pbar"><span class="lab" title="${esc(r.label)}">${esc(r.label)}</span><span class="bar"><i style="width:${(100 * r.p).toFixed(1)}%${r.color ? ";background:" + r.color : ""}"></i></span><span class="v">${r.text}</span></div>`).join(""); };
const okText = (ok, t) => `<b class="${ok ? "" : "no"}">${ok ? "✓" : "✗"}</b> ${t}`;
const near = (a, b, tol) => Math.abs(a - b) <= (tol || 1e-6) * Math.max(1, Math.abs(b));
function orderPick(hostId, names, trueOrder) {
  const host = $("#" + hostId); let order = []; let done = false;
  const draw = () => { host.innerHTML = names.map(n => { const i = order.indexOf(n); const cls = done ? (i >= 0 && trueOrder[i] === n ? "right" : i >= 0 ? "wrong" : "") : (i >= 0 ? "pick" : ""); return `<button data-n="${esc(n)}" class="${cls}">${i >= 0 ? `<i>${i + 1}</i>` : ""}${esc(n)}</button>`; }).join("") + (done ? `<span class="arrow">· the measured order: ${trueOrder.map(esc).join(" › ")}</span>` : order.length ? `<span class="arrow">${order.length} of ${names.length} ranked</span>` : ""); };
  host.addEventListener("click", e => { const b = e.target.closest("button[data-n]"); if (!b || done) return; const n = b.dataset.n; if (order.includes(n)) order = order.filter(x => x !== n); else order.push(n); draw(); });
  draw(); return { reveal: () => { done = true; draw(); return order.length === names.length && order.every((n, i) => n === trueOrder[i]); } };
}

/* ------------------------------------------------------------------ nav */
const SECTIONS = [["hero", "The claim", null], ["probe", "Head or body", "01"], ["prompt", "Prompt tuning", "02"], ["adapters", "Adapters", "03"], ["lora", "LoRA", "04"], ["map", "Where the parameters go", "05"], ["bill", "What it saves", "06"], ["end", "The scoreboard", "07"]];
(function buildNav() {
  const nav = $("#nav"); nav.innerHTML = SECTIONS.map(([id, t, n]) => `<a href="#${id}" data-id="${id}"><span>${n === null ? "·" : n}</span><span>${esc(t)}</span></a>`).join("");
  const links = $$("#nav a"); const io = new IntersectionObserver(ents => { ents.forEach(e => { if (e.isIntersecting) links.forEach(a => a.classList.toggle("on", a.dataset.id === e.target.id)); }); }, { rootMargin: "-15% 0px -70% 0px" });
  SECTIONS.forEach(([id]) => { const n = document.getElementById(id); if (n) io.observe(n); });
})();

/* the rail keeps the tally of bets */
const TALLY = { right: 0, placed: 0, total: 0 };
setTimeout(() => { if (!TALLY.total) $("#score").innerHTML = `<div class="t">your bets</div><div class="row"><span>right</span><b>0 / 0</b></div>`; });
function tally(ok, placed) { TALLY.total++; if (placed) TALLY.placed++; if (ok) TALLY.right++;
  $("#score").innerHTML = `<div class="t">your bets</div><div class="row on"><span>right</span><b>${TALLY.right} / ${TALLY.total}</b></div>`; }
/* a reveal: bets first, then the hidden output, the note, and the tally */
function revealBets(btnId, bets, after) {
  $("#" + btnId).addEventListener("click", e => { bets.forEach(b => { const placed = b.pick !== null; tally(b.reveal(), placed); });
    const p = e.target.closest(".panel"); const veil = p.querySelector(".veil"); if (veil) veil.remove(); $$("[hidden]", p).forEach(n => { if (n.id !== "mem-out") n.hidden = false; });
    e.target.disabled = true; e.target.textContent = "revealed"; if (after) after(); document.dispatchEvent(new CustomEvent("revealed", { detail: btnId })); });
}
function rng(seed) { return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
function gaussian(R) { return () => { const u = 1 - R(), v = R(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); }; }

const RUN = D.run, G = D.gpt2, M = D.meta, P = D.paper;
const accTxt = a => (100 * a).toFixed(1) + "%";
const human = x => { const a = Math.abs(x); for (const [u, k] of [["B", 1e9], ["M", 1e6], ["k", 1e3]]) if (a >= k) return +(x / k).toPrecision(3) + u; return String(x); };
const mb = b => b >= 1e9 ? (b / 1e9).toFixed(1) + " GB" : (b / 1e6).toFixed(b < 1e7 ? 2 : 0) + " MB";

/* ====================================================== GPT-2's parameter count, from its shapes */
const GP = (() => { const d = G.d, f = G.ffn, L = G.layers;
  const lin = { c_attn: [d, 3 * d], attn_proj: [d, d], c_fc: [d, f], mlp_proj: [f, d] };
  const block = Object.values(lin).reduce((a, [i, o]) => a + i * o + o, 0) + 2 * 2 * d;
  const total = L * block + G.vocab * d + G.positions * d + 2 * d + d * G.classes;
  const biases = L * (Object.values(lin).reduce((a, [, o]) => a + o, 0) + 2 * d) + d;
  return { lin, block, total, biases, head: d * G.classes, lnAll: L * 4 * d + 2 * d }; })();
function trainable(mode, o) { o = o || {}; const d = G.d, L = G.layers;
  if (mode === "ft") return GP.total;
  if (mode === "lp") return GP.head;
  if (mode === "bitfit") return GP.biases + GP.head;
  if (mode === "adapter") { const m = o.m || 64; return L * 2 * (2 * d * m + m + d) + GP.lnAll + GP.head; }
  if (mode === "pt") return (o.n || 12) * d + GP.head;
  if (mode === "lora") { const r = o.r || 8, t = o.t || "c_attn"; const mats = t === "c_attn" ? ["c_attn"] : t === "attn" ? ["c_attn", "attn_proj"] : ["c_attn", "attn_proj", "c_fc", "mlp_proj"];
    return L * mats.reduce((a, k) => a + r * (GP.lin[k][0] + GP.lin[k][1]), 0) + GP.head; }
}

/* ====================================================== hero */
(function hero() {
  $("#hero-trained").textContent = `trained: ${(100 * RUN.lora.trainable / GP.total).toFixed(2)}%`;
  $("#hero-note").innerHTML = TXT("hero-note", { device: M.device, steps: num(M.steps), batch: M.batch, n_valid: M.n_valid });
})();

/* ====================================================== 01 Kumar et al. */
(function kumar() {
  const K = P.kumar; $("#kumar-src").textContent = "Kumar et al. (2022)";
  const b1 = makeBet("#bet-kumar-id", ["fine-tuning", "the head alone"], K.id.FT > K.id.LP ? 0 : 1);
  const b2 = makeBet("#bet-kumar-ood", ["fine-tuning", "the head alone"], K.ood.FT > K.ood.LP ? 0 : 1);
  const cols = ["FT", "LP", "LP-FT"], names = { FT: "fine-tuning", LP: "probing", "LP-FT": "probing → fine-tuning" };
  const row = (lab, r) => { const best = Math.max(...cols.map(c => r[c])); return `<tr><td>${lab}</td>${cols.map(c => `<td class="num">${r[c] === best ? "<b>" : ""}${r[c].toFixed(1)}%${r[c] === best ? "</b>" : ""}</td>`).join("")}</tr>`; };
  $("#kumar-table").innerHTML = `<thead><tr><th></th>${cols.map(c => `<th class="num">${names[c]}</th>`).join("")}</tr></thead><tbody>${row("ID test", K.id)}${row("OOD test", K.ood)}</tbody>`;
  revealBets("btn-kumar-reveal", [b1, b2], () => { $("#kumar-note").innerHTML = TXT("kumar-note", { id_gap: (K.id.FT - K.id.LP).toFixed(1), ood_gap: (K.ood.LP - K.ood.FT).toFixed(1) }) + `<div class="small-note">${esc(K.src)}</div>`; });
})();

/* ====================================================== 01 the toy: LP, FT, LP-FT in the page */
const TOY = (() => {
  const R = rng(3), gs = gaussian(R);
  const mk = axis => Array.from({ length: 40 }, (_, i) => { const t = (i % 2 ? 1 : -1) * (0.3 + 1.2 * R()), e = 0.03 * gs(); return { x: axis === 0 ? [t, e] : [e, t], y: t > 0 ? 1 : 0 }; });
  const ID = mk(0), OOD = mk(1); const sig = z => 1 / (1 + Math.exp(-z));
  function train(p, steps, body) { p = { ...p }; const lr = 0.5, n = ID.length;
    for (let s = 0; s < steps; s++) { let gv = 0, g1 = 0, g2 = 0;
      for (const d of ID) { const z = p.b1 * d.x[0] + p.b2 * d.x[1], e = sig(p.v * z) - d.y; gv += e * z; g1 += e * p.v * d.x[0]; g2 += e * p.v * d.x[1]; }
      p.v -= lr * gv / n; if (body) { p.b1 -= lr * g1 / n; p.b2 -= lr * g2 / n; } }
    return p; }
  const acc = (p, Dset) => Dset.filter(d => (p.v * (p.b1 * d.x[0] + p.b2 * d.x[1]) > 0) === (d.y === 1)).length / Dset.length;
  const pre = { b1: 0.5, b2: 0.5, v: -1.0 }; const lp = train(pre, 300, false);
  const S = { pre, lp, ft: train(pre, 300, true), lpft: train(lp, 300, true) };
  return { ID, OOD, S, acc };
})();
(function toy() {
  const NAMES = { pre: "pretrained, random head", lp: "LP", ft: "FT", lpft: "LP → FT" }; const seen = new Set();
  const bet = makeBet("#bet-toy", ["they stay right", "some of them flip", "all of them flip"], (() => { const a = TOY.acc(TOY.S.ft, TOY.OOD); return a > 0.95 ? 0 : a < 0.05 ? 2 : 1; })());
  let betDone = false;
  function draw(mode) {
    const host = $("#fig-toy"); host.innerHTML = ""; const W = 440, H = 440, c = W / 2, k = 125; const s = svg(W, H); s.style.maxWidth = "440px";
    const X = v => c + v * k, Y = v => c - v * k;
    s.appendChild(el("line", { x1: 20, x2: W - 20, y1: c, y2: c, stroke: css("--rule-strong") })); s.appendChild(el("line", { x1: c, x2: c, y1: 20, y2: H - 20, stroke: css("--rule-strong") }));
    txt(s, 24, c + 22, "x₁ · training data", { anchor: "start", fs: 13 }); txt(s, c - 8, 34, "x₂ · OOD data", { anchor: "end", fs: 13 });
    const line = (p, o) => { const nx = p.v * p.b1, ny = p.v * p.b2, L = 1.75; const tx = -ny, ty = nx, nn = Math.hypot(tx, ty) || 1; // boundary: n·x = 0
      s.appendChild(el("line", { x1: X(L * tx / nn), y1: Y(L * ty / nn), x2: X(-L * tx / nn), y2: Y(-L * ty / nn), stroke: o.color, "stroke-width": o.sw || 2.4, "stroke-dasharray": o.dash ? "6 5" : "none" }));
      const hn = Math.hypot(nx, ny) || 1; arrow(s, c, c, X(0.55 * nx / hn), Y(0.55 * ny / hn), { color: o.color, sw: o.sw || 2 });
      if (o.label) txt(s, X(0.75 * nx / hn), Y(0.75 * ny / hn) + 4, o.label, { color: o.color, fs: 13, bold: true }); };
    seen.forEach(m => { if (m !== mode) line(TOY.S[m], { color: css("--ink-3"), dash: true, sw: 1.4, label: NAMES[m] === NAMES.pre ? "" : NAMES[m] }); });
    line(TOY.S[mode], { color: css("--cls-1"), label: mode === "pre" ? "head" : NAMES[mode] });
    const p = TOY.S[mode]; const right = (d) => (p.v * (p.b1 * d.x[0] + p.b2 * d.x[1]) > 0) === (d.y === 1);
    TOY.ID.forEach(d => { const cc = el("circle", { cx: X(d.x[0]), cy: Y(d.x[1]), r: 5.5, fill: css(d.y ? "--cls-2" : "--cls-0"), stroke: right(d) ? css("--panel") : css("--bad"), "stroke-width": right(d) ? 1 : 2.5 }); s.appendChild(cc); });
    TOY.OOD.forEach(d => { const r = el("rect", { x: X(d.x[0]) - 5, y: Y(d.x[1]) - 5, width: 10, height: 10, fill: css(d.y ? "--cls-2" : "--cls-0"), stroke: right(d) ? css("--panel") : css("--bad"), "stroke-width": right(d) ? 1 : 2.5 }); s.appendChild(r); });
    txt(s, 24, H - 26, "fill: the true label · red outline: wrong", { anchor: "start", fs: 12, color: css("--ink-3") }); txt(s, 24, H - 10, "arrow: the side the model calls positive", { anchor: "start", fs: 12, color: css("--ink-3") });
    host.appendChild(s);
    $("#toy-out").innerHTML = ["pre", "lp", "ft", "lpft"].filter(m => m === mode || seen.has(m)).map(m => { const q = TOY.S[m];
      return `<div class="toy-row${m === mode ? " on" : ""}">${TXT("toy-result", { name: `<b>${esc(NAMES[m])}</b>`, id: accTxt(TOY.acc(q, TOY.ID)), ood: accTxt(TOY.acc(q, TOY.OOD)), b1: q.b1.toFixed(2), b2: q.b2.toFixed(2), v: q.v.toFixed(2) })}</div>`; }).join("");
    $("#toy-status").textContent = mode === "pre" ? "pick a way to train" : `${NAMES[mode]} · 300 steps of gradient descent on the 40 training dots`;
    seen.add(mode);
    if (mode === "ft" && !betDone) { betDone = true; tally(bet.reveal(), bet.pick !== null); $("#toy-note").hidden = false; }
  }
  states("toy-btns", draw);
})();

/* ====================================================== 02 prompt tuning */
(function prompt() {
  const PT = D.prompt; let mode = "text";
  const nIn = $("#prompt-n");
  function draw() { const n = +nIn.value; $("#prompt-n-v").textContent = n;
    $("#prompt-n-out").textContent = `${num(n * G.d)} + ${num(GP.head)} (head) = ${num(trainable("pt", { n }))} trainable`;
    const host = $("#fig-prompt"); host.innerHTML = ""; const sample = PT.sample.filter(t => t.trim()), cols = n + sample.length;
    const cw = Math.min(58, 1040 / cols), W = Math.max(640, cols * cw + 40), H = 300; const s = svg(W, H); s.style.maxWidth = W + "px";
    const x0 = 20, yE = 150, h = 54;
    for (let i = 0; i < cols; i++) { const soft = i < n, x = x0 + i * cw;
      box(s, x + 2, yE, cw - 4, h, "", { fill: soft ? TINT("--cls-1", 55) : "var(--panel-sunk)", stroke: soft ? css("--cls-1") : css("--rule-strong") });
      const lab = soft ? (mode === "text" ? PT.init[i % PT.init.length] : `p${i + 1}`) : sample[i - n];
      const t = txt(s, x + cw / 2 + 4, yE + h + 14, lab.replace(/^ /, "␣"), { fs: 12.5, mono: true, anchor: "end", color: soft ? css("--cls-1") : css("--ink-2") }); t.setAttribute("transform", `rotate(-45 ${x + cw / 2 + 4} ${yE + h + 14})`);
      if (soft && mode === "text" && i >= PT.init.length) t.setAttribute("font-weight", "700");
      if (!soft) s.appendChild(el("line", { x1: x + cw / 2, x2: x + cw / 2, y1: yE, y2: 96, stroke: css("--rule") }));
    }
    box(s, x0, 50, cols * cw, 46, "GPT-2 · 12 frozen blocks, causal attention", { fs: 14 });
    const last = x0 + (cols - 1) * cw + cw / 2; arrow(s, last, 50, last, 22); txt(s, last - 8, 18, "head reads the last token", { anchor: "end", fs: 12.5 });
    txt(s, x0, yE - 10, `${n} trainable vectors × 768`, { anchor: "start", fs: 13, color: css("--cls-1"), bold: true });
    txt(s, x0 + n * cw + 4, yE - 10, "the review: frozen embeddings", { anchor: "start", fs: 13 });
    if (mode === "text" && n > PT.init.length) txt(s, x0 + cols * cw, 118, `the init text has ${PT.init.length} tokens; peft repeats it to fill ${n}`, { anchor: "end", fs: 12, color: css("--ink-3") });
    host.appendChild(s); }
  nIn.addEventListener("input", draw); toggle("prompt-init", m => { mode = m; draw(); }); draw(); REDRAW.push(draw);
  const pt = RUN.pt.acc, lora = RUN.lora.acc, lp = RUN.lp.acc;
  $("#prompt-meta").textContent = `${M.device}, ${M.year}`;
  const bet = makeBet("#bet-prompt", ["within a point of LoRA", "a few points below", "far below — near the head alone"], lora - pt < 0.01 ? 0 : lora - pt < 0.06 ? 1 : 2);
  revealBets("btn-prompt-reveal", [bet], () => {
    bar($("#prompt-out"), [["lora", "LoRA"], ["lp", "head only"], ["pt", "prompt, 12"]].map(([k, l]) => ({ label: `${l} · ${human(RUN[k].trainable)}`, p: RUN[k].acc, text: accTxt(RUN[k].acc), color: css(k === "pt" ? "--cls-1" : "--ink-3") })));
    $("#prompt-note").innerHTML = TXT("prompt-note2", { pt: accTxt(pt), lora: accTxt(lora), gap: (100 * (lora - pt)).toFixed(1), below_lp: pt < lp ? TXT("prompt-below") : TXT("prompt-above") }); });
})();

/* ====================================================== 03 adapters: the picture and the latency */
(function adapterFig() {
  function draw() { const host = $("#fig-adapter"); host.innerHTML = ""; const W = 900, H = 330; const s = svg(W, H); s.style.maxWidth = "900px";
    // left: adapter in series
    const lx = 40; txt(s, lx + 170, 24, "Adapter: in series", { bold: true, fs: 15, color: css("--ink") });
    box(s, lx + 90, 270, 160, 30, "x", { fill: "var(--panel)" });
    box(s, lx + 90, 200, 160, 40, "layer W (frozen)", { fs: 13.5 });
    arrow(s, lx + 170, 270, lx + 170, 242);
    const ad = { x: lx + 70, y: 70, w: 200, h: 100 };
    const r = el("rect", { x: ad.x, y: ad.y, width: ad.w, height: ad.h, rx: 8, fill: "none", stroke: css("--cls-1"), "stroke-width": 1.6, "stroke-dasharray": "5 4" }); s.appendChild(r);
    box(s, ad.x + 30, ad.y + 64, 140, 26, "down: 768 → m", { fs: 12.5, fill: TINT("--cls-1", 45), stroke: css("--cls-1") });
    box(s, ad.x + 30, ad.y + 10, 140, 26, "up: m → 768", { fs: 12.5, fill: TINT("--cls-1", 45), stroke: css("--cls-1") });
    txt(s, ad.x + 100, ad.y + 55, "nonlinearity", { fs: 12, color: css("--ink-3") });
    arrow(s, lx + 170, 200, lx + 170, ad.y + 92); arrow(s, ad.x + 100, ad.y + 64, ad.x + 100, ad.y + 38);
    arrow(s, lx + 170, 186, lx + 170, 186, { d: `M ${lx + 250} 220 C ${lx + 320} 220, ${lx + 320} 50, ${lx + 186} 50`, dash: true });
    s.appendChild(el("circle", { cx: lx + 170, cy: 50, r: 11, fill: css("--panel"), stroke: css("--ink-2"), "stroke-width": 1.4 })); txt(s, lx + 170, 55, "+", { fs: 16 });
    arrow(s, lx + 170, ad.y, lx + 170, 62); txt(s, lx + 300, 140, "skip", { fs: 12, color: css("--ink-3") });
    txt(s, lx + 170, 322, "one more step after every layer", { fs: 13, color: css("--ink-3") });
    // right: LoRA in parallel
    const rx = 500; txt(s, rx + 180, 24, "LoRA: in parallel", { bold: true, fs: 15, color: css("--ink") });
    box(s, rx + 100, 270, 160, 30, "x", { fill: "var(--panel)" });
    box(s, rx + 40, 140, 150, 60, "W (frozen)", { fs: 13.5 });
    box(s, rx + 220, 172, 110, 26, "A: 768 → r", { fs: 12.5, fill: TINT("--cls-1", 45), stroke: css("--cls-1") });
    box(s, rx + 220, 112, 110, 26, "B: r → 768", { fs: 12.5, fill: TINT("--cls-1", 45), stroke: css("--cls-1") });
    arrow(s, rx + 180, 270, rx + 115, 202); arrow(s, rx + 180, 270, rx + 275, 200); arrow(s, rx + 275, 172, rx + 275, 140);
    s.appendChild(el("circle", { cx: rx + 180, cy: 60, r: 11, fill: css("--panel"), stroke: css("--ink-2"), "stroke-width": 1.4 })); txt(s, rx + 180, 65, "+", { fs: 16 });
    arrow(s, rx + 115, 140, rx + 172, 70); arrow(s, rx + 275, 112, rx + 188, 70); txt(s, rx + 200, 56, "h", { fs: 14, mono: true, anchor: "start" });
    txt(s, rx + 180, 322, "merged into W after training: no extra step", { fs: 13, color: css("--ink-3") });
    host.appendChild(s); }
  draw(); REDRAW.push(draw);
  const T = P.latency; $("#latency-src").textContent = "Hu et al. (2021), Table 1";
  const pct = (row, i) => 100 * (T.rows[row][i] / T.rows["fine-tuned / LoRA merged"][i] - 1);
  const worst = Object.keys(T.rows)[2]; const bet = makeBet("#bet-latency", ["batch 32 × 512 tokens", "one request of 128 tokens"], pct(worst, 2) > pct(worst, 0) ? 1 : 0);
  $("#latency-table").innerHTML = `<thead><tr><th></th>${T.cols.map(c => `<th class="num">batch ${c.batch} × ${c.seq} tokens</th>`).join("")}</tr></thead><tbody>` +
    Object.entries(T.rows).map(([k, v], ri) => `<tr><td>${esc(k)}</td>${v.map((ms, i) => `<td class="num">${ms.toFixed(1)} ms${ri ? ` <b>(+${pct(k, i).toFixed(1)}%)</b>` : ""}</td>`).join("")}</tr>`).join("") + "</tbody>";
  revealBets("btn-latency-reveal", [bet], () => { $("#latency-note").innerHTML = TXT("latency-note", { big: pct(worst, 0).toFixed(1), small: pct(worst, 2).toFixed(1) }) + `<div class="small-note">${esc(T.src)}</div>`; });
})();

/* ====================================================== 04 LoRA: the layer with states */
(function loraFig() {
  function draw(mode) { const host = $("#fig-lora"); host.innerHTML = ""; const W = 800, H = 380; const s = svg(W, H); s.style.maxWidth = "800px";
    const merged = mode === "merge", training = mode === "train";
    box(s, 210, 330, 340, 30, "", { fill: TINT("--cls-3", 35), stroke: css("--cls-3") }); txt(s, 190, 351, "x", { fs: 17, mono: true, anchor: "end", color: css("--ink") }); txt(s, 380, 351, "k = 768", { fs: 12.5, color: css("--ink-2") });
    box(s, 210, 22, 340, 30, "", { fill: TINT("--cls-3", 35), stroke: css("--cls-3") }); txt(s, 190, 43, "h", { fs: 17, mono: true, anchor: "end", color: css("--ink") }); txt(s, 380, 43, "d", { fs: 12.5, color: css("--ink-2") });
    const wx = merged ? 230 : 150, ww = merged ? 300 : 230;
    const wb = box(s, wx, 110, ww, 180, "", { fill: merged ? TINT("--cls-1", 25) : "var(--panel-sunk)", stroke: merged ? css("--cls-1") : css("--rule-strong") });
    txt(s, wx + ww / 2, 185, merged ? "W′ = W + (α/r)·BA" : "W", { fs: merged ? 17 : 24, color: css("--ink"), italic: !merged });
    txt(s, wx + ww / 2, 212, merged ? "one matrix again: inference as before" : "pretrained · frozen", { fs: 13, color: css("--ink-3") });
    txt(s, wx + ww / 2, 236, "d × k", { fs: 13, mono: true, color: css("--ink-3") });
    if (!merged) {
      const tr = (y, top, bot, fill, label, sub) => { s.appendChild(el("path", { d: `M ${520 - top / 2} ${y} L ${520 + top / 2} ${y} L ${520 + bot / 2} ${y + 62} L ${520 - bot / 2} ${y + 62} Z`, fill, stroke: css("--cls-1"), "stroke-width": 1.5 }));
        txt(s, 520, y + 36, label, { fs: 16, color: css("--ink"), italic: true }); txt(s, 630, y + 36, sub, { fs: 12.5, anchor: "start", color: css("--ink-2") }); };
      tr(110, 200, 64, training ? TINT("--cls-1", 55) : TINT("--cls-1", 30), "B", mode === "init" ? "B = 0 · d × r" : "d × r, trained");
      tr(228, 64, 200, training ? TINT("--cls-1", 55) : TINT("--cls-1", 30), "A", mode === "init" ? "A ~ N(0, σ²) · r × k" : "r × k, trained");
      txt(s, 560, 205, "r = 8", { fs: 13, mono: true, anchor: "start", color: css("--cls-1") });
      arrow(s, 265, 330, 265, 292); arrow(s, 520, 330, 520, 292); arrow(s, 520, 228, 520, 174);
      arrow(s, 265, 110, 360, 54); arrow(s, 520, 110, 400, 54); txt(s, 380, 84, "+", { fs: 22, color: css("--ink") });
      if (training) { txt(s, 630, 205, "gradients only here", { fs: 13, anchor: "start", color: css("--cls-1"), bold: true }); txt(s, 140, 300, "no gradient for W", { fs: 13, anchor: "end", color: css("--ink-3") }); }
      if (mode === "init") { txt(s, 140, 282, "BA = 0:", { fs: 13, anchor: "end", color: css("--ink-2"), bold: true }); txt(s, 140, 300, "h = Wx exactly", { fs: 13, anchor: "end", color: css("--ink-2") }); }
    } else { arrow(s, 380, 330, 380, 292); arrow(s, 380, 110, 380, 54); txt(s, 560, 200, "A and B are gone", { fs: 13, anchor: "start", color: css("--ink-3") }); txt(s, 560, 218, "(or kept aside to swap)", { fs: 13, anchor: "start", color: css("--ink-3") }); }
    host.appendChild(s); }
  states("lora-btns", draw);
})();

/* ====================================================== 04 init: three ways, trained in the page */
(function initToy() {
  const n = 16, r = 4, R = rng(11), gs = gaussian(R);
  const mat = (a, b, f) => Array.from({ length: a }, () => Array.from({ length: b }, f));
  const U = mat(n, 2, gs), V = mat(2, n, gs); const target = mat(n, n, () => 0).map((row, i) => row.map((_, j) => (U[i][0] * V[0][j] + U[i][1] * V[1][j]) / 2));
  const X = mat(64, n, gs);
  function run(initA, initB) { const A = mat(r, n, initA), B = mat(n, r, initB), lr = 0.05, losses = [];
    for (let step = 0; step <= 200; step++) { let loss = 0; const gA = mat(r, n, () => 0), gB = mat(n, r, () => 0);
      for (const x of X) { const ax = A.map(row => row.reduce((a, w, j) => a + w * x[j], 0)); const y = B.map(row => row.reduce((a, w, j) => a + w * ax[j], 0));
        const t = target.map(row => row.reduce((a, w, j) => a + w * x[j], 0)); const e = y.map((v, i) => v - t[i]); loss += e.reduce((a, v) => a + v * v, 0) / n;
        for (let i = 0; i < n; i++) for (let j = 0; j < r; j++) gB[i][j] += 2 * e[i] * ax[j] / n;
        const bt = Array.from({ length: r }, (_, j) => e.reduce((a, v, i) => a + v * B[i][j], 0));
        for (let j = 0; j < r; j++) for (let k = 0; k < n; k++) gA[j][k] += 2 * bt[j] * x[k] / n; }
      losses.push(loss / X.length);
      for (let i = 0; i < n; i++) for (let j = 0; j < r; j++) B[i][j] -= lr * gB[i][j] / X.length;
      for (let j = 0; j < r; j++) for (let k = 0; k < n; k++) A[j][k] -= lr * gA[j][k] / X.length; }
    return losses; }
  const bet = makeBet("#bet-init", ["trains as usual", "trains, but slower", "never moves", "blows up"], 2);
  $("#btn-init-reveal").addEventListener("click", e => { e.target.disabled = true; e.target.textContent = "trained";
    const z = () => 0, g = () => 0.3 * gs(); const runs = [["A random, B = 0 (LoRA)", run(g, z), "--cls-1"], ["A = 0, B random", run(z, g), "--cls-2"], ["A = 0, B = 0", run(z, z), "--ink-3"]];
    lineChart($("#init-chart"), { W: 900, H: 300, series: runs.map(([label, y, c], i) => ({ label, x: y.map((_, k) => k), y, color: css(c), nodots: true, dash: i === 1 })), xlabel: "step", ylabel: "loss", ymin: 0, ymax: 1.5 * Math.max(...runs.map(x => x[1][0])), legendX: 560 });
    $("#init-status").textContent = `rank ${r}, target: a rank-2 update of a ${n} × ${n} layer, ${X.length} inputs`;
    tally(bet.reveal(), bet.pick !== null); $("#init-note").hidden = false; document.dispatchEvent(new CustomEvent("revealed", { detail: "btn-init-reveal" })); });
})();

/* ====================================================== 04 rank: W against ΔW */
(function rank() {
  const S = D.synthetic, n = S.n; $("#rank-meta").textContent = `two ${n} × ${n} matrices`;
  const recon = (P_, r) => { const out = Array.from({ length: n }, () => new Array(n).fill(0)); for (let q = 0; q < r; q++) { const s = P_.s[q]; for (let i = 0; i < n; i++) { const u = P_.u[i][q] * s; for (let j = 0; j < n; j++) out[i][j] += u * P_.vt[q][j]; } } return out; };
  const full = P_ => recon(P_, n); const energy = (P_, r) => P_.s.slice(0, r).reduce((a, v) => a + v * v, 0) / P_.s.reduce((a, v) => a + v * v, 0);
  const FW = full(S.W), FD = full(S.dW);
  const bet = makeBet("#bet-rank", ["W", "ΔW", "both the same"], energy(S.dW, 4) > energy(S.W, 4) ? 1 : 0);
  function heat(s, x, y, Mx, title, cell, maxv) { txt(s, x + n * cell / 2, y - 8, title, { fs: 13.5, color: css("--ink") });
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) { const v = Mx[i][j] / maxv, c = v >= 0 ? "--cls-1" : "--cls-0";
      s.appendChild(el("rect", { x: x + j * cell, y: y + i * cell, width: cell, height: cell, fill: `color-mix(in srgb, var(${c}) ${Math.round(100 * Math.min(1, Math.abs(v)))}%, var(--panel))` })); } }
  let revealed = false;
  function draw() { const r = +$("#rank-r").value; $("#rank-r-v").textContent = r; if (!revealed) return;
    const host = $("#fig-rank"); host.innerHTML = ""; const cell = 4, gap = 30, W = 4 * n * cell + 3 * gap + 20, H = n * cell + 50; const s = svg(W, H); s.style.maxWidth = W * 1.4 + "px";
    const mw = Math.max(...FW.flat().map(Math.abs)), md = Math.max(...FD.flat().map(Math.abs));
    heat(s, 10, 30, FW, "W", cell, mw); heat(s, 10 + n * cell + gap, 30, recon(S.W, r), `W, rank ${r}`, cell, mw);
    heat(s, 10 + 2 * (n * cell + gap), 30, FD, "ΔW", cell, md); heat(s, 10 + 3 * (n * cell + gap), 30, recon(S.dW, r), `ΔW, rank ${r}`, cell, md);
    host.appendChild(s);
    lineChart($("#rank-spectrum"), { W: 900, H: 260, series: [{ label: "W", x: S.W.s.map((_, i) => i + 1), y: S.W.s.map(v => v / S.W.s[0]), color: css("--ink-2"), r: 2.5 }, { label: "ΔW", x: S.dW.s.map((_, i) => i + 1), y: S.dW.s.map(v => v / S.dW.s[0]), color: css("--cls-1"), r: 2.5 }], vlines: [{ x: r + 0.5 }], xlabel: "singular value, by index", ylabel: "relative size", ymin: 0, ymax: 1.05, legendX: 640 });
    $("#rank-note").innerHTML = TXT("rank-note", { r, w_keep: pct(energy(S.W, r), 0), dw_keep: pct(energy(S.dW, r), 0), lora_n: num(r * 1536), full_n: num(768 * 768) }); }
  $("#rank-r").addEventListener("input", draw); draw(); REDRAW.push(draw);
  revealBets("btn-rank-reveal", [bet], () => { revealed = true; draw(); });
})();

/* ====================================================== 04 the code */
(function codePanels() {
  code("#code-lora", `class LoRALinear(nn.Module):
    def __init__(self, base, r=8, alpha=8):
        super().__init__()
        self.base = base.requires_grad_(False)            # W, frozen
        d, k = base.out_features, base.in_features
        self.A = nn.Parameter(torch.randn(r, k) * 0.01)   # A ~ N(0, σ²)
        self.B = nn.Parameter(torch.zeros(d, r))          # B = 0: starts as the base model
        self.scale = alpha / r

    def forward(self, x):
        return self.base(x) + self.scale * (x @ self.A.T @ self.B.T)

    @torch.no_grad()
    def merge(self):                                       # W' = W + (α/r)·BA
        self.base.weight += self.scale * self.B @ self.A`, { "self.base = base": "w", "self.A =": "a", "self.B =": "b", "self.scale =": "scale", "return self.base": "h w scale a b", "self.base.weight +=": "w scale a b", "def merge": "w scale a b" });
  code("#code-peft", `peft_config = LoraConfig(
    task_type=TaskType.SEQ_CLS, inference_mode=False, r=8, lora_dropout=0.1, target_modules=['c_attn']
)

model = Model(tokenizer, num_classes).to(device)
lora_model = get_peft_model(model, peft_config).to(device)
lora_model.print_trainable_parameters()
# trainable params: ${num(RUN.lora.trainable)} || all params: 124,738,560 || trainable%: 0.2377`, { "r=8": "a b scale w", "get_peft_model": "w" });
  const mine = trainable("lora", { r: 8, t: "c_attn" });
  $("#code-check").innerHTML = okText(mine === RUN.lora.trainable, `12 × 8 × (768 + 2304) + 1 536 = ${num(mine)}, as printed`);
})();

/* ====================================================== 04 which matrices, which rank */
(function whereRank() {
  const T = P.weight_type; $("#where-src").textContent = "Hu et al. (2021), Table 5";
  const bet = makeBet("#bet-where", ["one matrix, rank 8", "spread, rank 2–4", "no difference"], 1);
  const best = k => Math.max(...T[k]);
  $("#where-table").innerHTML = `<thead><tr><th>adapted</th>${T.cols.map(([w]) => `<th class="num">${esc(w)}</th>`).join("")}</tr><tr><th>rank r</th>${T.cols.map(([, r]) => `<th class="num">${r}</th>`).join("")}</tr></thead><tbody>` +
    [["wikisql", "WikiSQL"], ["mnli", "MultiNLI"]].map(([k, l]) => `<tr><td>${l} (±${T.sd[k]})</td>${T[k].map(v => `<td class="num">${v === best(k) ? "<b>" : ""}${v.toFixed(1)}${v === best(k) ? "</b>" : ""}</td>`).join("")}</tr>`).join("") + "</tbody>";
  revealBets("btn-where-reveal", [bet]);
  const RK = P.rank; $("#r-src").textContent = "Hu et al. (2021), Table 6";
  const bet2 = makeBet("#bet-r", ["r = 1", "r = 4", "r = 8", "it needs r = 64"], 0);
  const cols = { "Wq": "--ink-3", "Wq, Wv": "--cls-1", "Wq, Wk, Wv, Wo": "--cls-2" };
  function draw() { [["mnli", "MultiNLI"], ["wikisql", "WikiSQL"]].forEach(([k, l]) => lineChart($("#r-chart-" + k), { W: 520, H: 300, xlog: true, xticks: RK.r, xfmt: v => String(v), series: Object.entries(RK[k]).map(([w, y]) => ({ label: w, x: RK.r, y, color: css(cols[w]) })), xlabel: `rank r · ${l}`, ylabel: "accuracy, %", fs: 13, legendX: 300 })); }
  revealBets("btn-r-reveal", [bet2], () => { draw(); REDRAW.push(draw); });
})();

/* ====================================================== 05 the map */
const SORT_ITEMS = [["head only", () => trainable("lp")], ["prompt tuning, 12 tokens", () => trainable("pt", { n: 12 })], ["BitFit", () => trainable("bitfit")], ["LoRA, r = 8 on c_attn", () => trainable("lora", { r: 8 })], ["adapters, m = 64", () => trainable("adapter", { m: 64 })]];
(function sortBet() {
  const names = SORT_ITEMS.map(x => x[0]), shuffled = [names[3], names[2], names[4], names[0], names[1]];
  const trueOrder = SORT_ITEMS.slice().sort((a, b) => a[1]() - b[1]()).map(x => x[0]);
  const pick = orderPick("sort-pick", shuffled, trueOrder);
  $("#btn-sort-reveal").addEventListener("click", e => { const placed = $$("#sort-pick button i").length > 0; tally(pick.reveal(), placed); e.target.disabled = true; e.target.textContent = "revealed";
    $("#sort-pick").insertAdjacentHTML("beforeend", `<div class="small-note" style="flex-basis:100%">${SORT_ITEMS.slice().sort((a, b) => a[1]() - b[1]()).map(([n, f]) => `${esc(n)} ${num(f())}`).join(" · ")}</div>`); });
})();
(function map() {
  let mode = "lora", tgt = "c_attn";
  const vals = () => ({ r: +$("#map-r").value, m: +$("#map-m").value, n: +$("#map-n").value, t: tgt });
  function draw() { const o = vals(); $("#map-r-v").textContent = o.r; $("#map-m-v").textContent = o.m; $("#map-n-v").textContent = o.n;
    $("#map-r-wrap").style.display = $("#map-targets").style.display = mode === "lora" ? "" : "none"; $("#map-m-wrap").style.display = mode === "adapter" ? "" : "none"; $("#map-n-wrap").style.display = mode === "pt" ? "" : "none";
    const host = $("#fig-map"); host.innerHTML = ""; const W = 520, H = 560; const s = svg(W, H); s.style.maxWidth = "520px";
    const on = TINT("--cls-1", 55), onS = css("--cls-1"), off = "var(--panel-sunk)";
    const isLora = k => mode === "lora" && (k === "c_attn" || (k === "attn_proj" && tgt !== "c_attn") || ((k === "c_fc" || k === "mlp_proj") && tgt === "all"));
    const all = mode === "ft";
    const lay = (y, label, key, w) => { const b = box(s, 70, y, w || 260, 30, label, { fs: 13, fill: all ? on : off, stroke: all ? onS : css("--rule-strong") });
      if (mode === "bitfit" && key) s.appendChild(el("rect", { x: 70 + (w || 260) - 14, y: y + 3, width: 10, height: 24, rx: 2, fill: css("--cls-1") }));
      if (key && isLora(key)) { box(s, 345, y + 2, 34, 26, "A", { fs: 12, fill: on, stroke: onS }); box(s, 385, y + 2, 34, 26, "B", { fs: 12, fill: on, stroke: onS }); s.appendChild(el("line", { x1: 330, x2: 345, y1: y + 15, y2: y + 15, stroke: onS })); }
      return b; };
    const adapter = y => { if (mode !== "adapter") return; box(s, 110, y, 180, 22, `adapter 768 → ${o.m} → 768`, { fs: 11.5, fill: on, stroke: onS }); };
    // top to bottom
    box(s, 70, 20, 260, 30, "head: score 768 → 2", { fs: 13, fill: mode === "pt" || mode === "lora" || mode === "lp" || mode === "bitfit" || mode === "adapter" || all ? on : off, stroke: onS });
    lay(64, "ln_f", null);
    const r = el("rect", { x: 50, y: 110, width: 390, height: 330, rx: 10, fill: "none", stroke: css("--rule-strong"), "stroke-dasharray": "5 4" }); s.appendChild(r);
    txt(s, 460, 280, "× 12", { fs: 18, bold: true, color: css("--ink"), anchor: "start" });
    lay(400, "ln_1", "ln"); lay(360, "attn · c_attn  768 → 2304 (Q, K, V)", "c_attn"); lay(320, "attn · c_proj  768 → 768", "attn_proj"); adapter(292);
    lay(250, "ln_2", "ln"); lay(210, "mlp · c_fc  768 → 3072", "c_fc"); lay(170, "mlp · c_proj  3072 → 768", "mlp_proj"); adapter(142);
    if (mode === "adapter") { s.querySelectorAll("rect").forEach(n => { }); }
    if (mode === "adapter") [400, 250, 64].forEach(y => box(s, 70, y, 260, 30, y === 64 ? "ln_f" : y === 400 ? "ln_1" : "ln_2", { fs: 13, fill: on, stroke: onS }));
    lay(470, "wte 50 258 × 768 · wpe 1 024 × 768", null);
    if (mode === "pt") { for (let i = 0; i < Math.min(o.n, 20); i++) s.appendChild(el("rect", { x: 70 + i * 13, y: 512, width: 10, height: 26, rx: 2, fill: css("--cls-1") })); txt(s, 70 + Math.min(o.n, 20) * 13 + 8, 530, `${o.n} virtual tokens${o.n > 20 ? " (20 drawn)" : ""}`, { anchor: "start", fs: 12.5, color: css("--cls-1") }); }
    host.appendChild(s);
    const t = trainable(mode, o);
    $("#map-out").innerHTML = stat(num(t), "trainable parameters") + stat((100 * t / GP.total).toPrecision(2) + "%", "of GPT-2's 124M") + stat(mb(4 * t), "to store, fp32");
    const ref = mode === "lora" && o.r === 8 && tgt === "c_attn" ? RUN.lora.trainable : mode === "pt" && o.n === 12 ? RUN.pt.trainable : mode === "ft" ? RUN.ft.trainable : mode === "lp" ? RUN.lp.trainable : null;
    $("#map-check").innerHTML = ref == null ? "no notebook run with these settings" : okText(t === ref, `matches the notebook: ${num(ref)}`); }
  ["map-r", "map-m", "map-n"].forEach(id => $("#" + id).addEventListener("input", draw));
  toggle("map-t", m => { tgt = m; draw(); }); toggle("map-btns", m => { mode = m; draw(); }); draw(); REDRAW.push(draw);
})();

/* ====================================================== 06 the bill: speed */
(function speed() {
  const ratio = RUN.lora.it_s / RUN.ft.it_s; $("#speed-meta").textContent = `${M.device}, batch ${M.batch}, ${M.year}`;
  $("#bet-speed-q").innerHTML = TXT("bet-speed", { pct: (100 * RUN.lora.trainable / RUN.ft.trainable).toFixed(2) + "%" });
  const bet = makeBet("#bet-speed", ["about 400× faster", "about 10× faster", "about 2× faster", "within 20%"], ratio > 100 ? 0 : ratio > 5 ? 1 : ratio > 1.5 ? 2 : 3);
  revealBets("btn-speed-reveal", [bet], () => { const mx = Math.max(...Object.values(RUN).map(r => r.it_s));
    const SH = { ft: "full FT", lp: "head only", lora: "LoRA", pt: "prompt", lpft: "LP-FT" };
    bar($("#speed-out"), Object.entries(RUN).map(([k, r]) => ({ label: `${SH[k]} · ${(r.wall_s / 60).toFixed(1)} min`, p: r.it_s / mx, text: r.it_s.toFixed(2), color: css(r === RUN.lora ? "--cls-1" : "--ink-3") })));
    $("#speed-note").innerHTML = TXT("speed-note", { lora: RUN.lora.it_s.toFixed(2), ft: RUN.ft.it_s.toFixed(2), faster: (100 * (ratio - 1)).toFixed(0) }); });
})();

/* ====================================================== 06 the bill: memory */
const SIZES = [["GPT-2 small", 124e6], ["1B", 1e9], ["3B", 3e9], ["7B", 7e9], ["13B", 13e9], ["34B", 34e9], ["70B", 70e9]];
const LORA_FRAC = 0.004;   // LoRA on all linear layers at r ≈ 8–16 trains a few tenths of a percent of a 7–70B model
function memBill(N) { const a = LORA_FRAC * N;
  return { FT: { weights: 4 * N, grads: 4 * N, optimizer: 8 * N }, LoRA: { weights: 2 * N + 4 * a, grads: 4 * a, optimizer: 8 * a }, QLoRA: { weights: 0.516 * N + 4 * a, grads: 4 * a, optimizer: 8 * a } }; }
const sumB = o => o.weights + o.grads + o.optimizer;
(function memory() {
  const BET_N = 13e9, T4 = 16e9; $("#mem-meta").textContent = "bytes per parameter: full FT 4 + 4 + 8 · frozen base 2 (LoRA) or ≈ 0.52 (QLoRA)";
  const host = $("#fit-pick"); const names = ["FT", "LoRA", "QLoRA"], picked = new Set();
  host.innerHTML = names.map(n => `<button data-n="${n}">${n === "FT" ? "full fine-tuning" : n}</button>`).join("");
  host.addEventListener("click", e => { const b = e.target.closest("button[data-n]"); if (!b || host.dataset.done) return; const n = b.dataset.n; picked.has(n) ? picked.delete(n) : picked.add(n); b.classList.toggle("pick", picked.has(n)); });
  function draw() { const [lab, N] = SIZES[+$("#mem-n").value]; $("#mem-n-v").textContent = lab; const B = memBill(N), mx = Math.max(sumB(B.FT), 90e9);
    const W = 900, H = 200, L = 120, R = 30; const s = svg(W, H); s.style.maxWidth = "900px"; const X = v => L + v / mx * (W - L - R);
    const parts = [["weights", "--ink-3"], ["grads", "--cls-0"], ["optimizer", "--cls-2"]];
    names.forEach((n, i) => { let x = L; const y = 24 + i * 46; txt(s, L - 10, y + 22, n === "FT" ? "full FT" : n, { anchor: "end", fs: 14, color: css("--ink") });
      parts.forEach(([k, c]) => { const w = X(B[n][k]) - L; if (w > 0.3) s.appendChild(el("rect", { x, y, width: Math.max(w, 1), height: 30, fill: css(c), opacity: .85 })); x += w; });
      txt(s, Math.min(x + 8, W - 120), y + 21, (sumB(B[n]) / 1e9).toFixed(sumB(B[n]) < 10e9 ? 1 : 0) + " GB", { anchor: "start", fs: 13.5, bold: true, color: css("--ink") }); });
    [[16e9, "T4 · 16 GB"], [80e9, "A100 · 80 GB"]].forEach(([v, t]) => { if (v > mx) return; s.appendChild(el("line", { x1: X(v), x2: X(v), y1: 18, y2: 166, stroke: css("--bad"), "stroke-dasharray": "4 4" })); txt(s, X(v) + 4, 12, t, { anchor: "start", fs: 12.5, color: css("--bad") }); });
    let lx = L; parts.forEach(([k, c]) => { s.appendChild(el("rect", { x: lx, y: H - 12, width: 12, height: 10, fill: css(c) })); txt(s, lx + 16, H - 3, k, { anchor: "start", fs: 12 }); lx += 110; });
    $("#mem-chart").innerHTML = ""; $("#mem-chart").appendChild(s); }
  $("#mem-n").addEventListener("input", draw);
  $("#btn-fit-reveal").addEventListener("click", e => { host.dataset.done = 1; const B = memBill(BET_N); let ok = true;
    $$("button", host).forEach(b => { const fits = sumB(B[b.dataset.n]) <= T4; b.classList.add(fits ? "yes" : "no"); if (fits !== picked.has(b.dataset.n)) ok = false; });
    tally(ok, picked.size > 0); $("#mem-out").hidden = false; $("#fit-note").hidden = false; e.target.disabled = true; e.target.textContent = "revealed";
    $("#fit-note").innerHTML = TXT("fit-note", { ft: (sumB(B.FT) / 1e9).toFixed(0) + " GB", t4s: Math.ceil(sumB(B.FT) / T4), lora: (sumB(B.LoRA) / 1e9).toFixed(1) + " GB", qlora: (sumB(B.QLoRA) / 1e9).toFixed(1) + " GB" });
    draw(); REDRAW.push(draw); document.dispatchEvent(new CustomEvent("revealed", { detail: "btn-fit-reveal" })); });
})();

/* ====================================================== 06 the bill: disk */
(function store() {
  const full = 4 * GP.total, ad = 4 * RUN.lora.trainable;
  slider("store-n", v => v, n => { $("#store-out").innerHTML = stat(mb(n * full), `${n} fine-tuned copies`) + stat(mb(full + n * ad), `one base + ${n} LoRA adapters`) + stat(Math.round(n * full / (full + n * ad)) + "×", "less disk"); });
  $("#store-note").innerHTML = TXT("store-note", { full: mb(full), adapter: mb(ad) });
})();

/* ====================================================== 07 the scoreboard */
(function board() {
  const keys = Object.keys(RUN), n = M.n_valid; $("#board-meta").textContent = `${n} sentences · ${M.device}, ${M.year}`;
  const label = k => RUN[k].label; const trueOrder = keys.slice().sort((a, b) => RUN[b].acc - RUN[a].acc).map(label);
  const pick = orderPick("board-pick", [label("pt"), label("lora"), label("lp"), label("lpft"), label("ft")], trueOrder);
  const se = p => Math.sqrt(p * (1 - p) / n); const d = RUN.lpft.acc - RUN.ft.acc, sed = Math.hypot(se(RUN.lpft.acc), se(RUN.ft.acc));
  const bet = makeBet("#bet-lpft", ["better", "the same, within noise", "worse"], Math.abs(d) < 2 * sed ? 1 : d > 0 ? 0 : 2);
  function draw() { const host = $("#board-chart"); host.innerHTML = ""; const W = 900, L = 240, R = 80, rows = keys.slice().sort((a, b) => RUN[b].acc - RUN[a].acc), H = 30 + rows.length * 40; const s = svg(W, H); s.style.maxWidth = "900px";
    const x0 = 0.6, x1 = 0.95, X = v => L + (v - x0) / (x1 - x0) * (W - L - R);
    [0.6, 0.7, 0.8, 0.9].forEach(v => { s.appendChild(el("line", { x1: X(v), x2: X(v), y1: 10, y2: H - 22, stroke: css("--rule") })); txt(s, X(v), H - 6, accTxt(v), { fs: 12.5, color: css("--ink-3") }); });
    rows.forEach((k, i) => { const y = 20 + i * 40, a = RUN[k].acc, e = se(a); txt(s, L - 10, y + 5, label(k), { anchor: "end", fs: 14, color: css("--ink") });
      s.appendChild(el("line", { x1: X(a - e), x2: X(a + e), y1: y, y2: y, stroke: css("--cls-1"), "stroke-width": 8, opacity: .35 }));
      s.appendChild(el("circle", { cx: X(a), cy: y, r: 6, fill: css("--cls-1") })); txt(s, X(a + e) + 10, y + 5, accTxt(a), { anchor: "start", fs: 13.5, bold: true, color: css("--ink") }); });
    host.appendChild(s);
    const C = D.synthetic.curves; lineChart($("#curves-chart"), { W: 900, H: 280, series: keys.map((k, i) => ({ label: label(k), x: C.steps, y: C[k], color: css(["--ink-2", "--ink-3", "--cls-1", "--cls-0", "--cls-2"][i]), dash: k === "lp" })), xlabel: "training step", ylabel: "validation accuracy", ymin: 0.45, ymax: 1.0, legendX: 560 }); }
  revealBets("btn-board-reveal", [bet], () => { tally(pick.reveal(), $$("#board-pick button i").length > 0);
    $("#curves-head").innerHTML = `<span class="illus">illustrative</span> the curves between step 0 and step 1 000: the notebook kept them as plots only. The endpoints are measured.`;
    draw(); REDRAW.push(draw);
    $("#board-note").innerHTML = TXT("board-note", { n, se: (100 * se(RUN.ft.acc)).toFixed(1), lora_pct: (100 * RUN.lora.trainable / RUN.ft.trainable).toFixed(2) + "%" }); });
  const T = P.gpt3; $("#gpt3-src").textContent = "Hu et al. (2021), Table 4";
  $("#gpt3-table").innerHTML = `<thead><tr><th>method</th><th class="num">trainable</th><th class="num">WikiSQL</th><th class="num">MultiNLI</th></tr></thead><tbody>` +
    T.rows.map(([m, p, w, mn]) => `<tr class="${m === "LoRA" ? "hl" : ""}"><td>${esc(m)}</td><td class="num">${p >= 1000 ? num(p) : p.toFixed(1)}M</td><td class="num">${w.toFixed(1)}</td><td class="num">${mn.toFixed(1)}</td></tr>`).join("") + "</tbody>";
})();
linkCodeAndFormulas();
