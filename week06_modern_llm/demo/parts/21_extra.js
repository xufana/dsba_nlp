/* ====================================================== schematics and interactives */
performance.mark("extra:start");
const TEXT_W = (t, fs) => String(t).length * fs * 0.61 + 14;
function box(s, x, y, w, h, label, o) { o = o || {}; let fs = o.fs || 14;
  if (label != null && label !== "") { const need = TEXT_W(label, fs); if (need > w) { if (o.grow) { const cx = x + w / 2; w = need; x = cx - w / 2; } else fs = Math.max(8, fs * (w - 6) / (need - 8)); } }
  const r = el("rect", { x, y, width: w, height: h, rx: o.rx == null ? 6 : o.rx, fill: "none", stroke: o.stroke || css("--rule-strong"), "stroke-width": o.sw || 1.4, "stroke-dasharray": o.dash ? "5 4" : "none" }); r.style.fill = o.fill || "var(--panel-sunk)"; s.appendChild(r);
  if (label != null) { const t = el("text", { x: x + w / 2, y: y + h / 2 + fs * .36, "font-size": fs, "text-anchor": "middle", fill: o.color || css("--ink"), "font-weight": o.bold ? "600" : "400" }, label); s.appendChild(t); }
  r.box = { x, y, w, h }; return r; }
function txt(s, x, y, t, o) { o = o || {}; return s.appendChild(el("text", { x, y, "font-size": o.fs || 13.5, "text-anchor": o.anchor || "middle", fill: o.color || css("--ink-2"), "font-weight": o.bold ? "600" : "400", "font-style": o.italic ? "italic" : "normal", "font-family": o.mono ? "var(--mono)" : "inherit" }, t)); }
function arrow(s, x1, y1, x2, y2, o) { o = o || {}; const color = o.color || css("--ink-2"), id = "arr-" + String(color).replace(/[^a-z0-9]/gi, "");
  if (!s.querySelector("#" + id)) { let defs = s.querySelector("defs"); if (!defs) { defs = el("defs", {}); s.appendChild(defs); } const m = el("marker", { id, viewBox: "0 0 10 10", refX: 9, refY: 5, markerWidth: 6, markerHeight: 6, orient: "auto-start-reverse" }); m.appendChild(el("path", { d: "M 0 0 L 10 5 L 0 10 z", fill: color })); defs.appendChild(m); }
  s.appendChild(el("path", { d: o.d || `M ${x1} ${y1} L ${x2} ${y2}`, fill: "none", stroke: color, "stroke-width": o.sw || 1.6, "stroke-dasharray": o.dash ? "4 4" : "none", "marker-end": o.noHead ? "none" : `url(#${id})` })); }
const TINT = (v, pct) => `color-mix(in srgb, var(${v}) ${pct}%, var(--panel))`;
function states(btnsId, draw) {
  let mode = $(`#${btnsId} button.sel`).dataset.m; draw(mode); REDRAW.push(() => draw(mode));
  $(`#${btnsId}`).addEventListener("click", e => { const b = e.target.closest("button[data-m]"); if (!b) return; mode = b.dataset.m; $$(`#${btnsId} button`).forEach(x => x.classList.toggle("sel", x === b)); draw(mode); });
  return m => { mode = m; $$(`#${btnsId} button`).forEach(x => x.classList.toggle("sel", x.dataset.m === m)); draw(m); };
}
const slider = (id, fmt, on) => { const inp = $("#" + id), lab = $("#" + id + "-v"); const f = () => { if (lab) lab.textContent = fmt(+inp.value); on(+inp.value); }; inp.addEventListener("input", f); f(); return f; };
const CLSC = ["--cls-0", "--cls-1", "--cls-2", "--cls-3"];
const bar = (host, rows) => { host.innerHTML = rows.map(r => `<div class="pbar"><span class="lab" title="${esc(r.label)}">${esc(r.label)}</span><span class="bar"><i style="width:${(100 * r.p).toFixed(1)}%${r.color ? ";background:" + r.color : ""}"></i></span><span class="v">${r.text}</span></div>`).join(""); };
const okText = (ok, t) => `<b class="${ok ? "" : "no"}">${ok ? "✓" : "✗"}</b> ${t}`;
const near = (a, b, tol) => Math.abs(a - b) <= (tol || 1e-6) * Math.max(1, Math.abs(b));
const PRESENT_DEMO = D.data;

/* ====================================================== 00 pick three changes */
performance.mark("x:00 pick three changes");
const CHANGES = [
  ["depth instead of width", true, "12 × 768 → 30 × 576"], ["RMSNorm instead of LayerNorm", true, "2.1"], ["a gated feed-forward (SwiGLU)", true, "2.2"],
  ["rotary positions instead of a table", true, "2.3"], ["fewer K/V heads", true, "2.4"], ["no biases anywhere", true, "the passport"],
  ["a hundred times the tokens", true, "80 → 14 900 tokens / param"], ["filtered, curated text", true, "SmolLM2's own paper"],
  ["pre-norm", false, "GPT-2 already had it"], ["more attention heads", false, "12 → 9"], ["a bigger vocabulary", false, "50 257 → 49 152"],
  ["a wider feed-forward", false, "still 8d²"], ["post-norm, like BERT", false, "nobody went back"], ["sinusoidal positions", false, "that was 2017"]];
const PICKED = new Set();
(function pickThree() {
  const host = $("#changes-pick"); host.innerHTML = CHANGES.map((c, i) => `<button data-i="${i}">${esc(c[0])}</button>`).join("");
  host.addEventListener("click", e => { const b = e.target.closest("button[data-i]"); if (!b) return; const i = +b.dataset.i;
    if (PICKED.has(i)) PICKED.delete(i); else if (PICKED.size < 3) PICKED.add(i); $$("button", host).forEach(x => x.classList.toggle("pick", PICKED.has(+x.dataset.i)));
    $("#changes-count").textContent = PICKED.size ? `${PICKED.size} of 3 picked` : "pick three"; drawChangesOut(); });
  drawChangesOut();
})();
function drawChangesOut() {
  const made = CHANGES.filter(c => c[1]).length;
  $("#changes-out").innerHTML = PICKED.size ? `<div class="picklist">${[...PICKED].map(i => `<button class="${CHANGES[i][1] ? "yes" : "no"}">${esc(CHANGES[i][0])}<span class="why">${CHANGES[i][1] ? "made — " : "not made — "}${esc(CHANGES[i][2])}</span></button>`).join("")}</div>
      <div class="small-note">${[...PICKED].filter(i => CHANGES[i][1]).length} of your ${PICKED.size} are on SmolLM2's list of ${made}. The one that moved the bill furthest is not architectural: tokens per parameter.</div>`
    : `<div class="small-note">No picks in block 00 — the list is still there, scroll up.</div>`;
}

/* ====================================================== 01 the N–D plane */
performance.mark("x:01 the N–D plane");
const BILL_C = D.bill.cells;
const PLANE_MODELS = ["GPT-2 small (2019)", "GPT-3 (2020)", "Chinchilla (2022)", "Llama-3-8B (2024)", "SmolLM2-135M (2024)"];
const COLORS5 = ["--cls-3", "--cls-0", "--cls-2", "--cls-1", "--good"];
(function plane() {
  const host = $("#plane"), W = 760, H = 500, L = 70, R = 24, T = 20, B = 54;
  const lx0 = 7.5, lx1 = 12, ly0 = 9, ly1 = 13.5;
  const X = v => L + (v - lx0) / (lx1 - lx0) * (W - L - R), Y = v => H - B - (v - ly0) / (ly1 - ly0) * (H - T - B);
  const guesses = {}; let sel = 0, done = false;
  const mlist = $("#plane-models");
  const drawList = () => { mlist.innerHTML = PLANE_MODELS.map((m, i) => `<button data-i="${i}" class="${i === sel && !done ? "sel" : ""}"><span>${esc(m.replace(/ \(\d+\)/, ""))}</span><span class="st">${guesses[m] ? "placed" : ""}</span></button>`).join(""); };
  mlist.addEventListener("click", e => { const b = e.target.closest("button[data-i]"); if (!b || done) return; sel = +b.dataset.i; drawList(); });
  function draw() {
    host.innerHTML = ""; const s = svg(W, H); if (done) s.classList.add("done");
    for (let e = 8; e <= 12; e++) { s.appendChild(el("line", { x1: X(e), x2: X(e), y1: T, y2: H - B, stroke: css("--rule") })); txt(s, X(e), H - B + 20, `10^${e}`, { fs: 12.5, mono: 1 }); }
    for (let e = 9; e <= 13; e++) { s.appendChild(el("line", { x1: L, x2: W - R, y1: Y(e), y2: Y(e), stroke: css("--rule") })); txt(s, L - 8, Y(e) + 4, `10^${e}`, { fs: 12.5, anchor: "end", mono: 1 }); }
    for (let c = 19; c <= 25; c++) { // iso-compute: log D = c - log 6 - log N
      const p = []; for (let lx = lx0; lx <= lx1; lx += 0.05) { const ly = c - Math.log10(6) - lx; if (ly >= ly0 && ly <= ly1) p.push(`${X(lx).toFixed(1)},${Y(ly).toFixed(1)}`); }
      if (p.length > 1) { s.appendChild(el("polyline", { points: p.join(" "), fill: "none", stroke: css("--rule-strong"), "stroke-dasharray": "5 5" })); const [fx, fy] = p[0].split(","); txt(s, +fx + 6, +fy - 4, `C = 10^${c}`, { fs: 11, anchor: "start", mono: 1, color: css("--ink-3") }); }
    }
    s.appendChild(el("line", { x1: L, x2: W - R, y1: H - B, y2: H - B, stroke: css("--rule-strong") })); s.appendChild(el("line", { x1: L, x2: L, y1: T, y2: H - B, stroke: css("--rule-strong") }));
    txt(s, (L + W - R) / 2, H - 8, "N · parameters", { fs: 13 }); s.appendChild(el("text", { x: 16, y: (T + H - B) / 2, "font-size": 13, "text-anchor": "middle", fill: css("--ink-2"), transform: `rotate(-90 16 ${(T + H - B) / 2})` }, "D · training tokens"));
    PLANE_MODELS.forEach((m, i) => { const g = guesses[m], col = css(COLORS5[i]);
      if (g) { s.appendChild(el("circle", { cx: X(g[0]), cy: Y(g[1]), r: 7, fill: "none", stroke: col, "stroke-width": 2, "stroke-dasharray": done ? "3 3" : "none" })); if (!done) txt(s, X(g[0]) + 11, Y(g[1]) + 4, m.replace(/ \(\d+\)/, ""), { fs: 12, anchor: "start", color: col }); }
      if (done) { const tx = Math.log10(BILL_C[m].N), ty = Math.log10(BILL_C[m].D); const c = el("circle", { cx: X(tx), cy: Y(ty), r: 7, fill: col, stroke: css("--panel"), "stroke-width": 2 }); s.appendChild(c); tipOn(c, `<b>${esc(m)}</b><br>N = ${human(BILL_C[m].N)}, D = ${human(BILL_C[m].D)}<br>6ND = ${sci(BILL_C[m]["train FLOPs"])}`);
        const right = X(tx) > W - 220; txt(s, X(tx) + (right ? -11 : 11), Y(ty) + 4, `${m.replace(/ \(\d+\)/, "")} · ${BILL_C[m]["train FLOPs"].toExponential(2).replace("e+", "e")} FLOPs`, { fs: 12, anchor: right ? "end" : "start", color: col });
        if (g) s.appendChild(el("line", { x1: X(g[0]), y1: Y(g[1]), x2: X(tx), y2: Y(ty), stroke: col, "stroke-width": 1, "stroke-dasharray": "2 3" })); } });
    if (!done) s.addEventListener("click", e => { const r = s.getBoundingClientRect(), k = W / r.width, px = (e.clientX - r.left) * k, py = (e.clientY - r.top) * k; if (px < L || px > W - R || py < T || py > H - B) return;
      guesses[PLANE_MODELS[sel]] = [lx0 + (px - L) / (W - L - R) * (lx1 - lx0), ly0 + (H - B - py) / (H - T - B) * (ly1 - ly0)];
      const next = PLANE_MODELS.findIndex(m => !guesses[m]); if (next >= 0) sel = next; $("#plane-status").textContent = `${Object.keys(guesses).length} of 5 placed`; drawList(); draw(); });
    host.appendChild(s);
  }
  drawList(); draw(); REDRAW.push(draw);
  $("#btn-plane-reveal").addEventListener("click", e => { done = true; drawList(); draw(); e.target.disabled = true; e.target.textContent = "revealed";
    const err = PLANE_MODELS.filter(m => guesses[m]).map(m => Math.abs(guesses[m][0] - Math.log10(BILL_C[m].N)) + Math.abs(guesses[m][1] - Math.log10(BILL_C[m].D)));
    $("#plane-score").textContent = err.length ? `your guesses were off by ${(err.reduce((a, b) => a + b, 0) / err.length).toFixed(1)} orders of magnitude on average (N + D)` : "no bets placed";
    const rows = PLANE_MODELS.map(m => [m, BILL_C[m]["train FLOPs"]]).sort((a, b) => b[1] - a[1]);
    $("#plane-note").hidden = false; $("#plane-note").innerHTML = `<b>${esc(rows[0][0])}</b> cost the most — ${sci(rows[0][1])} FLOPs against GPT-3's ${sci(BILL_C["GPT-3 (2020)"]["train FLOPs"])}. A model that runs on a laptop took more compute to train than GPT-3; nobody would have paid that for an 8B model in 2020. SmolLM2-135M cost ${sci(BILL_C["SmolLM2-135M (2024)"]["train FLOPs"])} — ${Math.round(BILL_C["GPT-3 (2020)"]["train FLOPs"] / BILL_C["SmolLM2-135M (2024)"]["train FLOPs"])} times less than GPT-3 — while reading ${(BILL_C["SmolLM2-135M (2024)"].D / BILL_C["GPT-3 (2020)"].D).toFixed(1)} times more text. N and D are two separate dials: ${Math.round(BILL_C["GPT-3 (2020)"]["tokens / param"] * 10) / 10} tokens per parameter for GPT-3, ${Math.round(BILL_C["Chinchilla (2022)"]["tokens / param"])} for Chinchilla, ${num(Math.round(BILL_C["Llama-3-8B (2024)"]["tokens / param"]))} for Llama-3-8B, ${num(Math.round(BILL_C["SmolLM2-135M (2024)"]["tokens / param"]))} for SmolLM2. GPT-2's row is an estimate: OpenAI published WebText in gigabytes, not tokens.`;
    document.dispatchEvent(new CustomEvent("revealed", { detail: "btn-plane-reveal" })); });
})();
/* 6ND by hand */
(function ndCalc() {
  const A100 = 3.1e14, MFU = 0.4;
  const upd = () => { const N = Math.pow(10, +$("#ndc-n").value), Dn = Math.pow(10, +$("#ndc-d").value), C = 6 * N * Dn;
    $("#ndc-n-v").textContent = human(N); $("#ndc-d-v").textContent = human(Dn);
    $("#ndc-out").innerHTML = stat(sci(C), "6ND, FLOPs") + stat(`${(Dn / N).toPrecision(3)}`, "tokens / param") + stat(`${(C / (A100 * MFU) / 3.156e7).toFixed(1)}`, "A100-years at 40%") + stat(`${(C / (A100 * MFU) / 86400 / 1000).toFixed(1)} days`, "on a thousand A100s"); };
  $("#ndc-n").addEventListener("input", upd); $("#ndc-d").addEventListener("input", upd); upd();
  const gpt3 = 6 * 175e9 * 300e9; $("#ndc-check").innerHTML = okText(near(gpt3, BILL_C["GPT-3 (2020)"]["train FLOPs"], 1e-9), `GPT-3: ${sci(gpt3)} in the browser, ${sci(BILL_C["GPT-3 (2020)"]["train FLOPs"])} in the notebook`);
})();
/* the law */
(function scaling() {
  const S = D.scaling, bs = S.by_size, st = S.by_step;
  $("#scaling-meta").textContent = `${num(S.n_texts)} test texts · ${S.device}`;
  const fitBet = makeBet("#bet-scaling", ["straight line", "bends down — bigger helps more and more", "bends up — flattens, bigger helps less"], 0);
  let k = 6;
  function draw() {
    const key = "params_non_embedding", fit = S.fits[`${key}:${k}`];
    const slope = -fit.slope, inter = fit.intercept; const xs = bs.map(r => r[key]);
    const line = { x: [xs[0] * 0.8, xs[xs.length - 1] * 1.3], y: [Math.exp(inter) * Math.pow(xs[0] * 0.8, slope), Math.exp(inter) * Math.pow(xs[xs.length - 1] * 1.3, slope)], color: css("--ink-3"), dash: 1, nodots: 1, sw: 1.5, label: `fit on ${k === 6 ? "all" : "the first " + k} · slope −${fit.slope.toFixed(3)}` };
    const chart = lineChart($("#scaling-chart"), { W: 640, H: 360, xlog: 1, ylog: 1, ymin: 0.9, ymax: 1.7, xmin: 1.2e7, xmax: 4e9, legendX: 330, xlabel: "N · parameters, embeddings not counted", ylabel: "bits per byte", fs: 13,
      yticks: [0.9, 1.0, 1.2, 1.4, 1.6], yfmt: v => v.toFixed(1), xticks: [1e7, 1e8, 1e9], xfmt: v => human(v),
      series: [{ x: xs.slice(0, k), y: bs.slice(0, k).map(r => r.bits_per_byte), color: css("--cls-0"), label: "measured", tip: (x, y) => `${esc(bs.find(r => r[key] === x).name)}<br>${y.toFixed(4)} bits/byte`, labels: bs.slice(0, k).map(r => r.name.split("-")[1]) },
        { x: xs.slice(k), y: bs.slice(k).map(r => r.bits_per_byte), color: css("--cls-1"), label: k < 6 ? "measured, not in the fit" : undefined, labels: bs.slice(k).map(r => r.name.split("-")[1]), tip: (x, y) => `${esc(bs.find(r => r[key] === x).name)}<br>${y.toFixed(4)} bits/byte` },
        line] });
    if (k < 6) { const r = bs[bs.length - 1], pred = fit.predicted[bs.length - 1]; chart.s.appendChild(el("circle", { cx: chart.X(r[key]), cy: chart.Y(pred), r: 6, fill: "none", stroke: css("--cls-1"), "stroke-width": 2, "stroke-dasharray": "3 2" }));
      $("#fit-note").textContent = `read off the line for pythia-2.8b: ${pred.toFixed(3)} bits/byte; measured ${r.bits_per_byte.toFixed(4)} — the small sizes make the line ${pred < r.bits_per_byte ? "too optimistic" : "too pessimistic"} by ${(100 * Math.abs(pred - r.bits_per_byte) / r.bits_per_byte).toFixed(1)}%.`; }
    else $("#fit-note").textContent = `all six sizes: slope −${fit.slope.toFixed(3)} on log-log paper, Kaplan's −0.076 on theirs. Every ×10 in N takes ${(100 * (1 - Math.pow(10, -fit.slope))).toFixed(0)}% off the loss here.`;
    $("#fit-line").textContent = `L ≈ ${Math.exp(inter).toFixed(1)} · N^−${fit.slope.toFixed(3)}`;
    lineChart($("#steps-chart"), { W: 640, H: 360, xlog: 1, ylog: 1, ymin: 1.2, ymax: 2.0, xmin: 1e9, xmax: 5e11, xlabel: "tokens seen so far · pythia-160m", ylabel: "bits per byte", fs: 13, yticks: [1.2, 1.4, 1.6, 1.8, 2.0], yfmt: v => v.toFixed(1), xticks: [1e9, 1e10, 1e11], xfmt: v => human(v),
      series: [{ x: st.map(r => r.tokens_seen), y: st.map(r => r.bits_per_byte), color: css("--cls-1"), label: "one model along its training run", tip: (x, y) => `step ${num(st.find(r => r.tokens_seen === x).step)}<br>${human(x)} tokens · ${y.toFixed(4)} bits/byte` }] });
  }
  states("fit-k", m => { k = +m; draw(); });
  reveal("btn-scaling-reveal", ["scaling-out"], "scaling-note", [fitBet], () => { draw(); const f6 = S.fits["params_non_embedding:6"], f3 = S.fits["params_non_embedding:3"];
    $("#scaling-note").innerHTML = `Close to a line, bending slightly <b>up</b> — the two largest sizes sit above the line through the small ones. Fit on the first three sizes and the line predicts ${f3.predicted[5].toFixed(3)} for 2.8B; measured ${bs[5].bits_per_byte.toFixed(3)}. Slope on all six: −${f6.slope.toFixed(3)}; Kaplan's −0.076 was measured on the training distribution with the irreducible loss left in, ours is on news nobody trained on. The right panel: ${st[0].bits_per_byte.toFixed(2)} → ${st[6].bits_per_byte.toFixed(2)} bits/byte over the first ${human(st[6].tokens_seen)} tokens, then flat — the last two checkpoints are ${st[7].bits_per_byte.toFixed(3)} and ${st[8].bits_per_byte.toFixed(3)} on ${num(S.n_texts)} texts; do not read the difference.`; });
})();
/* how to split the money */
(function split() {
  const C = BILL_C["GPT-3 (2020)"]["train FLOPs"];
  const upd = () => { const N = Math.pow(10, +$("#split-n").value), Dn = C / (6 * N), tpp = Dn / N; $("#split-n-v").textContent = human(N);
    $("#split-out").innerHTML = stat(human(Dn), "D = C / 6N, tokens") + stat(num(Math.round(tpp * 10) / 10), "tokens / param") + stat(Math.abs(tpp - 20) < 2 ? "Chinchilla" : tpp < 20 ? "undertrained" : "overtrained", "by the 20 rule"); };
  $("#split-n").addEventListener("input", upd); upd();
  const rows = D.bill.rows.filter(r => BILL_C[r].D).map(r => ({ r, year: +r.match(/\((\d+)\)/)[1], tpp: BILL_C[r]["tokens / param"] }));
  const draw = () => lineChart($("#tpp-chart"), { W: 640, H: 300, ylog: 1, ymin: 1, ymax: 3e4, xmin: 2018.5, xmax: 2024.5, xlabel: "year", ylabel: "tokens per parameter", fs: 13, yticks: [1, 10, 100, 1000, 10000], yfmt: v => num(v), xticks: [2019, 2020, 2021, 2022, 2023, 2024], xfmt: v => String(v),
    hlines: [{ y: 20, label: "Chinchilla · 20", color: css("--cls-2") }], series: [{ x: rows.map(r => r.year), y: rows.map(r => r.tpp), color: css("--cls-1"), nodots: 0, sw: 0, labels: rows.map(r => r.r.replace(/ \(\d+\)/, "")), tip: (x, y) => `${num(Math.round(y))} tokens / param` }] });
  draw(); REDRAW.push(draw);
})();

/* ====================================================== 02 passports */
performance.mark("x:02 passports");
(function passports() {
  const P = D.passports, sec = { "layers": "depth for width", "d_model": "depth for width", "key/value heads": "attention", "FFN hidden": "feed-forward", "FFN": "feed-forward", "norm": "the norm", "positions": "positions", "context": "positions · block 03", "biases": "the passport", "vocabulary": "", "query heads": "attention", "parameters": "" };
  const [a, b] = P.cols;
  $("#passports").innerHTML = `<div class="pp-row head"><span></span><span>${esc(a)}</span><span>${esc(b)}</span></div>` + P.rows.map(r => { const va = P.cells[a][r], vb = P.cells[b][r], diff = String(va) !== String(vb);
    const f = v => typeof v === "number" ? num(v) : esc(v); return `<div class="pp-row ${diff ? "diff" : ""}" title="${diff ? esc(sec[r] || "") : "the same in both"}"><span class="k">${esc(r)}${diff && sec[r] ? `<span class="sec">→ ${esc(sec[r])}</span>` : ""}</span><span>${f(va)}</span><span>${f(vb)}</span></div>`; }).join("");
})();
/* decoder_params in the browser */
function decoderParams(vocab, d, layers, heads, kv, hidden, headDim, tied) { const hd = headDim || d / heads; const attention = 2 * d * heads * hd + 2 * d * kv * hd; const block = attention + 3 * d * hidden + 2 * d; return layers * block + vocab * d * (tied === false ? 2 : 1) + d; }
(function params() {
  const P = D.params, cfg = P.smollm2.config;
  code("#code-dp", `def decoder_params(vocab, d, layers, heads, kv_heads, hidden, head_dim=None, tied=True):
    """Parameters of a Llama-style decoder, from six numbers of its config.json."""
    hd = head_dim or d // heads
    attention = 2 * d * heads * hd + 2 * d * kv_heads * hd       # q, o full size; k, v are kv_heads wide
    block = attention + 3 * d * hidden + 2 * d                   # + three SwiGLU matrices + two RMSNorm gains
    return layers * block + vocab * d * (1 if tied else 2) + d   # + embedding (+ head if untied) + final norm`);
  const checks = P.decoderParamsChecks.map(c => decoderParams(...c.args) === c.value); $("#dp-check").innerHTML = okText(checks.every(Boolean), `${checks.filter(Boolean).length} of ${checks.length} counts match Python · ${num(P.smollm2.byHand)} by hand, ${num(P.smollm2.total)} in the checkpoint`);
  const presets = { smol: { d: 576, L: 30, kv: 3, h: 1536, heads: 9, vocab: 49152, tied: true, hd: 64 }, mistral: { d: 4096, L: 32, kv: 8, h: 14336, heads: 32, vocab: 32000, tied: false, hd: 128 }, llama3: { d: 4096, L: 32, kv: 8, h: 14336, heads: 32, vocab: 128256, tied: false, hd: 128 } };
  let cur = Object.assign({}, presets.smol);
  const upd = () => { const d = +$("#dp-d").value, L = +$("#dp-L").value, kv = +$("#dp-kv").value, h = +$("#dp-h").value; $("#dp-d-v").textContent = d; $("#dp-L-v").textContent = L; $("#dp-kv-v").textContent = kv; $("#dp-h-v").textContent = num(h);
    const heads = cur.heads, hd = cur.hd; const n = decoderParams(cur.vocab, d, L, heads, kv, h, hd, cur.tied); const att = L * (2 * d * heads * hd + 2 * d * kv * hd), ffn = L * 3 * d * h, emb = cur.vocab * d * (cur.tied ? 1 : 2);
    $("#dp-out").innerHTML = stat(human(n), "parameters") + stat(`${(100 * ffn / n).toFixed(0)}%`, "in the feed-forwards") + stat(`${(100 * att / n).toFixed(0)}%`, "in the attention") + stat(`${(100 * emb / n).toFixed(0)}%`, cur.tied ? "in the embedding (tied head)" : "in the two tables"); };
  ["dp-d", "dp-L", "dp-kv", "dp-h"].forEach(id => $("#" + id).addEventListener("input", upd));
  states("dp-presets", m => { cur = Object.assign({}, presets[m]); $("#dp-d").value = cur.d; $("#dp-L").value = cur.L; $("#dp-kv").value = cur.kv; $("#dp-kv").max = cur.heads; $("#dp-h").value = cur.h; upd(); });
  // where the parameters live, two models
  const parts = ["embedding", "positions", "attention", "feed-forward", "norms"], cols = ["--cls-0", "--cls-3", "--cls-1", "--cls-2", "--ink-3"];
  const draw = () => { const host = $("#params-bars"); host.innerHTML = ""; const W = 920, H = 150, s = svg(W, H), L = 130, R = 20;
    [["GPT-2 small", P.gpt2], ["SmolLM2-135M", P.smollm2]].forEach(([name, m], i) => { const y = 24 + i * 56, tot = m.total; let x = L; txt(s, L - 10, y + 17, name, { anchor: "end", fs: 13.5, bold: 1, color: css("--ink") });
      parts.forEach((p, j) => { const w = (W - L - R) * m.parts[p] / tot; if (w <= 0) return; const r = el("rect", { x, y, width: Math.max(w, 1), height: 26, fill: css(cols[j]), stroke: css("--panel"), "stroke-width": 1 }); s.appendChild(r); tipOn(r, `<b>${p}</b><br>${num(m.parts[p])} parameters · ${(100 * m.parts[p] / tot).toFixed(1)}%`); if (w > 70) txt(s, x + w / 2, y + 17, `${p} ${(100 * m.parts[p] / tot).toFixed(0)}%`, { fs: 11.5, color: css("--ground") }); x += w; }); });
    txt(s, L, 140, "where the parameters live · bar length = share of the model", { anchor: "start", fs: 12, color: css("--ink-3") }); host.appendChild(s); };
  draw(); REDRAW.push(draw);
})();

/* ====================================================== 02 the norm */
performance.mark("x:02 the norm");
const parseVec = s => s.split(/[,\s]+/).map(Number).filter(v => !isNaN(v));
const layerNorm = x => { const d = x.length, mu = x.reduce((a, b) => a + b, 0) / d, sd = Math.sqrt(x.reduce((a, b) => a + (b - mu) ** 2, 0) / d); return x.map(v => (v - mu) / (sd || 1)); };
const rmsNorm = x => { const rms = Math.sqrt(x.reduce((a, b) => a + b * b, 0) / x.length); return x.map(v => v / (rms || 1)); };
(function norm() {
  const N = D.norm; const okLN = N.layernorm.every((v, i) => near(v, layerNorm(N.x)[i], 1e-3)), okRMS = N.rmsnorm.every((v, i) => near(v, rmsNorm(N.x)[i], 1e-3));
  $("#norm-check").innerHTML = okText(okLN && okRMS, `both norms in the browser match torch on [${N.x.join(", ")}]`);
  $("#norm-counts").textContent = `${num(N.counts.gpt2.params)} parameters in GPT-2's ${N.counts.gpt2.n} LayerNorms against ${num(N.counts.smollm2.params)} in SmolLM2's ${N.counts.smollm2.n} RMSNorms`;
  const bet = makeBet("#bet-norm", ["the 0 stays 0 in both", "0 stays 0 after RMSNorm only", "0 stays 0 after LayerNorm only", "neither"], 1);
  let mode = "x";
  function draw() {
    const x = parseVec($("#norm-x").value); if (x.length < 2) return; const host = $("#fig-norm"); host.innerHTML = ""; const W = 620, H = 300, s = svg(W, H);
    const mu = x.reduce((a, b) => a + b, 0) / x.length, sd = Math.sqrt(x.reduce((a, b) => a + (b - mu) ** 2, 0) / x.length), rms = Math.sqrt(x.reduce((a, b) => a + b * b, 0) / x.length);
    const gamma = 1.5, beta = 0.2;
    const seq = { x: [x, x], centre: [x.map(v => v - mu), x], scale: [x.map(v => (v - mu) / sd), x.map(v => v / rms)], gain: [x.map(v => (v - mu) / sd * gamma + beta), x.map(v => v / rms * gamma)] }[mode];
    const titles = { x: ["x", "x"], centre: ["x − μ", "x (no centring)"], scale: ["(x − μ) / σ", "x / RMS(x)"], gain: ["(x − μ) / σ · γ + β", "x / RMS(x) · γ"] }[mode];
    const all = seq.flat().concat([0]); const lo = Math.min(...all) - 0.5, hi = Math.max(...all) + 0.5;
    [["LayerNorm", seq[0], "--cls-0"], ["RMSNorm", seq[1], "--cls-1"]].forEach(([name, v, col], k) => { const x0 = 40 + k * 300, w = 260, bw = w / v.length; const Y = val => 40 + (hi - val) / (hi - lo) * 210;
      txt(s, x0 + w / 2, 22, `${name} · ${titles[k]}`, { fs: 13.5, bold: 1, color: css(col) }); s.appendChild(el("line", { x1: x0, x2: x0 + w, y1: Y(0), y2: Y(0), stroke: css("--rule-strong") }));
      v.forEach((val, i) => { const r = el("rect", { x: x0 + i * bw + 6, y: Math.min(Y(val), Y(0)), width: bw - 12, height: Math.abs(Y(val) - Y(0)) || 1, fill: TINT(col, val === 0 ? 0 : 60), stroke: css(col), "stroke-width": val === 0 ? 2 : 1 }); s.appendChild(r);
        txt(s, x0 + i * bw + bw / 2, Y(val) + (val >= 0 ? -6 : 14), (+val.toFixed(2)).toString(), { fs: 12, mono: 1, color: css("--ink") }); txt(s, x0 + i * bw + bw / 2, 272, `x${i}`, { fs: 11.5, mono: 1 }); });
      if (mode === "centre" && k === 0) txt(s, x0 + w / 2, 290, `μ = ${mu.toFixed(2)}`, { fs: 12, mono: 1 }); if (mode === "scale") txt(s, x0 + w / 2, 290, k === 0 ? `σ = ${sd.toFixed(2)}` : `RMS = ${rms.toFixed(2)}`, { fs: 12, mono: 1 }); if (mode === "gain") txt(s, x0 + w / 2, 290, k === 0 ? `γ = ${gamma}, β = ${beta} · illustrative` : `γ = ${gamma} · illustrative`, { fs: 11.5, mono: 1 }); });
    host.appendChild(s);
  }
  const set = states("norm-states", m => { mode = m; draw(); });
  $("#norm-x").addEventListener("input", draw);
  $("#norm-states").addEventListener("click", () => { if (mode === "scale" || mode === "gain") bet.reveal(); });
  code("#code-rms", `class RMSNorm(nn.Module):
    """Divide by the root mean square, multiply by a learned gain. No mean subtracted, no bias added."""
    def __init__(self, d, eps=1e-5):
        super().__init__()
        self.weight, self.eps = nn.Parameter(torch.ones(d)), eps

    def forward(self, x):
        return x * torch.rsqrt(x.pow(2).mean(-1, keepdim=True) + self.eps) * self.weight`, { "rsqrt": "rms", "self.weight, self.eps": "gain" });
})();
/* where the norm stands */
states("prenorm-btns", mode => {
  const host = $("#fig-prenorm"); host.innerHTML = ""; const W = 920, H = 250, s = svg(W, H); const pre = mode === "pre";
  [0, 1].forEach(k => { const x0 = 60 + k * 440; const col = k ? "--cls-2" : "--cls-0"; const name = k ? "feed-forward" : "attention";
    // residual stream: a thick horizontal line
    s.appendChild(el("line", { x1: x0 - 40, x2: x0 + 400, y1: 60, y2: 60, stroke: css("--ink-3"), "stroke-width": 5, "stroke-linecap": "round" })); txt(s, x0 - 40, 44, k ? "" : "the residual stream x", { anchor: "start", fs: 12.5 });
    if (pre) { arrow(s, x0 + 40, 60, x0 + 40, 110, { color: css("--ink-2") }); box(s, x0 + 5, 110, 70, 30, "norm", { fill: TINT("--cls-3", 18), stroke: css("--cls-3") }); arrow(s, x0 + 75, 125, x0 + 110, 125, { color: css("--ink-2") });
      box(s, x0 + 110, 100, 160, 50, name, { fill: TINT(col, 14), stroke: css(col), bold: 1 }); arrow(s, x0 + 270, 125, x0 + 330, 125, { color: css("--ink-2") }); s.appendChild(el("circle", { cx: x0 + 330, cy: 60, r: 12, fill: css("--panel"), stroke: css("--ink"), "stroke-width": 1.5 })); txt(s, x0 + 330, 65, "+", { fs: 16, color: css("--ink"), bold: 1 }); arrow(s, x0 + 330, 125, x0 + 330, 73, { color: css("--ink-2") });
      txt(s, x0 + 180, 185, `x + ${name}(norm(x))`, { fs: 13, mono: 1, color: css("--ink") }); txt(s, x0 + 180, 208, "the stream is read through a norm, never normalised", { fs: 12 }); }
    else { arrow(s, x0 + 40, 60, x0 + 40, 110, { color: css("--ink-2") }); box(s, x0 + 5, 100, 160, 50, name, { fill: TINT(col, 14), stroke: css(col), bold: 1 }); arrow(s, x0 + 165, 125, x0 + 220, 125, { color: css("--ink-2") });
      s.appendChild(el("circle", { cx: x0 + 220, cy: 60, r: 12, fill: css("--panel"), stroke: css("--ink"), "stroke-width": 1.5 })); txt(s, x0 + 220, 65, "+", { fs: 16, color: css("--ink"), bold: 1 }); arrow(s, x0 + 220, 125, x0 + 220, 73, { color: css("--ink-2") });
      box(s, x0 + 255, 45, 70, 30, "norm", { fill: TINT("--cls-3", 18), stroke: css("--cls-3") }); s.appendChild(el("rect", { x: x0 + 232, y: 52, width: 23, height: 16, fill: css("--ground") }));
      txt(s, x0 + 180, 185, `norm(x + ${name}(x))`, { fs: 13, mono: 1, color: css("--ink") }); txt(s, x0 + 180, 208, "every layer normalises the stream itself", { fs: 12 }); } });
  txt(s, W / 2, 240, pre ? "pre-norm: gradients reach layer 1 of 30 through plain additions · GPT-2, Llama, SmolLM2" : "post-norm: the norm sits on the gradient's path at every layer · 2017, BERT — needs the warm-up (Xiong et al. 2020)", { fs: 12.5 });
  host.appendChild(s);
});

/* ====================================================== 02 the feed-forward */
performance.mark("x:02 the feed-forward");
const silu = x => x / (1 + Math.exp(-x)), gelu = x => 0.5 * x * (1 + erf(x / Math.SQRT2));
function erf(x) { const t = 1 / (1 + 0.3275911 * Math.abs(x)); const y = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x); return x >= 0 ? y : -y; }
(function ffn() {
  const F = D.ffn, d = F.d;
  const okS = F.silu.every((v, i) => near(v, silu(F.x[i]), 2e-3)), okG = F.gelu.every((v, i) => near(v, gelu(F.x[i]), 2e-3));
  function drawFig() { const host = $("#fig-ffn"); host.innerHTML = ""; const W = 920, H = 290, s = svg(W, H); const k = 36 / 576;
    // 2017: two matrices d×4d and 4d×d, drawn as rectangles whose area is their parameter count
    const x0 = 40; txt(s, x0, 24, "2017 · up, GELU, down: 2 · (d × 4d) = 8d²", { anchor: "start", fs: 13.5, bold: 1, color: css("--ink") });
    const dw = d * k, hw = 4 * d * k; let r = box(s, x0, 50, dw, hw, "", { fill: TINT("--cls-0", 18), stroke: css("--cls-0"), rx: 2 }); tipOn(r, `W_up · ${d} × ${4 * d} = ${num(4 * d * d)}`); txt(s, x0 + dw / 2, 50 + hw + 16, "W_up", { fs: 12, mono: 1 });
    box(s, x0 + dw + 14, 50 + hw / 2 - 15, 56, 30, "GELU", { fill: css("--panel"), fs: 12 }); r = box(s, x0 + dw + 84, 50, dw, hw, "", { fill: TINT("--cls-0", 18), stroke: css("--cls-0"), rx: 2 }); tipOn(r, `W_down · ${4 * d} × ${d} = ${num(4 * d * d)}`); txt(s, x0 + dw + 84 + dw / 2, 50 + hw + 16, "W_down", { fs: 12, mono: 1 });
    txt(s, x0, 50 + hw + 40, `${num(F.gpt2_ffn_params)} parameters (with biases)`, { anchor: "start", fs: 12, mono: 1 });
    // 2024: three matrices d×h
    const x1 = 430, h = F.hidden, hh = h * k; txt(s, x1, 24, `2024 · SiLU(gate) ⊙ up, down: 3 · (d × h), h = ${num(h)}`, { anchor: "start", fs: 13.5, bold: 1, color: css("--ink") });
    [["W_gate", "--cls-1"], ["W_up", "--cls-1"], ["W_down", "--cls-1"]].forEach(([n, c], i) => { const rr = box(s, x1 + i * (dw + 34), 50 + (hw - hh) / 2, dw, hh, "", { fill: TINT(c, 18), stroke: css(c), rx: 2 }); tipOn(rr, `${n} · ${d} × ${num(h)} = ${num(d * h)}`); txt(s, x1 + i * (dw + 34) + dw / 2, 50 + hw + 16, n, { fs: 11, mono: 1 }); });
    txt(s, x1 + 3 * (dw + 34) + 10, 50 + hw / 2 - 22, "SiLU(W_gate x) ⊙ W_up x", { anchor: "start", fs: 12, mono: 1 }); txt(s, x1 + 3 * (dw + 34) + 10, 50 + hw / 2 - 2, "the gate switches the value off,", { anchor: "start", fs: 11.5 }); txt(s, x1 + 3 * (dw + 34) + 10, 50 + hw / 2 + 14, "passes it, or flips its sign", { anchor: "start", fs: 11.5 });
    txt(s, x1, 50 + hw + 40, `${num(F.swiglu_params)} parameters: the same 8d², h = 8d/3`, { anchor: "start", fs: 12, mono: 1 });
    host.appendChild(s); }
  drawFig(); REDRAW.push(drawFig);
  const xs = []; for (let v = -4; v <= 4.001; v += 0.1) xs.push(+v.toFixed(2));
  const drawCurves = () => lineChart($("#ffn-curves"), { W: 640, H: 300, xlabel: "x", ylabel: "activation", fs: 13, ymin: -1, ymax: 4, series: [{ x: xs, y: xs.map(v => Math.max(0, v)), color: css("--ink-3"), nodots: 1, dash: 1, label: "ReLU · 2017" }, { x: xs, y: xs.map(gelu), color: css("--cls-0"), nodots: 1, label: "GELU · GPT-2, BERT" }, { x: xs, y: xs.map(silu), color: css("--cls-1"), nodots: 1, label: "SiLU · the gate" }] });
  drawCurves(); REDRAW.push(drawCurves);
  const drawGate = () => { const host = $("#ffn-gate"); host.innerHTML = ""; const W = 640, H = 300, s = svg(W, H), L = 60, T = 30, n = 33, cw = (W - L - 30) / n, ch = (H - T - 50) / n;
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) { const a = -4 + 8 * i / (n - 1), b = 4 - 8 * j / (n - 1), v = silu(a) * b; const m = Math.min(1, Math.abs(v) / 12); const r = el("rect", { x: L + i * cw, y: T + j * ch, width: cw + 0.5, height: ch + 0.5, fill: `color-mix(in srgb, var(${v >= 0 ? "--cls-1" : "--cls-0"}) ${Math.round(100 * m)}%, var(--panel))` }); s.appendChild(r); }
    txt(s, L + (W - L - 30) / 2, H - 8, "a = W_gate x  (the gate's input)", { fs: 12.5 }); s.appendChild(el("text", { x: 18, y: T + (H - T - 50) / 2, "font-size": 12.5, "text-anchor": "middle", fill: css("--ink-2"), transform: `rotate(-90 18 ${T + (H - T - 50) / 2})` }, "b = W_up x  (the value)"));
    txt(s, L + (W - L - 30) / 2, 18, "one hidden unit: SiLU(a) · b — orange positive, blue negative, white zero", { fs: 12.5 }); [-4, 0, 4].forEach(v => { txt(s, L + (v + 4) / 8 * (W - L - 30), H - 26, String(v), { fs: 11.5, mono: 1 }); txt(s, L - 8, T + (4 - v) / 8 * (H - T - 50) + 4, String(v), { fs: 11.5, mono: 1, anchor: "end" }); });
    host.appendChild(s); };
  drawGate(); REDRAW.push(drawGate);
  $("#btn-ffn-reveal").addEventListener("click", e => { const g = parseFloat($("#ffn-guess").value); e.target.disabled = true; e.target.textContent = "revealed";
    $("#ffn-note").hidden = false; $("#ffn-note").innerHTML = `${isNaN(g) ? "No guess typed." : g === F.hidden ? "<b>Right:</b>" : `You said ${num(g)}.`} 3 · d · h = 8d² gives h = 8d/3, and 576 · 8/3 = <b>1 536</b> exactly. The "8/3" you meet in every Llama-style config is not a discovery about language; it is bookkeeping, so that a paper can say <em>same parameters, lower loss</em>. Llama-3-8B uses 14 336 / 4 096 = 3.5 — the convention is a budget, not a law. ${okText(okS && okG, "SiLU and GELU drawn in the browser match torch at 17 points.")}`; });
})();

/* ====================================================== 02 positions */
performance.mark("x:02 positions");
const RP = D.rope, HD = RP.head_dim, THETA = RP.theta;
const omega = i => Math.pow(THETA, -2 * i / HD);
function ropeVec(x, p) { const out = new Array(HD); const half = HD / 2; for (let i = 0; i < half; i++) { const a = p * omega(i), c = Math.cos(a), s = Math.sin(a); out[i] = x[i] * c - x[i + half] * s; out[i + half] = x[i + half] * c + x[i] * s; } return out; }
(function ropeMatrix() {
  // JS port check: unit vectors rotated at positions, against torch
  const U = RP.unitCheck; let ok = true; U.which.forEach(([j, p], r) => { const e = new Array(HD).fill(0); e[j] = 1; const v = ropeVec(e, p); U.rows[r].forEach((t, i) => { if (!near(v[i], t, 1e-4)) ok = false; }); });
  $("#rope-check").innerHTML = okText(ok, `the rotation in the browser matches the notebook's rope() on ${U.which.length} unit vectors`);
  $("#rope-slowest").textContent = num(Math.round(2 * Math.PI / omega(31)));
  let p = 1, sel = 0;
  function draw() { const host = $("#fig-rope-matrix"); host.innerHTML = ""; const W = 560, H = 585, s = svg(W, H), L = 40, T = 40, cw = (W - L - 10) / HD; const cellInfo = [];
    s.appendChild(el("rect", { x: L, y: T, width: HD * cw, height: HD * cw, fill: css("--panel-sunk") }));          // every zero cell at once
    const half = HD / 2;
    for (let i = 0; i < half; i++) for (const [r, c, kind, v] of [[i, i, "cos", Math.cos(p * omega(i))], [i, i + half, "−sin", -Math.sin(p * omega(i))], [i + half, i, "sin", Math.sin(p * omega(i))], [i + half, i + half, "cos", Math.cos(p * omega(i))]]) {
      const m = Math.abs(v); const fill = `color-mix(in srgb, var(${v >= 0 ? "--cls-1" : "--cls-0"}) ${Math.round(100 * Math.max(0.08, m))}%, var(--panel))`;
      const rc = el("rect", { x: L + c * cw, y: T + r * cw, width: cw + 0.4, height: cw + 0.4, fill, stroke: i === sel ? css("--ink") : "none", "stroke-width": 1.2 }); s.appendChild(rc);
      rc.dataset.k = cellInfo.length; cellInfo.push(`cell (${r}, ${c}) · pair ${i}<br><b>${kind}(p · ω<sub>${i}</sub>)</b> = ${kind}(${p} · ${omega(i).toExponential(2)}) = <b>${v.toFixed(4)}</b>`); }
    s.addEventListener("pointermove", e => { const k = e.target.dataset && e.target.dataset.k; if (k == null) { TIP.style.opacity = "0"; return; } TIP.innerHTML = cellInfo[+k]; TIP.style.opacity = "1"; moveTip(e); }); s.addEventListener("pointerleave", () => { TIP.style.opacity = "0"; });
    txt(s, L + HD * cw / 2, 20, `R_p at p = ${p} · 32 blocks of 2 × 2 on (i, i + 32), zero elsewhere`, { fs: 12 }); [0, 16, 32, 48, 63].forEach(k => { txt(s, L + k * cw + cw / 2, T + HD * cw + 16, String(k), { fs: 11, mono: 1 }); txt(s, L - 6, T + k * cw + cw / 2 + 4, String(k), { fs: 11, mono: 1, anchor: "end" }); });
    host.appendChild(s);
    const i = sel, a = p * omega(i); $("#rope-cell").innerHTML = `pair <b>${i}</b> = coordinates (${i}, ${i + 32}) · ω<sub>${i}</sub> = θ<sup>−${2 * i}/64</sup> = ${omega(i).toExponential(3)} · angle p·ω = ${a.toFixed(4)} rad = ${(a * 180 / Math.PI).toFixed(2)}°<br>cells: cos = ${Math.cos(a).toFixed(4)}, sin = ${Math.sin(a).toFixed(4)} · one full turn every ${num(Math.round(2 * Math.PI / omega(i)))} positions`; }
  slider("rope-p", v => String(v), v => { p = v; draw(); }); slider("rope-i", v => String(v), v => { sel = v; draw(); }); REDRAW.push(draw);
  code("#code-rope", `def rope(x, theta, first=0):
    """Rotate [B, heads, T, head_dim] by position, positions first, first + 1, …
    Hugging Face's pairing: coordinate j turns with coordinate j + head_dim / 2 (week 5 §1.4 paired 2i with 2i + 1)."""
    T, hd = x.shape[-2:]
    angle = torch.arange(first, first + T, device=x.device)[:, None] * theta ** (-torch.arange(0, hd, 2, device=x.device) / hd)
    cos, sin = angle.cos().repeat(1, 2), angle.sin().repeat(1, 2)                  # [T, head_dim]
    x1, x2 = x.chunk(2, dim=-1)
    return x * cos + torch.cat([-x2, x1], -1) * sin`, { "angle = torch.arange": "angle", "cos, sin = angle": "cos sin", "x1, x2 = x.chunk": "pair", "return x * cos": "cos sin pair" });
})();
(function ropeCoords() {
  const R = RP.real, toks = R.tokens; let t = Math.min(3, toks.length - 1);
  $("#rope-real-meta").textContent = R.note;
  const row = $("#rope-toks"); row.innerHTML = toks.map((tk, i) => `<span class="tok ${i === t ? "on" : ""}" data-i="${i}">${esc(tk.replace(/^Ġ/, "␣"))}</span>`).join(""); row.addEventListener("click", e => { const n = e.target.closest(".tok"); if (!n) return; t = +n.dataset.i; $$(".tok", row).forEach(x => x.classList.toggle("on", x === n)); draw(); });
  function draw() { const host = $("#fig-rope-coords"); host.innerHTML = ""; const W = 920, H = 300, s = svg(W, H), L = 50, cw = (W - L - 20) / HD; const q = R.q[t], r = R.rotated[t]; const mine = ropeVec(q, t); const okp = r.every((v, i) => near(v, mine[i], 2e-3));
    const mx = Math.max(...q.map(Math.abs), ...r.map(Math.abs)) * 1.1; const Y = (v, base) => base - v / mx * 55;
    [["before the rotation · q", q, 80, "--ink-3"], [`after · R_${t} q`, r, 210, "--cls-1"]].forEach(([name, v, base, col]) => { txt(s, L, base - 68, name, { anchor: "start", fs: 12.5, bold: 1, color: css("--ink") }); s.appendChild(el("line", { x1: L, x2: L + HD * cw, y1: base, y2: base, stroke: css("--rule-strong") }));
      v.forEach((val, i) => { const fast = i % 32 < 8; const rc = el("rect", { x: L + i * cw + 1, y: Math.min(Y(val, base), base), width: cw - 2, height: Math.abs(Y(val, base) - base) || 0.5, fill: css(i < 32 ? "--cls-0" : "--cls-2"), opacity: fast ? 1 : 0.55 }); s.appendChild(rc); tipOn(rc, `coordinate ${i} · pair ${i % 32}${i < 32 ? "" : " (second half)"}<br>${name}: <b>${val.toFixed(3)}</b><br>turned by ${(t * omega(i % 32) * 180 / Math.PI).toFixed(3)}°`); }); });
    [0, 8, 16, 24, 32, 40, 48, 56, 63].forEach(k => txt(s, L + k * cw + cw / 2, 280, String(k), { fs: 11, mono: 1 }));
    txt(s, L + 16 * cw, 262, "first half: x_i", { fs: 11.5, color: css("--cls-0") }); txt(s, L + 48 * cw, 262, "second half: x_{i+32} — its partner", { fs: 11.5, color: css("--cls-2") });
    txt(s, W - 20, 20, `position ${t} · ${okp ? "✓ matches torch" : "✗ differs from torch"}`, { anchor: "end", fs: 12, mono: 1, color: okp ? css("--good") : css("--bad") });
    host.appendChild(s); }
  draw(); REDRAW.push(draw);
})();
(function shift() {
  const S = RP.shift; const bet = makeBet("#bet-shift", ["both change a lot", "SmolLM2 barely, GPT-2 a lot", "GPT-2 barely, SmolLM2 a lot", "neither changes"], 1);
  reveal("btn-shift-reveal", ["shift-out"], "shift-note", [bet], () => { $("#shift-out").innerHTML = [["SmolLM2 · +1 000", S.smollm2], ["GPT-2 · +400", S.gpt2]].map(([n, r]) => `<div class="box ${r.changed > 0.5 ? "moved" : "still"}"><div class="k">${n}</div><div class="v">${(100 * r.changed).toFixed(0)}%</div><div class="k">next-token guesses changed</div><div style="margin-top:6px;font-family:var(--mono);font-size:13px">largest logit change ${r.maxDiff < 0.01 ? r.maxDiff.toExponential(1) : r.maxDiff.toFixed(2)} · logits reach ${r.logitScale.toFixed(0)}</div></div>`).join(""); });
})();
(function slowPairs() {
  const chk = RP.slow.every(r => { let n = 0; for (let i = 0; i < 32; i++) if (2 * Math.PI / Math.pow(r.theta, -2 * i / 64) > r.context) n++; return n === r.slow; });
  function draw() { const th = Math.pow(10, +$("#slow-theta").value), ctx = Math.pow(2, +$("#slow-ctx").value); $("#slow-theta-v").textContent = num(Math.round(th)); $("#slow-ctx-v").textContent = num(Math.round(ctx));
    const host = $("#fig-slow"); host.innerHTML = ""; const W = 920, H = 200, s = svg(W, H), L = 60, cw = (W - L - 20) / 32; let slow = 0;
    for (let i = 0; i < 32; i++) { const wl = 2 * Math.PI / Math.pow(th, -2 * i / 64); const isSlow = wl > ctx; if (isSlow) slow++; const hgt = Math.min(120, Math.max(3, 18 * Math.log10(wl))); const r = el("rect", { x: L + i * cw + 2, y: 150 - hgt, width: cw - 4, height: hgt, fill: isSlow ? css("--cls-1") : TINT("--cls-0", 40), stroke: isSlow ? css("--cls-1") : css("--cls-0") }); s.appendChild(r); tipOn(r, `pair ${i} · one turn every ${num(Math.round(wl))} positions<br>${isSlow ? "<b>slow</b>: never completes a turn in this context" : `turns ${(ctx / wl).toFixed(1)} times inside the context`}`); txt(s, L + i * cw + cw / 2, 168, String(i), { fs: 10.5, mono: 1 }); }
    const yc = 150 - Math.min(120, 18 * Math.log10(ctx)); s.appendChild(el("line", { x1: L, x2: L + 32 * cw, y1: yc, y2: yc, stroke: css("--ink"), "stroke-dasharray": "5 4" })); txt(s, L + 32 * cw, yc - 6, `context ${num(Math.round(ctx))}`, { anchor: "end", fs: 12, mono: 1, color: css("--ink") });
    txt(s, L, 22, `${slow} of 32 pairs are slow at θ = ${num(Math.round(th))}, context ${num(Math.round(ctx))} · bar height: log of the pair's wavelength`, { anchor: "start", fs: 13, bold: 1, color: css("--ink") }); txt(s, L, 192, `checked against the notebook at three (θ, context) points: ${chk ? "✓" : "✗"} 11 · 7 · 12`, { anchor: "start", fs: 11.5, mono: 1, color: chk ? css("--good") : css("--bad") });
    host.appendChild(s); }
  $("#slow-theta").addEventListener("input", draw); $("#slow-ctx").addEventListener("input", draw); draw(); REDRAW.push(draw);
})();

/* ====================================================== 02 grouped-query attention */
performance.mark("x:02 grouped-query attention");
(function gqa() {
  const G = D.gqa;
  states("gqa-btns", m => { const kv = +m, heads = G.heads, share = heads / kv; const host = $("#fig-gqa"); host.innerHTML = ""; const W = 920, H = 322, s = svg(W, H); const qw = 78, x0 = (W - heads * qw) / 2;
    txt(s, W / 2, 22, "query heads · nine questions asked of the same tokens", { fs: 13, bold: 1, color: css("--ink") });
    for (let h = 0; h < heads; h++) { const k = Math.floor(h / share), col = CLSC[k % 4]; box(s, x0 + h * qw + 4, 36, qw - 8, 44, `q${h}`, { fill: TINT(col, 16), stroke: css(col), fs: 13, bold: 1 }); txt(s, x0 + h * qw + qw / 2, 94, "a question", { fs: 10.5 }); }
    const kw = Math.min(260, (W - 60) / kv), kx0 = (W - kv * kw) / 2;
    const wide = (kw - 16) > 150;
    for (let k = 0; k < kv; k++) { const col = CLSC[k % 4]; const bx = kx0 + k * kw + 8, bw = kw - 16; box(s, bx, 170, bw, 70, "", { fill: TINT(col, 10), stroke: css(col) }); txt(s, bx + bw / 2, wide ? 192 : 209, `K${k}, V${k}`, { fs: 13, bold: 1, color: css("--ink") }); if (wide) { txt(s, bx + bw / 2, 212, "one space of answers", { fs: 11 }); txt(s, bx + bw / 2, 228, `[B, T, ${G.head_dim}] · cached`, { fs: 10.5, mono: 1 }); }
      for (let h = k * share; h < (k + 1) * share; h++) arrow(s, x0 + h * qw + qw / 2, 82, bx + bw / 2 + (h - k * share - (share - 1) / 2) * Math.min(28, bw / (share + 1)), 168, { color: css(col), sw: 1.3 }); }
    if (!wide) txt(s, W / 2, 258, `nine spaces of answers, each [B, T, ${G.head_dim}] · all cached`, { fs: 11, mono: 1 });
    txt(s, W / 2, 282, kv === 1 ? "multi-query (Shazeer 2019): one answer space for all nine questions · Gemma 2B" : kv === heads ? "multi-head (2017): every question keeps its own keys and values" : `grouped (Ainslie et al. 2023): three questions share one answer space · SmolLM2, Llama 3`, { fs: 12.5 });
    txt(s, W / 2, 306, "a query is used once, at its own step, and thrown away — only K and V are kept, so only they were worth grouping", { fs: 11.5, color: css("--ink-3") });
    host.appendChild(s);
    const params = G.params_by_kv[String(kv)], cache = 2 * 30 * kv * G.head_dim; $("#gqa-out").innerHTML = stat(num(params), "attention parameters per block") + stat(`${(params / (G.d * G.d)).toFixed(2)} d²`, "against 4d² ungrouped") + stat(num(cache), "cache numbers per token, 30 layers") + stat(`${(cache * 2 / 1024).toFixed(1)} KB`, "per token at 16 bits"); });
  code("#code-attn", `class Attention(nn.Module):
    """Causal self-attention with grouped queries: \`heads\` query heads read from \`kv_heads\` key/value heads."""
    def __init__(self, d, heads, kv_heads, theta):
        super().__init__()
        self.heads, self.kv_heads, self.theta, hd = heads, kv_heads, theta, d // heads
        self.q_proj, self.o_proj = nn.Linear(d, heads * hd, bias=False), nn.Linear(heads * hd, d, bias=False)
        self.k_proj, self.v_proj = nn.Linear(d, kv_heads * hd, bias=False), nn.Linear(d, kv_heads * hd, bias=False)

    def forward(self, x):
        B, T, _ = x.shape
        q = self.q_proj(x).view(B, T, self.heads, -1).transpose(1, 2)              # [B, heads, T, hd]
        k = self.k_proj(x).view(B, T, self.kv_heads, -1).transpose(1, 2)           # [B, kv_heads, T, hd] — the cache keeps this
        v = self.v_proj(x).view(B, T, self.kv_heads, -1).transpose(1, 2)
        q, k = rope(q, self.theta), rope(k, self.theta)                            # positions enter here, and nowhere else
        share = self.heads // self.kv_heads                                        # each K/V head serves \`share\` query heads
        out = F.scaled_dot_product_attention(q, k.repeat_interleave(share, 1), v.repeat_interleave(share, 1), is_causal=True)
        return self.o_proj(out.transpose(1, 2).reshape(B, T, -1))`);
})();

/* ====================================================== 02 the block, 2017 → 2024 */
performance.mark("x:02 the block, 2017 → 2024");
(function stack() {
  states("stack-btns", m => { const host = $("#fig-stack"); host.innerHTML = ""; const W = 920, H = 340, s = svg(W, H); const is24 = m === "2024";
    const parts = is24 ? [["RMSNorm", "--cls-3", "no mean, one gain"], ["grouped-query attention · 9 q, 3 kv", "--cls-0", "RoPE inside, no biases"], ["+", null, ""], ["RMSNorm", "--cls-3", ""], ["SwiGLU · 576 → 1 536 ×2 → 576", "--cls-2", "a gate, 8d²"], ["+", null, ""]]
      : [["LayerNorm", "--cls-3", "mean, std, γ, β"], ["multi-head attention · 8 heads, 8 kv", "--cls-0", "biases everywhere"], ["+", null, ""], ["LayerNorm", "--cls-3", ""], ["FFN · 512 → 2 048 → 512, ReLU", "--cls-2", "two matrices"], ["+", null, ""]];
    const x0 = 230, bw = 420; let y = 40; s.appendChild(el("line", { x1: x0 - 60, x2: x0 - 60, y1: 30, y2: 278, stroke: css("--ink-3"), "stroke-width": 5, "stroke-linecap": "round" })); txt(s, x0 - 60, 20, "residual stream", { fs: 12 });
    parts.forEach(([name, col, note]) => { if (col === null) { s.appendChild(el("circle", { cx: x0 - 60, cy: y + 6, r: 11, fill: css("--panel"), stroke: css("--ink"), "stroke-width": 1.5 })); txt(s, x0 - 60, y + 11, "+", { fs: 15, bold: 1, color: css("--ink") }); y += 30; return; }
      arrow(s, x0 - 60, y + 18, x0, y + 18, { color: css("--ink-2") }); box(s, x0, y, bw, 36, name, { fill: TINT(col, 14), stroke: css(col), bold: 1, fs: 13.5 }); if (note) txt(s, x0 + bw + 12, y + 22, note, { anchor: "start", fs: 12 }); y += 44; });
    const extra = is24 ? ["positions: a rotation of q and k in every layer (RoPE), no table", "head: the embedding table, transposed · 49 152 × 576", "× 30 blocks · d = 576"] : ["positions: sinusoids added once at the input", "+ an encoder and cross-attention (week 3), or a separate head", "× 6 blocks · d = 512"];
    extra.forEach((t, i) => txt(s, x0 - 100, 296 + i * 15, t, { anchor: "start", fs: 11.5 }));
    txt(s, W - 20, 20, is24 ? "swap four parts, remove the biases, keep the pre-norm" : "the block of 2017, with the norm already moved in front (GPT-2)", { anchor: "end", fs: 12, color: css("--ink-3") });
    host.appendChild(s); });
  const A = D.assemble; const bet = makeBet("#bet-assemble", ["below 0.001 — float noise", "around 0.1 — something small differs", "several — a part is wrong"], A.maxDiff < 0.01 ? 0 : A.maxDiff < 1 ? 1 : 2);
  reveal("btn-assemble-reveal", ["assemble-out"], "assemble-note", [bet], () => { $("#assemble-out").innerHTML = stat(A.maxDiff < 0.01 ? A.maxDiff.toExponential(1) : A.maxDiff.toFixed(2), "largest logit difference") + stat(A.logitScale.toFixed(0), "the logits themselves reach") + stat(num(A.params), "parameters, loaded strictly") + stat(`${(100 * A.sameArgmax).toFixed(0)}%`, "positions with the same next token"); });
})();

/* ====================================================== 03 the cache */
performance.mark("x:03 the cache");
const kvCacheBytes = (L, kv, hd, T, bytes) => 2 * L * kv * hd * T * (bytes || 2);
(function cache() {
  const C = D.cache; const ok = C.checks.every(c => kvCacheBytes(...c.args) === c.value); $("#cache-check").innerHTML = okText(ok, `kv_cache_bytes in the browser matches the notebook · measured ${num(C.measuredBytes)} bytes at ${C.T} tokens, formula ${num(C.formulaBytes)}`);
  const presets = C.presets; let N = presets["Llama-3-8B"][3];
  $("#cache-presets").innerHTML = Object.keys(presets).map(k => `<button data-m="${k}" class="${k === "Llama-3-8B" ? "sel" : ""}">${esc(k)}</button>`).join("");
  const bet = makeBet("#bet-cache", ["around 8k — the model is small", "around 30k", "around 120k", "never — weights always dominate"], 2);
  const upd = () => { const L = +$("#cc-L").value, kv = +$("#cc-kv").value, hd = +$("#cc-hd").value, T = Math.round(Math.pow(2, +$("#cc-T").value)); $("#cc-L-v").textContent = L; $("#cc-kv-v").textContent = kv; $("#cc-hd-v").textContent = hd; $("#cc-T-v").textContent = num(T);
    const perTok = kvCacheBytes(L, kv, hd, 1), total = kvCacheBytes(L, kv, hd, T), wts = N ? N * 2 : null; const users = wts ? Math.floor((24 * 2 ** 30 - wts) / total) : null;
    $("#cc-out").innerHTML = stat(num(2 * L * kv * hd), "numbers per token") + stat(`${(perTok / 1024).toFixed(1)} KB`, "per token, 16 bits") + stat(`${gib(total).toFixed(2)} GiB`, `cache at ${num(T)} tokens`) + (wts ? stat(`${gib(wts).toFixed(1)} GiB`, "weights, 16 bits") + stat(users >= 0 ? String(users) : "0", "users on a 24 GiB card") : stat("—", "weights"));
    bar($("#cc-bars"), [{ label: "weights", p: wts ? Math.min(1, wts / Math.max(wts, total)) : 0, text: wts ? gib(wts).toFixed(1) + " GiB" : "—", color: css("--cls-0") }, { label: "cache", p: Math.min(1, total / Math.max(wts || total, total)), text: gib(total).toFixed(2) + " GiB", color: css("--cls-1") }]); };
  ["cc-L", "cc-kv", "cc-hd", "cc-T"].forEach(id => $("#" + id).addEventListener("input", upd));
  states("cache-presets", m => { const [L, kv, hd, n] = presets[m]; N = n; $("#cc-L").value = L; $("#cc-kv").value = kv; $("#cc-hd").value = hd; upd(); });
  reveal("btn-cache-reveal", [], "cache-note", [bet], () => { const [L, kv, hd, n] = presets["Llama-3-8B"]; const Tx = n * 2 / kvCacheBytes(L, kv, hd, 1); $("#cache-note").innerHTML = `Llama-3-8B: 128 KB per token, 15 GiB of weights — the cache catches the weights at <b>${num(Math.round(Tx))}</b> tokens, inside the 131 072 that Llama 3.1 put on the same shapes. At full context the conversation weighs 16 GiB and the model 15. Without grouping — all 32 heads — it would be 64 GiB, for one user. Nine users: 24 GiB minus 15 of weights leaves 9; at 1 GiB of cache per user at 8 192 tokens, that is nine conversations at once, whatever the card could compute.`; });
})();

/* ====================================================== 03 prefill / decode */
performance.mark("x:03 prefill / decode");
(function regimes() {
  const toks = ["Fears", "for", "TN", "pension", "after", "talks"]; let step = 0; const maxStep = 6;
  function draw() { const host = $("#fig-regimes"); host.innerHTML = ""; const W = 920, H = 300, s = svg(W, H); const cw = 70, x0 = 60, nP = toks.length;
    txt(s, x0, 22, "prefill · one pass, all prompt positions in parallel", { anchor: "start", fs: 13, bold: 1, color: css("--cls-0") });
    for (let i = 0; i < nP; i++) { box(s, x0 + i * cw, 40, cw - 8, 28, toks[i], { fill: TINT("--cls-0", 12), stroke: css("--cls-0"), fs: 12, rx: 3 }); arrow(s, x0 + i * cw + (cw - 8) / 2, 70, x0 + i * cw + (cw - 8) / 2, 96, { color: css("--cls-0"), sw: 1.2 }); }
    box(s, x0 - 10, 96, nP * cw + 12, 40, "30 blocks · every position at once", { fill: TINT("--cls-0", 8), stroke: css("--cls-0"), fs: 12.5 });
    // the cache it leaves behind: one column per token
    for (let i = 0; i < nP + step; i++) { const isNew = i >= nP; box(s, x0 + i * cw, 170, cw - 8, 22, "K", { fill: isNew ? TINT("--cls-1", 20) : TINT("--cls-0", 20), stroke: css(isNew ? "--cls-1" : "--cls-0"), fs: 11, rx: 2 }); box(s, x0 + i * cw, 194, cw - 8, 22, "V", { fill: isNew ? TINT("--cls-1", 20) : TINT("--cls-0", 20), stroke: css(isNew ? "--cls-1" : "--cls-0"), fs: 11, rx: 2 }); }
    txt(s, x0, 160, `the cache · ${nP + step} tokens × 30 layers · grows by one column per step`, { anchor: "start", fs: 12 });
    if (step > 0) { const xi = x0 + (nP + step - 1) * cw; txt(s, x0, 250, `decode step ${step} · one token in, one row out, the whole cache read`, { anchor: "start", fs: 13, bold: 1, color: css("--cls-1") });
      box(s, xi, 262, cw - 8, 28, step === 1 ? "→ Un" : ["ions", "repr…", "work…", "at", "Turner"][step - 2] || "…", { fill: TINT("--cls-1", 14), stroke: css("--cls-1"), fs: 12, rx: 3 }); arrow(s, xi + (cw - 8) / 2, 262, xi + (cw - 8) / 2, 218, { color: css("--cls-1"), sw: 1.2 });
      for (let i = 0; i < nP + step - 1; i++) arrow(s, x0 + i * cw + (cw - 8) / 2, 218, xi + (cw - 8) / 2 - 4, 258, { color: css("--cls-1"), sw: 0.8, dash: 1 }); }
    else txt(s, x0, 250, "press step: decode begins — one token per pass", { anchor: "start", fs: 13, color: css("--ink-3") });
    host.appendChild(s); $("#regime-cnt").innerHTML = `prompt <b>${nP}</b> tokens · decode steps <b>${step}</b>`; }
  $("#regime-step").addEventListener("click", () => { step = Math.min(maxStep, step + 1); draw(); }); $("#regime-reset").addEventListener("click", () => { step = 0; draw(); }); draw(); REDRAW.push(draw);
})();
(function serving() {
  const S = D.serving, art = S.artifact, live = S.live; const machines = { artifact: { label: `precompute · ${art.device}`, models: { gpt2: art.models.gpt2.by_length, "SmolLM2-135M": art.models["SmolLM2-135M"].by_length } }, live: { label: `the notebook's live cell · ${live.device}`, models: live.models } };
  $("#serving-machine").innerHTML = Object.keys(machines).map((k, i) => `<button data-m="${k}" class="${i === 0 ? "sel" : ""}">${esc(machines[k].label)}</button>`).join("");
  $("#serving-meta").textContent = `32 new tokens after each prompt · ${art.device} and ${live.device}`;
  const r256 = art.models["SmolLM2-135M"].by_length.find(r => r["prompt tokens"] === 256), ratio = r256["prefill, tokens/s"] / r256["decode, tokens/s"];
  const dec = art.models["SmolLM2-135M"].by_length.map(r => r["decode, ms/token"]), decTrend = dec[dec.length - 1] / dec[0];
  const b1 = makeBet("#bet-prefill", ["about 10×", "about 100×", "about 1 000×"], ratio < 30 ? 0 : ratio < 300 ? 1 : 2), b2 = makeBet("#bet-decode", ["yes, clearly — the cache gets longer", "barely — the step is launch-bound at these lengths"], decTrend > 1.3 ? 0 : 1);
  let mk = "artifact";
  function draw() { const m = machines[mk]; const cols = [["gpt2", "--cls-3"], ["SmolLM2-135M", "--cls-1"]];
    lineChart($("#serving-chart"), { W: 640, H: 320, xlog: 1, ylog: 1, xlabel: "prompt tokens", ylabel: "tokens / s", fs: 13, xticks: [16, 64, 256, 960], xfmt: v => String(v), yticks: [10, 100, 1000, 10000], yfmt: v => num(v), ymin: 10, ymax: 20000,
      series: cols.flatMap(([n, c]) => [{ x: m.models[n].map(r => r["prompt tokens"]), y: m.models[n].map(r => r["prefill, tokens/s"]), color: css(c), label: `${n} · prefill`, tip: (x, y) => `${n} prefill at ${x}: ${num(y)} tokens/s` }, { x: m.models[n].map(r => r["prompt tokens"]), y: m.models[n].map(r => r["decode, tokens/s"]), color: css(c), dash: 1, label: `${n} · decode`, tip: (x, y) => `${n} decode after ${x}: ${y} tokens/s` }]) });
    lineChart($("#decode-chart"), { W: 640, H: 320, xlog: 1, xlabel: "prompt tokens", ylabel: "ms per decode step", fs: 13, xticks: [16, 64, 256, 960], xfmt: v => String(v), ymin: 0, series: cols.map(([n, c]) => ({ x: m.models[n].map(r => r["prompt tokens"]), y: m.models[n].map(r => r["decode, ms/token"]), color: css(c), label: `${n} · ms / token`, tip: (x, y) => `${y} ms per token after a prompt of ${x}` })) });
    const rows = cols.flatMap(([n]) => m.models[n].map(r => Object.assign({ model: n }, r)));
    table($("#serving-table"), [{ h: "model", f: r => esc(r.model) }, { h: "prompt", num: 1, f: r => r["prompt tokens"] }, { h: "prefill, ms", num: 1, f: r => r["prefill, ms"] }, { h: "prefill, tok/s", num: 1, f: r => num(r["prefill, tokens/s"]) }, { h: "decode, ms/tok", num: 1, f: r => r["decode, ms/token"] }, { h: "decode, tok/s", num: 1, f: r => r["decode, tokens/s"] }, { h: "cache, KB", num: 1, f: r => num(r["cache, KB"]) }], rows); }
  states("serving-machine", m => { mk = m; draw(); });
  reveal("btn-serving-reveal", ["serving-out"], "serving-note", [b1, b2], () => { draw(); const l256 = live.models["SmolLM2-135M"].find(r => r["prompt tokens"] === 256);
    $("#serving-note").innerHTML = `On the ${art.device}: prefill ${num(r256["prefill, tokens/s"])} tokens/s against decode ${r256["decode, tokens/s"]} at a prompt of 256 — <b>${ratio.toFixed(0)}×</b>. The decode step goes ${dec[0]} → ${dec[dec.length - 1]} ms from 16 to 960 tokens of prompt: ${decTrend > 1.3 ? "the longer cache shows" : "flat — at these lengths the step is paying for thirty layers of kernel launches, not for reading the cache"}. On the M4 the same ratio is ${(l256["prefill, tokens/s"] / l256["decode, tokens/s"]).toFixed(0)}×; the live numbers move run to run. The cache column grows linearly with the prompt, by the formula above, to the byte.`; });
})();

/* ====================================================== 03 where the arithmetic happens */
performance.mark("x:03 where the arithmetic happens");
(function arith() {
  const A = D.arith; const M = { artifact: { label: `precompute · ${A.artifact.device}`, d: A.artifact }, live: { label: `live · ${A.live.device}`, d: A.live } };
  ["queue-machine", "xover-machine", "rt-machine"].forEach(id => { $("#" + id).innerHTML = Object.keys(M).map((k, i) => `<button data-m="${k}" class="${i === 0 ? "sel" : ""}">${esc(M[k].label)}</button>`).join(""); });
  // the queue
  const bq = makeBet("#bet-queue", ["the same — the line returns when the product is done", "returns 10× sooner", "returns 100× or more sooner"], A.artifact.launch["existed, ms"] / A.artifact.launch["returned, ms"] > 50 ? 2 : 1); let qRevealed = false;
  states("queue-machine", m => { const L = M[m].d.launch; const host = $("#fig-queue"); host.innerHTML = ""; const W = 920, H = 170, s = svg(W, H); const x0 = 120, span = W - x0 - 40; const tmax = L["existed, ms"] * 1.1; const X = t => x0 + t / tmax * span;
    txt(s, x0 - 10, 50, "Python", { anchor: "end", fs: 13, bold: 1, color: css("--ink") }); txt(s, x0 - 10, 110, "GPU", { anchor: "end", fs: 13, bold: 1, color: css("--ink") });
    s.appendChild(el("line", { x1: x0, x2: W - 30, y1: 50, y2: 50, stroke: css("--rule-strong") })); s.appendChild(el("line", { x1: x0, x2: W - 30, y1: 110, y2: 110, stroke: css("--rule-strong") }));
    if (qRevealed) { s.appendChild(el("rect", { x: X(0), y: 38, width: Math.max(3, X(L["returned, ms"]) - X(0)), height: 24, fill: css("--cls-0") })); txt(s, X(L["returned, ms"]) + 8, 55, `b = a @ a returned after ${L["returned, ms"].toFixed(2)} ms — queued, not done`, { anchor: "start", fs: 12.5, color: css("--cls-0") });
      s.appendChild(el("rect", { x: X(0), y: 98, width: X(L["existed, ms"]) - X(0), height: 24, fill: TINT("--cls-1", 60), stroke: css("--cls-1") })); txt(s, X(L["existed, ms"]) / 2 + x0 / 2, 115, `the product exists after ${L["existed, ms"].toFixed(1)} ms`, { fs: 12.5, color: css("--ink") });
      arrow(s, X(L["existed, ms"]), 98, X(L["existed, ms"]), 64, { color: css("--ink-2"), dash: 1 }); txt(s, X(L["existed, ms"]), 80, "sync() — Python waits here", { fs: 11.5, anchor: "middle" });
      txt(s, x0, 150, `${(L["existed, ms"] / L["returned, ms"]).toFixed(0)}× between the two numbers on the ${M[m].d.device}`, { anchor: "start", fs: 12.5, mono: 1 }); }
    else { txt(s, x0, 40, "b = a @ a   →   when does this line return?", { anchor: "start", fs: 13, mono: 1, color: css("--ink") }); txt(s, x0, 100, "4 096 × 4 096 · 137 GFLOP   →   when does the product exist?", { anchor: "start", fs: 13, mono: 1, color: css("--ink") }); }
    host.appendChild(s); });
  reveal("btn-queue-reveal", [], "queue-note", [bq], () => { qRevealed = true; $("#queue-machine button.sel").click(); });
  // the crossover
  const bx = makeBet("#bet-xover", ["from 64", "from 256", "from 1 024", "from 2 048"], (() => { const mm = M.artifact.d.matmul; const w = mm.find(r => r["on GPU, ms"] < r["x @ x on CPU, ms"]); return Math.max(0, [64, 256, 1024, 2048].indexOf(w ? w.n : 2048)); })()); let picks = []; let xRevealed = false;
  function drawX(m) { const d = M[m].d; const mm = d.matmul; const host = $("#xover-chart");
    const ch = lineChart(host, { W: 640, H: 320, xlog: 1, ylog: 1, xlabel: "n · the product is n × n", ylabel: "ms", fs: 13, xticks: mm.map(r => r.n), xfmt: v => num(v), ymin: 0.001, ymax: 300,
      series: [{ x: mm.map(r => r.n), y: mm.map(r => r["x @ x on CPU, ms"]), color: css("--ink"), label: "on the CPU", tip: (x, y) => `CPU · ${x}: ${y} ms` }, { x: mm.map(r => r.n), y: mm.map(r => r["on GPU, ms"]), color: css("--cls-1"), label: "on the GPU", tip: (x, y) => `GPU · ${x}: ${y} ms` }, { x: mm.map(r => r.n), y: mm.map(r => r["on GPU, there and back, ms"]), color: css("--cls-0"), dash: 1, label: "GPU, there and back", tip: (x, y) => `GPU + trip · ${x}: ${y} ms` }] });
    picks.forEach((n, i) => { ch.s.appendChild(el("line", { x1: ch.X(n), x2: ch.X(n), y1: 20, y2: 268, stroke: css(i ? "--cls-0" : "--cls-1"), "stroke-dasharray": "3 3", "stroke-width": 1.5 })); txt(ch.s, ch.X(n) + 4, 34 + i * 16, i ? "your bet, with the trip" : "your bet, GPU alone", { anchor: "start", fs: 11.5, color: css(i ? "--cls-0" : "--cls-1") }); });
    if (!xRevealed) ch.s.addEventListener("click", e => { const r = ch.s.getBoundingClientRect(), px = (e.clientX - r.left) * 640 / r.width; let best = mm[0].n, bd = 1e9; mm.forEach(q => { const dd = Math.abs(ch.X(q.n) - px); if (dd < bd) { bd = dd; best = q.n; } }); picks = picks.length >= 2 ? [best] : picks.concat([best]); drawX(m); });
    table($("#transfer-table"), [{ h: "floats", num: 1, f: r => num(r.floats) }, { h: "MB", num: 1, f: r => r.MB }, { h: "CPU → GPU, ms", num: 1, f: r => r["CPU -> GPU, ms"] }, { h: "GPU → CPU, ms", num: 1, f: r => r["GPU -> CPU, ms"] }, { h: "x · 2 on CPU, ms", num: 1, f: r => r["x * 2 on CPU, ms"] }, { h: "x · 2 on GPU, ms", num: 1, f: r => r["x * 2 on GPU, ms"] }], d.transfer); }
  let xm = "artifact"; states("xover-machine", m => { xm = m; drawX(m); });
  reveal("btn-xover-reveal", [], "xover-note", [bx], () => { xRevealed = true; const mm = M.artifact.d.matmul; const win = mm.find(r => r["on GPU, ms"] < r["x @ x on CPU, ms"]), winTrip = mm.find(r => r["on GPU, there and back, ms"] < r["x @ x on CPU, ms"]); drawX(xm);
    $("#xover-note").innerHTML = `On the ${M.artifact.d.device}: the GPU alone wins from <b>n = ${win ? num(win.n) : "—"}</b>; counting the trip there and back, from <b>n = ${winTrip ? num(winTrip.n) : "—"}</b>. At 16 × 16 the CPU is ${(mm[0]["on GPU, ms"] / mm[0]["x @ x on CPU, ms"]).toFixed(0)}× faster — the product is over before the launch is. At 2 048 the GPU is ${(mm[4]["x @ x on CPU, ms"] / mm[4]["on GPU, ms"]).toFixed(0)}× faster, and the trip takes ${(100 * (mm[4]["on GPU, there and back, ms"] - mm[4]["on GPU, ms"]) / mm[4]["on GPU, there and back, ms"]).toFixed(0)}% of that time back. The transfer table prices the copy: 40 MB crosses in ${M.artifact.d.transfer[2]["CPU -> GPU, ms"]} ms on the ${M.artifact.d.device} and ${M.live.d.transfer[2]["CPU -> GPU, ms"]} ms on the M4, where there is no bus — only a copy into memory the GPU manages.`; });
  // the round trip
  const brt = makeBet("#bet-rt", ["a few percent", "about 2×", "5× or more"], (() => { const r = A.artifact.roundTrip["SmolLM2-135M"]; const k = r.round_trip_ms / r.on_gpu_ms; return k < 1.3 ? 0 : k < 3.5 ? 1 : 2; })()); let rtRevealed = false;
  states("rt-machine", m => { const host = $("#fig-roundtrip"); host.innerHTML = ""; const W = 920, H = 230, s = svg(W, H); const rt = m === "artifact" ? A.artifact.roundTrip["SmolLM2-135M"] : A.live.roundTrip;
    txt(s, 40, 24, "one decode step, two ways", { anchor: "start", fs: 13, bold: 1, color: css("--ink") });
    // left: on the GPU
    box(s, 40, 50, 180, 40, "30 blocks → logits", { fill: TINT("--cls-1", 12), stroke: css("--cls-1"), fs: 12.5 }); arrow(s, 220, 70, 260, 70, { color: css("--cls-1") }); box(s, 260, 50, 110, 40, "argmax", { fill: TINT("--cls-1", 12), stroke: css("--cls-1"), fs: 12.5 }); arrow(s, 315, 90, 315, 120, { color: css("--cls-1") }); arrow(s, 315, 120, 130, 120, { color: css("--cls-1"), noHead: 1 }); arrow(s, 130, 120, 130, 92, { color: css("--cls-1") });
    txt(s, 205, 150, "everything stays on the GPU · the id never leaves", { fs: 12, color: css("--cls-1") });
    // right: the careless loop
    const x1 = 500; box(s, x1, 50, 180, 40, "30 blocks → logits", { fill: TINT("--cls-0", 12), stroke: css("--cls-0"), fs: 12.5 }); arrow(s, x1 + 180, 70, x1 + 215, 70, { color: css("--cls-0") }); box(s, x1 + 215, 50, 170, 40, ".cpu() · 200 KB · wait", { fill: TINT("--bad", 14), stroke: css("--bad"), fs: 12 });
    arrow(s, x1 + 300, 90, x1 + 300, 120, { color: css("--cls-0") }); box(s, x1 + 230, 120, 140, 34, "np.argmax", { fill: css("--panel"), fs: 12 }); arrow(s, x1 + 230, 137, x1 + 90, 137, { color: css("--cls-0") }); box(s, x1 + 10, 120, 80, 34, "to GPU", { fill: TINT("--bad", 14), stroke: css("--bad"), fs: 12 }); arrow(s, x1 + 50, 120, x1 + 50, 92, { color: css("--cls-0") });
    txt(s, x1 + 190, 180, "two copies and a forced wait, 64 times · same tokens", { fs: 12, color: css("--cls-0") });
    if (rtRevealed) txt(s, W / 2, 215, `${rt.on_gpu_ms.toFixed(0)} ms against ${rt.round_trip_ms.toFixed(0)} ms for 64 tokens on the ${m === "artifact" ? A.artifact.device : A.live.device} — ${(rt.round_trip_ms / rt.on_gpu_ms).toFixed(2)}×`, { fs: 13, mono: 1, color: css("--ink") });
    host.appendChild(s); });
  reveal("btn-rt-reveal", ["rt-out"], "rt-note", [brt], () => { rtRevealed = true; $("#rt-machine button.sel").click(); const a = A.artifact.roundTrip["SmolLM2-135M"], l = A.live.roundTrip;
    $("#rt-out").innerHTML = stat(`${(a.round_trip_ms / a.on_gpu_ms).toFixed(2)}×`, `round trip on the ${A.artifact.device}`) + stat(`${(l.round_trip_ms / l.on_gpu_ms).toFixed(2)}×`, `round trip on the ${A.live.device}`) + stat(`${A.logitsRowKB.toFixed(0)} KB`, "one row of logits, fp32") + stat(l.same ? "yes" : "no", "same 64 tokens both ways");
    $("#rt-note").innerHTML = `Whatever the ratio is on your machine, read what it is made of: a row of 49 152 logits is 200 KB — cheap to carry — and what the round trip really adds is a forced wait and two small copies at every step, 64 times. A loop that also <em>prints</em> each token as it goes, logs a tensor, or checks a stopping condition in Python pays the same toll. None of it is in 2N per token.`; });
})();

/* ====================================================== 03 experts */
performance.mark("x:03 experts");
(function moe() {
  const Mo = D.moe, toks = Mo.tokens, chosen = Mo.chosen; let t = 0; const E = Mo.n_experts;
  function draw() { const host = $("#fig-moe"); host.innerHTML = ""; const W = 920, H = 330, s = svg(W, H); const picks = chosen[t]; const ew = 96, ex0 = (W - E * ew) / 2;
    box(s, W / 2 - 90, 20, 180, 34, toks[t].replace(/^Ġ/, "␣"), { fill: css("--panel"), fs: 13, bold: 1 }); txt(s, W / 2 + 100, 42, `token ${t + 1} of ${toks.length} · its residual vector, 576 numbers`, { anchor: "start", fs: 11.5 });
    arrow(s, W / 2, 54, W / 2, 84, { color: css("--ink-2") }); box(s, W / 2 - 110, 84, 220, 36, `router · Linear(576 → ${E}), top-${Mo.top_k}`, { fill: TINT("--cls-3", 14), stroke: css("--cls-3"), fs: 12.5 });
    for (let e = 0; e < E; e++) { const on = picks.includes(e); const col = on ? "--cls-1" : "--ink-3"; const bx = ex0 + e * ew + 6; box(s, bx, 180, ew - 12, 70, "", { fill: on ? TINT("--cls-1", 16) : css("--panel-sunk"), stroke: css(col), sw: on ? 2 : 1 }); txt(s, bx + (ew - 12) / 2, 206, `expert ${e}`, { fs: 12.5, bold: on, color: on ? css("--ink") : css("--ink-3") }); txt(s, bx + (ew - 12) / 2, 224, "SwiGLU", { fs: 11, color: css("--ink-3") }); txt(s, bx + (ew - 12) / 2, 240, `${(Mo.expert / 1e6).toFixed(2)}M`, { fs: 10.5, mono: 1, color: css("--ink-3") });
      if (on) { arrow(s, W / 2, 120, bx + (ew - 12) / 2, 178, { color: css("--cls-1"), sw: 2 }); arrow(s, bx + (ew - 12) / 2, 250, W / 2, 292, { color: css("--cls-1"), sw: 2 }); } else s.appendChild(el("line", { x1: W / 2, y1: 120, x2: bx + (ew - 12) / 2, y2: 178, stroke: css("--rule"), "stroke-dasharray": "2 4" })); }
    s.appendChild(el("circle", { cx: W / 2, cy: 300, r: 12, fill: css("--panel"), stroke: css("--ink"), "stroke-width": 1.5 })); txt(s, W / 2, 305, "Σ", { fs: 14, bold: 1, color: css("--ink") }); txt(s, W / 2 + 22, 304, `mixed by a softmax over the ${Mo.top_k}: scores [2, 1] → [${Mo.softmaxTop2.map(v => v.toFixed(2)).join(", ")}]`, { anchor: "start", fs: 11.5 });
    txt(s, 30, 160, `owns ${num(Mo.owned)} · runs ${num(Mo.active)} per token (${(100 * Mo.active / Mo.owned).toFixed(0)}%)`, { anchor: "start", fs: 12, mono: 1 });
    host.appendChild(s); $("#moe-cnt").innerHTML = `token <b>${t + 1}</b> / ${toks.length} → experts <b>${picks.join(", ")}</b>`; }
  $("#moe-next").addEventListener("click", () => { t = (t + 1) % toks.length; draw(); }); $("#moe-prev").addEventListener("click", () => { t = (t - 1 + toks.length) % toks.length; draw(); }); draw(); REDRAW.push(draw);
  code("#code-moe", `class MoE(nn.Module):
    def __init__(self, d, hidden, n_experts, top_k):
        super().__init__()
        self.router, self.top_k = nn.Linear(d, n_experts, bias=False), top_k
        self.experts = nn.ModuleList(SwiGLU(d, hidden) for _ in range(n_experts))

    def forward(self, x):
        weights, chosen = self.router(x).topk(self.top_k, dim=-1)                   # both [B, T, top_k]
        weights = weights.softmax(-1)
        out = torch.zeros_like(x)
        for e, expert in enumerate(self.experts):
            share = (weights * (chosen == e)).sum(-1)                               # [B, T]: this expert's weight per token
            rows = share > 0
            out[rows] += expert(x[rows]) * share[rows][:, None]                     # only the tokens that chose it pay
        return out, chosen`);
  // scatter / gather
  $("#moe-hist").textContent = Mo.hist.map((n, e) => `${n} to expert ${e}`).join(", ");
  states("scatter-btns", m => { const host = $("#fig-scatter"); host.innerHTML = ""; const W = 920, H = 260, s = svg(W, H); const n = toks.length, tw = Math.min(26, (W - 80) / n), x0 = (W - n * tw) / 2;
    toks.forEach((tk, i) => { const r = box(s, x0 + i * tw, 30, tw - 3, 22, "", { fill: TINT(m === "moe" ? CLSC[chosen[i][0] % 4] : "--cls-0", 30), stroke: css(m === "moe" ? CLSC[chosen[i][0] % 4] : "--cls-0"), rx: 2 }); tipOn(r, `${esc(tk)}${m === "moe" ? ` → experts ${chosen[i].join(", ")}` : ""}`); });
    txt(s, W / 2, 20, `the batch · ${n} tokens`, { fs: 12.5 });
    if (m === "dense") { arrow(s, W / 2, 54, W / 2, 96, { color: css("--cls-0") }); box(s, W / 2 - 220, 96, 440, 48, `one matrix product · [${n}, 576] @ [576, 1 536] — every token, one launch`, { fill: TINT("--cls-0", 12), stroke: css("--cls-0"), fs: 12.5 }); arrow(s, W / 2, 144, W / 2, 186, { color: css("--cls-0") }); toks.forEach((tk, i) => box(s, x0 + i * tw, 186, tw - 3, 22, "", { fill: TINT("--cls-0", 30), stroke: css("--cls-0"), rx: 2 })); txt(s, W / 2, 240, "the GPU is full for one call", { fs: 12.5 }); }
    else { const ew = (W - 60) / E, maxH = Math.max(...Mo.hist); for (let e = 0; e < E; e++) { const cnt = Mo.hist[e], bx = 30 + e * ew; const h = 10 + 70 * cnt / maxH; box(s, bx + 6, 150 - h, ew - 12, h, "", { fill: TINT(CLSC[e % 4], 20), stroke: css(CLSC[e % 4]) }); txt(s, bx + ew / 2, 168, `expert ${e}`, { fs: 11.5 }); txt(s, bx + ew / 2, 150 - h - 6, `${cnt} rows`, { fs: 11, mono: 1 });
        toks.forEach((tk, i) => { if (chosen[i].includes(e)) s.appendChild(el("line", { x1: x0 + i * tw + tw / 2, y1: 52, x2: bx + ew / 2, y2: 150 - h, stroke: css(CLSC[e % 4]), "stroke-width": .7, opacity: .6 })); }); }
      arrow(s, W / 2, 182, W / 2, 200, { color: css("--ink-2") }); toks.forEach((tk, i) => box(s, x0 + i * tw, 200, tw - 3, 22, "", { fill: TINT(CLSC[chosen[i][0] % 4], 30), stroke: css(CLSC[chosen[i][0] % 4]), rx: 2 }));
      txt(s, W / 2, 240, `scatter to ${E} products of uneven size (${Mo.hist.join(", ")} rows), gather back`, { fs: 12 }); txt(s, W / 2, 256, "the biggest pile sets the pace; a pile of 1 row still pays a launch", { fs: 12 }); }
    host.appendChild(s); });
  // owned against run
  const presets = { mixtral: { E: 8, k: 2, expert: Mo.mistral.ffn / 1e9, shared: (Mo.mistral.dense - Mo.mistral.ffn) / 1e9, name: "Mixtral 8x7B · from Mistral 7B's config" }, gptoss: { E: 32, k: 4, expert: Mo.gptoss.expert, shared: Mo.gptoss.shared, name: "gpt-oss-20b · solved from 20.9B owned, 3.6B active" }, ours: { E: 8, k: 2, expert: Mo.expert * 30 / 1e9, shared: (D.params.smollm2.total - D.params.smollm2.parts["feed-forward"]) / 1e9, name: "our block × 30 · SmolLM2 with experts" } };
  let cur = presets.mixtral; const bet = $("#moe-guess");
  const upd = () => { const E2 = +$("#moe-E").value, k = Math.min(+$("#moe-k").value, E2); $("#moe-E-v").textContent = E2; $("#moe-k-v").textContent = k; const owned = cur.shared + E2 * cur.expert, active = cur.shared + k * cur.expert;
    $("#moe-out").innerHTML = stat(`${owned.toFixed(1)}B`, "owned · N") + stat(`${active.toFixed(1)}B`, "run per token · active N") + stat(`${(owned / active).toFixed(1)}×`, "owned / run") + stat(`${(owned * 2 / 2 ** 30 * 1e9).toFixed(0)} GiB`, "weights at 16 bits") + stat(`${cur.shared.toFixed(2)}B + ${E2} × ${cur.expert.toFixed(2)}B`, cur.name); };
  ["moe-E", "moe-k"].forEach(id => $("#" + id).addEventListener("input", upd));
  states("moe-presets", m => { cur = presets[m]; $("#moe-E").value = cur.E; $("#moe-k").value = cur.k; upd(); });
  reveal("btn-moe-reveal", [], "moe-note", [], () => { const g = parseFloat(bet.value); const owned = Mo.mistral.owned8 / 1e9, active = Mo.mistral.active2 / 1e9;
    $("#moe-note").innerHTML = `${isNaN(g) ? "No guess typed." : Math.abs(g - owned) < 2 ? `<b>${g}B — right.</b>` : `You said ${g}B.`} <b>${owned.toFixed(1)}B owned, ${active.toFixed(1)}B run</b> — the two numbers in Mistral's announcement, rebuilt from Mistral 7B's config: ${(Mo.mistral.ffn / 1e9).toFixed(2)}B of the 7.24B are feed-forwards, and only they are multiplied by eight. gpt-oss-20b: about ${Mo.gptoss.expert.toFixed(2)}B per expert and ${Mo.gptoss.shared.toFixed(1)}B shared by our assumption; the model card says 19.1B in the experts (0.60B each — we were right), 0.64B in the attention and 1.16B in the two embedding tables — 1.8B shared, because OpenAI does not count the input embedding as <em>active</em>. Either way: the memory bill of a 21B model, the per-token compute of a 3.6B one.`; });
})();

/* ====================================================== 03 context: three limits, and linear attention */
performance.mark("x:03 context: three limits, and linear attention");
(function context() {
  const Cx = D.context; const [L, kv, hd] = [32, 8, 128];
  const upd = () => { const T = Math.round(Math.pow(2, +$("#ctx-T").value)); $("#ctx-T-v").textContent = num(T); $("#ctx-T-label").textContent = `T = ${num(T)}`; let slow = 0; for (let i = 0; i < 64; i++) if (2 * Math.PI / Math.pow(500000, -2 * i / 128) > T) slow++;
    const pairs = T * T, win = T * Cx.window, mixed = (pairs + 2 * win) / 3;
    $("#ctx-out").innerHTML = stat(`${slow} / 64`, "slow pairs · θ = 500 000") + stat(`${gib(kvCacheBytes(L, kv, hd, T)).toFixed(2)} GiB`, "cache · 32 layers, 8 kv heads of 128") + stat(human(pairs), "pairs per head per layer, full") + stat(human(mixed), `full every 3rd, window ${Cx.window} else`) + stat(`${(pairs / mixed).toFixed(1)}×`, "cheaper on average"); };
  $("#ctx-T").addEventListener("input", upd); upd();
  const drawMasks = () => { const host = $("#fig-masks"); host.innerHTML = ""; const W = 920, H = 290, s = svg(W, H); const n = 24, cs = 8, w = 3;
    [["layer 3k · full attention", (i, j) => j <= i], [`layer 3k + 1 · window of ${w}`, (i, j) => j <= i && i - j < w], [`layer 3k + 2 · window of ${w}`, (i, j) => j <= i && i - j < w]].forEach(([name, keep], k) => { const x0 = 60 + k * 300; txt(s, x0 + n * cs / 2, 22, name, { fs: 12.5, bold: 1, color: css("--ink") });
      for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) s.appendChild(el("rect", { x: x0 + j * cs, y: 36 + i * cs, width: cs - 1, height: cs - 1, fill: keep(i, j) ? css(k ? "--cls-2" : "--cls-0") : css("--panel-sunk") }));
      txt(s, x0 + n * cs / 2, 36 + n * cs + 16, k ? `${n * w - 3} pairs` : `${n * (n + 1) / 2} pairs`, { fs: 11.5, mono: 1 }); });
    txt(s, W / 2, 262, `queries down, keys across · at ${num(Cx.T)} tokens: ${human(Cx.full)} pairs full, ${human(Cx.local)} windowed`, { fs: 12 }); txt(s, W / 2, 280, `${human(Cx.mixed)} on average in the mix — ${(Cx.full / Cx.mixed).toFixed(1)}× cheaper (ModernBERT; Gemma 3 does 5 : 1)`, { fs: 12 });
    host.appendChild(s); };
  drawMasks(); REDRAW.push(drawMasks);
})();
/* linear attention: the JS port of the recurrence, checked against torch */
function linearAttention(q, k, v) { const T = q.length, d = q[0].length; const phi = x => x.map(a => (a > 0 ? a : Math.exp(a) - 1) + 1); const S = Array.from({ length: d }, () => new Array(d).fill(0)), z = new Array(d).fill(0), out = [];
  for (let t = 0; t < T; t++) { const kt = phi(k[t]), qt = phi(q[t]); for (let i = 0; i < d; i++) { z[i] += kt[i]; for (let j = 0; j < d; j++) S[i][j] += kt[i] * v[t][j]; } const den = qt.reduce((a, b, i) => a + b * z[i], 0) + 1e-6; out.push(Array.from({ length: d }, (_, j) => qt.reduce((a, b, i) => a + b * S[i][j], 0) / den)); } return out; }
(function linear() {
  const Ln = D.linear; const mine = linearAttention(Ln.check.q, Ln.check.k, Ln.check.v); const ok = Ln.check.out.every((row, t) => row.every((v, j) => near(v, mine[t][j], 2e-3)));
  $("#lin-check").innerHTML = okText(ok, `the recurrence in the browser matches the notebook's linear_attention on a 3 × 4 example`);
  states("lin-btns", m => { const host = $("#fig-linear"); host.innerHTML = ""; const W = 920, H = 300, s = svg(W, H); const T = 10, cs = 18;
    if (m === "softmax") { const x0 = 80; txt(s, x0, 22, "softmax(q Kᵀ) V · the T × T scores must exist before they can be normalised", { anchor: "start", fs: 12.5, bold: 1, color: css("--ink") });
      for (let i = 0; i < T; i++) for (let j = 0; j <= i; j++) s.appendChild(el("rect", { x: x0 + j * cs, y: 40 + i * cs, width: cs - 1, height: cs - 1, fill: TINT("--cls-0", 20 + 60 * Math.exp(-(i - j) / 3)) })); txt(s, x0 + T * cs / 2, 40 + T * cs + 16, "scores · T² per head", { fs: 11.5, mono: 1 });
      const x1 = 380; txt(s, x1, 22, "", {}); for (let i = 0; i < T; i++) { box(s, x1, 40 + i * cs, 120, cs - 2, "", { fill: TINT("--cls-0", 18), stroke: css("--cls-0"), rx: 1 }); box(s, x1 + 130, 40 + i * cs, 120, cs - 2, "", { fill: TINT("--cls-2", 18), stroke: css("--cls-2"), rx: 1 }); } txt(s, x1 + 60, 40 + T * cs + 16, "K · T × d", { fs: 11.5, mono: 1 }); txt(s, x1 + 190, 40 + T * cs + 16, "V · T × d", { fs: 11.5, mono: 1 });
      txt(s, x1 + 265, 60, "kept between steps:", { anchor: "start", fs: 12.5, bold: 1, color: css("--ink") }); txt(s, x1 + 265, 78, "K and V of every token", { anchor: "start", fs: 12.5, bold: 1, color: css("--ink") }); txt(s, x1 + 265, 108, "cache: 2 · T · d_head numbers", { anchor: "start", fs: 12.5, mono: 1 }); txt(s, x1 + 265, 128, "per head per layer — grows with T", { anchor: "start", fs: 12 }); txt(s, x1 + 265, 156, "compute: T² · d_head multiplications", { anchor: "start", fs: 12.5, mono: 1 }); }
    else { const x0 = 80; txt(s, x0 + 160, 22, "φ(q)ᵀ S / φ(q)ᵀ z · S and z are running sums, updated once per token", { anchor: "start", fs: 12.5, bold: 1, color: css("--ink") });
      const d = 8, cs2 = 16; for (let i = 0; i < d; i++) for (let j = 0; j < d; j++) s.appendChild(el("rect", { x: x0 + j * cs2, y: 50 + i * cs2, width: cs2 - 1, height: cs2 - 1, fill: TINT("--cls-1", 30 + 40 * Math.random()) })); txt(s, x0 + d * cs2 / 2, 50 + d * cs2 + 16, "S · d × d", { fs: 11.5, mono: 1 });
      for (let i = 0; i < d; i++) s.appendChild(el("rect", { x: x0 + d * cs2 + 20, y: 50 + i * cs2, width: cs2 - 1, height: cs2 - 1, fill: TINT("--cls-3", 40) })); txt(s, x0 + d * cs2 + 28, 50 + d * cs2 + 16, "z · d", { fs: 11.5, mono: 1 });
      const x1 = 330; for (let t = 0; t < 5; t++) { box(s, x1 + t * 110, 70, 90, 30, `φ(k${t}) v${t}ᵀ`, { fill: TINT("--cls-2", 14), stroke: css("--cls-2"), fs: 11.5, rx: 3 }); arrow(s, x1 + t * 110 + 45, 100, x1 + t * 110 + 45, 130, { color: css("--cls-2"), sw: 1.2 }); if (t) arrow(s, x1 + (t - 1) * 110 + 90, 145, x1 + t * 110, 145, { color: css("--ink-2") }); box(s, x1 + t * 110, 130, 90, 30, `S${t}`, { fill: TINT("--cls-1", 16), stroke: css("--cls-1"), fs: 12, rx: 3 }); }
      txt(s, x1 + 270, 190, "S_t = S_{t−1} + φ(k_t) v_tᵀ — an RNN with a d × d state; the T × T scores never exist", { fs: 12.5, mono: 1 });
      txt(s, x0, 230, `state: d_head² + d_head numbers per head per layer — the same at T = 10 and at T = 100 000`, { anchor: "start", fs: 12.5, mono: 1 }); txt(s, x0, 252, "compute: T · d_head² multiplications — linear in the context · Katharopoulos et al. 2020", { anchor: "start", fs: 12.5, mono: 1 }); txt(s, x0, 280, "softmax head: a different function (not a faster softmax). Trained this way from scratch: Mamba, GLA, RWKV, the hybrids that keep a few softmax layers.", { anchor: "start", fs: 11.5, color: css("--ink-3") }); }
    host.appendChild(s); });
  code("#code-linear", `def phi(x):
    return F.elu(x) + 1                                                            # positive: the normaliser is never zero


def linear_attention(q, k, v):
    """Causal attention without the softmax, all positions at once: S_t and z_t are cumulative sums over positions."""
    q, k = phi(q), phi(k)
    S = torch.cumsum(k.unsqueeze(-1) * v.unsqueeze(-2), dim=-3)                  # [B, h, T, hd, hd]: Σ φ(k_s) v_sᵀ
    z = torch.cumsum(k, dim=-2)                                                  # [B, h, T, hd]:     Σ φ(k_s)
    return (q.unsqueeze(-2) @ S).squeeze(-2) / ((q * z).sum(-1, keepdim=True) + 1e-6)


def linear_attention_step(q_t, k_t, v_t, S, z):
    """The same thing, one token at a time: the recurrent form. (S, z) is the whole state — no cache of past tokens."""
    q_t, k_t = phi(q_t), phi(k_t)
    S, z = S + k_t.unsqueeze(-1) * v_t.unsqueeze(-2), z + k_t                   # [B, h, hd, hd], [B, h, hd]
    return (q_t.unsqueeze(-2) @ S).squeeze(-2) / ((q_t * z).sum(-1, keepdim=True) + 1e-6), S, z`);
  const b1 = makeBet("#bet-lin-state", ["from about 30 tokens", "from about 500", "from about 4 000", "never — a d × d state is big"], 0), b2 = makeBet("#bet-lin-time", ["linear is faster at every T", "softmax is faster at every T", "they cross somewhere in between"], (() => { const r = Ln.timing; const lw = r.map(x => x["linear, ms"] < x["softmax, ms"]); return lw.every(Boolean) ? 0 : lw.every(x => !x) ? 1 : 2; })()), b3 = makeBet("#bet-lin-swap", ["stays about 1.3", "about 2–3 — worse, still a language model", "above 6 — random guessing"], Ln.bpb.linear < 1.6 ? 0 : Ln.bpb.linear < 6 ? 1 : 2);
  const drawChart = () => { const Ts = [8, 16, 32, 64, 128, 256, 512, 1024, 2048, 4096, 8192, 16384]; lineChart($("#lin-chart"), { W: 640, H: 320, xlog: 1, ylog: 1, xlabel: "context T · one layer of SmolLM2 (3 kv heads of 64)", ylabel: "numbers kept", fs: 13, xticks: [8, 64, 512, 4096, 16384], xfmt: v => num(v), yticks: [1e3, 1e4, 1e5, 1e6, 1e7], yfmt: v => human(v), ymin: 1e3, ymax: 3e7, xmin: 6, xmax: 3e4,
    vlines: [{ x: Ln.crossoverT, label: `cross at ${Ln.crossoverT.toFixed(1)} tokens`, color: css("--cls-1") }], series: [{ x: Ts, y: Ts.map(T => Ln.cachePerToken * T), color: css("--cls-0"), nodots: 1, label: "KV cache · 2 · h_kv · d_head · T" }, { x: Ts, y: Ts.map(() => Ln.state), color: css("--cls-1"), nodots: 1, label: "linear-attention state · h_kv · (d_head² + d_head)" }] }); };
  REDRAW.push(() => { if (!$("#lin-out").hidden) drawChart(); });
  reveal("btn-lin-reveal", ["lin-out"], "lin-note", [b1, b2, b3], () => { drawChart(); table($("#lin-table"), [{ h: "T", num: 1, f: r => num(r.T) }, { h: "T² · hd", num: 1, f: r => human(r["pairs T²·hd"]) }, { h: "T · hd²", num: 1, f: r => human(r["linear T·hd²"]) }, { h: "softmax, ms", num: 1, f: r => r["softmax, ms"].toFixed(1) }, { h: "linear, ms", num: 1, f: r => `<b>${r["linear, ms"].toFixed(1)}</b>` }], Ln.timing);
    $("#lin-swap").innerHTML = stat(Ln.bpb.softmax.toFixed(3), "bits/byte · our Decoder, softmax") + stat(`<b>${Ln.bpb.linear.toFixed(3)}</b>`, "same weights, linear attention") + stat(`${Ln.bpb.nTexts}`, "test texts");
    const r = Ln.timing[Ln.timing.length - 1];
    $("#lin-note").innerHTML = `<b>${Math.ceil(Ln.crossoverT)} tokens.</b> The state of one layer is ${num(Ln.state)} numbers, the cache ${Ln.cachePerToken} per token; past ${Math.ceil(Ln.crossoverT)} tokens of context the recurrent form holds <em>less</em> than the cache, and at 8 192 it holds ${Math.round(Ln.cachePerToken * 8192 / Ln.state)} times less. <b>The arithmetic wins, the clock does not:</b> T · d² is ${Math.round(r["pairs T²·hd"] / r["linear T·hd²"])}× fewer multiplications than T² · d at ${num(r.T)}, and our <code>linear_attention</code> is ${(r["linear, ms"] / r["softmax, ms"]).toFixed(1)}× <em>slower</em> than the softmax there on the M4 (${r["softmax, ms"].toFixed(0)} against ${r["linear, ms"].toFixed(0)} ms). <code>cumsum</code> over a [T, 64, 64] tensor is memory traffic, and <code>scaled_dot_product_attention</code> is a fused kernel somebody spent years on — a FLOP count is not a time. Every linear-attention model in use ships a chunked, fused kernel for exactly this sum (Yang et al. 2024 put <em>hardware-efficient</em> in the title). <b>The weights do not transfer:</b> ${Ln.bpb.softmax.toFixed(2)} → ${Ln.bpb.linear.toFixed(2)} bits/byte on the same ${Ln.bpb.nTexts} texts. The trained q and k were shaped for an exponential; elu + 1 is not one. Linear attention is a different model, trained from scratch or distilled — the third way to pay the compute bill for context: not full attention everywhere, not a window, but a state.`; });
})();

/* ====================================================== 04 five years later */
performance.mark("x:04 five years later");
function orderPick(hostId, names, trueOrder) {
  const host = $("#" + hostId); let order = []; let done = false;
  const draw = () => { host.innerHTML = names.map(n => { const i = order.indexOf(n); const cls = done ? (i >= 0 && trueOrder[i] === n ? "right" : i >= 0 ? "wrong" : "") : (i >= 0 ? "pick" : ""); return `<button data-n="${esc(n)}" class="${cls}">${i >= 0 ? `<i>${i + 1}</i>` : ""}${esc(n)}</button>`; }).join("") + (done ? `<span class="arrow">· the measured order: ${trueOrder.map(esc).join(" › ")}</span>` : order.length ? `<span class="arrow">${order.length} of ${names.length} ranked</span>` : ""); };
  host.addEventListener("click", e => { const b = e.target.closest("button[data-n]"); if (!b || done) return; const n = b.dataset.n; if (order.includes(n)) order = order.filter(x => x !== n); else order.push(n); draw(); });
  draw(); return { reveal: () => { done = true; draw(); return order.length === names.length && order.every((n, i) => n === trueOrder[i]); } };
}
(function bpb() {
  const Fa = D.family.artifact, live = D.family.live; const names = Object.keys(Fa.models); const label = n => n === "gpt2" ? "GPT-2 small" : n;
  $("#bpb-meta").textContent = `${num(Fa.n_bpb)} test texts · ${Fa.device}`;
  const trueOrder = names.slice().sort((a, b) => Fa.models[a].bits_per_byte - Fa.models[b].bits_per_byte).map(label);
  const pick = orderPick("bpb-pick", names.map(label), trueOrder);
  $("#btn-bpb-reveal").addEventListener("click", e => { pick.reveal(); $("#bpb-out").hidden = false; e.target.closest(".panel").querySelector(".veil").remove(); e.target.disabled = true; e.target.textContent = "revealed";
    const mx = Math.max(...names.map(n => Fa.models[n].bits_per_byte)); bar($("#bpb-out"), names.map(n => ({ label: `${label(n)} · ${human(Fa.models[n].params)}`, p: Fa.models[n].bits_per_byte / mx, text: Fa.models[n].bits_per_byte.toFixed(4), color: css(n === "gpt2" ? "--cls-3" : "--cls-1") })));
    const g = Fa.models.gpt2.bits_per_byte, s135 = Fa.models["SmolLM2-135M"].bits_per_byte, s360 = Fa.models["SmolLM2-360M"].bits_per_byte, s17 = Fa.models["SmolLM2-1.7B"].bits_per_byte;
    $("#bpb-note").hidden = false; $("#bpb-note").innerHTML = `<b>${g.toFixed(2)} and ${s135.toFixed(2)}.</b> Five years, four new parts in the block and a couple of hundred times the training tokens — and on news text the 135M model of 2024 predicts the next token ${Math.abs(s135 - g) / g < 0.01 ? "exactly as well as" : s135 < g ? "a little better than" : "a little worse than"} the 124M model of 2019: the gap is ${(100 * Math.abs(s135 - g) / g).toFixed(1)}%, inside the noise between samples (the live cell on ${D.family.liveN} texts: ${live["GPT-2 small"]["bits / byte"].toFixed(3)} against ${live["SmolLM2-135M"]["bits / byte"].toFixed(3)}). The other rows say which dial still works: 360M is ${(100 * (1 - s360 / s135)).toFixed(0)}% better, 1.7B another ${(100 * (1 - s17 / s360)).toFixed(0)}%. <code>bytes / token</code> settles the guess from block 01: ${Fa.models.gpt2.bytes_per_token.toFixed(1)} for GPT-2, not 4 — WebText is nearer 9B tokens than 10B.`;
    document.dispatchEvent(new CustomEvent("revealed", { detail: "btn-bpb-reveal" })); });
})();
(function zeroShot() {
  const Fa = D.family.artifact, Z = D.zeroShot; const names = Object.keys(Fa.models); const label = n => n === "gpt2" ? "GPT-2 small" : n;
  $("#zs-meta").textContent = `${num(Fa.n_zero_shot)} test texts · 4 passes per text · ${Fa.device}`;
  const trueOrder = names.slice().sort((a, b) => Fa.models[b].zero_shot.accuracy - Fa.models[a].zero_shot.accuracy).map(label);
  const pick = orderPick("zs-pick", names.map(label), trueOrder);
  const big = Fa.models["SmolLM2-1.7B"].zero_shot.per_class; const worst = Object.keys(big).sort((a, b) => big[a] - big[b])[0];
  const b2 = makeBet("#bet-zs-class", D.data.classes, D.data.classes.indexOf(worst));
  $("#btn-zs-reveal").addEventListener("click", e => { pick.reveal(); b2.reveal(); $("#zs-out").hidden = false; e.target.closest(".panel").querySelector(".veil").remove(); e.target.disabled = true; e.target.textContent = "revealed";
    const cls = D.data.classes; $("#zs-out").innerHTML = `<table class="conf"><thead><tr><th></th><th>accuracy</th>${cls.map(c => `<th>${esc(c)}</th>`).join("")}</tr></thead><tbody>${names.map(n => { const z = Fa.models[n].zero_shot; return `<tr><td style="text-align:left"><b>${esc(label(n))}</b></td><td class="v"><b>${z.accuracy.toFixed(4)}</b></td>${cls.map(c => `<td class="v" style="background:color-mix(in srgb, var(--cls-2) ${Math.round(100 * Math.max(0, (z.per_class[c] - 0.3) / 0.7))}%, transparent)">${z.per_class[c].toFixed(2)}</td>`).join("")}</tr>`; }).join("")}</tbody></table>
      <div class="small-note">the live cell on ${Z.liveN} texts: ${Object.keys(Z.live).map(n => `${esc(n)} ${Z.live[n].accuracy.toFixed(3)}`).join(" · ")} — same ordering, noisier</div>`;
    const g = Fa.models.gpt2.zero_shot, s = Fa.models["SmolLM2-1.7B"].zero_shot;
    $("#zs-note").hidden = false; $("#zs-note").innerHTML = `${names.map(n => `${esc(label(n))} <b>${Fa.models[n].zero_shot.accuracy.toFixed(3)}</b>`).join(" · ")}. Nobody passes TF-IDF's 0.92, and the 1.7B is ${(100 * (s.accuracy - g.accuracy)).toFixed(0)} points above GPT-2 for thirteen times the compute per pass. Read the per-class columns: GPT-2 was at ${g.per_class.Business.toFixed(2)} on <em>Business</em> and ${g.per_class.Sports.toFixed(2)} on <em>Sports</em>; the 1.7B fixes <em>Sports</em> (${s.per_class.Sports.toFixed(2)}) and fails on <em>${esc(worst)}</em> (${big[worst].toFixed(2)}) — the weak class moves with the model, because the prompt and the four words were chosen for GPT-2. A bigger body moves the accuracy; it does not move the cost column.`;
    document.dispatchEvent(new CustomEvent("revealed", { detail: "btn-zs-reveal" })); });
})();
(function encoder() {
  const E = D.encoder; $("#enc-meta").textContent = `${num(E.n_train)} train texts · ${E.epochs} epochs · ${E.device}`;
  $("#enc-out").innerHTML = stat(`<b>${E.accuracy[E.accuracy.length - 1].toFixed(4)}</b>`, "AG News test accuracy") + stat(E.accuracy.map(a => a.toFixed(3)).join(" → "), "by epoch") + stat(human(E.params), "parameters") + stat(`${(E.seconds / 60).toFixed(1)} min`, `to fine-tune on the ${E.device}`) + stat(`${(E.ms_per_1000 / 1000).toFixed(1)} s`, "per 1 000 texts, one pass each");
  $("#enc-config").textContent = Object.entries(E.config).map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join("/") : v}`).join(" · ");
})();
/* the course table */
(function course() {
  const rows = [["1", "TF-IDF, n-grams", "none — counting", "the head (logreg)", "1 pass", "0.92"], ["2", "RNN language model", "next token", "the decoding rule", "T_out passes", "—"], ["3", "transformer encoder–decoder", "conditional next token", "the pair", "T_out passes", "—"], ["4", "BERT encoder", "MLM (+ NSP)", "the head", "1 pass", "0.91 fine-tuned"], ["5", "GPT decoder, 124M", "next token", "the prefix", "candidates or T_out passes", "0.61 zero-shot"], ["6", "the same decoder, 135M → 1.7B", "next token, 15 000 tokens per parameter", "the prefix", "6ND once; 2N_active and a cache per token", `${D.family.artifact.models["SmolLM2-1.7B"].zero_shot.accuracy.toFixed(2)} zero-shot · ${D.encoder.accuracy[1].toFixed(2)} encoder`]];
  $("#course").innerHTML = `<thead><tr>${["week", "body", "pretraining", "where the task lives", "what it costs", "AG News"].map(h => `<th>${h}</th>`).join("")}</tr></thead><tbody>${rows.map(r => `<tr class="${r[0] === "6" ? "now" : ""}">${r.map(c => `<td>${esc(c)}</td>`).join("")}</tr>`).join("")}</tbody>`;
})();
linkCodeAndFormulas();
performance.mark("extra:end");
