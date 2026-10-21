window.RICH_PUSH = (() => {
  const VERSION = '29';
  const PUBLIC_KEY = 'BItkwnCtm_lRThx5EGX9n5vg24xw2eYdgcrJ3FiE1oF7MjhFVnoc84D6dUHZX5pKie_UdeI2llm6bTnv4Xpl8_Y';
  const SUBSCRIBE_URL = 'https://ukrgjdbhbokfkpfpqmnb.supabase.co/functions/v1/rich-craft-push-subscribe';
  const JOURNAL_ID = 'rc_rodion_59da7a3cfbf30e70b30aa3dc';
  const TOKEN_KEY = 'richCraftDeviceTokenV1';
  const INSTALL_KEY = 'richCraftInstallIdV1';
  const TARGET_INSTALL_ID = '41f64301-bed2-4aca-b66b-166b5a2b4156';

  function b64ToUint8Array(base64String){
    const padding='='.repeat((4-base64String.length%4)%4);
    const base64=(base64String+padding).replace(/-/g,'+').replace(/_/g,'/');
    const raw=atob(base64);
    return Uint8Array.from([...raw].map(c=>c.charCodeAt(0)));
  }

  function els(){
    return {
      card:document.getElementById('pushCard'),
      status:document.getElementById('pushStatus'),
      button:document.getElementById('pushEnable')
    };
  }

  function setStatus(text, enabled=false, busy=false){
    const e=els();
    if(!e.status)return;
    e.status.textContent=`${text} · v${VERSION}`;
    e.card?.classList.toggle('enabled',enabled);
    if(e.button){
      e.button.textContent=enabled?'ВКЛЮЧЕНО':busy?'ПОДОЖДИ…':'ВКЛЮЧИТЬ';
      e.button.disabled=enabled||busy;
    }
  }

  function timeout(promise,ms,message){
    return Promise.race([
      promise,
      new Promise((_,reject)=>setTimeout(()=>reject(new Error(message||'timeout')),ms))
    ]);
  }

  async function readyWorker(){
    if(!('serviceWorker' in navigator))throw new Error('service_worker_unsupported');
    let reg=await timeout(navigator.serviceWorker.getRegistration(),5000,'service_worker_lookup_timeout');
    if(!reg){
      reg=await timeout(navigator.serviceWorker.register('./sw.js?v='+VERSION,{updateViaCache:'none'}),8000,'service_worker_register_timeout');
    } else {
      try{await timeout(reg.update(),6000,'service_worker_update_timeout');}catch{}
    }
    if(reg?.active)return reg;
    return await timeout(navigator.serviceWorker.ready,8000,'service_worker_ready_timeout');
  }

  async function syncSub(sub){
    const token=localStorage.getItem(TOKEN_KEY)||'';
    const installId=localStorage.getItem(INSTALL_KEY)||'';
    if(!token || !installId)throw new Error('missing_cloud');
    const r=await timeout(fetch(SUBSCRIBE_URL,{
      method:'POST',
      headers:{'Content-Type':'application/json','x-rich-device-token':token},
      body:JSON.stringify({journal_id:JOURNAL_ID,install_id:installId,subscription:sub.toJSON()})
    }),10000,'subscribe_timeout');
    if(!r.ok){
      let body='';
      try{body=await r.text();}catch{}
      throw new Error('subscribe_failed_'+r.status+(body?':'+body:''));
    }
  }

  async function finishSubscribe(reg){
    setStatus('создаю push-подписку…',false,true);
    let sub=await timeout(reg.pushManager.getSubscription(),6000,'push_get_subscription_timeout');
    if(!sub){
      sub=await timeout(reg.pushManager.subscribe({
        userVisibleOnly:true,
        applicationServerKey:b64ToUint8Array(PUBLIC_KEY)
      }),15000,'push_subscribe_timeout');
    }
    setStatus('сохраняю подписку…',false,true);
    await syncSub(sub);
    setStatus('каждый день в 15:00',true);
    await reg.showNotification('RICH CRAFT',{
      body:'Напоминание на 15:00 включено.',
      icon:'./icon-192.png',
      badge:'./icon-192.png',
      tag:'rich-craft-push-enabled'
    });
  }

  function showSiteSettingsHelp(){
    setStatus('разреши уведомления для сайта');
    alert('Chrome теперь может показывать разрешение на уведомления не отдельным окном, а через настройки сайта. Открой RICH CRAFT в Chrome → меню ⋮ → Настройки сайта / Разрешения → Уведомления → Разрешить. Потом вернись в RICH CRAFT — подписка включится автоматически.');
  }

  async function enable(){
    const e=els();
    if(!e.button || e.button.disabled)return;
    try{
      if(!('Notification' in window) || !('serviceWorker' in navigator) || !('PushManager' in window)){
        setStatus('не поддерживается');
        alert('Открой RICH CRAFT через Chrome и добавь на главный экран.');
        return;
      }
      const token=localStorage.getItem(TOKEN_KEY)||'';
      if(!token){
        setStatus('сначала подключи облачный журнал');
        alert('Сначала нажми на строку облачного журнала сверху и подключи RICH CRAFT.');
        return;
      }

      setStatus('проверяю разрешение…',false,true);
      let permission=Notification.permission;
      if(permission==='default'){
        try{permission=await Notification.requestPermission();}
        catch{permission='default';}
      }
      if(permission==='denied'){
        setStatus('уведомления запрещены в Android');
        alert('В Android открой Настройки → Приложения → Chrome (или RICH CRAFT) → Уведомления и разреши их. Затем вернись сюда.');
        return;
      }
      if(permission!=='granted'){
        showSiteSettingsHelp();
        return;
      }

      setStatus('готовлю уведомления…',false,true);
      const reg=await readyWorker();
      await finishSubscribe(reg);
    }catch(err){
      console.error('RICH PUSH ERROR',err);
      const code=String(err?.message||err);
      if(code.includes('service_worker'))setStatus('ошибка службы уведомлений');
      else if(code.includes('push_get_subscription'))setStatus('ошибка проверки подписки');
      else if(code.includes('push_subscribe'))setStatus('Android/Chrome не создал подписку');
      else if(code.includes('subscribe_failed')||code.includes('subscribe_timeout'))setStatus('сервер не принял подписку');
      else if(code.includes('missing_cloud'))setStatus('нет ключа облачного журнала');
      else setStatus('ошибка: '+code.slice(0,42));
      alert('Не получилось включить уведомления. Посмотри текст под «НАПОМИНАНИЕ · 15:00».');
    }
  }

  async function watchPermission(){
    if(!navigator.permissions?.query)return;
    try{
      const ps=await navigator.permissions.query({name:'notifications'});
      ps.onchange=async()=>{
        if(ps.state==='granted'){
          try{
            setStatus('разрешение получено, подключаю…',false,true);
            const reg=await readyWorker();
            await finishSubscribe(reg);
          }catch(err){
            console.error('Permission watcher subscribe failed',err);
            setStatus('разрешение есть, подписка не создана');
          }
        } else if(ps.state==='denied'){
          setStatus('уведомления запрещены');
        } else {
          setStatus('разреши уведомления для сайта');
        }
      };
    }catch{}
  }

  async function init(){
    const e=els();
    if(!e.card || !e.button)return;
    const installId=localStorage.getItem(INSTALL_KEY)||'';
    if(installId && installId!==TARGET_INSTALL_ID){
      e.card.hidden=true;
      return;
    }
    e.card.hidden=false;
    e.button.type='button';
    e.button.onclick=enable;
    watchPermission();

    if(!('Notification' in window) || !('PushManager' in window) || !('serviceWorker' in navigator)){
      setStatus('не поддерживается');
      return;
    }
    if(Notification.permission==='denied'){
      setStatus('запрещено в настройках телефона');
      return;
    }
    if(Notification.permission==='granted'){
      try{
        const reg=await readyWorker();
        const sub=await timeout(reg.pushManager.getSubscription(),6000,'push_get_subscription_timeout');
        if(sub){await syncSub(sub);setStatus('каждый день в 15:00',true);return;}
      }catch(err){console.warn('Push init retry later',err);}
    }
    setStatus('нажми «ВКЛЮЧИТЬ»');
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});
  else init();
  return {enable,init};
})();
