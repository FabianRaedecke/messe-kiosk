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
  async function preloadAll(onProgress) {
    const urls = [ex.url.loop(), `${ex.root.dataset.assets || 'assets/'}video/intro-1920.mp4`];
    ex.areas.forEach(a => {
      urls.push(ex.url.zoom(a, 'in'), ex.url.zoom(a, 'out'));
      if (a.hasVideo) urls.push(ex.url.detail(a));
    });
    const posters = ex.areas.map(ex.url.poster);
    const total = ex.frameCount + urls.length + posters.length;
    let done = 0;
    const report = () => onProgress((ex.framesLoaded + done) / total);
    const tickP = () => { done++; report(); };
    const timer = setInterval(report, 200); // Fortschritt der Intro-Frames
    await Promise.all([
      ex.loadIntroFrames(),
      ...urls.map(u => ex.fetchVideo(u).then(tickP)),
      ...posters.map(u => new Promise(r => { const i = new Image(); i.onload = i.onerror = () => { tickP(); r(); }; i.src = u; })),
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
    playing = false; stopIntro();
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

  /* ---------- Play-Button statt Wischen ---------- */
  // Spielt die Kamerafahrt als Video bis zur Übersicht mit den Hotspots ab
  // (Fallback: Scrollstrecke mit den Einzelbildern automatisch abfahren).
  // Manuelles Scrollen ist im Kiosk gesperrt (nur der Text im Overlay scrollt).
  const PLAY_MS = parseFloat(params.get('play') || ex.root.dataset.playDuration || '4') * 1000;
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const sticky = ex.root.querySelector('.ex-sticky');
  const playBtn = document.createElement('button');
  playBtn.type = 'button'; playBtn.className = 'ex-play';
  playBtn.setAttribute('aria-label', 'See details');
  playBtn.innerHTML = '<span class="ring"></span><span class="dot"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5.5v13l11-6.5z"/></svg></span><span class="label">See details</span>';
  sticky.appendChild(playBtn);

  let playing = false;
  const ease = t => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  function autoScroll() {
    if (playing) return;
    playing = true; playBtn.classList.remove('on');
    const from = window.scrollY;
    const to = ex.root.offsetTop + ex.root.offsetHeight - innerHeight;
    const dur = reduceMotion ? 0 : PLAY_MS, t0 = performance.now();
    const step = now => {
      if (!playing) return;
      const t = dur ? Math.min(1, (now - t0) / dur) : 1;
      window.scrollTo(0, from + (to - from) * ease(t));
      markActivity();
      if (t < 1) requestAnimationFrame(step); else playing = false;
    };
    requestAnimationFrame(step);
  }

  // Kamerafahrt als Video (flüssiger als die Einzelbilder). Am Ende steht das letzte Bild,
  // darunter wird die Übersicht aufgebaut; erst wenn der Loop läuft, wird das Video ausgeblendet.
  const introUrl = `${ex.root.dataset.assets || 'assets/'}video/intro-1920.mp4`;
  const introV = document.createElement('video');
  introV.className = 'ex-intro'; introV.muted = true; introV.playsInline = true; introV.preload = 'none';
  introV.setAttribute('muted', ''); introV.setAttribute('playsinline', ''); introV.setAttribute('aria-hidden', 'true');
  ex.root.querySelector('.ex-hotspots').before(introV);
  const loopV = ex.root.querySelector('.ex-loop');
  const until = (cond, ms) => new Promise(r => { const t0 = Date.now(); (function check() { cond() || Date.now() - t0 > ms ? r() : setTimeout(check, 50); })(); });
  // Zeitpunkt im Video, an dem die Übersicht erreicht ist (= letzter Intro-Frame)
  const INTRO_END_T = parseFloat(params.get('introEnd') || ex.root.dataset.introEnd || '2');
  let run = 0;

  async function playIntro() {
    if (playing) return;
    if (reduceMotion) return autoScroll();
    const me = ++run;
    playing = true; playBtn.classList.remove('on'); markActivity();
    try {
      const src = await ex.fetchVideo(introUrl);
      if (introV.dataset.src !== src) { introV.dataset.src = src; introV.src = src; }
      introV.currentTime = 0;
      await introV.play();
    } catch (e) { playing = false; return autoScroll(); } // Fallback: Einzelbilder
    await until(() => introV.currentTime > 0, 500);  // erst einblenden, wenn das erste Bild steht
    if (me !== run) return;
    introV.classList.add('on');
    // Bis zur Übersicht abspielen (das Video läuft danach weiter) und dort anhalten
    await new Promise(r => (function watch() {
      if (me !== run) return r();
      if (introV.currentTime >= INTRO_END_T - 0.01 || introV.ended) { introV.pause(); return r(); }
      setTimeout(watch, 10);
    })());
    if (me !== run) return;
    window.scrollTo(0, ex.root.offsetTop + ex.root.offsetHeight - innerHeight);
    await until(() => ex.state === 'overview' && loopV.classList.contains('on') && !loopV.paused, 3000);
    if (me !== run) return;
    introV.classList.remove('on');
    playing = false;
  }
  function stopIntro() { run++; introV.pause(); introV.classList.remove('on'); }
  playBtn.addEventListener('click', playIntro);

  // Reset-Button in der Übersicht: zurück zum Anfang
  const resetBtn = document.createElement('button');
  resetBtn.type = 'button'; resetBtn.className = 'ex-reset';
  resetBtn.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12a8 8 0 1 0 2.4-5.7M4 4v4.5h4.5"/></svg><span>Reset</span>';
  sticky.appendChild(resetBtn);
  resetBtn.addEventListener('click', resetToStart);

  // Play-Button nur am Anfang, Reset-Button nur in der Übersicht zeigen
  setInterval(() => {
    playBtn.classList.toggle('on', !playing && ex.state === 'intro' && window.scrollY < 2);
    resetBtn.classList.toggle('on', !playing && ex.state === 'overview');
  }, 250);

  const blockScroll = e => { if (!e.target.closest('.ex-copy')) e.preventDefault(); };
  window.addEventListener('touchmove', blockScroll, { passive: false });
  window.addEventListener('wheel', blockScroll, { passive: false });
  window.addEventListener('keydown', e => {
    if ([' ', 'PageDown', 'PageUp', 'ArrowDown', 'ArrowUp', 'Home', 'End'].includes(e.key) && !e.target.closest('.ex-copy, button')) e.preventDefault();
  });

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
