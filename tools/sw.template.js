/* Service Worker: hält die Messe-Version offline verfügbar.
   Wird beim ersten Aufruf mit Internet komplett in den Cache geladen.
   Nach Änderungen an Dateien: tools/build-sw.py erneut ausführen (neue Version). */
const VERSION = '__VERSION__';
const PRECACHE = __PRECACHE__;

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(PRECACHE)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Cache zuerst, sonst Netz (und dann für später merken)
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  e.respondWith(
    caches.match(req, { ignoreSearch: true }).then(hit => hit || fetch(req).then(res => {
      if (res.ok && res.status === 200) { const copy = res.clone(); caches.open(VERSION).then(c => c.put(req, copy)); }
      return res;
    }).catch(() => req.mode === 'navigate' ? caches.match('index.html') : Response.error()))
  );
});

// Seite kann fragen, ob alles offline bereit ist
self.addEventListener('message', async e => {
  if (e.data !== 'status') return;
  const c = await caches.open(VERSION);
  const keys = await c.keys();
  e.source.postMessage({ type: 'status', cached: keys.length, total: PRECACHE.length, version: VERSION });
});
