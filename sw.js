const PREFIX='myltv-mobile:'+self.registration.scope+':';
const VERSION=PREFIX+'v1';
const SHELL=['./','index.html','style.css','manifest.webmanifest','icons/logo.svg','icons/icon-192.png','icons/icon-512.png','icons/apple-touch-icon.png','src/app.js','src/model.js','src/store.js','src/backup.js','src/renderer.js','src/engine.js','src/mp4.js','src/exporter.js'];
self.addEventListener('install',event=>event.waitUntil(caches.open(VERSION).then(cache=>cache.addAll(SHELL))));
self.addEventListener('activate',event=>event.waitUntil((async()=>{for(const key of await caches.keys())if(key.startsWith(PREFIX)&&key!==VERSION)await caches.delete(key);await self.clients.claim();})()));
self.addEventListener('message',event=>{if(event.data==='ACTIVATE')self.skipWaiting();});
self.addEventListener('fetch',event=>{if(event.request.method!=='GET'||new URL(event.request.url).origin!==self.location.origin)return;event.respondWith((async()=>{const cache=await caches.open(VERSION);const hit=await cache.match(event.request,{ignoreSearch:true});if(hit)return hit;if(event.request.mode==='navigate')return await cache.match(new URL('./index.html',self.registration.scope));return fetch(event.request);})());});
