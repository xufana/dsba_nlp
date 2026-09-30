/* ====================================================== schematics and interactives (second pass, 2026-09-30) */
const code = (host, text) => { $(host).innerHTML = text.split("\n").map(l => `<span class="ln">${esc(l)}</span>`).join(""); };
/* a code panel whose lines carry a data-f token: hovering a line calls `on(f)` */
function codeF(host, text, tagger, on) {
  const h = $(host); h.innerHTML = text.split("\n").map(l => { const f = tagger(l); return `<span class="ln"${f ? ` data-f="${f}"` : ""}>${esc(l)}</span>`; }).join("");
  if (on) h.addEventListener("pointerover", e => { const ln = e.target.closest(".ln[data-f]"); if (ln) on(ln.dataset.f); });
}
/* a labelled box that never overflows: the label is measured (IBM Plex Mono ≈ 0.6 em per character);
   by default the font shrinks to fit the given width, with o.grow the box widens around its centre instead */
const TEXT_W = (t, fs) => String(t).length * fs * 0.61 + 14;
function box(s, x, y, w, h, label, o) { o = o || {}; let fs = o.fs || 14;
  if (label != null && label !== "") { const need = TEXT_W(label, fs);
    if (need > w) { if (o.grow) { const cx = x + w / 2; w = need; x = cx - w / 2; } else fs = Math.max(8, fs * (w - 6) / (need - 8)); } }
  const r = el("rect", { x, y, width: w, height: h, rx: o.rx == null ? 6 : o.rx, fill: "none", stroke: o.stroke || css("--rule-strong"), "stroke-width": o.sw || 1.4, "stroke-dasharray": o.dash ? "5 4" : "none" }); r.style.fill = o.fill || "var(--panel-sunk)"; s.appendChild(r);
  if (label != null) { const t = el("text", { x: x + w / 2, y: y + h / 2 + fs * .36, "font-size": fs, "text-anchor": "middle", fill: o.color || css("--ink"), "font-weight": o.bold ? "600" : "400" }, label); s.appendChild(t); if (fs < (o.fs || 14) - 2 && String(label).length > 6) tipOn(r, esc(label)); }
  r.box = { x, y, w, h }; return r; }
function txt(s, x, y, t, o) { o = o || {}; return s.appendChild(el("text", { x, y, "font-size": o.fs || 13.5, "text-anchor": o.anchor || "middle", fill: o.color || css("--ink-2"), "font-weight": o.bold ? "600" : "400", "font-style": o.italic ? "italic" : "normal" }, t)); }
function arrow(s, x1, y1, x2, y2, o) { o = o || {}; const color = o.color || css("--ink-2"), id = "arr-" + String(color).replace(/[^a-z0-9]/gi, "");
  if (!s.querySelector("#" + id)) { let defs = s.querySelector("defs"); if (!defs) { defs = el("defs", {}); s.appendChild(defs); } const m = el("marker", { id, viewBox: "0 0 10 10", refX: 9, refY: 5, markerWidth: 6, markerHeight: 6, orient: "auto-start-reverse" }); m.appendChild(el("path", { d: "M 0 0 L 10 5 L 0 10 z", fill: color })); defs.appendChild(m); }
  s.appendChild(el("path", { d: o.d || `M ${x1} ${y1} L ${x2} ${y2}`, fill: "none", stroke: color, "stroke-width": o.sw || 1.6, "stroke-dasharray": o.dash ? "4 4" : "none", "marker-end": `url(#${id})` })); }
const TINT = (v, pct) => `color-mix(in srgb, var(${v}) ${pct}%, var(--panel))`;
const SUNK = () => css("--panel-sunk");
function states(btnsId, draw) {                       // a button row that switches what a figure highlights
  let mode = $(`#${btnsId} button.sel`).dataset.m; draw(mode); REDRAW.push(() => draw(mode));
  $(`#${btnsId}`).addEventListener("click", e => { const b = e.target.closest("button[data-m]"); if (!b) return; mode = b.dataset.m; $$(`#${btnsId} button`).forEach(x => x.classList.toggle("sel", x === b)); draw(mode); });
  return m => { mode = m; $$(`#${btnsId} button`).forEach(x => x.classList.toggle("sel", x.dataset.m === m)); draw(m); };
}
/* one encoder block, drawn the way week 3 drew it: attention, FFN, dashed residuals */
function encoderBlock(s, x, y, w, h, o) {
  o = o || {}; box(s, x, y, w, h, null, { fill: TINT("--cls-1", 7), stroke: css("--cls-1") });
  const iw = Math.min(260, w * .5), ix = x + w / 2 - iw / 2, hh = (h - 30) / 2;
  box(s, ix, y + h - 10 - hh, iw, hh, "self-attention · 12 heads", { fill: css("--panel"), fs: 12.5 });
  box(s, ix, y + 10, iw, hh, "FFN · 768 → 3072 → 768", { fill: css("--panel"), fs: 12.5 });
  s.appendChild(el("path", { d: `M ${ix - 14} ${y + h - 6} C ${ix - 40} ${y + h - 6} ${ix - 40} ${y + h / 2} ${ix - 14} ${y + h / 2}`, fill: "none", stroke: css("--ink-3"), "stroke-dasharray": "3 3" }));
  s.appendChild(el("path", { d: `M ${ix - 14} ${y + h / 2 - 2} C ${ix - 40} ${y + h / 2 - 2} ${ix - 40} ${y + 6} ${ix - 14} ${y + 6}`, fill: "none", stroke: css("--ink-3"), "stroke-dasharray": "3 3" }));
  txt(s, ix - 46, y + h / 2 + 4, "+", { fs: 13, color: css("--ink-3") });
  if (o.label) txt(s, x + w - 10, y + 16, o.label, { anchor: "end", fs: 12.5, color: css("--cls-1"), bold: 1 });
}

/* ---- 01 live tokenizer: replay the toy merges / longest-match on the same vocabulary */
(function liveTok() {
  const BPE = TK.bpeMerges, WP = TK.wpMerges;
  const chars = new Set(); TK.toyWords.forEach(([w]) => { for (const c of w) chars.add(c); });
  function replay(word, merges, k, wp) {
    let units = wp ? [...word].map((c, i) => i ? "##" + c : c) : [...word].concat(["</w>"]);
    for (const c of word) if (!chars.has(c)) return null;
    for (let m = 0; m < k; m++) {
      const [a, b] = merges[m]; const out = [];
      for (let i = 0; i < units.length; i++) { if (units[i] === a && units[i + 1] === b) { out.push(wp ? a + b.replace(/^##/, "") : a + b); i++; } else out.push(units[i]); }
      units = out;
    }
    return units;
  }
  function longest(word, k) {
    const vocab = new Set(); chars.forEach(c => { vocab.add(c); vocab.add("##" + c); }); for (let m = 0; m < k; m++) vocab.add(WP[m][0] + WP[m][1].replace(/^##/, ""));
    const out = []; let i = 0;
    while (i < word.length) { let j = word.length, hit = null; while (j > i) { const cand = (i ? "##" : "") + word.slice(i, j); if (vocab.has(cand)) { hit = cand; break; } j--; } if (!hit) return ["[UNK]"]; out.push(hit); i = j; }
    return out;
  }
  const show = (host, pieces) => $(host).innerHTML = pieces === null ? tok("[UNK]", "unk") + `<span class="lab">a character not in the toy corpus</span>` : pieces.map(p => tok(p, p === "[UNK]" ? "unk" : p.startsWith("##") ? "cont" : p.endsWith("</w>") ? "eow" : "")).join("");
  function run() {
    const w = $("#live-tok-word").value.toLowerCase().replace(/\s+/g, "") || "a", k = +$("#live-tok-n").value; $("#live-tok-k").textContent = k;
    const b = replay(w, BPE, k, false), r = replay(w, WP, k, true), l = longest(w, k);
    show("#live-bpe", b); show("#live-wp-replay", r); show("#live-wp-longest", l);
    $("#live-tok-stats").textContent = r && r.join(" ") !== l.join(" ") ? "replay ≠ longest match" : "replay = longest match";
  }
  $("#live-tok-word").addEventListener("input", run); $("#live-tok-n").addEventListener("input", run); run();
})();

/* ---- 02 BERT: the model, then the two pretraining heads on the same picture */
const BERT_TOKS = ["[CLS]", "the", "cat", "sat", "on", "[SEP]", "it", "was", "warm", "[SEP]"];
function figBert(mode) {
  const host = $("#fig-bert"); host.innerHTML = ""; const W = 1000, H = 560, s = svg(W, H); const n = BERT_TOKS.length, x0 = 90, cw = (W - x0 - 30) / n, X = i => x0 + cw * (i + 0.5);
  const NOTE = {
    in: `Two sentences in, <code>[CLS] A [SEP] B [SEP]</code>. Every token becomes the <em>sum</em> of three table rows — its WordPiece, its segment (A or B: this is <code>token_type_ids</code>) and its position (a learned 512-row table, not a formula). <code>[SEP]</code> is where the segment flips; <code>[CLS]</code> has no token of its own, so whatever ends up in <math><msub><mi>h</mi><mn>0</mn></msub></math> is whatever a training task pushed there. Then 12 copies of last week's encoder block, and one 768-vector per position comes out. Our code differs from Alammar's picture in one place: Pre-LN inside the block, not Post-LN.`,
    mlm: `Masked language modelling. Of the 15% chosen positions, <span class="tok mk" style="font-size:12px">80%</span> are replaced by <code>[MASK]</code>, <span class="tok rnd" style="font-size:12px">10%</span> by a random token, <span class="tok keep" style="font-size:12px">10%</span> are left unchanged — and at all three the head has to produce the <em>original</em> token: a Linear + LayerNorm + Linear to 30 522 logits, softmax over the vocabulary, cross-entropy against the original. The other 85% of the positions get no gradient at all; that is the number ELECTRA later attacks.`,
    nsp: `Next-sentence prediction. Only <math><msub><mi>h</mi><mn>0</mn></msub></math> is read — through the <em>pooler</em>, <math><mrow><mi>tanh</mi><mo>(</mo><mi>W</mi><msub><mi>h</mi><mn>0</mn></msub><mo>+</mo><mi>b</mi><mo>)</mo></mrow></math>, and one <code>Linear(768, 2)</code>: did B follow A in the text, or was it a random sentence? This is the only reason <code>[CLS]</code> means anything: nothing else in pretraining ever looks at that position. RoBERTa dropped this task and lost nothing; the pooler stayed in every checkpoint.`,
  };
  const chosen = { 3: "mk", 8: "rnd", 2: "keep" };                          // sat → [MASK], warm → random, cat → unchanged
  const shown = mode === "mlm" ? BERT_TOKS.map((t, i) => chosen[i] === "mk" ? "[MASK]" : chosen[i] === "rnd" ? "apple" : t) : BERT_TOKS;
  // 1. tokens, then the three embedding rows they are summed from
  const yTok = 500, yE = [455, 425, 395];
  shown.forEach((t, i) => { const sp = /^\[/.test(BERT_TOKS[i]) && t !== "[MASK]", c = mode === "mlm" ? chosen[i] : null;
    box(s, X(i) - cw / 2 + 5, yTok, cw - 10, 32, t, { fill: c === "mk" ? TINT("--cls-3", 28) : c === "rnd" ? TINT("--cls-1", 28) : c === "keep" ? TINT("--cls-2", 28) : sp ? SUNK() : css("--panel"), stroke: c ? css(c === "mk" ? "--cls-3" : c === "rnd" ? "--cls-1" : "--cls-2") : css("--rule-strong"), fs: 13.5, bold: sp || !!c });
    if (mode === "mlm" && c) txt(s, X(i), yTok + 48, "was: " + BERT_TOKS[i], { fs: 11.5, color: css("--ink-3") });
    const seg = i <= 5 ? 0 : 1;
    box(s, X(i) - cw / 2 + 5, yE[0], cw - 10, 22, "E(" + BERT_TOKS[i].replace(/[\[\]]/g, "").slice(0, 4) + ")", { fill: css("--panel"), fs: 10.5, color: css("--ink-2"), rx: 3 });
    box(s, X(i) - cw / 2 + 5, yE[1], cw - 10, 22, seg ? "E_B" : "E_A", { fill: TINT(seg ? "--cls-2" : "--cls-0", mode === "nsp" || mode === "in" ? 22 : 10), fs: 11, color: css("--ink-2"), rx: 3 });
    box(s, X(i) - cw / 2 + 5, yE[2], cw - 10, 22, "P" + i, { fill: css("--panel"), fs: 11, color: css("--ink-2"), rx: 3 });
    s.appendChild(el("line", { x1: X(i), x2: X(i), y1: 395, y2: 372, stroke: css("--ink-3"), "stroke-width": 1.2 }));
  });
  txt(s, x0 - 8, yTok + 21, "tokens", { anchor: "end", fs: 12.5 }); txt(s, x0 - 8, yE[0] + 15, "token", { anchor: "end", fs: 12 }); txt(s, x0 - 8, yE[1] + 15, "segment", { anchor: "end", fs: 12 }); txt(s, x0 - 8, yE[2] + 15, "position", { anchor: "end", fs: 12 });
  txt(s, x0 - 8, yE[0] - 6, "+", { anchor: "end", fs: 13, color: css("--ink-3") }); txt(s, x0 - 8, yE[1] - 6, "+", { anchor: "end", fs: 13, color: css("--ink-3") });
  if (mode === "in") { txt(s, X(5), yTok + 48, "segment boundary", { fs: 11.5, color: css("--cls-2") }); txt(s, X(0), yTok + 48, "no token of its own", { fs: 11.5, color: css("--ink-3") }); }
  // 2. the encoder: one block drawn, the rest stacked
  encoderBlock(s, x0, 262, W - x0 - 30, 110, { label: "block 1 · 7.1M" });
  [0, 1, 2].forEach(k => box(s, x0, 236 - k * 22, W - x0 - 30, 16, null, { fill: TINT("--cls-1", 5), stroke: css("--cls-1"), rx: 4 }));
  txt(s, W / 2, 205, "⋮  blocks 2 … 12  ⋮", { fs: 12.5, color: css("--cls-1") });
  txt(s, x0 + 8, 182, "× 12 in bert-base · × 24 in bert-large · every block the same shape", { anchor: "start", fs: 12, color: css("--ink-3") });
  // 3. the output: one vector per position
  const yH = 130;
  BERT_TOKS.forEach((t, i) => { const on = mode === "in" || (mode === "mlm" && chosen[i]) || (mode === "nsp" && i === 0);
    s.appendChild(el("line", { x1: X(i), x2: X(i), y1: 262, y2: yH + 30, stroke: css("--ink-3"), "stroke-width": 1.2 }));
    box(s, X(i) - cw / 2 + 8, yH, cw - 16, 30, "h" + i, { fill: on ? TINT("--cls-1", 22) : SUNK(), stroke: on ? css("--cls-1") : css("--rule-strong"), fs: 12.5, color: on ? css("--ink") : css("--ink-3") }); });
  txt(s, x0 - 8, yH + 20, "H", { anchor: "end", fs: 13, bold: 1 }); txt(s, x0 - 8, yH + 36, "[L, 768]", { anchor: "end", fs: 11, color: css("--ink-3") });
  // 4. what reads H
  if (mode === "mlm") {
    const hx = (X(0) + X(n - 1)) / 2, hw = 760;
    box(s, hx - hw / 2, 24, hw, 34, "MLM head · Linear(768, 768) + GELU + LayerNorm + Linear(768, 30 522) → softmax over the vocabulary", { fill: TINT("--cls-3", 18), stroke: css("--cls-3"), fs: 12.5, bold: 1, grow: 1 });
    Object.keys(chosen).forEach(i => { i = +i; arrow(s, X(i), yH, X(i), 62, { color: css("--cls-3") }); txt(s, X(i), 14, "→ " + BERT_TOKS[i], { fs: 12.5, color: css("--cls-3"), bold: 1 }); });
    txt(s, x0, 14, "targets: the original tokens", { anchor: "start", fs: 11.5, color: css("--ink-3") });
    txt(s, x0, 84, "cross-entropy at the 3 chosen positions of 10 · the other 7 get no gradient", { anchor: "start", fs: 12, color: css("--ink-3") });
  } else if (mode === "nsp") {
    const bx = X(0) - cw / 2 + 8, bw = 260;
    const b1 = box(s, bx, 66, bw, 30, "pooler · tanh(W h₀ + b) · 768", { fill: TINT("--cls-2", 18), stroke: css("--cls-2"), fs: 12.5 });
    const b2 = box(s, bx, 24, bw, 30, "Linear(768, 2) → IsNext / NotNext", { fill: TINT("--cls-2", 18), stroke: css("--cls-2"), fs: 12.5, bold: 1 });
    arrow(s, X(0), yH, X(0), 100, { color: css("--cls-2") }); arrow(s, X(0), 66, X(0), 58, { color: css("--cls-2") });
    txt(s, bx + bw + 16, 44, "cross-entropy over the two classes", { anchor: "start", fs: 12, color: css("--ink-3") });
    txt(s, bx + bw + 16, 86, "h₀ is the only position anything reads — nothing else in pretraining looks at [CLS]", { anchor: "start", fs: 12, color: css("--ink-3") });
  } else {
    txt(s, W / 2, 60, "one 768-vector per position — what every head below reads", { fs: 13, color: css("--ink-2") });
    txt(s, W / 2, 84, "input: 3 tables summed  ·  body: 12 blocks  ·  output: H", { fs: 12, color: css("--ink-3") });
  }
  host.appendChild(s); $("#fig-bert-note").innerHTML = NOTE[mode];
}
const setBert = states("fig-bert-btns", figBert);
codeF("#code-pretrain", `H = body(input_ids, token_type_ids, attention_mask).last_hidden_state     # [B, L, 768] — one vector per position

# --- MLM: which positions?  the 15% that were chosen. The label is the ORIGINAL token there and -100 everywhere else
chosen = torch.rand(input_ids.shape) < 0.15                                 # (never the specials or the padding)
mlm_labels = torch.where(chosen, input_ids, -100)                           # target = the original token; -100 = "no loss here"
r = torch.rand(input_ids.shape)
input_ids[chosen & (r < 0.8)] = MASK_ID                                     # 80%: [MASK]
input_ids[chosen & (r >= 0.8) & (r < 0.9)] = random_token_id                # 10%: a random token
#                                                                            # 10%: left unchanged — and still predicted
mlm_logits = mlm_head(H)                                                    # Linear(768, 768) + GELU + LayerNorm + Linear(768, 30522): [B, L, V]
mlm_loss = F.cross_entropy(mlm_logits.flatten(0, 1), mlm_labels.flatten(), ignore_index=-100)   # softmax over V, only at the chosen positions

# --- NSP: which position?  one — h_0, the [CLS] slot — through the pooler
pooled = torch.tanh(pooler(H[:, 0]))                                        # [B, 768]
nsp_logits = nsp_head(pooled)                                               # Linear(768, 2): [B, 2]
nsp_loss = F.cross_entropy(nsp_logits, is_next)                             # softmax over the two classes, one label per pair

loss = mlm_loss + nsp_loss                                                  # BertForPreTraining sums the two`,
  l => /mlm|chosen|MASK_ID|random_token|10%|80%/.test(l) ? "mlm" : /nsp|pooled|pooler|is_next/.test(l) ? "nsp" : /^H = /.test(l) ? "in" : null, setBert);

/* ---- 02 the footnote: three later objectives, small, same language */
(function figVariants() {
  function strip(s, x, y, toks, cw, colours, o) { o = o || {}; toks.forEach((t, i) => box(s, x + i * cw + 2, y, cw - 4, 22, t, { fill: colours && colours[i] ? colours[i] : css("--panel"), stroke: colours && colours[i] ? css("--ink-3") : css("--rule-strong"), fs: o.fs || 10.5, rx: 3, color: css("--ink") })); }
  function electra() {
    const h = $("#fig-electra"); h.innerHTML = ""; const W = 560, H = 210, s = svg(W, H), toks = ["the", "cat", "sat", "on", "the", "mat"], cw = 56, x = 80;
    strip(s, x, 180, ["the", "[MASK]", "sat", "on", "the", "[MASK]"], cw, [0, TINT("--cls-3", 28), 0, 0, 0, TINT("--cls-3", 28)]);
    box(s, x, 140, 6 * cw, 26, "generator · a small MLM", { fill: TINT("--cls-3", 10), stroke: css("--cls-3"), fs: 12, grow: 1 });
    strip(s, x, 104, ["the", "dog", "sat", "on", "the", "mat"], cw, [0, TINT("--cls-1", 28), 0, 0, 0, TINT("--cls-2", 18)]);
    box(s, x, 60, 6 * cw, 30, "discriminator · the model you keep", { fill: TINT("--cls-1", 10), stroke: css("--cls-1"), fs: 12, bold: 1, grow: 1 });
    strip(s, x, 12, ["orig", "repl", "orig", "orig", "orig", "orig"], cw, toks.map((_, i) => TINT("--good", 16)), { fs: 10 });
    for (let i = 0; i < 6; i++) arrow(s, x + i * cw + cw / 2, 60, x + i * cw + cw / 2, 38, { color: css("--good") });
    txt(s, x + 6 * cw + 8, 28, "loss at 6 / 6", { anchor: "start", fs: 11, color: css("--good") }); txt(s, x - 8, 119, "corrupted", { anchor: "end", fs: 11 }); txt(s, x - 8, 195, "masked", { anchor: "end", fs: 11 });
    txt(s, x + 6 * cw + 8, 119, "mat: the generator", { anchor: "start", fs: 10, color: css("--cls-2") }); txt(s, x + 6 * cw + 8, 131, "sampled the original", { anchor: "start", fs: 10, color: css("--cls-2") });
    h.appendChild(s);
  }
  function t5() {
    const h = $("#fig-t5"); h.innerHTML = ""; const W = 560, H = 210, s = svg(W, H), cw = 56, x = 60;
    strip(s, x, 180, ["the", "cat", "<x>", "on", "the", "<y>", "."], cw, [0, 0, TINT("--cls-3", 28), 0, 0, TINT("--cls-3", 28), 0]);
    txt(s, x + 7 * cw / 2, 170, "spans dropped: 'sat', 'mat' · one sentinel each", { fs: 10.5, color: css("--ink-3") });
    box(s, x, 118, 190, 34, "encoder", { fill: TINT("--cls-1", 10), stroke: css("--cls-1"), fs: 12.5, bold: 1 });
    box(s, x + 210, 118, 190, 34, "decoder", { fill: TINT("--cls-0", 10), stroke: css("--cls-0"), fs: 12.5, bold: 1 });
    arrow(s, x + 190, 135, x + 210, 135, { color: css("--ink-2") });
    strip(s, x + 120, 60, ["<x>", "sat", "<y>", "mat", "</s>"], cw, [TINT("--cls-3", 28), TINT("--good", 16), TINT("--cls-3", 28), TINT("--good", 16), 0]);
    arrow(s, x + 305, 118, x + 305, 86, { color: css("--cls-0") });
    txt(s, x + 260, 40, "the target is a sequence: no head, text in → text out", { fs: 11, color: css("--ink-2") }); txt(s, x + 260, 24, "the same model translates and summarises the same way", { fs: 10.5, color: css("--ink-3") });
    h.appendChild(s);
  }
  function retromae() {
    const h = $("#fig-retromae"); h.innerHTML = ""; const W = 560, H = 230, s = svg(W, H), cw = 56, x = 20;
    strip(s, x, 200, ["[CLS]", "the", "[M]", "sat", "on", "[M]", "mat"], cw, [SUNK(), 0, TINT("--cls-3", 28), 0, 0, TINT("--cls-3", 28), 0]);
    txt(s, x + 7 * cw + 6, 215, "~30% masked", { anchor: "start", fs: 10.5, color: css("--ink-3") });
    box(s, x, 150, 7 * cw, 30, "encoder · 12 blocks", { fill: TINT("--cls-1", 10), stroke: css("--cls-1"), fs: 12, bold: 1 });
    box(s, x, 104, cw, 26, "h[CLS]", { fill: TINT("--cls-2", 28), stroke: css("--cls-2"), fs: 11, bold: 1 });
    arrow(s, x + cw / 2, 150, x + cw / 2, 132, { color: css("--cls-2") });
    strip(s, x + cw + 10, 106, ["[M]", "[M]", "sat", "[M]", "[M]", "mat"], cw, [TINT("--cls-3", 28), TINT("--cls-3", 28), 0, TINT("--cls-3", 28), TINT("--cls-3", 28), 0]);
    txt(s, x + cw + 10 + 6 * cw + 6, 121, "50–70%", { anchor: "start", fs: 10.5, color: css("--ink-3") });
    box(s, x, 58, 7 * cw, 30, "decoder · 1 block · gets h[CLS] and the heavier mask", { fill: TINT("--cls-0", 10), stroke: css("--cls-0"), fs: 11, bold: 1, grow: 1 });
    arrow(s, x + cw / 2, 104, x + cw / 2, 90, { color: css("--cls-2") });
    strip(s, x, 14, ["the", "cat", "sat", "on", "the", "mat", "."], cw, [1, 2, 3, 4, 5, 6, 7].map(() => TINT("--good", 16)));
    for (let i = 0; i < 7; i++) arrow(s, x + i * cw + cw / 2, 58, x + i * cw + cw / 2, 40, { color: css("--good") });
    h.appendChild(s);
  }
  const all = () => { electra(); t5(); retromae(); }; all(); REDRAW.push(all);
})();

/* ---- 02 the MLM head at every position: click a token */
(function mlmPick() {
  const P = D.mlm.positions; if (!P) return;
  let si = 0, ti = P[0].tokens.indexOf("[MASK]");
  $("#mlm-sents").innerHTML = P.map((p, i) => `<button data-m="${i}" class="${i === 0 ? "sel" : ""}">${i + 1}</button>`).join("");
  function draw() {
    const p = P[si];
    $("#mlm-toks").innerHTML = p.tokens.map((t, i) => `<span class="tok pick ${i === ti ? "on" : ""} ${t === "[MASK]" ? "mk" : /^\[/.test(t) ? "sp" : ""}" data-i="${i}">${esc(t)}</span>`).join("");
    const top = p.top[ti], t = p.tokens[ti];
    probBars($("#mlm-top"), top.map(([w, q]) => ({ label: w, p: q })), { max: 1 });
    const own = top.find(([w]) => w === t);
    $("#mlm-say").innerHTML = t === "[MASK]" ? `<b>masked</b> · the head predicts from context alone: top-1 <b>${esc(top[0][0])}</b> at ${top[0][1].toFixed(2)}` :
      own && own === top[0] ? `<b>${esc(t)}</b> is copied with ${own[1].toFixed(2)} — the 10% "unchanged" case; the runners-up are what would also fit here` :
      own ? `<b>${esc(t)}</b> gets ${own[1].toFixed(2)}, but <b>${esc(top[0][0])}</b> gets ${top[0][1].toFixed(2)} — the model flags the token as not fitting its context: the 10% "random" case` :
      `<b>${esc(t)}</b> is not even in its own top-5: the head wants <b>${esc(top[0][0])}</b> here (${top[0][1].toFixed(2)})`;
  }
  $("#mlm-sents").addEventListener("click", e => { const b = e.target.closest("button[data-m]"); if (!b) return; si = +b.dataset.m; $$("#mlm-sents button").forEach(x => x.classList.toggle("sel", x === b)); const m = P[si].tokens.indexOf("[MASK]"); ti = m >= 0 ? m : 1; draw(); });
  $("#mlm-toks").addEventListener("click", e => { const t = e.target.closest(".tok[data-i]"); if (!t) return; ti = +t.dataset.i; draw(); });
  draw();
})();

/* ---- 02 zero-shot: pick the label words, score in the browser, reveal the confusion */
(function zsPick() {
  const C = ZS.candidates, n = ZS.n, prob = f16(ZS.probs), gold = ZS.gold, m = C.length;
  $("#zs-pick").innerHTML = CLS.map((c, ci) => { const dflt = ZA.v1.words[ci]; return `<label class="field"><b>${esc(c)}</b><select data-c="${ci}">${C.map(w => `<option ${w === dflt ? "selected" : ""}>${esc(w)}</option>`).join("")}</select></label>`; }).join("");
  let revealed = false;
  function score() {
    const cols = $$("#zs-pick select").map(s => C.indexOf(s.value)); const conf = [[0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]]; let ok = 0;
    for (let i = 0; i < n; i++) { let b = 0, bv = -1; for (let c = 0; c < 4; c++) { const v = prob[i * m + cols[c]]; if (v > bv) { bv = v; b = c; } } conf[gold[i]][b]++; if (b === gold[i]) ok++; }
    const acc = ok / n;
    if (!revealed) { $("#zs-pick-acc").textContent = `words: ${cols.map(c => C[c]).join(" / ")}`; return acc; }
    $("#zs-pick-acc").textContent = `accuracy ${acc.toFixed(4)}`;
    probBars($("#zs-pick-out"), CLS.map((c, ci) => { const p = conf[ci][ci] / conf[ci].reduce((a, b) => a + b, 0); return { label: c, p, text: p.toFixed(3) }; }), { max: 1 });
    $("#zs-conf").innerHTML = `<tr><th></th>${CLS.map((c, ci) => `<th>→ ${esc(C[cols[ci]])}</th>`).join("")}</tr>` + CLS.map((c, ci) => `<tr><th style="text-align:left">${esc(c)}</th>${conf[ci].map((v, cj) => `<td class="${ci === cj ? "hit" : v > conf[ci][ci] ? "miss" : ""}" style="${v > conf[ci][ci] ? "color:var(--bad);font-weight:600" : ""}">${num(v)}</td>`).join("")}</tr>`).join("");
    return acc;
  }
  $("#zs-pick").addEventListener("change", score); score();
  $("#btn-zs-reveal").addEventListener("click", () => {
    revealed = true; const acc = score();
    betZs.reveal([0.30, 0.45, 0.60, 0.75].map((v, i) => [Math.abs(v - acc), i]).sort((a, b) => a[0] - b[0])[0][1]);
    $("#zs-out").hidden = false; $("#zs-note").hidden = false; const b = $("#btn-zs-reveal"); b.disabled = true; b.textContent = "revealed";
    document.dispatchEvent(new CustomEvent("revealed", { detail: "btn-zs-reveal" }));
  }, { once: true });
})();

/* ---- 02 pooler vs [CLS] vs mean: three bars with ±2 standard errors */
(function probeFig() {
  function draw() {
    const host = $("#probe-fig"); host.innerHTML = ""; const W = 620, H = 190, s = svg(W, H), rows = [["pooler (what NSP trained)", FE.artifact.summary.pooler], ["raw [CLS], last layer", FE.artifact.summary.cls], ["mean of all tokens, last layer", FE.artifact.summary.mean]];
    const x0 = 250, x1 = W - 30, lo = 0.84, hi = 0.93, X = v => x0 + (v - lo) / (hi - lo) * (x1 - x0), nT = FE.artifact.n_test || 7600;
    [0.85, 0.87, 0.89, 0.91].forEach(v => { s.appendChild(el("line", { x1: X(v), x2: X(v), y1: 14, y2: H - 30, stroke: css("--rule") })); txt(s, X(v), H - 14, v.toFixed(2), { fs: 12, color: css("--ink-3") }); });
    s.appendChild(el("line", { x1: X(DATA.tfidf.accuracy), x2: X(DATA.tfidf.accuracy), y1: 8, y2: H - 30, stroke: css("--bad"), "stroke-dasharray": "5 4", "stroke-width": 1.5 })); txt(s, X(DATA.tfidf.accuracy), H - 34, "TF-IDF " + DATA.tfidf.accuracy.toFixed(4), { fs: 12, color: css("--bad") });
    rows.forEach(([k, v], i) => { const y = 30 + i * 46, se = Math.sqrt(v * (1 - v) / nT);
      txt(s, x0 - 12, y + 5, k, { anchor: "end", fs: 13, color: css("--ink") });
      s.appendChild(el("rect", { x: x0, y: y - 9, width: X(v) - x0, height: 18, rx: 2, fill: css("--cls-0") }));
      s.appendChild(el("line", { x1: X(v - 2 * se), x2: X(v + 2 * se), y1: y, y2: y, stroke: css("--ink"), "stroke-width": 2 }));
      [v - 2 * se, v + 2 * se].forEach(w => s.appendChild(el("line", { x1: X(w), x2: X(w), y1: y - 6, y2: y + 6, stroke: css("--ink"), "stroke-width": 2 })));
      txt(s, X(v + 2 * se) + 8, y + 5, v.toFixed(4) + " ± " + (2 * se).toFixed(3), { anchor: "start", fs: 12.5, color: css("--ink-2") }); });
    host.appendChild(s);
  }
  draw(); REDRAW.push(draw);
})();

/* ---- 03 one H, three heads: where the Linear reads, what comes out, which axis the softmax runs along */
const HEAD_TOKS = ["[CLS]", "when", "?", "[SEP]", "founded", "in", "1992", "[SEP]"];
function figHeads(mode) {
  const host = $("#fig-heads"); host.innerHTML = ""; const W = 1000, H = 330, s = svg(W, H), L = HEAD_TOKS.length, rh = 28, y0 = 40, xH = 100, dCols = 7, dc = 26;
  const NOTE = {
    seq: `<strong>Sequence classification</strong> reads one row of <math><mi>H</mi></math> — position 0, <code>[CLS]</code> (the library reads it through the pooler) — and a <code>Linear(768, C)</code> turns it into <code>[B, C]</code>. The softmax runs <em>along the row</em>: which of the C classes is this text. The other L−1 vectors are computed and thrown away.`,
    tok: `<strong>Token classification</strong> applies the <em>same</em> <code>Linear(768, C)</code> to every row: <code>[B, L, C]</code>. The softmax runs along <em>each row separately</em>: which of the 9 tags is <em>this</em> token. L independent decisions; the loss is a cross-entropy per row, skipping the rows labelled −100.`,
    span: `<strong>Span extraction</strong> applies a <code>Linear(768, 2)</code> to every row — two numbers per token, a start score and an end score: <code>[B, L, 2]</code>. <code>unbind(-1)</code> splits the two <em>columns</em> apart, and each column is one softmax <em>down the positions</em>: which token starts the answer, which token ends it. That is why the output size is 2 and not 3: not "start / end / neither" per token, but two distributions over L.`,
  };
  txt(s, xH + dCols * dc / 2, 24, "H · [L, 768]", { fs: 13, bold: 1, color: css("--ink") });
  HEAD_TOKS.forEach((t, i) => { const y = y0 + i * rh, on = mode !== "seq" || i === 0;
    txt(s, xH - 10, y + rh / 2 + 4, t, { anchor: "end", fs: 12.5, color: on ? css("--ink") : css("--ink-3") });
    for (let j = 0; j < dCols; j++) s.appendChild(el("rect", { x: xH + j * dc, y: y + 3, width: dc - 3, height: rh - 6, rx: 2, fill: j === dCols - 1 ? "none" : on ? TINT("--cls-1", 16 + 10 * ((i * 3 + j) % 4)) : SUNK(), stroke: j === dCols - 1 ? "none" : on ? css("--cls-1") : css("--rule") }));
    txt(s, xH + (dCols - 1) * dc + dc / 2 - 2, y + rh / 2 + 5, "…", { fs: 13, color: css("--ink-3") }); });
  txt(s, xH + (dCols - 1) * dc / 2, y0 + L * rh + 18, "768 numbers per position", { fs: 11.5, color: css("--ink-3") });
  // the Linear
  const xL = xH + dCols * dc + 36, C = mode === "seq" ? 4 : mode === "tok" ? 9 : 2, lw = 130;
  const yMid = mode === "seq" ? y0 + rh / 2 : y0 + L * rh / 2;
  box(s, xL, yMid - 22, lw, 44, `Linear(768, ${C})`, { fill: TINT("--cls-2", 14), stroke: css("--cls-2"), fs: 13.5, bold: 1, grow: 1 });
  txt(s, xL + lw / 2, yMid + 38, mode === "seq" ? "once, on H[:, 0]" : "the same one at every position", { fs: 11.5, color: css("--ink-3") });
  if (mode === "seq") arrow(s, xH + dCols * dc, y0 + rh / 2, xL - 4, y0 + rh / 2, { color: css("--cls-2") });
  else HEAD_TOKS.forEach((_, i) => arrow(s, xH + dCols * dc, y0 + i * rh + rh / 2, xL - 4, y0 + i * rh + rh / 2, { color: css("--cls-2"), sw: 1 }));
  // the output grid, and the softmax axis
  const xO = xL + lw + 50, oc = mode === "tok" ? 40 : 56, rows = mode === "seq" ? 1 : L;
  const labelsC = mode === "seq" ? CLS : mode === "tok" ? TAGS : ["start", "end"];
  labelsC.forEach((c, j) => txt(s, xO + j * oc + oc / 2, y0 - 8, c, { fs: mode === "tok" ? 8.5 : 11.5, color: css("--ink-2") }));
  const ans = { seq: [[0, 1]], tok: { 4: 0, 5: 0, 6: 0, 1: 0, 2: 0 }, span: [6, 6] }[mode];
  for (let i = 0; i < rows; i++) for (let j = 0; j < C; j++) {
    const hot = mode === "seq" ? j === 1 : mode === "tok" ? (i === 0 || i === 3 || i === 7 ? false : j === 0) : (j === 0 ? i === ans[0] : i === ans[1]);
    const dead = mode === "tok" && (i === 0 || i === 3 || i === 7);
    s.appendChild(el("rect", { x: xO + j * oc, y: y0 + i * rh + 3, width: oc - 3, height: rh - 6, rx: 2, fill: hot ? TINT("--good", 40) : dead ? SUNK() : TINT("--cls-0", 12), stroke: hot ? css("--good") : dead ? css("--rule") : css("--cls-0"), "stroke-dasharray": dead ? "3 3" : "none" }));
    if (dead && j === 0) txt(s, xO + C * oc + 8, y0 + i * rh + rh / 2 + 4, "−100 · skipped", { anchor: "start", fs: 10.5, color: css("--ink-3") });
  }
  const gw = C * oc;
  if (mode === "seq") { arrow(s, xO, y0 + rh + 22, xO + gw - 3, y0 + rh + 22, { color: css("--ink") }); txt(s, xO + gw / 2, y0 + rh + 44, "softmax along the row · over the C classes · [B, C]", { fs: 12.5, color: css("--ink"), bold: 1 }); }
  else if (mode === "tok") { for (let i = 0; i < rows; i++) if (!(i === 0 || i === 3 || i === 7)) arrow(s, xO + gw + 8, y0 + i * rh + rh / 2, xO + gw + 8 + 44, y0 + i * rh + rh / 2, { color: css("--ink"), sw: 1.2 }); txt(s, xO + gw / 2 + 30, y0 + L * rh + 22, "softmax along each row · over the 9 tags · [B, L, 9]", { fs: 12.5, color: css("--ink"), bold: 1 }); }
  else {
    txt(s, xO + gw / 2, y0 - 26, "[B, L, 2] → unbind(-1) → two [B, L]", { fs: 12, color: css("--ink-3") });
    [0, 1].forEach(j => { const x = xO + j * oc + oc / 2 - 1; arrow(s, x, y0 + L * rh + 6, x, y0 + L * rh + 40, { color: css("--ink") }); });
    txt(s, xO + gw / 2, y0 + L * rh + 60, "softmax down each column · over the L positions · twice", { fs: 12.5, color: css("--ink"), bold: 1 });
    txt(s, xO + gw + 14, y0 + ans[0] * rh + rh / 2 + 4, "← start = end = '1992'", { anchor: "start", fs: 12, color: css("--good") });
  }
  host.appendChild(s); $("#fig-heads-note").innerHTML = NOTE[mode];
}
const setHeads = states("fig-heads-btns", figHeads);
codeF("#code-heads", `class SequenceHead(nn.Module):        # [B, L, d] -> [B, C].  One vector per text — the [CLS] position — then one Linear.
    def __init__(self, d, n_classes):    # Softmax (inside the loss) runs over C: "which class is this text".
        self.linear = nn.Linear(d, n_classes)
    def forward(self, H):
        return self.linear(H[:, 0])                            # [B, d] -> [B, C]

class TokenHead(nn.Module):           # [B, L, d] -> [B, L, C].  The same Linear at every position.
    def __init__(self, d, n_classes):    # Softmax runs over C, separately at each position: "which tag is this token".
        self.linear = nn.Linear(d, n_classes)
    def forward(self, H):
        return self.linear(H)                                  # [B, L, d] -> [B, L, C]

class SpanHead(nn.Module):            # [B, L, d] -> two [B, L].  A Linear with two outputs at every position:
    def __init__(self, d):               # a start score and an end score. Softmax runs over L — over positions.
        self.linear = nn.Linear(d, 2)
    def forward(self, H):
        start, end = self.linear(H).unbind(-1)                 # [B, L, 2] -> [B, L], [B, L]
        return start, end

def sequence_loss(logits, labels):
    return F.cross_entropy(logits, labels)                                   # normalises over the last axis: C
def token_loss(logits, labels):
    return F.cross_entropy(logits.flatten(0, 1), labels.flatten(), ignore_index=IGNORE)   # over C, at every kept position
def span_loss(scores, labels):
    start, end = scores                                                      # each [B, L]
    return (F.cross_entropy(start, labels[:, 0]) + F.cross_entropy(end, labels[:, 1])) / 2   # over L: "classes" = positions`,
  l => /Sequence|H\[:, 0\]|sequence_loss|last axis: C/.test(l) ? "seq" : /TokenHead|which tag|\[B, L, C\]|token_loss|ignore_index/.test(l) ? "tok" : /SpanHead|start|end|span_loss|positions/.test(l) ? "span" : null, setHeads);
code("#code-lib", `# transformers.models.bert.modeling_bert — the three classes, one Linear each (inspect.getsource, trimmed)
class BertForSequenceClassification:
    self.bert = BertModel(config)
    self.classifier = nn.Linear(config.hidden_size, config.num_labels)
    pooled_output = outputs[1]                                   # the pooler: tanh(W h[CLS] + b)
    logits = self.classifier(pooled_output)                      # [B, C]

class BertForTokenClassification:
    self.bert = BertModel(config, add_pooling_layer=False)
    self.classifier = nn.Linear(config.hidden_size, config.num_labels)
    sequence_output = outputs[0]                                 # H, [B, L, d]
    logits = self.classifier(sequence_output)                    # [B, L, C]

class BertForQuestionAnswering:
    self.bert = BertModel(config, add_pooling_layer=False)
    self.qa_outputs = nn.Linear(config.hidden_size, config.num_labels)      # num_labels = 2
    logits = self.qa_outputs(sequence_output)                    # [B, L, 2]
    start_logits, end_logits = logits.split(1, dim=-1)           # two [B, L, 1]
    start_logits = start_logits.squeeze(-1).contiguous()         # [B, L] — CrossEntropyLoss over L, twice
    end_logits = end_logits.squeeze(-1).contiguous()`);
code("#code-recipe", `model = AutoModelForSequenceClassification.from_pretrained("bert-base-uncased", num_labels=4)
#       AutoModelForTokenClassification (num_labels=9)  |  AutoModelForQuestionAnswering  — same body, another Linear
set_trainable(model, top_blocks=0)                    # the dial, block 04

args = TrainingArguments(output_dir=..., per_device_train_batch_size=32, num_train_epochs=2, learning_rate=lr,
                         weight_decay=0.01, warmup_steps=0.1, lr_scheduler_type="linear",   # BERT's fine-tuning recipe
                         eval_strategy="epoch", logging_strategy="epoch", save_strategy="no", report_to=[])
trainer = Trainer(model=model, args=args, train_dataset=train_ds, eval_dataset=eval_ds,
                  data_collator=DataCollatorWithPadding(tokenizer), compute_metrics=accuracy_metric)
trainer.train()                                       # curves come back in trainer.state.log_history`);

/* ---- 04 the dial knob: what moves, and — after the reveal — what it measured */
let DIAL_REVEALED = false;
(function knob() {
  const KEYS = TRN, LAB = { "head only": "0", "top 2 blocks": "2", "top 6 blocks": "6", "everything": "all" }; let cur = KEYS[0];
  $("#dial-knob").innerHTML = KEYS.map((k, i) => `<button data-k="${k}" class="${i === 0 ? "sel" : ""}">k = ${LAB[k]}</button>`).join("");
  function draw(k) {
    cur = k; const r = TR.runs[k], top = r.top_blocks === "all" ? 12 : r.top_blocks, all = r.top_blocks === "all";
    $("#dial-knob-stats").innerHTML = `<div class="stat-row">${stat(num(r.trainable_params), "trainable")}${stat(pct(r.trainable_params / r.total_params, 1), "of the model")}${stat(r.lr, "lr")}</div>` +
      (DIAL_REVEALED ? `<div class="stat-row" style="margin-top:12px">${stat(fmt(last(r.accuracy), 4), "test accuracy")}${stat(num(Math.round(last(r.seconds))) + " s", "the bill · " + r.epoch.length + " epochs")}${stat((100 * (last(r.accuracy) - DATA.tfidf.accuracy)).toFixed(1), "pts vs TF-IDF")}</div>` : "");
    const host = $("#dial-knob-fig"); host.innerHTML = ""; const s = svg(620, 330); const x = 40, w = 540;
    const cell = (y, h, label, on) => box(s, x, y, w, h, label, { fill: on ? TINT("--cls-1", 22) : SUNK(), stroke: on ? css("--cls-1") : css("--rule-strong"), color: on ? css("--ink") : css("--ink-3"), fs: 12.5 });
    cell(8, 26, "head · Linear(768, 4) · 3 076", true); cell(40, 22, "pooler · 0.6M", top > 0);
    for (let b = 11; b >= 0; b--) cell(70 + (11 - b) * 18, 15, `block ${b + 1} · 7.1M`, b >= 12 - top);
    cell(292, 26, "embeddings · 23.8M", all);
    host.appendChild(s);
    if (DIAL_REVEALED) { DIAL_HL = k; drawDialChart(); }
  }
  draw(KEYS[0]); REDRAW.push(() => draw(cur));
  $("#dial-knob").addEventListener("click", e => { const b = e.target.closest("button[data-k]"); if (!b) return; $$("#dial-knob button").forEach(x => x.classList.toggle("sel", x === b)); draw(b.dataset.k); });
  document.addEventListener("revealed", e => { if (e.detail === "btn-dial-reveal") { DIAL_REVEALED = true; draw(cur); } });
  code("#code-dial", `def set_trainable(model, top_blocks):          # 0 = head only · k = top k blocks · "all"
    body = model.base_model                       # whatever AutoModelFor* wrapped: model.bert
    for p in body.parameters():
        p.requires_grad = top_blocks == "all"
    if top_blocks != "all" and top_blocks > 0:
        for block in body.encoder.layer[-top_blocks:]:
            for p in block.parameters():
                p.requires_grad = True
        for p in body.pooler.parameters():        # above the last block: moves whenever any block does
            p.requires_grad = True`);
})();

/* ---- the scoreboard in the rail, and the sortable results table at the end */
(function scoreboard() {
  const rows = RES.map((r, i) => ({ i, r }));
  const gate = r => /week 1/.test(r.model) ? "line" : /zero-shot/.test(r.model) ? "btn-zs-reveal" : /logreg/.test(r.model) ? "btn-probe-reveal" : /fine-tune/.test(r.model) ? "btn-dial-reveal" : null;   // null: a live cell, visible from the start
  const on = new Set();
  const parseP = v => v === "—" || v == null ? 0 : /M$/.test(v) ? 1e6 * parseFloat(v) : parseFloat(String(v).replace(/,/g, ""));
  const short = m => m.replace("TF-IDF + logreg (week 1)", "TF-IDF, week 1").replace(/^zero-shot MLM, .*/, "zero-shot, politics/…").replace("frozen ", "").replace(" + logreg", " + logreg").replace(/^fine-tune: /, "dial · ").replace(/ \(.*\)$/, " (live)");
  function drawBoard() {
    $("#score").innerHTML = `<div class="t">AG News · test acc</div>` + rows.map(({ r }) => { const g = gate(r), vis = g === null || g === "line" || on.has(g);
      return `<div class="row ${g === "line" ? "line" : vis ? "on" : "off"} ${vis && g !== "line" && r["test acc"] >= DATA.tfidf.accuracy ? "pass" : ""}"><span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(short(r.model))}</span><span class="v">${vis ? fmt(r["test acc"], 4) : "·"}</span></div>`; }).join("");
  }
  let sortBy = "order";
  function drawTable() {
    const rs = rows.slice();
    if (sortBy === "acc") rs.sort((a, b) => b.r["test acc"] - a.r["test acc"]); else if (sortBy === "params") rs.sort((a, b) => parseP(a.r["trainable params"]) - parseP(b.r["trainable params"])); else if (sortBy === "s") rs.sort((a, b) => (a.r["train s"] || 0) - (b.r["train s"] || 0));
    table($("#results-1"), RES_COLS, rs.map(({ i, r }) => Object.assign({ _hl: i === 0 }, r)));
  }
  drawBoard(); drawTable();
  document.addEventListener("revealed", e => { on.add(e.detail); drawBoard(); });
  $("#res-sort").addEventListener("click", e => { const b = e.target.closest("button[data-s]"); if (!b) return; sortBy = b.dataset.s; $$("#res-sort button").forEach(x => x.classList.toggle("sel", x === b)); drawTable(); });
})();

/* ---- 05 NER: word → tokens → label, four shapes on one picture; the batch after the collator */
const NER_PICK = [0, 1, 7, 8, 13, 14, 15, 16, 23, 24, 25, 38];      // [CLS] germany · european union · werner z ##wing ##mann · sheep ##me ##at · [SEP]
function figNer(mode) {
  const E = NER.example, host = $("#fig-ner"); host.innerHTML = ""; const W = 1000, H = 400, s = svg(W, H), n = NER_PICK.length, x0 = 64, cw = (W - x0 - 16) / n, X = i => x0 + cw * (i + 0.5);
  const labels = mode === "label" ? E.labelsCont : E.labels;
  const groups = [[1, 1, "1 word · 1 token"], [2, 3, "2 words · 2 tokens"], [4, 7, "2 words · 4 tokens"], [8, 10, "1 word · 3 tokens · not an entity"]];
  groups.forEach(([a, b, t], gi) => { s.appendChild(el("line", { x1: X(a) - cw / 2 + 6, x2: X(b) + cw / 2 - 6, y1: 378, y2: 378, stroke: css("--rule-strong") }));
    const anchor = gi === 0 ? "end" : gi === 1 ? "start" : "middle", x = gi === 0 ? X(b) + cw / 2 - 6 : gi === 1 ? X(a) - cw / 2 + 6 : (X(a) + X(b)) / 2; txt(s, x, 394, t, { fs: 11, color: css("--ink-3"), anchor }); });
  NER_PICK.forEach((ti, i) => {
    const t = E.tokens[ti], wid = E.wordIds[ti], sp = wid === null, first = !sp && (i === 0 || E.wordIds[NER_PICK[i - 1]] !== wid), lab = labels[ti];
    // the word, once per word
    if (first) { let j = i; while (j + 1 < n && E.wordIds[NER_PICK[j + 1]] === wid) j++; box(s, X(i) - cw / 2 + 4, 330, X(j) - X(i) + cw - 8, 28, E.words[wid], { fill: css("--panel"), fs: 12.5, bold: E.tags[wid] > 0 }); }
    // the token
    box(s, X(i) - cw / 2 + 4, 272, cw - 8, 28, t, { fill: sp ? SUNK() : t.startsWith("##") ? TINT("--cls-1", 12) : css("--panel"), stroke: t.startsWith("##") ? css("--cls-1") : css("--rule-strong"), fs: 12, bold: sp });
    if (first) s.appendChild(el("line", { x1: X(i), x2: X(i), y1: 330, y2: 300, stroke: css("--ink-3") }));
    txt(s, X(i), 262, sp ? "None" : "word " + wid, { fs: 10.5, color: css("--ink-3") });
    // the label
    const ign = lab === -100;
    box(s, X(i) - cw / 2 + 4, 212, cw - 8, 28, ign ? "−100" : TAGS[lab], { fill: ign ? SUNK() : lab ? TINT("--good", 22) : TINT("--cls-0", 10), stroke: ign ? css("--rule-strong") : lab ? css("--good") : css("--cls-0"), fs: 12, bold: !ign, color: ign ? css("--ink-3") : css("--ink") });
    // h, the Linear, the 9-cell row
    box(s, X(i) - cw / 2 + 8, 150, cw - 16, 26, "h", { fill: TINT("--cls-1", 18), fs: 12 });
    s.appendChild(el("line", { x1: X(i), x2: X(i), y1: 272, y2: 176, stroke: css("--ink-3"), "stroke-dasharray": "3 3" }));
    arrow(s, X(i), 150, X(i), 118, { color: ign ? css("--ink-3") : css("--good"), dash: ign });
    const cells = 9, cwid = Math.min(8, (cw - 12) / cells);
    for (let c = 0; c < cells; c++) s.appendChild(el("rect", { x: X(i) - cells * cwid / 2 + c * cwid, y: 92, width: cwid - 1, height: 22, rx: 1, fill: ign ? SUNK() : c === lab ? TINT("--good", 55) : TINT("--cls-0", 12), stroke: "none" }));
    txt(s, X(i), 84, ign ? "no loss" : "CE vs " + TAGS[lab], { fs: 9.5, color: ign ? css("--ink-3") : css("--ink-2") });
  });
  txt(s, x0 - 30, 44, "one Linear(768, 9) per position → 9 scores · softmax along the row · cross-entropy only where the label ≠ −100", { anchor: "start", fs: 12.5, color: css("--ink") });
  txt(s, x0 - 30, 64, mode === "label" ? "continuations carry the word's tag: ##wing ##mann become I-PER — and get a loss, like a new token of the entity" : "continuations get −100: the head reads the first piece of a word, the rest is skipped", { anchor: "start", fs: 12, color: css("--ink-3") });
  [[348, "words"], [292, "tokens"], [262, "word_ids"], [232, "labels"], [168, "H"], [108, "scores"]].forEach(([y, t]) => txt(s, x0 - 6, y, t, { anchor: "end", fs: 10.5, color: css("--ink-3") }));
  host.appendChild(s);
  const NA_ = NER.artifact.runs, dF1 = last(NA_["head only, continuations labelled"].entity_f1) - last(NA_["head only"].entity_f1);
  $("#fig-ner-note").innerHTML = mode === "label"
    ? `<strong>Labelled continuations, measured:</strong> the same head, body and data give entity F1 ${fmt(last(NA_["head only, continuations labelled"].entity_f1), 3)} against ${fmt(last(NA_["head only"].entity_f1), 3)} with −100 — ${(100 * dF1).toFixed(1)} points. The extra labels aren't extra information — they're the same tag repeated, and a <code>B-</code> on a continuation reads as a new entity to anything that reads BIO.`
    : `<code>word_ids()</code> from the fast tokenizer says which word every token came from — <code>None</code> for the specials, the same id repeated for <code>z ##wing ##mann</code>. The first token of a word carries the word's tag; the continuations get −100 and the cross-entropy skips them. <em>sheepmeat</em> shows the same rule on an <code>O</code> word: three tokens, one label, two skips. The 9-cell row above each token is the head's output there; the green cell is the target.`;
}
states("fig-ner-btns", figNer);
/* the batch after a collator: rows of a padded tensor, the padding coloured */
function figCollator(host, spec) {
  const h = $(host); h.innerHTML = ""; const n = spec.rows[0].cells.length, W = 1000, rowH = 24, gap = 6, labW = 120, x0 = labW + 10, cw = (W - x0 - 10) / n;
  const groups = spec.groups; const H = 30 + groups.reduce((a, g) => a + g.rows.length * rowH + 22, 0);
  const s = svg(W, H); let y = 18;
  groups.forEach(g => {
    txt(s, x0, y, g.title, { anchor: "start", fs: 11.5, color: css("--ink-3") }); y += 8;
    g.rows.forEach(r => {
      txt(s, labW, y + rowH / 2 + 4, r.name, { anchor: "end", fs: 11.5, color: css("--ink-2") });
      r.cells.forEach((c, i) => { const pad = r.pad[i], t = String(c), rect = el("rect", { x: x0 + i * cw + 1, y: y + 2, width: cw - 2, height: rowH - 4, rx: 2, fill: pad ? TINT("--bad", 14) : r.fill ? r.fill(c, i) : css("--panel"), stroke: pad ? css("--bad") : css("--rule"), "stroke-dasharray": pad ? "3 3" : "none" }); s.appendChild(rect);
        const lab = t.length > 6 && cw < 60 ? t.slice(0, 5) + "…" : t; const tx = txt(s, x0 + i * cw + cw / 2, y + rowH / 2 + 4, lab, { fs: cw < 40 ? 9 : 10.5, color: pad ? css("--bad") : r.strike && r.strike(c, i) ? css("--ink-3") : css("--ink") });
        if (r.strike && r.strike(c, i) && !pad) s.appendChild(el("line", { x1: x0 + i * cw + 4, x2: x0 + i * cw + cw - 4, y1: y + rowH / 2, y2: y + rowH / 2, stroke: css("--ink-3"), "stroke-width": 1.2 }));
        if (t.length > 6) tipOn(rect, esc(t)); });
      y += rowH;
    });
    y += 14;
  });
  h.appendChild(s);
}
(function collators() {
  const C = NER.collator;
  if (C) {
    const n = C.tokens[0].length;
    const rowsFor = (i) => { const len = C.lengths[i], padAt = j => j >= len;
      return [{ name: `input_ids · ${i + 1}`, cells: C.tokens[i], pad: C.tokens[i].map((_, j) => padAt(j)), fill: (c) => /^\[/.test(c) ? SUNK() : css("--panel") },
              { name: "attention_mask", cells: C.attention_mask[i], pad: C.attention_mask[i].map((_, j) => padAt(j)) },
              { name: "labels", cells: C.labels[i].map(l => l === -100 ? "−100" : TAGS[l]), pad: C.labels[i].map((_, j) => padAt(j)), strike: c => c === "−100", fill: c => c === "−100" ? SUNK() : c === "O" ? TINT("--cls-0", 8) : TINT("--good", 20) }]; };
    figCollator("#fig-coll-ner", { rows: rowsFor(0), groups: C.tokens.map((_, i) => ({ title: `sentence ${i + 1} · ${C.lengths[i]} tokens${C.lengths[i] < n ? ` + ${n - C.lengths[i]} padding` : " — the longest, sets the width"}`, rows: rowsFor(i) })) });
    $("#coll-ner-stats").textContent = `batch of ${C.tokens.length} · padded to ${n} · loss at ${C.labels.flat().filter(l => l !== -100).length} of ${C.tokens.length * n} positions`;
  }
  const Q = QA.collator;
  if (Q) {
    const n = Q.tokens[0].length;
    const rowsFor = i => { const len = Q.lengths[i], padAt = j => j >= len, sp = Q.start_positions[i], ep = Q.end_positions[i];
      return [{ name: `input_ids · ${i + 1}`, cells: Q.tokens[i], pad: Q.tokens[i].map((_, j) => padAt(j)), fill: (c, j) => j >= sp && j <= ep && sp > 0 ? TINT("--good", 30) : /^\[/.test(c) ? SUNK() : Q.token_type_ids[i][j] ? TINT("--cls-2", 10) : TINT("--cls-0", 8) },
              { name: "token_type_ids", cells: Q.token_type_ids[i], pad: Q.token_type_ids[i].map((_, j) => padAt(j)), fill: c => c ? TINT("--cls-2", 18) : TINT("--cls-0", 14) },
              { name: "attention_mask", cells: Q.attention_mask[i], pad: Q.attention_mask[i].map((_, j) => padAt(j)) }]; };
    figCollator("#fig-coll-qa", { rows: rowsFor(0), groups: Q.tokens.map((_, i) => ({ title: `"${Q.questions[i]}" · ${Q.lengths[i]} tokens${Q.lengths[i] < n ? ` + ${n - Q.lengths[i]} padding` : ""} · start_positions = ${Q.start_positions[i]}, end_positions = ${Q.end_positions[i]} — two integers, nothing to pad`, rows: rowsFor(i) })) });
    $("#coll-qa-stats").textContent = `batch of ${Q.tokens.length} · padded to ${n} · segment 0 = question, 1 = context`;
  }
})();
code("#code-ner", `enc = tokenizer(batch["tokens"], is_split_into_words=True, truncation=True, max_length=160)
for word_id in enc.word_ids(i):                      # None for [CLS]/[SEP]; the same id for z ##wing ##mann
    if word_id is None:            labels.append(IGNORE)                 # IGNORE = -100
    elif word_id != previous:      labels.append(tags[word_id])          # first token of a word: the word's tag
    else:                          labels.append(IGNORE)                 # a continuation (or tags[word_id], measured above)
    previous = word_id

ner_collator = DataCollatorForTokenClassification(tokenizer)   # pads input_ids with [PAD], attention_mask with 0, labels with -100
loss = F.cross_entropy(logits.flatten(0, 1), labels.flatten(), ignore_index=-100)   # PyTorch's default — the reason for the number
ner_model = AutoModelForTokenClassification.from_pretrained(MODEL_NAME, num_labels=9)
seqeval = evaluate.load("seqeval")                             # entity-level F1: type AND both boundaries`);
code("#code-qa", `enc = tokenizer(questions, contexts, truncation="only_second", max_length=384, stride=128,
                return_overflowing_tokens=True, return_offsets_mapping=True)     # windows + character offsets
seq_ids = enc.sequence_ids(i)                                    # None = special, 0 = question, 1 = context
context_tokens = [k for k, s in enumerate(seq_ids) if s == 1]
start = next(k for k in context_tokens if offsets[k][1] > answer_start)             # first token that ends after the answer starts
end = next(k for k in reversed(context_tokens) if offsets[k][0] < answer_end)       # last token that starts before it ends
# ... or (0, 0) — the [CLS] position — when the answer is not inside this window

collator = DataCollatorWithPadding(tokenizer)                    # start_positions / end_positions are scalars: nothing to pad
qa_model = AutoModelForQuestionAnswering.from_pretrained(MODEL_NAME)                 # Linear(768, 2) → start / end
best_span(start_scores, end_scores, offsets, max_answer_tokens=30)                   # best pair with start <= end, both in the context`);

/* ---- 05 NER predictions: the fine-tuned model against the head-only one, on the same sentences */
(function nerPreds() {
  const S = NER.predictions.sentences, has = S[0].predHeadOnly;
  if (!has) $("#ner-preds-btns").hidden = true;
  function ents(words, tags, other, gold) {
    let out = "", i = 0; while (i < words.length) { const t = tags[i]; const dis = other && other[i] !== t;
      if (t === "O") { out += `<span class="${dis ? "ent wrong" : ""}" style="${dis ? "padding:2px 4px" : ""}">${esc(words[i])}</span> `; i++; continue; }
      const type = t.slice(2); let j = i + 1; while (j < words.length && tags[j] === "I-" + type) j++;
      const wrongAny = other && words.slice(i, j).some((_, k) => other[i + k] !== tags[i + k]);
      out += `<span class="ent ${type} ${wrongAny ? "wrong" : ""}">${esc(words.slice(i, j).join(" "))}<i>${type}</i></span> `; i = j; }
    return out;
  }
  function draw(mode) {
    const other = mode === "pred" ? "predHeadOnly" : "pred";
    $("#ner-preds").innerHTML = S.map(s => { const hasGold = s.gold && s.gold.some(g => g !== "O");
      return `<p class="ent-line">${ents(s.words, s[mode], has ? s[other] : null)}</p>` + (hasGold ? `<p class="ent-line" style="font-size:14px;line-height:1.9;margin:-6px 0 10px;color:var(--ink-3)"><span class="lab" style="font-family:var(--mono);font-size:11px;letter-spacing:.08em;text-transform:uppercase;margin-right:8px">gold</span>${ents(s.words, s.gold)}</p>` : ""); }).join("");
  }
  draw("pred");
  $("#ner-preds-btns").addEventListener("click", e => { const b = e.target.closest("button[data-m]"); if (!b) return; $$("#ner-preds-btns button").forEach(x => x.classList.toggle("sel", x === b)); draw(b.dataset.m); });
})();

/* ---- 05 QA: two score rows over the tokens of a window, from the fine-tuned model */
(function figQa() {
  const EX = QA.predictions.examples, has = EX.some(e => e.scores);
  const host = $("#fig-qa");
  if (!has) {                                                    // the artifact predates the score rows: the schematic, and a note
    const draw = () => { host.innerHTML = ""; const W = 900, H = 230, s = svg(W, H), toks = ["[CLS]", "when", "?", "[SEP]", "founded", "in", "1992", ".", "[SEP]"], n = toks.length, x0 = 40, cw = (W - 2 * x0) / n, X = i => x0 + cw * (i + 0.5);
      toks.forEach((t, i) => { const ctx = i >= 4 && i <= 7; box(s, X(i) - cw / 2 + 5, 180, cw - 10, 30, t, { fill: /^\[/.test(t) ? SUNK() : ctx ? TINT("--cls-2", 10) : TINT("--cls-0", 8), fs: 13, bold: /^\[/.test(t) });
        box(s, X(i) - cw / 2 + 8, 118, cw - 16, 30, "h" + i, { fill: TINT("--cls-1", 18), fs: 12.5 }); s.appendChild(el("line", { x1: X(i), x2: X(i), y1: 180, y2: 148, stroke: css("--ink-3") }));
        const hs = i === 6 ? 62 : ctx ? 14 + 8 * ((i * 7) % 3) : 4, he = i === 6 ? 58 : ctx ? 10 + 8 * ((i * 5) % 3) : 4;
        s.appendChild(el("rect", { x: X(i) - 14, y: 100 - hs, width: 12, height: hs, fill: css("--cls-2"), rx: 1 })); s.appendChild(el("rect", { x: X(i) + 2, y: 100 - he, width: 12, height: he, fill: css("--cls-3"), rx: 1 })); });
      txt(s, W / 2, 20, "start scores (green), end scores (purple) at every position · softmax over the positions, twice", { fs: 12.5 });
      txt(s, W / 2, H - 6, "schematic — the measured rows appear after precompute.py --only qa", { fs: 11, color: css("--ink-3") });
      host.appendChild(s); };
    draw(); REDRAW.push(draw); $("#qa-pick").innerHTML = ""; return;
  }
  const softmax = a => { const m = Math.max(...a), e = a.map(v => Math.exp(v - m)), z = e.reduce((x, y) => x + y, 0); return e.map(v => v / z); };
  function bestSpan(st, en, ctxMask, maxLen) {                    // the notebook's best_span: top-20 starts × top-20 ends, start <= end, both in the context
    const idx = a => a.map((v, i) => [v, i]).sort((x, y) => y[0] - x[0]).slice(0, 20).map(p => p[1]); let best = -1e9, span = null;
    for (const a of idx(st)) for (const b of idx(en)) { if (!ctxMask[a] || !ctxMask[b] || b < a || b - a + 1 > maxLen) continue; if (st[a] + en[b] > best) { best = st[a] + en[b]; span = [a, b]; } }
    return span;
  }
  let cur = 0;
  $("#qa-pick").innerHTML = EX.map((e, i) => `<button data-m="${i}" class="${i === 0 ? "sel" : ""} ${QA_NO_ANSWER(e.question) ? "noans" : ""}" title="${esc(e.question)}">${i + 1}</button>`).join("");
  function draw() {
    const e = EX[cur], sc = e.scores, toks = sc.tokens, n = toks.length, ctx = sc.offsets.map(o => o !== null), ps = softmax(sc.start), pe = softmax(sc.end), span = bestSpan(sc.start, sc.end, ctx, 30);
    host.innerHTML = ""; const W = 1000, dense = n > 70, H = dense ? 250 : 330, s = svg(W, H), x0 = 60, cw = (W - x0 - 20) / n, X = i => x0 + cw * (i + 0.5), barH = 70;
    const yS = 20 + barH, yE = yS + barH + 16, yT = yE + 24;
    txt(s, x0 - 8, yS - barH / 2, "start", { anchor: "end", fs: 12, color: css("--cls-2"), bold: 1 }); txt(s, x0 - 8, yE - barH / 2, "end", { anchor: "end", fs: 12, color: css("--cls-3"), bold: 1 });
    [[ps, yS, "--cls-2"], [pe, yE, "--cls-3"]].forEach(([p, y, c]) => { const mx = Math.max(...p); s.appendChild(el("line", { x1: x0, x2: W - 20, y1: y, y2: y, stroke: css("--rule-strong") }));
      p.forEach((v, i) => { const hgt = Math.max(1, v / mx * barH), r = el("rect", { x: x0 + i * cw + (dense ? 0 : 1), y: y - hgt, width: Math.max(1, cw - (dense ? 0 : 2)), height: hgt, fill: ctx[i] ? css(c) : css("--ink-3"), opacity: ctx[i] ? 1 : .45 }); tipOn(r, `${esc(toks[i])}<br>start ${ps[i].toFixed(3)} · end ${pe[i].toFixed(3)}`); s.appendChild(r); }); });
    if (!dense) toks.forEach((t, i) => { const inSpan = span && i >= span[0] && i <= span[1]; const g = el("g", { transform: `translate(${X(i)} ${yT + 8}) rotate(-60)` }); g.appendChild(el("text", { x: 0, y: 0, "font-size": 10.5, "text-anchor": "end", fill: inSpan ? css("--good") : ctx[i] ? css("--ink") : css("--ink-3"), "font-weight": inSpan ? "600" : "400" }, t)); s.appendChild(g); });
    if (span) { s.appendChild(el("rect", { x: x0 + span[0] * cw, y: yE + 4, width: (span[1] - span[0] + 1) * cw, height: 6, rx: 2, fill: css("--good") })); }
    const argS = ps.indexOf(Math.max(...ps)), argE = pe.indexOf(Math.max(...pe));
    const ctxStart = ctx.indexOf(true); s.appendChild(el("line", { x1: x0 + ctxStart * cw, x2: x0 + ctxStart * cw, y1: 10, y2: yE + 12, stroke: css("--ink-3"), "stroke-dasharray": "3 3" })); txt(s, x0 + ctxStart * cw - 4, 12, "question ·", { anchor: "end", fs: 10.5, color: css("--ink-3") }); txt(s, x0 + ctxStart * cw + 4, 12, "· context", { anchor: "start", fs: 10.5, color: css("--ink-3") });
    host.appendChild(s);
    const spanText = span ? toks.slice(span[0], span[1] + 1).join(" ").replace(/ ##/g, "") : "—";
    $("#fig-qa-note").innerHTML = `<b>${esc(e.question)}</b> · ${sc.windows > 1 ? `window 1 of ${sc.windows} · ` : ""}argmax start <b>${esc(toks[argS])}</b> (${ps[argS].toFixed(2)}), argmax end <b>${esc(toks[argE])}</b> (${pe[argE].toFixed(2)}) → <code>best_span</code>: <b>${esc(spanText)}</b>${e.pred ? ` · decoded from the offsets: <b>${esc(e.pred)}</b>` : ""}${e.gold && e.gold[0] ? ` · gold: ${esc(e.gold[0])}` : QA_NO_ANSWER(e.question) ? ` · <span style="color:var(--bad)">the answer is not in the paragraph — and the two rows still have peaks</span>` : ""}. Grey bars: question and special positions, excluded by <code>best_span</code>. Each row is its own softmax over the positions.`;
  }
  draw(); REDRAW.push(draw);
  $("#qa-pick").addEventListener("click", ev => { const b = ev.target.closest("button[data-m]"); if (!b) return; cur = +b.dataset.m; $$("#qa-pick button").forEach(x => x.classList.toggle("sel", x === b)); draw(); });
})();
