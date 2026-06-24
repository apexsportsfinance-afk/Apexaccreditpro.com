// Observability shim — a single seam for error/event capture.
//
// It's the integration point for Sentry without scattering vendor calls across
// the app. Sentry is loaded LAZILY (dynamic import) and ONLY when
// VITE_SENTRY_DSN is set, so with no DSN the vendor code is never fetched and
// the seam falls back to the console — zero runtime cost, no build coupling.
//
// To turn it on: set VITE_SENTRY_DSN in the environment (and redeploy). That's it.

const DSN = import.meta.env?.VITE_SENTRY_DSN;
const ENV = import.meta.env?.MODE || "development";

let backend = null; // set to the Sentry client once initialized

export async function initObservability() {
  if (!DSN) return; // no-op until a DSN is configured
  try {
    const Sentry = await import("@sentry/react");
    Sentry.init({
      dsn: DSN,
      environment: ENV,
      // Conservative trace sampling — errors are always captured; traces are a
      // 10% sample to keep cost/volume sane. Tune once real traffic is seen.
      tracesSampleRate: 0.1,
    });
    backend = Sentry;
  } catch (e) {
    console.warn("Observability init skipped:", e?.message);
  }
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
