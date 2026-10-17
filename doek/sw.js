/* Doek (gemaakt door JJ van Schelven) — service worker: bewaart de app lokaal zodat hij ook start als de server uit staat of er geen internet is. */
const VERSION = 'doek-v3';
const APP = [
  './', 'index.html', 'manifest.webmanifest', 'css/app.css', 'css/slides.css',
  'js/core.js', 'js/themes.js', 'js/model.js', 'js/text.js', 'js/shapes.js', 'js/charts.js', 'js/diagrams.js', 'js/geo.js', 'js/render.js', 'js/ui.js', 'js/stage.js',
  'js/editor.js', 'js/textedit.js', 'js/textfmt.js', 'js/thumbs.js', 'js/objects.js', 'js/format.js', 'js/picture.js', 'js/tables.js', 'js/panes.js', 'js/chartui.js', 'js/diagramui.js', 'js/design.js', 'js/view.js', 'js/media.js', 'js/links.js',
  'js/anim.js', 'js/transitions.js', 'js/show.js', 'js/review.js', 'js/file.js', 'js/pptx.js', 'js/pptx-read.js', 'js/export.js', 'js/video.js', 'js/native.js', 'js/delen.js',
  'js/gedeelde-map.js', 'js/start-screen.js', 'js/opslag.js', 'js/lang/en.js', 'js/lang/en-doek.js', 'js/lang/en-doek-2.js', 'js/lang/en-shapes.js',
  'js/lang/en-charts.js', 'js/lang/en-diagrams.js', 'js/i18n.js', 'js/main.js',
  'icons/icon-192.png', 'icons/icon-512.png', 'icons/doek.ico',
  // offline bibliotheken en lettertypen (geen internet nodig)
  'vendor/jszip.min.js', 'vendor/katex/katex.min.js', 'vendor/katex/katex.min.css', 'fonts/fonts.css', 'fonts/material-symbols-outlined.woff2',
  'fonts/inter-1.woff2', 'fonts/inter-2.woff2', 'fonts/inter-3.woff2', 'fonts/inter-4.woff2', 'fonts/inter-5.woff2', 'fonts/inter-6.woff2', 'fonts/inter-7.woff2',
];

self.addEventListener('install', (e) => {
  // ontbrekende bestanden mogen de installatie niet blokkeren
  e.waitUntil(caches.open(VERSION).then((c) => Promise.all(APP.map((u) => c.add(u).catch(() => null)))).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin || url.pathname.startsWith('/deel')) return;
  // Eigen bestanden: eerst het netwerk (altijd de nieuwste versie), anders de opgeslagen kopie
  e.respondWith(fetch(req).then((res) => {
    if (res.ok) { const copy = res.clone(); caches.open(VERSION).then((c) => c.put(req, copy)); }
    return res;
  }).catch(() => caches.match(req, { ignoreSearch: true }).then((r) => r || caches.match('index.html'))));
});
