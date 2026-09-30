/* ====================================================== schematics and interactives */
const code = (host, text) => { $(host).innerHTML = text.split("\n").map(l => `<span class="ln">${esc(l)}</span>`).join(""); };
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
function states(btnsId, draw) {
  let mode = $(`#${btnsId} button.sel`).dataset.m; draw(mode); REDRAW.push(() => draw(mode));
  $(`#${btnsId}`).addEventListener("click", e => { const b = e.target.closest("button[data-m]"); if (!b) return; mode = b.dataset.m; $$(`#${btnsId} button`).forEach(x => x.classList.toggle("sel", x === b)); draw(mode); });
  return m => { mode = m; $$(`#${btnsId} button`).forEach(x => x.classList.toggle("sel", x.dataset.m === m)); draw(m); };
}
const CLSC = ["--cls-0", "--cls-1", "--cls-2", "--cls-3"];

/* ---- 00 three bodies, one picture */
function figBodies() {
  const host = $("#fig-bodies"); host.innerHTML = ""; const W = 1000, H = 360, s = svg(W, H);
  const cols = [
    { x: 20, title: "encoder (week 4)", reads: "reads everything, both ways", out: "a vector per position", task: "the task lives in the head", passes: "1 pass per item", head: "head: a Linear per task", color: "--cls-0", dir: "both" },
    { x: 350, title: "encoder–decoder (week 3)", reads: "reads everything; writes left to right", out: "a distribution per position", task: "the task lives in the pair (source, target)", passes: "T_out passes per item", head: "head: the target vocabulary", color: "--cls-2", dir: "encdec" },
    { x: 680, title: "decoder-only (today)", reads: "reads left to right — the prompt too", out: "a distribution per position", task: "the task lives in the prefix", passes: "T_out passes (or one per candidate)", head: "head: the vocabulary, fixed", color: "--cls-1", dir: "left" }];
  cols.forEach(c => {
    txt(s, c.x + 150, 22, c.title, { fs: 14.5, bold: 1, color: css("--ink") });
    const bx = c.x + 40, by = 70, bw = 220, bh = 120;
    if (c.dir === "encdec") { box(s, bx, by, 100, bh, "encoder", { fill: TINT(c.color, 10), stroke: css(c.color) }); box(s, bx + 120, by, 100, bh, "decoder", { fill: TINT(c.color, 10), stroke: css(c.color) }); arrow(s, bx + 100, by + bh / 2, bx + 120, by + bh / 2, { color: css(c.color) }); txt(s, bx + 110, by + bh / 2 - 8, "cross-attn", { fs: 10.5, color: css(c.color) }); }
    else box(s, bx, by, bw, bh, c.dir === "both" ? "encoder × N" : "decoder × N", { fill: TINT(c.color, 10), stroke: css(c.color) });
    // the token row and how it is read
    const n = 6, tw = 30, tx0 = bx + (bw - n * tw) / 2 + 2;
    for (let i = 0; i < n; i++) { box(s, tx0 + i * tw, by + bh + 26, tw - 4, 22, null, { fill: css("--panel"), rx: 3 }); arrow(s, tx0 + i * tw + (tw - 4) / 2, by + bh + 26, tx0 + i * tw + (tw - 4) / 2, by + bh + 2, { color: css("--ink-3"), sw: 1 }); }
    if (c.dir === "both") { arrow(s, tx0 + 2 * tw, by + bh + 62, tx0 + 4 * tw, by + bh + 62, { color: css("--ink-3") }); arrow(s, tx0 + 4 * tw, by + bh + 70, tx0 + 2 * tw, by + bh + 70, { color: css("--ink-3") }); }
    else arrow(s, tx0, by + bh + 66, tx0 + n * tw - 4, by + bh + 66, { color: css("--ink-3") });
    txt(s, c.x + 150, by + bh + 92, c.reads, { fs: 12 });
    // what comes out
    arrow(s, bx + bw / 2, by, bx + bw / 2, by - 20, { color: css(c.color) });
    txt(s, c.x + 150, by - 26, c.out, { fs: 12.5, color: css("--ink") });
    txt(s, c.x + 150, H - 34, c.task, { fs: 13, bold: 1, color: css(c.color) });
    txt(s, c.x + 150, H - 14, c.passes, { fs: 12 });
  });
  host.appendChild(s);
}
REDRAW.push(figBodies);

/* ---- 01 the stack, two readers */
const SH = D.shapes;
function figBlock(mode) {
  const host = $("#fig-block"); host.innerHTML = ""; const W = 1000, H = 330, s = svg(W, H);
  const toks = ["Fears", "for", "T", "N", "pension", "after", "…"], n = toks.length, cw = 62, x0 = 120, yTok = H - 30;
  const gpt = mode === "gpt", color = gpt ? "--cls-1" : "--cls-0";
  box(s, x0 - 30, 84, n * cw + 60, 184, null, { fill: TINT(color, 6), stroke: css(color) });
  txt(s, x0 - 16, 100, gpt ? "GPT-2 · 12 decoder blocks, one column per position" : "BERT · 12 encoder blocks, one column per position", { anchor: "start", fs: 12.5, bold: 1, color: css(color) });
  [0, 1, 2].forEach(k => { const y = 250 - k * 52; box(s, x0, y - 40, n * cw, 20, gpt ? "masked self-attention · 12 heads" : "self-attention · 12 heads", { fill: css("--panel"), fs: 11.5 }); box(s, x0, y - 18, n * cw, 16, "FFN 768 → 3072 → 768", { fill: css("--panel"), fs: 11 }); });
  toks.forEach((t, i) => { const cx = x0 + i * cw + cw / 2; box(s, cx - 26, yTok - 14, 52, 24, t, { fill: css("--panel"), fs: 12, rx: 3 }); arrow(s, cx, yTok - 16, cx, 270, { color: css("--ink-3"), sw: 1 }); arrow(s, cx, 84, cx, 56, { color: css(color) }); });
  if (gpt) { toks.forEach((t, i) => { const cx = x0 + i * cw + cw / 2; for (let b = 0; b < 5; b++) { const h = [22, 9, 14, 5, 3][(b + i) % 5]; s.appendChild(el("rect", { x: cx - 18 + b * 7, y: 50 - h, width: 5, height: h, fill: css("--cls-1") })); } });
    txt(s, x0 + n * cw + 24, 40, "[1, 33, 50 257]", { anchor: "start", fs: 14, bold: 1, color: css("--ink") }); txt(s, x0 + n * cw + 24, 58, "a distribution over the vocabulary per token —", { anchor: "start", fs: 12 }); txt(s, x0 + n * cw + 24, 74, "the head is built in", { anchor: "start", fs: 12 });
    box(s, 8, 130, 80, 100, null, { fill: TINT("--cls-1", 14), stroke: css("--cls-1") }); txt(s, 48, 175, "wteᵀ", { fs: 14, bold: 1, color: css("--ink") }); txt(s, 48, 192, "50 257 × 768", { fs: 10.5 }); txt(s, 48, 210, "tied to the input", { fs: 10.5 });
    arrow(s, 88, 180, x0 - 30, 180, { color: css("--cls-1"), dash: 1 }); }
  else { toks.forEach((t, i) => { const cx = x0 + i * cw + cw / 2; s.appendChild(el("rect", { x: cx - 18, y: 34, width: 36, height: 18, rx: 3, fill: TINT("--cls-0", 40), stroke: css("--cls-0") })); });
    txt(s, x0 + n * cw + 24, 40, "[1, 32, 768]", { anchor: "start", fs: 14, bold: 1, color: css("--ink") }); txt(s, x0 + n * cw + 24, 58, "a vector per token — nothing to read", { anchor: "start", fs: 12 }); txt(s, x0 + n * cw + 24, 74, "until a head is attached", { anchor: "start", fs: 12 }); }
  const H2 = mode === "gpt" && n; host.appendChild(s);
  $("#fig-block-note").innerHTML = gpt ? `<b>${num(SH.params.total)}</b> parameters: <b>${(SH.params.wte / 1e6).toFixed(1)}M</b> in the token embedding, which is also the head, <b>${(SH.params.blocks / 1e6).toFixed(1)}M</b> in the 12 blocks, <b>${(SH.params.wpe / 1e6).toFixed(1)}M</b> in the position table. Head tied to the input embedding: <code>${SH.params.tied}</code>.`
    : `<b>${num(SH.params.bert)}</b> parameters, and not one of them turns 768 numbers into an answer — last week's whole point.`;
}
states("fig-block-btns", figBlock);
probBars($("#params-bars"), [["wte — token embedding = the head", SH.params.wte, "var(--cls-1)"], ["12 blocks (attention + FFN)", SH.params.blocks, "var(--ink-3)"], ["wpe — 1 024 position rows", SH.params.wpe, "var(--cls-3)"]].map(([l, v, c]) => ({ label: l, p: v / SH.params.total, text: `${(v / 1e6).toFixed(1)}M · ${pct(v / SH.params.total)}`, color: c })), { max: 0.75 });
$("#ppl-line").textContent = `cross-entropy ${SH.ppl.loss.toFixed(3)} nats → perplexity ${SH.ppl.ppl.toFixed(1)} on ${SH.ppl.n} news texts`;

/* ---- 01 logit lens */
(function lens() {
  const DP = D.depth, L = DP.layers, agree = DP.agreement, ppl = DP.perplexity;
  const half = agree.findIndex(a => a >= 0.5);
  const bet = makeBet("#bet-lens", L.map(k => "layer " + k), half);
  REDRAW.push(() => {
    lineChart($("#lens-agree"), { W: 520, H: 300, L: 64, fs: 13, series: [{ x: L, y: agree, color: css("--cls-1"), label: "top-1 agrees with the final layer", tip: (x, y) => `layer ${x}: ${fmt(y, 3)}` }], xticks: L, xlabel: "layer (0 = embeddings)", ylabel: "share of positions", ymin: 0, ymax: 1.02, hlines: [{ y: 0.5, label: "half", color: css("--ink-3") }] });
    lineChart($("#lens-ppl"), { W: 520, H: 300, L: 74, fs: 13, ylog: 1, series: [{ x: L.slice(1), y: ppl.slice(1), color: css("--cls-0"), label: "perplexity if the model stopped here", tip: (x, y) => `layer ${x}: ${tickFmt(y)}` }], xticks: L, xlabel: "layer", ylabel: "perplexity (log)", yfmt: v => tickFmt(v) });
  });
  $("#lens-stats").textContent = `${num(DP.n_texts)} test texts, ${num(DP.n_tokens)} positions · layer 0 is the embeddings straight through the head (perplexity ${ppl[0].toExponential(1)}, off the chart)`;
  reveal("btn-lens-reveal", ["lens-out"], "lens-note", [bet]);
  $("#lens-note").innerHTML = `Even layer ${half} agrees with the final answer on only ${pct(agree[half])} of positions, and the perplexity drops at every layer — ${num(Math.round(ppl[1]))} after layer 1, ${num(Math.round(ppl[11]))} after layer 11, ${num(Math.round(ppl[12]))} after the last. There is no layer you can cut at. <em>Open question:</em> the probe in week 4 peaked in the <em>middle</em> of BERT. Both are 12-layer transformers trained to predict tokens — what is different about <em>how we read them</em>?`;
  // the strip: one text, every position
  const LN = D.lens, toks = LN.tokens, T = toks.length;
  let pos = 4;
  $("#lens-toks").innerHTML = toks.map((t, i) => `<span class="tok${i === pos ? " on" : ""}${i === T - 1 ? " dim" : ""}" data-i="${i}">${esc(t)}</span>`).join("");
  function drawStrip() {
    $$("#lens-toks .tok").forEach(n => n.classList.toggle("on", +n.dataset.i === pos));
    const gold = pos + 1 < T ? toks[pos + 1] : null, rows = LN.top5[pos], finalTop = rows[LN.n_layers][0][0];
    $("#lens-pos-line").textContent = `prefix '${toks.slice(0, pos + 1).join("")}' → next token ${gold === null ? "(end)" : "'" + gold + "'"}`;
    $("#lens-strip").innerHTML = rows.map((g, k) => `<div class="col"><div class="h">layer ${k}</div>${g.map(([t, p]) => `<div class="g${t === gold ? " gold" : ""}${t === finalTop ? " same" : ""}" title="${esc(t)} ${p}">${esc(t)}<i>${p >= 0.01 ? Math.round(p * 100) + "%" : ""}</i></div>`).join("")}</div>`).join("");
  }
  $("#lens-toks").addEventListener("click", e => { const t = e.target.closest(".tok"); if (!t) return; pos = Math.min(+t.dataset.i, T - 2); drawStrip(); });
  drawStrip();
})();

/* ---- 01 attention on one prompt */
(function attention() {
  const A = D.attention, [NL, NH, T] = A.shape, P = A.n_prompt, raw = b64bytes(A.data);
  const at = (l, h, i, j) => raw[((l * NH + h) * T + i) * T + j] / A.scale;
  const lastShare = A.to_prompt.slice(8).reduce((a, b) => a + b, 0) / 4, sinkShare = A.to_first.slice(8).reduce((a, b) => a + b, 0) / 4;
  const betShare = makeBet("#bet-att-share", ["under 0.3", "about half", "0.75 or more"], lastShare < 0.4 ? 0 : lastShare < 0.65 ? 1 : 2);
  const betSink = makeBet("#bet-att-sink", ["a small part", "about half of it", "most of it"], sinkShare / lastShare < 0.35 ? 0 : sinkShare / lastShare < 0.65 ? 1 : 2);
  const cv = $("#att-canvas"), ctx = cv.getContext("2d"); cv.width = T; cv.height = T;
  let layer = 6, head = 0, sink = true;
  function draw() {
    const img = ctx.createImageData(T, T);
    for (let i = 0; i < T; i++) { const row = new Float32Array(T); let sum = 0;
      for (let j = 0; j <= i; j++) { let v = 0; if (head === 0) { for (let h = 0; h < NH; h++) v += at(layer - 1, h, i, j); v /= NH; } else v = at(layer - 1, head - 1, i, j); if (!sink && j === 0) v = 0; row[j] = v; sum += v; }
      for (let j = 0; j < T; j++) { const v = sum > 0 ? row[j] / sum : 0, t = Math.pow(Math.min(1, v * (sink ? 1 : 1)), 0.5); const k = 4 * (i * T + j); img.data[k] = 250 - 210 * t; img.data[k + 1] = 250 - 150 * t; img.data[k + 2] = 250 - 60 * t; img.data[k + 3] = j > i ? 30 : 255; } }
    ctx.putImageData(img, 0, 0);
    // the prompt boundary
    ctx.strokeStyle = "rgba(20,22,26,.8)"; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(P, 0); ctx.lineTo(P, T); ctx.moveTo(0, P); ctx.lineTo(T, P); ctx.stroke();
    $("#att-layer-v").textContent = layer; $("#att-head-v").textContent = head === 0 ? "mean of 12" : head;
  }
  $("#att-layer").addEventListener("input", e => { layer = +e.target.value; draw(); });
  $("#att-head").addEventListener("input", e => { head = +e.target.value; draw(); });
  toggle("att-sink-tgl", m => { sink = m === "on"; draw(); });
  cv.addEventListener("pointermove", e => { const r = cv.getBoundingClientRect(), i = Math.floor((e.clientY - r.top) / r.height * T), j = Math.floor((e.clientX - r.left) / r.width * T); if (i < 0 || j < 0 || i >= T || j >= T || j > i) { $("#att-cell").textContent = ""; return; }
    let v = 0; if (head === 0) { for (let h = 0; h < NH; h++) v += at(layer - 1, h, i, j); v /= NH; } else v = at(layer - 1, head - 1, i, j); $("#att-cell").textContent = `'${A.tokens[i]}' → '${A.tokens[j]}' ${v.toFixed(3)}`; });
  REDRAW.push(() => { draw(); lineChart($("#att-chart"), { W: 460, H: 300, L: 60, fs: 12.5, series: [{ x: A.to_prompt.map((_, i) => i + 1), y: A.to_prompt, color: css("--cls-0"), label: "on the prompt (32 tokens)", tip: (x, y) => `layer ${x}: ${fmt(y, 3)}` }, { x: A.to_first.map((_, i) => i + 1), y: A.to_first, color: css("--cls-1"), label: "on token 0 alone", tip: (x, y) => `layer ${x}: ${fmt(y, 3)}` }], xticks: A.to_prompt.map((_, i) => i + 1), xlabel: "layer", ylabel: "share of attention", ymin: 0, ymax: 1, hlines: [{ y: P / (T - 1), label: "the prompt's share of positions", color: css("--ink-3") }] }); });
  reveal("btn-att-reveal", ["att-out"], "att-note", [betShare, betSink]);
  $("#att-note").innerHTML = `Measured on this prompt: ${fmt(Math.min(...A.to_prompt.slice(0, 5)), 2)}–${fmt(Math.max(...A.to_prompt.slice(0, 5)), 2)} of the generated tokens' attention lands on the prompt in the first five layers, ${fmt(Math.min(...A.to_prompt.slice(5)), 2)}–${fmt(Math.max(...A.to_prompt.slice(5)), 2)} from layer 6 on — the shape changes with depth. But from layer 6 on, ${fmt(Math.min(...A.to_first.slice(5)), 2)}–${fmt(Math.max(...A.to_first.slice(5)), 2)} of <em>all</em> attention sits on the very first token. That is the <strong>attention sink</strong> (Xiao et al. 2023): a position heads park on when they have nothing to look up. Hide it, and the other 31 prompt tokens get no more than their count would predict. "Reads the prompt" is mostly "parks on token 0".`;
})();

/* ---- 02 RoPE: the rotation, running here */
const RP = D.rope, DIM = RP.d;
function rotate(x, pos, base) { base = base || 10000; const out = new Float64Array(x.length); for (let i = 0; i < x.length / 2; i++) { const a = pos * Math.pow(base, -2 * i / x.length), c = Math.cos(a), s = Math.sin(a), x1 = x[2 * i], x2 = x[2 * i + 1]; out[2 * i] = x1 * c - x2 * s; out[2 * i + 1] = x1 * s + x2 * c; } return out; }
const dot = (a, b) => { let s = 0; for (let i = 0; i < a.length; i++) s += a[i] * b[i]; return s; };
(function ropeDials() {
  const q = RP.q, k = RP.k;
  const bad = RP.check.filter(c => Math.abs(dot(rotate(q, c.m), rotate(k, c.n)) - c.rope) > 1e-4 || (RP.tableRows[c.m] && RP.tableRows[c.n] && Math.abs(dot(q.map((v, i) => v + RP.tableRows[c.m][i]), k.map((v, i) => v + RP.tableRows[c.n][i])) - c.learned) > 1e-3));
  ck("#rope-ck", bad.length === 0, bad.length ? `${bad.length} of ${RP.check.length} pairs differ from Python` : `matches the notebook on ${RP.check.length} (m, n) pairs`);
  // a learned table for the sliders: the notebook's rows where it exported them, a seeded stand-in elsewhere (the point is the arithmetic)
  let seed = 7; const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
  const gauss = () => { const u = 1 - rnd(), v = rnd(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); };
  const TABLE = Array.from({ length: 1024 }, () => Float64Array.from({ length: DIM }, gauss));
  for (const r in RP.tableRows) TABLE[+r] = Float64Array.from(RP.tableRows[r]);
  const clocksHost = $("#rope-clocks"), CW = 800, CH = 120, s = svg(CW, CH), hands = [], R = 9;
  for (let i = 0; i < DIM / 2; i++) { const cx = 34 + i * 23.5, cy = 40; s.appendChild(el("circle", { cx, cy, r: R, fill: "none", stroke: css("--rule-strong") })); const hd = el("line", { x1: cx, y1: cy, x2: cx + R, y2: cy, stroke: css("--cls-1"), "stroke-width": 2 }); s.appendChild(hd); hands.push([hd, cx, cy]);
    if (i % 4 === 0 || i === DIM / 2 - 1) txt(s, cx, 66, "pair " + i, { fs: 10 }); }
  txt(s, CW / 2, 96, "the query at position m: pair 0 turns every 6 positions, pair 31 once every 47 117", { fs: 12 });
  clocksHost.appendChild(s);
  const sl = { m: $("#rope-m"), n: $("#rope-n"), s: $("#rope-s") };
  let lastL = null, lastR = null;
  function update() {
    const shift = +sl.s.value, m = Math.min(1023, +sl.m.value + shift), n = Math.min(1023, +sl.n.value + shift);
    $("#rope-m-v").textContent = m; $("#rope-n-v").textContent = n; $("#rope-s-v").textContent = shift;
    const learned = dot(q.map((v, i) => v + TABLE[m][i]), k.map((v, i) => v + TABLE[n][i])), rp = dot(rotate(q, m), rotate(k, n));
    const bl = $("#rope-learned"), br = $("#rope-rope");
    $(".v", bl).textContent = learned.toFixed(2); $(".v", br).textContent = rp.toFixed(4);
    bl.className = "box " + (lastL !== null && Math.abs(learned - lastL) > 1e-9 ? "moved" : ""); br.className = "box " + (lastR !== null && Math.abs(rp - lastR) < 1e-9 ? "still" : "");
    lastL = learned; lastR = rp;
    hands.forEach(([hd, cx, cy], i) => { const a = m * Math.pow(10000, -2 * i / DIM); hd.setAttribute("x2", cx + R * Math.cos(a)); hd.setAttribute("y2", cy - R * Math.sin(a)); });
    $("#rope-learned .k").textContent = `learned table · offset ${m - n}`; $("#rope-rope .k").textContent = `RoPE · offset ${m - n}`;
  }
  Object.values(sl).forEach(x => x.addEventListener("input", update)); update();
})();

/* ---- 02 past the window */
function pplByBucket(nll, b) { const out = []; for (let i = 0; i + b <= nll.length; i += b) { let s = 0; for (let j = i; j < i + b; j++) s += nll[j]; out.push([i + b, Math.exp(s / b)]); } return out; }
(function ropeCurves() {
  const RA = RP.artifact, M = RA.models, names = Object.keys(M), colors = { 0: "--ink-3", 1: "--cls-1", 2: "--cls-2", 3: "--cls-0" };
  const ext = M[names[1]].nll_by_position, int_ = M[names[2]].nll_by_position;
  const mean = (a, lo, hi) => Math.exp(a.slice(lo, hi).reduce((x, y) => x + y, 0) / (hi - lo));
  const inExt = mean(ext, 0, 2048), inInt = mean(int_, 0, 2048), lastExt = mean(ext, ext.length - 256, ext.length), lastInt = mean(int_, int_.length - 256, int_.length);
  // where the wall starts: first 64-position window past the training window at twice the in-window perplexity
  let wall = null; for (let i = 2048; i + 64 <= ext.length; i += 16) { if (mean(ext, i, i + 64) > 2 * mean(ext, 1536, 2048)) { wall = i; break; } }
  const betG = makeBet("#bet-rope-gpt", ["an error — no such row", "a worse prediction", "the same as at 1 024"], 0);
  const betE = makeBet("#bet-rope-ext", ["flat, it extrapolates", "a slow climb", "a wall right away", "flat for a while, then a wall"], wall === null ? 0 : wall > 2048 + 256 ? 3 : 2);
  const betI = makeBet("#bet-rope-int", ["better", "the same", "worse"], inInt > inExt * 1.05 ? 2 : inInt < inExt * 0.95 ? 0 : 1);
  let bucket = 128;
  function draw() {
    const series = names.map((nm, i) => { const pts = pplByBucket(M[nm].nll_by_position, bucket); return { x: pts.map(p => p[0]), y: pts.map(p => p[1]), color: css(colors[i]), label: `${nm} (trained at ${num(M[nm].window)})`, r: 3, tip: (x, y) => `${nm}<br>positions ${num(x - bucket + 1)}–${num(x)}: ${y.toFixed(1)}` }; });
    lineChart($("#rope-chart"), { W: 1000, H: 360, L: 70, fs: 13, ylog: 1, series, xlabel: "position in the stream", ylabel: `perplexity, ${bucket}-position buckets (log)`, yfmt: v => tickFmt(v), vlines: [{ x: 1024, label: "gpt2's table ends", color: css("--ink-3") }, { x: 2048, label: "pythia's training window", color: css("--ink-3") }], xmin: 0, xmax: RA.stream_len, legendX: 90 });
    $("#rope-b-v").textContent = bucket;
  }
  $("#rope-b").addEventListener("input", e => { bucket = +e.target.value; draw(); });
  REDRAW.push(draw);
  $("#rope-err").innerHTML = `gpt2 at position ${num(M[names[0]].window + 1)}: <span class="miss">${esc(M[names[0]].error_past_window)}</span>`;
  const cols = [{ h: "model", f: r => `<b>${esc(r.name)}</b>` }].concat([512, 1024, 1536, 2048, 2560, 3072].map(p => ({ h: `≤ ${num(p)}`, num: 1, f: r => { const pts = pplByBucket(r.nll, 512).find(q => q[0] === p); return pts ? pts[1].toFixed(1) : "—"; } })));
  table($("#rope-table"), cols, names.map(nm => ({ name: nm, nll: M[nm].nll_by_position })));
  reveal("btn-rope-reveal", ["rope-out"], "rope-note", [betG, betE, betI]);
  const yarn = M[names[3]] ? M[names[3]].nll_by_position : null;
  $("#rope-note").innerHTML = `GPT-2 at 1 025 is not a worse prediction; it is an <code>IndexError</code> — the table has no row, and no scaling trick applies to a table. Pythia, run past its window as is: nothing happens for about ${num(Math.round((wall - 2048) / 100) * 100)} positions — then the wall, ${lastExt.toFixed(0)} in the last 256 positions. Squeezed by 1.5, the wall is gone (${lastInt.toFixed(0)} in the last 256) and the price is everywhere: ${inInt.toFixed(0)} against ${inExt.toFixed(0)} <em>inside</em> the window, because every offset the model learned now means something 1.5 times smaller. That is the trade behind every "context extended" release note: interpolate so nothing collapses, then fine-tune briefly at the new length.${yarn ? ` YaRN, the fourth line: ${mean(yarn, yarn.length - 256, yarn.length).toFixed(0)} in the last 256 and ${mean(yarn, 0, 2048).toFixed(0)} inside — the price is gone, without a step of training.` : ""} ${RA.n_streams} streams, one seed; the bucket-to-bucket wobble is the noise floor.`;
})();

/* ---- 02 YaRN */
(function yarn() {
  const wl = RP.wavelength, L = 2048;
  const mult = (s, a, b) => wl.map(w => { const g = Math.min(1, Math.max(0, (L / w - a) / (b - a))); return (1 - g) / s + g; });
  const bad = Object.entries(RP.yarnCheck).filter(([s, v]) => { const m = mult(+s, 1, 32); return v.some((x, i) => Math.abs(x - m[i]) > 1e-5); });
  ck("#yarn-ck", bad.length === 0, bad.length ? "differs from the notebook at s = " + bad.map(b => b[0]).join(", ") : `matches the notebook's yarn_multiplier at s = ${Object.keys(RP.yarnCheck).join(", ")}`);
  const sl = { s: $("#yarn-s"), a: $("#yarn-a"), b: $("#yarn-b") };
  function draw() {
    const s = +sl.s.value, a = +sl.a.value, b = +sl.b.value; $("#yarn-s-v").textContent = s; $("#yarn-a-v").textContent = a; $("#yarn-b-v").textContent = b;
    const m = mult(s, a, b), x = wl.map((_, i) => i);
    lineChart($("#yarn-chart"), { W: 520, H: 300, L: 76, fs: 12.5, series: [{ x, y: x.map(() => 1 / s), color: css("--ink-3"), dash: 1, nodots: 1, label: `linear: every pair / ${s}` }, { x, y: m, color: css("--cls-1"), r: 3, label: `YaRN, s = ${s}`, tip: (i, y) => `pair ${i}: a turn every ${num(Math.round(wl[i]))} positions · ${(L / wl[i]).toFixed(1)} turns inside L · × ${y.toFixed(3)}` }], xlabel: "pair i (0 = fastest)", ylabel: "multiplier on θ_i", ymin: 0, ymax: 1.05, xticks: [0, 4, 8, 12, 16, 20, 24, 28, 31] });
    const t = Math.pow(0.1 * Math.log(s) + 1, 2), untouched = m.filter(v => v > 0.999).length, full = m.filter(v => Math.abs(v - 1 / s) < 1e-6).length;
    $("#yarn-stats").innerHTML = stat(untouched, "pairs untouched") + stat(full, "pairs fully squeezed") + stat(t.toFixed(2) + "×", "on the logits (1/t)");
    $("#yarn-note").innerHTML = `At s = ${s}: pairs with more than β = ${b} turns inside the window keep their angles, pairs with fewer than α = ${a} are divided by ${s}, the rest ramp. The temperature is ${t.toFixed(2)} on the attention logits — ${s <= 2 ? "almost nothing at this stretch" : "no longer negligible"}. Measured on Pythia at s = 1.5: no wall past the window, and inside it ${M2()} — the price linear interpolation paid is gone.`;
  }
  const M2 = () => { const M = RP.artifact.models, k = Object.keys(M); if (!M[k[3]]) return "—"; const mean = (a, lo, hi) => Math.exp(a.slice(lo, hi).reduce((x, y) => x + y, 0) / (hi - lo)); return `${mean(M[k[3]].nll_by_position, 0, 2048).toFixed(0)} against the native ${mean(M[k[1]].nll_by_position, 0, 2048).toFixed(0)}`; };
  Object.values(sl).forEach(x => x.addEventListener("input", draw)); REDRAW.push(draw);
})();

/* ---- 03 the KV cache, step by step */
(function kvFig() {
  const P = 3, MAXT = 6; let t = 0, mode = "nocache";
  const toks = ["The", "match", "ended", "after", "ninety", "minutes", "of", "extra", "time", "."];
  function draw(m) { mode = m || mode; const host = $("#fig-kv"); host.innerHTML = ""; const W = 1000, H = 250, s = svg(W, H), cw = 76, x0 = 40;
    const T = P + t;
    txt(s, x0, 22, mode === "nocache" ? "no cache: every step re-reads the whole prefix — every column below is evaluated again" : "KV cache: the prefix's keys and values are kept per layer — only the new column is evaluated", { anchor: "start", fs: 13, color: css("--ink") });
    for (let step = 0; step <= t; step++) { const y = step === 0 ? 46 : 118; if (step > 0 && step < t) continue; const row = step === 0 ? "prefill" : `step ${step}`; txt(s, x0, y + 14, row, { anchor: "start", fs: 11.5 });
      const n = P + step; for (let i = 0; i < n; i++) { const fresh = mode === "nocache" || step === 0 || i === n - 1; const isNew = step > 0 && i === n - 1;
        box(s, x0 + 60 + i * cw, y, cw - 6, 22, toks[i], { fill: fresh ? (isNew ? TINT("--cls-1", 40) : TINT("--cls-0", 26)) : css("--panel"), stroke: fresh ? css(isNew ? "--cls-1" : "--cls-0") : css("--rule"), fs: 11.5, rx: 3, dash: !fresh }); }
      if (step === t && t > 0) { arrow(s, x0 + 60 + n * cw - 2, y + 11, x0 + 60 + n * cw + 26, y + 11, { color: css("--cls-1") }); txt(s, x0 + 60 + n * cw + 34, y + 15, `→ '${toks[n]}'`, { anchor: "start", fs: 12, color: css("--cls-1") }); }
      if (step === 0 && t > 1) txt(s, x0 + 8, y + 46, "⋮", { anchor: "start", fs: 13 }); }
    const evalN = mode === "nocache" ? Array.from({ length: t + 1 }, (_, k) => P + k).reduce((a, b) => a + b, 0) : P + t, need = P + t;
    $("#kv-t").textContent = t; $("#kv-eval").textContent = evalN; $("#kv-need").textContent = need;
    txt(s, x0, H - 42, `positions evaluated: ${evalN} · needed: ${need} · after T steps: ${mode === "nocache" ? "P·T + T(T+1)/2" : "P + T"}`, { anchor: "start", fs: 13, color: css("--ink"), bold: 1 });
    const lg = [["evaluated this step", "--cls-0", 26], ["the new token", "--cls-1", 40]]; if (mode === "cache") lg.push(["from the cache", null, 0]);
    lg.forEach(([l, c, p], i) => { const x = x0 + i * 200; box(s, x, H - 24, 16, 12, null, { fill: c ? TINT(c, p) : css("--panel"), stroke: c ? css(c) : css("--rule"), rx: 2, dash: !c }); txt(s, x + 22, H - 14, l, { anchor: "start", fs: 11.5 }); });
    host.appendChild(s); }
  const set = states("fig-kv-btns", draw);
  $("#kv-step").addEventListener("click", () => { t = Math.min(MAXT, t + 1); draw(); });
  $("#kv-reset").addEventListener("click", () => { t = 0; draw(); });
})();
(function kvNumbers() {
  const K = D.kv, ratio64 = K.sixtyFourMs / K.onePassMs, r896 = K.table.find(r => r.n === 896);
  const betOne = makeBet("#bet-kv-one", ["about 2×", "about 10×", "about 40×", "about 64×"], ratio64 < 5 ? 0 : ratio64 < 25 ? 1 : ratio64 < 55 ? 2 : 3);
  const betR = makeBet("#bet-kv-ratio", ["about 500", "about 50", "under 5"], r896.ratio > 100 ? 0 : r896.ratio > 20 ? 1 : 2);
  $("#kv-stats").innerHTML = stat(K.onePassMs.toFixed(0) + " ms", `one pass, ${K.promptTokens} tokens`) + stat(K.sixtyFourMs.toFixed(0) + " ms", "64 generated tokens") + stat(ratio64.toFixed(0) + "×", "slower") + stat((K.sixtyFourMs / 64).toFixed(0) + " ms", "one cached step, one token");
  table($("#kv-table"), [{ h: "new tokens", num: 1, f: r => r.n }, { h: "no cache, s", num: 1, f: r => r.noCache.toFixed(2) }, { h: "cache, s", num: 1, f: r => r.cache.toFixed(2) }, { h: "ratio", num: 1, f: r => `<b>${r.ratio.toFixed(1)}</b>` }, { h: "by token-passes", num: 1, f: r => (K.promptTokens + r.n / 2).toFixed(0) }], K.table);
  REDRAW.push(() => lineChart($("#kv-chart"), { W: 460, H: 280, L: 64, fs: 12.5, ylog: 1, series: [{ x: K.table.map(r => r.n), y: K.table.map(r => r.ratio), color: css("--cls-1"), label: "measured ratio, M4", tip: (x, y) => `${x} tokens: ${y.toFixed(1)}×` }, { x: K.table.map(r => r.n), y: K.table.map(r => K.promptTokens + r.n / 2), color: css("--ink-3"), dash: 1, label: "P + T/2, by token-passes", tip: (x, y) => `${x} tokens: ${y.toFixed(0)}×` }], xlabel: "new tokens", ylabel: "no cache / cache (log)", yfmt: v => tickFmt(v), ymin: 1, ymax: 5000 }));
  reveal("btn-kv-reveal", ["kv-out"], "kv-note", [betOne, betR]);
  $("#kv-note").innerHTML = `Count token-passes and the cache should buy a factor of P + T/2 — about ${(K.promptTokens + 448).toFixed(0)} at 896 tokens. Measured on the M4: ${K.table[0].ratio.toFixed(1)} at 64, ${r896.ratio.toFixed(1)} at 896. The uncached run pushes hundreds of positions through the network in one batched pass, which the GPU does in parallel; the cached step is one token, and what it pays for is launching kernels, not arithmetic — a one-token step cost ${(K.sixtyFourMs / 64).toFixed(0)} ms, the whole ${K.promptTokens}-token pass ${K.onePassMs.toFixed(0)} ms. The quadratic term is real, and it shows only when the prefix is long. Both numbers move by tens of percent between runs on MPS. The bill for the cache — memory, per token, per layer — is next week.`;
})();

/* ---- 04 zero-shot: the artifact and the verbalizer builder */
(function zeroShot() {
  const Z = D.zeroShot, R = Z.artifact.results, live = Z.live;
  const asWritten = R["class names, sum"].accuracy;
  const bet = makeBet("#bet-zs", ["about 0.25", "about 0.4", "about 0.6", "about 0.8"], asWritten < 0.32 ? 0 : asWritten < 0.5 ? 1 : asWritten < 0.7 ? 2 : 3);
  $("#zs-stats").innerHTML = stat(fmt(asWritten, 3), "class names as written, 7 600 texts") + stat(fmt(live.accuracy, 3), `live cell, ${live.n} texts`) + stat(Object.entries(live.tokensPerName).map(([c, n]) => `${c.replace("Sci/Tech", "Sci/Tech")} ${n}`).join(" · "), "tokens per class name");
  table($("#zs-table"), [{ h: "verbalizer", f: r => `<b>${esc(r.k)}</b>` }, { h: "words", mono: 1, f: r => esc(r.words.join(" ")) }, { h: "tokens", num: 1, f: r => r.tokens_per_word.join(" ") }, { h: "accuracy", num: 1, f: r => `<b>${fmt(r.accuracy, 4)}</b>` }].concat(CLS.map(c => ({ h: c, num: 1, f: r => fmt(r.per_class[c], 3) }))), Object.keys(R).map(k => Object.assign({ k }, R[k])));
  reveal("btn-zs-reveal", ["zs-out"], "zs-note", [bet]);
  $("#zs-note").innerHTML = `On the ${live.n} live texts <code>Sci/Tech</code> was chosen ${live.predictedAs["Sci/Tech"] || 0} times and <code>World</code> ${live.predictedAs.World}. <code>Sci/Tech</code> is three tokens; <code>World</code> is one. A sum of three log-probabilities is smaller than a sum of one almost by construction — the argmax was decided by tokenization, not by the text. The per-token fix loses ${Math.round(100 * (R["class names, sum"].accuracy - R["class names, per token"].accuracy))} points and flips the failure (now <code>Sci/Tech</code> takes almost everything: the two tokens after <code>Sci</code> are nearly free). One-token words — a <strong>verbalizer</strong> — buy ${Math.round(100 * (R["one token each, sum"].accuracy - R["class names, sum"].accuracy))} points: ${fmt(R["one token each, sum"].accuracy, 2)}, above week 4's mask and far below TF-IDF.`;
  // the builder
  const PL = Z.pool, W = PL.words, N = PL.n, sums = f16(PL.sums), nTok = PL.tokensPerWord, gold = PL.gold;
  $("#vb-n").textContent = num(N);
  const assign = new Array(W.length).fill(-1);
  [" world", " sports", " business", " technology"].forEach((w, c) => { assign[W.indexOf(w)] = c; });
  let how = "sum";
  function evalSet() {
    const pred = new Int8Array(N), have = [0, 1, 2, 3].map(c => assign.some(a => a === c));
    for (let i = 0; i < N; i++) { let best = -1, bs = -Infinity; for (let c = 0; c < 4; c++) { let sc = -Infinity; for (let w = 0; w < W.length; w++) if (assign[w] === c) { const v = sums[i * W.length + w] / (how === "per" ? nTok[w] : 1); if (v > sc) sc = v; } if (sc > bs) { bs = sc; best = c; } } pred[i] = best; }
    const conf = [[0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]]; let hit = 0; for (let i = 0; i < N; i++) { if (pred[i] >= 0) conf[gold[i]][pred[i]]++; if (pred[i] === gold[i]) hit++; }
    return { acc: hit / N, conf, per: conf.map((row, c) => row[c] / row.reduce((a, b) => a + b, 0)), have };
  }
  function draw() {
    $("#vb").innerHTML = CLS.map((c, ci) => `<div class="cls c${ci}"><div class="h t${ci}">${esc(c)}</div><div class="words">${W.map((w, wi) => `<button data-w="${wi}" data-c="${ci}" class="${assign[wi] === ci ? "on" : ""}">${esc(w.trim())}<i>${nTok[wi]}</i></button>`).join("")}</div></div>`).join("");
    const r = evalSet();
    $("#vb-acc").innerHTML = stat(fmt(r.acc, 4), "accuracy") + CLS.map((c, ci) => stat(r.have[ci] ? fmt(r.per[ci], 2) : "—", c)).join("") + `<span class="small-note">${how === "sum" ? "summed log-prob" : "log-prob per token"} · a class takes its best word</span>`;
    $("#vb-conf").innerHTML = `<tr><th></th>${CLS.map(c => `<th>→ ${esc(c)}</th>`).join("")}</tr>` + r.conf.map((row, g) => `<tr><th>${esc(CLS[g])}</th>${row.map((v, p) => `<td class="${p === g ? "hit" : v ? "" : "miss"}">${v}</td>`).join("")}</tr>`).join("");
  }
  $("#vb").addEventListener("click", e => { const b = e.target.closest("button[data-w]"); if (!b) return; const w = +b.dataset.w, c = +b.dataset.c; assign[w] = assign[w] === c ? -1 : c; draw(); });
  toggle("vb-how", m => { how = m; draw(); });
  draw();
  // parity with Python on the four fixed sets
  const checks = Z.poolCheck, saved = assign.slice(), savedHow = how; const bad = [];
  for (const [name, c] of Object.entries(checks)) { assign.fill(-1); c.words.forEach((w, ci) => { assign[W.indexOf(w)] = ci; }); how = /PerToken/.test(name) ? "per" : "sum"; const r = evalSet(); if (Math.abs(r.acc - c.accuracy) > 5e-4) bad.push(`${name} ${r.acc.toFixed(4)} vs ${c.accuracy}`); }
  assign.splice(0, assign.length, ...saved); how = savedHow;
  ck("#vb-ck", bad.length === 0, bad.length ? bad.join("; ") : `argmax here = Python on ${Object.keys(checks).length} verbalizers`);
})();

/* ---- 04 the card */
(function card() {
  const TASKS = { punct: { title: "3.1 · restore punctuation and capitalisation", text: "A speech recogniser writes everything in lower case with no punctuation. One million utterances a day. Return the text as a person would have typed it.", items: 1000000, tin: 60, tout: 60, follow: "and NASA? U.S.? iPhone? 3.5? — and if the words arrive one at a time, from a live stream?" },
    typos: { title: "3.2 · fix the typos in search queries", text: "A hundred thousand queries a minute, a tenth of them with a typo. Return the corrected query.", items: 100000 * 60 * 24, tin: 8, tout: 8, follow: "alot → a lot, ca n't → can't: the number of words changes — and if the misspelt word is a brand?" },
    ner: { title: "3.3 · extract the entities", text: "Named entities, four types, twenty milliseconds per document. You built this one last week — [B, L, 9], BIO tags, entity F1 of 0.89 on CoNLL-2003. The card asks you to do it the other way, and to say what it would cost.", items: 1000000, tin: 40, tout: 24, follow: "Bank of America — an organisation with a location inside it — a new entity type every month — the client wants JSON: where do the boundaries come from?" } };
  const FIELDS = [["body", ["encoder", "decoder", "encoder–decoder"]], ["use", ["head", "scorer", "generator", "transformer"]], ["output", ["[B, C]", "[B, L, C]", "[B, L, 2]", "a sequence over the vocabulary"]], ["enumerable", ["yes → a head", "no → the prefix"]], ["guaranteed", ["a label", "a copy of the input", "a substring", "nothing"]], ["passes", ["1", "candidates", "T_out"]]];
  const state = {}; let cur = "punct";
  function estimate(passes, items, tin, tout, candidates) { candidates = candidates || 4; const p = { "1": 1, candidates, T_out: tout }[passes]; const read = tin * (passes === "candidates" ? candidates : 1) + (passes === "T_out" ? tout : 0), written = passes === "T_out" ? tout : 0; return { "passes / day": p * items, "tokens read / day": read * items, "tokens written / day": written * items }; }
  const bad = D.cards.estimateCheck.filter(c => { const e = estimate(c.passes, c.items, c.tin, c.tout); return Object.keys(c.out).some(k => e[k] !== c.out[k]); });
  ck("#est-ck", bad.length === 0, bad.length ? `${bad.length} estimates differ from the notebook` : `estimate here = the notebook's estimate on ${D.cards.estimateCheck.length} cases`);
  function draw() {
    const T = TASKS[cur], st = state[cur] = state[cur] || { items: T.items, tin: T.tin, tout: T.tout };
    $("#card-task").innerHTML = `<p style="margin:0"><b>${esc(T.title)}</b> — <em>${esc(T.text)}</em></p>`;
    $("#card").innerHTML = FIELDS.map(([k, opts]) => `<span class="k">${k}</span><span class="btnrow row-btns" data-k="${k}">${opts.map(o => `<button data-v="${esc(o)}" class="${st[k] === o ? "sel" : ""}">${esc(o)}</button>`).join("")}</span>`).join("") +
      `<span class="k">items / day</span><span><input type="text" data-n="items" value="${st.items}"></span><span class="k">tokens in</span><span><input type="text" data-n="tin" value="${st.tin}"></span><span class="k">tokens out</span><span><input type="text" data-n="tout" value="${st.tout}"></span><span class="k">follow-up</span><span style="font-size:15.5px;color:var(--ink-2)">${esc(T.follow)}</span>`;
    const p = st.passes ? { "1": "1", candidates: "candidates", T_out: "T_out" }[st.passes] : null;
    $("#card-est").innerHTML = p ? Object.entries(estimate(p, +st.items || 0, +st.tin || 0, +st.tout || 0)).map(([k, v]) => stat(v >= 1e9 ? (v / 1e9).toFixed(1) + "B" : v >= 1e6 ? (v / 1e6).toFixed(1) + "M" : num(v), k)).join("") : `<span class="small-note">pick <b>passes</b> to get the numbers</span>`;
    $("#card-note").innerHTML = st.guaranteed ? `Guaranteed to be <b>${esc(st.guaranteed)}</b>: that line decides the reveal. ${st.guaranteed === "nothing" ? "A generator's output is nothing in particular — measure fidelity, not only accuracy." : st.guaranteed === "a label" ? "A label set has a ceiling — measure what it cannot express before training." : st.guaranteed === "a substring" ? "Two pointers cannot invent; a generator usually copies, and nothing forces it to." : "A copy is safe and cannot correct anything."}` : "Fill the card; the two tables in block 05 say who was right.";
  }
  $("#card-tabs").addEventListener("click", e => { const b = e.target.closest("button[data-c]"); if (!b) return; cur = b.dataset.c; $$("#card-tabs button").forEach(x => x.classList.toggle("sel", x === b)); draw(); });
  $("#card").addEventListener("click", e => { const b = e.target.closest("button[data-v]"); if (!b) return; const k = b.closest("[data-k]").dataset.k; state[cur][k] = state[cur][k] === b.dataset.v ? null : b.dataset.v; draw(); });
  $("#card").addEventListener("input", e => { const i = e.target.closest("input[data-n]"); if (!i) return; state[cur][i.dataset.n] = i.value.replace(/[^0-9]/g, ""); const p = state[cur].passes; if (p) $("#card-est").innerHTML = Object.entries(estimate(p, +state[cur].items || 0, +state[cur].tin || 0, +state[cur].tout || 0)).map(([k, v]) => stat(v >= 1e9 ? (v / 1e9).toFixed(1) + "B" : v >= 1e6 ? (v / 1e6).toFixed(1) + "M" : num(v), k)).join(""); });
  draw();
})();

/* ---- 04 word_label, running here */
const PU = D.punct, CASES = PU.cases, PUNCTS = PU.puncts;
const stripText = t => t.toLowerCase().replace(/[^a-z0-9' ]/g, "");
function wordLabel(word) {
  const tail = word.match(/[^A-Za-z0-9']*$/)[0], inner = word.slice(0, word.length - tail.length);
  let punct = PUNCTS.includes(tail) ? tail : "other";
  if (inner.replace(/[^A-Za-z0-9']/g, "") !== inner) punct = "other";
  const letters = inner.replace(/[^A-Za-z]/g, ""); let cs;
  if (letters === letters.toLowerCase()) cs = "lower"; else if (letters === letters.toUpperCase() && letters.length > 1) cs = "CAPS"; else if (letters === letters[0].toUpperCase() + letters.slice(1).toLowerCase()) cs = "Cap"; else cs = "other";
  return cs + "|" + punct;
}
function applyLabel(stripped, label) { const [cs, punct] = label.split("|"); const w = { lower: stripped, Cap: stripped[0] ? stripped[0].toUpperCase() + stripped.slice(1) : stripped, CAPS: stripped.toUpperCase(), other: stripped }[cs]; return w + (punct !== "other" ? punct : ""); }
(function wordLabels() {
  const bad = PU.labelCheck.filter(c => wordLabel(c.word) !== c.label || applyLabel(stripText(c.word), c.label) !== c.rebuilt);
  ck("#wl-ck", bad.length === 0, bad.length ? "differs on " + bad.map(b => b.word).join(", ") : `word_label here = Python on ${PU.labelCheck.length} words`);
  function draw() { const words = $("#wl-in").value.split(/\s+/).filter(Boolean), labs = words.map(wordLabel), unx = labs.filter(l => /other/.test(l)).length;
    $("#wl-out").innerHTML = words.map((w, i) => `<span class="tok${/other/.test(labs[i]) ? " unx" : ""}">${esc(w)}<i>${esc(labs[i])}</i></span>`).join("");
    $("#wl-line").textContent = `${unx} of ${words.length} words cannot be expressed by the ${PU.labels.length} labels · on the ${num(PU.liveCeiling.n)} live texts: ${pct(PU.liveCeiling.unexpressible, 1)} of ${num(PU.liveCeiling.nWords)} words · on the ${num(PU.artifact.n_test)} test texts: ${pct(PU.artifact.ceiling.unexpressible, 1)}`; }
  $("#wl-in").addEventListener("input", draw); draw();
})();

/* ---- 04 add_noise, running here */
const TY = D.typos, OPS = TY.ops;
function addNoise(text, opsSeq, ks, cs) {
  // the notebook's add_noise with a scripted rng: an op is drawn only for words longer than 2 letters (rate 1), k likewise, c for every word
  const words = text.split(" "), noisy = [], ops = [], flags = []; let i = 0, oi = 0, ki = 0, ci = 0;
  while (i < words.length) { const w = words[i]; let op = w.length > 2 ? opsSeq[oi++] : "none"; const k = w.length > 2 ? ks[ki++] : 0, c = cs[ci++]; let out;
    if (op === "merge" && i + 1 === words.length) op = "none";
    if (op === "none") out = [w]; else if (op === "sub") out = [w.slice(0, k) + c + w.slice(k + 1)]; else if (op === "del") out = [w.slice(0, k) + w.slice(k + 1)]; else if (op === "ins") out = [w.slice(0, k) + c + w.slice(k)];
    else if (op === "swap") out = [w.slice(0, k) + w[k + 1] + w[k] + w.slice(k + 2)]; else if (op === "split") out = [w.slice(0, k), w.slice(k)]; else { out = [w + words[i + 1]]; ops.push("merge"); i += 1; }
    noisy.push(...out); ops.push(op); for (let j = 0; j < out.length; j++) flags.push(op !== "none"); i += 1; }
  return { noisy: noisy.join(" "), ops, flags };
}
(function noise() {
  const bad = TY.noiseCheck.filter(c => { const r = addNoise(c.text, c.ops, c.ks.concat(c.ks, c.ks), c.cs.concat(c.cs, c.cs)); return r.noisy !== c.noisy || r.ops.join() !== c.opsOut.join() || r.flags.join() !== c.flags.join(); });
  ck("#noise-ck", bad.length === 0, bad.length ? `differs from Python on '${bad[0].text}'` : `add_noise here = Python on ${TY.noiseCheck.length} scripted cases`);
  $("#noise-ops").innerHTML = OPS.map((o, i) => `<button data-op="${o}" class="${i === 0 ? "on" : ""}">${o}</button>`).join("");
  let op = "sub";
  function draw() { const words = $("#noise-in").value.trim().split(/\s+/).filter(Boolean); if (!words.length) return; const wsl = $("#noise-w"), ksl = $("#noise-k"); wsl.max = words.length - 1; const wi = Math.min(+wsl.value, words.length - 1); wsl.value = wi; const w = words[wi]; ksl.max = Math.max(1, w.length - 2); const k = Math.min(+ksl.value, Math.max(1, w.length - 2)); ksl.value = k;
    $("#noise-w-v").textContent = `${wi} · '${w}'`; $("#noise-k-v").textContent = k;
    const seq = words.map((x, i) => i === wi ? op : "none"), r = addNoise(words.join(" "), seq.filter((_, i) => words[i].length > 2), words.map(() => k), words.map(() => "x"));
    const out = $("#noise-out"); out.textContent = r.noisy; const changed = r.noisy.split(" ").length !== words.length; out.className = "out " + (changed ? "no" : "ok");
    $("#noise-line").textContent = w.length <= 2 ? `'${w}' has 2 letters or fewer: add_noise leaves it alone` : `${op} at position ${k} of '${w}' → ${r.noisy.split(" ").length} words from ${words.length}${changed ? " — the word count changed: a label per input word has nowhere to say it" : " — one label per word can still point at it"}`; }
  $("#noise-ops").addEventListener("click", e => { const b = e.target.closest("button[data-op]"); if (!b) return; op = b.dataset.op; $$("#noise-ops button").forEach(x => x.classList.toggle("on", x === b)); draw(); });
  ["noise-in", "noise-w", "noise-k"].forEach(id => $("#" + id).addEventListener("input", draw)); draw();
})();

/* ---- 04 / 05 NER: the formats, parsed back — the notebook's parsers, ported */
const NE = D.ner, TYPES = ["PER", "ORG", "LOC", "MISC"];
function bioSpans(tags) { const spans = []; let start = null; const t2 = tags.concat(["O"]); for (let i = 0; i < t2.length; i++) { const t = t2[i]; if (start !== null && !t.startsWith("I-")) { spans.push([start, i, tags[start].slice(2)]); start = null; } if (t.startsWith("B-")) start = i; } return spans; }
function toInline(words, tags) { const out = []; let i = 0; for (const [s, e, t] of bioSpans(tags)) { out.push(...words.slice(i, s), `[${t} ${words.slice(s, e).join(" ")}]`); i = e; } return out.concat(words.slice(i)).join(" "); }
function toList(words, tags) { return bioSpans(tags).map(([s, e, t]) => `${words.slice(s, e).join(" ")}: ${t}`).join("; ") || "none"; }
/* difflib.SequenceMatcher(autojunk=False).get_matching_blocks, for sequences of words */
function matchingBlocks(a, b) {
  const blocks = [], queue = [[0, a.length, 0, b.length]];
  while (queue.length) { const [alo, ahi, blo, bhi] = queue.pop(); let bi = alo, bj = blo, bk = 0; const prev = new Map();
    for (let i = alo; i < ahi; i++) { const cur = new Map(); for (let j = blo; j < bhi; j++) { if (a[i] === b[j]) { const k = (prev.get(j - 1) || 0) + 1; cur.set(j, k); if (k > bk) { bi = i - k + 1; bj = j - k + 1; bk = k; } } } prev.clear(); cur.forEach((v, kk) => prev.set(kk, v)); }
    if (bk) { blocks.push([bi, bj, bk]); if (alo < bi && blo < bj) queue.push([alo, bi, blo, bj]); if (bi + bk < ahi && bj + bk < bhi) queue.push([bi + bk, ahi, bj + bk, bhi]); } }
  return blocks;
}
function parseInline(text, words) {
  const plain = [], ents = []; let cur = null;
  for (const t of text.split(/\s+/).filter(Boolean)) { const m = t.match(/^\[(PER|ORG|LOC|MISC)$/); if (m) { cur = [m[1], plain.length]; continue; } const closing = t.endsWith("]"); plain.push(t.replace(/\]+$/, "")); if (closing && cur) { ents.push([cur[1], plain.length, cur[0]]); cur = null; } }
  const tags = words.map(() => "O"); let unmatched = 0; const pairs = new Map();
  for (const [i, j, k] of matchingBlocks(plain, words)) for (let q = 0; q < k; q++) pairs.set(i + q, j + q);
  for (const [s, e, typ] of ents) { let ok = e > s; for (let i = s; i < e; i++) if (!pairs.has(i)) ok = false; if (ok) { let k = 0; for (let i = s; i < e; i++) tags[pairs.get(i)] = (k++ === 0 ? "B-" : "I-") + typ; } else unmatched++; }
  return [tags, unmatched];
}
function parseList(text, words) {
  const tags = words.map(() => "O"); let unmatched = 0; if (text.trim() === "none") return [tags, 0];
  for (const item of text.split(";")) { const p = item.lastIndexOf(":"); const spanS = (p < 0 ? "" : item.slice(0, p)).trim(), typ = (p < 0 ? item : item.slice(p + 1)).trim(); const span = spanS.split(/\s+/).filter(Boolean);
    const hits = []; for (let i = 0; i + span.length <= words.length; i++) if (span.length && words.slice(i, i + span.length).every((w, q) => w === span[q]) && tags[i] === "O") hits.push(i);
    if (TYPES.includes(typ) && hits.length) { for (let q = 0; q < span.length; q++) tags[hits[0] + q] = (q === 0 ? "B-" : "I-") + typ; } else unmatched++; }
  return [tags, unmatched];
}
function entLine(words, tags, wrongIdx) { const spans = bioSpans(tags), out = []; let i = 0; for (const [s, e, t] of spans) { out.push(esc(words.slice(i, s).join(" "))); out.push(`<span class="ent ${t}${wrongIdx && wrongIdx.has(s) ? " wrong" : ""}">${esc(words.slice(s, e).join(" "))}<i>${t}</i></span>`); i = e; } out.push(esc(words.slice(i).join(" "))); return out.filter(Boolean).join(" "); }
(function nerWriter() {
  const bad = NE.parseCheck.filter(c => { const [tags, un] = (c.fmt === "inline" ? parseInline : parseList)(c.text, c.words); return tags.join() !== c.tags.join() || un !== c.unmatched; });
  ck("#ner-ck", bad.length === 0, bad.length ? `${bad.length} of ${NE.parseCheck.length} parses differ from Python` : `parse_inline / parse_list here = Python on ${NE.parseCheck.length} strings`);
  const demos = NE.artifact.formats.inline.demo, d = demos.find(x => bioSpans(x.gold).length >= 2 && x.words.length <= 20) || demos[0], li = NE.artifact.formats.list.demo[demos.indexOf(d)];
  $("#ner-sent").innerHTML = entLine(d.words, d.gold) + ` <span class="small-note" style="display:inline">← gold</span>`;
  $("#ner-inline").placeholder = "e.g. " + toInline(d.words, d.gold); $("#ner-list").placeholder = "e.g. " + toList(d.words, d.gold);
  $("#ner-inline").value = d.generated; $("#ner-list").value = li.generated;
  function show(fmt) { const text = $(fmt === "inline" ? "#ner-inline" : "#ner-list").value, [tags, un] = (fmt === "inline" ? parseInline : parseList)(text, d.words);
    const goldSpans = new Map(bioSpans(d.gold).map(([s, e, t]) => [s, e + ":" + t])), wrong = new Set(bioSpans(tags).filter(([s, e, t]) => goldSpans.get(s) !== e + ":" + t).map(([s]) => s));
    $(fmt === "inline" ? "#ner-inline-out" : "#ner-list-out").innerHTML = `<div class="ent-line" style="font-size:16px">${entLine(d.words, tags, wrong)}</div><div class="small-note">${bioSpans(tags).length} entities parsed · <b style="color:var(--bad)">${un} unmatched</b> · ${wrong.size} not the gold span (dashed)${text === (fmt === "inline" ? d.generated : li.generated) ? " · this is what the model wrote" : ""}</div>`; }
  $("#ner-inline").addEventListener("input", () => show("inline")); $("#ner-list").addEventListener("input", () => show("list")); show("inline"); show("list");
})();

/* ---- 04 lightning round */
(function lightning() {
  const Q = [["Language identification, 100 000 requests per second.", [1], "Character n-grams and a linear model; no transformer at all. The trap is reaching for a model that reads 100 000 texts a second through twelve layers."],
    ["Autocomplete in a search box, on every keystroke.", [2], "A trie of frequent completions, or a small n-gram / RNN language model — one step per keystroke, no prefix re-read. The trap: GPT-2 at 60 ms per keystroke."],
    ["Spam / phishing on incoming mail.", [1, 4], "TF-IDF beat frozen BERT on topics; a fine-tuned encoder wins on phishing. One pass. The trap: \"just ask an LLM\" — one pass becomes ten, and the answer is not calibrated."],
    ["Translation, fifty language pairs, server-side batches.", [3], "Encoder–decoder — the source is read bidirectionally and only once; with a cache, a decoder-only reads it once too, but causally. The trap is \"always enc-dec\" and \"always decoder\"."],
    ["Question answering over the company's internal documents, the answer must be a quote.", [4], "Two pointers, [B, L, 2] — the answer is a substring by construction. The trap: a generator that usually quotes."],
    ["A chat assistant, a thousand concurrent users.", [5], "A decoder; the prefix is the conversation; the cost is T_out per turn and the cache per user. The trap: budgeting by FLOPs and forgetting memory — next week."]];
  const picks = Q.map(() => null); let done = false;
  $("#lr").innerHTML = Q.map((q, i) => `<div class="lr"><span>${i + 1}. ${esc(q[0])}</span><span class="pick" data-i="${i}">${[1, 2, 3, 4, 5].map(w => `<button data-w="${w}">week ${w}</button>`).join("")}</span><span class="ans" hidden><b>Week ${q[1].join(" or ")}.</b> ${esc(q[2])}</span></div>`).join("");
  $("#lr").addEventListener("click", e => { const b = e.target.closest("button[data-w]"); if (!b || done) return; const i = +b.closest("[data-i]").dataset.i; picks[i] = +b.dataset.w; $$("button", b.parentElement).forEach(x => x.classList.toggle("on", x === b)); $("#lr-score").textContent = `${picks.filter(p => p !== null).length} of ${Q.length} picked`; });
  $("#btn-lr-reveal").addEventListener("click", e => { done = true; let right = 0; $$("#lr .pick").forEach((p, i) => { $$("button", p).forEach(x => { const w = +x.dataset.w, ok = Q[i][1].includes(w); x.classList.toggle("right", ok); x.classList.toggle("wrong", picks[i] === w && !ok); }); if (Q[i][1].includes(picks[i])) right++; });
    $$("#lr .ans").forEach(a => a.hidden = false); $("#lr-score").textContent = `${right} of ${Q.length} agree with the answers`; e.target.disabled = true; e.target.textContent = "revealed"; });
})();

/* ---- 05 punctuation: label it yourself, then the reveal */
(function punctLabel() {
  const demos = PU.artifact.demo; let i = 0, checked = false;
  function draw() { checked = false; const d = demos[i]; $("#pl-i").textContent = i; $("#pl-score").textContent = "";
    $("#pl").innerHTML = d.words.map((w, wi) => `<span class="w${/other/.test(w.label) ? " unx" : ""}" data-i="${wi}"><span class="s">${esc(w.stripped)}</span><select>${PU.labels.map(l => `<option value="${esc(l)}"${l === "lower|" ? " selected" : ""}>${esc(l)}</option>`).join("")}</select><span class="g"></span></span>`).join(""); }
  $("#pl-prev").addEventListener("click", () => { i = (i + demos.length - 1) % demos.length; draw(); }); $("#pl-next").addEventListener("click", () => { i = (i + 1) % demos.length; draw(); });
  $("#btn-pl-check").addEventListener("click", () => { const d = demos[i]; let hit = 0, encHit = 0; $$("#pl .w").forEach(n => { const w = d.words[+n.dataset.i], pick = $("select", n).value, ok = applyLabel(w.stripped, pick) === w.gold; n.classList.toggle("hit", ok); n.classList.toggle("miss", !ok); if (ok) hit++; const encOk = w.encoder === w.gold; if (encOk) encHit++; $(".g", n).textContent = `gold ${w.label} · enc ${w.encoder == null ? "—" : wordLabel(w.encoder)}${encOk ? "" : " ✗"}`; });
    $("#pl-score").innerHTML = `you: <b>${hit}/${d.words.length}</b> · the encoder: <b>${encHit}/${d.words.length}</b> · unexpressible: ${d.words.filter(w => /other/.test(w.label)).length}`; });
  draw();
})();
(function punctReveal() {
  const A = PU.artifact, E = A.encoder, Dd = A.decoder;
  const betAll = makeBet("#bet-punct-all", ["the encoder, clearly", "the decoder, clearly", "within a point of each other"], Math.abs(E.accuracy - Dd.accuracy) < 0.01 ? 2 : E.accuracy > Dd.accuracy ? 0 : 1);
  const capE = (E.by_case.accuracy.Cap + E.by_punct.accuracy[","] + E.by_punct.accuracy["."]) / 3, capD = (Dd.by_case.accuracy.Cap + Dd.by_punct.accuracy[","] + Dd.by_punct.accuracy["."]) / 3;
  const betCap = makeBet("#bet-punct-cap", ["the encoder", "the decoder"], capE >= capD ? 0 : 1);
  const betChg = makeBet("#bet-punct-chg", ["under 1%", "about 5%", "over 10%"], Dd.changed < 0.01 ? 0 : Dd.changed < 0.1 ? 1 : 2);
  $("#punct-stats").innerHTML = stat(fmt(E.accuracy, 3), "encoder, word accuracy") + stat(fmt(Dd.accuracy, 3), "decoder, word accuracy") + stat(pct(A.ceiling.unexpressible, 1), "ceiling: unexpressible words") + stat(pct(Dd.changed, 1), "changed by the decoder") + stat(`${(E.ms_per_1000 / 1000).toFixed(1)}s / ${(Dd.ms_per_1000 / 1000).toFixed(0)}s`, "per 1 000 items, T4");
  const pairs = (host, key) => { const rows = Object.keys(E[key].words); host.innerHTML = rows.map(r => `<div class="pair${r === "other" ? " hl" : ""}"><span class="lab">${esc(r === "" ? "none" : r)}</span><span class="bar e" title="encoder"><i style="width:${(100 * E[key].accuracy[r]).toFixed(1)}%"></i></span><span class="bar d" title="decoder"><i style="width:${(100 * Dd[key].accuracy[r]).toFixed(1)}%"></i></span><span class="n">${fmt(E[key].accuracy[r], 2)} / ${fmt(Dd[key].accuracy[r], 2)} · ${num(E[key].words[r])}</span></div>`).join(""); };
  pairs($("#punct-case"), "by_case"); pairs($("#punct-punct"), "by_punct");
  const d0 = A.demo[0], dropped = d0.words.filter(w => w.decoder == null).length;
  $("#punct-drop").innerHTML = d0.words.map(w => w.decoder == null ? `<span class="drop">${esc(w.gold)}</span>` : stripText(w.decoder) !== stripText(w.gold) ? `<span class="chg">${esc(w.decoder)}</span>` : esc(w.decoder === w.gold ? w.gold : w.decoder)).join(" ") + `<div class="small-note">${dropped} of ${d0.words.length} words dropped — scored as wrong, not as changed</div>`;
  reveal("btn-punct-reveal", ["punct-out"], "punct-note", [betAll, betCap, betChg]);
  $("#punct-note").innerHTML = `Overall the two are a point apart — ${fmt(E.accuracy, 2)} and ${fmt(Dd.accuracy, 2)} — and the split underneath is the whole story. On every label the head can express, the encoder is ahead: <code>Cap</code> ${fmt(E.by_case.accuracy.Cap, 2)} to ${fmt(Dd.by_case.accuracy.Cap, 2)}, commas ${fmt(E.by_punct.accuracy[","], 2)} to ${fmt(Dd.by_punct.accuracy[","], 2)}, periods ${fmt(E.by_punct.accuracy["."], 2)} to ${fmt(Dd.by_punct.accuracy["."], 2)}. The decoder wins on the words the labels cannot express, and only there: ${fmt(Dd.by_case.accuracy.other, 2)} on the <code>other</code> cases, ${fmt(Dd.by_punct.accuracy.other, 2)} on the <code>other</code> punctuation, where the encoder is at zero by construction — and those are the words that matter. The encoder is cheaper by a factor of ${(Dd.ms_per_1000 / E.ms_per_1000).toFixed(0)} as measured, not the L ≈ ${Math.round(E.n_words / A.n_test)} the pass count promises: the generator's steps are batched. And a failure that <strong>changed</strong> does not count: a dropped word is scored as wrong, not as changed — the first demo text lost ${dropped} of its ${d0.words.length} words. Fidelity has to be measured on both sides.`;
})();

/* ---- 05 typos */
(function typos() {
  const A = TY.artifact, E = A.encoder, Dd = A.decoder, rows = ["none"].concat(OPS), picks = {};
  const zero = op => E.by_op.accuracy[op] < 0.02;
  function draw(revealed) { $("#typos-table").innerHTML = `<thead><tr><th>kind of noise</th><th class="num">words</th><th>zero by construction?</th><th class="num">encoder + dictionary</th><th class="num">decoder</th></tr></thead><tbody>` +
    rows.map(op => `<tr><td><b>${op}</b></td><td class="num">${num(E.by_op.words[op])}</td><td class="b">${op === "none" ? "" : ["yes", "no"].map(v => `<button data-op="${op}" data-v="${v}" class="${picks[op] === v ? "pick" : ""}${revealed ? (v === (zero(op) ? "yes" : "no") ? " right" : picks[op] === v ? " wrong" : "") : ""}">${v}</button>`).join(" ")}</td><td class="num${revealed && zero(op) ? " zero" : ""}">${revealed ? fmt(E.by_op.accuracy[op], 3) : "·"}</td><td class="num">${revealed ? fmt(Dd.by_op.accuracy[op], 3) : "·"}</td></tr>`).join("") + "</tbody>"; }
  $("#typos-table").addEventListener("click", e => { const b = e.target.closest("button[data-op]"); if (!b || b.classList.contains("right") || b.classList.contains("wrong")) return; picks[b.dataset.op] = b.dataset.v; draw(false); });
  draw(false);
  $("#typos-stats").innerHTML = stat(fmt(E.accuracy, 3), "encoder + dictionary, word accuracy") + stat(fmt(Dd.accuracy, 3), "decoder") + stat(`${fmt(E.detection_precision, 2)} / ${fmt(E.detection_recall, 2)}`, "detector precision / recall") + stat(`${(E.ms_per_1000 / 1000).toFixed(1)}s / ${(Dd.ms_per_1000 / 1000).toFixed(0)}s`, "per 1 000 items, T4");
  $("#typos-demo").innerHTML = A.demo.slice(0, 4).map(d => `<div class="order-row"><span class="k">noisy</span><span class="mono" style="font-size:14.5px">${esc(d.input)}</span></div><div class="order-row"><span class="k">gold</span><span>${esc(d.gold)}</span></div><div class="order-row"><span class="k">enc + dict</span><span>${esc(d.encoder)}${d.encoder === d.gold ? ' <b style="color:var(--good)">✓</b>' : ""}</span></div><div class="order-row" style="margin-bottom:10px"><span class="k">decoder</span><span>${esc(d.decoder)}${d.decoder === d.gold ? ' <b style="color:var(--good)">✓</b>' : d.decoder === d.input ? ' <b style="color:var(--bad)">left as is</b>' : ""}</span></div>`).join("");
  reveal("btn-typos-reveal", ["typos-out"], "typos-note", [], () => draw(true));
  const ops4 = ["sub", "del", "ins", "swap"], encAhead = ops4.filter(o => E.by_op.accuracy[o] > Dd.by_op.accuracy[o]);
  $("#typos-note").innerHTML = `Zero on <code>split</code>, zero on <code>merge</code>, and it is not a training problem — it is the formulation. A label per input word can only ever describe <em>that</em> word; it has nowhere to say "these two are one" or "this one is two". Not <em>expensive to express</em>, but <em>not expressible</em>. The usual escape is to extend the labels into edit operations — GECToR (Omelianchuk et al. 2020). The decoder is at ${fmt(Dd.by_op.accuracy.split, 2)} and ${fmt(Dd.by_op.accuracy.merge, 2)} there — and behind the dictionary on ${encAhead.length} of the four ops inside a word (${encAhead.map(o => `${o} ${fmt(Dd.by_op.accuracy[o], 2)} to ${fmt(E.by_op.accuracy[o], 2)}`).join(", ")}). A 124M model retyping a word is a worse speller than edit distance over a word list. Its row on <code>none</code>: ${fmt(Dd.by_op.accuracy.none, 3)} — it edits one clean word in ${Math.round(1 / (1 - Dd.by_op.accuracy.none))}. Overall ${fmt(Dd.accuracy, 3)} to ${fmt(E.accuracy, 3)}, and the whole margin is <code>split</code> and <code>merge</code>.`;
})();

/* ---- 05 NER reveal */
(function nerReveal() {
  const F = NE.artifact.formats, W4 = NE.week4, inl = F.inline, lst = F.list;
  const betF1 = makeBet("#bet-ner-f1", ["above BERT", "within 2 points", "3–5 points below", "more than 10 below"], (() => { const d = W4.entity_f1 - Math.max(inl.entity_f1, lst.entity_f1); return d < 0 ? 0 : d < 0.02 ? 1 : d < 0.06 ? 2 : 3; })());
  const betFmt = makeBet("#bet-ner-fmt", ["inline ahead", "list ahead", "within a point"], Math.abs(inl.entity_f1 - lst.entity_f1) < 0.01 ? 2 : inl.entity_f1 > lst.entity_f1 ? 0 : 1);
  const betUn = makeBet("#bet-ner-unm", ["under 5%", "5–15%", "over 15%"], Math.max(inl.unmatched_share, lst.unmatched_share) < 0.05 ? 0 : Math.max(inl.unmatched_share, lst.unmatched_share) < 0.15 ? 1 : 2);
  const rows = [{ k: "BERT, token head (week 4)", f1: W4.entity_f1, PER: W4.f1_PER, ORG: W4.f1_ORG, LOC: W4.f1_LOC, MISC: W4.f1_MISC }].concat(["inline", "list"].map(f => ({ k: "GPT-2, " + f, f1: F[f].entity_f1, ...F[f].f1_by_type, unm: F[f].unmatched_share, wt: F[f].wrong_type_share, tw: F[f].tokens_written_mean, ms: F[f].ms_per_1000 })));
  table($("#ner-table"), [{ h: "model", f: r => `<b>${esc(r.k)}</b>` }, { h: "entity F1", num: 1, f: r => `<b>${fmt(r.f1, 3)}</b>` }].concat(TYPES.map(t => ({ h: t, num: 1, f: r => fmt(r[t], 2) }))).concat([{ h: "unmatched", num: 1, f: r => r.unm == null ? "—" : pct(r.unm, 1) }, { h: "wrong type", num: 1, f: r => r.wt == null ? "—" : pct(r.wt, 1) }, { h: "tokens written", num: 1, f: r => r.tw == null ? "0" : r.tw }, { h: "s / 1 000", num: 1, f: r => r.ms == null ? "not timed" : (r.ms / 1000).toFixed(1) }]), rows);
  let fmt_ = "inline", i = 0;
  function demo() { const d = F[fmt_].demo[i]; $("#ner-demo-i").textContent = `${i + 1} / ${F[fmt_].demo.length}`; const goldSpans = new Map(bioSpans(d.gold).map(([s, e, t]) => [s, e + ":" + t])), wrong = new Set(bioSpans(d.parsed).filter(([s, e, t]) => goldSpans.get(s) !== e + ":" + t).map(([s]) => s));
    $("#ner-demo").innerHTML = `<div class="order-row"><span class="k">gold</span><span class="ent-line" style="font-size:16px">${entLine(d.words, d.gold)}</span></div><div class="order-row"><span class="k">written</span><span class="mono" style="font-size:14.5px">${esc(d.generated)}</span></div><div class="order-row"><span class="k">parsed</span><span class="ent-line" style="font-size:16px">${entLine(d.words, d.parsed, wrong)}${d.unmatched ? ` <b style="color:var(--bad)">${d.unmatched} unmatched — not in the text</b>` : ""}</span></div>`; }
  $("#ner-demo-btns").addEventListener("click", e => { const b = e.target.closest("button"); if (!b) return; if (b.dataset.m) { fmt_ = b.dataset.m; $$("#ner-demo-btns [data-m]").forEach(x => x.classList.toggle("sel", x === b)); } else if (b.id === "ner-demo-prev") i = (i + F[fmt_].demo.length - 1) % F[fmt_].demo.length; else if (b.id === "ner-demo-next") i = (i + 1) % F[fmt_].demo.length; demo(); });
  demo();
  reveal("btn-ner-reveal", ["ner-out"], "ner-note", [betF1, betFmt, betUn]);
  $("#ner-note").innerHTML = `At 124M the generator is below the head — ${fmt(inl.entity_f1, 2)} against ${fmt(W4.entity_f1, 2)} — and the two formats land within half a point of each other, one seed each, so on quality call it a tie; the list writes ${lst.tokens_written_mean} tokens where inline writes ${inl.tokens_written_mean} and costs half. The more interesting number is <em>how</em> it is wrong. The head can only miss or mislabel; it cannot invent, because a tag has to sit on a word. The generator invents — ${pct(inl.unmatched_share, 1)} of inline entities and ${pct(lst.unmatched_share, 1)} of list entities are not in the text — and ${pct(lst.wrong_type_share, 0)}–${pct(inl.wrong_type_share, 0)} of what it finds carries the wrong type. The follow-ups are where the generator earns its bill: <code>Bank of America</code> — BIO cannot nest, the inline format nests for free; <em>a new type every month</em> — the head is a matrix with nine rows, the generator is a word in the prompt.`;
})();

/* ---- 05 QA: the schematic with two orders, the reveal, the demos */
function figOrder(mode) {
  const host = $("#fig-order"); host.innerHTML = ""; const W = 1000, H = 200, s = svg(W, H);
  const cq = mode === "cq", ctxW = 420, qW = 200, gap = 20, x0 = 60, y = 60, h = 44;
  const first = cq ? { x: x0, w: ctxW, l: "the paragraph · ~150 tokens", c: "--cls-0" } : { x: x0, w: qW, l: "the question", c: "--cls-1" };
  const second = cq ? { x: x0 + ctxW + gap, w: qW, l: "the question", c: "--cls-1" } : { x: x0 + qW + gap, w: ctxW, l: "the paragraph · ~150 tokens", c: "--cls-0" };
  [first, second].forEach(b => box(s, b.x, y, b.w, h, b.l, { fill: TINT(b.c, 12), stroke: css(b.c), fs: 13 }));
  const ax = second.x + second.w + gap; box(s, ax, y, 120, h, "the answer →", { fill: TINT("--cls-2", 12), stroke: css("--cls-2"), fs: 13 });
  // who sees whom: causal arrows
  arrow(s, second.x + second.w / 2, y + h + 18, first.x + first.w / 2, y + h + 18, { color: css("--ink-2") }); txt(s, (first.x + first.w / 2 + second.x + second.w / 2) / 2, y + h + 36, `every token of "${cq ? "the question" : "the paragraph"}" sees all of "${cq ? "the paragraph" : "the question"}"`, { fs: 12 });
  arrow(s, first.x + first.w / 2, y - 14, second.x + second.w / 2, y - 14, { color: css("--bad"), dash: 1 }); txt(s, (first.x + first.w / 2 + second.x + second.w / 2) / 2, y - 22, `"${cq ? "the paragraph" : "the question"}" was encoded without seeing "${cq ? "the question" : "the paragraph"}"`, { fs: 12, color: css("--bad") });
  arrow(s, ax + 60, y + h + 52, second.x + second.w - 10, y + h + 52, { color: css("--cls-2") }); txt(s, (ax + 60 + second.x + second.w - 10) / 2, y + h + 70, `the answer is written right after ${cq ? "the question" : "the paragraph"}`, { fs: 12, color: css("--cls-2") });
  host.appendChild(s);
  $("#fig-order-note").innerHTML = cq ? "Context first: the paragraph is read <em>without knowing the question</em> — the argument from block 01 says this order should lose. But the question is the last thing before the answer." : "Question first: every token of the paragraph can see what to look for — the argument from block 01 says this order should win. But the model has to carry the question across 150 tokens of paragraph.";
}
states("fig-order-btns", figOrder);
(function qaReveal() {
  const A = D.qa.artifact, O = A.orders, W4 = D.qa.week4, names = Object.keys(O), cq = O["context, question"], qc = O["question, context"];
  const best = Math.max(cq.exact_match, qc.exact_match);
  const betEm = makeBet("#bet-qa-em", ["above BERT", "within 3 points", "5–10 points below", "more than 15 below"], (() => { const d = W4.exact_match - best; return d < 0 ? 0 : d < 3 ? 1 : d < 12 ? 2 : 3; })());
  const betOrd = makeBet("#bet-qa-order", ["context, question", "question, context", "a tie"], Math.abs(cq.exact_match - qc.exact_match) < 1 ? 2 : cq.exact_match > qc.exact_match ? 0 : 1);
  const betSub = makeBet("#bet-qa-sub", ["under 5%", "5–15%", "over 15%"], Math.max(cq.not_substring, qc.not_substring) < 0.05 ? 0 : Math.max(cq.not_substring, qc.not_substring) < 0.15 ? 1 : 2);
  table($("#qa-table"), [{ h: "model", f: r => `<b>${esc(r.k)}</b>` }, { h: "exact match", num: 1, f: r => `<b>${fmt(r.em, 1)}</b>` }, { h: "F1", num: 1, f: r => fmt(r.f1, 1) }, { h: "not a substring", num: 1, f: r => pct(r.ns, 1) }, { h: "tokens read", num: 1, f: r => r.tr == null ? "L" : r.tr }, { h: "s / 1 000", num: 1, f: r => r.ms == null ? "not timed" : (r.ms / 1000).toFixed(1) }],
    [{ k: "BERT, two pointers (week 4)", em: W4.exact_match, f1: W4.f1, ns: 0 }].concat(names.map(n => ({ k: "GPT-2, " + n, em: O[n].exact_match, f1: O[n].f1, ns: O[n].not_substring, tr: O[n].tokens_read_mean, ms: O[n].ms_per_1000 }))));
  let order = "context, question", i = 0;
  function demo() { const d = O[order].demo[i]; $("#qa-demo-i").textContent = `${i + 1} / ${O[order].demo.length}`; const p = d.pred.trim(), lc = d.context.toLowerCase(), at = p ? lc.indexOf(p.toLowerCase()) : -1;
    const ctx = at >= 0 ? esc(d.context.slice(0, at)) + `<mark class="pred">${esc(d.context.slice(at, at + p.length))}</mark>` + esc(d.context.slice(at + p.length)) : esc(d.context);
    $("#qa-demo").innerHTML = `<div class="ctx" style="font-size:15.5px;color:var(--ink-2)">${order === "context, question" ? ctx + ` <span class="q">${esc(d.question)}</span>` : `<span class="q">${esc(d.question)}</span> ` + ctx}</div><div class="order-row" style="margin-top:8px"><span class="k">written</span><span>${at >= 0 ? `<b>${esc(d.pred)}</b>` : `<b class="nosub">${esc(d.pred || "(nothing)")}</b> — not a substring`} <span class="small-note" style="display:inline">EM ${d.em} · F1 ${fmt(d.f1, 2)}</span></span></div><div class="order-row"><span class="k">gold</span><span>${esc([...new Set(d.gold)].join(" / "))}</span></div>`; }
  toggle("qa-order-tgl", m => { order = m; demo(); });
  $("#qa-demo-prev").addEventListener("click", () => { i = (i + O[order].demo.length - 1) % O[order].demo.length; demo(); }); $("#qa-demo-next").addEventListener("click", () => { i = (i + 1) % O[order].demo.length; demo(); });
  demo();
  reveal("btn-qa-reveal", ["qa-out"], "qa-note", [betEm, betOrd, betSub]);
  const win = cq.exact_match >= qc.exact_match ? cq : qc, lose = win === cq ? qc : cq;
  $("#qa-note").innerHTML = `Two pointers guarantee a quote and cost one pass: ${fmt(W4.exact_match, 1)} EM against ${fmt(best, 1)} for the better order, on the same ${num(A.n_train)} training questions. The generator costs a pass per answer token, and ${pct(win.not_substring, 0)} of its answers are not a substring — paraphrases, right in meaning, wrong for a system whose contract is <em>quote the document</em>. And the order matters — ${win === cq ? "in the <em>opposite</em> direction from what block 01 predicted. The paragraph read <em>without</em> the question wins" : "in the direction block 01 predicted"}, by ${(win.exact_match - lose.exact_match).toFixed(1)} EM points and ${(win.f1 - lose.f1).toFixed(1)} F1. One seed per order, so hold the size loosely; the sign is the finding. ${win === cq ? "What block 01 left out: what is read late is read with more context, and what is read late is also <em>next to the output</em>. Causal reading cuts both ways, and here the second edge is sharper." : ""} With an encoder that question does not exist — every token sees every other.`;
})();

/* ---- 06 the course table */
(function course() {
  const zsBest = Math.max(...Object.values(D.zeroShot.artifact.results).map(r => r.accuracy));
  const rows = [["1", "TF-IDF, n-grams", "none — counting", "the head (logreg)", "1", fmt(DATA.tfidf.accuracy, 2)], ["1", "word2vec / fastText", "skip-gram, CBOW", "the head, over averaged vectors", "1", "below TF-IDF"], ["2", "RNN language model", "next token", "the decoding rule", "T_out", "—"], ["2–3", "seq2seq LSTM ± attention", "conditional next token", "the pair (source, target)", "T_out", "—"], ["3", "transformer encoder–decoder", "conditional next token", "the pair", "T_out", "—"], ["4", "BERT encoder", "MLM (+ NSP)", "the head: shape, attachment, axis", "1", fmt(RES.find(r => /fine-tuned BERT/.test(r.model))["test acc"], 2) + " fine-tuned"], ["5", "GPT decoder", "next token", "the prefix", "candidates or T_out", fmt(zsBest, 2) + " zero-shot"]];
  $("#course").innerHTML = `<thead><tr><th>week</th><th>body</th><th>pretraining</th><th>where the task lives</th><th>passes / item</th><th>AG News</th></tr></thead><tbody>` + rows.map((r, i) => `<tr class="${i === rows.length - 1 ? "now" : ""}">${r.map(c => `<td>${esc(c)}</td>`).join("")}</tr>`).join("") + "</tbody>";
})();

redrawAll();
