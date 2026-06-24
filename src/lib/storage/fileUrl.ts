import { supabase } from "../supabase";
import { getSignedFileUrl, type SignedUrlOptions } from "./signedUrl";

// Unified file-URL resolver for the storage privacy cutover.
//
// Today the bucket is PUBLIC and files are served via getPublicUrl. The
// institutional target is a PRIVATE bucket + short-lived signed URLs. This
// resolver lets the app move to ONE async call contract now, while behaviour
// stays byte-identical to today until the `VITE_PRIVATE_STORAGE` flag is turned
// on — which happens only AFTER the bucket is flipped to private and verified on
// staging (see docs/STAGING_CLOUDFLARE.md and docs/INSTITUTIONAL_ROADMAP.md
// Phase 0).
//
//   flag OFF (default) -> public URL   (identical to current behaviour)
//   flag ON            -> signed URL
//
// Call sites historically store EITHER a bare path ("registrations/ab.jpg") OR a
// full public URL (".../storage/v1/object/public/accreditation-files/..."). To
// make the cutover a flag flip — not a data backfill — this resolver accepts
// both: when private mode is on it extracts the bucket+path from a stored
// Supabase URL and signs it; external/non-storage URLs are passed through
// untouched (we can't sign someone else's host).

const DEFAULT_BUCKET = "accreditation-files";

// Matches Supabase Storage object URLs:
//   /storage/v1/object/public/<bucket>/<path>
//   /storage/v1/object/sign/<bucket>/<path>?token=...
//   /storage/v1/object/authenticated/<bucket>/<path>
const STORAGE_URL_RE =
  /\/storage\/v1\/object\/(?:public|sign|authenticated)\/([^/]+)\/(.+)$/;

export interface StorageRef {
  bucket: string;
  path: string;
}

export interface FileUrlOptions extends SignedUrlOptions {}

/** Whether a stored value is an absolute URL (vs a bare in-bucket path). */
function isAbsoluteUrl(value: string): boolean {
  return /^(?:https?:|data:|blob:)/i.test(value);
}

/**
 * Normalise a stored value (bare path OR full Supabase URL) to { bucket, path }.
 * Returns null when the value is an external/non-storage URL we don't own.
 */
export function parseStorageRef(
  value: string | null | undefined,
  defaultBucket: string = DEFAULT_BUCKET
): StorageRef | null {
  if (!value) return null;
  if (!isAbsoluteUrl(value)) {
    // Already a bare in-bucket path.
    return { bucket: defaultBucket, path: value.replace(/^\/+/, "") };
  }
  const match = value.match(STORAGE_URL_RE);
  if (!match) return null; // external URL (flagcdn, data:, blob:, etc.)
  const [, bucket, rest] = match;
  // Strip any query string (signed URLs carry ?token=...) and decode.
  const path = decodeURIComponent(rest.split("?")[0]);
  return { bucket, path };
}

/** Whether the private-storage (signed-URL) mode is enabled via env flag. */
export function isPrivateStorageEnabled(): boolean {
  return import.meta.env?.VITE_PRIVATE_STORAGE === "true";
}

/** Synchronous public URL — today's behaviour. Returns null for empty input. */
export function getPublicFileUrl(
  filePath: string | null | undefined,
  opts: FileUrlOptions = {}
): string | null {
  if (!filePath) return null;
  const bucket = opts.bucket || DEFAULT_BUCKET;
  const { data } = supabase.storage.from(bucket).getPublicUrl(filePath);
  return data?.publicUrl || null;
}

/**
 * Synchronous resolution for PUBLIC mode (today's behaviour): a bare path
 * becomes a public URL, a stored absolute URL is returned verbatim. Returns
 * null when private mode is on (signing requires an async round-trip — use
 * resolveFileUrl / useResolvedFileUrl there). Lets render sites stay flicker-free
 * and byte-identical to today while the flag is off.
 */
export function resolveFileUrlSync(
  value: string | null | undefined,
  opts: FileUrlOptions = {}
): string | null {
  if (!value) return null;
  if (isPrivateStorageEnabled()) return null;
  return isAbsoluteUrl(value) ? value : getPublicFileUrl(value, opts);
}

/**
 * Resolve a stored file reference to a usable URL. Always async so every call
 * site has ONE contract regardless of public/private mode — making the eventual
 * cutover a flag flip rather than a code change.
 *
 * Accepts a bare path ("registrations/ab.jpg") OR a full stored URL. With the
 * flag OFF, behaviour is byte-identical to today (paths -> public URL, stored
 * URLs returned as-is). With the flag ON, our own storage references are signed;
 * external URLs are passed through unchanged.
 */
export async function resolveFileUrl(
  value: string | null | undefined,
  opts: FileUrlOptions = {}
): Promise<string | null> {
  if (!value) return null;

  if (!isPrivateStorageEnabled()) {
    // Public mode (default): unchanged behaviour. A stored absolute URL is
    // returned verbatim; a bare path is turned into a public URL.
    return resolveFileUrlSync(value, opts);
  }

  // Private mode: sign our own storage references; pass through anything else.
  const ref = parseStorageRef(value, opts.bucket || DEFAULT_BUCKET);
  if (!ref) return value; // external URL we can't sign
  return getSignedFileUrl(ref.path, { ...opts, bucket: ref.bucket });
}
