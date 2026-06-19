import { useEffect, useState } from "react";
import { supabase } from "../supabase";
import { isPrivateStorageEnabled, parseStorageRef, resolveFileUrlSync } from "./fileUrl";

// Public signed-URL resolver for ANONYMOUS pages (badge verify, scanner,
// registration, card previews).
//
// Authed pages can client-sign storage objects (resolveFileUrl / StorageImage),
// but anonymous users cannot create signed URLs against a private bucket. Once
// VITE_PRIVATE_STORAGE is on, these public surfaces resolve their assets through
// the `public-verify-assets` edge function instead: it re-derives an allowlist
// server-side (service role) and signs only the assets that the requested
// verification context legitimately exposes. See
// supabase/functions/public-verify-assets/index.ts.
//
//   flag OFF (default) -> public URLs, resolved synchronously (identical to today)
//   flag ON            -> one edge-fn round-trip returns short-lived signed URLs
//
// The eventual cutover stays a flag flip, never a data backfill.

const FN_NAME = "public-verify-assets";

/**
 * Resolve a batch of stored values (bare paths OR stored URLs) to usable URLs
 * for an anonymous surface. Keyed by the ORIGINAL value so call sites can read
 * `urls[value]` regardless of mode.
 *
 * @param {Array<string|null|undefined>} values
 * @param {object} [opts]
 * @param {string} [opts.accreditationId] - required for scope "profile"
 * @param {string} [opts.eventId] - required for scope "branding"/"gallery"/"live"
 * @param {"profile"|"branding"|"gallery"|"live"} [opts.scope]
 * @param {number} [opts.expiresIn] - signed-URL lifetime (seconds), private mode
 * @returns {Promise<Record<string, string|null>>}
 */
export async function resolvePublicAssetUrls(values, opts = {}) {
  const { accreditationId, eventId, scope = "profile", expiresIn } = opts;
  const list = [...new Set((values || []).filter(Boolean))];
  const out = {};
  if (list.length === 0) return out;

  if (!isPrivateStorageEnabled()) {
    // Public mode (default): unchanged behaviour — paths -> public URL, stored
    // URLs returned as-is.
    for (const v of list) out[v] = resolveFileUrlSync(v);
    return out;
  }

  // Private mode: external URLs we don't own (flagcdn, data:, blob:) pass
  // through; our own storage refs are sent as normalized paths for signing.
  const pathByValue = {};
  for (const v of list) {
    const ref = parseStorageRef(v);
    if (!ref) {
      out[v] = v; // not ours — leave untouched
      continue;
    }
    pathByValue[v] = ref.path;
  }

  const paths = [...new Set(Object.values(pathByValue))];
  if (paths.length === 0) return out;

  let signed = {};
  try {
    const { data, error } = await supabase.functions.invoke(FN_NAME, {
      body: { accreditationId, eventId, scope, paths, expiresIn },
    });
    if (error) throw error;
    signed = data?.urls || {};
  } catch (err) {
    console.error("resolvePublicAssetUrls error:", err?.message || err);
  }

  for (const [v, p] of Object.entries(pathByValue)) {
    out[v] = signed[p] ?? null;
  }
  return out;
}

/** Public-mode synchronous seed: real URLs (flag off) or {} (flag on). */
function seedUrls(values) {
  if (isPrivateStorageEnabled()) return {};
  const out = {};
  for (const v of (values || []).filter(Boolean)) out[v] = resolveFileUrlSync(v);
  return out;
}

/**
 * Hook wrapper around resolvePublicAssetUrls for render sites. Returns a map
 * keyed by the original stored value. In public mode it resolves synchronously
 * on first render (no flicker, no extra round-trip); in private mode it issues a
 * single edge-fn request for the whole batch and ignores stale resolutions.
 *
 * @param {Array<string|null|undefined>} values
 * @param {object} [opts] - same shape as resolvePublicAssetUrls opts
 * @returns {{ urls: Record<string, string|null>, loading: boolean }}
 */
export function usePublicAssetUrls(values, opts = {}) {
  const { accreditationId, eventId, scope, expiresIn } = opts;
  const [urls, setUrls] = useState(() => seedUrls(values));

  // Stable dependency over the (de-duplicated) value list.
  const key = [...new Set((values || []).filter(Boolean))].join("|");
  const privateMode = isPrivateStorageEnabled();
  const [loading, setLoading] = useState(privateMode && Boolean(key));

  useEffect(() => {
    if (!privateMode) {
      setUrls(seedUrls(values));
      setLoading(false);
      return;
    }
    if (!key) {
      setUrls({});
      setLoading(false);
      return;
    }
    let active = true;
    setLoading(true);
    resolvePublicAssetUrls(key.split("|"), { accreditationId, eventId, scope, expiresIn })
      .then((map) => {
        if (!active) return;
        setUrls(map);
        setLoading(false);
      })
      .catch(() => {
        if (!active) return;
        setLoading(false);
      });
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, accreditationId, eventId, scope, expiresIn, privateMode]);

  return { urls, loading };
}
