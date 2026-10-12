const CACHE='rich-craft-secure-v3';
const ASSETS=['./','./index.html','./styles.css','./app.js','./curriculum.js','./cloud.js','./manifest.webmanifest'];
self.addEventListener('install',e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS))));
self.addEventListener('fetch',e=>e.respondWith(caches.match(e.request).then(r=>r||fetch(e.request))));
