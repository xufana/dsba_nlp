"use strict";
/* week 8 — the interactive part. demo_base/base.js (TXT) is prepended at build; the data is in #demo-data. */
const D = JSON.parse(document.getElementById("demo-data").textContent);

/* --------------------------------------------------------------- helpers (week 6) */
const $ = (s, r) => (r || document).querySelector(s);
const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const NS = "http://www.w3.org/2000/svg";
function svg(w, h) { const s = document.createElementNS(NS, "svg"); s.setAttribute("viewBox", `0 0 ${w} ${h}`); s.setAttribute("width", "100%"); s.style.maxWidth = w + "px"; return s; }
const PAINT = { fill: 1, stroke: 1 };
function el(tag, attrs, text) {
  const n = document.createElementNS(NS, tag); let style = "";
  for (const k in attrs) { const v = attrs[k]; if (PAINT[k] && typeof v === "string" && v.startsWith("var(")) style += `${k}:${v};`; else if (PAINT[k] && typeof v === "string" && v.startsWith("color-mix(")) style += `${k}:${v};`; else n.setAttribute(k, v); }
  if (style) n.setAttribute("style", style); if (text != null) n.textContent = text; return n;
}
const TIP = $("#tip");
function tipOn(node, html) {
  node.addEventListener("pointerenter", e => { TIP.innerHTML = typeof html === "function" ? html() : html; TIP.style.opacity = "1"; moveTip(e); });
  node.addEventListener("pointermove", moveTip); node.addEventListener("pointerleave", () => { TIP.style.opacity = "0"; });
}
function moveTip(e) { const pad = 14, r = TIP.getBoundingClientRect(); let x = e.clientX + pad, y = e.clientY + pad; if (x + r.width > innerWidth - 8) x = e.clientX - r.width - pad; if (y + r.height > innerHeight - 8) y = e.clientY - r.height - pad; TIP.style.left = x + "px"; TIP.style.top = y + "px"; }
const css = name => `var(${name})`;
const TINT = (v, pct) => `color-mix(in srgb, var(${v}) ${pct}%, var(--panel))`;
function txt(s, x, y, t, o) { o = o || {}; return s.appendChild(el("text", { x, y, "font-size": o.fs || 13.5, "text-anchor": o.anchor || "middle", fill: o.color || css("--ink-2"), "font-weight": o.bold ? "600" : "400", "font-style": o.italic ? "italic" : "normal", "font-family": o.mono ? "var(--mono)" : "var(--body)" }, t)); }
function rect(s, x, y, w, h, o) { o = o || {}; return s.appendChild(el("rect", { x, y, width: Math.max(0, w), height: Math.max(0, h), rx: o.rx == null ? 3 : o.rx, fill: o.fill || "none", stroke: o.stroke || "none", "stroke-width": o.sw || 1.2, "stroke-dasharray": o.dash ? "4 4" : "none", opacity: o.op == null ? 1 : o.op })); }
function line(s, x1, y1, x2, y2, o) { o = o || {}; return s.appendChild(el("line", { x1, y1, x2, y2, stroke: o.color || css("--rule"), "stroke-width": o.sw || 1, "stroke-dasharray": o.dash ? "4 4" : "none" })); }
function arrow(s, x1, y1, x2, y2, o) { o = o || {}; const color = o.color || css("--ink-2"), id = "arr-" + String(color).replace(/[^a-z0-9]/gi, "");
  if (!s.querySelector("#" + id)) { let defs = s.querySelector("defs"); if (!defs) { defs = el("defs", {}); s.insertBefore(defs, s.firstChild); } const m = el("marker", { id, viewBox: "0 0 10 10", refX: 9, refY: 5, markerWidth: 6, markerHeight: 6, orient: "auto-start-reverse" }); m.appendChild(el("path", { d: "M 0 0 L 10 5 L 0 10 z", fill: color })); defs.appendChild(m); }
  return s.appendChild(el("path", { d: o.d || `M ${x1} ${y1} L ${x2} ${y2}`, fill: "none", stroke: color, "stroke-width": o.sw || 1.6, "stroke-dasharray": o.dash ? "4 4" : "none", opacity: o.op == null ? 1 : o.op, "marker-end": o.noHead ? "none" : `url(#${id})` })); }
const pct = (x, d) => (100 * x).toFixed(d == null ? 0 : d);
const num = x => Number(x).toLocaleString("en-US");
const sig = x => 1 / (1 + Math.exp(-x));
const stat = (v, k) => `<div class="stat"><span class="v">${v}</span><span class="k">${k}</span></div>`;

/* a tiny chart: axes, ticks, lines; returns the scales */
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
    s.appendChild(el("polyline", { points: pts.join(" "), fill: "none", stroke: sr.color, "stroke-width": sr.sw || 2.4, "stroke-dasharray": sr.dash ? "6 5" : "none", opacity: sr.op == null ? 1 : sr.op }));
    if (sr.dots) sr.pts.forEach(p => s.appendChild(el("circle", { cx: X(p[0]), cy: Y(p[1]), r: 3.4, fill: sr.color, opacity: sr.op == null ? 1 : sr.op })));
  });
  host.innerHTML = ""; host.appendChild(s); return { s, X, Y, W, H, L, R, T, B };
}

/* bets and reveals (week 6) */
function makeBet(host, options, answer) {
  const h = typeof host === "string" ? $(host) : host;
  h.insertAdjacentHTML("beforeend", options.map((o, i) => `<button data-opt="${i}">${esc(o)}</button>`).join("") + `<span class="verdict"></span>`);
  const st = { pick: null, revealed: false, answer };
  h.addEventListener("click", e => { const b = e.target.closest("button[data-opt]"); if (!b || st.revealed) return; st.pick = +b.dataset.opt; $$("button[data-opt]", h).forEach(x => x.classList.toggle("pick", x === b)); });
  st.reveal = () => { st.revealed = true; const v = $(".verdict", h);
    $$("button[data-opt]", h).forEach(x => { const i = +x.dataset.opt; x.classList.toggle("right", i === st.answer); x.classList.toggle("wrong", i === st.pick && i !== st.answer); });
    if (st.pick === null) { v.textContent = "no bet placed"; v.className = "verdict"; } else if (st.pick === st.answer) { v.textContent = "you were right"; v.className = "verdict ok"; } else { v.textContent = "not this time"; v.className = "verdict no"; }
    return st.pick === st.answer; };
  return st;
}
function reveal(btnId, outIds, noteId, bets, after) {
  $("#" + btnId).addEventListener("click", e => { (bets || []).forEach(b => b.reveal()); outIds.forEach(id => { const n = $("#" + id); if (n) n.hidden = false; }); if (noteId) $("#" + noteId).hidden = false;
    const veil = e.target.closest(".panel").querySelector(".veil"); if (veil) veil.remove(); e.target.disabled = true; e.target.textContent = "revealed";
    if (after) after(); });
}
/* a row of state buttons; `items` = [[key, label]] fills an empty host */
function states(id, items, on) {
  const h = $("#" + id);
  if (items) h.innerHTML = items.map(([k, l], i) => `<button data-m="${esc(k)}"${i === 0 ? ' class="sel"' : ""}>${l}</button>`).join("");
  let mode = $("button.sel", h).dataset.m;
  h.addEventListener("click", e => { const b = e.target.closest("button[data-m]"); if (!b) return; mode = b.dataset.m; $$("button", h).forEach(x => x.classList.toggle("sel", x === b)); on(mode); });
  return () => mode;
}

/* in-browser code checked against Python: the result goes next to the panel and into the rail */
const CHECKS = [];
function check(id, ok, text) {
  const h = $("#" + id); if (h) h.innerHTML = `<b class="${ok ? "" : "no"}">${ok ? "✓" : "✗"}</b> ${esc(text)}`;
  CHECKS.push({ id: id.replace(/-check$/, ""), ok });            // read by scripts/check_demo.js; the page shows the result in the panel only
}
const close = (a, b, tol) => Math.abs(a - b) <= (tol == null ? 1e-3 : tol);

/* code ↔ picture: hover any [data-f] and every element sharing a token lights up (week 3) */
function linkCodeAndFormulas() {
  const all = $$("[data-f]"); const toks = n => (n.dataset.f || "").split(/\s+/).filter(Boolean);
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

/* every block below the first screen is queued: one per task, so the page paints first; window.READY when all ran */
const LATER = [];
const later = f => LATER.push(f);
const runLater = () => { const next = () => { const f = LATER.shift(); if (!f) { window.READY = true; return; } try { f(); performance.mark("x:" + f.name); } catch (e) { console.error(e); } setTimeout(next, 0); }; setTimeout(next, 0); };

/* ------------------------------------------------------------------ nav, theme, presentation */
const SECTIONS = [["hero", "The claim", null], ["sft", "Supervised fine-tuning", "01"], ["pref", "Preferences", "02"], ["rlvr", "RL with a verifier", "03"], ["recipes", "Recipes", "04"], ["end", "Where this goes", "05"]];
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

/* ====================================================== the claim: whose tokens are in the sum, who sets w_t */
performance.mark("x:stages");
(function stages() {
  // one prompt for the last three rows, so the rows differ only in what is summed and with which weight
  const PROMPT = ["What", "is", "17", "×", "3", "?"];
  const ROWS = [
    { stage: "pretraining", sub: "+ mid-training", data: "the web, code, books, maths", size: "trillions of tokens", from: ["nobody", "w = 1"],
      strips: [{ toks: ["Paris", "is", "the", "capital", "of", "France", ".", "It", "is"], w: "1" }] },
    { stage: "SFT", sub: "supervised fine-tuning", data: "(prompt, written answer)", size: "hundreds of thousands of dialogues", from: ["nobody", "w = 1 on the answer"],
      strips: [{ prompt: 1, toks: ["17", "×", "3", "=", "51", "."], w: "1", tag: "written answer" }] },
    { stage: "DPO", sub: "preference tuning", data: "(prompt, better, worse)", size: "378k pairs", from: ["a comparison", "up for one, down for the other"],
      strips: [{ prompt: 1, toks: ["17", "×", "3", "=", "51", "."], w: "+", tag: "better" }, { prompt: 1, toks: ["It", "is", "41", "."], w: "−", tag: "worse" }] },
    { stage: "RLVR", sub: "RL, verifiable rewards", data: "(prompt, a checker)", size: "thousands of problems × many samples", from: ["the checker", "right or wrong"],
      strips: [{ prompt: 1, toks: ["51"], w: "+", tag: "✓", own: 1 }, { prompt: 1, toks: ["3", "×", "17", "=", "51"], w: "+", tag: "✓", own: 1 }, { prompt: 1, toks: ["17", "×", "3", "=", "41"], w: "−", tag: "✗", own: 1 }] },
  ];
  const COL = { "1": "--cls-0", "+": "--good", "−": "--bad" };
  const TIPS = { "1": "in the sum, w<sub>t</sub> = 1", "+": "in the sum, w<sub>t</sub> &gt; 0: its probability is pushed up", "−": "in the sum, w<sub>t</sub> &lt; 0: its probability is pushed down" };
  const TW = t => Math.max(20, t.length * 7.6 + 10);           // token box width, mono 12.5
  function draw() {
    const host = $("#fig-stages"); host.innerHTML = "";
    const W = 940, X0 = 290, XR = 722, SH = 44, GAP = 22, HEAD = 34;
    const H = HEAD + ROWS.reduce((a, r) => a + Math.max(66, r.strips.length * SH + 8) + GAP, 0) + 14;
    const s = svg(W, H);
    txt(s, 16, 20, "stage · the data · size (OLMo 2 1B)", { anchor: "start", fs: 12, color: css("--ink-3") });
    txt(s, X0, 20, "tokens in the sum", { anchor: "start", fs: 12, color: css("--ink-3") });
    txt(s, XR + 12, 20, "wₜ comes from", { anchor: "start", fs: 12, color: css("--ink-3") });
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
          tipOn(b, "the prompt: read, not in the sum");
          txt(s, x + (w - 3) / 2, ty + 15.5, t, { fs: 12.5, mono: 1, color: css("--ink-3") }); x += w; });
        if (st.prompt) x += 8;
        const c = COL[st.w];
        st.toks.forEach(t => { const w = TW(t);
          const b = s.appendChild(el("rect", { x, y: ty, width: w - 3, height: 22, rx: 3, fill: TINT(c, st.own ? 30 : 16), stroke: css(c), "stroke-width": 1.3 }));
          tipOn(b, TIPS[st.w] + (st.own ? "<br>sampled from the model itself" : ""));
          txt(s, x + (w - 3) / 2, ty + 15.5, t, { fs: 12.5, mono: 1, color: css("--ink") });
          txt(s, x + (w - 3) / 2, ty + 35, st.w === "1" ? "1" : st.w === "+" ? "↑" : "↓", { fs: 11, mono: 1, bold: st.w !== "1", color: st.w === "1" ? css("--ink-3") : css(c) });
          x += w; });
        if (st.own && si === 0) txt(s, x + 30, ty + 15.5, "← the model's own samples", { anchor: "start", fs: 12, italic: 1, color: css("--ink-2") });
        if (st.tag) txt(s, x + 8, ty + 15.5, st.tag, { anchor: "start", fs: st.tag.length === 1 ? 15 : 12, bold: st.tag.length === 1, color: st.tag.length === 1 ? css(c) : css("--ink-2"), italic: st.tag.length > 1 });
      });
      if (r.strips[0].prompt && ri === 1) txt(s, X0, y + SH + 14, "the prompt is read, not summed", { anchor: "start", fs: 11.5, italic: 1, color: css("--ink-3") });
      txt(s, XR + 12, y + 16, r.from[0], { anchor: "start", fs: 14, bold: 1, color: css("--ink") });
      txt(s, XR + 12, y + 33, r.from[1].length > 22 ? r.from[1].split(", ")[0] + "," : r.from[1], { anchor: "start", fs: 12, color: css("--ink-2") });
      if (r.from[1].length > 22) txt(s, XR + 12, y + 49, r.from[1].split(", ").slice(1).join(", "), { anchor: "start", fs: 12, color: css("--ink-2") });
      y += rh + GAP;
    });
    txt(s, X0, H - 8, "↑ / ↓  the weight pushes that token's probability up / down", { anchor: "start", fs: 11.5, italic: 1, color: css("--ink-3") });
    host.appendChild(s);
  }
  draw(); REDRAW.push(draw);
})();

/* ============================================== where the loss comes from and where the gradient goes */
/* node kinds: data · train (gets ∇) · frozen (no ∇) · prog (a program, not differentiable) · const (a number the loss treats as constant) · loss */
const FLOW_K = {
  data:   { fill: () => css("--panel-sunk"), stroke: () => css("--rule-strong"), tag: "" },
  train:  { fill: () => TINT("--cls-0", 20), stroke: () => css("--cls-0"), tag: "∇ · trained" },
  frozen: { fill: () => css("--panel"), stroke: () => css("--ink-3"), tag: "frozen · no ∇", dash: 1 },
  prog:   { fill: () => TINT("--cls-2", 16), stroke: () => css("--cls-2"), tag: "program · no ∇" },
  const:  { fill: () => css("--panel-sunk"), stroke: () => css("--rule-strong"), tag: "constant", dash: 1 },
  loss:   { fill: () => TINT("--bad", 14), stroke: () => css("--bad"), tag: "the loss" },
};
function flowFig(key, spec) {
  let mode = "fwd";
  const N = {}; spec.nodes.forEach(n => { N[n.id] = n; });
  const port = (n, side) => side === "r" ? [n.x + n.w, n.y + n.h / 2] : side === "l" ? [n.x, n.y + n.h / 2] : side === "t" ? [n.x + n.w / 2, n.y] : [n.x + n.w / 2, n.y + n.h];
  function draw() {
    const s = svg(940, spec.h), bwd = mode === "bwd";
    // forward edges
    spec.fwd.forEach(e => { const [x1, y1] = port(N[e.a], e.as || "r"), [x2, y2] = port(N[e.b], e.bs || "l");
      arrow(s, x1, y1, x2 - (e.bs === "t" || e.bs === "b" ? 0 : 2), y2, { color: css("--ink-3"), sw: 1.5, op: bwd ? 0.3 : 1 });
      if (e.stop) { const mx = (x1 + x2) / 2, my = (y1 + y2) / 2;
        txt(s, mx, my + 5, "✕", { fs: 15, bold: 1, color: css("--bad") });
        if (e.stop !== true) txt(s, mx + (e.lx || 0), my + (e.ly || -10), e.stop, { fs: 10.5, italic: 1, color: css("--bad") }); }
      if (e.t) txt(s, (x1 + x2) / 2 + (e.tx || 0), (y1 + y2) / 2 + (e.ty || -8), e.t, { fs: 10.5, mono: 1, color: css("--ink-3") }); });
    // nodes
    spec.nodes.forEach(n => { const K = FLOW_K[n.k];
      rect(s, n.x, n.y, n.w, n.h, { fill: K.fill(), stroke: K.stroke(), sw: n.k === "train" && bwd ? 2.6 : 1.5, dash: K.dash });
      txt(s, n.x + n.w / 2, n.y + (n.s ? 20 : 26), n.t, { fs: 13, bold: 1, color: n.k === "frozen" ? css("--ink-2") : css("--ink") });
      if (n.s) txt(s, n.x + n.w / 2, n.y + 36, n.s, { fs: 10.5, color: css("--ink-2") });
      if (K.tag && n.k !== "data") txt(s, n.x + n.w / 2, n.y + n.h - 7, K.tag, { fs: 10, mono: 1, bold: n.k === "train", color: n.k === "train" ? css("--cls-0") : n.k === "loss" ? css("--bad") : css("--ink-3") }); });
    // the gradient: dashed, from the loss back into what is trained
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
      { id: "d", k: "data", x: 10, y: 50, w: 175, h: 60, t: "dialogue", s: "prompt + written answer" },
      { id: "p", k: "train", x: 235, y: 50, w: 165, h: 60, t: "π_θ", s: "every layer" },
      { id: "z", k: "data", x: 450, y: 50, w: 165, h: 60, t: "logits", s: "at every position" },
      { id: "l", k: "loss", x: 665, y: 46, w: 265, h: 68, t: "cross-entropy", s: "answer tokens only: labels ≠ −100" }],
    fwd: [{ a: "d", b: "p" }, { a: "p", b: "z" }, { a: "z", b: "l" }],
    back: [{ a: "l", b: "p", y: 185, t: "into every layer — also through the prompt's positions" }] });
  flowFig("rm", { h: 210, nodes: [
      { id: "d", k: "data", x: 10, y: 50, w: 190, h: 60, t: "a pair", s: "prompt + chosen, + rejected" },
      { id: "m", k: "train", x: 250, y: 50, w: 190, h: 60, t: "reward model r_φ", s: "SFT body + one-number head" },
      { id: "r", k: "data", x: 490, y: 50, w: 150, h: 60, t: "r_c, r_r", s: "two numbers" },
      { id: "l", k: "loss", x: 690, y: 46, w: 240, h: 68, t: "−log σ(r_c − r_r)", s: "Bradley–Terry on the pair" }],
    fwd: [{ a: "d", b: "m" }, { a: "m", b: "r" }, { a: "r", b: "l" }],
    back: [{ a: "l", b: "m", y: 185, t: "through both passes — the same weights" }] });
  flowFig("ppo", { h: 400, nodes: [
      { id: "x", k: "data", x: 10, y: 140, w: 110, h: 60, t: "prompt" },
      { id: "p", k: "train", x: 160, y: 140, w: 140, h: 60, t: "π_θ", s: "the policy" },
      { id: "y", k: "data", x: 345, y: 140, w: 130, h: 60, t: "answer y", s: "sampled, its own" },
      { id: "m", k: "frozen", x: 520, y: 30, w: 150, h: 60, t: "reward model", s: "one number" },
      { id: "f", k: "frozen", x: 520, y: 140, w: 150, h: 60, t: "π_ref", s: "log π_ref per token" },
      { id: "v", k: "train", x: 520, y: 250, w: 150, h: 60, t: "critic V", s: "value of a prefix" },
      { id: "a", k: "const", x: 705, y: 140, w: 100, h: 60, t: "Â_t", s: "GAE" },
      { id: "l", k: "loss", x: 830, y: 132, w: 100, h: 76, t: "clip(ρ·Â)", s: "+ (V − G)²" }],
    fwd: [{ a: "x", b: "p" }, { a: "p", b: "y", stop: "sampling: no ∇", ly: 44 }, { a: "y", b: "m" }, { a: "y", b: "f" }, { a: "y", b: "v" },
      { a: "m", b: "a", stop: true }, { a: "f", b: "a", stop: true }, { a: "v", b: "a", stop: true }, { a: "a", b: "l" }],
    back: [{ a: "l", b: "p", y: 375, t: "into π_θ only through log π_θ of its own sampled tokens" }, { a: "l", b: "v", bs: "r", y: 290, t: "", ty: 0 }] });
  flowFig("dpo", { h: 360, nodes: [
      { id: "d", k: "data", x: 10, y: 155, w: 165, h: 60, t: "a pair", s: "prompt, chosen, rejected" },
      { id: "p", k: "train", x: 225, y: 75, w: 160, h: 60, t: "π_θ", s: "the model trained" },
      { id: "f", k: "frozen", x: 225, y: 235, w: 160, h: 60, t: "π_ref", s: "the SFT model" },
      { id: "q", k: "data", x: 435, y: 75, w: 200, h: 60, t: "log π(y_c), log π(y_r)", s: "two numbers" },
      { id: "c", k: "const", x: 435, y: 235, w: 200, h: 60, t: "log π_ref(y_c), (y_r)", s: "can be computed once" },
      { id: "l", k: "loss", x: 690, y: 147, w: 240, h: 76, t: "−log σ(β[Δ_c − Δ_r])", s: "Δ = log π − log π_ref" }],
    fwd: [{ a: "d", b: "p" }, { a: "d", b: "f" }, { a: "p", b: "q" }, { a: "f", b: "c" }, { a: "q", b: "l" }, { a: "c", b: "l" }],
    back: [{ a: "l", b: "p", as: "t", bs: "t", y: 8, t: "up through y_c, down through y_r, × σ(−margin)", ty: 6 }] });
  flowFig("grpo", { h: 340, nodes: [
      { id: "x", k: "data", x: 10, y: 125, w: 105, h: 60, t: "prompt" },
      { id: "p", k: "train", x: 150, y: 125, w: 135, h: 60, t: "π_θ", s: "the policy" },
      { id: "y", k: "data", x: 330, y: 125, w: 140, h: 60, t: "G answers", s: "sampled, its own" },
      { id: "c", k: "prog", x: 515, y: 30, w: 140, h: 60, t: "checker", s: "r_i ∈ {0, 1}" },
      { id: "f", k: "frozen", x: 515, y: 220, w: 140, h: 60, t: "π_ref", s: "for the KL only" },
      { id: "a", k: "const", x: 690, y: 30, w: 115, h: 60, t: "A_i", s: "(r − mean) / std" },
      { id: "l", k: "loss", x: 820, y: 117, w: 110, h: 76, t: "−A_i log π_θ", s: "+ β · KL" }],
    fwd: [{ a: "x", b: "p" }, { a: "p", b: "y", stop: "sampling: no ∇", ly: 44 }, { a: "y", b: "c" }, { a: "c", b: "a" }, { a: "a", b: "l", stop: true }, { a: "y", b: "f" }, { a: "f", b: "l", stop: true }],
    back: [{ a: "l", b: "p", y: 320, t: "only through log π_θ of its own tokens · the same A_i for every token of answer i" }] });
  flowFig("distill", { h: 210, nodes: [
      { id: "x", k: "data", x: 10, y: 50, w: 120, h: 60, t: "prompt" },
      { id: "t", k: "frozen", x: 170, y: 50, w: 160, h: 60, t: "teacher", s: "a larger model" },
      { id: "g", k: "const", x: 370, y: 50, w: 175, h: 60, t: "answers or logits", s: "the targets" },
      { id: "s", k: "train", x: 585, y: 50, w: 140, h: 60, t: "student", s: "the small model" },
      { id: "l", k: "loss", x: 765, y: 46, w: 165, h: 68, t: "CE or KL", s: "at every position" }],
    fwd: [{ a: "x", b: "t" }, { a: "t", b: "g", stop: true }, { a: "g", b: "s" }, { a: "s", b: "l" }],
    back: [{ a: "l", b: "s", y: 185, t: "into the student only" }] });

  /* which share of the numbers each stage actually changed, by kind of matrix (weights.json) */
  const W = D.weights, KINDS = [["embed_tokens", "embedding"], ["q_proj", "q"], ["k_proj", "k"], ["v_proj", "v"], ["o_proj", "o"], ["gate_proj", "gate"], ["up_proj", "up"], ["down_proj", "down"], ["norm", "norms"], ["lm_head", "lm_head"]];
  [["sft", "SFT"], ["dpo", "DPO"], ["grpo", "RLVR"]].forEach(([key, st]) => { const w = W[st];
    $(`#flow-${key}-w`).innerHTML = `<div class="flow-wgrid"><div>${stat(pct(w.changed) + "%", `numbers changed, ${w.from} → ${st}`)}${stat("100%", "of the weights get ∇")}</div><div>` +
      KINDS.map(([k, l]) => `<div class="pbar"><span class="lab">${l}</span><span class="bar"><i style="width:${pct(w.by_kind[k], 1)}%;background:${k === "embed_tokens" || k === "lm_head" ? "var(--cls-1)" : "var(--cls-0)"}"></i></span><span class="v">${pct(w.by_kind[k])}%</span></div>`).join("") + `</div></div>` +
      `<div class="small-note" style="font-family:var(--body);font-size:16px;color:var(--ink-2);line-height:1.55;margin-top:10px">${key === "sft" ? TXT("weights-note-sft", { changed: pct(w.changed, 1) })
        : TXT("weights-note", { changed: pct(w.changed), numel: num(w.numel), from: w.from, emb: pct(w.by_kind.embed_tokens), head: pct(w.by_kind.lm_head) })}</div>`;
  });
});

/* ============================================== the stage table: one model, four checkpoints, a row per block */
const ST = D.stages, ORDER = ["base", "SFT", "DPO", "RLVR"];
function stageRow(name, fresh) {
  const r = ST.rows[name];
  const cell = (t, i) => {
    let body = esc(t);
    if (name === "base") { const cut = t.indexOf("\nQuestion:"); if (cut >= 0) body = esc(t.slice(0, cut)) + `<span class="made" title="the model invented the next question">${esc(t.slice(cut))}</span>`; }
    return `<td><div class="ans" title="click to expand">${body.trim() ? body : '<span class="made">(nothing but blank space)</span>'}</div></td>`; };
  return `<tr class="${fresh ? "new" : ""}"><td class="st"><b>${name}</b><span>GSM8K ${String(r.gsm_acc)}</span><span>stops ${pct(r.gsm_stopped)}%</span><span>open: ${Math.round(r.open_tokens)} tok</span><span>bits/byte ${r.bits_per_byte.toFixed(3)}</span><span>${num(r.params)} params</span></td>${r.answers.map(cell).join("")}</tr>`;
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
  stageTable(i, i);                                            // the rows the earlier blocks already added
  $("#btn-stagetab-" + i).addEventListener("click", e => {
    stageTable(i, i + 1, true); $("#stagetab-note-" + i).innerHTML = STAGE_NOTES[i](); $("#stagetab-note-" + i).hidden = false;
    if (i === 1) refusalBet.reveal();
    e.target.disabled = true; e.target.textContent = "added"; });
});

/* ===================================================================== 01 SFT */
/* the mask: click the tokens that carry the loss, then the real labels of sft_example */
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
    e.target.disabled = true; e.target.textContent = "revealed";
  });
  states("mask-mode", null, paint);
});

/* the notebook's SFTTrainer cell, line by line linked to the cards; the collator picture under it */
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
print("the same mask as ours:", trainer.train_dataset[0]["labels"] == sft_example(small_tok, train_dialogues[0])["labels"])
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
    [[C.lengths_random, "random order", pr, 10], [C.lengths_sorted, "train_sampling_strategy = \"group_by_length\"", ps, 490]].forEach(([ls, title, share, x0]) => {
      txt(s, x0, 16, `${title} · padding ${pct(share)}%`, { anchor: "start", fs: 12.5, color: css("--ink") });
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

/* on-policy / off-policy: two loops, one method lit at a time */
later(function policy() {
  const ITEMS = [["sft", "SFT"], ["dpo", "DPO"], ["online", "online DPO"], ["grpo", "PPO · GRPO"], ["rs", "rejection sampling"]];
  const LIT = { sft: ["off"], dpo: ["off"], online: ["on"], grpo: ["on"], rs: ["rs"] };
  const JUDGE = { sft: "", dpo: "", online: "picks the better of two", grpo: "RM · checker", rs: "keeps the right ones" };
  const DATA = { sft: "written answers", dpo: "fixed pairs: better, worse", online: "", grpo: "", rs: "the model's own verified answers" };
  let mode = "sft";
  function box(s, x, y, w, h, title, sub, on, col) {
    rect(s, x, y, w, h, { fill: on ? TINT(col, 18) : css("--panel"), stroke: on ? css(col) : css("--rule-strong"), sw: on ? 2 : 1.2, dash: !on });
    txt(s, x + w / 2, y + (sub ? h / 2 - 3 : h / 2 + 5), title, { fs: 14, bold: 1, color: on ? css("--ink") : css("--ink-3") });
    if (sub) txt(s, x + w / 2, y + h / 2 + 15, sub, { fs: 11.5, color: on ? css("--ink-2") : css("--ink-3") });
  }
  function draw() {
    const s = svg(940, 300), lit = LIT[mode], off = lit.includes("off"), on = lit.includes("on"), rs = lit.includes("rs");
    const cOff = "--cls-3", cOn = "--cls-2";
    txt(s, 215, 22, "off-policy · someone else wrote the tokens", { fs: 13, bold: 1, color: off || rs ? css("--ink") : css("--ink-3") });
    txt(s, 695, 22, "on-policy · the model writes them at the step", { fs: 13, bold: 1, color: on || rs ? css("--ink") : css("--ink-3") });
    line(s, 470, 10, 470, 290, { color: css("--rule") });
    // off loop
    box(s, 40, 46, 350, 64, "data, collected before training", DATA[mode] || "the web · a human · a teacher model · pairs", off || rs, cOff);
    box(s, 40, 146, 150, 52, "loss", off || rs ? (mode === "dpo" ? "the DPO loss" : "next-token, w = 1") : "", off || rs, cOff);
    box(s, 240, 146, 150, 52, "the model", "π_θ", off || rs, cOff);
    arrow(s, 115, 110, 115, 144, { color: off || rs ? css(cOff) : css("--rule-strong") });
    arrow(s, 190, 172, 238, 172, { color: off || rs ? css(cOff) : css("--rule-strong") });
    txt(s, 215, 232, "the gradient only goes into the model;", { fs: 12, italic: 1, color: css("--ink-3") });
    txt(s, 215, 248, "nothing it writes comes back", { fs: 12, italic: 1, color: css("--ink-3") });
    // on loop
    box(s, 520, 46, 150, 52, "the model", "π_θ, now", on || rs, cOn);
    box(s, 740, 46, 170, 52, "samples", "its own answers", on || rs, cOn);
    box(s, 740, 146, 170, 52, "judge", JUDGE[mode] || "checker · RM · pair", on || rs, cOn);
    box(s, 520, 146, 150, 52, "loss", on ? "weighted by the judge" : "", on, cOn);
    arrow(s, 670, 72, 738, 72, { color: on || rs ? css(cOn) : css("--rule-strong") });
    arrow(s, 825, 98, 825, 144, { color: on || rs ? css(cOn) : css("--rule-strong") });
    arrow(s, 740, 172, 672, 172, { color: on ? css(cOn) : css("--rule-strong") });
    arrow(s, 595, 146, 595, 100, { color: on ? css(cOn) : css("--rule-strong"), sw: on ? 2.2 : 1.6 });
    txt(s, 700, 232, "the gradient goes back into the model", { fs: 12, italic: 1, color: css("--ink-3") });
    txt(s, 700, 248, "that wrote the tokens — every step", { fs: 12, italic: 1, color: css("--ink-3") });
    if (rs) { arrow(s, 0, 0, 0, 0, { d: "M 740 186 C 640 290, 330 300, 300 112", color: css("--cls-1"), sw: 2.2, dash: 1 });
      txt(s, 520, 284, "kept answers become the SFT data", { fs: 12.5, bold: 1, color: css("--cls-1") }); }
    const host = $("#fig-policy"); host.innerHTML = ""; host.appendChild(s);
    $("#policy-fig-note").innerHTML = TXT("policy-s-" + mode);
  }
  states("policy-states", ITEMS, m => { mode = m; draw(); });
  draw(); REDRAW.push(draw);
});

/* ===================================================================== 02 preferences */
/* label it yourself: four answers, six pairs, the room's counts */
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
/* one step of Hunter's MM iteration for Bradley–Terry; p = e^r, centred so that the mean of r is 0 */
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
    && close(a.mean, BT.check.agreement.mean) && a.cycle === BT.check.agreement.cycle, "MM steps, loss and agreement = Python's on a fixed vote table");
});

later(function label() {
  const it = BT.item; let revealed = false;
  $("#uf-prompt").textContent = it.instruction;
  $("#label-src").textContent = it.source === "stages.json" ? "OLMo 2 1B's four stages" : `UltraFeedback · ${it.source}`;
  const W = [[0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]];             // the room's votes; empty until they are typed in
  const any = () => PAIRS.some(([i, j]) => W[i][j] + W[j][i] > 0);
  function cards() {
    $("#uf-answers").innerHTML = it.completions.map((c, i) => `<div class="uf-card"><div class="h"><b>${LETTERS[i]}</b>${revealed ? `<span>${esc(c.model)}${c.score != null ? ` · judge ${c.score}` : ""}</span>` : ""}</div><div class="t">${esc(c.text)}</div></div>`).join("");
  }
  $("#uf-votes").insertAdjacentHTML("beforebegin", `<div class="small-note" style="margin:14px 0 6px">hands up for the left answer, hands up for the right one — type the counts</div>`);
  $("#uf-votes").innerHTML = PAIRS.map(([i, j]) =>
    `<div class="uf-vote"><input type="number" min="0" data-i="${i}" data-j="${j}" placeholder="0"><span><b>${LETTERS[i]}</b> vs <b>${LETTERS[j]}</b></span><input type="number" min="0" data-i="${j}" data-j="${i}" placeholder="0"><span class="bar"><i></i></span></div>`).join("");
  function agree() {
    if (!any()) { $("#agree-out").innerHTML = stat("—", "votes with their pair's majority") + stat("—", "κ against a coin") + stat("—", "a cycle among the majorities"); $("#agree-note").innerHTML = ""; $$(".uf-vote .bar i").forEach(i => { i.style.width = "0"; }); return; }
    const a = agreement(W);
    $$(".uf-vote").forEach((row, k) => { const [i, j] = PAIRS[k], n = W[i][j] + W[j][i]; $(".bar i", row).style.width = n ? pct(W[i][j] / n) + "%" : "0"; });
    $("#agree-out").innerHTML = stat(pct(a.mean) + "%", "votes with their pair's majority") + stat(a.kappa.toFixed(2), "κ against a coin") + stat(a.cycle ? "yes" : "no", "a cycle among the majorities");
    $("#agree-note").innerHTML = TXT("agree-note", { mean: pct(a.mean), kappa: a.kappa.toFixed(2), cycle: TXT(a.cycle ? "agree-cycle-yes" : "agree-cycle-no") });
  }
  $("#uf-votes").addEventListener("input", e => { const t = e.target.closest("input"); if (!t) return; W[+t.dataset.i][+t.dataset.j] = Math.max(0, +t.value || 0); agree(); btReset(); });

  /* Bradley–Terry, one MM step per click */
  let r = [0, 0, 0, 0], k = 0;
  const order = rr => rr.map((x, i) => [x, i]).sort((a, b) => b[0] - a[0]).map(([, i]) => LETTERS[i]).join(" > ");
  function btDraw() {
    const s = svg(420, 200), X = v => 210 + v * 70;
    line(s, X(0), 10, X(0), 180, { color: css("--rule-strong") });
    [-2, -1, 1, 2].forEach(v => { line(s, X(v), 10, X(v), 180, { color: css("--rule"), dash: 1 }); txt(s, X(v), 196, (v > 0 ? "+" : "") + v, { fs: 11, mono: 1, color: css("--ink-3") }); });
    txt(s, X(0), 196, "0", { fs: 11, mono: 1, color: css("--ink-3") });
    r.forEach((v, i) => { const y = 18 + i * 42, c = ["--cls-0", "--cls-1", "--cls-2", "--cls-3"][i];
      rect(s, Math.min(X(0), X(Math.max(-2.8, Math.min(2.8, v)))), y, Math.abs(X(Math.max(-2.8, Math.min(2.8, v))) - X(0)), 26, { fill: TINT(c, 55), stroke: css(c), rx: 2 });
      txt(s, 18, y + 18, LETTERS[i], { fs: 15, bold: 1, color: css("--ink") });
      txt(s, v >= 0 ? X(Math.min(2.8, v)) + 8 : X(Math.max(-2.8, v)) - 8, y + 18, (v >= 0 ? "+" : "") + v.toFixed(2), { fs: 12, mono: 1, anchor: v >= 0 ? "start" : "end", color: css("--ink") }); });
    const h = $("#bt-scores"); h.innerHTML = '<div class="hm-title">scores r</div>'; h.appendChild(s);
    let tb = `<div class="hm-title">model <span style="text-transform:none">σ(r<sub>row</sub> − r<sub>col</sub>)</span> · the votes' share</div><table class="conf bt-mat"><tr><th></th>${LETTERS.map(l => `<th>${l}</th>`).join("")}</tr>`;
    for (let i = 0; i < 4; i++) { tb += `<tr><th>${LETTERS[i]}</th>`; for (let j = 0; j < 4; j++) { if (i === j) { tb += "<td>—</td>"; continue; }
      const n = W[i][j] + W[j][i], obs = n ? W[i][j] / n : null, mod = sig(r[i] - r[j]);
      tb += `<td class="${obs != null && Math.abs(mod - obs) < 0.05 ? "hit" : ""}">${mod.toFixed(2)}<br><span class="obs">${obs == null ? "·" : obs.toFixed(2)}</span></td>`; } tb += "</tr>"; }
    $("#bt-matrix").innerHTML = tb + "</table>";
    $("#bt-step-line").innerHTML = TXT("bt-step", { k, nll: btNll(W, r).toFixed(2), order: order(r) });
  }
  function btReset() { r = [0, 0, 0, 0]; k = 0; btDraw(); }
  $("#btn-bt-step").addEventListener("click", () => { if (!any()) return; r = btStep(W, r); k++; btDraw(); });
  $("#btn-bt-run").addEventListener("click", () => { if (!any()) return; for (let i = 0; i < 60; i++) { r = btStep(W, r); k++; } btDraw(); });
  $("#btn-bt-reset").addEventListener("click", btReset);
  $("#btn-bt-reveal").addEventListener("click", e => {
    revealed = true; cards(); e.target.disabled = true; e.target.textContent = "revealed";
    if (any()) { for (let i = 0; i < 60; i++) { r = btStep(W, r); k++; } btDraw(); }
    const sc = it.completions.map(c => c.score);
    if (sc.some(x => x == null)) { $("#bt-note").hidden = true; return; }
    if (!any()) { $("#bt-note").innerHTML = TXT("bt-reveal-novotes", { judge: sc.map((x, i) => [x, i]).sort((a, b) => b[0] - a[0]).map(([, i]) => LETTERS[i]).join(" > ") }); $("#bt-note").hidden = false; return; }
    const judge = sc.map((x, i) => [x, i]).sort((a, b) => b[0] - a[0]).map(([, i]) => LETTERS[i]).join(" > "), room = order(r);
    $("#bt-note").innerHTML = TXT(judge === room ? "bt-reveal-agree" : "bt-reveal-disagree", { judge, room }); $("#bt-note").hidden = false;
  });
  cards(); agree(); btDraw(); REDRAW.push(btDraw);
});

/* what each method keeps in memory: PPO, DPO, GRPO on one picture */
later(function roles() {
  const BOX = [
    { k: "pol", t: "policy π_θ", s: "trained · samples", c: "--cls-0" },
    { k: "ref", t: "reference", s: "frozen · scores", c: "--ink-3" },
    { k: "rm", t: "reward model", s: "frozen · 1 number", c: "--cls-1" },
    { k: "crit", t: "critic V", s: "trained · value", c: "--cls-3" },
    { k: "chk", t: "checker", s: "a program", c: "--cls-2" },
    { k: "pairs", t: "pairs", s: "fixed data", c: "--cls-1" },
  ];
  const USE = { ppo: ["pol", "ref", "rm", "crit"], dpo: ["pol", "ref", "pairs"], grpo: ["pol", "ref", "chk"] };
  const FLOW = {
    ppo: ["prompt", "π_θ samples an answer", "RM scores it", "critic: value of every prefix", "PPO update of π_θ and V, KL to π_ref"],
    dpo: ["prompt + a pair", "log π_θ, log π_ref of both", "margin β[Δ_c − Δ_r]", "−log σ(margin)", "update of π_θ"],
    grpo: ["prompt", "π_θ samples G answers", "the checker: 1 / 0", "A = (r − mean) / std", "update of π_θ, KL to π_ref"],
  };
  const SIZE = { ppo: "4 models of the policy's size · 2 with optimiser states · generation inside the loop", dpo: "2 models · 1 with optimiser states · no generation", grpo: "2 models · 1 with optimiser states · generation inside the loop" };
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

/* the DPO loss by hand: four log-probabilities and β */
later(function dpo() {
  const E = D.dpo.examples;
  const loss = (pc, pr, rc, rr, b) => { const m = b * ((pc - rc) - (pr - rr)); return { m, loss: -Math.log(sig(m)), w: sig(-m), rc: b * (pc - rc), rr: b * (pr - rr) }; };
  check("dpo-check", ["b", "c"].every(k => { const e = E[k], o = loss(e.pi_chosen, e.pi_rejected, e.ref_chosen, e.ref_rejected, D.dpo.beta);
    return close(o.m, e.margin) && close(o.loss, e.loss) && close(o.w, e.grad_weight) && close(o.rc, e.r_chosen) && close(o.rr, e.r_rejected); }), "(b), (c) = the notebook's numbers");
  const SL = [["refc", "log π_ref(chosen)", -80, 0, 1], ["refr", "log π_ref(rejected)", -80, 0, 1], ["polc", "log π(chosen)", -80, 0, 1], ["polr", "log π(rejected)", -80, 0, 1], ["beta", "β", 0.01, 1, 0.01]];
  $("#dpo-sliders").innerHTML = SL.map(([k, l, a, b, st]) => `<div><label class="field">${l} <b id="dpo-${k}-v"></b></label><input type="range" id="dpo-${k}" min="${a}" max="${b}" step="${st}"></div>`).join("");
  const set = v => { for (const k in v) $("#dpo-" + k).value = v[k]; draw(); };
  const PRE = { b: { refc: -40, refr: -42, polc: -35, polr: -52, beta: D.dpo.beta }, c: { refc: -40, refr: -42, polc: -45, polr: -62, beta: D.dpo.beta }, init: { refc: -40, refr: -42, polc: -40, polr: -42, beta: D.dpo.beta } };
  function draw() {
    const v = {}; SL.forEach(([k]) => { v[k] = +$("#dpo-" + k).value; $(`#dpo-${k}-v`).textContent = k === "beta" ? v[k].toFixed(2) : v[k]; });
    const o = loss(v.polc, v.polr, v.refc, v.refr, v.beta);
    $("#dpo-out").innerHTML = stat((o.rc >= 0 ? "+" : "") + o.rc.toFixed(2), "implicit reward, chosen") + stat((o.rr >= 0 ? "+" : "") + o.rr.toFixed(2), "implicit reward, rejected") +
      stat(o.m.toFixed(2), "margin") + stat(o.loss.toFixed(3), "loss") + stat(o.w.toFixed(2), "gradient weight σ(−margin)") +
      stat("×" + (Math.exp(v.polc - v.refc) >= 0.01 ? Math.exp(v.polc - v.refc).toPrecision(2) : Math.exp(v.polc - v.refc).toExponential(0)), "P(chosen) vs the reference");
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

/* 1 000 real pairs: Δ log π(chosen) against Δ log π(rejected), DPO or RLVR against the SFT reference */
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
    return a.n === p.n && close(a.margin_pos, p.margin_pos, 2e-3) && close(a.chosen_up, p.chosen_up, 2e-3) && close(a.both_down, p.both_down, 2e-3); }), "DPO and RLVR shares = Python's");
  const A = SUM.DPO.all;
  const bet = makeBet("#bet-pairs", ["under 25%", "25–50%", "50–75%", "over 75%"], Math.min(3, Math.floor(A.chosen_up * 4)));
  const sources = Object.keys(SUM.DPO.by_source);
  $("#pairs-source").innerHTML = `<option value="">all ${PP.n}</option><option value="on">on-policy pairs</option><option value="off">off-policy pairs</option>` + sources.map(s => `<option value="${esc(s)}">${esc(s)} · ${SUM.DPO.by_source[s].n}</option>`).join("");
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
    txt(s, L + Wd / 2, T + Wd + 32, "Δ log π(chosen), against SFT →", { fs: 12, color: css("--ink-2") });
    txt(s, L + 6, T + 14, "↑ Δ log π(rejected)", { fs: 12, anchor: "start", color: css("--ink-2") });
    txt(s, X(-lim) + 8, Y(-lim) - 8, "both went down", { fs: 11.5, anchor: "start", italic: 1, color: css("--bad") });
    txt(s, X(lim) - 8, Y(-lim) - 8, "below the diagonal: the right way", { fs: 11.5, anchor: "end", italic: 1, color: css("--good") });
    for (let i = 0; i < PP.n; i++) { if (!keep(i)) continue;
      const dc = PP[stage].chosen[i] - PP.SFT.chosen[i], dr = PP[stage].rejected[i] - PP.SFT.rejected[i];
      const c = s.appendChild(el("circle", { cx: X(dc).toFixed(1), cy: Y(dr).toFixed(1), r: 2.6, fill: dc > dr ? css("--cls-0") : css("--cls-1"), opacity: 0.55 }));
      tipOn(c, () => `${esc(PP.source[i])}${PP.on_policy[i] ? " · on-policy" : ""}<br>Δ chosen ${dc.toFixed(1)} · Δ rejected ${dr.toFixed(1)}<br>${PP.len_chosen[i]} / ${PP.len_rejected[i]} tokens`); }
    const host = $("#fig-pairs"); host.innerHTML = ""; host.appendChild(s);
    const st = pairStats(stage, keep);
    $("#pairs-stats").innerHTML = stat(st.n, "pairs shown") + stat(pct(st.margin_pos) + "%", "margin > 0") + stat(pct(st.chosen_up) + "%", "chosen became more likely") + stat(pct(st.both_down) + "%", "both became less likely");
  }
  states("pairs-stage", null, m => { stage = m; draw(); });
  $("#pairs-source").addEventListener("change", draw);
  reveal("btn-pairs-reveal", ["pairs-out"], "pairs-note", [bet], () => { draw(); REDRAW.push(draw); });
  $("#pairs-note").innerHTML = TXT("pairs-note", { marginPos: pct(A.margin_pos), bothDown: pct(A.both_down), chosenUp: pct(A.chosen_up), rlvrPos: pct(SUM.RLVR.all.margin_pos) });

  /* the same pairs split by who wrote them */
  const on = SUM.DPO.on_policy, off = SUM.DPO.off_policy;
  $("#fig-onoff").innerHTML = `<div class="legend" style="margin:0 0 8px"><span><i class="sw" style="background:var(--cls-0)"></i>on-policy pairs · ${on.n}</span><span><i class="sw" style="background:var(--cls-1)"></i>written by other models · ${off.n}</span></div>` +
    [["margin > 0", "margin_pos"], ["chosen went up", "chosen_up"], ["both went down", "both_down"]].map(([l, k]) =>
      `<div class="pair"><span class="lab">${l}</span><span class="bar e"><i style="width:${pct(on[k], 1)}%"></i></span><span class="bar d"><i style="width:${pct(off[k], 1)}%"></i></span><span class="n">${pct(on[k])}% · ${pct(off[k])}%</span></div>`).join("");
  $("#policy-note").innerHTML = TXT("policy-note", { nOn: on.n, onUp: pct(on.chosen_up), onBoth: pct(on.both_down), nOff: off.n, offUp: pct(off.chosen_up), offBoth: pct(off.both_down) });

  /* length: the pairs, and the stages on open prompts */
  const Lg = D.dpo.length, R = D.stages.rows, mx = Math.max(...Object.values(R).map(r => r.open_tokens));
  $("#fig-length").innerHTML = `<div class="hm-title">open prompts · mean tokens written, and the share that stops by itself</div>` +
    Object.entries(R).map(([s, r]) => `<div class="pbar"><span class="lab">${s}</span><span class="bar"><i style="width:${pct(r.open_tokens / mx, 1)}%;background:${s === "DPO" ? "var(--cls-1)" : "var(--cls-0)"}"></i></span><span class="v">${Math.round(r.open_tokens)} · ${pct(r.open_stopped)}%</span></div>`).join("") +
    `<div class="hm-title" style="margin-top:12px">the DPO pairs</div><div class="pbar"><span class="lab">chosen is longer</span><span class="bar"><i style="width:${pct(Lg.chosen_longer, 1)}%"></i></span><span class="v">${pct(Lg.chosen_longer)}%</span></div>`;
  $("#length-note").innerHTML = TXT("length-note", { n: PP.n, longer: pct(Lg.chosen_longer), nOpen: D.stages.n_open, sftTok: Math.round(R.SFT.open_tokens), sftStop: pct(R.SFT.open_stopped),
    dpoTok: Math.round(R.DPO.open_tokens), dpoStop: pct(R.DPO.open_stopped), budget: D.stages.max_new_tokens });
});

/* ===================================================================== 03 RLVR */
/* GRPO's advantages: the notebook's `advantages`, population std, eps 1e-6 */
const advantages = r => { const m = r.reduce((a, x) => a + x, 0) / r.length, sd = Math.sqrt(r.reduce((a, x) => a + (x - m) ** 2, 0) / r.length); return r.map(x => (x - m) / (sd + 1e-6)); };
later(function grpo() {
  const G = D.grpo, PRE = { "mixed": [1, 0, 0, 1, 0, 0, 0, 1], "one right": [1, 0, 0, 0, 0, 0, 0, 0], "all right": [1, 1, 1, 1, 1, 1, 1, 1], "all wrong": [0, 0, 0, 0, 0, 0, 0, 0] };
  check("grpo-check", Object.keys(PRE).every(k => advantages(PRE[k]).every((a, i) => close(a, G.advantages[k][i]))), "advantages = the notebook's for the four groups");
  // eight answers to the notebook's first prompt; a click flips the checker's verdict
  let R = PRE.mixed.slice();
  function draw() {
    const A = advantages(R), right = R.reduce((a, x) => a + x, 0), mean = right / R.length;
    const s = svg(940, 250), bw = 104, gap = 11, X = i => 14 + i * (bw + gap), Y0 = 170, sc = 26;
    txt(s, 14, 18, "one prompt, a group of G = 8 samples from the current model · click a sample to flip the checker's verdict", { anchor: "start", fs: 12.5, color: css("--ink-2") });
    R.forEach((r, i) => { const x = X(i);
      const b = rect(s, x, 30, bw, 54, { fill: r ? TINT("--good", 16) : TINT("--bad", 12), stroke: r ? css("--good") : css("--bad"), sw: 1.6 });
      b.style.cursor = "pointer"; b.addEventListener("click", () => { R[i] = 1 - R[i]; draw(); });
      txt(s, x + bw / 2, 52, `sample ${i + 1}`, { fs: 12, mono: 1, color: css("--ink") }).style.pointerEvents = "none";
      txt(s, x + bw / 2, 74, r ? "✓  r = 1" : "✗  r = 0", { fs: 12, bold: 1, color: r ? css("--good") : css("--bad") }).style.pointerEvents = "none";
      const a = A[i], h = Math.min(Math.abs(a), 3) * sc;
      if (Math.abs(a) > 1e-9) rect(s, x + bw / 2 - 20, a > 0 ? Y0 - h : Y0, 40, h, { fill: a > 0 ? css("--good") : css("--bad"), op: 0.75, rx: 2 });
      txt(s, x + bw / 2, a >= 0 ? Y0 - h - 6 : Y0 + h + 15, (a > 0 ? "+" : "") + a.toFixed(2), { fs: 12, mono: 1, bold: 1, color: css("--ink") });
    });
    line(s, 10, Y0, 930, Y0, { color: css("--ink-3"), sw: 1.2 });
    txt(s, 930, Y0 - 6, "A = 0", { fs: 11, mono: 1, anchor: "end", color: css("--ink-3") });
    txt(s, 470, 244, `mean ${mean.toFixed(3)} · std ${Math.sqrt(mean * (1 - mean)).toFixed(3)} · Σ A = ${A.reduce((a, x) => a + x, 0).toFixed(6)} · every token of answer i gets w = Aᵢ`, { fs: 12, mono: 1, color: css("--ink-2") });
    const host = $("#fig-grpo"); host.innerHTML = ""; host.appendChild(s);
    const pos = A.find((a, i) => R[i] === 1), neg = A.find((a, i) => R[i] === 0);
    $("#grpo-note").innerHTML = right === 0 || right === R.length ? TXT("grpo-note-flat", { right, G: R.length })
      : right === 1 ? TXT("grpo-note-std", { G: R.length, aPos: "+" + pos.toFixed(2) })
      : TXT("grpo-note", { right, G: R.length, aPos: "+" + pos.toFixed(2), aNeg: neg.toFixed(2) });
  }
  states("grpo-presets", null, m => { R = PRE[m].slice(); draw(); });
  draw(); REDRAW.push(draw);
});

/* the checker: the notebook's final_number / reward, ported */
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
    """The whole 'reward model' of RL with a verifier: 1 if the final number is right, 0 otherwise."""
    pred = final_number(text)
    return float(pred is not None and abs(pred - gold) < 1e-6)`);
  const out = () => { const t = $("#checker-in").value, f = finalNumber(t), r = rewardOf(t, C.gold);
    const o = $("#checker-out"); o.className = "out " + (r ? "ok" : "no"); o.textContent = `final ${f === null ? "None" : f} → reward ${r}`; };
  $("#checker-in").addEventListener("input", out); out();
  $("#checker-table").innerHTML = `<thead><tr><th>answer</th><th class="num">final_number</th><th class="num">reward</th></tr></thead><tbody>` +
    C.tests.map(t => `<tr><td class="mono">${esc(t.text.replace(/\n/g, " ↵ "))}</td><td class="num">${t.final === null ? "None" : t.final}</td><td class="num"><b style="color:${t.reward ? "var(--good)" : "var(--bad)"}">${t.reward}</b></td></tr>`).join("") + "</tbody>";
  // a format reward on top: r = r_correct + w · r_format, where the format is a closing `#### number`
  const FMT = ["n = 6 − 2 = 4\n#### 4", "so n is 4", "#### 4.0", "n = 6 + 2 = 8\n#### 8"];
  const fmt = t => /####\s*\S+\s*$/.test(t) ? 1 : 0;
  function drawFmt() { const w = +$("#fmt-w").value; $("#fmt-w-v").textContent = w.toFixed(2);
    const rows = FMT.map(t => ({ t, c: rewardOf(t, C.gold), f: fmt(t) })), best = Math.max(...rows.map(r => r.c + w * r.f));
    $("#fmt-table").innerHTML = `<thead><tr><th>answer</th><th class="num">right</th><th class="num">format</th><th class="num">r = right + w · format</th></tr></thead><tbody>` +
      rows.map(r => `<tr class="${r.c === 0 && r.c + w * r.f >= Math.min(...rows.filter(x => x.c).map(x => x.c + w * x.f)) - 1e-9 ? "hl" : ""}"><td class="mono">${esc(r.t.replace(/\n/g, " ↵ "))}</td><td class="num">${r.c}</td><td class="num">${r.f}</td><td class="num"><b>${(r.c + w * r.f).toFixed(2)}</b></td></tr>`).join("") + "</tbody>"; }
  $("#fmt-w").addEventListener("input", drawFmt); drawFmt();
});

/* which prompts teach: sixteen simulated groups at the slider's p, then the measured per-problem counts */
later(function teach() {
  const mixed = (p, G) => 1 - p ** G - (1 - p) ** G, GS = [4, 8, 16, 32];
  check("teach-check", Object.entries(D.grpo.mixed_prob).every(([p, row]) => Object.entries(row).every(([G, v]) => close(mixed(+p, +G), v, 1e-4))), "1 − pᴳ − (1 − p)ᴳ = the notebook's table");
  let seed = 7;
  const rng = s0 => () => { s0 |= 0; s0 = s0 + 0x6D2B79F5 | 0; let t = Math.imul(s0 ^ s0 >>> 15, 1 | s0); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  function draw() {
    const p = +$("#teach-p").value, G = GS[+$("#teach-g").value]; $("#teach-p-v").textContent = p.toFixed(2); $("#teach-g-v").textContent = G;
    const R = rng(seed), rows = 16, cell = Math.min(15, 430 / G), W = 120 + G * cell + 150, H = rows * 21 + 8, s = svg(W, H);
    let teach = 0;
    for (let i = 0; i < rows; i++) { const y = 4 + i * 21, g = Array.from({ length: G }, () => R() < p ? 1 : 0), k = g.reduce((a, x) => a + x, 0), ok = k > 0 && k < G; if (ok) teach++;
      txt(s, 8, y + 13, `prompt ${i + 1}`, { anchor: "start", fs: 11.5, mono: 1, color: css("--ink-3") });
      g.forEach((v, j) => s.appendChild(el("circle", { cx: 120 + j * cell + cell / 2, cy: y + 9, r: Math.max(2.5, cell / 2 - 1.5), fill: v ? css("--good") : css("--bad"), opacity: ok ? 0.9 : 0.35 })));
      txt(s, 120 + G * cell + 12, y + 13, ok ? `${k}/${G} · teaches` : k ? "all ✓ · A = 0" : "all ✗ · A = 0", { anchor: "start", fs: 11.5, bold: ok, color: ok ? css("--ink") : css("--ink-3") }); }
    const h = $("#fig-teach"); h.innerHTML = ""; h.appendChild(s);
    $("#teach-out").innerHTML = stat(`${teach} / ${rows}`, "prompts that teach, drawn") + stat(pct(mixed(p, G)) + "%", "expected by the formula") + stat(num(rows * G), "generations paid for");
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
    txt(s, L + 4, B + 34, "never solved · too hard", { anchor: "start", fs: 11.5, italic: 1, color: css("--bad") });
    txt(s, L + (n + 1) * bw - 4, B + 34, "always solved · too easy", { anchor: "end", fs: 11.5, italic: 1, color: css("--bad") });
    txt(s, L + (n + 1) * bw / 2, B + 34, `right answers out of ${n}`, { fs: 11.5, color: css("--ink-3") });
    const h = $("#fig-teach-hist"); h.innerHTML = ""; h.appendChild(s);
  }
  states("teach-stage", null, m => { stage = m; hist(); });
  hist(); REDRAW.push(hist);
  $("#teach-note").innerHTML = TXT("teach-note", { n: P.n_problems, samples: P.n, base0: pct(S.base.all_wrong), rlvr1: pct(S.RLVR.all_right),
    sftFlat: pct(S.SFT.all_wrong + S.SFT.all_right), rlvrFlat: pct(S.RLVR.all_wrong + S.RLVR.all_right) });
});

/* pass@k: the notebook's unbiased estimator over the per-problem counts */
const passAtK = (n, c, k) => { if (n - c < k) return 1; let p = 1; for (let i = n - c + 1; i <= n; i++) p *= 1 - k / i; return 1 - p; };
later(function passk() {
  const P = D.passk, S = P.stages, names = Object.keys(S), COL = { base: "--ink-3", SFT: "--cls-0", DPO: "--cls-1", RLVR: "--cls-2" };
  const curve = s => P.ks.map(k => S[s].correct.reduce((a, c) => a + passAtK(P.n, c, k), 0) / S[s].correct.length);
  check("passk-check", names.every(s => curve(s).every((v, i) => close(v, S[s].curve[i], 1e-4))), "every pass@k = Python's");
  $("#passk-meta").textContent = `${P.n_problems} problems, ${P.n} samples each at T = ${P.temperature}`;
  $("#passk-k").max = P.ks.length - 1;
  const kmax = P.ks.length - 1, last = s => S[s].curve[kmax];
  const others = names.filter(s => s !== "RLVR"), near = others.filter(s => last("RLVR") - last(s) < 0.02);
  const bet = makeBet("#bet-passk", [...others, "neither"], near.length ? others.indexOf(near[0]) : others.length);
  function draw() {
    const ki = +$("#passk-k").value, k = P.ks[ki]; $("#passk-k-v").textContent = k;
    const Pl = plot($("#fig-passk"), { w: 520, h: 310, x: [1, P.ks[kmax]], y: [0, 1], logx: 1, xt: P.ks, yt: [0, 0.25, 0.5, 0.75, 1], xl: "k · answers per problem", yl: "pass@k",
      series: names.map(s => ({ pts: P.ks.map((kk, i) => [kk, S[s].curve[i]]), color: css(COL[s]), dots: 1 })) });
    names.forEach(s => txt(Pl.s, Pl.X(P.ks[kmax]) - 4, Pl.Y(last(s)) + (s === "SFT" ? 16 : -8), s, { fs: 12, bold: 1, anchor: "end", color: css(COL[s]) }));
    line(Pl.s, Pl.X(k), Pl.T, Pl.X(k), Pl.H - Pl.B, { color: css("--ink"), sw: 1.2 });
    $("#passk-vals").innerHTML = names.map(s => stat(S[s].curve[ki].toFixed(3), `${s} · pass@${k}`)).join("");
    const O = P.overlap;
    $("#passk-hist").innerHTML = `<div class="hm-title">the ${O.base_never} problems the base never solved in ${P.n} tries</div>` +
      [["solved by SFT", O.base_never_sft_solves, "--cls-0"], ["solved by RLVR", O.base_never_rlvr_solves, "--cls-2"]].map(([l, v, c]) =>
        `<div class="pbar"><span class="lab">${l}</span><span class="bar"><i style="width:${pct(v / O.base_never, 1)}%;background:var(${c})"></i></span><span class="v">${v}</span></div>`).join("");
  }
  $("#passk-k").addEventListener("input", draw);
  reveal("btn-passk-reveal", ["passk-out"], "passk-note", [bet], () => { draw(); REDRAW.push(draw); });
  const O = P.overlap;
  $("#passk-note").innerHTML = TXT("passk-note", { rlvr1: S.RLVR.curve[0].toFixed(2), sft1: S.SFT.curve[0].toFixed(2), base1: S.base.curve[0].toFixed(2), kmax: P.ks[kmax],
    baseK: last("base").toFixed(2), rlvrK: last("RLVR").toFixed(2), sftK: last("SFT").toFixed(2), gap1: (S.RLVR.curve[0] - S.SFT.curve[0]).toFixed(2), gapK: (last("RLVR") - last("SFT")).toFixed(2),
    baseNever: O.base_never, n: P.n, rlvrSolves: O.base_never_rlvr_solves, sftSolves: O.base_never_sft_solves });
});

/* thinking: the same weights, two templates */
later(function think() {
  const T = D.think, on = T.modes.thinking, off = T.modes["no thinking"];
  $("#think-meta").textContent = `${T.n} GSM8K problems`;
  const RATIOS = [2, 6, 20], bet = makeBet("#bet-think", RATIOS.map(r => `×${r} tokens`), RATIOS.reduce((b, r, i) => Math.abs(Math.log(r / T.ratio)) < Math.abs(Math.log(RATIOS[b] / T.ratio)) ? i : b, 0));
  let mode = "thinking";
  function draw() {
    const bins = 32, top = on.budget, step = top / bins, hist = ts => { const h = new Array(bins).fill(0); ts.forEach(t => { h[Math.min(bins - 1, Math.floor(t / step))]++; }); return h; };
    const hOn = hist(on.tokens), hOff = hist(off.tokens), mx = Math.max(...hOn, ...hOff);
    const s = svg(520, 290), L = 40, B = 250, Wd = 460, Hh = 210, bw = Wd / bins;
    [[hOff, "--cls-0", "no thinking"], [hOn, "--cls-2", "thinking"]].forEach(([h, c, m]) => h.forEach((v, i) => { if (v) rect(s, L + i * bw + 1, B - v / mx * Hh, bw - 2, v / mx * Hh, { fill: css(c), op: mode === m ? 0.85 : 0.3, rx: 1 }); }));
    line(s, L, B, L + Wd, B, { color: css("--rule-strong") });
    [0, 512, 1024, 1536, 2048].filter(t => t <= top).forEach(t => txt(s, L + t / top * Wd, B + 16, t, { fs: 11, mono: 1, color: css("--ink-3") }));
    [[off.budget, "--cls-0"], [on.budget, "--cls-2"]].forEach(([b, c]) => { const x = L + Math.min(b, top) / top * Wd - 1; line(s, x, 20, x, B, { color: css(c), dash: 1, sw: 1.4 }); txt(s, x - 4, 30, `budget ${b}`, { fs: 11, mono: 1, anchor: "end", color: css(c) }); });
    txt(s, L + Wd / 2, 284, "tokens written per answer", { fs: 12, color: css("--ink-3") });
    const h = $("#fig-think"); h.innerHTML = ""; h.appendChild(s);
    const m = T.modes[mode];
    $("#think-stats").innerHTML = stat(m.accuracy.toFixed(3), `${mode} · accuracy`) + stat(Math.round(m.mean), "tokens, mean") + stat(pct(m.ran_out) + "%", "ran into the budget") + stat(Math.round(m.seconds / 60) + " min", `${T.n} problems on a ${T.device === "cuda" ? "T4" : T.device}`);
    $("#think-trace").textContent = m.demo;
    $("#fig-template").innerHTML = `<div class="hm-title">what the template puts after the question</div><div class="pieces">` +
      (mode === "thinking" ? '<span class="tok sp">&lt;|im_start|&gt;assistant↵</span><span class="tok ans">&lt;think&gt; … the model writes this … &lt;/think&gt;</span><span class="tok ans">the answer</span>'
        : '<span class="tok sp">&lt;|im_start|&gt;assistant↵</span><span class="tok mk">&lt;think&gt;↵↵&lt;/think&gt;↵↵</span><span class="tok ans">the answer</span><span class="lab" style="margin-left:8px">the empty pair is written by the template, not the model</span>') + "</div>";
  }
  states("think-mode", null, m => { mode = m; if (!$("#think-out").hidden) draw(); });
  reveal("btn-think-reveal", ["think-out"], "think-note", [bet], () => { draw(); REDRAW.push(draw); });
  $("#think-note").innerHTML = TXT("think-note", { accOn: on.accuracy.toFixed(3), tokOn: Math.round(on.mean), ranOut: pct(on.ran_out), budgetOn: on.budget, accOff: off.accuracy.toFixed(3), tokOff: Math.round(off.mean),
    ratio: T.ratio.toFixed(1), gain: (on.accuracy - off.accuracy).toFixed(3) });
});

/* ===================================================================== 04 recipes */
later(function recipes() {
  // [label, type, who wrote the tokens, tooltip]; who: other = someone else, before = the model, before the stage; self = the model, at every step
  const R = [
    { name: "Tülu 3 · OLMo 2", year: "2024–25", st: [["SFT", "sft", "other", "the Tülu 3 mixture: human-written and teacher-written answers"], ["DPO, length-normalised", "pref", "before", "pairs: answers of the SFT model and of other models, judged once, before training"], ["RLVR", "rl", "self", "maths and instruction following with a checker; PPO in Tülu 3, GRPO for OLMo 2 1B"]] },
    { name: "DeepSeek-R1", year: "Jan 2025", st: [["cold-start SFT", "sft", "other", "thousands of curated long chains of thought"], ["reasoning RL · GRPO", "rl", "self", "rule-based rewards + a language-consistency reward"], ["rejection sampling, SFT", "sft", "before", "~600k verified reasoning samples of the stage-2 model + ~200k general; the base is fine-tuned on them again"], ["RL, all scenarios", "rl", "self", "checkers where an answer can be checked, reward models where it cannot"]] },
    { name: "R1-Zero", sub: 1, st: [["RL from the base · GRPO", "rl", "self", "no SFT before it: long reasoning appears by itself — in mixed languages"]] },
    { name: "R1-Distill", sub: 1, st: [["SFT on R1's 800k", "distill", "other", "Qwen2.5 and Llama students, sequence distillation, no RL stage"]] },
    { name: "Qwen3", year: "May 2025", st: [["long-CoT cold start", "sft", "other", "SFT on verified maths, code, logic, STEM"], ["reasoning RL · GRPO", "rl", "self", "about four thousand query–verifier pairs"], ["thinking-mode fusion", "sft", "before", "SFT that merges /think and /no_think; thinking data by rejection sampling from the stage-2 model"], ["general RL", "rl", "self", "20+ tasks: instruction following, format, preferences, agents"]] },
    { name: "Qwen3 ≤ 14B", sub: 1, st: [["off-policy distillation", "distill", "other", "the teacher's answers in both modes"], ["on-policy distillation", "distill", "self", "the student writes, its logits are pulled to the teacher's (KL)"]] },
    { name: "Olmo 3 Think", year: "Nov 2025", st: [["SFT", "sft", "other", "Dolci Think SFT: synthetic long thinking traces"], ["DPO · delta learning", "pref", "other", "pairs of a stronger and a weaker model's answers: the gap teaches even when both are weak"], ["RLVR · OlmoRL", "rl", "self", "verifiable and non-verifiable domains; asynchronous, active sampling"]] },
    { name: "Olmo 3 Instruct", sub: 1, st: [["SFT", "sft", "other", "Dolci Instruct SFT, with function calling"], ["DPO", "pref", "other", "delta-learning pairs, multi-turn, length controls"], ["RL", "rl", "self", "short answers, no thinking traces"]] },
    { name: "Olmo 3 RL-Zero", sub: 1, st: [["RLVR from the base", "rl", "self", "maths, code, instruction following, general — one run per domain"]] },
  ];
  const TYPE = { sft: ["--cls-0", "SFT"], pref: ["--cls-1", "preferences"], rl: ["--cls-2", "RL"], distill: ["--cls-3", "distillation"] };
  const WHO = { other: ["--cls-3", "someone else wrote them: a human, a teacher, other models"], before: ["--cls-1", "the model wrote them, before the stage"], self: ["--cls-2", "the model writes them at every step"] };
  let mode = "type";
  function draw() {
    const rowH = 44, W = 940, X0 = 150, H = R.length * rowH + 14, s = svg(W, H);
    R.forEach((r, i) => { const y = 10 + i * rowH;
      if (!r.sub && i) line(s, 8, y - 6, W - 8, y - 6, { color: css("--rule") });
      txt(s, r.sub ? 22 : 10, y + 20, (r.sub ? "↳ " : "") + r.name, { anchor: "start", fs: r.sub ? 12 : 14, bold: !r.sub, color: r.sub ? css("--ink-2") : css("--ink") });
      if (r.year) txt(s, 10, y + 35, r.year, { anchor: "start", fs: 11, mono: 1, color: css("--ink-3") });
      let x = X0; const bw = (W - X0 - 10 - (4 - 1) * 26) / 4;
      r.st.forEach(([l, t, w, tip], j) => { const c = mode === "type" ? TYPE[t][0] : WHO[w][0];
        const b = rect(s, x, y + 4, bw, 30, { fill: TINT(c, 20), stroke: css(c), sw: 1.4 });
        tipOn(b, `<b>${esc(l)}</b><br>${esc(tip)}<br><span style="opacity:.7">${TYPE[t][1]} · ${WHO[w][1]}</span>`);
        txt(s, x + bw / 2, y + 23.5, l, { fs: 11.5, color: css("--ink") }).style.pointerEvents = "none";
        if (j < r.st.length - 1) arrow(s, x + bw + 2, y + 19, x + bw + 22, y + 19, { color: css("--ink-3") });
        x += bw + 26; });
    });
    const h = $("#fig-recipes"); h.innerHTML = ""; h.appendChild(s);
    h.insertAdjacentHTML("beforeend", `<div class="legend">${Object.values(mode === "type" ? TYPE : WHO).map(([c, l]) => `<span><i class="sw" style="background:${TINT(c, 20)};border-color:var(${c})"></i>${l}</span>`).join("")}</div>`);
  }
  states("recipes-mode", null, m => { mode = m; draw(); });
  draw(); REDRAW.push(draw);
});

/* what a verified-teacher filter keeps: 1 − (1 − p)^K */
later(function filter() {
  const keep = (p, K) => 1 - (1 - p) ** K;
  check("filter-check", Object.entries(D.filter).every(([p, row]) => Object.entries(row).every(([K, v]) => close(keep(+p, +K), v, 1e-4))), "1 − (1 − p)ᴷ = the notebook's numbers");
  function draw() {
    const K = +$("#filter-k").value; $("#filter-k-v").textContent = K;
    const s = svg(520, 200), PS = [[0.9, "easy · p = 0.9", "--cls-2"], [0.5, "middle · p = 0.5", "--cls-0"], [0.1, "hard · p = 0.1", "--cls-1"]];
    PS.forEach(([p, l, c], i) => { const y = 20 + i * 56, v = keep(p, K);
      txt(s, 10, y + 18, l, { anchor: "start", fs: 13, color: css("--ink") });
      rect(s, 160, y, 300, 26, { fill: css("--panel-sunk") }); rect(s, 160, y, 300 * v, 26, { fill: css(c), op: 0.8 });
      txt(s, 468, y + 18, pct(v) + "%", { anchor: "start", fs: 12.5, mono: 1, color: css("--ink") });
      txt(s, 160, y + 42, `${(K * p).toFixed(1)} verified solutions per problem, on average`, { anchor: "start", fs: 11, color: css("--ink-3") }); });
    const h = $("#fig-filter"); h.innerHTML = ""; h.appendChild(s);
    $("#filter-out").innerHTML = stat(pct(keep(0.9, K)) + "%", "easy problems kept") + stat(pct(keep(0.1, K)) + "%", "hard problems kept") + stat((0.9 / 0.1).toFixed(0) + "×", "more solutions per easy problem");
    $("#filter-note").innerHTML = TXT("filter-note", { K, easy: pct(keep(0.9, K), 2), hard: pct(keep(0.1, K)) });
  }
  $("#filter-k").addEventListener("input", draw); draw(); REDRAW.push(draw);
});

/* every block is queued by now: start right away, without waiting for fonts or the load event */
setTimeout(runLater, 0);
