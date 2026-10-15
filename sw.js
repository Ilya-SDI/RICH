const CACHE='rich-craft-v2-4-day-note-20261015';
const ASSETS=[
'./',
'./index.html',
'./styles.css?v=24',
'./notes.css?v=24',
'./app.js?v=22',
'./curriculum.js',
'./cloud.js',
'./grades.js?v=23',
'./notes.js?v=24',
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
    e.respondWith(
      fetch(e.request,{cache:'no-store'})
        .catch(()=>caches.match('./index.html'))
    );
    return;
  }
  e.respondWith(
    fetch(e.request,{cache:'no-store'})
      .then(r=>{
        const copy=r.clone();
        caches.open(CACHE).then(c=>c.put(e.request,copy));
        return r;
      })
      .catch(()=>caches.match(e.request))
  );
});
