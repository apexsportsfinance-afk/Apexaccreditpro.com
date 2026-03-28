// Minimum service worker to satisfy PWA install requirements
self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('fetch', (event) => {
  // Pass-through for all requests
  event.respondWith(fetch(event.request));
});
