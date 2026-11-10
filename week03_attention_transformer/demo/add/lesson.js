/* Учебные схемы: развёрнутая RNN, BLEU, attention и трансформер по рисункам Alammar (2018). */
const SUBS = '₀₁₂₃₄₅₆₇₈₉', sub = n => String(n).split('').map(d => SUBS[+d]).join('');
const tint = (c, p = 22) => `color-mix(in srgb, var(${c}) ${p}%, var(--panel))`;
const G = {
  rect(x, y, w, h, fill = 'var(--panel-sunk)', stroke = '', extra = '') {
    return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="4" style="fill:${fill}${stroke ? ';stroke:' + stroke : ''}${extra}"/>`;
  },
  /* прямоугольник с подписью; key связывает его со строкой кода */
  cell(x, y, w, h, lines, o = {}) {
    const fs = o.cls === 'num' ? 4.5 : 5, step = o.cls === 'num' ? 18 : 21;
    const body = this.rect(x, y, w, h, o.fill, o.stroke, o.sw ? `;stroke-width:${o.sw}` : '') +
      lines.map((l, i) => ADD.text(x + w / 2, y + h / 2 + (i - (lines.length - 1) / 2) * step + fs, l, o.cls || '')).join('');
    return o.key ? `<g data-f="${o.key}" tabindex="0">${body}</g>` : body;
  },
  pill(x, y, w, h, label, fill, key = '') {
    const body = `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${h / 2}" style="fill:${fill};stroke:var(--ink-3)"/>` + ADD.text(x + w / 2, y + h / 2 + 5, label);
    return key ? `<g data-f="${key}" tabindex="0">${body}</g>` : body;
  },
  vec(x, y, vals, color, o = {}) {
    const cw = o.cw || 46, ch = o.ch || 24;
    return vals.map((v, i) => this.rect(x + i * cw, y, cw, ch, tint(color, 24), o.stroke || '', o.sw ? `;stroke-width:${o.sw}` : '') +
      (o.blank ? '' : ADD.text(x + i * cw + cw / 2, y + ch / 2 + 4.5, typeof v === 'number' ? v.toFixed(o.dec ?? 2) : v, 'num'))).join('');
  },
  path(d, style = '', arrow = true) { return `<path d="${d}" style="fill:none;${style}"${arrow ? ' marker-end="url(#MARKER)"' : ''}/>`; },
  circle(cx, cy, r = 11) { return `<circle cx="${cx}" cy="${cy}" r="${r}" style="fill:var(--panel);stroke:var(--ink-2)"/>` + ADD.text(cx, cy + 5, '+'); },
};

const BLEU = {
  ref: 'кошка спит на тёплом диване уже три часа',
  cases: [
    ['copy', 'копия эталона', 'кошка спит на тёплом диване уже три часа'],
    ['syn', 'синонимы', 'кот дремлет на горячей софе целых три часа'],
    ['order', 'другой порядок слов', 'уже три часа на тёплом диване спит кошка'],
    ['neg', 'добавили «не»', 'кошка не спит на тёплом диване уже три часа'],
    ['num', 'другое число', 'кошка спит на тёплом диване уже два часа'],
    ['short', 'обрезанный перевод', 'кошка спит на тёплом диване'],
    ['rep', 'повтор одного слова', 'кошка кошка кошка кошка кошка кошка'],
  ],
  tokens: s => s.toLowerCase().trim().split(/\s+/).filter(Boolean),
  grams(t, n) { const out = []; for (let i = 0; i + n <= t.length; i++) out.push(t.slice(i, i + n).join(' ')); return out; },
  /* BLEU одного предложения без сглаживания: та же формула, что sacrebleu.sentence_bleu(smooth_method="none") */
  score(hyp, ref = this.ref) {
    const h = this.tokens(hyp), r = this.tokens(ref);
    const rows = [1, 2, 3, 4].map(n => {
      const limit = new Map(), used = new Map();
      for (const g of this.grams(r, n)) limit.set(g, (limit.get(g) || 0) + 1);
      const grams = this.grams(h, n).map(g => {
        const u = used.get(g) || 0, l = limit.get(g) || 0; used.set(g, u + 1);
        return { g, state: !l ? 'miss' : u < l ? 'hit' : 'clip' };
      });
      const m = grams.filter(x => x.state === 'hit').length;
      return { n, grams, m, total: grams.length, p: grams.length ? m / grams.length : 0 };
    });
    const c = h.length, bp = !c ? 0 : c >= r.length ? 1 : Math.exp(1 - r.length / c);
    const bleu = rows.some(x => x.p === 0) ? 0 : bp * Math.exp(rows.reduce((s, x) => s + Math.log(x.p), 0) / 4);
    return { rows, c, r: r.length, bp, bleu: 100 * bleu };
  },
  render() {
    const out = document.querySelector('#bleu-result'); if (!out) return;
    const hyp = document.querySelector('#bleu-hyp').value, res = this.score(hyp);
    const chips = (list, cls) => list.map(x => `<span class="tok ${cls ? cls(x) : ''}">${ADD.esc(x.g ?? x)}</span>`).join('');
    const legend = { hit: 'есть в эталоне', clip: 'сверх числа в эталоне', miss: 'нет в эталоне' };
    let html = `<div class="row"><span class="k">эталон</span><span>${chips(this.tokens(this.ref))}</span></div>`;
    html += res.rows.map(row => `<div class="row"><span class="k">${row.n}-граммы</span><span class="g">${row.grams.length ? row.grams.map(x => `<span class="tok ${x.state}" title="${legend[x.state]}">${ADD.esc(x.g)}</span>`).join('') : '<span class="none">нет: перевод короче</span>'}</span><span class="p">p${sub(row.n)} = ${row.m} / ${row.total}${row.total ? ' = ' + row.p.toFixed(3) : ''}</span></div>`).join('');
    html += `<div class="total">c = ${res.c}, r = ${res.r} · BP = ${res.bp.toFixed(3)} · <b>BLEU = ${res.bleu.toFixed(1)}</b>${res.bleu === 0 && res.c ? ' · есть p, равное нулю' : ''}</div>`;
    out.innerHTML = html;
  },
  init() {
    const select = document.querySelector('#bleu-case'), input = document.querySelector('#bleu-hyp');
    select.innerHTML = this.cases.map(([k, label]) => `<option value="${k}">${label}</option>`).join('') + '<option value="own">свой вариант</option>';
    select.value = 'syn'; input.value = this.cases[1][2];
    select.onchange = () => { const c = this.cases.find(x => x[0] === select.value); if (c) input.value = c[2]; else input.focus(); this.render(); };
    input.oninput = () => { if (!this.cases.some(c => c[0] === select.value && c[2] === input.value)) select.value = 'own'; this.render(); };
    this.render();
  },
};

const W3 = {
  /* учебные оценки соответствия: шаг перевода × позиция источника */
  weights(step) { return ADD.softmax([[0, 3, -1], [-1, 0, 3], [0, .5, 1]][step]); },
  /* развёрнутые энкодер и декодер; без attention источник проходит через последнее состояние */
  encdec(host, o = {}) {
    const attention = !!o.attention, step = o.step || 0, long = !!o.long;
    const src = long ? ['the', 'cat', '…', 'day'] : ['the', 'cat', 'sleeps'];
    const hs = long ? ['h₁', 'h₂', '…', 'h₃₀'] : ['h₁', 'h₂', 'h₃'];
    const inp = ['BOS', 'кошка', 'спит'], out = ['кошка', 'спит', 'EOS'];
    const top = attention ? 0 : -80, n = src.length, ew = long ? 66 : 80, eg = (300 - n * ew) / (n - 1), y = 210 + top, h = 50;
    const ex = i => 20 + i * (ew + eg), dx = j => 460 + j * 100, w = attention ? this.weights(step) : null;
    let s = '';
    s += attention
      ? `<g data-f="scores" tabindex="0">${ADD.text(20, 30, 'αₜ,ᵢ = softmax по i от score(sₜ, hᵢ)', '', 'start')}${G.path(`M ${dx(step) + 80} ${y + 10} H ${dx(step) + 90} V 88`, 'stroke-dasharray:5 4;stroke:var(--cls-3)')}</g>`
      : ADD.text(380, 30, 'источник доходит до декодера одним вектором', 'label');
    src.forEach((t, i) => {
      if (hs[i] === '…') { s += ADD.text(ex(i) + ew / 2, y + h / 2 + 5, '…') + ADD.text(ex(i) + ew / 2, 300 + top, '…'); }
      else {
        const lines = w ? [hs[i], `α = ${w[i].toFixed(2)}`] : [hs[i]];
        s += G.cell(ex(i), y, ew, h, lines, { fill: tint('--cls-0', 16), stroke: 'var(--cls-0)', key: w ? 'weights' : '', cls: w ? 'num' : '' });
        s += ADD.text(ex(i) + ew / 2, 300 + top, t) + ADD.arrow(ex(i) + ew / 2, 284 + top, ex(i) + ew / 2, y + h + 4);
      }
      if (i < n - 1) s += ADD.arrow(ex(i) + ew, y + h / 2, ex(i + 1) - 3, y + h / 2);
    });
    /* бутылочное горлышко: последнее состояние энкодера = начальное состояние декодера */
    s += ADD.arrow(320, y + h / 2, 350, y + h / 2);
    s += G.vec(354, y + 13, [0, 0, 0, 0], '--cls-1', { cw: 18, blank: true, stroke: 'var(--cls-1)' });
    s += ADD.text(390, y + 2, 'd чисел', 'warn') + ADD.arrow(428, y + h / 2, 456, y + h / 2);
    if (!attention) s += ADD.text(390, y + 66, 'один вектор', 'warn');
    for (let j = 0; j < 3; j++) {
      const cur = j === step && (attention || o.highlight);
      s += G.cell(dx(j), y, 80, h, [`s${sub(j + 1)}`], { fill: tint('--cls-3', cur ? 26 : 12), stroke: 'var(--cls-3)', sw: cur ? 2.5 : 0 });
      s += ADD.text(dx(j) + 40, 300 + top, inp[j]) + ADD.arrow(dx(j) + 40, 284 + top, dx(j) + 40, y + h + 4);
      if (j < 2) s += ADD.arrow(dx(j) + 80, y + h / 2, dx(j + 1) - 3, y + h / 2);
      if (cur) s += G.cell(dx(j) - 5, 120 + top, 90, 34, [out[j]], { fill: tint('--cls-3', 22), stroke: 'var(--cls-3)', key: 'output' }) + ADD.arrow(dx(j) + 40, y - 2, dx(j) + 40, 158 + top);
      else s += ADD.text(dx(j) + 40, 143 + top, out[j]) + ADD.arrow(dx(j) + 40, y - 2, dx(j) + 40, 152 + top);
    }
    if (attention) {
      const cx = dx(step) + 40;
      s += G.cell(cx - 60, 50, 120, 36, [`c${sub(step + 1)}`], { fill: tint('--cls-2', 26), stroke: 'var(--cls-2)', key: 'context' }) + ADD.arrow(cx, 86, cx, 116);
      src.forEach((_, i) => {
        if (hs[i] === '…') return;
        const x1 = ex(i) + ew / 2, x2 = cx - 45 + i * 22;
        s += G.path(`M ${x1} ${y - 2} Q ${(x1 + x2) / 2} 110 ${x2} 89`, `stroke:var(--cls-2);stroke-width:${(1 + w[i] * 6).toFixed(2)};opacity:.8`, false);
      });
    }
    s += ADD.text(170, 335 + top, 'энкодер: RNN читает источник', 'label') + ADD.text(600, 335 + top, 'декодер: RNN пишет перевод', 'label');
    host.innerHTML = ADD.svg(s, 760, 350 + top, attention ? 'Рекуррентный переводчик с attention' : 'Рекуррентный encoder–decoder');
  },
  rnn(host) {
    const step = +document.querySelector('#rnn-step').value, enabled = document.querySelector('#rnn-enabled').checked;
    this.encdec(host, { attention: enabled, step, highlight: true });
    const w = this.weights(step);
    document.querySelector('#rnn-result').textContent = enabled
      ? `Σ α = ${w.reduce((a, b) => a + b, 0).toFixed(3)} · c${sub(step + 1)} = ${w.map((v, i) => `${v.toFixed(2)}·h${sub(i + 1)}`).join(' + ')}`
      : 'Связь с источником: только последнее состояние энкодера h₃.';
  },
  example(i) {
    const x = [[1, 0], [0, 1], [1, 1]], keys = [[1, 1], [0, 1], [1, 2]], values = [[1, 0], [1, 1], [2, 1]];
    const q = x[i], scores = keys.map(k => (q[0] * k[0] + q[1] * k[1]) / Math.sqrt(2));
    const weights = ADD.softmax(scores);
    const output = [0, 1].map(j => weights.reduce((sum, w, k) => sum + w * values[k][j], 0));
    return { x, queries: x, q, keys, values, raw: keys.map(k => q[0] * k[0] + q[1] * k[1]), scores, weights, output };
  },
  toks: ['кот', 'спит', 'дома'],
  /* расчёт одного запроса в духе Alammar: столбцы — токены, строки — шаги */
  qkv(host) {
    const i = +document.querySelector('#query-position').value, e = this.example(i), cx = [310, 470, 630];
    const rows = [['x: вход', 44], ['q = x·W_Q', 84], ['k = x·W_K', 118], ['v = x·W_V', 152], [`q${sub(i + 1)}·kⱼ`, 214], ['/ √dₖ = / √2', 252], ['softmax', 290], ['αⱼ·vⱼ', 328], [`z${sub(i + 1)} = Σⱼ αⱼ·vⱼ`, 392]];
    let s = rows.map(([label, y]) => ADD.text(20, y + 17, label, 'label', 'start')).join('');
    s += `<line x1="20" x2="740" y1="190" y2="190" style="stroke:var(--rule);stroke-dasharray:3 4"/>`;
    s += ADD.text(470, 206, `запрос «${this.toks[i]}» сравниваем с ключом каждой позиции`, 'small');
    this.toks.forEach((t, j) => {
      const x = cx[j] - 46, me = j === i;
      s += ADD.text(cx[j], 26, me ? `«${t}» · запрос` : `«${t}»`, me ? 'strong' : '');
      s += G.vec(x, 44, e.x[j], '--cls-2');
      s += `<g style="opacity:${me ? 1 : .35}">${G.vec(x, 84, e.queries[j], '--cls-3', me ? { stroke: 'var(--cls-3)', sw: 2.5 } : {})}</g>`;
      s += G.vec(x, 118, e.keys[j], '--cls-1') + G.vec(x, 152, e.values[j], '--cls-0');
      s += G.cell(x, 214, 92, 24, [e.raw[j].toFixed(2)], { cls: 'num' }) + ADD.arrow(cx[j], 238, cx[j], 250);
      s += G.cell(x, 252, 92, 24, [e.scores[j].toFixed(2)], { cls: 'num' }) + ADD.arrow(cx[j], 276, cx[j], 288);
      s += G.cell(x, 290, 92, 24, [e.weights[j].toFixed(3)], { cls: 'num', fill: tint('--cls-2', Math.round(10 + 50 * e.weights[j])), stroke: 'var(--cls-2)' }) + ADD.arrow(cx[j], 314, cx[j], 326);
      s += G.vec(x, 328, e.values[j].map(v => v * e.weights[j]), '--cls-0');
      s += ADD.arrow(cx[j], 354, 470 + (j - 1) * 30, 388);
    });
    s += G.vec(424, 392, e.output, '--cls-2', { stroke: 'var(--cls-2)', sw: 2, dec: 3, cw: 46 });
    host.innerHTML = ADD.svg(s, 760, 430, 'Расчёт self-attention для одного запроса');
    document.querySelector('#qkv-result').textContent = `z${sub(i + 1)} = ${e.weights.map((w, j) => `${w.toFixed(3)}·v${sub(j + 1)}`).join(' + ')} = [${e.output.map(v => v.toFixed(3)).join(', ')}]`;
  },
  /* матричная форма тех же чисел */
  matrix(host) {
    const i = +(document.querySelector('#query-position')?.value || 0), e = this.example(i), cw0 = 52, ch = 26;
    const S = e.queries.map(q => e.keys.map(k => (q[0] * k[0] + q[1] * k[1]) / Math.sqrt(2)));
    const A = S.map(r => ADD.softmax(r)), Z = A.map(r => [0, 1].map(j => r.reduce((s, w, k) => s + w * e.values[k][j], 0)));
    const grid = (x, y, M, color, o = {}) => {
      const cw = o.cw || cw0;
      let g = M.map((row, r) => row.map((v, c) => G.rect(x + c * cw, y + r * ch, cw, ch, tint(color, o.hi === r ? 34 : 16), o.hi === r ? 'var(--cls-3)' : '', o.hi === r ? ';stroke-width:2' : '') +
        ADD.text(x + c * cw + cw / 2, y + r * ch + 17.5, v.toFixed(o.dec ?? 2), 'num')).join('')).join('');
      if (o.rows) g += o.rows.map((t, r) => ADD.text(x - 8, y + r * ch + 18, t, 'small', 'end')).join('');
      if (o.cols) g += o.cols.map((t, c) => ADD.text(x + c * cw + cw / 2, y - 8, t, 'small')).join('');
      if (o.label) g += ADD.text(x + M[0].length * cw / 2, y + M.length * ch + 20, o.label, 'small');
      return o.key ? `<g data-f="${o.key}" tabindex="0">${g}</g>` : g;
    };
    const kt = [0, 1].map(r => e.keys.map(k => k[r])), y0 = 50, y1 = 232;
    let s = grid(64, y0, e.queries, '--cls-3', { hi: i, rows: this.toks, label: 'Q · T×dₖ', dec: 0 }) + ADD.text(183, y0 + 44, '×');
    s += grid(198, y0 + 13, kt, '--cls-1', { cols: this.toks, label: 'Kᵀ · dₖ×S', dec: 0 }) + ADD.text(392, y0 + 44, '/ √dₖ =');
    s += grid(430, y0, S, '--cls-1', { hi: i, cols: this.toks, label: 'S · T×S', key: 'scores' }) + ADD.text(602, y0 + 44, '+');
    s += grid(616, y0, S.map(r => r.map(() => 0)), '--ink-3', { cw: 40, label: 'M · нули', key: 'mask', dec: 0 });
    s += ADD.text(20, y1 - 24, 'A = softmax(S + M) по каждой строке: строка в сумме 1', 'label', 'start');
    s += grid(64, y1, A, '--cls-2', { hi: i, rows: this.toks, label: 'A · T×S', key: 'weights' }) + ADD.text(236, y1 + 44, '×');
    s += grid(252, y1, e.values, '--cls-0', { label: 'V · S×dᵥ', dec: 0 }) + ADD.text(372, y1 + 44, '=');
    s += grid(388, y1, Z, '--cls-2', { hi: i, label: 'Z · T×dᵥ', key: 'context' });
    host.innerHTML = ADD.svg(s, 760, 340, 'Матричный расчёт одной головы attention');
  },
  maskTokens(mode) {
    return mode === 'encoder' ? { q: ['the', 'cat', 'sleeps', 'PAD'], k: ['the', 'cat', 'sleeps', 'PAD'] }
      : mode === 'causal' ? { q: ['BOS', 'кошка', 'спит', 'PAD'], k: ['BOS', 'кошка', 'спит', 'PAD'] }
        : { q: ['BOS', 'кошка', 'спит'], k: ['the', 'cat', 'sleeps', 'PAD'] };
  },
  maskAllowed(mode, i, j) { return j < 3 && (mode !== 'causal' || j <= i); },
  maskQuery: 1,
  maskWhy(mode, i, j) {
    const t = this.maskTokens(mode);
    if (this.maskAllowed(mode, i, j)) return `«${t.q[i]}» читает «${t.k[j]}»: доступ разрешён`;
    return `«${t.q[i]}» → «${t.k[j]}»: ` + (j === 3 ? 'PAD исключён' : 'будущая позиция закрыта');
  },
  mask(host) {
    const mode = document.querySelector('#mask-mode').value, t = this.maskTokens(mode), rows = t.q.length;
    const qi = this.maskQuery = Math.min(this.maskQuery, rows - 1), bx = j => 60 + j * 175, bw = 110;
    const titles = { encoder: `self-attention энкодера: «${t.q[qi]}» читает весь источник, кроме PAD`, causal: `causal self-attention: «${t.q[qi]}» читает себя и прошлые позиции`, cross: `cross-attention: «${t.q[qi]}» из декодера читает источник` };
    let s = ADD.text(380, 24, titles[mode], 'label');
    const tokenBox = (x, y, label, role, idx, isQuery) => {
      const fill = role === 'q' ? tint('--cls-3', 26) : role === 'k' ? tint('--cls-0', 18) : 'var(--panel-sunk)';
      const stroke = role === 'q' ? 'var(--cls-3)' : role === 'k' ? 'var(--cls-0)' : 'var(--ink-3)';
      const extra = role === 'off' ? ';stroke-dasharray:4 4;opacity:.55' : role === 'q' ? ';stroke-width:2.5' : '';
      return `<g${isQuery != null ? ` data-query="${isQuery}" role="button" tabindex="0"` : ''}>${G.rect(x, y, bw, 40, fill, stroke, extra)}${ADD.text(x + bw / 2, y + 25, label)}</g>`;
    };
    if (mode === 'cross') {
      s += ADD.text(60, 52, 'выход энкодера → K и V', 'small', 'start');
      t.k.forEach((k, j) => {
        const ok = this.maskAllowed(mode, qi, j);
        s += tokenBox(bx(j), 62, k, ok ? 'k' : 'off', j, null);
        if (ok) s += G.path(`M ${bx(j) + bw / 2} 104 L ${bx(qi) + bw / 2 + (j - 1) * 12} 156`, 'stroke:var(--cls-2);stroke-width:2');
      });
      t.q.forEach((q, i) => s += tokenBox(bx(i), 160, q, i === qi ? 'q' : 'k', i, i));
      s += ADD.text(60, 226, 'декодер после causal self-attention → Q', 'small', 'start');
    } else {
      t.k.forEach((k, j) => {
        const ok = this.maskAllowed(mode, qi, j), role = j === qi ? 'q' : ok ? 'k' : 'off';
        s += tokenBox(bx(j), 150, k, role, j, j < rows ? j : null);
        if (!ok) s += ADD.text(bx(j) + bw / 2, 212, j === 3 ? 'PAD: исключён' : 'закрыто: будущее', 'small');
        else if (j === qi) {
          const c = bx(j) + bw / 2;
          s += G.path(`M ${c + 26} 148 C ${c + 40} 104, ${c - 40} 104, ${c - 22} 146`, 'stroke:var(--cls-2);stroke-width:2') + ADD.text(c, 212, 'запрос', 'small');
        } else {
          const a = bx(j) + bw / 2, b = bx(qi) + bw / 2 + (j - qi) * 9;
          s += G.path(`M ${a} 148 Q ${(a + b) / 2} ${108 - 22 * Math.abs(j - qi)} ${b} 146`, 'stroke:var(--cls-2);stroke-width:2');
        }
      });
    }
    /* та же маска матрицей */
    const my = 300, mx = j => 240 + j * 92;
    s += ADD.text(380, 262, 'та же маска: строки — запросы, столбцы — ключи', 'label');
    t.k.forEach((k, j) => s += ADD.text(mx(j) + 42, 288, k, 'small'));
    for (let i = 0; i < rows; i++) {
      s += ADD.text(230, my + i * 42 + 24, t.q[i], i === qi ? 'small strong' : 'small', 'end');
      for (let j = 0; j < t.k.length; j++) {
        const yes = this.maskAllowed(mode, i, j), x = mx(j), y = my + i * 42;
        s += `<g data-cell="${i},${j}" role="button" tabindex="0" aria-label="${ADD.esc(this.maskWhy(mode, i, j))}">${G.rect(x, y, 84, 36, yes ? tint('--cls-2', i === qi ? 40 : 20) : 'var(--panel-sunk)', i === qi ? 'var(--cls-3)' : '', i === qi ? ';stroke-width:2' : '')}${ADD.text(x + 42, y + 23, yes ? '✓' : '×')}</g>`;
      }
    }
    host.innerHTML = ADD.svg(s, 760, my + rows * 42 + 8, 'Кто кого читает: стрелки и маска');
    const describe = (i, j) => { this.maskQuery = i; this.mask(host); document.querySelector('#mask-result').textContent = this.maskWhy(mode, i, j); };
    const bind = (node, fn) => { node.onclick = fn; node.onkeydown = ev => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); fn(); } }; };
    host.querySelectorAll('[data-cell]').forEach(g => { const [i, j] = g.dataset.cell.split(',').map(Number); bind(g, () => describe(i, j)); });
    host.querySelectorAll('[data-query]').forEach(g => { const i = +g.dataset.query; bind(g, () => { this.maskQuery = i; this.mask(host); document.querySelector('#mask-result').textContent = `Запрос «${t.q[i]}»: читает ${t.k.filter((_, j) => this.maskAllowed(mode, i, j)).map(k => `«${k}»`).join(', ')}.`; }); });
    const result = document.querySelector('#mask-result');
    if (!result.dataset.mode || result.dataset.mode !== mode) { result.dataset.mode = mode; result.textContent = 'Нажмите на токен или клетку маски.'; }
  },
  heads(host) {
    let s = ADD.box(255, 15, 250, 50, ['X: B × T × d']);
    for (let i = 0; i < 3; i++) {
      const x = 20 + i * 250;
      s += ADD.arrow(380, 65, x + 110, 105) + ADD.box(x, 110, 220, 75, [`голова ${i + 1}: Q, K, V`, 'все T позиций', 'ширина d / H']);
      s += ADD.arrow(x + 110, 185, 380, 235);
    }
    s += ADD.box(205, 240, 350, 50, ['объединение: B × T × d']) + ADD.arrow(380, 290, 380, 325) + ADD.box(255, 330, 250, 50, ['W_O: d → d']);
    host.innerHTML = ADD.svg(s, 760, 400, 'Параллельные головы attention');
  },
  /* причинный Pre-LN блок на двух позициях, как у Alammar: attention общий, LayerNorm и FFN — на позицию */
  block(host) {
    const cx = [250, 510], toks = ['кот', 'спит'], pw = 170;
    const per = (y, label, fill, key) => `<g data-f="${key}" tabindex="0">${cx.map(c => G.pill(c - pw / 2, y, pw, 32, label, fill)).join('')}</g>`;
    let s = ADD.text(380, 24, 'Pre-LN блок декодера на двух позициях', 'label');
    s += `<rect x="120" y="94" width="520" height="378" rx="14" style="fill:none;stroke:var(--cls-3);stroke-dasharray:6 4"/>` + ADD.text(668, 284, '×N', 'strong');
    cx.forEach((c, k) => {
      s += G.vec(c - 44, 480, [0, 0, 0, 0], '--cls-2', { cw: 22, blank: true }) + ADD.text(c, 524, `«${toks[k]}»: x${sub(k + 1)}`);
      s += G.vec(c - 44, 52, [0, 0, 0, 0], '--cls-2', { cw: 22, blank: true });
      s += ADD.arrow(c, 478, c, 442) + ADD.arrow(c, 404, c, 370) + ADD.arrow(c, 332, c, 310) + ADD.arrow(c, 284, c, 258) + ADD.arrow(c, 220, c, 186) + ADD.arrow(c, 150, c, 126) + ADD.arrow(c, 100, c, 80);
      const side = k ? 1 : -1, rx = c + side * 110, rx2 = c + side * 100;
      s += G.path(`M ${c} 466 H ${rx} V 296 H ${c - side * -13}`, 'stroke-dasharray:6 4');
      s += G.path(`M ${c} 272 H ${rx2} V 112 H ${c - side * -13}`, 'stroke-dasharray:6 4');
    });
    s += G.path(`M ${cx[0]} 404 L ${cx[1] - 30} 370`, 'stroke:var(--cls-2);stroke-width:2');
    s += per(406, 'LayerNorm', 'var(--panel-sunk)', 'norm1');
    s += G.pill(150, 334, 460, 36, 'causal self-attention', tint('--cls-2', 26), 'attention');
    s += `<g data-f="add1" tabindex="0">${cx.map(c => G.circle(c, 296)).join('')}</g>`;
    s += per(222, 'LayerNorm', 'var(--panel-sunk)', 'norm2');
    s += per(152, 'FFN: d → 4d → d', tint('--cls-0', 20), 'ffn') + ADD.text(380, 173, 'одни веса', 'small');
    s += `<g data-f="add2" tabindex="0">${cx.map(c => G.circle(c, 112)).join('')}</g>`;
    s += ADD.text(380, 320, '«спит» читает «кот»', 'small');
    s += ADD.text(570, 69, 'выход: d чисел на позицию', 'small', 'start');
    host.innerHTML = ADD.svg(s, 760, 540, 'Причинный блок трансформера на двух позициях');
  },
  /* полный переводчик: два блока энкодера, блок декодера, K и V из энкодера в каждый cross-attention */
  assembly(host) {
    const RH = 28, GAP = 16, H = 700;
    let s = ADD.text(380, 24, 'Трансформер для перевода', 'label');
    const frame = (x, w, bottom, cols, rows, title, color) => {
      let y = bottom - 14; const boxes = [];
      for (const [kind, label, fill] of rows) {
        const yb = y - RH;
        s += kind === 'wide' ? G.pill(x + 24, yb, w - 48, RH, label, fill) : cols.map(c => G.pill(c - 60, yb, 120, RH, label, fill)).join('');
        boxes.push({ yb, label }); y = yb - GAP;
      }
      const top = y + GAP - 28;
      s += `<rect x="${x}" y="${top}" width="${w}" height="${bottom - top}" rx="14" style="fill:none;stroke:${color};stroke-width:1.6"/>` + ADD.text(x + 12, top + 18, title, 'small', 'start');
      boxes.forEach((b, k) => {
        const from = k ? boxes[k - 1].yb : bottom;
        cols.forEach(c => s += ADD.arrow(c, from, c, b.yb + RH + 2));
        if (b.label === 'Add & Norm') {
          const start = k >= 2 ? boxes[k - 2].yb - 8 : bottom - 6;
          s += G.path(`M ${cols[0]} ${start} H ${x + 12} V ${b.yb + RH / 2} H ${x + 22}`, 'stroke-dasharray:4 4');
        }
      });
      return { top, boxes };
    };
    const inputs = (cols, toks) => cols.forEach((c, k) => {
      s += ADD.text(c, H - 12, toks[k]) + G.vec(c - 40, H - 60, [0, 0, 0, 0], '--cls-2', { cw: 20, ch: 18, blank: true });
      s += ADD.arrow(c, H - 62, c, H - 80) + G.circle(c, H - 90, 9) + ADD.arrow(c, H - 100, c, H - 112);
    });
    const ec = [110, 270], dc = [490, 650], A = tint('--cls-2', 24), N = 'var(--panel-sunk)', F = tint('--cls-0', 20);
    const enc = [['wide', 'Self-attention', A], ['wide', 'Add & Norm', N], ['per', 'FFN', F], ['wide', 'Add & Norm', N]];
    inputs(ec, ['the', 'cat']); inputs(dc, ['BOS', 'кошка']);
    s += ADD.text(190, H - 86, '+ позиция', 'small') + ADD.text(570, H - 86, '+ позиция', 'small');
    const e1 = frame(20, 340, H - 112, ec, enc, 'энкодер · блок 1', 'var(--cls-0)');
    ec.forEach(c => s += ADD.arrow(c, e1.top, c, e1.top - 20));
    const e2 = frame(20, 340, e1.top - 22, ec, enc, 'энкодер · блок 2', 'var(--cls-0)');
    const dec = [['wide', 'Causal self-attention', A], ['wide', 'Add & Norm', N], ['wide', 'Cross-attention', tint('--cls-1', 24)], ['wide', 'Add & Norm', N], ['per', 'FFN', F], ['wide', 'Add & Norm', N]];
    const d1 = frame(400, 340, H - 112, dc, dec, 'декодер · блок 1', 'var(--cls-3)');
    const d2y = d1.top - 58;
    dc.forEach(c => s += ADD.arrow(c, d1.top, c, d2y + 38));
    s += `<rect x="400" y="${d2y}" width="340" height="36" rx="14" style="fill:none;stroke:var(--cls-3);stroke-dasharray:6 4"/>` + ADD.text(570, d2y + 23, 'декодер · блок 2: то же', 'small');
    s += ADD.arrow(570, d2y, 570, d2y - 20) + G.pill(424, d2y - 50, 292, RH, 'Linear', tint('--cls-3', 22));
    s += ADD.arrow(570, d2y - 50, 570, d2y - 70) + G.pill(424, d2y - 100, 292, RH, 'Softmax → P(следующий токен)', tint('--cls-1', 22));
    /* память: выход энкодера → K и V для каждого блока декодера */
    const crossY = d1.boxes[2].yb + RH / 2, mem = 'stroke:var(--cls-1);stroke-width:2';
    ec.forEach(c => s += ADD.arrow(c, e2.top, c, e2.top - 18) + G.vec(c - 40, e2.top - 36, [0, 0, 0, 0], '--cls-0', { cw: 20, ch: 18, blank: true }));
    s += G.path(`M 110 ${e2.top - 36} V ${e2.top - 46} H 270 V ${e2.top - 36}`, mem, false);
    s += G.path(`M 190 ${e2.top - 46} V ${e2.top - 56} H 380 V ${crossY} H 422`, mem);
    s += G.path(`M 380 ${d2y + 18} H 398`, mem);
    s += ADD.text(30, e2.top - 64, 'выход энкодера → K, V для cross-attention каждого блока', 'warn', 'start');
    host.innerHTML = ADD.svg(s, 760, H, 'Путь источника и перевода через трансформер');
  },
};

const figureDrawers = {
  encdec: h => W3.encdec(h, { long: document.querySelector('#encdec-length')?.value === 'long' }),
  'rnn-attention': h => W3.rnn(h), qkv: h => W3.qkv(h),
  'attention-matrix': h => W3.matrix(h), mask: h => W3.mask(h),
  heads: h => W3.heads(h), block: h => W3.block(h), assembly: h => W3.assembly(h),
};
for (const [name, draw] of Object.entries(figureDrawers)) figureDrawers[name] = h => { h.classList.add('w3fig'); draw(h); };
Object.assign(QUIZ.figs, figureDrawers);
function redrawAll() { for (const h of document.querySelectorAll('[data-fig]')) figureDrawers[h.dataset.fig](h); }
document.addEventListener('DOMContentLoaded', () => {
  for (const id of ['encdec-length', 'rnn-step', 'rnn-enabled', 'query-position', 'mask-mode']) document.getElementById(id).onchange = redrawAll;
  BLEU.init();
});
