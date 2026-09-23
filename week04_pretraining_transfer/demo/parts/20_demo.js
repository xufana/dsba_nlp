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
    const veil = e.target.closest(".panel").querySelector(".veil"); if (veil) veil.remove(); e.target.disabled = true; e.target.textContent = "revealed"; });
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
table($("#results-1"), RES_COLS, RES.map((r, i) => Object.assign({ _hl: i === 0 }, r)));

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
$("#mlm").innerHTML = `<div class="grid-2">` + D.mlm.guesses.map(g => `<div><div class="figcap">${esc(g.text).replace(esc(g.word), `<b>${esc(g.word)}</b>`)}</div><div id="mlm-${esc(g.word).replace(/\W/g, "")}"></div></div>`).join("") + `</div>`;
D.mlm.guesses.forEach(g => probBars($("#mlm-" + g.word.replace(/\W/g, "")), g.top.map(([w, p]) => ({ label: w, p })), { max: 1 }));

const ZS = D.zeroShot, ZA = ZS.artifact.label_sets;
const betZs = makeBet("#bet-zs", ["about 0.30", "about 0.45", "about 0.60", "about 0.75"], [0.30, 0.45, 0.60, 0.75].map((v, i) => [Math.abs(v - ZA.v1.accuracy), i]).sort((a, b) => a[0] - b[0])[0][1]);
$("#zs-out").innerHTML = `<div class="grid-2"><div><div class="figcap">v1 · ${ZA.v1.words.join(" / ")}</div><div class="stat-row">${stat(fmt(ZA.v1.accuracy, 3), "accuracy, " + num(ZS.n) + " texts")}</div><div id="zs-v1"></div></div>
  <div><div class="figcap">what the mask wants for World news · top words</div><div id="zs-top"></div></div></div>
  <div style="margin-top:14px"><div class="figcap">v2 · ${ZA.v2.words.join(" / ")} — one word changed</div><div class="stat-row">${stat(fmt(ZA.v2.accuracy, 3), "accuracy")}${stat("+" + (100 * (ZA.v2.accuracy - ZA.v1.accuracy)).toFixed(1), "points from one word")}</div><div id="zs-v2"></div></div>`;
probBars($("#zs-v1"), CLS.map(c => ({ label: c, p: ZA.v1.per_class[c], text: fmt(ZA.v1.per_class[c], 3) })), { max: 1 });
probBars($("#zs-v2"), CLS.map(c => ({ label: c, p: ZA.v2.per_class[c], text: fmt(ZA.v2.per_class[c], 3) })), { max: 1 });
probBars($("#zs-top"), ZS.topWorld.slice(0, 8).map(([w, n]) => ({ label: w, p: n / ZS.topWorld[0][1], text: num(n) })), { max: 1 });
reveal("btn-zs-reveal", ["zs-out"], "zs-note", [betZs]);

const FE = D.features;
const betProbe = makeBet("#bet-probe", ["pooler", "[CLS]", "mean of tokens", "you can't rank them"], 3);
$("#probe-out").innerHTML = `<div class="scroll-x"><table id="probe-table"></table></div><div class="small-note" style="margin-top:8px">live cell in the notebook, ${num(FE.live.n)} texts: pooler ${fmt(FE.live.summary.pooler, 3)}, [CLS] ${fmt(FE.live.summary.cls, 3)}, mean ${fmt(FE.live.summary.mean, 3)} · encoding ${num(FE.artifact.n_train)} texts took ${FE.artifact.encode_seconds}s</div>`;
table($("#probe-table"), [{ h: "vector", f: r => r.k }, { h: "test acc", num: 1, f: r => `<b>${fmt(r.v, 4)}</b>` }, { h: "vs TF-IDF 0.9195", num: 1, f: r => (100 * (r.v - DATA.tfidf.accuracy)).toFixed(1) + " pts" }],
  [["pooler (what NSP trained)", FE.artifact.summary.pooler], ["raw [CLS], last layer", FE.artifact.summary.cls], ["mean of all tokens, last layer", FE.artifact.summary.mean]].map(([k, v]) => ({ k, v })));
reveal("btn-probe-reveal", ["probe-out"], "probe-note", [betProbe]);

/* ============================================================ 03 head */
const HD = D.heads;
$("#body-n").textContent = num(HD.body);
probBars($("#head-counts"), Object.entries(HD.counts).map(([k, v]) => ({ label: k, p: v / 7000, text: `${num(v)} · ${(100 * v / HD.body).toFixed(4)}%` })), { max: 1 });
$("#head-counts").insertAdjacentHTML("beforeend", `<pre class="code" style="margin-top:12px;font-size:12.5px;white-space:pre-wrap;max-height:220px;overflow:auto">${esc(HD.librarySource)}</pre>`);
$("#head-untrained").innerHTML = `<div class="figcap">an untrained head · ${num(HD.untrained.n)} test texts</div><div class="stat-row">${stat(fmt(HD.untrained.accuracy, 3), "accuracy")}${stat("0.25", "random")}</div><pre class="code" style="margin-top:12px;font-size:12.5px;white-space:pre-wrap">${esc(HD.loadReport.replace(/\x1b\[[0-9;]*m/g, ""))}</pre>`;
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
REDRAW.push(() => lineChart($("#dial-chart"), { W: 520, H: 320, L: 70, fs: 13.5, xlog: 1, series: [{ x: TRN.map(k => TR.runs[k].trainable_params), y: TRN.map(finalAcc), color: css("--cls-1"), labels: TRN, tip: (x, y) => `${num(x)} params → ${fmt(y, 4)}` }], hlines: [{ y: DATA.tfidf.accuracy, label: "TF-IDF, week 1", color: css("--bad") }], xlabel: "trainable parameters", ylabel: "test accuracy", ymin: 0.82, ymax: 0.94 }));
probBars($("#dial-bill"), TRN.map(k => ({ label: k, p: last(TR.runs[k].seconds), text: Math.round(last(TR.runs[k].seconds)) + " s" })), { max: Math.max(...TRN.map(k => last(TR.runs[k].seconds))) });
$("#dial-score");
reveal("btn-dial-reveal", ["dial-out"], "dial-note", [betPass, betGap]);

/* ============================================================ 05 tasks */
const NER = D.ner, TAGS = DATA.nerTags;
(function align() { const e = NER.example; $("#ner-align").innerHTML = `<div class="pieces" style="margin-bottom:8px"><span class="lab">words</span>${e.words.map((w, i) => tok(w, e.tags[i] ? "ent" : "")).join("")}</div>
  <div class="pieces"><span class="lab">tokens · label</span>${e.tokens.map((t, i) => { const l = e.labels[i]; return `<span class="tok ${l === -100 ? "dim" : l ? "ans" : ""}" title="word ${e.wordIds[i]} · label ${l}">${esc(t)}<i style="font-style:normal;font-size:10.5px;margin-left:4px;opacity:.7">${l === -100 ? "−100" : esc(TAGS[l])}</i></span>`; }).join("")}</div>`; })();
const NL = NER.live;
$("#ner-live-n").textContent = num(NL.n);
const ratio = NL.entity_f1 / NL.token_acc;
const betNer = makeBet("#bet-ner", ["about the same as token accuracy", "10 points lower", "about half of it", "under a third of it"], ratio > 0.9 ? 0 : ratio > 0.75 ? 1 : ratio > 0.4 ? 2 : 3);
$("#ner-out").innerHTML = `<div class="stat-row">${stat(fmt(NL.token_acc, 3), "token accuracy")}${stat(fmt(NL.entity_f1, 3), "entity F1 (seqeval)")}${stat(NL.seconds + "s", "one epoch, " + num(NL.trainable) + " params")}</div><div class="small-note" style="margin-top:8px">per type: PER ${fmt(NL.f1_PER, 2)} · ORG ${fmt(NL.f1_ORG, 2)} · LOC ${fmt(NL.f1_LOC, 2)} · MISC ${fmt(NL.f1_MISC, 2)} — on ${num(NL.nTest)} test sentences, one epoch of ${num(NL.n)} sentences is barely past the all-O model (83% token accuracy, F1 0).</div>`;
reveal("btn-ner-reveal", ["ner-out"], "ner-note", [betNer]);
const NA = NER.artifact, NAN = Object.keys(NA.runs);
$("#ner-art-n").textContent = `${num(NA.n_train)} train · ${num(NA.n_test)} test sentences`;
table($("#ner-table"), [{ h: "setting", f: r => `<b>${esc(r.k)}</b>` }, { h: "trainable", num: 1, f: r => num(r.trainable_params) }, { h: "epochs", num: 1, f: r => r.epoch.length }, { h: "token acc", num: 1, f: r => fmt(last(r.token_acc), 3) }, { h: "entity F1", num: 1, f: r => `<b>${fmt(last(r.entity_f1), 3)}</b>` }, { h: "PER", num: 1, f: r => fmt(last(r.f1_PER), 2) }, { h: "ORG", num: 1, f: r => fmt(last(r.f1_ORG), 2) }, { h: "LOC", num: 1, f: r => fmt(last(r.f1_LOC), 2) }, { h: "MISC", num: 1, f: r => fmt(last(r.f1_MISC), 2) }, { h: "s / epoch", num: 1, f: r => num(Math.round(last(r.seconds))) }],
  NAN.map(k => Object.assign({ k }, NA.runs[k])));
$$("[data-ner-f1]").forEach(n => n.textContent = Math.round(100 * last(NA.runs["head only"].entity_f1)));
(function preds() {
  $("#ner-preds").innerHTML = `<div class="figcap">fine-tuned "everything" on unseen sentences · its predictions</div>` + NER.predictions.sentences.map(s => {
    let out = "", i = 0; while (i < s.words.length) { const t = s.pred[i]; if (t === "O") { out += esc(s.words[i]) + " "; i++; continue; }
      const type = t.slice(2); let j = i + 1; while (j < s.words.length && s.pred[j] === "I-" + type) j++; out += `<span class="ent ${type}">${esc(s.words.slice(i, j).join(" "))}<i>${type}</i></span> `; i = j; }
    return `<p class="ent-line">${out}</p>`; }).join("");
})();

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
$("#qa-preds").innerHTML = QA.predictions.examples.map((e, i) => `${i === 0 || e.context !== QA.predictions.examples[i - 1].context ? `<p class="ctx" style="margin:10px 0 6px;font-size:15.5px;color:var(--ink-2)">${esc(e.context)}</p>` : ""}<div class="qa-row"><span><span class="k">question</span>${esc(e.question)}</span><span><span class="k">predicted</span><b>${esc(e.pred)}</b></span><span><span class="k">gold</span>${e.gold && e.gold[0] ? esc(e.gold.join(" / ")) : "—"}</span></div>`).join("");

redrawAll();
