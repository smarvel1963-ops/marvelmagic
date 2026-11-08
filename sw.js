// sw.js
// Save to: C:\MarvelApps\marvelmagic\sw.js
// Makes the app installable. It caches nothing, so every open gets the current build and listings.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));
self.addEventListener('fetch', e => e.respondWith(fetch(e.request)));
