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
        : `<tr><td colspan="8" style="color:var(--ink-3);padding:18px 10px">Nothing revealed yet. Guess first, then press <em>Reveal next row</em>.</td></tr>`) +
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
    $("#guess-note").innerHTML = (any ? `<strong>${hits} / 4 correct.</strong> ` : "") +
      `A linear model on a sparse representation is directly readable — the parameters <em>are</em> the words, and fifteen of them per class are enough to name the class. Remember how easy that was; block 06 is the contrast, and every model after this seminar is the harder case.`;
  });
  $("#btn-guess-reset").addEventListener("click", () => { shuffle(); $("#guess-note").textContent = "Assign a class to each column, then reveal."; });
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
      <div class="footnote" style="margin-top:12px">First training row, with the marker removed: <span class="mono">${esc(D.shortcut.stripExample.slice(0, 140))}</span></div>`;
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
