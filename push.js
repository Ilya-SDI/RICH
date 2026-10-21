window.RICH_PUSH = (() => {
  const VERSION = '28';
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
    e.status.textContent=text;
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
    try{
      setStatus('обновляю службу уведомлений…',false,true);
      const reg=await timeout(
        navigator.serviceWorker.register('./sw.js?v='+VERSION,{updateViaCache:'none'}),
        10000,
        'service_worker_register_timeout'
      );
      try{await timeout(reg.update(),6000,'service_worker_update_timeout');}catch{}
      if(reg.active)return reg;
      return await timeout(navigator.serviceWorker.ready,10000,'service_worker_ready_timeout');
    }catch(e){
      console.error('SW ready failed',e);
      throw e;
    }
  }

  async function getSub(){
    if(!('PushManager' in window))return null;
    const reg=await readyWorker();
    return await timeout(reg.pushManager.getSubscription(),6000,'push_get_subscription_timeout');
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

  async function enable(){
    const e=els();
    if(!e.button || e.button.disabled)return;
    try{
      if(!('Notification' in window) || !('serviceWorker' in navigator) || !('PushManager' in window)){
        setStatus('не поддерживается · v'+VERSION);
        alert('Этот браузер не поддерживает push-уведомления. Открой RICH CRAFT через Chrome и добавь на главный экран.');
        return;
      }
      const token=localStorage.getItem(TOKEN_KEY)||'';
      if(!token){
        setStatus('сначала подключи облачный журнал · v'+VERSION);
        alert('Сначала нажми на строку облачного журнала сверху и подключи RICH CRAFT.');
        return;
      }

      setStatus('проверяю разрешение… · v'+VERSION,false,true);
      let permission=Notification.permission;
      if(permission==='default')permission=await timeout(Notification.requestPermission(),12000,'permission_timeout');
      if(permission!=='granted'){
        setStatus((permission==='denied'?'уведомления запрещены в Android':'разрешение не дано')+' · v'+VERSION);
        alert('Нужно разрешить уведомления для RICH CRAFT в настройках телефона.');
        return;
      }

      const reg=await readyWorker();
      setStatus('создаю push-подписку… · v'+VERSION,false,true);
      let sub=await timeout(reg.pushManager.getSubscription(),6000,'push_get_subscription_timeout');
      if(!sub){
        sub=await timeout(reg.pushManager.subscribe({
          userVisibleOnly:true,
          applicationServerKey:b64ToUint8Array(PUBLIC_KEY)
        }),15000,'push_subscribe_timeout');
      }

      setStatus('сохраняю подписку… · v'+VERSION,false,true);
      await syncSub(sub);
      setStatus('каждый день в 15:00 · v'+VERSION,true);
      await reg.showNotification('RICH CRAFT',{
        body:'Напоминание на 15:00 включено.',
        icon:'./icon-192.png',
        badge:'./icon-192.png',
        tag:'rich-craft-push-enabled'
      });
    }catch(err){
      console.error('RICH PUSH ERROR',err);
      const code=String(err?.message||err);
      if(code.includes('permission_timeout'))setStatus('Android не открыл запрос разрешения · v'+VERSION);
      else if(code.includes('service_worker'))setStatus('ошибка службы уведомлений · v'+VERSION);
      else if(code.includes('push_get_subscription'))setStatus('ошибка проверки подписки · v'+VERSION);
      else if(code.includes('push_subscribe'))setStatus('Android не создал push-подписку · v'+VERSION);
      else if(code.includes('subscribe_failed')||code.includes('subscribe_timeout'))setStatus('сервер не принял подписку · v'+VERSION);
      else if(code.includes('missing_cloud'))setStatus('нет ключа облачного журнала · v'+VERSION);
      else setStatus('ошибка: '+code.slice(0,42)+' · v'+VERSION);
      alert('Не получилось включить уведомления. Пришли папе текст под «НАПОМИНАНИЕ · 15:00».');
    }
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

    if(!('Notification' in window) || !('PushManager' in window) || !('serviceWorker' in navigator)){
      setStatus('не поддерживается · v'+VERSION);
      return;
    }
    if(Notification.permission==='denied'){
      setStatus('запрещено в настройках телефона · v'+VERSION);
      return;
    }
    if(Notification.permission==='granted'){
      try{
        const sub=await getSub();
        if(sub){await syncSub(sub);setStatus('каждый день в 15:00 · v'+VERSION,true);return;}
      }catch(err){console.warn('Push init retry later',err);}
    }
    setStatus('нажми «ВКЛЮЧИТЬ» · v'+VERSION);
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});
  else init();
  return {enable,init};
})();
