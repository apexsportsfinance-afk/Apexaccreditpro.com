import { supabase } from "../supabase";

// [APX-SEC] Signed-URL helper for the storage privacy cutover.
//
// Today, sensitive documents (ID/passport/medical) live in a bucket served via
// getPublicUrl (protected only by unguessable filenames). The institutional
// target is PRIVATE buckets + short-lived signed URLs. This helper is the
// additive first step: once the bucket is flipped to private, swap getPublicUrl
// call sites over to getSignedFileUrl. See docs/EDGE_MIGRATION.md (storage).
//
// Until the bucket is private, getPublicUrl still works; introducing this does
// not change current behavior anywhere on its own.

const DEFAULT_BUCKET = "accreditation-files";
const DEFAULT_EXPIRY_SECONDS = 60 * 60; // 1 hour

/**
 * Create a short-lived signed URL for a stored file.
 * @param {string} filePath - path within the bucket (e.g. "passports/abc.jpg")
 * @param {object} [opts]
 * @param {string} [opts.bucket]
 * @param {number} [opts.expiresIn] - seconds
 * @returns {Promise<string|null>}
 */
export async function getSignedFileUrl(filePath, opts = {}) {
  if (!filePath) return null;
  const bucket = opts.bucket || DEFAULT_BUCKET;
  const expiresIn = opts.expiresIn || DEFAULT_EXPIRY_SECONDS;

  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUrl(filePath, expiresIn);

  if (error) {
    console.error("Signed URL error:", error.message);
    return null;
  }
  return data?.signedUrl || null;
}

/**
 * Batch helper — sign many paths at once.
 * @param {string[]} filePaths
 * @param {object} [opts]
 * @returns {Promise<Record<string,string|null>>} map of path -> signed url
 */
export async function getSignedFileUrls(filePaths = [], opts = {}) {
  const entries = await Promise.all(
    filePaths.map(async (p) => [p, await getSignedFileUrl(p, opts)])
  );
  return Object.fromEntries(entries);
}
