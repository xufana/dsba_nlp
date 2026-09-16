"use strict";
const __T = [["start", performance.now()]];
function __mark(n) { __T.push([n, performance.now()]); }
const D = JSON.parse(document.getElementById("demo-data").textContent);
__mark("json");

/* ---------------------------------------------------------------- codecs */
function b64bytes(s) {
  const bin = atob(s), out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
function f16(s) {
  const b = b64bytes(s), u = new Uint16Array(b.buffer, b.byteOffset, b.byteLength / 2);
  const out = new Float32Array(u.length);
  for (let i = 0; i < u.length; i++) {
    const h = u[i], sg = (h & 0x8000) >> 15, e = (h & 0x7c00) >> 10, f = h & 0x03ff;
    out[i] = e === 0 ? (sg ? -1 : 1) * Math.pow(2, -14) * (f / 1024)
      : e === 31 ? (f ? NaN : (sg ? -Infinity : Infinity))
        : (sg ? -1 : 1) * Math.pow(2, e - 15) * (1 + f / 1024);
  }
  return out;
}
function i8(s) {
  const b = b64bytes(s);
  return new Int8Array(b.buffer, b.byteOffset, b.byteLength);
}

/* --------------------------------------------------------------- helpers */
const $ = (s, r) => (r || document).querySelector(s);
const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const fmt = (x, d) => x == null ? "—" : Number(x).toFixed(d === undefined ? 4 : d);
const pct = (x, d) => (100 * x).toFixed(d || 0) + "%";
const num = x => Number(x).toLocaleString("en-US");
/* seeded RNG so a seed slider reproduces a sample */
function mulberry32(a) {
  return function () {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
/* Python's re.findall(r"\w+", text.lower()) */
function tokenizeWords(text) {
  return String(text).toLowerCase().match(/[\p{L}\p{N}_]+/gu) || [];
}

/* -------------------------------------------------------------- svg draw */
const NS = "http://www.w3.org/2000/svg";
function svg(w, h, cls) {
  const s = document.createElementNS(NS, "svg");
  s.setAttribute("viewBox", `0 0 ${w} ${h}`);
  s.setAttribute("width", "100%");
  s.setAttribute("preserveAspectRatio", "xMidYMid meet");
  if (cls) s.setAttribute("class", cls);
  return s;
}
const PAINT = { fill: 1, stroke: 1, "stop-color": 1 };
function el(tag, attrs, text) {
  const n = document.createElementNS(NS, tag);
  let style = "";
  for (const k in attrs) {
    const v = attrs[k];
    if (PAINT[k] && typeof v === "string" && v.startsWith("var(")) style += `${k}:${v};`;
    else n.setAttribute(k, v);
  }
  if (style) n.setAttribute("style", style);
  if (text != null) n.textContent = text;
  return n;
}
const TIP = $("#tip");
function tipOn(node, html) {
  node.addEventListener("pointerenter", e => { TIP.innerHTML = html; TIP.style.opacity = "1"; moveTip(e); });
  node.addEventListener("pointermove", moveTip);
  node.addEventListener("pointerleave", () => { TIP.style.opacity = "0"; });
}
function moveTip(e) {
  const pad = 14, r = TIP.getBoundingClientRect();
  let x = e.clientX + pad, y = e.clientY + pad;
  if (x + r.width > innerWidth - 8) x = e.clientX - r.width - pad;
  if (y + r.height > innerHeight - 8) y = e.clientY - r.height - pad;
  TIP.style.left = x + "px"; TIP.style.top = y + "px";
}
function css(name) { return `var(${name})`; }
const MODEL_COLOR = { lstm0: "var(--bad)", additive: "var(--cls-2)", general: "var(--cls-1)", scaled_dot: "var(--cls-3)", l1: "var(--seq-1)", l3: "var(--seq-3)", l6: "var(--seq-5)", no_ca: "var(--cls-1)", no_pe: "var(--ink-3)" };

/* A generic line chart: series [{x:[], y:[], color, label, dash, dots}], log axes optional. */
function lineChart(host, o) {
  host.innerHTML = "";
  const W = o.W || 1000, H = o.H || 340, L = o.L || 74, R = o.R || 22, T = o.T || 18, B = o.B || 52, fs = o.fs || 14;
  const s = svg(W, H);
  const xs = [], ys = [];
  o.series.forEach(sr => sr.x.forEach((x, i) => { if (isFinite(sr.y[i]) && sr.y[i] != null) { xs.push(x); ys.push(sr.y[i]); } }));
  (o.hlines || []).forEach(h => ys.push(h.y));
  const xlog = !!o.xlog, ylog = !!o.ylog;
  const tx = v => xlog ? Math.log10(v) : v, ty = v => ylog ? Math.log10(v) : v;
  let x0 = o.xmin != null ? o.xmin : Math.min(...xs), x1 = o.xmax != null ? o.xmax : Math.max(...xs);
  let y0 = o.ymin != null ? o.ymin : Math.min(...ys), y1 = o.ymax != null ? o.ymax : Math.max(...ys);
  if (!ylog && o.ymin == null) { const p = (y1 - y0) * 0.08 || 1; y0 -= p; y1 += p; }
  if (ylog && o.ymin == null) { y0 /= 1.5; y1 *= 1.5; }
  if (x0 === x1) { x0 -= 1; x1 += 1; }
  const X = v => L + (tx(v) - tx(x0)) / (tx(x1) - tx(x0)) * (W - L - R);
  const Y = v => H - B - (ty(v) - ty(y0)) / (ty(y1) - ty(y0)) * (H - T - B);
  const yt = o.yticks || (ylog ? logTicks(y0, y1) : linTicks(y0, y1, 5));
  const xt = o.xticks || (xlog ? logTicks(x0, x1) : linTicks(x0, x1, o.nx || 6));
  yt.forEach(v => {
    s.appendChild(el("line", { class: "gridline", x1: L, x2: W - R, y1: Y(v), y2: Y(v), stroke: css("--rule") }));
    s.appendChild(el("text", { x: L - 8, y: Y(v) + fs * .35, "font-size": fs, "text-anchor": "end", fill: css("--ink-3") }, o.yfmt ? o.yfmt(v) : tickFmt(v)));
  });
  xt.forEach(v => {
    const lab = o.xlabels ? o.xlabels[v] : (o.xfmt ? o.xfmt(v) : tickFmt(v));
    if (lab == null) return;
    s.appendChild(el("line", { x1: X(v), x2: X(v), y1: H - B, y2: H - B + 5, stroke: css("--rule-strong") }));
    s.appendChild(el("text", { x: X(v), y: H - B + fs + 8, "font-size": fs, "text-anchor": "middle", fill: css("--ink-3") }, lab));
  });
  s.appendChild(el("line", { x1: L, x2: W - R, y1: H - B, y2: H - B, stroke: css("--rule-strong") }));
  s.appendChild(el("line", { x1: L, x2: L, y1: T, y2: H - B, stroke: css("--rule-strong") }));
  if (o.xlabel) s.appendChild(el("text", { x: (L + W - R) / 2, y: H - 6, "font-size": fs, "text-anchor": "middle", fill: css("--ink-2") }, o.xlabel));
  if (o.ylabel) s.appendChild(el("text", { x: 14, y: (T + H - B) / 2, "font-size": fs, "text-anchor": "middle", fill: css("--ink-2"), transform: `rotate(-90 14 ${(T + H - B) / 2})` }, o.ylabel));
  (o.hlines || []).forEach(h => {
    s.appendChild(el("line", { x1: L, x2: W - R, y1: Y(h.y), y2: Y(h.y), stroke: h.color || css("--ink-3"), "stroke-dasharray": "5 4", "stroke-width": 1.5 }));
    if (h.label) s.appendChild(el("text", { x: h.left ? L + 6 : W - R - 4, y: Y(h.y) - 5, "font-size": fs - 1, "text-anchor": h.left ? "start" : "end", fill: h.color || css("--ink-2") }, h.label));
  });
  o.series.forEach(sr => {
    const pts = sr.x.map((x, i) => [x, sr.y[i]]).filter(p => p[1] != null && isFinite(p[1]) && (!ylog || p[1] > 0));
    if (pts.length > 1) s.appendChild(el("polyline", {
      points: pts.map(p => `${X(p[0]).toFixed(1)},${Y(p[1]).toFixed(1)}`).join(" "),
      fill: "none", stroke: sr.color || css("--ink"), "stroke-width": sr.width || 2.2,
      "stroke-dasharray": sr.dash ? "6 5" : "none", "stroke-linejoin": "round", opacity: sr.opacity == null ? 1 : sr.opacity,
    }));
    if (sr.dots !== false) pts.forEach(p => {
      const c = el("circle", { cx: X(p[0]), cy: Y(p[1]), r: sr.r || 4, fill: sr.hollow ? css("--panel") : (sr.color || css("--ink")), stroke: sr.color || css("--ink"), "stroke-width": 2 });
      if (sr.tip) tipOn(c, sr.tip(p[0], p[1]));
      s.appendChild(c);
    });
  });
  if (o.legend !== false) {
    let lx = o.legendX != null ? o.legendX : L + 12, ly = (o.legendY != null ? o.legendY : T + 4) + fs;
    o.series.filter(sr => sr.label).forEach(sr => {
      s.appendChild(el("line", { x1: lx, x2: lx + 26, y1: ly - fs * .35, y2: ly - fs * .35, stroke: sr.color || css("--ink"), "stroke-width": 2.5, "stroke-dasharray": sr.dash ? "6 5" : "none" }));
      s.appendChild(el("text", { x: lx + 34, y: ly, "font-size": fs, fill: css("--ink-2") }, sr.label));
      ly += fs + 6;
    });
  }
  host.appendChild(s);
  return { X, Y, s };
}
function linTicks(a, b, n) {
  const span = b - a, raw = span / n, mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const step = [1, 2, 2.5, 5, 10].map(m => m * mag).find(st => span / st <= n + 1) || mag;
  const out = []; for (let v = Math.ceil(a / step) * step; v <= b + 1e-9; v += step) out.push(+v.toFixed(10));
  return out;
}
function logTicks(a, b) {
  const out = []; for (let e = Math.floor(Math.log10(a)); e <= Math.ceil(Math.log10(b)); e++) { const v = Math.pow(10, e); if (v >= a && v <= b) out.push(v); }
  if (out.length < 3) for (let e = Math.floor(Math.log10(a)); e <= Math.ceil(Math.log10(b)); e++) [2, 5].forEach(m => { const v = m * Math.pow(10, e); if (v >= a && v <= b) out.push(v); });
  return out.sort((x, y) => x - y);
}
function tickFmt(v) {
  if (Math.abs(v) >= 1000) return Number.isInteger(v / 100) ? +(v / 1000).toFixed(1) + "k" : num(Math.round(v));
  if (Math.abs(v) >= 10 || v === 0) return String(Math.round(v * 10) / 10);
  return String(+v.toPrecision(2));
}

/* probability bars: rows [{label, p, kept}] */
function probBars(host, rows, o) {
  host.innerHTML = rows.map(r => `<div class="pbar${r.kept === false ? " cut" : ""}">
    <span class="lab" title="${esc(r.label)}">${esc(r.label)}</span>
    <span class="bar"><i style="width:${(100 * r.p / (o && o.max || 1)).toFixed(1)}%"></i></span>
    <span class="v">${r.p < 0.001 ? r.p.toExponential(1) : r.p.toFixed(3)}</span></div>`).join("");
}

/* ------------------------------------------------------------------ bets */
/* A bet is a row of option buttons; makeBet renders it, reveal() scores it. */
function makeBet(host, options, answer) {
  const h = typeof host === "string" ? $(host) : host;
  h.insertAdjacentHTML("beforeend", options.map((o, i) => `<button data-opt="${i}">${esc(o)}</button>`).join("") + `<span class="verdict"></span>`);
  const st = { pick: null, revealed: false, answer };
  h.addEventListener("click", e => {
    const b = e.target.closest("button[data-opt]"); if (!b || st.revealed) return;
    st.pick = +b.dataset.opt;
    $$("button[data-opt]", h).forEach(x => x.classList.toggle("pick", x === b));
    h.dispatchEvent(new CustomEvent("bet", { bubbles: true }));
  });
  st.reveal = (ans) => {
    if (ans !== undefined) st.answer = ans;
    st.revealed = true;
    const v = $(".verdict", h);
    $$("button[data-opt]", h).forEach(x => {
      const i = +x.dataset.opt;
      x.classList.toggle("right", i === st.answer);
      x.classList.toggle("wrong", i === st.pick && i !== st.answer);
    });
    if (st.pick === null) { v.textContent = "no bet placed"; v.className = "verdict"; }
    else if (st.pick === st.answer) { v.textContent = "you were right"; v.className = "verdict ok"; }
    else { v.textContent = "not this time"; v.className = "verdict no"; }
    return st.pick === st.answer;
  };
  return st;
}

/* ------------------------------------------------------------------ nav */
const SECTIONS = [
  ["hero", "The claim", null],
  ["stop", "Where we stopped", "00"],
  ["seq2seq", "Attention in seq2seq", "01"],
  ["score", "Axis 1: the score", "02"],
  ["masks", "Axes 2 and 3: masks", "03"],
  ["tf", "The transformer, from scratch", "04"],
  ["results", "The results table", "05"],
  ["inside", "Looking inside", "06"],
  ["tasks", "Same class, other tasks", "07"],
  ["end", "Where this goes", "08"],
];
(function buildNav() {
  const nav = $("#nav");
  nav.innerHTML = SECTIONS.map(([id, t, n]) =>
    `<a href="#${id}" data-id="${id}"><span>${n === null ? "·" : n}</span><span>${esc(t)}</span></a>`).join("");
  const links = $$("#nav a");
  const io = new IntersectionObserver(ents => {
    ents.forEach(e => { if (e.isIntersecting) links.forEach(a => a.classList.toggle("on", a.dataset.id === e.target.id)); });
  }, { rootMargin: "-15% 0px -70% 0px" });
  SECTIONS.forEach(([id]) => { const n = document.getElementById(id); if (n) io.observe(n); });
})();

$("#btn-theme").addEventListener("click", () => {
  const cur = document.documentElement.getAttribute("data-theme");
  const dark = cur ? cur === "dark" : matchMedia("(prefers-color-scheme: dark)").matches;
  document.documentElement.setAttribute("data-theme", dark ? "light" : "dark");
  redrawAll();
});
$("#btn-present").addEventListener("click", e => {
  document.body.classList.toggle("present");
  e.target.classList.toggle("on", document.body.classList.contains("present"));
});
addEventListener("keydown", e => {
  if (/^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement.tagName)) return;
  if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
  const ys = SECTIONS.map(([id]) => document.getElementById(id)).filter(Boolean);
  const cur = ys.findIndex(n => n.getBoundingClientRect().top > 40);
  let i = e.key === "ArrowRight" ? (cur === -1 ? ys.length - 1 : cur) : Math.max(0, (cur === -1 ? ys.length : cur) - 2);
  i = Math.max(0, Math.min(ys.length - 1, i));
  ys[i].scrollIntoView({ behavior: "smooth" });
  e.preventDefault();
});
const REDRAW = [];
function redrawAll() { REDRAW.forEach(f => { try { f(); } catch (_) { } }); }


/* softmax / argmax on plain arrays */
function softmax(logits, T) {
  const n = logits.length, p = new Float32Array(n); let mx = -Infinity;
  const t = T || 1;
  for (let i = 0; i < n; i++) if (logits[i] / t > mx) mx = logits[i] / t;
  let sum = 0; for (let i = 0; i < n; i++) { p[i] = Math.exp(logits[i] / t - mx); sum += p[i]; }
  for (let i = 0; i < n; i++) p[i] /= sum;
  return p;
}
function argmax(a) { let b = 0; for (let i = 1; i < a.length; i++) if (a[i] > a[b]) b = i; return b; }

/* code ↔ formula: hover any [data-f] and every element sharing a token lights up */
(function linkCodeAndFormulas() {
  const all = $$("[data-f]");
  const toks = n => (n.dataset.f || "").split(/\s+/).filter(Boolean);
  all.forEach(n => {
    n.addEventListener("pointerenter", () => {
      const mine = toks(n);
      all.forEach(m => m.classList.toggle("hi", toks(m).some(t => mine.includes(t))));
    });
    n.addEventListener("pointerleave", () => all.forEach(m => m.classList.remove("hi")));
  });
})();

/* an attention heatmap: w[T][S] rows = queries (target), columns = keys (source) */
function heatmap(host, w, rowLab, colLab, o) {
  o = o || {};
  host.innerHTML = "";
  const T = w.length, S = w[0].length, cell = o.cell || 26, fs = o.fs || 12.5;
  const L = o.L == null ? 8 + Math.max(...rowLab.map(s => s.length)) * fs * .62 : o.L, Tm = o.T == null ? 8 + Math.max(...colLab.map(s => s.length)) * fs * .62 : o.T;
  const W = L + S * cell + 6, H = Tm + T * cell + 6;
  const s = svg(W, H, "hm-svg");
  const color = v => o.color ? o.color(v) : `color-mix(in srgb, var(--cls-0) ${Math.round(100 * Math.min(1, v))}%, var(--panel))`;
  for (let i = 0; i < T; i++) for (let j = 0; j < S; j++) {
    const r = el("rect", { class: o.flat ? "cell flat" : "cell", x: L + j * cell, y: Tm + i * cell, width: cell, height: cell });
    r.style.fill = color(w[i][j]);
    if (!o.noTip) tipOn(r, `${esc(rowLab[i])} ← ${esc(colLab[j])}<br>${w[i][j].toFixed(3)}`);
    s.appendChild(r);
  }
  if (!o.noLabels) {
    rowLab.forEach((t, i) => s.appendChild(el("text", { x: L - 5, y: Tm + i * cell + cell / 2 + fs * .36, "font-size": fs, "text-anchor": "end", fill: css("--ink-2") }, t)));
    colLab.forEach((t, j) => s.appendChild(el("text", { x: L + j * cell + cell / 2 + fs * .36, y: Tm - 5, "font-size": fs, "text-anchor": "start", fill: css("--ink-2"), transform: `rotate(-90 ${L + j * cell + cell / 2 + fs * .36} ${Tm - 5})` }, t)));
  }
  if (o.maxScale) s.style.maxWidth = Math.round(W * o.maxScale) + "px";
  host.appendChild(s);
  return s;
}
function betOptions(host, opts, ans) { return makeBet(host, opts, ans); }

/* ================================================================ shared */
__mark("shared");
const BASE = D.baseline, ATT = D.attn, TFM = D.tf, CK = D.checks, RES = D.results;
const LEN_KEYS = Object.keys(BASE.byLen), LEN_LABELS = { "0-10": "< 10", "10-15": "10–14", "15-20": "15–19", "20-25": "20–24", "25-100": "25+" };
function byLenSeries(byLen, color, label, dash) {
  return { x: LEN_KEYS.map((_, i) => i), y: LEN_KEYS.map(k => byLen[k]), color, label, dash, tip: (x, y) => `${label}<br>${LEN_LABELS[LEN_KEYS[x]]} tokens: BLEU ${y}` };
}
function lenChart(host, series, o) {
  lineChart(host, Object.assign({
    W: 500, H: 300, L: 60, B: 52, fs: 13.5, xticks: LEN_KEYS.map((_, i) => i), xlabels: LEN_KEYS.map(k => LEN_LABELS[k]), xmin: -0.3, xmax: LEN_KEYS.length - 0.7, ymin: 0,
    series, xlabel: "source length (BPE tokens)", ylabel: "test BLEU", legendX: 250, legendY: 8,
  }, o || {}));
}
function showRows(rows) {
  return rows.map(r => `<div class="tr-row"><span class="k">de</span><span>${esc(r.de)}</span><span class="k">ref</span><span>${esc(r.ref)}</span><span class="k">hyp</span><span>${esc(r.hyp)}</span></div>`).join("");
}
function resultsTable(host, hl) {
  host.innerHTML = `<thead><tr><th>model</th><th class="num">params</th><th class="num">test BLEU</th><th class="num">BLEU &lt; 10</th><th class="num">BLEU 25+</th><th class="num">s/epoch</th><th>note</th></tr></thead><tbody>` +
    RES.map(r => `<tr class="${hl && hl(r) ? "hl" : ""}"><td>${esc(r.model)}</td><td class="num">${esc(r.params)}</td><td class="num"><b>${r["test BLEU"].toFixed(1)}</b></td><td class="num">${fmt(r["BLEU 0-10"], 2)}</td><td class="num">${fmt(r["BLEU 25+"], 2)}</td><td class="num">${r["s/epoch"] == null ? "—" : r["s/epoch"]}</td><td class="mono" style="font-size:13.5px">${esc(r.note)}</td></tr>`).join("") + `</tbody>`;
}
/* svg helpers for the schematics */
function defsArrow(s, id, color) {
  let defs = s.querySelector("defs"); if (!defs) { defs = el("defs", {}); s.appendChild(defs); }
  const m = el("marker", { id, viewBox: "0 0 10 10", refX: 9, refY: 5, markerWidth: 6, markerHeight: 6, orient: "auto-start-reverse" });
  m.appendChild(el("path", { d: "M 0 0 L 10 5 L 0 10 z", fill: color })); defs.appendChild(m);
}
function arrow(s, x1, y1, x2, y2, o) {
  o = o || {};
  const color = o.color || css("--ink-2");
  const id = "arr-" + String(color).replace(/[^a-z0-9]/gi, "");
  if (!s.querySelector("#" + id)) defsArrow(s, id, color);
  const a = el("path", { d: o.curve ? `M ${x1} ${y1} Q ${o.curve[0]} ${o.curve[1]} ${x2} ${y2}` : `M ${x1} ${y1} L ${x2} ${y2}`, fill: "none", stroke: color, "stroke-width": o.width || 1.6, "marker-end": `url(#${id})`, "stroke-dasharray": o.dash ? "6 4" : "none", opacity: o.opacity == null ? 1 : o.opacity });
  s.appendChild(a); return a;
}
function box(s, x, y, w, h, label, o) {
  o = o || {};
  s.appendChild(el("rect", { x, y, width: w, height: h, rx: o.rx == null ? 6 : o.rx, fill: o.fill || css("--panel-sunk"), stroke: o.stroke || css("--rule-strong"), "stroke-width": o.sw || 1.4, "stroke-dasharray": o.dash ? "5 4" : "none" }));
  if (label != null) s.appendChild(el("text", { x: x + w / 2, y: y + h / 2 + (o.fs || 14) * .36, "font-size": o.fs || 14, "text-anchor": "middle", fill: o.color || css("--ink"), "font-weight": o.bold ? "600" : "400" }, label));
}
function txt(s, x, y, t, o) {
  o = o || {};
  s.appendChild(el("text", { x, y, "font-size": o.fs || 13.5, "text-anchor": o.anchor || "middle", fill: o.color || css("--ink-2"), "font-weight": o.bold ? "600" : "400" }, t));
}
/* a small vector drawn as cells with numbers */
function vec(s, x, y, vals, o) {
  o = o || {};
  const cw = o.cw || 38, ch = o.ch || 22;
  vals.forEach((v, i) => {
    const X = o.vertical ? x : x + i * cw, Y = o.vertical ? y + i * ch : y;
    const mag = Math.max(-1, Math.min(1, v / (o.scale || 1)));
    const fill = mag >= 0 ? `color-mix(in srgb, ${o.color || "var(--cls-0)"} ${Math.round(70 * mag)}%, var(--panel))` : `color-mix(in srgb, var(--cls-1) ${Math.round(70 * -mag)}%, var(--panel))`;
    const r = el("rect", { x: X, y: Y, width: cw, height: ch, fill: "none", stroke: css("--rule-strong"), "stroke-width": 1 }); r.style.fill = fill; s.appendChild(r);
    if (!o.noNum) s.appendChild(el("text", { x: X + cw / 2, y: Y + ch / 2 + 4.3, "font-size": 11.5, "text-anchor": "middle", fill: css("--ink") }, (o.fmt || (v => v.toFixed(o.dec == null ? 1 : o.dec)))(v)));
  });
  if (o.label) s.appendChild(el("text", { x: o.vertical ? x + cw / 2 : x - 6, y: o.vertical ? y - 6 : y + ch / 2 + 4.5, "font-size": 13, "text-anchor": o.vertical ? "middle" : "end", fill: o.labelColor || css("--ink-2"), "font-weight": "600" }, o.label));
}
function gauss(rng) { let u = 0, v = 0; while (u === 0) u = rng(); while (v === 0) v = rng(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); }

/* =============================================================== 00 stop */
__mark("00 stop");
(function () {
  const X = D.data;
  $("#data-split").textContent = `train ${num(X.nTrain)} · val ${num(X.nVal)} · test ${num(X.nTest)} · vocab de ${num(X.vDe)} / en ${num(X.vEn)}`;
  const toks = arr => arr.map(t => `<span class="tok">${esc(t)}</span>`).join("");
  $("#data-example").innerHTML = `<div class="tr-row"><span class="k">de</span><span>${esc(X.example.de)}<br>${toks(X.example.deTokens)}</span><span class="k">en</span><span>${esc(X.example.en)}<br>${toks(X.example.enTokens)}</span></div>`;
  $("#base-stats").textContent = `${(BASE.curves.n_params / 1e6).toFixed(1)}M params · test BLEU ${BASE.testBleu.toFixed(2)} · ${BASE.translateSeconds.toFixed(0)}s to translate the test set`;
  function chart() { lenChart($("#base-len-chart"), [byLenSeries(BASE.byLen, MODEL_COLOR.lstm0, "LSTM, no attention")], { ymax: 50 }); }
  REDRAW.push(chart); chart();
  $("#base-show").innerHTML = showRows(BASE.show);

  const added = D.attnLive.params - D.attnLive.w2Params;
  const b1 = makeBet("#bet-stop-which", ["(a) width: 1 024 numbers", "(b) attention: re-read everything at 256", "both, equally"], 1);
  const b2 = makeBet("#bet-stop-params", ["under 1M", "1–3M", "more than 3M"], added < 1e6 ? 0 : added < 3e6 ? 1 : 2);
  function stopChart() {
    lenChart($("#stop-len-chart"), [byLenSeries(BASE.byLen, MODEL_COLOR.lstm0, "LSTM, no attention (week 2)"), byLenSeries(ATT.additive.byLen, MODEL_COLOR.additive, "LSTM + additive attention")], { ymax: 50, W: 1000, H: 320, L: 70 });
  }
  $("#btn-stop-reveal").addEventListener("click", () => {
    const ok = [b1.reveal(), b2.reveal()].filter(Boolean).length;
    $("#stop-score").textContent = `${ok}/2 right`;
    $("#stop-out").hidden = false; $("#stop-note").hidden = false;
    const P = D.attnLive.parts;
    $("#stop-out").innerHTML = `<div class="stat-row" style="margin-bottom:14px">
      <div class="stat"><span class="v">+${(added / 1e6).toFixed(2)}M</span><span class="k">parameters added · ${pct(added / D.attnLive.w2Params, 1)}</span></div>
      <div class="stat"><span class="v">${(P.decoderExtra / 1e3).toFixed(0)}k</span><span class="k">wider decoder input [y; h̃]</span></div>
      <div class="stat"><span class="v">${(P.comb / 1e3).toFixed(0)}k</span><span class="k">W_c · attentional vector</span></div>
      <div class="stat"><span class="v">${(P.k_proj / 1e3).toFixed(0)}k</span><span class="k">key projection</span></div>
      <div class="stat"><span class="v">${(P.attn / 1e3).toFixed(0)}k</span><span class="k">additive score W_q, W_k, v</span></div></div>
      <div id="stop-len-chart"></div>`;
    stopChart(); REDRAW.push(stopChart);
  });
})();

/* ============================================================ 01 seq2seq */
__mark("01 seq2seq");
(function () {
  /* the notebook's figure, redrawn: one decoder step with attention */
  function figS2S() {
    const host = $("#fig-s2s-attn"); host.innerHTML = "";
    const W = 1000, H = 330, s = svg(W, H);
    const src = ["Ein", "Mädchen", "klettert", "…"], trg = ["[BOS]", "A", "girl", "climbs"], nxt = ["A", "girl", "climbs", "…"];
    const bw = 78, bh = 42, yb = 170, step = 100, x0 = 40, blue = css("--cls-0"), orange = css("--cls-1"), green = css("--cls-2"), red = css("--bad");
    const hx = [];
    src.forEach((t, i) => {
      const x = x0 + i * step, cx = x + bw / 2; hx.push(cx);
      box(s, x, yb, bw, bh, `h${"₁₂₃₄"[i]}`, { stroke: blue, fs: 15 });
      txt(s, cx, yb + bh + 28, t, { color: css("--ink"), fs: 14 });
      arrow(s, cx, yb + bh + 14, cx, yb + bh + 3, { color: css("--ink-3"), width: 1.2 });
      if (i) { arrow(s, x - step + bw + 2, yb + bh / 2 - 6, x - 2, yb + bh / 2 - 6, { color: blue, width: 1.2 }); arrow(s, x - 2, yb + bh / 2 + 6, x - step + bw + 2, yb + bh / 2 + 6, { color: blue, width: 1.2 }); }
    });
    const dx0 = 560, sx = [];
    trg.forEach((t, j) => {
      const x = dx0 + j * step, cx = x + bw / 2; sx.push(cx);
      box(s, x, yb, bw, bh, `s${"₁₂₃₄"[j]}`, { stroke: orange, fs: 15 });
      txt(s, cx, yb + bh + 28, t, { color: css("--ink"), fs: 14 });
      arrow(s, cx, yb + bh + 14, cx, yb + bh + 3, { color: css("--ink-3"), width: 1.2 });
      txt(s, cx, yb - 40, nxt[j], { color: orange, fs: 14, bold: true });
      if (j !== 2) arrow(s, cx, yb - 3, cx, yb - 28, { color: orange, width: 1.2 });
      if (j) arrow(s, x - step + bw + 2, yb + bh / 2, x - 2, yb + bh / 2, { color: orange, width: 1.2 });
    });
    /* attention for step 3 */
    const qx = sx[2], cy = 44;
    box(s, qx - 80, cy - 18, 160, 36, "c₃ = Σᵢ α₃,ᵢ hᵢ", { stroke: green, fs: 14.5 });
    const al = [0.05, 0.1, 0.8, 0.05];
    hx.forEach((x, i) => {
      arrow(s, x, yb - 2, qx - 60 + i * 40, cy + 18, { color: green, width: 0.8 + 3.4 * al[i], opacity: .85, curve: [(x + qx) / 2 - 60, cy + 40 + i * 12] });
      txt(s, x + 14, yb - 30 - i * 14, `α₃,${"₁₂₃₄"[i]} = ${al[i].toFixed(2)}`, { color: green, fs: 12, anchor: "start" });
    });
    arrow(s, qx, cy + 18, qx, yb - 44, { color: green, width: 2 });
    txt(s, qx - 12, yb - 58, "the output layer reads [s₃; c₃] →", { color: green, fs: 12, anchor: "end" });
    arrow(s, hx[3] + bw / 2 + 2, yb + bh / 2, dx0 - 2, yb + bh / 2, { color: red, width: 1.8, dash: true });
    txt(s, (hx[3] + dx0) / 2 + 20, yb + bh / 2 - 10, "(h₀, c₀)", { color: red, fs: 13 });
    txt(s, 270, H - 12, "encoder (bidirectional): one state per token — all kept", { color: blue, fs: 13 });
    txt(s, 745, H - 12, "decoder: state sₜ = query; keys and values = h₁..h₄", { color: orange, fs: 13 });
    host.appendChild(s);
  }
  REDRAW.push(figS2S); figS2S();

  const LV = D.attnLive;
  $("#live-attn-stats").textContent = `${(LV.params / 1e6).toFixed(2)}M params (week-2 model: ${(LV.w2Params / 1e6).toFixed(2)}M) · ${LV.seconds.toFixed(0)}s on ${D.meta.device}`;
  $("#live-attn-out").innerHTML = `<div class="stat"><span class="v">${LV.curves.train_loss[0].toFixed(3)}</span><span class="k">train loss · epoch 1</span></div>
    <div class="stat"><span class="v">${LV.curves.val_loss[0].toFixed(3)}</span><span class="k">val loss</span></div>
    <div class="stat"><span class="v">${LV.curves.val_bleu[0].toFixed(2)}</span><span class="k">val BLEU after one epoch on 5 000 pairs</span></div>
    <div class="stat"><span class="v">${LV.seconds.toFixed(0)}s</span><span class="k">per epoch on ${D.meta.device}</span></div>`;

  const A = ATT.additive, C = A.curves, W2 = BASE.curves;
  $("#attn-stats").textContent = `${(C.n_params / 1e6).toFixed(2)}M params · ${C.config.epochs} epochs · ${A.sPerEpoch.toFixed(0)} s/epoch · test BLEU ${A.testBleu.toFixed(2)}`;
  function attnCharts() {
    lineChart($("#attn-bleu-chart"), {
      W: 500, H: 300, L: 60, B: 52, fs: 13.5, xticks: C.epoch, xmin: 0.8, xmax: C.epoch.length + .2, ymin: 0, ymax: 45,
      series: [{ x: W2.epoch, y: W2.val_bleu, color: MODEL_COLOR.lstm0, dash: true, label: "LSTM, no attention (week 2)", tip: (x, y) => `epoch ${x}<br>val BLEU ${y}` },
        { x: C.epoch, y: C.val_bleu, color: MODEL_COLOR.additive, label: "LSTM + additive attention", tip: (x, y) => `epoch ${x}<br>val BLEU ${y}` }],
      xlabel: "epoch", ylabel: "validation BLEU", legendX: 200, legendY: 8,
    });
    lenChart($("#attn-len-chart"), [byLenSeries(BASE.byLen, MODEL_COLOR.lstm0, "no attention"), byLenSeries(A.byLen, MODEL_COLOR.additive, "additive attention")], { ymax: 50 });
  }
  REDRAW.push(attnCharts); attnCharts();
  const d0 = BASE.byLen["0-10"] - BASE.byLen["25-100"], dA = A.byLen["0-10"] - A.byLen["25-100"];
  $("#attn-slope").innerHTML = `from short to long sentences the score drops by <b>${d0.toFixed(1)}</b> BLEU without attention and by <b>${dA.toFixed(1)}</b> with it; as a ratio, long sentences keep ${pct(BASE.byLen["25-100"] / BASE.byLen["0-10"])} of the short-sentence score without attention and ${pct(A.byLen["25-100"] / A.byLen["0-10"])} with it. On this data attention lifted the whole curve; it did not flatten it.`;
  $("#attn-show").innerHTML = showRows(A.show);

  /* alignment viewer */
  const AL = D.alignments, sel = $("#align-pick");
  sel.innerHTML = AL.map((a, k) => `<option value="${k}">#${a.i} · ${esc(a.de.slice(0, 48))}${a.de.length > 48 ? "…" : ""}</option>`).join("");
  let cur = 0;
  function paintAlign() {
    const a = AL[cur]; sel.value = cur;
    $("#align-sent").innerHTML = `<b>DE</b> ${esc(a.de)}<br><b>REF</b> ${esc(a.ref)}<br><b>LSTM</b> ${esc(a.lstm.trgTok.filter(t => t !== "[EOS]").join(" ").replace(/▁/g, " ").trim())}<br><b>transformer</b> ${esc(a.tf.trgTok.filter(t => t !== "[EOS]").join(" ").replace(/▁/g, " ").trim())}`;
    heatmap($("#align-lstm"), a.lstm.w, a.lstm.trgTok, a.srcTok, { cell: 22, fs: 12 });
    $("#align-tf-title").textContent = `transformer, 6 layers · cross-attention layer ${a.tf.best[0] + 1} head ${a.tf.best[1] + 1} (block 06)`;
    heatmap($("#align-tf"), a.tf.w, a.tf.trgTok, a.srcTok, { cell: 22, fs: 12 });
  }
  sel.addEventListener("change", () => { cur = +sel.value; paintAlign(); });
  $("#btn-align-random").addEventListener("click", () => { cur = Math.floor(Math.random() * AL.length); paintAlign(); });
  REDRAW.push(paintAlign); paintAlign();
  window.__demo = Object.assign(window.__demo || {}, { paintAlign, setAlign: k => { cur = k; paintAlign(); } });
})();

/* ============================================================== 02 score */
__mark("02 score");
(function () {
  const DKS = [16, 32, 64, 128, 256, 512, 1024], N_KEYS = D.temperature.nKeys;
  let dkI = 2, scaled = 0, seed = 1;
  function draw(dk, sc, rng) {
    /* q ~ N(0, I), K ~ N(0, I): given q, each score K_j·q is N(0, |q|²), independent over keys —
       so we draw |q| from d_k gaussians and the 30 scores directly, instead of 30 × d_k products */
    let qq = 0; for (let i = 0; i < dk; i++) { const g = gauss(rng); qq += g * g; }
    const qn = Math.sqrt(qq), z = new Float64Array(N_KEYS);
    for (let j = 0; j < N_KEYS; j++) z[j] = qn * gauss(rng) / (sc ? Math.sqrt(dk) : 1);
    const p = softmax(z);
    let ent = 0; for (let j = 0; j < N_KEYS; j++) ent -= p[j] * Math.log(p[j] + 1e-12);
    /* gradient of a random downstream loss Σ p_j g_j w.r.t. the logits: dL/dz_j = p_j (g_j − Σ p_i g_i) */
    const gvec = Array.from({ length: N_KEYS }, () => gauss(rng)); let m = 0; for (let j = 0; j < N_KEYS; j++) m += p[j] * gvec[j];
    let gn = 0; for (let j = 0; j < N_KEYS; j++) gn += (p[j] * (gvec[j] - m)) ** 2;
    return { p, ent, gn: Math.sqrt(gn) };
  }
  function median(a) { const b = a.slice().sort((x, y) => x - y); return b[Math.floor(b.length / 2)]; }
  function paint() {
    const dk = DKS[dkI]; $("#temp-dk-v").textContent = dk;
    const rng = mulberry32(seed * 7919 + dk);
    const one = draw(dk, scaled, rng);
    const host = $("#temp-bars"); host.innerHTML = "";
    const W = 480, H = 200, s = svg(W, H), bw = (W - 40) / N_KEYS;
    for (let j = 0; j < N_KEYS; j++) { const h = one.p[j] * (H - 40); s.appendChild(el("rect", { x: 30 + j * bw + 1, y: H - 24 - h, width: bw - 2, height: h, fill: css("--cls-0") })); }
    s.appendChild(el("line", { x1: 30, x2: W - 10, y1: H - 24, y2: H - 24, stroke: css("--rule-strong") }));
    txt(s, W / 2, H - 6, `30 keys · max weight ${Math.max(...one.p).toFixed(2)} · entropy ${one.ent.toFixed(2)} of ${Math.log(N_KEYS).toFixed(2)}`, { fs: 13 });
    txt(s, 22, H - 24 - (H - 40) + 10, "1", { fs: 11, anchor: "end" }); txt(s, 22, H - 22, "0", { fs: 11, anchor: "end" });
    host.appendChild(s);
    /* medians over 200 draws for both settings */
    const rows = [0, 1].map(sc => {
      const rr = mulberry32(seed * 104729 + dk * 3 + sc), ents = [], gns = [];
      for (let t = 0; t < D.temperature.trials; t++) { const r = draw(dk, sc, rr); ents.push(r.ent); gns.push(r.gn); }
      const nb = D.temperature.rows.find(r => r.dk === dk && r.scaled === !!sc);
      return { sc, ent: median(ents), gn: median(gns), nb };
    });
    $("#temp-table").innerHTML = `<table class="temp-table"><thead><tr><th>d_k = ${dk}</th><th class="num">entropy</th><th class="num">notebook</th><th class="num">‖∂L/∂z‖</th><th class="num">notebook</th></tr></thead><tbody>` +
      rows.map(r => `<tr class="${r.sc === scaled ? "hl" : ""}"><td class="mono">${r.sc ? "scaled" : "unscaled"}</td><td class="num">${r.ent.toFixed(2)}</td><td class="num">${r.nb ? r.nb.entropy.toFixed(2) : "—"}</td><td class="num">${r.gn.toExponential(1)}</td><td class="num">${r.nb ? r.nb.gradNorm.toExponential(1) : "—"}</td></tr>`).join("") +
      `</tbody></table><div class="small-note">the notebook tabulates d_k = 16, 64, 256, 1024 (block 2.1); other sizes are this page's only. 200 draws: once the softmax has collapsed, the median gradient norm moves by an order of magnitude between seeds — the entropy is the stable number</div>`;
  }
  $("#temp-dk").addEventListener("input", e => { dkI = +e.target.value; paint(); });
  $$("#temp-scaled button").forEach(b => b.addEventListener("click", () => { scaled = +b.dataset.v; $$("#temp-scaled button").forEach(x => x.classList.toggle("sel", x === b)); paint(); }));
  $("#btn-temp-redraw").addEventListener("click", () => { seed++; paint(); });
  REDRAW.push(paint); paint();

  /* the three score functions */
  const kinds = ["additive", "general", "scaled_dot"], bleus = kinds.map(k => ATT[k].testBleu);
  const worst = bleus.indexOf(Math.min(...bleus)), gap = Math.abs(ATT.additive.testBleu - ATT.scaled_dot.testBleu);
  const b1 = makeBet("#bet-score-worst", kinds, worst);
  const b2 = makeBet("#bet-score-gap", ["under 1 BLEU", "1–5 BLEU", "more than 5 BLEU"], gap < 1 ? 0 : gap < 5 ? 1 : 2);
  function chart() {
    lineChart($("#score-chart"), {
      W: 500, H: 300, L: 60, B: 52, fs: 13.5, xticks: ATT.additive.curves.epoch, xmin: 0.8, xmax: 6.2, ymin: 0, ymax: 40,
      series: kinds.map(k => ({ x: ATT[k].curves.epoch, y: ATT[k].curves.val_bleu, color: MODEL_COLOR[k], label: k, tip: (x, y) => `${k} epoch ${x}<br>val BLEU ${y}` })),
      xlabel: "epoch", ylabel: "validation BLEU", legendX: 300, legendY: 150,
    });
  }
  $("#btn-score-reveal").addEventListener("click", () => {
    const ok = [b1.reveal(), b2.reveal()].filter(Boolean).length;
    $("#score-score").textContent = `${ok}/2 right`;
    $("#score-out").hidden = false; $("#score-note").hidden = false;
    $("#score-table").innerHTML = `<thead><tr><th>score</th><th class="num">params</th><th class="num">test BLEU</th><th class="num">BLEU &lt; 10</th><th class="num">BLEU 25+</th><th class="num">s/epoch</th></tr></thead><tbody>` +
      kinds.map(k => `<tr><td class="mono" style="color:${MODEL_COLOR[k]}">${k}</td><td class="num">${(ATT[k].curves.n_params / 1e6).toFixed(2)}M</td><td class="num"><b>${ATT[k].testBleu.toFixed(2)}</b></td><td class="num">${ATT[k].byLen["0-10"]}</td><td class="num">${ATT[k].byLen["25-100"]}</td><td class="num">${ATT[k].sPerEpoch.toFixed(0)}</td></tr>`).join("") + `</tbody>`;
    chart(); REDRAW.push(chart);
  });
})();

/* ============================================================== 03 masks */
__mark("03 masks");
(function () {
  const S = 8, lens = [5, 8, 3];
  const pad = l => Array.from({ length: S }, (_, i) => Array.from({ length: S }, (_, j) => j < l ? 1 : 0));
  const causal = Array.from({ length: S }, (_, i) => Array.from({ length: S }, (_, j) => j <= i ? 1 : 0));
  const both = causal.map((row, i) => row.map((v, j) => v && j < lens[0] ? 1 : 0));
  const pics = [["padding mask, sentence of length 8", "all queries may see keys 0..7", pad(8)], ["padding mask, length 5", "keys 5..7 are [PAD]", pad(5)], ["causal mask", "query t sees keys 0..t", causal], ["decoder self-attention, length 5", "causal AND padding", both]];
  function paint() {
    const host = $("#masks-out"); host.innerHTML = "";
    pics.forEach(([t, sub, m]) => {
      const d = document.createElement("div");
      d.innerHTML = `<div class="hm-title">${esc(t)} · ${esc(sub)}</div><div class="hm"></div>`;
      host.appendChild(d);
      heatmap($(".hm", d), m, Array.from({ length: S }, (_, i) => String(i)), Array.from({ length: S }, (_, i) => String(i)), { cell: 22, fs: 11, noTip: true, color: v => v ? "var(--panel)" : "var(--ink)" });
    });
  }
  REDRAW.push(paint); paint();
})();

/* ======================================================= 04 the transformer */
__mark("04 the transformer");
(function () {
  $("#ck-sdpa").innerHTML = CK.sdpaMatch ? `<b>✓</b> our attention == F.scaled_dot_product_attention · max |diff| ${CK.sdpaMaxDiff.toExponential(1)}` : `<b class="no">✗</b> mismatch`;
  $("#sdpa-note").innerHTML = `A check against PyTorch's own implementation, the one production models call: on random <code>(2, 4, 7, 32)</code> tensors with a random mask, <code>torch.allclose(ours, F.scaled_dot_product_attention(q, k, v, attn_mask=mask), atol=1e-5)</code> is <b>${CK.sdpaMatch ? "True" : "False"}</b>. Eleven lines, and they are the same function.`;

  /* --- one query, by hand, live numbers --- */
  let seed = 3;
  function figQKV() {
    const host = $("#fig-qkv"); host.innerHTML = "";
    const W = 1000, H = 400, s = svg(W, H), rng = mulberry32(seed), d = 4;
    const toks = ["Ein", "Mann", "mit"];
    const X = toks.map(() => Array.from({ length: d }, () => Math.round(gauss(rng) * 10) / 10));
    const Wm = () => Array.from({ length: d }, () => Array.from({ length: d }, () => gauss(rng) * .6));
    const WQ = Wm(), WK = Wm(), WV = Wm();
    const proj = (x, Wt) => Wt[0].map((_, j) => Math.round(x.reduce((a, xi, i) => a + xi * Wt[i][j], 0) * 10) / 10);
    const Q = X.map(x => proj(x, WQ)), K = X.map(x => proj(x, WK)), V = X.map(x => proj(x, WV));
    const sc = K.map(k => Q[0].reduce((a, qi, i) => a + qi * k[i], 0));
    const scd = sc.map(v => v / Math.sqrt(d)); const al = softmax(scd);
    const z = Array.from({ length: d }, (_, i) => V.reduce((a, v, j) => a + al[j] * v[i], 0));
    const cw = 32, ch = 20, colX = [30, 200, 370];
    toks.forEach((t, j) => {
      const x = colX[j];
      txt(s, x + 2 * cw, 22, `x${"₁₂₃"[j]} = "${t}"`, { color: css("--ink"), fs: 14, bold: true });
      vec(s, x, 34, X[j], { cw, ch, color: "var(--cls-2)" });
      arrow(s, x + 2 * cw, 58, x + 2 * cw, 82, { color: css("--ink-3"), width: 1.2 });
      txt(s, x + 2 * cw + 8, 74, "× W_Q, W_K, W_V", { fs: 11, anchor: "start" });
      vec(s, x, 88, Q[j], { cw, ch, color: "var(--cls-3)", label: `q${"₁₂₃"[j]}` });
      vec(s, x, 118, K[j], { cw, ch, color: "var(--cls-1)", label: `k${"₁₂₃"[j]}` });
      vec(s, x, 148, V[j], { cw, ch, color: "var(--cls-0)", label: `v${"₁₂₃"[j]}` });
    });
    txt(s, 280, 205, "the query of position 1 against every key", { fs: 13, color: css("--ink-2") });
    const rx = 560, cols = [rx, rx + 92, rx + 184, rx + 276];
    ["score = q₁·kⱼ", "/ √d = / 2", "softmax", "αⱼ · vⱼ"].forEach((h, i) => txt(s, cols[i] + (i === 3 ? 76 : 38), 22, h, { fs: 13, bold: true, color: css("--ink") }));
    K.forEach((_, j) => {
      const y = 44 + j * 40;
      txt(s, rx - 20, y + 14, `k${"₁₂₃"[j]}`, { fs: 13, anchor: "end", color: css("--cls-1"), bold: true });
      box(s, cols[0], y, 76, 26, sc[j].toFixed(2), { fs: 13, rx: 3 });
      arrow(s, cols[0] + 78, y + 13, cols[1] - 2, y + 13, { color: css("--ink-3"), width: 1 });
      box(s, cols[1], y, 76, 26, scd[j].toFixed(2), { fs: 13, rx: 3 });
      arrow(s, cols[1] + 78, y + 13, cols[2] - 2, y + 13, { color: css("--ink-3"), width: 1 });
      box(s, cols[2], y, 76, 26, al[j].toFixed(2), { fs: 13, rx: 3, stroke: css("--cls-2"), bold: true });
      arrow(s, cols[2] + 78, y + 13, cols[3] - 2, y + 13, { color: css("--ink-3"), width: 1 });
      vec(s, cols[3], y + 3, V[j].map(v => v * al[j]), { cw: 38, ch: 20, color: "var(--cls-0)", dec: 2 });
    });
    txt(s, cols[3] + 76, 175, "Σⱼ", { fs: 16, color: css("--ink") });
    arrow(s, cols[3] + 76, 178, cols[3] + 76, 196, { color: css("--ink-3"), width: 1.4 });
    vec(s, cols[3], 200, z, { cw: 38, ch: 22, color: "var(--cls-2)", dec: 2, label: "z₁" });
    txt(s, 500, 232, `z₁ = ${Array.from(al).map((a, j) => `${a.toFixed(2)}·v${"₁₂₃"[j]}`).join(" + ")}`, { fs: 13.5, color: css("--ink") });
    txt(s, 500, 256, "the output for position 1 is a mixture of the three values, in proportions the query decided", { fs: 12.5 });
    /* the temperature, live */
    const al0 = softmax(sc);
    txt(s, 500, 300, `without the /√d: softmax(${sc.map(v => v.toFixed(2)).join(", ")}) = (${Array.from(al0).map(v => v.toFixed(2)).join(", ")})`, { fs: 12.5, color: css("--ink-2") });
    txt(s, 500, 322, `with it: softmax(${scd.map(v => v.toFixed(2)).join(", ")}) = (${Array.from(al).map(v => v.toFixed(2)).join(", ")}) — the same order, a softer mix`, { fs: 12.5, color: css("--ink-2") });
    txt(s, 500, 372, "X (green): the input; q, k, v: three linear views of it. Only q₁ is scored here; positions 2 and 3 do the same in parallel.", { fs: 12.5 });
    host.appendChild(s);
  }
  $("#btn-qkv-redraw").addEventListener("click", () => { seed++; figQKV(); });
  REDRAW.push(figQKV); figQKV();

  /* --- matrix form --- */
  function grid(s, x, y, rows, cols, cw, label, o) {
    o = o || {};
    for (let i = 0; i < rows; i++) for (let j = 0; j < cols; j++) s.appendChild(el("rect", { x: x + j * cw, y: y + i * cw, width: cw, height: cw, fill: o.fill || css("--panel-sunk"), stroke: css("--rule-strong"), "stroke-width": 1 }));
    if (label) txt(s, x + cols * cw / 2, y + rows * cw + 16, label, { fs: 13, color: o.color || css("--ink"), bold: true });
    if (o.dims) txt(s, x + cols * cw / 2, y - 6, o.dims, { fs: 11.5 });
    return x + cols * cw;
  }
  function figMatrix() {
    const host = $("#fig-matrix"); host.innerHTML = "";
    const W = 1000, H = 190, s = svg(W, H), cw = 22;
    let x = 150, y = 46;
    txt(s, x + 6, y + 40, "softmax(", { fs: 17, anchor: "start", color: css("--ink") }); x += 96;
    x = grid(s, x, y, 3, 4, cw, "Q · T × d", { fill: "color-mix(in srgb, var(--cls-3) 25%, var(--panel))" }); x += 10;
    x = grid(s, x, y - 11, 4, 3, cw, "Kᵀ · d × S", { fill: "color-mix(in srgb, var(--cls-1) 25%, var(--panel))" });
    txt(s, x + 34, y + 40, "/ √d )", { fs: 17, color: css("--ink") }); x += 70;
    txt(s, x + 8, y + 40, "·", { fs: 18 }); x += 26;
    x = grid(s, x, y, 3, 4, cw, "V · S × d", { fill: "color-mix(in srgb, var(--cls-0) 25%, var(--panel))" }); txt(s, x + 18, y + 40, "=", { fs: 18 }); x += 36;
    x = grid(s, x, y, 3, 4, cw, "Z · T × d", { fill: "color-mix(in srgb, var(--cls-2) 25%, var(--panel))" });
    txt(s, 500, H - 30, "QKᵀ is T × S — every query against every key; the softmax runs along each row, so each row of the weights sums to one", { fs: 12.5 });
    txt(s, 500, H - 12, "the rows of Z are z₁, z₂, z₃ from the picture above; the code below is this line, with batch and head axes in front", { fs: 12.5 });
    host.appendChild(s);
  }
  REDRAW.push(figMatrix); figMatrix();

  /* --- multi-head --- */
  const MP = CK.mhaParams;
  $("#ck-mha").innerHTML = `<b>✓</b> input ${CK.mhaShape.in.join("×")} → output ${CK.mhaShape.out.join("×")}, weights ${CK.mhaShape.w.join("×")} (B, heads, queries, keys) · rows sum to one: ${CK.rowsSumToOne}`;
  $("#mha-note").innerHTML = `multi-head attention, d = 256, h = 8: <b>${num(MP.total)}</b> parameters — Q ${num(MP.Q)} (${pct(MP.Q / MP.total)}), K ${num(MP.K)} (${pct(MP.K / MP.total)}), V ${num(MP.V)} (${pct(MP.V / MP.total)}), O ${num(MP.O)} (${pct(MP.O / MP.total)}). Each is one 256 × 256 matrix plus a bias; eight heads cost exactly what one head of width 256 would.`;
  function figMHA() {
    const host = $("#fig-mha"); host.innerHTML = "";
    const W = 1000, H = 300, s = svg(W, H), cw = 12;
    grid(s, 30, 110, 3, 6, cw, "X", { fill: "color-mix(in srgb, var(--cls-2) 25%, var(--panel))", dims: "T × d" });
    for (let h = 0; h < 8; h++) {
      const y = 22 + h * 32;
      arrow(s, 106, 128, 150, y + 12, { color: css("--ink-3"), width: .9, opacity: .7 });
      box(s, 152, y, 178, 24, `head ${h + 1}: W_Q${h + 1}, W_K${h + 1}, W_V${h + 1}`, { fs: 11, rx: 3 });
      arrow(s, 332, y + 12, 354, y + 12, { color: css("--ink-3"), width: .9 });
      grid(s, 356, y + 2, 3, 2, 7, null, { fill: `color-mix(in srgb, var(--cls-${h % 4}) 35%, var(--panel))` });
      txt(s, 376, y + 15, `Z${h + 1}`, { fs: 11, anchor: "start" });
      arrow(s, 398, y + 12, 440 + h * 16, 118, { color: css("--ink-3"), width: .8, opacity: .5 });
    }
    for (let h = 0; h < 8; h++) grid(s, 440 + h * 16, 120, 3, 2, 8, null, { fill: `color-mix(in srgb, var(--cls-${h % 4}) 35%, var(--panel))` });
    txt(s, 504, 178, "Concat(Z₁ … Z₈) · T × d", { fs: 12.5, bold: true, color: css("--ink") });
    txt(s, 588, 134, "×", { fs: 16 });
    grid(s, 606, 96, 6, 6, 8, "W_O · d × d", {});
    txt(s, 676, 134, "=", { fs: 16 });
    grid(s, 700, 120, 3, 6, 8, "Z · T × d", { fill: "color-mix(in srgb, var(--cls-2) 25%, var(--panel))" });
    txt(s, 760, 106, "each head: d_k = d / h = 32", { fs: 12, anchor: "start" });
    txt(s, 760, 126, "its own Q, K, V — its own lookup", { fs: 12, anchor: "start" });
    txt(s, 760, 146, "W_O mixes the eight answers", { fs: 12, anchor: "start" });
    txt(s, 500, H - 10, "in the code the eight W_Q are one 256 × 256 matrix, .view()-ed into eight slices of 32 — same numbers, one matmul", { fs: 12.5 });
    host.appendChild(s);
  }
  REDRAW.push(figMHA); figMHA();

  /* --- positions --- */
  function sinPE(d, L) {
    const pe = [];
    for (let p = 0; p < L; p++) { const row = new Float32Array(d); for (let i = 0; i < d; i += 2) { const f = Math.exp(i * (-Math.log(10000) / d)); row[i] = Math.sin(p * f); row[i + 1] = Math.cos(p * f); } pe.push(row); }
    return pe;
  }
  const pe = sinPE(64, 60);
  let maxd = 0; CK.pe64.forEach((row, p) => row.forEach((v, i) => { maxd = Math.max(maxd, Math.abs(v - pe[p][i])); }));
  $("#ck-pe").innerHTML = `<b>${maxd < 1e-4 ? "✓" : "✗"}</b> this page's sinusoid vs the notebook's buffer: max |diff| ${maxd.toExponential(1)}`;
  function peCharts() {
    /* transpose: rows = dimension (64), columns = position (60) */
    const T = Array.from({ length: 64 }, (_, i) => pe.map(row => row[i]));
    heatmap($("#pe-heat"), T, Array.from({ length: 64 }, (_, i) => i % 8 === 0 ? String(i) : ""), Array.from({ length: 60 }, (_, p) => p % 10 === 0 ? String(p) : ""), {
      cell: 7, fs: 10, L: 26, T: 18, noTip: true, flat: true, color: v => v >= 0 ? `color-mix(in srgb, var(--cls-0) ${Math.round(85 * v)}%, var(--panel))` : `color-mix(in srgb, var(--cls-1) ${Math.round(85 * -v)}%, var(--panel))`,
    });
    lineChart($("#pe-lines"), {
      W: 500, H: 300, L: 50, B: 48, fs: 13, xmin: 0, xmax: 59, ymin: -1.15, ymax: 1.45, nx: 6,
      series: [0, 8, 20, 40].map((i, k) => ({ x: pe.map((_, p) => p), y: pe.map(row => row[i]), color: `var(--cls-${k})`, label: `dim ${i}`, dots: false, width: 1.8 })),
      xlabel: "position", ylabel: "PE value", legendX: 60, legendY: 6,
    });
  }
  REDRAW.push(peCharts); peCharts();
  function figPE() {
    const host = $("#fig-pe"); host.innerHTML = "";
    const W = 1000, H = 330, s = svg(W, H), d = 8, P = 6, toks = ["Ein", "Mann", "mit", "einem", "Hut", "."];
    const omega = i => +Math.exp(2 * i * (-Math.log(10000) / d)).toPrecision(3);     // ω_i = 10000^(-2i/d), i = 0..d/2-1 (rounded for display)
    const cw = 96, ch = 30, x0 = 120, y0 = 96;
    txt(s, x0 + d * cw / 2, 20, "dimension j of the PE vector → pair i = ⌊j/2⌋, sin for even j, cos for odd; ω_i = 10000^(−2i/d)", { fs: 13, color: css("--ink") });
    for (let jdx = 0; jdx < d; jdx++) {
      const i = Math.floor(jdx / 2), even = jdx % 2 === 0, x = x0 + jdx * cw;
      txt(s, x + cw / 2, 44, `j = ${jdx}`, { fs: 12.5, bold: true, color: css("--ink") });
      txt(s, x + cw / 2, 62, `${even ? "sin" : "cos"}(p · ω${"₀₁₂₃"[i]})`, { fs: 13, color: even ? css("--cls-0") : css("--cls-1"), bold: true });
      txt(s, x + cw / 2, 80, `ω${"₀₁₂₃"[i]} = ${omega(i)}`, { fs: 11 });
    }
    txt(s, x0 - 8, y0 - 8, "position p ↓", { fs: 12, anchor: "end", color: css("--ink") });
    for (let p = 0; p < P; p++) {
      const y = y0 + p * ch;
      txt(s, x0 - 8, y + ch / 2 + 4.5, `p = ${p} · ${toks[p]}`, { fs: 12.5, anchor: "end", color: css("--ink") });
      for (let jdx = 0; jdx < d; jdx++) {
        const i = Math.floor(jdx / 2), even = jdx % 2 === 0, arg = p * omega(i), v = even ? Math.sin(arg) : Math.cos(arg), x = x0 + jdx * cw;
        const r = el("rect", { x, y, width: cw, height: ch, stroke: css("--panel"), "stroke-width": 1 });
        r.style.fill = v >= 0 ? `color-mix(in srgb, var(--cls-0) ${Math.round(70 * v)}%, var(--panel))` : `color-mix(in srgb, var(--cls-1) ${Math.round(70 * -v)}%, var(--panel))`;
        tipOn(r, `PE[p = ${p}, j = ${jdx}] = ${even ? "sin" : "cos"}(${p} · ${omega(i)}) = ${even ? "sin" : "cos"}(${arg.toFixed(3)}) = ${v.toFixed(3)}`);
        s.appendChild(r);
        s.appendChild(el("text", { x: x + cw / 2, y: y + ch / 2 + 4.3, "font-size": 11.5, "text-anchor": "middle", fill: css("--ink") }, `${even ? "sin" : "cos"}(${p}·${omega(i)})`));
      }
    }
    txt(s, x0 + d * cw / 2, H - 30, "the argument p · ω_i grows down a column with the position, and ω_i shrinks 10× every two columns:", { fs: 12.5 });
    txt(s, x0 + d * cw / 2, H - 12, "j = 0, 1 turn a full circle in about six positions; j = 6, 7 barely move. Colour = value: blue positive, orange negative.", { fs: 12.5 });
    host.appendChild(s);
  }
  REDRAW.push(figPE); figPE();

  /* --- the layer --- */
  const LP = CK.layerParams;
  $("#ck-layer").innerHTML = `one encoder layer, d = 256, ff = 1024: <b>${num(LP.total)}</b> parameters`;
  $("#layer-split").innerHTML = `<b>${num(LP.total)}</b> parameters — attention ${num(LP.attention)} (${pct(LP.attention / LP.total)}), FFN ${num(LP.ffn)} (${pct(LP.ffn / LP.total)}), LayerNorm ${num(LP.layerNorm)}`;
  $("#layer-note").innerHTML = `LayerNorm is ${num(LP.layerNorm)} parameters of ${num(LP.total)} — two vectors of 256 per norm — and it is what lets six of these stack.`;
  function figLayer() {
    const host = $("#fig-layer"); host.innerHTML = "";
    const W = 1000, H = 640, s = svg(W, H), ink = css("--ink-2");
    const C = { attn: "color-mix(in srgb, var(--cls-1) 22%, var(--panel))", an: "color-mix(in srgb, var(--cls-2) 22%, var(--panel))", ff: "color-mix(in srgb, var(--cls-0) 20%, var(--panel))",
      lin: "color-mix(in srgb, var(--cls-3) 22%, var(--panel))", sm: "color-mix(in srgb, var(--bad) 22%, var(--panel))" };
    const pill = (x, y, w, h, label, fill, fs) => box(s, x, y, w, h, label, { fill, stroke: css("--ink-2"), sw: 1.3, rx: h / 2, fs: fs || 13 });
    const up = (x, y1, y2) => arrow(s, x, y1, x, y2, { color: ink, width: 1.4 });
    const dashed = (xs, y1, xe, y2) => s.appendChild(el("path", { d: `M ${xs} ${y1} H ${xe - 14} V ${y2} H ${xe}`, fill: "none", stroke: ink, "stroke-width": 1.3, "stroke-dasharray": "4 4" }));
    const RH = 30, GAP = 20;
    /* one layer block; sub = list of ["wide"|"per", label, fill]; returns top y of the box */
    function block(x, w, yBottom, cols, sub, title, stroke) {
      const pad = 16; let y = yBottom - pad;
      const boxes = [];
      sub.forEach(([kind, label, fill]) => {
        const yb = y - RH;
        if (kind === "wide") { pill(x + pad, yb, w - 2 * pad, RH, label, fill); }
        else cols.forEach(cx => pill(cx - 62, yb, 124, RH, label, fill));
        boxes.push({ label, yb, kind });
        y = yb - GAP;
      });
      const top = y + GAP - pad;
      s.appendChild(el("rect", { x, y: top, width: w, height: yBottom - top, rx: 14, fill: "none", stroke, "stroke-width": 1.6 }));
      s.appendChild(el("text", { x: x - 10, y: (top + yBottom) / 2, "font-size": 12.5, "text-anchor": "middle", fill: stroke, "font-weight": "600", "letter-spacing": ".08em", transform: `rotate(-90 ${x - 10} ${(top + yBottom) / 2})` }, title));
      /* arrows between sublayers, and dashed residuals into every Add & Normalize */
      for (let k = 0; k < boxes.length; k++) {
        const b = boxes[k], prevBottom = k ? boxes[k - 1].yb : yBottom + 2;
        cols.forEach(cx => up(cx, prevBottom, b.yb + RH + 2));
        if (b.label.startsWith("Add")) { const from = k >= 2 ? boxes[k - 2].yb : yBottom + 2; dashed(cols[0], from, x + 8 + 14, b.yb + RH / 2); }
      }
      return top;
    }
    /* encoder side */
    const ex = 70, ew = 400, ecols = [ex + 110, ex + 290];
    const toks = ["Ein", "Mann"];
    toks.forEach((t, i) => { const cx = ecols[i]; txt(s, cx, H - 8, t, { fs: 14, bold: true, color: css("--cls-2") }); txt(s, cx - 62, H - 42, `x${"₁₂"[i]}`, { fs: 13, bold: true, color: css("--cls-2"), anchor: "end" });
      for (let c = 0; c < 4; c++) s.appendChild(el("rect", { x: cx - 52 + c * 26, y: H - 56, width: 26, height: 20, fill: "color-mix(in srgb, var(--cls-2) 45%, var(--panel))", stroke: css("--panel") }));
      s.appendChild(el("circle", { cx, cy: H - 78, r: 9, fill: css("--panel"), stroke: ink, "stroke-width": 1.3 })); txt(s, cx, H - 74, "+", { fs: 14, color: css("--ink") });
      up(cx, H - 58, H - 87); });
    txt(s, ecols[0] - 14, H - 86, "positional", { fs: 10.5, anchor: "end" }); txt(s, ecols[0] - 14, H - 70, "encoding", { fs: 10.5, anchor: "end" });
    const encSub = [["wide", "Self-Attention", C.attn], ["wide", "Add & Normalize", C.an], ["per", "Feed Forward", C.ff], ["wide", "Add & Normalize", C.an]];
    const e1top = block(ex, ew, H - 92, ecols, encSub, "ENCODER #1", css("--cls-2"));
    ecols.forEach(cx => up(cx, e1top, e1top - 22));
    const e2top = block(ex, ew, e1top - 24, ecols, encSub, "ENCODER #2", css("--cls-2"));
    /* decoder side */
    const dx = 560, dw = 400, dcols = [dx + 110, dx + 290];
    dcols.forEach(cx => { s.appendChild(el("circle", { cx, cy: H - 78, r: 9, fill: css("--panel"), stroke: ink, "stroke-width": 1.3 })); txt(s, cx, H - 74, "+", { fs: 14, color: css("--ink") }); });
    txt(s, dx + 200, H - 40, "previous outputs, shifted right · [BOS] A …", { fs: 11.5 });
    const decSub = [["wide", "Self-Attention", C.attn], ["wide", "Add & Normalize", C.an], ["wide", "Encoder-Decoder Attention", C.attn], ["wide", "Add & Normalize", C.an], ["per", "Feed Forward", C.ff], ["wide", "Add & Normalize", C.an]];
    const d1top = block(dx, dw, H - 92, dcols, decSub, "DECODER #1", css("--cls-1"));
    dcols.forEach(cx => up(cx, d1top, d1top - 22));
    s.appendChild(el("rect", { x: dx, y: d1top - 60, width: dw, height: 36, rx: 14, fill: "none", stroke: css("--cls-1"), "stroke-width": 1.6, "stroke-dasharray": "6 4" }));
    txt(s, dx + dw / 2, d1top - 37, "DECODER #2", { fs: 12.5, bold: true, color: css("--cls-1") });
    up(dx + dw / 2, d1top - 62, d1top - 84);
    pill(dx + 16, d1top - 114, dw - 32, RH, "Linear · tied to the target embedding", C.lin);
    up(dx + dw / 2, d1top - 116, d1top - 138);
    pill(dx + 16, d1top - 168, dw - 32, RH, "Softmax · P(next token)", C.sm);
    /* memory: the encoder output feeds every decoder's encoder-decoder attention */
    const memY = e2top - 8, edaY = H - 92 - 16 - 3 * (RH + GAP) + GAP + RH / 2;   // centre of "Encoder-Decoder Attention"
    const path = el("path", { d: `M ${ex + ew / 2} ${e2top} V ${memY - 18} H ${dx - 40} V ${edaY} H ${dx - 2}`, fill: "none", stroke: css("--cls-0"), "stroke-width": 1.6, "stroke-dasharray": "2 4" });
    s.appendChild(path);
    arrow(s, dx - 40, edaY, dx - 2, edaY, { color: css("--cls-0"), width: 1.6 });
    arrow(s, dx - 40, d1top - 42, dx - 2, d1top - 42, { color: css("--cls-0"), width: 1.6 });
    txt(s, (ex + ew / 2 + dx - 40) / 2, memY - 24, "memory: one vector per source token, K and V for every decoder layer", { fs: 11.5, color: css("--cls-0") });
    host.appendChild(s);
  }
  REDRAW.push(figLayer); figLayer();

  /* --- assembly --- */
  const TP = CK.tfParams;
  $("#tf-params").innerHTML = `<div class="stat"><span class="v">${(TP.total / 1e6).toFixed(2)}M</span><span class="k">parameters · 6 + 6 layers, d = 256</span></div>
    <div class="stat"><span class="v">${pct(TP.layers / TP.total)}</span><span class="k">in the layers · ${num(TP.layers)}</span></div>
    <div class="stat"><span class="v">${pct(TP.embeddings / TP.total)}</span><span class="k">in the two embeddings · ${num(TP.embeddings)}</span></div>`;
  $("#ck-tf").innerHTML = CK.torchTransformerMatch ? `<b>✓</b> the stack is torch.nn.Transformer(norm_first=True), to the parameter` : `<b class="no">✗</b> parameter count differs from torch.nn.Transformer`;

})();

/* ============================================================ 05 results */
__mark("05 results");
(function () {
  const names = ["l1", "l3", "l6"], depth = names.map(n => TFM[n].testBleu), spread = Math.max(...depth) - Math.min(...depth);
  const noca = TFM.no_ca.testBleu, nope = TFM.no_pe.testBleu;
  const near = (v, opts) => opts.map((o, i) => [Math.abs(o - v), i]).sort((a, b) => a[0] - b[0])[0][1];
  const b1 = makeBet("#bet-res-depth", ["under 1 BLEU", "1–3 BLEU", "more than 3 BLEU"], spread < 1 ? 0 : spread < 3 ? 1 : 2);
  const b2 = makeBet("#bet-res-noca", ["≈ 13 — back to week 2", "≈ 26 — halfway", "≈ 36 — like the attention LSTM"], near(noca, [13, 26, 36]));
  const b3 = makeBet("#bet-res-nope", ["under 20", "20–35", "over 35"], nope < 20 ? 0 : nope < 35 ? 1 : 2);
  function charts() {
    const W2 = BASE.curves, A = ATT.additive.curves;
    lineChart($("#res-bleu-chart"), {
      W: 500, H: 320, L: 60, B: 52, fs: 13, xmin: 0.8, xmax: 15.2, ymin: 0, ymax: 45, nx: 8,
      series: [{ x: W2.epoch, y: W2.val_bleu, color: MODEL_COLOR.lstm0, dash: true, label: "LSTM, no attention", r: 3 },
        { x: A.epoch, y: A.val_bleu, color: MODEL_COLOR.additive, dash: true, label: "LSTM + attention", r: 3 }]
        .concat(names.map(n => ({ x: TFM[n].curves.epoch, y: TFM[n].curves.val_score, color: MODEL_COLOR[n], label: TFM[n].label, r: 3, tip: (x, y) => `${TFM[n].label} epoch ${x}<br>val BLEU ${y}` }))),
      xlabel: "epoch", ylabel: "validation BLEU", legendX: 230, legendY: 180,
    });
    lenChart($("#res-len-chart"), [byLenSeries(BASE.byLen, MODEL_COLOR.lstm0, "LSTM, no attention"), byLenSeries(ATT.additive.byLen, MODEL_COLOR.additive, "LSTM + attention"),
      byLenSeries(TFM.l6.byLen, MODEL_COLOR.l6, "Transformer, 6 layers"), byLenSeries(TFM.no_ca.byLen, MODEL_COLOR.no_ca, "Transformer, no cross-attn", true), byLenSeries(TFM.no_pe.byLen, MODEL_COLOR.no_pe, "Transformer, no positions", true)], { ymax: 52, H: 320, legendX: 250, legendY: 150 });
  }
  $("#btn-res-reveal").addEventListener("click", () => {
    const ok = [b1.reveal(), b2.reveal(), b3.reveal()].filter(Boolean).length;
    $("#res-score").textContent = `${ok}/3 right`;
    $("#res-out").hidden = false; $("#res-note").hidden = false;
    resultsTable($("#res-table"), r => /Transformer/.test(r.model));
    charts(); REDRAW.push(charts);
    $("#res-depth-say").innerHTML = `1, 3 and 6 layers land at <b>${depth.map(v => v.toFixed(1)).join(", ")}</b> BLEU — a spread of ${spread.toFixed(1)}; on 29 000 pairs the extra layers buy ${spread < 1 ? "nothing the first one did not" : "a little"}, and cost ${TFM.l6.sPerEpoch.toFixed(0)} s/epoch against ${TFM.l1.sPerEpoch.toFixed(0)}`;
    $("#res-noca-say").innerHTML = `<b>${noca.toFixed(1)}</b> BLEU — a drop of ${(TFM.l6.testBleu - noca).toFixed(1)} — and the slope is back in the right-hand plot: ${TFM.no_ca.byLen["0-10"]} on short sentences, ${TFM.no_ca.byLen["25-100"]} on long ones.`;
    $("#res-nope-say").innerHTML = `<b>${nope.toFixed(1)}</b> BLEU, ${(TFM.l6.testBleu - nope).toFixed(1)} below the full model, and ${TFM.no_pe.byLen["25-100"]} on long sentences against ${TFM.l6.byLen["25-100"]}`;
  });
  $("#res-show").innerHTML = `<div class="hm-title">6 layers</div>${showRows(TFM.l6.show)}<div class="hm-title" style="margin-top:14px">6 layers, no positional encoding</div>${showRows(TFM.no_pe.show)}`;

  /* browse the test set */
  const TR = D.translations, BUCKETS = [["all", 0, 999], ["≤ 10", 0, 10], ["11–15", 11, 15], ["16–20", 16, 20], ["21–25", 21, 25], ["26+", 26, 999]];
  let bucket = 0, shown = BASE.showIdx.slice();
  function inBucket(i) { const b = BUCKETS[bucket]; return TR[i].srcLen >= b[1] && TR[i].srcLen <= b[2]; }
  function pool() { return TR.map((_, i) => i).filter(inBucket); }
  function random() { const p = pool(); shown = []; while (shown.length < Math.min(3, p.length)) { const i = p[Math.floor(Math.random() * p.length)]; if (!shown.includes(i)) shown.push(i); } paint(); }
  function paint() {
    $("#tr-buckets").innerHTML = BUCKETS.map((b, i) => `<button class="${i === bucket ? "pick" : ""}" data-b="${i}" style="${i === bucket ? "background:var(--ink);color:var(--ground);border-color:var(--ink)" : ""}">${b[0]}</button>`).join("");
    const p = pool(), mean = k => p.reduce((a, i) => a + TR[i][k], 0) / p.length;
    const chip = (v, c) => `<span class="chip" style="border-color:${c}"><span class="dot" style="background:${c}"></span>BLEU ${v.toFixed(1)}</span>`;
    $("#tr-out").innerHTML = `<div class="footnote" style="margin-bottom:10px">${num(p.length)} sentences in this bucket · mean sentence BLEU: LSTM ${mean("b0").toFixed(1)}, LSTM + attention ${mean("bA").toFixed(1)}, transformer ${mean("bT").toFixed(1)} · corpus BLEU on all 1 000: ${BASE.testBleu.toFixed(1)} / ${ATT.additive.testBleu.toFixed(1)} / ${TFM.l6.testBleu.toFixed(1)}</div>` +
      shown.map(i => { const r = TR[i]; return `<div class="tr-row"><span class="k">de</span><span>${esc(r.de)} <span class="bleu">${r.srcLen} tokens</span></span><span class="k">ref</span><span>${esc(r.ref)}</span>
        <span class="k">lstm</span><span>${esc(r.h0)} ${chip(r.b0, MODEL_COLOR.lstm0)}</span><span class="k">+ attn</span><span>${esc(r.hA)} ${chip(r.bA, MODEL_COLOR.additive)}</span><span class="k">transf.</span><span>${esc(r.hT)} ${chip(r.bT, MODEL_COLOR.l6)}</span></div>`; }).join("");
  }
  $("#tr-buckets").addEventListener("click", e => { const b = e.target.closest("button[data-b]"); if (!b) return; bucket = +b.dataset.b; random(); });
  $("#btn-tr-random").addEventListener("click", random);
  paint();
})();

/* ============================================================= 06 inside */
__mark("06 inside");
(function () {
  const G = D.headGrids, sel = $("#grid-pick");
  sel.innerHTML = G.map((g, k) => `<option value="${k}">test #${g.i} · ${esc(g.srcTok.join(" ").replace(/▁/g, " ").trim().slice(0, 40))}…</option>`).join("");
  let cur = 0, kind = "cross", big = null;
  function score(m) { return m.reduce((a, row) => a + Math.max(...row), 0) / m.length; }
  function paint() {
    const g = G[cur]; sel.value = cur;
    const maps = g[kind], rows = kind === "cross" ? g.trgTok : g.srcTok, cols = g.srcTok;
    $("#grid-sent").innerHTML = `<b>DE</b> ${esc(g.srcTok.join(" ").replace(/▁/g, " ").trim())}<br><b>→</b> ${esc(g.trgTok.filter(t => t !== "[EOS]").join(" ").replace(/▁/g, " ").trim())}`;
    const host = $("#head-grid"); host.innerHTML = "";
    host.insertAdjacentHTML("beforeend", `<div></div>` + Array.from({ length: 8 }, (_, h) => `<div class="lab">head ${h + 1}</div>`).join(""));
    let best = [0, 0, -1];
    maps.forEach((layer, l) => {
      host.insertAdjacentHTML("beforeend", `<div class="lab">layer ${l + 1}</div>`);
      layer.forEach((m, h) => {
        const sc = score(m); if (sc > best[2]) best = [l, h, sc];
        const d = document.createElement("div"); host.appendChild(d);
        const s = heatmap(d, m, rows, cols, { cell: 5, fs: 4, noLabels: true, noTip: true, L: 0, T: 0 });
        s.dataset.lh = `${l},${h}`;
        s.addEventListener("click", () => { big = [l, h]; paintBig(); });
      });
    });
    if (!big) big = [best[0], best[1]];
    paintBig();
    /* what the 48 heads do, measured */
    const S = cols.length, flat = maps.flat();
    const sharp = flat.filter(m => score(m) > 0.5).length;
    const endHeads = flat.filter(m => { const cnt = m.filter(row => row.indexOf(Math.max(...row)) === S - 1).length; return cnt > m.length / 2; }).length;
    $("#inside-say").innerHTML = kind === "cross"
      ? `for this sentence, <b>${sharp} of 48</b> cross-attention heads are sharp (mean max weight above 0.5), the cleanest being layer ${best[0] + 1} head ${best[1] + 1} (${best[2].toFixed(2)}); <b>${endHeads}</b> put most of their weight on the last source token regardless of the query; the rest are diffuse.`
      : `for this sentence, <b>${sharp} of 48</b> encoder self-attention heads are sharp (mean max weight above 0.5); <b>${endHeads}</b> look at the sentence-final token from most positions.`;
  }
  function paintBig() {
    const g = G[cur], [l, h] = big, m = g[kind][l][h];
    $$("#head-grid svg").forEach(s => s.classList.toggle("on", s.dataset.lh === `${l},${h}`));
    $("#head-big-title").textContent = `${kind === "cross" ? "decoder cross-attention" : "encoder self-attention"} · layer ${l + 1} head ${h + 1} · mean max weight ${score(m).toFixed(2)}`;
    heatmap($("#head-big"), m, kind === "cross" ? g.trgTok : g.srcTok, g.srcTok, { cell: 20, fs: 11.5 });
  }
  sel.addEventListener("change", () => { cur = +sel.value; big = null; paint(); });
  $$("#grid-kind button").forEach(b => b.addEventListener("click", () => { kind = b.dataset.v; big = null; $$("#grid-kind button").forEach(x => x.classList.toggle("sel", x === b)); paint(); }));
  REDRAW.push(paint); paint();

  /* the residual stream as a composition: c_0 = one-hot; c_{l+1}[i] = ½ c_l[i] + ½ Σ_j ᾱ_l[i][j] c_l[j], ᾱ = head-averaged encoder self-attention */
  const rsel = $("#rs-pick"); rsel.innerHTML = sel.innerHTML; let rcur = 0;
  function figResidual() {
    const g = G[rcur]; rsel.value = rcur;
    const S = g.srcTok.length, L = g.enc.length;
    const avg = g.enc.map(layer => Array.from({ length: S }, (_, i) => Array.from({ length: S }, (_, j) => layer.reduce((a, h) => a + h[i][j], 0) / layer.length)));
    let comp = Array.from({ length: S }, (_, i) => Array.from({ length: S }, (_, j) => i === j ? 1 : 0));
    const comps = [comp];
    for (let l = 0; l < L; l++) {
      const next = comp.map((c, i) => c.map((_, k) => 0.5 * c[k] + 0.5 * avg[l][i].reduce((a, w, j) => a + w * comp[j][k], 0)));
      comps.push(next); comp = next;
    }
    const host = $("#fig-residual"); host.innerHTML = "";
    const W = 1000, H = 60 + (L + 1) * 44 + 40, s = svg(W, H), bw = Math.min(64, (W - 240) / S), bh = 26, x0 = 210;
    const hue = k => `hsl(${Math.round(200 + 140 * k / Math.max(1, S - 1))} 55% 55%)`;
    g.srcTok.forEach((t, k) => { s.appendChild(el("rect", { x: x0 + k * bw, y: 14, width: bw - 4, height: 10, fill: hue(k) })); txt(s, x0 + k * bw + bw / 2 - 2, 40, t.replace(/▁/g, ""), { fs: 11.5, color: css("--ink") }); });
    comps.forEach((c, l) => {
      const y = 60 + l * 44;
      const selfShare = c.reduce((a, row, i) => a + row[i], 0) / S;
      txt(s, x0 - 10, y + bh / 2 + 4.5, (l === 0 ? "embedding" : `after layer ${l}`) + ` · self ${pct(selfShare)}`, { fs: 12.5, anchor: "end", color: css("--ink") });
      c.forEach((row, i) => {
        let acc = 0; const x = x0 + i * bw;
        row.forEach((v, k) => { if (v < 0.004) { acc += v; return; } const r = el("rect", { x: x + acc * (bw - 4), y, width: v * (bw - 4), height: bh, fill: hue(k), stroke: k === i ? css("--ink") : "none", "stroke-width": k === i ? 1.6 : 0 }); tipOn(r, `position ${i} (${esc(g.srcTok[i])}) after layer ${l}<br>${pct(v, 1)} from ${esc(g.srcTok[k])}`); s.appendChild(r); acc += v; });
      });
    });
    txt(s, W / 2, H - 10, "columns: positions of this sentence · colours: which original token the mass came from · outlined slice: the token itself", { fs: 12 });
    host.appendChild(s);
  }
  rsel.addEventListener("change", () => { rcur = +rsel.value; figResidual(); });
  REDRAW.push(figResidual); figResidual();
})();

/* =============================================== 07 the tiny transformers */
__mark("07 the tiny transformers");
/* The notebook's Transformer class, forward pass only, for the two d=64 models trained in section 6.
   Weights come from the export as float16; the arithmetic below is the same as encode()/decode()/greedy(). */
class TinyTF {
  constructor(spec) {
    this.cfg = spec.config; this.itos = spec.itos; this.stoi = new Map(spec.itos.map((c, i) => [c, i]));
    this.W = {}; for (const k in spec.weights) this.W[k] = { a: f16(spec.weights[k].f16), shape: spec.weights[k].shape };
    this.d = this.cfg.d; this.h = this.cfg.h; this.dk = this.d / this.h; this.L = this.cfg.layers;
    this.PAD = 0; this.BOS = 2; this.EOS = 3;
  }
  w(n) { return this.W[n].a; }
  linear(x, name) {
    const Wt = this.W[name + ".weight"], W = Wt.a, [out, inn] = Wt.shape, b = this.W[name + ".bias"] ? this.W[name + ".bias"].a : null;
    return x.map(row => { const r = new Float32Array(out); for (let o = 0; o < out; o++) { let s = b ? b[o] : 0; const off = o * inn; for (let i = 0; i < inn; i++) s += W[off + i] * row[i]; r[o] = s; } return r; });
  }
  ln(x, name) {
    const g = this.w(name + ".weight"), b = this.w(name + ".bias");
    return x.map(row => { const n = row.length; let mu = 0; for (let i = 0; i < n; i++) mu += row[i]; mu /= n; let v = 0; for (let i = 0; i < n; i++) v += (row[i] - mu) ** 2; v /= n; const sc = 1 / Math.sqrt(v + 1e-5); const r = new Float32Array(n); for (let i = 0; i < n; i++) r[i] = (row[i] - mu) * sc * g[i] + b[i]; return r; });
  }
  add(x, y) { return x.map((row, t) => { const r = new Float32Array(row.length); for (let i = 0; i < row.length; i++) r[i] = row[i] + y[t][i]; return r; }); }
  ffn(x, name) { const h = this.linear(x, name + ".net.0"); h.forEach(r => { for (let i = 0; i < r.length; i++) if (r[i] < 0) r[i] = 0; }); return this.linear(h, name + ".net.3"); }
  /* multi-head attention = the notebook's MultiHeadAttention.forward + attention(): returns {out, w: [h][T][S]} */
  mha(xq, xkv, name, causal) {
    const q = this.linear(xq, name + ".W_q"), k = this.linear(xkv, name + ".W_k"), v = this.linear(xkv, name + ".W_v");
    const T = xq.length, S = xkv.length, d = this.d, dk = this.dk, scale = 1 / Math.sqrt(dk);
    const out = Array.from({ length: T }, () => new Float32Array(d)), w = [];
    for (let hh = 0; hh < this.h; hh++) {
      const off = hh * dk, wh = [];
      for (let t = 0; t < T; t++) {
        const sc = new Float64Array(S);
        for (let j = 0; j < S; j++) { let s = 0; for (let i = 0; i < dk; i++) s += q[t][off + i] * k[j][off + i]; sc[j] = causal && j > t ? -1e9 : s * scale; }   // scores = q @ k^T / sqrt(d_k); masked_fill(-1e9)
        const p = softmax(sc);                                                                                                                  // w = softmax(scores, dim=-1)
        wh.push(Array.from(p));
        for (let j = 0; j < S; j++) { const pj = p[j]; if (pj < 1e-9) continue; for (let i = 0; i < dk; i++) out[t][off + i] += pj * v[j][off + i]; }   // w @ v
      }
      w.push(wh);
    }
    return { out: this.linear(out, name + ".W_o"), w };
  }
  embed(ids, table) {
    const E = this.w(table), d = this.d, sc = Math.sqrt(d), pe = this.W["pos.pe"] ? this.w("pos.pe") : null;
    return ids.map((id, p) => { const r = new Float32Array(d); for (let i = 0; i < d; i++) r[i] = E[id * d + i] * sc + (pe ? pe[p * d + i] : 0); return r; });   // pos(emb(x) * sqrt(d))
  }
  encode(ids) {
    let x = this.embed(ids, "src_emb.weight");
    for (let l = 0; l < this.L; l++) {
      const p = `enc_layers.${l}`;
      x = this.add(x, this.mha(this.ln(x, p + ".ln1"), this.ln(x, p + ".ln1"), p + ".self_attn", false).out);
      x = this.add(x, this.ffn(this.ln(x, p + ".ln2"), p + ".ffn"));
    }
    return this.ln(x, "ln_enc");
  }
  decode(ids, memory) {
    let x = this.embed(ids, "trg_emb.weight"), cross = null;
    for (let l = 0; l < this.L; l++) {
      const p = `dec_layers.${l}`, y = this.ln(x, p + ".ln1");
      x = this.add(x, this.mha(y, y, p + ".self_attn", true).out);
      const c = this.mha(this.ln(x, p + ".ln2"), memory, p + ".cross_attn", false);
      x = this.add(x, c.out); cross = c.w;
      x = this.add(x, this.ffn(this.ln(x, p + ".ln3"), p + ".ffn"));
    }
    const last = this.ln(x, "ln_dec")[x.length - 1], E = this.w("trg_emb.weight"), d = this.d, V = this.W["trg_emb.weight"].shape[0], logits = new Float32Array(V);
    for (let v = 0; v < V; v++) { let s = 0; const off = v * d; for (let i = 0; i < d; i++) s += E[off + i] * last[i]; logits[v] = s; }   // tied output: E^T
    return { logits, cross };
  }
  encodeText(s) { return Array.from(s).map(c => this.stoi.has(c) ? this.stoi.get(c) : 1); }
  /* greedy(): the encoder runs once, the decoder re-reads the growing prefix. Returns the ids, the text and the
     head-averaged cross-attention of the last decoder layer for the final prefix — the notebook's task_alignment(). */
  run(text, maxLen) {
    const t0 = performance.now(), src = this.encodeText(text), memory = this.encode(src), ys = [this.BOS];
    let cross = null;
    for (let step = 0; step < maxLen; step++) {
      const r = this.decode(ys, memory); cross = r.cross;
      const y = argmax(r.logits); ys.push(y);
      if (y === this.EOS) break;
    }
    const ids = ys.slice(1), T = ys.length - 1, S = src.length;
    const w = Array.from({ length: T }, (_, t) => Array.from({ length: S }, (_, j) => cross.reduce((a, wh) => a + wh[t][j], 0) / this.h));
    const toks = ids.map(i => this.itos[i]);
    return { ids, toks, text: toks.filter(t => t.length === 1).join(""), w, srcTok: Array.from(text), ms: performance.now() - t0 };
  }
}
(function () {
  const DT = D.dates, RV = D.reverse;
  $("#date-examples").innerHTML = DT.examples.map(e => `<span class="mono">${esc(e.src)}</span> → <span class="mono">${esc(e.trg)}</span>`).join(" · ") + `<br>${DT.nChars} characters; ${num(DT.nTrain)} training pairs, ${num(DT.nVal)} validation`;
  const em = DT.exactMatch;
  const bd = makeBet("#bet-date", ["under 50%", "50–80%", "80–95%", "above 95%"], em < 50 ? 0 : em < 80 ? 1 : em < 95 ? 2 : 3);
  $("#btn-date-reveal").addEventListener("click", () => {
    bd.reveal(); $("#date-out").hidden = false; $("#date-note").hidden = false;
    $("#date-out").innerHTML = `<div class="stat-row"><div class="stat"><span class="v">${em.toFixed(1)}%</span><span class="k">exact match · 2 000 unseen dates · epoch ${DT.epochs}</span></div>
      <div class="stat"><span class="v">${num(DT.params)}</span><span class="k">parameters</span></div><div class="stat"><span class="v">${DT.seconds.toFixed(0)}s</span><span class="k">to train on ${D.meta.device}</span></div></div>
      <div class="footnote" style="margin-top:10px">exact match by epoch: ${DT.curves.val_score.map((v, i) => `<span class="mono">${i + 1}: ${v.toFixed(1)}%</span>`).join(" · ")}</div>`;
  });

  const dateTF = new TinyTF(DT.model);
  const revTF = { sin: new TinyTF(RV.models.sin.model), learned: new TinyTF(RV.models.learned.model) };
  function checkModel(tf, checks, maxLen) {
    let ok = 0, maxd = 0;
    checks.forEach(c => { const r = tf.run(c.src, maxLen); if (JSON.stringify(r.ids) === JSON.stringify(c.ids)) { ok++; c.w.forEach((row, t) => row.forEach((v, j) => { maxd = Math.max(maxd, Math.abs(v - r.w[t][j])); })); } });
    return { ok, n: checks.length, maxd };
  }
  const ckD = { ok: 0, n: DT.check.length, maxd: 0, done: false };
  $("#ck-date").textContent = "checking against the notebook…";
  function ckText(c, what) { return `<b class="${c.ok === c.n ? "" : "no"}">${c.ok === c.n ? "✓" : "✗"}</b> ${c.ok}/${c.n} ${what} reproduced in JS · attention max |diff| ${c.maxd.toExponential(1)}`; }
  function runDate() {
    const text = $("#date-in").value.slice(0, 40); if (!text) return;
    const r = dateTF.run(text, 16);
    $("#date-res").textContent = r.text; $("#date-res").className = "out " + (/^\d{4}-\d{2}-\d{2}$/.test(r.text) ? "ok" : "no");
    $("#date-time").textContent = `${r.ms.toFixed(0)} ms · ${r.ids.length} decoder steps, each re-reading the prefix · ${num(DT.params)} parameters, float16`;
    heatmap($("#date-hm"), r.w, r.toks, r.srcTok, { cell: 20, fs: 12, maxScale: 1.4 });
  }
  $("#date-in").addEventListener("input", runDate);
  $("#date-three").innerHTML = `<table><tbody>` + DT.check.map(c => `<tr><td class="mono" style="font-size:13.5px">${esc(c.src)}</td><td class="mono" style="font-size:13.5px">${esc(c.out)}</td><td class="mono" style="font-size:13.5px;color:${c.trg == null ? "var(--ink-3)" : c.trg === c.out ? "var(--good)" : "var(--bad)"}">${c.trg == null ? "not in the generator" : c.trg === c.out ? "✓" : "✗ " + esc(c.trg)}</td></tr>`).join("") + `</tbody></table>`;
  const firstOk = DT.check.find(c => c.trg != null && c.trg === c.out) || DT.check[0];
  if (!$("#date-in").value) $("#date-in").value = firstOk.src;
  REDRAW.push(runDate); $("#date-res").textContent = "…"; setTimeout(runDate, 0);

  /* reversal */
  const ex13 = RV.models.sin.exact["13"], exL13 = RV.models.learned.exact["13"];
  const b1 = makeBet("#bet-rev-13", ["≈ 90%", "≈ 50%", "≈ 15%", "0%"], [90, 50, 15, 0].map((o, i) => [Math.abs(o - ex13), i]).sort((a, b) => a[0] - b[0])[0][1]);
  const b2 = makeBet("#bet-rev-which", ["sinusoidal", "learned", "neither — both are at zero past 12"], ex13 > exL13 + 5 ? 0 : exL13 > ex13 + 5 ? 1 : 2);
  function revChart() {
    const Ls = RV.testLens, ser = [];
    [["sin", "var(--cls-0)"], ["learned", "var(--cls-1)"]].forEach(([pe, c]) => {
      ser.push({ x: Ls, y: Ls.map(L => RV.models[pe].exact[String(L)]), color: c, label: `pe=${pe}: exact match`, tip: (x, y) => `pe=${pe}, length ${x}<br>exact ${y}%` });
      ser.push({ x: Ls, y: Ls.map(L => RV.models[pe].char[String(L)]), color: c, dash: true, hollow: true, r: 3, label: `pe=${pe}: per-character`, tip: (x, y) => `pe=${pe}, length ${x}<br>per-character ${y}%` });
    });
    const r = lineChart($("#rev-chart"), { W: 1000, H: 330, L: 70, B: 52, fs: 13.5, xmin: 4.5, xmax: 20.5, ymin: -3, ymax: 108, nx: 16, xfmt: v => Number.isInteger(v) ? v : null, series: ser, xlabel: "sequence length", ylabel: "accuracy %", legendX: 600, legendY: 120 });
    const rect = el("rect", { x: r.X(4.5), y: r.Y(108), width: r.X(12.5) - r.X(4.5), height: r.Y(-3) - r.Y(108), fill: css("--ink"), opacity: .06 });
    r.s.insertBefore(rect, r.s.firstChild.nextSibling);
    r.s.appendChild(el("text", { x: r.X(8.5), y: r.Y(104), "font-size": 12.5, "text-anchor": "middle", fill: css("--ink-3") }, "training lengths 5–12"));
  }
  $("#btn-rev-reveal").addEventListener("click", () => {
    const ok = [b1.reveal(), b2.reveal()].filter(Boolean).length;
    $("#rev-score").textContent = `${ok}/2 right`;
    $("#rev-out").hidden = false; $("#rev-note").hidden = false;
    revChart(); REDRAW.push(revChart);
    $("#rev-say").innerHTML = `the sinusoid keeps <b>${ex13.toFixed(0)}%</b> of the strings (${RV.models.sin.char["13"].toFixed(0)}% of the characters) right at length 13, the learned table <b>${exL13.toFixed(0)}%</b> (${RV.models.learned.char["13"].toFixed(0)}% of the characters), and by 14 both are at ${Math.max(RV.models.sin.exact["14"], RV.models.learned.exact["14"]).toFixed(0)}%`;
  });
  let pe = "sin";
  const ckR = { sin: { ok: 0, n: RV.models.sin.check.length, maxd: 0, done: false }, learned: { ok: 0, n: RV.models.learned.check.length, maxd: 0, done: false } };
  /* the 26 reproduction runs happen after first paint, one model per tick, so they never block the page */
  const CHECKS_DONE = new Promise(resolve => setTimeout(() => {
    Object.assign(ckD, checkModel(dateTF, DT.check, 16), { done: true }); $("#ck-date").innerHTML = ckText(ckD, "notebook outputs");
    setTimeout(() => {
      Object.assign(ckR.sin, checkModel(revTF.sin, RV.models.sin.check, 22), { done: true });
      Object.assign(ckR.learned, checkModel(revTF.learned, RV.models.learned.check, 22), { done: true });
      runRev(); resolve(true);
    }, 30);
  }, 300));
  function runRev() {
    const text = $("#rev-in").value.toLowerCase().replace(/[^a-z]/g, "").slice(0, 22); $("#rev-in").value = text; if (!text) return;
    const tf = revTF[pe], r = tf.run(text, 22), want = Array.from(text).reverse().join("");
    $("#rev-res").textContent = r.text; $("#rev-res").className = "out " + (r.text === want ? "ok" : "no");
    $("#rev-time").textContent = `${text.length} letters${text.length > 12 ? " — past the training range" : ""} · ${r.text === want ? "correct" : "wrong"} · ${r.ms.toFixed(0)} ms · pe=${pe}`;
    const c = ckR[pe]; $("#ck-rev").innerHTML = c.done ? ckText(c, "notebook outputs") : "checking against the notebook…";
    heatmap($("#rev-hm"), r.w, r.toks, r.srcTok, { cell: 20, fs: 12, maxScale: 1.3 });
  }
  $("#rev-in").addEventListener("input", runRev);
  $$("#rev-pe button").forEach(b => b.addEventListener("click", () => { pe = b.dataset.v; $$("#rev-pe button").forEach(x => x.classList.toggle("sel", x === b)); runRev(); }));
  REDRAW.push(runRev); $("#rev-res").textContent = "…"; setTimeout(runRev, 0);
  window.__demo = Object.assign(window.__demo || {}, { dateTF, revTF, runDate, runRev, ckD, ckR, CHECKS_DONE });
})();

/* ================================================================ 08 end */
__mark("08 end");
resultsTable($("#end-table"));
__mark("done");
