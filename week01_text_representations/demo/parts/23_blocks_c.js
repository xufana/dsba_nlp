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
      <div class="footnote" style="margin-top:12px">The model never sees a label. Its only job is to tell a pair that really co-occurred from one that did not — and the vectors are what it needs in order to do that.</div>`;
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
        '<div class="footnote" style="margin-top:10px">This is the honest 2013 objective, and the reason nobody trains it this way: ' +
        "the gradient is dense in the vocabulary, so cost per example grows with V while only one word was ever the answer. " +
        "Hierarchical softmax replaces the flat normalisation with a binary tree (log V); negative sampling gives up on normalising at all. " +
        "Flip the switch back to see what is left.</div>";
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
      '<div class="footnote" style="margin-top:10px">The two coefficients in the middle are the entire learning signal. ' +
      "<span class=\"mono\">σ − 1</span> is negative for the pair that really occurred and <span class=\"mono\">σ</span> is positive for the one that did not, " +
      "so a single update rule pulls <span class=\"mono\">" + esc(context) + "</span> towards <span class=\"mono\">" + esc(centre) +
      "</span> and pushes <span class=\"mono\">" + esc(negWord) + "</span> away. Both shrink as the model gets the pair right — " +
      "a pair it already scores confidently produces almost no gradient, which is why the loss curve flattens.</div>";
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
      : `<div class="footnote">Train the model and the neighbourhood appears. At epoch 0 these are random directions in 24 dimensions.</div>`;
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
      $("#an-out").innerHTML = `<div class="footnote">Not in the 8 006-word subset: ${missing.map(m => `<span class="mono">${esc(m)}</span>`).join(", ")}. The full model has 1.2 million tokens; this page ships the most frequent slice.</div>`;
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
      ${exclude ? `<div class="footnote" style="margin-top:12px">With the inputs kept, the top of this list would be:
        <span class="mono">${resWith.slice(0, 3).map(r => esc(r[0])).join(", ")}</span>.</div>` : ""}`;

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

