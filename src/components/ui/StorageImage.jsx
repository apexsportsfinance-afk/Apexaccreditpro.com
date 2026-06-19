import { useResolvedFileUrl } from "../../lib/storage/useResolvedFileUrl";

/**
 * Drop-in replacement for <img> whose `src` is a STORED file reference (a bare
 * in-bucket path or a stored URL). Resolves through the storage layer so the
 * same markup works in both public and private (signed-URL) modes. In public
 * mode (flag off, default) it renders byte-identically to a plain <img>.
 *
 * Storage options: `bucket`, `expiresIn`. All other props forward to <img>.
 */
export default function StorageImage({ src, bucket, expiresIn, ...imgProps }) {
  const { url } = useResolvedFileUrl(src, { bucket, expiresIn });
  // Pass through undefined (not null) when unresolved so the <img> matches a
  // plain `<img src={value}>` with a falsy value.
  return <img src={url ?? undefined} {...imgProps} />;
}
