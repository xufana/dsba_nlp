/* Lecture 1 — figures and browser-computed values for the questions (demo_base/quiz.js renders the questions).
   #lecture-data is artifacts/lecture_data.json (export_lecture_data.py): the four toy documents, the OOV table. */
(function () {
  const LD = JSON.parse(document.getElementById("lecture-data").textContent);
  const $ = (s, r) => (r || document).querySelector(s);
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
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
  const arrow = (p, x1, y1, x2, y2) => el("path", { d: `M${x1},${y1} L${x2},${y2}`, stroke: "var(--ink-3)", "stroke-width": 1.2, fill: "none", "marker-end": "url(#lec-arr)" }, p);
  function defs(s) { const d = el("defs", {}, s); const m = el("marker", { id: "lec-arr", viewBox: "0 0 10 10", refX: 9, refY: 5, markerWidth: 7, markerHeight: 7, orient: "auto" }, d); el("path", { d: "M0,0 L10,5 L0,10 z", fill: "var(--ink-3)" }, m); }
  /* a clickable part of a `point` figure: the group carries data-pick, its last child is the hit rect quiz.js styles */
  function pickable(parent, key, x, y, w, h) { const g = el("g", { "data-pick": key }, parent); g.hit = () => el("rect", { class: "hit", x: x - 5, y: y - 5, width: w + 10, height: h + 10, rx: 5 }, g); return g; }

  /* ------------------------------------------ tf-idf on four toy documents */
  const TOKPAT = /[A-Za-z0-9_À-ɏЀ-ӿ]{2,}/g;
  const analyze = t => String(t).toLowerCase().match(TOKPAT) || [];
  /* the textbook tf-idf: tf = count / |d|, idf = ln(|D| / df), then each row to unit length */
  function vectorize(docs) {
    const analyzed = docs.map(analyze);
    const vocab = Array.from(new Set(analyzed.flat())).sort();
    const idx = new Map(vocab.map((w, i) => [w, i]));
    const counts = analyzed.map(toks => { const r = new Float64Array(vocab.length); toks.forEach(t => r[idx.get(t)]++); return r; });
    const lens = analyzed.map(t => t.length);
    const n = docs.length;
    const df = vocab.map((_, j) => counts.reduce((a, r) => a + (r[j] > 0 ? 1 : 0), 0));
    const idf = df.map(d => Math.log(n / d));
    const tf = counts.map((r, i) => r.map(v => v / lens[i]));
    const raw = tf.map(r => r.map((v, j) => v * idf[j]));
    const norms = raw.map(r => Math.hypot(...r) || 1);
    const l2 = raw.map((r, i) => r.map(v => v / norms[i]));
    return { vocab, counts, lens, df, idf, tf, raw, l2, norms, n };
  }
  const V = vectorize(LD.toy);
  const jRise = V.vocab.indexOf("rise"), jThe = V.vocab.indexOf("the");
  Object.assign(QUIZ.values, {
    idf_rise: V.idf[jRise], w_rise_d0: V.l2[0][jRise], norm_d0: V.norms[0], raw_rise_d0: V.raw[0][jRise], w_the_d2: jThe >= 0 ? V.l2[2][jThe] : null,
    vocab_size: LD.vocabSize.toLocaleString("en-US").replace(/,/g, " "),
    oov_rate_pct: (100 * LD.oovRate).toFixed(2) + "%", oov_example: LD.oovExamples[2] || LD.oovExamples[0],
  });
  LD.oov.forEach(r => {
    QUIZ.values["ng_" + r.w] = r.ngramsSeen; QUIZ.values["ng_total_" + r.w] = r.ngramsTotal;
    QUIZ.values["bpe_" + r.w] = r.bpe.join(" · "); QUIZ.values["ft_" + r.w] = r.ftN; QUIZ.values["stem_" + r.w] = r.stem;
  });

  /* the same corpus with `prices` written twice in d0 — the row before and after */
  const toy2 = LD.toy.slice(); toy2[0] = toy2[0].replace("prices", "prices prices");
  const V2 = vectorize(toy2);
  const col = (VV, w) => VV.vocab.indexOf(w);
  ["prices", "rise", "oil"].forEach(w => {
    QUIZ.values[`w_${w}_1`] = V.l2[0][col(V, w)];
    QUIZ.values[`w_${w}_2`] = V2.l2[0][col(V2, w)];
  });
  QUIZ.figs["tfidf-twice"] = host => {
    const words = V.vocab.filter(w => V.counts[0][col(V, w)] > 0);
    const cell = (VV, w) => VV.l2[0][col(VV, w)];
    const row = (label, VV) => `<tr><td class="mono" style="white-space:nowrap">${esc(label)}</td>${words.map(w => {
      const v = cell(VV, w), d = VV === V2 ? v - cell(V, w) : 0;
      return `<td class="num">${v.toFixed(3)}${VV === V2 && Math.abs(d) > 1e-9 ? ` <span style="color:var(${d > 0 ? "--good" : "--bad"});font-size:.85em">${d > 0 ? "▲" : "▼"}</span>` : ""}</td>`;
    }).join("")}</tr>`;
    host.innerHTML = `<div class="scroll-x"><table class="lec-matrix" style="width:auto"><thead><tr><th>d0</th>${words.map(w => `<th class="num data-th">${esc(w)}</th>`).join("")}</tr></thead><tbody>
      ${row(LD.toy[0], V)}${row(toy2[0], V2)}</tbody></table></div>`;
  };

  /* ------------------------------------------------------------- stemming vs lemmatization, computed by nltk in the export */
  QUIZ.figs["norm-table"] = host => {
    const merged = new Set(LD.normEn.map(r => r.stem).filter((st, i, a) => a.indexOf(st) !== i));
    const ru = LD.normRu.map(g => `<tr><td class="mono">${g.map(r => esc(r.w)).join(", ")}</td><td class="mono" colspan="3">${g.map(r => esc(r.stem)).join(", ")}${new Set(g.map(r => r.stem)).size === 1 ? ' <span style="color:var(--good)">· one stem</span>' : ' <span style="color:var(--bad)">· ' + new Set(g.map(r => r.stem)).size + ' different stems</span>'}</td></tr>`).join("");
    host.innerHTML = `<div class="scroll-x"><table class="lec-norm"><thead><tr><th>word</th><th>Porter stem</th><th>lemma (with POS)</th><th>lemma, no POS</th></tr></thead><tbody>` +
      LD.normEn.map(r => `<tr><td class="mono">${esc(r.w)}</td><td class="mono"${merged.has(r.stem) ? ' style="color:var(--bad)"' : ""}>${esc(r.stem)}</td><td class="mono">${esc(r.lemma)}</td><td class="mono"${r.lemmaNoPos !== r.lemma ? ' style="color:var(--bad)"' : ""}>${esc(r.lemmaNoPos)}</td></tr>`).join("") +
      `<tr><th colspan="4" style="padding-top:14px">Russian · Snowball stemmer</th></tr>` + ru + `</tbody></table></div>`;
  };

  QUIZ.figs["tfidf-matrix"] = host => {
    const maxV = Math.max(...V.l2.flatMap(r => Array.from(r)));
    host.innerHTML = `<div class="lec-docs mono">${LD.toy.map((d, i) => `<span><b>d${i}</b> ${esc(d)}</span>`).join("")}</div>
      <div class="scroll-x"><table class="lec-matrix"><thead><tr><th></th>${V.vocab.map(w => `<th class="num data-th">${esc(w)}</th>`).join("")}<th class="num">‖row‖</th></tr></thead><tbody>` +
      V.l2.map((r, i) => `<tr><td class="mono" style="color:var(--ink-3)">d${i}</td>` +
        Array.from(r).map((v, j) => `<td class="num cell" data-i="${i}" data-j="${j}" style="background:color-mix(in srgb, var(--seq-3) ${Math.round(v / maxV * 34)}%, transparent);${v === 0 ? "color:var(--ink-3)" : ""}">${v ? v.toFixed(3) : "0"}</td>`).join("") +
        `<td class="num" style="color:var(--ink-2)">${Math.hypot(...r).toFixed(3)}</td></tr>`).join("") + `</tbody></table></div>
      <div class="lec-trace mono" id="lec-trace">click a cell</div>`;
    const dims = $("#matrix-dims"); if (dims) dims.textContent = `${V.n} documents · ${V.vocab.length} columns`;
    host.addEventListener("click", e => {
      const c = e.target.closest("td.cell"); if (!c) return;
      host.querySelectorAll("td.cell.on").forEach(x => x.classList.remove("on")); c.classList.add("on");
      const i = +c.dataset.i, j = +c.dataset.j, w = V.vocab[j], cnt = V.counts[i][j];
      $("#lec-trace").innerHTML = cnt === 0
        ? `(d${i}, <b>${esc(w)}</b>): count 0 — <b>${esc(w)}</b> is not in d${i}, so the cell is 0 whatever the idf is`
        : `(d${i}, <b>${esc(w)}</b>): tf = ${cnt}/${V.lens[i]} = <b>${V.tf[i][j].toFixed(3)}</b> &nbsp;×&nbsp; idf = ln(${V.n}/${V.df[j]}) = <b>${V.idf[j].toFixed(3)}</b> &nbsp;→&nbsp; ${V.raw[i][j].toFixed(3)} &nbsp;÷&nbsp; ‖d${i}‖ = ${V.norms[i].toFixed(3)} &nbsp;→&nbsp; <b>${V.l2[i][j].toFixed(3)}</b>`
        + (V.df[j] === V.n ? ` &nbsp;·&nbsp; <span style="color:var(--bad)">in every document: idf = 0</span>` : "");
    });
  };

  /* ------------------------------------------------------------- word2vec and fastText schematics
     Each is drawn twice: labelled, in the theory (L = true), and with letters only, in the questions that ask
     "what is what" (L = false). The parts are data-pick groups so a `point` question can be answered on them. */
  const title = (g, L, x, y, label, letter, a) => L
    ? txt(g, x, y, label, Object.assign({ "text-anchor": "middle", "font-size": 13 }, a || {}))
    : txt(g, x, y, letter, Object.assign({ "text-anchor": "middle", "font-size": 16, "font-weight": 700, fill: "var(--cls-3)" }, a || {}));
  const note = (g, L, x, y, t, a) => L ? txt(g, x, y, t, Object.assign({ "text-anchor": "middle", "font-size": 10, fill: "var(--ink-3)" }, a || {})) : null;

  function skipgram(host, L) {
    const W = 760, H = L ? 250 : 220, s = svg(host, W, H); defs(s);
    const top = 40, Vh = 150, d = 56;
    let g = pickable(s, "onehot", 44, top, 18, Vh);
    for (let k = 0; k < 15; k++) el("rect", { x: 44, y: top + k * 10, width: 18, height: 9, fill: k === 6 ? "var(--cls-0)" : "var(--panel-sunk)", stroke: "var(--rule)", "stroke-width": .5 }, g);
    title(g, L, 53, top - 14, "x", "A"); note(g, L, 53, top + Vh + 16, "one-hot · |V|");
    if (L) txt(g, 66, top + 67, "oil = 1", { "font-size": 9.5, fill: "var(--cls-0)" });
    g.hit();
    arrow(s, 66, top + Vh / 2, 96, top + Vh / 2);
    g = pickable(s, "win", 100, top, d + 30, Vh);
    box(g, 100, top, d + 30, Vh, { fill: "var(--panel)" });
    el("rect", { x: 100, y: top + 60, width: d + 30, height: 9, fill: "var(--cls-0)" }, g);
    title(g, L, 100 + (d + 30) / 2, top - 14, "W_in · |V| × d", "B"); note(g, L, 100 + (d + 30) / 2, top + Vh + 16, "one row per word"); g.hit();
    arrow(s, 190, top + Vh / 2, 240, top + Vh / 2); note(s, L, 215, top + Vh / 2 - 8, "lookup", { "font-size": 9 });
    g = pickable(s, "h", 244, top + Vh / 2 - 9, 86, 18);
    for (let k = 0; k < 8; k++) el("rect", { x: 244 + k * 11, y: top + Vh / 2 - 9, width: 10, height: 18, fill: "var(--cls-0)", opacity: .35 + .08 * ((k * 5) % 7), stroke: "var(--rule)", "stroke-width": .5 }, g);
    title(g, L, 287, top + Vh / 2 - 18, "h · d", "C"); note(g, L, 287, top + Vh / 2 + 26, "= the oil row"); g.hit();
    arrow(s, 334, top + Vh / 2, 384, top + Vh / 2);
    g = pickable(s, "wout", 388, top + Vh / 2 - 40, 150, 80);
    box(g, 388, top + Vh / 2 - 40, 150, 80, { fill: "var(--panel)" });
    el("rect", { x: 388 + 66, y: top + Vh / 2 - 40, width: 9, height: 80, fill: "var(--cls-1)" }, g);
    title(g, L, 463, top + Vh / 2 - 48, "W_out · d × |V|", "D"); note(g, L, 463, top + Vh / 2 + 56, "one column per word");
    if (L) txt(g, 388 + 71, top + Vh / 2 + 70, "prices", { "text-anchor": "middle", "font-size": 9.5, fill: "var(--cls-1)" });
    g.hit();
    arrow(s, 542, top + Vh / 2, 590, top + Vh / 2); note(s, L, 566, top + Vh / 2 - 8, "softmax", { "font-size": 9 });
    g = pickable(s, "out", 594, top, 60, Vh);
    const ps = [.02, .04, .03, .07, .02, .05, .03, .41, .04, .06, .03, .08, .04, .05, .03];
    ps.forEach((p, k) => el("rect", { x: 594, y: top + k * 10, width: 2 + 110 * p, height: 9, fill: k === 7 ? "var(--cls-1)" : "var(--rule-strong)" }, g));
    if (L) { txt(g, 594, top - 14, "P(context | oil)", { "font-size": 13 }); note(g, L, 594, top + Vh + 16, "|V| numbers, sum 1", { "text-anchor": "start" }); txt(g, 594 + 50, top + 78, "↑ prices", { "font-size": 9.5, fill: "var(--cls-1)" }); }
    else title(g, L, 624, top - 14, "", "E");
    g.hit();
    if (L) txt(s, W / 2, H - 8, "one training example: centre oil, context prices — the loss raises P(prices | oil)", { "text-anchor": "middle", "font-size": 11, fill: "var(--ink-2)" });
  }

  function cbow(host, L) {
    const W = 760, H = L ? 260 : 230, s = svg(host, W, H); defs(s);
    const top = 40, Vh = 150, ctx = ["oil", "prices", "sharply", "today"], rows = [18, 52, 92, 124];
    let g = pickable(s, "ctx", 14, top + 4, 92, 4 * 36 - 10);
    ctx.forEach((w, i) => { box(g, 14, top + 4 + i * 36, 92, 24); txt(g, 60, top + 21 + i * 36, w, { "text-anchor": "middle", "font-size": 12, "font-family": "var(--mono)" }); });
    title(g, L, 60, top - 14, "context words", "A"); g.hit();
    ctx.forEach((w, i) => arrow(s, 108, top + 16 + i * 36, 146, top + rows[i] + 4));
    g = pickable(s, "win", 150, top, 86, Vh);
    box(g, 150, top, 86, Vh, { fill: "var(--panel)" });
    rows.forEach(r => el("rect", { x: 150, y: top + r, width: 86, height: 8, fill: "var(--cls-0)" }, g));
    title(g, L, 193, top - 14, "W_in · |V| × d", "B"); note(g, L, 193, top + Vh + 16, "four rows, one matrix"); g.hit();
    const cx = 272, cy = top + Vh / 2;
    rows.forEach(r => el("path", { d: `M236,${top + r + 4} L${cx - 9},${cy}`, stroke: "var(--ink-3)", "stroke-width": 1, fill: "none" }, s));
    el("circle", { cx, cy, r: 9, fill: "var(--panel)", stroke: "var(--ink-3)" }, s); txt(s, cx, cy + 4, "÷", { "text-anchor": "middle", "font-size": 12 });
    arrow(s, cx + 10, cy, 300, cy);
    g = pickable(s, "h", 304, cy - 9, 86, 18);
    for (let k = 0; k < 8; k++) el("rect", { x: 304 + k * 11, y: cy - 9, width: 10, height: 18, fill: "var(--cls-0)", opacity: .35 + .08 * ((k * 3) % 7), stroke: "var(--rule)", "stroke-width": .5 }, g);
    title(g, L, 347, cy - 18, "h · d", "C"); note(g, L, 347, cy + 26, "average of the four rows"); g.hit();
    arrow(s, 394, cy, 436, cy);
    g = pickable(s, "wout", 440, cy - 40, 140, 80);
    box(g, 440, cy - 40, 140, 80, { fill: "var(--panel)" });
    el("rect", { x: 500, y: cy - 40, width: 9, height: 80, fill: "var(--cls-1)" }, g);
    title(g, L, 510, cy - 48, "W_out · d × |V|", "D");
    if (L) txt(g, 505, cy + 54, "rise", { "text-anchor": "middle", "font-size": 9.5, fill: "var(--cls-1)" });
    g.hit();
    arrow(s, 584, cy, 622, cy); note(s, L, 603, cy - 8, "softmax", { "font-size": 9 });
    g = pickable(s, "out", 626, top, 60, Vh);
    const ps = [.03, .05, .02, .06, .03, .04, .38, .05, .03, .07, .02, .06, .04, .03, .05];
    ps.forEach((p, k) => el("rect", { x: 626, y: top + k * 10, width: 2 + 110 * p, height: 9, fill: k === 6 ? "var(--cls-1)" : "var(--rule-strong)" }, g));
    if (L) { txt(g, 656, top - 14, "P(centre | context)", { "text-anchor": "middle", "font-size": 13 }); txt(g, 626 + 46, top + 68, "↑ rise", { "font-size": 9.5, fill: "var(--cls-1)" }); }
    else title(g, L, 656, top - 14, "", "E");
    g.hit();
    if (L) txt(s, W / 2, H - 8, "one training example per window: oil prices _ sharply today → rise", { "text-anchor": "middle", "font-size": 11, fill: "var(--ink-2)" });
  }

  function fasttext(host, L) {
    const W = 760, H = L ? 270 : 245, s = svg(host, W, H); defs(s);
    const top = 34, pieces = ["<wh", "whe", "her", "ere", "re>", "<where>"], rowY = [14, 46, 70, 104, 132, 160];
    if (L) txt(s, 40, top + 96, "where", { "text-anchor": "middle", "font-size": 14, "font-family": "var(--mono)" });
    else txt(s, 40, top + 96, "where", { "text-anchor": "middle", "font-size": 14, "font-family": "var(--mono)" });
    let g = pickable(s, "pieces", 96, top, 84, pieces.length * 30 - 8);
    pieces.forEach((p, i) => { box(g, 96, top + i * 30, 84, 22); txt(g, 138, top + 15 + i * 30, p, { "text-anchor": "middle", "font-size": 11.5, "font-family": "var(--mono)" }); });
    title(g, L, 138, top - 12, "character n-grams", "A"); g.hit();
    pieces.forEach((p, i) => el("path", { d: `M70,${top + 92} L94,${top + 11 + i * 30}`, stroke: "var(--rule-strong)", "stroke-width": .8, fill: "none" }, s));
    const tx = 240, tw = 150, th = 186;
    g = pickable(s, "table", tx, top, tw, th);
    box(g, tx, top, tw, th, { fill: "var(--panel)" });
    rowY.forEach(r => el("rect", { x: tx, y: top + r, width: tw, height: 7, fill: "var(--cls-0)" }, g));
    title(g, L, tx + tw / 2, top - 12, "n-gram vectors", "B"); note(g, L, tx + tw / 2, top + th + 16, "buckets × d · the learned parameters"); g.hit();
    pieces.forEach((p, i) => arrow(s, 182, top + 11 + i * 30, tx - 2, top + rowY[i] + 3, { "stroke-width": .9 }));
    const cx = 440, cy = top + th / 2;
    g = pickable(s, "sum", cx - 13, cy - 13, 26, 26);
    rowY.forEach(r => el("path", { d: `M${tx + tw},${top + r + 3} L${cx - 13},${cy}`, stroke: "var(--ink-3)", "stroke-width": .9, fill: "none" }, s));
    el("circle", { cx, cy, r: 13, fill: "var(--panel)", stroke: "var(--ink-3)" }, g); txt(g, cx, cy + 5, "Σ", { "text-anchor": "middle", "font-size": 14 });
    if (!L) title(g, L, cx, cy - 22, "", "C");
    g.hit();
    arrow(s, cx + 14, cy, 476, cy);
    g = pickable(s, "vec", 480, cy - 9, 86, 18);
    for (let k = 0; k < 8; k++) el("rect", { x: 480 + k * 11, y: cy - 9, width: 10, height: 18, fill: "var(--cls-1)", opacity: .35 + .08 * ((k * 5) % 7), stroke: "var(--rule)", "stroke-width": .5 }, g);
    title(g, L, 523, cy - 18, "vector of where", "D"); note(g, L, 523, cy + 26, "computed, not stored"); g.hit();
    arrow(s, 570, cy, 604, cy);
    box(s, 608, cy - 26, 140, 52, { fill: "transparent", "stroke-dasharray": "4 3" });
    txt(s, 678, cy - 4, "skip-gram objective", { "text-anchor": "middle", "font-size": 11.5 });
    txt(s, 678, cy + 12, "as in word2vec", { "text-anchor": "middle", "font-size": 10, fill: "var(--ink-3)" });
    if (L) txt(s, W / 2, H - 8, "an unseen word still has n-grams, so it still gets a vector", { "text-anchor": "middle", "font-size": 11, fill: "var(--ink-2)" });
  }

  QUIZ.figs.sg = h => skipgram(h, true);
  QUIZ.figs["sg-q"] = h => skipgram(h, false);
  QUIZ.figs["sg-q2"] = h => skipgram(h, false);
  QUIZ.figs.cbow = h => cbow(h, true);
  QUIZ.figs["cbow-q"] = h => cbow(h, false);
  QUIZ.figs.ft = h => fasttext(h, true);
  QUIZ.figs["ft-q"] = h => fasttext(h, false);


  /* ------------------------------------------------------------- Zipf's law on the AG News training set */
  const Z = LD.zipf, sp = n => n.toLocaleString("en-US").replace(/,/g, " ");
  Object.assign(QUIZ.values, {
    zipf_tokens: sp(Z.tokens), zipf_types: sp(Z.types), zipf_top: Z.top.slice(0, 6).join(", "),
    zipf_top100: Math.round(100 * Z.top100share) + "%", zipf_hapax: 100 * Z.hapax / Z.types,
    zipf_hapax_pct: Math.round(100 * Z.hapax / Z.types) + "%",
    half_types: sp(Z.half.types), half_hapax_pct: Math.round(100 * Z.half.hapax / Z.half.types) + "%", new_in_second: sp(Z.newInSecondHalf), zipf_slope: "−" + Math.abs(Z.slope).toFixed(2),
  });
  QUIZ.figs.zipf = host => {
    const W = 640, H = 300, s = svg(host, W, H), x0 = 60, y0 = 20, pw = W - x0 - 20, ph = H - y0 - 46;
    const lx = Math.log10(Z.points[Z.points.length - 1][0]), ly = Math.log10(Z.points[0][1]);
    const X = r => x0 + Math.log10(r) / Math.ceil(lx) * pw, Y = c => y0 + ph - Math.log10(c) / Math.ceil(ly) * ph;
    for (let k = 0; k <= Math.ceil(lx); k++) { el("line", { x1: X(10 ** k), y1: y0, x2: X(10 ** k), y2: y0 + ph, stroke: "var(--rule)", "stroke-width": .6 }, s); txt(s, X(10 ** k), y0 + ph + 16, "10" + "⁰¹²³⁴⁵⁶"[k], { "text-anchor": "middle", "font-size": 10.5, fill: "var(--ink-3)" }); }
    for (let k = 0; k <= Math.ceil(ly); k++) { el("line", { x1: x0, y1: Y(10 ** k), x2: x0 + pw, y2: Y(10 ** k), stroke: "var(--rule)", "stroke-width": .6 }, s); if (k) txt(s, x0 - 8, Y(10 ** k) + 4, "10" + "⁰¹²³⁴⁵⁶⁷"[k], { "text-anchor": "end", "font-size": 10.5, fill: "var(--ink-3)" }); }
    txt(s, x0 + pw / 2, H - 6, "rank of the word", { "text-anchor": "middle", "font-size": 11, fill: "var(--ink-2)" });
    txt(s, 14, y0 + ph / 2, "count", { "text-anchor": "middle", "font-size": 11, fill: "var(--ink-2)", transform: `rotate(-90 14 ${y0 + ph / 2})` });
    const c1 = Z.points[0][1];
    el("line", { x1: X(1), y1: Y(c1), x2: X(c1), y2: Y(1), stroke: "var(--ink-3)", "stroke-width": 1, "stroke-dasharray": "5 4" }, s);
    el("polyline", { points: Z.points.map(([r, c]) => `${X(r).toFixed(1)},${Y(c).toFixed(1)}`).join(" "), fill: "none", stroke: "var(--cls-0)", "stroke-width": 2 }, s);
    txt(s, X(1) + 6, Y(c1) - 6, Z.top[0], { "font-size": 11, "font-family": "var(--mono)" });
    const hy = Y(1);
    txt(s, X(20), Y(2.2), `${sp(Z.hapax)} words seen once →`, { "text-anchor": "start", "font-size": 10.5, fill: "var(--cls-1)" });
  };

  /* ------------------------------------------------------------- one-hot: three words, three axes */
  QUIZ.figs.ohe = host => {
    const words = ["like", "love", "geografia"], V = 14, W = 760, H = 150, s = svg(host, W, H);
    const x0 = 120, cw = 34, ch = 24, rows = { like: 3, love: 7, geografia: 11 };
    txt(s, x0, 22, "axes of the vocabulary · |V| of them, one per word", { "font-size": 11, fill: "var(--ink-3)" });
    words.forEach((w, i) => {
      const y = 34 + i * (ch + 10);
      txt(s, x0 - 12, y + 16, w, { "text-anchor": "end", "font-size": 12.5, "font-family": "var(--mono)" });
      for (let k = 0; k < V; k++) {
        const on = k === rows[w];
        el("rect", { x: x0 + k * cw, y, width: cw - 2, height: ch, rx: 2, fill: on ? "var(--cls-0)" : "var(--panel-sunk)", stroke: "var(--rule)", "stroke-width": .6 }, s);
        txt(s, x0 + k * cw + (cw - 2) / 2, y + 16, on ? "1" : "0", { "text-anchor": "middle", "font-size": 11, fill: on ? "var(--ground)" : "var(--ink-3)", "font-family": "var(--mono)" });
      }
      txt(s, x0 + V * cw + 10, y + 16, "…", { "font-size": 12, fill: "var(--ink-3)" });
    });
    ["like · love = 0", "like · geografia = 0", "love · geografia = 0"].forEach((t, i) => txt(s, x0 + i * 170, H - 8, t, { "font-size": 11.5, "font-family": "var(--mono)", fill: "var(--ink-2)" }));
  };


  /* ------------------------------------------------------------- aggregating word vectors into a text vector
     Toy 2-d word vectors, set by hand so the picture is readable; every property in the table is computed
     by running the aggregation, not typed in. */
  QUIZ.figs.agg = host => {
    const WV = { good: [0.9, 0.15], film: [0.1, 0.9], a: [0.06, 0.04], really: [0.35, 0.05], not: [-0.25, 0.1] };
    const IDF = { a: 0.2, really: 1, good: 1, film: 1, not: 1.2 };
    const TEXTS = ["good film", "film good", "a really good film", "good film good film", "not a good film"];
    const AGG = {
      sum: { name: "sum", f: vs => vs.reduce((a, v) => a.map((x, i) => x + v[i]), [0, 0]) },
      mean: { name: "mean", f: vs => vs.reduce((a, v) => a.map((x, i) => x + v[i] / vs.length), [0, 0]) },
      max: { name: "max per coordinate", f: vs => [0, 1].map(i => Math.max(...vs.map(v => v[i]))) },
      wmean: { name: "idf-weighted mean", f: (vs, ws) => { const z = ws.reduce((a, b) => a + b, 0); return vs.reduce((a, v, k) => a.map((x, i) => x + ws[k] * v[i] / z), [0, 0]); } },
      concat: { name: "concatenation", f: vs => vs.flat() },
      last: { name: "last word only", f: vs => vs[vs.length - 1].slice() },
    };
    const words = t => t.split(" ");
    const run = (k, t, wv) => { const w = words(t); return AGG[k].f(w.map(x => (wv || WV)[x]), w.map(x => IDF[x])); };
    const same = (a, b) => a.length === b.length && a.every((x, i) => Math.abs(x - b[i]) < 1e-9);
    const cos = (a, b) => { const d = a.reduce((s, x, i) => s + x * b[i], 0); return d / (Math.hypot(...a) * Math.hypot(...b)); };
    function props(k) {
      const fixed = new Set(TEXTS.map(t => run(k, t).length)).size === 1;
      const order = same(run(k, "good film"), run(k, "film good"));
      const length = same(run(k, "good film"), run(k, "good film good film"));
      // every word: nudge each word of a text and see whether the text vector moves
      const t = "a really good film";
      const every = words(t).every(w => { const wv = Object.assign({}, WV, { [w]: WV[w].map(x => x - 0.01) }); return !same(run(k, t), run(k, t, wv)); });
      const a = run(k, "good film"), b = run(k, "not a good film");
      const neg = a.length === b.length ? cos(a, b) : null;
      return { fixed, order, length, every, neg };
    }
    const P = Object.fromEntries(Object.keys(AGG).map(k => [k, props(k)]));
    let agg = "mean", text = 2;
    const mark = v => v ? '<span class="agg-ok">✓</span>' : '<span class="agg-no">✗</span>';
    host.innerHTML = `<div class="agg">
      <div class="agg-left">
        <div class="agg-k">text</div><div class="btnrow agg-texts">${TEXTS.map((t, i) => `<button data-t="${i}">${esc(t)}</button>`).join("")}</div>
        <div class="agg-plane"></div>
        <div class="agg-out mono"></div>
      </div>
      <div class="agg-right scroll-x"><table class="agg-table"><thead><tr><th>aggregation</th><th>fixed size</th><th>every word counts</th><th>order-free</th><th>length-free</th><th>cos(good film, not a good film)</th></tr></thead><tbody>
        ${Object.keys(AGG).map(k => `<tr data-a="${k}"><td>${AGG[k].name}</td><td>${mark(P[k].fixed)}</td><td>${mark(P[k].every)}</td><td>${mark(P[k].order)}</td><td>${mark(P[k].length)}</td><td class="num">${P[k].neg == null ? "—" : P[k].neg.toFixed(2)}</td></tr>`).join("")}
      </tbody></table><div class="agg-note">Click a row to draw it. Toy 2-d vectors: x ≈ "positive", y ≈ "about cinema".</div></div></div>`;
    function draw() {
      host.querySelectorAll(".agg-texts button").forEach(b => b.classList.toggle("on", +b.dataset.t === text));
      host.querySelectorAll(".agg-table tr[data-a]").forEach(r => r.classList.toggle("on", r.dataset.a === agg));
      const t = TEXTS[text], ws = words(t), v = run(agg, t), plane = host.querySelector(".agg-plane");
      plane.innerHTML = "";
      host.querySelector(".agg-out").innerHTML = `${esc(AGG[agg].name)}(${esc(t)}) = [${v.map(x => x.toFixed(2)).join(", ")}] · ${v.length} numbers`;
      if (v.length !== 2) { plane.innerHTML = `<div class="agg-flat">${v.length} numbers for ${ws.length} words — no longer a point in the words' plane, and a longer text would be a longer vector.</div>`; return; }
      const S = 220, s2 = svg(plane, S, S), o = 40, span = Math.max(2, ...[v, ...ws.map(w => WV[w])].flat().map(Math.abs)) * 1.1, sc = (S - o - 14) / span;
      const P2 = ([x, y]) => [o + x * sc, S - o - y * sc];
      el("line", { x1: 8, y1: S - o, x2: S - 6, y2: S - o, stroke: "var(--rule-strong)" }, s2);
      el("line", { x1: o, y1: 6, x2: o, y2: S - 8, stroke: "var(--rule-strong)" }, s2);
      txt(s2, S - 8, S - o + 14, "positive", { "text-anchor": "end", "font-size": 9.5, fill: "var(--ink-3)" });
      txt(s2, o + 4, 14, "cinema", { "font-size": 9.5, fill: "var(--ink-3)" });
      const seen = new Set();
      ws.forEach(w => {
        if (seen.has(w)) return; seen.add(w);
        const [x, y] = P2(WV[w]);
        el("line", { x1: o, y1: S - o, x2: x, y2: y, stroke: "var(--ink-3)", "stroke-width": 1.2 }, s2);
        el("circle", { cx: x, cy: y, r: 2.5, fill: "var(--ink-3)" }, s2);
        txt(s2, x + 4, y - 4, w, { "font-size": 10, fill: "var(--ink-2)" });
      });
      const [x, y] = P2(v);
      el("line", { x1: o, y1: S - o, x2: x, y2: y, stroke: "var(--cls-1)", "stroke-width": 2.4 }, s2);
      el("circle", { cx: x, cy: y, r: 4, fill: "var(--cls-1)" }, s2);
      txt(s2, x + 6, y + 12, "text", { "font-size": 10.5, fill: "var(--cls-1)" });
    }
    host.addEventListener("click", e => {
      const b = e.target.closest("button[data-t]"), r = e.target.closest("tr[data-a]");
      if (b) text = +b.dataset.t; else if (r) agg = r.dataset.a; else return;
      draw();
    });
    draw();
  };

  /* ------------------------------------------------------------- the 2 x 2 map of the week's methods */
  QUIZ.figs["repr-map"] = host => {
    const W = 760, H = 250, s = svg(host, W, H);
    const x0 = 150, y0 = 44, cw = 290, ch = 90;
    const cells = [
      ["cw", 0, 0, "counted · per word", ["co-occurrence counts", "LSA"]],
      ["ct", 1, 0, "counted · per text", ["bag of words", "tf-idf", "LDA topics"]],
      ["lw", 0, 1, "learned · per word", ["word2vec", "GloVe", "fastText"]],
      ["lt", 1, 1, "learned · per text", ["mean pooling of word vectors", "sentence encoders (later)"]],
    ];
    txt(s, x0 + cw / 2, y0 - 12, "a word", { "text-anchor": "middle", "font-size": 12.5 });
    txt(s, x0 + cw + cw / 2, y0 - 12, "a text", { "text-anchor": "middle", "font-size": 12.5 });
    txt(s, x0 - 14, y0 + ch / 2 + 4, "counted", { "text-anchor": "end", "font-size": 12.5 });
    txt(s, x0 - 14, y0 + ch + ch / 2 + 4, "learned", { "text-anchor": "end", "font-size": 12.5 });
    cells.forEach(([key, cx, cy, name, items]) => {
      const x = x0 + cx * cw, y = y0 + cy * ch;
      const g = pickable(s, key, x + 4, y + 4, cw - 8, ch - 8);
      box(g, x + 4, y + 4, cw - 8, ch - 8, { fill: "var(--panel)" });
      txt(g, x + 16, y + 26, name, { "font-size": 11, fill: "var(--ink-3)" });
      items.forEach((it, i) => txt(g, x + 16, y + 46 + i * 15, it, { "font-size": 12 }));
      g.hit();
    });
    txt(s, x0 + cw, y0 + 2 * ch + 18, "a third column, per occurrence of a word, arrives in week 4", { "text-anchor": "middle", "font-size": 11, fill: "var(--ink-3)" });
  };

  /* ------------------------------------------------------------- what each method does with each unknown word */
  QUIZ.figs["oov-table"] = host => {
    const tok = p => `<span class="tok">${esc(p)}</span>`;
    const rows = [
      ["bag of words / tf-idf", r => `<span style="color:var(--ink-3)">no column — dropped</span>`],
      ["Porter stem → bag of words", r => r.stemKnown ? `<code>${esc(r.stem)}</code> <span style="color:var(--good)">= stem of ${r.stemOf.map(esc).join(", ")}</span>` : `<code>${esc(r.stem)}</code> <span style="color:var(--bad)">no training word has this stem</span>`],
      ["character 3–5-grams", r => `<b>${r.ngramsSeen}</b> of ${r.ngramsTotal} n-grams seen in training`],
      ["BPE (cl100k_base)", r => `<span class="pieces">${r.bpe.map(tok).join("")}</span> <span style="color:var(--ink-3)">${r.bpe.length} tokens</span>`],
      ["word2vec", r => `<code>KeyError</code>`],
      ["fastText", r => `sum of <b>${r.ftN}</b> n-gram vectors: ${r.ft.slice(0, 4).map(tok).join("")}<span style="color:var(--ink-3)">…</span>`],
    ];
    host.innerHTML = `<div class="scroll-x"><table class="lec-oov"><thead><tr><th></th>${LD.oov.map(r => `<th class="data-th"><code>${esc(r.w)}</code><br><span style="font-weight:400;color:var(--ink-3)">${esc(r.kind)}</span></th>`).join("")}</tr></thead><tbody>` +
      rows.map(([name, f]) => `<tr><td style="white-space:nowrap">${name}</td>${LD.oov.map(r => `<td>${f(r)}</td>`).join("")}</tr>`).join("") + `</tbody></table></div>`;
  };
})();
