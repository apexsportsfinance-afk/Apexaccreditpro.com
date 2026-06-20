import { supabase } from "./supabase";
import { GlobalSettingsAPI } from "./broadcastApi";

// Scanner-gate PIN verification.
//
// Today the gate compares PINs IN THE BROWSER: the event PIN is fetched to the
// client and the global fallback is `VITE_SCANNER_PIN`, baked into the public
// bundle — anyone with devtools can recover it. The `verify-scanner-pin` edge
// function moves the comparison server-side (timing-safe) and returns only a
// boolean, so the secret never reaches the client.
//
// This is gated so the cutover is a flag flip, not a blind change to a core
// auth gate:
//   flag OFF (default) -> exact current client-side comparison (zero regression)
//   flag ON            -> one edge-fn round-trip; fails CLOSED on any error
//
// See docs/runbooks/SCANNER_PIN_server_side.md.

const FN_NAME = "verify-scanner-pin";

/** True when the server-side scanner-PIN check is enabled for this build. */
export function isServerScannerPinEnabled() {
  return import.meta.env?.VITE_SERVER_SCANNER_PIN === "true";
}

/**
 * Verify a scanner PIN for an (optional) event.
 *
 * Flag ON: delegates to the edge function and never trusts the client; returns
 * false on any network/server error (fail closed). Flag OFF: reproduces today's
 * behaviour exactly — event PIN from global_settings, then the VITE_SCANNER_PIN
 * global fallback — and lets a settings-fetch error propagate so callers can
 * still surface a "Connection Error" (unchanged UX).
 *
 * @param {string} [eventId]
 * @param {string} pin
 * @returns {Promise<boolean>}
 */
export async function verifyScannerPin(eventId, pin) {
  if (!pin) return false;

  if (isServerScannerPinEnabled()) {
    try {
      const { data, error } = await supabase.functions.invoke(FN_NAME, {
        body: { eventId: eventId || undefined, pin },
      });
      if (error) throw error;
      return data?.valid === true;
    } catch (err) {
      console.error("verifyScannerPin error:", err?.message || err);
      return false; // fail closed — never authorise on an error
    }
  }

  // Flag OFF (default): today's client-side comparison, unchanged.
  let valid = false;
  if (eventId) {
    const customPin = await GlobalSettingsAPI.get(`event_${eventId}_scanner_pin`);
    if (customPin && pin === customPin) valid = true;
  }
  const defaultPin = import.meta.env?.VITE_SCANNER_PIN;
  if (!valid && defaultPin && pin === defaultPin) valid = true;
  return valid;
}
