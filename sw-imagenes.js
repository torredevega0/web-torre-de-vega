/*
 * Torre de Vega — service worker de imágenes.
 *
 * Solo intercepta las fotografías versionadas de /assets/img/ (nombre.hash-ANCHO.webp):
 *   - si ya están guardadas, las sirve al instante (el nombre lleva hash: nunca caducan);
 *   - si no, las descarga, las guarda y avisa a la página de la velocidad medida;
 *   - sin cobertura, sirve la versión más nítida guardada de esa misma fotografía.
 * HTML, CSS, JS, analítica y el resto de peticiones no pasan por aquí.
 *
 * Desactivarlo: ver "Imágenes adaptativas" en README-DISENO.md.
 */
const CACHE = 'tdv-imagenes-v1'; // same name as CACHE_NAME in assets/js/tdv-images.js
const MAX_ENTRIES = 300;
const TIER = /^(\/assets\/img\/.+\.[0-9a-f]{8})-(\d+)\.webp$/;

self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', event => {
  event.waitUntil(
    (async () => {
      const names = await caches.keys();
      await Promise.all(names.filter(name => name.startsWith('tdv-imagenes-') && name !== CACHE).map(name => caches.delete(name)));
      await self.clients.claim();
    })()
  );
});

self.addEventListener('fetch', event => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  const match = url.pathname.match(TIER);
  if (!match) return;
  event.respondWith(serve(event, url.pathname, match[1]));
});

async function serve(event, path, base) {
  const cache = await caches.open(CACHE);
  const stored = await cache.match(path);
  if (stored) return stored;
  // A sharper stored copy of the same photograph beats downloading a lighter one.
  const sharper = await sharpestStored(cache, base, Number(path.match(TIER)[2]));
  if (sharper) return sharper;

  try {
    const started = Date.now();
    const response = await fetch(event.request);
    if (!response.ok || response.type !== 'basic') return response;
    const body = await response.arrayBuffer();
    report(event.clientId, body.byteLength, Date.now() - started);
    const fresh = new Response(body, { status: response.status, statusText: response.statusText, headers: response.headers });
    event.waitUntil(store(cache, path, base, fresh.clone()));
    return fresh;
  } catch (error) {
    // No signal: any stored size of this photograph is better than nothing.
    const fallback = await sharpestStored(cache, base);
    return fallback || Response.error();
  }
}

async function report(clientId, bytes, ms) {
  if (!clientId || bytes < 20000 || ms <= 0) return;
  const client = await self.clients.get(clientId);
  client?.postMessage({ type: 'tdv-throughput', kbps: Math.min(50000, (bytes * 8) / ms) });
}

async function store(cache, path, base, response) {
  await cache.put(path, response);
  const width = Number(path.match(TIER)[2]);
  const keys = await cache.keys();
  // A sharper copy supersedes the smaller ones of the same photograph.
  for (const request of keys) {
    const match = new URL(request.url).pathname.match(TIER);
    if (match && match[1] === base && Number(match[2]) < width) await cache.delete(request);
  }
  const remaining = await cache.keys();
  for (let i = 0; i < remaining.length - MAX_ENTRIES; i++) await cache.delete(remaining[i]);
}

async function sharpestStored(cache, base, minWidth = 1) {
  let best = null;
  let bestWidth = minWidth - 1;
  for (const request of await cache.keys()) {
    const match = new URL(request.url).pathname.match(TIER);
    if (match && match[1] === base && Number(match[2]) > bestWidth) {
      best = request;
      bestWidth = Number(match[2]);
    }
  }
  return best ? cache.match(best) : null;
}
