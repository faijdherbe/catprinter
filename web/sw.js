// Cache-first service worker. Change VERSION after each change to a file in FILES.
const VERSION = 'catprinter-7';
const FILES = [
  './', 'index.html', 'app.js', 'render.js', 'printer.js', 'manifest.webmanifest', 'icons/192.png', 'icons/512.png',
  'lib/beer.min.css', 'lib/beer.min.js', 'lib/material-dynamic-colors.min.js', 'lib/material-symbols-outlined.woff2', 'lib/marked.esm.js',
];
self.oninstall = e => e.waitUntil(caches.open(VERSION).then(c => c.addAll(FILES)));
self.onactivate = e => e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== VERSION).map(k => caches.delete(k)))));
self.onfetch = e => e.respondWith(caches.match(e.request, {ignoreSearch: true}).then(r => r || fetch(e.request)));
