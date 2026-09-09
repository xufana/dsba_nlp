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
