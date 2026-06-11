// ByteShards service worker — minimal, no aggressive caching.
self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", (event) => {
  // Passthrough: let the network handle everything.
  event.respondWith(fetch(event.request));
});
