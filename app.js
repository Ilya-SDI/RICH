
const CUR = window.RICH_CURRICULUM;
const DAY_NAMES=['ПН','ВТ','СР','ЧТ','ПТ','СБ','ВС'];
const DAY_FULL=['ПОНЕДЕЛЬНИК','ВТОРНИК','СРЕДА','ЧЕТВЕРГ','ПЯТНИЦА','СУББОТА','ВОСКРЕСЕНЬЕ'];
const KEY='richCraftFullV1';

let state=JSON.parse(localStorage.getItem(KEY)||'{}');
state.days=state.days||{};
state.settings=state.settings||{startDate:new Date().toISOString().slice(0,10)};
let selected=0;
let timerInt=null, timerStart=null, elapsed=0, answers={}, confidence={};

function save(){localStorage.setItem(KEY,JSON.stringify(state));render();}
function weekDayKey(week,day){return `w${week}d${day}`}
function currentWeek(){ return Math.max(0, Math.min(3, Math.floor(monthDayIndex()/7))); }
function monthDayIndex(){
  const s=new Date(state.settings.startDate+'T00:00:00');
  const n=new Date(); n.setHours(0,0,0,0);
  return Math.max(0, Math.min(29, Math.floor((n-s)/86400000)));
}
function selectedDateISO(){
  const base=new Date(state.settings.startDate+'T12:00:00');
  base.setDate(base.getDate()+currentWeek()*7+selected);
  const y=base.getFullYear(), m=String(base.getMonth()+1).padStart(2,'0'), d=String(base.getDate()).padStart(2,'0');
  return `${y}-${m}-${d}`;
}
function devIndex(){ return Math.min(29,currentWeek()*7+selected); }
function ensureDay(week,day){
  const k=weekDayKey(week,day);
  if(!state.days[k]) state.days[k]={school:null,trumpet:null,home:null,dev:null};
  return state.days[k];
}
function completeCountWeek(){
  const w=currentWeek(); let n=0;
  for(let d=0;d<7;d++){
    const x=ensureDay(w,d);
    ['school','trumpet','home','dev'].forEach(k=>{if(x[k]?.done)n++});
  }
  return n;
}
function renderDays(){
  const el=document.getElementById('days'); el.innerHTML='';
  const w=currentWeek();
  for(let i=0;i<7;i++){
    const d=ensureDay(w,i);
    const c=['school','trumpet','home','dev'].filter(k=>d[k]?.done).length;
    const node=document.createElement('div');
    node.className='day'+(selected===i?' active':'');
    node.textContent=`${DAY_NAMES[i]} ${c}/4`;
    node.onclick=()=>{selected=i;render()};
    el.appendChild(node);
  }
}
function setBlock(type,label){
  const d=ensureDay(currentWeek(),selected);
  const item=d[type], done=!!item?.done;
  document.getElementById('st'+label).textContent=done?'1/1':'0/1';
  document.getElementById('st'+label).className='status'+(done?' done':'');
  document.getElementById('q'+label).className='quest'+(done?' done':'');
  document.getElementById('txt'+label).value=item?.text||'';
}
function renderStats(){
  const w=currentWeek(), types=[['school','Уроки'],['trumpet','Труба'],['home','Дом'],['dev','Развитие']];
  let html='';
  types.forEach(([k,name])=>{
    let c=0; for(let d=0;d<7;d++) if(ensureDay(w,d)[k]?.done)c++;
    html+=`<div class="progress-line"><div class="lab">${name}</div><div class="track"><span style="width:${c/7*100}%"></span></div><b>${c}/7</b></div>`;
  });
  document.getElementById('weekStats').innerHTML=html;
}
function render(){
  renderDays(); renderStats();
  const d=ensureDay(currentWeek(),selected);
  setBlock('school','School');setBlock('trumpet','Trumpet');setBlock('home','Home');
  document.getElementById('todayTitle').textContent=DAY_FULL[selected];
  document.getElementById('sSchool').textContent=d.school?.done?'1':'0';
  document.getElementById('sTrumpet').textContent=d.trumpet?.done?'1':'0';
  document.getElementById('sHome').textContent=d.home?.done?'1':'0';
  document.getElementById('sDev').textContent=d.dev?.done?'1':'0';

  const p=CUR[devIndex()];
  document.getElementById('devName').textContent=p.title;
  document.getElementById('devMeta').textContent=`${p.skill} · сложность ${p.difficulty}/5 · ~${p.minutes} мин`;
  document.getElementById('devStrip').className='dev-strip'+(d.dev?.done?' done':'');
  document.getElementById('devGo').textContent=d.dev?.done?'ГОТОВО':'ОТКРЫТЬ';

  const c=completeCountWeek();
  document.getElementById('weekScore').textContent=`${c}/28`;
  document.getElementById('weekBar').style.width=`${c/28*100}%`;
  document.getElementById('xp').textContent=`${totalXP()} XP`;
}
function totalXP(){
  let xp=0;
  Object.values(state.days).forEach(d=>{
    ['school','trumpet','home'].forEach(k=>{if(d[k]?.done) xp+=20});
    if(d.dev?.done) xp+=50 + (d.dev.score||0)*10;
  });
  return xp;
}
document.addEventListener('click',e=>{
  const b=e.target.closest('[data-complete]');
  if(!b)return;
  const type=b.dataset.complete;
  const map={school:'School',trumpet:'Trumpet',home:'Home'};
  const t=document.getElementById('txt'+map[type]).value.trim();
  if(t.length<3){alert('Напиши коротко, что именно сделал.');return;}
  ensureDay(currentWeek(),selected)[type]={done:true,text:t,at:new Date().toISOString()};
  save();
  if(window.RICH_CLOUD){
    RICH_CLOUD.log({
      event_date:selectedDateISO(),
      week_index:currentWeek(),
      day_index:selected,
      category:type,
      title:type==='school'?'Уроки':type==='trumpet'?'Труба':'Помощь по дому',
      text_value:t,
      details:{source:'daily_block'}
    }).catch(()=>{});
  }
});
document.getElementById('devStrip').onclick=openDev;
document.getElementById('closeModal').onclick=closeDev;

function startTimer(){
  clearInterval(timerInt); timerStart=Date.now(); elapsed=0;
  timerInt=setInterval(()=>{
    elapsed=Math.floor((Date.now()-timerStart)/1000);
    const m=String(Math.floor(elapsed/60)).padStart(2,'0');
    const s=String(elapsed%60).padStart(2,'0');
    document.getElementById('timerText').textContent=`${m}:${s}`;
  },500);
}
function stopTimer(){clearInterval(timerInt)}
function openDev(){
  document.getElementById('modalBg').classList.add('open');
  buildDev(); startTimer();
}
function closeDev(){ stopTimer(); document.getElementById('modalBg').classList.remove('open') }
function buildDev(){
  answers={};confidence={};
  const p=CUR[devIndex()], body=document.getElementById('devBody');
  document.getElementById('modalTitle').textContent=p.title;
  let h=`<div class="meta">${p.intro}</div>`;
  if(p.passage) h+=`<div class="passage">${esc(p.passage)}</div>`;
  const d=ensureDay(currentWeek(),selected);
  if(d.dev?.done){
    h+=`<div class="resultbox"><b>Уже выполнено.</b><br>${esc(d.dev.summary||'Готово')}<br><span class="mini">Время: ${fmt(d.dev.seconds||0)}</span></div>`;
    body.innerHTML=h; return;
  }
  if(p.type==='open'){
    h+=`<div class="qbox"><b>ЗАДАНИЕ</b><br>${esc(p.prompt)}</div>
        <textarea id="openAnswer" style="min-height:150px" placeholder="Твой ответ..."></textarea>
        <div class="meta" style="margin-top:8px">Перед сдачей: какое условие ты ещё не проверил?</div>
        <textarea id="openCheck" placeholder="Короткая самопроверка..."></textarea>
        <button class="purple" id="submitOpen">СДАТЬ РЕШЕНИЕ</button>`;
    body.innerHTML=h;
    document.getElementById('submitOpen').onclick=submitOpen;
  } else {
    p.questions.forEach((q,qi)=>{
      h+=`<div class="qbox"><b>${qi+1}. ${esc(q.q)}</b><div class="options">`+
      q.opts.map((o,oi)=>`<button class="opt" data-q="${qi}" data-o="${oi}">${esc(o)}</button>`).join('')+
      `</div><div class="confidence" id="cf${qi}">
        <button data-cq="${qi}" data-c="low">не уверен</button>
        <button data-cq="${qi}" data-c="mid">средне</button>
        <button data-cq="${qi}" data-c="high">уверен</button>
      </div></div>`;
    });
    h+=`<button class="blue" id="submitQuiz">ПРОВЕРИЛ → ОТВЕТИТЬ</button>`;
    body.innerHTML=h;
    body.querySelectorAll('[data-q]').forEach(b=>b.onclick=()=>{
      const qi=+b.dataset.q, oi=+b.dataset.o; answers[qi]=oi;
      body.querySelectorAll(`[data-q="${qi}"]`).forEach(x=>x.classList.toggle('selected',x===b));
    });
    body.querySelectorAll('[data-cq]').forEach(b=>b.onclick=()=>{
      const qi=+b.dataset.cq; confidence[qi]=b.dataset.c;
      body.querySelectorAll(`[data-cq="${qi}"]`).forEach(x=>x.classList.toggle('selected',x===b));
    });
    document.getElementById('submitQuiz').onclick=submitQuiz;
  }
}
function submitOpen(){
  const a=document.getElementById('openAnswer').value.trim();
  const ch=document.getElementById('openCheck').value.trim();
  if(a.length<40){alert('Ответ слишком короткий. Нужен настоящий план/разбор.');return;}
  if(ch.length<10){alert('Добавь самопроверку: что ещё мог упустить?');return;}
  stopTimer();
  const d=ensureDay(currentWeek(),selected);
  d.dev={done:true,text:a,check:ch,seconds:elapsed,score:1,summary:'Открытая тренировка выполнена',at:new Date().toISOString()};
  save();
  if(window.RICH_CLOUD){
    const p=CUR[devIndex()];
    RICH_CLOUD.log({
      event_date:selectedDateISO(),
      week_index:currentWeek(),
      day_index:selected,
      training_index:devIndex(),
      category:'development',
      title:p.title,
      text_value:a,
      score:1,
      max_score:1,
      seconds:elapsed,
      details:{type:'open',skill:p.skill,difficulty:p.difficulty,self_check:ch}
    }).catch(()=>{});
  }
  showNotice('Развитие закрыто. +60 XP'); setTimeout(closeDev,800);
}
function submitQuiz(){
  const p=CUR[devIndex()];
  if(Object.keys(answers).length<p.questions.length){alert('Ответь на все вопросы.');return;}
  if(Object.keys(confidence).length<p.questions.length){alert('Отметь уверенность по каждому вопросу.');return;}
  stopTimer();
  let correct=0, highWrong=0, details=[];
  p.questions.forEach((q,i)=>{
    const ok=answers[i]===q.a; if(ok)correct++;
    if(!ok && confidence[i]==='high')highWrong++;
    details.push({q:i+1,answer:answers[i],correct:ok,confidence:confidence[i]});
  });
  const d=ensureDay(currentWeek(),selected);
  d.dev={done:true,text:`${correct}/${p.questions.length}`,score:correct,highWrong,seconds:elapsed,details,
    summary:`${correct}/${p.questions.length}; уверенных ошибок: ${highWrong}`,at:new Date().toISOString()};
  save();
  if(window.RICH_CLOUD){
    RICH_CLOUD.log({
      event_date:selectedDateISO(),
      week_index:currentWeek(),
      day_index:selected,
      training_index:devIndex(),
      category:'development',
      title:p.title,
      text_value:`${correct}/${p.questions.length}`,
      score:correct,
      max_score:p.questions.length,
      seconds:elapsed,
      confidence:confidence,
      details:{type:'quiz',skill:p.skill,difficulty:p.difficulty,high_wrong:highWrong,answers:details}
    }).catch(()=>{});
  }
  const body=document.getElementById('devBody');
  let html=`<div class="resultbox"><b>Результат ${correct}/${p.questions.length}</b><br>Уверенных ошибок: ${highWrong}<br>Время: ${fmt(elapsed)}</div>`;
  p.questions.forEach((q,i)=>{
    const ok=answers[i]===q.a;
    html+=`<div class="qbox"><b>${i+1}. ${ok?'Верно':'Ошибка'}</b><br>${esc(q.why)}</div>`;
  });
  html+=`<button class="primary" onclick="closeDev()">ГОТОВО</button>`;
  body.innerHTML=html;
}
function fmt(s){return `${Math.floor(s/60)}:${String(s%60).padStart(2,'0')}`}
function esc(s){return String(s||'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]))}
function showNotice(t){
  const n=document.getElementById('notice'); n.textContent=t;n.style.display='block';setTimeout(()=>n.style.display='none',1800);
}
document.getElementById('copyDay').onclick=async()=>{
  const d=ensureDay(currentWeek(),selected);
  const line=(k,n)=>`${n}: ${d[k]?.done?'✅ '+(d[k].text||'готово'):'⬜ не закрыто'}`;
  const txt=`RICH CRAFT — ${DAY_FULL[selected]}
${line('school','Уроки')}
${line('trumpet','Труба')}
${line('home','Дом')}
${line('dev','Развитие')}
Итог: ${['school','trumpet','home','dev'].filter(k=>d[k]?.done).length}/4`;
  await copyText(txt); showNotice('Отчёт дня скопирован');
};
document.getElementById('exportAll').onclick=()=>{
  const exported={journal_id:window.RICH_CLOUD?.journalId||null,state};
  const blob=new Blob([JSON.stringify(exported,null,2)],{type:'application/json'});
  const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='rich-craft-progress.json';a.click();URL.revokeObjectURL(a.href);
};
async function copyText(t){
  try{await navigator.clipboard.writeText(t)}catch(e){
    const ta=document.createElement('textarea');ta.value=t;document.body.appendChild(ta);ta.select();document.execCommand('copy');ta.remove();
  }
}
render();
