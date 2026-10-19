/* Service Worker — 離線快取
 * 一律「有網路抓最新、離線才用快取」，更新網站不需要改 VERSION（固定 v1.0.0） */
const VERSION = 'wte-v1.0.0';
const SHELL = [
  './',
  './index.html',
  './css/style.css',
  './js/data.js',
  './js/app.js',
  './manifest.webmanifest',
  './icons/favicon.ico',
  './icons/icon-32.png',
  './icons/icon-180.png',
  './icons/icon-192.png',
  './icons/icon-512.png',
];
const FONT_CACHE = 'wte-fonts';

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION && k !== FONT_CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // Google Fonts: cache-first
  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    e.respondWith(
      caches.open(FONT_CACHE).then(async (c) => {
        const hit = await c.match(req);
        if (hit) return hit;
        const res = await fetch(req);
        if (res.ok || res.type === 'opaque') c.put(req, res.clone());
        return res;
      }).catch(() => caches.match(req))
    );
    return;
  }

  if (url.origin !== self.location.origin) return;

  // Navigations: network-first, fall back to cached shell
  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req)
        .then((res) => { const copy = res.clone(); caches.open(VERSION).then((c) => c.put('./index.html', copy)); return res; })
        .catch(() => caches.match('./index.html').then((r) => r || caches.match('./')))
    );
    return;
  }

  // Static assets: network-first，離線才用快取（確保 HTML 與 JS／CSS 永遠是同一版）
  e.respondWith(
    caches.open(VERSION).then((c) =>
      fetch(req)
        .then((res) => { if (res.ok) c.put(url.origin + url.pathname, res.clone()); return res; }) // 存成不含 ?v= 的網址，避免每版累積一份
        .catch(() => c.match(req, { ignoreSearch: true }))
    )
  );
});
