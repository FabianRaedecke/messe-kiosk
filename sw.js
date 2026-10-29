/* Service Worker: hält die Messe-Version offline verfügbar.
   Wird beim ersten Aufruf mit Internet komplett in den Cache geladen.
   Nach Änderungen an Dateien: tools/build-sw.py erneut ausführen (neue Version). */
const VERSION = 'explorer-5c150de6';
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
 "assets/fonts/SuisseIntl-Regular-WebS.woff2",
 "assets/fonts/SuisseIntl-Bold-WebS.woff2",
 "assets/fonts/SuisseIntl-Medium-WebS.woff2",
 "assets/intro/1920/f000.jpg",
 "assets/intro/1920/f001.jpg",
 "assets/intro/1920/f002.jpg",
 "assets/intro/1920/f003.jpg",
 "assets/intro/1920/f004.jpg",
 "assets/intro/1920/f005.jpg",
 "assets/intro/1920/f006.jpg",
 "assets/intro/1920/f007.jpg",
 "assets/intro/1920/f008.jpg",
 "assets/intro/1920/f009.jpg",
 "assets/intro/1920/f010.jpg",
 "assets/intro/1920/f011.jpg",
 "assets/intro/1920/f012.jpg",
 "assets/intro/1920/f013.jpg",
 "assets/intro/1920/f014.jpg",
 "assets/intro/1920/f015.jpg",
 "assets/intro/1920/f016.jpg",
 "assets/intro/1920/f017.jpg",
 "assets/intro/1920/f018.jpg",
 "assets/intro/1920/f019.jpg",
 "assets/intro/1920/f020.jpg",
 "assets/intro/1920/f021.jpg",
 "assets/intro/1920/f022.jpg",
 "assets/intro/1920/f023.jpg",
 "assets/intro/1920/f024.jpg",
 "assets/intro/1920/f025.jpg",
 "assets/intro/1920/f026.jpg",
 "assets/intro/1920/f027.jpg",
 "assets/intro/1920/f028.jpg",
 "assets/intro/1920/f029.jpg",
 "assets/intro/1920/f030.jpg",
 "assets/intro/1920/f031.jpg",
 "assets/intro/1920/f032.jpg",
 "assets/intro/1920/f033.jpg",
 "assets/intro/1920/f034.jpg",
 "assets/intro/1920/f035.jpg",
 "assets/intro/1920/f036.jpg",
 "assets/intro/1920/f037.jpg",
 "assets/intro/1920/f038.jpg",
 "assets/intro/1920/f039.jpg",
 "assets/intro/1920/f040.jpg",
 "assets/intro/1920/f041.jpg",
 "assets/intro/1920/f042.jpg",
 "assets/intro/1920/f043.jpg",
 "assets/intro/1920/f044.jpg",
 "assets/intro/1920/f045.jpg",
 "assets/intro/1920/f046.jpg",
 "assets/intro/1920/f047.jpg",
 "assets/intro/1920/f048.jpg",
 "assets/intro/1920/f049.jpg",
 "assets/video/detail-02-1920.mp4",
 "assets/video/detail-03-1920.mp4",
 "assets/video/intro-1920.mp4",
 "assets/video/overview-loop-1920.mp4",
 "assets/video/zoom-01-in-1920.mp4",
 "assets/video/zoom-01-out-1920.mp4",
 "assets/video/zoom-02-in-1920.mp4",
 "assets/video/zoom-02-out-1920.mp4",
 "assets/video/zoom-03-in-1920.mp4",
 "assets/video/zoom-03-out-1920.mp4",
 "assets/video/zoom-04-in-1920.mp4",
 "assets/video/zoom-04-out-1920.mp4",
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
