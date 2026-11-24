const DATA = JSON.parse(document.getElementById("add-data").textContent);
window.COPIED = {};
(function() {
let markerSerial = 0;
const TXT = (key, values) => window.TXT("p-" + key, values);
"use strict";
const D = DATA.peft;
const $ = (s, r) => (r || document).querySelector(s.replace(/#([\w-]+)/g, "#p-$1"));
const $$ = (s, r) => Array.from((r || document).querySelectorAll(s.replace(/#([\w-]+)/g, "#p-$1")));
const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const fmt = (x, d) => x == null ? "—": Number(x).toFixed(d === undefined ? 4 : d);
const pct = (x, d) => (100 * x).toFixed(d || 0) + "%";
const num = x => Number(x).toLocaleString("ru-RU");
const last = a => Array.isArray(a) ? a[a.length - 1] : a;
const NS = "http://www.w3.org/2000/svg";
function svg(w, h) { const s = document.createElementNS(NS, "svg"); s.setAttribute("viewBox", `0 0 ${w} ${h}`); s.setAttribute("width", "100%"); return s; }
const PAINT = { fill: 1, stroke: 1 };
function el(tag, attrs, text) {
  const n = document.createElementNS(NS, tag); let style = "";
  for (const k in attrs) { const v = attrs[k]; if (PAINT[k] && typeof v === "string" && v.startsWith("var(")) style += `${k}:${v};`; else n.setAttribute(k, v); }
  if (style) n.setAttribute("style", style); if (text != null) n.textContent = RU(text); return n;
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
  const W = o.W || 1000, H = o.H || 340, L = o.L || 105, R = o.R || 90, T = o.T || 28, B = o.B || 52, fs = o.fs || 14;
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
  if (o.ylabel) s.appendChild(el("text", { x: 28, y: (T + H - B) / 2, "font-size": fs, "text-anchor": "middle", fill: css("--ink-2"), transform: `rotate(-90 28 ${(T + H - B) / 2})` }, o.ylabel));
  (o.hlines || []).forEach(h => { s.appendChild(el("line", { x1: L, x2: W - R, y1: Y(h.y), y2: Y(h.y), stroke: h.color || css("--ink-3"), "stroke-dasharray": "5 4", "stroke-width": 1.5 }));
    if (h.label) s.appendChild(el("text", { x: W - R - 4, y: Y(h.y) - 5, "font-size": fs - 1, "text-anchor": "end", fill: h.color || css("--ink-2") }, h.label)); });
  (o.vlines || []).forEach(h => { s.appendChild(el("line", { x1: X(h.x), x2: X(h.x), y1: T, y2: H - B, stroke: h.color || css("--ink-3"), "stroke-dasharray": "3 4", "stroke-width": 1.2 }));
    if (h.label) s.appendChild(el("text", { x: X(h.x) + 4, y: H - B - 6, "font-size": fs - 1, fill: h.color || css("--ink-2") }, h.label)); });
  o.series.forEach(sr => {
    const pts = sr.x.map((x, i) => [x, sr.y[i]]).filter(p => p[1] != null && isFinite(p[1]));
    if (pts.length > 1) s.appendChild(el("polyline", { points: pts.map(p => `${X(p[0]).toFixed(1)},${Y(p[1]).toFixed(1)}`).join(" "), fill: "none", stroke: sr.color || css("--ink"), "stroke-width": sr.sw || 2.2, "stroke-dasharray": sr.dash ? "6 5": "none", "stroke-linejoin": "round" }));
    if (!sr.nodots) pts.forEach(p => { const c = el("circle", { cx: X(p[0]), cy: Y(p[1]), r: sr.r || 4, fill: sr.color || css("--ink"), stroke: sr.color || css("--ink"), "stroke-width": 2 }); if (sr.tip) tipOn(c, sr.tip(p[0], p[1])); s.appendChild(c);
      if (sr.labels) s.appendChild(el("text", { x: X(p[0]), y: Y(p[1]) - 10, "font-size": fs - 1, "text-anchor": "middle", fill: css("--ink-2") }, sr.labels[sr.x.indexOf(p[0])])); });
  });
  let lx = (o.legendX != null ? o.legendX : L + 12), ly = T + 4 + fs;
  o.series.filter(sr => sr.label).forEach(sr => { s.appendChild(el("line", { x1: lx, x2: lx + 26, y1: ly - fs * .35, y2: ly - fs * .35, stroke: sr.color || css("--ink"), "stroke-width": 2.5, "stroke-dasharray": sr.dash ? "6 5": "none" }));
    s.appendChild(el("text", { x: lx + 34, y: ly, "font-size": fs, fill: css("--ink-2") }, sr.label)); ly += fs + 6; });
  host.appendChild(s); return { X, Y, s };
}
function linTicks(a, b, n) { const span = b - a, raw = span / n, mag = Math.pow(10, Math.floor(Math.log10(raw))); const step = [1, 2, 2.5, 5, 10].map(m => m * mag).find(st => span / st <= n + 1) || mag; const out = []; for (let v = Math.ceil(a / step) * step; v <= b + 1e-9; v += step) out.push(+v.toFixed(10)); return out; }
function logTicks(a, b) { const out = []; for (let e = Math.floor(Math.log10(a)); e <= Math.ceil(Math.log10(b)); e++) { const v = Math.pow(10, e); if (v >= a && v <= b) out.push(v); } return out; }
function tickFmt(v) { if (Math.abs(v) >= 1e6) return +(v / 1e6).toFixed(1) + "M"; if (Math.abs(v) >= 1000) return +(v / 1000).toFixed(1) + "k"; if (Math.abs(v) >= 10 || v === 0) return String(Math.round(v * 10) / 10); return String(+v.toPrecision(3)); }
function probBars(host, rows, o) {
  host.innerHTML = rows.map(r => `<div class="pbar${r.kept === false ? " cut": ""}"><span class="lab" title="${esc(r.label)}">${esc(RU(r.label))}</span><span class="bar"><i style="width:${(100 * r.p / (o && o.max || 1)).toFixed(1)}%${r.color ? ";background:" + r.color : ""}"></i></span><span class="v">${r.text != null ? r.text : (r.p < 0.001 ? r.p.toExponential(1) : r.p.toFixed(3))}</span></div>`).join("");
}
function makeBet(host, options, answer) {
  const h = typeof host === "string" ? $(host) : host;
  h.insertAdjacentHTML("beforeend", options.map((o, i) => `<button data-opt="${i}">${esc(RU(o))}</button>`).join("") + `<span class="verdict"></span>`);
  const st = { pick: null, revealed: false, answer };
  h.addEventListener("click", e => { const b = e.target.closest("button[data-opt]"); if (!b || st.revealed) return; st.pick = +b.dataset.opt; $$("button[data-opt]", h).forEach(x => x.classList.toggle("pick", x === b)); });
  st.reveal = (ans) => { if (ans !== undefined) st.answer = ans; st.revealed = true; const v = $(".verdict", h);
    $$("button[data-opt]", h).forEach(x => { const i = +x.dataset.opt; x.classList.toggle("right", i === st.answer); x.classList.toggle("wrong", i === st.pick && i !== st.answer); });
    if (st.pick === null) { v.textContent = "ответ не выбран"; v.className = "verdict"; } else if (st.pick === st.answer) { v.textContent = "верно"; v.className = "verdict ok"; } else { v.textContent = "неверно"; v.className = "verdict no"; }
    return st.pick === st.answer; };
  return st;
}
function reveal(btnId, outIds, noteId, bets, after) {
  $("#" + btnId).addEventListener("click", e => { (bets || []).forEach(b => b.reveal()); outIds.forEach(id => { const n = $("#" + id); if (n) n.hidden = false; }); if (noteId) $("#" + noteId).hidden = false;
    const veil = e.target.closest(".panel").querySelector(".veil"); if (veil) veil.remove(); e.target.disabled = true; e.target.textContent = "открыто";
    if (after) after();
    document.dispatchEvent(new CustomEvent("revealed", { detail: btnId })); });
}
function table(host, cols, rows) {
  host.innerHTML = `<thead><tr>${cols.map(c => `<th class="${c.num ? "num": ""}">${RU(c.h)}</th>`).join("")}</tr></thead><tbody>` +
    rows.map(r => `<tr class="${r._hl ? "hl": ""}${r._new ? " new": ""}">${cols.map(c => `<td class="${c.num ? "num": ""}${c.mono ? " mono": ""}">${c.f(r)}</td>`).join("")}</tr>`).join("") + "</tbody>";
}
const stat = (v, k) => `<div class="stat"><span class="v">${v}</span><span class="k">${RU(k)}</span></div>`;
const tok = (t, cls) => `<span class="tok ${cls || ""}">${esc(t)}</span>`;
const ck = (host, ok, text) => { $(host).innerHTML = `<b class="${ok ? "" : "no"}">${ok ? "✓": "✗"}</b> ${esc(text)}`; };
function toggle(id, on) { const h = $("#" + id); let mode = $("button.sel", h).dataset.m; h.addEventListener("click", e => { const b = e.target.closest("button[data-m]"); if (!b) return; mode = b.dataset.m; $$("button", h).forEach(x => x.classList.toggle("sel", x === b)); on(mode); }); return () => mode; }
const REDRAW = [];
function redrawAll() { REDRAW.forEach(f => { try { f(); } catch (_) { } }); }
document.addEventListener("add-theme", redrawAll);
function linkCodeAndFormulas() {
  const all = $$("#copy-peft [data-f]"); const toks = n => (n.dataset.f || "").split(/\s+/).filter(Boolean);
  all.forEach(n => { if (n._linked) return; n._linked = true;
    n.addEventListener("pointerenter", () => { const mine = toks(n); all.forEach(m => m.classList.toggle("hi", toks(m).some(t => mine.includes(t)))); });
    n.addEventListener("pointerleave", () => all.forEach(m => m.classList.remove("hi"))); });
}
function code(host, text, f) {
  $(host).innerHTML = text.split("\n").map(l => { let tok = ""; for (const k in (f || {})) if (l.includes(k)) tok = f[k];
    const body = esc(l).replace(/^(\s*)(def|class|return|for|in|if|else|import|from|with)\b/g, '$1<span class="kw">$2</span>').replace(/(#.*)$/, '<span class="c">$1</span>');
    return `<span class="ln"${tok ? ` data-f="${tok}"` : ""}>${body}</span>`; }).join("");
  linkCodeAndFormulas();
}
const TEXT_W = (t, fs) => String(t).length * fs * 0.61 + 14;
function box(s, x, y, w, h, label, o) { o = o || {}; let fs = o.fs || 14;
  if (label != null && label !== "") { const need = TEXT_W(label, fs); if (need > w) { if (o.grow) { const cx = x + w / 2; w = need; x = cx - w / 2; } else fs = Math.max(10, fs * (w - 6) / (need - 8)); } }
  const r = el("rect", { x, y, width: w, height: h, rx: o.rx == null ? 6 : o.rx, fill: "none", stroke: o.stroke || css("--rule-strong"), "stroke-width": o.sw || 1.4, "stroke-dasharray": o.dash ? "5 4": "none" }); r.style.fill = o.fill || "var(--panel-sunk)"; s.appendChild(r);
  if (label != null) { const t = el("text", { x: x + w / 2, y: y + h / 2 + fs * .36, "font-size": fs, "text-anchor": "middle", fill: o.color || css("--ink"), "font-weight": o.bold ? "600": "400" }, label); s.appendChild(t); }
  r.box = { x, y, w, h }; return r; }
function txt(s, x, y, t, o) { o = o || {}; return s.appendChild(el("text", { x, y, "font-size": o.fs || 13.5, "text-anchor": o.anchor || "middle", fill: o.color || css("--ink-2"), "font-weight": o.bold ? "600": "400", "font-style": o.italic ? "italic": "normal", "font-family": o.mono ? "var(--mono)": "inherit" }, t)); }
function arrow(s, x1, y1, x2, y2, o) { o = o || {}; const color = o.color || css("--ink-2"), id = "p-arr-" + (++markerSerial) + "-" + String(color).replace(/[^a-z0-9]/gi, "");
  if (!s.querySelector("#" + id)) { let defs = s.querySelector("defs"); if (!defs) { defs = el("defs", {}); s.appendChild(defs); } const m = el("marker", { id, viewBox: "0 0 10 10", refX: 9, refY: 5, markerWidth: 6, markerHeight: 6, orient: "auto-start-reverse" }); m.appendChild(el("path", { d: "M 0 0 L 10 5 L 0 10 z", fill: color })); defs.appendChild(m); }
  s.appendChild(el("path", { d: o.d || `M ${x1} ${y1} L ${x2} ${y2}`, fill: "none", stroke: color, "stroke-width": o.sw || 1.6, "stroke-dasharray": o.dash ? "4 4": "none", "marker-end": o.noHead ? "none": `url(#${id})` })); }
const TINT = (v, pct) => `color-mix(in srgb, var(${v}) ${pct}%, var(--panel))`;
function states(btnsId, draw) {
  let mode = $(`#${btnsId} button.sel`).dataset.m; draw(mode); REDRAW.push(() => draw(mode));
  $(`#${btnsId}`).addEventListener("click", e => { const b = e.target.closest("button[data-m]"); if (!b) return; mode = b.dataset.m; $$(`#${btnsId} button`).forEach(x => x.classList.toggle("sel", x === b)); draw(mode); });
  return m => { mode = m; $$(`#${btnsId} button`).forEach(x => x.classList.toggle("sel", x.dataset.m === m)); draw(m); };
}
const slider = (id, fmt, on) => { const inp = $("#" + id), lab = $("#" + id + "-v"); const f = () => { if (lab) lab.textContent = fmt(+inp.value); on(+inp.value); }; inp.addEventListener("input", f); f(); return f; };
const CLSC = ["--cls-0", "--cls-1", "--cls-2", "--cls-3"];
const bar = (host, rows) => { host.innerHTML = rows.map(r => `<div class="pbar"><span class="lab" title="${esc(r.label)}">${esc(RU(r.label))}</span><span class="bar"><i style="width:${(100 * r.p).toFixed(1)}%${r.color ? ";background:" + r.color : ""}"></i></span><span class="v">${r.text}</span></div>`).join(""); };
const okText = (ok, t) => `<b class="${ok ? "" : "no"}">${ok ? "✓": "✗"}</b> ${t}`;
const near = (a, b, tol) => Math.abs(a - b) <= (tol || 1e-6) * Math.max(1, Math.abs(b));
function orderPick(hostId, names, trueOrder) {
  const host = $("#" + hostId); let order = []; let done = false;
  const draw = () => { host.innerHTML = names.map(n => { const i = order.indexOf(n); const cls = done ? (i >= 0 && trueOrder[i] === n ? "right": i >= 0 ? "wrong": "") : (i >= 0 ? "pick": ""); return `<button data-n="${esc(n)}" class="${cls}">${i >= 0 ? `<i>${i + 1}</i>` : ""}${esc(RU(n))}</button>`; }).join("") + (done ? `<span class="arrow">· порядок по результату: ${trueOrder.map(esc).join(" › ")}</span>` : order.length ? `<span class="arrow">${order.length} из ${names.length} выбрано</span>` : ""); };
  host.addEventListener("click", e => { const b = e.target.closest("button[data-n]"); if (!b || done) return; const n = b.dataset.n; if (order.includes(n)) order = order.filter(x => x !== n); else order.push(n); draw(); });
  draw(); return { reveal: () => { done = true; draw(); return order.length === names.length && order.every((n, i) => n === trueOrder[i]); } };
}
const TALLY = { right: 0, placed: 0, total: 0 };
setTimeout(() => { if (!TALLY.total) $("#score").innerHTML = `<div class="t">ваши ответы</div><div class="row"><span>верно</span><b>0 / 0</b></div>`; });
function tally(ok, placed) { TALLY.total++; if (placed) TALLY.placed++; if (ok) TALLY.right++;
  $("#score").innerHTML = `<div class="t">ваши ответы</div><div class="row on"><span>верно</span><b>${TALLY.right} / ${TALLY.total}</b></div>`; }
function revealBets(btnId, bets, after) {
  $("#" + btnId).addEventListener("click", e => { bets.forEach(b => { const placed = b.pick !== null; tally(b.reveal(), placed); });
    const p = e.target.closest(".panel"); const veil = p.querySelector(".veil"); if (veil) veil.remove(); $$("[hidden]", p).forEach(n => { if (n.id !== "mem-out") n.hidden = false; });
    e.target.disabled = true; e.target.textContent = "открыто"; if (after) after(); document.dispatchEvent(new CustomEvent("revealed", { detail: btnId })); });
}
function rng(seed) { return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
function gaussian(R) { return () => { const u = 1 - R(), v = R(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); }; }
const RUN = D.run, G = D.gpt2, M = D.meta, P = D.paper;
const accTxt = a => (100 * a).toFixed(1) + "%";
const human = x => { const a = Math.abs(x); for (const [u, k] of [["B", 1e9], ["M", 1e6], ["k", 1e3]]) if (a >= k) return +(x / k).toPrecision(3) + u; return String(x); };
const mb = b => b >= 1e9 ? (b / 1e9).toFixed(1) + " GB": (b / 1e6).toFixed(b < 1e7 ? 2 : 0) + " MB";
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
(function hero() {
  $("#hero-trained").textContent = `обучается: ${(100 * RUN.lora.trainable / GP.total).toFixed(2)}%`;
  $("#hero-note").innerHTML = TXT("hero-note", { device: M.device, steps: num(M.steps), batch: M.batch, n_valid: M.n_valid });
})();
(function bertTransfer() {
  const B = DATA.bertTransfer, TR = B.transfer, KEYS = Object.keys(TR.runs);
  const names = {"head only": "только голову", "top 2 blocks": "голову + 2 блока", "top 6 blocks": "голову + 6 блоков", "everything": "всю модель"};
  let current = KEYS[0], revealed = false;
  const accuracy = k => 100 * last(TR.runs[k].accuracy);
  $("#bert-transfer-conditions").textContent = `${B.model} · ${num(TR.n_train)} / ${num(TR.n_test)} текстов · ${TR.epochs} эпохи · ${B.device}`;
  $("#bert-transfer-modes").innerHTML = KEYS.map((k, i) => `<button data-k="${k}" class="${i ? "" : "sel"}">${names[k]}</button>`).join("");
  function draw() {
    const r = TR.runs[current], all = r.top_blocks === "all", top = all ? B.layers : r.top_blocks;
    $("#bert-transfer-stats").innerHTML = stat(num(r.trainable_params), "обучаемых параметров") + stat(pct(r.trainable_params / r.total_params, r.trainable_params / r.total_params < .0001 ? 4 : 2), "доля модели") + stat(r.lr, "скорость обучения");
    const host = $("#bert-transfer-fig"); host.innerHTML = "";
    const width = Math.min(620, host.getBoundingClientRect().width || 620);
    const s = svg(width, 330); s.style.maxWidth = "620px";
    function cell(y, h, label, on, part) {
      const rect = box(s, 12, y, width - 24, h, label, {fill: on ? TINT("--cls-1", 22) : "var(--panel-sunk)", stroke: on ? css("--cls-1") : css("--rule-strong"), color: on ? css("--ink") : css("--ink-3"), fs: 12.5});
      rect.dataset.part = part; rect.dataset.trainable = String(on);
    }
    cell(8, 26, "Голова · 4 темы новостей", true, "head");
    cell(40, 22, "Pooler · вектор [CLS]", top > 0, "pooler");
    for (let b = B.layers - 1; b >= 0; b--) cell(70 + (B.layers - 1 - b) * 18, 15, `Блок ${b + 1}`, b >= B.layers - top, "block");
    cell(292, 26, "Эмбеддинги токенов и позиций", all, "embeddings");
    host.appendChild(s);
    $("#bert-transfer-results").hidden = !revealed;
    $("#bert-transfer-note").hidden = !revealed;
    if (!revealed) return;
    $("#bert-transfer-result").innerHTML = stat(pct(last(r.accuracy), 2), "точность на проверке") + stat(num(last(r.seconds)) + " с", `время · ${TR.epochs} эпохи`);
    table($("#bert-transfer-table"), [
      {h: "Обучаем", f: r => names[r.key]}, {h: "Параметров", num: 1, f: r => num(r.trainable_params)},
      {h: "скорость обучения", num: 1, f: r => r.lr}, {h: "Точность", num: 1, f: r => pct(last(r.accuracy), 2)},
      {h: `Время · ${TR.epochs} эпохи, с`, num: 1, f: r => num(last(r.seconds))}
    ], KEYS.map(key => ({...TR.runs[key], key, _hl: key === current})));
    const c = lineChart($("#bert-transfer-chart"), {W: 520, H: 300, L: 70, R: 32, fs: 12.5, xlog: true,
      series: [{x: KEYS.map(k => TR.runs[k].trainable_params), y: KEYS.map(accuracy), color: css("--cls-1"),
        tip: (x, y) => `${num(x)} параметров · ${y.toFixed(2)}%`}],
      hlines: [{y: 100 * B.tfidf.accuracy, label: "TF-IDF + логистическая регрессия", color: css("--bad")}],
      xlabel: "Обучаемых параметров · логарифмическая шкала", ylabel: "Точность, %"});
    c.s.appendChild(el("circle", {cx: c.X(r.trainable_params), cy: c.Y(accuracy(current)), r: 8, fill: "none", stroke: css("--ink"), "stroke-width": 2}));
    $("#bert-transfer-bill").innerHTML = `<p class="small-note">Время обучения · ${TR.epochs} эпохи · ${B.device}</p>`;
    const bill = document.createElement("div"); $("#bert-transfer-bill").appendChild(bill);
    probBars(bill, KEYS.map(k => ({label: names[k], p: last(TR.runs[k].seconds), text: num(last(TR.runs[k].seconds)) + " с", color: css(k === current ? "--cls-1" : "--ink-3")})), {max: Math.max(...KEYS.map(k => last(TR.runs[k].seconds)))});
    $("#bert-transfer-note").innerHTML = TXT("bert-transfer-note", {head: accuracy(KEYS[0]).toFixed(2), two: accuracy(KEYS[1]).toFixed(2), six: accuracy(KEYS[2]).toFixed(2), all: accuracy(KEYS[3]).toFixed(2), gainTwo: (accuracy(KEYS[1]) - accuracy(KEYS[0])).toFixed(2), gapAll: Math.abs(accuracy(KEYS[3]) - accuracy(KEYS[2])).toFixed(2), tfidf: (100 * B.tfidf.accuracy).toFixed(2)});
  }
  $("#bert-transfer-modes").addEventListener("click", e => {
    const b = e.target.closest("button[data-k]"); if (!b) return;
    current = b.dataset.k; $$("#bert-transfer-modes button").forEach(n => n.classList.toggle("sel", n === b)); draw();
  });
  $("#btn-bert-transfer-reveal").addEventListener("click", e => {revealed = true; e.target.disabled = true; e.target.textContent = "Результаты открыты"; draw();});
  draw(); REDRAW.push(draw);
})();
(function kumar() {
  const K = P.kumar, cols = ["FT", "LP", "LP-FT"], names = {FT: "Вся модель", LP: "Только голова", "LP-FT": "Голова → вся модель"};
  const row = (label, r) => `<tr><td>${label}</td>${cols.map(c => `<td class="num">${r[c].toFixed(1)}%</td>`).join("")}</tr>`;
  $("#kumar-table").innerHTML = `<thead><tr><th>Проверочные данные</th>${cols.map(c => `<th class="num">${names[c]}</th>`).join("")}</tr></thead><tbody>${row("То же распределение", K.id)}${row("Сдвинутое распределение", K.ood)}</tbody>`;
  $("#kumar-note").innerHTML = TXT("kumar-note", {id_gap: (K.id.FT - K.id.LP).toFixed(1), ood_gap: (K.ood.LP - K.ood.FT).toFixed(1)}) + `<div class="small-note">${esc(K.src)}</div>`;
})();
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
  const NAMES = { pre: "готовые признаки, случайная голова", lp: "LP", ft: "FT", lpft: "LP → FT" }; const seen = new Set();
  const bet = makeBet("#bet-toy", ["останутся верными", "часть изменится", "изменятся все"], (() => { const a = TOY.acc(TOY.S.ft, TOY.OOD); return a > 0.95 ? 0 : a < 0.05 ? 2 : 1; })());
  let betDone = false;
  function draw(mode) {
    const host = $("#fig-toy"); host.innerHTML = ""; const W = 440, H = 440, c = W / 2, k = 125; const s = svg(W, H); s.style.maxWidth = "440px";
    const X = v => c + v * k, Y = v => c - v * k;
    s.appendChild(el("line", { x1: 20, x2: W - 20, y1: c, y2: c, stroke: css("--rule-strong") })); s.appendChild(el("line", { x1: c, x2: c, y1: 20, y2: H - 20, stroke: css("--rule-strong") }));
    txt(s, 24, c + 22, "x₁ · обучение", { anchor: "start", fs: 13 }); txt(s, c - 8, 34, "x₂ · другие данные", { anchor: "end", fs: 13 });
    const line = (p, o) => { const nx = p.v * p.b1, ny = p.v * p.b2, L = 1.75; const tx = -ny, ty = nx, nn = Math.hypot(tx, ty) || 1;
      s.appendChild(el("line", { x1: X(L * tx / nn), y1: Y(L * ty / nn), x2: X(-L * tx / nn), y2: Y(-L * ty / nn), stroke: o.color, "stroke-width": o.sw || 2.4, "stroke-dasharray": o.dash ? "6 5": "none" }));
      const hn = Math.hypot(nx, ny) || 1; arrow(s, c, c, X(0.55 * nx / hn), Y(0.55 * ny / hn), { color: o.color, sw: o.sw || 2 });
      if (o.label) txt(s, X(0.75 * nx / hn), Y(0.75 * ny / hn) + 4, o.label, { color: o.color, fs: 13, bold: true }); };
    seen.forEach(m => { if (m !== mode) line(TOY.S[m], { color: css("--ink-3"), dash: true, sw: 1.4, label: NAMES[m] === NAMES.pre ? "" : NAMES[m] }); });
    line(TOY.S[mode], { color: css("--cls-1"), label: mode === "pre" ? "head": NAMES[mode] });
    const p = TOY.S[mode]; const right = (d) => (p.v * (p.b1 * d.x[0] + p.b2 * d.x[1]) > 0) === (d.y === 1);
    TOY.ID.forEach(d => { const cc = el("circle", { cx: X(d.x[0]), cy: Y(d.x[1]), r: 5.5, fill: css(d.y ? "--cls-2": "--cls-0"), stroke: right(d) ? css("--panel") : css("--bad"), "stroke-width": right(d) ? 1 : 2.5 }); s.appendChild(cc); });
    TOY.OOD.forEach(d => { const r = el("rect", { x: X(d.x[0]) - 5, y: Y(d.x[1]) - 5, width: 10, height: 10, fill: css(d.y ? "--cls-2": "--cls-0"), stroke: right(d) ? css("--panel") : css("--bad"), "stroke-width": right(d) ? 1 : 2.5 }); s.appendChild(r); });
    txt(s, 24, H - 26, "заливка: эталон · красная рамка: ошибка", { anchor: "start", fs: 12, color: css("--ink-3") }); txt(s, 24, H - 10, "стрелка: сторона положительного класса", { anchor: "start", fs: 12, color: css("--ink-3") });
    host.appendChild(s);
    $("#toy-out").innerHTML = ["pre", "lp", "ft", "lpft"].filter(m => m === mode || seen.has(m)).map(m => { const q = TOY.S[m];
      return `<div class="toy-row${m === mode ? " on": ""}">${TXT("toy-result", { name: `<b>${esc(NAMES[m])}</b>`, id: accTxt(TOY.acc(q, TOY.ID)), ood: accTxt(TOY.acc(q, TOY.OOD)), b1: q.b1.toFixed(2), b2: q.b2.toFixed(2), v: q.v.toFixed(2) })}</div>`; }).join("");
    $("#toy-status").textContent = mode === "pre" ? "pick a way to train": `${NAMES[mode]} · 300 steps of gradient descent on the 40 training dots`;
    seen.add(mode);
    if (mode === "ft" && !betDone) { betDone = true; tally(bet.reveal(), bet.pick !== null); $("#toy-note").hidden = false; }
  }
  states("toy-btns", draw);
})();
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
    box(s, x0, 50, cols * cw, 46, "GPT-2 · 12 замороженных блоков", { fs: 14 });
    const last = x0 + (cols - 1) * cw + cw / 2; arrow(s, last, 50, last, 22); txt(s, last - 8, 18, "голова читает последний токен", { anchor: "end", fs: 12.5 });
    txt(s, x0, yE - 10, `${n} обучаемых векторов × 768`, { anchor: "start", fs: 13, color: css("--cls-1"), bold: true });
    txt(s, x0 + n * cw + 4, yE - 10, "текст: замороженные векторы", { anchor: "start", fs: 13 });
    if (mode === "text" && n > PT.init.length) txt(s, x0 + cols * cw, 118, `the init text has ${PT.init.length} tokens; peft repeats it to fill ${n}`, { anchor: "end", fs: 12, color: css("--ink-3") });
    host.appendChild(s); }
  nIn.addEventListener("input", draw); toggle("prompt-init", m => { mode = m; draw(); }); draw(); REDRAW.push(draw);
  const pt = RUN.pt.acc, lora = RUN.lora.acc, lp = RUN.lp.acc;
  $("#prompt-meta").textContent = `${M.device}, ${M.year}`;
  const bet = makeBet("#bet-prompt", ["в пределах 1 п. п. от LoRA", "на несколько пунктов ниже", "значительно ниже, около linear probing"], lora - pt < 0.01 ? 0 : lora - pt < 0.06 ? 1 : 2);
  revealBets("btn-prompt-reveal", [bet], () => {
    bar($("#prompt-out"), [["lora", "LoRA"], ["lp", "только голова"], ["pt", "префикс, 12"]].map(([k, l]) => ({ label: `${l} · ${human(RUN[k].trainable)}`, p: RUN[k].acc, text: accTxt(RUN[k].acc), color: css(k === "pt" ? "--cls-1": "--ink-3") })));
    $("#prompt-note").innerHTML = TXT("prompt-note2", { pt: accTxt(pt), lora: accTxt(lora), gap: (100 * (lora - pt)).toFixed(1), below_lp: pt < lp ? TXT("prompt-below") : TXT("prompt-above") }); });
})();
(function adapterFig() {
  function draw() { const host = $("#fig-adapter"); host.innerHTML = ""; const W = 900, H = 330; const s = svg(W, H); s.style.maxWidth = "900px";
    const lx = 40; txt(s, lx + 170, 24, "Адаптер: последовательно", { bold: true, fs: 15, color: css("--ink") });
    box(s, lx + 90, 270, 160, 30, "x", { fill: "var(--panel)" });
    box(s, lx + 90, 200, 160, 40, "слой W заморожен", { fs: 13.5 });
    arrow(s, lx + 170, 270, lx + 170, 242);
    const ad = { x: lx + 70, y: 70, w: 200, h: 100 };
    const r = el("rect", { x: ad.x, y: ad.y, width: ad.w, height: ad.h, rx: 8, fill: "none", stroke: css("--cls-1"), "stroke-width": 1.6, "stroke-dasharray": "5 4" }); s.appendChild(r);
    box(s, ad.x + 30, ad.y + 64, 140, 26, "сжатие: 768 → m", { fs: 12.5, fill: TINT("--cls-1", 45), stroke: css("--cls-1") });
    box(s, ad.x + 30, ad.y + 10, 140, 26, "расширение: m → 768", { fs: 12.5, fill: TINT("--cls-1", 45), stroke: css("--cls-1") });
    txt(s, ad.x + 100, ad.y + 55, "нелинейность", { fs: 12, color: css("--ink-3") });
    arrow(s, lx + 170, 200, lx + 170, ad.y + 92); arrow(s, ad.x + 100, ad.y + 64, ad.x + 100, ad.y + 38);
    arrow(s, lx + 170, 186, lx + 170, 186, { d: `M ${lx + 250} 220 C ${lx + 320} 220, ${lx + 320} 50, ${lx + 186} 50`, dash: true });
    s.appendChild(el("circle", { cx: lx + 170, cy: 50, r: 11, fill: css("--panel"), stroke: css("--ink-2"), "stroke-width": 1.4 })); txt(s, lx + 170, 55, "+", { fs: 16 });
    arrow(s, lx + 170, ad.y, lx + 170, 62); txt(s, lx + 300, 140, "skip", { fs: 12, color: css("--ink-3") });
    txt(s, lx + 170, 322, "дополнительный этап после слоя", { fs: 13, color: css("--ink-3") });
    const rx = 500; txt(s, rx + 180, 24, "LoRA: параллельно", { bold: true, fs: 15, color: css("--ink") });
    box(s, rx + 100, 270, 160, 30, "x", { fill: "var(--panel)" });
    box(s, rx + 40, 140, 150, 60, "W заморожена", { fs: 13.5 });
    box(s, rx + 220, 172, 110, 26, "A: 768 → r", { fs: 12.5, fill: TINT("--cls-1", 45), stroke: css("--cls-1") });
    box(s, rx + 220, 112, 110, 26, "B: r → 768", { fs: 12.5, fill: TINT("--cls-1", 45), stroke: css("--cls-1") });
    arrow(s, rx + 180, 270, rx + 115, 202); arrow(s, rx + 180, 270, rx + 275, 200); arrow(s, rx + 275, 172, rx + 275, 140);
    s.appendChild(el("circle", { cx: rx + 180, cy: 60, r: 11, fill: css("--panel"), stroke: css("--ink-2"), "stroke-width": 1.4 })); txt(s, rx + 180, 65, "+", { fs: 16 });
    arrow(s, rx + 115, 140, rx + 172, 70); arrow(s, rx + 275, 112, rx + 188, 70); txt(s, rx + 200, 56, "h", { fs: 14, mono: true, anchor: "start" });
    txt(s, rx + 180, 322, "после обучения добавка объединяется с W", { fs: 13, color: css("--ink-3") });
    host.appendChild(s); }
  draw(); REDRAW.push(draw);
  const T = P.latency; $("#latency-src").textContent = "Hu et al. (2021), Table 1";
  const pct = (row, i) => 100 * (T.rows[row][i] / T.rows["fine-tuned / LoRA merged"][i] - 1);
  const worst = Object.keys(T.rows)[2]; const bet = makeBet("#bet-latency", ["batch 32 × 512 tokens", "one request of 128 tokens"], pct(worst, 2) > pct(worst, 0) ? 1 : 0);
  $("#latency-table").innerHTML = `<thead><tr><th></th>${T.cols.map(c => `<th class="num">batch ${c.batch} × ${c.seq} tokens</th>`).join("")}</tr></thead><tbody>` +
    Object.entries(T.rows).map(([k, v], ri) => `<tr><td>${esc(RU(k))}</td>${v.map((ms, i) => `<td class="num">${ms.toFixed(1)} ms${ri ? ` <b>(+${pct(k, i).toFixed(1)}%)</b>` : ""}</td>`).join("")}</tr>`).join("") + "</tbody>";
  revealBets("btn-latency-reveal", [bet], () => { $("#latency-note").innerHTML = TXT("latency-note", { big: pct(worst, 0).toFixed(1), small: pct(worst, 2).toFixed(1) }) + `<div class="small-note">${esc(T.src)}</div>`; });
})();
(function loraFig() {
  function draw(mode) { const host = $("#fig-lora"); host.innerHTML = ""; const W = 800, H = 380; const s = svg(W, H); s.style.maxWidth = "800px";
    const merged = mode === "merge", training = mode === "train";
    box(s, 210, 330, 340, 30, "", { fill: TINT("--cls-3", 35), stroke: css("--cls-3") }); txt(s, 190, 351, "x", { fs: 17, mono: true, anchor: "end", color: css("--ink") }); txt(s, 380, 351, "k = 768", { fs: 12.5, color: css("--ink-2") });
    box(s, 210, 22, 340, 30, "", { fill: TINT("--cls-3", 35), stroke: css("--cls-3") }); txt(s, 190, 43, "h", { fs: 17, mono: true, anchor: "end", color: css("--ink") }); txt(s, 380, 43, "d", { fs: 12.5, color: css("--ink-2") });
    const wx = merged ? 230 : 150, ww = merged ? 300 : 230;
    const wb = box(s, wx, 110, ww, 180, "", { fill: merged ? TINT("--cls-1", 25) : "var(--panel-sunk)", stroke: merged ? css("--cls-1") : css("--rule-strong") });
    txt(s, wx + ww / 2, 185, merged ? "W′ = W + (α/r)·BA": "W", { fs: merged ? 17 : 24, color: css("--ink"), italic: !merged });
    txt(s, wx + ww / 2, 212, merged ? "one matrix again: inference as before": "заморожена", { fs: 13, color: css("--ink-3") });
    txt(s, wx + ww / 2, 236, "d × k", { fs: 13, mono: true, color: css("--ink-3") });
    if (!merged) {
      const tr = (y, top, bot, fill, label, sub) => { s.appendChild(el("path", { d: `M ${520 - top / 2} ${y} L ${520 + top / 2} ${y} L ${520 + bot / 2} ${y + 62} L ${520 - bot / 2} ${y + 62} Z`, fill, stroke: css("--cls-1"), "stroke-width": 1.5 }));
        txt(s, 520, y + 36, label, { fs: 16, color: css("--ink"), italic: true }); txt(s, 630, y + 36, sub, { fs: 12.5, anchor: "start", color: css("--ink-2") }); };
      tr(110, 200, 64, training ? TINT("--cls-1", 55) : TINT("--cls-1", 30), "B", mode === "init" ? "B = 0 · d × r": "d × r, trained");
      tr(228, 64, 200, training ? TINT("--cls-1", 55) : TINT("--cls-1", 30), "A", mode === "init" ? "A ~ N(0, σ²) · r × k": "r × k, trained");
      txt(s, 560, 205, "r = 8", { fs: 13, mono: true, anchor: "start", color: css("--cls-1") });
      arrow(s, 265, 330, 265, 292); arrow(s, 520, 330, 520, 292); arrow(s, 520, 228, 520, 174);
      arrow(s, 265, 110, 360, 54); arrow(s, 520, 110, 400, 54); txt(s, 380, 84, "+", { fs: 22, color: css("--ink") });
      if (training) { txt(s, 630, 205, "градиенты только здесь", { fs: 13, anchor: "start", color: css("--cls-1"), bold: true }); txt(s, 140, 300, "W без градиента", { fs: 13, anchor: "end", color: css("--ink-3") }); }
      if (mode === "init") { txt(s, 140, 282, "BA = 0:", { fs: 13, anchor: "end", color: css("--ink-2"), bold: true }); txt(s, 140, 300, "h = Wx в начале", { fs: 13, anchor: "end", color: css("--ink-2") }); }
    } else { arrow(s, 380, 330, 380, 292); arrow(s, 380, 110, 380, 54); txt(s, 560, 200, "A и B объединены с W", { fs: 13, anchor: "start", color: css("--ink-3") }); txt(s, 560, 218, "или сохранены для смены задачи", { fs: 13, anchor: "start", color: css("--ink-3") }); }
    host.appendChild(s); }
  states("lora-btns", draw);
})();
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
  const bet = makeBet("#bet-init", ["обучение начинается", "обучается медленнее", "останутся нулями", "значения расходятся"], 2);
  $("#btn-init-reveal").addEventListener("click", e => { e.target.disabled = true; e.target.textContent = "обучено";
    const z = () => 0, g = () => 0.3 * gs(); const runs = [["A случайная, B = 0", run(g, z), "--cls-1"], ["A = 0, B случайная", run(z, g), "--cls-2"], ["A = 0, B = 0", run(z, z), "--ink-3"]];
    lineChart($("#init-chart"), { W: 900, H: 300, series: runs.map(([label, y, c], i) => ({ label, x: y.map((_, k) => k), y, color: css(c), nodots: true, dash: i === 1 })), xlabel: "step", ylabel: "loss", ymin: 0, ymax: 1.5 * Math.max(...runs.map(x => x[1][0])), legendX: 560 });
    $("#init-status").textContent = `ранг ${r}; цель: изменение ранга 2 для слоя ${n} × ${n}, входов ${X.length}`;
    tally(bet.reveal(), bet.pick !== null); $("#init-note").hidden = false; document.dispatchEvent(new CustomEvent("revealed", { detail: "btn-init-reveal" })); });
})();
(function rank() {
  const S = D.synthetic, n = S.n; $("#rank-meta").textContent = `две матрицы ${n} × ${n}`;
  const recon = (P_, r) => { const out = Array.from({ length: n }, () => new Array(n).fill(0)); for (let q = 0; q < r; q++) { const s = P_.s[q]; for (let i = 0; i < n; i++) { const u = P_.u[i][q] * s; for (let j = 0; j < n; j++) out[i][j] += u * P_.vt[q][j]; } } return out; };
  const full = P_ => recon(P_, n); const energy = (P_, r) => P_.s.slice(0, r).reduce((a, v) => a + v * v, 0) / P_.s.reduce((a, v) => a + v * v, 0);
  const FW = full(S.W), FD = full(S.dW);
  const bet = makeBet("#bet-rank", ["W", "ΔW", "both the same"], energy(S.dW, 4) > energy(S.W, 4) ? 1 : 0);
  function heat(s, x, y, Mx, title, cell, maxv) { txt(s, x + n * cell / 2, y - 8, title, { fs: 13.5, color: css("--ink") });
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) { const v = Mx[i][j] / maxv, c = v >= 0 ? "--cls-1": "--cls-0";
      s.appendChild(el("rect", { x: x + j * cell, y: y + i * cell, width: cell, height: cell, fill: `color-mix(in srgb, var(${c}) ${Math.round(100 * Math.min(1, Math.abs(v)))}%, var(--panel))` })); } }
  let revealed = false;
  function draw() { const r = +$("#rank-r").value; $("#rank-r-v").textContent = r; if (!revealed) return;
    const host = $("#fig-rank"); host.innerHTML = ""; const cell = 4, gap = 30, W = 4 * n * cell + 3 * gap + 20, H = n * cell + 50; const s = svg(W, H); s.style.maxWidth = W * 1.4 + "px";
    const mw = Math.max(...FW.flat().map(Math.abs)), md = Math.max(...FD.flat().map(Math.abs));
    heat(s, 10, 30, FW, "W", cell, mw); heat(s, 10 + n * cell + gap, 30, recon(S.W, r), `W, rank ${r}`, cell, mw);
    heat(s, 10 + 2 * (n * cell + gap), 30, FD, "ΔW", cell, md); heat(s, 10 + 3 * (n * cell + gap), 30, recon(S.dW, r), `ΔW, rank ${r}`, cell, md);
    host.appendChild(s);
    lineChart($("#rank-spectrum"), { W: 900, H: 260, series: [{ label: "W", x: S.W.s.map((_, i) => i + 1), y: S.W.s.map(v => v / S.W.s[0]), color: css("--ink-2"), r: 2.5 }, { label: "ΔW", x: S.dW.s.map((_, i) => i + 1), y: S.dW.s.map(v => v / S.dW.s[0]), color: css("--cls-1"), r: 2.5 }], vlines: [{ x: r + 0.5 }], xlabel: "singular value, by index", ylabel: "относительная величина", ymin: 0, ymax: 1.05, legendX: 640 });
    $("#rank-note").innerHTML = TXT("rank-note", { r, w_keep: pct(energy(S.W, r), 0), dw_keep: pct(energy(S.dW, r), 0), lora_n: num(r * 1536), full_n: num(768 * 768) }); }
  $("#rank-r").addEventListener("input", draw); draw(); REDRAW.push(draw);
  revealBets("btn-rank-reveal", [bet], () => { revealed = true; draw(); });
})();
(function codePanels() {
  code("#code-lora", `class LoRALinear(nn.Module):
    def __init__(self, base, r=8, alpha=8):
        super().__init__()
        self.base = base.requires_grad_(False)
        d, k = base.out_features, base.in_features
        self.A = nn.Parameter(torch.randn(r, k) * 0.01)   # A ~ N(0, σ²)
        self.B = nn.Parameter(torch.zeros(d, r))
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
lora_model.print_trainable_parameters()`, { "r=8": "a b scale w", "get_peft_model": "w" });
  const mine = trainable("lora", { r: 8, t: "c_attn" });
  $("#code-check").innerHTML = okText(mine === RUN.lora.trainable, `12 × 8 × (768 + 2304) + 1 536 = ${num(mine)}, as printed`);
})();
(function whereRank() {
  const T = P.weight_type; $("#where-src").textContent = "Hu et al. (2021), Table 5";
  const bet = makeBet("#bet-where", ["одна матрица, ранг 8", "несколько матриц, ранг 2–4", "одинаково"], 1);
  const best = k => Math.max(...T[k]);
  $("#where-table").innerHTML = `<thead><tr><th>adapted</th>${T.cols.map(([w]) => `<th class="num">${esc(w)}</th>`).join("")}</tr><tr><th>rank r</th>${T.cols.map(([, r]) => `<th class="num">${r}</th>`).join("")}</tr></thead><tbody>` +
    [["wikisql", "WikiSQL"], ["mnli", "MultiNLI"]].map(([k, l]) => `<tr><td>${l} (±${T.sd[k]})</td>${T[k].map(v => `<td class="num">${v === best(k) ? "<b>": ""}${v.toFixed(1)}${v === best(k) ? "</b>": ""}</td>`).join("")}</tr>`).join("") + "</tbody>";
  revealBets("btn-where-reveal", [bet]);
  const RK = P.rank; $("#r-src").textContent = "Hu et al. (2021), Table 6";
  const bet2 = makeBet("#bet-r", ["r = 1", "r = 4", "r = 8", "нужен ранг 64"], 0);
  const cols = { "Wq": "--ink-3", "Wq, Wv": "--cls-1", "Wq, Wk, Wv, Wo": "--cls-2" };
  function draw() { [["mnli", "MultiNLI"], ["wikisql", "WikiSQL"]].forEach(([k, l]) => lineChart($("#r-chart-" + k), { W: 520, H: 300, xlog: true, xticks: RK.r, xfmt: v => String(v), series: Object.entries(RK[k]).map(([w, y]) => ({ label: w, x: RK.r, y, color: css(cols[w]) })), xlabel: `rank r · ${l}`, ylabel: "точность, %", fs: 13, legendX: 300 })); }
  revealBets("btn-r-reveal", [bet2], () => { draw(); REDRAW.push(draw); });
})();
const SORT_ITEMS = [["только голова", () => trainable("lp")], ["обучаемый префикс, 12 токенов", () => trainable("pt", { n: 12 })], ["BitFit", () => trainable("bitfit")], ["LoRA, r = 8 на c_attn", () => trainable("lora", { r: 8 })], ["адаптеры, m = 64", () => trainable("adapter", { m: 64 })]];
(function sortBet() {
  const names = SORT_ITEMS.map(x => x[0]), shuffled = [names[3], names[2], names[4], names[0], names[1]];
  const trueOrder = SORT_ITEMS.slice().sort((a, b) => a[1]() - b[1]()).map(x => x[0]);
  const pick = orderPick("sort-pick", shuffled, trueOrder);
  $("#btn-sort-reveal").addEventListener("click", e => { const placed = $$("#sort-pick button i").length > 0; tally(pick.reveal(), placed); e.target.disabled = true; e.target.textContent = "открыто";
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
    box(s, 70, 20, 260, 30, "голова: score 768 → 2", { fs: 13, fill: mode === "pt" || mode === "lora" || mode === "lp" || mode === "bitfit" || mode === "adapter" || all ? on : off, stroke: onS });
    lay(64, "ln_f", null);
    const r = el("rect", { x: 50, y: 110, width: 390, height: 330, rx: 10, fill: "none", stroke: css("--rule-strong"), "stroke-dasharray": "5 4" }); s.appendChild(r);
    txt(s, 460, 280, "× 12", { fs: 18, bold: true, color: css("--ink"), anchor: "start" });
    lay(400, "ln_1", "ln"); lay(360, "attn · c_attn  768 → 2304 (Q, K, V)", "c_attn"); lay(320, "attn · c_proj  768 → 768", "attn_proj"); adapter(292);
    lay(250, "ln_2", "ln"); lay(210, "mlp · c_fc  768 → 3072", "c_fc"); lay(170, "mlp · c_proj  3072 → 768", "mlp_proj"); adapter(142);
    if (mode === "adapter") { s.querySelectorAll("rect").forEach(n => { }); }
    if (mode === "adapter") [400, 250, 64].forEach(y => box(s, 70, y, 260, 30, y === 64 ? "ln_f": y === 400 ? "ln_1": "ln_2", { fs: 13, fill: on, stroke: onS }));
    lay(470, "wte 50 258 × 768 · wpe 1 024 × 768", null);
    if (mode === "pt") { for (let i = 0; i < Math.min(o.n, 20); i++) s.appendChild(el("rect", { x: 70 + i * 13, y: 512, width: 10, height: 26, rx: 2, fill: css("--cls-1") })); txt(s, 70, 552, `${o.n} токенов; показано ${Math.min(o.n, 20)}`, { anchor: "start", fs: 12.5, color: css("--cls-1") }); }
    host.appendChild(s);
    const t = trainable(mode, o);
    $("#map-out").innerHTML = stat(num(t), "обучаемых параметров") + stat((100 * t / GP.total).toPrecision(2) + "%", "от параметров GPT-2") + stat(mb(4 * t), "для хранения, fp32");
    const ref = mode === "lora" && o.r === 8 && tgt === "c_attn" ? RUN.lora.trainable : mode === "pt" && o.n === 12 ? RUN.pt.trainable : mode === "ft" ? RUN.ft.trainable : mode === "lp" ? RUN.lp.trainable : null;
    $("#map-check").innerHTML = ref == null ? "no notebook run with these settings": okText(t === ref, `matches the notebook: ${num(ref)}`); }
  ["map-r", "map-m", "map-n"].forEach(id => $("#" + id).addEventListener("input", draw));
  toggle("map-t", m => { tgt = m; draw(); }); toggle("map-btns", m => { mode = m; draw(); }); draw(); REDRAW.push(draw);
})();
(function speed() {
  const ratio = RUN.lora.it_s / RUN.ft.it_s; $("#speed-meta").textContent = `${M.device}, batch ${M.batch}, ${M.year}`;
  $("#bet-speed-q").innerHTML = TXT("bet-speed", { pct: (100 * RUN.lora.trainable / RUN.ft.trainable).toFixed(2) + "%" });
  const bet = makeBet("#bet-speed", ["примерно в 400 раз", "примерно в 10 раз", "примерно в 2 раза", "в пределах 20%"], ratio > 100 ? 0 : ratio > 5 ? 1 : ratio > 1.5 ? 2 : 3);
  revealBets("btn-speed-reveal", [bet], () => { const mx = Math.max(...Object.values(RUN).map(r => r.it_s));
    const SH = { ft: "полное дообучение", lp: "только голова", lora: "LoRA", pt: "prompt", lpft: "LP-FT" };
    bar($("#speed-out"), Object.entries(RUN).map(([k, r]) => ({ label: `${SH[k]} · ${(r.wall_s / 60).toFixed(1)} min`, p: r.it_s / mx, text: r.it_s.toFixed(2), color: css(r === RUN.lora ? "--cls-1": "--ink-3") })));
    $("#speed-note").innerHTML = TXT("speed-note", { lora: RUN.lora.it_s.toFixed(2), ft: RUN.ft.it_s.toFixed(2), faster: (100 * (ratio - 1)).toFixed(0) }); });
})();
const SIZES = [["GPT-2 small", 124e6], ["1B", 1e9], ["3B", 3e9], ["7B", 7e9], ["13B", 13e9], ["34B", 34e9], ["70B", 70e9]];
const LORA_FRAC = 0.004;
function memBill(N) { const a = LORA_FRAC * N;
  return { FT: { weights: 4 * N, grads: 4 * N, optimizer: 8 * N }, LoRA: { weights: 2 * N + 4 * a, grads: 4 * a, optimizer: 8 * a }, QLoRA: { weights: 0.516 * N + 4 * a, grads: 4 * a, optimizer: 8 * a } }; }
const sumB = o => o.weights + o.grads + o.optimizer;
(function memory() {
  const BET_N = 13e9, T4 = 16e9; $("#mem-meta").textContent = "байт/параметр: обучение 4 + 4 + 8; замороженная основа 2 или ≈ 0,52";
  const host = $("#fit-pick"); const names = ["FT", "LoRA", "QLoRA"], picked = new Set();
  host.innerHTML = names.map(n => `<button data-n="${n}">${n === "FT" ? "fine-tuning": n}</button>`).join("");
  host.addEventListener("click", e => { const b = e.target.closest("button[data-n]"); if (!b || host.dataset.done) return; const n = b.dataset.n; picked.has(n) ? picked.delete(n) : picked.add(n); b.classList.toggle("pick", picked.has(n)); });
  function draw() { const [lab, N] = SIZES[+$("#mem-n").value]; $("#mem-n-v").textContent = lab; const B = memBill(N), mx = Math.max(sumB(B.FT), 90e9);
    const W = 900, H = 200, L = 120, R = 30; const s = svg(W, H); s.style.maxWidth = "900px"; const X = v => L + v / mx * (W - L - R);
    const parts = [["weights", "--ink-3"], ["grads", "--cls-0"], ["optimizer", "--cls-2"]];
    names.forEach((n, i) => { let x = L; const y = 24 + i * 46; txt(s, L - 10, y + 22, n === "FT" ? "FT": n, { anchor: "end", fs: 14, color: css("--ink") });
      parts.forEach(([k, c]) => { const w = X(B[n][k]) - L; if (w > 0.3) s.appendChild(el("rect", { x, y, width: Math.max(w, 1), height: 30, fill: css(c), opacity: .85 })); x += w; });
      txt(s, Math.min(x + 8, W - 120), y + 21, (sumB(B[n]) / 1e9).toFixed(sumB(B[n]) < 10e9 ? 1 : 0) + " GB", { anchor: "start", fs: 13.5, bold: true, color: css("--ink") }); });
    [[16e9, "T4 · 16 GB"], [80e9, "A100 · 80 GB"]].forEach(([v, t]) => { if (v > mx) return; s.appendChild(el("line", { x1: X(v), x2: X(v), y1: 18, y2: 166, stroke: css("--bad"), "stroke-dasharray": "4 4" })); txt(s, X(v) + 4, 12, t, { anchor: "start", fs: 12.5, color: css("--bad") }); });
    let lx = L; parts.forEach(([k, c]) => { s.appendChild(el("rect", { x: lx, y: H - 12, width: 12, height: 10, fill: css(c) })); txt(s, lx + 16, H - 3, k, { anchor: "start", fs: 12 }); lx += 110; });
    $("#mem-chart").innerHTML = ""; $("#mem-chart").appendChild(s); }
  $("#mem-n").addEventListener("input", draw);
  $("#btn-fit-reveal").addEventListener("click", e => { host.dataset.done = 1; const B = memBill(BET_N); let ok = true;
    $$("button", host).forEach(b => { const fits = sumB(B[b.dataset.n]) <= T4; b.classList.add(fits ? "yes": "no"); if (fits !== picked.has(b.dataset.n)) ok = false; });
    tally(ok, picked.size > 0); $("#mem-out").hidden = false; $("#fit-note").hidden = false; e.target.disabled = true; e.target.textContent = "открыто";
    $("#fit-note").innerHTML = TXT("fit-note", { ft: (sumB(B.FT) / 1e9).toFixed(0) + " GB", t4s: Math.ceil(sumB(B.FT) / T4), lora: (sumB(B.LoRA) / 1e9).toFixed(1) + " GB", qlora: (sumB(B.QLoRA) / 1e9).toFixed(1) + " GB" });
    draw(); REDRAW.push(draw); document.dispatchEvent(new CustomEvent("revealed", { detail: "btn-fit-reveal" })); });
})();
(function store() {
  const full = 4 * GP.total, ad = 4 * RUN.lora.trainable;
  slider("store-n", v => v, n => { $("#store-out").innerHTML = stat(mb(n * full), `${n} полных копий`) + stat(mb(full + n * ad), `одна основа + ${n} адаптеров LoRA`) + stat(Math.round(n * full / (full + n * ad)) + "×", "экономия хранения"); });
  $("#store-note").innerHTML = TXT("store-note", { full: mb(full), adapter: mb(ad) });
})();
(function board() {
  const keys = Object.keys(RUN), n = M.n_valid; $("#board-meta").textContent = `${n} sentences · ${M.device}, ${M.year}`;
  const label = k => RUN[k].label; const trueOrder = keys.slice().sort((a, b) => RUN[b].acc - RUN[a].acc).map(label);
  const pick = orderPick("board-pick", [label("pt"), label("lora"), label("lp"), label("lpft"), label("ft")], trueOrder);
  const se = p => Math.sqrt(p * (1 - p) / n); const d = RUN.lpft.acc - RUN.ft.acc, sed = Math.hypot(se(RUN.lpft.acc), se(RUN.ft.acc));
  const bet = makeBet("#bet-lpft", ["better", "различий недостаточно", "worse"], Math.abs(d) < 2 * sed ? 1 : d > 0 ? 0 : 2);
  function draw() { const host = $("#board-chart"); host.innerHTML = ""; const W = 900, L = 240, R = 80, rows = keys.slice().sort((a, b) => RUN[b].acc - RUN[a].acc), H = 30 + rows.length * 40; const s = svg(W, H); s.style.maxWidth = "900px";
    const x0 = 0.6, x1 = 0.95, X = v => L + (v - x0) / (x1 - x0) * (W - L - R);
    [0.6, 0.7, 0.8, 0.9].forEach(v => { s.appendChild(el("line", { x1: X(v), x2: X(v), y1: 10, y2: H - 22, stroke: css("--rule") })); txt(s, X(v), H - 6, accTxt(v), { fs: 12.5, color: css("--ink-3") }); });
    rows.forEach((k, i) => { const y = 20 + i * 40, a = RUN[k].acc, e = se(a); txt(s, L - 10, y + 5, label(k), { anchor: "end", fs: 14, color: css("--ink") });
      s.appendChild(el("line", { x1: X(a - e), x2: X(a + e), y1: y, y2: y, stroke: css("--cls-1"), "stroke-width": 8, opacity: .35 }));
      s.appendChild(el("circle", { cx: X(a), cy: y, r: 6, fill: css("--cls-1") })); txt(s, X(a + e) + 10, y + 5, accTxt(a), { anchor: "start", fs: 13.5, bold: true, color: css("--ink") }); });
    host.appendChild(s);
    const C = D.synthetic.curves; lineChart($("#curves-chart"), { W: 900, H: 280, series: keys.map((k, i) => ({ label: label(k), x: C.steps, y: C[k], color: css(["--ink-2", "--ink-3", "--cls-1", "--cls-0", "--cls-2"][i]), dash: k === "lp" })), xlabel: "шаг обучения", ylabel: "точность на проверке", ymin: 0.45, ymax: 1.0, legendX: 560 }); }
  revealBets("btn-board-reveal", [bet], () => { tally(pick.reveal(), $$("#board-pick button i").length > 0);
    $("#curves-head").innerHTML = `<span class="illus">Учебная иллюстрация</span> Промежуточные кривые синтетические; измерены итоговые точки.`;
    draw(); REDRAW.push(draw);
    $("#board-note").innerHTML = TXT("board-note", { n, se: (100 * se(RUN.ft.acc)).toFixed(1), lora_pct: (100 * RUN.lora.trainable / RUN.ft.trainable).toFixed(2) + "%" }); });
  const T = P.gpt3; $("#gpt3-src").textContent = "Hu et al. (2021), Table 4";
  $("#gpt3-table").innerHTML = `<thead><tr><th>method</th><th class="num">trainable</th><th class="num">WikiSQL</th><th class="num">MultiNLI</th></tr></thead><tbody>` +
    T.rows.map(([m, p, w, mn]) => `<tr class="${m === "LoRA" ? "hl": ""}"><td>${esc(RU(m))}</td><td class="num">${p >= 1000 ? num(p) : p.toFixed(1)}M</td><td class="num">${w.toFixed(1)}</td><td class="num">${mn.toFixed(1)}</td></tr>`).join("") + "</tbody>";
})();
linkCodeAndFormulas();
window.COPIED.peft = {D, redrawAll, trainable, TOY, memBill};
})();
(function() {
let markerSerial = 0;
const TXT = (key, values) => window.TXT("a-" + key, values);
"use strict";
const D = DATA.alignment;
const $ = (s, r) => (r || document).querySelector(s.replace(/#([\w-]+)/g, "#a-$1"));
const $$ = (s, r) => Array.from((r || document).querySelectorAll(s.replace(/#([\w-]+)/g, "#a-$1")));
const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const NS = "http://www.w3.org/2000/svg";
function svg(w, h) { const s = document.createElementNS(NS, "svg"); s.setAttribute("viewBox", `0 0 ${w} ${h}`); s.setAttribute("width", "100%"); s.style.maxWidth = w + "px"; return s; }
const PAINT = { fill: 1, stroke: 1 };
function el(tag, attrs, text) {
  const n = document.createElementNS(NS, tag); let style = "";
  for (const k in attrs) { const v = attrs[k]; if (PAINT[k] && typeof v === "string" && v.startsWith("var(")) style += `${k}:${v};`; else if (PAINT[k] && typeof v === "string" && v.startsWith("color-mix(")) style += `${k}:${v};`; else n.setAttribute(k, v); }
  if (style) n.setAttribute("style", style); if (text != null) n.textContent = RU(text); return n;
}
const TIP = $("#tip");
function tipOn(node, html) {
  node.addEventListener("pointerenter", e => { TIP.innerHTML = typeof html === "function" ? html() : html; TIP.style.opacity = "1"; moveTip(e); });
  node.addEventListener("pointermove", moveTip); node.addEventListener("pointerleave", () => { TIP.style.opacity = "0"; });
}
function moveTip(e) { const pad = 14, r = TIP.getBoundingClientRect(); let x = e.clientX + pad, y = e.clientY + pad; if (x + r.width > innerWidth - 8) x = e.clientX - r.width - pad; if (y + r.height > innerHeight - 8) y = e.clientY - r.height - pad; TIP.style.left = x + "px"; TIP.style.top = y + "px"; }
const css = name => `var(${name})`;
const TINT = (v, pct) => `color-mix(in srgb, var(${v}) ${pct}%, var(--panel))`;
function txt(s, x, y, t, o) { o = o || {}; return s.appendChild(el("text", { x, y, "font-size": o.fs || 13.5, "text-anchor": o.anchor || "middle", fill: o.color || css("--ink-2"), "font-weight": o.bold ? "600": "400", "font-style": o.italic ? "italic": "normal", "font-family": o.mono ? "var(--mono)": "var(--body)" }, t)); }
function rect(s, x, y, w, h, o) { o = o || {}; return s.appendChild(el("rect", { x, y, width: Math.max(0, w), height: Math.max(0, h), rx: o.rx == null ? 3 : o.rx, fill: o.fill || "none", stroke: o.stroke || "none", "stroke-width": o.sw || 1.2, "stroke-dasharray": o.dash ? "4 4": "none", opacity: o.op == null ? 1 : o.op })); }
function line(s, x1, y1, x2, y2, o) { o = o || {}; return s.appendChild(el("line", { x1, y1, x2, y2, stroke: o.color || css("--rule"), "stroke-width": o.sw || 1, "stroke-dasharray": o.dash ? "4 4": "none" })); }
function arrow(s, x1, y1, x2, y2, o) { o = o || {}; const color = o.color || css("--ink-2"), id = "a-arr-" + (++markerSerial) + "-" + String(color).replace(/[^a-z0-9]/gi, "");
  if (!s.querySelector("#" + id)) { let defs = s.querySelector("defs"); if (!defs) { defs = el("defs", {}); s.insertBefore(defs, s.firstChild); } const m = el("marker", { id, viewBox: "0 0 10 10", refX: 9, refY: 5, markerWidth: 6, markerHeight: 6, orient: "auto-start-reverse" }); m.appendChild(el("path", { d: "M 0 0 L 10 5 L 0 10 z", fill: color })); defs.appendChild(m); }
  return s.appendChild(el("path", { d: o.d || `M ${x1} ${y1} L ${x2} ${y2}`, fill: "none", stroke: color, "stroke-width": o.sw || 1.6, "stroke-dasharray": o.dash ? "4 4": "none", opacity: o.op == null ? 1 : o.op, "marker-end": o.noHead ? "none": `url(#${id})` })); }
const pct = (x, d) => (100 * x).toFixed(d == null ? 0 : d);
const num = x => Number(x).toLocaleString("ru-RU");
const sig = x => 1 / (1 + Math.exp(-x));
const stat = (v, k) => `<div class="stat"><span class="v">${v}</span><span class="k">${RU(k)}</span></div>`;
function plot(host, o) {
  const W = o.w || 560, H = o.h || 300, L = o.l || 54, R = o.r || 16, T = o.t || 14, B = o.b || 42;
  const s = svg(W, H); const fs = o.fs || 12;
  const lx = v => o.logx ? Math.log10(v) : v, ly = v => o.logy ? Math.log10(v) : v;
  const X = v => L + (lx(v) - lx(o.x[0])) / (lx(o.x[1]) - lx(o.x[0])) * (W - L - R);
  const Y = v => H - B - (ly(v) - ly(o.y[0])) / (ly(o.y[1]) - ly(o.y[0])) * (H - T - B);
  (o.yt || []).forEach(v => { line(s, L, Y(v), W - R, Y(v), { color: css("--rule"), dash: 1 }); txt(s, L - 6, Y(v) + 4, o.yf ? o.yf(v) : String(v), { anchor: "end", fs, mono: 1, color: css("--ink-3") }); });
  (o.xt || []).forEach(v => { line(s, X(v), H - B, X(v), H - B + 4, { color: css("--rule-strong") }); txt(s, X(v), H - B + 17, o.xf ? o.xf(v) : String(v), { fs, mono: 1, color: css("--ink-3") }); });
  line(s, L, H - B, W - R, H - B, { color: css("--rule-strong") });
  if (o.xl) txt(s, (L + W - R) / 2, H - 6, o.xl, { fs, color: css("--ink-3") });
  if (o.yl) txt(s, L, T - 2 + fs, o.yl, { fs, anchor: "start", color: css("--ink-3") });
  (o.series || []).forEach(sr => {
    const pts = sr.pts.map(p => `${X(p[0]).toFixed(1)},${Y(p[1]).toFixed(1)}`);
    s.appendChild(el("polyline", { points: pts.join(" "), fill: "none", stroke: sr.color, "stroke-width": sr.sw || 2.4, "stroke-dasharray": sr.dash ? "6 5": "none", opacity: sr.op == null ? 1 : sr.op }));
    if (sr.dots) sr.pts.forEach(p => s.appendChild(el("circle", { cx: X(p[0]), cy: Y(p[1]), r: 3.4, fill: sr.color, opacity: sr.op == null ? 1 : sr.op })));
  });
  host.innerHTML = ""; host.appendChild(s); return { s, X, Y, W, H, L, R, T, B };
}
function makeBet(host, options, answer) {
  const h = typeof host === "string" ? $(host) : host;
  h.insertAdjacentHTML("beforeend", options.map((o, i) => `<button data-opt="${i}">${esc(RU(o))}</button>`).join("") + `<span class="verdict"></span>`);
  const st = { pick: null, revealed: false, answer };
  h.addEventListener("click", e => { const b = e.target.closest("button[data-opt]"); if (!b || st.revealed) return; st.pick = +b.dataset.opt; $$("button[data-opt]", h).forEach(x => x.classList.toggle("pick", x === b)); });
  st.reveal = () => { st.revealed = true; const v = $(".verdict", h);
    $$("button[data-opt]", h).forEach(x => { const i = +x.dataset.opt; x.classList.toggle("right", i === st.answer); x.classList.toggle("wrong", i === st.pick && i !== st.answer); });
    if (st.pick === null) { v.textContent = "ответ не выбран"; v.className = "verdict"; } else if (st.pick === st.answer) { v.textContent = "верно"; v.className = "verdict ok"; } else { v.textContent = "неверно"; v.className = "verdict no"; }
    return st.pick === st.answer; };
  return st;
}
function reveal(btnId, outIds, noteId, bets, after) {
  $("#" + btnId).addEventListener("click", e => { (bets || []).forEach(b => b.reveal()); outIds.forEach(id => { const n = $("#" + id); if (n) n.hidden = false; }); if (noteId) $("#" + noteId).hidden = false;
    const veil = e.target.closest(".panel").querySelector(".veil"); if (veil) veil.remove(); e.target.disabled = true; e.target.textContent = "открыто";
    if (after) after(); });
}
function states(id, items, on) {
  const h = $("#" + id);
  if (items) h.innerHTML = items.map(([k, l], i) => `<button data-m="${esc(k)}"${i === 0 ? ' class="sel"' : ""}>${l}</button>`).join("");
  let mode = $("button.sel", h).dataset.m;
  h.addEventListener("click", e => { const b = e.target.closest("button[data-m]"); if (!b) return; mode = b.dataset.m; $$("button", h).forEach(x => x.classList.toggle("sel", x === b)); on(mode); });
  return () => mode;
}
const CHECKS = [];
function check(id, ok, text) {
  const h = $("#" + id); if (h) h.innerHTML = `<b class="${ok ? "" : "no"}">${ok ? "✓": "✗"}</b> ${esc(text)}`;
  CHECKS.push({ id: id.replace(/-check$/, ""), ok });
}
const close = (a, b, tol) => Math.abs(a - b) <= (tol == null ? 1e-3 : tol);
function linkCodeAndFormulas() {
  const all = $$("#copy-alignment [data-f]"); const toks = n => (n.dataset.f || "").split(/\s+/).filter(Boolean);
  all.forEach(n => { if (n._linked) return; n._linked = true;
    n.addEventListener("pointerenter", () => { const mine = toks(n); all.forEach(m => m.classList.toggle("hi", toks(m).some(t => mine.includes(t)))); });
    n.addEventListener("pointerleave", () => all.forEach(m => m.classList.remove("hi"))); });
}
function code(host, text, f) {
  $(host).innerHTML = text.split("\n").map(l => { let tok = ""; for (const k in (f || {})) if (l.includes(k)) tok = f[k];
    const body = esc(l).replace(/^(\s*)(def|class|return|for|in|if|else|import|from|with)\b/g, '$1<span class="kw">$2</span>').replace(/(#.*)$/, '<span class="c">$1</span>');
    return `<span class="ln"${tok ? ` data-f="${tok}"` : ""}>${body}</span>`; }).join("");
  linkCodeAndFormulas();
}
const LATER = [];
const later = f => LATER.push(f);
const runLater = () => { const next = () => { const f = LATER.shift(); if (!f) { window.READY = true; return; } try { f(); performance.mark("x:" + f.name); } catch (e) { console.error(e); } setTimeout(next, 0); }; setTimeout(next, 0); };
const REDRAW = [];
function redrawAll() { REDRAW.forEach(f => { try { f(); } catch (_) { } }); }
document.addEventListener("add-theme", redrawAll);
performance.mark("x:stages");
(function stages() {
  const PROMPT = ["What", "is", "17", "×", "3", "?"];
  const ROWS = [
    { stage: "pretraining", sub: "+ продолжение предобучения", data: "веб, код, книги, математика", size: "триллионы токенов", from: ["nobody", "w = 1"],
      strips: [{ toks: ["Paris", "is", "the", "capital", "of", "France", ".", "It", "is"], w: "1" }] },
    { stage: "SFT", sub: "обучение на ответах", data: "(запрос, готовый ответ)", size: "сотни тысяч диалогов", from: ["nobody", "w = 1 на ответе"],
      strips: [{ prompt: 1, toks: ["17", "×", "3", "=", "51", "."], w: "1", tag: "готовый ответ" }] },
    { stage: "DPO", sub: "обучение на предпочтениях", data: "(запрос, лучший, худший)", size: "378 тыс. пар", from: ["сравнение", "вверх для одного, вниз для другого"],
      strips: [{ prompt: 1, toks: ["17", "×", "3", "=", "51", "."], w: "+", tag: "better" }, { prompt: 1, toks: ["It", "is", "41", "."], w: "−", tag: "worse" }] },
    { stage: "RLVR", sub: "проверяемая награда", data: "(запрос, проверка)", size: "тысячи задач × много попыток", from: ["проверка", "верно или неверно"],
      strips: [{ prompt: 1, toks: ["51"], w: "+", tag: "✓", own: 1 }, { prompt: 1, toks: ["3", "×", "17", "=", "51"], w: "+", tag: "✓", own: 1 }, { prompt: 1, toks: ["17", "×", "3", "=", "41"], w: "−", tag: "✗", own: 1 }] },
  ];
  const COL = { "1": "--cls-0", "+": "--good", "−": "--bad" };
  const TIPS = { "1": "in the sum, w<sub>t</sub> = 1", "+": "in the sum, w<sub>t</sub> &gt; 0: its probability is pushed up", "−": "in the sum, w<sub>t</sub> &lt; 0: its probability is pushed down" };
  const TW = t => Math.max(20, t.length * 7.6 + 10);
  function draw() {
    const host = $("#fig-stages"); host.innerHTML = "";
    const W = 940, X0 = 290, XR = 722, SH = 44, GAP = 22, HEAD = 34;
    const H = HEAD + ROWS.reduce((a, r) => a + Math.max(66, r.strips.length * SH + 8) + GAP, 0) + 14;
    const s = svg(W, H);
    txt(s, 16, 20, "стадия · данные · объём (OLMo 2 1B)", { anchor: "start", fs: 12, color: css("--ink-3") });
    txt(s, X0, 20, "токены обучающего сигнала", { anchor: "start", fs: 12, color: css("--ink-3") });
    txt(s, XR + 12, 20, "источник веса wₜ", { anchor: "start", fs: 12, color: css("--ink-3") });
    let y = HEAD;
    ROWS.forEach((r, ri) => {
      const rh = Math.max(66, r.strips.length * SH + 8);
      if (ri) s.appendChild(el("line", { x1: 16, y1: y - GAP / 2, x2: W - 16, y2: y - GAP / 2, stroke: css("--rule"), "stroke-width": 1 }));
      txt(s, 16, y + 16, r.stage, { anchor: "start", fs: 16, bold: 1, color: css("--ink") });
      txt(s, 16, y + 33, r.sub, { anchor: "start", fs: 12, color: css("--ink-2") });
      txt(s, 16, y + 50, r.data, { anchor: "start", fs: 12, color: css("--ink-2") });
      txt(s, 16, y + 66, r.size, { anchor: "start", fs: 11.5, mono: 1, color: css("--ink-3") });
      r.strips.forEach((st, si) => {
        let x = X0; const ty = y + si * SH + 4;
        if (st.prompt) PROMPT.forEach(t => { const w = TW(t);
          const b = s.appendChild(el("rect", { x, y: ty, width: w - 3, height: 22, rx: 3, fill: css("--panel-sunk"), stroke: css("--rule-strong"), "stroke-dasharray": "3 3" }));
          tipOn(b, "запрос: контекст без целевых меток");
          txt(s, x + (w - 3) / 2, ty + 15.5, t, { fs: 12.5, mono: 1, color: css("--ink-3") }); x += w; });
        if (st.prompt) x += 8;
        const c = COL[st.w];
        st.toks.forEach(t => { const w = TW(t);
          const b = s.appendChild(el("rect", { x, y: ty, width: w - 3, height: 22, rx: 3, fill: TINT(c, st.own ? 30 : 16), stroke: css(c), "stroke-width": 1.3 }));
          tipOn(b, TIPS[st.w] + (st.own ? "<br>sampled from the model itself": ""));
          txt(s, x + (w - 3) / 2, ty + 15.5, t, { fs: 12.5, mono: 1, color: css("--ink") });
          txt(s, x + (w - 3) / 2, ty + 35, st.w === "1" ? "1": st.w === "+" ? "↑": "↓", { fs: 11, mono: 1, bold: st.w !== "1", color: st.w === "1" ? css("--ink-3") : css(c) });
          x += w; });
        if (st.own && si === 0) txt(s, x + 30, ty + 15.5, "← ответы самой модели", { anchor: "start", fs: 12, italic: 1, color: css("--ink-2") });
        if (st.tag) txt(s, x + 8, ty + 15.5, st.tag, { anchor: "start", fs: st.tag.length === 1 ? 15 : 12, bold: st.tag.length === 1, color: st.tag.length === 1 ? css(c) : css("--ink-2"), italic: st.tag.length > 1 });
      });
      if (r.strips[0].prompt && ri === 1) txt(s, X0, y + SH + 14, "запрос служит контекстом", { anchor: "start", fs: 11.5, italic: 1, color: css("--ink-3") });
      txt(s, XR + 12, y + 16, r.from[0], { anchor: "start", fs: 14, bold: 1, color: css("--ink") });
      txt(s, XR + 12, y + 33, r.from[1].length > 22 ? r.from[1].split(", ")[0] + ",": r.from[1], { anchor: "start", fs: 12, color: css("--ink-2") });
      if (r.from[1].length > 22) txt(s, XR + 12, y + 49, r.from[1].split(", ").slice(1).join(", "), { anchor: "start", fs: 12, color: css("--ink-2") });
      y += rh + GAP;
    });
    txt(s, X0, H - 8, "↑ / ↓  вес повышает или понижает вероятность токена", { anchor: "start", fs: 11.5, italic: 1, color: css("--ink-3") });
    host.appendChild(s);
  }
  draw(); REDRAW.push(draw);
})();
const FLOW_K = {
  data:   { fill: () => css("--panel-sunk"), stroke: () => css("--rule-strong"), tag: "" },
  train:  { fill: () => TINT("--cls-0", 20), stroke: () => css("--cls-0"), tag: "∇ · обучается" },
  frozen: { fill: () => css("--panel"), stroke: () => css("--ink-3"), tag: "заморожено · без ∇", dash: 1 },
  prog:   { fill: () => TINT("--cls-2", 16), stroke: () => css("--cls-2"), tag: "программа · без ∇" },
  const:  { fill: () => css("--panel-sunk"), stroke: () => css("--rule-strong"), tag: "constant", dash: 1 },
  loss:   { fill: () => TINT("--bad", 14), stroke: () => css("--bad"), tag: "ошибка" },
};
function flowFig(key, spec) {
  let mode = "fwd";
  const N = {}; spec.nodes.forEach(n => { N[n.id] = n; });
  const port = (n, side) => side === "r" ? [n.x + n.w, n.y + n.h / 2] : side === "l" ? [n.x, n.y + n.h / 2] : side === "t" ? [n.x + n.w / 2, n.y] : [n.x + n.w / 2, n.y + n.h];
  function draw() {
    const s = svg(940, spec.h), bwd = mode === "bwd";
    spec.fwd.forEach(e => { const [x1, y1] = port(N[e.a], e.as || "r"), [x2, y2] = port(N[e.b], e.bs || "l");
      arrow(s, x1, y1, x2 - (e.bs === "t" || e.bs === "b" ? 0 : 2), y2, { color: css("--ink-3"), sw: 1.5, op: bwd ? 0.3 : 1 });
      if (e.stop) { const mx = (x1 + x2) / 2, my = (y1 + y2) / 2;
        txt(s, mx, my + 5, "✕", { fs: 15, bold: 1, color: css("--bad") });
        if (e.stop !== true) txt(s, mx + (e.lx || 0), my + (e.ly || -10), e.stop, { fs: 10.5, italic: 1, color: css("--bad") }); }
      if (e.t) txt(s, (x1 + x2) / 2 + (e.tx || 0), (y1 + y2) / 2 + (e.ty || -8), e.t, { fs: 10.5, mono: 1, color: css("--ink-3") }); });
    spec.nodes.forEach(n => { const K = FLOW_K[n.k];
      rect(s, n.x, n.y, n.w, n.h, { fill: K.fill(), stroke: K.stroke(), sw: n.k === "train" && bwd ? 2.6 : 1.5, dash: K.dash });
      txt(s, n.x + n.w / 2, n.y + (n.s ? 20 : 26), n.t, { fs: 13, bold: 1, color: n.k === "frozen" ? css("--ink-2") : css("--ink") });
      if (n.s) txt(s, n.x + n.w / 2, n.y + 36, n.s, { fs: 10.5, color: css("--ink-2") });
      if (K.tag && n.k !== "data") txt(s, n.x + n.w / 2, n.y + n.h - 7, K.tag, { fs: 10, mono: 1, bold: n.k === "train", color: n.k === "train" ? css("--cls-0") : n.k === "loss" ? css("--bad") : css("--ink-3") }); });
    spec.back.forEach(e => { const [x1, y1] = port(N[e.a], e.as || "b"), [x2, y2] = port(N[e.b], e.bs || "b"), yc = e.y;
      arrow(s, 0, 0, 0, 0, { d: `M ${x1} ${y1} C ${x1} ${yc}, ${x2} ${yc}, ${x2} ${y2 + (y2 < yc ? 3 : -3)}`, color: css("--bad"), sw: bwd ? 2.6 : 1.4, dash: 1, op: bwd ? 1 : 0.25 });
      if (e.t) txt(s, (x1 + x2) / 2, yc + (yc > y1 ? -6 : 14) + (e.ty || 0), "∇  " + e.t, { fs: 11.5, bold: bwd, color: bwd ? css("--bad") : css("--ink-3") }); });
    const host = $("#flow-" + key); host.innerHTML = ""; host.appendChild(s);
  }
  states(`flow-${key}-st`, null, m => { mode = m; draw(); });
  draw(); REDRAW.push(draw);
}
later(function flows() {
  flowFig("sft", { h: 210, nodes: [
      { id: "d", k: "data", x: 10, y: 50, w: 175, h: 60, t: "dialogue", s: "запрос + готовый ответ" },
      { id: "p", k: "train", x: 235, y: 50, w: 165, h: 60, t: "π_θ", s: "все слои" },
      { id: "z", k: "data", x: 450, y: 50, w: 165, h: 60, t: "logits", s: "на каждой позиции" },
      { id: "l", k: "loss", x: 665, y: 46, w: 265, h: 68, t: "cross-entropy", s: "только ответ: labels ≠ −100" }],
    fwd: [{ a: "d", b: "p" }, { a: "p", b: "z" }, { a: "z", b: "l" }],
    back: [{ a: "l", b: "p", y: 185, t: "во все слои, включая вычисления над запросом" }] });
  flowFig("rm", { h: 210, nodes: [
      { id: "d", k: "data", x: 10, y: 50, w: 190, h: 60, t: "пара", s: "запрос + выбранный / отвергнутый" },
      { id: "m", k: "train", x: 250, y: 50, w: 190, h: 60, t: "модель награды r_φ", s: "SFT + выход из одного числа" },
      { id: "r", k: "data", x: 490, y: 50, w: 150, h: 60, t: "r_c, r_r", s: "два числа" },
      { id: "l", k: "loss", x: 690, y: 46, w: 240, h: 68, t: "−log σ(r_c − r_r)", s: "Bradley–Terry для пары" }],
    fwd: [{ a: "d", b: "m" }, { a: "m", b: "r" }, { a: "r", b: "l" }],
    back: [{ a: "l", b: "m", y: 185, t: "через оба ответа с общими весами" }] });
  flowFig("ppo", { h: 400, nodes: [
      { id: "x", k: "data", x: 10, y: 140, w: 110, h: 60, t: "prompt" },
      { id: "p", k: "train", x: 160, y: 140, w: 140, h: 60, t: "π_θ", s: "обучаемая модель" },
      { id: "y", k: "data", x: 345, y: 140, w: 130, h: 60, t: "ответ y", s: "собственная генерация" },
      { id: "m", k: "frozen", x: 520, y: 30, w: 150, h: 60, t: "модель награды", s: "одно число" },
      { id: "f", k: "frozen", x: 520, y: 140, w: 150, h: 60, t: "π_ref", s: "log π_ref по токенам" },
      { id: "v", k: "train", x: 520, y: 250, w: 150, h: 60, t: "critic V", s: "ценность префикса" },
      { id: "a", k: "const", x: 705, y: 140, w: 100, h: 60, t: "Â_t", s: "GAE" },
      { id: "l", k: "loss", x: 830, y: 132, w: 100, h: 76, t: "clip(ρ·Â)", s: "+ (V − G)²" }],
    fwd: [{ a: "x", b: "p" }, { a: "p", b: "y", stop: "выбор токена: без ∇", ly: 44 }, { a: "y", b: "m" }, { a: "y", b: "f" }, { a: "y", b: "v" },
      { a: "m", b: "a", stop: true }, { a: "f", b: "a", stop: true }, { a: "v", b: "a", stop: true }, { a: "a", b: "l" }],
    back: [{ a: "l", b: "p", y: 375, t: "в π_θ через log π_θ порождённых токенов" }, { a: "l", b: "v", bs: "r", y: 290, t: "", ty: 0 }] });
  flowFig("dpo", { h: 360, nodes: [
      { id: "d", k: "data", x: 10, y: 155, w: 165, h: 60, t: "пара", s: "запрос, выбранный, отвергнутый" },
      { id: "p", k: "train", x: 225, y: 75, w: 160, h: 60, t: "π_θ", s: "обучаемая модель" },
      { id: "f", k: "frozen", x: 225, y: 235, w: 160, h: 60, t: "π_ref", s: "исходная SFT-модель" },
      { id: "q", k: "data", x: 435, y: 75, w: 200, h: 60, t: "log π(y_c), log π(y_r)", s: "два числа" },
      { id: "c", k: "const", x: 435, y: 235, w: 200, h: 60, t: "log π_ref(y_c), (y_r)", s: "можно вычислить заранее" },
      { id: "l", k: "loss", x: 690, y: 147, w: 240, h: 76, t: "−log σ(β[Δ_c − Δ_r])", s: "Δ = log π − log π_ref" }],
    fwd: [{ a: "d", b: "p" }, { a: "d", b: "f" }, { a: "p", b: "q" }, { a: "f", b: "c" }, { a: "q", b: "l" }, { a: "c", b: "l" }],
    back: [{ a: "l", b: "p", as: "t", bs: "t", y: 8, t: "через оба ответа, с весом σ(−разность)", ty: 6 }] });
  flowFig("grpo", { h: 340, nodes: [
      { id: "x", k: "data", x: 10, y: 125, w: 105, h: 60, t: "prompt" },
      { id: "p", k: "train", x: 150, y: 125, w: 135, h: 60, t: "π_θ", s: "обучаемая модель" },
      { id: "y", k: "data", x: 330, y: 125, w: 140, h: 60, t: "G ответов", s: "собственная генерация" },
      { id: "c", k: "prog", x: 515, y: 30, w: 140, h: 60, t: "checker", s: "r_i ∈ {0, 1}" },
      { id: "f", k: "frozen", x: 515, y: 220, w: 140, h: 60, t: "π_ref", s: "только для KL" },
      { id: "a", k: "const", x: 690, y: 30, w: 115, h: 60, t: "A_i", s: "(r − mean) / std" },
      { id: "l", k: "loss", x: 820, y: 117, w: 110, h: 76, t: "−A_i log π_θ", s: "+ β · KL" }],
    fwd: [{ a: "x", b: "p" }, { a: "p", b: "y", stop: "выбор токена: без ∇", ly: 44 }, { a: "y", b: "c" }, { a: "c", b: "a" }, { a: "a", b: "l", stop: true }, { a: "y", b: "f" }, { a: "f", b: "l", stop: true }],
    back: [{ a: "l", b: "p", y: 320, t: "через log π_θ своих токенов; один A_i на ответ" }] });
  const W = D.weights, KINDS = [["embed_tokens", "embedding"], ["q_proj", "q"], ["k_proj", "k"], ["v_proj", "v"], ["o_proj", "o"], ["gate_proj", "gate"], ["up_proj", "up"], ["down_proj", "down"], ["norm", "norms"], ["lm_head", "lm_head"]];
  [["sft", "SFT"], ["dpo", "DPO"], ["grpo", "RLVR"]].forEach(([key, st]) => { const w = W[st];
    $(`#flow-${key}-w`).innerHTML = `<div class="flow-wgrid"><div>${stat(pct(w.changed) + "%", `изменилось чисел, ${w.from} → ${st}`)}${stat("100%", "параметров участвуют в градиенте")}</div><div>` +
      KINDS.map(([k, l]) => `<div class="pbar"><span class="lab">${l}</span><span class="bar"><i style="width:${pct(w.by_kind[k], 1)}%;background:${k === "embed_tokens" || k === "lm_head" ? "var(--cls-1)": "var(--cls-0)"}"></i></span><span class="v">${pct(w.by_kind[k])}%</span></div>`).join("") + `</div></div>` +
      `<div class="small-note" style="font-family:var(--body);font-size:16px;color:var(--ink-2);line-height:1.55;margin-top:10px">${key === "sft" ? TXT("weights-note-sft", { changed: pct(w.changed, 1) })
        : TXT("weights-note", { changed: pct(w.changed), numel: num(w.numel), from: w.from, emb: pct(w.by_kind.embed_tokens), head: pct(w.by_kind.lm_head) })}</div>`;
  });
});
const ST = D.stages, ORDER = ["base", "SFT", "DPO", "RLVR"];
function stageRow(name, fresh) {
  const r = ST.rows[name];
  const cell = (t, i) => {
    let body = esc(t);
    if (name === "base") { const cut = t.indexOf("\nQuestion:"); if (cut >= 0) body = esc(t.slice(0, cut)) + `<span class="made" title="модель придумала следующий вопрос">${esc(t.slice(cut))}</span>`; }
    return `<td><div class="ans" title="нажмите, чтобы раскрыть">${body.trim() ? body : '<span class="made">(только пробельные символы)</span>'}</div></td>`; };
  return `<tr class="${fresh ? "new": ""}"><td class="st"><b>${name}</b><span>GSM8K ${String(r.gsm_acc)}</span><span>stops ${pct(r.gsm_stopped)}%</span><span>open: ${Math.round(r.open_tokens)} tok</span><span>bits/byte ${r.bits_per_byte.toFixed(3)}</span><span>${num(r.params)} params</span></td>${r.answers.map(cell).join("")}</tr>`;
}
function stageTable(i, k, fresh) {
  const head = `<thead><tr><th>stage</th>${ST.prompts.map((q, j) => `<th class="data-th">${esc(q)}${j === 0 ? "" : ""}</th>`).join("")}</tr></thead>`;
  $("#stagetab-" + i).innerHTML = head + "<tbody>" + ORDER.slice(0, k).map((n, j) => stageRow(n, fresh && j === k - 1)).join("") + "</tbody>";
}
document.addEventListener("click", e => { const a = e.target.closest(".stagetab .ans"); if (a) a.classList.toggle("open"); });
const firstRefusal = ORDER.findIndex(n => /sorry|can't|cannot|unable/i.test(ST.rows[n].answers[2]));
const refusalBet = makeBet("#bet-refusal", ORDER, firstRefusal);
const R0 = ST.rows;
const STAGE_NOTES = [
  () => TXT("stagetab-base"),
  () => TXT("stagetab-sft", { stopSft: pct(R0.SFT.gsm_stopped), stopBase: pct(R0.base.gsm_stopped), gsmSft: String(R0.SFT.gsm_acc), gsmBase: String(R0.base.gsm_acc), bpbBase: R0.base.bits_per_byte.toFixed(3), bpbSft: R0.SFT.bits_per_byte.toFixed(3) }),
  () => TXT("stagetab-dpo", { nOpen: ST.n_open, openSft: Math.round(R0.SFT.open_tokens), openDpo: Math.round(R0.DPO.open_tokens), stopOpenSft: pct(R0.SFT.open_stopped), stopOpenDpo: pct(R0.DPO.open_stopped), gsmSft: String(R0.SFT.gsm_acc), gsmDpo: String(R0.DPO.gsm_acc) }),
  () => TXT("stagetab-rlvr", { gsmDpo: String(R0.DPO.gsm_acc), gsmRlvr: String(R0.RLVR.gsm_acc), tokDpo: Math.round(R0.DPO.gsm_tokens), tokRlvr: Math.round(R0.RLVR.gsm_tokens), openRlvr: Math.round(R0.RLVR.open_tokens), bpbRlvr: R0.RLVR.bits_per_byte.toFixed(3) }),
];
stageTable(0, 1); $("#stagetab-note-0").innerHTML = STAGE_NOTES[0]();
[1, 2, 3].forEach(i => {
  stageTable(i, i);
  $("#btn-stagetab-" + i).addEventListener("click", e => {
    stageTable(i, i + 1, true); $("#stagetab-note-" + i).innerHTML = STAGE_NOTES[i](); $("#stagetab-note-" + i).hidden = false;
    if (i === 1) refusalBet.reveal();
    e.target.disabled = true; e.target.textContent = "добавлено"; });
});
later(function mask() {
  const S = D.sft, host = $("#mask-tokens"), picked = new Set();
  const show = t => t.replace(/\n/g, "↵");
  host.innerHTML = S.pieces.map((p, i) => `<span class="tok pick" data-i="${i}">${esc(show(p)) || "·"}</span>` + (p.includes("\n") ? '<span class="gap"></span>' : "")).join("");
  const toks = $$(".tok", host);
  host.addEventListener("click", e => { const t = e.target.closest(".tok.pick"); if (!t) return; const i = +t.dataset.i;
    picked.has(i) ? picked.delete(i) : picked.add(i); t.classList.toggle("on", picked.has(i)); $("#mask-count").textContent = `${picked.size} marked`; });
  function paint(m) {
    toks.forEach((t, i) => { const loss = m === "off" || S.labels[i] === 1; t.classList.toggle("ans", loss); t.classList.toggle("dim", !loss); });
    $("#mask-count").textContent = m === "off" ? `${S.n_tokens} of ${S.n_tokens} carry loss` : `${S.n_loss} of ${S.n_tokens} carry loss`;
    $("#mask-note").innerHTML = m === "off" ? TXT("mask-off-note", { prompt: S.n_tokens - S.n_loss, answer: S.n_loss })
      : TXT("mask-note", { loss: S.n_loss, n: S.n_tokens, rest: S.n_tokens - S.n_loss });
  }
  $("#btn-mask-reveal").addEventListener("click", e => {
    const hit = [...picked].filter(i => S.labels[i] === 1).length, extra = picked.size - hit, missed = S.n_loss - hit;
    $("#mask-score").innerHTML = TXT("mask-score", { picked: picked.size, hit, missed, extra });
    toks.forEach(t => { t.classList.remove("pick", "on"); });
    $("#mask-mode").hidden = false; $("#mask-note").hidden = false; paint("on");
    e.target.disabled = true; e.target.textContent = "открыто";
  });
  states("mask-mode", null, paint);
});
later(function trl() {
  const TRL = `from trl import SFTConfig, SFTTrainer
# the prompt–completion format: the loss goes on the completion only — the mask of sft_example
data = Dataset.from_list([{"prompt": d[:-1], "completion": d[-1:]} for d in train_dialogues])
args = SFTConfig(
    output_dir="sft-smollm2",
    max_length=512,                                # sft_example's cut
    per_device_train_batch_size=8,
    gradient_accumulation_steps=2,                 # 16 dialogues per step, as in train_sft
    learning_rate=5e-5,
    lr_scheduler_type="linear",                    # AdamW, linear decay, no weight decay, clip at 1.0: train_sft's defaults too
    num_train_epochs=1,
    train_sampling_strategy="group_by_length",     # batches of similar length: less padding
    logging_steps=10,
    save_strategy="no",
)
trainer = SFTTrainer(model=SMALL_BASE, args=args, train_dataset=data, processing_class=small_tok)   # the -Instruct template
print("маска совпадает:", trainer.train_dataset[0]["labels"] == sft_example(small_tok, train_dialogues[0])["labels"])
trainer.train()`;
  code("#code-trl", TRL, { "prompt–completion": "mask", '"completion"': "mask", "max_length": "cut", "per_device_train_batch_size": "step", "gradient_accumulation": "step",
    "learning_rate": "loop", "lr_scheduler_type": "loop", "train_sampling_strategy": "batch", "the same mask": "check mask" });
  $("#mask-tokens").setAttribute("data-f", "mask");
  $("#fig-collate").setAttribute("data-f", "batch");
  linkCodeAndFormulas();
  const C = D.sft.collate;
  const padShare = ls => { let real = 0, box = 0; for (let i = 0; i < ls.length; i += C.batch) { const b = ls.slice(i, i + C.batch); real += b.reduce((a, x) => a + x, 0); box += Math.max(...b) * b.length; } return 1 - real / box; };
  const pr = padShare(C.lengths_random), ps = padShare(C.lengths_sorted);
  check("collate-check", close(pr, C.pad_random, 1e-4) && close(ps, C.pad_sorted, 1e-4), "padding shares = Python's");
  function draw() {
    const W = 940, colW = 440, rowH = 3.2, gap = 7, top = 30, nb = Math.ceil(C.lengths_random.length / C.batch);
    const H = top + nb * (C.batch * rowH + gap) + 10, maxL = Math.max(...C.lengths_random);
    const s = svg(W, H);
    [[C.lengths_random, "случайный порядок", pr, 10], [C.lengths_sorted, "train_sampling_strategy = \"group_by_length\"", ps, 490]].forEach(([ls, title, share, x0]) => {
      txt(s, x0, 16, `${title} · дополнение ${pct(share)}%`, { anchor: "start", fs: 12.5, color: css("--ink") });
      for (let b = 0; b < nb; b++) { const chunk = ls.slice(b * C.batch, (b + 1) * C.batch), wmax = Math.max(...chunk), yb = top + b * (C.batch * rowH + gap);
        chunk.forEach((l, i) => { const y = yb + i * rowH;
          rect(s, x0, y, l / maxL * colW, rowH - 0.6, { fill: css("--cls-0"), rx: 0 });
          rect(s, x0 + l / maxL * colW, y, (wmax - l) / maxL * colW, rowH - 0.6, { fill: TINT("--cls-1", 45), rx: 0 }); });
        line(s, x0 + wmax / maxL * colW, yb - 1, x0 + wmax / maxL * colW, yb + C.batch * rowH, { color: css("--ink-3") }); }
    });
    const host = $("#fig-collate"); host.innerHTML = ""; host.appendChild(s);
    host.insertAdjacentHTML("beforeend", `<div class="legend"><span><i class="sw" style="background:var(--cls-0)"></i>tokens of a dialogue</span><span><i class="sw" style="background:${TINT("--cls-1", 45)}"></i>padding: IGNORE in the labels, 0 in the attention mask</span><span>one block = one batch of ${C.batch}</span></div>`);
  }
  draw(); REDRAW.push(draw);
  $("#collate-note").innerHTML = TXT("collate-note", { n: C.lengths_random.length, mean: Math.round(C.mean_len), batch: C.batch, padRandom: pct(pr), padSorted: pct(ps) });
});
later(function policy() {
  const ITEMS = [["sft", "SFT"], ["dpo", "DPO"], ["online", "online DPO"], ["grpo", "PPO · GRPO"], ["rs", "rejection sampling"]];
  const LIT = { sft: ["off"], dpo: ["off"], online: ["on"], grpo: ["on"], rs: ["rs"] };
  const JUDGE = { sft: "", dpo: "", online: "picks the better of two", grpo: "RM · checker", rs: "keeps the right ones" };
  const DATA = { sft: "готовые ответы", dpo: "готовые пары: лучший, худший", online: "", grpo: "", rs: "the model's own verified answers" };
  let mode = "sft";
  function box(s, x, y, w, h, title, sub, on, col) {
    rect(s, x, y, w, h, { fill: on ? TINT(col, 18) : css("--panel"), stroke: on ? css(col) : css("--rule-strong"), sw: on ? 2 : 1.2, dash: !on });
    txt(s, x + w / 2, y + (sub ? h / 2 - 3 : h / 2 + 5), title, { fs: 14, bold: 1, color: on ? css("--ink") : css("--ink-3") });
    if (sub) txt(s, x + w / 2, y + h / 2 + 15, sub, { fs: 11.5, color: on ? css("--ink-2") : css("--ink-3") });
  }
  function draw() {
    const s = svg(940, 300), lit = LIT[mode], off = lit.includes("off"), on = lit.includes("on"), rs = lit.includes("rs");
    const cOff = "--cls-3", cOn = "--cls-2";
    txt(s, 215, 22, "готовые данные до обучения", { fs: 13, bold: 1, color: off || rs ? css("--ink") : css("--ink-3") });
    txt(s, 695, 22, "модель порождает ответы во время обучения", { fs: 13, bold: 1, color: on || rs ? css("--ink") : css("--ink-3") });
    line(s, 470, 10, 470, 290, { color: css("--rule") });
    box(s, 40, 46, 350, 64, "данные собраны до обучения", DATA[mode] || "веб · человек · модель-учитель · пары", off || rs, cOff);
    box(s, 40, 146, 150, 52, "loss", off || rs ? (mode === "dpo" ? "the DPO loss": "следующий токен, w = 1") : "", off || rs, cOff);
    box(s, 240, 146, 150, 52, "модель", "π_θ", off || rs, cOff);
    arrow(s, 115, 110, 115, 144, { color: off || rs ? css(cOff) : css("--rule-strong") });
    arrow(s, 190, 172, 238, 172, { color: off || rs ? css(cOff) : css("--rule-strong") });
    txt(s, 215, 232, "градиент обновляет модель;", { fs: 12, italic: 1, color: css("--ink-3") });
    txt(s, 215, 248, "новые ответы не собираются", { fs: 12, italic: 1, color: css("--ink-3") });
    box(s, 520, 46, 150, 52, "модель", "текущая π_θ", on || rs, cOn);
    box(s, 740, 46, 170, 52, "samples", "собственные ответы", on || rs, cOn);
    box(s, 740, 146, 170, 52, "judge", JUDGE[mode] || "проверка · модель награды · сравнение", on || rs, cOn);
    box(s, 520, 146, 150, 52, "loss", on ? "weighted by the judge": "", on, cOn);
    arrow(s, 670, 72, 738, 72, { color: on || rs ? css(cOn) : css("--rule-strong") });
    arrow(s, 825, 98, 825, 144, { color: on || rs ? css(cOn) : css("--rule-strong") });
    arrow(s, 740, 172, 672, 172, { color: on ? css(cOn) : css("--rule-strong") });
    arrow(s, 595, 146, 595, 100, { color: on ? css(cOn) : css("--rule-strong"), sw: on ? 2.2 : 1.6 });
    txt(s, 700, 232, "градиент обновляет модель,", { fs: 12, italic: 1, color: css("--ink-3") });
    txt(s, 700, 248, "которая породила эти токены", { fs: 12, italic: 1, color: css("--ink-3") });
    if (rs) { arrow(s, 0, 0, 0, 0, { d: "M 740 186 C 640 290, 330 300, 300 112", color: css("--cls-1"), sw: 2.2, dash: 1 });
      txt(s, 520, 284, "выбранные ответы становятся данными SFT", { fs: 12.5, bold: 1, color: css("--cls-1") }); }
    const host = $("#fig-policy"); host.innerHTML = ""; host.appendChild(s);
    $("#policy-fig-note").innerHTML = TXT("policy-s-" + mode);
  }
  states("policy-states", ITEMS, m => { mode = m; draw(); });
  draw(); REDRAW.push(draw);
});
const LETTERS = ["A", "B", "C", "D"];
const PAIRS = [[0, 1], [0, 2], [0, 3], [1, 2], [1, 3], [2, 3]];
const BT = D.bt;
function agreement(w) {
  const shares = [];
  PAIRS.forEach(([i, j]) => { const n = w[i][j] + w[j][i]; if (n > 0) shares.push(Math.max(w[i][j], w[j][i]) / n); });
  const mean = shares.reduce((a, x) => a + x, 0) / Math.max(1, shares.length);
  let cycle = false;
  for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) for (let k = 0; k < 4; k++)
    if (i !== j && j !== k && i !== k && w[i][j] > w[j][i] && w[j][k] > w[k][j] && w[k][i] > w[i][k]) cycle = true;
  return { shares, mean, kappa: (mean - 0.5) / 0.5, cycle };
}
function btStep(w, r) {
  const n = r.length, p = r.map(Math.exp), out = [];
  for (let i = 0; i < n; i++) { let W = 0, den = 0;
    for (let j = 0; j < n; j++) if (j !== i) { W += w[i][j]; den += (w[i][j] + w[j][i]) / (p[i] + p[j]); }
    out.push(W > 0 ? W / Math.max(den, 1e-12) : 1e-6); }
  const lg = out.map(Math.log), m = lg.reduce((a, x) => a + x, 0) / n;
  return lg.map(x => x - m);
}
const btNll = (w, r) => { let s = 0; for (let i = 0; i < r.length; i++) for (let j = 0; j < r.length; j++) if (i !== j && w[i][j]) s -= w[i][j] * Math.log(sig(r[i] - r[j]) + 1e-300); return s; };
later(function btCheck() {
  const w = BT.check.wins; let r = [0, 0, 0, 0]; const traj = [];
  for (let k = 0; k < BT.check.steps; k++) { r = btStep(w, r); traj.push(r); }
  const a = agreement(w);
  check("bt-check", traj[0].every((x, i) => close(x, BT.check.r_first[i])) && r.every((x, i) => close(x, BT.check.r_final[i])) && close(btNll(w, r), BT.check.nll_final, 1e-2)
    && close(a.mean, BT.check.agreement.mean) && a.cycle === BT.check.agreement.cycle, "шаги Bradley–Terry, ошибка и согласованность сверены с Python");
});
later(function label() {
  const it = BT.item; let revealed = false;
  $("#uf-prompt").textContent = it.instruction;
  $("#label-src").textContent = it.source === "stages.json" ? "OLMo 2 1B's four stages": `UltraFeedback · ${it.source}`;
  const W = [[0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]];
  const any = () => PAIRS.some(([i, j]) => W[i][j] + W[j][i] > 0);
  function cards() {
    $("#uf-answers").innerHTML = it.completions.map((c, i) => `<div class="uf-card"><div class="h"><b>${LETTERS[i]}</b>${revealed ? `<span>${esc(c.model)}${c.score != null ? ` · judge ${c.score}` : ""}</span>` : ""}</div><div class="t">${esc(c.text)}</div></div>`).join("");
  }
  $("#uf-votes").insertAdjacentHTML("beforebegin", `<div class="small-note" style="margin:14px 0 6px">hands up for the left answer, hands up for the right one — type the counts</div>`);
  $("#uf-votes").innerHTML = PAIRS.map(([i, j]) =>
    `<div class="uf-vote"><input type="number" min="0" data-i="${i}" data-j="${j}" placeholder="0"><span><b>${LETTERS[i]}</b> vs <b>${LETTERS[j]}</b></span><input type="number" min="0" data-i="${j}" data-j="${i}" placeholder="0"><span class="bar"><i></i></span></div>`).join("");
  function agree() {
    if (!any()) { $("#agree-out").innerHTML = stat("—", "голосов за большинство пары") + stat("—", "κ с поправкой на случайность") + stat("—", "цикл предпочтений большинства"); $("#agree-note").innerHTML = ""; $$(".uf-vote .bar i").forEach(i => { i.style.width = "0"; }); return; }
    const a = agreement(W);
    $$(".uf-vote").forEach((row, k) => { const [i, j] = PAIRS[k], n = W[i][j] + W[j][i]; $(".bar i", row).style.width = n ? pct(W[i][j] / n) + "%": "0"; });
    $("#agree-out").innerHTML = stat(pct(a.mean) + "%", "голосов за большинство пары") + stat(a.kappa.toFixed(2), "κ с поправкой на случайность") + stat(a.cycle ? "yes": "no", "цикл предпочтений большинства");
    $("#agree-note").innerHTML = TXT("agree-note", { mean: pct(a.mean), kappa: a.kappa.toFixed(2), cycle: TXT(a.cycle ? "agree-cycle-yes": "agree-cycle-no") });
  }
  $("#uf-votes").addEventListener("input", e => { const t = e.target.closest("input"); if (!t) return; W[+t.dataset.i][+t.dataset.j] = Math.max(0, +t.value || 0); agree(); btReset(); });
  let r = [0, 0, 0, 0], k = 0;
  const order = rr => rr.map((x, i) => [x, i]).sort((a, b) => b[0] - a[0]).map(([, i]) => LETTERS[i]).join(" > ");
  function btDraw() {
    const s = svg(420, 200), X = v => 210 + v * 70;
    line(s, X(0), 10, X(0), 180, { color: css("--rule-strong") });
    [-2, -1, 1, 2].forEach(v => { line(s, X(v), 10, X(v), 180, { color: css("--rule"), dash: 1 }); txt(s, X(v), 196, (v > 0 ? "+": "") + v, { fs: 11, mono: 1, color: css("--ink-3") }); });
    txt(s, X(0), 196, "0", { fs: 11, mono: 1, color: css("--ink-3") });
    r.forEach((v, i) => { const y = 18 + i * 42, c = ["--cls-0", "--cls-1", "--cls-2", "--cls-3"][i];
      rect(s, Math.min(X(0), X(Math.max(-2.8, Math.min(2.8, v)))), y, Math.abs(X(Math.max(-2.8, Math.min(2.8, v))) - X(0)), 26, { fill: TINT(c, 55), stroke: css(c), rx: 2 });
      txt(s, 18, y + 18, LETTERS[i], { fs: 15, bold: 1, color: css("--ink") });
      txt(s, v >= 0 ? X(Math.min(2.8, v)) + 8 : X(Math.max(-2.8, v)) - 8, y + 18, (v >= 0 ? "+": "") + v.toFixed(2), { fs: 12, mono: 1, anchor: v >= 0 ? "start": "end", color: css("--ink") }); });
    const h = $("#bt-scores"); h.innerHTML = '<div class="hm-title">scores r</div>'; h.appendChild(s);
    let tb = `<div class="hm-title">model <span style="text-transform:none">σ(r<sub>row</sub> − r<sub>col</sub>)</span> · the votes' share</div><table class="conf bt-mat"><tr><th></th>${LETTERS.map(l => `<th>${l}</th>`).join("")}</tr>`;
    for (let i = 0; i < 4; i++) { tb += `<tr><th>${LETTERS[i]}</th>`; for (let j = 0; j < 4; j++) { if (i === j) { tb += "<td>—</td>"; continue; }
      const n = W[i][j] + W[j][i], obs = n ? W[i][j] / n : null, mod = sig(r[i] - r[j]);
      tb += `<td class="${obs != null && Math.abs(mod - obs) < 0.05 ? "hit": ""}">${mod.toFixed(2)}<br><span class="obs">${obs == null ? "·": obs.toFixed(2)}</span></td>`; } tb += "</tr>"; }
    $("#bt-matrix").innerHTML = tb + "</table>";
    $("#bt-step-line").innerHTML = TXT("bt-step", { k, nll: btNll(W, r).toFixed(2), order: order(r) });
  }
  function btReset() { r = [0, 0, 0, 0]; k = 0; btDraw(); }
  $("#btn-bt-step").addEventListener("click", () => { if (!any()) return; r = btStep(W, r); k++; btDraw(); });
  $("#btn-bt-run").addEventListener("click", () => { if (!any()) return; for (let i = 0; i < 60; i++) { r = btStep(W, r); k++; } btDraw(); });
  $("#btn-bt-reset").addEventListener("click", btReset);
  $("#btn-bt-reveal").addEventListener("click", e => {
    revealed = true; cards(); e.target.disabled = true; e.target.textContent = "открыто";
    if (any()) { for (let i = 0; i < 60; i++) { r = btStep(W, r); k++; } btDraw(); }
    const sc = it.completions.map(c => c.score);
    if (sc.some(x => x == null)) { $("#bt-note").hidden = true; return; }
    if (!any()) { $("#bt-note").innerHTML = TXT("bt-reveal-novotes", { judge: sc.map((x, i) => [x, i]).sort((a, b) => b[0] - a[0]).map(([, i]) => LETTERS[i]).join(" > ") }); $("#bt-note").hidden = false; return; }
    const judge = sc.map((x, i) => [x, i]).sort((a, b) => b[0] - a[0]).map(([, i]) => LETTERS[i]).join(" > "), room = order(r);
    $("#bt-note").innerHTML = TXT(judge === room ? "bt-reveal-agree": "bt-reveal-disagree", { judge, room }); $("#bt-note").hidden = false;
  });
  cards(); agree(); btDraw(); REDRAW.push(btDraw);
});
later(function roles() {
  const BOX = [
    { k: "pol", t: "модель π_θ", s: "обучается · генерирует", c: "--cls-0" },
    { k: "ref", t: "reference", s: "заморожена · оценивает", c: "--ink-3" },
    { k: "rm", t: "модель награды", s: "заморожена · одно число", c: "--cls-1" },
    { k: "crit", t: "critic V", s: "обучается · ценность", c: "--cls-3" },
    { k: "chk", t: "checker", s: "программа", c: "--cls-2" },
    { k: "pairs", t: "pairs", s: "готовые данные", c: "--cls-1" },
  ];
  const USE = { ppo: ["pol", "ref", "rm", "crit"], dpo: ["pol", "ref", "pairs"], grpo: ["pol", "ref", "chk"] };
  const FLOW = {
    ppo: ["prompt", "π_θ порождает ответ", "модель награды оценивает", "critic оценивает префиксы", "PPO обновляет π_θ и V; KL к π_ref"],
    dpo: ["запрос + пара", "log π_θ и log π_ref обоих", "margin β[Δ_c − Δ_r]", "−log σ(margin)", "обновление π_θ"],
    grpo: ["prompt", "π_θ порождает G ответов", "проверка: 1 / 0", "A = (r − mean) / std", "обновление π_θ; KL к π_ref"],
  };
  const SIZE = { ppo: "policy, reference, награда, critic · два обучаются · генерации в цикле", dpo: "policy и reference · одна обучается · готовые пары", grpo: "policy и reference · одна обучается · генерации в цикле" };
  let mode = "ppo";
  function draw() {
    const s = svg(940, 250), use = USE[mode], bw = 142, gap = 12;
    BOX.forEach((b, i) => { const x = 10 + i * (bw + gap), on = use.includes(b.k);
      rect(s, x, 14, bw, 62, { fill: on ? TINT(b.c, 18) : css("--panel"), stroke: on ? css(b.c) : css("--rule"), sw: on ? 2 : 1, dash: !on });
      txt(s, x + bw / 2, 40, b.t, { fs: 13.5, bold: 1, color: on ? css("--ink") : css("--ink-3") });
      txt(s, x + bw / 2, 60, b.s, { fs: 11, color: on ? css("--ink-2") : css("--ink-3") });
      if (!on) line(s, x + 8, 20, x + bw - 8, 70, { color: css("--rule-strong") }); });
    const f = FLOW[mode], fw = 172, fy = 120;
    f.forEach((t, i) => { const x = 10 + i * (fw + 15);
      rect(s, x, fy, fw, 46, { fill: css("--panel-sunk"), stroke: css("--rule-strong") });
      const words = t.split(" "), half = Math.ceil(words.length / 2), l1 = t.length > 24 ? words.slice(0, half).join(" ") : t, l2 = t.length > 24 ? words.slice(half).join(" ") : "";
      txt(s, x + fw / 2, fy + (l2 ? 19 : 28), l1, { fs: 12, color: css("--ink") }); if (l2) txt(s, x + fw / 2, fy + 35, l2, { fs: 12, color: css("--ink") });
      if (i < f.length - 1) arrow(s, x + fw + 1, fy + 23, x + fw + 14, fy + 23, { color: css("--ink-3") }); });
    if (mode !== "dpo") arrow(s, 0, 0, 0, 0, { d: `M ${10 + 4 * (fw + 15) + fw / 2} ${fy + 46} C ${10 + 4 * (fw + 15) + fw / 2} 220, ${10 + fw / 2} 220, ${10 + fw / 2 + 30} ${fy + 48}`, color: css("--cls-0"), dash: 1 });
    txt(s, 470, 240, SIZE[mode], { fs: 12.5, bold: 1, color: css("--ink-2") });
    const host = $("#fig-roles"); host.innerHTML = ""; host.appendChild(s);
  }
  states("roles-states", [["ppo", "RLHF · PPO"], ["dpo", "DPO"], ["grpo", "GRPO"]], m => { mode = m; draw(); });
  draw(); REDRAW.push(draw);
});
later(function dpo() {
  const E = D.dpo.examples;
  const loss = (pc, pr, rc, rr, b) => { const m = b * ((pc - rc) - (pr - rr)); return { m, loss: -Math.log(sig(m)), w: sig(-m), rc: b * (pc - rc), rr: b * (pr - rr) }; };
  check("dpo-check", ["b", "c"].every(k => { const e = E[k], o = loss(e.pi_chosen, e.pi_rejected, e.ref_chosen, e.ref_rejected, D.dpo.beta);
    return close(o.m, e.margin) && close(o.loss, e.loss) && close(o.w, e.grad_weight) && close(o.rc, e.r_chosen) && close(o.rr, e.r_rejected); }), "два численных примера из ноутбука");
  window.COPIED.alignment.dpoLoss = loss;
  const SL = [["refc", "log π_ref(выбранного)", -80, 0, 1], ["refr", "log π_ref(отвергнутого)", -80, 0, 1], ["polc", "log π(выбранного)", -80, 0, 1], ["polr", "log π(отвергнутого)", -80, 0, 1], ["beta", "β", 0.01, 1, 0.01]];
  $("#dpo-sliders").innerHTML = SL.map(([k, l, a, b, st]) => `<div><label class="field">${l} <b id="a-dpo-${k}-v"></b></label><input type="range" id="a-dpo-${k}" min="${a}" max="${b}" step="${st}"></div>`).join("");
  const set = v => { for (const k in v) $("#dpo-" + k).value = v[k]; draw(); };
  const PRE = { b: { refc: -40, refr: -42, polc: -35, polr: -52, beta: D.dpo.beta }, c: { refc: -40, refr: -42, polc: -45, polr: -62, beta: D.dpo.beta }, init: { refc: -40, refr: -42, polc: -40, polr: -42, beta: D.dpo.beta } };
  function draw() {
    const v = {}; SL.forEach(([k]) => { v[k] = +$("#dpo-" + k).value; $(`#dpo-${k}-v`).textContent = k === "beta" ? v[k].toFixed(2) : v[k]; });
    const o = loss(v.polc, v.polr, v.refc, v.refr, v.beta);
    $("#dpo-out").innerHTML = stat((o.rc >= 0 ? "+": "") + o.rc.toFixed(2), "неявная награда выбранного") + stat((o.rr >= 0 ? "+": "") + o.rr.toFixed(2), "неявная награда отвергнутого") +
      stat(o.m.toFixed(2), "margin") + stat(o.loss.toFixed(3), "loss") + stat(o.w.toFixed(2), "вес градиента σ(−разность)") +
      stat("×" + (Math.exp(v.polc - v.refc) >= 0.01 ? Math.exp(v.polc - v.refc).toPrecision(2) : Math.exp(v.polc - v.refc).toExponential(0)), "вероятность выбранного относительно reference");
    const s = svg(760, 120), X = x => 120 + (x + 80) / 80 * 600;
    [-80, -60, -40, -20, 0].forEach(t => { line(s, X(t), 14, X(t), 96, { color: css("--rule"), dash: 1 }); txt(s, X(t), 112, t, { fs: 11, mono: 1, color: css("--ink-3") }); });
    [["chosen", v.refc, v.polc, 34], ["rejected", v.refr, v.polr, 74]].forEach(([n, a, b, y]) => {
      txt(s, 10, y + 4, n, { anchor: "start", fs: 13, bold: 1, color: css("--ink") });
      s.appendChild(el("circle", { cx: X(a), cy: y, r: 5, fill: css("--panel"), stroke: css("--ink-3"), "stroke-width": 1.5 }));
      if (Math.abs(X(b) - X(a)) > 6) arrow(s, X(a), y, X(b), y, { color: b > a ? css("--good") : css("--bad"), sw: 2.4 });
      txt(s, X(a), y - 10, "ref", { fs: 10.5, mono: 1, color: css("--ink-3") }); });
    const h = $("#fig-dpo-bars"); h.innerHTML = ""; h.appendChild(s);
  }
  $("#dpo-sliders").addEventListener("input", draw);
  states("dpo-presets", null, m => set(PRE[m]));
  set(PRE.b); REDRAW.push(draw);
});
const PP = D.dpo.pairs, SUM = D.dpo.summary;
function pairStats(stage, keep) {
  let n = 0, mp = 0, up = 0, both = 0;
  for (let i = 0; i < PP.n; i++) { if (!keep(i)) continue; n++;
    const dc = PP[stage].chosen[i] - PP.SFT.chosen[i], dr = PP[stage].rejected[i] - PP.SFT.rejected[i];
    if (dc > dr) mp++; if (dc > 0) up++; if (dc < 0 && dr < 0) both++; }
  return { n, margin_pos: mp / n, chosen_up: up / n, both_down: both / n };
}
later(function pairs() {
  check("pairs-check", ["DPO", "RLVR"].every(st => { const a = pairStats(st, () => true), p = SUM[st].all;
    return a.n === p.n && close(a.margin_pos, p.margin_pos, 2e-3) && close(a.chosen_up, p.chosen_up, 2e-3) && close(a.both_down, p.both_down, 2e-3); }), "доли DPO и RLVR совпали с Python");
  const A = SUM.DPO.all;
  const bet = makeBet("#bet-pairs", ["меньше 25%", "25–50%", "50–75%", "больше 75%"], Math.min(3, Math.floor(A.chosen_up * 4)));
  const sources = Object.keys(SUM.DPO.by_source);
  $("#pairs-source").innerHTML = `<option value="">все ${PP.n}</option><option value="on">ответы SFT-модели</option><option value="off">ответы других моделей</option>` + sources.map(s => `<option value="${esc(s)}">${esc(s)} · ${SUM.DPO.by_source[s].n}</option>`).join("");
  let stage = "DPO";
  function draw() {
    const f = $("#pairs-source").value, keep = i => !f || (f === "on" ? PP.on_policy[i] : f === "off" ? !PP.on_policy[i] : PP.source[i] === f);
    const lim = 200, s = svg(470, 456), L = 50, T = 14, Wd = 400, X = v => L + (Math.max(-lim, Math.min(lim, v)) + lim) / (2 * lim) * Wd, Y = v => T + (lim - Math.max(-lim, Math.min(lim, v))) / (2 * lim) * Wd;
    rect(s, X(-lim), Y(lim), Wd, Wd, { fill: css("--panel"), stroke: css("--rule") });
    s.appendChild(el("polygon", { points: `${X(-lim)},${Y(-lim)} ${X(lim)},${Y(-lim)} ${X(lim)},${Y(lim)}`, fill: TINT("--good", 7) }));
    rect(s, X(-lim), Y(0), Wd / 2, Wd / 2, { fill: TINT("--bad", 6), rx: 0 });
    line(s, X(-lim), Y(0), X(lim), Y(0), { color: css("--rule-strong") }); line(s, X(0), Y(-lim), X(0), Y(lim), { color: css("--rule-strong") });
    line(s, X(-lim), Y(-lim), X(lim), Y(lim), { color: css("--ink-3"), dash: 1 });
    [-200, -100, 100, 200].forEach(t => { txt(s, X(t), T + Wd + 16, t, { fs: 10.5, mono: 1, color: css("--ink-3") }); txt(s, L - 6, Y(t) + 4, t, { fs: 10.5, mono: 1, anchor: "end", color: css("--ink-3") }); });
    txt(s, L + Wd / 2, T + Wd + 32, "Δ log π(выбранного), относительно SFT →", { fs: 12, color: css("--ink-2") });
    txt(s, L + 6, T + 14, "↑ Δ log π(отвергнутого)", { fs: 12, anchor: "start", color: css("--ink-2") });
    txt(s, X(-lim) + 8, Y(-lim) - 8, "обе вероятности упали", { fs: 11.5, anchor: "start", italic: 1, color: css("--bad") });
    txt(s, X(lim) - 8, Y(-lim) - 8, "ниже диагонали: предпочтение усилилось", { fs: 11.5, anchor: "end", italic: 1, color: css("--good") });
    for (let i = 0; i < PP.n; i++) { if (!keep(i)) continue;
      const dc = PP[stage].chosen[i] - PP.SFT.chosen[i], dr = PP[stage].rejected[i] - PP.SFT.rejected[i];
      const c = s.appendChild(el("circle", { cx: X(dc).toFixed(1), cy: Y(dr).toFixed(1), r: 2.6, fill: dc > dr ? css("--cls-0") : css("--cls-1"), opacity: 0.55 }));
      tipOn(c, () => `${esc(PP.source[i])}${PP.on_policy[i] ? " · on-policy": ""}<br>Δ chosen ${dc.toFixed(1)} · Δ rejected ${dr.toFixed(1)}<br>${PP.len_chosen[i]} / ${PP.len_rejected[i]} tokens`); }
    const host = $("#fig-pairs"); host.innerHTML = ""; host.appendChild(s);
    const st = pairStats(stage, keep);
    $("#pairs-stats").innerHTML = stat(st.n, "показано пар") + stat(pct(st.margin_pos) + "%", "margin > 0") + stat(pct(st.chosen_up) + "%", "выбранный стал вероятнее") + stat(pct(st.both_down) + "%", "обе вероятности уменьшились");
  }
  states("pairs-stage", null, m => { stage = m; draw(); });
  $("#pairs-source").addEventListener("change", draw);
  reveal("btn-pairs-reveal", ["pairs-out"], "pairs-note", [bet], () => { draw(); REDRAW.push(draw); });
  $("#pairs-note").innerHTML = TXT("pairs-note", { marginPos: pct(A.margin_pos), bothDown: pct(A.both_down), chosenUp: pct(A.chosen_up), rlvrPos: pct(SUM.RLVR.all.margin_pos) });
  const on = SUM.DPO.on_policy, off = SUM.DPO.off_policy;
  $("#fig-onoff").innerHTML = `<div class="legend" style="margin:0 0 8px"><span><i class="sw" style="background:var(--cls-0)"></i>on-policy pairs · ${on.n}</span><span><i class="sw" style="background:var(--cls-1)"></i>written by other models · ${off.n}</span></div>` +
    [["margin > 0", "margin_pos"], ["выбранный стал вероятнее", "chosen_up"], ["обе вероятности упали", "both_down"]].map(([l, k]) =>
      `<div class="pair"><span class="lab">${l}</span><span class="bar e"><i style="width:${pct(on[k], 1)}%"></i></span><span class="bar d"><i style="width:${pct(off[k], 1)}%"></i></span><span class="n">${pct(on[k])}% · ${pct(off[k])}%</span></div>`).join("");
  $("#policy-note").innerHTML = TXT("policy-note", { nOn: on.n, onUp: pct(on.chosen_up), onBoth: pct(on.both_down), nOff: off.n, offUp: pct(off.chosen_up), offBoth: pct(off.both_down) });
  const Lg = D.dpo.length, R = D.stages.rows, mx = Math.max(...Object.values(R).map(r => r.open_tokens));
  $("#fig-length").innerHTML = `<div class="hm-title">open prompts · mean tokens written, and the share that stops by itself</div>` +
    Object.entries(R).map(([s, r]) => `<div class="pbar"><span class="lab">${s}</span><span class="bar"><i style="width:${pct(r.open_tokens / mx, 1)}%;background:${s === "DPO" ? "var(--cls-1)": "var(--cls-0)"}"></i></span><span class="v">${Math.round(r.open_tokens)} · ${pct(r.open_stopped)}%</span></div>`).join("") +
    `<div class="hm-title" style="margin-top:12px">the DPO pairs</div><div class="pbar"><span class="lab">chosen is longer</span><span class="bar"><i style="width:${pct(Lg.chosen_longer, 1)}%"></i></span><span class="v">${pct(Lg.chosen_longer)}%</span></div>`;
  $("#length-note").innerHTML = TXT("length-note", { n: PP.n, longer: pct(Lg.chosen_longer), nOpen: D.stages.n_open, sftTok: Math.round(R.SFT.open_tokens), sftStop: pct(R.SFT.open_stopped),
    dpoTok: Math.round(R.DPO.open_tokens), dpoStop: pct(R.DPO.open_stopped), budget: D.stages.max_new_tokens });
});
const advantages = r => { const m = r.reduce((a, x) => a + x, 0) / r.length, sd = Math.sqrt(r.reduce((a, x) => a + (x - m) ** 2, 0) / r.length); return r.map(x => (x - m) / (sd + 1e-6)); };
later(function grpo() {
  const G = D.grpo, PRE = { "mixed": [1, 0, 0, 1, 0, 0, 0, 1], "one right": [1, 0, 0, 0, 0, 0, 0, 0], "all right": [1, 1, 1, 1, 1, 1, 1, 1], "all wrong": [0, 0, 0, 0, 0, 0, 0, 0] };
  check("grpo-check", Object.keys(PRE).every(k => advantages(PRE[k]).every((a, i) => close(a, G.advantages[k][i]))), "advantages совпали с Python для четырёх групп");
  let R = PRE.mixed.slice();
  function draw() {
    const A = advantages(R), right = R.reduce((a, x) => a + x, 0), mean = right / R.length;
    const s = svg(940, 250), bw = 104, gap = 11, X = i => 14 + i * (bw + gap), Y0 = 170, sc = 26;
    txt(s, 14, 18, "один запрос, 8 ответов текущей модели · нажмите на ответ для смены награды", { anchor: "start", fs: 12.5, color: css("--ink-2") });
    R.forEach((r, i) => { const x = X(i);
      const b = rect(s, x, 30, bw, 54, { fill: r ? TINT("--good", 16) : TINT("--bad", 12), stroke: r ? css("--good") : css("--bad"), sw: 1.6 });
      b.style.cursor = "pointer"; b.addEventListener("click", () => { R[i] = 1 - R[i]; draw(); });
      txt(s, x + bw / 2, 52, `sample ${i + 1}`, { fs: 12, mono: 1, color: css("--ink") }).style.pointerEvents = "none";
      txt(s, x + bw / 2, 74, r ? "✓  r = 1": "✗  r = 0", { fs: 12, bold: 1, color: r ? css("--good") : css("--bad") }).style.pointerEvents = "none";
      const a = A[i], h = Math.min(Math.abs(a), 3) * sc;
      if (Math.abs(a) > 1e-9) rect(s, x + bw / 2 - 20, a > 0 ? Y0 - h : Y0, 40, h, { fill: a > 0 ? css("--good") : css("--bad"), op: 0.75, rx: 2 });
      txt(s, x + bw / 2, a >= 0 ? Y0 - h - 6 : Y0 + h + 15, (a > 0 ? "+": "") + a.toFixed(2), { fs: 12, mono: 1, bold: 1, color: css("--ink") });
    });
    line(s, 10, Y0, 930, Y0, { color: css("--ink-3"), sw: 1.2 });
    txt(s, 930, Y0 - 6, "A = 0", { fs: 11, mono: 1, anchor: "end", color: css("--ink-3") });
    txt(s, 470, 244, `среднее ${mean.toFixed(3)} · отклонение ${Math.sqrt(mean * (1 - mean)).toFixed(3)} · Σ A = ${A.reduce((a, x) => a + x, 0).toFixed(6)} · каждый токен ответа i получает вес Aᵢ`, { fs: 12, mono: 1, color: css("--ink-2") });
    const host = $("#fig-grpo"); host.innerHTML = ""; host.appendChild(s);
    const pos = A.find((a, i) => R[i] === 1), neg = A.find((a, i) => R[i] === 0);
    $("#grpo-note").innerHTML = right === 0 || right === R.length ? TXT("grpo-note-flat", { right, G: R.length })
      : right === 1 ? TXT("grpo-note-std", { G: R.length, aPos: "+" + pos.toFixed(2) })
      : TXT("grpo-note", { right, G: R.length, aPos: "+" + pos.toFixed(2), aNeg: neg.toFixed(2) });
  }
  states("grpo-presets", null, m => { R = PRE[m].slice(); draw(); });
  draw(); REDRAW.push(draw);
});
function finalNumber(text) {
  text = text.split("\nQuestion:")[0].replace(/,/g, "");
  for (const p of [/\\boxed\{([^}]*)\}/g, /####\s*([^\n]*)/g, /answer is[:\s]*([^\n]*)/g]) {
    const found = [...text.matchAll(p)].map(m => m[1]);
    if (found.length) { text = found[found.length - 1]; break; }
  }
  const nums = text.match(/-?\d+(?:\.\d+)?/g);
  return nums ? parseFloat(nums[nums.length - 1]) : null;
}
const rewardOf = (text, gold) => { const p = finalNumber(text); return p !== null && Math.abs(p - gold) < 1e-6 ? 1 : 0; };
later(function checker() {
  const C = D.grpo.checker;
  check("checker-check", C.tests.every(t => finalNumber(t.text) === t.final && rewardOf(t.text, C.gold) === t.reward), `${C.tests.length} answers: the same final number and reward as Python`);
  code("#code-checker", `def final_number(text):
    """The number a solution ends on: \\\\boxed{…}, '#### …', 'the answer is …', or else the last number in the text.
    A base model keeps writing the next 'Question:' after its answer, so that part is cut first."""
    text = text.split("\\nQuestion:")[0].replace(",", "")
    for pattern in [r"\\\\boxed\\{([^}]*)\\}", r"####\\s*([^\\n]*)", r"answer is[:\\s]*([^\\n]*)"]:
        found = re.findall(pattern, text)
        if found:
            text = found[-1]
            break
    numbers = re.findall(r"-?\\d+(?:\\.\\d+)?", text)
    return float(numbers[-1]) if numbers else None
def reward(text, gold):
    """The whole 'модель награды' of RL with a verifier: 1 if the final number is right, 0 otherwise."""
    pred = final_number(text)
    return float(pred is not None and abs(pred - gold) < 1e-6)`);
  const out = () => { const t = $("#checker-in").value, f = finalNumber(t), r = rewardOf(t, C.gold);
    const o = $("#checker-out"); o.className = "out " + (r ? "ok": "no"); o.textContent = `final ${f === null ? "None": f} → reward ${r}`; };
  $("#checker-in").addEventListener("input", out); out();
  $("#checker-table").innerHTML = `<thead><tr><th>answer</th><th class="num">final_number</th><th class="num">reward</th></tr></thead><tbody>` +
    C.tests.map(t => `<tr><td class="mono">${esc(t.text.replace(/\n/g, " ↵ "))}</td><td class="num">${t.final === null ? "None": t.final}</td><td class="num"><b style="color:${t.reward ? "var(--good)": "var(--bad)"}">${t.reward}</b></td></tr>`).join("") + "</tbody>";
  const FMT = ["n = 6 − 2 = 4\n#### 4", "so n is 4", "#### 4.0", "n = 6 + 2 = 8\n#### 8"];
  const fmt = t => /####\s*\S+\s*$/.test(t) ? 1 : 0;
  function drawFmt() { const w = +$("#fmt-w").value; $("#fmt-w-v").textContent = w.toFixed(2);
    const rows = FMT.map(t => ({ t, c: rewardOf(t, C.gold), f: fmt(t) })), best = Math.max(...rows.map(r => r.c + w * r.f));
    $("#fmt-table").innerHTML = `<thead><tr><th>answer</th><th class="num">верно</th><th class="num">format</th><th class="num">r = right + w · format</th></tr></thead><tbody>` +
      rows.map(r => `<tr class="${r.c === 0 && r.c + w * r.f >= Math.min(...rows.filter(x => x.c).map(x => x.c + w * x.f)) - 1e-9 ? "hl": ""}"><td class="mono">${esc(r.t.replace(/\n/g, " ↵ "))}</td><td class="num">${r.c}</td><td class="num">${r.f}</td><td class="num"><b>${(r.c + w * r.f).toFixed(2)}</b></td></tr>`).join("") + "</tbody>"; }
  $("#fmt-w").addEventListener("input", drawFmt); drawFmt();
});
later(function teach() {
  const mixed = (p, G) => 1 - p ** G - (1 - p) ** G, GS = [4, 8, 16, 32];
  check("teach-check", Object.entries(D.grpo.mixed_prob).every(([p, row]) => Object.entries(row).every(([G, v]) => close(mixed(+p, +G), v, 1e-4))), "вероятность смешанной группы совпала с Python");
  let seed = 7;
  const rng = s0 => () => { s0 |= 0; s0 = s0 + 0x6D2B79F5 | 0; let t = Math.imul(s0 ^ s0 >>> 15, 1 | s0); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  function draw() {
    const p = +$("#teach-p").value, G = GS[+$("#teach-g").value]; $("#teach-p-v").textContent = p.toFixed(2); $("#teach-g-v").textContent = G;
    const R = rng(seed), rows = 16, cell = Math.min(15, 430 / G), W = 120 + G * cell + 150, H = rows * 21 + 8, s = svg(W, H);
    let teach = 0;
    for (let i = 0; i < rows; i++) { const y = 4 + i * 21, g = Array.from({ length: G }, () => R() < p ? 1 : 0), k = g.reduce((a, x) => a + x, 0), ok = k > 0 && k < G; if (ok) teach++;
      txt(s, 8, y + 13, `запрос ${i + 1}`, { anchor: "start", fs: 11.5, mono: 1, color: css("--ink-3") });
      g.forEach((v, j) => s.appendChild(el("circle", { cx: 120 + j * cell + cell / 2, cy: y + 9, r: Math.max(2.5, cell / 2 - 1.5), fill: v ? css("--good") : css("--bad"), opacity: ok ? 0.9 : 0.35 })));
      txt(s, 120 + G * cell + 12, y + 13, ok ? `${k}/${G} · есть сигнал` : k ? "все ✓ · A = 0": "все ✗ · A = 0", { anchor: "start", fs: 11.5, bold: ok, color: ok ? css("--ink") : css("--ink-3") }); }
    const h = $("#fig-teach"); h.innerHTML = ""; h.appendChild(s);
    $("#teach-out").innerHTML = stat(`${teach} / ${rows}`, "групп с разными наградами") + stat(pct(mixed(p, G)) + "%", "ожидается по формуле") + stat(num(rows * G), "порождённых ответов");
  }
  ["teach-p", "teach-g"].forEach(id => $("#" + id).addEventListener("input", draw));
  $("#btn-teach-redraw").addEventListener("click", () => { seed++; draw(); });
  draw(); REDRAW.push(draw);
  const P = D.passk, S = P.stages; let stage = "base";
  function hist() {
    const c = S[stage].correct, n = P.n, cnt = new Array(n + 1).fill(0); c.forEach(x => cnt[x]++);
    const mx = Math.max(...Object.values(S).map(r => { const h = new Array(n + 1).fill(0); r.correct.forEach(x => h[x]++); return Math.max(...h); }));
    const s = svg(760, 230), L = 40, B = 190, bw = 680 / (n + 1);
    cnt.forEach((v, i) => { const flat = i === 0 || i === n, hh = v / mx * 160;
      if (v) rect(s, L + i * bw + 1, B - hh, bw - 2, hh, { fill: flat ? css("--bad") : css("--cls-0"), op: 0.85, rx: 1 });
      if (v && flat) txt(s, L + i * bw + bw / 2, B - hh - 6, v, { fs: 12, mono: 1, bold: 1, color: css("--bad") }); });
    line(s, L, B, L + (n + 1) * bw, B, { color: css("--rule-strong") });
    [0, 8, 16, 24, 32].filter(t => t <= n).forEach(t => txt(s, L + t * bw + bw / 2, B + 16, t, { fs: 11, mono: 1, color: css("--ink-3") }));
    txt(s, L + 4, B + 34, "ни одного успеха", { anchor: "start", fs: 11.5, italic: 1, color: css("--bad") });
    txt(s, L + (n + 1) * bw - 4, B + 34, "все попытки успешны", { anchor: "end", fs: 11.5, italic: 1, color: css("--bad") });
    txt(s, L + (n + 1) * bw / 2, B + 34, `right answers out of ${n}`, { fs: 11.5, color: css("--ink-3") });
    const h = $("#fig-teach-hist"); h.innerHTML = ""; h.appendChild(s);
  }
  states("teach-stage", null, m => { stage = m; hist(); });
  hist(); REDRAW.push(hist);
  $("#teach-note").innerHTML = TXT("teach-note", { n: P.n_problems, samples: P.n, base0: pct(S.base.all_wrong), rlvr1: pct(S.RLVR.all_right),
    sftFlat: pct(S.SFT.all_wrong + S.SFT.all_right), rlvrFlat: pct(S.RLVR.all_wrong + S.RLVR.all_right) });
});
const passAtK = (n, c, k) => { if (n - c < k) return 1; let p = 1; for (let i = n - c + 1; i <= n; i++) p *= 1 - k / i; return 1 - p; };
later(function passk() {
  const P = D.passk, S = P.stages, names = Object.keys(S), COL = { base: "--ink-3", SFT: "--cls-0", DPO: "--cls-1", RLVR: "--cls-2" };
  const curve = s => P.ks.map(k => S[s].correct.reduce((a, c) => a + passAtK(P.n, c, k), 0) / S[s].correct.length);
  check("passk-check", names.every(s => curve(s).every((v, i) => close(v, S[s].curve[i], 1e-4))), "все pass@k совпали с Python");
  $("#passk-meta").textContent = `${P.n_problems} problems, ${P.n} samples each at T = ${P.temperature}`;
  $("#passk-k").max = P.ks.length - 1;
  const kmax = P.ks.length - 1, last = s => S[s].curve[kmax];
  const others = names.filter(s => s !== "RLVR"), near = others.filter(s => last("RLVR") - last(s) < 0.02);
  const bet = makeBet("#bet-passk", [...others, "neither"], near.length ? others.indexOf(near[0]) : others.length);
  function draw() {
    const ki = +$("#passk-k").value, k = P.ks[ki]; $("#passk-k-v").textContent = k;
    const Pl = plot($("#fig-passk"), { w: 520, h: 310, x: [1, P.ks[kmax]], y: [0, 1], logx: 1, xt: P.ks, yt: [0, 0.25, 0.5, 0.75, 1], xl: "k · попыток на задачу", yl: "pass@k",
      series: names.map(s => ({ pts: P.ks.map((kk, i) => [kk, S[s].curve[i]]), color: css(COL[s]), dots: 1 })) });
    names.forEach(s => txt(Pl.s, Pl.X(P.ks[kmax]) - 4, Pl.Y(last(s)) + (s === "SFT" ? 16 : -8), s, { fs: 12, bold: 1, anchor: "end", color: css(COL[s]) }));
    line(Pl.s, Pl.X(k), Pl.T, Pl.X(k), Pl.H - Pl.B, { color: css("--ink"), sw: 1.2 });
    $("#passk-vals").innerHTML = names.map(s => stat(S[s].curve[ki].toFixed(3), `${s} · pass@${k}`)).join("");
    const O = P.overlap;
    $("#passk-hist").innerHTML = `<div class="hm-title">the ${O.base_never} problems the base never solved in ${P.n} tries</div>` +
      [["решено SFT", O.base_never_sft_solves, "--cls-0"], ["решено RLVR", O.base_never_rlvr_solves, "--cls-2"]].map(([l, v, c]) =>
        `<div class="pbar"><span class="lab">${l}</span><span class="bar"><i style="width:${pct(v / O.base_never, 1)}%;background:var(${c})"></i></span><span class="v">${v}</span></div>`).join("");
  }
  $("#passk-k").addEventListener("input", draw);
  reveal("btn-passk-reveal", ["passk-out"], "passk-note", [bet], () => { draw(); REDRAW.push(draw); });
  const O = P.overlap;
  $("#passk-note").innerHTML = TXT("passk-note", { rlvr1: S.RLVR.curve[0].toFixed(2), sft1: S.SFT.curve[0].toFixed(2), base1: S.base.curve[0].toFixed(2), kmax: P.ks[kmax],
    baseK: last("base").toFixed(2), rlvrK: last("RLVR").toFixed(2), sftK: last("SFT").toFixed(2), gap1: (S.RLVR.curve[0] - S.SFT.curve[0]).toFixed(2), gapK: (last("RLVR") - last("SFT")).toFixed(2),
    baseNever: O.base_never, n: P.n, rlvrSolves: O.base_never_rlvr_solves, sftSolves: O.base_never_sft_solves });
});
setTimeout(runLater, 0);
window.COPIED.alignment = {D, redrawAll, CHECKS, sig, btStep, agreement, finalNumber, advantages};
})();
const nav = document.getElementById("nav");
nav.innerHTML = [...document.querySelectorAll("main section")].map(s => `<a href="#${s.id}"><span>·</span><span>${s.querySelector("h1,h2").textContent}</span></a>`).join("");
document.getElementById("btn-present").onclick = () => document.body.classList.toggle("present");
document.getElementById("btn-theme").addEventListener("click", () => document.dispatchEvent(new Event("add-theme")));
function redrawAll() { Object.values(window.COPIED).forEach(c => c.redrawAll()); }
