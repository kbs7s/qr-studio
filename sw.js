/* QR Studio service worker: precache the app shell so it works offline.
 * Bump VERSION whenever any cached file changes. */
const VERSION = 'qr-studio-v5';
const ASSETS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './css/app.css',
  './js/i18n.js',
  './js/payloads.js',
  './js/app.js',
  './vendor/qrcode.min.js',
  './vendor/qr-code-styling.js',
  './vendor/zxing.min.js',
  './vendor/html5-qrcode.min.js',
  './vendor/bwip-js.min.js',
  './icons/icon.svg',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/maskable-512.png',
  './icons/apple-touch-icon.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(VERSION).then((c) => c.addAll(ASSETS.map((u) => new Request(u, { cache: 'reload' })))).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Network first for the page and the app's own code, so an update never mixes a new
// page with old styles or scripts. "no-cache" revalidates with the server instead of
// trusting the browser's HTTP cache. The cache is only the offline fallback.
// Third-party libraries and icons rarely change, so they are served cache first.
function networkFirst(req, cacheKey) {
  return fetch(req, { cache: 'no-cache' })
    .then((res) => {
      if (res.ok) { const copy = res.clone(); caches.open(VERSION).then((c) => c.put(cacheKey || req, copy)); }
      return res;
    })
    .catch(() => caches.match(cacheKey || req, { ignoreSearch: true }));
}

function cacheFirst(req) {
  return caches.match(req, { ignoreSearch: true }).then((hit) => hit || fetch(req).then((res) => {
    if (res.ok) { const copy = res.clone(); caches.open(VERSION).then((c) => c.put(req, copy)); }
    return res;
  }));
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== self.location.origin) return;

  if (req.mode === 'navigate') {
    event.respondWith(networkFirst(req, './index.html'));
  } else if (/\/(vendor|icons)\//.test(url.pathname)) {
    event.respondWith(cacheFirst(req));
  } else {
    event.respondWith(networkFirst(req));
  }
});
