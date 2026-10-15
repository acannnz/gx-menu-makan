// Cache supaya aplikasi tetap terbuka walau sinyal jelek / offline.
// Naikkan VERSION kalau ingin memaksa semua HP mengambil ulang file aplikasi.
const VERSION = 'menugx-v2';
const SHELL = ['./', 'index.html', 'app.js', 'parser.js', 'menu.json', 'manifest.webmanifest',
  'icons/icon-192.png', 'icons/favicon.png'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

function put(req, res) {
  if (res && (res.ok || res.type === 'opaque')) {
    const copy = res.clone();
    caches.open(VERSION).then((c) => c.put(req, copy));
  }
  return res;
}

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // Halaman & menu.json: jaringan dulu (data terbaru), cache kalau offline
  if (req.mode === 'navigate' || (url.origin === location.origin && url.pathname.endsWith('/menu.json'))) {
    e.respondWith(
      fetch(req).then((res) => put(req, res))
        .catch(() => caches.match(req, { ignoreSearch: true }).then((hit) => hit || caches.match('index.html')))
    );
    return;
  }

  // Aset lain (JS, ikon, SheetJS): langsung dari cache, diperbarui diam-diam di belakang
  const network = fetch(req).then((res) => put(req, res));
  e.respondWith(caches.match(req).then((hit) => hit || network));
  e.waitUntil(network.catch(() => {}));
});
