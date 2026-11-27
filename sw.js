// Service worker: la app funciona sin conexión.
// - App (HTML/CSS/JS): primero red, para que todos vean la versión nueva en cuanto se publica;
//   sin conexión, la copia guardada. Iconos, librerías y fuentes: primero caché.
// - Banco de preguntas: no pasa por aquí; la app lo guarda en IndexedDB (viene de Supabase, spec 006).
// - Cuentas (Supabase) y demás servidores: siempre a la red, nunca en caché.
const CACHE = 'test-cap-v11';
const APP = [
  './', 'index.html', 'privacidad.html', 'condiciones.html', 'styles.css', 'app.js', 'manifest.webmanifest',
  'vendor/supabase.js', 'vendor/jszip.min.js',
  'icons/icon-192.png', 'icons/icon-512.png', 'icons/apple-touch-icon.png',
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

  const esApp = propio && (req.mode === 'navigate' || /\.(html|js|css|webmanifest)$/.test(url.pathname) || url.pathname.endsWith('/'))
    && !url.pathname.includes('/vendor/');
  if (esApp) {
    e.respondWith(fetch(req, { cache: 'no-cache' }).then(res => {
      if (res.ok) { const copia = res.clone(); caches.open(CACHE).then(c => c.put(req, copia)); }
      return res;
    }).catch(() => caches.match(req).then(r => r || caches.match('index.html'))));
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
