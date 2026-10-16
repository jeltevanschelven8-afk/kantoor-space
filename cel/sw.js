/* Cel (gemaakt door JJ van Schelven) — service worker: bewaart de app lokaal zodat hij ook start als de server uit staat of er geen internet is. */
const VERSION = 'cel-v9';
const APP = [
  './', 'index.html', 'manifest.webmanifest', 'css/app.css', 'css/sheet.css',
  'js/core.js', 'js/numfmt.js', 'js/formula.js', 'js/functions.js', 'js/functions2.js', 'js/extra.js', 'js/delen.js', 'js/start-screen.js', 'js/opslag.js', 'js/lang/en.js', 'js/lang/en-cel.js', 'js/lang/en-cel-2.js', 'js/lang/en-cel-fn.js', 'js/lang/en-cel-tpl.js', 'js/i18n.js', 'vendor/jszip.min.js', 'fonts/fonts.css', 'fonts/material-symbols-outlined.woff2', 'fonts/carlito-regular.woff2', 'fonts/carlito-bold.woff2', 'fonts/carlito-italic.woff2', 'fonts/carlito-bolditalic.woff2', 'js/ui.js', 'js/grid.js', 'js/edit.js',
  'js/format.js', 'js/data.js', 'js/objects.js', 'js/print.js', 'js/xlsx.js', 'js/file.js', 'js/main.js',
  'icons/icon-192.png', 'icons/icon-512.png', 'icons/cel.ico',
];
const CDN = /^https:\/\/(fonts\.googleapis\.com|fonts\.gstatic\.com|cdnjs\.cloudflare\.com|cdn\.jsdelivr\.net)\//;

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(APP)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== VERSION && k !== 'cel-cdn').map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin === location.origin) {
    // Eigen bestanden: eerst het netwerk (altijd de nieuwste versie), anders de opgeslagen kopie
    e.respondWith(fetch(req).then((res) => {
      if (res.ok) { const copy = res.clone(); caches.open(VERSION).then((c) => c.put(req, copy)); }
      return res;
    }).catch(() => caches.match(req, { ignoreSearch: true }).then((r) => r || caches.match('index.html'))));
  } else if (CDN.test(req.url)) {
    // Lettertypen en bibliotheken: opgeslagen kopie gebruiken, op de achtergrond verversen
    e.respondWith(caches.open('cel-cdn').then((c) => c.match(req).then((hit) => {
      const net = fetch(req).then((res) => { if (res.ok || res.type === 'opaque') c.put(req, res.clone()); return res; }).catch(() => hit);
      return hit || net;
    })));
  }
});
