"use strict";
/* week 9 — the interactive part. demo_base/base.js (TXT) is prepended at build; the data is in #demo-data. */
performance.mark("x:start");
const D = JSON.parse(document.getElementById("demo-data").textContent);

/* --------------------------------------------------------------- helpers (week 6/8) */
const $ = (s, r) => (r || document).querySelector(s);
const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const NS = "http://www.w3.org/2000/svg";
function svg(w, h) { const s = document.createElementNS(NS, "svg"); s.setAttribute("viewBox", `0 0 ${w} ${h}`); s.setAttribute("width", "100%"); s.style.maxWidth = w + "px"; return s; }
const PAINT = { fill: 1, stroke: 1 };
function el(tag, attrs, text) {
  const n = document.createElementNS(NS, tag); let style = "";
  for (const k in attrs) { const v = attrs[k]; if (PAINT[k] && typeof v === "string" && (v.startsWith("var(") || v.startsWith("color-mix("))) style += `${k}:${v};`; else n.setAttribute(k, v); }
  if (style) n.setAttribute("style", style); if (text != null) n.textContent = text; return n;
}
const TIP = $("#tip");
function tipOn(node, html) {
  node.addEventListener("pointerenter", e => { TIP.innerHTML = typeof html === "function" ? html() : html; TIP.style.opacity = "1"; moveTip(e); });
  node.addEventListener("pointermove", moveTip); node.addEventListener("pointerleave", () => { TIP.style.opacity = "0"; });
}
function moveTip(e) { const pad = 14, r = TIP.getBoundingClientRect(); let x = e.clientX + pad, y = e.clientY + pad; if (x + r.width > innerWidth - 8) x = e.clientX - r.width - pad; if (y + r.height > innerHeight - 8) y = e.clientY - r.height - pad; TIP.style.left = x + "px"; TIP.style.top = y + "px"; }
const css = name => `var(${name})`;
const TINT = (v, p) => `color-mix(in srgb, var(${v}) ${p}%, var(--panel))`;
function txt(s, x, y, t, o) { o = o || {}; return s.appendChild(el("text", { x, y, "font-size": o.fs || 13.5, "text-anchor": o.anchor || "middle", fill: o.color || css("--ink-2"), "font-weight": o.bold ? "600" : "400", "font-family": o.mono ? "var(--mono)" : "var(--body)" }, t)); }
function rect(s, x, y, w, h, o) { o = o || {}; return s.appendChild(el("rect", { x, y, width: Math.max(0, w), height: Math.max(0, h), rx: o.rx == null ? 2 : o.rx, fill: o.fill || "none", stroke: o.stroke || "none", "stroke-width": o.sw || 1.2, opacity: o.op == null ? 1 : o.op })); }
function line(s, x1, y1, x2, y2, o) { o = o || {}; return s.appendChild(el("line", { x1, y1, x2, y2, stroke: o.color || css("--rule"), "stroke-width": o.sw || 1, "stroke-dasharray": o.dash ? "4 4" : "none" })); }
const f2 = x => Number(x).toFixed(2), f3 = x => Number(x).toFixed(3);
const stat = (v, k) => `<div class="stat"><span class="v">${v}</span><span class="k">${k}</span></div>`;

function plot(host, o) {
  const W = o.w || 560, H = o.h || 300, L = o.l || 54, R = o.r || 16, T = o.t || 14, B = o.b || 42;
  const s = svg(W, H); const fs = o.fs || 12;
  const X = v => L + (v - o.x[0]) / (o.x[1] - o.x[0]) * (W - L - R);
  const Y = v => H - B - (v - o.y[0]) / (o.y[1] - o.y[0]) * (H - T - B);
  (o.yt || []).forEach(v => { line(s, L, Y(v), W - R, Y(v), { color: css("--rule"), dash: 1 }); txt(s, L - 6, Y(v) + 4, o.yf ? o.yf(v) : String(v), { anchor: "end", fs, mono: 1, color: css("--ink-3") }); });
  (o.xt || []).forEach(v => { line(s, X(v), H - B, X(v), H - B + 4, { color: css("--rule-strong") }); txt(s, X(v), H - B + 17, o.xf ? o.xf(v) : String(v), { fs, mono: 1, color: css("--ink-3") }); });
  line(s, L, H - B, W - R, H - B, { color: css("--rule-strong") });
  if (o.xl) txt(s, (L + W - R) / 2, H - 6, o.xl, { fs, color: css("--ink-3") });
  if (o.yl) txt(s, L, T - 2 + fs, o.yl, { fs, anchor: "start", color: css("--ink-3") });
  (o.series || []).forEach(sr => {
    s.appendChild(el("polyline", { points: sr.pts.map(p => `${X(p[0]).toFixed(1)},${Y(p[1]).toFixed(1)}`).join(" "), fill: "none", stroke: sr.color, "stroke-width": sr.sw || 2.4, "stroke-dasharray": sr.dash ? "6 5" : "none" }));
  });
  host.innerHTML = ""; host.appendChild(s); return { s, X, Y, W, H, L, R, T, B };
}

/* bets and reveals (week 6) */
function makeBet(host, options, answer) {
  const h = typeof host === "string" ? $(host) : host;
  h.insertAdjacentHTML("beforeend", options.map((o, i) => `<button data-opt="${i}">${esc(o)}</button>`).join("") + `<span class="verdict"></span>`);
  const st = { pick: null, revealed: false, answer };
  h.addEventListener("click", e => { const b = e.target.closest("button[data-opt]"); if (!b || st.revealed) return; st.pick = +b.dataset.opt; $$("button[data-opt]", h).forEach(x => x.classList.toggle("pick", x === b)); });
  st.reveal = () => { st.revealed = true; const v = $(".verdict", h);
    $$("button[data-opt]", h).forEach(x => { const i = +x.dataset.opt; x.classList.toggle("right", i === st.answer); x.classList.toggle("wrong", i === st.pick && i !== st.answer); });
    if (st.pick === null) { v.textContent = "no bet placed"; v.className = "verdict"; } else if (st.pick === st.answer) { v.textContent = "you were right"; v.className = "verdict ok"; } else { v.textContent = "not this time"; v.className = "verdict no"; } };
  return st;
}
function reveal(btnId, bets, after) {
  $("#" + btnId).addEventListener("click", e => { (bets || []).forEach(b => b.reveal()); const veil = e.target.closest(".panel").querySelector(".veil"); if (veil) veil.remove();
    e.target.disabled = true; e.target.textContent = "revealed"; if (after) after(); });
}
function states(id, items, on) {
  const h = $("#" + id);
  if (items) h.innerHTML = items.map(([k, l], i) => `<button data-m="${esc(k)}"${i === 0 ? ' class="sel"' : ""}>${l}</button>`).join("");
  let mode = $("button.sel", h).dataset.m;
  h.addEventListener("click", e => { const b = e.target.closest("button[data-m]"); if (!b) return; mode = b.dataset.m; $$("button", h).forEach(x => x.classList.toggle("sel", x === b)); on(mode); });
  return () => mode;
}

/* in-browser code checked against Python */
const CHECKS = [];
function check(id, ok, text) { CHECKS.push({ id, ok, text }); return `<span class="ck"><b class="${ok ? "" : "no"}">${ok ? "✓" : "✗"}</b> ${text}</span>`; }

/* code ↔ picture: hover any [data-f] and every element sharing a token lights up (week 3) */
function linkCodeAndFormulas() {
  const all = $$("[data-f]"); const toks = n => (n.dataset.f || "").split(/\s+/).filter(Boolean);
  all.forEach(n => { if (n._linked) return; n._linked = true;
    n.addEventListener("pointerenter", () => { const mine = toks(n); $$("[data-f]").forEach(m => m.classList.toggle("hi", toks(m).some(t => mine.includes(t)))); });
    n.addEventListener("pointerleave", () => $$("[data-f]").forEach(m => m.classList.remove("hi"))); });
}
function code(host, text, f) {
  $(host).innerHTML = text.split("\n").map(l => { let tok = ""; for (const k in (f || {})) if (l.includes(k)) tok = f[k];
    const body = esc(l).replace(/^(\s*)(def|class|return|for|in|if|else|import|from|with|lambda)\b/g, '$1<span class="kw">$2</span>').replace(/(#.*)$/, '<span class="c">$1</span>');
    return `<span class="ln"${tok ? ` data-f="${tok}"` : ""}>${body}</span>`; }).join("");
  linkCodeAndFormulas();
}

const LATER = [];
const later = f => LATER.push(f);
const runLater = () => { const next = () => { const f = LATER.shift(); if (!f) { window.READY = true; return; } try { f(); performance.mark("x:" + f.name); } catch (e) { console.error(e); } setTimeout(next, 0); }; setTimeout(next, 0); };

/* ------------------------------------------------------------------ nav, theme, presentation */
const SECTIONS = [["hero", "The data", null], ["pipe", "The pipeline", "01"], ["index", "What is indexed", "02"], ["search", "The search method", "03"],
  ["query", "Before the search", "04"], ["rerank", "Reranking", "05"], ["answer", "Generation", "06"], ["eval", "How to measure", "07"], ["end", "The roadmap", "08"]];
(function buildNav() {
  const nav = $("#nav"); nav.innerHTML = SECTIONS.map(([id, t, n]) => `<a href="#${id}" data-id="${id}"><span>${n === null ? "·" : n}</span><span>${esc(t)}</span></a>`).join("");
  const links = $$("#nav a"); const io = new IntersectionObserver(ents => { ents.forEach(e => { if (e.isIntersecting) links.forEach(a => a.classList.toggle("on", a.dataset.id === e.target.id)); }); }, { rootMargin: "-15% 0px -70% 0px" });
  SECTIONS.forEach(([id]) => { const n = document.getElementById(id); if (n) io.observe(n); });
})();
const REDRAW = [];
function redrawAll() { REDRAW.forEach(f => { try { f(); } catch (_) { } }); }
$("#btn-theme").addEventListener("click", () => { const cur = document.documentElement.getAttribute("data-theme"); const dark = cur ? cur === "dark" : matchMedia("(prefers-color-scheme: dark)").matches; document.documentElement.setAttribute("data-theme", dark ? "light" : "dark"); redrawAll(); });
$("#btn-present").addEventListener("click", e => { document.body.classList.toggle("present"); e.target.classList.toggle("on", document.body.classList.contains("present")); });

/* ------------------------------------------------------------------ the data, once */
const DOCS = D.docs;                                     // {id, date, text}: the 876 documents of doc_list
const GOLDEN = D.golden, NA = D.no_answer;
const QS = GOLDEN.map(g => g.q).concat(NA);              // the 30 questions precompute ran on, golden first
const NG = GOLDEN.length, NQ = QS.length;
const GOLD = i => (i < NG ? GOLDEN[i].post : null);
const isGold = (i, j) => i < NG && DOCS[j].id === GOLDEN[i].post;
const FIRST = (() => { const m = new Map(); DOCS.forEach((d, j) => { if (!m.has(d.text)) m.set(d.text, j); }); return DOCS.map(d => m.get(d.text)); })();
const snip = (t, n) => { t = t.replace(/\s+/g, " ").trim(); return t.length > n ? t.slice(0, n) + "…" : t; };
const rankIn = (i, order) => { const r = order.slice(0, 10).findIndex(j => isGold(i, j)); return r < 0 ? null : r + 1; };
const T = D.table;
function qOptions(sel, which) {
  const opt = (i) => `<option value="${i}">${i < NG ? "G" + (i + 1) : "N" + (i - NG + 1)} · ${esc(snip(QS[i], 90))}</option>`;
  const g = GOLDEN.map((_, i) => opt(i)).join(""), n = NA.map((_, k) => opt(NG + k)).join("");
  $(sel).innerHTML = which === "golden" ? g : `<optgroup label="golden">${g}</optgroup><optgroup label="no answer in the corpus">${n}</optgroup>`;
}
function resultList(i, items, opts) {
  opts = opts || {};
  if (!items.length) return `<div class="empty">${opts.empty || "—"}</div>`;
  return items.map(([j, s], r) => `<div class="r${i != null && isGold(i, j) ? " gold" : ""}" data-doc="${j}"><span class="n">${r + 1}</span><span class="x">${opts.date ? `<span class="m">${DOCS[j].date}</span> ` : ""}${esc(snip(DOCS[j].text, 160))}</span><span class="s">${s == null ? "" : (opts.fmt || f3)(s)}</span></div>`).join("");
}
function hoverDocs(host) { $$(".r[data-doc]", host).forEach(n => tipOn(n, () => `<b>#${DOCS[+n.dataset.doc].id}</b> · ${DOCS[+n.dataset.doc].date}<br>${esc(snip(DOCS[+n.dataset.doc].text, 600))}`)); }

/* ------------------------------------------------------------------ BM25, as rank_bm25.BM25Okapi (k1 1.5, b 0.75, eps 0.25) */
const PY_WS = new RegExp("[\\t\\n\\v\\f\\r \\x1c-\\x1f\\x85\\xa0\\u1680\\u2000-\\u200a\\u2028\\u2029\\u202f\\u205f\\u3000]+");   // str.split()'s whitespace
const TOK = {
  split: t => t.split(PY_WS).filter(Boolean),
  lower: t => t.toLowerCase().match(/[\p{L}\p{N}_]+/gu) || [],
};
function BM25(docs, tok) {
  const k1 = 1.5, b = 0.75, eps = 0.25;
  const tf = docs.map(d => { const m = new Map(); tok(d).forEach(w => m.set(w, (m.get(w) || 0) + 1)); return m; });
  const len = docs.map((d, i) => { let n = 0; tf[i].forEach(v => { n += v; }); return n; });
  const N = docs.length, avgdl = len.reduce((a, c) => a + c, 0) / N;
  const df = new Map(); tf.forEach(m => m.forEach((_, w) => df.set(w, (df.get(w) || 0) + 1)));
  const idf = new Map(); let sum = 0; const neg = [];
  df.forEach((f, w) => { const v = Math.log(N - f + 0.5) - Math.log(f + 0.5); idf.set(w, v); sum += v; if (v < 0) neg.push(w); });
  const floor = eps * sum / idf.size; neg.forEach(w => idf.set(w, floor));
  return { tok, scores(q) { const s = new Float64Array(N); for (const w of tok(q)) { const v = idf.get(w) || 0; if (!v) continue;
      for (let i = 0; i < N; i++) { const f = tf[i].get(w) || 0; if (f) s[i] += v * (f * (k1 + 1) / (f + k1 * (1 - b + b * len[i] / avgdl))); } } return s; },
    top(q, k, allow) { const s = this.scores(q); const idx = []; for (let i = 0; i < N; i++) if (!allow || allow(i)) idx.push(i);
      idx.sort((a, c) => s[c] - s[a] || c - a); return idx.slice(0, k).map(i => [i, s[i]]); } };
}
let BM = null;
function bm() { if (!BM) { const texts = DOCS.map(d => d.text); BM = { split: BM25(texts, TOK.split), lower: BM25(texts, TOK.lower) }; } return BM; }
function rrf(lists, k) {      // EnsembleRetriever(weights=[0.5, 0.5]): weight / (rank + 60), deduplicated by content
  const sc = new Map(), order = [];
  lists.forEach(l => l.slice(0, k || 10).forEach((j, r) => { const u = FIRST[j]; sc.set(u, (sc.get(u) || 0) + 0.5 / (r + 1 + 60)); }));
  lists.forEach(l => l.slice(0, k || 10).forEach(j => { const u = FIRST[j]; if (!order.includes(u)) order.push(u); }));
  return order.map(u => [u, sc.get(u)]).sort((a, c) => c[1] - a[1]);
}

/* ====================================================== 00 · the data */
(function data() {
  const show = m => { $("#data-corpus").hidden = m !== "corpus"; $("#data-golden").hidden = m !== "golden"; };
  states("data-tabs", null, show);
  const render = () => { const q = $("#corpus-q").value.trim().toLowerCase();
    const hit = DOCS.map((d, j) => j).filter(j => !q || DOCS[j].text.toLowerCase().includes(q) || String(DOCS[j].id) === q || DOCS[j].date.startsWith(q));
    $("#corpus-list").innerHTML = hit.slice(0, 150).map(j => `<div class="doc"><span class="m">#${DOCS[j].id} · ${DOCS[j].date}</span>${esc(snip(DOCS[j].text, 220))}</div>`).join("") +
      (hit.length > 150 ? `<div class="doc group">${hit.length - 150} more…</div>` : "") + (hit.length ? "" : `<div class="doc group">nothing</div>`); };
  $("#corpus-q").addEventListener("input", render); render();
  const histo = () => { const h = D.word_hist, mx = Math.max(...h); const p = plot($("#corpus-hist"), { w: 420, h: 250, x: [0, h.length * 25], y: [0, mx * 1.05], xt: [0, 200, 400, 600], yt: [0, Math.round(mx / 2), mx], xl: "words per post", yl: "posts", l: 44 });
    h.forEach((c, i) => rect(p.s, p.X(i * 25) + 1, p.Y(c), p.X(25) - p.X(0) - 2, p.Y(0) - p.Y(c), { fill: css("--cls-0"), rx: 1 })); };
  histo(); REDRAW.push(histo);
  const byPost = []; GOLDEN.forEach((g, i) => { let grp = byPost.find(x => x.post === g.post); if (!grp) byPost.push(grp = { post: g.post, qs: [] }); grp.qs.push(i); });
  const docOf = id => DOCS.find(d => d.id === id);
  $("#golden-list").innerHTML = byPost.map(grp => `<div class="doc group">post #${grp.post} · ${docOf(grp.post).date} · ${esc(snip(docOf(grp.post).text, 90))}</div>` +
      grp.qs.map(i => `<div class="doc"><span class="m">G${i + 1}</span>${esc(GOLDEN[i].q)}<br><span class="g">quote:</span> <span class="small-note">${esc(snip(GOLDEN[i].quote, 220))}</span></div>`).join("")).join("") +
    `<div class="doc group">no answer in the corpus</div>` + NA.map((q, k) => `<div class="doc"><span class="m">N${k + 1}</span>${esc(q)}</div>`).join("");
  $("#data-note").innerHTML = TXT("corpus-note", { posts: D.n_posts, from: D.date_from, to: D.date_to, docs: D.n_docs }) + " " + TXT("golden-note", { n: NG, posts: byPost.length, na: NA.length });
})();

/* ====================================================== 01 · one query through the pipeline */
const LCEL = `from langchain_huggingface import HuggingFacePipeline
from langchain_core.prompts import PromptTemplate

local_llm = HuggingFacePipeline(pipeline=generation_pipeline)

rag_prompt_local = PromptTemplate.from_template(
    "Ты — ассистент, отвечающий на вопросы по контексту ниже.\\n"
    "Если в контексте нет ответа, явно скажи об этом.\\n\\n"
    "Контекст:\\n{context}\\n\\nВопрос: {question}\\n\\nОтвет:"
)

rag_chain_local = (
    {"context": qdrant_retriever | format_docs, "question": RunnablePassthrough()}
    | rag_prompt_local
    | local_llm
    | StrOutputParser()
)

print(rag_chain_local.invoke(question))`;
const ROLE = "Ты — ассистент, отвечающий на вопросы по контексту ниже.", IDK = "Если в контексте нет ответа, явно скажи об этом.";
function promptHTML(i, mode, cut) {
  const q = esc(QS[i]);
  if (mode === "closed book") return `Вопрос: ${q}\n\nОтвет:`;
  const ctx = D.answer_docs[i].map(j => { const t = DOCS[j].text; return t.length > cut ? esc(t.slice(0, cut)) + ` <i>[… ${t.length - cut} more characters]</i>` : esc(t); }).join("\n\n");
  return `${ROLE}${mode === "context + say so" ? `\n<span class="idk">${IDK}</span>` : ""}\n\nКонтекст:\n<span class="ctxpart">${ctx}</span>\n\nВопрос: ${q}\n\nОтвет:`;
}
const DECL = (mode, i) => D.declined[mode][i];        // read by hand from the answers (export_demo_data.py)
(function stepper() {
  qOptions("#step-q");
  const STEPS = [["question", "1 · the question", "s0"], ["search", "2 · encoder + search", "search"], ["prompt", "3 · top-3 → the prompt", "prompt"], ["answer", "4 · the LLM's answer", "llm"]];
  $("#step-bar").innerHTML = STEPS.map(([k, l, f], n) => `<button data-n="${n}" data-f="${f}">${l}</button>`).join("");
  let step = 0;
  const render = () => { const i = +$("#step-q").value;
    $$("#step-bar button").forEach((b, n) => { b.classList.toggle("sel", n === step); b.classList.toggle("done", n < step); });
    const order = D.dense.order[i].map(j => [j, D.dense.scores[i][j]]);
    const left = [`<div class="k-label">in</div><div class="ctx">${esc(QS[i])}</div>`,
      `<div class="k-label">in</div><div class="ctx">${esc(QS[i])}\n\n→ bge-m3 → a 1024-dimensional vector, normalised\n→ cosine against every document's vector</div>`,
      `<div class="k-label">in · the top-3 found</div><div class="rl">${resultList(i, order.slice(0, 3))}</div>`,
      `<div class="k-label">in · the prompt</div><div class="prompt-view">${promptHTML(i, "context + say so", 260)}</div>`][step];
    const ans = D.answers["context + say so"][i], dec = DECL("context + say so", i);
    const right = [`<div class="k-label">gold</div><div class="ctx">${i < NG ? `post #${GOLD(i)} — ${esc(snip(GOLDEN[i].quote, 260))}` : "none: the corpus cannot answer this one"}</div>`,
      `<div class="k-label">out · top-10 by cosine</div><div class="rl">${resultList(i, order)}</div>`,
      `<div class="k-label">out · the prompt</div><div class="prompt-view">${promptHTML(i, "context + say so", 260)}</div>`,
      `<div class="k-label">out</div><div class="answer${dec ? " refuse" : ""}">${esc(ans)}</div>`][step];
    $("#step-out").innerHTML = `<div>${left}</div><div>${right}</div>`; hoverDocs($("#step-out")); };
  $("#step-bar").addEventListener("click", e => { const b = e.target.closest("button[data-n]"); if (!b) return; step = +b.dataset.n; render(); });
  $("#step-next").addEventListener("click", () => { step = Math.min(3, step + 1); render(); });
  $("#step-prev").addEventListener("click", () => { step = Math.max(0, step - 1); render(); });
  $("#step-q").addEventListener("change", () => { step = 0; render(); });
  render();
  $("#step-note").innerHTML = TXT("stepper-note", { docs: D.n_docs });
  code("#code-lcel", LCEL, { "qdrant_retriever | format_docs": "search", "RunnablePassthrough": "s0", "| rag_prompt_local": "prompt", "rag_prompt_local = ": "prompt", '"Ты': "prompt", '"Если': "prompt", '"Контекст': "prompt", "| local_llm": "llm", "local_llm = ": "llm", "StrOutputParser": "llm" });
})();

/* ====================================================== 02 · the index */
const CODE_INDEX = `doc_list = RecursiveCharacterTextSplitter().split_documents([   # chunk_size=4000, chunk_overlap=200 by default
    Document(page_content=row["text"], metadata={"title": row["id"]})
    for _, row in df.iterrows()
])

embeddings = HuggingFaceEmbeddings(
    model_name="BAAI/bge-m3",
    model_kwargs={"device": device},
    encode_kwargs={"normalize_embeddings": True},
)

qdrant = QdrantVectorStore.from_documents(
    doc_list, embeddings, location=":memory:", collection_name="documents",
)
qdrant_retriever = qdrant.as_retriever(search_kwargs={"k": 10})`;
const CODE_PD = `child_splitter = RecursiveCharacterTextSplitter(chunk_size=120, chunk_overlap=0)

client = QdrantClient(":memory:")
client.create_collection("children", vectors_config=models.VectorParams(size=1024, distance=models.Distance.COSINE))
child_store = QdrantVectorStore(client=client, collection_name="children", embedding=embeddings)

pd_retriever = ParentDocumentRetriever(
    vectorstore=child_store,          # its own collection, not qdrant
    docstore=InMemoryStore(),         # the parents, by id
    child_splitter=child_splitter,
    search_kwargs={"k": 400},         # 120-character children: ten different posts can take a few hundred of them
)
pd_retriever.add_documents(doc_list)`;
later(function index() {
  code("#code-index", CODE_INDEX, { "as_retriever": "k" });
  const bet = makeBet("#bet-k", ["1", "4", "10", "all of them"], 1);
  reveal("btn-k", [bet], () => { $("#k-note").hidden = false; });
  qOptions("#pd-q");
  const render = () => { const i = +$("#pd-q").value; const best = D.pd.best_child[i]; const parent = best[0].parent; let t = DOCS[parent].text;
    const marks = best.map((c, n) => ({ ...c, n: n + 1 })).filter(c => c.parent === parent);
    const spans = []; marks.forEach(c => { const at = t.indexOf(c.text); if (at >= 0) spans.push([at, at + c.text.length, c.n, c.score]); });
    spans.sort((a, b) => a[0] - b[0]); let out = "", pos = 0;
    spans.forEach(([a, b, n, s]) => { if (a < pos) return; out += esc(t.slice(pos, a)) + `<mark title="child ${n} · cos ${f3(s)}">${esc(t.slice(a, b))}<sup>${n}</sup></mark>`; pos = b; });
    out += esc(t.slice(pos));
    const others = best.map((c, n) => ({ ...c, n: n + 1 })).filter(c => c.parent !== parent);
    $("#pd-parent").innerHTML = `<div class="k-label">the parent returned first · #${DOCS[parent].id} · ${DOCS[parent].date}${i < NG ? (isGold(i, parent) ? " · the gold post" : " · not the gold post") : ""}</div>${out}` +
      (others.length ? `<div class="k-label">children 1–5 that came from other parents</div>` + others.map(c => `<div class="small-note">${c.n} · #${DOCS[c.parent].id} · cos ${f3(c.score)} · «${esc(c.text)}»</div>`).join("") : "");
    const pr = i < NG ? rankIn(i, D.pd.order[i]) : null, dr = i < NG ? rankIn(i, D.dense.order[i]) : null, fmt = r => (i >= NG ? "—" : r == null ? "beyond 10" : r);
    $("#pd-note").innerHTML = TXT("pd-note", { children: D.dense.n_children.toLocaleString("en-US"), docs: D.n_docs, pd: fmt(pr), dense: fmt(dr) }) + " " +
      check("langchain-numpy", D.dense.check.qdrant_vs_numpy === NG && D.dense.check.parent_document_vs_numpy === NG, `QdrantVectorStore and ParentDocumentRetriever on the same vectors give the same gold ranks as the numpy search behind this page: ${D.dense.check.qdrant_vs_numpy}/${NG} and ${D.dense.check.parent_document_vs_numpy}/${NG}.`); };
  $("#pd-q").addEventListener("change", render); render();
  code("#code-pd", CODE_PD, {});
});

/* ====================================================== 03 · the arena */
const CODE_SEARCH = `from langchain_community.retrievers import BM25Retriever
from langchain_classic.retrievers import EnsembleRetriever

bm25_retriever = BM25Retriever.from_documents(doc_list)   # tokenises with text.split(): case and punctuation stay
bm25_retriever.k = 10

ensemble_retriever = EnsembleRetriever(
    retrievers=[bm25_retriever, qdrant_retriever],
    weights=[0.5, 0.5],  # BM25 + Qdrant
)

bm25_lower = BM25Retriever.from_documents(doc_list, preprocess_func=lambda t: re.findall(r"\\w+", t.lower()))`;
later(function arena() {
  const B = bm();
  qOptions("#ar-q");
  const render = (free) => {
    const i = free == null ? +$("#ar-q").value : null, q = free == null ? QS[i] : free;
    const cols = [["BM25", "str.split", B.split.top(q, 10)], ["BM25", "lower case", B.lower.top(q, 10)]];
    if (i != null) { const dn = D.dense.order[i].map(j => [j, D.dense.scores[i][j]]); cols.push(["Dense", "bge-m3, cos", dn]);
      cols.push(["Ensemble", "RRF, c = 60", rrf([cols[0][2].map(x => x[0]), dn.map(x => x[0])]).slice(0, 10)]); }
    else cols.push(["Dense", "bge-m3, cos", []], ["Ensemble", "RRF, c = 60", []]);
    $("#arena").innerHTML = cols.map(([h, m, items], c) => `<div><div class="colh"><span>${h}</span><span class="m">${m}</span></div><div class="rl">${resultList(i, items, { fmt: c === 3 ? (x => x.toFixed(4)) : c === 2 ? f3 : f2, empty: "needs the encoder: fixed questions only" })}</div></div>`).join("");
    hoverDocs($("#arena"));
    $("#ar-toks").textContent = `str.split → ${JSON.stringify(TOK.split(q))}   lower → ${JSON.stringify(TOK.lower(q))}`; };
  $("#ar-q").addEventListener("change", () => { $("#ar-free").value = ""; render(); });
  $("#ar-free").addEventListener("keydown", e => { if (e.key === "Enter" && e.target.value.trim()) render(e.target.value.trim()); });
  render();
  // the check: browser BM25 = rank_bm25, browser RRF = EnsembleRetriever
  const ok = name => QS.filter((q, i) => { const mine = B[name].top(q, 10).map(x => x[1]), py = D.bm25.check[name].top10_scores[i]; return mine.every((v, r) => Math.abs(v - py[r]) < 1e-4); }).length;
  const okEns = QS.filter((q, i) => { const mine = rrf([D.bm25.order.split[i], D.dense.order[i]]).slice(0, 10).map(x => x[0]); return JSON.stringify(mine) === JSON.stringify(D.ensemble.order[i]); }).length;
  const okS = ok("split"), okL = ok("lower");
  $("#arena-check").innerHTML = check("bm25-rrf", okS === NQ && okL === NQ && okEns === NQ && D.ensemble.agree === NQ, TXT("arena-check", { docs: D.n_docs, okSplit: okS, okLower: okL, okEns, n: NQ }));
  code("#code-search", CODE_SEARCH, { "text.split": "tok", "preprocess_func": "tok", "weights": "rrf" });
  const a = T["BM25"], b = T["BM25, lower case"], dm = b.mrr - a.mrr;
  const bet = makeBet("#bet-tok", ["yes, by more than one question", "no, within one question"], Math.abs(dm) > 0.05 ? 0 : 1);
  reveal("btn-tok", [bet], () => { $("#tok-note").hidden = false; $("#tok-note").innerHTML = TXT("tok-note", { a: f3(a.mrr), b: f3(b.mrr), c: f2(a.hit["1"]), d: f2(b.hit["1"]), delta: (dm / 0.05).toFixed(1) }); });
  $("#btn-rrf").addEventListener("click", e => { $("#rrf-answer").hidden = false; e.target.remove(); });
});

/* ====================================================== 04 · query expansion, HyDE, SelfQuery */
function twoCols(host, i, left, right, lh, rh) {
  $(host).innerHTML = `<div><div class="colh"><span>${lh[0]}</span><span class="m">${lh[1]}</span></div><div class="rl">${resultList(i, left.slice(0, 5))}</div></div>` +
    `<div><div class="colh"><span>${rh[0]}</span><span class="m">${rh[1]}</span></div><div class="rl">${resultList(i, right.slice(0, 5))}</div></div>`;
  hoverDocs($(host));
}
const fmtRank = r => (r == null ? "beyond 10" : r);
later(function qe() {
  qOptions("#qe-q", "golden");
  const render = () => { const i = +$("#qe-q").value;
    $("#qe-text").innerHTML = `<b>rephrased:</b> ${esc(D.qe[i])}`;
    twoCols("#qe-cols", i, D.dense.order[i].map(j => [j, D.dense.scores[i][j]]), D.qe_top[i], ["the question", "cos(q, d)"], ["the rephrasing", "cos(q′, d)"]);
    $("#qe-note").innerHTML = TXT("qe-note", { a: fmtRank(T["Qdrant"].ranks[i]), b: fmtRank(T["QE + Qdrant"].ranks[i]), m0: f3(T["Qdrant"].mrr), m1: f3(T["QE + Qdrant"].mrr) }); };
  $("#qe-q").addEventListener("change", render); render();
});
/* rephrasing: what the user wrote, a rephrasing, and the gold post's rank under BM25 for both (g = golden question whose post answers it) */
const PARA = [
  { q: "как устроенны свзи и обучени в архетектуре кан?", r: "Как устроены связи и обучение в архитектуре KAN?", g: 5 },
  { q: "што нового в мамбе 2 по сравнению с первой", r: "Что нового в Mamba-2 по сравнению с первой версией Mamba?", g: 6 },
  { q: "чем матквант отличаеться от обычной квантизаций", r: "Чем метод MatQuant отличается от обычной квантизации?", g: 17 },
  { q: "pathfinder как отбирает кандидатов", r: "Как найти путь в лабиринте и отобрать кандидатов на собеседование?", g: 13, broken: "PathFinder is a method from the post, not a path in a maze" },
  { q: "кан vs млп чем отличаются", r: "Чем сети KAN отличаются от многослойного перцептрона (MLP)?", g: 3 },
  { q: "гре инструкция по печи?", r: "Как испечь пирог в духовке?", broken: "meant «где инструкция к печи?» — a manual for a stove" },
  { q: "видюхи для локального инференса норм?", r: "Подходят ли игровые видеокарты для локального инференса больших моделей?", g: 15 },
  { q: "когда ованц?", r: "Когда появится ованц?", broken: "«ованц» is «аванс» written as it sounds" },
];
later(function paraphrase() {
  const B = bm().lower, pick = new Set(); let shown = false;
  const rk = (q, g) => fmtRank(rankIn(g, B.top(q, 10).map(x => x[0])));
  const render = () => { $("#para-rows").innerHTML = PARA.map((c, k) => `<div class="pr${pick.has(k) ? " pick" : ""}${shown ? (c.broken ? " broken" : " fine") : ""}" data-k="${k}">
      <div class="u">${esc(c.q)}</div><div class="arr">→</div><div class="r">${esc(c.r)}</div>
      <div class="rk">${shown ? (c.g == null ? "not about this corpus" : `gold post: ${rk(c.q, c.g)} → <b>${rk(c.r, c.g)}</b>`) : ""}</div>
      ${shown && c.broken ? `<div class="why">${esc(c.broken)}</div>` : ""}</div>`).join(""); };
  $("#para-rows").addEventListener("click", e => { const row = e.target.closest(".pr"); if (!row || shown) return; const k = +row.dataset.k; pick.has(k) ? pick.delete(k) : pick.add(k); render(); });
  render();
  $("#btn-para").addEventListener("click", e => { shown = true; render(); e.target.disabled = true; e.target.textContent = "revealed";
    const right = PARA.filter((c, k) => !!c.broken === pick.has(k)).length;
    $("#para-note").hidden = false; $("#para-note").innerHTML = TXT("para-note", { right, n: PARA.length, broken: PARA.filter(c => c.broken).length }); });
});
later(function hyde() {
  qOptions("#hyde-q", "golden");
  const m0 = T["Qdrant"].mrr, m1 = T["HyDE + Qdrant"].mrr, d = m1 - m0;
  const bet = makeBet("#bet-hyde", ["HyDE is better", "about the same, within one question", "HyDE is worse"], d > 0.05 ? 0 : d < -0.05 ? 2 : 1);
  const render = () => { const i = +$("#hyde-q").value;
    $("#hyde-text").innerHTML = `<b>hypothetical answer:</b> ${esc(D.hyde[i])}`;
    twoCols("#hyde-cols", i, D.dense.order[i].map(j => [j, D.dense.scores[i][j]]), D.hyde_top[i], ["plain RAG: the question", "cos(q, d)"], ["HyDE: the hypothetical answer", "cos(h, d)"]); };
  $("#hyde-q").addEventListener("change", render); render();
  const rr = (r) => (r == null ? 99 : r);
  const up = T["Qdrant"].ranks.filter((r, i) => rr(T["HyDE + Qdrant"].ranks[i]) < rr(r)).length, down = T["Qdrant"].ranks.filter((r, i) => rr(T["HyDE + Qdrant"].ranks[i]) > rr(r)).length;
  reveal("btn-hyde", [bet], () => { $("#hyde-note").hidden = false; $("#hyde-note").innerHTML = TXT("hyde-note", { m0: f3(m0), m1: f3(m1), up, down }); });
});
later(function selfQuery() {
  const B = bm().lower;
  const PRESETS = ["посты про Mamba за 2024", "что писали про LoRA до 2024", "agents после 2024", "KAN в 2024", "Mamba"];
  $("#sq-presets").innerHTML = PRESETS.map(p => `<button>${esc(p)}</button>`).join("");
  // the constructor: rules for a year or a range, the rest of the query is what gets searched
  const RULES = [
    [/(?:^|\s)(?:за|в|in)\s+(20\d\d)(?:\s*(?:году|г\.?))?/i, y => [["gte", `${y}-01-01`], ["lt", `${+y + 1}-01-01`]]],
    [/(?:^|\s)(?:после|after)\s+(20\d\d)(?:\s*(?:года|г\.?))?/i, y => [["gte", `${+y + 1}-01-01`]]],
    [/(?:^|\s)(?:с|since|from)\s+(20\d\d)(?:\s*(?:года|г\.?))?/i, y => [["gte", `${y}-01-01`]]],
    [/(?:^|\s)(?:до|before)\s+(20\d\d)(?:\s*(?:года|г\.?))?/i, y => [["lt", `${y}-01-01`]]],
  ];
  const parse = q => { let rest = q, conds = [];
    RULES.forEach(([re, f]) => { const m = rest.match(re); if (m) { conds = conds.concat(f(m[1])); rest = rest.replace(m[0], " "); } });
    return { query: rest.replace(/\s+/g, " ").trim(), filter: conds.map(([op, v]) => ({ op, field: "date", value: v })) }; };
  const render = () => { const q = $("#sq-q").value, p = parse(q);
    $("#sq-json").textContent = JSON.stringify(p, null, 1);
    const range = {}; p.filter.forEach(c => { range[c.op] = c.value; });
    $("#sq-filter").textContent = p.filter.length ? JSON.stringify({ must: [{ key: "metadata.date", range }] }, null, 1) : "no filter: nothing in the query is about a date";
    const allow = j => p.filter.every(c => (c.op === "gte" ? DOCS[j].date >= c.value : DOCS[j].date < c.value));
    const a = B.top(q, 6), b = p.filter.length ? B.top(p.query || q, 6, allow) : [];
    $("#sq-cols").innerHTML = `<div><div class="colh"><span>No filter</span><span class="m">BM25 over the whole query</span></div><div class="rl">${resultList(null, a, { date: 1, fmt: f2 })}</div></div>` +
      `<div><div class="colh"><span>With the filter</span><span class="m">metadata → BM25 over the rest</span></div><div class="rl">${resultList(null, b, { date: 1, fmt: f2, empty: "no filter extracted" })}</div></div>`;
    hoverDocs($("#sq-cols")); };
  const withDate = GOLDEN.filter(g => parse(g.q).filter.length).length;
  $("#sq-gonzo-note").innerHTML = TXT("sq-gonzo-note", { n: withDate, total: NG });
  $("#sq-q").addEventListener("input", render);
  $("#sq-presets").addEventListener("click", e => { const b = e.target.closest("button"); if (!b) return; $("#sq-q").value = b.textContent; render(); });
  render();
});

/* SelfQuery over songs: the 2025 RAG page's synthetic collection, its tokenizer (stop words, a crude stemmer), BM25 and parser */
const SONGS = D.synthetic.songs;
const RU_STOP = new Set("и в во не что он на я с со как а то все она так его но да ты к у же вы за бы по только ее мне было вот от меня еще нет о из ему теперь когда даже ну вдруг ли если уже или ни быть был него до вас нибудь опять уж вам ведь там потом себя ничего ей может они тут где есть надо ней для мы тебя их чем была сам чтоб без будто чего раз тоже себе под будет ж тогда кто этот того потому этого какой совсем ним здесь этом один почти мой тем чтобы нее сейчас были куда зачем всех никогда можно при наконец два об другой хоть после над больше тот через эти нас про всего них какая много разве три эту моя впрочем хорошо свою этой перед иногда лучше чуть том нельзя такой им более всегда конечно всю между это ваш ваша ваше ваши вашей вашем вашу мои моё моего моей ли".split(" "));
const RU_END = ["иями","ями","ами","ией","иях","ях","ах","ием","ем","ам","ом","ому","ему","ого","его","ой","ей","ый","ий","ая","яя","ое","ее","ые","ие","ую","юю","ов","ев","ам","ям","ах","ях","ии","ия","ие","ью","ья","ье","ешь","ете","ем","ет","ут","ют","ат","ят","ешь","ишь","ите","им","ит","ешь","ать","ять","ить","еть","ыть","уть","ся","сь","ла","ло","ли","ть","л","а","я","ы","и","о","е","у","ю","й","ь"];
const ruStem = w => { if (w.length <= 3) return w; for (const e of RU_END) if (w.endsWith(e) && w.length - e.length >= 3) return w.slice(0, -e.length); return w; };
const ruWords = t => t.toLowerCase().replace(/ё/g, "е").match(/[а-яa-z0-9]+/g) || [];
const ruTok = t => ruWords(t).filter(w => !RU_STOP.has(w) && (w.length > 1 || /^\d+$/.test(w))).map(ruStem);
const SONG_BM = (() => { const texts = SONGS.map(d => `${d.title}. ${d.artist}. ${d.genre}. ${d.text}`), docs = texts.map(ruTok), N = docs.length, k1 = 1.5, b = 0.75;
  const tf = docs.map(d => { const m = new Map(); d.forEach(w => m.set(w, (m.get(w) || 0) + 1)); return m; }), df = new Map();
  tf.forEach(m => m.forEach((_, w) => df.set(w, (df.get(w) || 0) + 1)));
  const avg = docs.reduce((a, d) => a + d.length, 0) / N, idf = w => { const n = df.get(w) || 0; return Math.log((N - n + 0.5) / (n + 0.5) + 1); };
  return q => { const qt = ruTok(q); return docs.map((d, i) => qt.reduce((s, w) => { const f = tf[i].get(w) || 0; return f ? s + idf(w) * f * (k1 + 1) / (f + k1 * (1 - b + b * d.length / avg)) : s; }, 0)); }; })();
later(function selfQuerySongs() {
  const GENRES = [...new Set(SONGS.map(d => d.genre))], ARTISTS = [...new Set(SONGS.map(d => d.artist))];
  const PRESETS = ["найди рок, выпущенный до 90-х", "джаз после 2000 про природу", "песни Лены Ковач про море", "электроника 2010-х", "что-нибудь про дорогу"];
  $("#sqs-presets").innerHTML = PRESETS.map(p => `<button>${esc(p)}</button>`).join("");
  $("#sqs-hint").innerHTML = TXT("sq-songs-hint", { n: SONGS.length });
  const parse = text => { let rest = " " + text.toLowerCase().replace(/ё/g, "е") + " "; const f = []; let m;
    for (const g of GENRES) { const re = new RegExp(`(^|\\s)(${g.replace("-", "[- ]?")}[а-я]*)(?=[\\s,.!?])`, "i"); const mm = rest.match(re); if (mm) { f.push(["genre", "eq", g]); rest = rest.replace(mm[2], " "); } }
    for (const a of ARTISTS) { for (const p of ruWords(a).filter(w => w.length > 3)) { const re = new RegExp(`(^|\\s)(${p.slice(0, 4)}[а-яa-z]*)(?=[\\s,.!?])`, "i"); const mm = rest.match(re); if (mm) { f.push(["artist", "eq", a]); rest = rest.replace(mm[2], " "); break; } } }
    const yr = y => (+y < 100 ? +y + 1900 : +y);
    if ((m = rest.match(/\s(до|раньше)\s+(\d{2,4})(?:-?х|-?го)?(?:\s+год[а-я]*)?/))) { f.push(["year", "lt", yr(m[2])]); rest = rest.replace(m[0], " "); }
    if ((m = rest.match(/\s(после|позже|новее)\s+(\d{2,4})(?:-?х|-?го)?(?:\s+год[а-я]*)?/))) { f.push(["year", "gt", yr(m[2])]); rest = rest.replace(m[0], " "); }
    if ((m = rest.match(/\s(\d{2,4})-?х\s/))) { const y = yr(m[1]); f.push(["year", "gte", y], ["year", "lt", y + 10]); rest = rest.replace(m[0], " "); }
    if ((m = rest.match(/\s(в\s+)?(\d{4})(\s+год[а-я]*)?\s/))) { f.push(["year", "eq", +m[2]]); rest = rest.replace(m[0], " "); }
    rest = rest.replace(/\s(найди|найти|покажи|подбери|песни|песню|песня|трек|треки|музыку|музыка|что-нибудь|про|о|об|выпущенн[а-я]*|вышедш[а-я]*|композици[а-я]*)\s/g, " ").replace(/\s+/g, " ").trim();
    return { filters: f, rest }; };
  const OPS = { eq: "=", lt: "<", gt: ">", gte: "≥" };
  const passes = (d, f) => { const v = d[f[0]]; return { eq: v === f[2], lt: v < f[2], gt: v > f[2], gte: v >= f[2] }[f[1]]; };
  const list = (sc, keep) => { const o = sc.map((s, i) => [i, s]).filter(([i]) => keep(i)).sort((a, b) => b[1] - a[1]).slice(0, 5);
    return o.length ? o.map(([i, s], r) => `<div class="r"><span class="n">${r + 1}</span><span class="x"><b>${esc(SONGS[i].title)}</b> — ${esc(SONGS[i].artist)} · <span class="mono">${esc(SONGS[i].genre)} · ${SONGS[i].year}</span><br>${esc(SONGS[i].text)}</span><span class="s">${f2(s)}</span></div>`).join("") : `<div class="empty">the filter left nothing</div>`; };
  const render = () => { const q = $("#sqs-q").value, { filters, rest } = parse(q);
    $("#sqs-json").textContent = JSON.stringify({ query: rest, filter: filters.map(([k, op, v]) => ({ field: k, op, value: v })) }, null, 1);
    $("#sqs-filter").textContent = filters.length ? JSON.stringify({ must: filters.map(([k, op, v]) => op === "eq" ? { key: k, match: { value: v } } : { key: k, range: { [op]: v } }) }, null, 1) : "no filter: nothing in the query is about a field";
    const keep = i => filters.every(f => passes(SONGS[i], f)), n = SONGS.filter((d, i) => keep(i)).length;
    $("#sqs-cols").innerHTML = `<div><div class="colh"><span>No filter</span><span class="m">BM25 over the whole query</span></div><div class="rl">${list(SONG_BM(q), () => true)}</div></div>` +
      `<div><div class="colh"><span>With the filter</span><span class="m">${filters.length ? `${n} of ${SONGS.length} pass · BM25 over «${esc(rest || "—")}»` : "no filter extracted"}</span></div><div class="rl">${filters.length ? list(SONG_BM(rest || ""), keep) : ""}</div></div>`;
    $("#sqs-note").textContent = filters.length ? `Filters: ${filters.map(([k, op, v]) => `${k} ${OPS[op]} ${v}`).join(" AND ")}. Without them BM25 treats «${filters.map(f => f[2]).join("», «")}» as ordinary words of the text.` : ""; };
  $("#sqs-q").addEventListener("input", render);
  $("#sqs-presets").addEventListener("click", e => { const b = e.target.closest("button"); if (!b) return; $("#sqs-q").value = b.textContent; render(); });
  render();
});

/* FLARE, scripted (the 2025 RAG page): drafts with token probabilities, the shop documents they retrieve, the rewrites */
const FLARE_S = [
    {tent:[['Если',.92],['курьер',.95],['не',.9],['уложился',.71],['в',.97],['интервал,',.88],['вам',.93],['полагается',.8],['компенсация',.77],['200',.22],['баллов',.85],['и',.9],['скидка',.35],['на',.9],['следующий',.62],['заказ.',.8]],
     doc:'R32', final:[['Если',.94],['курьер',.96],['не',.93],['уложился',.9],['в',.97],['выбранный',.88],['интервал,',.91],['вам',.93],['начислят',.9],['компенсацию',.92],['100',.96],['баллов,',.95],['а',.9],['следующая',.9],['доставка',.94],['будет',.93],['бесплатной.',.95]], wrong:'«200 баллов» and «скидка» are made up; the document says 100 points and a free next delivery.'},
    {tent:[['За',.9],['разбитый',.86],['товар',.92],['нужно',.84],['написать',.8],['в',.95],['поддержку',.9],['в',.9],['течение',.88],['3',.28],['дней,',.7],['и',.9],['его',.86],['стоимость',.9],['вернут',.83],['только',.31],['на',.9],['карту.',.55]],
     doc:'R33', final:[['За',.93],['повреждённый',.9],['товар',.94],['сообщите',.9],['в',.96],['чат',.92],['поддержки',.95],['в',.95],['течение',.94],['24',.95],['часов',.96],['и',.9],['приложите',.9],['фото:',.9],['стоимость',.92],['вернут',.9],['баллами',.91],['или',.9],['на',.9],['карту,',.9],['по',.9],['вашему',.9],['выбору.',.92]], wrong:'«3 дней» and «только на карту» are made up; the document says 24 hours and a choice: points or the card.'},
    {tent:[['Деньги',.9],['вернутся',.85],['тем',.8],['же',.9],['способом,',.78],['которым',.9],['вы',.9],['платили:',.75],['на',.9],['карту',.85],['—',.9],['в',.9],['течение',.9],['3–10',.58],['рабочих',.9],['дней,',.9],['баллы',.8],['—',.9],['в',.9],['течение',.85],['суток.',.6]],
     doc:'R26', final:[['Деньги',.93],['вернутся',.92],['тем',.9],['же',.9],['способом,',.9],['которым',.9],['была',.9],['оплата:',.9],['на',.9],['карту',.92],['—',.9],['в',.9],['течение',.9],['3–10',.95],['рабочих',.95],['дней,',.95],['баллы',.9],['—',.9],['в',.9],['течение',.9],['суток.',.94]], wrong:null},
  ];
later(function flare() {
  const RET = Object.fromEntries(D.synthetic.retail.map(d => [d.id, d]));
  let run = 0;
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const tok = (t, p, th, cls) => `<span class="tk ${cls} ${p < th ? "low" : "ok"}"><small>${p.toFixed(2)}</small>${esc(t)}</span>`;
  const reset = () => { run++; $("#fl-gen").innerHTML = `<span class="small-note">press Generate</span>`; $("#fl-log").innerHTML = ""; $("#fl-stats").innerHTML = ""; };
  $("#fl-t").addEventListener("input", e => { $("#fl-tv").textContent = (+e.target.value).toFixed(2); });
  $("#fl-reset").addEventListener("click", reset);
  $("#fl-run").addEventListener("click", async () => { reset(); const me = run, th = +$("#fl-t").value, gen = $("#fl-gen"), log = $("#fl-log");
    let html = "", searches = 0, wrongKept = 0;
    const add = (cls, k, body) => { log.insertAdjacentHTML("beforeend", `<div class="e ${cls}"><div class="k">${k}</div>${body}</div>`); log.scrollTop = log.scrollHeight; };
    for (const [si, s] of FLARE_S.entries()) { let cur = "";
      for (const [t, p] of s.tent) { if (me !== run) return; cur += tok(t, p, th, "tent") + " "; gen.innerHTML = html + cur + `<span class="cursor"></span>`; await sleep(70); }
      const low = s.tent.filter(([, p]) => p < th);
      if (low.length) { searches++;
        add("w", `sentence ${si + 1}: ${low.length} token(s) below θ = ${th.toFixed(2)}`, `doubtful: ${low.map(([t]) => `<code>${esc(t)}</code>`).join(" ")}`); await sleep(500); if (me !== run) return;
        add("s", "the search query = the sentence with a mask", `«${esc(s.tent.map(([t, p]) => p < th ? "[?]" : t).join(" "))}»`); await sleep(600); if (me !== run) return;
        const d = RET[s.doc]; add("r", `retriever → ${d.id}`, `<b>${esc(d.title)}.</b> ${esc(d.text)}`); await sleep(500); if (me !== run) return;
        cur = ""; for (const [t, p] of s.final) { if (me !== run) return; cur += tok(t, p, th, "fin") + " "; gen.innerHTML = html + cur + `<span class="cursor"></span>`; await sleep(55); }
        add("r", "regenerated with the context", "The sentence is rewritten; the probabilities went up.");
      } else { add("", `sentence ${si + 1}: every token ≥ θ`, s.wrong ? `Kept as it is. <span class="bad">${esc(s.wrong)}</span>` : "Kept as it is — and this time the model is right (but without a search there is nothing to check it with).");
        if (s.wrong) wrongKept++; }
      html += cur + "<br>"; gen.innerHTML = html + `<span class="cursor"></span>`; await sleep(300); }
    gen.innerHTML = html;
    $("#fl-stats").innerHTML = stat(`${searches} / ${FLARE_S.length}`, "retriever calls") + stat(searches, "regenerations") + stat(wrongKept, "made-up facts left"); });
  reset();
});

/* ====================================================== 05 · reranking */
const CODE_RERANK = `cross_encoder = HuggingFaceCrossEncoder(model_name="BAAI/bge-reranker-v2-m3", model_kwargs={"device": device})

bm25_pool = BM25Retriever.from_documents(doc_list)
bm25_pool.k = 50
pool_retriever = EnsembleRetriever(
    retrievers=[bm25_pool, qdrant.as_retriever(search_kwargs={"k": 50})], weights=[0.5, 0.5])

def reranking_retriever_fn(question, k_candidates=20):
    """Ensemble -> cross-encoder reranking -> top-10."""
    candidates = pool_retriever.invoke(question)[:k_candidates]
    pairs = [(question, doc.page_content) for doc in candidates]
    scores = cross_encoder.score(pairs)
    ranked = sorted(zip(scores, candidates), key=lambda x: x[0], reverse=True)
    return [doc for _, doc in ranked[:10]]`;
later(function rerank() {
  const R = D.rerank;
  const ranksAt = k => GOLDEN.map((g, i) => { const c = R.pool[i].slice(0, k).map((j, n) => [j, R.scores[i][n]]); c.sort((a, b) => b[1] - a[1]); return rankIn(i, c.map(x => x[0])); });
  const mrr = rk => rk.reduce((a, r) => a + (r ? 1 / r : 0), 0) / rk.length, hit1 = rk => rk.filter(r => r === 1).length / rk.length;
  const base = mrr(GOLDEN.map((g, i) => rankIn(i, R.pool[i])));
  const recall = k => GOLDEN.filter((g, i) => R.pool[i].slice(0, k).some(j => isGold(i, j))).length / NG;
  const curve = []; for (let k = 1; k <= 50; k++) curve.push([k, mrr(ranksAt(k))]);
  const best = Math.max(...curve.map(c => c[1])), at50 = curve[49][1], kBest = curve.find(c => c[1] === best)[0];
  const ans = at50 < best - 0.05 ? 2 : kBest <= 25 ? 1 : 0;
  const bet = makeBet("#bet-rerank", ["yes, all the way to 50", "it flattens out early", "it gets worse past some k"], ans);
  const poolRank = i => { const j = R.pool[i].findIndex(d => isGold(i, d)); return j < 0 ? null : j + 1; };
  const step = f => { const o = []; for (let k = 1; k <= 50; k++) { o.push([k, f(k)]); if (k < 50) o.push([k + 1, f(k)]); } return o; };
  const mrrAt = k => curve[k - 1][1];
  const draw = () => { const k = +$("#rr-k").value; $("#rr-kv").textContent = k;
    const p = plot($("#rr-plot"), { w: 760, h: 270, x: [1, 50], y: [0.7, 1], xt: [1, 10, 20, 30, 40, 50], yt: [0.7, 0.8, 0.9, 1], yf: v => v.toFixed(1), xl: "k_candidates — how many of the pool the cross-encoder reads", l: 44, r: 210, t: 26,
      series: [{ pts: [[1, base], [50, base]], color: css("--ink-3"), dash: 1, sw: 1.6 }, { pts: step(recall), color: css("--cls-2"), sw: 3 }, { pts: step(mrrAt), color: css("--cls-0") }] });
    line(p.s, p.X(k), p.T - 6, p.X(k), p.H - p.B, { color: css("--cls-1"), sw: 1.4 });
    [[recall(k), "--cls-2"], [mrrAt(k), "--cls-0"]].forEach(([v, c]) => p.s.appendChild(el("circle", { cx: p.X(k), cy: p.Y(v), r: 4.5, fill: css(c) })));
    txt(p.s, p.X(k) + (k > 40 ? -6 : 6), p.T - 10, `k = ${k}: MRR ${f3(mrrAt(k))} · gold in the pool ${f2(recall(k))}`, { anchor: k > 40 ? "end" : "start", fs: 12, color: css("--cls-1") });
    const lx = p.W - p.R + 10;
    txt(p.s, lx, p.Y(recall(50)) + 4, "gold in the pool (Hit@k)", { anchor: "start", fs: 12, color: css("--cls-2") });
    txt(p.s, lx, p.Y(mrrAt(50)) + 4, "MRR, reranked", { anchor: "start", fs: 12, color: css("--cls-0") });
    txt(p.s, lx, p.Y(base) + 4, "MRR, the ensemble alone", { anchor: "start", fs: 12, color: css("--ink-3") });
    const rk = ranksAt(k);
    $("#rr-rows").innerHTML = GOLDEN.map((g, i) => { const a = poolRank(i), b = rk[i], cls = !b ? "lost" : a == null || b < a ? "up" : b > a ? "down" : "";
      return `<div class="${cls}"><span class="g">G${i + 1}</span>${a == null ? "—" : a} → <b>${b == null ? "—" : b}</b></div>`; }).join("");
    const sec = (R.seconds_per_pair * k).toFixed(2);
    $("#rerank-note").innerHTML = TXT("rerank-note", { k, mrr: f3(mrr(rk)), h1: f2(hit1(rk)), sec, device: D.devices.rerank, base: f3(base), recall: f2(recall(k)) }) + " " +
      check("rerank20", JSON.stringify(ranksAt(20)) === JSON.stringify(T["Ensemble + Reranking"].ranks), "at k = 20 the ranks equal the notebook's reranking_retriever_fn."); };
  $("#rr-k").addEventListener("input", draw); draw(); REDRAW.push(draw);
  reveal("btn-rerank", [bet]);
  code("#code-rerank", CODE_RERANK, { "k_candidates": "k" });
});

/* ====================================================== 06 · the prompt, the threshold, CRAG */
later(function sandbox() {
  qOptions("#ps-q");
  let mode = "closed book";
  const render = () => { const i = +$("#ps-q").value, a = D.answers[mode][i], dec = DECL(mode, i);
    $("#ps-prompt").innerHTML = promptHTML(i, mode, 300);
    $("#ps-answer").className = "answer" + (dec ? " refuse" : "");
    $("#ps-answer").innerHTML = esc(a) + `<span class="tag">${dec ? "declined" : "answered"}${i < NG ? " · golden" : " · no answer in the corpus"}</span>`; };
  states("ps-mode", null, m => { mode = m; render(); });
  $("#ps-q").addEventListener("change", render); render();
  const ref = (m, from, to) => D.declined[m].slice(from, to).filter(Boolean).length;
  const ctx = ref("context", NG, NQ), idk = ref("context + say so", NG, NQ), closed = ref("closed book", NG, NQ), gold = ref("context + say so", 0, NG);
  const ans = idk >= 0.6 * NA.length ? 2 : idk > ctx ? 1 : 0;
  const bet = makeBet("#bet-idk", ["it answers all of them either way", "a few more refusals with the line, most still answered", "with the line, it declines most of them"], ans);
  reveal("btn-idk", [bet], () => { $("#idk-note").hidden = false; $("#idk-note").innerHTML = TXT("idk-note", { ctx, idk, closed, na: NA.length, gold, n: NG }); });
});
later(function threshold() {
  const top1 = QS.map((q, i) => Math.max(...D.dense.scores[i]));
  const g = top1.slice(0, NG), n = top1.slice(NG), gmin = Math.min(...g), nmax = Math.max(...n);
  const lo = Math.floor((Math.min(...top1) - .03) * 100) / 100, hi = Math.ceil((Math.max(...top1) + .03) * 100) / 100;
  const sl = $("#th"); sl.min = lo; sl.max = hi; sl.value = ((gmin + nmax) / 2).toFixed(3);
  const bet = makeBet("#bet-th", ["yes, there is one", "no, every threshold breaks one of the groups"], gmin > nmax ? 0 : 1);
  const draw = () => { const t = +sl.value; $("#th-v").textContent = t.toFixed(3);
    const p = plot($("#th-plot"), { w: 760, h: 170, x: [lo, hi], y: [0, 3], xt: [lo, (lo + hi) / 2, hi].map(v => +v.toFixed(2)), yt: [], xl: "the best cosine over the documents", l: 150, b: 40 });
    [[g, 2, "--cls-0", "golden"], [n, 1, "--cls-1", "no answer"]].forEach(([vals, row, c, lab]) => { txt(p.s, p.L - 10, p.Y(row) + 4, lab, { anchor: "end", fs: 12.5, color: css(c) });
      vals.forEach((v, k) => { const i = row === 2 ? k : NG + k; const dot = p.s.appendChild(el("circle", { cx: p.X(v), cy: p.Y(row) + ((k % 3) - 1) * 7, r: 5.5, fill: (row === 2 ? v >= t : v < t) ? css(c) : "none", stroke: css(c), "stroke-width": 1.6 }));
        tipOn(dot, `${esc(QS[i])}<br><span class="mono">cos ${f3(v)}</span>`); }); });
    line(p.s, p.X(t), p.T, p.X(t), p.H - p.B, { color: css("--ink"), sw: 1.6 });
    $("#th-stats").innerHTML = stat(`${g.filter(v => v >= t).length}/${NG}`, "golden kept") + stat(`${n.filter(v => v < t).length}/${NA.length}`, "no-answer stopped"); };
  sl.addEventListener("input", draw); draw(); REDRAW.push(draw);
  reveal("btn-th", [bet], () => { $("#th-note").hidden = false; $("#th-note").innerHTML = TXT("th-note", { gmin: f3(gmin), nmax: f3(nmax), verdict: TXT(gmin > nmax ? "th-yes" : "th-no", { gap: f3(gmin - nmax) }) }); });
});
later(function crag() {
  const y = D.crag.yes, gy = y.slice(0, NG).filter(Boolean).length, ny = y.slice(NG).filter(Boolean).length;
  const bucket = ny === 0 ? 0 : ny <= 3 ? 1 : ny <= 7 ? 2 : 3;
  const bet = makeBet("#bet-crag", ["none", "1–3", "4–7", "8–10"], bucket);
  $("#crag-grid").innerHTML = `<div class="two eq">` + [[0, NG, "golden: «yes» is right"], [NG, NQ, "no answer in the corpus: «no» is right"]].map(([a, b, lab]) =>
    `<div><div class="k-label">${lab}</div>` + QS.slice(a, b).map((q, k) => { const i = a + k, ok = i < NG ? y[i] : !y[i];
      return `<div class="small-note"><b class="${ok ? "" : "no"}" style="color:var(${ok ? "--good" : "--bad"})">${y[i] ? "yes" : "no"}</b> · ${esc(snip(q, 70))}</div>`; }).join("") + `</div>`).join("") + `</div>`;
  reveal("btn-crag", [bet], () => { $("#crag-note").hidden = false; $("#crag-note").innerHTML = TXT("crag-note", { gy, n: NG, ny, na: NA.length, hit: f2(T["CRAG"].hit["10"]) }); });
});

/* ====================================================== 07 · what counts as a hit */
/* a threshold in general: synthetic best-cosine scores of four kinds of questions (seeded) */
later(function thresholdGeneral() {
  const rnd = mulberry32(7), gauss = () => { const u = 1 - rnd(), v = rnd(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); };
  const G = [{ k: "ans", l: "answerable, well-formed", n: 60, mu: .64, sd: .05, ok: 1, fixed: 1 }, { k: "noisy", l: "answerable, typos or keywords", n: 40, mu: .52, sd: .06, ok: 1 },
    { k: "off", l: "no answer, off-topic", n: 40, mu: .38, sd: .05, ok: 0, fixed: 1 }, { k: "near", l: "no answer, on the topic", n: 40, mu: .56, sd: .05, ok: 0 }];
  G.forEach(g => { g.s = Array.from({ length: g.n }, () => Math.max(0.05, Math.min(0.95, g.mu + g.sd * gauss()))); g.on = !!g.fixed; });
  let other = false;
  const sc = v => other ? 0.3 + 0.55 * v : v;   // "another encoder": the same order of questions on a compressed scale
  const rates = (t, gs) => { const a = gs.filter(g => g.ok).flatMap(g => g.s.map(sc)), n = gs.filter(g => !g.ok).flatMap(g => g.s.map(sc));
    return { ref: a.filter(v => v < t).length / a.length, pass: n.filter(v => v >= t).length / n.length }; };
  const bestT = gs => { let b = [1, 0]; for (let t = 0.2; t <= 0.9; t += 0.005) { const r = rates(t, gs), m = Math.max(r.ref, r.pass); if (m < b[0]) b = [m, t]; } return b; };
  $("#thg-groups").innerHTML = G.filter(g => !g.fixed).map(g => `<button data-k="${g.k}">+ ${esc(g.l)}</button>`).join("") + `<button data-enc>another encoder</button>`;
  const draw = () => { const t = +$("#thg-t").value; $("#thg-v").textContent = t.toFixed(3); const on = G.filter(g => g.on);
    const p = plot($("#thg-plot"), { w: 760, h: 60 + 42 * on.length, x: [0.2, 0.9], y: [0, on.length], xt: [0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9], yt: [], xl: "the best cosine of the question", l: 250, r: 16, t: 10, b: 40 });
    rect(p.s, p.X(0.2), p.T, p.X(t) - p.X(0.2), p.H - p.B - p.T, { fill: TINT("--ink-3", 10) });
    on.forEach((g, r) => { const y = p.Y(on.length - r - 0.5);
      txt(p.s, p.L - 10, y + 4, g.l, { anchor: "end", fs: 12, color: css(g.ok ? "--good" : "--bad") });
      g.s.forEach((v, i) => p.s.appendChild(el("circle", { cx: p.X(sc(v)), cy: y + ((i * 7) % 15) - 7, r: 3.2, fill: css(g.ok ? "--good" : "--bad"), opacity: 0.7 }))); });
    line(p.s, p.X(t), p.T, p.X(t), p.H - p.B, { color: css("--ink"), sw: 1.6 });
    const r = rates(t, on);
    $("#thg-stats").innerHTML = stat(pct(r.ref), "answerable questions refused") + stat(pct(r.pass), "unanswerable ones let through"); };
  const pct = x => Math.round(x * 100) + "%";
  $("#thg-groups").addEventListener("click", e => { const b = e.target.closest("button"); if (!b) return;
    if (b.dataset.enc != null) other = !other; else { const g = G.find(x => x.k === b.dataset.k); g.on = !g.on; }
    b.classList.toggle("sel"); draw(); });
  $("#thg-t").addEventListener("input", draw); draw(); REDRAW.push(draw);
  const enc0 = other; other = false; const [m1, t1] = bestT(G); other = true; const [, t2] = bestT(G); other = enc0;
  const bet = makeBet("#bet-thg", ["yes", "no"], m1 < 0.1 ? 0 : 1);
  reveal("btn-thg", [bet], () => { const o = other; other = false; const r = rates(t1, G); other = o; $("#thg-note").hidden = false;
    $("#thg-note").innerHTML = TXT("thg-note", { t: t1.toFixed(3), ref: pct(r.ref), pass: pct(r.pass), t2: t2.toFixed(3) }); });
});
later(function fuzzy() {
  // every (question, doc) of Qdrant's top 10 with its partial_ratio and alignment (export_demo_data.py); labels by post id here
  const PX = D.fuzzy.proxy.map(([i, j, sc, al]) => ({ i, j, sc, al, gold: isGold(i, j) }));
  const byQ = GOLDEN.map((g, i) => PX.filter(p => p.i === i));
  const idHit = byQ.map(ps => ps.some(p => p.gold));
  const at = t => { const fz = byQ.map(ps => ps.some(p => p.sc >= t));
    return { lost: idHit.filter((h, i) => h && !fz[i]).length, wrong: fz.filter((f, i) => f && !idHit[i]).length,
             foreign: PX.filter(p => !p.gold && p.sc >= t).length, hits: fz.filter(Boolean).length }; };
  const ts = []; for (let t = 30; t <= 100; t++) ts.push([t, at(t)]);
  const dmin = Math.min(...ts.map(([, r]) => r.lost + r.wrong));
  const clean = ts.filter(([, r]) => r.foreign === 0), cmin = Math.min(...clean.map(([, r]) => r.lost + r.wrong)), plateau = clean.filter(([, r]) => r.lost + r.wrong === cmin).map(([t]) => t);
  const tbest = plateau[Math.floor(plateau.length / 2)];
  const bet = makeBet("#bet-proxy", ["yes, there is one", "no, every threshold disagrees somewhere"], dmin === 0 ? 0 : 1);
  let sel = PX.find(p => p.gold && p.sc < 80) || PX[0];
  const showPair = p => { const q = GOLDEN[p.i].quote, d = DOCS[p.j].text, [a0, a1, b0, b1] = p.al, pad = 90;
    const mk = (t, x0, x1) => { const s0 = Math.max(0, x0 - pad), s1 = Math.min(t.length, x1 + pad);
      return (s0 ? "…" : "") + esc(t.slice(s0, x0)) + `<mark>${esc(t.slice(x0, x1))}</mark>` + esc(t.slice(x1, s1)) + (s1 < t.length ? "…" : ""); };
    $("#px-a").innerHTML = `<span class="mono small-note">G${p.i + 1} · ${p.gold ? "gold post" : "another post"} · partial_ratio ${p.sc.toFixed(0)}</span>\n` + mk(q, a0, a1);
    $("#px-b").innerHTML = `<span class="mono small-note">#${DOCS[p.j].id}</span>\n` + mk(d, b0, b1); };
  const draw = () => { const t = +$("#px-t").value; $("#px-tv").textContent = t; const r = at(t);
    const p = plot($("#px-plot"), { w: 760, h: 300, x: [0, 100], y: [0.5, NG + 0.5], xt: [0, 20, 40, 60, 80, 100], yt: [], xl: "partial_ratio(golden quote, retrieved document)", l: 44, t: 10, b: 40 });
    GOLDEN.forEach((g, i) => { txt(p.s, p.L - 6, p.Y(NG - i) + 4, "G" + (i + 1), { anchor: "end", fs: 10.5, mono: 1, color: css(idHit[i] ? "--ink-2" : "--ink-3") });
      line(p.s, p.L, p.Y(NG - i), p.W - p.R, p.Y(NG - i), { color: css("--rule"), sw: 0.6 }); });
    rect(p.s, p.X(t), p.T, p.X(100) - p.X(t), p.H - p.B - p.T, { fill: TINT("--cls-1", 10) });
    line(p.s, p.X(t), p.T, p.X(t), p.H - p.B, { color: css("--cls-1"), sw: 1.6 });
    PX.slice().sort((a, b) => a.gold - b.gold).forEach(q => { const c = p.s.appendChild(el("circle", { cx: p.X(q.sc), cy: p.Y(NG - q.i), r: q === sel ? 6.5 : 4.5,
        fill: q.gold ? css("--good") : css("--ink-3"), opacity: q.gold ? 0.95 : 0.55, stroke: q === sel ? css("--ink") : "none", "stroke-width": 1.5, style: "cursor:pointer" }));
      c.addEventListener("click", () => { sel = q; showPair(q); draw(); });
      tipOn(c, `G${q.i + 1} · #${DOCS[q.j].id} · ${q.gold ? "gold post" : "another post"} · ${q.sc.toFixed(0)}`); });
    $("#px-stats").innerHTML = stat(`${idHit.filter(Boolean).length} / ${NG}`, "hits by post id") + stat(`${r.hits} / ${NG}`, `hits by fuzzy ≥ ${t}`) +
      stat(r.lost, "gold retrieved, fuzzy says miss") + stat(r.foreign, "other posts counted as hits"); };
  $("#px-t").addEventListener("input", draw); draw(); showPair(sel); REDRAW.push(draw);
  const best = D.fuzzy.best, reach = best.filter(b => b >= 80).length;
  const gmin = Math.min(...byQ.filter((ps, i) => idHit[i]).map(ps => Math.max(...ps.filter(p => p.gold).map(p => p.sc)))), omax = Math.max(...PX.filter(p => !p.gold).map(p => p.sc));
  reveal("btn-proxy", [bet], () => { $("#proxy-note").hidden = false;
    $("#proxy-note").innerHTML = TXT("proxy-note", { lost80: at(80).lost, reach, n: NG, ceil: f2(reach / NG), omax: omax.toFixed(0), gmin: gmin.toFixed(0), tlo: plateau[0], thi: plateau[plateau.length - 1], dbest: cmin }); });
  $("#asran-note").innerHTML = TXT("asran-note", { asis: f3(D.as_ran.mrr), fixed: f3(T["Qdrant"].mrr) });
});
later(function rankMetrics() {
  qOptions("#mk-q", "golden");
  const RET = { "Qdrant": i => D.dense.order[i], "BM25": i => D.bm25.order.split[i], "BM25, lower case": i => D.bm25.order.lower[i], "Ensemble": i => D.ensemble.order[i], "PD-Retriever": i => D.pd.order[i] };
  $("#mk-ret").innerHTML = Object.keys(RET).map(k => `<option>${k}</option>`).join("");
  let list = [];
  const load = () => { const i = +$("#mk-q").value; list = RET[$("#mk-ret").value](i).slice(0, 10).map(j => ({ j, rel: isGold(i, j) ? 1 : 0 })); render(); };
  const render = () => { const k = +$("#mk-k").value; $("#mk-kv").textContent = k;
    $("#mk-list").innerHTML = list.map((d, r) => `<div class="it${d.rel ? " rel" : ""}${r >= k ? " out" : ""}" draggable="true" data-r="${r}"><span class="n">${r + 1}</span><input type="checkbox" ${d.rel ? "checked" : ""} title="relevant"><span class="x">#${DOCS[d.j].id} · ${esc(snip(DOCS[d.j].text, 80))}</span><span class="mv"><button data-up>↑</button><button data-dn>↓</button></span></div>`).join("");
    const rel = list.map(d => d.rel), top = rel.slice(0, k), nrel = rel.filter(Boolean).length;
    const P = top.filter(Boolean).length / k, hit = top.some(Boolean) ? 1 : 0, first = rel.indexOf(1), RR = first >= 0 && first < 10 ? 1 / (first + 1) : 0;
    let ap = 0, seen = 0; const apT = []; top.forEach((x, r) => { if (x) { seen++; ap += seen / (r + 1); apT.push(`${seen}/${r + 1}`); } }); ap = nrel ? ap / Math.min(nrel, k) : 0;
    const dcgT = top.map((x, r) => (x ? 1 / Math.log2(r + 2) : 0)), dcg = dcgT.reduce((a, c) => a + c, 0);
    const idcg = Array.from({ length: Math.min(nrel, k) }, (_, r) => 1 / Math.log2(r + 2)).reduce((a, c) => a + c, 0), nd = idcg ? dcg / idcg : 0;
    const row = (k1, v, terms) => `<div class="mrow"><div class="k">${k1}</div><div class="v">${f3(v)}</div><div class="terms">${terms}</div></div>`;
    $("#mk-out").innerHTML = `<div class="mgrid">` + row(`P@${k}`, P, `${top.filter(Boolean).length} relevant / ${k}`) + row(`Hit@${k}`, hit, hit ? "a relevant one is in the top-k" : "none in the top-k") +
      row("reciprocal rank", RR, first >= 0 ? `1 / ${first + 1}` : "no relevant document") + row(`AP@${k}`, ap, apT.length ? `(${apT.join(" + ")}) / ${Math.min(nrel, k)}` : "0") +
      row(`NDCG@${k}`, nd, `DCG ${dcgT.map(x => x ? f3(x) : "0").join(" + ")} / IDCG ${f3(idcg)}`) + `</div>`; };
  $("#mk-list").addEventListener("click", e => { const it = e.target.closest(".it"); if (!it) return; const r = +it.dataset.r;
    if (e.target.matches("input")) { list[r].rel = e.target.checked ? 1 : 0; render(); return; }
    const to = e.target.matches("[data-up]") ? r - 1 : e.target.matches("[data-dn]") ? r + 1 : -1; if (to < 0 || to >= list.length) return; [list[r], list[to]] = [list[to], list[r]]; render(); });
  let drag = null;
  $("#mk-list").addEventListener("dragstart", e => { const it = e.target.closest(".it"); drag = +it.dataset.r; it.classList.add("drag"); });
  $("#mk-list").addEventListener("dragover", e => e.preventDefault());
  $("#mk-list").addEventListener("drop", e => { e.preventDefault(); const it = e.target.closest(".it"); if (!it || drag == null) return; const to = +it.dataset.r; const [m] = list.splice(drag, 1); list.splice(to, 0, m); drag = null; render(); });
  // open on a question where Qdrant has the gold post below the first place: the metrics then disagree with each other
  const first = T["Qdrant"].ranks.findIndex(r => r && r > 1); if (first >= 0) $("#mk-q").value = String(first);
  ["#mk-q", "#mk-ret"].forEach(s => $(s).addEventListener("change", load)); $("#mk-k").addEventListener("input", render); load();
});
later(function board() {
  const ROWS = ["Qdrant", "BM25", "BM25, lower case", "Ensemble", "PD-Retriever", "QE + Qdrant", "HyDE + Qdrant", "Ensemble + Reranking", "CRAG"];
  const base = T["Qdrant"].mrr;
  const verdict = n => { const d = T[n].mrr - base; return d > 0.05 ? 0 : d < -0.05 ? 2 : 1; };
  const cell = r => { const c = r == null ? "var(--panel-sunk)" : r === 1 ? TINT("--good", 70) : r <= 3 ? TINT("--good", 38) : TINT("--good", 16); return `<td class="q"><i style="background:${c}">${r == null ? "–" : r}</i></td>`; };
  // the browser's metrics from the ranks equal the table Python wrote
  const mrrOf = rk => rk.reduce((a, r) => a + (r ? 1 / r : 0), 0) / rk.length;
  const okAll = ROWS.every(n => Math.abs(mrrOf(T[n].ranks) - T[n].mrr) < 1e-3);
  $("#board").innerHTML = `<thead><tr><th>retriever</th><th>vs Qdrant?</th><th>MRR</th><th>Hit@1</th><th>Hit@10</th>${GOLDEN.map((g, i) => `<th class="q">${i + 1}</th>`).join("")}</tr></thead><tbody>` +
    ROWS.map((n, r) => `<tr class="${r === 0 ? "base" : "hidden"}" data-n="${esc(n)}"><td>${esc(n)}</td><td class="betcell">${r === 0 ? "the baseline" : `<button data-v="0">better</button> <button data-v="1">≈</button> <button data-v="2">worse</button><span class="verdict"></span>`}</td>` +
      `<td class="num">${f3(T[n].mrr)}</td><td class="num">${f2(T[n].hit["1"])}</td><td class="num">${f2(T[n].hit["10"])}</td>${T[n].ranks.map(cell).join("")}</tr>`).join("") + `</tbody>`;
  const open = (tr, pick) => { if (!tr.classList.contains("hidden")) return; tr.classList.remove("hidden"); const v = verdict(tr.dataset.n), out = $(".verdict", tr);
    $$("button[data-v]", tr).forEach(b => { b.classList.toggle("right", +b.dataset.v === v); b.classList.toggle("wrong", +b.dataset.v === pick && pick !== v); b.disabled = true; });
    if (out) out.textContent = pick == null ? "" : pick === v ? "✓" : "✗"; };
  $("#board").addEventListener("click", e => { const b = e.target.closest("button[data-v]"); if (b) open(b.closest("tr"), +b.dataset.v); });
  $$("#board tbody tr").forEach((tr, r) => { if (r) $$("td.q", tr).forEach((td, i) => tipOn(td, () => tr.classList.contains("hidden") ? "the bet first" : `G${i + 1} · ${esc(snip(GOLDEN[i].q, 90))}`)); });
  $("#btn-board").addEventListener("click", e => { $$("#board tr.hidden").forEach(tr => open(tr, null)); e.target.disabled = true; e.target.textContent = "revealed";
    const better = ROWS.slice(1).filter(n => verdict(n) === 0).length, worse = ROWS.slice(1).filter(n => verdict(n) === 2).length;
    $("#board-note").hidden = false; $("#board-note").innerHTML = TXT("board-note", { better, worse }) + " " + check("board", okAll, "every row's MRR, recomputed here from its ranks, equals the notebook's."); });
});
/* the kappa stand (after the evaluation lecture of llm-system-engineering): synthetic labels, kappas checked against sklearn */
function mulberry32(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const KAP = (() => { const N = 60, r1 = mulberry32(11), r2 = mulberry32(23), r3 = mulberry32(37);
  const human = Array.from({ length: N }, () => 2 + Math.floor(r1() * 4)), u = Array.from({ length: N }, () => r2()), sign = Array.from({ length: N }, () => r3() < .5 ? -1 : 1);
  const judgeOf = (sh, p) => human.map((v, i) => Math.max(1, Math.min(5, v - sh + (u[i] < p ? sign[i] : 0))));
  const kappa = (h, j, weighted) => { const K = 5, O = Array.from({ length: K }, () => Array(K).fill(0)); h.forEach((v, i) => O[v - 1][j[i] - 1]++);
    const rs = O.map(r => r.reduce((a, b) => a + b, 0)), cs = Array.from({ length: K }, (_, c) => O.reduce((a, r) => a + r[c], 0)); let num = 0, den = 0;
    for (let a = 0; a < K; a++) for (let b = 0; b < K; b++) { const w = weighted ? (a - b) * (a - b) : (a === b ? 0 : 1); num += w * O[a][b]; den += w * rs[a] * cs[b] / h.length; }
    return { k: den ? 1 - num / den : 1, O }; };
  return { human, judgeOf, kappa }; })();
later(function kappaStand() {
  const draw = () => { const sh = +$("#ks-sh").value, p = +$("#ks-ns").value / 100;
    $("#ks-v").textContent = sh ? "−" + sh : "0"; $("#ks-nv").textContent = Math.round(p * 100) + "%";
    const j = KAP.judgeOf(sh, p), acc = KAP.human.filter((v, i) => v === j[i]).length / j.length, ku = KAP.kappa(KAP.human, j, false), kw = KAP.kappa(KAP.human, j, true);
    $("#ks-stats").innerHTML = stat(Math.round(acc * 100) + "%", "accuracy") + stat(f2(ku.k), "plain κ") + stat(f2(kw.k), "weighted κ, quadratic");
    const mx = Math.max(...ku.O.flat());
    $("#ks-grid").innerHTML = `<div class="h"></div>` + [1, 2, 3, 4, 5].map(c => `<div class="h">${c}</div>`).join("") +
      [1, 2, 3, 4].map(a => `<div class="h">${a + 1}</div>` + ku.O[a].map((v, b) => `<div class="c${a === b ? " d" : ""}" style="background:${TINT("--cls-0", Math.round(v / mx * 55))}">${v || ""}</div>`).join("")).join("");
    $("#ks-note").innerHTML = TXT("kappa-" + sh); };
  ["#ks-sh", "#ks-ns"].forEach(x => $(x).addEventListener("input", draw)); draw();
  // every slider position against sklearn's cohen_kappa_score
  const KC = D.kappa_check; let bad = 0, n = 0;
  for (const key in KC) { const [sh, pn] = key.split("/").map(Number), j = KAP.judgeOf(sh, pn / 100); n++;
    if (Math.abs(KAP.kappa(KAP.human, j, false).k - KC[key][0]) > 1e-8 || Math.abs(KAP.kappa(KAP.human, j, true).k - KC[key][1]) > 1e-8) bad++; }
  $("#ks-check").innerHTML = check("kappa", bad === 0, `plain and weighted κ at all ${n} slider positions equal sklearn's cohen_kappa_score.`);
});
later(function judge() {
  const J = D.judge, cl = v => Math.max(0, Math.min(5, v));
  const kappa = (a, b) => { const n = a.length, cats = [0, 1, 2, 3, 4, 5]; const po = a.filter((x, i) => x === b[i]).length / n;
    const pe = cats.reduce((s, c) => s + (a.filter(x => x === c).length / n) * (b.filter(x => x === c).length / n), 0); return pe === 1 ? 1 : (po - pe) / (1 - pe); };
  const ks = ["relevance", "faithfulness"].map(k => { const a = J.lenient.map(s => cl(s[k])), b = J.strict.map(s => cl(s[k])); return { k, a, b, kap: kappa(a, b) }; });
  const ok = ks.every((x, n) => Math.abs(x.kap - D.judge.kappa[x.k]) < 1e-6);
  const bet = makeBet("#bet-judge", ["yes, κ > 0.4 on both", "no"], ks.every(x => x.kap > 0.4) ? 0 : 1);
  const draw = () => { $("#judge-mats").innerHTML = ks.map(x => `<div><div class="hm-title">${x.k} · κ = ${f3(x.kap)}</div><div class="hm" id="jm-${x.k}"></div></div>`).join("");
    ks.forEach(x => { const s = svg(300, 300), C = 40, L = 50, Tt = 20; const m = Array.from({ length: 6 }, () => new Array(6).fill(0)); x.a.forEach((v, i) => m[v][x.b[i]]++); const mx = Math.max(...m.flat(), 1);
      for (let r = 0; r < 6; r++) for (let c = 0; c < 6; c++) { const v = m[r][c]; const R = rect(s, L + c * C, Tt + r * C, C - 2, C - 2, { fill: v ? TINT("--cls-0", 15 + 75 * v / mx) : css("--panel-sunk"), rx: 2 }); if (v) txt(s, L + c * C + C / 2 - 1, Tt + r * C + C / 2 + 4, String(v), { fs: 12.5, mono: 1, color: css("--ink") }); }
      for (let r = 0; r < 6; r++) { txt(s, L - 8, Tt + r * C + C / 2 + 4, String(r), { anchor: "end", fs: 12, mono: 1, color: css("--ink-3") }); txt(s, L + r * C + C / 2, Tt - 6, String(r), { fs: 12, mono: 1, color: css("--ink-3") }); }
      txt(s, L + 3 * C, 296, "", { fs: 1 }); txt(s, 12, Tt + 3 * C, "lenient", { fs: 12, color: css("--ink-3"), anchor: "middle" }).setAttribute("transform", `rotate(-90 12 ${Tt + 3 * C})`);
      $("#jm-" + x.k).appendChild(s); $("#jm-" + x.k).insertAdjacentHTML("beforeend", `<div class="small-note">rows: the lenient judge · columns: the strict one</div>`); }); };
  draw(); REDRAW.push(draw);
  reveal("btn-judge", [bet], () => { $("#judge-note").hidden = false; const good = ks.every(x => x.kap > 0.4);
    $("#judge-note").innerHTML = TXT("judge-note", { kr: f3(ks[0].kap), kf: f3(ks[1].kap), n: J.lenient.length, verdict: TXT(good ? "judge-ok" : "judge-bad") }) + " " + check("kappa", ok, "κ here equals sklearn's cohen_kappa_score."); });
});

runLater();
