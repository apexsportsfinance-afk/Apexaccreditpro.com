import { useResolvedFileUrl } from "../../lib/storage/useResolvedFileUrl";

/**
 * Drop-in replacement for <a href={storedUrl}> file/document links whose href is
 * a STORED file reference (a bare in-bucket path or a stored URL). Resolves
 * through the storage layer so the link works in both public and private
 * (signed-URL) modes. In public mode (flag off, default) it renders
 * byte-identically to a plain <a>.
 *
 * Storage options: `bucket`, `expiresIn`. All other props forward to <a>.
 */
export default function StorageLink({ href, bucket, expiresIn, children, ...anchorProps }) {
  const { url } = useResolvedFileUrl(href, { bucket, expiresIn });
  // Pass through undefined (not null) when unresolved so it matches a plain
  // `<a href={value}>` with a falsy value.
  return (
    <a href={url ?? undefined} {...anchorProps}>
      {children}
    </a>
  );
}
