/* Схемы и связи со строками кода для страниц ADD. */
const ADD = {
  esc: s => String(s).replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c])),
  svg(content, width=760, height=180, label='Схема') {
    return `<svg viewBox="0 0 ${width} ${height}" role="img" aria-label="${this.esc(label)}"><defs><marker id="arrow-${++this.serial}" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" style="fill:var(--ink-3)"/></marker></defs>${content.replaceAll('MARKER', 'arrow-'+this.serial)}</svg>`;
  },
  serial: 0,
  text(x,y,label,cls='',anchor='middle') {
    return `<text x="${x}" y="${y}" text-anchor="${anchor}" class="${cls}">${this.esc(label)}</text>`;
  },
  box(x,y,w,h,lines,key='',pick='') {
    return `<g ${key?`data-f="${key}" tabindex="0"`:''} ${pick?`data-pick="${pick}"`:''}><rect x="${x}" y="${y}" width="${w}" height="${h}" rx="4"/>${lines.map((line,i)=>this.text(x+w/2,y+h/2+(i-(lines.length-1)/2)*23+5,line)).join('')}${pick?`<rect class="hit" x="${x}" y="${y}" width="${w}" height="${h}" rx="4"/>`:''}</g>`;
  },
  arrow(x1,y1,x2,y2) { return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" marker-end="url(#MARKER)"/>`; },
  flow(items, label='Последовательность преобразований') {
    const w=760/items.length;
    return this.svg(items.map((a,i)=>this.box(i*w+6,30,w-30,90,a.lines,a.key,a.pick)+(i<items.length-1?this.arrow((i+1)*w-24,75,(i+1)*w+1,75):'')).join(''),760,150,label);
  },
  table(headers, rows) {
    return '<table class="add-table"><thead><tr>'+headers.map(h=>'<th>'+this.esc(h)+'</th>').join('')+'</tr></thead><tbody>'+rows.map(row=>'<tr>'+row.map(v=>'<td>'+this.esc(v)+'</td>').join('')+'</tr>').join('')+'</tbody></table>';
  },
  softmax(values) { const m=Math.max(...values), ex=values.map(v=>Math.exp(v-m)), z=ex.reduce((a,b)=>a+b,0); return ex.map(v=>v/z); },
  link(scope,key,on) { scope.querySelectorAll('[data-f]').forEach(n=>n.classList.toggle('hi',on && n.dataset.f===key)); },
};
for(const event of ['pointerover','focusin']) document.addEventListener(event,e=>{
  const node=e.target.closest('[data-f]'), scope=node?.closest('[data-link-scope]');
  if(scope) ADD.link(scope,node.dataset.f,true);
});
for(const event of ['pointerout','focusout']) document.addEventListener(event,e=>{
  const node=e.target.closest('[data-f]'), scope=node?.closest('[data-link-scope]');
  if(scope) ADD.link(scope,node.dataset.f,false);
});
