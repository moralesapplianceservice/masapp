// Guarda la app en el dispositivo para que abra sin internet y se actualice sola.
const CACHE = 'mas-2026.11.25-9b21ea';
const ASSETS = [
 "./",
 "./index.html",
 "./manifest.webmanifest",
 "./firebase-config.js",
 "./fonts/atkinson-hyperlegible-latin-400-normal.woff2",
 "./fonts/atkinson-hyperlegible-latin-700-normal.woff2",
 "./fonts/ibm-plex-mono-latin-500-normal.woff2",
 "./fonts/sofia-sans-condensed-latin-600-normal.woff2",
 "./fonts/sofia-sans-condensed-latin-800-normal.woff2",
 "./icons/icon-180.png",
 "./icons/icon-192.png",
 "./icons/icon-512.png",
 "./img/logo-claro.jpg",
 "./img/logo-oscuro.jpg",
 "./lib/firebase-app-compat.js",
 "./lib/firebase-auth-compat.js",
 "./lib/firebase-firestore-compat.js",
 "./lib/jspdf.umd.min.js",
 "./lib/xlsx.full.min.js"
];

self.addEventListener('install', e => {
  // Baja todo directo de internet (sin copias viejas) y entra en uso enseguida.
  e.waitUntil(caches.open(CACHE)
    .then(c => c.addAll(ASSETS.map(u => new Request(u, { cache: 'reload' }))))
    .then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(ks => Promise.all(ks.filter(k => k !== CACHE && k.startsWith('mas-')).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});
const wait = ms => new Promise(r => setTimeout(r, ms));

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;   // Firebase y Google van directo a internet
  const scope = new URL(self.registration.scope).pathname;
  const isPage = req.mode === 'navigate' || url.pathname === scope || url.pathname === scope + 'index.html';
  const isConfig = url.pathname === scope + 'firebase-config.js';
  if (isPage || isConfig) {
    // La página y la configuración: primero internet (hasta 3 segundos) para abrir siempre lo más nuevo;
    // sin señal, la copia guardada.
    const key = isPage ? './index.html' : './firebase-config.js';
    let saved = Promise.resolve();
    const net = fetch(url.href, { cache: 'no-store', credentials: 'same-origin' }).then(r => {
      if (r.ok) { const copy = r.clone(); saved = caches.open(CACHE).then(c => c.put(key, copy)); }
      return r;
    });
    e.waitUntil(net.then(() => saved, () => {}));
    e.respondWith(Promise.race([net.catch(() => null), wait(3000).then(() => null)]).then(r =>
      (r && r.ok) ? r : caches.match(key, { ignoreSearch: true }).then(hit => hit || net)));
    return;
  }
  // Lo demás (librerías, letras, íconos): la copia guardada primero y se renueva en segundo plano.
  e.respondWith(caches.open(CACHE).then(async c => {
    const hit = await c.match(req, { ignoreSearch: true });
    const net = fetch(req).then(r => { if (r.ok) c.put(req, r.clone()); return r; });
    if (hit) { e.waitUntil(net.catch(() => {})); return hit; }
    return net;
  }));
});
