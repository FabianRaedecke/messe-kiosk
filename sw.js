/* Service Worker: hält die Messe-Version offline verfügbar.
   Wird beim ersten Aufruf mit Internet komplett in den Cache geladen.
   Nach Änderungen an Dateien: tools/build-sw.py erneut ausführen (neue Version). */
const VERSION = 'explorer-444f3949';
const PRECACHE = [
 "./",
 "index.html",
 "manifest.webmanifest",
 "css/explorer.css",
 "css/kiosk.css",
 "js/explorer.js",
 "js/kiosk.js",
 "icon-180.png",
 "icon-192.png",
 "icon-512.png",
 "assets/fonts/SuisseIntl-Black-WebS.woff2",
 "assets/intro/1920/f000.webp",
 "assets/intro/1920/f000.avif",
 "assets/intro/1920/f001.avif",
 "assets/intro/1920/f002.avif",
 "assets/intro/1920/f003.avif",
 "assets/intro/1920/f004.avif",
 "assets/intro/1920/f005.avif",
 "assets/intro/1920/f006.avif",
 "assets/intro/1920/f007.avif",
 "assets/intro/1920/f008.avif",
 "assets/intro/1920/f009.avif",
 "assets/intro/1920/f010.avif",
 "assets/intro/1920/f011.avif",
 "assets/intro/1920/f012.avif",
 "assets/intro/1920/f013.avif",
 "assets/intro/1920/f014.avif",
 "assets/intro/1920/f015.avif",
 "assets/intro/1920/f016.avif",
 "assets/intro/1920/f017.avif",
 "assets/intro/1920/f018.avif",
 "assets/intro/1920/f019.avif",
 "assets/intro/1920/f020.avif",
 "assets/intro/1920/f021.avif",
 "assets/intro/1920/f022.avif",
 "assets/intro/1920/f023.avif",
 "assets/intro/1920/f024.avif",
 "assets/intro/1920/f025.avif",
 "assets/intro/1920/f026.avif",
 "assets/intro/1920/f027.avif",
 "assets/intro/1920/f028.avif",
 "assets/intro/1920/f029.avif",
 "assets/intro/1920/f030.avif",
 "assets/intro/1920/f031.avif",
 "assets/intro/1920/f032.avif",
 "assets/intro/1920/f033.avif",
 "assets/intro/1920/f034.avif",
 "assets/intro/1920/f035.avif",
 "assets/intro/1920/f036.avif",
 "assets/intro/1920/f037.avif",
 "assets/intro/1920/f038.avif",
 "assets/intro/1920/f039.avif",
 "assets/intro/1920/f040.avif",
 "assets/intro/1920/f041.avif",
 "assets/intro/1920/f042.avif",
 "assets/intro/1920/f043.avif",
 "assets/intro/1920/f044.avif",
 "assets/intro/1920/f045.avif",
 "assets/intro/1920/f046.avif",
 "assets/intro/1920/f047.avif",
 "assets/intro/1920/f048.avif",
 "assets/intro/1920/f049.avif",
 "assets/intro/1920/f050.avif",
 "assets/video/detail-01-1920.mp4",
 "assets/video/detail-02-1920.mp4",
 "assets/video/detail-03-1920.mp4",
 "assets/video/overview-loop-1920.mp4",
 "assets/video/zoom-01-in-1920.mp4",
 "assets/video/zoom-01-out-1920.mp4",
 "assets/video/zoom-02-in-1920.mp4",
 "assets/video/zoom-02-out-1920.mp4",
 "assets/video/zoom-03-in-1920.mp4",
 "assets/video/zoom-03-out-1920.mp4",
 "assets/video/zoom-04-in-1920.mp4",
 "assets/video/zoom-04-out-1920.mp4",
 "assets/video/detail-01-1920.avif",
 "assets/video/detail-02-1920.avif",
 "assets/video/detail-03-1920.avif",
 "assets/video/detail-04-1920.avif",
 "assets/video/detail-01-1920.jpg",
 "assets/video/detail-02-1920.jpg",
 "assets/video/detail-03-1920.jpg",
 "assets/video/detail-04-1920.jpg"
];

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
