// Service worker: la app funciona sin conexión.
// - App (HTML/CSS/JS/iconos): primero caché, y se refresca en segundo plano.
// - Banco (data/*.json): primero red, y si no hay conexión, la copia guardada.
const CACHE = 'test-cap-v1';
const APP = [
  './', 'index.html', 'styles.css', 'app.js', 'manifest.webmanifest',
  'icons/icon-192.png', 'icons/icon-512.png', 'icons/apple-touch-icon.png',
  'data/banco-cap.json', 'data/version.json',
];
// Opcional: si no se puede descargar, la app funciona igual (solo falla "Importar ZIP").
const OPCIONAL = ['https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE)
    .then(c => c.addAll(APP).then(() => Promise.allSettled(OPCIONAL.map(u => c.add(u)))))
    .then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  if (url.pathname.includes('/data/')) {
    e.respondWith(fetch(req).then(res => {
      if (res.ok) {
        const copia = res.clone();
        caches.open(CACHE).then(c => c.put(url.pathname.endsWith('version.json') ? 'data/version.json' : 'data/banco-cap.json', copia));
      }
      return res;
    }).catch(() => caches.match(url.pathname.endsWith('version.json') ? 'data/version.json' : 'data/banco-cap.json')));
    return;
  }

  e.respondWith(caches.match(req).then(cached => {
    const red = fetch(req).then(res => {
      if (res.ok && (url.origin === location.origin || url.hostname === 'cdnjs.cloudflare.com')) {
        const copia = res.clone();
        caches.open(CACHE).then(c => c.put(req, copia));
      }
      return res;
    }).catch(() => cached);
    return cached || red;
  }));
});
