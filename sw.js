// Service worker: la app funciona sin conexión.
// - App (HTML/CSS/JS/iconos/librerías): primero caché y se refresca en segundo plano.
// - Banco (data/*.json): primero red; sin conexión, la copia guardada.
// - Cuentas (Supabase) y demás servidores: siempre a la red, nunca en caché.
const CACHE = 'test-cap-v2';
const APP = [
  './', 'index.html', 'styles.css', 'app.js', 'manifest.webmanifest',
  'vendor/supabase.js', 'vendor/jszip.min.js',
  'icons/icon-192.png', 'icons/icon-512.png', 'icons/apple-touch-icon.png',
  'data/banco-cap.json', 'data/version.json',
];
const FUENTES = ['fonts.googleapis.com', 'fonts.gstatic.com'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(APP)).then(() => self.skipWaiting()));
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
  const propio = url.origin === location.origin;
  if (!propio && !FUENTES.includes(url.hostname)) return; // Supabase, GitHub...: directo a la red

  if (propio && url.pathname.includes('/data/')) {
    const clave = url.pathname.endsWith('version.json') ? 'data/version.json' : 'data/banco-cap.json';
    e.respondWith(fetch(req).then(res => {
      if (res.ok) { const copia = res.clone(); caches.open(CACHE).then(c => c.put(clave, copia)); }
      return res;
    }).catch(() => caches.match(clave)));
    return;
  }

  e.respondWith(caches.match(req).then(cached => {
    const red = fetch(req).then(res => {
      if (res.ok || res.type === 'opaque') { const copia = res.clone(); caches.open(CACHE).then(c => c.put(req, copia)); }
      return res;
    }).catch(() => cached);
    return cached || red;
  }));
});
