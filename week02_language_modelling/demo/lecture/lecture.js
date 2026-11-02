/* Lecture 2 — figures and the measured values the questions quote (demo_base/quiz.js renders the questions).
   #lecture-data is artifacts/lecture_data.json (export_lecture_data.py): a subset of the seminar's demo_data. */
(function () {
  const LD = JSON.parse(document.getElementById("lecture-data").textContent);
  const NS = "http://www.w3.org/2000/svg";
  const PAINT = { fill: 1, stroke: 1 };
  function el(tag, attrs, parent, text) {
    const n = document.createElementNS(NS, tag); let style = "";
    for (const k in attrs) { const v = attrs[k]; if (PAINT[k] && typeof v === "string" && v.startsWith("var(")) style += `${k}:${v};`; else n.setAttribute(k, v); }
    if (style) n.setAttribute("style", style);
    if (text != null) n.textContent = text;
    if (parent) parent.appendChild(n);
    return n;
  }
  const svg = (host, w, h) => el("svg", { viewBox: `0 0 ${w} ${h}`, width: "100%", preserveAspectRatio: "xMidYMid meet" }, host);
  const txt = (p, x, y, s, a) => el("text", Object.assign({ x, y, "font-size": 12, fill: "var(--ink)" }, a || {}), p, s);
  const box = (p, x, y, w, h, a) => el("rect", Object.assign({ x, y, width: w, height: h, rx: 3, fill: "var(--panel-sunk)", stroke: "var(--rule-strong)", "stroke-width": 1 }, a || {}), p);
  const arrow = (p, x1, y1, x2, y2, a) => el("path", Object.assign({ d: `M${x1},${y1} L${x2},${y2}`, stroke: "var(--ink-3)", "stroke-width": 1.2, fill: "none", "marker-end": "url(#lec-arr)" }, a || {}), p);
  function defs(s) { const d = el("defs", {}, s); const m = el("marker", { id: "lec-arr", viewBox: "0 0 10 10", refX: 9, refY: 5, markerWidth: 7, markerHeight: 7, orient: "auto" }, d); el("path", { d: "M0,0 L10,5 L0,10 z", fill: "var(--ink-3)" }, m); }
  function pickable(parent, key, x, y, w, h) { const g = el("g", { "data-pick": key }, parent); g.hit = () => el("rect", { class: "hit", x: x - 5, y: y - 5, width: w + 10, height: h + 10, rx: 5 }, g); return g; }

  /* ----------------------------------------------------------------- the measured values the answers quote */
  const pct = x => (100 * x).toFixed(0) + "%";
  const sp = LD.sparsity, wi = n => sp.n.indexOf(n);
  const row = (rows, name) => rows.find(r => r.model === name);
  const neural = LD.results.filter(r => !/gram/.test(r.model));
  const g = LD.gradTime.cells;
  const decay = a => Math.round(a[a.length - 1] / a[0]);
  const lens = Object.keys(LD.bleuByLen);
  Object.assign(QUIZ.values, {
    sparsity_w3: Math.round(100 * sp.words[wi(3)]), sparsity_w3_pct: pct(sp.words[wi(3)]), sparsity_w2_pct: pct(sp.words[wi(2)]), sparsity_w5_pct: pct(sp.words[wi(5)]),
    hapax_pct: pct(LD.corpus.hapax / LD.corpus.nTypes),
    copied3_pct: pct(LD.ngramFirst.copied3), copied5_pct: pct(LD.ngramFirst.copied5),
    add1_3gram_ppl: Math.round(row(LD.smoothingWords, "3-gram, add-1").ppl).toLocaleString("en-US").replace(/,/g, " "),
    unigram_ppl: Math.round(row(LD.smoothingWords, "1-gram").ppl).toLocaleString("en-US").replace(/,/g, " "),
    word_trigram_ppl: Math.round(row(LD.smoothingWords, "3-gram, interpolated").ppl).toLocaleString("en-US").replace(/,/g, " "),
    bpe_trigram_ppl: Math.round(row(LD.smoothingBpe, "3-gram, interpolated").ppl),
    best_rnn_ppl: Math.round(Math.min(...neural.map(r => r.ppl))),
    greedy_lp: LD.decode.find(r => r.method === "greedy").logprob.toFixed(2),
    greedy_rep_pct: pct(LD.decode.find(r => r.method === "greedy").repetition),
    bleu_short: LD.bleuByLen[lens[0]].toFixed(1), bleu_long: LD.bleuByLen[lens[lens.length - 1]].toFixed(1),
    bleu_greedy: LD.beam.greedy.toFixed(1), bleu_beam5: LD.beam.beam5.toFixed(1),
    rnn_decay: decay(g.rnn).toLocaleString("en-US").replace(/,/g, " "), lstm_decay: decay(g.lstm).toLocaleString("en-US").replace(/,/g, " "),
  });

  /* ----------------------------------------------------------------- input row and shifted targets */
  QUIZ.figs.shift = host => {
    const toks = ["[BOS]", "Штирлиц", "открыл", "дверь", "и"], targets = ["Штирлиц", "открыл", "дверь", "и", "[EOS]"];
    const W = 760, H = 150, s = svg(host, W, H); defs(s);
    const x0 = 110, cw = 118, gap = 8;
    txt(s, x0 - 12, 44, "input", { "text-anchor": "end", "font-size": 11, fill: "var(--ink-3)" });
    txt(s, x0 - 12, 118, "target", { "text-anchor": "end", "font-size": 11, fill: "var(--ink-3)" });
    toks.forEach((t, i) => {
      const x = x0 + i * (cw + gap);
      txt(s, x + cw / 2, 16, "position " + i, { "text-anchor": "middle", "font-size": 10, fill: "var(--ink-3)" });
      box(s, x, 28, cw, 26, { fill: i === 2 ? "color-mix(in srgb, var(--cls-0) 18%, var(--panel))" : "var(--panel-sunk)", stroke: i === 2 ? "var(--cls-0)" : "var(--rule-strong)" });
      txt(s, x + cw / 2, 45, t, { "text-anchor": "middle", "font-size": 12.5, "font-family": "var(--mono)" });
      // the shift: input i+1 is target i
      if (i + 1 < toks.length) el("path", { d: `M${x + cw + gap + cw / 2},56 C ${x + cw + gap + cw / 2},80 ${x + cw / 2},78 ${x + cw / 2},100`, stroke: "var(--rule-strong)", "stroke-width": 1, fill: "none", "stroke-dasharray": "3 3" }, s);
      const gp = pickable(s, "y" + i, x, 102, cw, 26);
      box(gp, x, 102, cw, 26, { fill: "var(--panel)" });
      txt(gp, x + cw / 2, 119, targets[i], { "text-anchor": "middle", "font-size": 12.5, "font-family": "var(--mono)" });
      gp.hit();
    });
    txt(s, W / 2, H - 6, "one joke, one forward pass: the loss at position t compares softmax(h_t) with target t", { "text-anchor": "middle", "font-size": 11, fill: "var(--ink-2)" });
  };

  /* ----------------------------------------------------------------- the RNN unrolled, four steps */
  QUIZ.figs["rnn-unrolled"] = host => {
    const W = 760, H = 268, s = svg(host, W, H); defs(s);
    const toks = ["[BOS]", "Штирлиц", "открыл", "дверь"], n = toks.length;
    const x0 = 120, step = 150, yx = 215, yf = 128, yh = 128, yy = 40;
    const gx = pickable(s, "x", x0 - 40, yx - 16, (n - 1) * step + 80, 30);
    const gf = pickable(s, "f", x0 - 40, yf - 22, (n - 1) * step + 80, 44);
    const gh = pickable(s, "h", x0 + 50, yh - 14, (n - 2) * step + 50, 28);
    const gy = pickable(s, "y", x0 - 40, yy - 16, (n - 1) * step + 80, 36);
    // h0
    txt(s, x0 - 84, yh + 4, "h₀ = 0", { "text-anchor": "middle", "font-size": 11.5, fill: "var(--ink-3)" });
    arrow(s, x0 - 50, yh, x0 - 42, yh);
    toks.forEach((t, i) => {
      const x = x0 + i * step;
      // input token
      box(gx, x - 40, yx - 14, 80, 26);
      txt(gx, x, yx + 3, t, { "text-anchor": "middle", "font-size": 12, "font-family": "var(--mono)" });
      txt(gx, x, yx + 26, "x" + (i + 1), { "text-anchor": "middle", "font-size": 10, fill: "var(--ink-3)" });
      arrow(s, x, yx - 16, x, yf + 22);
      // the cell
      box(gf, x - 40, yf - 20, 80, 40, { fill: "var(--panel)", stroke: "var(--cls-0)", "stroke-width": 1.4 });
      txt(gf, x, yf - 2, "f", { "text-anchor": "middle", "font-size": 14, "font-style": "italic" });
      txt(gf, x, yf + 13, "same weights", { "text-anchor": "middle", "font-size": 8.5, fill: "var(--ink-3)" });
      // state to the next cell
      if (i + 1 < n) {
        arrow(gh, x + 42, yh, x + step - 42, yh);
        txt(gh, x + step / 2, yh - 8, "h" + (i + 1), { "text-anchor": "middle", "font-size": 11.5 });
      }
      // output
      arrow(s, x, yf - 22, x, yy + 20);
      txt(s, x + 8, yf - 32, "softmax(W h)", { "font-size": 8.5, fill: "var(--ink-3)" });
      const bars = [[.1, .6, .2, .3], [.5, .15, .25, .1], [.2, .55, .1, .3], [.15, .2, .5, .1]][i];
      bars.forEach((p, k) => el("rect", { x: x - 30 + k * 16, y: yy + 12 - 28 * p, width: 12, height: 28 * p, fill: k === [1, 0, 1, 2][i] ? "var(--cls-1)" : "var(--rule-strong)" }, gy));
      txt(gy, x, yy - 22, "P(w" + (i + 2) + " | prefix)", { "text-anchor": "middle", "font-size": 10.5 });
    });
    [gx, gf, gh, gy].forEach(gg => gg.hit());
    txt(s, W / 2, H - 4, "unrolled over four tokens: one row of inputs, one row of states, one distribution per position", { "text-anchor": "middle", "font-size": 11, fill: "var(--ink-2)" });
  };
})();
