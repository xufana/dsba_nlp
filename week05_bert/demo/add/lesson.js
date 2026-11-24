/* BERT: вход, задачи предобучения, прикладные выходы и современный энкодер. */
const BERT_DATA = JSON.parse(document.getElementById('add-data').textContent);
const BERT = {
  token: 2, selected: new Set(), checked: false, maskRound: 0, modernToken: 4,
  tokens: ['[CLS]', 'the', 'cat', '[SEP]', 'it', 'sleeps', '[SEP]'],
  col: i => 150 + i * 86,
  architecture(host, mode = 'input') {
    const T = Transformer, token = this.token;
    let s = mode === 'input' ? ADD.text(380,25,'BERT: стек энкодера','caption') : '';
    const outY = 72;
    this.tokens.forEach((t,i) => {
      const x = this.col(i), on = i === token;
      s += T.clickable(T.cell(x-38,480,76,30,t,'--cls-0',on),'data-token',i);
      for (const [y, label, color] of [[425,'токен','--cls-0'],[385,i < 4 ? 'A' : 'B','--cls-2'],[345,String(i),'--cls-1']]) {
        s += T.vec(x-30,y,['','',''],color,on,20,23);
        s += ADD.text(x, y+38, label,'small');
      }
      s += T.path(`M ${x} 343 V 309`) + ADD.text(x,305,'Σ','strong') + T.path(`M ${x} 290 V 275`);
      s += T.vec(x-30,outY,['','',''],'--cls-0',on,20,23);
      s += T.path(`M ${x} 140 V ${outY+24}`);
    });
    s += ADD.text(17,439,'слово','small','start') + ADD.text(17,399,'сегмент','small','start') + ADD.text(17,359,'позиция','small','start');
    for (const y of [150,218]) {
      s += T.rect(99,y,638,54,'--cls-0') + ADD.text(48,y+32,y===150?'блок 2':'блок 1','small');
      s += T.rect(108,y+31,620,16,'--cls-2');
      this.tokens.forEach((_,i) => s += T.rect(this.col(i)-30,y+7,60,16,'--cls-3',i===token));
      this.tokens.forEach((_,i) => s += T.path(`M ${this.col(i)} ${y} V ${y-10}`));
    }
    s += ADD.text(418,133,'H: контекстный вектор на каждой позиции','caption');
    s += ADD.text(418,540,'широкая полоса: attention · отдельные ячейки: FFN','small');
    if (mode === 'nsp') {
      s += T.path('M 150 71 V 50 H 390 V 42','--cls-1') + T.cell(280,23,360,32,'pooler → последовательная / случайная','--cls-1',true);
    }
    T.mount(host,s,565,'BERT: суммы эмбеддингов, два блока и выходные векторы');
  },
  mlm(host) {
    const T=Transformer, raw=['she','went','to','the','store','for','milk'], input=['she','[MASK]','to','the','banana','for','milk'];
    let s=ADD.text(380,25,'исходные токены → вход → представления → цели','caption');
    raw.forEach((t,i) => {
      const x=52+i*99, target=[1,4,6].includes(i), selected=this.selected.has(i);
      s+=T.cell(x,55,88,32,t,'--cls-0',target)+T.path(`M ${x+44} 88 V 110`);
      s+=T.clickable(T.cell(x,115,88,38,input[i],selected?'--cls-1':'--cls-0',selected),'data-mlm',i);
      s+=T.path(`M ${x+44} 153 V 180`)+T.vec(x+14,185,['','',''],'--cls-2',false,20,25);
      if(this.checked) s+=T.path(`M ${x+44} 212 V 240`)+T.cell(x,245,88,34,target?t:'—',target?'--cls-1':'--ink-3',target);
    });
    s+=ADD.text(380,320,this.checked?'цель есть в выбранных позициях; «milk» оставлен без замены':'нажмите позиции, где будет прямое слагаемое MLM-ошибки','small');
    T.mount(host,s,345,'Позиции MLM: маска, случайная замена и сохранённый токен');
    const result=document.getElementById('mlm-result');
    result.textContent=this.checked ? ([1,4,6].every(i=>this.selected.has(i))&&this.selected.size===3 ? 'Верно: выбраны все три случая.' : 'Цели: went, store, milk. Сравните выбранные позиции с нижней строкой.') : `Выбрано позиций: ${this.selected.size}`;
  },
  predictions() {
    const item=BERT_DATA.mlm[+document.getElementById('mlm-example').value];
    document.getElementById('mlm-predictions').innerHTML='<p class="mono">'+ADD.esc(item.text)+'</p>'+ADD.table(['Токен','Вероятность'],item.top.map(([word,p])=>[word,p.toFixed(2)]));
  },
  heads(host) {
    const T=Transformer, task=document.getElementById('head-task').value, full=document.getElementById('head-train').value==='all';
    const tokens=task==='qa'?['[CLS]','who','[SEP]','Ada','met','Acme','[SEP]']:['[CLS]','Ada','met','Acme','in','Paris','[SEP]'];
    let s=ADD.text(380,24,full?'обучаются энкодер и голова':'обучается голова; энкодер заморожен','caption');
    tokens.forEach((t,i)=>{
      const x=58+i*99;
      s+=T.cell(x,355,88,32,t,'--cls-0')+T.path(`M ${x+44} 354 V 320`)+T.vec(x+14,275,['','',''],full?'--cls-1':'--ink-3',full,20,25)+T.path(`M ${x+44} 274 V 245`);
      s+=T.vec(x+14,160,['','',''],full?'--cls-1':'--ink-3',full,20,25);
      if(task==='seq'&&i===0)s+=T.path(`M ${x+44} 158 V 120 H 380 V 102`);
      if(task!=='seq'){
        s+=T.path(`M ${x+44} 158 V 130`);
        if(task==='ner')s+=T.cell(x,82,88,38,['—','B-PER','O','B-ORG','O','B-LOC','—'][i],'--cls-1',true);
        else {
          const inDocument=i>=3&&i<=5;
          s+=T.cell(x,55,88,25,inDocument?(i===3?'start ✓':'start'):'×',inDocument?'--cls-1':'--ink-3',i===3);
          s+=T.cell(x,90,88,25,inDocument?(i===3?'end ✓':'end'):'×',inDocument?'--cls-2':'--ink-3',i===3);
        }
      }
    });
    s+=T.cell(58,202,682,42,'двунаправленный энкодер',full?'--cls-1':'--ink-3',full);
    if(task==='seq')s+=T.cell(255,55,250,45,'P(тема | текст)','--cls-1',true);
    s+=ADD.text(380,425,task==='qa'?'каждая строка softmax — по позициям; ответ: Ada':task==='ner'?'softmax по меткам отдельно в каждой позиции':'softmax по классам текста','small');
    T.mount(host,s,450,'Классификация, NER и границы ответа на выходе энкодера');
  },
  evolution(host) {
    const T=Transformer, mode=document.getElementById('pretrain-model').value, words=['she','went','to','the','store','for','milk'];
    const chosen=mode==='roberta'&&this.maskRound%2?[0,2,5]:[1,4,6];
    let s=ADD.text(380,28,mode==='electra'?'генератор заполняет выбранные позиции; дискриминатор читает весь результат':mode==='roberta'?'MLM · новая маска при другом предъявлении · NSP отсутствует':'MLM + NSP · показан один вариант маски','small');
    words.forEach((w,i)=>{
      const x=45+i*101, pick=chosen.includes(i), replaced=mode==='electra'&&i===4;
      const middle=mode==='electra'?(i===4?'banana':w):(pick?'[MASK]':w);
      s+=T.cell(x,58,90,32,w,'--cls-0')+T.path(`M ${x+45} 90 V 112`)+T.cell(x,118,90,35,middle,pick?'--cls-1':'--cls-0',pick)+T.path(`M ${x+45} 153 V 183`);
      s+=T.vec(x+15,240,['','',''],'--cls-2',false,20,24)+T.path(`M ${x+45} 264 V 288`);
      s+=T.cell(x,298,90,35,mode==='electra'?(replaced?'заменён':'исходный'):(pick?w:'—'),mode==='electra'||pick?'--cls-1':'--ink-3');
    });
    s+=T.cell(45,185,696,36,mode==='electra'?'дискриминатор · энкодер':'энкодер → голова MLM','--cls-2');
    s+=ADD.text(380,375,mode==='electra'?'went и milk предложены генератором и совпали с оригиналом':'нижняя строка: целевые ответы MLM','small');
    T.mount(host,s,405,'BERT, RoBERTa и ELECTRA на одной последовательности');
    document.getElementById('mask-next').disabled=mode!=='roberta';
  },
  rope(host) {
    const T=Transformer, shift=+document.getElementById('rope-shift').value, pair=+document.getElementById('rope-pair').value;
    const p=3+shift,r=8+shift,q=[1,0,.5,-1],k=[.5,1,-1,.5],rq=T.rotate(q,p),rk=T.rotate(k,r);
    let s=ADD.text(380,25,`позиции ${p} и ${r} · расстояние ${r-p}`,'caption');
    const vector=(cx,cy,vec,color,label)=>{
      const norm=Math.hypot(...vec),x=cx+72*vec[0]/norm,y=cy-72*vec[1]/norm;
      return `<circle cx="${cx}" cy="${cy}" r="78" style="fill:none;stroke:var(--rule-strong)"/>`+T.path(`M ${cx-90} ${cy} H ${cx+90}`,'--rule-strong',false)+T.path(`M ${cx} ${cy-90} V ${cy+90}`,'--rule-strong',false)+T.path(`M ${cx} ${cy} L ${x} ${y}`,color)+ADD.text(cx,cy+125,label,'caption');
    };
    s+=`<g data-f="rotation">${vector(210,155,rq.slice(pair*2,pair*2+2),'--cls-0','Q после поворота')}${vector(550,155,rk.slice(pair*2,pair*2+2),'--cls-1','K после поворота')}</g>`;
    s+=`<g data-f="angle">${ADD.text(380,320,`углы: ${(p/10000**(pair/2)).toFixed(3)} и ${(r/10000**(pair/2)).toFixed(3)} рад`,'small')}</g>`;
    T.mount(host,s,350,'RoPE: две пары координат Q и K с общим сдвигом позиций');
    document.getElementById('rope-shift-value').textContent=shift;
    document.getElementById('rope-result').textContent=`Исходные пары: q=[${q.slice(pair*2,pair*2+2)}], k=[${k.slice(pair*2,pair*2+2)}]. Вклад пары: ${T.dot(rq.slice(pair*2,pair*2+2),rk.slice(pair*2,pair*2+2)).toFixed(6)} · полное qᵀk: ${T.dot(rq,rk).toFixed(6)}`;
  },
  ffnValues(kind,coordinate,raw){
    const T=Transformer,gate=[-1,1,2],value=[2,-1,.5];gate[coordinate]=raw;
    const activated=gate.map(x=>T[kind](x)),h=T.gate(value,gate,kind),out=[T.dot(h,[1,.5,-1]),T.dot(h,[-.5,1,.25])];
    return {gate,value,activated,h,out};
  },
  ffn(host) {
    const T=Transformer, i=+document.getElementById('ffn-coordinate').value,kind=document.getElementById('ffn-kind').value;
    const {gate,value,activated,h,out}=this.ffnValues(kind,i,+document.getElementById('ffn-gate').value);
    let s=ADD.text(380,25,kind==='gelu'?'GeGLU · GELU в управляющей ветви':'SwiGLU · SiLU в управляющей ветви','caption');
    s+=T.vec(352,55,['x₁','x₂'],'--cls-0',false,28,25)+T.path('M 380 81 V 94 H 210 V 108')+T.path('M 380 94 H 550 V 108');
    s+=T.cell(130,110,160,35,'Wᵤ · значения','--cls-0')+T.cell(470,110,160,35,'Wg · управление','--cls-1');
    value.forEach((v,j)=>{s+=`<g data-f="value">${T.cell(135+j*50,170,47,28,v.toFixed(2),'--cls-0',i===j)}</g>`;s+=`<g data-f="gate">${T.cell(475+j*50,170,47,28,gate[j].toFixed(2),'--cls-1',i===j)}</g>`;});
    s+=T.path('M 210 146 V 168')+T.path('M 550 146 V 168');
    s+=T.path('M 550 200 V 215')+T.cell(468,218,165,35,kind==='gelu'?'GELU(g)':'SiLU(g)','--cls-1');
    s+=T.path('M 210 200 V 285 H 365 V 308')+T.path('M 550 255 V 285 H 395 V 308');
    s+=T.cell(345,310,70,32,'⊙','--cls-2',true)+T.path('M 380 344 V 362');
    h.forEach((v,j)=>s+=`<g data-f="product">${T.cell(305+j*50,365,48,30,v.toFixed(3),'--cls-2',j===i)}</g>`);
    s+=T.path('M 380 397 V 420');
    s+=`<g data-f="down">${T.cell(170,423,420,35,'W↓ → выход полной ширины','--cls-3',true)}</g>`;
    s+=T.path('M 380 460 V 478')+T.vec(310,482,out,'--cls-3',false,70,28);
    T.mount(host,s,535,'Две проекции gated FFN, активация, произведение и выходная проекция');
    document.getElementById('ffn-result').textContent=`Координата ${'abc'[i]}: ${value[i]} × ${activated[i].toFixed(4)} = ${h[i].toFixed(4)} · выход [${out.map(x=>x.toFixed(3)).join(', ')}]`;
  },
  norm(host) {
    const T=Transformer,x=BERT_DATA.reference.norms[+document.getElementById('norm-input').value].x,pre=document.getElementById('norm-place').value==='pre';
    let s=ADD.text(380,25,pre?'Pre-LN · подслой читает нормированную копию':'Post-LN · нормировка после сложения','caption');
    const steps=pre?['x','Norm','Attention','+']:['x','Attention','+','Norm'];
    steps.forEach((label,i)=>{s+=T.cell(55+i*172,70,140,40,label,i===3?'--cls-1':'--cls-0');if(i<3)s+=T.path(`M ${195+i*172} 90 H ${224+i*172}`);});
    s+=T.path(pre?'M 90 70 V 47 H 641 V 69':'M 90 70 V 47 H 469 V 69','--cls-1');
    s+=ADD.text(380,168,`x = [${x.join(', ')}]`,'num');
    s+=`<g data-f="ln">${T.cell(60,200,210,35,'LayerNorm','--cls-0')}${ADD.text(500,223,T.norm(x).map(v=>v.toFixed(3)).join(' · '),'num')}</g>`;
    s+=`<g data-f="rms">${T.cell(60,260,210,35,'RMSNorm','--cls-1')}${ADD.text(500,283,T.norm(x,true).map(v=>v.toFixed(3)).join(' · '),'num')}</g>`;
    T.mount(host,s,325,'Положение нормы и два способа нормировки координат одного токена');
    document.getElementById('norm-result').textContent='ε = 0.00001 · масштаб 1 · сдвиг 0';
  },
  global(layer,mode='modern') { return mode==='bert'||(layer-1)%BERT_DATA.modern.every===0; },
  allowed(layer,i,j,mode='modern'){return this.global(layer,mode)||Math.abs(i-j)<=1;},
  reachable(depth,token,mode='modern',n=9) {
    let positions=new Set([token]);
    for(let layer=depth;layer>=1;layer--) {
      const next=new Set();for(const i of positions)for(let j=0;j<n;j++)if(this.allowed(layer,i,j,mode))next.add(j);
      positions=next;
    }
    return positions;
  },
  modern(host) {
    const T=Transformer,layer=+document.getElementById('modern-layer').value,mode=document.getElementById('modern-mode').value,global=this.global(layer,mode),reach=this.reachable(layer,this.modernToken,mode);
    let s=ADD.text(380,25,`слой ${layer}: ${global?'глобальный':'локальный'} attention`,'caption');
    for(let i=0;i<9;i++)for(let j=0;j<9;j++){
      const allowed=this.allowed(layer,i,j,mode);
      s+=T.rect(220+j*29,65+i*29,27,27,allowed?'--cls-0':'--ink-3',allowed&&i===this.modernToken);
    }
    s+=ADD.text(350,51,'ключи','small')+ADD.text(150,202,'запросы','small');
    for(let i=0;i<9;i++)s+=T.clickable(T.cell(54+i*77,365,65,32,String(i),reach.has(i)?'--cls-1':'--ink-3',i===this.modernToken),'data-modern',i);
    s+=ADD.text(380,430,'нижняя строка: доступный исходный контекст через весь пройденный стек','small');
    T.mount(host,s,455,'Матрица локальных или глобальных связей и достижимые входные позиции');
    document.getElementById('modern-layer-value').textContent=layer;
    document.getElementById('modern-result').textContent=`Позиция ${this.modernToken}: через ${layer} сл. доступны ${reach.size} из 9 входных позиций. Учебное локальное окно: позиция и ближайшие соседи.`;
  },
  padding(host) {
    const T=Transformer,off=document.getElementById('padding-off').checked,lengths=[5,2,4];
    let s=ADD.text(380,25,off?'непустые позиции; границы документов сохранены':'батч с выравниванием по самому длинному документу','caption');
    if(!off)lengths.forEach((n,row)=>{
      for(let i=0;i<5;i++)s+=T.cell(150+i*85,65+row*55,75,35,i<n?`${'ABC'[row]}${i}`:'PAD',i<n?`--cls-${row}`:'--ink-3');
    });
    else {
      let index=0;lengths.forEach((n,row)=>{for(let i=0;i<n;i++,index++)s+=T.cell(44+index*62,105,56,38,`${'ABC'[row]}${i}`,`--cls-${row}`);});
      s+=ADD.text(380,185,'attention: A↔A · B↔B · C↔C','caption');
    }
    T.mount(host,s,255,'Документы разной длины с padding и без него');
    document.getElementById('padding-result').textContent=`${off?11:15} позиций обрабатываются; содержательных позиций 11; документов 3.`;
  },
};
Object.assign(QUIZ.values,{bert_width:BERT_DATA.body.d,bert_layers:BERT_DATA.body.layers,bert_context:BERT_DATA.body.maxPos,
  mlm_rate:BERT_DATA.recipe.selected,mask_rate:BERT_DATA.recipe.mask,random_rate:BERT_DATA.recipe.random,keep_rate:BERT_DATA.recipe.unchanged,
  global_every:BERT_DATA.modern.every,local_window:BERT_DATA.modern.window,modern_context:BERT_DATA.modern.context,modern_tokens:BERT_DATA.modern.trainingTokens});
const bertDrawers={bert:h=>BERT.architecture(h),mlm:h=>BERT.mlm(h),nsp:h=>BERT.architecture(h,'nsp'),heads:h=>BERT.heads(h),evolution:h=>BERT.evolution(h),rope:h=>BERT.rope(h),ffn:h=>BERT.ffn(h),norm:h=>BERT.norm(h),modern:h=>BERT.modern(h),padding:h=>BERT.padding(h)};
Object.assign(QUIZ.figs,bertDrawers);
function redrawAll(){for(const host of document.querySelectorAll('[data-fig]'))bertDrawers[host.dataset.fig](host);BERT.predictions();}
document.addEventListener('DOMContentLoaded',()=>{
  document.querySelectorAll('.add-controls select,.add-controls input').forEach(el=>{el.addEventListener('input',()=>{BERT.token=+document.getElementById('bert-token').value;redrawAll();});});
  document.getElementById('mlm-check').onclick=()=>{BERT.checked=true;redrawAll();};
  document.getElementById('mlm-reset').onclick=()=>{BERT.selected.clear();BERT.checked=false;redrawAll();};
  document.getElementById('mask-next').onclick=()=>{BERT.maskRound++;redrawAll();};
  const activate=e=>{
    const node=e.target.closest('[data-token],[data-mlm],[data-modern]');if(!node)return;
    if(node.hasAttribute('data-token')){BERT.token=+node.dataset.token;document.getElementById('bert-token').value=BERT.token;}
    if(node.hasAttribute('data-mlm')){const i=+node.dataset.mlm;BERT.selected.has(i)?BERT.selected.delete(i):BERT.selected.add(i);BERT.checked=false;}
    if(node.hasAttribute('data-modern'))BERT.modernToken=+node.dataset.modern;
    redrawAll();
  };
  document.addEventListener('click',activate);document.addEventListener('keydown',e=>{if((e.key==='Enter'||e.key===' ')&&e.target.matches('[data-token],[data-mlm],[data-modern]')){e.preventDefault();activate(e);}});
  BERT.predictions();
});

/* Схема DSBA week04, autumn-2026 e24968d5eaf0a7a721fd14c412bd7a98a3d335cf: исходная отрисовка и три режима. */
(function dsbaBertPicture() {
const $ = (selector, root) => (root || document).querySelector(selector);
const $$ = (selector, root) => [...(root || document).querySelectorAll(selector)];
const esc = ADD.esc;
const NS = 'http://www.w3.org/2000/svg';
const REDRAW = [];
function svg(w, h) { const s = document.createElementNS(NS, "svg"); s.setAttribute("viewBox", `0 0 ${w} ${h}`); s.setAttribute("width", "100%"); return s; }
const PAINT = { fill: 1, stroke: 1 };
function el(tag, attrs, text) {
  const n = document.createElementNS(NS, tag); let style = "";
  for (const k in attrs) { const v = attrs[k]; if (PAINT[k] && typeof v === "string" && v.startsWith("var(")) style += `${k}:${v};`; else n.setAttribute(k, v); }
  if (style) n.setAttribute("style", style); if (text != null) n.textContent = text; return n;
}

const TIP = $("#tip");
function tipOn(node, html) {
  node.addEventListener("pointerenter", e => { TIP.innerHTML = html; TIP.style.opacity = "1"; moveTip(e); });
  node.addEventListener("pointermove", moveTip); node.addEventListener("pointerleave", () => { TIP.style.opacity = "0"; });
}
function moveTip(e) { const pad = 14, r = TIP.getBoundingClientRect(); let x = e.clientX + pad, y = e.clientY + pad; if (x + r.width > innerWidth - 8) x = e.clientX - r.width - pad; if (y + r.height > innerHeight - 8) y = e.clientY - r.height - pad; TIP.style.left = x + "px"; TIP.style.top = y + "px"; }
function css(name) { return `var(${name})`; }

function codeF(host, text, tagger, on) {
  const h = $(host); h.innerHTML = text.split("\n").map(l => { const f = tagger(l); return `<span class="ln"${f ? ` data-f="${f}"` : ""}>${esc(l)}</span>`; }).join("");
  if (on) h.addEventListener("pointerover", e => { const ln = e.target.closest(".ln[data-f]"); if (ln) on(ln.dataset.f); });
}
/* Подпись вписывается в прямоугольник; grow расширяет его вокруг центра. */
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
function states(btnsId, draw) {                       // Кнопки переключают выделенную часть схемы.
  let mode = $(`#${btnsId} button.sel`).dataset.m; draw(mode); REDRAW.push(() => draw(mode));
  $(`#${btnsId}`).addEventListener("click", e => { const b = e.target.closest("button[data-m]"); if (!b) return; mode = b.dataset.m; $$(`#${btnsId} button`).forEach(x => x.classList.toggle("sel", x === b)); draw(mode); });
  return m => { mode = m; $$(`#${btnsId} button`).forEach(x => x.classList.toggle("sel", x.dataset.m === m)); draw(m); };
}
/* Блок энкодера: attention, FFN и пунктирные остаточные связи. */
function encoderBlock(s, x, y, w, h, o) {
  o = o || {}; box(s, x, y, w, h, null, { fill: TINT("--cls-1", 7), stroke: css("--cls-1") });
  const iw = Math.min(260, w * .5), ix = x + w / 2 - iw / 2, hh = (h - 30) / 2;
  box(s, ix, y + h - 10 - hh, iw, hh, "self-attention · 12 голов", { fill: css("--panel"), fs: 12.5 });
  box(s, ix, y + 10, iw, hh, "FFN · 768 → 3072 → 768", { fill: css("--panel"), fs: 12.5 });
  s.appendChild(el("path", { d: `M ${ix - 14} ${y + h - 6} C ${ix - 40} ${y + h - 6} ${ix - 40} ${y + h / 2} ${ix - 14} ${y + h / 2}`, fill: "none", stroke: css("--ink-3"), "stroke-dasharray": "3 3" }));
  s.appendChild(el("path", { d: `M ${ix - 14} ${y + h / 2 - 2} C ${ix - 40} ${y + h / 2 - 2} ${ix - 40} ${y + 6} ${ix - 14} ${y + 6}`, fill: "none", stroke: css("--ink-3"), "stroke-dasharray": "3 3" }));
  txt(s, ix - 46, y + h / 2 + 4, "+", { fs: 13, color: css("--ink-3") });
  if (o.label) txt(s, x + w - 10, y + 16, o.label, { anchor: "end", fs: 12.5, color: css("--cls-1"), bold: 1 });
}

const BERT_TOKS = ["[CLS]", "the", "cat", "sat", "on", "[SEP]", "it", "was", "warm", "[SEP]"];
function figBert(mode) {
  const host = $("#fig-bert"); host.innerHTML = ""; const W = 1000, H = 560, s = svg(W, H); const n = BERT_TOKS.length, x0 = 90, cw = (W - x0 - 30) / n, X = i => x0 + cw * (i + 0.5);
  const NOTE = {
    in: TXT("fig-bert-note-in"),
    mlm: TXT("fig-bert-note-mlm"),
    nsp: TXT("fig-bert-note-nsp"),
  };
  const chosen = { 3: "mk", 8: "rnd", 2: "keep" };                          // sat → [MASK], warm → случайный токен, cat сохраняется
  const shown = mode === "mlm" ? BERT_TOKS.map((t, i) => chosen[i] === "mk" ? "[MASK]" : chosen[i] === "rnd" ? "apple" : t) : BERT_TOKS;
  // Токены и строки трёх таблиц эмбеддингов.
  const yTok = 500, yE = [455, 425, 395];
  shown.forEach((t, i) => { const sp = /^\[/.test(BERT_TOKS[i]) && t !== "[MASK]", c = mode === "mlm" ? chosen[i] : null;
    box(s, X(i) - cw / 2 + 5, yTok, cw - 10, 32, t, { fill: c === "mk" ? TINT("--cls-3", 28) : c === "rnd" ? TINT("--cls-1", 28) : c === "keep" ? TINT("--cls-2", 28) : sp ? SUNK() : css("--panel"), stroke: c ? css(c === "mk" ? "--cls-3" : c === "rnd" ? "--cls-1" : "--cls-2") : css("--rule-strong"), fs: 13.5, bold: sp || !!c });
    if (mode === "mlm" && c) txt(s, X(i), yTok + 48, "было: " + BERT_TOKS[i], { fs: 11.5, color: css("--ink-3") });
    const seg = i <= 5 ? 0 : 1;
    box(s, X(i) - cw / 2 + 5, yE[0], cw - 10, 22, "E(" + BERT_TOKS[i].replace(/[\[\]]/g, "").slice(0, 4) + ")", { fill: css("--panel"), fs: 10.5, color: css("--ink-2"), rx: 3 });
    box(s, X(i) - cw / 2 + 5, yE[1], cw - 10, 22, seg ? "E_B" : "E_A", { fill: TINT(seg ? "--cls-2" : "--cls-0", mode === "nsp" || mode === "in" ? 22 : 10), fs: 11, color: css("--ink-2"), rx: 3 });
    box(s, X(i) - cw / 2 + 5, yE[2], cw - 10, 22, "P" + i, { fill: css("--panel"), fs: 11, color: css("--ink-2"), rx: 3 });
    s.appendChild(el("line", { x1: X(i), x2: X(i), y1: 395, y2: 372, stroke: css("--ink-3"), "stroke-width": 1.2 }));
  });
  txt(s, x0 - 8, yTok + 21, "токены", { anchor: "end", fs: 12.5 }); txt(s, x0 - 8, yE[0] + 15, "токен", { anchor: "end", fs: 12 }); txt(s, x0 - 8, yE[1] + 15, "сегмент", { anchor: "end", fs: 12 }); txt(s, x0 - 8, yE[2] + 15, "позиция", { anchor: "end", fs: 12 });
  txt(s, x0 + 2, yE[0] - 6, "+", { anchor: "end", fs: 13, color: css("--ink-3") }); txt(s, x0 + 2, yE[1] - 6, "+", { anchor: "end", fs: 13, color: css("--ink-3") });
  if (mode === "in") { txt(s, X(5), yTok + 48, "граница сегментов", { fs: 11.5, color: css("--cls-2") }); txt(s, X(0), yTok + 48, "служебный токен", { fs: 11.5, color: css("--ink-3") }); }
  // Один блок энкодера развёрнут, остальные показаны стопкой.
  encoderBlock(s, x0, 262, W - x0 - 30, 110, { label: "блок 1 · 7,1 млн" });
  [0, 1, 2].forEach(k => box(s, x0, 236 - k * 22, W - x0 - 30, 16, null, { fill: TINT("--cls-1", 5), stroke: css("--cls-1"), rx: 4 }));
  txt(s, W / 2, 205, "⋮  блоки 2 … 12  ⋮", { fs: 12.5, color: css("--cls-1") });
  txt(s, x0 + 8, 182, "× 12 в bert-base · × 24 в bert-large · блоки одинаковой формы", { anchor: "start", fs: 12, color: css("--ink-3") });
  // Выход: вектор каждой позиции.
  const yH = 130;
  BERT_TOKS.forEach((t, i) => { const on = mode === "in" || (mode === "mlm" && chosen[i]) || (mode === "nsp" && i === 0);
    s.appendChild(el("line", { x1: X(i), x2: X(i), y1: 262, y2: yH + 30, stroke: css("--ink-3"), "stroke-width": 1.2 }));
    box(s, X(i) - cw / 2 + 8, yH, cw - 16, 30, "h" + i, { fill: on ? TINT("--cls-1", 22) : SUNK(), stroke: on ? css("--cls-1") : css("--rule-strong"), fs: 12.5, color: on ? css("--ink") : css("--ink-3") }); });
  txt(s, x0 - 8, yH + 20, "H", { anchor: "end", fs: 13, bold: 1 }); txt(s, x0 - 8, yH + 36, "[L, 768]", { anchor: "end", fs: 11, color: css("--ink-3") });
  // Головы, которые читают H.
  if (mode === "mlm") {
    const hx = (X(0) + X(n - 1)) / 2, hw = 760;
    box(s, hx - hw / 2, 24, hw, 34, "Голова MLM · Linear(768,768) + GELU + LayerNorm + Linear(768,30522) → softmax по словарю", { fill: TINT("--cls-3", 18), stroke: css("--cls-3"), fs: 12.5, bold: 1, grow: 1 });
    Object.keys(chosen).forEach(i => { i = +i; arrow(s, X(i), yH, X(i), 62, { color: css("--cls-3") }); txt(s, X(i), 14, "→ " + BERT_TOKS[i], { fs: 12.5, color: css("--cls-3"), bold: 1 }); });
    txt(s, x0, 14, "цели: исходные токены", { anchor: "start", fs: 11.5, color: css("--ink-3") });
    txt(s, x0, 84, "Прямая ошибка — в выбранных позициях; градиент проходит и через контекст", { anchor: "start", fs: 12, color: css("--ink-3") });
  } else if (mode === "nsp") {
    const bx = X(0) - cw / 2 + 8, bw = 260;
    const b1 = box(s, bx, 66, bw, 30, "pooler · tanh(W h₀ + b) · 768", { fill: TINT("--cls-2", 18), stroke: css("--cls-2"), fs: 12.5 });
    const b2 = box(s, bx, 24, bw, 30, "Linear(768, 2) → подряд / случайно", { fill: TINT("--cls-2", 18), stroke: css("--cls-2"), fs: 12.5, bold: 1 });
    arrow(s, X(0), yH, X(0), 100, { color: css("--cls-2") }); arrow(s, X(0), 66, X(0), 58, { color: css("--cls-2") });
    txt(s, bx + bw + 16, 44, "перекрёстная энтропия по двум классам", { anchor: "start", fs: 12, color: css("--ink-3") });
    txt(s, bx + bw + 16, 86, "NSP читает h₀ — представление [CLS]", { anchor: "start", fs: 12, color: css("--ink-3") });
  } else {
    txt(s, W / 2, 60, "на каждой позиции — вектор ширины 768; головы читают эти представления", { fs: 13, color: css("--ink-2") });
    txt(s, W / 2, 84, "вход: сумма строк трёх таблиц · энкодер: 12 блоков · выход: H", { fs: 12, color: css("--ink-3") });
  }
  host.appendChild(s); $("#fig-bert-note").innerHTML = NOTE[mode];
}
const setBert = states("fig-bert-btns", figBert);
codeF("#code-pretrain", `H = body(input_ids, token_type_ids, attention_mask).last_hidden_state     # [B, L, 768] — вектор каждой позиции

# --- MLM: исходный токен в выбранных позициях; в остальных цель -100
chosen = torch.rand(input_ids.shape) < 0.15                                 # служебные токены и PAD исключаются из выбора
mlm_labels = torch.where(chosen, input_ids, -100)                           # цель — исходный токен; -100 исключает позицию из ошибки
r = torch.rand(input_ids.shape)
input_ids[chosen & (r < 0.8)] = MASK_ID                                     # 80%: [MASK]
input_ids[chosen & (r >= 0.8) & (r < 0.9)] = random_token_id                # 10%: случайный токен
#                                                                            # 10%: исходный токен сохраняется и тоже предсказывается
mlm_logits = mlm_head(H)                                                    # Linear(768, 768) + GELU + LayerNorm + Linear(768, 30522): [B, L, V]
mlm_loss = F.cross_entropy(mlm_logits.flatten(0, 1), mlm_labels.flatten(), ignore_index=-100)   # softmax по словарю; ошибка в выбранных позициях

# --- NSP: читаем h_0, позицию [CLS], через pooler
pooled = torch.tanh(pooler(H[:, 0]))                                        # [B, 768]
nsp_logits = nsp_head(pooled)                                               # Linear(768, 2): [B, 2]
nsp_loss = F.cross_entropy(nsp_logits, is_next)                             # softmax по двум классам; одна метка на пару

loss = mlm_loss + nsp_loss                                                  # BertForPreTraining складывает две ошибки`,
  l => /mlm|chosen|MASK_ID|random_token|10%|80%/.test(l) ? "mlm" : /nsp|pooled|pooler|is_next/.test(l) ? "nsp" : /^H = /.test(l) ? "in" : null, setBert);


bertDrawers['bert-dsba'] = () => REDRAW.forEach(draw => draw());
QUIZ.figs['bert-dsba'] = bertDrawers['bert-dsba'];
})();
