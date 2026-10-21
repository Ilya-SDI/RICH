const CACHE='rich-craft-v2-9-push-v29-20261021';
const ASSETS=[
'./',
'./index.html',
'./styles.css?v=24',
'./notes.css?v=24',
'./push.css?v=26',
'./app.js?v=22',
'./curriculum.js',
'./cloud.js',
'./grades.js?v=23',
'./notes.js?v=24',
'./push.js?v=29',
'./manifest.webmanifest',
'./icon-192.png',
'./icon-512.png',
'./maskable-512.png',
'./apple-touch-icon.png'
];

self.addEventListener('install',e=>{
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS)));
});

self.addEventListener('activate',e=>{
  e.waitUntil(Promise.all([
    self.clients.claim(),
    caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k))))
  ]));
});

self.addEventListener('fetch',e=>{
  if(e.request.method!=='GET')return;
  if(e.request.mode==='navigate'){
    e.respondWith(fetch(e.request,{cache:'no-store'}).catch(()=>caches.match('./index.html')));
    return;
  }
  e.respondWith(
    fetch(e.request,{cache:'no-store'})
      .then(r=>{const copy=r.clone();caches.open(CACHE).then(c=>c.put(e.request,copy));return r;})
      .catch(()=>caches.match(e.request))
  );
});

self.addEventListener('push',e=>{
  let data={};
  try{data=e.data?e.data.json():{};}catch{data={body:e.data?e.data.text():''};}
  const title=data.title||'RICH CRAFT';
  const options={
    body:data.body||'Пора сделать свой шаг.',
    icon:data.icon||'./icon-192.png',
    badge:data.badge||'./icon-192.png',
    tag:data.tag||'rich-craft-daily',
    renotify:false,
    data:{url:data.url||'./'}
  };
  e.waitUntil(self.registration.showNotification(title,options));
});

self.addEventListener('notificationclick',e=>{
  e.notification.close();
  const target=new URL(e.notification.data?.url||'./',self.registration.scope).href;
  e.waitUntil((async()=>{
    const list=await clients.matchAll({type:'window',includeUncontrolled:true});
    for(const client of list){
      if(client.url.startsWith(self.registration.scope)){
        await client.focus();
        if('navigate' in client)await client.navigate(target);
        return;
      }
    }
    if(clients.openWindow)await clients.openWindow(target);
  })());
});