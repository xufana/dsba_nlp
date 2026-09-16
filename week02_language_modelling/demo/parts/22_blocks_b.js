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
  else $("#gpt2-out").innerHTML = `<div class="footnote">The GPT-2 block is optional in the notebook (needs <span class="mono">transformers</span> and a 500 MB download).</div>`;
})();
