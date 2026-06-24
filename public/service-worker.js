// APX-FIX (heatsheet-on-stable): SERVICE-WORKER KILL SWITCH.
//
// The previous "Offline Shield" worker — and an earlier Workbox PWA worker from
// the institutional build — kept serving STALE cached assets after deploys,
// which broke every Supabase call and rejected admin logins (the app was
// running an old cached bundle against the live API).
//
// Browsers always re-fetch the worker script itself on navigation to check for
// updates, even when the page is served from cache. So this replacement worker
// is the one thing that can reach an already-stuck client: it takes control,
// purges every cache, unregisters itself, and reloads open tabs so all clients
// converge on the live network app. Paired with main.jsx no longer registering
// a worker, this fully removes service-worker caching.

self.addEventListener('install', () => {
  // Activate immediately instead of waiting for the old worker to release.
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    // 1. Delete every cache (Offline Shield + Workbox precaches).
    try {
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => caches.delete(k)));
    } catch (e) { /* best-effort */ }

    // 2. Remove this registration so no worker controls the site anymore.
    try { await self.registration.unregister(); } catch (e) { /* best-effort */ }

    // 3. Reload any open tabs so they re-fetch the fresh app from the network.
    try {
      const clients = await self.clients.matchAll({ type: 'window' });
      for (const client of clients) {
        client.navigate(client.url);
      }
    } catch (e) { /* best-effort */ }
  })());
});

// No fetch handler on purpose: never intercept requests — everything goes
// straight to the network.
