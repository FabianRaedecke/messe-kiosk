/* =====================================================================
   Maschinen-Explorer
   ---------------------------------------------------------------------
   Intro:   51 Einzelbilder (Scroll-Scrubbing auf Canvas)
   Zoom:    je Bereich ein Video hinein + ein Video zurück
   Loops:   Übersicht + Details als normale Videos
   Größen:  960 / 1440 / 1920 px Frames, 960 / 1600 px Videos,
            AVIF mit WebP-Fallback, Auswahl nach Bühnengröße und DPR
   Laden:   erst wenn der Bereich in die Nähe des Viewports kommt,
            Zoom-Videos erst bei Hover, Fokus oder Leerlauf
   Kiosk:   eigenes Script (kiosk.js), nutzt window.explorer
   ===================================================================== */
(() => {
  'use strict';

  const root = document.querySelector('[data-explorer]');
  if (!root) return;

  /* ---------- Einstellungen (per data-Attribut am Wrapper überschreibbar) ---------- */
  const BASE          = root.dataset.assets || 'assets/';
  const INTRO_END     = parseInt(root.dataset.introFrames || '51', 10) - 1; // letzter Intro-Frame = Übersicht
  const FRAME_TIERS   = [960, 1440, 1920];
  const VIDEO_TIERS   = [960, 1600];
  const INTRO_SHARE   = parseFloat(root.dataset.introShare || '0.8');   // Anteil Scrollstrecke für die Fahrt
  const PORTRAIT_ZOOM = parseFloat(root.dataset.portraitZoom || '1.6'); // Hochformat: Bildbreite = Viewport × Faktor
  root.style.setProperty('--ex-scroll-length', root.dataset.scrollLength || '400vh');

  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const EDIT = new URLSearchParams(location.search).has('edit');
  const conn = navigator.connection || {};
  const saveData = !!conn.saveData || /(^|-)2g$/.test(conn.effectiveType || '');

  const $ = s => root.querySelector(s);
  const sticky = $('.ex-sticky'), stage = $('.ex-stage');
  const canvas = $('.ex-canvas'), ctx = canvas.getContext('2d');
  const bgCanvas = $('.ex-bg'), bgCtx = bgCanvas.getContext('2d');
  const posterImg = $('.ex-poster img, img.ex-poster');
  const loopV = $('.ex-loop'), zIn = $('.ex-zoom-in'), zOut = $('.ex-zoom-out');
  const hotWrap = $('.ex-hotspots'), hint = $('.ex-hint'), choose = $('.ex-choose'), progressBar = $('.ex-progress');
  const overlay = $('.ex-overlay'), dialog = $('.ex-dialog');
  const ovMedia = $('.ex-media'), ovKicker = $('.ex-kicker'), ovBody = $('.ex-body');
  const btnClose = $('.ex-close');

  /* ---------- Bereiche aus dem Markup lesen (CMS-freundlich) ---------- */
  const areas = [...root.querySelectorAll('.ex-area')].map((el, i) => ({
    el, i,
    id: el.dataset.area,
    name: el.dataset.name || el.querySelector('h2,h3')?.textContent || `Bereich ${i + 1}`,
    zoom: el.dataset.zoom,                 // z. B. "01" → zoom-01-in / zoom-01-out
    x: parseFloat(el.dataset.x), y: parseFloat(el.dataset.y),
    detail: el.dataset.detail,             // z. B. "01" → detail-01-*.mp4 / .avif / .jpg
    hasVideo: el.dataset.video !== 'false',
  }));

  /* ---------- Hilfen ---------- */
  const wait = ms => new Promise(r => setTimeout(r, ms));
  const withTimeout = (p, ms) => Promise.race([p, wait(ms)]);
  const once = (el, ev) => new Promise(r => el.addEventListener(ev, r, { once: true }));

  // data-avif="false": nur WebP/JPG laden (z. B. wenn ein Encoder AVIFs erzeugt, die Safari nicht dekodiert)
  const useAvif = root.dataset.avif !== 'false';
  const avifSupport = !useAvif ? Promise.resolve(false) : new Promise(res => {
    const i = new Image();
    i.onload = () => res(i.width > 0); i.onerror = () => res(false);
    i.src = 'data:image/avif;base64,AAAAIGZ0eXBhdmlmAAAAAGF2aWZtaWYxbWlhZk1BMUIAAADybWV0YQAAAAAAAAAoaGRscgAAAAAAAAAAcGljdAAAAAAAAAAAAAAAAGxpYmF2aWYAAAAADnBpdG0AAAAAAAEAAAAeaWxvYwAAAABEAAABAAEAAAABAAABGgAAAB0AAAAoaWluZgAAAAAAAQAAABppbmZlAgAAAAABAABhdjAxQ29sb3IAAAAAamlwcnAAAABLaXBjbwAAABRpc3BlAAAAAAAAAAIAAAACAAAAEHBpeGkAAAAAAwgICAAAAAxhdjFDgQ0MAAAAABNjb2xybmNseAACAAIAAYAAAAAXaXBtYQAAAAAAAAABAAEEAQKDBAAAACVtZGF0EgAKCBgANogQEAwgMg8f8D///8WfhwB8+ErK42A=';
  });

  /* ---------- Layout ---------- */
  let isPortrait = false, stageW = 0;
  function layout() {
    const W = sticky.clientWidth, H = sticky.clientHeight, ar = 16 / 9;
    isPortrait = W / H < 1.1;
    sticky.classList.toggle('ex-portrait', isPortrait);
    let w, h;
    if (!isPortrait) { if (W / H > ar) { w = W; h = W / ar; } else { h = H; w = H * ar; } } // cover
    else { w = Math.min(W * PORTRAIT_ZOOM, H * ar); h = w / ar; }
    stageW = w;
    stage.style.width = w + 'px'; stage.style.height = h + 'px';
    stage.style.transform = `translate(${(W - w) / 2}px,${(H - h) / 2}px)`;
    if (drawn >= 0) draw(drawn, true);
  }

  /* ---------- Qualitätsstufe wählen (einmalig) ---------- */
  let frameW, videoW, ext;
  function pickTiers() {
    const dpr = Math.min(window.devicePixelRatio || 1, isPortrait ? 1.5 : 2);
    const need = saveData ? 0 : stageW * dpr;
    frameW = FRAME_TIERS.find(t => need <= t * 1.05) || FRAME_TIERS[FRAME_TIERS.length - 1];
    videoW = need <= 1100 ? VIDEO_TIERS[0] : VIDEO_TIERS[1];
    // feste Stufe per data-Attribut (z. B. Kiosk mit nur einer Größe)
    if (root.dataset.frameWidth) frameW = parseInt(root.dataset.frameWidth, 10);
    if (root.dataset.videoWidth) videoW = parseInt(root.dataset.videoWidth, 10);
    canvas.width = frameW; canvas.height = Math.round(frameW * 9 / 16);
  }
  const frameUrl = i => `${BASE}intro/${frameW}/f${String(i).padStart(3, '0')}.${ext}`;
  // H.264 (mp4) überall wo möglich, sonst VP9 (webm) als Fallback
  const probe = document.createElement('video');
  const vext = probe.canPlayType('video/mp4; codecs="avc1.640028"') ? 'mp4' : 'webm';
  const zoomUrl  = (a, dir) => `${BASE}video/zoom-${a.zoom}-${dir}-${videoW}.${vext}`;
  const loopUrl  = () => `${BASE}video/overview-loop-${videoW}.${vext}`;
  const detailUrl = a => `${BASE}video/detail-${a.detail}-${videoW}.${vext}`;
  const detailPoster = a => `${BASE}video/detail-${a.detail}-${videoW}`;

  /* ---------- Intro-Frames: grob nach fein laden ---------- */
  const frames = new Array(INTRO_END + 1);
  let framesP = null;
  function loadFrame(i) {
    return new Promise(res => {
      const img = new Image();
      img.decoding = 'async';
      img.onload = () => { frames[i] = img; if (Math.round(current) === i || drawn < 0) draw(current, true); res(); };
      img.onerror = () => res();
      img.src = frameUrl(i);
    });
  }
  function progressiveOrder(n) {
    const seen = new Set(), out = [];
    const add = i => { if (!seen.has(i)) { seen.add(i); out.push(i); } };
    add(0); add(n - 1);
    for (let step = 16; step >= 1; step >>= 1) for (let i = 0; i < n; i += step) add(i);
    return out;
  }
  function loadIntroFrames() {
    if (!framesP) {
      const queue = progressiveOrder(INTRO_END + 1);
      const worker = async () => { while (queue.length) await loadFrame(queue.shift()); };
      framesP = Promise.all(Array.from({ length: 6 }, worker));
    }
    return framesP;
  }

  /* ---------- Zeichnen ---------- */
  let drawn = -1;
  function nearest(i) {
    for (let d = 0; d <= INTRO_END; d++) {
      if (frames[i - d]) return [frames[i - d], i - d];
      if (frames[i + d]) return [frames[i + d], i + d];
    }
    return [null, -1];
  }
  function draw(f, force) {
    const i = Math.max(0, Math.min(INTRO_END, Math.round(f)));
    if (i === drawn && !force) return;
    const [img, at] = nearest(i);
    if (!img) return;
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    if (isPortrait) bgCtx.drawImage(img, 0, 0, bgCanvas.width, bgCanvas.height);
    drawn = at === i ? i : -1;
  }

  /* ---------- Videos vorladen (als Blob, damit der Start ohne Nachladen klappt) ---------- */
  const blobs = new Map();
  function fetchVideo(url) {
    if (!blobs.has(url)) {
      blobs.set(url, fetch(url)
        .then(r => { if (!r.ok) throw new Error(r.status); return r.blob(); })
        .then(b => URL.createObjectURL(new Blob([b], { type: `video/${vext}` })))
        .catch(() => url)); // Fallback: direkte URL (z. B. bei file://)
    }
    return blobs.get(url);
  }
  function prepare(v, src) {
    if (v.dataset.src === src && v.readyState >= 2) return Promise.resolve();
    v.dataset.src = src;
    v.src = src; v.load();
    return withTimeout(once(v, 'loadeddata'), 2500);
  }
  function framePainted(v) {
    if ('requestVideoFrameCallback' in v) return withTimeout(new Promise(r => v.requestVideoFrameCallback(() => r())), 300);
    return withTimeout(once(v, 'timeupdate'), 300);
  }
  const playEnd = v => withTimeout(once(v, 'ended'), ((v.duration || 1) * 1000) + 1500);
  const show = (v, on) => v.classList.toggle('on', on);

  function preloadArea(a) {
    fetchVideo(zoomUrl(a, 'in'));
  }

  /* ---------- Hotspots ---------- */
  areas.forEach(a => {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'ex-hotspot';
    b.style.left = a.x + '%'; b.style.top = a.y + '%';
    b.style.transitionDelay = (a.i * 70) + 'ms';
    b.setAttribute('aria-label', `${a.name}: view details`);
    b.innerHTML = `<span class="ring"></span><span class="dot"></span><span class="label"></span>`;
    b.querySelector('.label').textContent = a.name;
    b.addEventListener('click', () => { if (!(EDIT && dragMoved)) openArea(a.i); });
    ['pointerenter', 'focus', 'touchstart'].forEach(ev => b.addEventListener(ev, () => preloadArea(a), { passive: true }));
    a.btn = b; hotWrap.appendChild(b);
  });
  function showHotspots(on) {
    hotWrap.classList.toggle('on', on);
    choose && choose.classList.toggle('on', on);
    areas.forEach(a => a.btn.tabIndex = on ? 0 : -1);
  }

  /* ---------- Zustand ---------- */
  // intro | overview | zoomIn | detail | zoomOut
  let state = 'intro', target = 0, current = 0, active = -1, lastFocus = null;
  let visible = false, running = false, idlePreloadDone = false;

  function scrollProgress() {
    const r = root.getBoundingClientRect();
    const len = root.offsetHeight - innerHeight;
    return len > 0 ? Math.min(1, Math.max(0, -r.top / len)) : 0;
  }

  function enterOverview() {
    state = 'overview';
    fetchVideo(loopUrl()).then(src => prepare(loopV, src)).then(() => {
      if (state !== 'overview') return;
      loopV.currentTime = 0; loopV.play().catch(() => {}); show(loopV, true);
    });
    showHotspots(true);
    if (!idlePreloadDone && !saveData) { // im Leerlauf alle Zoom-Videos vorladen
      idlePreloadDone = true;
      const idle = window.requestIdleCallback || (cb => setTimeout(cb, 1500));
      idle(() => areas.forEach(preloadArea), { timeout: 3000 });
    }
  }
  function leaveOverview() {
    state = 'intro';
    show(loopV, false);
    setTimeout(() => { if (state === 'intro') loopV.pause(); }, 350);
    showHotspots(false);
  }

  function tick() {
    if (state === 'intro' || state === 'overview') {
      const p = scrollProgress();
      progressBar && (progressBar.style.width = (p * 100) + '%');
      hint && (hint.style.opacity = p > 0.02 ? 0 : 1);
      target = Math.min(1, p / INTRO_SHARE) * INTRO_END;
      current += (target - current) * (reduceMotion ? 1 : 0.18);
      if (Math.abs(target - current) < 0.02) current = target;
      draw(current);
      const atEnd = current >= INTRO_END - 0.5;
      if (atEnd && state === 'intro') enterOverview();
      else if (!atEnd && state === 'overview') leaveOverview();
    }
    // Hochformat: unscharfen Hintergrund während der Zoom-Fahrt mitziehen
    if (isPortrait && (state === 'zoomIn' || state === 'zoomOut')) {
      const v = zOut.classList.contains('on') ? zOut : zIn.classList.contains('on') ? zIn : null;
      if (v && v.readyState >= 2) bgCtx.drawImage(v, 0, 0, bgCanvas.width, bgCanvas.height);
    }
    // Schleife nur laufen lassen, solange sie gebraucht wird
    if (visible || state === 'zoomIn' || state === 'zoomOut' || state === 'detail') requestAnimationFrame(tick);
    else running = false;
  }
  function startLoop() { if (!running) { running = true; requestAnimationFrame(tick); } }

  /* ---------- Scroll sperren ---------- */
  function lockScroll(on) { document.documentElement.classList.toggle('ex-locked', on); }
  window.addEventListener('touchmove', e => {
    if (document.documentElement.classList.contains('ex-locked') && !e.target.closest('.ex-copy')) e.preventDefault();
  }, { passive: false });

  /* ---------- Overlay ---------- */
  async function fillOverlay(a) {
    ovKicker.textContent = `${root.dataset.kicker || 'Bereich'} ${String(a.i + 1).padStart(2, '0')} · ${a.name}`;
    ovBody.innerHTML = a.el.innerHTML;
    const heading = ovBody.querySelector('h2,h3'); if (heading) heading.id = 'ex-ov-title';
    ovMedia.innerHTML = '';
    const pic = document.createElement('picture');
    pic.innerHTML = (useAvif ? `<source type="image/avif" srcset="${detailPoster(a)}.avif">` : '') + `<img src="${detailPoster(a)}.jpg" alt="">`;
    ovMedia.appendChild(pic);
    if (a.hasVideo) {
      const v = document.createElement('video');
      v.muted = true; v.loop = true; v.playsInline = true; v.autoplay = true;
      v.setAttribute('muted', ''); v.setAttribute('playsinline', ''); v.setAttribute('aria-hidden', 'true');
      v.style.opacity = 0; v.style.transition = 'opacity .3s';
      ovMedia.appendChild(v);
      const src = await fetchVideo(detailUrl(a));
      if (!ovMedia.contains(v)) return;
      v.src = src;
      v.play().catch(() => {});
      once(v, 'playing').then(() => v.style.opacity = 1);
    }
  }
  function openOverlay() {
    overlay.classList.add('open'); overlay.setAttribute('aria-hidden', 'false');
    btnClose.focus({ preventScroll: true });
  }
  function closeOverlay() {
    overlay.classList.remove('open'); overlay.setAttribute('aria-hidden', 'true');
  }

  async function openArea(i) {
    if (state !== 'overview' || EDIT) return;
    const a = areas[i];
    state = 'zoomIn'; active = i; lastFocus = document.activeElement;
    lockScroll(true);
    a.btn.classList.add('busy');
    fetchVideo(zoomUrl(a, 'out'));             // Rückfahrt schon mal laden
    if (a.hasVideo) fetchVideo(detailUrl(a));  // Detail-Loop ebenso

    if (!reduceMotion) {
      const inSrc = await fetchVideo(zoomUrl(a, 'in'));
      showHotspots(false);
      show(loopV, false);                       // Loop ausblenden, darunter liegt Frame 50
      await Promise.all([wait(300), prepare(zIn, inSrc)]);
      loopV.pause();
      zIn.currentTime = 0;
      await zIn.play().catch(() => {});
      await framePainted(zIn);
      show(zIn, true);
      await playEnd(zIn);
    } else {
      showHotspots(false);
    }
    a.btn.classList.remove('busy');
    fillOverlay(a);
    openOverlay();
    state = 'detail';
    // Rückfahrt bereitlegen: erster Frame = Zoom-Ziel
    if (!reduceMotion) fetchVideo(zoomUrl(a, 'out')).then(src => prepare(zOut, src)).then(() => { zOut.currentTime = 0; });
  }

  async function closeArea() {
    if (state !== 'detail') return;
    const a = areas[active];
    state = 'zoomOut';
    closeOverlay();
    await wait(reduceMotion ? 0 : 350);
    ovMedia.innerHTML = '';
    if (!reduceMotion) {
      const outSrc = await fetchVideo(zoomUrl(a, 'out'));
      await prepare(zOut, outSrc);
      zOut.currentTime = 0;
      show(zOut, true); show(zIn, false); zIn.pause();
      await zOut.play().catch(() => {});
      await playEnd(zOut);
    }
    // zurück in die Übersicht: Loop über das Ende der Rückfahrt legen
    draw(INTRO_END, true); current = target = INTRO_END;
    loopV.currentTime = 0;
    await loopV.play().catch(() => {});
    await framePainted(loopV);
    loopV.style.transition = 'none'; show(loopV, true); void loopV.offsetWidth; loopV.style.transition = '';
    show(zOut, false); show(zIn, false);
    showHotspots(true);
    lockScroll(false);
    state = 'overview';
    if (lastFocus && lastFocus.focus) lastFocus.focus({ preventScroll: true });
  }

  btnClose.addEventListener('click', closeArea);
  overlay.addEventListener('click', e => { if (e.target === overlay) closeArea(); });
  window.addEventListener('keydown', e => {
    if (state !== 'detail') return;
    if (e.key === 'Escape') closeArea();
    if (e.key === 'Tab') {
      const f = [...overlay.querySelectorAll('button')], first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  });

  /* ---------- Edit-Modus: Hotspots verschieben (?edit) ---------- */
  let dragMoved = false;
  if (EDIT) {
    root.classList.add('ex-edit');
    const panel = document.createElement('div'); panel.className = 'ex-edit-panel'; document.body.appendChild(panel);
    const render = () => {
      panel.textContent = 'Hotspots ziehen. Werte als data-x / data-y eintragen:\n\n' +
        areas.map(a => `${a.name.padEnd(10)} data-x="${a.x}" data-y="${a.y}"`).join('\n');
    };
    render();
    areas.forEach(a => a.btn.addEventListener('pointerdown', e => {
      e.preventDefault(); dragMoved = false; a.btn.setPointerCapture(e.pointerId);
      const move = ev => {
        const r = stage.getBoundingClientRect();
        a.x = +(((ev.clientX - r.left) / r.width) * 100).toFixed(1);
        a.y = +(((ev.clientY - r.top) / r.height) * 100).toFixed(1);
        a.btn.style.left = a.x + '%'; a.btn.style.top = a.y + '%'; dragMoved = true; render();
      };
      const up = () => { a.btn.removeEventListener('pointermove', move); a.btn.removeEventListener('pointerup', up); };
      a.btn.addEventListener('pointermove', move); a.btn.addEventListener('pointerup', up);
    }));
  }

  /* ---------- Zurück zum Anfang (z. B. für den Kiosk) ---------- */
  function reset() {
    closeOverlay(); ovMedia.innerHTML = '';
    [zIn, zOut, loopV].forEach(v => { v.pause(); show(v, false); });
    showHotspots(false);
    lockScroll(false);
    state = 'intro'; active = -1;
    current = target = 0; draw(0, true);
    window.scrollTo(0, 0);
  }

  /* ---------- Start ---------- */
  const ready = (async function init() {
    layout();
    pickTiers();
    ext = (await avifSupport) ? 'avif' : (root.dataset.frameFallback || 'webp');
    window.addEventListener('resize', layout);

    if (posterImg) {
      const paintBg = () => isPortrait && drawn < 0 && bgCtx.drawImage(posterImg, 0, 0, bgCanvas.width, bgCanvas.height);
      posterImg.complete ? paintBg() : posterImg.addEventListener('load', paintBg, { once: true });
    }

    // 1) Laden erst, wenn der Bereich in die Nähe kommt
    new IntersectionObserver(([e]) => {
      if (e.isIntersecting) { loadIntroFrames(); fetchVideo(loopUrl()); }
    }, { rootMargin: '150% 0px 150% 0px' }).observe(root);

    // 2) Animationsschleife nur, solange sichtbar
    new IntersectionObserver(([e]) => {
      visible = e.isIntersecting;
      if (visible) { startLoop(); if (state === 'overview') loopV.play().catch(() => {}); }
      else if (state === 'overview') loopV.pause();
    }).observe(root);

    // Debug-Info für die Konsole
    root.dataset.tier = `frames ${frameW}px ${ext} · videos ${videoW}px ${vext}`;
  })();

  // Schnittstelle für Erweiterungen (kiosk.js) und die Konsole
  window.explorer = {
    root, areas, ready, reset, fetchVideo, loadIntroFrames,
    frameCount: INTRO_END + 1,
    get framesLoaded() { return frames.filter(Boolean).length; },
    get state() { return state; },
    url: { zoom: zoomUrl, loop: loopUrl, detail: detailUrl, poster: a => `${detailPoster(a)}.${ext === 'avif' ? 'avif' : 'jpg'}` },
  };
})();
