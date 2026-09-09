/* ============================================================ 00 history */
(function () {
  const rows = [
    ["1957", "distributional hypothesis (Firth)", "—", "not yet an algorithm"],
    ["1972", "TF-IDF", "ranking by relevance", "no semantics, no word order"],
    ["1990", "LSA", "synonymy", "dense matrix, no interpretation"],
    ["2003", "LDA", "topic structure", "bag of words, brittle to preprocessing"],
    ["2013", "word2vec", "semantic similarity, arithmetic", "one word → one vector"],
    ["2016", "fastText", "out-of-vocabulary, morphology", "still no context"],
    ["2018+", "contextual representations", "homonymy, word order", "cost, non-determinism"],
  ];
  $("#tbl-history").innerHTML =
    `<thead><tr><th>Year</th><th>Representation</th><th>What became cheap</th><th>What it cost</th></tr></thead><tbody>` +
    rows.map(r => `<tr><td class="mono">${r[0]}</td><td>${esc(r[1])}</td><td>${esc(r[2])}</td><td style="color:var(--ink-2)">${esc(r[3])}</td></tr>`).join("") +
    `</tbody>`;
})();

/* ============================================================== 01 label */
const LABEL_STATE = { mine: new Array(12).fill(null), revealed: false };
(function () {
  const list = $("#label-list");
  list.innerHTML = D.disputed.map((d, n) => `
    <div style="display:grid;grid-template-columns:26px 1fr;gap:12px;padding:11px 0;border-bottom:1px solid var(--rule)" data-row="${n}">
      <div class="mono" style="color:var(--ink-3);font-size:15px;padding-top:3px">${String(n + 1).padStart(2, "0")}</div>
      <div>
        <div style="font-size:18.2px;line-height:1.45">${esc(d.text.slice(0, 190))}</div>
        <div class="btnrow" style="margin-top:8px" data-btns="${n}">
          ${CN.map((c, i) => `<button data-n="${n}" data-c="${i}" style="font-size:15.4px;padding:4px 9px">${c}</button>`).join("")}
          <span class="mono" style="font-size:15px" data-verdict="${n}"></span>
        </div>
      </div>
    </div>`).join("");

  list.addEventListener("click", e => {
    const b = e.target.closest("button[data-c]");
    if (!b) return;
    const n = +b.dataset.n, c = +b.dataset.c;
    LABEL_STATE.mine[n] = c;
    $$(`[data-btns="${n}"] button`).forEach(x => x.classList.toggle("on", +x.dataset.c === c));
    paint();
  });
  $("#btn-label-reveal").addEventListener("click", () => { LABEL_STATE.revealed = true; paint(); ceilingPaint(); });
  $("#btn-label-reset").addEventListener("click", () => {
    LABEL_STATE.mine.fill(null); LABEL_STATE.revealed = false;
    $$("#label-list button").forEach(b => b.classList.remove("on"));
    paint(); ceilingPaint();
  });

  function paint() {
    const done = LABEL_STATE.mine.filter(x => x !== null).length;
    $("#label-progress").textContent = `${done} / 12 labelled`;
    $("#btn-label-reveal").disabled = done < 12 || LABEL_STATE.revealed;
    D.disputed.forEach((d, n) => {
      const v = $(`[data-verdict="${n}"]`);
      if (!LABEL_STATE.revealed) { v.textContent = ""; return; }
      const mine = LABEL_STATE.mine[n], ok = mine === d.gold;
      v.innerHTML = `<span style="color:${ok ? "var(--good)" : "var(--bad)"}">${ok ? "agree" : "differ"}</span>
        <span style="color:var(--ink-3)"> · dataset says</span> ${CN[d.gold]}`;
    });
    const score = $("#label-score");
    if (LABEL_STATE.revealed) {
      const agree = LABEL_STATE.mine.filter((m, n) => m === D.disputed[n].gold).length;
      score.hidden = false;
      score.innerHTML = `You agree with the dataset on <strong>${agree}/12 — ${pct(agree / 12)}</strong> of the disputed twelve.
        Keep that number; block 11 puts it next to every model built today.`;
    } else score.hidden = true;
  }
  paint();
})();

/* ============================================================= 02 tokens */
(function () {
  const cases = D.tokenizerCases;
  $("#tok-cases").innerHTML = cases.map((c, i) =>
    `<button data-case="${i}" ${i === 0 ? 'class="on"' : ""} style="font-size:15px;padding:4px 8px">${i + 1}</button>`).join("");
  const PUNCT = "!\"#$%&'()*+,-./:;<=>?@[\\]^_`{|}~";
  const naive = t => { for (const p of PUNCT) t = t.split(p).join(" "); return t.trim().split(/\s+/).filter(Boolean); };
  const rex = t => t.match(/[A-Za-z0-9_]+/g) || [];
  const wordpunct = t => t.match(/[A-Za-z0-9_]+|[^\sA-Za-z0-9_]/g) || [];

  function render(text, known) {
    const rows = known
      ? [["naive", known.naive], ["regex", known.regex], ["wordpunct", known.wordpunct], ["word_tok", known.word_tok]]
      : [["naive", naive(text)], ["regex", rex(text)], ["wordpunct", wordpunct(text)],
      ["word_tok", null]];
    const ref = new Set(rows[3][1] || rows[0][1]);
    $("#tok-out").innerHTML = `
      <div class="mono" style="font-size:15.9px;color:var(--ink-2);margin-bottom:12px">${esc(text)}</div>
      <div style="display:grid;grid-template-columns:96px 1fr;gap:10px 14px;align-items:baseline">` +
      rows.map(([name, toks]) => `
        <div class="mono" style="font-size:14.5px;letter-spacing:.06em;color:var(--ink-3)">${name}
          <span style="display:block;color:var(--ink-2)">${toks ? toks.length : "—"}</span></div>
        <div>${toks
          ? toks.map(t => `<span class="tok${ref.has(t) ? "" : " diff"}">${esc(t)}</span>`).join("")
          : `<span class="footnote">nltk’s Treebank tokenizer is a Python library — it runs only on the five precomputed strings above.</span>`}</div>`).join("") +
      `</div>`;
  }
  let activeCase = 0;
  $("#tok-cases").addEventListener("click", e => {
    const b = e.target.closest("button"); if (!b) return;
    activeCase = +b.dataset.case;
    $$("#tok-cases button").forEach(x => x.classList.toggle("on", x === b));
    $("#tok-input").value = cases[activeCase].text;
    render(cases[activeCase].text, cases[activeCase]);
  });
  $("#tok-input").addEventListener("input", e => {
    const v = e.target.value;
    const hit = cases.findIndex(c => c.text === v);
    $$("#tok-cases button").forEach((x, i) => x.classList.toggle("on", i === hit));
    render(v, hit >= 0 ? cases[hit] : null);
  });
  render(cases[0].text, cases[0]);

  /* morphology reveal */
  $("[data-reveal='morph']").addEventListener("click", () => {
    $("#veil-morph").hidden = true;
    $("#morph-out").hidden = false;
    $("#morph-note").hidden = false;
    $("#morph-out").innerHTML = `<div class="scroll-x"><table>
      <thead><tr><th>surface</th><th>Porter stem</th><th>lemma (default, pos='n')</th><th>lemma pos='v'</th><th>lemma pos='a'</th></tr></thead>
      <tbody>${D.morph.map(m => {
      const odd = m.n !== m.v || m.n === "wa";
      return `<tr><td class="mono">${esc(m.word)}</td><td class="mono">${esc(m.stem)}</td>
        <td class="mono" style="${odd ? "color:var(--bad)" : ""}">${esc(m.n)}</td>
        <td class="mono">${esc(m.v)}</td><td class="mono">${esc(m.a)}</td></tr>`;
    }).join("")}</tbody></table></div>`;
  });

  /* BPE */
  if (D.bpe) {
    const p = D.bpe.pairs.map(pr => {
      const ratio = pr.ruTok.length / pr.enTok.length;
      return `<div style="margin-bottom:18px">
        <div style="display:flex;gap:10px;align-items:baseline;margin-bottom:5px">
          <span class="mono" style="color:var(--ink-3);font-size:14px">EN ${String(pr.enTok.length).padStart(3)}</span>
          <span>${pr.enTok.map(t => `<span class="tok">${esc(t.replace(/ /g, "␣"))}</span>`).join("")}</span></div>
        <div style="display:flex;gap:10px;align-items:baseline">
          <span class="mono" style="color:var(--ink-3);font-size:14px">RU ${String(pr.ruTok.length).padStart(3)}</span>
          <span>${pr.ruTok.map(t => `<span class="tok">${esc(t.replace(/ /g, "␣"))}</span>`).join("")}</span></div>
        <div class="mono" style="font-size:15px;color:var(--ink-2);margin-top:6px">ratio ×${ratio.toFixed(1)}</div>
      </div>`;
    }).join("");
    const w = `<div class="eyebrow" style="margin:20px 0 8px">How a single word gets cut up</div>` +
      D.bpe.words.map(x => `<div style="margin-bottom:6px"><span class="mono" style="display:inline-block;width:150px;color:var(--ink-2);font-size:15.4px">${esc(x.w)}</span>${x.pieces.map(p => `<span class="tok">${esc(p)}</span>`).join("")}</div>`).join("");
    $("#bpe-out").innerHTML = p + w;
  }
})();

/* =============================================================== 03 prep */
(function () {
  /* LDA */
  function lda(tag) {
    const t = D.lda[tag];
    $("#lda-topic-count").textContent = `${t.topics.length} topics`;
    $("#lda-out").innerHTML = `<div class="mono" style="font-size:14.5px;color:var(--ink-3);margin-bottom:10px">vocabulary ${t.vocab_size.toLocaleString()} types</div>` +
      t.topics.map((topic, i) => `<div style="display:grid;grid-template-columns:64px 1fr;gap:12px;padding:7px 0;border-bottom:1px solid var(--rule)">
        <span class="mono" style="font-size:14.5px;color:var(--ink-3)">topic ${i}</span>
        <span>${topic.map(w => `<span class="tok">${esc(w)}</span>`).join("")}</span></div>`).join("");
  }
  $("#btn-lda-raw").addEventListener("click", e => { lda("raw"); $("#btn-lda-lem").classList.remove("on"); e.target.classList.add("on"); });
  $("#btn-lda-lem").addEventListener("click", e => { lda("lemmatised"); $("#btn-lda-raw").classList.remove("on"); e.target.classList.add("on"); });
  lda("raw");

  /* stopwords */
  const STOP = new Set(D.stopwords);
  $("#stop-count").textContent = `${D.stopwords.length} entries · "not" in list: ${STOP.has("not")}`;
  const presets = ["the movie was not good", "I would never recommend this", "no problems at all, very happy"];
  $("#stop-presets").innerHTML = presets.map((p, i) => `<button data-p="${i}" style="font-size:15px">${esc(p)}</button>`).join("");
  $("#stop-presets").addEventListener("click", e => {
    const b = e.target.closest("button"); if (!b) return;
    $("#stop-input").value = presets[+b.dataset.p]; drop();
  });
  function drop() {
    const text = $("#stop-input").value;
    const toks = (text.toLowerCase().match(/[A-Za-z0-9_]+/g) || []);
    const kept = toks.filter(t => !STOP.has(t));
    $("#stop-out").innerHTML = `
      <div style="margin-bottom:10px">${toks.map(t => STOP.has(t)
        ? `<span class="tok" style="opacity:.34;text-decoration:line-through">${esc(t)}</span>`
        : `<span class="tok diff">${esc(t)}</span>`).join("")}</div>
      <div class="mono" style="font-size:15.9px">→ <span style="color:var(--ink)">${esc(kept.join(" ")) || "<em>everything was a stopword</em>"}</span></div>
      <div class="mono" style="font-size:14.5px;color:var(--ink-3);margin-top:6px">${toks.length} tokens in · ${kept.length} out · ${toks.length - kept.length} deleted</div>`;
  }
  $("#stop-input").addEventListener("input", drop);
  drop();
})();

/* ============================================================== 04 tfidf */
(function () {
  const STAGES = [
    ["vocab", "Vocabulary", "The columns. sklearn’s analyzer lowercases and keeps runs of two or more word characters, then sorts."],
    ["counts", "Counts", "One number per vocabulary word. Word order and anything out of vocabulary are gone, and never come back."],
    ["idf", "Document frequency → IDF", "sklearn smooths: idf = ln((1+n)/(1+df)) + 1. A term in every document is pushed to the floor of 1.0, never to zero."],
    ["tfidf", "Multiply", "tf × idf. A term’s weight is its frequency here times its rarity across the corpus."],
    ["l2", "L2-normalize", "Every row now has length exactly 1, so a ten-word and a thousand-word document are comparable."],
  ];
  let stage = 4;
  $("#tfidf-stages").innerHTML = STAGES.map((s, i) =>
    `<button data-stage="${i}" style="font-size:15px;padding:4px 9px">${i + 1}. ${s[1]}</button>`).join("");
  $("#toy-input").value = D.toy.join("\n");
  $("#tfidf-stages").addEventListener("click", e => {
    const b = e.target.closest("button"); if (!b) return; stage = +b.dataset.stage; draw();
  });
  $("#toy-input").addEventListener("input", draw);

  function vectorize(docs, ngram) {
    const analyzed = docs.map(d => analyze(d, ngram));
    const vocab = Array.from(new Set(analyzed.flat())).sort();
    const idx = new Map(vocab.map((w, i) => [w, i]));
    const counts = analyzed.map(toks => {
      const row = new Float64Array(vocab.length);
      toks.forEach(t => row[idx.get(t)]++);
      return row;
    });
    const n = docs.length;
    const df = vocab.map((_, j) => counts.reduce((a, r) => a + (r[j] > 0 ? 1 : 0), 0));
    const idf = df.map(d => Math.log((1 + n) / (1 + d)) + 1);
    const raw = counts.map(r => r.map((v, j) => v * idf[j]));
    const norms = raw.map(r => Math.hypot(...r) || 1);
    const l2 = raw.map((r, i) => r.map(v => v / norms[i]));
    return { vocab, counts, df, idf, raw, l2, norms };
  }

  function draw() {
    const docs = $("#toy-input").value.split("\n").map(s => s.trim()).filter(Boolean);
    if (!docs.length) return;
    const V = vectorize(docs, 1);
    $$("#tfidf-stages button").forEach((b, i) => b.classList.toggle("on", i === stage));
    $("#tfidf-caption").textContent = STAGES[stage][2];
    $("#tfidf-formula").innerHTML = `
      <div class="eyebrow" style="margin-bottom:8px">Stage ${stage + 1} of 5</div>
      <div style="font-family:var(--mono);font-size:15.9px;line-height:2;color:var(--ink-2)">
        ${["vocabulary = sorted(set(tokens))",
        "count(t, d) = number of times t occurs in d",
        "idf(t) = ln((1 + n) / (1 + df(t))) + 1",
        "w(t, d) = count(t, d) · idf(t)",
        "w(t, d) ← w(t, d) / ‖w(·, d)‖₂"][stage]}
      </div>
      <div class="mono" style="font-size:14.5px;color:var(--ink-3);margin-top:10px">
        ${docs.length} documents · ${V.vocab.length} columns</div>`;

    const show = stage <= 1 ? V.counts : stage === 2 ? null : stage === 3 ? V.raw : V.l2;
    const T = $("#tfidf-matrix");
    if (stage === 0) {
      T.innerHTML = `<thead><tr><th></th>${V.vocab.map(w => `<th class="num data-th">${esc(w)}</th>`).join("")}</tr></thead><tbody>` +
        docs.map((d, i) => `<tr><td class="mono" style="color:var(--ink-3)">d${i}</td>` +
          V.vocab.map(() => `<td class="num" style="color:var(--ink-3)">·</td>`).join("") + `</tr>`).join("") +
        `</tbody>`;
    } else if (stage === 2) {
      T.innerHTML = `<thead><tr><th>term</th><th class="num">df</th><th class="num">idf</th><th>in every document?</th></tr></thead><tbody>` +
        V.vocab.map((w, j) => ({ w, j }))
          .sort((a, b) => V.df[a.j] - V.df[b.j] || (a.w < b.w ? -1 : 1))
          .map(({ w, j }) => `<tr><td class="mono">${esc(w)}</td><td class="num">${V.df[j]}</td>
          <td class="num" style="${V.idf[j] === 1 ? "color:var(--bad)" : ""}">${V.idf[j].toFixed(3)}</td>
          <td style="color:var(--ink-2)">${V.df[j] === docs.length ? "yes — floored at 1.0, not deleted" : ""}</td></tr>`)
          .join("") + `</tbody>`;
    } else {
      const maxV = Math.max(...show.flatMap(r => Array.from(r)));
      T.innerHTML = `<thead><tr><th></th>${V.vocab.map(w => `<th class="num data-th">${esc(w)}</th>`).join("")}${stage === 4 ? '<th class="num">‖row‖</th>' : ""}</tr></thead><tbody>` +
        show.map((r, i) => `<tr><td class="mono" style="color:var(--ink-3)">d${i}</td>` +
          Array.from(r).map(v => {
            const a = maxV ? v / maxV : 0;
            return `<td class="num" style="background:color-mix(in srgb, var(--seq-3) ${Math.round(a * 34)}%, transparent);${v === 0 ? "color:var(--ink-3)" : ""}">${stage <= 1 ? v : v.toFixed(3)}</td>`;
          }).join("") +
          (stage === 4 ? `<td class="num" style="color:var(--ink-2)">${Math.hypot(...V.l2[i]).toFixed(3)}</td>` : "") +
          `</tr>`).join("") + `</tbody>`;
    }

    const jThe = V.vocab.indexOf("the"), jToday = V.vocab.indexOf("today"), jRise = V.vocab.indexOf("rise");
    $("#tfidf-note").innerHTML = (jToday >= 0 && jRise >= 0)
      ? `Read the last stage rather than skimming it. <span class="mono">today</span> holds the smallest non-zero weight in every row — it is in every document, so it distinguishes nothing. <span class="mono">rise</span> in <span class="mono">d0</span> gets ${V.l2[0][jRise].toFixed(3)}, the largest in its row, because it appears once, in one document. ${jThe >= 0 ? `<span class="mono">the</span> in <span class="mono">d2</span> gets ${V.l2[2][jThe].toFixed(3)} — higher than <span class="mono">game</span> or <span class="mono">team</span>, purely because it occurs twice.` : ""} <strong>This is the whole method.</strong> Everything on the rest of this page is these five stages on a bigger vocabulary.`
      : `Edit the documents above and every stage recomputes — this is <span class="mono">sklearn</span>’s exact arithmetic, running here.`;
  }
  draw();

  /* order flip */
  let ngram = 1;
  function order() {
    const docs = D.orderPair;
    const V = vectorize(docs, ngram);
    let dot = 0;
    for (let j = 0; j < V.vocab.length; j++) dot += V.l2[0][j] * V.l2[1][j];
    const bigrams = V.vocab.filter(t => t.includes(" "));
    $("#order-out").innerHTML = `
      <div style="display:flex;gap:26px;flex-wrap:wrap;align-items:flex-start">
        <div style="flex:1 1 300px">
          ${docs.map((d, i) => `<div style="margin-bottom:8px"><span class="mono" style="color:var(--ink-3);font-size:14.5px">d${i}</span>
            <div>${analyze(d, 1).map(t => `<span class="tok">${esc(t)}</span>`).join("")}</div></div>`).join("")}
          ${bigrams.length ? `<div style="margin-top:14px"><div class="eyebrow" style="margin-bottom:6px">bigrams present</div>
            ${bigrams.map(b => `<span class="tok">${esc(b)}</span>`).join("")}</div>` : ""}
        </div>
        <div class="stat-row">
          <div class="stat"><span class="v">${dot.toFixed(3)}</span><span class="k">cosine similarity</span></div>
          <div class="stat"><span class="v">${V.vocab.length}</span><span class="k">dimensions</span></div>
        </div>
      </div>`;
  }
  $("#btn-ng-1").addEventListener("click", e => { ngram = 1; e.target.classList.add("on"); $("#btn-ng-2").classList.remove("on"); order(); });
  $("#btn-ng-2").addEventListener("click", e => { ngram = 2; e.target.classList.add("on"); $("#btn-ng-1").classList.remove("on"); order(); });
  order();
})();

/* ------------------------------------ preprocessing × task grid (block 02) */
(() => {
  const P = (D.preproc && D.preproc.rows) || [];
  const host = $("#preproc-grid");
  if (!host || !P.length) return;

  const CHOICES = ["helps", "no change", "hurts"];
  const LABEL = { "helps": "helps", "no change": "nothing", "hurts": "hurts" };
  const FAM = {
    "classification": "text classification · one knob, four tasks",
    "data size": "the same task and dataset, different amounts of labelled data",
    "retrieval": "lexical search · BM25 over held-out queries",
    "topic modelling": "topic modelling · LDA, NPMI coherence",
  };
  const bets = new Array(P.length).fill(null);
  let revealed = false;

  const col = v => v === "helps" ? "var(--good)" : v === "hurts" ? "var(--bad)" : "var(--ink-2)";
  const signed = (x, d) => (x >= 0 ? "+" : "−") + Math.abs(x).toFixed(d === undefined ? 4 : d);

  function result(r, bet) {
    const ok = bet === r.verdict;
    const mark = bet == null ? ""
      : `<span style="color:${ok ? "var(--good)" : "var(--bad)"};font-weight:700">${ok ? "✓" : "✗"}</span> `;
    return `${mark}<span style="color:${col(r.verdict)};font-weight:700">${LABEL[r.verdict]}</span>
      <div class="mono" style="color:var(--ink-2);font-size:14.5px;margin-top:3px;white-space:nowrap">
        ${fmt(r.baseline)} → ${fmt(r.variant)} &middot; ${signed(r.delta)}</div>`;
  }

  function paint() {
    let fam = null;
    let html = `<table><thead><tr><th style="width:26%">dataset</th><th style="width:26%">knob</th>
      <th style="width:26%">your bet</th><th style="width:22%">measured</th></tr></thead><tbody>`;
    P.forEach((r, i) => {
      if (r.family !== fam) {
        fam = r.family;
        html += `<tr><td colspan="4" style="background:var(--panel-sunk);color:var(--ink-2);
          font-size:14.5px;letter-spacing:.06em;text-transform:uppercase">${esc(FAM[fam] || fam)}</td></tr>`;
      }
      html += `<tr>
        <td><div>${esc(r.dataset)}</div>
            <div class="footnote" style="margin:2px 0 0">${esc(r.task)}<br>
              <span class="mono">${r.nTrain.toLocaleString()}</span>
              ${r.family === "retrieval" ? "documents indexed" : r.family === "topic modelling"
        ? "documents" : "labelled documents"}</div></td>
        <td class="mono" style="font-size:15px">${esc(r.knob)}
            <div class="footnote" style="margin:2px 0 0">${esc(r.metric)}</div></td>
        <td><span class="btnrow">${CHOICES.map(v =>
        `<button data-i="${i}" data-v="${v}" class="${bets[i] === v ? "on" : ""}"${revealed ? " disabled" : ""}>${LABEL[v]}</button>`).join("")}</span></td>
        <td>${revealed ? result(r, bets[i])
        : `<span class="mono" style="color:var(--ink-3)">hidden</span>`}</td></tr>`;
      if (revealed) {
        html += `<tr><td colspan="4" class="footnote" style="padding-top:0">
          ${esc(r.note)}${r.chance != null
            ? ` <span class="mono">majority baseline ${fmt(r.chance, 3)}</span>.` : ""}
          <span class="mono">${esc(r.baselineName)} → ${esc(r.variantName)}</span>,
          vocabulary ${r.dims[0].toLocaleString()} → ${r.dims[1].toLocaleString()}.</td></tr>`;
      }
    });
    host.innerHTML = html + "</tbody></table>";
    const placed = bets.filter(Boolean).length;
    $("#preproc-progress").textContent = `${placed} / ${P.length} bets placed`;
  }

  host.addEventListener("click", e => {
    const b = e.target.closest("button[data-i]");
    if (!b || revealed) return;
    bets[+b.dataset.i] = b.dataset.v;
    paint();
  });

  $("#btn-preproc-reveal").addEventListener("click", () => {
    revealed = true;
    paint();
    const placed = bets.filter(Boolean).length;
    const hits = P.filter((r, i) => bets[i] === r.verdict).length;
    const flips = new Map();
    P.forEach(r => {
      const k = r.knob.split(" (")[0];
      if (!flips.has(k)) flips.set(k, new Set());
      flips.get(k).add(r.verdict);
    });
    const ambiguous = [...flips.entries()].filter(([, v]) => v.size > 1).length;
    // accuracy rows only: NPMI points and accuracy points are not the same unit
    const stopDeltas = P.filter(r => r.knob === "drop stopwords" && r.metric === "accuracy")
      .map(r => r.delta);
    const spread = signed(Math.min(...stopDeltas) * 100, 1) + " … " +
      signed(Math.max(...stopDeltas) * 100, 1) + " pts";

    $("#preproc-score").hidden = false;
    $("#preproc-score").innerHTML = `
      <div class="stat"><span class="v">${placed ? hits + " / " + placed : "—"}</span>
        <span class="k">${placed ? "bets correct" : "no bets placed"}</span></div>
      <div class="stat"><span class="v">${ambiguous}</span>
        <span class="k">knobs that answer differently on different rows</span></div>
      <div class="stat"><span class="v">${spread}</span>
        <span class="k">what <span class="mono">drop stopwords</span> does, worst to best row</span></div>`;
    $("#preproc-note").hidden = false;
    $("#preproc-note").innerHTML = `<strong>Read the columns, not the rows.</strong>
      <span class="mono">drop stopwords</span> appears four times in the classification block and
      gives four different answers: nothing on AG News topics, <span style="color:var(--good)">+1.0</span>
      points on 700-word reviews, <span style="color:var(--bad)">−1.2</span> on 21-word sentences
      of the <em>same task</em>, <span style="color:var(--bad)">−2.2</span> on authorship — where that
      same list, used <em>alone</em>, still reaches 0.873. Document length is doing most of that work:
      one lost negation is nothing in 700 words and a large share of the evidence in 21.
      <span class="mono">Porter stemming</span> appears three times: it buys
      <span style="color:var(--good)">+1.4</span> points on 500 labelled documents, nothing on
      120 000 of them, and <span style="color:var(--good)">+1.5</span> nDCG in retrieval, where a
      query and a document have to share a surface form to match at all.
      Two rows contradict the textbook outright: shouting and punctuation do not help spam detection
      here, and lemmatising <em>lowers</em> topic coherence, because WordNet without POS tags turns
      <span class="mono">has</span> into <span class="mono">ha</span> and <span class="mono">us</span>
      into <span class="mono">u</span>. None of this is a property of a method. Every row is a property
      of the pair — what the task needs, and what the representation can still recover once you have
      thrown something away.`;
  });

  $("#btn-preproc-reset").addEventListener("click", () => {
    bets.fill(null);
    revealed = false;
    $("#preproc-score").hidden = true;
    $("#preproc-note").hidden = true;
    paint();
  });

  paint();
})();


