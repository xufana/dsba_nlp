/* Lecture 8 — figures and browser-computed values for the questions (demo_base/quiz.js renders the questions).
   #lecture-data is artifacts/lecture_data.json (export_lecture_data.py): OLMo 2 1B after base / SFT / RLVR,
   the number of right answers out of 32 on each of 100 GSM8K problems. */
(function () {
  const LD = JSON.parse(document.getElementById("lecture-data").textContent);
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
  const svg = (host, w, h) => el("svg", { viewBox: `0 0 ${w} ${h}`, width: "100%", preserveAspectRatio: "xMidYMid meet", style: `max-width:${w}px` }, host);
  const txt = (p, x, y, s, a) => el("text", Object.assign({ x, y, "font-size": 12, fill: "var(--ink)" }, a || {}), p, s);
  const box = (p, x, y, w, h, a) => el("rect", Object.assign({ x, y, width: w, height: h, rx: 3, fill: "var(--panel-sunk)", stroke: "var(--rule-strong)", "stroke-width": 1 }, a || {}), p);
  const arrow = (p, x1, y1, x2, y2) => el("path", { d: `M${x1},${y1} L${x2},${y2}`, stroke: "var(--ink-3)", "stroke-width": 1.2, fill: "none", "marker-end": "url(#lec-arr)" }, p);
  function defs(s) { const d = el("defs", {}, s); const m = el("marker", { id: "lec-arr", viewBox: "0 0 10 10", refX: 9, refY: 5, markerWidth: 7, markerHeight: 7, orient: "auto" }, d); el("path", { d: "M0,0 L10,5 L0,10 z", fill: "var(--ink-3)" }, m); }
  /* a clickable part of a `point` figure: the group carries data-pick, its last child is the hit rect quiz.js styles */
  function pickable(parent, key, x, y, w, h) { const g = el("g", { "data-pick": key }, parent); g.hit = () => el("rect", { class: "hit", x: x - 4, y: y - 4, width: w + 8, height: h + 8, rx: 5 }, g); return g; }
  const MONO = { "font-family": "var(--mono)" };
  /* "π" with a subscript, as one <text> */
  function sub(p, x, y, main, lower, a) { const t = txt(p, x, y, main, a); if (lower) el("tspan", { "baseline-shift": "sub", "font-size": "75%" }, t, lower); return t; }

  /* --------------------------------------------------------------- measured: OLMo 2 1B on GSM8K, 32 samples per problem */
  const P = LD.passk, ST = P.stages, n = P.n;
  const comb = (a, b) => { if (b < 0 || b > a) return 0; let r = 1; for (let i = 1; i <= b; i++) r = r * (a - b + i) / i; return r; };
  /* a group of G answers drawn from the n samples of a problem, without replacement: all right, all wrong */
  const G = 8;
  const groupShare = (c, right) => c.reduce((s, k) => s + comb(right ? k : n - k, G) / comb(n, G), 0) / c.length;
  const pk = (s, k) => ST[s].curve[P.ks.indexOf(k)];
  const pct = x => Math.round(100 * x) + "%";
  const f2 = x => x.toFixed(2);
  const V = QUIZ.values;
  ["base", "SFT", "RLVR"].forEach(s => {
    const key = s.toLowerCase(), c = ST[s].correct;
    V[key + "1"] = f2(pk(s, 1)); V[key + "32"] = f2(pk(s, n));
    const r = groupShare(c, true), w = groupShare(c, false);
    V["allright_" + key] = pct(r); V["allwrong_" + key] = pct(w); V["flat_" + key] = pct(r + w);
  });
  V.gap1 = f2(pk("RLVR", 1) - pk("SFT", 1));

  /* --------------------------------------------------------------- the pipeline */
  QUIZ.figs.pipeline = host => {
    const W = 760, H = 214, s = svg(host, W, H); defs(s);
    const st = [["Pretraining", "trillions of tokens", "predict the next token"], ["SFT", "demonstrations", "“write this”"],
                ["Preferences", "comparisons · RLHF, DPO", "“this one is better”"], ["RLVR", "tasks with a checker", "“right” / “wrong”"]];
    const bw = 170, gap = 16, y = 30, bh = 58;
    st.forEach(([name, data, signal], i) => {
      const x = 4 + i * (bw + gap);
      box(s, x, y, bw, bh, { fill: "var(--panel)" });
      el("rect", { x, y, width: bw, height: 4, fill: `var(--cls-${i})` }, s);
      txt(s, x + bw / 2, y + 26, name, { "text-anchor": "middle", "font-size": 14, "font-weight": 600 });
      txt(s, x + bw / 2, y + 45, data, { "text-anchor": "middle", "font-size": 11, fill: "var(--ink-2)" });
      txt(s, x + bw / 2, y + bh + 22, signal, { "text-anchor": "middle", "font-size": 12, fill: `var(--cls-${i})`, "font-style": "italic" });
      if (i) arrow(s, x - gap + 1, y + bh / 2, x - 2, y + bh / 2);
    });
    txt(s, 4, 16, "what the model learns from", { "font-size": 10.5, fill: "var(--ink-3)", ...MONO });
    const px = 4 + 2 * (bw + gap), sy = 156;
    box(s, px - 20, sy, bw + 40, 40, { "stroke-dasharray": "4 3" });
    txt(s, px + bw / 2, sy + 17, "safety data · Constitutional AI", { "text-anchor": "middle", "font-size": 11 });
    txt(s, px + bw / 2, sy + 32, "red teaming", { "text-anchor": "middle", "font-size": 11 });
    arrow(s, px + bw / 2, sy - 2, px + bw / 2, y + bh + 30);
  };

  /* --------------------------------------------------------------- one SFT dialogue through a chat template */
  QUIZ.figs["sft-mask"] = host => {
    const W = 760, H = 104, s = svg(host, W, H);
    const seg = [["sys", "system", "Be concise.", 120], ["user", "user", "Capital of Australia?", 180], ["head", "opens the turn", "<|im_start|>assistant", 160],
                 ["ans", "assistant", "Canberra.", 135], ["end", "closes the turn", "<|im_end|>", 104]];
    let x = 6; const y = 30, h = 50;
    seg.forEach(([key, label, body, w]) => {
      const g = pickable(s, key, x, y, w, h);
      box(g, x, y, w, h, { fill: "var(--panel)" });
      txt(g, x + 8, y - 8, label, { "font-size": 10.5, fill: "var(--ink-3)", ...MONO });
      const mono = body.startsWith("<|");
      txt(g, x + 8, y + 30, body, Object.assign({ "font-size": mono ? 11 : 12.5 }, mono ? MONO : {}));
      g.hit();
      x += w + 12;
    });
    txt(s, 6, H - 4, "the whole sequence is read by the model; the question is where the loss is summed", { "font-size": 10.5, fill: "var(--ink-3)" });
  };

  /* --------------------------------------------------------------- RLHF with PPO: the four models */
  QUIZ.figs.rlhf = host => {
    const W = 760, H = 238, s = svg(host, W, H); defs(s);
    const mid = 119;
    box(s, 4, mid - 20, 80, 40); txt(s, 44, mid + 5, "prompt x", { "text-anchor": "middle", "font-size": 12 });
    arrow(s, 86, mid, 118, mid);
    box(s, 120, mid - 38, 170, 76, { fill: "var(--panel)", stroke: "var(--cls-1)", "stroke-width": 1.6 });
    sub(s, 205, mid - 10, "policy  π", "θ", { "text-anchor": "middle", "font-size": 14, "font-weight": 600 });
    txt(s, 205, mid + 10, "the model being aligned;", { "text-anchor": "middle", "font-size": 11, fill: "var(--ink-2)" });
    txt(s, 205, mid + 25, "it generates the answer", { "text-anchor": "middle", "font-size": 11, fill: "var(--ink-2)" });
    arrow(s, 292, mid, 324, mid);
    box(s, 326, mid - 20, 86, 40); txt(s, 369, mid + 5, "answer y", { "text-anchor": "middle", "font-size": 12 });
    const roles = [[["reference  π", "ref"], "the SFT model's log-probs of y,", "for the KL penalty"], [["reward model  r", ""], "one score for the whole answer,", "trained on human picks"], [["value model  V", ""], "the expected reward of each prefix,", "to credit single tokens"]];
    roles.forEach(([name, l1, l2], i) => {
      const by = 6 + i * 78, bx = 470;
      box(s, bx, by, 280, 70, { fill: "var(--panel)" });
      sub(s, bx + 12, by + 20, name[0], name[1], { "font-size": 13.5, "font-weight": 600 });
      txt(s, bx + 12, by + 42, l1, { "font-size": 11, fill: "var(--ink-2)" });
      txt(s, bx + 12, by + 58, l2, { "font-size": 11, fill: "var(--ink-2)" });
      arrow(s, 414, mid, bx - 2, by + 35);
    });
  };

  /* --------------------------------------------------------------- GRPO advantages for k right of 8: with and without the std */
  QUIZ.figs["grpo-std"] = host => {
    const rows = [];
    for (let k = 0; k <= G; k++) {
      const p = k / G, sd = Math.sqrt(p * (1 - p));
      const aPos = k ? (1 - p) / (sd || 1) * (sd ? 1 : 0) : null, aNeg = k < G ? -p / (sd || 1) * (sd ? 1 : 0) : null;
      const totStd = sd ? k * (1 - p) / sd + (G - k) * p / sd : 0, totRaw = k * (1 - p) + (G - k) * p;
      rows.push({ k, aPos, aNeg, totStd, totRaw });
    }
    const mid = rows[G / 2], fmt = v => v == null ? "—" : (Math.abs(v) < 1e-12 ? "0" : (v > 0 ? "+" : "−") + Math.abs(v).toFixed(2));
    const rel = (v, m) => m ? `<span style="color:var(--ink-3);font-size:.88em"> ×${(v / m).toFixed(2)}</span>` : "";
    host.innerHTML = `<div class="scroll-x"><table class="lec-grpo"><thead><tr><th class="num">right of 8</th><th class="num">A₊, a right answer</th><th class="num">A₋, a wrong one</th><th class="num">∑|A| · GRPO</th><th class="num">∑|A| · without the std</th></tr></thead><tbody>` +
      rows.map(r => `<tr${r.k === 1 || r.k === 7 ? ' class="edge"' : ""}><td class="num">${r.k}</td><td class="num">${fmt(r.aPos)}</td><td class="num">${fmt(r.aNeg)}</td>` +
        `<td class="num">${r.totStd.toFixed(2)}${r.totStd ? rel(r.totStd, mid.totStd) : ""}</td><td class="num">${r.totRaw.toFixed(2)}${r.totRaw ? rel(r.totRaw, mid.totRaw) : ""}</td></tr>`).join("") +
      `</tbody></table></div>`;
  };

  /* --------------------------------------------------------------- importance weights of whole answers
     Per-token log-ratio log π/μ ~ N(−σ²/2, σ²), independent across tokens, so the answer's log-weight is N(−Tσ²/2, Tσ²):
     sampled exactly, with a seeded generator so the table is the same on every load. */
  const SIGMA = 0.1, NIS = 10000;
  V.is_sigma = String(SIGMA); V.is_n = NIS.toLocaleString("en-US").replace(/,/g, " ");
  function mulberry(a) { return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  function isRow(T) {
    const rnd = mulberry(7 + T), s2 = T * SIGMA * SIGMA, lw = new Float64Array(NIS);
    for (let i = 0; i < NIS; i++) { const u = rnd() || 1e-12, v = rnd(); lw[i] = -s2 / 2 + Math.sqrt(s2) * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); }
    const mx = Math.max(...lw), w = Array.from(lw, x => Math.exp(x - mx)), sum = w.reduce((a, b) => a + b, 0);
    const norm = w.map(x => x * NIS / sum).sort((a, b) => a - b);
    const top = norm.slice(-NIS / 100).reduce((a, b) => a + b, 0) / NIS;
    const ess = NIS * NIS / norm.reduce((a, b) => a + b * b, 0);
    return { T, median: norm[NIS / 2], max: norm[NIS - 1], top, ess };
  }
  const IS = [1, 10, 100, 300, 1000].map(isRow);
  V.is_top_1000 = pct(IS[4].top); V.is_ess_1000 = Math.round(IS[4].ess); V.is_ess_100 = Math.round(IS[2].ess);
  QUIZ.figs["is-weights"] = host => {
    const g = v => v >= 100 ? Math.round(v).toLocaleString("en-US").replace(/,/g, " ") : v >= 0.01 ? v.toFixed(2) : v.toExponential(1);
    host.innerHTML = `<div class="scroll-x"><table class="lec-grpo"><thead><tr><th class="num">answer length T</th><th class="num">median weight</th><th class="num">largest weight</th><th class="num">top 1% of samples carry</th><th class="num">effective sample size</th></tr></thead><tbody>` +
      IS.map(r => `<tr><td class="num">${r.T}</td><td class="num">${g(r.median)}</td><td class="num">${g(r.max)}</td><td class="num">${pct(r.top)}</td><td class="num">${Math.round(r.ess).toLocaleString("en-US").replace(/,/g, " ")} <span style="color:var(--ink-3);font-size:.88em">of ${V.is_n}</span></td></tr>`).join("") +
      `</tbody></table></div>`;
  };

  /* --------------------------------------------------------------- an agent's trajectory */
  QUIZ.figs["agent-traj"] = host => {
    const W = 760, H = 196, s = svg(host, W, H); defs(s);
    const seg = [["sys", "system", "tool schemas"], ["user", "user", "fix issue #412"], ["a1", "assistant", "calls search(…)"], ["o1", "tool", "5 matching files"],
                 ["a2", "assistant", "calls run_tests()"], ["o2", "tool", "3 tests failed"], ["fin", "assistant", "final answer"], ["rew", "", "reward: tests pass"]];
    const bw = 172, bh = 50, gap = 18, ys = [26, 124];
    seg.forEach(([key, role, body], i) => {
      const r = Math.floor(i / 4), c = i % 4, x = 4 + c * (bw + gap), y = ys[r];
      const g = pickable(s, key, x, y, bw, bh);
      box(g, x, y, bw, bh, key === "rew" ? { "stroke-dasharray": "4 3" } : { fill: "var(--panel)" });
      if (role) txt(g, x + 8, y - 8, role, { "font-size": 10.5, fill: "var(--ink-3)", ...MONO });
      txt(g, x + 10, y + 30, body, { "font-size": 12 });
      g.hit();
      if (c) arrow(s, x - gap + 1, y + bh / 2, x - 3, y + bh / 2);
    });
    el("path", { d: `M${4 + 3 * (bw + gap) + bw / 2},${ys[0] + bh + 4} L${4 + 3 * (bw + gap) + bw / 2},${ys[0] + bh + 18} L${4 + bw / 2},${ys[0] + bh + 18} L${4 + bw / 2},${ys[1] - 18}`,
      stroke: "var(--ink-3)", "stroke-width": 1.2, fill: "none", "marker-end": "url(#lec-arr)" }, s);
  };
})();
