"use strict";
const D = JSON.parse(document.getElementById("demo-data").textContent);
const CN = D.classNames;

/* ---------------------------------------------------------------- codecs */
function b64bytes(s) {
  const bin = atob(s), out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
function f16(s) {
  const b = b64bytes(s), u = new Uint16Array(b.buffer, b.byteOffset, b.byteLength / 2);
  const out = new Float32Array(u.length);
  for (let i = 0; i < u.length; i++) {
    const h = u[i], sg = (h & 0x8000) >> 15, e = (h & 0x7c00) >> 10, f = h & 0x03ff;
    out[i] = e === 0 ? (sg ? -1 : 1) * Math.pow(2, -14) * (f / 1024)
      : e === 31 ? (f ? NaN : (sg ? -Infinity : Infinity))
        : (sg ? -1 : 1) * Math.pow(2, e - 15) * (1 + f / 1024);
  }
  return out;
}
function u16(s) {
  const b = b64bytes(s);
  return new Uint16Array(b.buffer, b.byteOffset, b.byteLength / 2);
}

/* --------------------------------------------------------------- helpers */
const $ = (s, r) => (r || document).querySelector(s);
const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const fmt = (x, d) => x == null ? "—" : Number(x).toFixed(d === undefined ? 4 : d);
const pct = x => (100 * x).toFixed(0) + "%";
const clsChip = i => `<span class="chip"><span class="dot c${i}"></span>${CN[i]}</span>`;

/* sklearn's default analyzer: lowercase, r"(?u)\b\w\w+\b" */
const TOKPAT = /[A-Za-z0-9_À-ɏЀ-ӿ]{2,}/g;
function analyze(text, ngram) {
  const uni = (String(text).toLowerCase().match(TOKPAT) || []);
  if (!ngram || ngram < 2) return uni;
  const out = uni.slice();
  for (let i = 0; i + 1 < uni.length; i++) out.push(uni[i] + " " + uni[i + 1]);
  return out;
}

/* -------------------------------------------------------------- svg draw */
const NS = "http://www.w3.org/2000/svg";
function svg(w, h, cls) {
  const s = document.createElementNS(NS, "svg");
  s.setAttribute("viewBox", `0 0 ${w} ${h}`);
  s.setAttribute("width", "100%");
  s.setAttribute("preserveAspectRatio", "xMidYMid meet");
  if (cls) s.setAttribute("class", cls);
  return s;
}
/* Colours go in as `var(--token)` so the drawing follows the viewer's theme
   without being repainted — presentation attributes cannot hold var(), so any
   paint value that is a custom property is moved into inline style instead. */
const PAINT = { fill: 1, stroke: 1, "stop-color": 1 };
function el(tag, attrs, text) {
  const n = document.createElementNS(NS, tag);
  let style = "";
  for (const k in attrs) {
    const v = attrs[k];
    if (PAINT[k] && typeof v === "string" && v.startsWith("var(")) style += `${k}:${v};`;
    else n.setAttribute(k, v);
  }
  if (style) n.setAttribute("style", style);
  if (text != null) n.textContent = text;
  return n;
}
const TIP = $("#tip");
function tipOn(node, html) {
  node.addEventListener("pointerenter", e => {
    TIP.innerHTML = html;
    TIP.style.opacity = "1";
    moveTip(e);
  });
  node.addEventListener("pointermove", moveTip);
  node.addEventListener("pointerleave", () => { TIP.style.opacity = "0"; });
}
function moveTip(e) {
  const pad = 14, r = TIP.getBoundingClientRect();
  let x = e.clientX + pad, y = e.clientY + pad;
  if (x + r.width > innerWidth - 8) x = e.clientX - r.width - pad;
  if (y + r.height > innerHeight - 8) y = e.clientY - r.height - pad;
  TIP.style.left = x + "px"; TIP.style.top = y + "px";
}

/* Greedy label placement: skip a label whose box hits one already placed. */
function placeLabels(items, put, minDx, minDy, fs) {
  const done = [];
  for (const it of items) {
    // The box has to be measured at the size the label is actually drawn at,
    // otherwise the collision test passes and the labels still overlap.
    const cw = it.cw || (fs ? fs * 0.6 : 7);
    const w = (it.text.length * cw) + 10, h = minDy || (fs ? fs * 1.15 : 11);
    const box = [it.x, it.y - h / 2, it.x + w, it.y + h / 2];
    let clash = false;
    for (const b of done) {
      if (box[0] < b[2] + (minDx || 2) && box[2] > b[0] - (minDx || 2) &&
        box[1] < b[3] + 2 && box[3] > b[1] - 2) { clash = true; break; }
    }
    if (clash) continue;
    done.push(box);
    put(it);
  }
}

/* ------------------------------------------------------------------ nav */
const SECTIONS = [
  ["hero", "The bet", null],
  ["label", "Label twelve yourself", "00"],
  ["tokens", "Tokenization", "01"],
  ["prep", "Preprocessing", "02"],
  ["tfidf", "Building TF-IDF", "03"],
  ["train", "Watch it learn", "04"],
  ["weights", "Reading the weights", "05"],
  ["attack", "Break the model", "06"],
  ["skipgram", "Skip-gram, live", "07"],
  ["space", "The embedding space", "08"],
  ["llm", "Asking an LLM", "09"],
  ["table", "The results table", "10"],
  ["ceiling", "The ceiling", "11"],
];
(function buildNav() {
  const nav = $("#nav");
  nav.innerHTML = SECTIONS.map(([id, t, n]) =>
    `<a href="#${id}" data-id="${id}"><span>${n === null ? "·" : n}</span><span>${esc(t)}</span></a>`).join("");
  const links = $$("#nav a");
  const io = new IntersectionObserver(ents => {
    ents.forEach(e => {
      if (e.isIntersecting) {
        links.forEach(a => a.classList.toggle("on", a.dataset.id === e.target.id));
      }
    });
  }, { rootMargin: "-15% 0px -70% 0px" });
  SECTIONS.forEach(([id]) => { const n = document.getElementById(id); if (n) io.observe(n); });
})();

/* theme + presentation mode */
$("#btn-theme").addEventListener("click", () => {
  const cur = document.documentElement.getAttribute("data-theme");
  const dark = cur ? cur === "dark" : matchMedia("(prefers-color-scheme: dark)").matches;
  document.documentElement.setAttribute("data-theme", dark ? "light" : "dark");
  redrawAll();
});
$("#btn-present").addEventListener("click", e => {
  document.body.classList.toggle("present");
  e.target.classList.toggle("on", document.body.classList.contains("present"));
});
addEventListener("keydown", e => {
  if (/^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement.tagName)) return;
  if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
  const ys = SECTIONS.map(([id]) => document.getElementById(id)).filter(Boolean);
  const cur = ys.findIndex(n => n.getBoundingClientRect().top > 40);
  let i = e.key === "ArrowRight" ? (cur === -1 ? ys.length - 1 : cur) : Math.max(0, (cur === -1 ? ys.length : cur) - 2);
  i = Math.max(0, Math.min(ys.length - 1, i));
  ys[i].scrollIntoView({ behavior: "smooth" });
  e.preventDefault();
});

/* charts that must be repainted when the palette changes */
const REDRAW = [];
function redrawAll() { REDRAW.forEach(f => { try { f(); } catch (_) { } }); }
function css(name) { return `var(${name})`; }

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
      score.innerHTML = TXT("label-score", { agree, pct: pct(agree / 12) });
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
          : `<span class="footnote">${TXT("tok-wordtok-note")}</span>`}</div>`).join("") +
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
    ["vocab", "Vocabulary", "tfidf-caption-vocab"],
    ["counts", "Counts", "tfidf-caption-counts"],
    ["idf", "Document frequency → IDF", "tfidf-caption-idf"],
    ["tfidf", "Multiply", "tfidf-caption-tfidf"],
    ["l2", "L2-normalize", "tfidf-caption-l2"],
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
    $("#tfidf-caption").innerHTML = TXT(STAGES[stage][2]);
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
    const the_note = jThe >= 0 ? TXT("tfidf-note-the", { w_the: V.l2[2][jThe].toFixed(3) }) : "";
    $("#tfidf-note").innerHTML = (jToday >= 0 && jRise >= 0)
      ? TXT("tfidf-note", { w_rise: V.l2[0][jRise].toFixed(3), the_note })
      : TXT("tfidf-note-edit");
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
    $("#preproc-note").innerHTML = TXT("preproc-note");
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



/* ============================================================== 05 table */
(function () {
  const R = D.results;
  let shown = 0;
  const AXES = [
    ["acc", "test accuracy", v => v.acc, x => x.toFixed(4)],
    ["f1", "macro F1", v => v.f1, x => x.toFixed(4)],
    ["cost", "vectorize + fit, seconds", v => (v.vec_s || 0) + (v.fit_s || 0), x => x.toFixed(1) + "s"],
  ];
  let axis = 0;
  $("#table-axes").innerHTML = AXES.map((a, i) =>
    `<button data-axis="${i}" ${i === 0 ? 'class="on"' : ""} style="font-size:15px">${a[1]}</button>`).join("");
  $("#table-axes").addEventListener("click", e => {
    const b = e.target.closest("button"); if (!b) return;
    axis = +b.dataset.axis;
    $$("#table-axes button").forEach(x => x.classList.toggle("on", x === b));
    paint();
  });
  $("#btn-row-next").addEventListener("click", () => { shown = Math.min(R.length, shown + 1); paint(); });
  $("#btn-row-all").addEventListener("click", () => { shown = R.length; paint(); });
  $("#btn-row-reset").addEventListener("click", () => { shown = 0; paint(); });

  function paint() {
    $("#table-shown").textContent = `${shown} / ${R.length} revealed`;
    $("#btn-row-next").disabled = shown >= R.length;
    const vis = R.slice(0, shown);
    const T = $("#table-rows");
    T.innerHTML = `<thead><tr><th>representation</th><th>head</th><th class="num">accuracy</th><th class="num">macro F1</th>
      <th class="num">vec s</th><th class="num">fit s</th><th class="num">latency</th><th>note</th></tr></thead><tbody>` +
      (vis.length ? vis.map(r => `<tr><td class="mono">${esc(r.rep)}</td><td class="mono" style="color:var(--ink-2)">${esc(r.head)}</td>
        <td class="num">${fmt(r.acc)}</td><td class="num">${fmt(r.f1)}</td>
        <td class="num">${r.vec_s == null ? "—" : r.vec_s.toFixed(1)}</td><td class="num">${r.fit_s == null ? "—" : r.fit_s.toFixed(1)}</td>
        <td class="num">${r.lat == null ? "—" : r.lat + " ms"}</td><td style="color:var(--ink-2)">${esc(r.note)}</td></tr>`).join("")
        : `<tr><td colspan="8" style="color:var(--ink-3);padding:18px 10px">${TXT("table-rows-empty")}</td></tr>`) +
      `</tbody>`;
    chart(vis);
  }

  function chart(vis) {
    const host = $("#table-chart");
    host.innerHTML = "";
    const W = 1000, rowH = 26, H = Math.max(90, 34 + R.length * rowH + 26);
    const s = svg(W, H);
    const L = 330, Rp = 64, get = AXES[axis][2], fm = AXES[axis][3];
    const vals = vis.map(get).filter(v => isFinite(v));
    if (!vals.length) {
      s.appendChild(el("text", { x: L, y: 40, "font-size": 15 }, "no rows revealed yet"));
      host.appendChild(s); return;
    }
    let lo = Math.min(...vals), hi = Math.max(...vals);
    if (axis < 2) { lo = Math.min(lo, 0.8); hi = Math.max(hi, 0.93); }
    else { lo = 0; hi = Math.max(hi, 10); }
    const pad = (hi - lo) * 0.08 || 0.01;
    lo -= pad; hi += pad;
    const x = v => L + (v - lo) / (hi - lo) * (W - L - Rp);
    const best = Math.max(...vals);

    for (let i = 0; i <= 4; i++) {
      const v = lo + (hi - lo) * i / 4;
      s.appendChild(el("line", { class: "gridline", x1: x(v), x2: x(v), y1: 20, y2: H - 24, stroke: css("--rule") }));
      s.appendChild(el("text", { x: x(v), y: H - 8, "font-size": 13.5, "text-anchor": "middle", fill: css("--ink-3") }, fm(v)));
    }
    R.forEach((r, i) => {
      const y = 34 + i * rowH;
      const revealed = i < vis.length;
      s.appendChild(el("text", { x: L - 12, y: y + 4, "font-size": 14.5, "text-anchor": "end", fill: revealed ? css("--ink-2") : css("--ink-3") },
        revealed ? `${r.rep} · ${r.head}` : "— hidden —"));
      if (!revealed) return;
      const v = get(r), cx = x(v);
      const g = el("g", {});
      g.appendChild(el("line", { x1: L, x2: cx, y1: y, y2: y, stroke: css("--rule"), "stroke-width": 1 }));
      g.appendChild(el("circle", {
        cx, cy: y, r: v === best ? 6 : 5,
        fill: v === best ? css("--ink") : css("--panel"),
        stroke: css("--ink"), "stroke-width": 2,
      }));
      g.appendChild(el("text", { x: cx + 11, y: y + 4, "font-size": 14, fill: css("--ink-2") }, fm(v)));
      tipOn(g, `<strong>${esc(r.rep)}</strong><br>${esc(r.head)}<br>accuracy ${fmt(r.acc)} · macro F1 ${fmt(r.f1)}<br>${esc(r.note)}${r.lat ? "<br>latency " + r.lat + " ms/example" : ""}`);
      s.appendChild(g);
    });
    host.appendChild(s);
  }
  REDRAW.push(() => paint());
  paint();
})();

/* ============================================================== 06 train */
(function () {
  const B = D.trainB;
  let docs = null, W = null, bias = null, hist = [], epoch = 0, running = false, raf = 0;
  const V = B.vocab.length, K = 4;

  function build() {
    if (docs) return;
    const idf = f16(B.idf);
    function pack(idsB, offsB, ys) {
      const ids = u16(idsB), offs = u16(offsB), out = [];
      let p = 0;
      for (let d = 0; d < offs.length; d++) {
        const n = offs[d], m = new Map();
        for (let k = 0; k < n; k++) { const j = ids[p + k]; m.set(j, (m.get(j) || 0) + 1); }
        p += n;
        const J = new Int32Array(m.size), X = new Float32Array(m.size);
        let t = 0, nrm = 0;
        m.forEach((c, j) => { const v = c * idf[j]; J[t] = j; X[t] = v; nrm += v * v; t++; });
        nrm = Math.sqrt(nrm) || 1;
        for (let k = 0; k < X.length; k++) X[k] /= nrm;
        out.push({ J, X, y: ys[d] });
      }
      return out;
    }
    docs = { tr: pack(B.trIds, B.trOffs, B.trY), te: pack(B.teIds, B.teOffs, B.teY) };
    reset();
  }
  function reset() {
    W = new Float32Array(K * V); bias = new Float32Array(K);
    hist = []; epoch = 0; paint();
  }
  function scores(d, out) {
    for (let c = 0; c < K; c++) {
      let s = bias[c]; const off = c * V;
      for (let k = 0; k < d.J.length; k++) s += W[off + d.J[k]] * d.X[k];
      out[c] = s;
    }
    let mx = Math.max(out[0], out[1], out[2], out[3]), sum = 0;
    for (let c = 0; c < K; c++) { out[c] = Math.exp(out[c] - mx); sum += out[c]; }
    for (let c = 0; c < K; c++) out[c] /= sum;
    return out;
  }
  function runEpoch() {
    const lr = 0.9 / (1 + 0.12 * epoch), p = new Float32Array(K);
    const order = docs.tr;
    let loss = 0;
    for (let i = order.length - 1; i > 0; i--) { const j = (Math.random() * (i + 1)) | 0; const t = order[i]; order[i] = order[j]; order[j] = t; }
    for (const d of order) {
      scores(d, p);
      loss -= Math.log(Math.max(p[d.y], 1e-12));
      for (let c = 0; c < K; c++) {
        const g = lr * ((c === d.y ? 1 : 0) - p[c]);
        if (!g) continue;
        const off = c * V;
        for (let k = 0; k < d.J.length; k++) W[off + d.J[k]] += g * d.X[k];
        bias[c] += g * 0.1;
      }
    }
    let ok = 0;
    for (const d of docs.te) { scores(d, p); let a = 0; for (let c = 1; c < K; c++) if (p[c] > p[a]) a = c; if (a === d.y) ok++; }
    epoch++;
    hist.push({ epoch, loss: loss / order.length, acc: ok / docs.te.length });
    paint();
  }
  function paint() {
    const last = hist[hist.length - 1];
    $("#tr-epoch").textContent = epoch;
    $("#tr-loss").textContent = last ? last.loss.toFixed(3) : "—";
    $("#tr-acc").textContent = last ? last.acc.toFixed(4) : "—";
    let nz = 0; if (W) for (let i = 0; i < W.length; i++) if (Math.abs(W[i]) > 1e-4) nz++;
    $("#tr-nz").textContent = nz.toLocaleString();
    curves(); histo(); words();
  }
  function curves() {
    const host = $("#train-chart"); host.innerHTML = "";
    const Wd = 440, Hd = 285, L = 66, Rr = 12, T = 20, gap = 48;
    const paneH = (Hd - T - gap - 30) / 2;
    const s = svg(Wd, Hd);
    const maxE = Math.max(12, hist.length);
    const xs = e => L + (e - 1) / Math.max(1, maxE - 1) * (Wd - L - Rr);
    function pane(y0, key, label, lo, hi, fmtv) {
      s.appendChild(el("text", { x: 4, y: y0 - 13, "font-size": 13, fill: css("--ink-3") }, label));
      s.appendChild(el("line", { x1: L, x2: Wd - Rr, y1: y0 + paneH, y2: y0 + paneH, stroke: css("--rule") }));
      [lo, (lo + hi) / 2, hi].forEach(v => {
        const y = y0 + paneH - (v - lo) / (hi - lo) * paneH;
        s.appendChild(el("line", { class: "gridline", x1: L, x2: Wd - Rr, y1: y, y2: y, stroke: css("--rule") }));
        s.appendChild(el("text", { x: L - 6, y: y + 3.5, "font-size": 12.5, "text-anchor": "end", fill: css("--ink-3") }, fmtv(v)));
      });
      if (hist.length > 1) {
        const pts = hist.map(h => `${xs(h.epoch)},${y0 + paneH - (Math.min(hi, Math.max(lo, h[key])) - lo) / (hi - lo) * paneH}`).join(" ");
        s.appendChild(el("polyline", { points: pts, fill: "none", stroke: css("--ink"), "stroke-width": 2, "stroke-linejoin": "round" }));
      }
      if (hist.length) {
        const h = hist[hist.length - 1];
        s.appendChild(el("circle", { cx: xs(h.epoch), cy: y0 + paneH - (Math.min(hi, Math.max(lo, h[key])) - lo) / (hi - lo) * paneH, r: 4, fill: css("--ink") }));
      }
    }
    pane(T + 14, "loss", "cross-entropy loss (train)", 0, 1.5, v => v.toFixed(1));
    pane(T + 14 + paneH + gap, "acc", "accuracy (2 000 held-out documents)", 0.2, 0.95, v => v.toFixed(2));
    s.appendChild(el("text", { x: (L + Wd) / 2, y: Hd - 3, "font-size": 13, "text-anchor": "middle", fill: css("--ink-3") }, "epoch"));
    host.appendChild(s);
  }
  function histo() {
    const host = $("#train-hist"); host.innerHTML = "";
    const Wd = 440, Hd = 285, L = 44, Rr = 12, T = 22, Bm = 40;
    const s = svg(Wd, Hd);
    const NB = 34, hi = 3.2, bins = new Float64Array(NB);
    if (W) for (let i = 0; i < W.length; i++) {
      const a = Math.abs(W[i]);
      bins[Math.min(NB - 1, Math.floor(a / hi * NB))]++;
    }
    const mx = Math.max(1, ...bins.slice(1));
    const bw = (Wd - L - Rr) / NB;
    for (let i = 0; i < NB; i++) {
      const h = bins[i] ? Math.max(1.5, bins[i] / mx * (Hd - T - Bm)) : 0;
      const g = el("g", {});
      g.appendChild(el("rect", {
        x: L + i * bw + 1, y: Hd - Bm - h, width: Math.max(1, bw - 2), height: h,
        fill: i === 0 ? css("--ink-3") : css("--ink-2"), rx: 1.5,
      }));
      tipOn(g, `|w| ∈ [${(i * hi / NB).toFixed(2)}, ${((i + 1) * hi / NB).toFixed(2)})<br>${Math.round(bins[i]).toLocaleString()} coefficients`);
      s.appendChild(g);
    }
    s.appendChild(el("line", { x1: L, x2: Wd - Rr, y1: Hd - Bm, y2: Hd - Bm, stroke: css("--rule") }));
    [0, hi / 2, hi].forEach((v, i) => s.appendChild(el("text", {
      x: L + (v / hi) * (Wd - L - Rr), y: Hd - Bm + 18, "font-size": 12.5,
      "text-anchor": i === 0 ? "start" : i === 2 ? "end" : "middle", fill: css("--ink-3"),
    }, v.toFixed(1))));
    s.appendChild(el("text", { x: L, y: T - 4, "font-size": 13, fill: css("--ink-3") },
      `first bar: ${Math.round(bins[0]).toLocaleString()} of ${(K * V).toLocaleString()} still at zero`));
    s.appendChild(el("text", { x: (L + Wd) / 2, y: Hd - 4, "font-size": 13, "text-anchor": "middle", fill: css("--ink-3") }, "|coefficient|"));
    host.appendChild(s);
  }
  function words() {
    const host = $("#train-words");
    const cols = [];
    for (let c = 0; c < K; c++) {
      let top = [];
      if (W) {
        const off = c * V;
        const idx = Array.from({ length: V }, (_, j) => j);
        idx.sort((a, b) => W[off + b] - W[off + a]);
        top = idx.slice(0, 8).filter(j => W[off + j] > 1e-3)
          .map(j => ({ w: B.vocab[j], v: W[off + j] }));
      }
      const mx = top.length ? top[0].v : 1;
      cols.push(`<div>
        <div style="display:flex;align-items:center;gap:7px;margin-bottom:8px">
          <span class="dot c${c}"></span><span class="mono" style="font-size:14.5px">${CN[c]}</span></div>
        ${top.length ? top.map(t => `
          <div style="display:grid;grid-template-columns:1fr 42px;gap:6px;align-items:center;margin-bottom:3px">
            <div style="position:relative;padding:1px 5px">
              <div style="position:absolute;inset:0;background:var(--cls-${c});opacity:.14;width:${(t.v / mx * 100).toFixed(0)}%;border-radius:2px"></div>
              <span class="mono" style="position:relative;font-size:15px">${esc(t.w)}</span></div>
            <span class="mono" style="font-size:14px;color:var(--ink-3);text-align:right">${t.v.toFixed(2)}</span>
          </div>`).join("")
          : `<div class="mono" style="font-size:14.5px;color:var(--ink-3)">all coefficients are zero</div>`}
      </div>`);
    }
    host.innerHTML = cols.join("");
  }
  function loop() {
    if (!running) return;
    runEpoch();
    if (epoch >= 30) { stop(); return; }
    raf = requestAnimationFrame(loop);
  }
  function stop() { running = false; cancelAnimationFrame(raf); $("#btn-train-run").textContent = "Train"; $("#btn-train-run").classList.remove("on"); }
  $("#btn-train-run").addEventListener("click", () => {
    build();
    if (running) { stop(); return; }
    if (epoch >= 30) reset();
    running = true; $("#btn-train-run").textContent = "Pause"; $("#btn-train-run").classList.add("on");
    raf = requestAnimationFrame(loop);
  });
  $("#btn-train-step").addEventListener("click", () => { build(); stop(); runEpoch(); });
  $("#btn-train-reset").addEventListener("click", () => { build(); stop(); reset(); });
  REDRAW.push(() => { if (docs) paint(); });
  paint();
})();

/* ============================================================ 07 weights */
(function () {
  let order = [0, 1, 2, 3], picks = [null, null, null, null], revealed = false;
  const guessNote0 = $("#guess-note").innerHTML;
  function shuffle() {
    order = [0, 1, 2, 3];
    for (let i = 3; i > 0; i--) { const j = (Math.random() * (i + 1)) | 0; [order[i], order[j]] = [order[j], order[i]]; }
    picks = [null, null, null, null]; revealed = false; paint();
  }
  function paint() {
    $("#guess-cols").innerHTML = order.map((cls, slot) => {
      const letter = String.fromCharCode(65 + slot);
      const picked = picks[slot];
      return `<div style="border:1px solid var(--rule);border-radius:3px;padding:11px">
        <div class="mono" style="font-size:14.5px;letter-spacing:.1em;color:var(--ink-3);margin-bottom:8px">column ${letter}</div>
        <div style="font-family:var(--mono);font-size:15px;line-height:1.85;margin-bottom:10px">
          ${D.topFeatures[cls].map(f => esc(f.w)).join("<br>")}
        </div>
        ${revealed
          ? `<div style="border-top:1px solid var(--rule);padding-top:8px">
               <span class="chip"><span class="dot c${cls}"></span>${CN[cls]}</span>
               ${picked != null ? `<div class="mono" style="font-size:14px;margin-top:6px;color:${picked === cls ? "var(--good)" : "var(--bad)"}">you said ${CN[picked]}</div>` : ""}</div>`
          : `<select data-slot="${slot}" style="font-size:15px">
               <option value="">— your guess —</option>
               ${CN.map((c, i) => `<option value="${i}" ${picked === i ? "selected" : ""}>${c}</option>`).join("")}
             </select>`}
      </div>`;
    }).join("");
  }
  $("#guess-cols").addEventListener("change", e => {
    const s = e.target.closest("select[data-slot]"); if (!s) return;
    picks[+s.dataset.slot] = s.value === "" ? null : +s.value;
  });
  $("#btn-guess-reveal").addEventListener("click", () => {
    revealed = true; paint();
    const hits = picks.filter((p, s) => p === order[s]).length;
    const any = picks.some(p => p !== null);
    const score = any ? TXT("guess-note-hits", { hits }) + " " : "";
    $("#guess-note").innerHTML = TXT("guess-note-reveal", { score });
  });
  $("#btn-guess-reset").addEventListener("click", () => { shuffle(); $("#guess-note").innerHTML = guessNote0; });
  shuffle();

  /* the (Reuters) shortcut */
  $("#first-doc").textContent = D.shortcut.firstDoc.slice(0, 150);
  $("#shortcut-coverage").textContent = `${pct(D.shortcut.coverage)} of training rows carry a marker`;
  const ct = D.shortcut.crosstab;
  $("#shortcut-table").innerHTML =
    `<thead><tr><th>source</th>${CN.map(c => `<th class="num">${c}</th>`).join("")}<th class="num">total</th><th style="width:150px">share</th></tr></thead><tbody>` +
    ct.map(r => {
      const parts = CN.map(c => r[c] / r.total);
      return `<tr><td class="mono">${esc(r.src)}</td>${CN.map(c => `<td class="num">${r[c].toLocaleString()}</td>`).join("")}
        <td class="num" style="color:var(--ink-2)">${r.total.toLocaleString()}</td>
        <td><div style="display:flex;height:10px;border-radius:2px;overflow:hidden;gap:2px">
          ${parts.map((p, i) => p > 0 ? `<div style="width:${(p * 100).toFixed(1)}%;background:var(--cls-${i})" title="${CN[i]} ${pct(p)}"></div>` : "").join("")}
        </div></td></tr>`;
    }).join("") + `</tbody>`;

  $("#bet-marker").addEventListener("input", e => { $("#bet-marker-v").textContent = e.target.value; });
  $("#bet-strip").addEventListener("input", e => { $("#bet-strip-v").textContent = e.target.value; });
  $("#btn-shortcut-reveal").addEventListener("click", () => {
    const S = D.shortcut;
    const guessM = +$("#bet-marker").value / 100, guessS = +$("#bet-strip").value / 100;
    const lostReal = S.rawAcc - S.strippedAcc;
    const rows = [
      ["majority baseline", S.majority, null],
      ["ONLY the source marker", S.markerOnlyAcc, `dim=${S.markerOnlyDim}`],
      ["raw text", S.rawAcc, "dim=29,350"],
      ["source markers stripped", S.strippedAcc, `dim=${S.strippedDim.toLocaleString()}`],
    ];
    $("#shortcut-result").hidden = false;
    $("#shortcut-note").hidden = false;
    $("#shortcut-result").innerHTML = `
      <table><thead><tr><th>experiment</th><th class="num">test accuracy</th><th>note</th></tr></thead><tbody>
      ${rows.map(r => `<tr><td class="mono">${esc(r[0])}</td><td class="num">${fmt(r[1])}</td><td style="color:var(--ink-2)">${r[2] ? esc(r[2]) : ""}</td></tr>`).join("")}
      </tbody></table>
      <div class="stat-row" style="margin-top:18px">
        <div class="stat"><span class="v">${pct(S.markerOnlyAcc)}</span><span class="k">marker alone · you guessed ${pct(guessM)}</span></div>
        <div class="stat"><span class="v">−${(lostReal * 100).toFixed(2)} pts</span><span class="k">lost by stripping · you guessed −${(guessS * 100).toFixed(0)} pts</span></div>
      </div>
      <div class="footnote" style="margin-top:12px">${TXT("shortcut-result-first", { example: esc(D.shortcut.stripExample.slice(0, 140)) })}</div>`;
  });
})();

/* =========================================================== 08 attack */
const MODEL = {
  ready: false,
  init() {
    if (this.ready) return;
    this.idf = f16(D.model.idf);
    this.coef = f16(D.model.coef);
    this.b = D.model.intercept;
    this.V = D.model.vocab.length;
    this.idx = new Map();
    D.model.vocab.forEach((w, i) => this.idx.set(w, i));
    this.ready = true;
  },
  vectorize(text) {
    this.init();
    const toks = analyze(text, 1), m = new Map();
    for (const t of toks) { const j = this.idx.get(t); if (j !== undefined) m.set(j, (m.get(j) || 0) + 1); }
    const J = [], X = [];
    let nrm = 0;
    m.forEach((c, j) => { const v = c * this.idf[j]; J.push(j); X.push(v); nrm += v * v; });
    nrm = Math.sqrt(nrm) || 1;
    for (let i = 0; i < X.length; i++) X[i] /= nrm;
    return { J, X, toks, oov: toks.filter(t => !this.idx.has(t)) };
  },
  proba(text) {
    const v = this.vectorize(text), p = new Float64Array(4);
    for (let c = 0; c < 4; c++) {
      let s = this.b[c];
      for (let k = 0; k < v.J.length; k++) s += this.coef[c * this.V + v.J[k]] * v.X[k];
      p[c] = s;
    }
    const mx = Math.max(...p); let sum = 0;
    for (let c = 0; c < 4; c++) { p[c] = Math.exp(p[c] - mx); sum += p[c]; }
    for (let c = 0; c < 4; c++) p[c] /= sum;
    return { p, v };
  },
};

(function () {
  const PRESETS = [
    "Apple sued over patent dispute in federal court",
    "Russia and Ukraine agree on grain shipping corridor",
    "Oil prices soar to an all-time record high",
    "Manchester United shares jump after takeover bid",
  ];
  $("#attack-presets").innerHTML = PRESETS.map((p, i) =>
    `<button data-p="${i}" style="font-size:15px">${esc(p.length > 46 ? p.slice(0, 44) + "…" : p)}</button>`).join("");
  $("#attack-presets").addEventListener("click", e => {
    const b = e.target.closest("button"); if (!b) return;
    $("#attack-input").value = PRESETS[+b.dataset.p]; run();
  });
  $("#attack-input").addEventListener("input", run);

  function run() {
    const text = $("#attack-input").value;
    const t0 = performance.now();
    const { p, v } = MODEL.proba(text);
    const ms = performance.now() - t0;
    let top = 0; for (let c = 1; c < 4; c++) if (p[c] > p[top]) top = c;
    $("#attack-timing").textContent = `${ms.toFixed(2)} ms · ${v.J.length} non-zero features`;

    $("#attack-probs").innerHTML = `
      <div style="display:flex;align-items:baseline;gap:12px;margin-bottom:14px;flex-wrap:wrap">
        <span class="mono" style="font-size:14px;letter-spacing:.1em;color:var(--ink-3)">PREDICTION</span>
        ${clsChip(top)}
        <span class="mono" style="font-size:15.9px">confidence ${p[top].toFixed(2)}</span>
        ${p[top] > 0.8 ? `<span class="chip" style="border-color:var(--bad);color:var(--bad)">confident — if it is wrong, you broke it</span>` : ""}
      </div>` +
      CN.map((c, i) => `
        <div style="display:grid;grid-template-columns:82px 1fr 58px;gap:10px;align-items:center;margin-bottom:5px">
          <span class="mono" style="font-size:15px">${c}</span>
          <div style="height:12px;background:var(--panel-sunk);border-radius:2px;overflow:hidden">
            <div style="height:100%;width:${(p[i] * 100).toFixed(1)}%;background:var(--cls-${i});border-radius:2px"></div></div>
          <span class="mono num" style="font-size:15px;text-align:right;font-variant-numeric:tabular-nums">${p[i].toFixed(3)}</span>
        </div>`).join("");

    /* contributions of every token, coef x tfidf, for the predicted class */
    const contrib = new Map();
    for (let k = 0; k < v.J.length; k++) {
      const j = v.J[k], w = D.model.vocab[j];
      contrib.set(w, MODEL.coef[top * MODEL.V + j] * v.X[k]);
    }
    const mx = Math.max(1e-9, ...Array.from(contrib.values(), Math.abs));
    $("#attack-words").innerHTML = v.toks.map(t => {
      if (!contrib.has(t)) return `<span class="tok" style="opacity:.4" title="not in the 29,350-word vocabulary">${esc(t)}</span>`;
      const c = contrib.get(t), a = Math.abs(c) / mx;
      const col = c > 0 ? `var(--cls-${top})` : "var(--ink-3)";
      return `<button class="tok" data-word="${esc(t)}" style="cursor:pointer;border-color:${col};
        background:color-mix(in srgb, ${col} ${(a * 26).toFixed(0)}%, var(--panel))"
        title="${c > 0 ? "+" : ""}${c.toFixed(3)} logits towards ${CN[top]} — click to delete">${esc(t)}<span style="opacity:.55;font-size:13px"> ${c > 0 ? "+" : ""}${c.toFixed(2)}</span></button>`;
    }).join("") + (v.oov.length ? `<div class="footnote" style="margin-top:8px">out of vocabulary: ${v.oov.map(o => `<span class="mono">${esc(o)}</span>`).join(", ")}</div>` : "");
    $("#attack-occl").innerHTML = "";
  }

  $("#attack-words").addEventListener("click", e => {
    const b = e.target.closest("button[data-word]"); if (!b) return;
    const word = b.dataset.word, text = $("#attack-input").value;
    const stripped = text.replace(new RegExp(`\\b${word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "gi"), " ");
    const full = MODEL.proba(text), less = MODEL.proba(stripped);
    let top = 0; for (let c = 1; c < 4; c++) if (full.p[c] > full.p[top]) top = c;
    const d = full.p[top] - less.p[top];
    $("#attack-occl").innerHTML = `
      <div class="mono" style="font-size:15.4px;line-height:1.9;border-top:1px solid var(--rule);padding-top:10px">
        delete <strong>${esc(word)}</strong> →
        P(${CN[top]}) ${full.p[top].toFixed(3)} → ${less.p[top].toFixed(3)}
        <span style="color:${d > 0 ? "var(--good)" : "var(--bad)"}">(${d > 0 ? "−" : "+"}${Math.abs(d).toFixed(3)})</span><br>
        <span style="color:var(--ink-3)">without it: ${CN.map((c, i) => `${c} ${less.p[i].toFixed(2)}`).join(" · ")}</span>
      </div>`;
  });
  run();
})();

/* =========================================================== 09 skipgram */
(function () {
  const C = D.trainC, V = C.vocab.length, DIM = 24, WIN = 2, NEG = 5;
  const ids = u16(C.ids), lens = u16(C.lens);
  const STOP = new Set(C.stopIds);

  /* ---- the window animation ------------------------------------------ */
  const sample = C.sampleDoc;
  let wpos = 0, wtimer = 0;
  function drawWindow() {
    $("#window-text").innerHTML = sample.map((w, i) => {
      const centre = i === wpos, ctx = !centre && Math.abs(i - wpos) <= WIN;
      return `<span class="tok" style="${centre ? "border-color:var(--ink);background:var(--ink);color:var(--ground);font-weight:600"
        : ctx ? "border-color:var(--ink-3);background:var(--panel-sunk)" : "opacity:.4"}">${esc(w)}</span>`;
    }).join("");
    const pairs = [];
    for (let d = -WIN; d <= WIN; d++) {
      const j = wpos + d;
      if (d === 0 || j < 0 || j >= sample.length) continue;
      pairs.push([sample[wpos], sample[j]]);
    }
    const negs = [];
    for (let k = 0; k < 3; k++) negs.push(C.vocab[(Math.random() * V) | 0]);
    $("#window-pairs").innerHTML = `
      <div class="grid-2">
        <div><div class="eyebrow" style="margin-bottom:8px">positive pairs from this position</div>
          ${pairs.map(p => `<div class="mono" style="font-size:15.4px;line-height:1.9">(${esc(p[0])}, ${esc(p[1])}) → <span style="color:var(--good)">1</span></div>`).join("")}</div>
        <div><div class="eyebrow" style="margin-bottom:8px">negative samples drawn from the corpus</div>
          ${negs.map(n => `<div class="mono" style="font-size:15.4px;line-height:1.9">(${esc(sample[wpos])}, ${esc(n)}) → <span style="color:var(--bad)">0</span></div>`).join("")}</div>
      </div>
      <div class="footnote" style="margin-top:12px">${TXT("window-pairs-note")}</div>`;
  }
  function moveWindow(d) {
    wpos = d === 0 ? 0 : (wpos + d + sample.length) % sample.length;
    ARCH.for = null;
    drawWindow(); drawArch();
  }
  $("#btn-win-step").addEventListener("click", () => moveWindow(1));
  $("#btn-win-back").addEventListener("click", () => moveWindow(-1));
  $("#btn-win-reset").addEventListener("click", () => moveWindow(0));
  $("#btn-arch-step").addEventListener("click", () => moveWindow(1));
  $("#btn-arch-back").addEventListener("click", () => moveWindow(-1));
  $("#btn-arch-mode").addEventListener("click", e => {
    ARCH.mode = ARCH.mode === "softmax" ? "neg" : "softmax";
    e.target.textContent = "output: " + (ARCH.mode === "softmax" ? "full softmax" : "negative sampling");
    e.target.classList.toggle("on", ARCH.mode === "softmax");
    drawArch();
  });
  $("#btn-arch-math").addEventListener("click", e => {
    const box = $("#sg-math");
    box.hidden = !box.hidden;
    e.target.classList.toggle("on", !box.hidden);
    e.target.textContent = box.hidden ? "Show the loss and its gradient" : "Hide the loss and its gradient";
    drawArch();
  });

  /* ---- the architecture, drawn from the live matrices ------------------ */
  const ARCH = { neg: null, mode: "neg" };
  function vecOf(M, i, n) {
    const out = new Float32Array(n);
    if (M) for (let d = 0; d < n; d++) out[d] = M[i * n + d];
    return out;
  }
  function strip(s, x, y, vals, cellW, cellH, scale) {
    vals.forEach((v, d) => {
      const a = Math.min(1, Math.abs(v) / scale);
      const cx = x + d * cellW;
      s.appendChild(el("rect", {
        x: cx, y, width: cellW - 1.2, height: cellH, rx: 1,
        fill: v >= 0 ? css("--ink") : "url(#neghatch)",
        "fill-opacity": v >= 0 ? (0.3 + 0.7 * a).toFixed(3) : 1,
        opacity: v >= 0 ? 1 : (0.4 + 0.6 * a).toFixed(3),
        stroke: css("--rule"), "stroke-width": 0.5,
      }));
    });
  }
  function drawArch() {
    const host = $("#sg-arch"); if (!host) return;
    host.innerHTML = "";
    const Wd = ARCH.mode === "softmax" ? 1090 : 940, Hd = 440;
    const s = svg(Wd, Hd);
    s.setAttribute("role", "img");
    s.setAttribute("aria-label",
      "Skip-gram with negative sampling. W_in and W_out both hold one row per vocabulary word in the same order. The centre word indexes its row of W_in, the context word and a negative sample index their rows of W_out, and each pair is scored by a dot product passed through a sigmoid against a target of 1 or 0.");
    const defs = el("defs", {});
    const pat = el("pattern", { id: "neghatch", width: 4, height: 4, patternUnits: "userSpaceOnUse", patternTransform: "rotate(45)" });
    pat.appendChild(el("rect", { width: 4, height: 4, fill: css("--panel") }));
    pat.appendChild(el("line", { x1: 0, y1: 0, x2: 0, y2: 4, stroke: css("--ink"), "stroke-width": 2 }));
    defs.appendChild(pat);
    const mk = el("marker", { id: "ah", viewBox: "0 0 10 10", refX: 9, refY: 5, markerWidth: 6, markerHeight: 6, orient: "auto-start-reverse" });
    mk.appendChild(el("path", { d: "M 0 0 L 10 5 L 0 10 z", fill: css("--ink-2") }));
    defs.appendChild(mk);
    s.appendChild(defs);

    const centre = sample[wpos];
    const ctxPos = wpos + 1 < sample.length ? wpos + 1 : wpos - 1;
    const context = sample[ctxPos];
    if (!ARCH.neg || ARCH.for !== centre) { ARCH.neg = C.vocab[(Math.random() * V) | 0]; ARCH.for = centre; }
    const negWord = ARCH.neg;
    const iC = Math.max(0, C.vocab.indexOf(centre));
    const iO = Math.max(0, C.vocab.indexOf(context));
    const iN = Math.max(0, C.vocab.indexOf(negWord));
    const vC = vecOf(Win, iC, DIM), uO = vecOf(Wout, iO, DIM), uN = vecOf(Wout, iN, DIM);
    let scale = 0;
    for (const arr of [vC, uO, uN]) for (const v of arr) scale = Math.max(scale, Math.abs(v));
    scale = scale || 1;

    const arrow = (x1, y1, x2, y2, label) => {
      s.appendChild(el("line", { x1, y1, x2, y2, stroke: css("--ink-2"), "stroke-width": 1.4, "marker-end": "url(#ah)" }));
      if (label) s.appendChild(el("text", { x: x2 - 2, y: y1 - 21, "font-size": 11, "text-anchor": "end", fill: css("--ink-3") }, label));
    };

    /* the two tables, drawn as what they are: one row per vocabulary word */
    const MX = 236, MW = 128;
    const softmaxMode = ARCH.mode === "softmax";
    const tables = [
      { y: 52, h: 84, name: "W_in", rows: [{ i: iC, w: centre, live: true }, { i: iO, w: context, live: false }] },
      {
        y: 206, h: 176, name: "W_out", all: softmaxMode,
        rows: softmaxMode
          ? [{ i: iO, w: context, live: true }]
          : [{ i: iO, w: context, live: true }, { i: iN, w: negWord, live: true }, { i: iC, w: centre, live: false }],
      },
    ];
    tables.forEach(t => {
      s.appendChild(el("rect", { x: MX, y: t.y, width: MW, height: t.h, fill: css("--panel-sunk"), stroke: css("--rule-strong"), rx: 2 }));
      for (let k = 1; k < 14; k++) {
        const yy = t.y + (t.h * k) / 14;
        s.appendChild(el("line", {
          x1: MX + 1, x2: MX + MW - 1, y1: yy, y2: yy,
          stroke: t.all ? css("--ink-3") : css("--rule"), "stroke-width": t.all ? 1.6 : 0.6,
        }));
      }
      if (t.all) {
        s.appendChild(el("text", { x: MX + MW + 10, y: t.y + t.h / 2 - 5, "font-size": 10.5, fill: css("--ink-2") },
          "every row is read"));
        s.appendChild(el("text", { x: MX + MW + 10, y: t.y + t.h / 2 + 9, "font-size": 10.5, fill: css("--ink-2") },
          "and every row is updated"));
      }
      t.rows.forEach(r => {
        const yy = t.y + 6 + (t.h - 12) * (r.i / V);
        s.appendChild(el("rect", {
          x: MX + 1, y: yy - 3, width: MW - 2, height: 6,
          fill: r.live ? css("--ink") : css("--ink-3"), opacity: r.live ? 1 : 0.45,
        }));

      });
      s.appendChild(el("text", { x: MX + MW / 2, y: t.y - 17, "font-size": 14, "text-anchor": "middle", fill: css("--ink"), "font-weight": 600, "font-family": "monospace" }, t.name));
      s.appendChild(el("text", { x: MX + MW / 2, y: t.y - 4, "font-size": 10.5, "text-anchor": "middle", fill: css("--ink-3") }, "1 500 × 24"));
    });
    /* the spine that says both tables are indexed by the same vocabulary */
    s.appendChild(el("path", {
      d: "M " + (MX - 10) + " 52 L " + (MX - 16) + " 52 L " + (MX - 16) + " 382 L " + (MX - 10) + " 382",
      fill: "none", stroke: css("--ink-3"), "stroke-width": 1.2,
    }));
    s.appendChild(el("text", { x: MX - 22, y: 398, "font-size": 10.5, fill: css("--ink-2") },
      "one row per vocabulary word, in the same order in both tables"));
    s.appendChild(el("text", { x: MX - 22, y: 412, "font-size": 10.5, fill: css("--ink-3") },
      "faint row = that word's other vector, not touched by this step"));

    /* the rows of one training step — the negative row only exists in sampling mode */
    const CW = 9.6, CH = 30, SX = 404;
    const softmax = ARCH.mode === "softmax";
    const rows = softmax
      ? [{ y: 94, word: centre, role: "centre word", vals: vC, tag: "h = v_c", idx: iC }]
      : [
        { y: 94, word: centre, role: "centre word", vals: vC, tag: "h = v_c", idx: iC },
        { y: 252, word: context, role: "context word", vals: uO, tag: "u_o", idx: iO, target: 1 },
        { y: 338, word: negWord, role: "negative sample", vals: uN, tag: "u_n", idx: iN, target: 0 },
      ];
    rows.forEach(r => {
      s.appendChild(el("text", { x: 14, y: r.y + 3, "font-size": 14, fill: css("--ink"), "font-weight": 600, "font-family": "monospace" }, r.word));
      s.appendChild(el("text", { x: 14, y: r.y + 19, "font-size": 10.5, fill: css("--ink-3") }, r.role));
      const ohx = 172, ohh = 56, ohy = r.y - 28;
      s.appendChild(el("rect", { x: ohx, y: ohy, width: 15, height: ohh, fill: css("--panel"), stroke: css("--rule-strong") }));
      s.appendChild(el("rect", { x: ohx, y: ohy + ohh * (r.idx / V), width: 15, height: 4, fill: css("--ink") }));
      s.appendChild(el("text", { x: ohx + 7.5, y: ohy + ohh + 12, "font-size": 10, "text-anchor": "middle", fill: css("--ink-3") }, "one-hot"));
      arrow(ohx + 17, r.y, MX - 2, r.y, null);
      arrow(MX + MW + 2, r.y, SX - 6, r.y, "row lookup");
      strip(s, SX, r.y - CH / 2, r.vals, CW, CH, scale);
      s.appendChild(el("text", { x: SX, y: r.y - CH / 2 - 8, "font-size": 11.5, fill: css("--ink-3") }, r.tag + " ∈ R²⁴"));
    });

    /* scoring, stacked so nothing runs past the edge */
    const dot = (a, b) => { let t = 0; for (let d = 0; d < DIM; d++) t += a[d] * b[d]; return t; };
    const sig = z => 1 / (1 + Math.exp(-z));
    const RX = 660;

    if (softmax) {
      /* u = W_out · h over the whole vocabulary, then a real softmax over V */
      const u = new Float64Array(V);
      let mx = -Infinity;
      for (let j = 0; j < V; j++) {
        let t = 0;
        for (let d = 0; d < DIM; d++) t += vC[d] * Wout[j * DIM + d];
        u[j] = t; if (t > mx) mx = t;
      }
      let sum = 0;
      for (let j = 0; j < V; j++) { u[j] = Math.exp(u[j] - mx); sum += u[j]; }
      for (let j = 0; j < V; j++) u[j] /= sum;
      const order = Array.from({ length: V }, (_, j) => j).sort((a, b) => u[b] - u[a]);
      const rank = order.indexOf(iO) + 1;

      /* the score vector, as tall as the vocabulary */
      const VX = SX + DIM * CW + 46, VY = 60, VH = 250;
      s.appendChild(el("rect", { x: VX, y: VY, width: 20, height: VH, fill: css("--panel"), stroke: css("--rule-strong") }));
      const pmax = u[order[0]] || 1;
      for (let j = 0; j < V; j += 3) {
        const a = u[j] / pmax;
        if (a < 0.02) continue;
        s.appendChild(el("rect", {
          x: VX + 1, y: VY + (VH - 2) * (j / V), width: 18, height: 1.6,
          fill: css("--ink"), opacity: (0.15 + 0.85 * a).toFixed(3),
        }));
      }
      s.appendChild(el("rect", { x: VX - 4, y: VY + (VH - 2) * (iO / V) - 1.5, width: 28, height: 4, fill: css("--good") }));
      arrow(SX + DIM * CW + 8, 94, VX - 8, 94, null);
      s.appendChild(el("text", { x: VX + 10, y: VY - 34, "font-size": 11.5, "text-anchor": "middle", fill: css("--ink-3") }, "ŷ = softmax(u)"));
      s.appendChild(el("text", { x: VX + 10, y: VY - 21, "font-size": 10.5, "text-anchor": "middle", fill: css("--ink-3") }, "one entry per word"));
      s.appendChild(el("text", { x: VX + 10, y: VY + VH + 14, "font-size": 10, "text-anchor": "middle", fill: css("--good") }, "the true context word"));

      /* what the model would actually answer */
      const LX = VX + 54;
      s.appendChild(el("text", { x: LX, y: VY - 7, "font-size": 11.5, fill: css("--ink-3") }, "most probable next-door words"));
      order.slice(0, 7).forEach((j, i) => {
        const y = VY + 14 + i * 21, w = Math.max(2, (u[j] / pmax) * 92);
        const isTarget = j === iO;
        s.appendChild(el("rect", { x: LX, y: y - 9, width: w, height: 12, rx: 2, fill: isTarget ? css("--good") : css("--ink-3") }));
        s.appendChild(el("text", { x: LX + 100, y: y + 1, "font-size": 11.5, "font-family": "monospace", fill: isTarget ? css("--ink") : css("--ink-2") },
          C.vocab[j] + "  " + u[j].toFixed(4)));
      });
      s.appendChild(el("text", { x: LX, y: VY + 14 + 7 * 21 + 8, "font-size": 11, fill: css("--ink-2") },
        "target " + context + ": p = " + u[iO].toFixed(5) + ", rank " + rank + " of " + V));
      s.appendChild(el("text", { x: LX, y: VY + 14 + 7 * 21 + 24, "font-size": 11, fill: css("--ink-3") },
        "chance alone would be " + (1 / V).toFixed(5)));
      s.appendChild(el("text", { x: MX - 22, y: 430, "font-size": 11, "font-weight": 600, fill: css("--ink-2") },
        "cost: one pair touches all " + V.toLocaleString() + " rows of W_out — this is what negative sampling removes"));
      host.appendChild(s);
      drawMath(vC, uO, uN, dot, sig, centre, context, negWord, u, iO);
      return;
    }

    [rows[1], rows[2]].forEach(r => {
      const z = dot(vC, r.vals), p = sig(z), y = r.y;
      s.appendChild(el("path", {
        d: "M " + (SX + DIM * CW + 8) + " " + rows[0].y + " C " + (RX - 74) + " " + rows[0].y + ", " + (RX - 74) + " " + y + ", " + (RX - 10) + " " + y,
        fill: "none", stroke: css("--ink-2"), "stroke-width": 1.4, "marker-end": "url(#ah)",
      }));
      s.appendChild(el("text", { x: RX, y: y - 15, "font-size": 12.5, "font-family": "monospace", fill: css("--ink") },
        "v_c · " + r.tag + " = " + z.toFixed(3)));
      s.appendChild(el("text", { x: RX, y: y + 3, "font-size": 12.5, "font-family": "monospace", fill: css("--ink") },
        "σ = " + p.toFixed(3)));
      s.appendChild(el("text", { x: RX + 100, y: y + 3, "font-size": 12.5, "font-family": "monospace", fill: r.target ? css("--good") : css("--bad") },
        "target " + r.target));
      s.appendChild(el("text", { x: RX, y: y + 21, "font-size": 11.5, fill: css("--ink-2") },
        r.target ? "→ pull the two rows together" : "→ push the two rows apart"));
    });

    const LGX = 626;
    s.appendChild(el("rect", { x: LGX, y: Hd - 26, width: 14, height: 12, fill: css("--ink"), rx: 1 }));
    s.appendChild(el("text", { x: LGX + 20, y: Hd - 16, "font-size": 11, fill: css("--ink-3") }, "positive"));
    s.appendChild(el("rect", { x: LGX + 84, y: Hd - 26, width: 14, height: 12, fill: "url(#neghatch)", stroke: css("--rule"), rx: 1 }));
    s.appendChild(el("text", { x: LGX + 104, y: Hd - 16, "font-size": 11, fill: css("--ink-3") }, "negative · shade = magnitude"));
    host.appendChild(s);

    drawMath(vC, uO, uN, dot, sig, centre, context, negWord);
  }

  /* the objective and its gradient, on the pair currently in the diagram */
  function drawMath(vC, uO, uN, dot, sig, centre, context, negWord, yhat, iO) {
    const box = $("#sg-math"); if (!box || box.hidden) return;
    const row = (a, b) => '<tr><td class="mono" style="font-size:15.4px;white-space:nowrap">' + a +
      '</td><td class="mono" style="font-size:15.4px;color:var(--ink-2)">' + b + "</td></tr>";
    if (yhat) {
      const p = yhat[iO], loss = -Math.log(Math.max(1e-12, p));
      box.innerHTML =
        '<div class="eyebrow" style="margin:20px 0 8px">What the step optimises · full softmax</div>' +
        '<div class="scroll-x"><table>' +
        row("u = W_out · h", "1 500 scores, one per vocabulary word") +
        row("ŷ = softmax(u)", "a distribution over the whole vocabulary") +
        row("L = −log ŷ[" + esc(context) + "]", "= −log(" + p.toFixed(5) + ") = " + loss.toFixed(3)) +
        row("∂L/∂u = ŷ − y", "y is the one-hot of " + esc(context) + "; every entry is non-zero") +
        row("∂L/∂W_out[j] = (ŷⱼ − yⱼ) · h", "for every j — all 1 500 rows move on this one pair") +
        row("∂L/∂h = W_outᵀ (ŷ − y)", "reads the whole table back") +
        "</table></div>" +
        '<div class="footnote" style="margin-top:10px">' + TXT("sg-math-softmax-note") + "</div>";
      return;
    }
    const zo = dot(vC, uO), zn = dot(vC, uN), po = sig(zo), pn = sig(zn);
    const loss = -Math.log(Math.max(1e-9, po)) - Math.log(Math.max(1e-9, 1 - pn));
    const co = po - 1, cn = pn;
    let gn = 0;
    for (let d = 0; d < DIM; d++) { const g = co * uO[d] + cn * uN[d]; gn += g * g; }
    gn = Math.sqrt(gn);
    const lr = 0.05 * Math.max(0.15, 1 - epoch / 14);
    box.innerHTML =
      '<div class="eyebrow" style="margin:20px 0 8px">What the step optimises, for this pair</div>' +
      '<div class="scroll-x"><table>' +
      row("L = −log σ(v_c · u_o) − Σⱼ log σ(−v_c · u_nⱼ)",
        "= −log(" + po.toFixed(3) + ") − log(" + (1 - pn).toFixed(3) + ") = " + loss.toFixed(3)) +
      row("∂L/∂u_o = (σ(v_c · u_o) − 1) · v_c",
        "= " + co.toFixed(3) + " · v_c — negative, so u_o moves towards v_c") +
      row("∂L/∂u_n = σ(v_c · u_n) · v_c",
        "= +" + cn.toFixed(3) + " · v_c — positive, so u_n moves away") +
      row("∂L/∂v_c = (σ(v_c · u_o) − 1) · u_o + Σⱼ σ(v_c · u_nⱼ) · u_nⱼ",
        "‖·‖ = " + gn.toFixed(3) + " across the 24 components") +
      row("v_c ← v_c − lr · ∂L/∂v_c",
        "lr = " + lr.toFixed(4) + " at epoch " + epoch) +
      "</table></div>" +
      '<div class="footnote" style="margin-top:10px">' + TXT("sg-math-neg-note", { context: esc(context), centre: esc(centre), neg: esc(negWord) }) + "</div>";
  }
  $("#btn-win-play").addEventListener("click", e => {
    if (wtimer) { clearInterval(wtimer); wtimer = 0; e.target.textContent = "Slide the window"; e.target.classList.remove("on"); return; }
    e.target.textContent = "Pause"; e.target.classList.add("on");
    wtimer = setInterval(() => moveWindow(1), 900);
  });
  drawWindow();

  /* ---- the trainer ---------------------------------------------------- */
  let Win = null, Wout = null, corpus = null, cum = null, keepP = null;
  let epoch = 0, pairs = 0, lossAcc = 0, lossN = 0, running = false, raf = 0, noStop = false;
  let cursor = 0, sel = "oil";

  function buildCorpus() {
    const docs = [];
    let p = 0;
    for (let d = 0; d < lens.length; d++) {
      const n = lens[d], arr = [];
      for (let k = 0; k < n; k++) { const j = ids[p + k]; if (!noStop || !STOP.has(j)) arr.push(j); }
      p += n;
      if (arr.length >= 3) docs.push(arr);
    }
    corpus = docs;
    const total = C.freq.reduce((a, b) => a + b, 0);
    keepP = C.freq.map(f => {
      const z = f / total, t = 1e-3;
      return Math.min(1, (Math.sqrt(z / t) + 1) * (t / z));
    });
    cum = new Float64Array(V);
    let s = 0;
    for (let i = 0; i < V; i++) { s += Math.pow(C.freq[i], 0.75); cum[i] = s; }
    for (let i = 0; i < V; i++) cum[i] /= s;
  }
  function reset() {
    buildCorpus();
    Win = new Float32Array(V * DIM); Wout = new Float32Array(V * DIM);
    for (let i = 0; i < Win.length; i++) Win[i] = (Math.random() - 0.5) / DIM;
    epoch = 0; pairs = 0; cursor = 0; lossAcc = 0; lossN = 0;
    paint();
  }
  function negSample() {
    const r = Math.random();
    let lo = 0, hi = V - 1;
    while (lo < hi) { const m = (lo + hi) >> 1; if (cum[m] < r) lo = m + 1; else hi = m; }
    return lo;
  }
  function chunk(nDocs) {
    const lr = 0.05 * Math.max(0.15, 1 - epoch / 14);
    const grad = new Float32Array(DIM);
    for (let it = 0; it < nDocs; it++) {
      if (cursor >= corpus.length) { cursor = 0; epoch++; }
      const doc = corpus[cursor++];
      for (let i = 0; i < doc.length; i++) {
        const ci = doc[i];
        if (Math.random() > keepP[ci]) continue;
        const b = Math.max(0, i - WIN), e = Math.min(doc.length - 1, i + WIN);
        for (let j = b; j <= e; j++) {
          if (j === i) continue;
          const oi = doc[j];
          grad.fill(0);
          const co = ci * DIM;
          for (let k = 0; k <= NEG; k++) {
            const target = k === 0 ? oi : negSample();
            if (k > 0 && target === oi) continue;
            const lbl = k === 0 ? 1 : 0, to = target * DIM;
            let dot = 0;
            for (let d = 0; d < DIM; d++) dot += Win[co + d] * Wout[to + d];
            const sig = 1 / (1 + Math.exp(-Math.max(-8, Math.min(8, dot))));
            const g = (lbl - sig) * lr;
            lossAcc -= Math.log(Math.max(1e-9, lbl ? sig : 1 - sig)); lossN++;
            for (let d = 0; d < DIM; d++) { grad[d] += g * Wout[to + d]; Wout[to + d] += g * Win[co + d]; }
          }
          for (let d = 0; d < DIM; d++) Win[co + d] += grad[d];
          pairs++;
        }
      }
    }
  }
  /* PCA of Win, two components by power iteration on the 24x24 covariance */
  function project() {
    const mean = new Float64Array(DIM);
    for (let i = 0; i < V; i++) for (let d = 0; d < DIM; d++) mean[d] += Win[i * DIM + d];
    for (let d = 0; d < DIM; d++) mean[d] /= V;
    const cov = new Float64Array(DIM * DIM);
    const row = new Float64Array(DIM);
    for (let i = 0; i < V; i++) {
      let n = 0;
      for (let d = 0; d < DIM; d++) { row[d] = Win[i * DIM + d] - mean[d]; n += row[d] * row[d]; }
      n = Math.sqrt(n) || 1;
      for (let d = 0; d < DIM; d++) row[d] /= n;
      for (let a = 0; a < DIM; a++) for (let b = 0; b < DIM; b++) cov[a * DIM + b] += row[a] * row[b];
    }
    function power(mat, skip) {
      let v = new Float64Array(DIM).map(() => Math.random() - 0.5);
      for (let it = 0; it < 40; it++) {
        const o = new Float64Array(DIM);
        for (let a = 0; a < DIM; a++) { let s = 0; for (let b = 0; b < DIM; b++) s += mat[a * DIM + b] * v[b]; o[a] = s; }
        if (skip) { let p = 0; for (let d = 0; d < DIM; d++) p += o[d] * skip[d]; for (let d = 0; d < DIM; d++) o[d] -= p * skip[d]; }
        let n = Math.hypot(...o) || 1;
        for (let d = 0; d < DIM; d++) o[d] /= n;
        v = o;
      }
      return v;
    }
    const p1 = power(cov, null), p2 = power(cov, p1);
    const xy = new Float32Array(V * 2);
    for (let i = 0; i < V; i++) {
      let n = 0;
      for (let d = 0; d < DIM; d++) { row[d] = Win[i * DIM + d] - mean[d]; n += row[d] * row[d]; }
      n = Math.sqrt(n) || 1;
      let a = 0, b = 0;
      for (let d = 0; d < DIM; d++) { const x = row[d] / n; a += x * p1[d]; b += x * p2[d]; }
      xy[i * 2] = a; xy[i * 2 + 1] = b;
    }
    return xy;
  }
  function neighbours(word, topn) {
    const i = C.vocab.indexOf(word);
    if (i < 0 || !Win) return [];
    const base = new Float64Array(DIM);
    let n = 0;
    for (let d = 0; d < DIM; d++) { base[d] = Win[i * DIM + d]; n += base[d] * base[d]; }
    n = Math.sqrt(n) || 1;
    const out = [];
    for (let j = 0; j < V; j++) {
      if (j === i) continue;
      let dot = 0, m = 0;
      for (let d = 0; d < DIM; d++) { const x = Win[j * DIM + d]; dot += base[d] * x; m += x * x; }
      out.push([C.vocab[j], dot / (n * (Math.sqrt(m) || 1))]);
    }
    out.sort((a, b) => b[1] - a[1]);
    return out.slice(0, topn);
  }
  function paint() {
    $("#sg-epoch").textContent = epoch;
    $("#sg-pairs").textContent = pairs > 1e6 ? (pairs / 1e6).toFixed(1) + "M" : pairs.toLocaleString();
    $("#sg-loss").textContent = lossN ? (lossAcc / lossN).toFixed(3) : "—";
    $("#sg-mode").textContent = noStop ? "stopwords removed" : "with stopwords";
    $("#sg-mode").style.fontSize = "17px";
    drawMap(); drawNeighbours(); drawArch();
  }
  function drawMap() {
    const host = $("#sg-map"); host.innerHTML = "";
    const Wd = 660, Hd = 480;
    const s = svg(Wd, Hd);
    if (!Win) { s.appendChild(el("text", { x: 14, y: 26, "font-size": 15, fill: css("--ink-3") }, "press Train")); host.appendChild(s); return; }
    const xy = project();
    let xmin = Infinity, xmax = -Infinity, ymin = Infinity, ymax = -Infinity;
    for (let i = 0; i < V; i++) {
      xmin = Math.min(xmin, xy[i * 2]); xmax = Math.max(xmax, xy[i * 2]);
      ymin = Math.min(ymin, xy[i * 2 + 1]); ymax = Math.max(ymax, xy[i * 2 + 1]);
    }
    const px = v => 22 + (v - xmin) / ((xmax - xmin) || 1) * (Wd - 44);
    const py = v => 22 + (1 - (v - ymin) / ((ymax - ymin) || 1)) * (Hd - 52);
    const ramp = ["--seq-1", "--seq-2", "--seq-3", "--seq-4", "--seq-5"].map(css);
    const maxF = Math.log(C.freq[0] + 1);
    const nb = new Set(neighbours(sel, 6).map(n => n[0]));
    for (let i = V - 1; i >= 0; i--) {
      const w = C.vocab[i];
      const band = Math.min(4, Math.floor(Math.log(C.freq[i] + 1) / maxF * 5));
      s.appendChild(el("circle", {
        cx: px(xy[i * 2]), cy: py(xy[i * 2 + 1]), r: nb.has(w) || w === sel ? 5.5 : 2.6,
        fill: w === sel ? css("--ink") : nb.has(w) ? css("--ink-2") : ramp[band],
        opacity: nb.has(w) || w === sel ? 1 : 0.75,
      }));
    }
    const wanted = [sel, ...nb];
    for (let i = 0; i < V && wanted.length < 36; i += 31) wanted.push(C.vocab[i]);
    placeLabels(
      wanted.map(w => {
        const i = C.vocab.indexOf(w);
        if (i < 0) return null;
        const tw = w.length * 14.5 * 0.6, at = px(xy[i * 2]);
        const flip = at + 6 + tw > Wd - 8;          // keep it inside the frame
        return { text: w, x: flip ? at - 6 - tw : at + 6, y: py(xy[i * 2 + 1]) + 3.5, key: w };
      }).filter(Boolean),
      it => s.appendChild(el("text", {
        x: it.x, y: it.y, "font-size": 14.5,
        fill: it.key === sel ? css("--ink") : nb.has(it.key) ? css("--ink-2") : css("--ink-3"),
        "font-weight": it.key === sel ? 600 : 400,
      }, it.text)), 5, 17, 14.5);
    s.appendChild(el("text", { x: 22, y: Hd - 8, "font-size": 14, fill: css("--ink-3") },
      "live PCA of the input vectors · darker = more frequent in the corpus"));
    host.appendChild(s);
  }
  function drawNeighbours() {
    const list = neighbours(sel, 8);
    $("#sg-neighbours").innerHTML = list.length
      ? list.map(([w, c]) => `
        <div style="display:grid;grid-template-columns:1fr 46px;gap:8px;align-items:center;margin-bottom:4px">
          <div style="position:relative;padding:2px 6px">
            <div style="position:absolute;inset:0;background:var(--ink);opacity:${(Math.max(0, c) * 0.16).toFixed(3)};border-radius:2px"></div>
            <span class="mono" style="position:relative;font-size:15.4px">${esc(w)}</span></div>
          <span class="mono" style="font-size:14px;color:var(--ink-3);text-align:right">${c.toFixed(3)}</span>
        </div>`).join("")
      : `<div class="footnote">${TXT("sg-neighbours-empty")}</div>`;
  }
  const PICKS = ["oil", "election", "software", "microsoft", "olympic", "police", "stocks", "iraq", "google", "cup", "court", "prices"]
    .filter(w => C.vocab.includes(w));
  if (!PICKS.includes(sel)) sel = PICKS[0] || C.vocab[0];
  $("#sg-word").innerHTML = PICKS.map(w => `<option ${w === sel ? "selected" : ""}>${w}</option>`).join("");
  $("#sg-word").addEventListener("change", e => { sel = e.target.value; drawMap(); drawNeighbours(); });

  function loop() {
    if (!running) return;
    chunk(320);
    paint();
    if (epoch >= 6) { stop(); return; }
    raf = requestAnimationFrame(loop);
  }
  function stop() { running = false; cancelAnimationFrame(raf); $("#btn-sg-run").textContent = "Train"; $("#btn-sg-run").classList.remove("on"); }
  $("#btn-sg-run").addEventListener("click", () => {
    if (!Win) reset();
    if (running) { stop(); return; }
    if (epoch >= 6) reset();
    running = true; $("#btn-sg-run").textContent = "Pause"; $("#btn-sg-run").classList.add("on");
    raf = requestAnimationFrame(loop);
  });
  $("#btn-sg-reset").addEventListener("click", () => { stop(); reset(); });
  $("#btn-sg-stop").addEventListener("click", e => {
    noStop = !noStop; e.target.classList.toggle("on", noStop);
    e.target.textContent = noStop ? "with stopwords" : "without stopwords";
    stop(); reset();
  });
  REDRAW.push(() => { if (Win) paint(); });
  reset();
})();

/* ============================================================== 10 space */
(function () {
  const G = D.glove, dim = G.dim, N = G.words.length;
  const vecs = f16(G.vecs), xy = f16(G.xy), basis = f16(G.basis), mean = f16(G.mean);
  const idx = new Map(G.words.map((w, i) => [w, i]));
  const norm = new Float32Array(N * dim);
  for (let i = 0; i < N; i++) {
    let n = 0;
    for (let d = 0; d < dim; d++) n += vecs[i * dim + d] ** 2;
    n = Math.sqrt(n) || 1;
    for (let d = 0; d < dim; d++) norm[i * dim + d] = vecs[i * dim + d] / n;
  }
  let exclude = true;

  function nearest(v, topn, skip) {
    let n = 0;
    for (let d = 0; d < dim; d++) n += v[d] * v[d];
    n = Math.sqrt(n) || 1;
    const out = [];
    for (let i = 0; i < N; i++) {
      if (skip && skip.has(G.words[i])) continue;
      let s = 0;
      for (let d = 0; d < dim; d++) s += norm[i * dim + d] * v[d];
      s /= n;
      if (out.length < topn) { out.push([G.words[i], s]); out.sort((a, b) => b[1] - a[1]); }
      else if (s > out[topn - 1][1]) { out[topn - 1] = [G.words[i], s]; out.sort((a, b) => b[1] - a[1]); }
    }
    return out;
  }
  function combine(pos, neg) {
    const v = new Float64Array(dim);
    for (const w of pos) { const i = idx.get(w); for (let d = 0; d < dim; d++) v[d] += vecs[i * dim + d]; }
    for (const w of neg) { const i = idx.get(w); for (let d = 0; d < dim; d++) v[d] -= vecs[i * dim + d]; }
    return v;
  }
  function project(v) {
    let n = 0;
    for (let d = 0; d < dim; d++) n += v[d] * v[d];
    n = Math.sqrt(n) || 1;
    let a = 0, b = 0;
    for (let d = 0; d < dim; d++) { const x = v[d] / n - mean[d]; a += x * basis[d]; b += x * basis[dim + d]; }
    return [a, b];
  }

  const PRESETS = [["king", "man", "woman"], ["italy", "france", "paris"], ["sock", "foot", "head"]];
  $("#an-presets").innerHTML = PRESETS.map((p, i) => `<button data-p="${i}" style="font-size:14.5px">${p[0]}−${p[1]}+${p[2]}</button>`).join("");
  $("#an-presets").addEventListener("click", e => {
    const b = e.target.closest("button"); if (!b) return;
    const p = PRESETS[+b.dataset.p];
    $("#an-a").value = p[0]; $("#an-b").value = p[1]; $("#an-c").value = p[2]; run();
  });
  ["#an-a", "#an-b", "#an-c"].forEach(s => $(s).addEventListener("input", run));
  $("#btn-excl").addEventListener("click", e => { exclude = true; e.target.classList.add("on"); $("#btn-noexcl").classList.remove("on"); run(); });
  $("#btn-noexcl").addEventListener("click", e => { exclude = false; e.target.classList.add("on"); $("#btn-excl").classList.remove("on"); run(); });

  function run() {
    const a = $("#an-a").value.trim().toLowerCase(), b = $("#an-b").value.trim().toLowerCase(), c = $("#an-c").value.trim().toLowerCase();
    const missing = [a, b, c].filter(w => !idx.has(w));
    if (missing.length) {
      $("#an-out").innerHTML = `<div class="footnote">${TXT("an-out-missing", { missing: missing.map(m => `<span class="mono">${esc(m)}</span>`).join(", ") })}</div>`;
      $("#an-map").innerHTML = ""; return;
    }
    const v = combine([a, c], [b]);
    const skip = exclude ? new Set([a, b, c]) : null;
    const res = nearest(v, 6, skip);
    const resWith = nearest(v, 6, null);
    $("#an-out").innerHTML = `
      <div class="mono" style="font-size:15.9px;margin-bottom:12px">${esc(a)} − ${esc(b)} + ${esc(c)} =</div>
      ${res.map(([w, s], i) => `
        <div style="display:grid;grid-template-columns:20px 1fr 52px;gap:8px;align-items:center;margin-bottom:4px">
          <span class="mono" style="font-size:14px;color:var(--ink-3)">${i + 1}</span>
          <div style="position:relative;padding:2px 6px">
            <div style="position:absolute;inset:0;background:var(--ink);opacity:${(Math.max(0, s) * 0.2).toFixed(3)};border-radius:2px"></div>
            <span class="mono" style="position:relative;font-size:15.9px;${[a, b, c].includes(w) ? "font-weight:600" : ""}">${esc(w)}${[a, b, c].includes(w) ? " ← an input word" : ""}</span></div>
          <span class="mono" style="font-size:14px;color:var(--ink-3);text-align:right">${s.toFixed(3)}</span>
        </div>`).join("")}
      ${exclude ? `<div class="footnote" style="margin-top:12px">${TXT("an-out-kept", { top: resWith.slice(0, 3).map(r => esc(r[0])).join(", ") })}</div>` : ""}`;

    /* the map */
    const host = $("#an-map"); host.innerHTML = "";
    const Wd = 440, Hd = 360, s = svg(Wd, Hd);
    let xmin = Infinity, xmax = -Infinity, ymin = Infinity, ymax = -Infinity;
    for (let i = 0; i < N; i += 3) {
      xmin = Math.min(xmin, xy[i * 2]); xmax = Math.max(xmax, xy[i * 2]);
      ymin = Math.min(ymin, xy[i * 2 + 1]); ymax = Math.max(ymax, xy[i * 2 + 1]);
    }
    const px = v => 22 + (v - xmin) / ((xmax - xmin) || 1) * (Wd - 44);
    const py = v => 20 + (1 - (v - ymin) / ((ymax - ymin) || 1)) * (Hd - 44);
    for (let i = 0; i < N; i += 4) {
      s.appendChild(el("circle", { cx: px(xy[i * 2]), cy: py(xy[i * 2 + 1]), r: 1.8, fill: css("--ink-3"), opacity: .7 }));
    }
    const pv = project(v);
    const pts = [[a, "a"], [b, "− b"], [c, "+ c"]].map(([w, tag]) => {
      const i = idx.get(w);
      return { w, tag, x: px(xy[i * 2]), y: py(xy[i * 2 + 1]) };
    });
    const rx = px(pv[0]), ry = py(pv[1]);
    s.appendChild(el("path", {
      d: `M ${pts[0].x} ${pts[0].y} L ${rx} ${ry}`, stroke: css("--ink"),
      "stroke-width": 1.6, fill: "none", "stroke-dasharray": "4 3",
    }));
    /* everything the arithmetic touches, in map coordinates */
    const marks = [
      ...pts.map(p => ({ label: p.w, x: p.x, y: p.y, kind: "input" })),
      { label: "the result", x: rx, y: ry, kind: "result" },
      ...res.slice(0, 3).map(([w]) => {
        const i = idx.get(w);
        return { label: w, x: px(xy[i * 2]), y: py(xy[i * 2 + 1]), kind: "near" };
      }),
    ];
    marks.forEach(m => s.appendChild(el("circle", {
      cx: m.x, cy: m.y, r: m.kind === "result" ? 6 : m.kind === "input" ? 5 : 3.5,
      fill: m.kind === "result" ? css("--ink") : m.kind === "input" ? css("--panel") : css("--ink-2"),
      stroke: m.kind === "input" ? css("--ink") : "none", "stroke-width": 2,
    })));

    /* the region the whole journey fits into, boxed on the map and blown up as an inset */
    const bx0 = Math.min(...marks.map(m => m.x)), bx1 = Math.max(...marks.map(m => m.x));
    const by0 = Math.min(...marks.map(m => m.y)), by1 = Math.max(...marks.map(m => m.y));
    const m0 = 8;
    s.appendChild(el("rect", {
      x: bx0 - m0, y: by0 - m0, width: (bx1 - bx0) + 2 * m0, height: (by1 - by0) + 2 * m0,
      fill: "none", stroke: css("--ink"), "stroke-width": 1, "stroke-dasharray": "3 3",
    }));

    const iw = 236, ih = 168, ix = Wd - iw - 16, iy = 12;
    s.appendChild(el("rect", { x: ix, y: iy, width: iw, height: ih, fill: css("--panel"), stroke: css("--rule-strong"), rx: 3 }));
    s.appendChild(el("line", {
      x1: bx1 - bx0 > 0 ? bx1 + m0 : bx1, y1: by0 - m0, x2: ix, y2: iy + ih / 2,
      stroke: css("--rule-strong"), "stroke-width": 1,
    }));
    const sw = (bx1 - bx0) + 2 * m0, sh = (by1 - by0) + 2 * m0;
    const k = Math.min((iw - 96) / (sw || 1), (ih - 42) / (sh || 1));
    const zx = v => ix + 18 + (v - (bx0 - m0)) * k;
    const zy = v => iy + 20 + (v - (by0 - m0)) * k;
    marks.forEach(m => s.appendChild(el("circle", {
      cx: zx(m.x), cy: zy(m.y), r: m.kind === "result" ? 5 : m.kind === "input" ? 4.5 : 3,
      fill: m.kind === "result" ? css("--ink") : m.kind === "input" ? css("--panel") : css("--ink-2"),
      stroke: m.kind === "input" ? css("--ink") : "none", "stroke-width": 1.8,
    })));
    s.appendChild(el("path", {
      d: `M ${zx(pts[0].x)} ${zy(pts[0].y)} L ${zx(rx)} ${zy(ry)}`,
      stroke: css("--ink"), "stroke-width": 1.4, fill: "none", "stroke-dasharray": "3 2",
    }));
    placeLabels(
      marks.map(m => ({ text: m.label, x: zx(m.x) + 7, y: zy(m.y) + 3.5, kind: m.kind })),
      it => s.appendChild(el("text", {
        x: it.x, y: it.y, "font-size": 12.5,
        "font-weight": it.kind === "result" ? 600 : 400,
        fill: it.kind === "near" ? css("--ink-2") : css("--ink"),
      }, it.text)), 3, 14, 12.5);
    s.appendChild(el("text", { x: ix + 8, y: iy + ih - 6, "font-size": 12, fill: css("--ink-3") },
      `detail · ${(100 * sw / (Wd - 44)).toFixed(0)}% of the map’s width`));
    s.appendChild(el("text", { x: 22, y: Hd - 6, "font-size": 13, fill: css("--ink-3") },
      "dashed box = everything the arithmetic touched"));
    host.appendChild(s);
  }
  REDRAW.push(run);
  run();

  /* the two pooling rows, next to the sparse baseline they lose to */
  (function () {
    const want = ["tf-idf, words 1-1", "word2vec, mean pooling", "word2vec, idf-weighted"];
    const rows = want
      .map(r => D.results.find(x => x.rep === r && x.head === "LogisticRegression"))
      .filter(Boolean);
    const best = Math.max(...rows.map(r => r.acc));
    $("#pooling-table").innerHTML =
      `<thead><tr><th>representation</th><th class="num">dimensions</th><th class="num">vectorize s</th>
        <th class="num">accuracy</th><th style="width:220px">accuracy, to scale</th></tr></thead><tbody>` +
      rows.map(r => {
        const lo = 0.86, w = Math.max(2, (r.acc - lo) / (best - lo) * 100);
        return `<tr>
          <td class="mono">${esc(r.rep)}</td>
          <td class="num" style="color:var(--ink-2)">${esc(r.note.replace("dim=", ""))}</td>
          <td class="num">${r.vec_s == null ? "—" : r.vec_s.toFixed(1)}</td>
          <td class="num"${r.acc === best ? ' style="font-weight:600"' : ""}>${fmt(r.acc)}</td>
          <td><div style="height:11px;background:var(--panel-sunk);border-radius:2px;overflow:hidden">
            <div style="height:100%;width:${w.toFixed(1)}%;background:var(--ink-2);border-radius:2px"></div></div></td>
        </tr>`;
      }).join("") +
      `</tbody>`;
  })();

  /* bias */
  const BIAS = [[["woman", "doctor"], ["man"]], [["man", "nurse"], ["woman"]], [["woman", "programmer"], ["man"]]];
  $("#bias-out").innerHTML = BIAS.map(([pos, neg]) => {
    if ([...pos, ...neg].some(w => !idx.has(w))) return "";
    const v = combine(pos, neg);
    const res = nearest(v, 6, new Set([...pos, ...neg]));
    return `<div style="padding:9px 0;border-bottom:1px solid var(--rule)">
      <div class="mono" style="font-size:15.4px;color:var(--ink-2);margin-bottom:6px">${pos.join(" + ")} − ${neg.join(" + ")}</div>
      <div>${res.map(r => `<span class="tok">${esc(r[0])}</span>`).join("")}</div></div>`;
  }).join("");

  /* t-SNE perplexity */
  const TS = D.tsne, tw = TS.words;
  const PERP = ["2", "5", "30", "100"];
  let perp = "30";
  $("#tsne-btns").innerHTML = PERP.map(p => `<button data-p="${p}" ${p === perp ? 'class="on"' : ""} style="font-size:15px">perplexity ${p}</button>`).join("");
  $("#tsne-btns").addEventListener("click", e => {
    const b = e.target.closest("button"); if (!b) return;
    perp = b.dataset.p;
    $$("#tsne-btns button").forEach(x => x.classList.toggle("on", x === b));
    drawTsne();
  });
  function drawTsne() {
    const host = $("#tsne-map"); host.innerHTML = "";
    const g = f16(TS.grids[perp]), n = tw.length;
    const Wd = 880, Hd = 380, s = svg(Wd, Hd);
    let xmin = Infinity, xmax = -Infinity, ymin = Infinity, ymax = -Infinity;
    for (let i = 0; i < n; i++) {
      xmin = Math.min(xmin, g[i * 2]); xmax = Math.max(xmax, g[i * 2]);
      ymin = Math.min(ymin, g[i * 2 + 1]); ymax = Math.max(ymax, g[i * 2 + 1]);
    }
    const px = v => 24 + (v - xmin) / ((xmax - xmin) || 1) * (Wd - 48);
    const py = v => 18 + (1 - (v - ymin) / ((ymax - ymin) || 1)) * (Hd - 42);
    for (let i = n - 1; i >= 0; i--) {
      const c = el("circle", { cx: px(g[i * 2]), cy: py(g[i * 2 + 1]), r: i < 60 ? 3.4 : 2.4, fill: i < 60 ? css("--ink") : css("--ink-3") });
      tipOn(c, esc(tw[i]));
      s.appendChild(c);
    }
    const cand = [];
    for (let i = 0; i < n; i += 7) cand.push({ text: tw[i], x: px(g[i * 2]) + 5, y: py(g[i * 2 + 1]) + 3 });
    placeLabels(cand.slice(0, 90), it => s.appendChild(
      el("text", { x: it.x, y: it.y, "font-size": 13.5, fill: css("--ink-2") }, it.text)), 4, 16, 13.5);
    s.appendChild(el("text", { x: 24, y: Hd - 5, "font-size": 13, fill: css("--ink-3") },
      `same 1 000 vectors, same algorithm, perplexity = ${perp}`));
    host.appendChild(s);
  }
  REDRAW.push(drawTsne);
  drawTsne();
})();

/* ================================================================ 11 llm */
(function () {
  if (!D.llm) return;
  const L = D.llm;
  $("#llm-head").textContent = `${L.calls.toLocaleString()} API calls · ${L.examples} unique examples · temperature = 0`;
  $("#llm-unstable").textContent = (L.unstable * 100).toFixed(1) + "%";
  $("#llm-lat").textContent = L.medianLatencyMs + " ms";
  function draw() {
    const host = $("#llm-chart"); host.innerHTML = "";
    const Wd = 700, Hd = 224, L0 = 128, T = 16, Bm = 52;
    const s = svg(Wd, Hd);
    const bars = L.byPrompt;
    const bw = (Wd - L0 - 24) / bars.length;
    const lo = 0, hi = 1;
    const y = v => T + (1 - (v - lo) / (hi - lo)) * (Hd - T - Bm);
    [0, 0.25, 0.5, 0.75, 1].forEach(v => {
      s.appendChild(el("line", { class: "gridline", x1: L0, x2: Wd - 24, y1: y(v), y2: y(v), stroke: css("--rule") }));
      s.appendChild(el("text", { x: L0 - 8, y: y(v) + 3.5, "font-size": 13, "text-anchor": "end", fill: css("--ink-3") }, v.toFixed(2)));
    });
    bars.forEach((b, i) => {
      const w = Math.min(46, bw - 26), x = L0 + i * bw + (bw - w) / 2;
      const g = el("g", {});
      g.appendChild(el("rect", { x, y: y(b.acc), width: w, height: y(0) - y(b.acc), fill: css("--ink-2"), rx: 2 }));
      g.appendChild(el("text", { x: x + w / 2, y: y(b.acc) + 16, "font-size": 14, "text-anchor": "middle", fill: css("--ground") }, b.acc.toFixed(3)));
      g.appendChild(el("text", { x: x + w / 2, y: Hd - Bm + 17, "font-size": 13, "text-anchor": "middle", fill: css("--ink-3") }, `prompt ${b.prompt}`));
      g.appendChild(el("text", { x: x + w / 2, y: Hd - Bm + 35, "font-size": 13, "text-anchor": "middle", fill: css("--ink-3") }, `run ${b.repeat + 1}`));
      tipOn(g, `prompt ${b.prompt}, repeat ${b.repeat + 1}<br>accuracy ${b.acc.toFixed(3)} on 200 examples`);
      s.appendChild(g);
    });
    const best = Math.max(...D.results.map(r => r.acc));
    s.appendChild(el("line", { x1: L0, x2: Wd - 24, y1: y(best), y2: y(best), stroke: css("--ink-3"), "stroke-dasharray": "5 4" }));
    s.appendChild(el("text", { x: Wd - 24, y: y(best) - 6, "font-size": 13, "text-anchor": "end", fill: css("--ink-3") }, `best supervised row on this page — ${best.toFixed(4)}`));
    s.appendChild(el("text", { x: 8, y: T + 10, "font-size": 13, fill: css("--ink-3") }, "accuracy"));
    host.appendChild(s);
  }
  REDRAW.push(draw);
  draw();
})();

/* ============================================================ 12 ceiling */
function ceilingPaint() {
  const disp = D.disputed;
  const mine = LABEL_STATE.mine, shown = LABEL_STATE.revealed;
  const modelAgree = disp.filter(d => d.model === d.gold).length / disp.length;
  $("#ceiling-agree").textContent = `model agrees with the dataset on ${pct(modelAgree)} of these twelve`;
  $("#ceiling-table").innerHTML =
    `<thead><tr><th></th><th>headline</th><th>you</th><th>dataset</th><th>model</th></tr></thead><tbody>` +
    disp.map((d, n) => {
      const m = mine[n];
      return `<tr>
        <td class="mono" style="color:var(--ink-3)">${String(n + 1).padStart(2, "0")}</td>
        <td style="font-size:16.4px">${esc(d.text.slice(0, 96))}</td>
        <td>${m == null ? `<span class="mono" style="color:var(--ink-3)">—</span>` : clsChip(m)}</td>
        <td>${clsChip(d.gold)}</td>
        <td>${clsChip(d.model)}</td></tr>`;
    }).join("") + `</tbody>`;

  const yourAgree = shown ? mine.filter((m, n) => m === disp[n].gold).length / 12 : null;
  const accs = D.results.map(r => r.acc);
  const best = Math.max(...accs), worst = Math.min(...accs);
  $("#ceiling-spread").textContent = `spread across every method today: ${((best - worst) * 100).toFixed(1)} points`;
  const host = $("#ceiling-bars"); host.innerHTML = "";
  const Wd = 900, rows = [
    ["you · the contested twelve", yourAgree, yourAgree == null ? "label them in block 00, then reveal" : null],
    ["best model · the same twelve", modelAgree, null],
    ["best model · full test set", best, "tf-idf 1-2 + LogReg"],
    ["weakest method · full test set", worst, "zero-shot LLM"],
  ];
  const Hd = 30 + rows.length * 52, s = svg(Wd, Hd), L0 = 330;
  rows.forEach((r, i) => {
    const y = 26 + i * 52;
    s.appendChild(el("text", { x: L0 - 14, y: y + 4, "font-size": 14.5, "text-anchor": "end", fill: css("--ink-2") }, r[0]));
    if (r[1] == null) {
      s.appendChild(el("text", { x: L0, y: y + 4, "font-size": 14, fill: css("--ink-3") }, r[2]));
      return;
    }
    const w = Math.max(2, r[1] * (Wd - L0 - 240));
    s.appendChild(el("rect", { x: L0, y: y - 11, width: w, height: 22, fill: css("--ink-2"), rx: 2 }));
    s.appendChild(el("text", { x: L0 + w + 10, y: y + 4, "font-size": 15, fill: css("--ink") }, pct(r[1]) + (r[2] ? `  ${r[2]}` : "")));
  });
  host.appendChild(s);
}
(function () {
  $("#mistakes-table").innerHTML =
    `<thead><tr><th>dataset says</th><th>model says</th><th>headline</th></tr></thead><tbody>` +
    D.mistakes.map(m => `<tr><td>${clsChip(m.gold)}</td><td>${clsChip(m.pred)}</td>
      <td style="font-size:16.4px">${esc(m.text.slice(0, 120))}</td></tr>`).join("") + `</tbody>`;
  REDRAW.push(ceilingPaint);
  ceilingPaint();
})();

