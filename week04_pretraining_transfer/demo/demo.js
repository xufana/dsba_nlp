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
  const xlog = !!o.xlog; const tx = v => xlog ? Math.log10(v) : v;
  let x0 = o.xmin != null ? o.xmin : Math.min(...xs), x1 = o.xmax != null ? o.xmax : Math.max(...xs);
  let y0 = o.ymin != null ? o.ymin : Math.min(...ys), y1 = o.ymax != null ? o.ymax : Math.max(...ys);
  if (o.ymin == null) { const p = (y1 - y0) * 0.08 || 1; y0 -= p; y1 += p; }
  if (x0 === x1) { x0 -= 1; x1 += 1; }
  const X = v => L + (tx(v) - tx(x0)) / (tx(x1) - tx(x0)) * (W - L - R);
  const Y = v => H - B - (v - y0) / (y1 - y0) * (H - T - B);
  const yt = o.yticks || linTicks(y0, y1, 5);
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
  o.series.forEach(sr => {
    const pts = sr.x.map((x, i) => [x, sr.y[i]]).filter(p => p[1] != null && isFinite(p[1]));
    if (pts.length > 1) s.appendChild(el("polyline", { points: pts.map(p => `${X(p[0]).toFixed(1)},${Y(p[1]).toFixed(1)}`).join(" "), fill: "none", stroke: sr.color || css("--ink"), "stroke-width": 2.2, "stroke-dasharray": sr.dash ? "6 5" : "none", "stroke-linejoin": "round" }));
    pts.forEach(p => { const c = el("circle", { cx: X(p[0]), cy: Y(p[1]), r: 4, fill: sr.color || css("--ink"), stroke: sr.color || css("--ink"), "stroke-width": 2 }); if (sr.tip) tipOn(c, sr.tip(p[0], p[1])); s.appendChild(c);
      if (sr.labels) s.appendChild(el("text", { x: X(p[0]), y: Y(p[1]) - 10, "font-size": fs - 1, "text-anchor": "middle", fill: css("--ink-2") }, sr.labels[sr.x.indexOf(p[0])])); });
  });
  let lx = L + 12, ly = T + 4 + fs;
  o.series.filter(sr => sr.label).forEach(sr => { s.appendChild(el("line", { x1: lx, x2: lx + 26, y1: ly - fs * .35, y2: ly - fs * .35, stroke: sr.color || css("--ink"), "stroke-width": 2.5, "stroke-dasharray": sr.dash ? "6 5" : "none" }));
    s.appendChild(el("text", { x: lx + 34, y: ly, "font-size": fs, fill: css("--ink-2") }, sr.label)); ly += fs + 6; });
  host.appendChild(s); return { X, Y, s };
}
function linTicks(a, b, n) { const span = b - a, raw = span / n, mag = Math.pow(10, Math.floor(Math.log10(raw))); const step = [1, 2, 2.5, 5, 10].map(m => m * mag).find(st => span / st <= n + 1) || mag; const out = []; for (let v = Math.ceil(a / step) * step; v <= b + 1e-9; v += step) out.push(+v.toFixed(10)); return out; }
function logTicks(a, b) { const out = []; for (let e = Math.floor(Math.log10(a)); e <= Math.ceil(Math.log10(b)); e++) { const v = Math.pow(10, e); if (v >= a && v <= b) out.push(v); } return out; }
function tickFmt(v) { if (Math.abs(v) >= 1e6) return +(v / 1e6).toFixed(1) + "M"; if (Math.abs(v) >= 1000) return +(v / 1000).toFixed(1) + "k"; if (Math.abs(v) >= 10 || v === 0) return String(Math.round(v * 10) / 10); return String(+v.toPrecision(3)); }
function probBars(host, rows, o) {
  host.innerHTML = rows.map(r => `<div class="pbar${r.kept === false ? " cut" : ""}"><span class="lab" title="${esc(r.label)}">${esc(r.label)}</span><span class="bar"><i style="width:${(100 * r.p / (o && o.max || 1)).toFixed(1)}%"></i></span><span class="v">${r.text != null ? r.text : (r.p < 0.001 ? r.p.toExponential(1) : r.p.toFixed(3))}</span></div>`).join("");
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
function reveal(btnId, outIds, noteId, bets) {
  $("#" + btnId).addEventListener("click", e => { (bets || []).forEach(b => b.reveal()); outIds.forEach(id => { const n = $("#" + id); if (n) n.hidden = false; }); if (noteId) $("#" + noteId).hidden = false;
    const veil = e.target.closest(".panel").querySelector(".veil"); if (veil) veil.remove(); e.target.disabled = true; e.target.textContent = "revealed";
    document.dispatchEvent(new CustomEvent("revealed", { detail: btnId })); });
}
function table(host, cols, rows) {
  host.innerHTML = `<thead><tr>${cols.map(c => `<th class="${c.num ? "num" : ""}">${c.h}</th>`).join("")}</tr></thead><tbody>` +
    rows.map(r => `<tr class="${r._hl ? "hl" : ""}">${cols.map(c => `<td class="${c.num ? "num" : ""}${c.mono ? " mono" : ""}">${c.f(r)}</td>`).join("")}</tr>`).join("") + "</tbody>";
}
const stat = (v, k) => `<div class="stat"><span class="v">${v}</span><span class="k">${k}</span></div>`;
const tok = (t, cls) => `<span class="tok ${cls || ""}">${esc(t)}</span>`;

/* ------------------------------------------------------------------ nav */
const SECTIONS = [["hero", "The claim", null], ["stop", "Where we stopped", "00"], ["tok", "Three tokenizers", "01"], ["bert", "BERT", "02"], ["head", "The head", "03"], ["dial", "Transfer is a dial", "04"], ["tasks", "NER and QA", "05"], ["end", "Where this goes", "06"]];
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

/* =============================================================== 00 stop */
const DATA = D.data, RES = D.results, CLS = DATA.classes;
$("#data-split").textContent = `${num(DATA.nTrain)} train · ${num(DATA.nTest)} test · ${CLS.length} classes`;
$("#data-example").innerHTML = `<p style="margin:0 0 8px">${esc(DATA.example.text)}</p><span class="chip"><span class="dot c${DATA.example.label}"></span>label ${DATA.example.label} = ${esc(CLS[DATA.example.label])}</span>`;
const RES_COLS = [{ h: "model", f: r => esc(r.model) }, { h: "trainable params", num: 1, f: r => esc(r["trainable params"]) }, { h: "test acc", num: 1, f: r => `<b>${fmt(r["test acc"], 4)}</b>` }, { h: "train s", num: 1, f: r => r["train s"] == null ? "—" : num(r["train s"]) }, { h: "note", mono: 1, f: r => `<span style="font-size:13.5px">${esc(r.note)}</span>` }];
table($("#results-0"), RES_COLS, [Object.assign({ _hl: 1 }, RES[0])]);


/* ============================================================ 01 tokenizers */
const TK = D.tok;
function mergeRows(host, merges, wp) {
  host.innerHTML = merges.slice(0, 12).map((m, i) => `<div class="merge-row${wp ? " wp" : ""}"><span class="n">${i + 1}</span><span class="p">${tok(m[0])} + ${tok(m[1])} → ${tok(m[0] + (wp ? m[1].replace(/^##/, "") : m[1]), "new")}</span><span class="c">${num(m[2])}${wp ? ` <small>/ ${num(m[3])}·${num(m[4])}</small>` : ""}</span></div>`).join("");
}
mergeRows($("#merges-bpe"), TK.bpeMerges, false); mergeRows($("#merges-wp"), TK.wpMerges, true);
const betTok = makeBet("#bet-tok-first", ["yes, s + </w> again", "no — a frequent bigram like th / in", "no — pieces whose parts are rare on their own"], 2);
reveal("btn-tok-reveal", ["tok-out"], "tok-note", [betTok]);

const fracDis = TK.nDisagree / TK.nTestWords;
const betEnc = makeBet("#bet-enc", ["none — same vocabulary, same result", "under 1%", "about 5%", "about 20%"], fracDis < 0.01 ? 1 : fracDis < 0.1 ? 2 : 3);
$("#enc-out").innerHTML = `<div class="stat-row" style="margin-bottom:12px">${stat(num(TK.nDisagree) + " / " + num(TK.nTestWords), "words where they disagree")}${stat(pct(fracDis, 1), "of the test words")}</div>` +
  TK.disagree.map(d => `<div class="enc-row diff"><span class="k">${esc(d.word)}</span><span><div class="pieces"><span class="lab">replay</span>${d.replay.map(p => tok(p, p.startsWith("##") ? "cont" : "")).join("")}<span class="gap"></span><span class="lab">longest</span>${d.longest.map(p => tok(p, p.startsWith("##") ? "cont" : "")).join("")}</div></span></div>`).join("");
reveal("btn-enc-reveal", ["enc-out"], "enc-note", [betEnc]);

REDRAW.push(() => lineChart($("#uni-chart"), { W: 520, H: 300, L: 90, fs: 13.5, series: [{ x: TK.llCurve.map(p => p[0]), y: TK.llCurve.map(p => p[1]), color: css("--cls-1"), label: "corpus log-likelihood", tip: (x, y) => `vocabulary ${num(x)}<br>log-likelihood ${num(y)}` }], xlabel: "vocabulary size (pruned by a fifth each round)", ylabel: "corpus log-likelihood", yfmt: v => tickFmt(v) }));
$("#uni-segs").innerHTML = `<div class="figcap">Viterbi segmentation · and how many segmentations the word has</div>` + TK.uniExamples.map(e => `<div class="seg-row best"><span class="p">${e.n} segs</span><span class="pieces">${e.viterbi.map(p => tok(p)).join("")}<span class="lab" style="margin-left:8px">log p ${e.score.toFixed(1)}</span></span></div>`).join("") + `<pre class="code" style="margin-top:12px;font-size:13px;white-space:pre-wrap">${esc(TK.cellOut.segs)}</pre>`;

const ZOO = D.zoo;
$("#zoo").innerHTML = ZOO.texts.map((t, ti) => `<p style="margin:0 0 6px"><b>${esc(t)}</b></p>` + ZOO.names.map((n, ni) => { const toks = ZOO.tokens[ti][ni]; return `<div class="enc-row"><span class="k">${esc(n)}<br><small>${toks.length} tokens</small></span><span class="pieces">${toks.map(p => tok(p, p.startsWith("##") ? "cont" : (p.startsWith("Ġ") || p.startsWith("▁")) ? "sp" : p === "[UNK]" ? "unk" : "")).join("")}</span></div>`; }).join("")).join("<div style='height:14px'></div>");

/* ============================================================ 02 bert */
const BODY = D.body, P = BODY.params;
$("#body-config").textContent = `${BODY.config.layers} blocks × ${BODY.config.heads} heads · d = ${BODY.config.d} · FFN ${BODY.config.ffn} · vocab ${num(BODY.config.vocab)}`;
probBars($("#body-params"), [["token embeddings", P.token_emb], ["position embeddings", P.position_emb], ["segment embeddings", P.segment_emb], ["12 blocks: attention", P.block_attention * 12], ["12 blocks: FFN", P.block_ffn * 12], ["pooler", P.pooler]].map(([l, v]) => ({ label: l, p: v / P.total, text: `${(v / 1e6).toFixed(1)}M · ${pct(v / P.total)}` })), { max: 0.6 });
$("#body-params").insertAdjacentHTML("beforeend", `<div class="small-note" style="margin-top:8px">total ${num(P.total)} · one block ${(P.block / 1e6).toFixed(2)}M</div>`);
(function posSim() {
  const n = BODY.posSim.n, v = f16(BODY.posSim.values), c = document.createElement("canvas"); c.width = n; c.height = n; c.style.width = "100%"; c.style.imageRendering = "pixelated";
  const ctx = c.getContext("2d"), img = ctx.createImageData(n, n);
  for (let i = 0; i < n * n; i++) { const t = Math.max(0, Math.min(1, (v[i] + 0.2) / 1.2)); img.data[4 * i] = 250 - 200 * t; img.data[4 * i + 1] = 250 - 150 * t; img.data[4 * i + 2] = 250 - 60 * t; img.data[4 * i + 3] = 255; }
  ctx.putImageData(img, 0, 0); $("#pos-sim").appendChild(c);
  $("#pos-sim").insertAdjacentHTML("beforeend", `<div class="small-note">cosine from ${BODY.posSim.min.toFixed(2)} (light) to 1 (dark)</div>`);
})();

const ZS = D.zeroShot, ZA = ZS.artifact.label_sets;
const betZs = makeBet("#bet-zs", ["about 0.30", "about 0.45", "about 0.60", "about 0.75"], null);   // the answer is scored from the picked words at reveal time (extra.js)
probBars($("#zs-top"), ZS.topWorld.slice(0, 8).map(([w, n]) => ({ label: w, p: n / ZS.topWorld[0][1], text: num(n) })), { max: 1 });


const FE = D.features;
const betProbe = makeBet("#bet-probe", ["pooler", "[CLS]", "mean of tokens", "you can't rank them"], 3);
$("#probe-out").innerHTML = `<div id="probe-fig"></div><div class="small-note" style="margin-top:8px">${TXT("probe-live", { n: num(FE.live.n), pooler: fmt(FE.live.summary.pooler, 3), cls: fmt(FE.live.summary.cls, 3), mean: fmt(FE.live.summary.mean, 3), n_train: num(FE.artifact.n_train), seconds: FE.artifact.encode_seconds })}</div>`;
reveal("btn-probe-reveal", ["probe-out"], "probe-note", [betProbe]);

/* ============================================================ 03 head */
const HD = D.heads;
$("#body-n").textContent = num(HD.body);
probBars($("#head-counts"), Object.entries(HD.counts).map(([k, v]) => ({ label: k, p: v / 7000, text: `${num(v)} · ${(100 * v / HD.body).toFixed(4)}%` })), { max: 1 });
$("#head-untrained").innerHTML = `<div class="figcap">an untrained head · ${num(HD.untrained.n)} test texts</div><div class="stat-row">${stat(fmt(HD.untrained.accuracy, 3), "accuracy")}${stat("0.25", "random")}</div><pre class="report" style="margin-top:12px">${esc(HD.loadReport.replace(/\x1b\[[0-9;]*m/g, "")).split("\n").filter(l => /MISSING|LOAD REPORT|Key|---/.test(l)).join("\n").replace(/MISSING/g, '<span class="miss">MISSING</span>')}\n<span class="unex">${TXT("head-untrained-unexpected")}</span></pre>`;
const HO = HD.headOnlyLive;
$("#ho-live-stats").textContent = `${num(HO.n)} texts · lr ${HO.lr} · ${num(HO.trainable)} trainable`;
$("#ho-live").innerHTML = `<div class="stat-row">${stat(fmt(HO.accuracy, 3), "test accuracy")}${stat(HO.seconds + "s", "one epoch")}${stat(fmt(FE.live.summary.pooler, 3), "pooler + logreg, same " + num(FE.live.n) + " texts")}</div>`;

/* ============================================================ 04 dial */
const betLayer = makeBet("#bet-layer", ["the last one", "somewhere in the middle", "flat after the first blocks", "the embeddings"], 2);
REDRAW.push(() => lineChart($("#layer-chart"), { W: 1000, H: 340, fs: 14, series: [
  { x: FE.artifact.by_layer.map((_, i) => i), y: FE.artifact.by_layer, color: css("--cls-1"), label: `logreg on the mean-pool, ${num(FE.artifact.n_train)} texts`, tip: (x, y) => `layer ${x}: ${fmt(y, 4)}` },
  { x: FE.live.byLayer.map((_, i) => i), y: FE.live.byLayer, color: css("--ink-3"), dash: 1, label: `live cell, ${num(FE.live.n)} texts`, tip: (x, y) => `layer ${x}: ${fmt(y, 4)}` }],
  xticks: FE.artifact.by_layer.map((_, i) => i), xlabel: "layer (0 = embeddings, 12 = last block)", ylabel: "test accuracy", hlines: [{ y: DATA.tfidf.accuracy, label: "TF-IDF, week 1", color: css("--bad") }], ymin: 0.78, ymax: 0.94 }));
reveal("btn-layer-reveal", ["layer-chart"], "layer-note", [betLayer]);

const TR = D.transfer, TRN = Object.keys(TR.runs);
$("#dial-n").textContent = num(TR.n_train);
const finalAcc = k => last(TR.runs[k].accuracy);
const passIdx = TRN.findIndex(k => finalAcc(k) >= DATA.tfidf.accuracy);
const betPass = makeBet("#bet-dial-pass", TRN.concat(["none of them"]), passIdx < 0 ? TRN.length : passIdx);
const gap = finalAcc("everything") - finalAcc("top 6 blocks");
const betGap = makeBet("#bet-dial-gap", ["under 0.5 points", "1–2 points", "3–5 points", "more than 5"], gap < 0.005 ? 0 : gap < 0.02 ? 1 : gap < 0.05 ? 2 : 3);
table($("#dial-table"), [{ h: "setting", f: r => `<b>${esc(r.k)}</b>` }, { h: "trainable", num: 1, f: r => num(r.trainable_params) }, { h: "of the body", num: 1, f: r => pct(r.trainable_params / r.total_params, 1) }, { h: "lr", num: 1, f: r => r.lr }, { h: "epoch 1", num: 1, f: r => fmt(r.accuracy[0], 4) }, { h: "epoch 2", num: 1, f: r => `<b>${fmt(last(r.accuracy), 4)}</b>` }, { h: "s / epoch", num: 1, f: r => num(Math.round(last(r.seconds))) }],
  TRN.map(k => Object.assign({ k, _hl: finalAcc(k) >= DATA.tfidf.accuracy }, TR.runs[k])));
let DIAL_HL = null;
function drawDialChart() {
  const c = lineChart($("#dial-chart"), { W: 520, H: 320, L: 70, fs: 13.5, xlog: 1, series: [{ x: TRN.map(k => TR.runs[k].trainable_params), y: TRN.map(finalAcc), color: css("--cls-1"), labels: TRN, tip: (x, y) => `${num(x)} params → ${fmt(y, 4)}` }], hlines: [{ y: DATA.tfidf.accuracy, label: "TF-IDF, week 1", color: css("--bad") }], xlabel: "trainable parameters", ylabel: "test accuracy", ymin: 0.82, ymax: 0.94 });
  if (DIAL_HL) { const r = TR.runs[DIAL_HL]; c.s.appendChild(el("circle", { cx: c.X(r.trainable_params), cy: c.Y(last(r.accuracy)), r: 9, fill: "none", stroke: css("--ink"), "stroke-width": 2 })); }
}
REDRAW.push(drawDialChart);
probBars($("#dial-bill"), TRN.map(k => ({ label: k, p: last(TR.runs[k].seconds), text: Math.round(last(TR.runs[k].seconds)) + " s" })), { max: Math.max(...TRN.map(k => last(TR.runs[k].seconds))) });
reveal("btn-dial-reveal", ["dial-out"], "dial-note", [betPass, betGap]);

/* ============================================================ 05 tasks */
const NER = D.ner, TAGS = DATA.nerTags;
const NL = NER.live;
$("#ner-live-n").textContent = num(NL.n);
const ratio = NL.entity_f1 / NL.token_acc;
const betNer = makeBet("#bet-ner", ["about the same as token accuracy", "10 points lower", "about half of it", "under a third of it"], ratio > 0.9 ? 0 : ratio > 0.75 ? 1 : ratio > 0.4 ? 2 : 3);
$("#ner-out").innerHTML = `<div class="stat-row">${stat(fmt(NL.token_acc, 3), "token accuracy")}${stat(fmt(NL.entity_f1, 3), "entity F1 (seqeval)")}${stat(NL.seconds + "s", "one epoch, " + num(NL.trainable) + " params")}</div><div class="small-note" style="margin-top:8px">${TXT("ner-live-note", { per: fmt(NL.f1_PER, 2), org: fmt(NL.f1_ORG, 2), loc: fmt(NL.f1_LOC, 2), misc: fmt(NL.f1_MISC, 2), n_test: num(NL.nTest), n: num(NL.n) })}</div>`;
reveal("btn-ner-reveal", ["ner-out"], "ner-note", [betNer]);
const NA = NER.artifact, NAN = Object.keys(NA.runs);
$("#ner-art-n").textContent = `${num(NA.n_train)} train · ${num(NA.n_test)} test sentences`;
table($("#ner-table"), [{ h: "setting", f: r => `<b>${esc(r.k)}</b>` }, { h: "trainable", num: 1, f: r => num(r.trainable_params) }, { h: "epochs", num: 1, f: r => r.epoch.length }, { h: "token acc", num: 1, f: r => fmt(last(r.token_acc), 3) }, { h: "entity F1", num: 1, f: r => `<b>${fmt(last(r.entity_f1), 3)}</b>` }, { h: "PER", num: 1, f: r => fmt(last(r.f1_PER), 2) }, { h: "ORG", num: 1, f: r => fmt(last(r.f1_ORG), 2) }, { h: "LOC", num: 1, f: r => fmt(last(r.f1_LOC), 2) }, { h: "MISC", num: 1, f: r => fmt(last(r.f1_MISC), 2) }, { h: "s / epoch", num: 1, f: r => num(Math.round(last(r.seconds))) }],
  NAN.map(k => Object.assign({ k }, NA.runs[k])));
$$("[data-ner-f1]").forEach(n => n.textContent = Math.round(100 * last(NA.runs["head only"].entity_f1)));
const QA = D.qa, WK = Object.keys(QA.windowsCheck);
$("#qa-win-btns").innerHTML = WK.map(k => `<button data-w="${k}">${k}</button>`).join("");
function showWindows(k) {
  $("#qa-win-sel").textContent = k.split("/")[0] + " (stride " + k.split("/")[1] + ")"; $$("#qa-win-btns button").forEach(b => b.classList.toggle("sel", b.dataset.w === k));
  $("#qa-windows").innerHTML = `<p style="margin:0 0 8px"><b>Q:</b> ${esc(QA.example.question)} <span class="mono" style="font-size:13.5px">answer '${esc(QA.example.answer)}' at character ${QA.example.answerStart}</span></p>` +
    QA.windowsCheck[k].map((w, wi) => `<div class="window"><div class="wh"><b>window ${wi}</b> · ${w.n} tokens · label (${w.start}, ${w.end}) ${w.start === 0 ? "→ [CLS], answer not here" : "→ '" + esc(w.tokens.slice(w.start, w.end + 1).join(" ").replace(/ ##/g, "")) + "'"}</div><div class="pieces">${w.tokens.map((t, i) => tok(t, i >= w.start && i <= w.end && w.start > 0 ? "ans" : /^\[/.test(t) ? "sp" : "")).join("")}</div></div>`).join("");
}
$("#qa-win-btns").addEventListener("click", e => { const b = e.target.closest("button[data-w]"); if (b) showWindows(b.dataset.w); });
showWindows(WK[0]);
const QL = QA.live; $("#qa-live-n").textContent = num(QL.n);
const betQa = makeBet("#bet-qa", ["about 70", "about 40", "about 20", "under 15"], QL.f1 > 55 ? 0 : QL.f1 > 30 ? 1 : QL.f1 > 15 ? 2 : 3);
const QAA = QA.artifact, QAN = Object.keys(QAA.runs);
$("#qa-out").innerHTML = `<div class="stat-row">${stat(QL.f1.toFixed(1), "token F1")}${stat(QL.exact_match.toFixed(1), "exact match")}${stat(QL.seconds + "s", num(QL.windows) + " windows, " + num(QL.trainable) + " params")}</div><div class="figcap" style="margin-top:14px">the artifacts · ${num(QAA.n_train)} questions (${num(QAA.n_train_windows)} windows), ${num(QAA.n_dev)} dev</div><div class="scroll-x"><table id="qa-table"></table></div>`;
table($("#qa-table"), [{ h: "setting", f: r => `<b>${esc(r.k)}</b>` }, { h: "trainable", num: 1, f: r => num(r.trainable_params) }, { h: "epochs", num: 1, f: r => r.epoch.length }, { h: "lr", num: 1, f: r => r.lr }, { h: "exact match", num: 1, f: r => fmt(last(r.exact_match), 1) }, { h: "F1", num: 1, f: r => `<b>${fmt(last(r.f1), 1)}</b>` }, { h: "s / epoch", num: 1, f: r => num(Math.round(last(r.seconds))) }], QAN.map(k => Object.assign({ k }, QAA.runs[k])));
reveal("btn-qa-reveal", ["qa-out"], "qa-note", [betQa]);
const QA_NO_ANSWER = q => /rector|admit/.test(q);        // the two QA_DEMO questions whose answer is not in the paragraph
$("#qa-preds").innerHTML = QA.predictions.examples.map((e, i) => `${i === 0 || e.context !== QA.predictions.examples[i - 1].context ? `<p class="ctx" style="margin:10px 0 6px;font-size:15.5px;color:var(--ink-2)">${esc(e.context)}</p>` : ""}<div class="qa-row"><span><span class="k">question</span>${esc(e.question)}</span><span><span class="k">predicted</span><b class="${QA_NO_ANSWER(e.question) ? "no" : ""}">${esc(e.pred)}</b></span><span><span class="k">gold</span>${e.gold && e.gold[0] ? esc(e.gold.join(" / ")) : QA_NO_ANSWER(e.question) ? '<span class="no">not in the paragraph</span>' : "—"}</span></div>`).join("");

redrawAll();

/* ====================================================== schematics and interactives (second pass, 2026-09-30) */
const code = (host, text) => { $(host).innerHTML = text.split("\n").map(l => `<span class="ln">${esc(l)}</span>`).join(""); };
/* a code panel whose lines carry a data-f token: hovering a line calls `on(f)` */
function codeF(host, text, tagger, on) {
  const h = $(host); h.innerHTML = text.split("\n").map(l => { const f = tagger(l); return `<span class="ln"${f ? ` data-f="${f}"` : ""}>${esc(l)}</span>`; }).join("");
  if (on) h.addEventListener("pointerover", e => { const ln = e.target.closest(".ln[data-f]"); if (ln) on(ln.dataset.f); });
}
/* a labelled box that never overflows: the label is measured (IBM Plex Mono ≈ 0.6 em per character);
   by default the font shrinks to fit the given width, with o.grow the box widens around its centre instead */
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
function states(btnsId, draw) {                       // a button row that switches what a figure highlights
  let mode = $(`#${btnsId} button.sel`).dataset.m; draw(mode); REDRAW.push(() => draw(mode));
  $(`#${btnsId}`).addEventListener("click", e => { const b = e.target.closest("button[data-m]"); if (!b) return; mode = b.dataset.m; $$(`#${btnsId} button`).forEach(x => x.classList.toggle("sel", x === b)); draw(mode); });
  return m => { mode = m; $$(`#${btnsId} button`).forEach(x => x.classList.toggle("sel", x.dataset.m === m)); draw(m); };
}
/* one encoder block, drawn the way week 3 drew it: attention, FFN, dashed residuals */
function encoderBlock(s, x, y, w, h, o) {
  o = o || {}; box(s, x, y, w, h, null, { fill: TINT("--cls-1", 7), stroke: css("--cls-1") });
  const iw = Math.min(260, w * .5), ix = x + w / 2 - iw / 2, hh = (h - 30) / 2;
  box(s, ix, y + h - 10 - hh, iw, hh, "self-attention · 12 heads", { fill: css("--panel"), fs: 12.5 });
  box(s, ix, y + 10, iw, hh, "FFN · 768 → 3072 → 768", { fill: css("--panel"), fs: 12.5 });
  s.appendChild(el("path", { d: `M ${ix - 14} ${y + h - 6} C ${ix - 40} ${y + h - 6} ${ix - 40} ${y + h / 2} ${ix - 14} ${y + h / 2}`, fill: "none", stroke: css("--ink-3"), "stroke-dasharray": "3 3" }));
  s.appendChild(el("path", { d: `M ${ix - 14} ${y + h / 2 - 2} C ${ix - 40} ${y + h / 2 - 2} ${ix - 40} ${y + 6} ${ix - 14} ${y + 6}`, fill: "none", stroke: css("--ink-3"), "stroke-dasharray": "3 3" }));
  txt(s, ix - 46, y + h / 2 + 4, "+", { fs: 13, color: css("--ink-3") });
  if (o.label) txt(s, x + w - 10, y + 16, o.label, { anchor: "end", fs: 12.5, color: css("--cls-1"), bold: 1 });
}

/* ---- 01 live tokenizer: replay the toy merges / longest-match on the same vocabulary */
(function liveTok() {
  const BPE = TK.bpeMerges, WP = TK.wpMerges;
  const chars = new Set(); TK.toyWords.forEach(([w]) => { for (const c of w) chars.add(c); });
  function replay(word, merges, k, wp) {
    let units = wp ? [...word].map((c, i) => i ? "##" + c : c) : [...word].concat(["</w>"]);
    for (const c of word) if (!chars.has(c)) return null;
    for (let m = 0; m < k; m++) {
      const [a, b] = merges[m]; const out = [];
      for (let i = 0; i < units.length; i++) { if (units[i] === a && units[i + 1] === b) { out.push(wp ? a + b.replace(/^##/, "") : a + b); i++; } else out.push(units[i]); }
      units = out;
    }
    return units;
  }
  function longest(word, k) {
    const vocab = new Set(); chars.forEach(c => { vocab.add(c); vocab.add("##" + c); }); for (let m = 0; m < k; m++) vocab.add(WP[m][0] + WP[m][1].replace(/^##/, ""));
    const out = []; let i = 0;
    while (i < word.length) { let j = word.length, hit = null; while (j > i) { const cand = (i ? "##" : "") + word.slice(i, j); if (vocab.has(cand)) { hit = cand; break; } j--; } if (!hit) return ["[UNK]"]; out.push(hit); i = j; }
    return out;
  }
  const show = (host, pieces) => $(host).innerHTML = pieces === null ? tok("[UNK]", "unk") + `<span class="lab">a character not in the toy corpus</span>` : pieces.map(p => tok(p, p === "[UNK]" ? "unk" : p.startsWith("##") ? "cont" : p.endsWith("</w>") ? "eow" : "")).join("");
  function run() {
    const w = $("#live-tok-word").value.toLowerCase().replace(/\s+/g, "") || "a", k = +$("#live-tok-n").value; $("#live-tok-k").textContent = k;
    const b = replay(w, BPE, k, false), r = replay(w, WP, k, true), l = longest(w, k);
    show("#live-bpe", b); show("#live-wp-replay", r); show("#live-wp-longest", l);
    $("#live-tok-stats").textContent = r && r.join(" ") !== l.join(" ") ? "replay ≠ longest match" : "replay = longest match";
  }
  $("#live-tok-word").addEventListener("input", run); $("#live-tok-n").addEventListener("input", run); run();
})();

/* ---- 02 BERT: the model, then the two pretraining heads on the same picture */
const BERT_TOKS = ["[CLS]", "the", "cat", "sat", "on", "[SEP]", "it", "was", "warm", "[SEP]"];
function figBert(mode) {
  const host = $("#fig-bert"); host.innerHTML = ""; const W = 1000, H = 560, s = svg(W, H); const n = BERT_TOKS.length, x0 = 90, cw = (W - x0 - 30) / n, X = i => x0 + cw * (i + 0.5);
  const NOTE = {
    in: TXT("fig-bert-note-in"),
    mlm: TXT("fig-bert-note-mlm"),
    nsp: TXT("fig-bert-note-nsp"),
  };
  const chosen = { 3: "mk", 8: "rnd", 2: "keep" };                          // sat → [MASK], warm → random, cat → unchanged
  const shown = mode === "mlm" ? BERT_TOKS.map((t, i) => chosen[i] === "mk" ? "[MASK]" : chosen[i] === "rnd" ? "apple" : t) : BERT_TOKS;
  // 1. tokens, then the three embedding rows they are summed from
  const yTok = 500, yE = [455, 425, 395];
  shown.forEach((t, i) => { const sp = /^\[/.test(BERT_TOKS[i]) && t !== "[MASK]", c = mode === "mlm" ? chosen[i] : null;
    box(s, X(i) - cw / 2 + 5, yTok, cw - 10, 32, t, { fill: c === "mk" ? TINT("--cls-3", 28) : c === "rnd" ? TINT("--cls-1", 28) : c === "keep" ? TINT("--cls-2", 28) : sp ? SUNK() : css("--panel"), stroke: c ? css(c === "mk" ? "--cls-3" : c === "rnd" ? "--cls-1" : "--cls-2") : css("--rule-strong"), fs: 13.5, bold: sp || !!c });
    if (mode === "mlm" && c) txt(s, X(i), yTok + 48, "was: " + BERT_TOKS[i], { fs: 11.5, color: css("--ink-3") });
    const seg = i <= 5 ? 0 : 1;
    box(s, X(i) - cw / 2 + 5, yE[0], cw - 10, 22, "E(" + BERT_TOKS[i].replace(/[\[\]]/g, "").slice(0, 4) + ")", { fill: css("--panel"), fs: 10.5, color: css("--ink-2"), rx: 3 });
    box(s, X(i) - cw / 2 + 5, yE[1], cw - 10, 22, seg ? "E_B" : "E_A", { fill: TINT(seg ? "--cls-2" : "--cls-0", mode === "nsp" || mode === "in" ? 22 : 10), fs: 11, color: css("--ink-2"), rx: 3 });
    box(s, X(i) - cw / 2 + 5, yE[2], cw - 10, 22, "P" + i, { fill: css("--panel"), fs: 11, color: css("--ink-2"), rx: 3 });
    s.appendChild(el("line", { x1: X(i), x2: X(i), y1: 395, y2: 372, stroke: css("--ink-3"), "stroke-width": 1.2 }));
  });
  txt(s, x0 - 8, yTok + 21, "tokens", { anchor: "end", fs: 12.5 }); txt(s, x0 - 8, yE[0] + 15, "token", { anchor: "end", fs: 12 }); txt(s, x0 - 8, yE[1] + 15, "segment", { anchor: "end", fs: 12 }); txt(s, x0 - 8, yE[2] + 15, "position", { anchor: "end", fs: 12 });
  txt(s, x0 - 8, yE[0] - 6, "+", { anchor: "end", fs: 13, color: css("--ink-3") }); txt(s, x0 - 8, yE[1] - 6, "+", { anchor: "end", fs: 13, color: css("--ink-3") });
  if (mode === "in") { txt(s, X(5), yTok + 48, "segment boundary", { fs: 11.5, color: css("--cls-2") }); txt(s, X(0), yTok + 48, "no token of its own", { fs: 11.5, color: css("--ink-3") }); }
  // 2. the encoder: one block drawn, the rest stacked
  encoderBlock(s, x0, 262, W - x0 - 30, 110, { label: "block 1 · 7.1M" });
  [0, 1, 2].forEach(k => box(s, x0, 236 - k * 22, W - x0 - 30, 16, null, { fill: TINT("--cls-1", 5), stroke: css("--cls-1"), rx: 4 }));
  txt(s, W / 2, 205, "⋮  blocks 2 … 12  ⋮", { fs: 12.5, color: css("--cls-1") });
  txt(s, x0 + 8, 182, "× 12 in bert-base · × 24 in bert-large · every block the same shape", { anchor: "start", fs: 12, color: css("--ink-3") });
  // 3. the output: one vector per position
  const yH = 130;
  BERT_TOKS.forEach((t, i) => { const on = mode === "in" || (mode === "mlm" && chosen[i]) || (mode === "nsp" && i === 0);
    s.appendChild(el("line", { x1: X(i), x2: X(i), y1: 262, y2: yH + 30, stroke: css("--ink-3"), "stroke-width": 1.2 }));
    box(s, X(i) - cw / 2 + 8, yH, cw - 16, 30, "h" + i, { fill: on ? TINT("--cls-1", 22) : SUNK(), stroke: on ? css("--cls-1") : css("--rule-strong"), fs: 12.5, color: on ? css("--ink") : css("--ink-3") }); });
  txt(s, x0 - 8, yH + 20, "H", { anchor: "end", fs: 13, bold: 1 }); txt(s, x0 - 8, yH + 36, "[L, 768]", { anchor: "end", fs: 11, color: css("--ink-3") });
  // 4. what reads H
  if (mode === "mlm") {
    const hx = (X(0) + X(n - 1)) / 2, hw = 760;
    box(s, hx - hw / 2, 24, hw, 34, "MLM head · Linear(768, 768) + GELU + LayerNorm + Linear(768, 30 522) → softmax over the vocabulary", { fill: TINT("--cls-3", 18), stroke: css("--cls-3"), fs: 12.5, bold: 1, grow: 1 });
    Object.keys(chosen).forEach(i => { i = +i; arrow(s, X(i), yH, X(i), 62, { color: css("--cls-3") }); txt(s, X(i), 14, "→ " + BERT_TOKS[i], { fs: 12.5, color: css("--cls-3"), bold: 1 }); });
    txt(s, x0, 14, "targets: the original tokens", { anchor: "start", fs: 11.5, color: css("--ink-3") });
    txt(s, x0, 84, "cross-entropy at the 3 chosen positions of 10 · the other 7 get no gradient", { anchor: "start", fs: 12, color: css("--ink-3") });
  } else if (mode === "nsp") {
    const bx = X(0) - cw / 2 + 8, bw = 260;
    const b1 = box(s, bx, 66, bw, 30, "pooler · tanh(W h₀ + b) · 768", { fill: TINT("--cls-2", 18), stroke: css("--cls-2"), fs: 12.5 });
    const b2 = box(s, bx, 24, bw, 30, "Linear(768, 2) → IsNext / NotNext", { fill: TINT("--cls-2", 18), stroke: css("--cls-2"), fs: 12.5, bold: 1 });
    arrow(s, X(0), yH, X(0), 100, { color: css("--cls-2") }); arrow(s, X(0), 66, X(0), 58, { color: css("--cls-2") });
    txt(s, bx + bw + 16, 44, "cross-entropy over the two classes", { anchor: "start", fs: 12, color: css("--ink-3") });
    txt(s, bx + bw + 16, 86, "h₀ is the only position anything reads — nothing else in pretraining looks at [CLS]", { anchor: "start", fs: 12, color: css("--ink-3") });
  } else {
    txt(s, W / 2, 60, "one 768-vector per position — what every head below reads", { fs: 13, color: css("--ink-2") });
    txt(s, W / 2, 84, "input: 3 tables summed  ·  body: 12 blocks  ·  output: H", { fs: 12, color: css("--ink-3") });
  }
  host.appendChild(s); $("#fig-bert-note").innerHTML = NOTE[mode];
}
const setBert = states("fig-bert-btns", figBert);
codeF("#code-pretrain", `H = body(input_ids, token_type_ids, attention_mask).last_hidden_state     # [B, L, 768] — one vector per position

# --- MLM: which positions?  the 15% that were chosen. The label is the ORIGINAL token there and -100 everywhere else
chosen = torch.rand(input_ids.shape) < 0.15                                 # (never the specials or the padding)
mlm_labels = torch.where(chosen, input_ids, -100)                           # target = the original token; -100 = "no loss here"
r = torch.rand(input_ids.shape)
input_ids[chosen & (r < 0.8)] = MASK_ID                                     # 80%: [MASK]
input_ids[chosen & (r >= 0.8) & (r < 0.9)] = random_token_id                # 10%: a random token
#                                                                            # 10%: left unchanged — and still predicted
mlm_logits = mlm_head(H)                                                    # Linear(768, 768) + GELU + LayerNorm + Linear(768, 30522): [B, L, V]
mlm_loss = F.cross_entropy(mlm_logits.flatten(0, 1), mlm_labels.flatten(), ignore_index=-100)   # softmax over V, only at the chosen positions

# --- NSP: which position?  one — h_0, the [CLS] slot — through the pooler
pooled = torch.tanh(pooler(H[:, 0]))                                        # [B, 768]
nsp_logits = nsp_head(pooled)                                               # Linear(768, 2): [B, 2]
nsp_loss = F.cross_entropy(nsp_logits, is_next)                             # softmax over the two classes, one label per pair

loss = mlm_loss + nsp_loss                                                  # BertForPreTraining sums the two`,
  l => /mlm|chosen|MASK_ID|random_token|10%|80%/.test(l) ? "mlm" : /nsp|pooled|pooler|is_next/.test(l) ? "nsp" : /^H = /.test(l) ? "in" : null, setBert);

/* ---- 02 the footnote: three later objectives, small, same language */
(function figVariants() {
  function strip(s, x, y, toks, cw, colours, o) { o = o || {}; toks.forEach((t, i) => box(s, x + i * cw + 2, y, cw - 4, 22, t, { fill: colours && colours[i] ? colours[i] : css("--panel"), stroke: colours && colours[i] ? css("--ink-3") : css("--rule-strong"), fs: o.fs || 10.5, rx: 3, color: css("--ink") })); }
  function electra() {
    const h = $("#fig-electra"); h.innerHTML = ""; const W = 560, H = 210, s = svg(W, H), toks = ["the", "cat", "sat", "on", "the", "mat"], cw = 56, x = 80;
    strip(s, x, 180, ["the", "[MASK]", "sat", "on", "the", "[MASK]"], cw, [0, TINT("--cls-3", 28), 0, 0, 0, TINT("--cls-3", 28)]);
    box(s, x, 140, 6 * cw, 26, "generator · a small MLM", { fill: TINT("--cls-3", 10), stroke: css("--cls-3"), fs: 12, grow: 1 });
    strip(s, x, 104, ["the", "dog", "sat", "on", "the", "mat"], cw, [0, TINT("--cls-1", 28), 0, 0, 0, TINT("--cls-2", 18)]);
    box(s, x, 60, 6 * cw, 30, "discriminator · the model you keep", { fill: TINT("--cls-1", 10), stroke: css("--cls-1"), fs: 12, bold: 1, grow: 1 });
    strip(s, x, 12, ["orig", "repl", "orig", "orig", "orig", "orig"], cw, toks.map((_, i) => TINT("--good", 16)), { fs: 10 });
    for (let i = 0; i < 6; i++) arrow(s, x + i * cw + cw / 2, 60, x + i * cw + cw / 2, 38, { color: css("--good") });
    txt(s, x + 6 * cw + 8, 28, "loss at 6 / 6", { anchor: "start", fs: 11, color: css("--good") }); txt(s, x - 8, 119, "corrupted", { anchor: "end", fs: 11 }); txt(s, x - 8, 195, "masked", { anchor: "end", fs: 11 });
    txt(s, x + 6 * cw + 8, 119, "mat: the generator", { anchor: "start", fs: 10, color: css("--cls-2") }); txt(s, x + 6 * cw + 8, 131, "sampled the original", { anchor: "start", fs: 10, color: css("--cls-2") });
    h.appendChild(s);
  }
  function t5() {
    const h = $("#fig-t5"); h.innerHTML = ""; const W = 560, H = 210, s = svg(W, H), cw = 56, x = 60;
    strip(s, x, 180, ["the", "cat", "<x>", "on", "the", "<y>", "."], cw, [0, 0, TINT("--cls-3", 28), 0, 0, TINT("--cls-3", 28), 0]);
    txt(s, x + 7 * cw / 2, 170, "spans dropped: 'sat', 'mat' · one sentinel each", { fs: 10.5, color: css("--ink-3") });
    box(s, x, 118, 190, 34, "encoder", { fill: TINT("--cls-1", 10), stroke: css("--cls-1"), fs: 12.5, bold: 1 });
    box(s, x + 210, 118, 190, 34, "decoder", { fill: TINT("--cls-0", 10), stroke: css("--cls-0"), fs: 12.5, bold: 1 });
    arrow(s, x + 190, 135, x + 210, 135, { color: css("--ink-2") });
    strip(s, x + 120, 60, ["<x>", "sat", "<y>", "mat", "</s>"], cw, [TINT("--cls-3", 28), TINT("--good", 16), TINT("--cls-3", 28), TINT("--good", 16), 0]);
    arrow(s, x + 305, 118, x + 305, 86, { color: css("--cls-0") });
    txt(s, x + 260, 40, "the target is a sequence: no head, text in → text out", { fs: 11, color: css("--ink-2") }); txt(s, x + 260, 24, "the same model translates and summarises the same way", { fs: 10.5, color: css("--ink-3") });
    h.appendChild(s);
  }
  function retromae() {
    const h = $("#fig-retromae"); h.innerHTML = ""; const W = 560, H = 230, s = svg(W, H), cw = 56, x = 20;
    strip(s, x, 200, ["[CLS]", "the", "[M]", "sat", "on", "[M]", "mat"], cw, [SUNK(), 0, TINT("--cls-3", 28), 0, 0, TINT("--cls-3", 28), 0]);
    txt(s, x + 7 * cw + 6, 215, "~30% masked", { anchor: "start", fs: 10.5, color: css("--ink-3") });
    box(s, x, 150, 7 * cw, 30, "encoder · 12 blocks", { fill: TINT("--cls-1", 10), stroke: css("--cls-1"), fs: 12, bold: 1 });
    box(s, x, 104, cw, 26, "h[CLS]", { fill: TINT("--cls-2", 28), stroke: css("--cls-2"), fs: 11, bold: 1 });
    arrow(s, x + cw / 2, 150, x + cw / 2, 132, { color: css("--cls-2") });
    strip(s, x + cw + 10, 106, ["[M]", "[M]", "sat", "[M]", "[M]", "mat"], cw, [TINT("--cls-3", 28), TINT("--cls-3", 28), 0, TINT("--cls-3", 28), TINT("--cls-3", 28), 0]);
    txt(s, x + cw + 10 + 6 * cw + 6, 121, "50–70%", { anchor: "start", fs: 10.5, color: css("--ink-3") });
    box(s, x, 58, 7 * cw, 30, "decoder · 1 block · gets h[CLS] and the heavier mask", { fill: TINT("--cls-0", 10), stroke: css("--cls-0"), fs: 11, bold: 1, grow: 1 });
    arrow(s, x + cw / 2, 104, x + cw / 2, 90, { color: css("--cls-2") });
    strip(s, x, 14, ["the", "cat", "sat", "on", "the", "mat", "."], cw, [1, 2, 3, 4, 5, 6, 7].map(() => TINT("--good", 16)));
    for (let i = 0; i < 7; i++) arrow(s, x + i * cw + cw / 2, 58, x + i * cw + cw / 2, 40, { color: css("--good") });
    h.appendChild(s);
  }
  const all = () => { electra(); t5(); retromae(); }; all(); REDRAW.push(all);
})();

/* ---- 02 the MLM head at every position: click a token */
(function mlmPick() {
  const P = D.mlm.positions; if (!P) return;
  let si = 0, ti = P[0].tokens.indexOf("[MASK]");
  $("#mlm-sents").innerHTML = P.map((p, i) => `<button data-m="${i}" class="${i === 0 ? "sel" : ""}">${i + 1}</button>`).join("");
  function draw() {
    const p = P[si];
    $("#mlm-toks").innerHTML = p.tokens.map((t, i) => `<span class="tok pick ${i === ti ? "on" : ""} ${t === "[MASK]" ? "mk" : /^\[/.test(t) ? "sp" : ""}" data-i="${i}">${esc(t)}</span>`).join("");
    const top = p.top[ti], t = p.tokens[ti];
    probBars($("#mlm-top"), top.map(([w, q]) => ({ label: w, p: q })), { max: 1 });
    const own = top.find(([w]) => w === t);
    $("#mlm-say").innerHTML = t === "[MASK]" ? TXT("mlm-say-masked", { top1: esc(top[0][0]), p_top1: top[0][1].toFixed(2) }) :
      own && own === top[0] ? TXT("mlm-say-copied", { t: esc(t), p_own: own[1].toFixed(2) }) :
      own ? TXT("mlm-say-flagged", { t: esc(t), p_own: own[1].toFixed(2), top1: esc(top[0][0]), p_top1: top[0][1].toFixed(2) }) :
      TXT("mlm-say-missing", { t: esc(t), top1: esc(top[0][0]), p_top1: top[0][1].toFixed(2) });
  }
  $("#mlm-sents").addEventListener("click", e => { const b = e.target.closest("button[data-m]"); if (!b) return; si = +b.dataset.m; $$("#mlm-sents button").forEach(x => x.classList.toggle("sel", x === b)); const m = P[si].tokens.indexOf("[MASK]"); ti = m >= 0 ? m : 1; draw(); });
  $("#mlm-toks").addEventListener("click", e => { const t = e.target.closest(".tok[data-i]"); if (!t) return; ti = +t.dataset.i; draw(); });
  draw();
})();

/* ---- 02 zero-shot: pick the label words, score in the browser, reveal the confusion */
(function zsPick() {
  const C = ZS.candidates, n = ZS.n, prob = f16(ZS.probs), gold = ZS.gold, m = C.length;
  $("#zs-pick").innerHTML = CLS.map((c, ci) => { const dflt = ZA.v1.words[ci]; return `<label class="field"><b>${esc(c)}</b><select data-c="${ci}">${C.map(w => `<option ${w === dflt ? "selected" : ""}>${esc(w)}</option>`).join("")}</select></label>`; }).join("");
  let revealed = false;
  function score() {
    const cols = $$("#zs-pick select").map(s => C.indexOf(s.value)); const conf = [[0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]]; let ok = 0;
    for (let i = 0; i < n; i++) { let b = 0, bv = -1; for (let c = 0; c < 4; c++) { const v = prob[i * m + cols[c]]; if (v > bv) { bv = v; b = c; } } conf[gold[i]][b]++; if (b === gold[i]) ok++; }
    const acc = ok / n;
    if (!revealed) { $("#zs-pick-acc").textContent = `words: ${cols.map(c => C[c]).join(" / ")}`; return acc; }
    $("#zs-pick-acc").textContent = `accuracy ${acc.toFixed(4)}`;
    probBars($("#zs-pick-out"), CLS.map((c, ci) => { const p = conf[ci][ci] / conf[ci].reduce((a, b) => a + b, 0); return { label: c, p, text: p.toFixed(3) }; }), { max: 1 });
    $("#zs-conf").innerHTML = `<tr><th></th>${CLS.map((c, ci) => `<th>→ ${esc(C[cols[ci]])}</th>`).join("")}</tr>` + CLS.map((c, ci) => `<tr><th style="text-align:left">${esc(c)}</th>${conf[ci].map((v, cj) => `<td class="${ci === cj ? "hit" : v > conf[ci][ci] ? "miss" : ""}" style="${v > conf[ci][ci] ? "color:var(--bad);font-weight:600" : ""}">${num(v)}</td>`).join("")}</tr>`).join("");
    return acc;
  }
  $("#zs-pick").addEventListener("change", score); score();
  $("#btn-zs-reveal").addEventListener("click", () => {
    revealed = true; const acc = score();
    betZs.reveal([0.30, 0.45, 0.60, 0.75].map((v, i) => [Math.abs(v - acc), i]).sort((a, b) => a[0] - b[0])[0][1]);
    $("#zs-out").hidden = false; $("#zs-note").hidden = false; const b = $("#btn-zs-reveal"); b.disabled = true; b.textContent = "revealed";
    document.dispatchEvent(new CustomEvent("revealed", { detail: "btn-zs-reveal" }));
  }, { once: true });
})();

/* ---- 02 pooler vs [CLS] vs mean: three bars with ±2 standard errors */
(function probeFig() {
  function draw() {
    const host = $("#probe-fig"); host.innerHTML = ""; const W = 620, H = 190, s = svg(W, H), rows = [["pooler (what NSP trained)", FE.artifact.summary.pooler], ["raw [CLS], last layer", FE.artifact.summary.cls], ["mean of all tokens, last layer", FE.artifact.summary.mean]];
    const x0 = 250, x1 = W - 30, lo = 0.84, hi = 0.93, X = v => x0 + (v - lo) / (hi - lo) * (x1 - x0), nT = FE.artifact.n_test || 7600;
    [0.85, 0.87, 0.89, 0.91].forEach(v => { s.appendChild(el("line", { x1: X(v), x2: X(v), y1: 14, y2: H - 30, stroke: css("--rule") })); txt(s, X(v), H - 14, v.toFixed(2), { fs: 12, color: css("--ink-3") }); });
    s.appendChild(el("line", { x1: X(DATA.tfidf.accuracy), x2: X(DATA.tfidf.accuracy), y1: 8, y2: H - 30, stroke: css("--bad"), "stroke-dasharray": "5 4", "stroke-width": 1.5 })); txt(s, X(DATA.tfidf.accuracy), H - 34, "TF-IDF " + DATA.tfidf.accuracy.toFixed(4), { fs: 12, color: css("--bad") });
    rows.forEach(([k, v], i) => { const y = 30 + i * 46, se = Math.sqrt(v * (1 - v) / nT);
      txt(s, x0 - 12, y + 5, k, { anchor: "end", fs: 13, color: css("--ink") });
      s.appendChild(el("rect", { x: x0, y: y - 9, width: X(v) - x0, height: 18, rx: 2, fill: css("--cls-0") }));
      s.appendChild(el("line", { x1: X(v - 2 * se), x2: X(v + 2 * se), y1: y, y2: y, stroke: css("--ink"), "stroke-width": 2 }));
      [v - 2 * se, v + 2 * se].forEach(w => s.appendChild(el("line", { x1: X(w), x2: X(w), y1: y - 6, y2: y + 6, stroke: css("--ink"), "stroke-width": 2 })));
      txt(s, X(v + 2 * se) + 8, y + 5, v.toFixed(4) + " ± " + (2 * se).toFixed(3), { anchor: "start", fs: 12.5, color: css("--ink-2") }); });
    host.appendChild(s);
  }
  draw(); REDRAW.push(draw);
})();

/* ---- 03 one H, three heads: where the Linear reads, what comes out, which axis the softmax runs along */
const HEAD_TOKS = ["[CLS]", "when", "?", "[SEP]", "founded", "in", "1992", "[SEP]"];
function figHeads(mode) {
  const host = $("#fig-heads"); host.innerHTML = ""; const W = 1000, H = 330, s = svg(W, H), L = HEAD_TOKS.length, rh = 28, y0 = 40, xH = 100, dCols = 7, dc = 26;
  const NOTE = {
    seq: TXT("fig-heads-note-seq"),
    tok: TXT("fig-heads-note-tok"),
    span: TXT("fig-heads-note-span"),
  };
  txt(s, xH + dCols * dc / 2, 24, "H · [L, 768]", { fs: 13, bold: 1, color: css("--ink") });
  HEAD_TOKS.forEach((t, i) => { const y = y0 + i * rh, on = mode !== "seq" || i === 0;
    txt(s, xH - 10, y + rh / 2 + 4, t, { anchor: "end", fs: 12.5, color: on ? css("--ink") : css("--ink-3") });
    for (let j = 0; j < dCols; j++) s.appendChild(el("rect", { x: xH + j * dc, y: y + 3, width: dc - 3, height: rh - 6, rx: 2, fill: j === dCols - 1 ? "none" : on ? TINT("--cls-1", 16 + 10 * ((i * 3 + j) % 4)) : SUNK(), stroke: j === dCols - 1 ? "none" : on ? css("--cls-1") : css("--rule") }));
    txt(s, xH + (dCols - 1) * dc + dc / 2 - 2, y + rh / 2 + 5, "…", { fs: 13, color: css("--ink-3") }); });
  txt(s, xH + (dCols - 1) * dc / 2, y0 + L * rh + 18, "768 numbers per position", { fs: 11.5, color: css("--ink-3") });
  // the Linear
  const xL = xH + dCols * dc + 36, C = mode === "seq" ? 4 : mode === "tok" ? 9 : 2, lw = 130;
  const yMid = mode === "seq" ? y0 + rh / 2 : y0 + L * rh / 2;
  box(s, xL, yMid - 22, lw, 44, `Linear(768, ${C})`, { fill: TINT("--cls-2", 14), stroke: css("--cls-2"), fs: 13.5, bold: 1, grow: 1 });
  txt(s, xL + lw / 2, yMid + 38, mode === "seq" ? "once, on H[:, 0]" : "the same one at every position", { fs: 11.5, color: css("--ink-3") });
  if (mode === "seq") arrow(s, xH + dCols * dc, y0 + rh / 2, xL - 4, y0 + rh / 2, { color: css("--cls-2") });
  else HEAD_TOKS.forEach((_, i) => arrow(s, xH + dCols * dc, y0 + i * rh + rh / 2, xL - 4, y0 + i * rh + rh / 2, { color: css("--cls-2"), sw: 1 }));
  // the output grid, and the softmax axis
  const xO = xL + lw + 50, oc = mode === "tok" ? 40 : 56, rows = mode === "seq" ? 1 : L;
  const labelsC = mode === "seq" ? CLS : mode === "tok" ? TAGS : ["start", "end"];
  labelsC.forEach((c, j) => txt(s, xO + j * oc + oc / 2, y0 - 8, c, { fs: mode === "tok" ? 8.5 : 11.5, color: css("--ink-2") }));
  const ans = { seq: [[0, 1]], tok: { 4: 0, 5: 0, 6: 0, 1: 0, 2: 0 }, span: [6, 6] }[mode];
  for (let i = 0; i < rows; i++) for (let j = 0; j < C; j++) {
    const hot = mode === "seq" ? j === 1 : mode === "tok" ? (i === 0 || i === 3 || i === 7 ? false : j === 0) : (j === 0 ? i === ans[0] : i === ans[1]);
    const dead = mode === "tok" && (i === 0 || i === 3 || i === 7);
    s.appendChild(el("rect", { x: xO + j * oc, y: y0 + i * rh + 3, width: oc - 3, height: rh - 6, rx: 2, fill: hot ? TINT("--good", 40) : dead ? SUNK() : TINT("--cls-0", 12), stroke: hot ? css("--good") : dead ? css("--rule") : css("--cls-0"), "stroke-dasharray": dead ? "3 3" : "none" }));
    if (dead && j === 0) txt(s, xO + C * oc + 8, y0 + i * rh + rh / 2 + 4, "−100 · skipped", { anchor: "start", fs: 10.5, color: css("--ink-3") });
  }
  const gw = C * oc;
  if (mode === "seq") { arrow(s, xO, y0 + rh + 22, xO + gw - 3, y0 + rh + 22, { color: css("--ink") }); txt(s, xO + gw / 2, y0 + rh + 44, "softmax along the row · over the C classes · [B, C]", { fs: 12.5, color: css("--ink"), bold: 1 }); }
  else if (mode === "tok") { for (let i = 0; i < rows; i++) if (!(i === 0 || i === 3 || i === 7)) arrow(s, xO + gw + 8, y0 + i * rh + rh / 2, xO + gw + 8 + 44, y0 + i * rh + rh / 2, { color: css("--ink"), sw: 1.2 }); txt(s, xO + gw / 2 + 30, y0 + L * rh + 22, "softmax along each row · over the 9 tags · [B, L, 9]", { fs: 12.5, color: css("--ink"), bold: 1 }); }
  else {
    txt(s, xO + gw / 2, y0 - 26, "[B, L, 2] → unbind(-1) → two [B, L]", { fs: 12, color: css("--ink-3") });
    [0, 1].forEach(j => { const x = xO + j * oc + oc / 2 - 1; arrow(s, x, y0 + L * rh + 6, x, y0 + L * rh + 40, { color: css("--ink") }); });
    txt(s, xO + gw / 2, y0 + L * rh + 60, "softmax down each column · over the L positions · twice", { fs: 12.5, color: css("--ink"), bold: 1 });
    txt(s, xO + gw + 14, y0 + ans[0] * rh + rh / 2 + 4, "← start = end = '1992'", { anchor: "start", fs: 12, color: css("--good") });
  }
  host.appendChild(s); $("#fig-heads-note").innerHTML = NOTE[mode];
}
const setHeads = states("fig-heads-btns", figHeads);
codeF("#code-heads", `class SequenceHead(nn.Module):        # [B, L, d] -> [B, C].  One vector per text — the [CLS] position — then one Linear.
    def __init__(self, d, n_classes):    # Softmax (inside the loss) runs over C: "which class is this text".
        self.linear = nn.Linear(d, n_classes)
    def forward(self, H):
        return self.linear(H[:, 0])                            # [B, d] -> [B, C]

class TokenHead(nn.Module):           # [B, L, d] -> [B, L, C].  The same Linear at every position.
    def __init__(self, d, n_classes):    # Softmax runs over C, separately at each position: "which tag is this token".
        self.linear = nn.Linear(d, n_classes)
    def forward(self, H):
        return self.linear(H)                                  # [B, L, d] -> [B, L, C]

class SpanHead(nn.Module):            # [B, L, d] -> two [B, L].  A Linear with two outputs at every position:
    def __init__(self, d):               # a start score and an end score. Softmax runs over L — over positions.
        self.linear = nn.Linear(d, 2)
    def forward(self, H):
        start, end = self.linear(H).unbind(-1)                 # [B, L, 2] -> [B, L], [B, L]
        return start, end

def sequence_loss(logits, labels):
    return F.cross_entropy(logits, labels)                                   # normalises over the last axis: C
def token_loss(logits, labels):
    return F.cross_entropy(logits.flatten(0, 1), labels.flatten(), ignore_index=IGNORE)   # over C, at every kept position
def span_loss(scores, labels):
    start, end = scores                                                      # each [B, L]
    return (F.cross_entropy(start, labels[:, 0]) + F.cross_entropy(end, labels[:, 1])) / 2   # over L: "classes" = positions`,
  l => /Sequence|H\[:, 0\]|sequence_loss|last axis: C/.test(l) ? "seq" : /TokenHead|which tag|\[B, L, C\]|token_loss|ignore_index/.test(l) ? "tok" : /SpanHead|start|end|span_loss|positions/.test(l) ? "span" : null, setHeads);
code("#code-lib", `# transformers.models.bert.modeling_bert — the three classes, one Linear each (inspect.getsource, trimmed)
class BertForSequenceClassification:
    self.bert = BertModel(config)
    self.classifier = nn.Linear(config.hidden_size, config.num_labels)
    pooled_output = outputs[1]                                   # the pooler: tanh(W h[CLS] + b)
    logits = self.classifier(pooled_output)                      # [B, C]

class BertForTokenClassification:
    self.bert = BertModel(config, add_pooling_layer=False)
    self.classifier = nn.Linear(config.hidden_size, config.num_labels)
    sequence_output = outputs[0]                                 # H, [B, L, d]
    logits = self.classifier(sequence_output)                    # [B, L, C]

class BertForQuestionAnswering:
    self.bert = BertModel(config, add_pooling_layer=False)
    self.qa_outputs = nn.Linear(config.hidden_size, config.num_labels)      # num_labels = 2
    logits = self.qa_outputs(sequence_output)                    # [B, L, 2]
    start_logits, end_logits = logits.split(1, dim=-1)           # two [B, L, 1]
    start_logits = start_logits.squeeze(-1).contiguous()         # [B, L] — CrossEntropyLoss over L, twice
    end_logits = end_logits.squeeze(-1).contiguous()`);
code("#code-recipe", `model = AutoModelForSequenceClassification.from_pretrained("bert-base-uncased", num_labels=4)
#       AutoModelForTokenClassification (num_labels=9)  |  AutoModelForQuestionAnswering  — same body, another Linear
set_trainable(model, top_blocks=0)                    # the dial, block 04

args = TrainingArguments(output_dir=..., per_device_train_batch_size=32, num_train_epochs=2, learning_rate=lr,
                         weight_decay=0.01, warmup_steps=0.1, lr_scheduler_type="linear",   # BERT's fine-tuning recipe
                         eval_strategy="epoch", logging_strategy="epoch", save_strategy="no", report_to=[])
trainer = Trainer(model=model, args=args, train_dataset=train_ds, eval_dataset=eval_ds,
                  data_collator=DataCollatorWithPadding(tokenizer), compute_metrics=accuracy_metric)
trainer.train()                                       # curves come back in trainer.state.log_history`);

/* ---- 04 the dial knob: what moves, and — after the reveal — what it measured */
let DIAL_REVEALED = false;
(function knob() {
  const KEYS = TRN, LAB = { "head only": "0", "top 2 blocks": "2", "top 6 blocks": "6", "everything": "all" }; let cur = KEYS[0];
  $("#dial-knob").innerHTML = KEYS.map((k, i) => `<button data-k="${k}" class="${i === 0 ? "sel" : ""}">k = ${LAB[k]}</button>`).join("");
  function draw(k) {
    cur = k; const r = TR.runs[k], top = r.top_blocks === "all" ? 12 : r.top_blocks, all = r.top_blocks === "all";
    $("#dial-knob-stats").innerHTML = `<div class="stat-row">${stat(num(r.trainable_params), "trainable")}${stat(pct(r.trainable_params / r.total_params, 1), "of the model")}${stat(r.lr, "lr")}</div>` +
      (DIAL_REVEALED ? `<div class="stat-row" style="margin-top:12px">${stat(fmt(last(r.accuracy), 4), "test accuracy")}${stat(num(Math.round(last(r.seconds))) + " s", "the bill · " + r.epoch.length + " epochs")}${stat((100 * (last(r.accuracy) - DATA.tfidf.accuracy)).toFixed(1), "pts vs TF-IDF")}</div>` : "");
    const host = $("#dial-knob-fig"); host.innerHTML = ""; const s = svg(620, 330); const x = 40, w = 540;
    const cell = (y, h, label, on) => box(s, x, y, w, h, label, { fill: on ? TINT("--cls-1", 22) : SUNK(), stroke: on ? css("--cls-1") : css("--rule-strong"), color: on ? css("--ink") : css("--ink-3"), fs: 12.5 });
    cell(8, 26, "head · Linear(768, 4) · 3 076", true); cell(40, 22, "pooler · 0.6M", top > 0);
    for (let b = 11; b >= 0; b--) cell(70 + (11 - b) * 18, 15, `block ${b + 1} · 7.1M`, b >= 12 - top);
    cell(292, 26, "embeddings · 23.8M", all);
    host.appendChild(s);
    if (DIAL_REVEALED) { DIAL_HL = k; drawDialChart(); }
  }
  draw(KEYS[0]); REDRAW.push(() => draw(cur));
  $("#dial-knob").addEventListener("click", e => { const b = e.target.closest("button[data-k]"); if (!b) return; $$("#dial-knob button").forEach(x => x.classList.toggle("sel", x === b)); draw(b.dataset.k); });
  document.addEventListener("revealed", e => { if (e.detail === "btn-dial-reveal") { DIAL_REVEALED = true; draw(cur); } });
  code("#code-dial", `def set_trainable(model, top_blocks):          # 0 = head only · k = top k blocks · "all"
    body = model.base_model                       # whatever AutoModelFor* wrapped: model.bert
    for p in body.parameters():
        p.requires_grad = top_blocks == "all"
    if top_blocks != "all" and top_blocks > 0:
        for block in body.encoder.layer[-top_blocks:]:
            for p in block.parameters():
                p.requires_grad = True
        for p in body.pooler.parameters():        # above the last block: moves whenever any block does
            p.requires_grad = True`);
})();

/* ---- the scoreboard in the rail, and the sortable results table at the end */
(function scoreboard() {
  const rows = RES.map((r, i) => ({ i, r }));
  const gate = r => /week 1/.test(r.model) ? "line" : /zero-shot/.test(r.model) ? "btn-zs-reveal" : /logreg/.test(r.model) ? "btn-probe-reveal" : /fine-tune/.test(r.model) ? "btn-dial-reveal" : null;   // null: a live cell, visible from the start
  const on = new Set();
  const parseP = v => v === "—" || v == null ? 0 : /M$/.test(v) ? 1e6 * parseFloat(v) : parseFloat(String(v).replace(/,/g, ""));
  const short = m => m.replace("TF-IDF + logreg (week 1)", "TF-IDF, week 1").replace(/^zero-shot MLM, .*/, "zero-shot, politics/…").replace("frozen ", "").replace(" + logreg", " + logreg").replace(/^fine-tune: /, "dial · ").replace(/ \(.*\)$/, " (live)");
  function drawBoard() {
    $("#score").innerHTML = `<div class="t">AG News · test acc</div>` + rows.map(({ r }) => { const g = gate(r), vis = g === null || g === "line" || on.has(g);
      return `<div class="row ${g === "line" ? "line" : vis ? "on" : "off"} ${vis && g !== "line" && r["test acc"] >= DATA.tfidf.accuracy ? "pass" : ""}"><span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(short(r.model))}</span><span class="v">${vis ? fmt(r["test acc"], 4) : "·"}</span></div>`; }).join("");
  }
  let sortBy = "order";
  function drawTable() {
    const rs = rows.slice();
    if (sortBy === "acc") rs.sort((a, b) => b.r["test acc"] - a.r["test acc"]); else if (sortBy === "params") rs.sort((a, b) => parseP(a.r["trainable params"]) - parseP(b.r["trainable params"])); else if (sortBy === "s") rs.sort((a, b) => (a.r["train s"] || 0) - (b.r["train s"] || 0));
    table($("#results-1"), RES_COLS, rs.map(({ i, r }) => Object.assign({ _hl: i === 0 }, r)));
  }
  drawBoard(); drawTable();
  document.addEventListener("revealed", e => { on.add(e.detail); drawBoard(); });
  $("#res-sort").addEventListener("click", e => { const b = e.target.closest("button[data-s]"); if (!b) return; sortBy = b.dataset.s; $$("#res-sort button").forEach(x => x.classList.toggle("sel", x === b)); drawTable(); });
})();

/* ---- 05 NER: word → tokens → label, four shapes on one picture; the batch after the collator */
const NER_PICK = [0, 1, 7, 8, 13, 14, 15, 16, 23, 24, 25, 38];      // [CLS] germany · european union · werner z ##wing ##mann · sheep ##me ##at · [SEP]
function figNer(mode) {
  const E = NER.example, host = $("#fig-ner"); host.innerHTML = ""; const W = 1000, H = 400, s = svg(W, H), n = NER_PICK.length, x0 = 64, cw = (W - x0 - 16) / n, X = i => x0 + cw * (i + 0.5);
  const labels = mode === "label" ? E.labelsCont : E.labels;
  const groups = [[1, 1, "1 word · 1 token"], [2, 3, "2 words · 2 tokens"], [4, 7, "2 words · 4 tokens"], [8, 10, "1 word · 3 tokens · not an entity"]];
  groups.forEach(([a, b, t], gi) => { s.appendChild(el("line", { x1: X(a) - cw / 2 + 6, x2: X(b) + cw / 2 - 6, y1: 378, y2: 378, stroke: css("--rule-strong") }));
    const anchor = gi === 0 ? "end" : gi === 1 ? "start" : "middle", x = gi === 0 ? X(b) + cw / 2 - 6 : gi === 1 ? X(a) - cw / 2 + 6 : (X(a) + X(b)) / 2; txt(s, x, 394, t, { fs: 11, color: css("--ink-3"), anchor }); });
  NER_PICK.forEach((ti, i) => {
    const t = E.tokens[ti], wid = E.wordIds[ti], sp = wid === null, first = !sp && (i === 0 || E.wordIds[NER_PICK[i - 1]] !== wid), lab = labels[ti];
    // the word, once per word
    if (first) { let j = i; while (j + 1 < n && E.wordIds[NER_PICK[j + 1]] === wid) j++; box(s, X(i) - cw / 2 + 4, 330, X(j) - X(i) + cw - 8, 28, E.words[wid], { fill: css("--panel"), fs: 12.5, bold: E.tags[wid] > 0 }); }
    // the token
    box(s, X(i) - cw / 2 + 4, 272, cw - 8, 28, t, { fill: sp ? SUNK() : t.startsWith("##") ? TINT("--cls-1", 12) : css("--panel"), stroke: t.startsWith("##") ? css("--cls-1") : css("--rule-strong"), fs: 12, bold: sp });
    if (first) s.appendChild(el("line", { x1: X(i), x2: X(i), y1: 330, y2: 300, stroke: css("--ink-3") }));
    txt(s, X(i), 262, sp ? "None" : "word " + wid, { fs: 10.5, color: css("--ink-3") });
    // the label
    const ign = lab === -100;
    box(s, X(i) - cw / 2 + 4, 212, cw - 8, 28, ign ? "−100" : TAGS[lab], { fill: ign ? SUNK() : lab ? TINT("--good", 22) : TINT("--cls-0", 10), stroke: ign ? css("--rule-strong") : lab ? css("--good") : css("--cls-0"), fs: 12, bold: !ign, color: ign ? css("--ink-3") : css("--ink") });
    // h, the Linear, the 9-cell row
    box(s, X(i) - cw / 2 + 8, 150, cw - 16, 26, "h", { fill: TINT("--cls-1", 18), fs: 12 });
    s.appendChild(el("line", { x1: X(i), x2: X(i), y1: 272, y2: 176, stroke: css("--ink-3"), "stroke-dasharray": "3 3" }));
    arrow(s, X(i), 150, X(i), 118, { color: ign ? css("--ink-3") : css("--good"), dash: ign });
    const cells = 9, cwid = Math.min(8, (cw - 12) / cells);
    for (let c = 0; c < cells; c++) s.appendChild(el("rect", { x: X(i) - cells * cwid / 2 + c * cwid, y: 92, width: cwid - 1, height: 22, rx: 1, fill: ign ? SUNK() : c === lab ? TINT("--good", 55) : TINT("--cls-0", 12), stroke: "none" }));
    txt(s, X(i), 84, ign ? "no loss" : "CE vs " + TAGS[lab], { fs: 9.5, color: ign ? css("--ink-3") : css("--ink-2") });
  });
  txt(s, x0 - 30, 44, "one Linear(768, 9) per position → 9 scores · softmax along the row · cross-entropy only where the label ≠ −100", { anchor: "start", fs: 12.5, color: css("--ink") });
  txt(s, x0 - 30, 64, mode === "label" ? "continuations carry the word's tag: ##wing ##mann become I-PER — and get a loss, like a new token of the entity" : "continuations get −100: the head reads the first piece of a word, the rest is skipped", { anchor: "start", fs: 12, color: css("--ink-3") });
  [[348, "words"], [292, "tokens"], [262, "word_ids"], [232, "labels"], [168, "H"], [108, "scores"]].forEach(([y, t]) => txt(s, x0 - 6, y, t, { anchor: "end", fs: 10.5, color: css("--ink-3") }));
  host.appendChild(s);
  const NA_ = NER.artifact.runs, dF1 = last(NA_["head only, continuations labelled"].entity_f1) - last(NA_["head only"].entity_f1);
  $("#fig-ner-note").innerHTML = mode === "label"
    ? TXT("fig-ner-note-label", { f1_labelled: fmt(last(NA_["head only, continuations labelled"].entity_f1), 3), f1_ignored: fmt(last(NA_["head only"].entity_f1), 3), d_pts: (100 * dF1).toFixed(1) })
    : TXT("fig-ner-note-ids");
}
states("fig-ner-btns", figNer);
/* the batch after a collator: rows of a padded tensor, the padding coloured */
function figCollator(host, spec) {
  const h = $(host); h.innerHTML = ""; const n = spec.rows[0].cells.length, W = 1000, rowH = 24, gap = 6, labW = 120, x0 = labW + 10, cw = (W - x0 - 10) / n;
  const groups = spec.groups; const H = 30 + groups.reduce((a, g) => a + g.rows.length * rowH + 22, 0);
  const s = svg(W, H); let y = 18;
  groups.forEach(g => {
    txt(s, x0, y, g.title, { anchor: "start", fs: 11.5, color: css("--ink-3") }); y += 8;
    g.rows.forEach(r => {
      txt(s, labW, y + rowH / 2 + 4, r.name, { anchor: "end", fs: 11.5, color: css("--ink-2") });
      r.cells.forEach((c, i) => { const pad = r.pad[i], t = String(c), rect = el("rect", { x: x0 + i * cw + 1, y: y + 2, width: cw - 2, height: rowH - 4, rx: 2, fill: pad ? TINT("--bad", 14) : r.fill ? r.fill(c, i) : css("--panel"), stroke: pad ? css("--bad") : css("--rule"), "stroke-dasharray": pad ? "3 3" : "none" }); s.appendChild(rect);
        const lab = t.length > 6 && cw < 60 ? t.slice(0, 5) + "…" : t; const tx = txt(s, x0 + i * cw + cw / 2, y + rowH / 2 + 4, lab, { fs: cw < 40 ? 9 : 10.5, color: pad ? css("--bad") : r.strike && r.strike(c, i) ? css("--ink-3") : css("--ink") });
        if (r.strike && r.strike(c, i) && !pad) s.appendChild(el("line", { x1: x0 + i * cw + 4, x2: x0 + i * cw + cw - 4, y1: y + rowH / 2, y2: y + rowH / 2, stroke: css("--ink-3"), "stroke-width": 1.2 }));
        if (t.length > 6) tipOn(rect, esc(t)); });
      y += rowH;
    });
    y += 14;
  });
  h.appendChild(s);
}
(function collators() {
  const C = NER.collator;
  if (C) {
    const n = C.tokens[0].length;
    const rowsFor = (i) => { const len = C.lengths[i], padAt = j => j >= len;
      return [{ name: `input_ids · ${i + 1}`, cells: C.tokens[i], pad: C.tokens[i].map((_, j) => padAt(j)), fill: (c) => /^\[/.test(c) ? SUNK() : css("--panel") },
              { name: "attention_mask", cells: C.attention_mask[i], pad: C.attention_mask[i].map((_, j) => padAt(j)) },
              { name: "labels", cells: C.labels[i].map(l => l === -100 ? "−100" : TAGS[l]), pad: C.labels[i].map((_, j) => padAt(j)), strike: c => c === "−100", fill: c => c === "−100" ? SUNK() : c === "O" ? TINT("--cls-0", 8) : TINT("--good", 20) }]; };
    figCollator("#fig-coll-ner", { rows: rowsFor(0), groups: C.tokens.map((_, i) => ({ title: `sentence ${i + 1} · ${C.lengths[i]} tokens${C.lengths[i] < n ? ` + ${n - C.lengths[i]} padding` : " — the longest, sets the width"}`, rows: rowsFor(i) })) });
    $("#coll-ner-stats").textContent = `batch of ${C.tokens.length} · padded to ${n} · loss at ${C.labels.flat().filter(l => l !== -100).length} of ${C.tokens.length * n} positions`;
  }
  const Q = QA.collator;
  if (Q) {
    const n = Q.tokens[0].length;
    const rowsFor = i => { const len = Q.lengths[i], padAt = j => j >= len, sp = Q.start_positions[i], ep = Q.end_positions[i];
      return [{ name: `input_ids · ${i + 1}`, cells: Q.tokens[i], pad: Q.tokens[i].map((_, j) => padAt(j)), fill: (c, j) => j >= sp && j <= ep && sp > 0 ? TINT("--good", 30) : /^\[/.test(c) ? SUNK() : Q.token_type_ids[i][j] ? TINT("--cls-2", 10) : TINT("--cls-0", 8) },
              { name: "token_type_ids", cells: Q.token_type_ids[i], pad: Q.token_type_ids[i].map((_, j) => padAt(j)), fill: c => c ? TINT("--cls-2", 18) : TINT("--cls-0", 14) },
              { name: "attention_mask", cells: Q.attention_mask[i], pad: Q.attention_mask[i].map((_, j) => padAt(j)) }]; };
    figCollator("#fig-coll-qa", { rows: rowsFor(0), groups: Q.tokens.map((_, i) => ({ title: `"${Q.questions[i]}" · ${Q.lengths[i]} tokens${Q.lengths[i] < n ? ` + ${n - Q.lengths[i]} padding` : ""} · start_positions = ${Q.start_positions[i]}, end_positions = ${Q.end_positions[i]} — two integers, nothing to pad`, rows: rowsFor(i) })) });
    $("#coll-qa-stats").textContent = `batch of ${Q.tokens.length} · padded to ${n} · segment 0 = question, 1 = context`;
  }
})();
code("#code-ner", `enc = tokenizer(batch["tokens"], is_split_into_words=True, truncation=True, max_length=160)
for word_id in enc.word_ids(i):                      # None for [CLS]/[SEP]; the same id for z ##wing ##mann
    if word_id is None:            labels.append(IGNORE)                 # IGNORE = -100
    elif word_id != previous:      labels.append(tags[word_id])          # first token of a word: the word's tag
    else:                          labels.append(IGNORE)                 # a continuation (or tags[word_id], measured above)
    previous = word_id

ner_collator = DataCollatorForTokenClassification(tokenizer)   # pads input_ids with [PAD], attention_mask with 0, labels with -100
loss = F.cross_entropy(logits.flatten(0, 1), labels.flatten(), ignore_index=-100)   # PyTorch's default — the reason for the number
ner_model = AutoModelForTokenClassification.from_pretrained(MODEL_NAME, num_labels=9)
seqeval = evaluate.load("seqeval")                             # entity-level F1: type AND both boundaries`);
code("#code-qa", `enc = tokenizer(questions, contexts, truncation="only_second", max_length=384, stride=128,
                return_overflowing_tokens=True, return_offsets_mapping=True)     # windows + character offsets
seq_ids = enc.sequence_ids(i)                                    # None = special, 0 = question, 1 = context
context_tokens = [k for k, s in enumerate(seq_ids) if s == 1]
start = next(k for k in context_tokens if offsets[k][1] > answer_start)             # first token that ends after the answer starts
end = next(k for k in reversed(context_tokens) if offsets[k][0] < answer_end)       # last token that starts before it ends
# ... or (0, 0) — the [CLS] position — when the answer is not inside this window

collator = DataCollatorWithPadding(tokenizer)                    # start_positions / end_positions are scalars: nothing to pad
qa_model = AutoModelForQuestionAnswering.from_pretrained(MODEL_NAME)                 # Linear(768, 2) → start / end
best_span(start_scores, end_scores, offsets, max_answer_tokens=30)                   # best pair with start <= end, both in the context`);

/* ---- 05 NER predictions: the fine-tuned model against the head-only one, on the same sentences */
(function nerPreds() {
  const S = NER.predictions.sentences, has = S[0].predHeadOnly;
  if (!has) $("#ner-preds-btns").hidden = true;
  function ents(words, tags, other, gold) {
    let out = "", i = 0; while (i < words.length) { const t = tags[i]; const dis = other && other[i] !== t;
      if (t === "O") { out += `<span class="${dis ? "ent wrong" : ""}" style="${dis ? "padding:2px 4px" : ""}">${esc(words[i])}</span> `; i++; continue; }
      const type = t.slice(2); let j = i + 1; while (j < words.length && tags[j] === "I-" + type) j++;
      const wrongAny = other && words.slice(i, j).some((_, k) => other[i + k] !== tags[i + k]);
      out += `<span class="ent ${type} ${wrongAny ? "wrong" : ""}">${esc(words.slice(i, j).join(" "))}<i>${type}</i></span> `; i = j; }
    return out;
  }
  function draw(mode) {
    const other = mode === "pred" ? "predHeadOnly" : "pred";
    $("#ner-preds").innerHTML = S.map(s => { const hasGold = s.gold && s.gold.some(g => g !== "O");
      return `<p class="ent-line">${ents(s.words, s[mode], has ? s[other] : null)}</p>` + (hasGold ? `<p class="ent-line" style="font-size:14px;line-height:1.9;margin:-6px 0 10px;color:var(--ink-3)"><span class="lab" style="font-family:var(--mono);font-size:11px;letter-spacing:.08em;text-transform:uppercase;margin-right:8px">gold</span>${ents(s.words, s.gold)}</p>` : ""); }).join("");
  }
  draw("pred");
  $("#ner-preds-btns").addEventListener("click", e => { const b = e.target.closest("button[data-m]"); if (!b) return; $$("#ner-preds-btns button").forEach(x => x.classList.toggle("sel", x === b)); draw(b.dataset.m); });
})();

/* ---- 05 QA: two score rows over the tokens of a window, from the fine-tuned model */
(function figQa() {
  const EX = QA.predictions.examples, has = EX.some(e => e.scores);
  const host = $("#fig-qa");
  if (!has) {                                                    // the artifact predates the score rows: the schematic, and a note
    const draw = () => { host.innerHTML = ""; const W = 900, H = 230, s = svg(W, H), toks = ["[CLS]", "when", "?", "[SEP]", "founded", "in", "1992", ".", "[SEP]"], n = toks.length, x0 = 40, cw = (W - 2 * x0) / n, X = i => x0 + cw * (i + 0.5);
      toks.forEach((t, i) => { const ctx = i >= 4 && i <= 7; box(s, X(i) - cw / 2 + 5, 180, cw - 10, 30, t, { fill: /^\[/.test(t) ? SUNK() : ctx ? TINT("--cls-2", 10) : TINT("--cls-0", 8), fs: 13, bold: /^\[/.test(t) });
        box(s, X(i) - cw / 2 + 8, 118, cw - 16, 30, "h" + i, { fill: TINT("--cls-1", 18), fs: 12.5 }); s.appendChild(el("line", { x1: X(i), x2: X(i), y1: 180, y2: 148, stroke: css("--ink-3") }));
        const hs = i === 6 ? 62 : ctx ? 14 + 8 * ((i * 7) % 3) : 4, he = i === 6 ? 58 : ctx ? 10 + 8 * ((i * 5) % 3) : 4;
        s.appendChild(el("rect", { x: X(i) - 14, y: 100 - hs, width: 12, height: hs, fill: css("--cls-2"), rx: 1 })); s.appendChild(el("rect", { x: X(i) + 2, y: 100 - he, width: 12, height: he, fill: css("--cls-3"), rx: 1 })); });
      txt(s, W / 2, 20, "start scores (green), end scores (purple) at every position · softmax over the positions, twice", { fs: 12.5 });
      txt(s, W / 2, H - 6, "schematic — the measured rows appear after precompute.py --only qa", { fs: 11, color: css("--ink-3") });
      host.appendChild(s); };
    draw(); REDRAW.push(draw); $("#qa-pick").innerHTML = ""; return;
  }
  const softmax = a => { const m = Math.max(...a), e = a.map(v => Math.exp(v - m)), z = e.reduce((x, y) => x + y, 0); return e.map(v => v / z); };
  function bestSpan(st, en, ctxMask, maxLen) {                    // the notebook's best_span: top-20 starts × top-20 ends, start <= end, both in the context
    const idx = a => a.map((v, i) => [v, i]).sort((x, y) => y[0] - x[0]).slice(0, 20).map(p => p[1]); let best = -1e9, span = null;
    for (const a of idx(st)) for (const b of idx(en)) { if (!ctxMask[a] || !ctxMask[b] || b < a || b - a + 1 > maxLen) continue; if (st[a] + en[b] > best) { best = st[a] + en[b]; span = [a, b]; } }
    return span;
  }
  let cur = 0;
  $("#qa-pick").innerHTML = EX.map((e, i) => `<button data-m="${i}" class="${i === 0 ? "sel" : ""} ${QA_NO_ANSWER(e.question) ? "noans" : ""}" title="${esc(e.question)}">${i + 1}</button>`).join("");
  function draw() {
    const e = EX[cur], sc = e.scores, toks = sc.tokens, n = toks.length, ctx = sc.offsets.map(o => o !== null), ps = softmax(sc.start), pe = softmax(sc.end), span = bestSpan(sc.start, sc.end, ctx, 30);
    host.innerHTML = ""; const W = 1000, dense = n > 70, H = dense ? 250 : 330, s = svg(W, H), x0 = 60, cw = (W - x0 - 20) / n, X = i => x0 + cw * (i + 0.5), barH = 70;
    const yS = 20 + barH, yE = yS + barH + 16, yT = yE + 24;
    txt(s, x0 - 8, yS - barH / 2, "start", { anchor: "end", fs: 12, color: css("--cls-2"), bold: 1 }); txt(s, x0 - 8, yE - barH / 2, "end", { anchor: "end", fs: 12, color: css("--cls-3"), bold: 1 });
    [[ps, yS, "--cls-2"], [pe, yE, "--cls-3"]].forEach(([p, y, c]) => { const mx = Math.max(...p); s.appendChild(el("line", { x1: x0, x2: W - 20, y1: y, y2: y, stroke: css("--rule-strong") }));
      p.forEach((v, i) => { const hgt = Math.max(1, v / mx * barH), r = el("rect", { x: x0 + i * cw + (dense ? 0 : 1), y: y - hgt, width: Math.max(1, cw - (dense ? 0 : 2)), height: hgt, fill: ctx[i] ? css(c) : css("--ink-3"), opacity: ctx[i] ? 1 : .45 }); tipOn(r, `${esc(toks[i])}<br>start ${ps[i].toFixed(3)} · end ${pe[i].toFixed(3)}`); s.appendChild(r); }); });
    if (!dense) toks.forEach((t, i) => { const inSpan = span && i >= span[0] && i <= span[1]; const g = el("g", { transform: `translate(${X(i)} ${yT + 8}) rotate(-60)` }); g.appendChild(el("text", { x: 0, y: 0, "font-size": 10.5, "text-anchor": "end", fill: inSpan ? css("--good") : ctx[i] ? css("--ink") : css("--ink-3"), "font-weight": inSpan ? "600" : "400" }, t)); s.appendChild(g); });
    if (span) { s.appendChild(el("rect", { x: x0 + span[0] * cw, y: yE + 4, width: (span[1] - span[0] + 1) * cw, height: 6, rx: 2, fill: css("--good") })); }
    const argS = ps.indexOf(Math.max(...ps)), argE = pe.indexOf(Math.max(...pe));
    const ctxStart = ctx.indexOf(true); s.appendChild(el("line", { x1: x0 + ctxStart * cw, x2: x0 + ctxStart * cw, y1: 10, y2: yE + 12, stroke: css("--ink-3"), "stroke-dasharray": "3 3" })); txt(s, x0 + ctxStart * cw - 4, 12, "question ·", { anchor: "end", fs: 10.5, color: css("--ink-3") }); txt(s, x0 + ctxStart * cw + 4, 12, "· context", { anchor: "start", fs: 10.5, color: css("--ink-3") });
    host.appendChild(s);
    const spanText = span ? toks.slice(span[0], span[1] + 1).join(" ").replace(/ ##/g, "") : "—";
    const win = sc.windows > 1 ? TXT("fig-qa-note-window", { n: sc.windows }) + " · " : "";
    const decoded = e.pred ? " · " + TXT("fig-qa-note-decoded", { pred: esc(e.pred) }) : "";
    const tail = e.gold && e.gold[0] ? " · " + TXT("fig-qa-note-gold", { gold: esc(e.gold[0]) }) : QA_NO_ANSWER(e.question) ? " · " + TXT("fig-qa-note-noanswer") : "";
    $("#fig-qa-note").innerHTML = TXT("fig-qa-note-scores", { question: esc(e.question), win, start_tok: esc(toks[argS]), p_start: ps[argS].toFixed(2), end_tok: esc(toks[argE]), p_end: pe[argE].toFixed(2), span: esc(spanText), decoded, tail });
  }
  draw(); REDRAW.push(draw);
  $("#qa-pick").addEventListener("click", ev => { const b = ev.target.closest("button[data-m]"); if (!b) return; cur = +b.dataset.m; $$("#qa-pick button").forEach(x => x.classList.toggle("sel", x === b)); draw(); });
})();
