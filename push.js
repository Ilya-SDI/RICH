window.RICH_PUSH = (() => {
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

  function setStatus(text, enabled=false){
    const e=els();
    if(!e.status)return;
    e.status.textContent=text;
    e.card?.classList.toggle('enabled',enabled);
    if(e.button)e.button.textContent=enabled?'ВКЛЮЧЕНО':'ВКЛЮЧИТЬ';
    if(e.button)e.button.disabled=enabled;
  }

  async function getSub(){
    if(!('serviceWorker' in navigator) || !('PushManager' in window))return null;
    const reg=await navigator.serviceWorker.ready;
    return await reg.pushManager.getSubscription();
  }

  async function syncSub(sub){
    const token=localStorage.getItem(TOKEN_KEY)||'';
    const installId=localStorage.getItem(INSTALL_KEY)||'';
    if(!token || !installId)throw new Error('missing_cloud');

    const r=await fetch(SUBSCRIBE_URL,{
      method:'POST',
      headers:{'Content-Type':'application/json','x-rich-device-token':token},
      body:JSON.stringify({journal_id:JOURNAL_ID,install_id:installId,subscription:sub.toJSON()})
    });
    if(!r.ok)throw new Error('subscribe_failed');
  }

  async function enable(){
    const e=els();
    if(e.button)e.button.disabled=true;
    try{
      if(!('Notification' in window) || !('serviceWorker' in navigator) || !('PushManager' in window)){
        setStatus('уведомления не поддерживаются');
        return;
      }
      const token=localStorage.getItem(TOKEN_KEY)||'';
      if(!token){
        setStatus('сначала подключи облачный журнал');
        alert('Сначала подключи облачный журнал RICH CRAFT.');
        return;
      }
      const permission=await Notification.requestPermission();
      if(permission!=='granted'){
        setStatus('разрешение не дано');
        return;
      }
      const reg=await navigator.serviceWorker.ready;
      let sub=await reg.pushManager.getSubscription();
      if(!sub){
        sub=await reg.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:b64ToUint8Array(PUBLIC_KEY)});
      }
      await syncSub(sub);
      setStatus('каждый день в 15:00',true);
      await reg.showNotification('RICH CRAFT',{
        body:'Напоминание на 15:00 включено.',
        icon:'./icon-192.png',
        badge:'./icon-192.png',
        tag:'rich-craft-push-enabled'
      });
    }catch(err){
      console.error(err);
      setStatus('не удалось включить');
      alert('Не получилось включить уведомления. Открой RICH CRAFT ещё раз и попробуй снова.');
    }finally{
      if(e.button && !e.card?.classList.contains('enabled'))e.button.disabled=false;
    }
  }

  async function init(){
    const e=els();
    if(!e.card)return;
    const installId=localStorage.getItem(INSTALL_KEY)||'';
    if(installId && installId!==TARGET_INSTALL_ID){
      e.card.hidden=true;
      return;
    }
    e.button.onclick=enable;
    if(!('Notification' in window) || !('PushManager' in window)){
      setStatus('не поддерживается');
      return;
    }
    if(Notification.permission==='denied'){
      setStatus('запрещено в настройках телефона');
      return;
    }
    if(Notification.permission==='granted'){
      const sub=await getSub();
      if(sub){
        try{await syncSub(sub);setStatus('каждый день в 15:00',true);return;}catch{}
      }
    }
    setStatus('выключено');
  }

  window.addEventListener('load',()=>setTimeout(init,900));
  return {enable,init};
})();
