/* Lecture 9 — figures and browser-computed values for the questions (demo_base/quiz.js renders the questions).
   #lecture-data is artifacts/lecture_data.json (export_lecture_data.py): the examples on the seminar's corpus, the
   reference values the in-browser metrics and IVF are checked against (check_steps.json). */
(function () {
  const LD = JSON.parse(document.getElementById("lecture-data").textContent);
  const NS = "http://www.w3.org/2000/svg";
  const PAINT = { fill: 1, stroke: 1 };
  function el(tag, attrs, parent, text) {
    const n = document.createElementNS(NS, tag); let style = "";
    for (const k in attrs) { const v = attrs[k]; if (PAINT[k] && typeof v === "string" && (v.startsWith("var(") || v.startsWith("color-mix("))) style += `${k}:${v};`; else n.setAttribute(k, v); }
    if (style) n.setAttribute("style", style);
    if (text != null) n.textContent = text;
    if (parent) parent.appendChild(n);
    return n;
  }
  const svg = (host, w, h) => el("svg", { viewBox: `0 0 ${w} ${h}`, width: "100%", preserveAspectRatio: "xMidYMid meet", style: `max-width:${w}px` }, host);
  const txt = (p, x, y, s, a) => el("text", Object.assign({ x, y, "font-size": 12, fill: "var(--ink)" }, a || {}), p, s);
  const box = (p, x, y, w, h, a) => el("rect", Object.assign({ x, y, width: w, height: h, rx: 3, fill: "var(--panel-sunk)", stroke: "var(--rule-strong)", "stroke-width": 1 }, a || {}), p);
  const line = (p, x1, y1, x2, y2, a) => el("line", Object.assign({ x1, y1, x2, y2, stroke: "var(--rule-strong)", "stroke-width": 1 }, a || {}), p);
  const arrow = (p, x1, y1, x2, y2, c) => el("path", { d: `M${x1},${y1} L${x2},${y2}`, stroke: c || "var(--ink-3)", "stroke-width": 1.3, fill: "none", "marker-end": "url(#lec-arr)" }, p);
  function defs(s) { const d = el("defs", {}, s); const m = el("marker", { id: "lec-arr", viewBox: "0 0 10 10", refX: 9, refY: 5, markerWidth: 7, markerHeight: 7, orient: "auto" }, d); el("path", { d: "M0,0 L10,5 L0,10 z", fill: "var(--ink-3)" }, m); }
  function pickable(parent, key, x, y, w, h) { const g = el("g", { "data-pick": key }, parent); g.hit = () => el("rect", { class: "hit", x: x - 4, y: y - 4, width: w + 8, height: h + 8, rx: 5 }, g); return g; }
  const MONO = { "font-family": "var(--mono)" };
  const tint = (v, p) => `color-mix(in srgb, var(${v}) ${p}%, var(--panel))`;
  const V = QUIZ.values;
  const G = (s, a) => el("g", a || {}, s);
  const SMALL = { "font-size": 11, fill: "var(--ink-3)" };
  const pct = x => `${Math.round(x * 100)}%`;
  /* a plain chart frame: o = {x0, x1, y0, y1, xmin, xmax, ymin, ymax, xt, yt, xl, yl, xfmt, yfmt, xlog} */
  function axes(s, o) {
    const lg = Math.log2;
    const X = v => o.x0 + (o.xlog ? (lg(v) - lg(o.xmin)) / (lg(o.xmax) - lg(o.xmin)) : (v - o.xmin) / (o.xmax - o.xmin)) * (o.x1 - o.x0);
    const Y = v => o.y1 - (v - o.ymin) / (o.ymax - o.ymin) * (o.y1 - o.y0);
    (o.yt || []).forEach(v => { line(s, o.x0, Y(v), o.x1, Y(v), { stroke: "var(--rule)", "stroke-dasharray": "2 3" });
      txt(s, o.x0 - 6, Y(v) + 4, (o.yfmt || String)(v), { "text-anchor": "end", ...MONO, ...SMALL }); });
    (o.xt || []).forEach(v => txt(s, X(v), o.y1 + 16, (o.xfmt || String)(v), { "text-anchor": "middle", ...MONO, ...SMALL }));
    line(s, o.x0, o.y1, o.x1, o.y1);
    if (o.xl) txt(s, (o.x0 + o.x1) / 2, o.y1 + 33, o.xl, { "text-anchor": "middle", "font-size": 11.5, fill: "var(--ink-3)" });
    if (o.yl) txt(s, o.x0 - 40, o.y0 - 8, o.yl, { "font-size": 11.5, fill: "var(--ink-3)" });
    return { X, Y };
  }
  const poly = (s, pts, a) => el("polyline", Object.assign({ points: pts.map(p => p[0].toFixed(1) + "," + p[1].toFixed(1)).join(" "), fill: "none", "stroke-width": 2.2, "stroke-linejoin": "round" }, a || {}), s);
  const dot = (s, x, y, r, f, a) => el("circle", Object.assign({ cx: x, cy: y, r, fill: f }, a || {}), s);
  /* controls above a figure: host gets <div class="fig-ctl">…</div><div class="fig-svg"></div><div class="fig-stat"></div> */
  function ctlHost(host, ctl) {
    host.innerHTML = `<div class="fig-ctl">${ctl}</div><div class="fig-svg"></div><div class="fig-stat"></div>`;
    return { ctl: host.querySelector(".fig-ctl"), out: host.querySelector(".fig-svg"), stat: host.querySelector(".fig-stat") };
  }

  /* --------------------------------------------------------------- measured values the prose quotes */
  const f3 = x => x.toFixed(3), f2 = x => x.toFixed(2);
  V.n_posts = LD.n_posts; V.n_golden = LD.n_golden; V.n_noanswer = LD.n_noanswer; V.n_docs = LD.n_docs;
  V.bm25_split = f2(LD.bm25_split); V.bm25_lower = f2(LD.bm25_lower);
  V.ex_post_words = LD.ex_post_words; V.q_words_median = String(LD.q_words_median); V.doc_words_median = String(LD.doc_words_median);
  V.qd_h5 = f2(LD.hit.Qdrant["5"]); V.qd_h10 = f2(LD.hit.Qdrant["10"]); V.en_h5 = f2(LD.hit.Ensemble["5"]); V.en_h10 = f2(LD.hit.Ensemble["10"]);
  { const R = LD.ivf_real, big = R.recall.findIndex(r => r >= 0.9);
    Object.assign(V, { ivf_n: R.n.toLocaleString("en-US"), ivf_d: R.d, ivf_cells: R.cells, ivf_nq: R.n_q, ivf_r1: pct(R.recall[0]),
      ivf_r_big: pct(R.recall[big]), ivf_np_big: R.nprobe[big], ivf_s_big: pct(R.scanned[big]) }); }
  V.rrf_ratio12 = f3(62 / 61); V.rrf_w10 = pct(61 / 70);
  V.rr_model = LD.rerank_model.split("/").pop(); V.rr_params = Math.round(LD.rerank_params / 1e6) + " M"; V.rr_s_pair = f3(LD.rerank_s_per_pair);
  V.rr_full = Math.round(LD.n_docs * LD.rerank_s_per_pair); V.rr_top20 = (20 * LD.rerank_s_per_pair).toFixed(1);
  { const C = LD.cascade, up = C.depth.filter((d, i) => i && d > 10 && C.first_hit[i] > C.first_hit[i - 1]), full = C.first_hit.indexOf(1);
    V.cas_first = f2(C.first_mrr); V.cas_ranks = up.slice(0, -1).join(", ") + " and " + up[up.length - 1]; V.cas_full = C.depth[full]; V.cas_mrr_full = f2(C.mrr[full]); }
  V.g_min = f3(LD.top1_golden_min); V.n_max = f3(LD.top1_noanswer_max); V.gap = f3(LD.top1_golden_min - LD.top1_noanswer_max);

  /* --------------------------------------------------------------- block 00: classification and retrieval */
  QUIZ.figs.task = host => {
    const W = 780, H = 250, s = svg(host, W, H); defs(s);
    line(s, 305, 10, 305, 240, { stroke: "var(--rule)" });
    txt(s, 150, 18, "classification", { "text-anchor": "middle", "font-size": 13.5, "font-weight": 600 });
    box(s, 20, 50, 100, 64, { fill: "var(--panel)" }); [64, 78, 92].forEach(y => line(s, 30, y, 108, y, { stroke: "var(--rule-strong)" }));
    txt(s, 70, 132, "one email", { "text-anchor": "middle", ...SMALL });
    arrow(s, 122, 82, 156, 82);
    box(s, 160, 60, 90, 44, { fill: tint("--cls-0", 16), stroke: "var(--cls-0)" }); txt(s, 205, 87, "model", { "text-anchor": "middle", "font-size": 12.5 });
    arrow(s, 205, 106, 205, 138);
    box(s, 150, 142, 46, 26, { fill: tint("--cls-1", 22), stroke: "var(--cls-1)" }); txt(s, 173, 159, "spam", { "text-anchor": "middle", "font-size": 12 });
    box(s, 202, 142, 76, 26, { fill: "var(--panel)" }); txt(s, 240, 159, "not spam", { "text-anchor": "middle", "font-size": 12, fill: "var(--ink-3)" });
    txt(s, 150, 206, "one object → one label", { "text-anchor": "middle", "font-size": 12, fill: "var(--ink-2)" });
    txt(s, 150, 224, "from a fixed set", { "text-anchor": "middle", "font-size": 12, fill: "var(--ink-2)" });
    txt(s, 545, 18, "retrieval", { "text-anchor": "middle", "font-size": 13.5, "font-weight": 600 });
    box(s, 330, 32, 120, 26, { fill: tint("--cls-1", 18), stroke: "var(--cls-1)" }); txt(s, 390, 49, "query q", { "text-anchor": "middle", "font-size": 12 });
    txt(s, 330, 78, "collection D", SMALL);
    const sc = i => 0.15 + 0.8 * Math.abs(Math.sin(i * 12.9898) * 43758.5453 % 1);
    const tiles = []; for (let i = 0; i < 24; i++) tiles.push([i, sc(i)]);
    const top = tiles.slice().sort((a, b) => b[1] - a[1]).slice(0, 4).map(t => t[0]);
    tiles.forEach(([i, v]) => { const x = 330 + (i % 6) * 32, y = 86 + Math.floor(i / 6) * 36, hot = top.includes(i);
      box(s, x, y, 26, 30, { fill: "var(--panel)", stroke: hot ? "var(--cls-0)" : "var(--rule-strong)", "stroke-width": hot ? 1.6 : 1 });
      el("rect", { x: x + 4, y: y + 26 - 20 * v, width: 18, height: 20 * v, fill: hot ? tint("--cls-0", 55) : "var(--rule-strong)" }, s); });
    arrow(s, 526, 154, 612, 154);
    txt(s, 569, 144, "s(q, d)", { "text-anchor": "middle", ...MONO, "font-size": 11.5, fill: "var(--ink-2)" });
    txt(s, 569, 172, "sort", { "text-anchor": "middle", ...MONO, "font-size": 11.5, fill: "var(--ink-2)" });
    txt(s, 626, 78, "top k", SMALL);
    top.forEach((i, r) => { const y = 86 + r * 36, v = sc(i);
      txt(s, 636, y + 20, String(r + 1), { ...MONO, "font-size": 11, fill: "var(--ink-3)", "text-anchor": "middle" });
      box(s, 648, y, 116, 28, { fill: "var(--panel)", stroke: "var(--cls-0)" });
      el("rect", { x: 654, y: y + 9, width: 70 * v, height: 10, fill: tint("--cls-0", 55) }, s);
      txt(s, 758, y + 19, `d${i + 1}`, { "text-anchor": "end", ...MONO, "font-size": 10.5, fill: "var(--ink-3)" }); });
    txt(s, 545, 242, "a query and every document → an order over the collection", { "text-anchor": "middle", "font-size": 12, fill: "var(--ink-2)" });
  };

  /* --------------------------------------------------------------- block 00: a question against its post */
  QUIZ.figs.mismatch = host => {
    const W = 760, H = 186, s = svg(host, W, H);
    const C = { exact: [tint("--good", 22), "var(--good)", "var(--ink)"], form: [tint("--cls-1", 22), "var(--cls-1)", "var(--ink)"], none: ["var(--panel-sunk)", "var(--rule-strong)", "var(--ink-3)"] };
    txt(s, 10, 20, "the question, word by word", SMALL);
    let x = 10;
    LD.ex_words.forEach(([w, kind, form]) => { const wd = 18 + 7.4 * w.length;
      box(s, x, 30, wd, 28, { fill: C[kind][0], stroke: C[kind][1] }); txt(s, x + wd / 2, 49, w, { "text-anchor": "middle", "font-size": 13, fill: C[kind][2] });
      if (kind === "form") txt(s, x + wd / 2, 76, `post: ${form}`, { "text-anchor": "middle", "font-size": 11, fill: "var(--cls-1)" });
      x += wd + 6; });
    [["exact", "in the post"], ["form", "only another form"], ["none", "absent"]].forEach(([k, l], i) => {
      box(s, 10 + i * 170, 96, 14, 14, { fill: C[k][0], stroke: C[k][1] }); txt(s, 30 + i * 170, 108, l, { "font-size": 11.5, fill: "var(--ink-2)" }); });
    const nq = LD.ex_words.length, np = LD.ex_post_words, sc = (W - 200) / np;
    txt(s, 10, 146, `question · ${nq} words`, { "font-size": 11.5, fill: "var(--ink-2)" });
    el("rect", { x: 180, y: 137, width: nq * sc, height: 10, fill: "var(--cls-1)" }, s);
    txt(s, 10, 172, `its post · ${np} words`, { "font-size": 11.5, fill: "var(--ink-2)" });
    el("rect", { x: 180, y: 163, width: np * sc, height: 10, fill: "var(--rule-strong)" }, s);
  };

  /* --------------------------------------------------------------- block 00: no answer, still a first document */
  QUIZ.figs.noanswer = host => {
    const W = 760, H = 150, s = svg(host, W, H);
    box(s, 10, 8, 170, 28, { fill: tint("--cls-1", 18), stroke: "var(--cls-1)" }); txt(s, 95, 27, LD.na_q, { "text-anchor": "middle", "font-size": 13 });
    txt(s, 22, 58, "rank", { ...MONO, ...SMALL, "text-anchor": "middle" }); txt(s, 70, 58, "cosine", { ...MONO, ...SMALL, "text-anchor": "middle" }); txt(s, 112, 58, "the post", { ...MONO, ...SMALL });
    LD.na_top.forEach(([c, t], i) => { const y = 66 + i * 28;
      line(s, 10, y, W - 10, y, { stroke: "var(--rule)" });
      txt(s, 22, y + 19, String(i + 1), { ...MONO, "font-size": 12, "text-anchor": "middle", fill: "var(--ink-3)" });
      txt(s, 70, y + 19, c.toFixed(3), { ...MONO, "font-size": 12, "text-anchor": "middle", fill: "var(--cls-0)" });
      txt(s, 112, y + 19, t.length > 84 ? t.slice(0, 84) + "…" : t, { "font-size": 12.5 }); });
  };

  /* --------------------------------------------------------------- block 01: pooling, as three steps */
  const POOL = { truth: [2, 5, 9, 14, 21, 27, 33, 36], sys: { A: [2, 5, 11, 14, 20], B: [5, 9, 12, 2, 30], C: [21, 14, 9, 25, 3], D: [27, 2, 33, 18, 9] },
    col: { A: "var(--cls-0)", B: "var(--cls-1)", C: "var(--cls-2)", D: "var(--cls-3)" } };
  QUIZ.figs.pool = host => {
    const h = ctlHost(host, `<button>reveal what D really found</button>`); let truth = false;
    const pool = [...new Set([...POOL.sys.A, ...POOL.sys.B, ...POOL.sys.C])].sort((a, b) => a - b);
    const REL = { fill: tint("--good", 28), stroke: "var(--good)" }, NOT = { fill: "var(--panel-sunk)", stroke: "var(--rule-strong)" },
      UNJ = { fill: "var(--panel)", stroke: "var(--ink-3)", "stroke-dasharray": "3 3" };
    const judged = i => pool.includes(i) ? (POOL.truth.includes(i) ? REL : NOT) : UNJ;
    const draw = () => {
      h.out.innerHTML = ""; const W = 780, H = 270, s = svg(h.out, W, H); defs(s);
      const step = (x, n, t) => txt(s, x, 16, `${n} ${t}`, { "font-size": 12.5, "font-weight": 600 });
      step(20, "①", "three systems retrieve"); step(330, "②", "people judge the pool"); step(560, "③", "a new system is scored");
      ["A", "B", "C"].forEach((k, c) => { const x = 20 + c * 92;
        txt(s, x + 35, 40, `system ${k}`, { "text-anchor": "middle", "font-size": 11.5, fill: POOL.col[k] });
        POOL.sys[k].forEach((i, r) => { box(s, x, 50 + r * 32, 70, 26, judged(i)); txt(s, x + 35, 67 + r * 32, `d${i + 1}`, { "text-anchor": "middle", ...MONO, "font-size": 12 }); }); });
      arrow(s, 292, 125, 326, 125); txt(s, 309, 115, "∪", { "text-anchor": "middle", "font-size": 15 });
      box(s, 330, 30, 150, 196, { fill: "none", stroke: "var(--rule-strong)", rx: 6 });
      txt(s, 405, 46, `the pool: ${pool.length} documents`, { "text-anchor": "middle", ...SMALL });
      pool.forEach((i, j) => { const x = 342 + (j % 2) * 66, y = 56 + Math.floor(j / 2) * 28; box(s, x, y, 58, 22, judged(i)); txt(s, x + 29, y + 15, `d${i + 1}`, { "text-anchor": "middle", ...MONO, "font-size": 11.5 }); });
      arrow(s, 486, 125, 556, 125);
      txt(s, 600, 40, "system D", { "text-anchor": "middle", "font-size": 11.5, fill: POOL.col.D });
      POOL.sys.D.forEach((i, r) => { const y = 50 + r * 32, inPool = pool.includes(i), real = POOL.truth.includes(i);
        box(s, 565, y, 70, 26, inPool ? judged(i) : (truth && real ? { fill: tint("--good", 12), stroke: "var(--good)", "stroke-dasharray": "4 3" } : UNJ));
        txt(s, 600, y + 17, `d${i + 1}`, { "text-anchor": "middle", ...MONO, "font-size": 12 });
        if (!inPool) txt(s, 644, y + 17, truth && real ? "relevant, still 0" : "not judged → 0", { "font-size": 11, fill: truth && real ? "var(--good)" : "var(--bad)" }); });
      [[REL, "judged relevant"], [NOT, "judged not relevant"], [UNJ, "never judged"]].forEach(([a, l], i) => {
        box(s, 20 + i * 170, 248, 14, 14, a); txt(s, 40 + i * 170, 260, l, { "font-size": 11, fill: "var(--ink-2)" }); });
      const D = POOL.sys.D, j = D.filter(i => pool.includes(i) && POOL.truth.includes(i)).length, t = D.filter(i => POOL.truth.includes(i)).length;
      h.stat.innerHTML = `D's P@5 as judged: <b>${j}/5 = ${f2(j / 5)}</b>` + (truth ? ` · in truth: <b>${t}/5 = ${f2(t / 5)}</b>` : "");
    };
    h.ctl.querySelector("button").addEventListener("click", e => { truth = !truth; e.target.classList.toggle("sel", truth); e.target.textContent = truth ? "hide the truth" : "reveal what D really found"; draw(); });
    draw();
  };

  /* --------------------------------------------------------------- block 01: the metrics, the same definitions as ir_metrics.py
     grades: 2 / 1 relevant, 0 judged not relevant, -1 not judged; R — relevant in the collection; gmax = 2 for ERR */
  function metrics(g, k, R) {
    const top = g.slice(0, k), rel = g.map(x => x > 0 ? 1 : 0), b = rel.slice(0, k), hits = b.reduce((a, c) => a + c, 0);
    const first = b.indexOf(1) + 1, p = hits / k, recall = R ? hits / R : 0, f1 = p + recall ? 2 * p * recall / (p + recall) : 0;
    let ap = 0, seen = 0; const apTerms = []; b.forEach((x, i) => { if (x) { seen++; ap += seen / (i + 1); apTerms.push([seen, i + 1]); } }); ap = R ? ap / Math.min(R, k) : 0;
    const rprec = R ? rel.slice(0, R).reduce((a, c) => a + c, 0) / R : 0;
    const listed = g.filter(x => x > 0), ideal = listed.concat(Array(Math.max(0, R - listed.length)).fill(1)).sort((a, c) => c - a).slice(0, k);
    const dcgT = top.map((x, i) => Math.max(x, 0) / Math.log2(i + 2)), dcg = dcgT.reduce((a, c) => a + c, 0), idcg = ideal.reduce((a, x, i) => a + x / Math.log2(i + 2), 0);
    let err = 0, keep = 1; const errT = []; top.forEach((x, i) => { const st = (Math.pow(2, Math.max(x, 0)) - 1) / 4; if (st) errT.push([i + 1, st, keep]); err += keep * st / (i + 1); keep *= 1 - st; });
    const N = g.filter(x => x === 0).length; let bpref = 0, nonrel = 0; const bT = [];
    g.forEach((x, i) => { if (x === 0) nonrel++; else if (x > 0) { const v = nonrel === 0 || N === 0 ? 1 : 1 - Math.min(nonrel, R) / Math.min(R, N); bpref += v; bT.push([i + 1, Math.min(nonrel, R), v]); } });
    bpref = R ? bpref / R : 0;
    return { p, rprec, recall, hit: hits ? 1 : 0, f1, rr: first ? 1 / first : 0, ap, ndcg: idcg ? dcg / idcg : 0, err, bpref,
      _: { hits, first, apTerms, dcgT, dcg, idcg, errT, bT, N, relR: rel.slice(0, R).reduce((a, c) => a + c, 0) } };
  }
  QUIZ.metrics = metrics;

  /* --------------------------------------------------------------- block 01: one list, ten metrics, a tab each */
  const MTABS = [["p", "P@k"], ["rprec", "R-precision"], ["recall", "Recall@k"], ["hit", "Hit@k"], ["f1", "F1@k"], ["rr", "MRR"], ["ap", "AP / MAP"], ["ndcg", "NDCG@k"], ["err", "ERR"], ["bpref", "bpref"]];
  QUIZ.figs.metrics = host => {
    const g = [0, 1, -1, 2, 0, 0, 1, -1, 0, 0]; let k = 5, R = 4, tab = "p";
    host.innerHTML = `<div class="mt-rank"></div>
      <div class="lec-sliders"><label><span>k</span> <b data-v="k"></b><input type="range" min="1" max="10" step="1" data-s="k"></label>
      <label><span>R — relevant in the collection</span> <b data-v="R"></b><input type="range" min="0" max="12" step="1" data-s="R"></label></div>
      <div class="mt-tabs">${MTABS.map(([m, n]) => `<button data-m="${m}">${n}</button>`).join("")}</div><div class="mt-live"></div>`;
    const descs = host.parentElement.querySelectorAll(".mt-desc"), sk = host.querySelector('[data-s="k"]'), sR = host.querySelector('[data-s="R"]');
    const G = x => x === -1 ? "?" : String(x);
    const draw = () => {
      const listed = g.filter(x => x > 0).length; R = Math.max(R, listed); sR.min = listed; sk.value = k; sR.value = R;
      host.querySelector('[data-v="k"]').textContent = k; host.querySelector('[data-v="R"]').textContent = R;
      host.querySelector(".mt-rank").innerHTML = g.map((x, i) => `<button data-i="${i}" class="g${x < 0 ? "u" : x}${i >= k ? " out" : ""}"><span class="n">${i + 1}</span><span class="gr">${G(x)}</span></button>`).join("");
      host.querySelectorAll(".mt-tabs button").forEach(b => b.classList.toggle("sel", b.dataset.m === tab));
      descs.forEach(d => { d.hidden = d.dataset.m !== tab; });
      const m = metrics(g, k, R), t = m._;
      const how = {
        p: `${t.hits} relevant in the top ${k} / ${k}`,
        rprec: `${t.relR} relevant in the top R = ${R} / ${R}`,
        recall: `${t.hits} relevant in the top ${k} / R = ${R}`,
        hit: t.hits ? `something relevant in the top ${k} → 1` : `nothing relevant in the top ${k} → 0`,
        f1: `2 · ${f3(m.p)} · ${f3(m.recall)} / (${f3(m.p)} + ${f3(m.recall)})`,
        rr: t.first ? `the first relevant is at rank ${t.first} → 1/${t.first}` : `no relevant in the top ${k} → 0`,
        ap: t.apTerms.length ? `(${t.apTerms.map(([a, b]) => `${a}/${b}`).join(" + ")}) / min(R, k) = … / ${Math.min(R, k)}` : "no relevant in the top k → 0",
        ndcg: `DCG = ${t.dcgT.map((v, i) => v ? `${Math.max(g[i], 0)}/log₂${i + 2}` : null).filter(Boolean).join(" + ") || "0"} = ${f3(t.dcg)} · best order ${f3(t.idcg)}`,
        err: t.errT.length ? t.errT.map(([r, st, kp]) => `${kp < 1 ? f2(kp) + "·" : ""}${st}/${r}`).join(" + ") + "  (stop probability R = (2^g − 1)/4)" : "no relevant in the top k → 0",
        bpref: t.bT.length ? `N = ${t.N} judged non-relevant · (${t.bT.map(([r, n, v]) => n ? `1 − ${n}/${Math.min(R, t.N)}` : "1").join(" + ")}) / R = ${R}` : "nothing relevant retrieved → 0",
      }[tab];
      const scope = { rprec: "whole list", bpref: "whole list; ? skipped" }[tab] || `top ${k}; ? counts as 0`;
      host.querySelector(".mt-live").innerHTML = `<span class="v">${MTABS.find(x => x[0] === tab)[1]} = ${f3(m[tab])}</span><span class="t">${how}</span><span class="s">${scope}</span>`;
    };
    host.querySelector(".mt-rank").addEventListener("click", e => { const b = e.target.closest("button"); if (!b) return; const i = +b.dataset.i; g[i] = g[i] === 2 ? -1 : g[i] + 1; draw(); });
    host.querySelector(".mt-tabs").addEventListener("click", e => { const b = e.target.closest("button"); if (!b) return; tab = b.dataset.m; draw(); });
    sk.addEventListener("input", () => { k = +sk.value; draw(); }); sR.addEventListener("input", () => { R = +sR.value; draw(); });
    draw();
  };

  QUIZ.figs.pceil = host => {
    const W = 600, H = 230, s = svg(host, W, H);
    const { X, Y } = axes(s, { x0: 50, x1: 480, y0: 20, y1: 180, xmin: 1, xmax: 20, ymin: 0, ymax: 1, xt: [1, 5, 10, 15, 20], yt: [0, 0.5, 1], xl: "k" });
    [[1, "var(--cls-1)"], [3, "var(--cls-0)"], [10, "var(--cls-2)"]].forEach(([R, c]) => {
      const pts = []; for (let k = 1; k <= 20; k++) pts.push([X(k), Y(Math.min(R, k) / k)]);
      poly(s, pts, { stroke: c }); txt(s, X(20) + 8, Y(Math.min(R, 20) / 20) + 4, `R = ${R}`, { "font-size": 12, fill: c }); });
    txt(s, X(10), Y(0.1) - 8, "0.1", { ...MONO, "font-size": 11, fill: "var(--cls-1)", "text-anchor": "middle" });
    dot(s, X(10), Y(0.1), 3.5, "var(--cls-1)");
  };

  const PRK = { rel: [2, 5, 9, 16], R: 4 };
  QUIZ.figs.prk = host => {
    const W = 640, H = 262, s = svg(host, W, H);
    const { X, Y } = axes(s, { x0: 50, x1: 540, y0: 52, y1: 212, xmin: 1, xmax: 20, ymin: 0, ymax: 1, xt: [1, 5, 10, 15, 20], yt: [0, 0.5, 1], xl: "k — how deep the list is read" });
    for (let k = 1; k <= 20; k++) { const r = PRK.rel.includes(k);
      box(s, X(k) - 10, 12, 20, 20, r ? { fill: tint("--good", 35), stroke: "var(--good)" } : { fill: "var(--panel)" });
      txt(s, X(k), 26, String(k), { "text-anchor": "middle", ...MONO, "font-size": 9.5, fill: "var(--ink-3)" }); }
    const rec = [], pre = [];
    for (let k = 1; k <= 20; k++) { const h = PRK.rel.filter(r => r <= k).length; rec.push([X(k), Y(h / PRK.R)]); pre.push([X(k), Y(h / k)]); }
    poly(s, rec, { stroke: "var(--cls-0)" }); poly(s, pre, { stroke: "var(--cls-1)" });
    rec.forEach(p => dot(s, p[0], p[1], 2.5, "var(--cls-0)")); pre.forEach(p => dot(s, p[0], p[1], 2.5, "var(--cls-1)"));
    txt(s, X(20) + 8, Y(1) + 4, "recall@k", { "font-size": 12, fill: "var(--cls-0)" });
    txt(s, X(20) + 8, Y(0.2) + 4, "precision@k", { "font-size": 12, fill: "var(--cls-1)" });
  };

  QUIZ.figs.rrbars = host => {
    const W = 640, H = 240, s = svg(host, W, H);
    const x0 = 50, y0 = 30, y1 = 196, bw = 34, Xc = i => x0 + 26 + i * 48, Y = v => y1 - v * (y1 - y0);
    [0, 0.5, 1].forEach(v => { line(s, x0, Y(v), 600, Y(v), { stroke: "var(--rule)", "stroke-dasharray": "2 3" }); txt(s, x0 - 6, Y(v) + 4, String(v), { "text-anchor": "end", ...MONO, ...SMALL }); });
    const vals = []; for (let r = 1; r <= 10; r++) vals.push([String(r), 1 / r]); vals.push(["none", 0]);
    vals.forEach(([l, v], i) => { el("rect", { x: Xc(i) - bw / 2, y: Y(v), width: bw, height: y1 - Y(v), fill: tint("--cls-0", 45), stroke: "var(--cls-0)" }, s);
      if (v) txt(s, Xc(i), Y(v) - 5, v === 1 ? "1" : v.toFixed(2).replace(/^0/, ""), { "text-anchor": "middle", ...MONO, "font-size": 10.5, fill: "var(--ink-2)" });
      txt(s, Xc(i), y1 + 16, l, { "text-anchor": "middle", ...MONO, ...SMALL }); });
    line(s, x0, y1, 600, y1);
    txt(s, 325, y1 + 34, "rank of the first relevant document", { "text-anchor": "middle", "font-size": 11.5, fill: "var(--ink-3)" });
    const note = (i, j, lab, dy) => { const xa = Xc(i) + bw / 2 + 2, xb = Xc(j) - bw / 2 - 2;
      el("path", { d: `M${xa},${Y(vals[i][1])} C${xb + 6},${Y(vals[i][1])} ${xb},${Y(vals[j][1]) - 10} ${xb},${Y(vals[j][1]) - 2}`, stroke: "var(--cls-1)", fill: "none", "stroke-width": 1.4 }, s);
      txt(s, (xa + xb) / 2 + 4, Y(vals[i][1]) + dy, lab, { ...MONO, "font-size": 11, fill: "var(--cls-1)" }); };
    note(0, 1, "−0.5", -6); note(4, 5, "−0.033", -14); note(9, 10, "−0.1", -14);
  };

  QUIZ.figs.apfig = host => {
    const W = 700, H = 186, s = svg(host, W, H);
    const rel = [1, 3, 6], R = 4, P = i => rel.filter(r => r <= i).length / i;
    for (let i = 1; i <= 8; i++) { const x = 20 + (i - 1) * 62, r = rel.includes(i);
      txt(s, x + 27, 20, String(i), { "text-anchor": "middle", ...MONO, ...SMALL });
      box(s, x, 28, 54, 30, r ? { fill: tint("--good", 30), stroke: "var(--good)" } : { fill: "var(--panel)" });
      if (r) txt(s, x + 27, 80, `P@${i} = ${f2(P(i))}`, { "text-anchor": "middle", ...MONO, "font-size": 11, fill: "var(--good)" }); }
    box(s, 590, 28, 90, 30, { fill: "var(--panel)", stroke: "var(--good)", "stroke-dasharray": "4 3" });
    txt(s, 635, 20, "never found", { "text-anchor": "middle", ...SMALL }); txt(s, 635, 80, "0", { "text-anchor": "middle", ...MONO, "font-size": 11, fill: "var(--good)" });
    const t4 = rel.map(P), ap4 = (t4.reduce((a, c) => a + c, 0)) / R, ap3 = (t4.reduce((a, c) => a + c, 0)) / 3;
    txt(s, 20, 124, `AP = (${t4.map(f2).join(" + ")} + 0) / ${R} = ${f3(ap4)}`, { ...MONO, "font-size": 12.5 });
    txt(s, 20, 152, `the fourth never judged: R = 3, AP = (${t4.map(f2).join(" + ")}) / 3 = ${f3(ap3)}`, { ...MONO, "font-size": 12.5, fill: "var(--cls-1)" });
  };

  QUIZ.figs.disc = host => {
    const W = 640, H = 240, s = svg(host, W, H);
    const { X, Y } = axes(s, { x0: 50, x1: 520, y0: 20, y1: 186, xmin: 1, xmax: 20, ymin: 0, ymax: 1, xt: [1, 5, 10, 15, 20], yt: [0, 0.5, 1], xl: "position r" });
    poly(s, [[X(1), Y(1)], [X(5), Y(1)], [X(5.5), Y(1)], [X(5.5), Y(0)], [X(20), Y(0)]], { stroke: "var(--cls-2)" });
    const a = [], b = []; for (let r = 1; r <= 20; r += 0.25) { a.push([X(r), Y(1 / r)]); b.push([X(r), Y(1 / Math.log2(r + 1))]); }
    poly(s, a, { stroke: "var(--cls-1)" }); poly(s, b, { stroke: "var(--cls-0)" });
    txt(s, X(5.5) + 6, Y(1) + 14, "Hit@5", { "font-size": 12, fill: "var(--cls-2)" });
    txt(s, X(20) + 8, Y(1 / 20) + 2, "1 / r", { "font-size": 12, fill: "var(--cls-1)" });
    txt(s, X(20) + 8, Y(1 / Math.log2(21)) + 4, "1 / log₂(r + 1)", { "font-size": 12, fill: "var(--cls-0)" });
  };

  /* --------------------------------------------------------------- block 01: one ranking, its metrics (the fill question) */
  const REL = [0, 1, 0, 1, 0], R2 = 2;
  { const m5 = metrics(REL, 5, R2); V.p3 = +metrics(REL, 3, R2).p.toFixed(3); V.rr = +m5.rr.toFixed(3); V.ap = +m5.ap.toFixed(3); V.ndcg = +m5.ndcg.toFixed(3); }
  QUIZ.figs.ranking = host => {
    const W = 560, H = 196, s = svg(host, W, H);
    const titles = ["Attention is all you need: a review", "How self-attention scales with length", "Positional encodings, revisited", "Linear attention and its limits", "A history of RNNs"];
    REL.forEach((r, i) => { const y = 8 + i * 37;
      box(s, 40, y, 500, 30, r ? { fill: tint("--good", 16), stroke: "var(--good)" } : { fill: "var(--panel)" });
      txt(s, 24, y + 20, String(i + 1), { "text-anchor": "end", ...MONO, fill: "var(--ink-3)" });
      txt(s, 54, y + 20, titles[i], { "font-size": 13 });
      txt(s, 528, y + 20, r ? "relevant" : "—", { "text-anchor": "end", ...MONO, "font-size": 11, fill: r ? "var(--good)" : "var(--ink-3)" }); });
  };

  /* --------------------------------------------------------------- block 02: the inverted index */
  QUIZ.figs.invidx = host => {
    const W = 760, H = 230, s = svg(host, W, H); defs(s);
    const docs = [["d1", "attention scales with length"], ["d2", "linear attention is fast"], ["d3", "length of the context"]];
    txt(s, 10, 16, "documents", { ...MONO, "font-size": 11, fill: "var(--ink-3)" });
    docs.forEach(([id, t], i) => { const y = 28 + i * 62; box(s, 10, y, 250, 44, { fill: "var(--panel)" }); txt(s, 22, y + 18, id, { ...MONO, "font-size": 11, fill: "var(--cls-0)" }); txt(s, 22, y + 34, t, { "font-size": 13 }); });
    const post = [["attention", ["d1", "d2"]], ["context", ["d3"]], ["fast", ["d2"]], ["length", ["d1", "d3"]], ["linear", ["d2"]], ["scales", ["d1"]]];
    txt(s, 340, 16, "term", { ...MONO, "font-size": 11, fill: "var(--ink-3)" }); txt(s, 470, 16, "postings list", { ...MONO, "font-size": 11, fill: "var(--ink-3)" });
    post.forEach(([term, ds], i) => { const y = 26 + i * 33; const hl = term === "attention" || term === "length";
      box(s, 340, y, 110, 24, { fill: hl ? tint("--cls-1", 16) : "var(--panel)", stroke: hl ? "var(--cls-1)" : "var(--rule-strong)" }); txt(s, 350, y + 16, term, { "font-size": 13 });
      arrow(s, 452, y + 12, 466, y + 12);
      ds.forEach((d, k) => { box(s, 470 + k * 52, y, 44, 24, { fill: "var(--panel-sunk)" }); txt(s, 492 + k * 52, y + 16, d, { ...MONO, "font-size": 11, "text-anchor": "middle", fill: "var(--cls-0)" }); }); });
    arrow(s, 262, 112, 334, 112); txt(s, 298, 104, "invert", { "font-size": 11, "text-anchor": "middle", fill: "var(--ink-3)" });
    txt(s, 572, 50, "query «attention length»", { "font-size": 12, fill: "var(--cls-1)" });
    txt(s, 572, 68, "reads two lists:", { "font-size": 12, fill: "var(--ink-2)" });
    txt(s, 572, 86, "d1 (both), d2, d3", { ...MONO, "font-size": 12, fill: "var(--ink-2)" });
  };

  /* --------------------------------------------------------------- block 02: saturation and length, with sliders */
  QUIZ.figs.bm25 = host => {
    host.innerHTML = `<div class="lec-sliders"><label class="c-k1"><span>k<sub>1</sub> · saturation</span> <b data-v="k1"></b><input type="range" min="0" max="5" step="0.1" value="1.5" data-s="k1"></label>
      <label class="c-b"><span>b · length</span> <b data-v="b"></b><input type="range" min="0" max="1" step="0.05" value="0.75" data-s="b"></label></div><div class="lec-plot"></div>`;
    const plotHost = host.querySelector(".lec-plot");
    const draw = () => {
      const k1 = +host.querySelector('[data-s="k1"]').value, b = +host.querySelector('[data-s="b"]').value;
      host.querySelector('[data-v="k1"]').textContent = k1.toFixed(1); host.querySelector('[data-v="b"]').textContent = b.toFixed(2);
      plotHost.innerHTML = ""; const W = 600, H = 270, L = 46, Rm = 150, T = 14, B = 36, s = svg(plotHost, W, H);
      const tmax = 20, ymax = 6, X = t => L + t / tmax * (W - L - Rm), Y = v => H - B - v / ymax * (H - T - B);
      [0, 2, 4, 6].forEach(v => { line(s, L, Y(v), W - Rm, Y(v), { stroke: "var(--rule)", "stroke-dasharray": "2 3" }); txt(s, L - 6, Y(v) + 4, String(v), { "text-anchor": "end", ...MONO, "font-size": 11, fill: "var(--ink-3)" }); });
      [0, 5, 10, 15, 20].forEach(t => txt(s, X(t), H - B + 16, String(t), { "text-anchor": "middle", ...MONO, "font-size": 11, fill: "var(--ink-3)" }));
      line(s, L, H - B, W - Rm, H - B);
      txt(s, (L + W - Rm) / 2, H - 4, "tf(t, d) — how many times the term occurs", { "text-anchor": "middle", "font-size": 11.5, fill: "var(--ink-3)" });
      const bm = (tf, len) => (tf * (k1 + 1)) / (tf + k1 * (1 - b + b * len)), pts = f => { const o = []; for (let t = 0; t <= tmax; t += 0.25) o.push(`${X(t).toFixed(1)},${Y(Math.min(ymax, f(t))).toFixed(1)}`); return o.join(" "); };
      el("polyline", { points: pts(t => t * 0.5), fill: "none", stroke: "var(--ink-3)", "stroke-width": 1.6, "stroke-dasharray": "5 4" }, s);
      el("polyline", { points: pts(t => bm(t, 1)), fill: "none", stroke: "var(--cls-0)", "stroke-width": 2.4 }, s);
      el("polyline", { points: pts(t => bm(t, 3)), fill: "none", stroke: "var(--cls-1)", "stroke-width": 2.4 }, s);
      line(s, L, Y(k1 + 1), W - Rm, Y(k1 + 1), { stroke: "var(--cls-0)", "stroke-dasharray": "2 4", opacity: 0.6 });
      txt(s, W - Rm + 8, Y(Math.min(ymax, tmax * 0.5)) + 4, "raw count (tf-idf)", { "font-size": 11.5, fill: "var(--ink-3)" });
      txt(s, W - Rm + 8, Y(bm(tmax, 1)) + 4, "average length", { "font-size": 11.5, fill: "var(--cls-0)" });
      txt(s, W - Rm + 8, Y(bm(tmax, 3)) + 14, "3× longer", { "font-size": 11.5, fill: "var(--cls-1)" });
      txt(s, L + 6, Y(k1 + 1) - 5, `ceiling k₁ + 1 = ${(k1 + 1).toFixed(1)}`, { "font-size": 11, fill: "var(--cls-0)" });
    };
    host.querySelectorAll("input").forEach(i => i.addEventListener("input", draw)); draw();
  };

  /* --------------------------------------------------------------- block 03: offline and online */
  QUIZ.figs.lanes = host => {
    const W = 780, H = 256, s = svg(host, W, H); defs(s);
    box(s, 8, 8, 764, 110, { fill: "var(--panel-sunk)", stroke: "var(--rule-strong)", "stroke-dasharray": "4 3", rx: 8 });
    box(s, 8, 132, 764, 116, { fill: tint("--cls-0", 6), stroke: "var(--cls-0)", "stroke-dasharray": "4 3", rx: 8 });
    txt(s, 20, 26, "offline · once per document, when the collection changes", { ...MONO, "font-size": 11, fill: "var(--ink-3)" });
    txt(s, 20, 150, "online · once per query", { ...MONO, "font-size": 11, fill: "var(--cls-0)" });
    [8, 4, 0].forEach(o => box(s, 30 + o, 44 + o, 80, 44, { fill: "var(--panel)" })); txt(s, 74, 74, "documents", { "text-anchor": "middle", "font-size": 12 });
    arrow(s, 120, 70, 156, 70);
    box(s, 160, 48, 100, 44, { fill: tint("--cls-0", 16), stroke: "var(--cls-0)", rx: 8 }); txt(s, 210, 75, "encoder", { "text-anchor": "middle", "font-size": 12.5 });
    arrow(s, 262, 70, 296, 70);
    [0, 1, 2].forEach(i => { for (let j = 0; j < 6; j++) box(s, 300 + j * 12, 52 + i * 13, 11, 10, { fill: tint("--cls-0", 20 + 12 * ((i * 6 + j) % 5)), stroke: "none", rx: 1 }); });
    txt(s, 336, 106, "vectors", { "text-anchor": "middle", ...SMALL });
    arrow(s, 376, 70, 446, 70);
    box(s, 450, 40, 150, 178, { fill: "var(--panel)", stroke: "var(--ink-3)", "stroke-width": 1.4, rx: 8 });
    txt(s, 525, 110, "vector store", { "text-anchor": "middle", "font-size": 13, "font-weight": 600 });
    txt(s, 525, 128, "ANN index", { "text-anchor": "middle", "font-size": 11.5, fill: "var(--ink-2)" });
    txt(s, 525, 144, "+ metadata", { "text-anchor": "middle", "font-size": 11.5, fill: "var(--ink-2)" });
    txt(s, 620, 62, "N forward passes,", { "font-size": 11.5, fill: "var(--ink-2)" }); txt(s, 620, 78, "once", { "font-size": 11.5, fill: "var(--ink-2)" });
    box(s, 30, 176, 80, 30, { fill: tint("--cls-1", 18), stroke: "var(--cls-1)" }); txt(s, 70, 196, "query", { "text-anchor": "middle", "font-size": 12 });
    arrow(s, 112, 191, 156, 191);
    box(s, 160, 169, 100, 44, { fill: tint("--cls-0", 16), stroke: "var(--cls-0)", rx: 8 }); txt(s, 210, 196, "encoder", { "text-anchor": "middle", "font-size": 12.5 });
    line(s, 210, 94, 210, 167, { stroke: "var(--cls-0)", "stroke-dasharray": "3 3" }); txt(s, 216, 110, "same weights", { "font-size": 11, fill: "var(--cls-0)" });
    arrow(s, 262, 191, 296, 191);
    for (let j = 0; j < 6; j++) box(s, 300 + j * 12, 186, 11, 10, { fill: tint("--cls-1", 25 + 10 * (j % 4)), stroke: "none", rx: 1 });
    arrow(s, 376, 191, 446, 191); txt(s, 410, 182, "k nearest?", { "text-anchor": "middle", ...SMALL });
    arrow(s, 602, 191, 636, 191);
    [0, 1, 2].forEach(i => box(s, 640, 170 + i * 16, 110, 12, { fill: tint("--cls-0", 30 - i * 8), stroke: "none", rx: 2 })); txt(s, 695, 230, "top k", { "text-anchor": "middle", ...SMALL });
    txt(s, 300, 236, "1 forward pass + a lookup", { "font-size": 11.5, fill: "var(--ink-2)" });
  };

  /* --------------------------------------------------------------- block 03: a bi-encoder */
  QUIZ.figs.bienc = host => {
    const W = 760, H = 300, s = svg(host, W, H); defs(s);
    const tower = (cx, toks, col, label) => {
      const w = 62, x0 = cx - toks.length * w / 2;
      toks.forEach((t, i) => { box(s, x0 + i * w + 3, 240, w - 6, 24, { fill: "var(--panel)" }); txt(s, x0 + i * w + w / 2, 256, t, { "text-anchor": "middle", "font-size": 12 }); });
      box(s, x0, 186, toks.length * w, 36, { fill: tint(col, 12), stroke: `var(${col})`, rx: 6 });
      txt(s, cx, 208, "encoder (transformer)", { "text-anchor": "middle", "font-size": 12 });
      toks.forEach((t, i) => { const x = x0 + i * w + w / 2; line(s, x, 238, x, 224, { stroke: "var(--ink-3)" }); line(s, x, 184, x, 168, { stroke: "var(--ink-3)" });
        box(s, x - 12, 148, 24, 20, { fill: tint(col, 30 + 7 * (i % 4)), stroke: `var(${col})` });
        el("path", { d: `M${x},146 L${cx},116`, stroke: "var(--rule-strong)", fill: "none" }, s); });
      txt(s, cx + 46, 110, "mean", { ...MONO, ...SMALL });
      for (let j = 0; j < 6; j++) box(s, cx - 39 + j * 13, 98, 12, 16, { fill: tint(col, 30 + 10 * (j % 4)), stroke: `var(${col})`, rx: 1 });
      txt(s, cx, 284, label, { "text-anchor": "middle", ...SMALL });
      return [cx, 96];
    };
    const q = tower(190, ["как", "устроен", "KAN", "?"], "--cls-1", "the query · encoded online");
    const d = tower(540, ["KAN", "—", "сеть", "на", "сплайнах", "…"], "--cls-0", "a passage · encoded offline, once");
    dot(s, 365, 40, 16, "var(--panel)", { stroke: "var(--ink-2)", "stroke-width": 1.4 }); txt(s, 365, 46, "·", { "text-anchor": "middle", "font-size": 22, "font-weight": 700 });
    arrow(s, q[0], q[1], 348, 46); arrow(s, d[0], d[1], 382, 46);
    txt(s, 390, 22, "s(q, d) — one dot product", { "font-size": 12, fill: "var(--ink-2)" });
    txt(s, 80, 162, "token states", { ...SMALL, "text-anchor": "end" });
  };

  /* --------------------------------------------------------------- block 03: in-batch negatives, plus a hard one */
  const B = 32; V.b = B; V.neg = B - 1; V.scores = B * B;
  QUIZ.figs.inbatch = host => {
    const h = ctlHost(host, `<button>+ one hard negative per pair</button>`); let hard = false;
    const draw = () => {
      h.out.innerHTML = ""; const n = 4, C = 42, L = 70, T = 50, cols = hard ? 2 * n : n, W = L + cols * C + 260, H = 240, s = svg(h.out, W, H);
      const sub = "₁₂₃₄";
      txt(s, L + n * C / 2, 18, "passages p₁ … p₄", { "text-anchor": "middle", "font-size": 12, fill: "var(--ink-2)" });
      if (hard) txt(s, L + n * C + n * C / 2, 18, "hard negatives h₁ … h₄", { "text-anchor": "middle", "font-size": 12, fill: "var(--bad)" });
      for (let j = 0; j < cols; j++) txt(s, L + j * C + C / 2 - 2, T - 10, j < n ? `p${sub[j]}` : `h${sub[j - n]}`, { "text-anchor": "middle", ...MONO, "font-size": 12, fill: j < n ? "var(--ink-3)" : "var(--bad)" });
      for (let i = 0; i < n; i++) { txt(s, L - 12, T + i * C + C / 2 + 2, `q${sub[i]}`, { "text-anchor": "end", ...MONO, "font-size": 12, fill: "var(--ink-3)" });
        for (let j = 0; j < cols; j++) { const pos = j === i, own = j === n + i;
          box(s, L + j * C, T + i * C, C - 4, C - 4, pos ? { fill: tint("--good", 40), stroke: "var(--good)" } : own ? { fill: tint("--bad", 40), stroke: "var(--bad)" } : { fill: tint("--bad", 10), stroke: "var(--rule-strong)" });
          txt(s, L + j * C + C / 2 - 2, T + i * C + C / 2 + 3, pos ? "+" : own ? "h" : "−", { "text-anchor": "middle", "font-size": own ? 13 : 15, fill: pos ? "var(--good)" : "var(--bad)" }); } }
      const lx = L + cols * C + 20;
      txt(s, lx, T + 16, "+  the pair's own passage", { "font-size": 12, fill: "var(--good)" });
      txt(s, lx, T + 36, "−  another pair's passage:", { "font-size": 12, fill: "var(--bad)" });
      txt(s, lx + 14, T + 52, "a free negative", { "font-size": 12, fill: "var(--bad)" });
      if (hard) { txt(s, lx, T + 80, "h  looks relevant, is not:", { "font-size": 12, fill: "var(--bad)" }); txt(s, lx + 14, T + 96, "a BM25 hit, not the answer", { "font-size": 12, fill: "var(--bad)" }); }
      txt(s, lx, T + 130, "each row is a softmax", { "font-size": 12, fill: "var(--ink-2)" });
      txt(s, lx, T + 146, `over its ${cols} columns`, { "font-size": 12, fill: "var(--ink-2)" });
    };
    h.ctl.querySelector("button").addEventListener("click", e => { hard = !hard; e.target.classList.toggle("sel", hard); e.target.textContent = hard ? "− the hard negatives" : "+ one hard negative per pair"; draw(); });
    draw();
  };

  /* --------------------------------------------------------------- block 03: where each strategy's negatives sit */
  QUIZ.figs.negs = host => {
    const W = 760, H = 236, s = svg(host, W, H); defs(s);
    const x0 = 180, x1 = 720, pos = 690;
    const rows = [["random", "var(--ink-3)", [0.04, 0.1, 0.17, 0.24, 0.3]], ["in-batch", "var(--cls-3)", [0.12, 0.2, 0.27, 0.36, 0.42]],
      ["BM25", "var(--cls-1)", [0.44, 0.5, 0.56, 0.6, 0.66]], ["hard, by cosine", "var(--bad)", [0.7, 0.75, 0.8, 0.84, 0.87]]];
    const X = v => x0 + v * (pos - 30 - x0);
    line(s, pos, 14, pos, 176, { stroke: "var(--good)", "stroke-dasharray": "3 3" });
    txt(s, pos - 6, 196, "the positive", { "text-anchor": "end", "font-size": 11.5, fill: "var(--good)" });
    rows.forEach(([name, c, xs], r) => { const y = 34 + r * 38;
      txt(s, 14, y + 4, name, { "font-size": 12.5, fill: c });
      line(s, x0, y, x1, y, { stroke: "var(--rule)" });
      xs.forEach(v => dot(s, X(v), y, 6, c, { opacity: 0.85 }));
      dot(s, pos, y, 7, "var(--good)"); });
    const fy = 34 + 3 * 38; dot(s, X(0.93), fy, 6, "none", { stroke: "var(--good)", "stroke-width": 2, "stroke-dasharray": "2 2" });
    txt(s, X(0.93) - 4, fy + 22, "relevant, unlabelled → a false negative", { "text-anchor": "end", "font-size": 11, fill: "var(--good)" });
    arrow(s, x0, 214, x1, 214); txt(s, x0, 230, "far from the query", SMALL); txt(s, x1, 230, "cosine to the query → close", { ...SMALL, "text-anchor": "end" });
  };

  /* --------------------------------------------------------------- block 03: prefixes, schematically */
  QUIZ.figs.prefix = host => {
    const h = ctlHost(host, `<button data-m="0" class="sel">documents with passage:</button> <button data-m="1">documents with query: (the bug)</button>`); let wrong = 0;
    const DOCS = [["ans", [360, 118], [470, 70]], ["faq", [210, 206], [300, 150]], ["o1", [420, 190], [258, 104]], ["o2", [470, 120], [210, 168]], ["o3", [400, 60], [350, 196]], ["o4", [520, 200], [178, 120]]];
    const q = [318, 132];
    const draw = () => {
      h.out.innerHTML = ""; const W = 640, H = 250, s = svg(h.out, W, H);
      el("ellipse", { cx: 250, cy: 140, rx: 120, ry: 92, fill: tint("--cls-1", 8), stroke: "var(--cls-1)", "stroke-dasharray": "4 3" }, s);
      txt(s, 160, 40, "where questions land", { "font-size": 11.5, fill: "var(--cls-1)" });
      const P = DOCS.map(([id, a, b]) => [id, wrong ? b : a]);
      const near = P.slice().sort((u, v) => Math.hypot(u[1][0] - q[0], u[1][1] - q[1]) - Math.hypot(v[1][0] - q[0], v[1][1] - q[1])).slice(0, 2);
      near.forEach(([, p]) => line(s, q[0], q[1], p[0], p[1], { stroke: "var(--ink-2)", "stroke-dasharray": "3 3" }));
      P.forEach(([id, p]) => { const c = id === "ans" ? "var(--good)" : id === "faq" ? "var(--cls-3)" : "var(--ink-3)"; dot(s, p[0], p[1], 7, c);
        if (id === "ans") txt(s, p[0] + 11, p[1] + 4, "the answer", { "font-size": 11.5, fill: c });
        if (id === "faq") txt(s, p[0] + 11, p[1] + 4, "«how do I…?» — reads like a question", { "font-size": 11.5, fill: c }); });
      el("path", { d: `M${q[0]},${q[1] - 9} L${q[0] + 8},${q[1] + 6} L${q[0] - 8},${q[1] + 6} z`, fill: "var(--cls-1)" }, s);
      txt(s, q[0] - 6, q[1] + 24, "new question", { "font-size": 11.5, fill: "var(--cls-1)", "text-anchor": "end" });
      txt(s, 620, 240, "dashed: the two nearest documents", { ...SMALL, "text-anchor": "end" });
    };
    h.ctl.addEventListener("click", e => { const b = e.target.closest("button"); if (!b) return; wrong = +b.dataset.m; h.ctl.querySelectorAll("button").forEach(x => x.classList.toggle("sel", x === b)); draw(); });
    draw();
  };

  /* --------------------------------------------------------------- block 04: IVF on a 2-D cloud */
  function clipHalf(poly, a, b) {   // keep the side of the bisector of a, b nearer to a
    const m = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2], n = [b[0] - a[0], b[1] - a[1]], f = p => (p[0] - m[0]) * n[0] + (p[1] - m[1]) * n[1], out = [];
    for (let i = 0; i < poly.length; i++) { const p = poly[i], r = poly[(i + 1) % poly.length], fp = f(p), fr = f(r);
      if (fp <= 0) out.push(p); if ((fp < 0) !== (fr < 0) && fp !== fr) { const t = fp / (fp - fr); out.push([p[0] + t * (r[0] - p[0]), p[1] + t * (r[1] - p[1])]); } }
    return out;
  }
  const IV = LD.ivf;
  const d2 = (p, q) => (p[0] - q[0]) * (p[0] - q[0]) + (p[1] - q[1]) * (p[1] - q[1]);
  function ivfSearch(q, nprobe) {   // the same as ivf_found in export_lecture_data.py: squared distance, ties by index
    const byD = (A, idx) => idx.slice().sort((i, j) => d2(A[i], q) - d2(A[j], q) || i - j);
    const all = IV.pts.map((_, i) => i), exact = byD(IV.pts, all).slice(0, IV.k);
    const probed = byD(IV.cent, IV.cent.map((_, i) => i)).slice(0, nprobe);
    const cand = all.filter(i => probed.includes(IV.cell[i]));
    return { exact, found: byD(IV.pts, cand).slice(0, IV.k), probed, cand: cand.length };
  }
  QUIZ.ivfSearch = ivfSearch;
  QUIZ.figs.ivf = host => {
    const h = ctlHost(host, `<div class="lec-sliders"><label><span>n<sub>probe</sub></span> <b data-v="np"></b><input type="range" min="1" max="8" step="1" value="1" data-s="np"></label></div>
      <span class="ivf-q">query: ${IV.presets.map((_, i) => `<button data-q="${i}"${i ? "" : ' class="sel"'}>${i + 1}</button>`).join(" ")} or click the map</span>`);
    let q = IV.presets[0].slice(), np = 1;
    const cells = IV.cent.map((c, i) => IV.cent.reduce((poly, o, j) => j === i ? poly : clipHalf(poly, c, o), [[0, 0], [1, 0], [1, 1], [0, 1]]));
    const S = 440, P = 10, X = x => P + x * S, Y = y => P + (1 - y) * S;
    const draw = () => {
      h.out.innerHTML = ""; const s = svg(h.out, S + 2 * P, S + 2 * P); h.ctl.querySelector('[data-v="np"]').textContent = np;
      const r = ivfSearch(q, np);
      cells.forEach((poly, i) => el("polygon", { points: poly.map(p => X(p[0]).toFixed(1) + "," + Y(p[1]).toFixed(1)).join(" "),
        fill: r.probed.includes(i) ? tint("--cls-0", 18) : "var(--panel)", stroke: "var(--rule-strong)", "stroke-width": 0.8 }, s));
      IV.pts.forEach((p, i) => dot(s, X(p[0]), Y(p[1]), 2, r.probed.includes(IV.cell[i]) ? "var(--ink-2)" : "var(--rule-strong)"));
      IV.cent.forEach(c => { line(s, X(c[0]) - 4, Y(c[1]), X(c[0]) + 4, Y(c[1]), { stroke: "var(--ink-3)" }); line(s, X(c[0]), Y(c[1]) - 4, X(c[0]), Y(c[1]) + 4, { stroke: "var(--ink-3)" }); });
      r.exact.forEach(i => dot(s, X(IV.pts[i][0]), Y(IV.pts[i][1]), 5.5, "none", { stroke: r.found.includes(i) ? "var(--good)" : "var(--bad)", "stroke-width": 2 }));
      el("path", { d: `M${X(q[0])},${Y(q[1]) - 9} L${X(q[0]) + 8},${Y(q[1]) + 6} L${X(q[0]) - 8},${Y(q[1]) + 6} z`, fill: "var(--cls-1)" }, s);
      const got = r.exact.filter(i => r.found.includes(i)).length;
      h.stat.innerHTML = `<b>found ${got} of ${IV.k}</b> true neighbours · probed ${np} of ${IV.cent.length} cells, ${r.cand} of ${IV.pts.length} points scanned · <span style="color:var(--good)">○ found</span> <span style="color:var(--bad)">○ missed</span>`;
      s.addEventListener("click", ev => { const pt = s.createSVGPoint(); pt.x = ev.clientX; pt.y = ev.clientY; const m = pt.matrixTransform(s.getScreenCTM().inverse());
        q = [Math.min(1, Math.max(0, (m.x - P) / S)), Math.min(1, Math.max(0, 1 - (m.y - P) / S))]; h.ctl.querySelectorAll("[data-q]").forEach(b => b.classList.remove("sel")); draw(); });
    };
    h.ctl.querySelector('[data-s="np"]').addEventListener("input", e => { np = +e.target.value; draw(); });
    h.ctl.querySelectorAll("[data-q]").forEach(b => b.addEventListener("click", () => { q = IV.presets[+b.dataset.q].slice(); h.ctl.querySelectorAll("[data-q]").forEach(x => x.classList.toggle("sel", x === b)); draw(); }));
    draw();
  };

  QUIZ.figs.ivfreal = host => {
    const W = 640, H = 240, s = svg(host, W, H), R = LD.ivf_real;
    const { X, Y } = axes(s, { x0: 50, x1: 610, y0: 20, y1: 186, xmin: 1, xmax: 64, ymin: 0, ymax: 1, xlog: true, xt: R.nprobe, yt: [0, 0.5, 1], xl: `n_probe — cells probed, of ${R.cells}` });
    poly(s, R.nprobe.map((n, i) => [X(n), Y(R.scanned[i])]), { stroke: "var(--ink-3)", "stroke-dasharray": "5 4", "stroke-width": 1.8 });
    poly(s, R.nprobe.map((n, i) => [X(n), Y(R.recall[i])]), { stroke: "var(--cls-0)" });
    R.nprobe.forEach((n, i) => { dot(s, X(n), Y(R.recall[i]), 3.5, "var(--cls-0)");
      if (i < R.nprobe.length - 1) { txt(s, X(n), Y(R.recall[i]) - 9, f2(R.recall[i]), { "text-anchor": "middle", ...MONO, "font-size": 10.5, fill: "var(--cls-0)" });
        txt(s, X(n) + 4, Y(R.scanned[i]) - 6, pct(R.scanned[i]), { ...MONO, "font-size": 10.5, fill: "var(--ink-3)" }); } });
    txt(s, X(1) + 4, Y(1) + 4, "recall of the exact top 10 (blue)", { "font-size": 12, fill: "var(--cls-0)" });
    txt(s, X(1) + 4, Y(1) + 20, "share of the collection scanned (grey)", { "font-size": 12, fill: "var(--ink-3)" });
  };

  /* --------------------------------------------------------------- block 04: product quantisation */
  QUIZ.figs.pq = host => {
    const W = 760, H = 210, s = svg(host, W, H); defs(s);
    txt(s, 20, 18, "one vector, d = 1024 float32 = 4096 B", { "font-size": 12, fill: "var(--ink-2)" });
    const sw = 90;
    for (let j = 0; j < 8; j++) { const x = 20 + j * sw;
      box(s, x, 28, sw - 4, 26, { fill: tint("--cls-0", 14 + 6 * (j % 3)), stroke: "var(--cls-0)", rx: 2 }); txt(s, x + sw / 2 - 2, 46, "128 d", { "text-anchor": "middle", ...MONO, "font-size": 10.5 });
      arrow(s, x + sw / 2 - 2, 56, x + sw / 2 - 2, 82);
      for (let a = 0; a < 4; a++) for (let b = 0; b < 4; b++) dot(s, x + 26 + a * 12, 92 + b * 10, 3, (a * 4 + b) === (j * 5) % 16 ? "var(--cls-1)" : "var(--rule-strong)");
      arrow(s, x + sw / 2 - 2, 134, x + sw / 2 - 2, 152);
      box(s, x + 24, 156, 40, 24, { fill: tint("--cls-1", 18), stroke: "var(--cls-1)" }); txt(s, x + 44, 172, `c${"₁₂₃₄₅₆₇₈"[j]}`, { "text-anchor": "middle", ...MONO, "font-size": 12 }); }
    txt(s, 20, 202, "each piece → the index of its nearest centroid among 256 (a codebook per piece): 8 codes × 1 B = 8 B", { "font-size": 12, fill: "var(--ink-2)" });
  };

  /* --------------------------------------------------------------- block 04: filtering after the search, or during it */
  QUIZ.figs.postf = host => {
    const W = 780, H = 226, s = svg(host, W, H); defs(s);
    const lane = (y, title, steps, cells, verdict, vc) => {
      txt(s, 14, y, title, { "font-size": 12.5, "font-weight": 600 });
      let x = 14; steps.forEach(([t, w, hl], i) => { if (i) { arrow(s, x + 2, y + 31, x + 26, y + 31); x += 30; }
        box(s, x, y + 14, w, 34, hl ? { fill: tint("--cls-1", 16), stroke: "var(--cls-1)" } : { fill: "var(--panel)" });
        txt(s, x + w / 2, y + 36, t, { "text-anchor": "middle", "font-size": 12 }); x += w; });
      arrow(s, x + 2, y + 31, x + 26, y + 31); x += 30;
      cells.forEach((ok, i) => { box(s, x + i * 22, y + 20, 18, 22, ok ? { fill: tint("--good", 35), stroke: "var(--good)" } : { fill: "var(--panel-sunk)" });
        if (!ok) txt(s, x + i * 22 + 9, y + 36, "×", { "text-anchor": "middle", "font-size": 12, fill: "var(--bad)" }); });
      txt(s, x + 230, y + 37, verdict, { "font-size": 13, "font-weight": 600, fill: vc });
    };
    lane(16, "filter after the search (post-filtering)", [["1 M posts", 90], ["top 10 by cosine", 130], ["keep «2024»", 110, 1]], Array(10).fill(0), "≈ 0 left", "var(--bad)");
    lane(120, "filter during the search (pre-filtering)", [["1 M posts", 90], ["keep «2024» → 20 000", 160, 1], ["top 10", 80]], Array(10).fill(1), "10 left", "var(--good)");
    txt(s, 14, 214, "2% of the posts are from 2024: of the 10 nearest, 10 × 0.02 = 0.2 pass on average.", { "font-size": 11.5, fill: "var(--ink-2)" });
  };

  /* --------------------------------------------------------------- block 05: the weight of a rank in RRF */
  QUIZ.figs.rrfw = host => {
    const h = ctlHost(host, `<div class="lec-sliders"><label>c <b data-v="c"></b><input type="range" min="0" max="100" step="1" value="60" data-s="c"></label></div>`);
    const draw = () => {
      const c = +h.ctl.querySelector("input").value; h.ctl.querySelector('[data-v="c"]').textContent = c;
      h.out.innerHTML = ""; const W = 600, H = 230, s = svg(h.out, W, H);
      const { X, Y } = axes(s, { x0: 50, x1: 480, y0: 20, y1: 180, xmin: 1, xmax: 20, ymin: 0, ymax: 1, xt: [1, 5, 10, 15, 20], yt: [0, 0.5, 1], xl: "rank r in one list" });
      const a = [], b = []; for (let r = 1; r <= 20; r++) { a.push([X(r), Y((c + 1) / (c + r))]); b.push([X(r), Y(1 / r)]); }
      poly(s, b, { stroke: "var(--ink-3)", "stroke-dasharray": "5 4", "stroke-width": 1.6 }); poly(s, a, { stroke: "var(--ink)" });
      a.forEach(p => dot(s, p[0], p[1], 2.5, "var(--ink)"));
      txt(s, X(20) + 8, Y((c + 1) / (c + 20)) + 4, `c = ${c}`, { "font-size": 12 });
      txt(s, X(20) + 8, Y(1 / 20) + 4, "c = 0", { "font-size": 12, fill: "var(--ink-3)" });
      h.stat.innerHTML = `rank 1 is worth <b>${f3((c + 2) / (c + 1))}×</b> rank 2 · rank 10 keeps <b>${pct((c + 1) / (c + 10))}</b> of rank 1's weight`;
    };
    h.ctl.querySelector("input").addEventListener("input", draw); draw();
  };

  /* --------------------------------------------------------------- block 06: the cascade on gonzo_ML */
  QUIZ.figs.cascade = host => {
    const W = 660, H = 250, s = svg(host, W, H), C = LD.cascade, n = C.depth.length;
    const { X, Y } = axes(s, { x0: 50, x1: 460, y0: 20, y1: 190, xmin: 1, xmax: n, ymin: 0.5, ymax: 1, xt: [1, 10, 20, 30, 40, 50], yt: [0.5, 0.75, 1], yfmt: v => v.toFixed(2), xl: "depth k — candidates the reranker reads" });
    line(s, X(20), Y(0.5), X(20), Y(1), { stroke: "var(--rule-strong)", "stroke-dasharray": "2 3" });
    line(s, X(1), Y(C.first_mrr), X(n), Y(C.first_mrr), { stroke: "var(--cls-1)", "stroke-dasharray": "5 4", "stroke-width": 1.6 });
    const step = arr => { const o = []; arr.forEach((v, i) => { if (i) o.push([X(C.depth[i]), Y(arr[i - 1])]); o.push([X(C.depth[i]), Y(v)]); }); return o; };
    poly(s, step(C.first_hit), { stroke: "var(--ink-3)", "stroke-width": 3, opacity: 0.6 }); poly(s, step(C.mrr), { stroke: "var(--cls-0)" });
    txt(s, X(n) + 8, Y(C.first_hit[n - 1]) + 4, "ceiling: first-stage Hit@k", { "font-size": 12, fill: "var(--ink-3)" });
    txt(s, X(n) + 8, Y(C.mrr[n - 1]) + 10, "MRR after reranking", { "font-size": 12, fill: "var(--cls-0)" });
    txt(s, X(n) + 8, Y(C.first_mrr) + 14, "first stage alone, MRR", { "font-size": 12, fill: "var(--cls-1)" });
  };

  /* --------------------------------------------------------------- block 07: two evaluations */
  QUIZ.figs.blame = host => {
    const W = 760, H = 214, s = svg(host, W, H);
    txt(s, 340, 22, "the answer is right", { "text-anchor": "middle", "font-size": 12.5, "font-weight": 600 });
    txt(s, 610, 22, "the answer is wrong", { "text-anchor": "middle", "font-size": 12.5, "font-weight": 600 });
    txt(s, 14, 78, "the right passage", { "font-size": 12.5, "font-weight": 600 }); txt(s, 14, 94, "is in the prompt", { "font-size": 12.5, "font-weight": 600 });
    txt(s, 14, 162, "it is not", { "font-size": 12.5, "font-weight": 600 });
    const cell = (x, y, c, a, b) => { box(s, x, y, 260, 76, { fill: tint(c, 16), stroke: `var(${c})` }); txt(s, x + 12, y + 30, a, { "font-size": 13, "font-weight": 600, fill: `var(${c})` }); txt(s, x + 12, y + 52, b, { "font-size": 12, fill: "var(--ink-2)" }); };
    cell(220, 40, "--good", "it works", "both halves did their job");
    cell(484, 40, "--cls-1", "the generator's failure", "prompt, model, position, noise");
    cell(220, 126, "--cls-3", "not grounded", "the model's memory, or luck");
    cell(484, 126, "--bad", "the retriever's failure", "— or no answer exists: refuse");
  };

  /* --------------------------------------------------------------- block 07: the best cosine, answerable or not */
  QUIZ.figs.strip = host => {
    const W = 640, H = 170, s = svg(host, W, H), g = LD.top1_golden, na = LD.top1_noanswer, all = g.concat(na);
    const lo = Math.floor(Math.min(...all) * 20) / 20, hi = Math.ceil(Math.max(...all) * 20) / 20;
    const ticks = []; for (let t = lo; t <= hi + 1e-9; t += 0.05) ticks.push(+t.toFixed(2));
    const { X } = axes(s, { x0: 150, x1: 620, y0: 20, y1: 130, xmin: lo, xmax: hi, ymin: 0, ymax: 1, xt: ticks, xfmt: v => v.toFixed(2), xl: "the best cosine over the posts" });
    const row = (vals, y, c) => { const used = []; vals.slice().sort((a, b) => a - b).forEach(v => { let k = 0; while (used.some(u => Math.abs(u[0] - X(v)) < 9 && u[1] === k)) k++; used.push([X(v), k]);
      dot(s, X(v), y + 10 * (k % 3) - 10, 5, c, { opacity: 0.85 }); }); };
    txt(s, 10, 60, `answerable (${g.length})`, { "font-size": 12, fill: "var(--good)" }); row(g, 52, "var(--good)");
    txt(s, 10, 110, `no answer (${na.length})`, { "font-size": 12, fill: "var(--bad)" }); row(na, 102, "var(--bad)");
    [LD.top1_golden_min, LD.top1_noanswer_max].forEach(v => line(s, X(v), 24, X(v), 128, { stroke: "var(--ink-3)", "stroke-dasharray": "2 3" }));
    txt(s, X(LD.top1_golden_min) + 6, 22, `gap ${V.gap}`, { ...MONO, "font-size": 11, fill: "var(--ink-2)" });
  };

  /* --------------------------------------------------------------- block 04: HNSW */
  QUIZ.figs.hnsw = host => {
    const W = 720, H = 300, s = svg(host, W, H); defs(s);
    const layers = [{ y: 50, pts: [[120, 0], [420, 0], [620, 0]] }, { y: 150, pts: [[80, 0], [200, 0], [330, 0], [420, 0], [540, 0], [640, 0]] },
      { y: 250, pts: [[60, 0], [110, 0], [170, 0], [230, 0], [290, 0], [350, 0], [420, 0], [480, 0], [530, 0], [590, 0], [650, 0]] }];
    const names = ["layer 2 · sparse", "layer 1", "layer 0 · every vector"];
    const qx = 545;
    layers.forEach((L, li) => { el("rect", { x: 30, y: L.y - 26, width: 660, height: 52, rx: 8, fill: "var(--panel-sunk)", stroke: "var(--rule)" }, s);
      txt(s, 40, L.y - 12, names[li], { ...MONO, "font-size": 10.5, fill: "var(--ink-3)" });
      L.pts.forEach((p, k) => { if (k) line(s, L.pts[k - 1][0], L.y + 6, p[0], L.y + 6, { stroke: "var(--rule-strong)" }); });
      L.pts.forEach(p => el("circle", { cx: p[0], cy: L.y + 6, r: 6, fill: "var(--panel)", stroke: "var(--ink-3)", "stroke-width": 1.2 }, s)); });
    const path = [[120, 50], [420, 50], [420, 150], [540, 150], [540, 250], [530, 250]];
    for (let i = 1; i < path.length; i++) arrow(s, path[i - 1][0], path[i - 1][1] + 6, path[i][0] + (path[i][0] === path[i - 1][0] ? 0 : (path[i][0] > path[i - 1][0] ? -8 : 8)), path[i][1] + (path[i][0] === path[i - 1][0] ? -2 : 6), "var(--cls-1)");
    path.forEach(p => el("circle", { cx: p[0], cy: p[1] + 6, r: 6, fill: "var(--cls-1)" }, s));
    el("circle", { cx: qx, cy: 282, r: 5, fill: "var(--cls-0)" }, s); txt(s, qx + 10, 290, "the query", { "font-size": 12, fill: "var(--cls-0)" });
    txt(s, 120, 74, "entry point", { "text-anchor": "middle", "font-size": 11.5, fill: "var(--cls-1)" });
  };

  /* --------------------------------------------------------------- block 06: three ways to score a pair (point) */
  const CL = { off: ["var(--panel-sunk)", "var(--rule-strong)"], q: [tint("--cls-0", 18), "var(--cls-0)"], pair: [tint("--cls-1", 18), "var(--cls-1)"] };
  QUIZ.figs.encoders = host => {
    const W = 780, H = 250, s = svg(host, W, H); defs(s);
    const col = (x, title) => txt(s, x + 110, 20, title, { "text-anchor": "middle", "font-size": 13.5, "font-weight": 600 });
    const part = (key, x, y, w, h, label, kind, sub) => { const g = pickable(s, key, x, y, w, h); box(g, x, y, w, h, { fill: CL[kind][0], stroke: CL[kind][1], "stroke-width": 1.3 });
      txt(g, x + w / 2, y + (sub ? h / 2 - 2 : h / 2 + 4), label, { "text-anchor": "middle", "font-size": 12.5 }); if (sub) txt(g, x + w / 2, y + h / 2 + 13, sub, { "text-anchor": "middle", "font-size": 10.5, fill: "var(--ink-3)" }); g.hit(); return g; };
    // bi-encoder
    col(10, "bi-encoder");
    txt(s, 60, 50, "document", { "text-anchor": "middle", "font-size": 11.5, fill: "var(--ink-3)" }); txt(s, 170, 50, "query", { "text-anchor": "middle", "font-size": 11.5, fill: "var(--ink-3)" });
    part("bi-doc", 12, 60, 96, 46, "encoder", "off", "one vector");
    part("bi-q", 122, 60, 96, 46, "encoder", "q", "one vector");
    arrow(s, 60, 108, 104, 160); arrow(s, 170, 108, 128, 160);
    part("bi-dot", 70, 162, 90, 34, "dot product", "pair");
    // cross-encoder
    col(270, "cross-encoder");
    txt(s, 380, 50, "[CLS] query [SEP] document", { "text-anchor": "middle", ...MONO, "font-size": 11, fill: "var(--ink-3)" });
    part("cross", 290, 60, 180, 100, "one encoder,", "pair", "both texts at once");
    arrow(s, 380, 162, 380, 178); txt(s, 380, 196, "a relevance score", { "text-anchor": "middle", "font-size": 12, fill: "var(--ink-2)" });
    // ColBERT
    col(540, "late interaction (ColBERT)");
    txt(s, 600, 50, "document", { "text-anchor": "middle", "font-size": 11.5, fill: "var(--ink-3)" }); txt(s, 710, 50, "query", { "text-anchor": "middle", "font-size": 11.5, fill: "var(--ink-3)" });
    part("col-doc", 552, 60, 96, 46, "encoder", "off", "per token");
    part("col-q", 662, 60, 96, 46, "encoder", "q", "per token");
    arrow(s, 600, 108, 644, 160); arrow(s, 710, 108, 668, 160);
    part("col-max", 610, 162, 90, 34, "MaxSim", "pair");
    // legend
    [["off", "offline, once per document"], ["q", "once per query"], ["pair", "once per (query, document) pair"]].forEach(([k, l], i) => {
      box(s, 70 + i * 220, 226, 14, 14, { fill: CL[k][0], stroke: CL[k][1] }); txt(s, 90 + i * 220, 238, l, { "font-size": 11.5, fill: "var(--ink-2)" }); });
  };

  /* --------------------------------------------------------------- blocks 05, 06: arithmetic */
  V.rrf_a = +(1 / 61 + 1 / 65).toFixed(4); V.rrf_b = +(1 / 63 + 1 / 62).toFixed(4);
  V.n_coll = 1000000; V.k_pool = 100; V.with = V.k_pool; V.without = V.n_coll;
})();
