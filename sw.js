/* Inkt — service worker: bewaart de app lokaal zodat hij ook start als de server uit staat of er geen internet is. */
const VERSION = 'inkt-v12';
const APP = [
  './', 'index.html', 'manifest.webmanifest', 'css/app.css', 'css/document.css',
  'js/core.js', 'js/ui.js', 'js/format.js', 'js/layout.js', 'js/insert.js', 'js/objects.js', 'js/references.js',
  'js/review.js', 'js/mailings.js', 'js/docx.js', 'js/file.js',
  'js/layout-extra.js', 'js/references-extra.js', 'js/mailings-extra.js', 'js/review-extra.js', 'js/view-extra.js', 'js/file-extra.js',
  'js/autocorrect.js', 'js/start-extra.js', 'js/insert-extra.js', 'js/draw.js', 'css/extra.css',
  'js/native.js', 'js/gedeelde-map.js', 'js/start-screen.js', 'js/delen.js', 'js/opslag.js', 'js/veilig.js', 'js/lint.js', 'js/import-extra.js', 'js/docx-import.js', 'js/lang/en.js', 'js/lang/en-inkt.js', 'js/lang/en-inkt-2.js', 'js/lang/en-inkt-3.js', 'js/lang/en-inkt-tpl.js', 'js/lang/en-inkt-4.js', 'js/i18n.js', 'js/main.js',
  'icons/icon-192.png', 'icons/icon-512.png', 'icons/inkt.ico',
  // offline bibliotheken en lettertypen (geen internet nodig)
  'vendor/jszip.min.js', 'vendor/mammoth.browser.min.js', 'vendor/katex/katex.min.js', 'vendor/katex/katex.min.css', 'fonts/fonts.css', 'fonts/inter-1.woff2', 'fonts/inter-2.woff2', 'fonts/inter-3.woff2', 'fonts/inter-4.woff2', 'fonts/inter-5.woff2', 'fonts/inter-6.woff2', 'fonts/inter-7.woff2', 'fonts/material-symbols-outlined.woff2', 'vendor/katex/fonts/KaTeX_AMS-Regular.woff2', 'vendor/katex/fonts/KaTeX_Caligraphic-Bold.woff2', 'vendor/katex/fonts/KaTeX_Caligraphic-Regular.woff2', 'vendor/katex/fonts/KaTeX_Fraktur-Bold.woff2', 'vendor/katex/fonts/KaTeX_Fraktur-Regular.woff2', 'vendor/katex/fonts/KaTeX_Main-Bold.woff2', 'vendor/katex/fonts/KaTeX_Main-BoldItalic.woff2', 'vendor/katex/fonts/KaTeX_Main-Italic.woff2', 'vendor/katex/fonts/KaTeX_Main-Regular.woff2', 'vendor/katex/fonts/KaTeX_Math-BoldItalic.woff2', 'vendor/katex/fonts/KaTeX_Math-Italic.woff2', 'vendor/katex/fonts/KaTeX_SansSerif-Bold.woff2', 'vendor/katex/fonts/KaTeX_SansSerif-Italic.woff2', 'vendor/katex/fonts/KaTeX_SansSerif-Regular.woff2', 'vendor/katex/fonts/KaTeX_Script-Regular.woff2', 'vendor/katex/fonts/KaTeX_Size1-Regular.woff2', 'vendor/katex/fonts/KaTeX_Size2-Regular.woff2', 'vendor/katex/fonts/KaTeX_Size3-Regular.woff2', 'vendor/katex/fonts/KaTeX_Size4-Regular.woff2', 'vendor/katex/fonts/KaTeX_Typewriter-Regular.woff2',
];
const CDN = /^https:\/\/(fonts\.googleapis\.com|fonts\.gstatic\.com|cdnjs\.cloudflare\.com|cdn\.jsdelivr\.net)\//;

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(APP)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== VERSION && k !== 'inkt-cdn').map((k) => caches.delete(k)))).then(() => self.clients.claim()));
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
    e.respondWith(caches.open('inkt-cdn').then((c) => c.match(req).then((hit) => {
      const net = fetch(req).then((res) => { if (res.ok || res.type === 'opaque') c.put(req, res.clone()); return res; }).catch(() => hit);
      return hit || net;
    })));
  }
});
