/* Расчёты и отрисовка учебных примеров двух лекций о трансформерах. */
const Transformer = {
  dot: (a, b) => a.reduce((s, x, i) => s + x * b[i], 0),
  rotate(x, position, theta = 10000) {
    const out = [];
    for (let i = 0; i < x.length; i += 2) {
      const angle = position / theta ** (i / x.length), c = Math.cos(angle), s = Math.sin(angle);
      out.push(x[i] * c - x[i + 1] * s, x[i] * s + x[i + 1] * c);
    }
    return out;
  },
  norm(x, rms = false, eps = 1e-5) {
    const mean = rms ? 0 : x.reduce((s, v) => s + v, 0) / x.length;
    const scale = Math.sqrt(x.reduce((s, v) => s + (v - mean) ** 2, 0) / x.length + eps);
    return x.map(v => (v - mean) / scale);
  },
  silu: x => x / (1 + Math.exp(-x)),
  gelu: x => x / 2 * (1 + Math.tanh(Math.sqrt(2 / Math.PI) * (x + 0.044715 * x ** 3))),
  gate(value, gate, kind) { return value.map((x, i) => x * this[kind](gate[i])); },
  cacheBytes(layers, heads, width, length, bytes = 2) { return 2 * layers * heads * width * length * bytes; },
  group(query, queryHeads, kvHeads) { return Math.floor(query / (queryHeads / kvHeads)); },
  attention(q, k, v, causal = false) {
    return q.map((row, i) => {
      const scores = k.map((key, j) => causal && j > i ? -Infinity : this.dot(row, key) / Math.sqrt(row.length));
      const weights = ADD.softmax(scores);
      return v[0].map((_, d) => weights.reduce((s, a, j) => s + a * v[j][d], 0));
    });
  },
  /* Плиточный softmax с накоплением максимума, знаменателя и взвешенной суммы. */
  tiled(q, k, v, causal = false, tile = 2) {
    const trace = [], width = v[0].length;
    const output = q.map((row, i) => {
      let m = -Infinity, l = 0, acc = Array(width).fill(0);
      for (let start = 0; start < k.length; start += tile) {
        const stop = Math.min(k.length, start + tile);
        const scores = k.slice(start, stop).map((key, j) => causal && start + j > i ? -Infinity : this.dot(row, key) / Math.sqrt(row.length));
        const next = Math.max(m, ...scores);
        if (next === -Infinity) continue;
        const alpha = m === -Infinity ? 0 : Math.exp(m - next);
        const p = scores.map(s => Math.exp(s - next));
        acc = acc.map((a, d) => alpha * a + p.reduce((sum, weight, j) => sum + weight * v[start + j][d], 0));
        l = alpha * l + p.reduce((a, b) => a + b, 0); m = next;
        trace.push({row: i, start, stop, m, l, acc: [...acc], output: acc.map(a => a / l)});
      }
      return acc.map(a => a / l);
    });
    return {output, trace};
  },
  fill: (c = '--cls-0', p = 20) => `color-mix(in srgb,var(${c}) ${p}%,var(--panel))`,
  rect(x, y, w, h, color = '--cls-0', selected = false) {
    return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="4" style="fill:${this.fill(color, selected ? 40 : 15)};stroke:var(${selected ? color : '--rule-strong'});stroke-width:${selected ? 2 : 1}"/>`;
  },
  cell(x, y, w, h, label, color = '--cls-0', selected = false) {
    return this.rect(x,y,w,h,color,selected) + ADD.text(x+w/2,y+h/2+5,label);
  },
  vec(x, y, values, color = '--cls-0', selected = false, cw = 28, ch = 24) {
    return values.map((v, i) => this.rect(x+i*cw,y,cw,ch,color,selected) + (v === '' ? '' : ADD.text(x+(i+.5)*cw,y+ch/2+4,typeof v === 'number' ? v.toFixed(2) : v,'num'))).join('');
  },
  path(d, color = '--ink-3', arrow = true) {
    return `<path d="${d}" style="fill:none;stroke:var(${color})"${arrow ? ' marker-end="url(#MARKER)"' : ''}/>`;
  },
  clickable(content, attribute, value) {
    return `<g ${attribute}="${value}" tabindex="0" role="button">${content}</g>`;
  },
  mount(host, content, height, label) { host.classList.add('transformer-fig'); host.innerHTML = ADD.svg(content,760,height,label); },
};
