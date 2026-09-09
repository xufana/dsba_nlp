/* ================================================================ 00 hero */
$("#michael-img").src = D.michael;

/* ================================================================ 00 data */
(function () {
  const C = D.corpus;
  $("#data-split").textContent = `train ${num(C.nTrain)} · val ${num(C.nVal)} · test ${num(C.nTest)}`;
  $("#data-stats").innerHTML = [
    [num(C.nTrain), "training jokes"], [num(C.charsTrain), "characters in train"],
    [Math.round(C.median), "median characters"], [Math.round(C.p95), "95th percentile"],
  ].map(([v, k]) => `<div class="stat"><span class="v">${v}</span><span class="k">${k}</span></div>`).join("");
  $("#data-examples").innerHTML = C.examples.map(j => `<div class="gen">${esc(j)}</div>`).join("");

  function lenChart() {
    const host = $("#len-chart"); host.innerHTML = "";
    const W = 480, H = 280, L = 56, R = 12, T = 14, B = 46, fs = 13.5;
    const s = svg(W, H), cnt = C.lenHist.counts, ed = C.lenHist.edges, mx = Math.max(...cnt);
    const X = v => L + v / 600 * (W - L - R), Y = v => H - B - v / mx * (H - T - B);
    linTicks(0, mx, 4).forEach(v => {
      s.appendChild(el("line", { class: "gridline", x1: L, x2: W - R, y1: Y(v), y2: Y(v), stroke: css("--rule") }));
      s.appendChild(el("text", { x: L - 6, y: Y(v) + 4, "font-size": fs, "text-anchor": "end", fill: css("--ink-3") }, tickFmt(v)));
    });
    cnt.forEach((c, i) => {
      const r = el("rect", { x: X(ed[i]) + .5, y: Y(c), width: X(ed[i + 1]) - X(ed[i]) - 1, height: H - B - Y(c), fill: css("--cls-0"), opacity: .85 });
      tipOn(r, `${Math.round(ed[i])}–${Math.round(ed[i + 1])} characters<br>${num(c)} jokes`);
      s.appendChild(r);
    });
    [0, 100, 200, 300, 400, 500, 600].forEach(v => s.appendChild(el("text", { x: X(v), y: H - B + fs + 6, "font-size": fs, "text-anchor": "middle", fill: css("--ink-3") }, v)));
    s.appendChild(el("line", { x1: X(C.median), x2: X(C.median), y1: T, y2: H - B, stroke: css("--ink"), "stroke-dasharray": "5 4" }));
    s.appendChild(el("text", { x: X(C.median) + 6, y: T + fs, "font-size": fs, fill: css("--ink-2") }, `median ${Math.round(C.median)}`));
    s.appendChild(el("text", { x: (L + W) / 2, y: H - 6, "font-size": fs, "text-anchor": "middle", fill: css("--ink-2") }, "characters per joke"));
    host.appendChild(s);
  }
  function zipfChart() {
    lineChart($("#zipf-chart"), {
      W: 480, H: 280, L: 70, B: 48, fs: 13.5, xlog: true, ylog: true, legend: false,
      series: [{ x: C.zipf.map(p => p[0]), y: C.zipf.map(p => p[1]), color: css("--cls-0"), dots: false }],
      xlabel: "rank of the word", ylabel: "frequency", xfmt: tickFmt, yfmt: tickFmt,
    });
  }
  REDRAW.push(lenChart, zipfChart); lenChart(); zipfChart();

  $("#bet-hapax").addEventListener("input", e => { $("#bet-hapax-v").textContent = e.target.value; });
  $("#btn-zipf-reveal").addEventListener("click", () => {
    const guess = +$("#bet-hapax").value / 100, real = C.hapax / C.nTypes;
    $("#zipf-stats").hidden = false; $("#zipf-note").hidden = false;
    $("#zipf-stats").innerHTML = `<div class="stat-row">
      <div class="stat"><span class="v">${num(C.nTokens)}</span><span class="k">word occurrences</span></div>
      <div class="stat"><span class="v">${num(C.nTypes)}</span><span class="k">distinct words</span></div>
      <div class="stat"><span class="v">${pct(real)}</span><span class="k">seen exactly once · you said ${pct(guess)}</span></div></div>
      <div class="footnote" style="margin-top:12px">most common: ${C.topWords.map(w => `<span class="tok">${esc(w)}</span>`).join("")}</div>`;
  });
})();

/* ================================================================= 01 bpe */
(function () {
  const TOYN = D.bpeToy.nJokes, TARGET = D.bpeToy.merges.length;
  const eow = s => esc(s).replace(/&lt;\/w&gt;/g, '<span class="eow">&lt;/w&gt;</span>');
  const betMerge = makeBet("#bet-merge", ["с + т", "п + о", "а + end-of-word", "н + е", "о + end-of-word"], 2);
  let wf = null, merges = [], counts = [], timer = 0;

  const SEP = "\u0001";
  function reset() {
    wf = new Map();                                   // key -> {sym: [...], f}
    for (const j of D.jokesSample.slice(0, TOYN)) for (const w of tokenizeWords(j)) {
      const sym = Array.from(w).concat("</w>"), k = sym.join(SEP), e = wf.get(k);
      if (e) e.f++; else wf.set(k, { sym, f: 1 });
    }
    merges = []; counts = []; paint();
    $("#bpe-encode").hidden = true; $("#bpe-note").hidden = true;
  }
  function oneMerge() {
    if (merges.length >= TARGET) return false;
    const pairs = new Map();
    for (const { sym, f } of wf.values())
      for (let i = 0; i + 1 < sym.length; i++) { const p = sym[i] + SEP + sym[i + 1]; pairs.set(p, (pairs.get(p) || 0) + f); }
    let best = null, bc = -1;
    for (const [p, c] of pairs) if (c > bc) { bc = c; best = p; }
    if (!best) return false;
    const [a, b] = best.split(SEP), nwf = new Map();
    for (const { sym, f } of wf.values()) {
      const out = [];
      for (let i = 0; i < sym.length; i++) {
        if (i + 1 < sym.length && sym[i] === a && sym[i + 1] === b) { out.push(a + b); i++; } else out.push(sym[i]);
      }
      const nk = out.join(SEP), e = nwf.get(nk);
      if (e) e.f += f; else nwf.set(nk, { sym: out, f });
    }
    wf = nwf; merges.push([a, b]); counts.push(bc);
    return true;
  }
  function paint() {
    $("#bpe-progress").textContent = `${merges.length} / ${TARGET} merges`;
    const SHOW = 12, rows = merges.slice(0, SHOW).map((m, i) => row(i, m, counts[i], i === merges.length - 1));
    const later = merges.length > SHOW ? [merges.length - 1].map(i => row(i, merges[i], counts[i], true)) : [];
    const words = merges.length > 30 ? merges.map((m, i) => [m, i]).filter(([m]) => !m[0].includes("</w>") && m[1] === "</w>" && m[0].length >= 2).slice(0, 14) : [];
    $("#bpe-merges").innerHTML = (merges.length ? "" : `<div class="footnote">Nothing merged yet. Place your bet, then press <em>Train</em>.</div>`) +
      rows.join("") + (later.length ? `<div class="merge-row"><span class="n">…</span><span></span><span></span></div>` + later.join("") : "") +
      (words.length ? `<div class="footnote" style="margin-top:12px">whole words so far: ${words.map(([m, i]) => `<span class="tok" title="merge ${i + 1}">${eow(m[0])}</span>`).join("")}</div>` : "");
    if (merges.length >= TARGET) { $("#bpe-encode").hidden = false; $("#bpe-note").hidden = false; encodeWord(); }
  }
  const row = (i, m, c, isNew) => `<div class="merge-row"><span class="n">${i + 1}</span>
    <span class="p"><span class="tok">${eow(m[0])}</span> + <span class="tok">${eow(m[1])}</span> → <span class="tok${isNew ? " new" : ""}">${eow(m[0] + m[1])}</span></span>
    <span class="c">seen ${num(c)}×</span></div>`;

  function run() {
    if (timer) return;
    if (!merges.length) betMerge.reveal(firstMergeAnswer());
    const t0 = performance.now();
    const tick = () => {
      let k = 0;
      while (k++ < 8 && oneMerge()) { }
      paint();
      if (merges.length < TARGET) timer = requestAnimationFrame(tick);
      else { timer = 0; $("#bpe-progress").textContent += ` · ${((performance.now() - t0) / 1000).toFixed(1)}s in your browser (${D.bpeToy.seconds}s in Python)`; }
    };
    timer = requestAnimationFrame(tick);
  }
  function firstMergeAnswer() {
    const m = D.bpeToy.merges[0];
    const opts = [["с", "т"], ["п", "о"], ["а", "</w>"], ["н", "е"], ["о", "</w>"]];
    const i = opts.findIndex(o => o[0] === m[0] && o[1] === m[1]);
    return i < 0 ? -1 : i;
  }
  window.__demo = Object.assign(window.__demo || {}, { toyMerges: () => merges });
  $("#btn-bpe-train").addEventListener("click", run);
  $("#btn-bpe-step").addEventListener("click", () => { if (timer) return; if (!merges.length) betMerge.reveal(firstMergeAnswer()); oneMerge(); paint(); });
  $("#btn-bpe-reset").addEventListener("click", () => { if (timer) { cancelAnimationFrame(timer); timer = 0; } reset(); });

  function bpeEncodeToy(word) {
    let pieces = Array.from(word).concat("</w>");
    for (const [a, b] of merges) {
      let j = 0;
      while (j < pieces.length - 1) {
        if (pieces[j] === a && pieces[j + 1] === b) pieces.splice(j, 2, a + b); else j++;
      }
    }
    return pieces;
  }
  function encodeWord() {
    const w = tokenizeWords($("#bpe-word").value)[0] || "";
    const pieces = w ? bpeEncodeToy(w) : [];
    $("#bpe-word-out").innerHTML = pieces.map(p => `<span class="tok">${eow(p)}</span>`).join("") + (w ? ` <span class="mono" style="color:var(--ink-3);font-size:14px">${pieces.length} pieces</span>` : "");
  }
  $("#bpe-word").addEventListener("input", encodeWord);
  $("#bpe-word-presets").innerHTML = D.bpeToy.words.map(w => `<button data-w="${esc(w.w)}" style="font-size:15px">${esc(w.w)}</button>`).join("");
  $("#bpe-word-presets").addEventListener("click", e => { const b = e.target.closest("button"); if (!b) return; $("#bpe-word").value = b.dataset.w; encodeWord(); });
  reset();

  /* the library tokenizer, 8k */
  $("#tok-stats").textContent = `${num(TOK.vocab.length)} tokens · ${num(D.tokenizer.merges.length)} merges · trained in ${D.bpeLib.seconds}s`;
  const presets = [D.bpeLib.text, "Штирлиц выстрелил в упор.", "Заходит мужик в бар", "Инквизиция, программист и Дарвин"];
  $("#tok-presets").innerHTML = presets.map((p, i) => `<button data-p="${i}" style="font-size:15px">${esc(p.length > 42 ? p.slice(0, 40) + "…" : p)}</button>`).join("");
  $("#tok-presets").addEventListener("click", e => { const b = e.target.closest("button"); if (!b) return; $("#tok-input").value = presets[+b.dataset.p]; tokRender(); });
  function tokRender() {
    const text = $("#tok-input").value, ids = TOK.encode(text), back = TOK.decode(ids);
    const words = tokenizeWords(text).length;
    $("#tok-out").innerHTML = ids.map(i => `<span class="tok${i === TOK.UNK ? " diff" : ""}" title="id ${i}">${esc(TOK.vocab[i]).replace(/\n/g, "⏎")}</span>`).join("") +
      `<div class="mono" style="font-size:14.5px;color:var(--ink-2);margin-top:8px">${ids.length} tokens · ${words} words · ${text.length} characters · ${(ids.length / Math.max(1, words)).toFixed(2)} tokens/word · round trip ${back === text ? "identical" : "<span style='color:var(--bad)'>differs</span>"}</div>`;
  }
  $("#tok-input").value = presets[0];
  $("#tok-input").addEventListener("input", tokRender);
  tokRender();

  /* the dial */
  const DL = D.dial, ratio = DL.rows.find(r => r.vocab === 1000).tokPerJoke / DL.rows.find(r => r.vocab === 32000).tokPerJoke;
  const betDial = makeBet("#bet-dial", ["under 2×", "2–3×", "3–5×", "over 5×"], ratio < 2 ? 0 : ratio < 3 ? 1 : ratio < 5 ? 2 : 3);
  function dialChart() {
    lineChart($("#dial-chart"), {
      W: 520, H: 300, L: 60, B: 52, fs: 13.5, xlog: true, ymin: 0, ymax: 120, legend: true, legendX: 300, legendY: 14,
      series: [{ x: DL.rows.map(r => r.vocab), y: DL.rows.map(r => r.tokPerJoke), color: css("--cls-0"), label: "BPE", tip: (x, y) => `vocabulary ${num(x)}<br>${y.toFixed(1)} tokens per joke` }],
      hlines: [{ y: DL.wordsPerJoke, label: `words · ${DL.wordsPerJoke.toFixed(1)}`, color: css("--ink-3") }, { y: DL.charsPerJoke, label: `characters · ${DL.charsPerJoke.toFixed(0)}`, color: css("--ink-3") }],
      xlabel: "BPE vocabulary size", ylabel: "tokens per joke", xticks: [500, 1000, 2000, 4000, 8000, 16000, 32000], xfmt: v => v >= 1000 ? (v / 1000) + "k" : v,
    });
  }
  $("#btn-dial-reveal").addEventListener("click", () => {
    betDial.reveal();
    $("#dial-out").hidden = false; $("#dial-note").hidden = false;
    dialChart(); REDRAW.push(dialChart);
    $("#dial-table").innerHTML = `<thead><tr><th>vocab</th><th class="num">tokens / joke</th><th class="num">tokens / word</th><th class="num">chars / token</th><th class="num">fit s</th></tr></thead><tbody>` +
      DL.rows.map(r => `<tr><td class="mono">${num(r.vocab)}</td><td class="num">${r.tokPerJoke.toFixed(1)}</td><td class="num">${r.tokPerWord.toFixed(2)}</td><td class="num">${r.charsPerTok.toFixed(2)}</td><td class="num">${r.fitS}</td></tr>`).join("") +
      `<tr><td class="mono">chars</td><td class="num">${DL.charsPerJoke.toFixed(1)}</td><td class="num">${(1 / DL.charsPerWord * DL.charsPerWord * DL.charsPerJoke / DL.wordsPerJoke).toFixed(2)}</td><td class="num">1.00</td><td class="num">0</td></tr>
       <tr><td class="mono">words (${num(DL.nWordTypes)})</td><td class="num">${DL.wordsPerJoke.toFixed(1)}</td><td class="num">1.00</td><td class="num">${DL.charsPerWord.toFixed(2)}</td><td class="num">0 · OOV ${pct(DL.oovWords, 1)}</td></tr></tbody>`;
    const r8 = DL.rows.find(r => r.vocab === 8000);
    $("#dial-note").innerHTML = `A 32 000-token vocabulary is <strong>not</strong> four times more efficient than an 8 000 one: 1 000 → 32 000 shortens the average joke by ×${ratio.toFixed(2)}, and the curve keeps flattening. The frequent words were already single tokens at 8 000; the extra 24 000 slots go to rare words that barely appear, and every one of those embedding rows will be trained on a handful of examples. At 8 000 tokens a joke costs ${r8.tokPerWord.toFixed(2)} tokens per word — compare last week's <span class="mono">tiktoken</span> experiment: a tokenizer trained <em>on Russian</em> pays far less for Russian than one trained mostly on English. A word vocabulary has ${pct(DL.oovWords, 1)} of test tokens out of vocabulary; BPE has exactly zero, at any size. We use <strong>8 000</strong> for the rest of the day — not because it is optimal, but because the perplexities below are only comparable if every neural model shares one tokenizer.`;
  });
})();

/* =============================================================== 02 ngram */
const NG = {
  built: false, maxN: 5, counts: null, totals: null, joined: null,
  build() {
    if (this.built) return;
    const t0 = performance.now();
    this.counts = []; this.totals = [];
    for (let n = 1; n <= this.maxN; n++) { this.counts[n] = new Map(); this.totals[n] = new Map(); }
    const docs = [];
    for (const j of D.jokesSample) {
      const toks = tokenizeWords(j); docs.push(toks.join(" "));
      for (let n = 1; n <= this.maxN; n++) {
        const padded = new Array(n - 1).fill("[BOS]").concat(toks, ["[EOS]"]);
        const C = this.counts[n], Tt = this.totals[n];
        for (let i = n - 1; i < padded.length; i++) {
          const key = padded.slice(i - n + 1, i).join(""), nxt = padded[i];
          let m = C.get(key); if (!m) { m = new Map(); C.set(key, m); }
          m.set(nxt, (m.get(nxt) || 0) + 1);
          Tt.set(key, (Tt.get(key) || 0) + 1);
        }
      }
    }
    this.joined = "\n" + docs.join("\n") + "\n";
    this.built = true; this.buildMs = performance.now() - t0;
  },
  next(prefix, n) {
    const p = n > 1 ? new Array(n - 1).fill("[BOS]").concat(prefix).slice(-(n - 1)) : [];
    return this.counts[n].get(p.join("")) || null;
  },
  generate(prefix, n, seed, maxLen) {
    const rng = mulberry32(seed + 1), toks = prefix.slice();
    let dead = false;
    for (let k = 0; k < (maxLen || 60); k++) {
      const dist = this.next(toks, n);
      if (!dist) { dead = true; break; }
      let total = 0; for (const c of dist.values()) total += c;
      let r = rng() * total, pick = null;
      for (const [t, c] of dist) { r -= c; if (r <= 0) { pick = t; break; } }
      if (pick === null) pick = Array.from(dist.keys()).pop();
      if (pick === "[EOS]") break;
      toks.push(pick);
    }
    return { toks, dead };
  },
  /* longest window of the generated tokens found verbatim in the shipped training jokes */
  longestCopied(toks) {
    for (let k = Math.min(toks.length, 24); k >= 3; k--) {
      for (let i = 0; i + k <= toks.length; i++) {
        const w = toks.slice(i, i + k).join(" ");
        const at = this.joined.indexOf(w);
        if (at >= 0 && /[\s]/.test(this.joined[at - 1]) && /[\s]/.test(this.joined[at + w.length] || " ")) return { i, k };
      }
    }
    return null;
  },
};
(function () {
  const F = D.ngramFirst;
  $("#ng-nb-stats").textContent = `${num(F.bigramPrefixes)} bigram prefixes · ${num(F.trigramPrefixes)} trigram prefixes`;
  $("#ng-nb-3").innerHTML = F.samples3.map(s => `<div class="gen">${esc(s)}</div>`).join("");
  $("#ng-nb-5").innerHTML = F.samples5.map(s => `<div class="gen">${esc(s)}</div>`).join("");
  $("#ng-nb-copied").innerHTML = [[pct(F.copied3), "3-gram samples with an 8-word run copied verbatim from training"], [pct(F.copied5), "5-gram samples with an 8-word run copied verbatim"]]
    .map(([v, k]) => `<div class="stat"><span class="v">${v}</span><span class="k">${k}</span></div>`).join("");
  ["n", "seed"].forEach(k => $(`#ng-${k}`).addEventListener("input", e => { $(`#ng-${k}-v`).textContent = e.target.value; }));
  $("#btn-ng-gen").addEventListener("click", () => {
    const btn = $("#btn-ng-gen");
    if (!NG.built) { $("#ng-status").textContent = "counting 1..5-grams …"; btn.disabled = true; }
    setTimeout(() => {
      NG.build();
      $("#ng-status").textContent = `${num(D.jokesSample.length)} jokes · counted in ${(NG.buildMs / 1000).toFixed(1)}s`;
      btn.disabled = false;
      const n = +$("#ng-n").value, seed = +$("#ng-seed").value, prefix = tokenizeWords($("#ng-prefix").value);
      const outs = [];
      for (let s = 0; s < 3; s++) {
        const g = NG.generate(prefix, n, seed * 3 + s), cp = NG.longestCopied(g.toks);
        outs.push(`<div class="gen">` + g.toks.map((t, i) => `<span class="t${cp && i >= cp.i && i < cp.i + cp.k ? " copied" : ""}${i < prefix.length ? " prompt" : ""}">${esc(t)}</span>`).join(" ") +
          (g.dead ? ` <span class="dead" title="a prefix that never occurred in training: the raw model has no distribution to sample from">⟂ dead end</span>` : "") + `</div>`);
      }
      $("#ng-out").innerHTML = outs.join("");
      $("#ng-copied").innerHTML = `n = ${n}, seeds ${seed * 3}–${seed * 3 + 2}. Orange: the longest run that occurs verbatim in the 8 000 training jokes counted here. A <span class="dead">⟂</span> is a dead end — a prefix that never occurred, so the unsmoothed model has nothing to sample from; that is the zero we fix in block 03.`;
    }, 20);
  });
})();

/* ============================================================== 03 smooth */
(function () {
  const F = D.ngramFirst, S = D.smoothing, SP = D.sparsity;
  $("#btn-ppl-reveal").addEventListener("click", () => {
    const guess = $("#bet-ppl").value.trim();
    $("#ppl-out").hidden = false; $("#ppl-note").hidden = false; $("#sparsity-panel").hidden = false;
    $("#ppl-out").innerHTML = `<div class="stat-row">
      <div class="stat"><span class="v">${F.rawTrigramPpl === "inf" ? "∞" : fmt(F.rawTrigramPpl, 1)}</span><span class="k">test perplexity · trigram, no smoothing</span></div>
      <div class="stat"><span class="v">${guess ? esc(guess) : "—"}</span><span class="k">your bet</span></div></div>`;
    sparsityChart(); REDRAW.push(sparsityChart);
  });
  function sparsityChart() {
    lineChart($("#sparsity-chart"), {
      W: 1000, H: 330, L: 70, fs: 14.5, ymin: 0, ymax: 1, xmin: 1, xmax: 5, xticks: [1, 2, 3, 4, 5], yfmt: v => pct(v),
      series: [
        { x: SP.n, y: SP.words, color: css("--cls-1"), label: "words", tip: (x, y) => `${x}-grams, words<br>${pct(y, 1)} of test n-grams unseen` },
        { x: SP.n, y: SP.bpe, color: css("--cls-0"), label: "BPE, 8 000 tokens", tip: (x, y) => `${x}-grams, BPE<br>${pct(y, 1)} of test n-grams unseen` },
      ],
      xlabel: "n", ylabel: "share of test n-grams never seen in training",
    });
  }

  /* the three smoothing bets */
  const rows = S.words, best = rows.reduce((a, b) => a.ppl < b.ppl ? a : b);
  const bestSingle = rows.filter(r => !r.interp).reduce((a, b) => a.ppl < b.ppl ? a : b);
  const bestInterp = rows.filter(r => r.interp).reduce((a, b) => a.ppl < b.ppl ? a : b);
  const bN = makeBet("#bet-sm-n", ["n = 2", "n = 3", "n = 5"], { 2: 0, 3: 1, 5: 2 }[best.n]);
  const add1 = rows.find(r => r.model === "3-gram, add-1").ppl, add001 = rows.find(r => r.model === "3-gram, add-0.01").ppl;
  const bD = makeBet("#bet-sm-delta", ["δ = 1 is better", "δ = 0.01 is better", "about the same"], add1 < add001 * 0.9 ? 0 : add001 < add1 * 0.9 ? 1 : 2);
  const bI = makeBet("#bet-sm-interp", ["yes, interpolation wins", "no, the best single order wins"], bestInterp.ppl < bestSingle.ppl ? 0 : 1);
  const arm = () => { $("#btn-smooth-reveal").disabled = !(bN.pick !== null && bD.pick !== null && bI.pick !== null); };
  ["#bet-sm-n", "#bet-sm-delta", "#bet-sm-interp"].forEach(id => $(id).addEventListener("bet", arm));
  $("#btn-smooth-reveal").addEventListener("click", () => {
    const hits = [bN.reveal(), bD.reveal(), bI.reveal()].filter(Boolean).length;
    $("#smooth-score").textContent = `${hits} / 3 right`;
    $("#btn-smooth-reveal").disabled = true;
    $("#smooth-out").hidden = false; $("#smooth-note").hidden = false;
    $("#smooth-out").innerHTML = `<div class="scroll-x"><table><thead><tr><th>model</th><th class="num">test_ppl</th><th class="num">bits/char</th><th class="num">eval s</th></tr></thead><tbody>` +
      rows.map(r => `<tr${r === best ? ' style="font-weight:600"' : ""}><td class="mono">${esc(r.model)}</td><td class="num">${fmt(r.ppl, 1)}</td><td class="num">${fmt(r.bpc, 3)}</td><td class="num">${r.evalS}</td></tr>`).join("") + `</tbody></table></div>`;
    $("#smooth-note").innerHTML = `<strong>Add-1 is a disaster</strong> and gets worse with n: the trigram with δ = 1 (${fmt(add1, 0)}) is worse than the unigram (${fmt(rows[0].ppl, 0)}). ${num(D.dial.nWordTypes)} imaginary observations per prefix flatten every distribution toward uniform. Add-0.01 is far better — the smoothing constant is a hyperparameter, and the textbook value of 1 is the wrong one on any realistic vocabulary. <strong>Interpolation wins</strong> (${esc(bestInterp.model)}, ${fmt(bestInterp.ppl, 0)}), by letting the model fall back gracefully: when the trigram has never seen the prefix, the bigram usually has. <strong>The 5-gram does not win</strong>, even interpolated (${fmt(rows.find(r => r.n === 5).ppl, 0)}): the 4- and 5-gram counts are almost all ones — look at the sparsity plot again. More context is only useful if you have the data to estimate it, and we have two million words. This is the ceiling of counting.`;
  });

  /* the number that lies */
  const wi = rows.filter(r => r.interp), bi = S.bpe;
  const tbl = (title, rs) => `<div><div class="eyebrow" style="margin-bottom:6px">${title}</div><div class="scroll-x"><table><thead><tr><th>model</th><th class="num">test_ppl</th><th class="num">bits/char</th></tr></thead><tbody>` +
    rs.map(r => `<tr><td class="mono">${esc(r.model)}</td><td class="num">${fmt(r.ppl, 1)}</td><td class="num">${fmt(r.bpc, 3)}</td></tr>`).join("") + `</tbody></table></div></div>`;
  $("#lies-out").innerHTML = tbl("words · 692 177 tokens counted", wi) + tbl(`BPE 8k · ${num(S.nBpeTokens)} tokens counted`, bi);
})();
