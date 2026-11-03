/* Учебные расчёты выполняются в браузере, измерения читаются из артефакта. */
const W1 = {
  docs: ['кот ест рыбу', 'кот спит', 'рыбу ест пёс'], repeat:false, reverse:false,
  tfidf() {
    const train=this.docs.map(d=>d.split(' '));
    const vocab=[...new Set(train.flat())].sort();
    const idf=vocab.map(w=>Math.log((1+train.length)/(1+train.filter(d=>d.includes(w)).length))+1);
    const docs=train.map(d=>[...d]);
    if(this.repeat) docs[0].push('кот');
    if(this.reverse) docs[0].reverse();
    const counts=docs.map(d=>vocab.map(w=>d.filter(t=>t===w).length));
    const raw=counts.map(row=>row.map((n,j)=>n*idf[j]));
    const values=raw.map(row=>{const norm=Math.hypot(...row); return row.map(v=>norm?v/norm:0);});
    return {docs,vocab,idf,counts,raw,values};
  },
  matrix(host) {
    const d=this.tfidf(), left=180, top=63, cw=100, rh=46;
    let s=ADD.text(12,25,'документы × словарь · [B, V]','caption','start');
    d.vocab.forEach((w,j)=>s+=ADD.text(left+j*cw+cw/2,50,w));
    d.docs.forEach((doc,i)=>{
      s+=ADD.text(12,top+i*rh+29,doc.join(' '),'caption','start');
      d.values[i].forEach((v,j)=>s+=`<g data-cell="${i},${j}" data-f="matrix" tabindex="0" role="button" aria-label="Документ ${i+1}, ${d.vocab[j]}"><rect x="${left+j*cw}" y="${top+i*rh}" width="${cw-4}" height="${rh-4}" class="${v?'accent':''}"/>${ADD.text(left+j*cw+48,top+i*rh+27,v.toFixed(3))}</g>`);
    });
    host.innerHTML=ADD.svg(s,760,215,'Матрица TF-IDF');
    const trace=(i,j)=>{document.querySelector('#tfidf-trace').textContent=`${d.vocab[j]}: TF = ${d.counts[i][j]}, IDF = ${d.idf[j].toFixed(3)}, TF × IDF = ${d.raw[i][j].toFixed(3)}, после L2 = ${d.values[i][j].toFixed(3)}`;};
    const choose=e=>{const cell=e.target.closest('[data-cell]'); if(cell) trace(...cell.dataset.cell.split(',').map(Number));};
    host.onclick=choose;
    host.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();choose(e);}};
    trace(0,d.vocab.indexOf('кот'));
  },
  linearCounts:[1,0],
  linear(host) {
    const x=this.linearCounts, weights=[[2,-1],[-1,2]], scores=[x[0]*2-x[1],-x[0]+x[1]*2], p=ADD.softmax(scores);
    host.innerHTML=ADD.flow([
      {lines:['матч · акции',`x = [${x.join(', ')}]`],key:'matrix'},
      {lines:['W = [[2, −1],','     [−1, 2]]'],key:'scores'},
      {lines:['спорт · бизнес',`z = [${scores.join(', ')}]`],key:'scores'},
      {lines:p.map((v,i)=>`${i?'бизнес':'спорт'} ${v.toFixed(3)}`),key:'prob'},
      {lines:['решение',p[0]>=p[1]?'спорт':'бизнес'],key:'decision'},
    ],'Линейный классификатор');
    const result=document.querySelector('#linear-result');
    if(result) result.textContent=`X [1, 2] × W [2, 2] → Z [1, 2]; решение: ${p[0]>=p[1]?'спорт':'бизнес'}${p[0]===p[1]?' (равенство, выбран первый класс)':''}`;
    return {x,weights,scores,p};
  },
};
QUIZ.figs.task=h=>h.innerHTML=ADD.flow([
  {lines:['текст новости','строка'],key:'input'}, {lines:['вектор признаков','[V]'],key:'matrix'},
  {lines:['вероятности','[C]'],key:'prob'}, {lines:['одна тема','метка'],key:'target'},
]);
QUIZ.figs.tokens=h=>h.innerHTML=ADD.flow([
  {lines:['Команда выиграла','матч!'],key:'input'}, {lines:['команда · выиграла','матч · !'],key:'tokens'},
  {lines:['ID по словарю','[2, 1, 3, 0]'],key:'ids'},
]);
QUIZ.figs.normalization=h=>{
  let s=ADD.box(10,75,225,70,['кошки · кошкой','кошкам']);
  s+=ADD.arrow(235,100,300,50)+ADD.arrow(235,120,300,180);
  s+=ADD.box(310,20,215,60,['лемматизация'],'lemma');
  s+=ADD.arrow(525,50,570,50)+ADD.box(580,20,165,60,['кошка'],'lemma');
  s+=ADD.box(310,150,215,60,['стемминг'],'stem');
  s+=ADD.arrow(525,180,570,180)+ADD.box(580,150,165,60,['кошк'],'stem');
  h.innerHTML=ADD.svg(s,760,235,'Лемматизация и стемминг словоформ');
};
QUIZ.figs.onehot=h=>{
  let s=ADD.text(380,24,'one-hot: одно слово → одна ось','caption');
  ['кот','пёс','рыба'].forEach((word,i)=>{s+=ADD.text(120,65+i*40,word); for(let j=0;j<3;j++) s+=ADD.box(220+j*110,40+i*40,100,35,[i===j?'1':'0']);});
  h.innerHTML=ADD.svg(s,760,175,'One-hot трёх слов');
};
QUIZ.figs.tfidf=h=>W1.matrix(h);
QUIZ.figs.linear=h=>W1.linear(h);
(function () {
  const NS = "http://www.w3.org/2000/svg";
  let serial = 0;
  function el(tag, attrs, parent, text) {
    const node = document.createElementNS(NS, tag);
    for (const [key, value] of Object.entries(attrs)) {
      if (["fill", "stroke"].includes(key)) node.style[key] = value;
      else if (key === "font-size") node.style.fontSize = value + "px";
      else node.setAttribute(key, value);
    }
    if (text != null) node.textContent = text;
    if (parent) parent.appendChild(node);
    return node;
  }
  const svg = (host, w, h) => {
    host.replaceChildren();
    return el("svg", {viewBox: `0 0 ${w} ${h}`, class: "word2vec-diagram", role: "img", "aria-label": host.dataset.fig === "cbow" ? "CBOW: контекст предсказывает центр" : "Skip-Gram: центр предсказывает соседа"}, host);
  };
  const txt = (p,x,y,s,a) => el("text", {x,y,"font-size":12,fill:"var(--ink)",...a},p,s);
  const box = (p,x,y,w,h,a) => el("rect",{x,y,width:w,height:h,rx:3,fill:"var(--panel-sunk)",stroke:"var(--rule-strong)",...a},p);
  function arrow(p,x1,y1,x2,y2) {
    const root = p.tagName === "svg" ? p : p.ownerSVGElement;
    return el("path",{d:`M${x1},${y1} L${x2},${y2}`,stroke:"var(--ink-3)","stroke-width":1.2,fill:"none","marker-end":`url(#${root.dataset.arrow})`},p);
  }
  function defs(s) {
    s.dataset.arrow = "w2v-arrow-" + ++serial;
    const d = el("defs",{},s);
    const marker = el("marker",{id:s.dataset.arrow,viewBox:"0 0 10 10",refX:9,refY:5,markerWidth:7,markerHeight:7,orient:"auto"},d);
    el("path",{d:"M0,0 L10,5 L0,10 z",fill:"var(--ink-3)"},marker);
  }
  function pickable(parent,key,x,y,w,h) {
    const field = {embedding:"lookup",hidden:"lookup",output:"context",distribution:"target",ctx:"lookup"}[key];
    const g = el("g",{"data-pick":key,...(field?{"data-f":field,tabindex:0}:{})},parent);
    g.hit = () => el("rect",{class:"hit",x:x-5,y:y-5,width:w+10,height:h+10,rx:5},g);
    return g;
  }
  const title = (g, L, x, y, label, letter, a) => L
    ? txt(g, x, y, label, Object.assign({ "text-anchor": "middle", "font-size": 13 }, a || {}))
    : txt(g, x, y, letter, Object.assign({ "text-anchor": "middle", "font-size": 16, "font-weight": 700, fill: "var(--cls-3)" }, a || {}));
  const note = (g, L, x, y, t, a) => L ? txt(g, x, y, t, Object.assign({ "text-anchor": "middle", "font-size": 10, fill: "var(--ink-3)" }, a || {})) : null;

  function skipgram(host, L) {
    const W = 760, H = L ? 250 : 220, s = svg(host, W, H); defs(s);
    const top = 40, Vh = 150, d = 56;
    let g = pickable(s, "onehot", 44, top, 18, Vh);
    for (let k = 0; k < 15; k++) el("rect", { x: 44, y: top + k * 10, width: 18, height: 9, fill: k === 6 ? "var(--cls-0)" : "var(--panel-sunk)", stroke: "var(--rule)", "stroke-width": .5 }, g);
    title(g, L, 53, top - 14, "x", "A"); note(g, L, 53, top + Vh + 16, "one-hot · |V|");
    if (L) txt(g, 66, top + 67, "ест = 1", { "font-size": 9.5, fill: "var(--cls-0)" });
    g.hit();
    arrow(s, 66, top + Vh / 2, 96, top + Vh / 2);
    g = pickable(s, "embedding", 100, top, d + 30, Vh);
    box(g, 100, top, d + 30, Vh, { fill: "var(--panel)" });
    el("rect", { x: 100, y: top + 60, width: d + 30, height: 9, fill: "var(--cls-0)" }, g);
    title(g, L, 100 + (d + 30) / 2, top - 14, "входные векторы", "B"); note(g, L, 100 + (d + 30) / 2, top + Vh + 16, "строка: слово"); g.hit();
    arrow(s, 190, top + Vh / 2, 240, top + Vh / 2); note(s, L, 215, top + Vh / 2 - 8, "строка", { "font-size": 9 });
    g = pickable(s, "hidden", 244, top + Vh / 2 - 9, 86, 18);
    for (let k = 0; k < 8; k++) el("rect", { x: 244 + k * 11, y: top + Vh / 2 - 9, width: 10, height: 18, fill: "var(--cls-0)", opacity: .35 + .08 * ((k * 5) % 7), stroke: "var(--rule)", "stroke-width": .5 }, g);
    title(g, L, 287, top + Vh / 2 - 18, "h · d", "C"); note(g, L, 287, top + Vh / 2 + 26, "строка «ест»"); g.hit();
    arrow(s, 334, top + Vh / 2, 384, top + Vh / 2);
    g = pickable(s, "output", 388, top + Vh / 2 - 40, 150, 80);
    box(g, 388, top + Vh / 2 - 40, 150, 80, { fill: "var(--panel)" });
    el("rect", { x: 388 + 66, y: top + Vh / 2 - 40, width: 9, height: 80, fill: "var(--cls-1)" }, g);
    title(g, L, 463, top + Vh / 2 - 48, "выходные векторы", "D"); note(g, L, 463, top + Vh / 2 + 56, "столбец: слово");
    if (L) txt(g, 388 + 71, top + Vh / 2 + 70, "рыбу", { "text-anchor": "middle", "font-size": 9.5, fill: "var(--cls-1)" });
    g.hit();
    arrow(s, 542, top + Vh / 2, 590, top + Vh / 2); note(s, L, 566, top + Vh / 2 - 8, "softmax", { "font-size": 9 });
    g = pickable(s, "distribution", 594, top, 60, Vh);
    const ps = [.02, .04, .03, .07, .02, .05, .03, .41, .04, .06, .03, .08, .04, .05, .03];
    ps.forEach((value, k) => { const p = value / ps.reduce((a, b) => a + b, 0); return el("rect", { x: 594, y: top + k * 10, width: 2 + 110 * p, height: 9, fill: k === 7 ? "var(--cls-1)" : "var(--rule-strong)" }, g); });
    if (L) { txt(g, 594, top - 14, "P(сосед | ест)", { "font-size": 13 }); note(g, L, 594, top + Vh + 16, "V вероятностей; сумма 1", { "text-anchor": "start" }); txt(g, 594 + 50, top + 78, "↑ рыбу", { "font-size": 9.5, fill: "var(--cls-1)" }); }
    else title(g, L, 624, top - 14, "", "E");
    g.hit();
    if (L) txt(s, W / 2, H - 8, "Пара «ест» → «рыбу»: увеличиваем P(рыбу | ест)", { "text-anchor": "middle", "font-size": 11, fill: "var(--ink-2)" });
  }

  function cbow(host, L) {
    const W = 760, H = L ? 260 : 230, s = svg(host, W, H); defs(s);
    const top = 40, Vh = 150, ctx = ["кот", "утром", "свежую", "рыбу"], rows = [18, 52, 92, 124];
    let g = pickable(s, "ctx", 14, top + 4, 92, 4 * 36 - 10);
    ctx.forEach((w, i) => { box(g, 14, top + 4 + i * 36, 92, 24); txt(g, 60, top + 21 + i * 36, w, { "text-anchor": "middle", "font-size": 12, "font-family": "var(--mono)" }); });
    title(g, L, 60, top - 14, "контекст", "A"); g.hit();
    ctx.forEach((w, i) => arrow(s, 108, top + 16 + i * 36, 146, top + rows[i] + 4));
    g = pickable(s, "embedding", 150, top, 86, Vh);
    box(g, 150, top, 86, Vh, { fill: "var(--panel)" });
    rows.forEach(r => el("rect", { x: 150, y: top + r, width: 86, height: 8, fill: "var(--cls-0)" }, g));
    title(g, L, 193, top - 14, "входные векторы", "B"); note(g, L, 193, top + Vh + 16, "четыре строки"); g.hit();
    const cx = 272, cy = top + Vh / 2;
    rows.forEach(r => el("path", { d: `M236,${top + r + 4} L${cx - 9},${cy}`, stroke: "var(--ink-3)", "stroke-width": 1, fill: "none" }, s));
    el("circle", { cx, cy, r: 9, fill: "var(--panel)", stroke: "var(--ink-3)" }, s); txt(s, cx, cy + 4, "÷", { "text-anchor": "middle", "font-size": 12 });
    arrow(s, cx + 10, cy, 300, cy);
    g = pickable(s, "hidden", 304, cy - 9, 86, 18); g.dataset.f = "average";
    for (let k = 0; k < 8; k++) el("rect", { x: 304 + k * 11, y: cy - 9, width: 10, height: 18, fill: "var(--cls-0)", opacity: .35 + .08 * ((k * 3) % 7), stroke: "var(--rule)", "stroke-width": .5 }, g);
    title(g, L, 347, cy - 18, "h · d", "C"); note(g, L, 347, cy + 26, "среднее четырёх строк"); g.hit();
    arrow(s, 394, cy, 436, cy);
    g = pickable(s, "output", 440, cy - 40, 140, 80);
    box(g, 440, cy - 40, 140, 80, { fill: "var(--panel)" });
    el("rect", { x: 500, y: cy - 40, width: 9, height: 80, fill: "var(--cls-1)" }, g);
    title(g, L, 510, cy - 48, "выходные векторы", "D");
    if (L) txt(g, 505, cy + 54, "ест", { "text-anchor": "middle", "font-size": 9.5, fill: "var(--cls-1)" });
    g.hit();
    arrow(s, 584, cy, 622, cy); note(s, L, 603, cy - 8, "softmax", { "font-size": 9 });
    g = pickable(s, "distribution", 626, top, 60, Vh);
    const ps = [.03, .05, .02, .06, .03, .04, .38, .05, .03, .07, .02, .06, .04, .03, .05];
    ps.forEach((value, k) => { const p = value / ps.reduce((a, b) => a + b, 0); return el("rect", { x: 626, y: top + k * 10, width: 2 + 110 * p, height: 9, fill: k === 6 ? "var(--cls-1)" : "var(--rule-strong)" }, g); });
    if (L) { txt(g, 656, top - 14, "P(центр | контекст)", { "text-anchor": "middle", "font-size": 13 }); txt(g, 626 + 46, top + 68, "↑ ест", { "font-size": 9.5, fill: "var(--cls-1)" }); }
    else title(g, L, 656, top - 14, "", "E");
    g.hit();
    if (L) txt(s, W / 2, H - 8, "Одно окно: кот утром ___ свежую рыбу → ест", { "text-anchor": "middle", "font-size": 11, fill: "var(--ink-2)" });
  }

  QUIZ.figs.skip = h => skipgram(h, true);
  QUIZ.figs["skip-question"] = h => skipgram(h, false);
  QUIZ.figs.cbow = h => cbow(h, true);
})();
QUIZ.figs.negative=host=>{
  let s=ADD.text(16,24,'1. Готовим пары и метки','caption','start');
  s+=ADD.box(16,44,330,65,['текст: кот ест рыбу','сосед «рыбу» → метка 1'],'samples');
  s+=ADD.box(394,44,350,65,['случайные слова из словаря','«стол», «бег» → метки 0, 0'],'samples');
  s+=ADD.text(16,150,'2. Вычисляем оценки и сравниваем с метками','caption','start');
  // Один входной вектор используется во всех трёх парах.
  s+=ADD.text(105,309,'вектор «ест»');
  let center='';
  for(let j=0;j<8;j++)center+=`<rect x="${22+j*21}" y="321" width="19" height="22" class="accent"/>`;
  s+=`<g data-f="lookup" tabindex="0">${center}</g>`;
  let candidates=ADD.text(300,187,'векторы кандидатов');
  ['рыбу','стол','бег'].forEach((word,i)=>{
    const y=204+i*38;
    candidates+=ADD.text(212,y+16,word,'','end');
    for(let j=0;j<8;j++)candidates+=`<rect x="${230+j*17}" y="${y}" width="15" height="22" class="accent"/>`;
  });
  s+=`<g data-f="context" tabindex="0">${candidates}</g>`;
  s+=ADD.arrow(368,252,402,252);
  s+='<path d="M190 332 L412 332 L412 268" marker-end="url(#MARKER)"/>';
  s+='<g data-f="pair" tabindex="0"><circle cx="412" cy="252" r="15" style="fill:var(--panel);stroke:var(--ink-3)"/>'+ADD.text(412,257,'·')+'</g>';
  s+=ADD.arrow(428,252,455,252);
  s+=ADD.text(500,190,'оценки z');
  let scores='';
  ['z₁','z₂','z₃'].forEach((z,i)=>scores+=ADD.box(460,204+i*38,80,28,[z]));
  s+=`<g data-f="pair" tabindex="0">${scores}</g>`;
  s+=ADD.box(600,175,140,65,['метки y','[1, 0, 0]'],'labels');
  s+=ADD.arrow(670,240,670,279);
  s+='<path d="M542 254 L566 254 L566 312 L598 312" marker-end="url(#MARKER)"/>';
  s+=ADD.box(600,285,140,60,['сравнение','BCE(z, y)'],'target');
  s+=ADD.text(380,388,'По ошибкам на парах обновляем входные и выходные векторы','caption');
  host.innerHTML=ADD.svg(s,760,410,'Negative sampling: подготовка меток и вычисление функции потерь');
};
const POOLING_EXAMPLE = JSON.parse(document.querySelector('#add-data').textContent).pooling;
function drawDocumentMean(host) {
  const data=POOLING_EXAMPLE, width=data.mean.length;
  let input=ADD.text(225,26,`векторы Word2Vec · [${data.tokens.length}, ${width}]`,'caption');
  data.tokens.forEach((word,i)=>{
    const y=62+i*42;
    input+=ADD.text(83,y+25,word,'','end');
    data.word_vectors[i].forEach((value,j)=>input+=ADD.box(100+j*64,y,60,36,[value.toFixed(3)]));
  });
  let result=ADD.text(556,74,'среднее по словам','caption');
  data.mean.forEach((value,j)=>result+=ADD.box(414+j*80,100,75,40,[value.toFixed(3)]));
  result+=ADD.text(574,185,`вектор документа · [${width}]`,'caption');
  host.innerHTML=ADD.svg(`<g data-f="lookup" tabindex="0">${input}</g>`+ADD.arrow(360,120,406,120)+`<g data-f="pool" tabindex="0">${result}</g>`,760,225,'Усреднение: конкретные векторы слов и вектор документа');
}
function drawDocumentProjection(host) {
  const data=POOLING_EXAMPLE, projection=data.projection;
  let input=ADD.text(82,63,`среднее · [${data.mean.length}]`,'caption');
  data.mean.forEach((v,i)=>input+=ADD.box(24,86+i*36,116,31,[v.toFixed(3)]));
  let learned=ADD.text(279,41,'обученная матрица','caption')+ADD.text(279,65,`[${projection.weight.length}, ${projection.output.length}]`);
  projection.weight.forEach((row,i)=>row.forEach((v,j)=>learned+=ADD.box(204+j*84,86+i*36,80,31,[v.toFixed(3)])));
  learned+=ADD.text(557,300,'смещение','caption','start');
  learned+=ADD.box(412,265,126,62,projection.bias.map(v=>v.toFixed(3)));
  let output=ADD.text(650,65,`вектор · [${projection.output.length}]`,'caption');
  projection.output.forEach((v,i)=>output+=ADD.box(591,109+i*44,119,36,[v.toFixed(3)]));
  let s=`<g data-f="pool" tabindex="0">${input}</g>`+ADD.arrow(145,153,196,153);
  s+=`<g data-f="projection" tabindex="0">${learned}</g>`+ADD.arrow(375,153,457,153);
  s+='<circle cx="475" cy="153" r="16" style="fill:var(--panel);stroke:var(--ink-3)"/>'+ADD.text(475,158,'+');
  s+=ADD.arrow(475,262,475,173)+ADD.arrow(494,153,583,153);
  s+=`<g data-f="projection" tabindex="0">${output}</g>`;
  s+=ADD.text(380,365,'Матрица и смещение обучаются по меткам документов','caption');
  host.innerHTML=ADD.svg(s,760,390,'Проекция среднего вектора через обученную матрицу');
}
QUIZ.figs.pool=drawDocumentMean;
QUIZ.figs.projection=drawDocumentProjection;

QUIZ.figs.fast=h=>h.innerHTML=ADD.flow([
  {lines:['<ко · кош · ошк','шки · ки>'],key:'subword'},
  {lines:['векторы частей','[число частей, d]'],key:'subword'},
  {lines:['сумма','вектор [d]'],key:'subword'},
],'Символьные части fastText');
document.addEventListener('DOMContentLoaded',()=>{
  const tabs=[...document.querySelectorAll('#document-representation [role="tab"]')];
  function selectTab(tab,focus=false) {
    tabs.forEach(button=>{
      const active=button===tab;
      button.setAttribute('aria-selected',String(active));
      button.tabIndex=active?0:-1;
      button.classList.toggle('sel',active);
      document.getElementById(button.getAttribute('aria-controls')).hidden=!active;
    });
    if(focus)tab.focus();
  }
  tabs.forEach((tab,i)=>{
    tab.addEventListener('click',()=>selectTab(tab));
    tab.addEventListener('keydown',event=>{
      if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;
      event.preventDefault();
      const index=event.key==='Home'?0:event.key==='End'?tabs.length-1:(i+(event.key==='ArrowRight'?1:-1)+tabs.length)%tabs.length;
      selectTab(tabs[index],true);
    });
  });

  document.querySelector('#repeat-word').onclick=e=>{W1.repeat=!W1.repeat; e.target.textContent=W1.repeat?'Убрать повтор «кот»':'Повторить «кот»'; W1.matrix(document.querySelector('[data-fig="tfidf"]'));};
  document.querySelector('#reverse-words').onclick=()=>{W1.reverse=!W1.reverse; W1.matrix(document.querySelector('[data-fig="tfidf"]'));};
  document.querySelector('#linear-controls').onclick=e=>{const word=e.target.dataset.word; if(word===undefined)return; if(word==='reset')W1.linearCounts=[1,0];else W1.linearCounts[+word]++; W1.linear(document.querySelector('[data-fig="linear"]'));};
  const data=JSON.parse(document.querySelector('#add-data').textContent);
  const morphology=data.morphology;
  document.querySelector('#normalization-table').innerHTML=ADD.table(['Слово','Стем · Snowball','Возможные леммы · pymorphy3','Случай'],morphology.rows.map(r=>[r.word,r.stem,r.lemmas.join(', '),r.case]));
  document.querySelector('#normalization-versions').innerHTML=TXT('normalization-versions',{nltk:morphology.versions.nltk,pymorphy:morphology.versions.pymorphy3,dict:morphology.versions['pymorphy3-dicts-ru']});
  const results=data.results.filter(r=>r.head==='LogisticRegression' && (r.rep.startsWith('counts')||r.rep.startsWith('tf-idf')));
  document.querySelector('#classification-results').innerHTML=ADD.table(['Представление','Accuracy','Macro-F1'],results.map(r=>[r.rep,(r.acc*100).toFixed(2)+'%',r.f1.toFixed(4)]));
});

QUIZ.figs.oov=h=>{
  let s=ADD.text(380,25,'фиксированный словарь: UNK → 0 · кот → 1 · спит → 2','caption');
  ['кот','квокка','капибара'].forEach((word,i)=>{
    const y=50+i*65;
    s+=ADD.box(20,y,170,45,[word])+ADD.arrow(190,y+22,280,y+22);
    s+=ADD.box(290,y,170,45,[i?'UNK → 0':'кот → 1'],'unknown');
    s+=ADD.arrow(460,y+22,540,y+22)+ADD.box(550,y,190,45,[i?'один вектор UNK':'вектор «кот»'],'unknown');
  });
  h.innerHTML=ADD.svg(s,760,255,'OOV: разные неизвестные слова получают общий UNK');
};
