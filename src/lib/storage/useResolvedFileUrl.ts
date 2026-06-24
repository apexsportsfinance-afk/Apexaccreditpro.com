import { useEffect, useState } from "react";
import { resolveFileUrl, resolveFileUrlSync, type FileUrlOptions } from "./fileUrl";

/**
 * Resolve a stored file reference (bare path OR stored URL) into a usable URL,
 * giving every render site ONE contract across public/private storage modes.
 *
 * Public mode (flag off, default): resolves synchronously on first render —
 * byte-identical to using the stored value directly, no flicker, no extra
 * render. Private mode (flag on): fetches a short-lived signed URL; `loading`
 * is true until it arrives. Re-resolves when the stored value changes and
 * ignores stale resolutions on unmount/value change.
 */
export function useResolvedFileUrl(
  value: string | null | undefined,
  opts: FileUrlOptions = {}
): { url: string | null; loading: boolean } {
  const { bucket, expiresIn } = opts;

  // Synchronous best-guess: real URL in public mode, null when signing is
  // required. Keeps the common (flag-off) path identical to today.
  const initial = resolveFileUrlSync(value, { bucket, expiresIn });
  const [url, setUrl] = useState<string | null>(initial);
  const [loading, setLoading] = useState<boolean>(Boolean(value) && initial === null);

  useEffect(() => {
    if (!value) {
      setUrl(null);
      setLoading(false);
      return;
    }
    const sync = resolveFileUrlSync(value, { bucket, expiresIn });
    if (sync !== null) {
      // Public mode: nothing async to do.
      setUrl(sync);
      setLoading(false);
      return;
    }
    // Private mode: fetch a signed URL.
    let active = true;
    setLoading(true);
    resolveFileUrl(value, { bucket, expiresIn })
      .then((resolved) => {
        if (!active) return;
        setUrl(resolved);
        setLoading(false);
      })
      .catch(() => {
        if (!active) return;
        setUrl(null);
        setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [value, bucket, expiresIn]);

  return { url, loading };
}
