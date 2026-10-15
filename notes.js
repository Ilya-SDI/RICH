window.RICH_DAY_NOTES = (() => {
  const KEY='richCraftDayNotesV1';
  let currentDate=null;

  function load(){
    try{return JSON.parse(localStorage.getItem(KEY)||'{}')}catch{return{}}
  }
  function save(data){localStorage.setItem(KEY,JSON.stringify(data))}
  function closestDateFromLabel(label){
    const m=String(label||'').trim().match(/(\d{1,2})\s+([а-яё]+)/i);
    if(!m)return new Date().toISOString().slice(0,10);
    const months={января:0,февраля:1,марта:2,апреля:3,мая:4,июня:5,июля:6,августа:7,сентября:8,октября:9,ноября:10,декабря:11};
    const month=months[m[2].toLowerCase()];
    if(month===undefined)return new Date().toISOString().slice(0,10);
    const day=+m[1],now=new Date();
    const candidates=[now.getFullYear()-1,now.getFullYear(),now.getFullYear()+1].map(y=>new Date(y,month,day,12));
    candidates.sort((a,b)=>Math.abs(a-now)-Math.abs(b-now));
    const d=candidates[0];
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  }
  function selectedDate(){
    const el=document.getElementById('todayDate');
    return closestDateFromLabel(el?.textContent||'');
  }
  function render(){
    const box=document.getElementById('dayNoteText');
    const status=document.getElementById('dayNoteStatus');
    if(!box)return;
    currentDate=selectedDate();
    const data=load();
    box.value=data[currentDate]?.text||'';
    if(status){
      const saved=!!data[currentDate]?.text;
      status.textContent=saved?'сохранено':'необязательно';
      status.dataset.saved=saved?'1':'0';
    }
  }
  async function submit(){
    const box=document.getElementById('dayNoteText');
    const btn=document.getElementById('dayNoteSave');
    const status=document.getElementById('dayNoteStatus');
    if(!box)return;
    const text=box.value.trim();
    if(text.length<2)return alert('Напиши хотя бы пару слов — или просто оставь заметку пустой.');
    const date=selectedDate();
    const data=load();
    if(data[date]?.text===text){
      if(status)status.textContent='уже сохранено';
      return;
    }
    btn.disabled=true;
    data[date]={text,at:new Date().toISOString()};
    save(data);
    if(status){status.textContent='сохранено ✓';status.dataset.saved='1'}
    try{
      await window.RICH_CLOUD?.log({
        event_date:date,
        category:'day_note',
        title:'Заметка дня',
        text_value:text,
        details:{source:'day_note',app_version:'pwa_v2_day_note_v1'}
      });
    }catch{}
    btn.disabled=false;
  }
  function init(){
    const btn=document.getElementById('dayNoteSave');
    const dateEl=document.getElementById('todayDate');
    if(!btn||!dateEl)return;
    btn.onclick=submit;
    new MutationObserver(()=>setTimeout(render,0)).observe(dateEl,{childList:true,characterData:true,subtree:true});
    render();
  }
  window.addEventListener('load',init);
  return{render};
})();
