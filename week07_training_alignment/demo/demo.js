"use strict";
/* week 7 — the interactive part. demo_base/base.js (TXT) is prepended at build; the data is in #demo-data. */
const D = JSON.parse(document.getElementById("demo-data").textContent);

/* --------------------------------------------------------------- helpers (week 6) */
const $ = (s, r) => (r || document).querySelector(s);
const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
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
const TINT = (v, pct) => `color-mix(in srgb, var(${v}) ${pct}%, var(--panel))`;
function txt(s, x, y, t, o) { o = o || {}; return s.appendChild(el("text", { x, y, "font-size": o.fs || 13.5, "text-anchor": o.anchor || "middle", fill: o.color || css("--ink-2"), "font-weight": o.bold ? "600" : "400", "font-style": o.italic ? "italic" : "normal", "font-family": o.mono ? "var(--mono)" : "inherit" }, t)); }
function arrow(s, x1, y1, x2, y2, o) { o = o || {}; const color = o.color || css("--ink-2"), id = "arr-" + String(color).replace(/[^a-z0-9]/gi, "");
  if (!s.querySelector("#" + id)) { let defs = s.querySelector("defs"); if (!defs) { defs = el("defs", {}); s.appendChild(defs); } const m = el("marker", { id, viewBox: "0 0 10 10", refX: 9, refY: 5, markerWidth: 6, markerHeight: 6, orient: "auto-start-reverse" }); m.appendChild(el("path", { d: "M 0 0 L 10 5 L 0 10 z", fill: color })); defs.appendChild(m); }
  s.appendChild(el("path", { d: o.d || `M ${x1} ${y1} L ${x2} ${y2}`, fill: "none", stroke: color, "stroke-width": o.sw || 1.6, "stroke-dasharray": o.dash ? "4 4" : "none", "marker-end": o.noHead ? "none" : `url(#${id})` })); }

const REDRAW = [];
function redrawAll() { REDRAW.forEach(f => { try { f(); } catch (_) { } }); }
$("#btn-theme").addEventListener("click", () => { const cur = document.documentElement.getAttribute("data-theme"); const dark = cur ? cur === "dark" : matchMedia("(prefers-color-scheme: dark)").matches; document.documentElement.setAttribute("data-theme", dark ? "light" : "dark"); redrawAll(); });
$("#btn-present").addEventListener("click", e => { document.body.classList.toggle("present"); e.target.classList.toggle("on", document.body.classList.contains("present")); });

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
    const s = svg(W, H); s.style.maxWidth = W + "px";
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
