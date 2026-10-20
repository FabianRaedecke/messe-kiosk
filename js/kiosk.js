/* =====================================================================
   Maschinen-Explorer · Kiosk-Erweiterung (Messe)
   ---------------------------------------------------------------------
   Nach explorer.js einbinden. Lädt alles vorab, setzt nach
   data-idle-timeout Sekunden ohne Eingabe auf den Anfang zurück,
   hält den Bildschirm wach und unterbindet Zoom und Kontextmenü.
   ===================================================================== */
(() => {
  'use strict';

  const ex = window.explorer;
  if (!ex) return;

  const params  = new URLSearchParams(location.search);
  const IDLE_MS = parseFloat(params.get('idle') || ex.root.dataset.idleTimeout || '120') * 1000;
  const wait = ms => new Promise(r => setTimeout(r, ms));

  /* ---------- Alles vorladen ---------- */
  // Overlay-Bild laden, fertig entschlüsseln und behalten, damit es beim Öffnen ohne Aufblitzen erscheint
  function loadPoster(a) {
    const img = new Image();
    img.alt = ''; img.decoding = 'sync';
    img.src = ex.url.poster(a);
    return img.decode().then(() => { ex.posters.set(a.i, img); }, () => {});
  }
  async function preloadAll(onProgress) {
    const urls = [ex.url.loop()];
    ex.areas.forEach(a => {
      urls.push(ex.url.zoom(a, 'in'), ex.url.zoom(a, 'out'));
      if (a.hasVideo) urls.push(ex.url.detail(a));
    });
    const total = ex.frameCount + urls.length + ex.areas.length;
    let done = 0;
    const report = () => onProgress((ex.framesLoaded + done) / total);
    const tickP = () => { done++; report(); };
    const timer = setInterval(report, 200); // Fortschritt der Intro-Frames
    await Promise.all([
      ex.loadIntroFrames(),
      ...urls.map(u => ex.fetchVideo(u).then(tickP)),
      ...ex.areas.map(a => loadPoster(a).then(tickP)),
    ]);
    clearInterval(timer);
  }

  /* ---------- Nach Inaktivität zurück zum Anfang ---------- */
  const startedAt = Date.now();
  let lastActivity = Date.now();
  const veil = document.querySelector('.ex-veil');
  function markActivity() { lastActivity = Date.now(); }

  async function resetToStart() {
    if (ex.state === 'intro' && window.scrollY < 2) return;
    if (ex.state === 'zoomIn' || ex.state === 'zoomOut') { lastActivity = Date.now() - IDLE_MS + 3000; return; } // gleich nochmal versuchen
    if (veil) { veil.classList.add('on'); await wait(600); }
    // Nach langer Laufzeit einmal frisch laden (Speicher aufräumen), kommt aus dem Offline-Cache
    if (Date.now() - startedAt > 6 * 3600 * 1000) { location.reload(); return; }
    ex.reset();
    if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
    await wait(150);
    if (veil) veil.classList.remove('on');
    markActivity();
  }

  ['pointerdown', 'touchstart', 'wheel', 'keydown', 'scroll'].forEach(ev =>
    window.addEventListener(ev, markActivity, { passive: true, capture: true }));
  setInterval(() => { if (Date.now() - lastActivity >= IDLE_MS) resetToStart(); }, 1000);

  /* ---------- Bildschirm wach halten (Safari ab iPadOS 16.4) ---------- */
  let lock = null;
  const keepAwake = async () => {
    try { if ('wakeLock' in navigator && !lock && document.visibilityState === 'visible') { lock = await navigator.wakeLock.request('screen'); lock.addEventListener('release', () => lock = null); } } catch (e) {}
  };
  keepAwake();
  document.addEventListener('visibilitychange', keepAwake);
  window.addEventListener('pointerdown', keepAwake, { passive: true });

  // Zoomen und Kontextmenü unterbinden (Doppeltipp-Zoom per CSS touch-action)
  ['gesturestart', 'gesturechange'].forEach(ev => document.addEventListener(ev, e => e.preventDefault()));
  document.addEventListener('contextmenu', e => e.preventDefault());

  /* ---------- Start ---------- */
  ex.ready.then(async () => {
    const loader = document.querySelector('.ex-loader'), loaderText = document.querySelector('.ex-loader-text');
    await preloadAll(p => { if (loaderText) loaderText.textContent = `Lädt … ${Math.round(p * 100)} %`; });
    if (loader) loader.classList.add('done');
    markActivity();
  });

  window.explorer.kioskReset = resetToStart;
})();
