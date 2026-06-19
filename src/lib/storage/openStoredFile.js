import { resolveFileUrl, resolveFileUrlSync } from "./fileUrl";

// Imperative counterpart to <StorageImage>/<StorageLink> for "open/download this
// stored file in a new tab" click handlers. Resolves a stored reference (bare
// in-bucket path OR a legacy stored URL) through the storage layer so the same
// call works in both public and private (signed-URL) modes.
//
//   flag OFF (default) -> resolves synchronously, opens immediately
//                         (byte-identical to window.open(value, "_blank"))
//   flag ON            -> opens a blank tab inside the user gesture, then
//                         navigates it to the freshly signed URL
//
// The private-mode dance matters because signing is async: a window.open() fired
// AFTER an await is no longer "in response to a user gesture" and gets caught by
// popup blockers. So we grab the tab handle synchronously and redirect it once
// the signed URL arrives.
//
// MUST be called directly from a user-gesture handler (onClick), like
// window.open itself.

/**
 * @param {string|null|undefined} value - stored path or URL
 * @param {object} [opts]
 * @param {string} [opts.bucket]
 * @param {number} [opts.expiresIn] - signed-URL lifetime (seconds), private mode
 */
export function openStoredFile(value, opts = {}) {
  if (!value) return;

  // Public mode (default): identical to the previous window.open(value).
  const sync = resolveFileUrlSync(value, opts);
  if (sync !== null) {
    window.open(sync, "_blank");
    return;
  }

  // Private mode: hold the tab handle from the gesture, then redirect it. We
  // can't use "noopener" here (it nulls the handle), so we sever opener access
  // manually to avoid reverse-tabnabbing.
  const win = window.open("", "_blank");
  if (win) {
    try {
      win.opener = null;
    } catch {
      /* cross-origin opener may be read-only; best-effort */
    }
  }
  resolveFileUrl(value, opts)
    .then((url) => {
      if (!url) {
        win?.close();
        return;
      }
      if (win) win.location.href = url;
      else window.open(url, "_blank");
    })
    .catch(() => {
      win?.close();
    });
}
