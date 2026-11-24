/* Причинный трансформер, пошаговая генерация, кэш, GQA и плиточный attention. */
const GPT_DATA=JSON.parse(document.getElementById('add-data').textContent);
const GPT={
  generated:0,trainingRevealed:false,cacheStage:0,flashStep:0,flashPhase:0,moeToken:0,
  allowed(mode,i,j){return mode==='bert'||j<=i;},
  architecture(host){
    const T=Transformer,mode=document.getElementById('architecture-mode').value,i=+document.getElementById('architecture-query').value;
    let s=ADD.text(200,25,mode==='gpt'?'причинная маска':'двунаправленная маска','caption');
    for(let r=0;r<5;r++)for(let c=0;c<5;c++)s+=T.rect(65+c*48,58+r*36,44,32,this.allowed(mode,r,c)?'--cls-0':'--ink-3',this.allowed(mode,r,c)&&r===i);
    s+=ADD.text(200,270,'строки: запросы · столбцы: ключи','small');
    const tokens=['the','cat','is','at','home'];
    tokens.forEach((t,j)=>{
      const x=370+j*76;
      s+=T.cell(x,400,68,32,t,'--cls-0',j===i)+T.path(`M ${x+34} 399 V 369`)+T.vec(x+10,342,['','',''],'--cls-0',j===i,16,20)+T.path(`M ${x+34} 341 V 321`);
      s+=T.vec(x+10,170,['','',''],'--cls-0',j===i,16,20)+T.path(`M ${x+34} 169 V 148`);
      s+=T.cell(x,103,68,33,mode==='gpt'?'P(next)':'hᵢ','--cls-1',j===i);
    });
    s+=T.cell(370,278,372,36,mode==='gpt'?'causal self-attention':'self-attention','--cls-2');
    tokens.forEach((_,j)=>s+=T.cell(370+j*76,220,68,32,'FFN','--cls-3',j===i));
    s+=ADD.text(550,67,mode==='gpt'?'финальная норма → словарь':'контекстные представления','small');
    s+=ADD.text(380,475,'тело возвращает векторы; словарная голова GPT предсказывает следующий токен','small');
    T.mount(host,s,505,'Маска attention, столбцы токенов и выходная голова BERT или GPT');
  },
  training(host){
    const T=Transformer,mode=document.getElementById('training-mode').value,shift=+document.getElementById('training-shift').value;
    let s='';
    const showTrain=mode==='train';
    if(showTrain){
      const input=['BOS','the','cat','sleeps','.'],targets=['the','cat','sleeps','.','EOS'];
      s+=ADD.text(380,25,'цель над позицией — ваш выбор сдвига','caption');
      input.forEach((t,i)=>{
        const x=95+i*120;
        s+=T.cell(x,220,102,35,t,'--cls-0')+T.path(`M ${x+51} 219 V 180`)+T.vec(x+21,145,['','',''],'--cls-2',false,20,24)+T.path(`M ${x+51} 144 V 112`);
        s+=T.cell(x,65,102,35,shift?targets[i]:t,this.trainingRevealed?(shift?'--cls-2':'--cls-1'):'--cls-3',this.trainingRevealed);
      });
      s+=ADD.text(380,300,'все входные токены известны; будущие позиции закрыты причинной маской','small');
    }else{
      const n=this.generated,start=Math.max(0,n-5),tokens=GPT_DATA.generation.tokens.slice(start,n);
      s+=ADD.text(380,25,'запрос → выбор токена → добавить ко входу','caption');
      s+=T.cell(38,80,165,40,'известный запрос','--cls-0');
      tokens.forEach((t,i)=>{const x=220+i*82;s+=T.cell(x,80,76,40,t.replaceAll('\n','↵'),'--cls-1',start+i===n-1);});
      s+=T.cell(210,170,340,40,'причинный трансформер → P(next)','--cls-2')+T.path('M 380 121 V 168');
      s+=ADD.text(380,265,`${n} из ${GPT_DATA.generation.tokens.length} сохранённых новых токенов`,'caption');
    }
    T.mount(host,s,335,'Сдвинутые цели обучения и последовательное добавление токенов');
    document.getElementById('training-result').textContent=showTrain?(this.trainingRevealed?(shift?'Верно: предсказываем следующий токен.':'Текущий токен уже находится во входе. Нужен сдвиг на следующий токен.'):'Сопоставьте входы и цели, затем проверьте.'): 'Сохранённое продолжение GPT-2; это чтение результата из артефакта.';
    const gen=GPT_DATA.generation;
    document.getElementById('generation-text').innerHTML=showTrain?'':ADD.esc(gen.prompt.join(''))+'<mark>'+ADD.esc(gen.tokens.slice(0,this.generated).join(''))+'</mark>';
    document.getElementById('generation-next').disabled=showTrain||this.generated===gen.tokens.length;
    document.getElementById('training-reveal').disabled=!showTrain;
    document.getElementById('training-shift').disabled=!showTrain;
  },
  cacheCounts(stage=this.cacheStage,cache=true){
    if(!stage)return {length:4,newPositions:0,total:0,stored:0};
    const length=stage+3,newPositions=cache&&stage>1?1:length;
    const total=cache?length:stage*4+stage*(stage-1)/2;
    return {length,newPositions,total,stored:cache&&stage>1?length-1:0};
  },
  cache(host){
    const T=Transformer,on=document.getElementById('cache-mode').value==='cache',stage=this.cacheStage,state=this.cacheCounts(stage,on),n=state.length;
    let s=ADD.text(380,25,stage===0?'запрос ещё не обработан':stage===1?'prefill: все позиции запроса':'decode: подаём выбранный токен','caption');
    const tokens=['The','cat','is','asleep','.','It','dreams','now'];
    for(let i=0;i<n;i++){
      const x=65+i*84,old=i<state.stored,color=old?'--ink-3':'--cls-1';
      s+=T.cell(x,70,74,32,tokens[i],'--cls-0');
      if(stage){
        s+=`<g data-f="keys">${T.cell(x,155,74,32,`K${i}`,color,!old)}</g>`;
        s+=`<g data-f="values">${T.cell(x,205,74,32,`V${i}`,color,!old)}</g>`;
        if(!old)s+=`<g data-f="new">${T.path(`M ${x+37} 104 V 150`,color)}</g>`;
      }
    }
    if(stage){
      for(let i=0;i<n;i++)s+=T.path(`M ${102+i*84} 239 V 261`,'--cls-2',false);
      s+=T.path(`M 102 261 H ${102+(n-1)*84}`,'--cls-2',false)+T.path(`M ${102+(n-1)*42} 261 V 282 H 380 V 298`,'--cls-2');
      s+=`<g data-f="new">${T.cell(65,300,74,40,`Q${n-1}`,'--cls-1',true)}</g>`+T.path('M 141 320 H 198','--cls-1');
      s+=`<g data-f="read">${T.cell(200,300,360,40,'softmax(Q Kᵀ / √d) @ V','--cls-2')}</g>`;
      s+=T.path('M 380 342 V 365')+T.cell(160,370,440,38,'P(next) → выбираем следующий токен','--cls-1');
    }
    s+=ADD.text(380,450,on?'K,V хранятся отдельно в каждом слое':'на этом шаге K,V вычислены для всего префикса','small');
    T.mount(host,s,478,'Новые и сохранённые ключи и значения в prefill и decode');
    document.getElementById('cache-next').textContent=stage?'Подать выбранный токен':'Обработать запрос';
    document.getElementById('cache-next').disabled=stage>=5;
    document.getElementById('cache-result').textContent=stage?`Позиций на шаге: ${state.newPositions}; всего обработано: ${state.total}; позиций K,V сейчас: ${on?n:0}. Распределений нового токена получено: ${stage}.`:'Нажмите «Обработать запрос»: prefill даст распределение первого нового токена.';
  },
  gqa(host){
    const T=Transformer,heads=+document.getElementById('gqa-heads').value,length=+document.getElementById('gqa-length').value;
    let s=ADD.text(380,25,heads===8?'MHA · K,V для каждой головы Q':heads===1?'MQA · одна пара K,V для всех Q':'GQA · общая пара K,V внутри группы','caption');
    for(let i=0;i<8;i++){
      const x=35+i*88,group=T.group(i,8,heads),gx=35+(group+.5)*(704/heads);
      s+=`<g data-f="group">${T.cell(x,65,74,35,`Q${i}`,`--cls-${group%4}`)}</g>`;
      s+=T.path(`M ${x+37} 101 V 135 L ${gx} 185`,`--cls-${group%4}`);
    }
    for(let g=0;g<heads;g++){
      const x=35+(g+.5)*704/heads-35;
      s+=`<g data-f="shared">${T.cell(x,190,70,34,`K${g}`,`--cls-${g%4}`)}${T.cell(x,245,70,34,`V${g}`,`--cls-${g%4}`)}</g>`;
    }
    s+=ADD.text(380,330,'головы Q остаются отдельными; K,V разделяются внутри группы','small');
    T.mount(host,s,355,'Соответствие восьми голов Q общим головам K и V');
    document.getElementById('gqa-length-value').textContent=length;
    const bytes=T.cacheBytes(32,heads,128,length);
    document.getElementById('gqa-result').textContent=`2 × 32 × ${length} × ${heads} × 128 × 2 = ${bytes.toLocaleString('ru-RU')} байт · ${(bytes/2**20).toFixed(2)} MiB на один запрос.`;
  },
  flashData(){return GPT_DATA.reference.attention[2];},
  flashFlow(host){
    const T=Transformer,phase=this.flashPhase;
    const part=(n,content)=>`<g data-flash-phase="${n}" opacity="${phase && phase !== n ? 0.23 : 1}">${content}</g>`;
    const pillar=(x,w,color)=>T.rect(x,72,w,430,color).replace('rx="4"','rx="22"');
    const arrow=(x1,x2,y,label,n,second='')=>part(n,
      ADD.text((x1+x2)/2,y-(second?32:14),label,'small')+
      (second?ADD.text((x1+x2)/2,y-14,second,'small'):'')+
      T.path(`M ${x1} ${y} H ${x2}`,`--cls-${n===1?0:n===2?2:3}`));
    let s=ADD.text(254,29,'Обычный attention','caption')+ADD.text(786,29,'FlashAttention','caption');
    s+=T.path('M 520 55 V 512','--rule-strong',false);
    for(const [memory,compute] of [[18,280],[550,812]]){
      s+=pillar(memory,100,'--cls-0')+pillar(compute,210,'--cls-1');
      s+=ADD.text(memory+50,106,'HBM','strong')+ADD.text(memory+50,131,'память','small');
      s+=ADD.text(compute+105,106,'Вычисления','strong');
    }
    s+=ADD.text(385,130,'отдельные запуски','small')+ADD.text(917,130,'один kernel','small');
    s+=ADD.text(68,169,'Q, K, V','num');
    s+=part(1,T.cell(31,199,74,34,'S','--cls-0',phase===1)+ADD.text(68,253,'N × N','num'));
    s+=part(2,T.cell(31,324,74,34,'P','--cls-2',phase===2)+ADD.text(68,378,'N × N','num'));
    s+=part(3,T.cell(31,450,74,34,'O','--cls-3',phase===3));
    s+=arrow(120,278,154,'Чтение Q, K',1)+arrow(278,120,217,'Запись S',1);
    s+=arrow(120,278,279,'Чтение S',2)+arrow(278,120,342,'Запись P',2);
    s+=arrow(120,278,404,'Чтение P, V',3)+arrow(278,120,467,'Запись O',3);
    s+=part(1,T.cell(291,156,188,45,'S = QKᵀ / √d','--cls-0',phase===1));
    s+=part(2,T.cell(291,281,188,45,'P = softmax(S)','--cls-2',phase===2));
    s+=part(3,T.cell(291,406,188,45,'O = PV','--cls-3',phase===3));
    s+=ADD.text(385,484,'полные матрицы S и P','small');
    s+=T.cell(563,166,74,34,'K, V','--cls-0');
    s+=T.cell(563,267,74,34,'Q','--cls-0');
    s+=T.cell(563,369,74,34,'O, ℓ, m','--cls-3');
    s+=arrow(652,810,164,'Чтение Kⱼ, Vⱼ',1);
    s+=arrow(652,810,241,'Чтение Qᵢ, Oᵢ',1,'и ℓᵢ, mᵢ');
    s+=arrow(810,652,451,'Запись Oᵢ,',3,'ℓᵢ, mᵢ');
    s+=part(1,T.rect(823,156,188,48,'--cls-0',phase===1)+ADD.text(917,185,'Sᵢⱼ = QᵢKⱼᵀ / √d','num'));
    s+=part(2,T.rect(823,226,188,112,'--cls-2',phase===2)+
      `<g data-f="maximum">${ADD.text(917,249,'m′ = max(m, max Sᵢⱼ)','num')}${ADD.text(917,273,'α = exp(m − m′)','num')}</g>`+
      ADD.text(917,297,'Pᵢⱼ = exp(Sᵢⱼ − m′)','num')+
      `<g data-f="denominator">${ADD.text(917,321,'ℓ′ = αℓ + ΣPᵢⱼ','num')}</g>`);
    s+=part(3,T.rect(823,360,188,94,'--cls-3',phase===3)+
      `<g data-f="accumulator">${ADD.text(917,386,'acc′ = αℓOᵢ + PᵢⱼVⱼ','num')}</g>`+
      `<g data-f="output">${ADD.text(917,412,'Oᵢ ← acc′ / ℓ′','num')}</g>`+
      ADD.text(917,438,'m ← m′ · ℓ ← ℓ′','num'));
    s+=ADD.text(917,475,'SRAM и регистры','small');
    s+=ADD.text(254,535,'S и P проходят через HBM','caption');
    s+=ADD.text(786,535,'Sᵢⱼ и Pᵢⱼ остаются на чипе','caption');
    s+=ADD.text(786,561,'чтения и записи повторяются для очередных плиток','small');
    host.classList.add('transformer-fig','flash-flow');
    host.innerHTML=ADD.svg(s,1040,585,'Обычный attention и FlashAttention: обмен данными между HBM и вычислениями на чипе');
    const descriptions=[
      'Показан весь расчёт. Кнопка выделяет один и тот же этап в двух реализациях.',
      'Оценки QKᵀ: обычный вариант записывает всю S в HBM; FlashAttention получает Sᵢⱼ для текущих плиток на чипе.',
      'Softmax: обычный вариант читает S и записывает P; FlashAttention обновляет максимум m и знаменатель ℓ внутри объединённого вычисления.',
      'Выход: обычный вариант читает P,V и записывает O; FlashAttention обновляет Oᵢ и сохраняет Oᵢ,ℓᵢ,mᵢ для продолжения по плиткам.',
    ];
    document.getElementById('flash-flow-state').textContent=descriptions[phase];
  },
  flash(host){
    const T=Transformer,data=this.flashData(),causal=document.getElementById('flash-mask').value==='causal',tile=+document.getElementById('flash-tile').value,row=+document.getElementById('flash-query').value,naive=document.getElementById('flash-mode').value==='naive';
    const run=T.tiled(data.q,data.k,data.v,causal,tile),trace=run.trace.filter(t=>t.row===row),step=Math.min(this.flashStep,trace.length),current=step?trace[step-1]:null;
    let s=ADD.text(165,25,'карта оценок S','caption')+ADD.text(525,25,'основная память GPU · HBM','caption');
    for(let i=0;i<data.q.length;i++)for(let j=0;j<data.k.length;j++){
      const allowed=!causal||j<=i,selected=current&&i===row&&j>=current.start&&j<current.stop;
      s+=T.cell(35+j*51,70+i*41,48,37,allowed?(T.dot(data.q[i],data.k[j])/2).toFixed(2):'×',allowed?'--cls-0':'--ink-3',!!selected);
    }
    s+=T.rect(330,55,390,120,'--cls-0');
    s+=ADD.text(525,83,'Q, K, V хранятся здесь','caption');
    s+=ADD.text(525,112,`Q${row} = [${data.q[row].map(x=>x.toFixed(2)).join(', ')}]`,'num');
    s+=ADD.text(525,146,naive?'S и P записываются сюда целиком':'S и P целиком сюда не записываются','small');
    s+=T.path('M 525 177 V 214','--cls-1');
    s+=T.rect(330,220,390,230,'--cls-2');
    s+=ADD.text(525,249,'быстрая память на чипе · SRAM','caption');
    if(naive){
      const scores=data.k.map((key,j)=>causal&&j>row?-Infinity:T.dot(data.q[row],key)/2),weights=ADD.softmax(scores);
      s+=ADD.text(525,287,`S${row}: ${scores.map(v=>v===-Infinity?'−∞':v.toFixed(2)).join(' · ')}`,'num');
      s+=ADD.text(525,322,`P${row}: ${weights.map(v=>v.toFixed(3)).join(' · ')}`,'num');
      s+=ADD.text(525,361,'softmax по полной строке → P @ V','small');
      s+=ADD.text(525,407,`S,P: ${2*25} чисел · ${(2*25*8)} байт, FP64`,'num');
    }else if(current){
      const scores=data.k.slice(current.start,current.stop).map((key,j)=>causal&&current.start+j>row?-Infinity:T.dot(data.q[row],key)/2);
      s+=ADD.text(525,284,`K,V: позиции ${current.start}…${current.stop-1}`,'num');
      s+=ADD.text(525,316,`оценки плитки: ${scores.map(v=>v===-Infinity?'−∞':v.toFixed(3)).join(' · ')}`,'num');
      s+=`<g data-f="maximum">${ADD.text(525,352,`m = ${current.m.toFixed(4)}`,'num')}</g>`;
      s+=`<g data-f="denominator">${ADD.text(525,384,`l = ${current.l.toFixed(4)}`,'num')}</g>`;
      s+=`<g data-f="accumulator">${ADD.text(525,418,`acc = [${current.acc.map(v=>v.toFixed(3)).join(', ')}]`,'num')}</g>`;
    }else s+=ADD.text(525,320,'нажмите «Следующая плитка»','small');
    const out=naive?T.attention(data.q,data.k,data.v,causal)[row]:current?.output;
    s+=`<g data-f="output">${ADD.text(380,500,out?`выход${!naive&&step<trace.length?' после части ключей':''}: [${out.map(v=>v.toFixed(4)).join(', ')}]`:'накопитель пуст; выход ещё не получен','num')}</g>`;
    s+=ADD.text(380,545,naive?'учёт только S,P: 2 записи + 2 чтения полной матрицы':'учёт только S,P: полные матрицы не передаются в HBM','small');
    T.mount(host,s,573,'Плитки attention в HBM и SRAM с численным накопителем softmax');
    const diff=Math.max(...run.output.flat().map((v,i)=>Math.abs(v-T.attention(data.q,data.k,data.v,causal).flat()[i])));
    document.getElementById('flash-result').textContent=`${naive?'Полная строка':`Плиток запроса ${row}: ${step}/${trace.length}`} · max|Δ| полного результата: ${diff.toExponential(2)}. Обмен S,P в HBM: ${naive?4*25*8:0} байт в этой учебной задаче (FP64).`;
    document.getElementById('flash-next').disabled=naive||step>=trace.length;
  },
  moe(host){
    const T=Transformer,active=+document.getElementById('moe-active').value,routes=[[0,2],[1,3],[2,3]],chosen=routes[this.moeToken].slice(0,active);
    let s=ADD.text(380,25,'учебный MoE: четыре FFN, маршрут выбирается для каждого токена','caption');
    ['the','cat','sleeps'].forEach((token,i)=>{s+=T.clickable(T.cell(185+i*135,65,110,34,token,'--cls-0',this.moeToken===i),'data-moe-token',i);});
    s+=T.path(`M ${240+this.moeToken*135} 101 V 125 H 380 V 145`)+T.cell(275,150,210,35,'маршрутизатор','--cls-1');
    for(let i=0;i<4;i++){
      const x=50+i*180,selected=chosen.includes(i);
      s+=T.cell(x,265,140,45,`FFN ${i}`,selected?'--cls-2':'--ink-3',selected);
      if(selected)s+=T.path(`M 380 187 V 219 H ${x+70} V 262`,'--cls-2')+T.path(`M ${x+70} 312 V 345 H 380 V 367`,'--cls-2');
    }
    s+=T.cell(230,370,300,35,'взвешенная сумма выходов','--cls-3');
    T.mount(host,s,435,'Токен, выбранные FFN-эксперты и объединение выходов');
    const d=8,h=16,expert=3*d*h,shared=4*d*d+d*4;
    document.getElementById('moe-result').textContent=`Учебный блок: d=${d}, h=${h}; attention и router ${shared}, эксперт ${expert}. Всего ${shared+4*expert}; активны на токен ${shared+active*expert}. Нормы и эмбеддинги в этот расчёт не входят.`;
  },
  passports(){
    const p=GPT_DATA.passports,keys=['layers','d_model','query heads','key/value heads','FFN','norm','positions','parameters'];
    const labels=['слои','ширина','головы Q','головы K,V','FFN','норма','позиции','параметры'];
    const label=(key,value)=>{
      if(typeof value==='number')return value.toLocaleString('ru-RU');
      if(key==='FFN')return value.includes('gate')?'SwiGLU → линейный':'линейный → GELU → линейный';
      return value.replace('before each sublayer','перед подслоем').replace('learned table','обучаемая таблица').replace('rows','строк').replace('rotation','поворот').replace(/\d[\d,]*/g,n=>Number(n.replaceAll(',','')).toLocaleString('ru-RU'));
    };
    document.getElementById('model-passports').innerHTML=ADD.table(['Устройство',...p.cols],keys.map((key,i)=>[labels[i],...p.cols.map(c=>label(key,p.cells[c][key]))]));
  },
};
Object.assign(QUIZ.values,{cache_layers:32,query_heads:8,head_width:128});
const gptDrawers={architecture:h=>GPT.architecture(h),training:h=>GPT.training(h),cache:h=>GPT.cache(h),gqa:h=>GPT.gqa(h),'flash-flow':h=>GPT.flashFlow(h),flash:h=>GPT.flash(h),moe:h=>GPT.moe(h)};
Object.assign(QUIZ.figs,gptDrawers);
function redrawAll(){for(const host of document.querySelectorAll('[data-fig]'))gptDrawers[host.dataset.fig](host);GPT.passports();}
document.addEventListener('DOMContentLoaded',()=>{
  for(const el of document.querySelectorAll('.add-controls select,.add-controls input'))el.addEventListener('input',()=>{
    if(el.id==='training-shift')GPT.trainingRevealed=false;
    if(el.id.startsWith('flash-'))GPT.flashStep=0;
    redrawAll();
  });
  const actions={
    'training-reveal':()=>GPT.trainingRevealed=true,'generation-next':()=>GPT.generated=Math.min(GPT.generated+1,GPT_DATA.generation.tokens.length),
    'generation-reset':()=>{GPT.generated=0;GPT.trainingRevealed=false;},
    'cache-next':()=>GPT.cacheStage=Math.min(5,GPT.cacheStage+1),'cache-reset':()=>GPT.cacheStage=0,
    'flash-flow-next':()=>GPT.flashPhase=(GPT.flashPhase+1)%4,'flash-flow-reset':()=>GPT.flashPhase=0,
    'flash-next':()=>GPT.flashStep++,'flash-reset':()=>GPT.flashStep=0,
  };
  for(const [id,action] of Object.entries(actions))document.getElementById(id).onclick=()=>{action();redrawAll();};
  const activate=e=>{const node=e.target.closest('[data-moe-token]');if(node){GPT.moeToken=+node.dataset.moeToken;redrawAll();}};
  document.addEventListener('click',activate);document.addEventListener('keydown',e=>{if((e.key==='Enter'||e.key===' ')&&e.target.matches('[data-moe-token]')){e.preventDefault();activate(e);}});
  GPT.passports();
});
