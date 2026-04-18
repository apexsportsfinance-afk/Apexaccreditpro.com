import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";

console.log("🚀 main.jsx: Mounting application...");

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
