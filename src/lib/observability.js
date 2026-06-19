// Observability shim — a single, dependency-free seam for error/event capture.
//
// Today it routes to the console. It's the integration point for Sentry (or
// similar) without scattering vendor calls across the app. To enable Sentry:
//   1. npm i @sentry/react
//   2. set VITE_SENTRY_DSN in the environment
//   3. uncomment the dynamic-import block in initObservability()
//
// Keeping this dependency-free means the app builds and runs whether or not the
// monitoring vendor is installed — no build-time coupling.

const DSN = import.meta.env?.VITE_SENTRY_DSN;
const ENV = import.meta.env?.MODE || "development";

let backend = null; // set to the Sentry client once initialized

export async function initObservability() {
  if (!DSN) return; // no-op until configured
  // --- Enable after installing @sentry/react ---
  // try {
  //   const Sentry = await import("@sentry/react");
  //   Sentry.init({ dsn: DSN, environment: ENV, tracesSampleRate: 0.1 });
  //   backend = Sentry;
  // } catch (e) {
  //   console.warn("Observability init skipped:", e?.message);
  // }
}

/** Report a handled error with optional context. */
export function captureError(error, context = {}) {
  if (backend?.captureException) {
    backend.captureException(error, { extra: context });
  } else {
    console.error("[captureError]", error, context);
  }
}

/** Record a breadcrumb / structured event. */
export function captureEvent(name, data = {}) {
  if (backend?.captureMessage) {
    backend.captureMessage(name, { level: "info", extra: data });
  } else if (ENV !== "production") {
    console.info("[event]", name, data);
  }
}
