/* Учебные распределения и слияния считаются в браузере. */
const W2 = {
  initial:['кот','коты','кота','ток'], pieces:[], merges:[], teacher:true,
  resetBpe() { this.pieces=this.initial.map(w=>[...w]); this.merges=[]; },
  pairs() {
    const counts=new Map();
    for(const word of this.pieces)for(let i=0;i<word.length-1;i++){
      const key=JSON.stringify([word[i],word[i+1]]);counts.set(key,(counts.get(key)||0)+1);
    }
    return [...counts].sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0]));
  },
  merge() {
    const best=this.pairs()[0]; if(!best)return;
    const [a,b]=JSON.parse(best[0]);
    this.pieces=this.pieces.map(word=>{const result=[];for(let i=0;i<word.length;i++){
      if(word[i]===a && word[i+1]===b){result.push(a+b);i++;}else result.push(word[i]);
    }return result;});
    this.merges.push(`${a} + ${b} → ${a+b}`);
  },
  bpe(host) {
    let s=ADD.text(380,24,'одно слово → последовательность частей','caption');
    this.pieces.forEach((word,i)=>{
      s+=ADD.text(50,61+i*43,this.initial[i]);
      word.forEach((piece,j)=>s+=ADD.box(140+j*120,35+i*43,105,35,[piece],'merge'));
    });
    const pair=this.pairs()[0];
    s+=`<g data-f="pairs" tabindex="0">${ADD.text(380,237,pair?'Частая пара: '+JSON.parse(pair[0]).join(' + ')+'; частота '+pair[1]:'Пар не осталось','caption')}</g>`;
    host.innerHTML=ADD.svg(s,760,260,'Слияния BPE');
    const best=this.pairs()[0];
    const result=document.querySelector('#bpe-result');
    if(result) result.textContent=`Следующая пара: ${best?JSON.parse(best[0]).join(' + ')+'; частота '+best[1]:'пар не осталось'}. Слияния: ${this.merges.join('; ')||'пока нет'}`;
    const button=document.querySelector('#bpe-merge');if(button)button.disabled=!best;
  },
  counts(smooth=false) {
    const counts=[2,1,0], a=smooth?1:0, total=3;
    return counts.map(n=>(n+a)/(total+a*counts.length));
  },
  drawCounts(host) {
    const smooth=!!document.querySelector('#smooth')?.checked, p=this.counts(smooth);
    let s=ADD.box(10,50,140,75,['контекст','кот'],'counts');
    ['ест','спит','рыбу'].forEach((word,i)=>{
      s+=ADD.arrow(155,87,240,45+i*65)+ADD.box(250,20+i*65,180,55,[`${word}: N = ${[2,1,0][i]}`],'counts');
      s+=ADD.box(480,20+i*65,230,55,[`P = ${p[i].toFixed(3)}`],smooth?'smooth':'counts');
    });
    host.innerHTML=ADD.svg(s,760,225,'Счётчики и сглаживание');
    const result=document.querySelector('#count-result');if(result)result.textContent=`V = 3, сумма вероятностей = ${p.reduce((a,b)=>a+b,0).toFixed(3)}; α = ${smooth?1:0}`;
  },
  distribution(t=1,topP=.9) {
    const p=ADD.softmax([2,1.5,1,0,-1].map(x=>x/t));
    let before=0;
    const mask=p.map(v=>{const keep=before<topP;before+=v;return keep;});
    const mass=p.reduce((s,v,i)=>s+(mask[i]?v:0),0);
    return {p,mask,filtered:p.map((v,i)=>mask[i]?v/mass:0)};
  },
  decoding(host) {
    const t=+(document.querySelector('#temperature')?.value||1), topP=+(document.querySelector('#top-p')?.value||.9);
    const d=this.distribution(t,topP), words=['кот','пёс','он','мы','все'];
    let s=`<g data-f="temperature" tabindex="0">${ADD.text(380,24,'вероятности после температуры · [V]','caption')}</g>`;
    words.forEach((word,i)=>{
      const x=70+i*130;
      s+=`<g data-f="${d.mask[i]?'renorm':'truncate'}" tabindex="0"><rect x="${x}" y="${190-d.p[i]*200}" width="32" height="${d.p[i]*200}"/><rect x="${x+36}" y="${190-d.filtered[i]*200}" width="32" height="${d.filtered[i]*200}" class="accent"/>${ADD.text(x+34,215,word)}${ADD.text(x+34,239,d.filtered[i].toFixed(3))}</g>`;
    });
    s+=ADD.box(20,275,210,55,['маска top-p [V]'],'truncate')+ADD.arrow(230,302,270,302);
    s+=ADD.box(280,275,210,55,['нормировка [V]'],'renorm')+ADD.arrow(490,302,530,302);
    s+=ADD.box(540,275,200,55,['выбор ID [B]'],'choice');
    host.innerHTML=ADD.svg(s,760,350,'Декодирование: температура и top-p');
    const result=document.querySelector('#decode-result');
    if(result){result.textContent=`Кандидаты: ${words.filter((_,i)=>d.mask[i]).join(', ')}. Сумма после нормировки: ${d.filtered.reduce((a,b)=>a+b,0).toFixed(3)}`;
      document.querySelector('#temperature-value').textContent=t;
      document.querySelector('#top-p-value').textContent=topP;}
    return d;
  },
  translation(host) {
    let s=ADD.text(160,25,'encoder: читает источник','caption')+ADD.text(585,25,'decoder: генерирует перевод','caption');
    const inputs=this.teacher?['BOS','A','man']:['BOS','The','person'];
    for(let i=0;i<3;i++){
      const x=15+i*100;
      s+=ADD.box(x,170,90,55,['RNN'],'encode');
      s+=ADD.box(x,280,90,45,[['Ein','Mann','schläft'][i]],'encode')+ADD.arrow(x+45,280,x+45,230);
      if(i<2)s+=ADD.arrow(x+90,197,x+98,197);
      const d=435+i*100;
      s+=ADD.box(d,170,90,55,['RNN'],'decode');
      s+=ADD.box(d,280,90,45,[inputs[i]],'teacher')+ADD.arrow(d+45,280,d+45,230);
      s+=ADD.arrow(d+45,170,d+45,130)+ADD.box(d-2,65,94,60,['Linear', 'softmax'],'decode');
      s+=ADD.text(d+45,52,(this.teacher?['A','man','sleeps']:['The','person','sleeps'])[i]);
      if(i<2)s+=ADD.arrow(d+90,197,d+98,197);
    }
    s+=ADD.arrow(305,197,430,197)+ADD.text(367,150,'последнее h')+ADD.text(367,175,'→ первое h');
    s+=ADD.text(160,360,'эмбеддинги слов источника','caption');
    s+=ADD.text(585,360,this.teacher?'вход: эталонный перевод':'вход: выбранные моделью слова','caption');
    s+=ADD.text(380,410,'весь источник проходит через одно состояние фиксированного размера','caption');
    host.innerHTML=ADD.svg(s,760,440,'Рекуррентный encoder–decoder: развёртки обеих сетей и передача состояния');
  },
};
W2.resetBpe();
QUIZ.figs.generation=h=>h.innerHTML=ADD.flow([
  {lines:['префикс','[B, T]'],key:'append'}, {lines:['модель','[B, V]'],key:'distribution'},
  {lines:['правило выбора','ID [B]'],key:'choice'}, {lines:['новый префикс','[B, T+1]'],key:'append'},
],'Шаг генерации');
QUIZ.figs.markov=h=>{
  let s=ADD.text(380,24,'триграммная модель: из всего префикса оставляем два слова','caption');
  s+=ADD.box(20,60,300,55,['сегодня утром кот ест']);
  s+=ADD.arrow(320,87,380,87)+ADD.box(390,60,160,55,['кот · ест'],'counts');
  s+=ADD.arrow(550,87,600,87)+ADD.box(610,60,130,55,['P(w | кот, ест)'],'counts');
  h.innerHTML=ADD.svg(s,760,145,'Марковское предположение: сокращение контекста до последних n−1 слов');
};
W2.jokeIndex=1;
W2.drawJoke=function(){
  const data=JSON.parse(document.querySelector('#add-data').textContent).ngramExamples;
  const n=Number(document.querySelector('#joke-order').value);
  const row=data.samples[n][this.jokeIndex], words=row.text.split(' '), cp=row.copied;
  const output=document.querySelector('#joke-output');
  output.innerHTML='<p>'+words.map((word,i)=>cp && i===cp.start?'<span class="t copied">'+ADD.esc(words.slice(i,i+cp.length).join(' '))+'</span>':cp && i>cp.start && i<cp.start+cp.length?'':ADD.esc(word)).filter(Boolean).join(' ')+'</p>';
  document.querySelector('#joke-source').textContent=TXT('jokes-source',{index:this.jokeIndex+1,total:data.samples[n].length,training:data.trainingJokes,checked:data.checkedJokes,copied:cp?.length||0});
  const retained=words.slice(0,n-1), rest=words[n-1]||'EOS';
  const s=ADD.box(15,35,330,60,[retained.join(' '),`контекст: ${n-1} слова`])+ADD.arrow(345,65,420,65)+ADD.box(430,35,310,60,[rest,'следующее выбранное слово']);
  document.querySelector('[data-fig="ngram-context"]').innerHTML=ADD.svg(s,760,125,`Начало сохранённой генерации при n=${n}`);
};
QUIZ.figs['ngram-context']=h=>W2.drawJoke();
QUIZ.figs.bpe=h=>W2.bpe(h);
QUIZ.figs.counts=h=>W2.drawCounts(h);
QUIZ.figs.shift=h=>{
  const rows=[['вход 1','BOS','кот','спит'],['цель 1','кот','спит','EOS'],['вход 2','BOS','кот','PAD'],['цель 2','кот','EOS','PAD']];
  let s=ADD.text(380,24,'вход [B, T] → оценки [B, T, V] → цель [B, T]','caption');
  rows.forEach((row,i)=>{s+=ADD.text(60,67+i*48,row[0]); row.slice(1).forEach((word,j)=>{
    const x=140+j*155,y=40+i*48;
    s+=ADD.box(x,y,140,40,[word],i%2?'target':'shift');
    if(word==='PAD' && i%2)s+=`<path d="M${x+5} ${y+5} L${x+135} ${y+35}"/>`;
  });});
  s+=`<g data-f="loss" tabindex="0">${ADD.text(380,268,'цель PAD: исключена из loss → среднее по остальным позициям','caption')}</g>`;
  s+=ADD.box(105,295,540,55,['логиты одной позиции: [z₁, z₂, …, zᵥ]'],'logits');
  h.innerHTML=ADD.svg(s,760,370,'Сдвиг целей и маска PAD');
};
/* Операции внутри рекуррентных ячеек и пути состояния. */
const REC = {
  path(points,key='') {
    return `<path ${key?`data-f="${key}" tabindex="0"`:''} d="${points}" marker-end="url(#MARKER)"/>`;
  },
  op(x,y,label,key='state') {
    return `<g data-f="${key}" tabindex="0"><circle cx="${x}" cy="${y}" r="17" style="fill:var(--panel-sunk);stroke:var(--rule-strong)"/>${ADD.text(x,y+5,label)}</g>`;
  },
};
QUIZ.figs['rnn-cell']=h=>{
  let s=ADD.text(380,25,'одна ячейка: как новый токен меняет состояние','caption');
  s+=ADD.box(20,100,125,50,['hₜ₋₁ [H]'],'state')+ADD.arrow(145,125,185,125);
  s+=ADD.box(195,100,105,50,['Wₕ hₜ₋₁'],'state')+ADD.arrow(300,125,345,125);
  s+=REC.op(365,125,'+');
  s+=ADD.box(310,235,110,50,['Wₓ eₜ'],'state')+ADD.arrow(365,235,365,147);
  s+=ADD.box(310,320,110,45,['eₜ [d]'],'embedding')+ADD.arrow(365,320,365,290);
  s+=ADD.box(450,205,70,40,['b'],'state')+REC.path('M485 205 V170 H365 V147');
  s+=ADD.arrow(382,125,435,125)+ADD.box(445,100,100,50,['tanh'],'state');
  s+=ADD.arrow(545,125,600,125)+ADD.box(610,100,125,50,['hₜ [H]'],'state');
  s+=REC.path('M670 100 V55 H80 V100');
  s+=ADD.text(380,75,'на следующем шаге hₜ становится предыдущим состоянием','caption');
  h.innerHTML=ADD.svg(s,760,390,'RNN: входная и рекуррентная матрицы, сложение, tanh и обратная связь');
};
QUIZ.figs.rnn=h=>{
  let s=ADD.text(380,25,'та же ячейка, развёрнутая по времени','caption');
  s+=ADD.box(5,172,65,45,['h₀=0'],'state');
  for(let i=0;i<3;i++){
    const x=130+i*225;
    s+=ADD.box(x,165,140,60,['RNN','одни веса'],'state');
    s+=ADD.arrow(i?x-85:70,195,x-5,195);
    s+=ADD.text(x-30,180,i?`h${i}`:'');
    s+=ADD.box(x,280,140,45,[`e${i+1} [d]`],'embedding')+ADD.arrow(x+70,280,x+70,230);
    s+=ADD.text(x+70,355,['кот','ест','рыбу'][i]);
    s+=ADD.arrow(x+70,165,x+70,120)+ADD.box(x-10,60,160,55,[`P(w${i+2}|контекст)`,'Linear → softmax'],'head');
  }
  s+=ADD.arrow(720,195,753,195)+ADD.text(737,175,'h₃');
  s+=ADD.text(380,390,'h₁: «кот» · h₂: «кот ест» · h₃: «кот ест рыбу»','caption');
  h.innerHTML=ADD.svg(s,760,420,'RNN во времени: эмбеддинги, перенос состояния и вероятности следующих токенов');
};
QUIZ.figs.lstm=h=>{
  let s=ADD.text(380,25,'память c проходит через умножение и сложение','caption');
  s+=ADD.text(40,88,'cₜ₋₁')+ADD.arrow(70,82,193,82)+REC.op(215,82,'×','lstm');
  s+=ADD.arrow(232,82,433,82)+REC.op(455,82,'+','lstm')+ADD.arrow(472,82,725,82)+ADD.text(727,60,'cₜ');
  s+=ADD.box(175,210,80,45,['σ → f'],'lstm')+ADD.arrow(215,210,215,105);
  s+=ADD.box(295,210,80,45,['σ → i'],'lstm')+ADD.arrow(335,210,335,160)+REC.path('M335 160 H388');
  s+=ADD.box(415,210,80,45,['tanh → g'],'lstm')+ADD.arrow(455,210,455,160)+REC.path('M455 160 H422');
  s+=REC.op(405,160,'×','lstm')+REC.path('M405 143 V125 H455 V105');
  s+=ADD.box(545,210,80,45,['σ → o'],'lstm')+REC.path('M585 210 V185 H643');
  s+=REC.path('M660 82 V112')+ADD.box(625,118,70,40,['tanh'],'lstm')+ADD.arrow(660,158,660,163)+REC.op(660,185,'×','lstm');
  s+=REC.path('M660 202 V245 H735')+ADD.text(718,225,'hₜ');
  s+=ADD.box(20,305,130,45,['hₜ₋₁'],'lstm')+ADD.box(20,365,130,40,['eₜ'],'lstm');
  s+=REC.path('M150 327 H180 V290 H585');
  s+=REC.path('M150 385 H180 V290');
  for(const x of [215,335,455,585])s+=ADD.arrow(x,290,x,260);
  s+=ADD.text(425,325,'каждый блок ворот имеет свои матрицы и смещение','caption');
  s+=ADD.text(425,365,'f: сохранить · i: записать · o: прочитать','caption');
  h.innerHTML=ADD.svg(s,760,430,'LSTM: забывающие, входные и выходные ворота, кандидат и два состояния');
};
QUIZ.figs.gru=h=>{
  let s=ADD.text(380,25,'одно состояние h: смешиваем прошлое и кандидат','caption');
  s+=ADD.text(40,80,'hₜ₋₁')+ADD.arrow(70,75,553,75)+REC.op(575,75,'×','gru');
  s+=ADD.arrow(592,75,673,75)+REC.op(695,75,'+','gru')+ADD.arrow(712,75,752,75);
  s+=ADD.text(735,50,'hₜ');
  s+=ADD.box(20,185,120,45,['Wₕ hₜ₋₁+bₕ'],'gru')+REC.path('M90 75 V180');
  s+=ADD.arrow(140,207,183,207)+REC.op(205,207,'×','gru');
  s+=ADD.box(165,305,80,45,['σ → r'],'gru')+ADD.arrow(205,305,205,230);
  s+=ADD.arrow(222,207,303,207)+REC.op(325,207,'+','gru');
  s+=ADD.box(270,305,110,45,['Wₓ eₜ+bₓ'],'gru')+ADD.arrow(325,305,325,230);
  s+=ADD.arrow(342,207,390,207)+ADD.box(400,185,75,45,['tanh'],'gru');
  s+=ADD.arrow(475,207,600,207)+REC.op(620,207,'×','gru');
  s+=REC.path('M637 207 H695 V98');
  s+=ADD.box(490,305,80,45,['σ → z'],'gru')+REC.path('M530 305 V130 H575 V98');
  s+=REC.path('M530 265 H620 V280')+ADD.box(580,285,80,40,['1 − z'],'gru')+ADD.arrow(620,285,620,230);
  s+=ADD.box(20,400,160,45,['hₜ₋₁ и eₜ'],'gru')+REC.path('M180 422 H700 V375 H205');
  s+=ADD.arrow(205,375,205,355)+ADD.arrow(325,375,325,355)+ADD.arrow(530,375,530,355);
  s+=ADD.text(380,465,'r: вклад прошлого в кандидат · z: доля прошлого в новом h','caption');
  h.innerHTML=ADD.svg(s,760,490,'GRU: reset управляет вкладом прошлого в кандидат, update смешивает кандидат и предыдущее состояние');
};
QUIZ.figs.decoding=h=>W2.decoding(h);
QUIZ.figs.translation=h=>W2.translation(h);
QUIZ.figs.beam=h=>{
  let s=ADD.box(10,90,100,50,['BOS']);
  s+=ADD.arrow(110,105,220,45)+ADD.arrow(110,125,220,180);
  s+=ADD.text(165,54,'0.6')+ADD.text(165,185,'0.4');
  s+=ADD.box(230,20,120,50,['A'])+ADD.box(230,155,120,50,['B']);
  s+=ADD.arrow(350,45,475,45)+ADD.text(410,30,'0.5');
  s+=ADD.arrow(350,180,475,180)+ADD.text(410,165,'0.9');
  s+=ADD.box(485,20,255,50,['A → EOS: 0.30'])+ADD.box(485,155,255,50,['B → EOS: 0.36']);
  s+=ADD.text(380,250,'остальные продолжения: после A — 0.5, после B — 0.1','caption');
  h.innerHTML=ADD.svg(s,760,275,'Greedy и поиск последовательности');
};
/* Входы при генерации и teacher forcing; учебный расчёт перплексии. */
W2.forcingMode='generation';
W2.forcingError=false;
W2.forcingSequence=function(){
  const gold=['кот','спит','EOS'];
  const chosen=[this.forcingError?'пёс':'кот','спит','EOS'];
  const previous=this.forcingMode==='teacher'?gold:chosen;
  return {gold,chosen,contexts:gold.map((_,i)=>['BOS',...previous.slice(0,i)])};
};
W2.drawForcing=function(host){
  const teacher=this.forcingMode==='teacher', data=this.forcingSequence();
  let s=ADD.text(380,24,teacher?'обучение: следующий вход берём из эталонного текста':'генерация: следующий вход берём из своего выбора','caption');
  for(let i=0;i<3;i++){
    const y=60+i*180;
    s+=ADD.text(35,y+35,String(i+1));
    s+=ADD.box(75,y,250,60,['вход',data.contexts[i].join(' · ')],'context');
    s+=ADD.arrow(325,y+30,360,y+30)+ADD.box(365,y,170,60,['P(токен | контекст)','[V]'],'distribution');
    s+=ADD.arrow(535,y+30,585,y+30)+ADD.box(590,y,145,60,[teacher?'прогноз':'выбор',data.chosen[i]],'choice');
    if(teacher){
      s+=ADD.box(590,y+85,145,34,[`эталон: ${data.gold[i]}`],'target');
      s+=`<path d="M662 ${y+60} V${y+80}" style="stroke:var(--cls-1)" marker-end="url(#MARKER)"/>`;
      s+=ADD.text(485,y+108,i===0&&this.forcingError?'ошибка → штраф':'сравниваем с целью','caption');
    }
    if(i<2){
      const fromY=teacher?y+119:y+60, turnY=y+140;
      s+=`<path data-feedback="${teacher?'gold':'chosen'}" d="M${teacher?730:662} ${fromY} V${turnY} H195 V${y+175}" style="stroke:var(--cls-0);stroke-width:2" marker-end="url(#MARKER)"/>`;
      s+=ADD.text(310,turnY-9,teacher?`во вход: ${data.gold[i]}`:`во вход: ${data.chosen[i]}`,'caption');
    }
  }
  s+=ADD.text(380,575,teacher?'эталонный текст: «кот спит» · EOS учит завершать текст':'выбран EOS → останавливаем генерацию','caption');
  host.innerHTML=ADD.svg(s,760,605,'Авторегрессионная генерация и teacher forcing: источник токена для следующего входа');
  document.querySelector('#forcing-note').innerHTML=TXT(teacher?'forcing-teacher-note':'forcing-generation-note');
  const button=document.querySelector('#forcing-error');
  button.setAttribute('aria-pressed',String(this.forcingError));
  button.textContent=this.forcingError?'Убрать ошибку':'Добавить ошибку: «кот» → «пёс»';
};
QUIZ.figs.autoregression=h=>W2.drawForcing(h);
W2.perplexity=function(middle=.25){
  const probabilities=[.5,middle,.5], penalties=probabilities.map(p=>-Math.log(p));
  const loss=penalties.reduce((a,b)=>a+b,0)/penalties.length;
  return {probabilities,penalties,loss,ppl:Math.exp(loss),geometric:Math.exp(-loss)};
};
W2.drawPerplexity=function(host){
  const probability=Number(document.querySelector('#ppl-probability').value), data=this.perplexity(probability);
  let s=ADD.text(380,25,'teacher forcing на проверочном тексте: читаем P правильной цели','caption');
  ['кот','спит','EOS'].forEach((word,i)=>{
    const x=20+i*250, p=data.probabilities[i];
    s+=ADD.text(x+110,60,word);
    s+=ADD.box(x,85,220,48,[`P = ${p.toFixed(2)}`],'token-prob');
    s+=`<g data-f="token-prob" tabindex="0"><rect x="${x}" y="142" width="220" height="12"/><rect class="accent" x="${x}" y="142" width="${220*p}" height="12"/></g>`;
    s+=ADD.arrow(x+110,165,x+110,190)+ADD.box(x,200,220,48,[`−ln P = ${data.penalties[i].toFixed(3)}`],'token-loss');
    s+=`<path d="M${x+110} 248 V275 H380 V295" marker-end="url(#MARKER)"/>`;
  });
  s+=ADD.box(250,300,260,48,[`среднее L = ${data.loss.toFixed(3)}`],'loss');
  s+=ADD.arrow(380,348,380,380)+ADD.box(250,390,260,48,[`exp(L) = ${data.ppl.toFixed(3)}`],'ppl');
  host.innerHTML=ADD.svg(s,760,465,'Перплексия: вероятности правильных токенов, отрицательные логарифмы, среднее и экспонента');
  document.querySelector('#ppl-probability-value').textContent=probability.toFixed(2);
  document.querySelector('#ppl-example-result').textContent=TXT('ppl-example-result',{loss:data.loss.toFixed(3),ppl:data.ppl.toFixed(3),geometric:data.geometric.toFixed(3)});
  document.querySelector('#ppl-example pre [data-f="token-prob"]').textContent=`correct_probabilities = [0.5, ${probability.toFixed(2)}, 0.5]`;
};
QUIZ.figs.perplexity=h=>W2.drawPerplexity(h);

QUIZ.figs['ppl-dependencies']=h=>{
  const inputs=[['проверочный корпус','язык · тема · стиль'],['обучающий корпус','объём · близость темы'],['модель и обучение','параметры · шаги'],['токенизатор','словарь · части слов']];
  let s='';
  inputs.forEach((lines,i)=>{
    const x=10+i*190;
    s+=ADD.box(x,25,170,80,lines);
    s+=ADD.arrow(x+85,105,380,190);
  });
  s+=ADD.box(235,200,290,65,['PPL','для этих условий']);
  h.innerHTML=ADD.svg(s,760,290,'Перплексия зависит от модели, обучения, проверочного корпуса и токенизации');
};

document.addEventListener('DOMContentLoaded',()=>{
  document.querySelector('#forcing-mode').onchange=e=>{W2.forcingMode=e.target.value;W2.drawForcing(document.querySelector('[data-fig="autoregression"]'));};
  document.querySelector('#forcing-error').onclick=()=>{W2.forcingError=!W2.forcingError;W2.drawForcing(document.querySelector('[data-fig="autoregression"]'));};
  document.querySelector('#ppl-probability').oninput=()=>W2.drawPerplexity(document.querySelector('[data-fig="perplexity"]'));

  document.querySelector('#bpe-merge').onclick=()=>{W2.merge();W2.bpe(document.querySelector('[data-fig="bpe"]'));};
  document.querySelector('#bpe-reset').onclick=()=>{W2.resetBpe();W2.bpe(document.querySelector('[data-fig="bpe"]'));};
  document.querySelector('#smooth').onchange=()=>W2.drawCounts(document.querySelector('[data-fig="counts"]'));
  for(const id of ['temperature','top-p'])document.getElementById(id).oninput=()=>W2.decoding(document.querySelector('[data-fig="decoding"]'));
  document.querySelector('#teacher-toggle').onclick=e=>{W2.teacher=!W2.teacher;W2.translation(document.querySelector('[data-fig="translation"]'));e.target.textContent=W2.teacher?'Показать вход при генерации':'Показать вход при обучении';};
  W2.drawJoke();
  document.querySelector('#joke-order').onchange=()=>W2.drawJoke();
  document.querySelector('#joke-next').onclick=()=>{W2.jokeIndex=(W2.jokeIndex+1)%3;W2.drawJoke();};
  const data=JSON.parse(document.querySelector('#add-data').textContent);
  const measured=data.pplExamples, config=measured.rows[0].config;
  document.querySelector('#ppl-jokes-conditions').innerHTML=TXT('ppl-jokes-conditions',{vocab:measured.vocabSize,train:config.n_train_jokes,epochs:config.epochs,hidden:config.hidden,test:measured.testJokes});
  document.querySelector('#ppl-jokes-table').innerHTML=ADD.table(['Модель','PPL на отложенных анекдотах'],measured.rows.map(row=>[row.model,row.ppl.toFixed(1)]));
  document.querySelector('#decode-measured').innerHTML=ADD.table(['Правило','Доля повторов','Distinct-2'],data.decodeTable.rows.map(r=>[r.method,(r.repetition*100).toFixed(1)+'%',r.distinct2.toFixed(3)]))
    + ['greedy','sampling'].filter(k=>data.decodeSamples[k]).map(k=>`<details class="optional"><summary>${ADD.esc(k)}: пример генерации</summary><div class="prose"><p>${ADD.esc(data.decodeSamples[k][0])}</p></div></details>`).join('');
});
