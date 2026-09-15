/*
 * Torre de Vega — imágenes adaptativas a la cobertura.
 *
 * Cada fotografía existe en varios anchos (assets/img/nombre.hash-ANCHO.webp) y con una
 * miniatura difuminada incrustada en el HTML, así que siempre hay algo que ver:
 *   1. Al abrir la página se muestra la miniatura, sin ninguna descarga.
 *   2. Se estima la velocidad de la conexión (Network Information API cuando existe, cómo
 *      llegó el propio HTML y, siempre, midiendo las descargas reales) y se pide el ancho
 *      que necesita el hueco de cada foto y que esa velocidad permite. Con mala señal llega
 *      antes una versión ligera; con buena señal, directamente la nítida.
 *   3. Si la señal mejora (evento de red, vuelta a estar en línea o una prueba periódica),
 *      las fotos visibles se cambian por versiones más nítidas. Nunca se baja la calidad
 *      de una foto ya mostrada. Si empeora, las fotos pendientes pasan a la versión ligera.
 *   4. Cada tamaño se descarga una sola vez por página (aunque la foto aparezca en varios
 *      sitios); los fallos se reintentan con espera creciente y /sw-imagenes.js guarda lo
 *      descargado para servirlo al instante o sin cobertura.
 *
 * Marcado (los valores de cada foto están en _herramientas/imagenes-generadas.json):
 *   <img class="tdv-img" src="data:…" data-tdv-src="/assets/img/fotos/foto.1a2b3c4d" data-tdv-w="360,720,1080">
 *   <div class="tdv-bg" style="--tdv-img:url(data:…)" data-tdv-src="…" data-tdv-w="…" data-tdv-ratio="1.19">
 * Los elementos añadidos más tarde (p. ej. por tdv-carta.js) se detectan solos.
 */
(() => {
  'use strict';

  const SELECTOR = '[data-tdv-src][data-tdv-w]';
  const CACHE_NAME = 'tdv-imagenes-v1'; // same name as CACHE in /sw-imagenes.js
  const SW_URL = '/sw-imagenes.js';
  const TIER_RE = /^(\/assets\/img\/.+\.[0-9a-f]{8})-(\d+)\.webp$/;
  // Estimated speed needed before allowing the second and third size of a photograph.
  const MEDIUM_KBPS = 700;
  const HIGH_KBPS = 2500;
  const MAX_KBPS = 50000;
  const PROBE_MIN_MS = 15000;
  const PROBE_MAX_MS = 120000;
  const RELEASE_DELAY_MS = 5000;

  const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
  const items = new Map();
  const storedBest = new Map(); // base -> widest size held by the service worker
  const blobs = new Map(); // `${base}-${width}` -> { objectUrl, width, refs } downloaded in this page

  /* ---- Connection estimate (kbps) -------------------------------------------------- */

  const throughput = (bytes, ms) => Math.min(MAX_KBPS, (bytes * 8) / ms);
  // Latency says little about capacity, but a very slow round trip rules out large photos.
  const fromRtt = rtt => (rtt < 250 ? MAX_KBPS : rtt < 600 ? 3000 : rtt < 1200 ? 900 : 350);

  function fromConnection() {
    if (!connection) return null;
    const estimates = [];
    if (connection.downlink > 0) estimates.push(connection.downlink * 1000);
    else {
      const typical = { 'slow-2g': 50, '2g': 150, '3g': 700, '4g': 5000 }[connection.effectiveType];
      if (typical) estimates.push(typical);
    }
    if (connection.rtt > 0) estimates.push(fromRtt(connection.rtt));
    return estimates.length ? Math.min(...estimates) : null;
  }

  // How this very page arrived: speed of the HTML body and time to first byte.
  function fromNavigation() {
    const nav = performance.getEntriesByType?.('navigation')?.[0];
    if (!nav || !(nav.responseEnd > 0)) return null;
    const estimates = [fromRtt(nav.responseStart - nav.requestStart)];
    const bodyMs = nav.responseEnd - nav.responseStart;
    if (nav.transferSize > 0 && nav.encodedBodySize > 6000 && bodyMs > 0) estimates.push(throughput(nav.encodedBodySize, bodyMs));
    return Math.min(...estimates);
  }

  const initial = [fromConnection(), fromNavigation()].filter(v => v > 0);
  let kbps = initial.length ? Math.min(...initial) : 1500;

  function tierLimit() {
    if (connection?.saveData) return 0;
    return kbps >= HIGH_KBPS ? 2 : kbps >= MEDIUM_KBPS ? 1 : 0;
  }

  function addSample(sample) {
    if (!(sample > 0)) return;
    const before = tierLimit();
    kbps = kbps * 0.55 + sample * 0.45;
    if (tierLimit() > before) refreshAll();
  }

  try {
    new PerformanceObserver(list => {
      for (const entry of list.getEntries()) {
        if (!TIER_RE.test(new URL(entry.name, location.href).pathname)) continue;
        const ms = entry.responseEnd - entry.responseStart;
        // transferSize 0 = browser cache. Requests through the service worker (workerStart)
        // are measured there, because a stored copy would look like an infinitely fast link.
        if (entry.transferSize > 0 && !(entry.workerStart > 0) && entry.encodedBodySize > 8000 && ms > 0) {
          addSample(throughput(entry.encodedBodySize, ms));
        }
      }
    }).observe({ type: 'resource', buffered: true });
  } catch {
    /* Without Resource Timing, the service worker samples and timeouts still adapt. */
  }

  /* ---- Service worker and stored copies --------------------------------------------- */

  const controlled = () => Boolean(navigator.serviceWorker?.controller);

  if ('serviceWorker' in navigator && window.isSecureContext) {
    navigator.serviceWorker.addEventListener('message', event => {
      if (event.data?.type === 'tdv-throughput') addSample(event.data.kbps);
    });
    addEventListener('load', () => navigator.serviceWorker.register(SW_URL).catch(() => {}), { once: true });
  }

  if (window.caches && window.isSecureContext && controlled()) {
    caches
      .open(CACHE_NAME)
      .then(cache => cache.keys())
      .then(requests => {
        for (const request of requests) {
          const match = new URL(request.url).pathname.match(TIER_RE);
          if (match) storedBest.set(match[1], Math.max(storedBest.get(match[1]) || 0, Number(match[2])));
        }
        if (storedBest.size) refreshAll();
      })
      .catch(() => {});
  }

  /* ---- Downloaded bytes shared by every element of the page -------------------------- */

  function widestInPage(base) {
    let widest = 0;
    for (const blob of blobs.values()) if (blob.base === base && blob.width > widest) widest = blob.width;
    return widest;
  }

  function release(key) {
    const blob = blobs.get(key);
    if (!blob || --blob.refs > 0) return;
    // Give a replacement time to paint before freeing the bytes.
    setTimeout(() => {
      if (blob.refs <= 0 && blobs.get(key) === blob) {
        blobs.delete(key);
        URL.revokeObjectURL(blob.objectUrl);
      }
    }, RELEASE_DELAY_MS);
  }

  function apply(el, state, key) {
    const blob = blobs.get(key);
    if (!blob || blob.width <= state.current) return;
    blob.refs++;
    if (el.tagName === 'IMG') el.src = blob.objectUrl;
    else el.style.setProperty('--tdv-img', `url("${blob.objectUrl}")`);
    const previous = state.blobKey;
    state.blobKey = key;
    state.current = blob.width;
    el.dataset.tdvShown = String(blob.width);
    if (previous) release(previous);
  }

  /* ---- Registry ------------------------------------------------------------------------ */

  const observer =
    'IntersectionObserver' in window
      ? new IntersectionObserver(
          entries => {
            for (const entry of entries) {
              const state = items.get(entry.target);
              if (!state) continue;
              state.near = entry.isIntersecting;
              if (state.near) ensure(entry.target);
            }
          },
          { rootMargin: '100% 0px' }
        )
      : null;

  function register(el) {
    if (items.has(el)) return;
    const widths = el.dataset.tdvW.split(',').map(Number).filter(w => w > 0).sort((a, b) => a - b);
    if (!widths.length) return;
    const shown = el.tagName === 'IMG' && (el.getAttribute('src') || '').match(/-(\d+)\.webp$/);
    const state = {
      widths,
      base: el.dataset.tdvSrc,
      current: shown ? Number(shown[1]) : 0,
      blobKey: '',
      loading: 0,
      failures: 0,
      retryAt: 0,
      retryTimer: 0,
      near: !observer
    };
    items.set(el, state);
    if (observer) observer.observe(el);
    else ensure(el);
  }

  function forget(el) {
    const state = items.get(el);
    if (state?.blobKey) release(state.blobKey);
    observer?.unobserve(el);
    items.delete(el);
  }

  /* ---- Choosing and loading ------------------------------------------------------------ */

  function neededWidth(el) {
    const w = el.offsetWidth;
    const h = el.offsetHeight;
    if (!w || !h) return 0;
    const ratio = parseFloat(el.dataset.tdvRatio) || 1;
    // Backgrounds and object-fit: cover fill the box; contained images fit inside it.
    const covers = el.tagName !== 'IMG' || getComputedStyle(el).objectFit === 'cover';
    const cssWidth = covers ? Math.max(w, h * ratio) : Math.min(w, h * ratio);
    return cssWidth * Math.min(window.devicePixelRatio || 1, 2);
  }

  function choose(state, need, limit) {
    const allowed = state.widths.slice(0, limit + 1);
    return allowed.find(w => w >= need * 0.9) || allowed[allowed.length - 1];
  }

  const isVisible = el => {
    const r = el.getBoundingClientRect();
    return r.bottom > 0 && r.top < innerHeight;
  };

  function ensure(el) {
    const state = items.get(el);
    if (!state || !state.near || state.loading || document.hidden) return;
    if (!el.isConnected) return forget(el);
    const wait = state.retryAt - Date.now();
    if (wait > 0) {
      clearTimeout(state.retryTimer);
      state.retryTimer = setTimeout(() => ensure(el), wait);
      return;
    }
    const need = neededWidth(el);
    if (!need) return;
    // A size already downloaded here costs nothing; one held by the service worker is instant.
    const inPage = widestInPage(state.base);
    const stored = Math.max(inPage, controlled() ? storedBest.get(state.base) || 0 : 0);
    if (!navigator.onLine && stored <= state.current) return;

    let target = Math.max(choose(state, need, tierLimit()), stored);
    if (target <= state.current) return;
    if (inPage >= target) return apply(el, state, `${state.base}-${inPage}`);
    // First real photo on a slow or uncertain link: the lightest size, refined afterwards.
    if (state.current === 0 && target !== stored && kbps < HIGH_KBPS) target = state.widths[0];
    load(el, state, target);
  }

  async function load(el, state, width, onSettled) {
    const url = `${state.base}-${width}.webp`;
    const firstPaint = state.current === 0;
    const controller = new AbortController();
    let downgrade = false;
    state.loading = width;

    const timer = setTimeout(
      () => {
        if (firstPaint) {
          // Only the blurred preview is on screen: switch to the lightest size right away.
          kbps = Math.min(kbps * 0.5, MEDIUM_KBPS - 1);
          if (width > state.widths[0]) {
            downgrade = true;
            controller.abort();
          }
        } else {
          // A sharper version is taking too long: keep the current one and back off.
          kbps *= 0.5;
          controller.abort();
        }
      },
      firstPaint ? 3000 + width * 5 : 6000 + width * 10
    );

    let ok = false;
    try {
      const response = await fetch(url, { signal: controller.signal, credentials: 'same-origin', priority: firstPaint && isVisible(el) ? 'high' : 'auto' });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const objectUrl = URL.createObjectURL(await response.blob());
      const decoded = new Image();
      decoded.src = objectUrl;
      try {
        await decoded.decode();
      } catch (error) {
        if (!decoded.complete || !decoded.naturalWidth) {
          URL.revokeObjectURL(objectUrl);
          throw error;
        }
      }
      // The service worker may answer with another stored size of the same photograph.
      const got = state.widths.filter(w => w <= decoded.naturalWidth + 2).pop() || width;
      const key = `${state.base}-${got}`;
      storedBest.set(state.base, Math.max(storedBest.get(state.base) || 0, got));
      if (blobs.has(key)) URL.revokeObjectURL(objectUrl); // another element fetched it meanwhile
      else {
        blobs.set(key, { objectUrl, width: got, base: state.base, refs: 1 });
        release(key); // held only by the elements that show it
      }
      apply(el, state, key);
      state.failures = 0;
      ok = true;
    } catch {
      if (!downgrade) {
        state.failures++;
        state.retryAt = Date.now() + Math.min(60000, 3000 * 2 ** (state.failures - 1));
      }
    } finally {
      clearTimeout(timer);
      state.loading = 0;
    }
    onSettled?.(ok);
    // Other elements with the same photograph can reuse these bytes now.
    requestAnimationFrame(ok ? refreshAll : () => ensure(el));
  }

  function refreshAll() {
    for (const el of items.keys()) ensure(el);
  }

  /* ---- Reacting to better coverage ------------------------------------------------------ */

  connection?.addEventListener?.('change', () => {
    kbps = fromConnection() ?? kbps;
    refreshAll();
  });
  addEventListener('online', () => {
    for (const state of items.values()) {
      state.failures = 0;
      state.retryAt = 0;
    }
    refreshAll();
  });
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) refreshAll();
  });
  // Layout (fonts, sticky sections) settles on load: sizes measured before may have been 0.
  addEventListener('load', refreshAll, { once: true });
  let resizeTimer = 0;
  addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(refreshAll, 250);
  });

  // Not every browser reports network changes: now and then, try the next size of one
  // visible photo that the current estimate is holding back. A fast download raises the
  // estimate (and upgrades the rest); a failed one spaces out the next attempt.
  let probeDelay = PROBE_MIN_MS;
  function probe() {
    let started = false;
    if (!document.hidden && navigator.onLine && !connection?.saveData && tierLimit() < 2) {
      for (const [el, state] of items) {
        if (!state.near || state.loading || state.current === 0 || Date.now() < state.retryAt || !isVisible(el)) continue;
        const need = neededWidth(el);
        const next = state.widths.find(w => w > state.current);
        if (!need || !next || choose(state, need, 2) <= state.current) continue;
        started = true;
        load(el, state, next, ok => {
          probeDelay = ok ? PROBE_MIN_MS : Math.min(PROBE_MAX_MS, probeDelay * 2);
          setTimeout(probe, probeDelay);
        });
        break;
      }
    }
    if (!started) setTimeout(probe, probeDelay);
  }
  setTimeout(probe, PROBE_MIN_MS);

  /* ---- Start ------------------------------------------------------------------------------ */

  const scan = node => {
    if (node.nodeType !== 1) return;
    if (node.matches(SELECTOR)) register(node);
    node.querySelectorAll(SELECTOR).forEach(register);
  };
  scan(document.body);
  new MutationObserver(records => records.forEach(record => record.addedNodes.forEach(scan))).observe(document.body, { childList: true, subtree: true });

  window.TDVImages = {
    refresh: refreshAll,
    get kbps() {
      return Math.round(kbps);
    }
  };
})();
