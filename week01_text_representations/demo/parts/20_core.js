"use strict";
const D = JSON.parse(document.getElementById("demo-data").textContent);
const CN = D.classNames;

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
function u16(s) {
  const b = b64bytes(s);
  return new Uint16Array(b.buffer, b.byteOffset, b.byteLength / 2);
}

/* --------------------------------------------------------------- helpers */
const $ = (s, r) => (r || document).querySelector(s);
const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const fmt = (x, d) => x == null ? "—" : Number(x).toFixed(d === undefined ? 4 : d);
const pct = x => (100 * x).toFixed(0) + "%";
const clsChip = i => `<span class="chip"><span class="dot c${i}"></span>${CN[i]}</span>`;

/* sklearn's default analyzer: lowercase, r"(?u)\b\w\w+\b" */
const TOKPAT = /[A-Za-z0-9_À-ɏЀ-ӿ]{2,}/g;
function analyze(text, ngram) {
  const uni = (String(text).toLowerCase().match(TOKPAT) || []);
  if (!ngram || ngram < 2) return uni;
  const out = uni.slice();
  for (let i = 0; i + 1 < uni.length; i++) out.push(uni[i] + " " + uni[i + 1]);
  return out;
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
/* Colours go in as `var(--token)` so the drawing follows the viewer's theme
   without being repainted — presentation attributes cannot hold var(), so any
   paint value that is a custom property is moved into inline style instead. */
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
  node.addEventListener("pointerenter", e => {
    TIP.innerHTML = html;
    TIP.style.opacity = "1";
    moveTip(e);
  });
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

/* Greedy label placement: skip a label whose box hits one already placed. */
function placeLabels(items, put, minDx, minDy, fs) {
  const done = [];
  for (const it of items) {
    // The box has to be measured at the size the label is actually drawn at,
    // otherwise the collision test passes and the labels still overlap.
    const cw = it.cw || (fs ? fs * 0.6 : 7);
    const w = (it.text.length * cw) + 10, h = minDy || (fs ? fs * 1.15 : 11);
    const box = [it.x, it.y - h / 2, it.x + w, it.y + h / 2];
    let clash = false;
    for (const b of done) {
      if (box[0] < b[2] + (minDx || 2) && box[2] > b[0] - (minDx || 2) &&
        box[1] < b[3] + 2 && box[3] > b[1] - 2) { clash = true; break; }
    }
    if (clash) continue;
    done.push(box);
    put(it);
  }
}

/* ------------------------------------------------------------------ nav */
const SECTIONS = [
  ["hero", "The bet", null],
  ["label", "Label twelve yourself", "00"],
  ["tokens", "Tokenization", "01"],
  ["prep", "Preprocessing", "02"],
  ["tfidf", "Building TF-IDF", "03"],
  ["train", "Watch it learn", "04"],
  ["weights", "Reading the weights", "05"],
  ["attack", "Break the model", "06"],
  ["skipgram", "Skip-gram, live", "07"],
  ["space", "The embedding space", "08"],
  ["llm", "Asking an LLM", "09"],
  ["table", "The results table", "10"],
  ["ceiling", "The ceiling", "11"],
];
(function buildNav() {
  const nav = $("#nav");
  nav.innerHTML = SECTIONS.map(([id, t, n]) =>
    `<a href="#${id}" data-id="${id}"><span>${n === null ? "·" : n}</span><span>${esc(t)}</span></a>`).join("");
  const links = $$("#nav a");
  const io = new IntersectionObserver(ents => {
    ents.forEach(e => {
      if (e.isIntersecting) {
        links.forEach(a => a.classList.toggle("on", a.dataset.id === e.target.id));
      }
    });
  }, { rootMargin: "-15% 0px -70% 0px" });
  SECTIONS.forEach(([id]) => { const n = document.getElementById(id); if (n) io.observe(n); });
})();

/* theme + presentation mode */
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

/* charts that must be repainted when the palette changes */
const REDRAW = [];
function redrawAll() { REDRAW.forEach(f => { try { f(); } catch (_) { } }); }
function css(name) { return `var(${name})`; }
