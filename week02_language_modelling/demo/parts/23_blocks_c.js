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
      `</tbody></table></div><div class="footnote" style="margin-top:10px">On all 1 000 test sentences: greedy ${D.s2sBleu.greedy.toFixed(2)}, beam-5 ${D.s2sBleu.beam5.toFixed(2)}.</div>`;
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
