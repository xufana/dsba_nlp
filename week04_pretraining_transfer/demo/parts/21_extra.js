/* ====================================================== extra interactives */
const code = (host, text) => { $(host).innerHTML = text.split("\n").map(l => `<span class="ln">${esc(l)}</span>`).join(""); };

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

/* ---- 02 BERT schematic after Alammar, with the head switch */
(function figBert() {
  const NOTE = {
    pre: "Pretraining: two sentences in, <code>[CLS] A [SEP] B [SEP]</code>. The MLM head reads the vectors at the <em>masked</em> positions and predicts the original token over the 30 522-word vocabulary; the NSP head reads <code>[CLS]</code> through the pooler and says whether B followed A. Nothing else gets a gradient — which is why <code>[CLS]</code> means anything at all.",
    cls: "Sequence classification: one vector, <code>H[:, 0]</code>, through the pooler and one Linear to <code>[B, C]</code>. Softmax over the C classes, one cross-entropy per text. The other L−1 vectors are computed and thrown away.",
    ner: "Token classification: the <em>same</em> Linear at <em>every</em> position, <code>[B, L, C]</code>. Softmax over the C tags at each position; cross-entropy at every token whose label is not −100 (specials, padding, word continuations are skipped).",
    qa: "Span extraction: a <code>Linear(d, 2)</code> at every position gives a start score and an end score per token — two <code>[B, L]</code> rows. Softmax over the L <em>positions</em>, twice; the answer is the best (start ≤ end) pair inside the context.",
  };
  const toks = ["[CLS]", "the", "cat", "[MASK]", "on", "[SEP]", "it", "was", "warm", "[SEP]"];
  function draw(mode) {
    const host = $("#fig-bert"); host.innerHTML = ""; const W = 1000, H = 400, s = svg(W, H); const n = toks.length, x0 = 70, cw = (W - 2 * x0) / n;
    const X = i => x0 + cw * (i + 0.5);
    const isQ = i => mode === "qa" && i >= 1 && i <= 4, isC = i => mode === "qa" && i >= 6 && i <= 8;
    toks.forEach((t, i) => { const sp = /^\[/.test(t), mk = t === "[MASK]";
      box(s, X(i) - cw / 2 + 5, 330, cw - 10, 32, mode === "pre" ? t : (t === "[MASK]" ? "sat" : t), { fill: mk && mode === "pre" ? "color-mix(in srgb, var(--cls-3) 25%, var(--panel))" : sp ? css("--panel-sunk") : isQ(i) ? "color-mix(in srgb, var(--cls-0) 12%, var(--panel))" : isC(i) ? "color-mix(in srgb, var(--cls-2) 12%, var(--panel))" : css("--panel"), fs: 13.5, bold: sp });
      s.appendChild(el("line", { x1: X(i), x2: X(i), y1: 330, y2: 262, stroke: css("--ink-3"), "stroke-width": 1.2 }));
      s.appendChild(el("line", { x1: X(i), x2: X(i), y1: 188, y2: 150, stroke: css("--ink-3"), "stroke-width": 1.2 }));
    });
    txt(s, 36, 351, "tokens", { anchor: "end", fs: 12.5 });
    if (mode === "qa") { txt(s, X(2.5), 385, "segment 0 · question", { fs: 12.5, color: css("--cls-0") }); txt(s, X(7), 385, "segment 1 · context", { fs: 12.5, color: css("--cls-2") }); }
    else txt(s, X(4.5), 385, "+ position embedding + segment embedding (A / B)", { fs: 12.5 });
    box(s, x0, 188, W - 2 * x0, 74, "BERT · 12 × (self-attention + FFN) · 110M · " + (mode === "pre" ? "trained by the two heads above" : "the dial decides how much of it moves"), { fill: "color-mix(in srgb, var(--cls-1) 8%, var(--panel))", fs: 14.5, bold: 1 });
    toks.forEach((t, i) => { const on = mode === "pre" ? (t === "[MASK]" || i === 0) : mode === "cls" ? i === 0 : !/^\[/.test(t) && (mode === "ner" || isC(i));
      box(s, X(i) - cw / 2 + 8, 118, cw - 16, 32, "h" + i, { fill: on ? "color-mix(in srgb, var(--cls-1) 22%, var(--panel))" : css("--panel-sunk"), stroke: on ? css("--cls-1") : css("--rule-strong"), fs: 12.5, color: on ? css("--ink") : css("--ink-3") });
      if (on) arrow(s, X(i), 118, X(i), 78, { color: css("--cls-1") }); });
    txt(s, 36, 139, "H", { anchor: "end", fs: 13, bold: 1 });
    if (mode === "pre") {
      box(s, X(0) - 55, 30, 110, 44, "NSP head", { fill: "color-mix(in srgb, var(--cls-2) 18%, var(--panel))", fs: 13, bold: 1 }); txt(s, X(0), 18, "pooler → IsNext / NotNext", { fs: 12 });
      box(s, X(3) - 80, 30, 160, 44, "MLM head → 30 522 words", { fill: "color-mix(in srgb, var(--cls-3) 22%, var(--panel))", fs: 13, bold: 1 }); txt(s, X(3), 18, "softmax over the vocabulary: sat 0.41, lay 0.2 …", { fs: 12 });
    } else if (mode === "cls") {
      box(s, X(0) - 70, 30, 140, 44, "pooler + Linear(d, 4)", { fill: "color-mix(in srgb, var(--cls-2) 18%, var(--panel))", fs: 13, bold: 1 }); txt(s, X(0) + 10, 18, "[B, 4] · softmax over classes · World / Sports / Business / Sci/Tech", { fs: 12, anchor: "start" });
    } else if (mode === "ner") {
      toks.forEach((t, i) => { if (/^\[/.test(t)) return; box(s, X(i) - cw / 2 + 8, 30, cw - 16, 44, ["", "O", "O", "O", "O", "", "B-PER", "O", "O"][i] || "O", { fill: "color-mix(in srgb, var(--cls-2) 18%, var(--panel))", fs: 12.5, bold: 1 }); });
      txt(s, X(4.5), 18, "the same Linear(d, 9) at every position · [B, L, 9] · softmax over tags", { fs: 12.5 });
    } else {
      toks.forEach((t, i) => { if (!isC(i)) return; box(s, X(i) - cw / 2 + 8, 30, cw - 16, 44, i === 6 ? "start" : i === 8 ? "end" : "·", { fill: i === 6 || i === 8 ? "color-mix(in srgb, var(--good) 22%, var(--panel))" : css("--panel-sunk"), fs: 12.5, bold: 1 }); });
      txt(s, X(4.5), 18, "Linear(d, 2) at every position → start scores, end scores · softmax over positions, twice", { fs: 12.5 });
    }
    host.appendChild(s); $("#fig-bert-note").innerHTML = NOTE[mode];
  }
  let mode = "pre"; draw(mode); REDRAW.push(() => draw(mode));
  $("#fig-bert-btns").addEventListener("click", e => { const b = e.target.closest("button[data-m]"); if (!b) return; mode = b.dataset.m; $$("#fig-bert-btns button").forEach(x => x.classList.toggle("sel", x === b)); draw(mode); });
})();
function box(s, x, y, w, h, label, o) { o = o || {}; const r = el("rect", { x, y, width: w, height: h, rx: 6, fill: "none", stroke: o.stroke || css("--rule-strong"), "stroke-width": 1.4 }); r.style.fill = o.fill || "var(--panel-sunk)"; s.appendChild(r);
  if (label != null) s.appendChild(el("text", { x: x + w / 2, y: y + h / 2 + (o.fs || 14) * .36, "font-size": o.fs || 14, "text-anchor": "middle", fill: o.color || css("--ink"), "font-weight": o.bold ? "600" : "400" }, label)); }
function txt(s, x, y, t, o) { o = o || {}; s.appendChild(el("text", { x, y, "font-size": o.fs || 13.5, "text-anchor": o.anchor || "middle", fill: o.color || css("--ink-2"), "font-weight": o.bold ? "600" : "400" }, t)); }
function arrow(s, x1, y1, x2, y2, o) { o = o || {}; const color = o.color || css("--ink-2"), id = "arr-" + String(color).replace(/[^a-z0-9]/gi, "");
  if (!s.querySelector("#" + id)) { let defs = s.querySelector("defs"); if (!defs) { defs = el("defs", {}); s.appendChild(defs); } const m = el("marker", { id, viewBox: "0 0 10 10", refX: 9, refY: 5, markerWidth: 6, markerHeight: 6, orient: "auto-start-reverse" }); m.appendChild(el("path", { d: "M 0 0 L 10 5 L 0 10 z", fill: color })); defs.appendChild(m); }
  s.appendChild(el("path", { d: `M ${x1} ${y1} L ${x2} ${y2}`, fill: "none", stroke: color, "stroke-width": 1.6, "marker-end": `url(#${id})` })); }

/* ---- 02 zero-shot: pick the label words, score in the browser */
(function zsPick() {
  const C = ZS.candidates, n = ZS.n, prob = f16(ZS.probs), gold = ZS.gold, m = C.length;
  const sel = CLS.map((c, ci) => { const dflt = ZA.v1.words[ci]; return `<label class="field"><b>${esc(c)}</b><select data-c="${ci}">${C.map(w => `<option ${w === dflt ? "selected" : ""}>${esc(w)}</option>`).join("")}</select></label>`; });
  $("#zs-pick").innerHTML = sel.join("");
  function score() {
    const cols = $$("#zs-pick select").map(s => C.indexOf(s.value)); const hit = [0, 0, 0, 0], cnt = [0, 0, 0, 0]; let ok = 0;
    for (let i = 0; i < n; i++) { let b = 0, bv = -1; for (let c = 0; c < 4; c++) { const v = prob[i * m + cols[c]]; if (v > bv) { bv = v; b = c; } } cnt[gold[i]]++; if (b === gold[i]) { hit[gold[i]]++; ok++; } }
    $("#zs-pick-acc").textContent = `accuracy ${(ok / n).toFixed(4)}`;
    probBars($("#zs-pick-out"), CLS.map((c, ci) => ({ label: c, p: hit[ci] / cnt[ci], text: (hit[ci] / cnt[ci]).toFixed(3) })), { max: 1 });
  }
  $("#zs-pick").addEventListener("change", score); score();
  $("#zs-cellout").textContent = ZS.cellOut;
})();

/* ---- 03 the HF recipe */
code("#code-recipe", `model = AutoModelForSequenceClassification.from_pretrained("bert-base-uncased", num_labels=4)
#       AutoModelForTokenClassification (num_labels=9)  |  AutoModelForQuestionAnswering  — same body, another Linear

def set_trainable(model, top_blocks):                 # the dial: 0 = head only, k = top k blocks, "all"
    body = model.base_model
    for p in body.parameters():
        p.requires_grad = top_blocks == "all"
    if top_blocks != "all" and top_blocks > 0:
        for block in body.encoder.layer[-top_blocks:]:
            for p in block.parameters():
                p.requires_grad = True
        for p in body.pooler.parameters():            # sits above the last block: moves whenever any block does
            p.requires_grad = True

args = TrainingArguments(output_dir=..., per_device_train_batch_size=32, num_train_epochs=2, learning_rate=lr,
                         weight_decay=0.01, warmup_steps=0.1, lr_scheduler_type="linear",   # BERT's fine-tuning recipe
                         eval_strategy="epoch", logging_strategy="epoch", save_strategy="no", report_to=[])
trainer = Trainer(model=model, args=args, train_dataset=train_ds, eval_dataset=eval_ds,
                  data_collator=DataCollatorWithPadding(tokenizer), compute_metrics=accuracy_metric)
trainer.train()                                       # curves come back in trainer.state.log_history`);

/* ---- 04 the dial knob */
(function knob() {
  const KEYS = TRN, LAB = { "head only": "0", "top 2 blocks": "2", "top 6 blocks": "6", "everything": "all" };
  $("#dial-knob").innerHTML = KEYS.map((k, i) => `<button data-k="${k}" class="${i === 0 ? "sel" : ""}">k = ${LAB[k]}</button>`).join("");
  function draw(k) {
    const r = TR.runs[k], top = r.top_blocks === "all" ? 12 : r.top_blocks, all = r.top_blocks === "all";
    $("#dial-knob-stats").innerHTML = `<div class="stat-row">${stat(num(r.trainable_params), "trainable")}${stat(pct(r.trainable_params / r.total_params, 1), "of the model")}${stat(r.lr, "lr")}</div>`;
    const host = $("#dial-knob-fig"); host.innerHTML = ""; const s = svg(620, 330); const x = 40, w = 540;
    const cell = (y, h, label, on) => box(s, x, y, w, h, label, { fill: on ? "color-mix(in srgb, var(--cls-1) 22%, var(--panel))" : css("--panel-sunk"), stroke: on ? css("--cls-1") : css("--rule-strong"), color: on ? css("--ink") : css("--ink-3"), fs: 12.5 });
    cell(8, 26, "head · Linear(768, 4) · 3 076", true); cell(40, 22, "pooler · 0.6M", top > 0);
    for (let b = 11; b >= 0; b--) cell(70 + (11 - b) * 18, 15, `block ${b + 1} · 7.1M`, b >= 12 - top);
    cell(292, 26, "embeddings · 23.8M", all);
    host.appendChild(s);
  }
  draw(KEYS[0]);
  $("#dial-knob").addEventListener("click", e => { const b = e.target.closest("button[data-k]"); if (!b) return; $$("#dial-knob button").forEach(x => x.classList.toggle("sel", x === b)); draw(b.dataset.k); });
})();

/* ---- 05 NER / QA figures and code */
(function figHeads() {
  function heads(host, mode) {
    const h = $(host); h.innerHTML = ""; const W = 900, H = 230, s = svg(W, H), toks = mode === "ner" ? ["[CLS]", "werner", "z", "##wing", "##mann", "said", "[SEP]"] : ["[CLS]", "when", "?", "[SEP]", "founded", "in", "1992", ".", "[SEP]"];
    const n = toks.length, x0 = 40, cw = (W - 2 * x0) / n, X = i => x0 + cw * (i + 0.5);
    toks.forEach((t, i) => { box(s, X(i) - cw / 2 + 5, 180, cw - 10, 30, t, { fill: /^\[/.test(t) ? css("--panel-sunk") : css("--panel"), fs: 13, bold: /^\[/.test(t) });
      box(s, X(i) - cw / 2 + 8, 118, cw - 16, 30, "h" + i, { fill: "color-mix(in srgb, var(--cls-1) 18%, var(--panel))", fs: 12.5 }); s.appendChild(el("line", { x1: X(i), x2: X(i), y1: 180, y2: 148, stroke: css("--ink-3") }));
      const lab = mode === "ner" ? ["−100", "B-PER", "I-PER", "−100", "−100", "O", "−100"][i] : (i >= 4 && i <= 7 ? (i === 6 ? "start ✓ end ✓" : "s · e") : "—");
      const on = mode === "ner" ? !lab.startsWith("−") : (i === 6);
      box(s, X(i) - cw / 2 + 8, 40, cw - 16, 40, lab, { fill: on ? "color-mix(in srgb, var(--good) 22%, var(--panel))" : css("--panel-sunk"), stroke: on ? css("--good") : css("--rule-strong"), fs: 12, color: on ? css("--ink") : css("--ink-3"), bold: on });
      arrow(s, X(i), 118, X(i), 82, { color: on ? css("--good") : css("--ink-3") }); });
    txt(s, W / 2, 22, mode === "ner" ? "one Linear(768, 9) per position · loss at every label ≠ −100 · softmax over the 9 tags" : "one Linear(768, 2) per position → start / end scores · softmax over the positions · question and specials excluded", { fs: 13 });
    h.appendChild(s);
  }
  heads("#fig-ner", "ner"); heads("#fig-qa", "qa"); REDRAW.push(() => { heads("#fig-ner", "ner"); heads("#fig-qa", "qa"); });
  code("#code-ner", `enc = tokenizer(batch["tokens"], is_split_into_words=True, truncation=True, max_length=160)
for word_id in enc.word_ids(i):                       # None for [CLS]/[SEP], the same id for zw ##ing ##mann
    labels.append(IGNORE if word_id is None else tags[word_id] if word_id != previous else IGNORE)
    previous = word_id

ner_model = AutoModelForTokenClassification.from_pretrained(MODEL_NAME, num_labels=9)
set_trainable(ner_model, top_blocks=0)
ner_collator = DataCollatorForTokenClassification(tokenizer)    # pads input_ids with [PAD] and labels with -100
seqeval = evaluate.load("seqeval")                              # entity-level F1: type AND both boundaries
trainer, curves = train(ner_model, ner_train, ner_test, ner_collator, ner_metrics, epochs=1, lr=1e-3)`);
  code("#code-qa", `enc = tokenizer(questions, contexts, truncation="only_second", max_length=384, stride=128,
                return_overflowing_tokens=True, return_offsets_mapping=True)     # windows + char offsets
# label = first context token that ends after answer_start, last that starts before answer_end; (0, 0) if not inside

qa_model = AutoModelForQuestionAnswering.from_pretrained(MODEL_NAME)          # Linear(768, 2), split into start / end
set_trainable(qa_model, top_blocks=0)
squad = evaluate.load("squad")                                               # exact match + token F1, best over the human answers
trainer, curves = train(qa_model, qa_train, qa_dev, collator, qa_metrics_for(qa_dev, dev_examples), epochs=1, lr=1e-3)`);
  $("#ner-cellout").textContent = NER.cellOut;
})();
