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

// APX-101: Global Offline Shield Registration
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
      // Auto-unregister any existing service workers on localhost to prevent local dev offline-locks
      navigator.serviceWorker.getRegistrations().then((registrations) => {
        for (let registration of registrations) {
          registration.unregister();
          console.log('🛡️ Unregistered Service Worker on localhost');
        }
      });
      return;
    }
    
    navigator.serviceWorker.register('/service-worker.js')
      .then(reg => console.log('🛡️ Apex Offline Shield Active:', reg.scope))
      .catch(err => console.error('🛡️ Offline Shield failed:', err));
  });
}
