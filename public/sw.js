// Only public install assets are cached. No app HTML, API, auth, uploads,
// signed attachment URLs or account data may enter this cache.
const CACHE='project-finance-public-v1'
const PUBLIC_FILES=['/offline.html','/icons/app-192.png','/icons/app-512.png','/icons/app-maskable-512.png','/icons/apple-touch-icon.png']
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(PUBLIC_FILES))))
self.addEventListener('activate',event=>event.waitUntil((async()=>{
 for(const key of await caches.keys())if(key.startsWith('project-finance-public-')&&key!==CACHE)await caches.delete(key)
 await self.clients.claim()
})()))
self.addEventListener('fetch',event=>{
 const request=event.request,url=new URL(request.url)
 if(request.method!=='GET'||url.origin!==self.location.origin)return
 if(request.mode==='navigate'){
  event.respondWith(fetch(request).catch(async()=>{
   const cache=await caches.open(CACHE)
   return await cache.match('/offline.html')||new Response('暫時未能連線，請上網後重試。',{status:503,headers:{'Content-Type':'text/plain;charset=utf-8'}})
  }))
 }else if(!url.search&&PUBLIC_FILES.includes(url.pathname)){
  event.respondWith(caches.open(CACHE).then(async cache=>await cache.match(url.pathname)||fetch(request)))
 }
})
