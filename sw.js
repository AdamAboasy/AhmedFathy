/* ==========================================================
   منصة المستر — Service Worker (تشغيل أوفلاين + تثبيت PWA)
   ========================================================== */
const CACHE = 'mostar-v2.1.0';
const CORE = [
  './',
  './index.html',
  './manifest.webmanifest',
  './logo.png',
  './logo.jpg',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/maskable-512.png',
  './icons/apple-touch-icon.png',
  './icons/favicon-64.png'
];

self.addEventListener('install', event => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE).then(cache => Promise.allSettled(CORE.map(u => cache.add(new Request(u, { cache: 'reload' })))))
  );
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)));
    if (self.registration.navigationPreload) { try { await self.registration.navigationPreload.disable(); } catch (e) {} }
    await self.clients.claim();
  })());
});

self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // Firebase / الخطوط: تتسيب للشبكة

  // صفحات التنقل: الشبكة أولًا (لضمان أحدث نسخة) ثم الكاش
  if (req.mode === 'navigate'){
    event.respondWith((async () => {
      try{
        const fresh = await fetch(req);
        const cache = await caches.open(CACHE);
        cache.put('./index.html', fresh.clone());
        return fresh;
      }catch(e){
        const cache = await caches.open(CACHE);
        return (await cache.match('./index.html')) || (await cache.match('./')) || Response.error();
      }
    })());
    return;
  }

  // باقي الملفات: الكاش أولًا مع تحديث في الخلفية
  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const hit = await cache.match(req);
    if (hit){
      fetch(req).then(res => { if (res && res.ok) cache.put(req, res.clone()); }).catch(() => {});
      return hit;
    }
    try{
      const res = await fetch(req);
      if (res && res.ok && res.type === 'basic') cache.put(req, res.clone());
      return res;
    }catch(e){
      return (await cache.match('./index.html')) || Response.error();
    }
  })());
});
