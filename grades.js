window.RICH_GRADES = (() => {
  const KEY = 'richCraftGradesV1';
  let editingId = null;
  let busy = false;

  function uid(){
    return crypto.randomUUID ? crypto.randomUUID() : 'grade-' + Date.now() + '-' + Math.random().toString(16).slice(2);
  }
  function today(){ return new Date().toISOString().slice(0,10); }
  function load(){
    try { return JSON.parse(localStorage.getItem(KEY) || '[]'); }
    catch { return []; }
  }
  function save(items){ localStorage.setItem(KEY, JSON.stringify(items)); }
  function esc(s){
    return String(s || '').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  }
  function fmtDate(s){
    if(!s) return 'срок не указан';
    const d = new Date(s + 'T12:00:00');
    return d.toLocaleDateString('ru-RU',{day:'numeric',month:'short'});
  }
  function canFixLabel(v){
    return v === 'yes' ? 'можно исправить' : v === 'no' ? 'не исправляется' : 'нужно уточнить';
  }

  function elements(){
    return {
      list: document.getElementById('gradesList'),
      open: document.getElementById('gradesOpen'),
      closed: document.getElementById('gradesClosed'),
      form: document.getElementById('gradeForm'),
      subject: document.getElementById('gradeSubject'),
      what: document.getElementById('gradeWhat'),
      why: document.getElementById('gradeWhy'),
      plan: document.getElementById('gradePlan'),
      deadline: document.getElementById('gradeDeadline'),
      canFix: document.getElementById('gradeCanFix'),
      submit: document.getElementById('gradeSubmit'),
      cancel: document.getElementById('gradeCancel'),
      formTitle: document.getElementById('gradeFormTitle')
    };
  }

  function render(){
    const e = elements();
    if(!e.list) return;
    const items = load();
    const open = items.filter(x=>x.status !== 'closed');
    const closed = items.filter(x=>x.status === 'closed');
    e.open.textContent = open.length;
    e.closed.textContent = closed.length;

    if(!items.length){
      e.list.innerHTML = '<div class="gradeEmpty">Пока записей нет.<br>Добавь первую двойку и разложи её без эмоций: <b>что произошло → почему → что делаем.</b></div>';
      return;
    }

    const sorted = [...items].sort((a,b)=>{
      if((a.status==='closed') !== (b.status==='closed')) return a.status==='closed' ? 1 : -1;
      return String(b.created_at).localeCompare(String(a.created_at));
    });

    e.list.innerHTML = sorted.map(x=>`
      <article class="gradeCard ${x.status==='closed'?'closed':''}" data-grade-id="${esc(x.id)}">
        <div class="gradeTop">
          <div><span class="gradeBadge">2</span><b>${esc(x.subject)}</b></div>
          <span class="gradeStatus">${x.status==='closed'?'ИСПРАВЛЕНО':'В РАБОТЕ'}</span>
        </div>
        <div class="gradeLine"><small>ЗА ЧТО</small><p>${esc(x.what)}</p></div>
        <div class="gradeLine"><small>ПОЧЕМУ ТАК ВЫШЛО</small><p>${esc(x.why)}</p></div>
        <div class="gradeLine plan"><small>ЧТО НУЖНО СДЕЛАТЬ</small><p>${esc(x.plan)}</p></div>
        <div class="gradeMeta"><span>📅 ${fmtDate(x.deadline)}</span><span>${esc(canFixLabel(x.can_fix))}</span></div>
        ${x.status==='closed' ?
          `<div class="gradeClosedAt">✓ закрыто ${fmtDate((x.closed_at||'').slice(0,10))}</div>` :
          `<div class="gradeActions"><button data-grade-edit="${esc(x.id)}">ИЗМЕНИТЬ</button><button class="gradeDone" data-grade-close="${esc(x.id)}">✓ ИСПРАВЛЕНО</button></div>`}
      </article>`).join('');

    e.list.querySelectorAll('[data-grade-close]').forEach(b=>b.onclick=()=>closeGrade(b.dataset.gradeClose));
    e.list.querySelectorAll('[data-grade-edit]').forEach(b=>b.onclick=()=>editGrade(b.dataset.gradeEdit));
  }

  function clearForm(){
    const e=elements();
    if(!e.form) return;
    e.form.reset();
    editingId=null;
    e.formTitle.textContent='РАЗОБРАТЬ ДВОЙКУ';
    e.submit.textContent='ДОБАВИТЬ В РАЗБОР';
    e.cancel.hidden=true;
  }

  function editGrade(id){
    const e=elements();
    const item=load().find(x=>x.id===id);
    if(!item) return;
    editingId=id;
    e.subject.value=item.subject||'';
    e.what.value=item.what||'';
    e.why.value=item.why||'';
    e.plan.value=item.plan||'';
    e.deadline.value=item.deadline||'';
    e.canFix.value=item.can_fix||'unknown';
    e.formTitle.textContent='ИЗМЕНИТЬ РАЗБОР';
    e.submit.textContent='СОХРАНИТЬ';
    e.cancel.hidden=false;
    e.form.scrollIntoView({behavior:'smooth',block:'start'});
  }

  async function log(item,action){
    try{
      await window.RICH_CLOUD?.log({
        event_date: today(),
        category:'grade_issue',
        title:item.subject,
        text_value: action==='closed' ? 'Исправлено' : item.what,
        details:{
          action,
          grade_id:item.id,
          subject:item.subject,
          what:item.what,
          why:item.why,
          plan:item.plan,
          deadline:item.deadline||null,
          can_fix:item.can_fix,
          status:item.status,
          app_version:'pwa_v2_grades_v1'
        }
      });
    }catch{}
  }

  async function submit(ev){
    ev.preventDefault();
    if(busy) return;
    const e=elements();
    const subject=e.subject.value.trim();
    const what=e.what.value.trim();
    const why=e.why.value.trim();
    const plan=e.plan.value.trim();
    if(subject.length<2) return alert('Напиши предмет.');
    if(what.length<4) return alert('Напиши, за что получил двойку.');
    if(why.length<4) return alert('Разбери, почему так вышло.');
    if(plan.length<4) return alert('Напиши, что нужно сделать.');

    busy=true;
    e.submit.disabled=true;
    const items=load();
    let item;
    let action='created';
    if(editingId){
      item=items.find(x=>x.id===editingId);
      if(!item){ busy=false; e.submit.disabled=false; return; }
      Object.assign(item,{subject,what,why,plan,deadline:e.deadline.value,can_fix:e.canFix.value,updated_at:new Date().toISOString()});
      action='updated';
    }else{
      item={id:uid(),subject,what,why,plan,deadline:e.deadline.value,can_fix:e.canFix.value,status:'open',created_at:new Date().toISOString()};
      items.push(item);
    }
    save(items);
    clearForm();
    render();
    await log(item,action);
    busy=false;
    e.submit.disabled=false;
  }

  async function closeGrade(id){
    if(busy) return;
    const items=load();
    const item=items.find(x=>x.id===id);
    if(!item || item.status==='closed') return;
    if(!confirm(`Точно исправлено: ${item.subject}?`)) return;
    busy=true;
    item.status='closed';
    item.closed_at=new Date().toISOString();
    save(items);
    render();
    await log(item,'closed');
    busy=false;
  }

  function init(){
    const e=elements();
    if(!e.form) return;
    e.form.addEventListener('submit',submit);
    e.cancel.addEventListener('click',clearForm);
    render();
  }

  window.addEventListener('load',init);
  return {render};
})();
