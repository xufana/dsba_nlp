"use strict";
const D = JSON.parse(document.getElementById("demo-data").textContent);

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
const CELL_COLOR = { rnn: "var(--cls-1)", gru: "var(--cls-2)", lstm: "var(--cls-0)" };

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
  ["data", "The data", "00"],
  ["bpe", "BPE, for real", "01"],
  ["ngram", "Counting", "02"],
  ["smooth", "Perplexity", "03"],
  ["rnn", "Learning: RNNs", "04"],
  ["decode", "The sampler, live", "05"],
  ["holtz", "Likelihood ≠ quality", "06"],
  ["s2s", "Encoder–decoder", "07"],
  ["bottleneck", "The bottleneck", "08"],
  ["table", "The results table", "09"],
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

/* ------------------------------------------------------------ tokenizer */
/* The saved 8k BPE tokenizer: Metaspace + Punctuation pre-tokenizer, merges by rank. */
const TOK = {
  vocab: D.tokenizer.vocab,
  id: new Map(D.tokenizer.vocab.map((t, i) => [t, i])),
  rank: new Map(D.tokenizer.merges.map((m, i) => [m[0] + " " + m[1], i])),
  PAD: 0, UNK: 1, BOS: 2, EOS: 3,
  preTokenize(text) {
    if (!String(text).length) return [];
    let s = String(text).replace(/ /g, "▁");
    if (!s.startsWith("▁")) s = "▁" + s;
    const pieces = s.match(/▁[^▁]*|[^▁]+/g) || [];
    const out = [];
    const PUNCT = /\p{P}|[$+<=>^`|~]/u;
    for (const p of pieces) {
      let cur = "";
      for (const ch of p) {
        if (PUNCT.test(ch)) { if (cur) out.push(cur); out.push(ch); cur = ""; }
        else cur += ch;
      }
      if (cur) out.push(cur);
    }
    return out;
  },
  bpe(piece) {
    let sym = Array.from(piece);
    if (sym.length === 1) return sym;
    for (; ;) {
      let best = -1, bi = -1;
      for (let i = 0; i + 1 < sym.length; i++) {
        const r = this.rank.get(sym[i] + " " + sym[i + 1]);
        if (r !== undefined && (best < 0 || r < best)) { best = r; bi = i; }
      }
      if (best < 0) break;
      sym.splice(bi, 2, sym[bi] + sym[bi + 1]);
    }
    return sym;
  },
  encode(text) {
    const ids = [];
    for (const p of this.preTokenize(text)) for (const t of this.bpe(p)) ids.push(this.id.has(t) ? this.id.get(t) : this.UNK);
    return ids;
  },
  tokens(text) { return this.encode(text).map(i => this.vocab[i]); },
  decode(ids) {
    let s = "";
    ids.forEach((i, k) => {
      if (i < 4) return;
      let t = this.vocab[i];
      if (k === 0 || s === "") t = t.replace(/^▁/, "");
      s += t.replace(/▁/g, " ");
    });
    return s;
  },
};

/* ------------------------------------------------------------- the LSTM */
/* The notebook's lm_lstm.pt: embedding rows and output rows as int8 with a per-row scale,
   recurrent weights as float16. Forward pass = PyTorch's nn.LSTM, gate order i, f, g, o. */
const LSTM = {
  ready: false, V: D.lstm.V, E: D.lstm.E, H: D.lstm.H,
  init() {
    if (this.ready) return;
    const t0 = performance.now();
    this.emb = i8(D.lstm.emb_q); this.embS = f16(D.lstm.emb_s);
    this.wih = f16(D.lstm.w_ih); this.whh = f16(D.lstm.w_hh);
    const bi = f16(D.lstm.b_ih), bh = f16(D.lstm.b_hh);
    this.b = new Float32Array(bi.length); for (let i = 0; i < bi.length; i++) this.b[i] = bi[i] + bh[i];
    this.out = i8(D.lstm.out_q); this.outS = f16(D.lstm.out_s); this.outB = f16(D.lstm.out_b);
    this.gates = new Float32Array(4 * this.H);
    this.x = new Float32Array(this.E);
    this.ready = true;
    this.loadMs = performance.now() - t0;
  },
  newState() { return { h: new Float32Array(this.H), c: new Float32Array(this.H) }; },
  /* feed one token; returns the logits for the NEXT token (a fresh Float32Array). */
  step(tokenId, st) {
    const E = this.E, H = this.H, x = this.x, g = this.gates, h = st.h, c = st.c;
    const es = this.embS[tokenId], eo = tokenId * E;
    for (let j = 0; j < E; j++) x[j] = this.emb[eo + j] * es;
    const wih = this.wih, whh = this.whh, b = this.b;
    for (let r = 0; r < 4 * H; r++) {
      let s = b[r]; const o1 = r * E, o2 = r * H;
      for (let j = 0; j < E; j++) s += wih[o1 + j] * x[j];
      for (let j = 0; j < H; j++) s += whh[o2 + j] * h[j];
      g[r] = s;
    }
    const sig = v => 1 / (1 + Math.exp(-v));
    const nh = new Float32Array(H), nc = new Float32Array(H);
    for (let j = 0; j < H; j++) {
      const i_ = sig(g[j]), f_ = sig(g[H + j]), g_ = Math.tanh(g[2 * H + j]), o_ = sig(g[3 * H + j]);
      nc[j] = f_ * c[j] + i_ * g_;
      nh[j] = o_ * Math.tanh(nc[j]);
    }
    st.h = nh; st.c = nc;
    const V = this.V, out = this.out, outS = this.outS, outB = this.outB, logits = new Float32Array(V);
    for (let v = 0; v < V; v++) {
      let s = 0; const o = v * H;
      for (let j = 0; j < H; j++) s += out[o + j] * nh[j];
      logits[v] = s * outS[v] + outB[v];
    }
    return logits;
  },
  /* logits after feeding [BOS] + ids */
  feed(ids, st) { let lg = null; for (const t of ids) lg = this.step(t, st); return lg; },
};
function softmax(logits, T) {
  const n = logits.length, p = new Float32Array(n); let mx = -Infinity;
  const t = T || 1;
  for (let i = 0; i < n; i++) if (logits[i] / t > mx) mx = logits[i] / t;
  let sum = 0; for (let i = 0; i < n; i++) { p[i] = Math.exp(logits[i] / t - mx); sum += p[i]; }
  for (let i = 0; i < n; i++) p[i] /= sum;
  return p;
}
function argmax(a) { let b = 0; for (let i = 1; i < a.length; i++) if (a[i] > a[b]) b = i; return b; }
function topIdx(p, k) {
  const idx = Array.from(p.keys()); idx.sort((a, b) => p[b] - p[a]); return idx.slice(0, k);
}

/* ================================================================ 00 hero */
$("#michael-img").src = D.michael;

/* ================================================================ 00 data */
(function () {
  const C = D.corpus;
  $("#data-split").textContent = `train ${num(C.nTrain)} · val ${num(C.nVal)} · test ${num(C.nTest)}`;
  $("#data-stats").innerHTML = [
    [num(C.nTrain), "training jokes"], [num(C.charsTrain), "characters in train"],
    [Math.round(C.median), "median characters"], [Math.round(C.p95), "95th percentile"],
  ].map(([v, k]) => `<div class="stat"><span class="v">${v}</span><span class="k">${k}</span></div>`).join("");
  $("#data-examples").innerHTML = C.examples.map(j => `<div class="gen">${esc(j)}</div>`).join("");

  function lenChart() {
    const host = $("#len-chart"); host.innerHTML = "";
    const W = 480, H = 280, L = 56, R = 12, T = 14, B = 46, fs = 13.5;
    const s = svg(W, H), cnt = C.lenHist.counts, ed = C.lenHist.edges, mx = Math.max(...cnt);
    const X = v => L + v / 600 * (W - L - R), Y = v => H - B - v / mx * (H - T - B);
    linTicks(0, mx, 4).forEach(v => {
      s.appendChild(el("line", { class: "gridline", x1: L, x2: W - R, y1: Y(v), y2: Y(v), stroke: css("--rule") }));
      s.appendChild(el("text", { x: L - 6, y: Y(v) + 4, "font-size": fs, "text-anchor": "end", fill: css("--ink-3") }, tickFmt(v)));
    });
    cnt.forEach((c, i) => {
      const r = el("rect", { x: X(ed[i]) + .5, y: Y(c), width: X(ed[i + 1]) - X(ed[i]) - 1, height: H - B - Y(c), fill: css("--cls-0"), opacity: .85 });
      tipOn(r, `${Math.round(ed[i])}–${Math.round(ed[i + 1])} characters<br>${num(c)} jokes`);
      s.appendChild(r);
    });
    [0, 100, 200, 300, 400, 500, 600].forEach(v => s.appendChild(el("text", { x: X(v), y: H - B + fs + 6, "font-size": fs, "text-anchor": "middle", fill: css("--ink-3") }, v)));
    s.appendChild(el("line", { x1: X(C.median), x2: X(C.median), y1: T, y2: H - B, stroke: css("--ink"), "stroke-dasharray": "5 4" }));
    s.appendChild(el("text", { x: X(C.median) + 6, y: T + fs, "font-size": fs, fill: css("--ink-2") }, `median ${Math.round(C.median)}`));
    s.appendChild(el("text", { x: (L + W) / 2, y: H - 6, "font-size": fs, "text-anchor": "middle", fill: css("--ink-2") }, "characters per joke"));
    host.appendChild(s);
  }
  function zipfChart() {
    lineChart($("#zipf-chart"), {
      W: 480, H: 280, L: 70, B: 48, fs: 13.5, xlog: true, ylog: true, legend: false,
      series: [{ x: C.zipf.map(p => p[0]), y: C.zipf.map(p => p[1]), color: css("--cls-0"), dots: false }],
      xlabel: "rank of the word", ylabel: "frequency", xfmt: tickFmt, yfmt: tickFmt,
    });
  }
  REDRAW.push(lenChart, zipfChart); lenChart(); zipfChart();

  $("#bet-hapax").addEventListener("input", e => { $("#bet-hapax-v").textContent = e.target.value; });
  $("#btn-zipf-reveal").addEventListener("click", () => {
    const guess = +$("#bet-hapax").value / 100, real = C.hapax / C.nTypes;
    $("#zipf-stats").hidden = false; $("#zipf-note").hidden = false;
    $("#zipf-stats").innerHTML = `<div class="stat-row">
      <div class="stat"><span class="v">${num(C.nTokens)}</span><span class="k">word occurrences</span></div>
      <div class="stat"><span class="v">${num(C.nTypes)}</span><span class="k">distinct words</span></div>
      <div class="stat"><span class="v">${pct(real)}</span><span class="k">seen exactly once · you said ${pct(guess)}</span></div></div>
      <div class="footnote" style="margin-top:12px">most common: ${C.topWords.map(w => `<span class="tok">${esc(w)}</span>`).join("")}</div>`;
  });
})();

/* ================================================================= 01 bpe */
(function () {
  const TOYN = D.bpeToy.nJokes, TARGET = D.bpeToy.merges.length;
  const eow = s => esc(s).replace(/&lt;\/w&gt;/g, '<span class="eow">&lt;/w&gt;</span>');
  const betMerge = makeBet("#bet-merge", ["с + т", "п + о", "а + end-of-word", "н + е", "о + end-of-word"], 2);
  let wf = null, merges = [], counts = [], timer = 0;

  const SEP = "\u0001";
  function reset() {
    wf = new Map();                                   // key -> {sym: [...], f}
    for (const j of D.jokesSample.slice(0, TOYN)) for (const w of tokenizeWords(j)) {
      const sym = Array.from(w).concat("</w>"), k = sym.join(SEP), e = wf.get(k);
      if (e) e.f++; else wf.set(k, { sym, f: 1 });
    }
    merges = []; counts = []; paint();
    $("#bpe-encode").hidden = true; $("#bpe-note").hidden = true;
  }
  function oneMerge() {
    if (merges.length >= TARGET) return false;
    const pairs = new Map();
    for (const { sym, f } of wf.values())
      for (let i = 0; i + 1 < sym.length; i++) { const p = sym[i] + SEP + sym[i + 1]; pairs.set(p, (pairs.get(p) || 0) + f); }
    let best = null, bc = -1;
    for (const [p, c] of pairs) if (c > bc) { bc = c; best = p; }
    if (!best) return false;
    const [a, b] = best.split(SEP), nwf = new Map();
    for (const { sym, f } of wf.values()) {
      const out = [];
      for (let i = 0; i < sym.length; i++) {
        if (i + 1 < sym.length && sym[i] === a && sym[i + 1] === b) { out.push(a + b); i++; } else out.push(sym[i]);
      }
      const nk = out.join(SEP), e = nwf.get(nk);
      if (e) e.f += f; else nwf.set(nk, { sym: out, f });
    }
    wf = nwf; merges.push([a, b]); counts.push(bc);
    return true;
  }
  function paint() {
    $("#bpe-progress").textContent = `${merges.length} / ${TARGET} merges`;
    const SHOW = 12, rows = merges.slice(0, SHOW).map((m, i) => row(i, m, counts[i], i === merges.length - 1));
    const later = merges.length > SHOW ? [merges.length - 1].map(i => row(i, merges[i], counts[i], true)) : [];
    const words = merges.length > 30 ? merges.map((m, i) => [m, i]).filter(([m]) => !m[0].includes("</w>") && m[1] === "</w>" && m[0].length >= 2).slice(0, 14) : [];
    $("#bpe-merges").innerHTML = (merges.length ? "" : `<div class="footnote">${TXT("bpe-merges-empty")}</div>`) +
      rows.join("") + (later.length ? `<div class="merge-row"><span class="n">…</span><span></span><span></span></div>` + later.join("") : "") +
      (words.length ? `<div class="footnote" style="margin-top:12px">whole words so far: ${words.map(([m, i]) => `<span class="tok" title="merge ${i + 1}">${eow(m[0])}</span>`).join("")}</div>` : "");
    if (merges.length >= TARGET) { $("#bpe-encode").hidden = false; $("#bpe-note").hidden = false; encodeWord(); }
  }
  const row = (i, m, c, isNew) => `<div class="merge-row"><span class="n">${i + 1}</span>
    <span class="p"><span class="tok">${eow(m[0])}</span> + <span class="tok">${eow(m[1])}</span> → <span class="tok${isNew ? " new" : ""}">${eow(m[0] + m[1])}</span></span>
    <span class="c">seen ${num(c)}×</span></div>`;

  function run() {
    if (timer) return;
    if (!merges.length) betMerge.reveal(firstMergeAnswer());
    const t0 = performance.now();
    const tick = () => {
      let k = 0;
      while (k++ < 8 && oneMerge()) { }
      paint();
      if (merges.length < TARGET) timer = requestAnimationFrame(tick);
      else { timer = 0; $("#bpe-progress").textContent += ` · ${((performance.now() - t0) / 1000).toFixed(1)}s in your browser (${D.bpeToy.seconds}s in Python)`; }
    };
    timer = requestAnimationFrame(tick);
  }
  function firstMergeAnswer() {
    const m = D.bpeToy.merges[0];
    const opts = [["с", "т"], ["п", "о"], ["а", "</w>"], ["н", "е"], ["о", "</w>"]];
    const i = opts.findIndex(o => o[0] === m[0] && o[1] === m[1]);
    return i < 0 ? -1 : i;
  }
  window.__demo = Object.assign(window.__demo || {}, { toyMerges: () => merges });
  $("#btn-bpe-train").addEventListener("click", run);
  $("#btn-bpe-step").addEventListener("click", () => { if (timer) return; if (!merges.length) betMerge.reveal(firstMergeAnswer()); oneMerge(); paint(); });
  $("#btn-bpe-reset").addEventListener("click", () => { if (timer) { cancelAnimationFrame(timer); timer = 0; } reset(); });

  function bpeEncodeToy(word) {
    let pieces = Array.from(word).concat("</w>");
    for (const [a, b] of merges) {
      let j = 0;
      while (j < pieces.length - 1) {
        if (pieces[j] === a && pieces[j + 1] === b) pieces.splice(j, 2, a + b); else j++;
      }
    }
    return pieces;
  }
  function encodeWord() {
    const w = tokenizeWords($("#bpe-word").value)[0] || "";
    const pieces = w ? bpeEncodeToy(w) : [];
    $("#bpe-word-out").innerHTML = pieces.map(p => `<span class="tok">${eow(p)}</span>`).join("") + (w ? ` <span class="mono" style="color:var(--ink-3);font-size:14px">${pieces.length} pieces</span>` : "");
  }
  $("#bpe-word").addEventListener("input", encodeWord);
  $("#bpe-word-presets").innerHTML = D.bpeToy.words.map(w => `<button data-w="${esc(w.w)}" style="font-size:15px">${esc(w.w)}</button>`).join("");
  $("#bpe-word-presets").addEventListener("click", e => { const b = e.target.closest("button"); if (!b) return; $("#bpe-word").value = b.dataset.w; encodeWord(); });
  reset();

  /* the library tokenizer, 8k */
  $("#tok-stats").textContent = `${num(TOK.vocab.length)} tokens · ${num(D.tokenizer.merges.length)} merges · trained in ${D.bpeLib.seconds}s`;
  const presets = [D.bpeLib.text, "Штирлиц выстрелил в упор.", "Заходит мужик в бар", "Инквизиция, программист и Дарвин"];
  $("#tok-presets").innerHTML = presets.map((p, i) => `<button data-p="${i}" style="font-size:15px">${esc(p.length > 42 ? p.slice(0, 40) + "…" : p)}</button>`).join("");
  $("#tok-presets").addEventListener("click", e => { const b = e.target.closest("button"); if (!b) return; $("#tok-input").value = presets[+b.dataset.p]; tokRender(); });
  function tokRender() {
    const text = $("#tok-input").value, ids = TOK.encode(text), back = TOK.decode(ids);
    const words = tokenizeWords(text).length;
    $("#tok-out").innerHTML = ids.map(i => `<span class="tok${i === TOK.UNK ? " diff" : ""}" title="id ${i}">${esc(TOK.vocab[i]).replace(/\n/g, "⏎")}</span>`).join("") +
      `<div class="mono" style="font-size:14.5px;color:var(--ink-2);margin-top:8px">${ids.length} tokens · ${words} words · ${text.length} characters · ${(ids.length / Math.max(1, words)).toFixed(2)} tokens/word · round trip ${back === text ? "identical" : "<span style='color:var(--bad)'>differs</span>"}</div>`;
  }
  $("#tok-input").value = presets[0];
  $("#tok-input").addEventListener("input", tokRender);
  tokRender();

  /* the dial */
  const DL = D.dial, ratio = DL.rows.find(r => r.vocab === 1000).tokPerJoke / DL.rows.find(r => r.vocab === 32000).tokPerJoke;
  const betDial = makeBet("#bet-dial", ["under 2×", "2–3×", "3–5×", "over 5×"], ratio < 2 ? 0 : ratio < 3 ? 1 : ratio < 5 ? 2 : 3);
  function dialChart() {
    lineChart($("#dial-chart"), {
      W: 520, H: 300, L: 60, B: 52, fs: 13.5, xlog: true, ymin: 0, ymax: 120, legend: true, legendX: 300, legendY: 14,
      series: [{ x: DL.rows.map(r => r.vocab), y: DL.rows.map(r => r.tokPerJoke), color: css("--cls-0"), label: "BPE", tip: (x, y) => `vocabulary ${num(x)}<br>${y.toFixed(1)} tokens per joke` }],
      hlines: [{ y: DL.wordsPerJoke, label: `words · ${DL.wordsPerJoke.toFixed(1)}`, color: css("--ink-3") }, { y: DL.charsPerJoke, label: `characters · ${DL.charsPerJoke.toFixed(0)}`, color: css("--ink-3") }],
      xlabel: "BPE vocabulary size", ylabel: "tokens per joke", xticks: [500, 1000, 2000, 4000, 8000, 16000, 32000], xfmt: v => v >= 1000 ? (v / 1000) + "k" : v,
    });
  }
  $("#btn-dial-reveal").addEventListener("click", () => {
    betDial.reveal();
    $("#dial-out").hidden = false; $("#dial-note").hidden = false;
    dialChart(); REDRAW.push(dialChart);
    $("#dial-table").innerHTML = `<thead><tr><th>vocab</th><th class="num">tokens / joke</th><th class="num">tokens / word</th><th class="num">chars / token</th><th class="num">fit s</th></tr></thead><tbody>` +
      DL.rows.map(r => `<tr><td class="mono">${num(r.vocab)}</td><td class="num">${r.tokPerJoke.toFixed(1)}</td><td class="num">${r.tokPerWord.toFixed(2)}</td><td class="num">${r.charsPerTok.toFixed(2)}</td><td class="num">${r.fitS}</td></tr>`).join("") +
      `<tr><td class="mono">chars</td><td class="num">${DL.charsPerJoke.toFixed(1)}</td><td class="num">${(1 / DL.charsPerWord * DL.charsPerWord * DL.charsPerJoke / DL.wordsPerJoke).toFixed(2)}</td><td class="num">1.00</td><td class="num">0</td></tr>
       <tr><td class="mono">words (${num(DL.nWordTypes)})</td><td class="num">${DL.wordsPerJoke.toFixed(1)}</td><td class="num">1.00</td><td class="num">${DL.charsPerWord.toFixed(2)}</td><td class="num">0 · OOV ${pct(DL.oovWords, 1)}</td></tr></tbody>`;
    const r8 = DL.rows.find(r => r.vocab === 8000);
    $("#dial-note").innerHTML = TXT("dial-note", { ratio: ratio.toFixed(2), tok_per_word: r8.tokPerWord.toFixed(2), oov: pct(DL.oovWords, 1) });
  });
})();

/* =============================================================== 02 ngram */
const NG = {
  built: false, maxN: 5, counts: null, totals: null, joined: null,
  build() {
    if (this.built) return;
    const t0 = performance.now();
    this.counts = []; this.totals = [];
    for (let n = 1; n <= this.maxN; n++) { this.counts[n] = new Map(); this.totals[n] = new Map(); }
    const docs = [];
    for (const j of D.jokesSample) {
      const toks = tokenizeWords(j); docs.push(toks.join(" "));
      for (let n = 1; n <= this.maxN; n++) {
        const padded = new Array(n - 1).fill("[BOS]").concat(toks, ["[EOS]"]);
        const C = this.counts[n], Tt = this.totals[n];
        for (let i = n - 1; i < padded.length; i++) {
          const key = padded.slice(i - n + 1, i).join(""), nxt = padded[i];
          let m = C.get(key); if (!m) { m = new Map(); C.set(key, m); }
          m.set(nxt, (m.get(nxt) || 0) + 1);
          Tt.set(key, (Tt.get(key) || 0) + 1);
        }
      }
    }
    this.joined = "\n" + docs.join("\n") + "\n";
    this.built = true; this.buildMs = performance.now() - t0;
  },
  next(prefix, n) {
    const p = n > 1 ? new Array(n - 1).fill("[BOS]").concat(prefix).slice(-(n - 1)) : [];
    return this.counts[n].get(p.join("")) || null;
  },
  generate(prefix, n, seed, maxLen) {
    const rng = mulberry32(seed + 1), toks = prefix.slice();
    let dead = false;
    for (let k = 0; k < (maxLen || 60); k++) {
      const dist = this.next(toks, n);
      if (!dist) { dead = true; break; }
      let total = 0; for (const c of dist.values()) total += c;
      let r = rng() * total, pick = null;
      for (const [t, c] of dist) { r -= c; if (r <= 0) { pick = t; break; } }
      if (pick === null) pick = Array.from(dist.keys()).pop();
      if (pick === "[EOS]") break;
      toks.push(pick);
    }
    return { toks, dead };
  },
  /* longest window of the generated tokens found verbatim in the shipped training jokes */
  longestCopied(toks) {
    for (let k = Math.min(toks.length, 24); k >= 3; k--) {
      for (let i = 0; i + k <= toks.length; i++) {
        const w = toks.slice(i, i + k).join(" ");
        const at = this.joined.indexOf(w);
        if (at >= 0 && /[\s]/.test(this.joined[at - 1]) && /[\s]/.test(this.joined[at + w.length] || " ")) return { i, k };
      }
    }
    return null;
  },
};
(function () {
  const F = D.ngramFirst;
  $("#ng-nb-stats").textContent = `${num(F.bigramPrefixes)} bigram prefixes · ${num(F.trigramPrefixes)} trigram prefixes`;
  $("#ng-nb-3").innerHTML = F.samples3.map(s => `<div class="gen">${esc(s)}</div>`).join("");
  $("#ng-nb-5").innerHTML = F.samples5.map(s => `<div class="gen">${esc(s)}</div>`).join("");
  $("#ng-nb-copied").innerHTML = [[pct(F.copied3), "3-gram samples with an 8-word run copied verbatim from training"], [pct(F.copied5), "5-gram samples with an 8-word run copied verbatim"]]
    .map(([v, k]) => `<div class="stat"><span class="v">${v}</span><span class="k">${k}</span></div>`).join("");
  ["n", "seed"].forEach(k => $(`#ng-${k}`).addEventListener("input", e => { $(`#ng-${k}-v`).textContent = e.target.value; }));
  $("#btn-ng-gen").addEventListener("click", () => {
    const btn = $("#btn-ng-gen");
    if (!NG.built) { $("#ng-status").textContent = "counting 1..5-grams …"; btn.disabled = true; }
    setTimeout(() => {
      NG.build();
      $("#ng-status").textContent = `${num(D.jokesSample.length)} jokes · counted in ${(NG.buildMs / 1000).toFixed(1)}s`;
      btn.disabled = false;
      const n = +$("#ng-n").value, seed = +$("#ng-seed").value, prefix = tokenizeWords($("#ng-prefix").value);
      const outs = [];
      for (let s = 0; s < 3; s++) {
        const g = NG.generate(prefix, n, seed * 3 + s), cp = NG.longestCopied(g.toks);
        outs.push(`<div class="gen">` + g.toks.map((t, i) => `<span class="t${cp && i >= cp.i && i < cp.i + cp.k ? " copied" : ""}${i < prefix.length ? " prompt" : ""}">${esc(t)}</span>`).join(" ") +
          (g.dead ? ` <span class="dead" title="a prefix that never occurred in training: the raw model has no distribution to sample from">⟂ dead end</span>` : "") + `</div>`);
      }
      $("#ng-out").innerHTML = outs.join("");
      $("#ng-copied").innerHTML = TXT("ng-copied", { n, seed_lo: seed * 3, seed_hi: seed * 3 + 2 });
    }, 20);
  });
})();

/* ============================================================== 03 smooth */
(function () {
  const F = D.ngramFirst, S = D.smoothing, SP = D.sparsity;
  $("#btn-ppl-reveal").addEventListener("click", () => {
    const guess = $("#bet-ppl").value.trim();
    $("#ppl-out").hidden = false; $("#ppl-note").hidden = false; $("#sparsity-panel").hidden = false;
    $("#ppl-out").innerHTML = `<div class="stat-row">
      <div class="stat"><span class="v">${F.rawTrigramPpl === "inf" ? "∞" : fmt(F.rawTrigramPpl, 1)}</span><span class="k">test perplexity · trigram, no smoothing</span></div>
      <div class="stat"><span class="v">${guess ? esc(guess) : "—"}</span><span class="k">your bet</span></div></div>`;
    sparsityChart(); REDRAW.push(sparsityChart);
  });
  function sparsityChart() {
    lineChart($("#sparsity-chart"), {
      W: 1000, H: 330, L: 70, fs: 14.5, ymin: 0, ymax: 1, xmin: 1, xmax: 5, xticks: [1, 2, 3, 4, 5], yfmt: v => pct(v),
      series: [
        { x: SP.n, y: SP.words, color: css("--cls-1"), label: "words", tip: (x, y) => `${x}-grams, words<br>${pct(y, 1)} of test n-grams unseen` },
        { x: SP.n, y: SP.bpe, color: css("--cls-0"), label: "BPE, 8 000 tokens", tip: (x, y) => `${x}-grams, BPE<br>${pct(y, 1)} of test n-grams unseen` },
      ],
      xlabel: "n", ylabel: "share of test n-grams never seen in training",
    });
  }

  /* the three smoothing bets */
  const rows = S.words, best = rows.reduce((a, b) => a.ppl < b.ppl ? a : b);
  const bestSingle = rows.filter(r => !r.interp).reduce((a, b) => a.ppl < b.ppl ? a : b);
  const bestInterp = rows.filter(r => r.interp).reduce((a, b) => a.ppl < b.ppl ? a : b);
  const bN = makeBet("#bet-sm-n", ["n = 2", "n = 3", "n = 5"], { 2: 0, 3: 1, 5: 2 }[best.n]);
  const add1 = rows.find(r => r.model === "3-gram, add-1").ppl, add001 = rows.find(r => r.model === "3-gram, add-0.01").ppl;
  const bD = makeBet("#bet-sm-delta", ["δ = 1 is better", "δ = 0.01 is better", "about the same"], add1 < add001 * 0.9 ? 0 : add001 < add1 * 0.9 ? 1 : 2);
  const bI = makeBet("#bet-sm-interp", ["yes, interpolation wins", "no, the best single order wins"], bestInterp.ppl < bestSingle.ppl ? 0 : 1);
  const arm = () => { $("#btn-smooth-reveal").disabled = !(bN.pick !== null && bD.pick !== null && bI.pick !== null); };
  ["#bet-sm-n", "#bet-sm-delta", "#bet-sm-interp"].forEach(id => $(id).addEventListener("bet", arm));
  $("#btn-smooth-reveal").addEventListener("click", () => {
    const hits = [bN.reveal(), bD.reveal(), bI.reveal()].filter(Boolean).length;
    $("#smooth-score").textContent = `${hits} / 3 right`;
    $("#btn-smooth-reveal").disabled = true;
    $("#smooth-out").hidden = false; $("#smooth-note").hidden = false;
    $("#smooth-out").innerHTML = `<div class="scroll-x"><table><thead><tr><th>model</th><th class="num">test_ppl</th><th class="num">bits/char</th><th class="num">eval s</th></tr></thead><tbody>` +
      rows.map(r => `<tr${r === best ? ' style="font-weight:600"' : ""}><td class="mono">${esc(r.model)}</td><td class="num">${fmt(r.ppl, 1)}</td><td class="num">${fmt(r.bpc, 3)}</td><td class="num">${r.evalS}</td></tr>`).join("") + `</tbody></table></div>`;
    $("#smooth-note").innerHTML = TXT("smooth-note-measured", { add1: fmt(add1, 0), uni_ppl: fmt(rows[0].ppl, 0), n_types: num(D.dial.nWordTypes), interp_model: esc(bestInterp.model), interp_ppl: fmt(bestInterp.ppl, 0), ppl5: fmt(rows.find(r => r.n === 5).ppl, 0) });
  });

  /* the number that lies */
  const wi = rows.filter(r => r.interp), bi = S.bpe;
  const tbl = (title, rs) => `<div><div class="eyebrow" style="margin-bottom:6px">${title}</div><div class="scroll-x"><table><thead><tr><th>model</th><th class="num">test_ppl</th><th class="num">bits/char</th></tr></thead><tbody>` +
    rs.map(r => `<tr><td class="mono">${esc(r.model)}</td><td class="num">${fmt(r.ppl, 1)}</td><td class="num">${fmt(r.bpc, 3)}</td></tr>`).join("") + `</tbody></table></div></div>`;
  $("#lies-out").innerHTML = tbl("words · 692 177 tokens counted", wi) + tbl(`BPE 8k · ${num(S.nBpeTokens)} tokens counted`, bi);
})();

/* ================================================================= 04 rnn */
(function () {
  /* unrolled diagrams: training (teacher forcing) and inference (autoregressive) */
  const JOKE = "Хорошее утро наступает в обед.";
  let TOKS = ["[BOS]", "▁Хоро", "шее", "▁утро", "▁наступает", "▁в", "▁обед", ".", "[EOS]"], PREDS = null;
  function drawUnrolled(host, mode) {
    host.innerHTML = "";
    const T = TOKS.length - 1, infer = mode === "infer";
    const W = 1000, H = 250, step = 100, x0 = 150, bw = 80, bh = 46, yb = 105, fs = 14;
    const s = svg(W, H), mk = "arr-" + mode, out = infer ? css("--cls-2") : css("--ink-2");
    const defs = el("defs", {});
    [[mk, css("--ink-2")], [mk + "-out", out], [mk + "-eq", css("--good")], [mk + "-ne", css("--bad")]].forEach(([id, color]) => {
      const m = el("marker", { id, viewBox: "0 0 10 10", refX: 9, refY: 5, markerWidth: 7, markerHeight: 7, orient: "auto-start-reverse" });
      m.appendChild(el("path", { d: "M 0 0 L 10 5 L 0 10 z", fill: color })); defs.appendChild(m);
    });
    s.appendChild(defs);
    const arrow = (x1, y1, x2, y2, color, marker) => s.appendChild(el("line", { x1, y1, x2, y2, stroke: color || css("--ink-2"), "stroke-width": 1.6, "marker-end": `url(#${marker || mk})` }));
    const yTop = 30, yArrowTop = infer ? 40 : 46;
    s.appendChild(el("text", { x: x0 - 30, y: yb + bh / 2 + 5, "font-size": fs, "text-anchor": "end", fill: css("--ink-2") }, "h₀"));
    arrow(x0 - 24, yb + bh / 2, x0 - 2, yb + bh / 2);
    s.appendChild(el("text", { x: x0 - 30, y: H - 22, "font-size": fs - 1, "text-anchor": "end", fill: css("--ink-3") }, infer ? "input = own ŵₜ" : "input = gold wₜ"));
    s.appendChild(el("text", { x: x0 - 30, y: yTop + 4, "font-size": fs - 1, "text-anchor": "end", fill: infer ? out : css("--ink-2") }, infer ? "sampled ŵₜ₊₁" : "output ŵₜ₊₁"));
    if (!infer) s.appendChild(el("text", { x: x0 - 30, y: yTop + 20, "font-size": 12, "text-anchor": "end", fill: css("--ink-3") }, "(argmax)"));
    for (let t = 0; t < T; t++) {
      const x = x0 + t * step, cx = x + bw / 2;
      s.appendChild(el("rect", { x, y: yb, width: bw, height: bh, rx: 6, fill: css("--panel-sunk"), stroke: css("--cls-0"), "stroke-width": 1.6 }));
      s.appendChild(el("text", { x: cx, y: yb + bh / 2 + 5, "font-size": fs, "text-anchor": "middle", fill: css("--ink") }, `h${"₁₂₃₄₅₆₇₈₉"[t]}`));
      s.appendChild(el("text", { x: cx, y: H - 22, "font-size": fs, "text-anchor": "middle", fill: infer && t > 0 ? css("--cls-2") : css("--ink") }, TOKS[t]));
      arrow(cx, H - 40, cx, yb + bh + 2);
      if (t < T - 1) arrow(x + bw + 2, yb + bh / 2, x + step - 2, yb + bh / 2);
      if (infer) {
        s.appendChild(el("text", { x: cx, y: yTop + 4, "font-size": fs, "text-anchor": "middle", fill: out }, TOKS[t + 1]));
        arrow(cx, yb - 2, cx, yArrowTop, out, mk + "-out");
        s.appendChild(el("text", { x: cx + 6, y: yb - 14, "font-size": 12, fill: out }, "sample"));
        if (t < T - 1) {
          const gx = x + step - 10, ex = cx + step - 40;
          s.appendChild(el("path", { d: `M ${cx + 34} 30 C ${gx} 30, ${gx} 40, ${gx} 70 L ${gx} ${H - 46} C ${gx} ${H - 22}, ${gx} ${H - 22}, ${ex} ${H - 22}`,
            fill: "none", stroke: css("--cls-2"), "stroke-width": 1.5, "stroke-dasharray": "5 4", "marker-end": `url(#${mk}-out)` }));
        }
      } else {
        /* the model's actual output, in a pill at the end of the softmax arrow */
        const pr = PREDS ? PREDS[t] : "…", nextIn = TOKS[t + 1], ok = PREDS ? pr === nextIn : null;
        const pw = Math.max(3, pr.length) * 8.5 + 12;
        s.appendChild(el("rect", { x: cx - pw / 2, y: yTop - 11, width: pw, height: 22, rx: 3, fill: css("--panel-sunk"), stroke: css("--ink-2") }));
        s.appendChild(el("text", { x: cx, y: yTop + 5, "font-size": fs, "text-anchor": "middle", fill: css("--ink") }, pr));
        arrow(cx, yb - 2, cx, yArrowTop, css("--ink-2"), mk);
        s.appendChild(el("text", { x: cx + 6, y: yb - 14, "font-size": 12, fill: css("--ink-3") }, "softmax"));
        /* compare the output with what actually goes in next: the gold token (or the [EOS] target after the last step) */
        const gx = x + step - 10, last = t === T - 1, ex = last ? x0 + T * step + 2 : cx + step - 40;
        const col = ok === null ? css("--ink-3") : ok ? css("--good") : css("--bad"), mkr = ok === null ? mk : ok ? mk + "-eq" : mk + "-ne";
        s.appendChild(el("path", { d: `M ${cx + pw / 2 + 3} ${yTop} C ${gx} ${yTop}, ${gx} ${yTop + 10}, ${gx} ${yTop + 40} L ${gx} ${H - 46} C ${gx} ${H - 22}, ${gx} ${H - 22}, ${ex} ${H - 22}`,
          fill: "none", stroke: col, "stroke-width": 1.4, "stroke-dasharray": "4 4", "marker-end": `url(#${mkr})` }));
        if (ok !== null) {
          const my = 66;
          s.appendChild(el("circle", { cx: gx, cy: my, r: 10, fill: css("--panel"), stroke: col, "stroke-width": 1.4 }));
          s.appendChild(el("text", { x: gx, y: my + 5, "font-size": 14, "text-anchor": "middle", fill: col, "font-weight": 700 }, ok ? "=" : "≠"));
        }
        if (last) {
          s.appendChild(el("text", { x: x0 + T * step + 6, y: H - 22, "font-size": fs, fill: css("--ink-2") }, TOKS[T]));
          s.appendChild(el("text", { x: x0 + T * step + 6, y: H - 40, "font-size": 11.5, fill: css("--ink-3") }, "target"));
        }
      }
    }
    host.appendChild(s);
  }
  function unroll() { drawUnrolled($("#unroll-train"), "train"); drawUnrolled($("#unroll-infer"), "infer"); }
  /* the training row shows what the LSTM actually predicts on the gold prefix — computed by the model in this page */
  function predictTrain() {
    LSTM.init();
    const ids = [TOK.BOS].concat(TOK.encode(JOKE), [TOK.EOS]);
    TOKS = ids.map(i => TOK.vocab[i]);
    const st = LSTM.newState(); PREDS = [];
    for (let t = 0; t < ids.length - 1; t++) { const lg = LSTM.step(ids[t], st); PREDS.push(TOK.vocab[argmax(lg)]); }
    unroll();
  }
  REDRAW.push(unroll); unroll();
  const ioU = new IntersectionObserver(ents => { if (ents.some(e => e.isIntersecting)) { ioU.disconnect(); setTimeout(predictTrain, 30); } }, { rootMargin: "400px" });
  ioU.observe($("#unroll-train"));
  window.__demo = Object.assign(window.__demo || {}, { predictTrain });

  const P = D.pipeline;
  $("#pipe-shape").textContent = `x, y: ${P.xShape[0]} × ${P.xShape[1]} after padding`;
  $("#pipe-table").innerHTML = `<thead><tr><th></th>${P.x.map((_, i) => `<th class="num">${i}</th>`).join("")}</tr></thead><tbody>
    <tr><td class="mono">x (input)</td>${P.x.map(t => `<td class="mono nowrap">${esc(t)}</td>`).join("")}</tr>
    <tr><td class="mono">y (target)</td>${P.y.map(t => `<td class="mono nowrap" style="color:var(--bad)">${esc(t)}</td>`).join("")}</tr></tbody>`;

  if (D.recipe) $("#recipe-stats").textContent = `prints: test perplexity ${D.recipe.ppl.toFixed(1)} · ${D.recipe.seconds.toFixed(1)}s on ${D.recipe.device} · ${(D.recipe.params / 1e6).toFixed(2)}M params`;
  if (D.recipeS2s) $("#recipe-s2s-stats").textContent = `prints: test BLEU ${D.recipeS2s.bleu.toFixed(2)} · ${D.recipeS2s.seconds.toFixed(1)}s on ${D.recipeS2s.device} · ${(D.recipeS2s.params / 1e6).toFixed(2)}M params`;
  /* live LSTM bet */
  const LV = D.lmLive, tri = D.results.find(r => r.tokens === "BPE 8k" && r.note === "count-based");
  const betLive = makeBet("#bet-live", ["below the trigram's " + fmt(tri.ppl, 0), "above it"], LV.ppl < tri.ppl ? 0 : 1);
  $("#btn-live-reveal").addEventListener("click", () => {
    betLive.reveal(); $("#live-out").hidden = false; $("#live-note").hidden = false;
    $("#live-out").innerHTML = `<div class="stat-row" style="margin-bottom:14px">
      ${LV.history.map(h => `<div class="stat"><span class="v">${fmt(h.valPpl, 0)}</span><span class="k">val ppl · epoch ${h.epoch}</span></div>`).join("")}
      <div class="stat"><span class="v">${fmt(LV.ppl, 1)}</span><span class="k">test ppl · LSTM, ${LV.seconds.toFixed(0)}s</span></div>
      <div class="stat"><span class="v">${fmt(tri.ppl, 1)}</span><span class="k">test ppl · BPE trigram, interpolated</span></div>
      <div class="stat"><span class="v">${(LV.params / 1e6).toFixed(1)}M</span><span class="k">parameters</span></div></div>
      <div class="eyebrow" style="margin-bottom:6px">Three samples from it, seeds 0–2</div>
      <div class="gen-list">${LV.samples.map(s => `<div class="gen">${esc(s)}</div>`).join("")}</div>`;
  });

  /* cells */
  const CV = D.lmCurves, cells = ["rnn", "gru", "lstm"];
  const ppls = cells.map(c => CV[c].testPplRecomputed), spread = (Math.max(...ppls) - Math.min(...ppls)) / Math.min(...ppls);
  const betCells = makeBet("#bet-cells", ["5%", "about 20%", "50%", "more than 2×"], spread < 0.12 ? 0 : spread < 0.35 ? 1 : spread < 0.75 ? 2 : 3);
  function cellsChart() {
    lineChart($("#cells-chart"), {
      W: 1000, H: 340, L: 70, fs: 14.5, xticks: [1, 2, 3], xmin: 0.8, xmax: 3.2, ymin: 150, ymax: 950,
      series: cells.flatMap(c => [
        { x: CV[c].epoch, y: CV[c].val_ppl, color: CELL_COLOR[c], label: `${c.toUpperCase()} · ${(CV[c].n_params / 1e6).toFixed(1)}M params · validation`, tip: (x, y) => `${c.toUpperCase()} epoch ${x}<br>val ppl ${y.toFixed(1)}` },
        { x: CV[c].epoch, y: CV[c].train_ppl, color: CELL_COLOR[c], dash: true, dots: false, opacity: .6 },
      ]),
      hlines: [{ y: tri.ppl, label: `3-gram interpolated, BPE · ${fmt(tri.ppl, 1)}`, color: css("--ink-3"), left: true }],
      xlabel: "epoch", ylabel: "perplexity", legendX: 560, legendY: 12,
    });
  }
  $("#btn-cells-reveal").addEventListener("click", () => {
    betCells.reveal(); $("#cells-out").hidden = false; $("#cells-note").hidden = false;
    cellsChart(); REDRAW.push(cellsChart);
    $("#cells-table").innerHTML = `<thead><tr><th>cell</th><th class="num">params</th><th class="num">test_ppl</th><th class="num">bits/char</th><th class="num">train s</th></tr></thead><tbody>` +
      cells.map(c => `<tr><td class="mono" style="color:${CELL_COLOR[c]}">${c.toUpperCase()}</td><td class="num">${(CV[c].n_params / 1e6).toFixed(1)}M</td><td class="num">${fmt(CV[c].testPplRecomputed, 1)}</td><td class="num">${fmt(CV[c].testBpcRecomputed, 3)}</td><td class="num">${CV[c].seconds.reduce((a, b) => a + b, 0).toFixed(0)}</td></tr>`).join("") +
      `<tr><td class="mono">3-gram, interpolated · BPE</td><td class="num">${esc(tri.params)}</td><td class="num">${fmt(tri.ppl, 1)}</td><td class="num">${fmt(tri.bpc, 3)}</td><td class="num">—</td></tr></tbody>`;
    $("#cells-samples").innerHTML = D.lmSamples.map(s => `<div class="gen">${esc(s)}</div>`).join("");
  });

  /* gradients */
  const G = D.gradTime;
  function gradChart() {
    const xs = Array.from({ length: G.L }, (_, i) => G.L - i);
    lineChart($("#grad-chart"), {
      W: 500, H: 300, L: 66, B: 50, fs: 13.5, ylog: true, xmin: 1, xmax: G.L, xticks: [1, 10, 20, 30, 40], xfmt: v => v,
      series: cells.map(c => ({ x: xs, y: G.cells[c], color: CELL_COLOR[c], label: c.toUpperCase(), dots: false })),
      xlabel: "distance from the position where the loss is computed", ylabel: "‖∂ loss / ∂ embedding‖", legendX: 330, legendY: 10,
    });
    /* the axis is drawn far-to-near in the notebook; here distance grows to the right, so read right-to-left as "further back" */
  }
  function gnormChart() {
    const host = $("#gnorm-chart"); host.innerHTML = "";
    const wrap = document.createElement("div"); wrap.style.display = "grid"; wrap.style.gridTemplateColumns = "repeat(3, 1fr)"; wrap.style.gap = "6px";
    host.appendChild(wrap);
    cells.forEach(c => {
      const g = CV[c].grad_norms, d = document.createElement("div"); wrap.appendChild(d);
      lineChart(d, {
        W: 170, H: 300, L: 40, R: 18, B: 50, fs: 12, ylog: true, ymin: 0.08, ymax: 1.5, xmin: 0, xmax: (g.length - 1) * 20, xticks: [0, 140, 280], xfmt: v => v,
        series: [{ x: g.map((_, i) => i * 20), y: g, color: CELL_COLOR[c], dots: false, label: c.toUpperCase(), width: 1.6 }],
        hlines: [{ y: 1, label: "clip", color: css("--bad") }], xlabel: "step", legendX: 44, legendY: 4, yticks: [0.1, 0.3, 1],
      });
    });
  }
  REDRAW.push(gradChart, gnormChart); gradChart(); gnormChart();

  /* the gradient travelling back through time, animated from the measured norms */
  (function () {
    const host = $("#grad-anim"); if (!host) return;
    const W = 1000, H = 300, N = 8, x0 = 150, step = 100, bw = 70, bh = 40;
    const norm = cell => { const g = G.cells[cell], near = g[g.length - 1]; return d => g[Math.max(0, Math.min(g.length - 1, G.L - Math.max(1, d)))] / near; };
    const rows = [
      { y: 96, name: "plain RNN", cell: "rnn", color: css("--cls-1"), label: "hₜ = tanh(W xₜ + U hₜ₋₁)  ·  every step multiplies the gradient by ∂hₜ/∂hₜ₋₁" },
      { y: 232, name: "LSTM", cell: "lstm", color: css("--cls-0"), label: "cₜ = fₜ ⊙ cₜ₋₁ + iₜ ⊙ c̃ₜ  ·  the cell state adds: the gradient passes through fₜ, not through a weight matrix" },
    ];
    const rOf = m => 4 + 15 * Math.max(0, 1 + Math.log10(Math.max(m, 1e-4)) / 4);
    const fmtM = m => m >= 0.1 ? m.toFixed(2) : m >= 0.005 ? m.toFixed(3) : m.toExponential(0);
    let s, dots, marker, raf = 0;
    function build() {
      host.innerHTML = ""; s = svg(W, H); dots = []; marker = [];
      const defs = el("defs", {}); const m = el("marker", { id: "arr-g", viewBox: "0 0 10 10", refX: 9, refY: 5, markerWidth: 6, markerHeight: 6, orient: "auto-start-reverse" });
      m.appendChild(el("path", { d: "M 0 0 L 10 5 L 0 10 z", fill: css("--rule-strong") })); defs.appendChild(m); s.appendChild(defs);
      rows.forEach((r, ri) => {
        const mag = norm(r.cell), lineY = r.y - 34;
        s.appendChild(el("text", { x: x0 - 16, y: r.y + bh / 2 + 5, "font-size": 14.5, "text-anchor": "end", fill: r.color, "font-weight": 600 }, r.name));
        s.appendChild(el("text", { x: x0, y: r.y + bh + 24, "font-size": 12.5, fill: css("--ink-3") }, r.label));
        if (r.cell === "lstm") s.appendChild(el("line", { x1: x0 + bw / 2, x2: x0 + (N - 1) * step + bw / 2, y1: lineY, y2: lineY, stroke: r.color, "stroke-width": 2.5, opacity: .5 }));
        for (let t = 0; t < N; t++) {
          const x = x0 + t * step, cx = x + bw / 2, d = 5 * (N - 1 - t);
          s.appendChild(el("rect", { x, y: r.y, width: bw, height: bh, rx: 6, fill: css("--panel-sunk"), stroke: css("--rule-strong"), "stroke-width": 1.4 }));
          s.appendChild(el("text", { x: cx, y: r.y + bh / 2 + 5, "font-size": 13.5, "text-anchor": "middle", fill: css("--ink-2") }, d === 0 ? "t" : `t−${d}`));
          if (t < N - 1) s.appendChild(el("line", { x1: x + bw + 2, x2: x + step - 2, y1: r.y + bh / 2, y2: r.y + bh / 2, stroke: css("--rule-strong"), "stroke-width": 1.4, "marker-end": "url(#arr-g)" }));
          const dot = el("circle", { cx, cy: lineY, r: 0, fill: r.color, opacity: 0 });
          const lab = el("text", { x: cx, y: lineY - 30, "font-size": 12.5, "text-anchor": "middle", fill: r.color, opacity: 0 }, fmtM(mag(d)));
          s.appendChild(dot); s.appendChild(lab); dots.push({ dot, lab, t, ri, m: mag(d) });
        }
        s.appendChild(el("text", { x: x0 + N * step + 4, y: r.y + bh / 2 + 5, "font-size": 13.5, fill: css("--bad") }, "loss"));
        s.appendChild(el("line", { x1: x0 + N * step, x2: x0 + (N - 1) * step + bw + 4, y1: r.y + bh / 2, y2: r.y + bh / 2, stroke: css("--bad"), "stroke-width": 1.6, "marker-end": "url(#arr-g)" }));
        const mk = el("circle", { cx: x0 + (N - 1) * step + bw / 2, cy: lineY, r: 0, fill: "none", stroke: r.color, "stroke-width": 2.5 });
        s.appendChild(mk); marker.push(mk);
      });
      host.appendChild(s);
    }
    function frame(p) {
      const pos = (N - 1) * (1 - p);
      rows.forEach((r, ri) => {
        const mag = norm(r.cell), lo = Math.floor(pos), hi = Math.ceil(pos), f = pos - lo;
        const m = Math.exp((1 - f) * Math.log(mag(5 * (N - 1 - lo))) + f * Math.log(mag(5 * (N - 1 - hi))));
        marker[ri].setAttribute("cx", x0 + pos * step + bw / 2); marker[ri].setAttribute("r", rOf(m) + 3); marker[ri].setAttribute("opacity", p < 1 ? .9 : 0);
        dots.filter(d => d.ri === ri).forEach(d => { const on = d.t >= pos - 1e-6; d.dot.setAttribute("r", on ? rOf(d.m) : 0); d.dot.setAttribute("opacity", on ? .85 : 0); d.lab.setAttribute("opacity", on ? 1 : 0); });
      });
      $("#grad-anim-status").textContent = p < 1 ? `${Math.round(5 * pos)} steps back` : "40 steps back · measured";
    }
    const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
    function play() {
      if (raf) cancelAnimationFrame(raf);
      if (reduced) { frame(1); return; }
      const T = 6000, t0 = performance.now();
      const tick = now => { const p = Math.min(1, (now - t0) / T); frame(p); raf = p < 1 ? requestAnimationFrame(tick) : 0; };
      raf = requestAnimationFrame(tick);
    }
    build(); frame(1);
    let played = false;
    const io = new IntersectionObserver(ents => { if (!played && ents.some(e => e.isIntersecting)) { played = true; io.disconnect(); build(); play(); } }, { threshold: .4 });
    io.observe(host);
    $("#btn-grad-replay").addEventListener("click", () => { build(); play(); });
    REDRAW.push(() => { if (raf) cancelAnimationFrame(raf); build(); frame(1); });
    window.__demo = Object.assign(window.__demo || {}, { gradAnim: { build, frame } });
  })();
})();

/* ============================================================== 05 decode */
(function () {
  /* the two extremes */
  const DS = D.decodeSamples;
  const betExt = makeBet("#bet-ext", ["greedy loops, sampling drifts", "greedy drifts, sampling loops"], 0);
  $("#btn-ext-reveal").addEventListener("click", () => {
    betExt.reveal(); $("#ext-out").hidden = false; $("#ext-note").hidden = false;
    $("#ext-out").innerHTML = `<div><div class="eyebrow" style="margin-bottom:6px">Greedy · argmax every step · seeds 0, 1</div><div class="gen-list">${DS.greedy.map(s => `<div class="gen">${esc(s)}</div>`).join("")}</div></div>
      <div><div class="eyebrow" style="margin-bottom:6px">Pure sampling · seeds 0–2</div><div class="gen-list">${DS.sampling.map(s => `<div class="gen">${esc(s)}</div>`).join("")}</div></div>`;
  });

  /* the sampler */
  const METHODS = [["greedy", "greedy"], ["sample", "sampling"], ["top_k", "top-k"], ["top_p", "top-p"], ["min_p", "min-p"]];
  const S = { method: "top_p", ids: [], probs: [], state: null, logits: null, rng: null, prompt: null };
  const sl = id => $(`#${id} input`), slv = id => +sl(id).value;
  $("#gen-methods").innerHTML = `<span class="mono" style="font-size:14px;letter-spacing:.08em;color:var(--ink-3)">RULE</span>` +
    METHODS.map(([k, t]) => `<button data-m="${k}" class="${k === S.method ? "pick" : ""}">${t}</button>`).join("");
  $("#gen-methods").addEventListener("click", e => {
    const b = e.target.closest("button[data-m]"); if (!b) return;
    S.method = b.dataset.m; $$("#gen-methods button").forEach(x => x.classList.toggle("pick", x === b)); syncSliders(); paintDist();
  });
  function syncSliders() {
    const m = S.method;
    $("#sl-T").classList.toggle("off", m === "greedy");
    $("#sl-k").classList.toggle("off", m !== "top_k");
    $("#sl-p").classList.toggle("off", m !== "top_p");
    $("#sl-mp").classList.toggle("off", m !== "min_p");
    $("#sl-seed").classList.toggle("off", m === "greedy");
  }
  ["T", "k", "p", "mp", "rep", "ng", "seed"].forEach(id => {
    const inp = sl(`sl-${id}`), lab = $(`#sl-${id} label b`);
    const show = () => {
      const v = +inp.value;
      lab.textContent = id === "ng" ? (v ? v : "off") : id === "p" ? v.toFixed(2) : id === "mp" ? v.toFixed(2) : id === "T" ? v.toFixed(1) : id === "rep" ? v.toFixed(2) : v;
    };
    inp.addEventListener("input", () => { show(); if (id !== "seed") paintDist(); });
    show();
  });
  const PRESETS = ["Заходит мужик в бар", "Штирлиц", "Однажды", "Приходит муж домой", "Доктор говорит", ""];
  $("#gen-presets").innerHTML = PRESETS.map((p, i) => `<button data-p="${i}" style="font-size:15px">${p ? esc(p) : "(empty — from [BOS])"}</button>`).join("");
  $("#gen-presets").addEventListener("click", e => { const b = e.target.closest("button"); if (!b) return; $("#gen-prompt").value = PRESETS[+b.dataset.p]; clear(); });
  $("#gen-prompt").addEventListener("input", clear);

  function clear() { S.ids = []; S.probs = []; S.state = null; S.logits = null; S.prompt = null; paintOut(); $("#gen-dist").innerHTML = ""; $("#gen-stats").textContent = ""; }
  function start() {
    LSTM.init();
    S.prompt = TOK.encode($("#gen-prompt").value);
    S.ids = []; S.probs = []; S.state = LSTM.newState();
    S.logits = LSTM.feed([TOK.BOS].concat(S.prompt), S.state);
    S.rng = mulberry32(slv("sl-seed") + 7);
  }
  /* the decoding rule: logits -> {p (raw model probs), kept (Set or null), pick} */
  function rule(logits, history, forPaint) {
    const m = S.method, T = m === "greedy" ? 1 : slv("sl-T");
    const lg = Float32Array.from(logits), pen = slv("sl-rep"), ng = slv("sl-ng");
    if (pen > 1) for (const t of new Set(history)) lg[t] = lg[t] > 0 ? lg[t] / pen : lg[t] * pen;
    if (ng > 0 && history.length >= ng - 1) {
      const pre = history.slice(-(ng - 1)).join(",");
      for (let i = 0; i + ng - 1 < history.length; i++) if (history.slice(i, i + ng - 1).join(",") === pre) lg[history[i + ng - 1]] = -Infinity;
    }
    const praw = softmax(logits), p = softmax(lg, T);
    let kept = null, pick;
    if (m === "greedy") { pick = argmax(lg); kept = new Set([pick]); }
    else {
      const order = topIdx(p, m === "sample" ? 400 : 8000);
      let keep;
      if (m === "sample") keep = null;
      else if (m === "top_k") keep = order.slice(0, slv("sl-k"));
      else if (m === "top_p") { const pv = slv("sl-p"); let c = 0, n = 0; while (n < order.length && c < pv) { c += p[order[n]]; n++; } keep = order.slice(0, n); }
      else { const mp = slv("sl-mp") * p[order[0]]; keep = order.filter(i => p[i] >= mp); }
      if (keep) kept = new Set(keep);
      if (forPaint) return { praw, p, kept, pick: null };
      let mass = 0; const cand = keep || order;
      if (keep) for (const i of keep) mass += p[i]; else mass = 1;
      let r = S.rng() * mass; pick = cand[cand.length - 1];
      if (keep) { for (const i of keep) { r -= p[i]; if (r <= 0) { pick = i; break; } } }
      else { for (let i = 0; i < p.length; i++) { r -= p[i]; if (r <= 0) { pick = i; break; } } }
    }
    return { praw, p, kept, pick };
  }
  function stepOnce() {
    if (!S.state) start();
    const r = rule(S.logits, S.ids, false);
    if (r.pick === TOK.EOS) return false;
    S.ids.push(r.pick); S.probs.push(r.praw[r.pick]);
    S.logits = LSTM.step(r.pick, S.state);
    return S.ids.length < 60;
  }
  function paintOut() {
    const host = $("#gen-out");
    if (!S.state) { host.innerHTML = `<span class="prompt">nothing generated yet</span>`; return; }
    const ptxt = TOK.decode(S.prompt);
    let html = ptxt ? `<span class="prompt">${esc(ptxt)}</span>` : "";
    S.ids.forEach((id, k) => {
      const t = TOK.vocab[id].replace(/▁/g, " "), p = S.probs[k], a = Math.min(1, 0.08 + p) ;
      html += `<span class="t" style="background:color-mix(in srgb, var(--cls-0) ${(a * 70).toFixed(0)}%, transparent)" title="P = ${p.toFixed(4)}">${esc(t)}</span>`;
    });
    host.innerHTML = html || `<span class="prompt">[EOS] immediately</span>`;
    if (S.ids.length) {
      const lp = S.probs.reduce((a, p) => a + Math.log(Math.max(1e-9, p)), 0) / S.probs.length;
      const rep = S.ids.filter((id, i) => S.ids.slice(Math.max(0, i - 20), i).includes(id)).length / S.ids.length;
      const bg = new Set(S.ids.slice(1).map((id, i) => S.ids[i] + "," + id)).size / Math.max(1, S.ids.length - 1);
      $("#gen-stats").innerHTML = `${S.ids.length} tokens · avg log P / token ${lp.toFixed(2)} · repetition ${pct(rep)} · distinct-2 ${pct(bg)}`;
    }
  }
  function paintDist() {
    if (!S.state) return;
    const r = rule(S.logits, S.ids, true), order = topIdx(r.p, 12);
    const H = -r.p.reduce((a, v) => a + (v > 0 ? v * Math.log(v) : 0), 0);
    probBars($("#gen-dist"), order.map(i => ({ label: TOK.vocab[i].replace(/\n/g, "⏎"), p: r.p[i], kept: r.kept ? r.kept.has(i) : true })), { max: r.p[order[0]] });
    $("#gen-dist").insertAdjacentHTML("beforeend", `<div class="footnote" style="margin-top:8px">${r.kept ? `${num(r.kept.size)} of ${num(TOK.vocab.length)} tokens kept · ` : "all 8 000 tokens eligible · "}entropy ${H.toFixed(2)} nats ≈ ${Math.exp(H).toFixed(0)} effective tokens</div>`);
  }
  $("#btn-gen").addEventListener("click", () => {
    const btn = $("#btn-gen"); btn.disabled = true; $("#gen-timing").textContent = "generating …";
    setTimeout(() => {
      const t0 = performance.now(); start();
      while (stepOnce()) { }
      $("#gen-timing").textContent = `${((performance.now() - t0) / 1000).toFixed(2)}s · ${S.ids.length} tokens · ${LSTM.loadMs ? (LSTM.loadMs / 1000).toFixed(1) + "s to load " + (D.lstm.params / 1e6).toFixed(1) + "M weights" : ""}`;
      paintOut(); paintDist(); btn.disabled = false;
    }, 20);
  });
  $("#btn-gen-step").addEventListener("click", () => { if (!S.state) start(); stepOnce(); paintOut(); paintDist(); });
  $("#btn-gen-clear").addEventListener("click", clear);
  syncSliders();

  /* expose for the harness */
  window.__demo = Object.assign(window.__demo || {}, { LSTM, TOK, NG, sampler: S, stepOnce, start, paintOut, paintDist });
})();

/* ================================== 05b temperature + truncation, one distribution */
(function () {
  const PRE = ["Заходит мужик в бар", "Заходит мужик в", "Штирлиц", "Однажды", "Доктор говорит"];
  const KCOL = { k: css("--cls-0"), p: css("--cls-2"), mp: css("--cls-3") };
  let logits = null, curPrompt = null, painted = false;
  $("#dist-presets").innerHTML = PRE.map((p, i) => `<button data-p="${i}" style="font-size:15px;padding:4px 9px">${esc(p)}</button>`).join("");
  $("#dist-presets").addEventListener("click", e => { const b = e.target.closest("button"); if (!b) return; $("#dist-prompt").value = PRE[+b.dataset.p]; paint(); });
  $("#dist-prompt").addEventListener("input", paint);
  const sl = id => $(`#${id} input`), slv = id => +sl(id).value;
  ["T", "k", "p", "mp"].forEach(id => {
    const inp = sl(`dsl-${id}`), lab = $(`#dsl-${id} label b`);
    const show = () => { const v = +inp.value; lab.textContent = id === "T" ? v.toFixed(1) : id === "k" ? v : v.toFixed(2); };
    inp.addEventListener("input", () => { show(); paint(); }); show();
  });
  const tokLabel = i => TOK.vocab[i].replace(/\n/g, "⏎");
  function ensure() {
    const pr = $("#dist-prompt").value;
    if (pr === curPrompt && logits) return;
    LSTM.init(); const st = LSTM.newState();
    logits = LSTM.feed([TOK.BOS].concat(TOK.encode(pr)), st); curPrompt = pr;
  }
  function paint() {
    ensure(); painted = true;
    const T = slv("dsl-T"), p1 = softmax(logits), pT = softmax(logits, T);
    tempChart(p1, pT, T); truncChart(pT, T);
  }
  function tempChart(p1, pT, T) {
    const host = $("#dist-temp-chart"); host.innerHTML = "";
    const N = 25, order = topIdx(p1, N), W = 1000, H = 300, L = 84, R = 16, top = 14, axisY = 200, fs = 13.5;
    const s = svg(W, H), bw = (W - L - R) / N, mx = Math.max(...order.map(i => Math.max(p1[i], pT[i]))) * 1.08;
    const Y = v => axisY - v / mx * (axisY - top);
    const dp = mx < 0.02 ? 4 : mx < 0.2 ? 3 : 2;
    linTicks(0, mx, 4).forEach(v => {
      s.appendChild(el("line", { class: "gridline", x1: L, x2: W - R, y1: Y(v), y2: Y(v), stroke: css("--rule") }));
      s.appendChild(el("text", { x: L - 8, y: Y(v) + 4, "font-size": fs, "text-anchor": "end", fill: css("--ink-3") }, v.toFixed(dp)));
    });
    order.forEach((i, n) => {
      const x = L + n * bw;
      s.appendChild(el("rect", { x: x + 3, y: Y(p1[i]), width: bw - 6, height: axisY - Y(p1[i]), fill: "none", stroke: css("--ink-3"), "stroke-dasharray": "3 3" }));
      const r = el("rect", { x: x + 3, y: Y(pT[i]), width: bw - 6, height: Math.max(0, axisY - Y(pT[i])), fill: css("--cls-0"), opacity: .85 });
      tipOn(r, `<strong>${esc(tokLabel(i))}</strong><br>T = ${T.toFixed(1)}: ${pT[i].toFixed(4)}<br>T = 1: ${p1[i].toFixed(4)}`);
      s.appendChild(r);
      s.appendChild(el("text", { x: x + bw / 2, y: axisY + 12, "font-size": fs, "text-anchor": "end", fill: css("--ink-2"), transform: `rotate(-55 ${x + bw / 2} ${axisY + 12})` }, tokLabel(i)));
    });
    s.appendChild(el("line", { x1: L, x2: W - R, y1: axisY, y2: axisY, stroke: css("--rule-strong") }));
    s.appendChild(el("text", { x: 14, y: (top + axisY) / 2, "font-size": fs, "text-anchor": "middle", fill: css("--ink-2"), transform: `rotate(-90 14 ${(top + axisY) / 2})` }, "P(token | prompt)"));
    host.appendChild(s);
    let Hn = 0, head = 0; for (let i = 0; i < pT.length; i++) if (pT[i] > 0) Hn -= pT[i] * Math.log(pT[i]);
    order.forEach(i => head += pT[i]);
    $("#dist-temp-stats").innerHTML = [[T.toFixed(1), "temperature"], [Hn.toFixed(2) + " nats", "entropy"], [Math.exp(Hn).toFixed(0), "effective tokens"], [pct(head), "mass in the top 25"], [pct(1 - head), "mass in the other " + num(TOK.vocab.length - 25)]]
      .map(([v, k]) => `<div class="stat"><span class="v">${v}</span><span class="k">${k}</span></div>`).join("");
  }
  function truncChart(pT, T) {
    const host = $("#dist-trunc-chart"); host.innerHTML = "";
    const N = 40, all = topIdx(pT, TOK.vocab.length), order = all.slice(0, N);
    const k = slv("dsl-k"), pv = slv("dsl-p"), mp = slv("dsl-mp");
    let cum = 0, nP = 0; for (; nP < all.length && cum < pv; nP++) cum += pT[all[nP]];
    const thr = mp * pT[all[0]]; let nM = 0; for (let i = 0; i < pT.length; i++) if (pT[i] >= thr) nM++;
    const W = 1000, H = 350, L = 196, R = 60, top = 22, axisY = 190, fs = 13.5, bw = (W - L - R) / N;
    const s = svg(W, H), mx = pT[all[0]] * 1.08;
    const Y = v => axisY - v / mx * (axisY - top), Yc = v => axisY - v * (axisY - top);
    const dp = mx < 0.02 ? 4 : mx < 0.2 ? 3 : 2;
    linTicks(0, mx, 4).forEach(v => {
      s.appendChild(el("line", { class: "gridline", x1: L, x2: W - R, y1: Y(v), y2: Y(v), stroke: css("--rule") }));
      s.appendChild(el("text", { x: L - 8, y: Y(v) + 4, "font-size": fs, "text-anchor": "end", fill: css("--ink-3") }, v.toFixed(dp)));
    });
    [0, 0.5, 1].forEach(v => s.appendChild(el("text", { x: W - R + 8, y: Yc(v) + 4, "font-size": fs, fill: KCOL.p }, v.toFixed(1))));
    
    let c = 0; const pts = [];
    order.forEach((i, n) => {
      const x = L + n * bw; c += pT[i]; pts.push(`${(x + bw / 2).toFixed(1)},${Yc(c).toFixed(1)}`);
      const keptAny = n < k || n < nP || pT[i] >= thr;
      const r = el("rect", { x: x + 2, y: Y(pT[i]), width: bw - 4, height: Math.max(0, axisY - Y(pT[i])), fill: keptAny ? css("--ink-2") : css("--rule-strong"), opacity: .9 });
      tipOn(r, `<strong>${esc(tokLabel(i))}</strong> · rank ${n + 1}<br>P = ${pT[i].toFixed(4)} · cumulative ${c.toFixed(3)}<br>top-k ${n < k ? "keeps" : "cuts"} · top-p ${n < nP ? "keeps" : "cuts"} · min-p ${pT[i] >= thr ? "keeps" : "cuts"}`);
      s.appendChild(r);
      s.appendChild(el("text", { x: x + bw / 2, y: axisY + 12, "font-size": fs, "text-anchor": "end", fill: css("--ink-2"), transform: `rotate(-55 ${x + bw / 2} ${axisY + 12})` }, tokLabel(i)));
      [["k", n < k], ["p", n < nP], ["mp", pT[i] >= thr]].forEach(([key, kept], row) => {
        s.appendChild(el("rect", { x: x + 2, y: 272 + row * 20, width: bw - 4, height: 15, rx: 2, fill: kept ? KCOL[key] : css("--panel-sunk"), stroke: kept ? "none" : css("--rule") }));
      });
    });
    s.appendChild(el("line", { x1: L, x2: W - R, y1: axisY, y2: axisY, stroke: css("--rule-strong") }));
    s.appendChild(el("polyline", { points: pts.join(" "), fill: "none", stroke: KCOL.p, "stroke-width": 2, "stroke-dasharray": "5 4" }));
    /* the three rules as three lines */
    const xk = L + Math.min(k, N) * bw;
    s.appendChild(el("line", { x1: xk, x2: xk, y1: top, y2: axisY, stroke: KCOL.k, "stroke-width": 2 }));

    s.appendChild(el("line", { x1: L, x2: W - R, y1: Yc(pv), y2: Yc(pv), stroke: KCOL.p, "stroke-width": 1.2, "stroke-dasharray": "2 3" }));
    if (nP <= N) { const xp = L + nP * bw; s.appendChild(el("line", { x1: xp, x2: xp, y1: top, y2: axisY, stroke: KCOL.p, "stroke-width": 2 })); }
    s.appendChild(el("line", { x1: L, x2: W - R, y1: Y(thr), y2: Y(thr), stroke: KCOL.mp, "stroke-width": 2 }));
    /* legend, one line at the top */
    const legend = [[KCOL.k, `│ top-k = ${k}`], [KCOL.p, `┄ cumulative P, top-p cuts at ${pv.toFixed(2)}`], [KCOL.mp, `— min-p line = ${mp.toFixed(2)} × max = ${thr.toFixed(4)}`]];
    let lx = L + 6; legend.forEach(([col, txt]) => { const t = el("text", { x: lx, y: top - 1, "font-size": 12.5, fill: col }, txt); s.appendChild(t); lx += txt.length * 7.2 + 22; });
    [["top-k", KCOL.k, `keeps ${num(Math.min(k, TOK.vocab.length))}`], ["top-p", KCOL.p, `keeps ${num(nP)}`], ["min-p", KCOL.mp, `keeps ${num(nM)}`]].forEach(([lab, col, cnt], row) => {
      s.appendChild(el("text", { x: L - 8, y: 272 + row * 20 + 12, "font-size": fs, "text-anchor": "end", fill: col }, `${lab} · ${cnt}`));
    });
    host.appendChild(s);
    $("#dist-trunc-stats").innerHTML = [[num(k), `top-k keeps · of ${num(TOK.vocab.length)}`], [num(nP), `top-p = ${pv.toFixed(2)} keeps`], [num(nM), `min-p = ${mp.toFixed(2)} keeps`], [T.toFixed(1), "at temperature"]]
      .map(([v, kk]) => `<div class="stat"><span class="v">${v}</span><span class="k">${kk}</span></div>`).join("");
  }
  function grid() {
    LSTM.init();
    const TS = [0.5, 1, 2], rows = PRE.map(pr => {
      const st = LSTM.newState(), lg = LSTM.feed([TOK.BOS].concat(TOK.encode(pr)), st);
      return { pr, cells: TS.map(T => { const p = softmax(lg, T), all = topIdx(p, p.length); let c = 0, n = 0; for (; n < all.length && c < 0.9; n++) c += p[all[n]];
        const thr = 0.05 * p[all[0]]; let m = 0; for (let i = 0; i < p.length; i++) if (p[i] >= thr) m++; return { max: p[all[0]], nP: n, nM: m }; }) };
    });
    $("#dist-grid").innerHTML = `<thead><tr><th>prompt</th>${TS.map(T => `<th class="num">T = ${T}: max P</th><th class="num">top-p 0.9 keeps</th><th class="num">min-p 0.05 keeps</th>`).join("")}</tr></thead><tbody>` +
      rows.map(r => `<tr><td class="mono">${esc(r.pr)}</td>${r.cells.map(c => `<td class="num">${c.max.toFixed(3)}</td><td class="num" style="color:${KCOL.p}">${num(c.nP)}</td><td class="num" style="color:${KCOL.mp}">${num(c.nM)}</td>`).join("")}</tr>`).join("") + `</tbody>`;
  }
  REDRAW.push(() => { if (painted) paint(); });
  const io = new IntersectionObserver(ents => { if (ents.some(e => e.isIntersecting)) { io.disconnect(); setTimeout(() => { paint(); grid(); }, 30); } }, { rootMargin: "300px" });
  io.observe($("#dist-temp-chart"));
  window.__demo = Object.assign(window.__demo || {}, { dist: { paint } });
})();

/* =============================================================== 06 holtz */
(function () {
  const HZ = D.holtzman;
  let cur = 0, cache = {};
  $("#holtz-picks").innerHTML = HZ.otherJokes.map((_, i) => `<button data-j="${i}" class="${i === 0 ? "pick" : ""}" style="font-size:15px;padding:4px 9px">${i + 1}</button>`).join("");
  $("#holtz-picks").addEventListener("click", e => { const b = e.target.closest("button[data-j]"); if (!b) return; cur = +b.dataset.j; $$("#holtz-picks button").forEach(x => x.classList.toggle("pick", x === b)); paint(); });

  function probsOf(ids) {           /* P(ids[t+1] | ids[..t]) for t = 0.. */
    const st = LSTM.newState(), out = [];
    let lg = LSTM.step(ids[0], st);
    for (let t = 1; t < ids.length; t++) { const p = softmax(lg); out.push(p[ids[t]]); if (t < ids.length - 1) lg = LSTM.step(ids[t], st); }
    return out;
  }
  function compute(j) {
    if (cache[j]) return cache[j];
    LSTM.init();
    const real = [TOK.BOS].concat(TOK.encode(HZ.otherJokes[j]), [TOK.EOS]);
    const pHuman = probsOf(real);
    const g = real.slice(0, 4), st = LSTM.newState();
    let lg = LSTM.feed(g, st);
    for (let k = 0; k < real.length - 4; k++) { const nxt = argmax(lg); g.push(nxt); lg = LSTM.step(nxt, st); }
    const pGreedy = probsOf(g);
    return cache[j] = { pHuman, pGreedy, human: real, greedy: g };
  }
  function paint() {
    const r = compute(cur);
    lineChart($("#holtz-chart"), {
      W: 1000, H: 320, L: 70, fs: 14.5, ymin: 0, ymax: 1.02, xmin: 0, xmax: Math.max(r.pHuman.length, r.pGreedy.length) - 1, yfmt: v => v.toFixed(1),
      series: [
        { x: r.pHuman.map((_, i) => i), y: r.pHuman, color: css("--cls-0"), label: "the actual joke (human text)", r: 3, tip: (x, y) => `position ${x} · ${esc(TOK.vocab[r.human[x + 1]])}<br>P = ${y.toFixed(4)}` },
        { x: r.pGreedy.map((_, i) => i), y: r.pGreedy, color: css("--bad"), label: "the model's greedy continuation", r: 3, tip: (x, y) => `position ${x} · ${esc(TOK.vocab[r.greedy[x + 1]])}<br>P = ${y.toFixed(4)}` },
      ],
      xlabel: "position in the sequence", ylabel: "P assigned to the chosen token", legendX: 560, legendY: 10,
    });
    const paintToks = (ids, ps, host) => {
      host.innerHTML = ids.slice(1).map((id, k) => id === TOK.EOS ? `<span class="t prompt">[EOS]</span>` : `<span class="t" style="background:color-mix(in srgb, var(--cls-0) ${Math.min(70, 6 + ps[k] * 70).toFixed(0)}%, transparent)" title="P = ${ps[k].toFixed(4)}">${esc(TOK.vocab[id].replace(/▁/g, " "))}</span>`).join("");
    };
    paintToks(r.human, r.pHuman, $("#holtz-human"));
    paintToks(r.greedy, r.pGreedy, $("#holtz-greedy"));
  }
  REDRAW.push(() => { if (Object.keys(cache).length) paint(); });
  /* draw lazily: the LSTM decode takes a moment, and the section is far down the page */
  const io = new IntersectionObserver(ents => { if (ents.some(e => e.isIntersecting)) { io.disconnect(); setTimeout(paint, 30); } }, { rootMargin: "300px" });
  io.observe($("#holtz"));
  window.__demo = Object.assign(window.__demo || {}, { holtz: { compute, paint } });

  /* the table */
  const DT = D.decodeTable;
  $("#decode-table").innerHTML = `<thead><tr><th>method</th><th class="num">repetition</th><th class="num">distinct-2</th><th class="num">avg logprob / token</th></tr></thead><tbody>` +
    DT.rows.map(r => `<tr><td class="mono">${esc(r.method)}</td><td class="num" style="${r.repetition > 0.5 ? "color:var(--bad)" : ""}">${pct(r.repetition, 1)}</td><td class="num">${pct(r.distinct2, 1)}</td><td class="num">${r.logprob.toFixed(2)}</td></tr>`).join("") + `</tbody>`;

  const PN = D.decodeSamples.penalty;
  $("#penalty-out").innerHTML = `<div><div class="eyebrow" style="margin-bottom:4px">greedy, unpatched</div><div class="gen">${esc(PN.plain)}</div></div>
    <div><div class="eyebrow" style="margin-bottom:4px">greedy + repetition penalty 1.3 + no-repeat-3-gram</div><div class="gen">${esc(PN.patched)}</div></div>`;
  if (D.gpt2) $("#gpt2-out").innerHTML = D.gpt2.outputs.map(o => `<div><div class="eyebrow" style="margin-bottom:4px">${esc(o.tag)}</div><div class="gen" style="white-space:pre-wrap">${esc(o.text)}</div></div>`).join("") +
    `<div class="footnote">${esc(D.gpt2.model)} · 40 new tokens · from the notebook's run</div>`;
  else $("#gpt2-out").innerHTML = `<div class="footnote">${TXT("gpt2-missing")}</div>`;
})();

/* ================================================================= 07 s2s */
(function () {
  function diagram() {
    const host = $("#s2s-diagram"); host.innerHTML = "";
    const W = 1000, H = 260, fs = 14.5, s = svg(W, H);
    const defs = el("defs", {}); const m = el("marker", { id: "arr2", viewBox: "0 0 10 10", refX: 9, refY: 5, markerWidth: 7, markerHeight: 7, orient: "auto-start-reverse" });
    m.appendChild(el("path", { d: "M 0 0 L 10 5 L 0 10 z", fill: css("--ink-2") })); defs.appendChild(m); s.appendChild(defs);
    const arrow = (x1, y1, x2, y2, color, w) => s.appendChild(el("line", { x1, y1, x2, y2, stroke: color || css("--ink-2"), "stroke-width": w || 1.6, "marker-end": "url(#arr2)" }));
    const src = ["Ein", "Mädchen", "klettert", "…"], trg = ["[BOS]", "A", "girl", "climbs"], nxt = ["A", "girl", "climbs", "into"];
    const bw = 84, bh = 44, yb = 108, step = 100, x0 = 40;
    src.forEach((t, i) => {
      const x = x0 + i * step, cx = x + bw / 2;
      s.appendChild(el("rect", { x, y: yb, width: bw, height: bh, rx: 6, fill: css("--panel-sunk"), stroke: css("--cls-0"), "stroke-width": 1.6 }));
      s.appendChild(el("text", { x: cx, y: yb + bh / 2 + 5, "font-size": fs, "text-anchor": "middle", fill: css("--ink") }, "enc"));
      s.appendChild(el("text", { x: cx, y: H - 44, "font-size": fs, "text-anchor": "middle", fill: css("--ink") }, t));
      arrow(cx, H - 60, cx, yb + bh + 2);
      if (i) arrow(x - step + bw + 2, yb + bh / 2, x - 2, yb + bh / 2);
    });
    const bx = x0 + src.length * step + 10;
    s.appendChild(el("rect", { x: bx, y: yb - 8, width: 64, height: bh + 16, rx: 6, fill: "color-mix(in srgb, var(--bad) 14%, var(--panel))", stroke: css("--bad"), "stroke-width": 2.2 }));
    s.appendChild(el("text", { x: bx + 32, y: yb + bh / 2 + 6, "font-size": 18, "text-anchor": "middle", fill: css("--bad"), "font-weight": "700" }, "c"));
    s.appendChild(el("text", { x: bx + 32, y: yb - 20, "font-size": 13, "text-anchor": "middle", fill: css("--bad") }, "the bottleneck: one vector"));
    arrow(bx - step + x0 - x0 + (src.length - 1) * step + x0 + bw + 2 - x0 + 0, yb + bh / 2, bx - 2, yb + bh / 2);
    const dx0 = bx + 64 + 24;
    trg.forEach((t, i) => {
      const x = dx0 + i * step, cx = x + bw / 2;
      s.appendChild(el("rect", { x, y: yb, width: bw, height: bh, rx: 6, fill: css("--panel-sunk"), stroke: css("--cls-2"), "stroke-width": 1.6 }));
      s.appendChild(el("text", { x: cx, y: yb + bh / 2 + 5, "font-size": fs, "text-anchor": "middle", fill: css("--ink") }, "dec"));
      s.appendChild(el("text", { x: cx, y: H - 44, "font-size": fs, "text-anchor": "middle", fill: css("--ink") }, t));
      arrow(cx, H - 60, cx, yb + bh + 2);
      s.appendChild(el("text", { x: cx, y: 40, "font-size": fs, "text-anchor": "middle", fill: css("--cls-2") }, nxt[i]));
      arrow(cx, yb - 2, cx, 48, css("--cls-2"));
      if (i) arrow(x - step + bw + 2, yb + bh / 2, x - 2, yb + bh / 2);
      else arrow(bx + 66, yb + bh / 2, x - 2, yb + bh / 2, css("--bad"), 2.2);
    });
    s.appendChild(el("text", { x: x0 + 2 * step, y: H - 12, "font-size": fs, "text-anchor": "middle", fill: css("--cls-0") }, "ENCODER · reads German, both directions"));
    s.appendChild(el("text", { x: dx0 + 2 * step, y: H - 12, "font-size": fs, "text-anchor": "middle", fill: css("--cls-2") }, "DECODER · writes English, one token at a time"));
    host.appendChild(s);
  }
  REDRAW.push(diagram); diagram();

  const C = D.s2sCurves;
  $("#s2s-train-stats").textContent = `${(C.n_params / 1e6).toFixed(1)}M params · ${C.config.epochs} epochs · test BLEU ${C.test_bleu}`;
  function curves() {
    lineChart($("#s2s-loss-chart"), {
      W: 500, H: 280, L: 60, B: 48, fs: 13.5, xticks: C.epoch, xmin: 0.8, xmax: C.epoch.length + .2,
      series: [{ x: C.epoch, y: C.train_loss, color: css("--cls-0"), label: "train cross-entropy" }, { x: C.epoch, y: C.val_loss, color: css("--cls-1"), label: "validation", dash: true }],
      xlabel: "epoch", ylabel: "cross-entropy loss", legendX: 250, legendY: 10,
    });
    lineChart($("#s2s-bleu-chart"), {
      W: 500, H: 280, L: 60, B: 48, fs: 13.5, xticks: C.epoch, xmin: 0.8, xmax: C.epoch.length + .2, ymin: 0,
      series: [{ x: C.epoch, y: C.val_bleu, color: css("--cls-2"), label: "validation BLEU", tip: (x, y) => `epoch ${x}<br>BLEU ${y}` }],
      xlabel: "epoch", ylabel: "BLEU", legendX: 250, legendY: 10,
    });
  }
  REDRAW.push(curves); curves();

  /* browse the test set */
  const TR = D.translations, BUCKETS = [["all", 0, 999], ["≤ 10", 0, 10], ["11–15", 11, 15], ["16–20", 16, 20], ["21–25", 21, 25], ["26+", 26, 999]];
  let bucket = 0, shown = D.s2sBleu.shown.slice();
  $("#tr-buckets").innerHTML = BUCKETS.map((b, i) => `<button data-b="${i}" class="${i === 0 ? "pick" : ""}" style="font-size:15px;padding:4px 9px">${b[0]}</button>`).join("");
  $("#tr-buckets").addEventListener("click", e => { const b = e.target.closest("button[data-b]"); if (!b) return; bucket = +b.dataset.b; $$("#tr-buckets button").forEach(x => x.classList.toggle("pick", x === b)); random(); });
  function inBucket(i) { const b = BUCKETS[bucket]; return TR[i].srcLen >= b[1] && TR[i].srcLen <= b[2]; }
  function random() {
    const pool = TR.map((_, i) => i).filter(inBucket), out = [];
    while (out.length < 3 && pool.length) { const k = Math.floor(Math.random() * pool.length); out.push(pool.splice(k, 1)[0]); }
    shown = out; paint();
  }
  function paint() {
    const pool = TR.filter((_, i) => inBucket(i));
    const mean = k => pool.reduce((a, t) => a + t[k], 0) / Math.max(1, pool.length);
    $("#tr-out").innerHTML = `<div class="footnote" style="margin-bottom:10px">${num(pool.length)} sentences in this bucket · mean sentence BLEU: greedy ${mean("bleuG").toFixed(1)}, beam-5 ${mean("bleuB").toFixed(1)} · corpus BLEU on all 1 000: greedy ${D.s2sBleu.greedy.toFixed(2)}, beam-5 ${D.s2sBleu.beam5.toFixed(2)}</div>` +
      shown.map(i => { const t = TR[i]; return `<div style="padding:10px 0;border-bottom:1px solid var(--rule)">
        <div class="tr-row"><span class="k">DE · ${t.srcLen} tok</span><span>${esc(t.de)}</span></div>
        <div class="tr-row"><span class="k">ref</span><span>${esc(t.ref)}</span></div>
        <div class="tr-row"><span class="k">greedy</span><span>${esc(t.greedy)}<span class="bleu">BLEU ${t.bleuG}</span></span></div>
        <div class="tr-row"><span class="k">beam-5</span><span>${esc(t.beam)}<span class="bleu">BLEU ${t.bleuB}</span></span></div></div>`; }).join("");
  }
  $("#btn-tr-random").addEventListener("click", random);
  paint();
})();

/* ========================================================== 08 bottleneck */
(function () {
  const SW = D.s2sSweep, widths = ["64", "128", "256"], WCOL = { "64": "var(--cls-1)", "128": "var(--cls-3)", "256": "var(--cls-0)" };
  const b256 = Object.values(SW["256"].bleu_by_src_len), drop = b256[0] - b256[b256.length - 1];
  const betLen = makeBet("#bet-len", ["falls by more than half", "falls a little", "stays flat", "rises"], drop > b256[0] / 2 ? 0 : drop > 1 ? 1 : drop > -1 ? 2 : 3);
  const slope = w => { const v = Object.values(SW[w].bleu_by_src_len); return Math.max(...v) - Math.min(...v); };
  const flattest = widths.reduce((a, b) => slope(a) <= slope(b) ? a : b);
  const betFlat = makeBet("#bet-flat", ["hidden = 64", "hidden = 128", "hidden = 256"], widths.indexOf(flattest));
  function lenChart() {
    const keys = Object.keys(SW["256"].bleu_by_src_len), xs = keys.map((_, i) => i), labels = {}; keys.forEach((k, i) => labels[i] = k);
    lineChart($("#bleu-len-chart"), {
      W: 1000, H: 340, L: 70, fs: 14.5, xticks: xs, xlabels: labels, xmin: -0.2, xmax: keys.length - .8, ymin: 0, ymax: 22,
      series: widths.filter(w => SW[w]).map(w => ({ x: xs, y: Object.values(SW[w].bleu_by_src_len), color: WCOL[w], label: `hidden = ${w} · ${(SW[w].n_params / 1e6).toFixed(1)}M · overall BLEU ${SW[w].test_bleu}`, tip: (x, y) => `hidden ${w} · source length ${keys[x]}<br>BLEU ${y}` })),
      xlabel: "source length (BPE tokens)", ylabel: "BLEU", legendX: 560, legendY: 10,
    });
  }
  $("#btn-len-reveal").addEventListener("click", () => {
    betLen.reveal(); betFlat.reveal(); $("#len-out").hidden = false; $("#len-note").hidden = false;
    lenChart(); REDRAW.push(lenChart);
  });

  /* PCA */
  const PC = D.pca;
  $("#pca-stats").textContent = `PC1 ${pct(PC.explained[0])} · PC2 ${pct(PC.explained[1])} of variance`;
  function pca() {
    const host = $("#pca-chart"); host.innerHTML = "";
    const W = 500, H = 340, L = 44, R = 100, T = 14, B = 44, fs = 13, s = svg(W, H);
    const xs = PC.xy.map(p => p[0]), ys = PC.xy.map(p => p[1]);
    const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
    const X = v => L + (v - x0) / (x1 - x0) * (W - L - R), Y = v => H - B - (v - y0) / (y1 - y0) * (H - T - B);
    const lmin = Math.min(...PC.len), lmax = Math.max(...PC.len);
    const col = l => { const t = (l - lmin) / (lmax - lmin); return `color-mix(in srgb, var(--cls-2) ${(100 * (1 - t)).toFixed(0)}%, var(--cls-3))`; };
    PC.xy.forEach((p, i) => { const c = el("circle", { cx: X(p[0]), cy: Y(p[1]), r: 3.4, fill: col(PC.len[i]), opacity: .85 }); tipOn(c, `source length ${PC.len[i]} tokens<br>PC1 ${p[0]}, PC2 ${p[1]}`); s.appendChild(c); });
    s.appendChild(el("line", { x1: L, x2: W - R, y1: H - B, y2: H - B, stroke: css("--rule-strong") }));
    s.appendChild(el("line", { x1: L, x2: L, y1: T, y2: H - B, stroke: css("--rule-strong") }));
    s.appendChild(el("text", { x: (L + W - R) / 2, y: H - 8, "font-size": fs, "text-anchor": "middle", fill: css("--ink-2") }, "PC 1"));
    s.appendChild(el("text", { x: 14, y: (T + H - B) / 2, "font-size": fs, "text-anchor": "middle", fill: css("--ink-2"), transform: `rotate(-90 14 ${(T + H - B) / 2})` }, "PC 2"));
    /* legend: a vertical ramp */
    const lx = W - R + 22, ly0 = T + 10, lh = 150;
    for (let i = 0; i < 30; i++) s.appendChild(el("rect", { x: lx, y: ly0 + i * lh / 30, width: 12, height: lh / 30 + .5, fill: col(lmax - (lmax - lmin) * i / 30) }));
    s.appendChild(el("text", { x: lx + 16, y: ly0 + 10, "font-size": fs - 1, fill: css("--ink-3") }, `${lmax} tok`));
    s.appendChild(el("text", { x: lx + 16, y: ly0 + lh, "font-size": fs - 1, fill: css("--ink-3") }, `${lmin} tok`));
    s.appendChild(el("text", { x: lx + 6, y: ly0 + lh + 22, "font-size": fs - 1, "text-anchor": "middle", fill: css("--ink-3") }, "source"));
    s.appendChild(el("text", { x: lx + 6, y: ly0 + lh + 38, "font-size": fs - 1, "text-anchor": "middle", fill: css("--ink-3") }, "length"));
    host.appendChild(s);
  }
  REDRAW.push(pca); pca();

  /* beam */
  const BT = D.beamTable, bl = BT.rows.map(r => r.bleu);
  const betBeam = makeBet("#bet-beam", ["climbs", "stays flat", "falls"], bl[2] > bl[0] + 0.3 ? 0 : bl[2] < bl[0] - 0.3 ? 2 : 1);
  $("#btn-beam-reveal").addEventListener("click", () => {
    betBeam.reveal(); $("#beam-out").hidden = false; $("#beam-note").hidden = false;
    $("#beam-out").innerHTML = `<div class="scroll-x"><table><thead><tr><th>beam width</th><th class="num">BLEU · first ${BT.n}</th><th class="num">seconds</th></tr></thead><tbody>` +
      BT.rows.map(r => `<tr><td class="mono">${r.beam}${r.beam === 1 ? " (greedy)" : ""}</td><td class="num">${fmt(r.bleu, 2)}</td><td class="num">${r.seconds}</td></tr>`).join("") +
      `</tbody></table></div><div class="footnote" style="margin-top:10px">${TXT("beam-all", { greedy: D.s2sBleu.greedy.toFixed(2), beam5: D.s2sBleu.beam5.toFixed(2) })}</div>`;
  });
})();

/* =============================================================== 09 table */
(function () {
  const R = D.results;
  $("#table-rows").innerHTML = `<thead><tr><th>model</th><th>tokens</th><th class="num">test_ppl</th><th class="num">bits/char</th><th class="num">params</th><th class="num">train s</th><th>note</th></tr></thead><tbody>` +
    R.map(r => `<tr><td class="mono">${esc(r.model)}</td><td class="mono" style="color:var(--ink-2)">${esc(r.tokens)}</td><td class="num">${fmt(r.ppl, 1)}</td><td class="num">${fmt(r.bpc, 3)}</td><td class="num">${esc(r.params)}</td><td class="num">${r.trainS == null ? "—" : r.trainS}</td><td style="color:var(--ink-2)">${esc(r.note)}</td></tr>`).join("") + `</tbody>`;
  function chart() {
    const host = $("#table-chart"); host.innerHTML = "";
    const rows = R.filter(r => r.tokens === "BPE 8k"), W = 1000, rowH = 30, H = 40 + rows.length * rowH + 30, L = 300, Rp = 70, fs = 14.5;
    const s = svg(W, H), lo = 0, hi = Math.max(...rows.map(r => r.ppl)) * 1.08;
    const x = v => L + (v - lo) / (hi - lo) * (W - L - Rp), best = Math.min(...rows.map(r => r.ppl));
    linTicks(lo, hi, 5).forEach(v => {
      s.appendChild(el("line", { class: "gridline", x1: x(v), x2: x(v), y1: 18, y2: H - 26, stroke: css("--rule") }));
      s.appendChild(el("text", { x: x(v), y: H - 8, "font-size": fs, "text-anchor": "middle", fill: css("--ink-3") }, tickFmt(v)));
    });
    s.appendChild(el("text", { x: L, y: 14, "font-size": 13, fill: css("--ink-3") }, "test perplexity · BPE 8k rows only — the comparable ones"));
    rows.forEach((r, i) => {
      const y = 40 + i * rowH, cx = x(r.ppl);
      s.appendChild(el("text", { x: L - 12, y: y + 5, "font-size": fs, "text-anchor": "end", fill: css("--ink-2") }, r.model));
      const g = el("g", {});
      g.appendChild(el("line", { x1: L, x2: cx, y1: y, y2: y, stroke: css("--rule"), "stroke-width": 1.5 }));
      g.appendChild(el("circle", { cx, cy: y, r: r.ppl === best ? 7 : 5.5, fill: r.ppl === best ? css("--ink") : css("--panel"), stroke: css("--ink"), "stroke-width": 2 }));
      const lab = `${fmt(r.ppl, 1)} · ${fmt(r.bpc, 3)} bits/char`, right = cx > W - 250;
      g.appendChild(el("text", { x: right ? cx - 12 : cx + 12, y: y + 5, "font-size": fs, "text-anchor": right ? "end" : "start", fill: css("--ink-2") }, lab));
      tipOn(g, `<strong>${esc(r.model)}</strong><br>ppl ${fmt(r.ppl, 1)} · ${fmt(r.bpc, 3)} bits/char<br>${esc(r.params)}${r.trainS ? " · " + r.trainS + " s" : ""}`);
      s.appendChild(g);
    });
    host.appendChild(s);
  }
  REDRAW.push(chart); chart();
})();
