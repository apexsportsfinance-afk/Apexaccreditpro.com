import { supabase } from "../supabase";
import { getSignedFileUrl } from "./signedUrl";

// Unified file-URL resolver for the storage privacy cutover.
//
// Today the bucket is PUBLIC and files are served via getPublicUrl. The
// institutional target is a PRIVATE bucket + short-lived signed URLs. This
// resolver lets the app move to ONE async call contract now, while behaviour
// stays byte-identical to today until the `VITE_PRIVATE_STORAGE` flag is turned
// on — which happens only AFTER the bucket is flipped to private and verified on
// staging (see docs/STAGING_CLOUDFLARE.md and docs/INSTITUTIONAL_ROADMAP.md
// Phase 0). Introducing this module changes nothing on its own: nothing imports
// it yet, and the flag defaults off.
//
//   flag OFF (default) -> public URL   (identical to current behaviour)
//   flag ON            -> signed URL

const DEFAULT_BUCKET = "accreditation-files";

/** Whether the private-storage (signed-URL) mode is enabled via env flag. */
export function isPrivateStorageEnabled() {
  return import.meta.env?.VITE_PRIVATE_STORAGE === "true";
}

/** Synchronous public URL — today's behaviour. Returns null for empty input. */
export function getPublicFileUrl(filePath, opts = {}) {
  if (!filePath) return null;
  const bucket = opts.bucket || DEFAULT_BUCKET;
  const { data } = supabase.storage.from(bucket).getPublicUrl(filePath);
  return data?.publicUrl || null;
}

/**
 * Resolve a stored file path to a URL. Always async so every call site has ONE
 * contract regardless of public/private mode — making the eventual cutover a
 * flag flip rather than a code change.
 * @param {string} filePath - path within the bucket (e.g. "passports/abc.jpg")
 * @param {object} [opts]
 * @param {string} [opts.bucket]
 * @param {number} [opts.expiresIn] - signed-URL lifetime (seconds), private mode
 * @returns {Promise<string|null>}
 */
export async function resolveFileUrl(filePath, opts = {}) {
  if (!filePath) return null;
  return isPrivateStorageEnabled()
    ? getSignedFileUrl(filePath, opts)
    : getPublicFileUrl(filePath, opts);
}
