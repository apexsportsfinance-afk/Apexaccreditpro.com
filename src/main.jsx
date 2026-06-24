import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";

console.log("🚀 main.jsx: Mounting application...");

// Auto-reload when Vercel deploys new chunks and the old chunk URL is no longer valid.
// Without this, users on a stale tab get "Failed to fetch dynamically imported module"
// on every lazy-loaded route after a deployment. A reload fetches the fresh HTML + new chunks.
window.addEventListener("vite:preloadError", () => {
  window.location.reload();
});

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// APX-FIX: Offline Shield REMOVED. A stale service worker (the Offline Shield,
// plus an earlier Workbox PWA worker from the institutional build) kept serving
// cached assets after deploys, which broke Supabase calls and admin login.
//
// We no longer register any worker. We DO proactively unregister any that exist
// and purge their caches, so fresh tabs self-clean. Already-stuck tabs are
// rescued by the kill-switch in /service-worker.js (the browser re-fetches that
// script on navigation even when the page itself is served from cache).
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations()
    .then((registrations) => registrations.forEach((r) => r.unregister()))
    .catch(() => {});
  if (window.caches) {
    caches.keys()
      .then((keys) => keys.forEach((k) => caches.delete(k)))
      .catch(() => {});
  }
}
